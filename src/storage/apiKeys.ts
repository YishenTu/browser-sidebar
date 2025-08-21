/**
 * @file API Key Storage
 *
 * Secure API key storage implementation with encryption, caching, and comprehensive
 * key management features. Supports CRUD operations, rotation, usage tracking,
 * and provider-specific validation.
 *
 * Features:
 * - AES-256-GCM encryption for all stored keys
 * - Chrome storage for encrypted data sync
 * - IndexedDB for fast metadata queries
 * - LRU caching for frequently accessed keys
 * - Batch operations for performance
 * - Comprehensive audit logging
 * - Data integrity verification
 * - Secure memory cleanup
 */

import type {
  APIProvider,
  CreateAPIKeyInput,
  UpdateAPIKeyInput,
  APIKeyQueryOptions,
  APIKeyListResult,
  KeyRotationResult,
  APIKeyUsageStats,
  ConnectionTestResult,
  HealthCheckResult,
  ImportResult,
  EncryptedAPIKey,
  APIKeyStorage,
  APIKeyMetadata,
} from '../types/apiKeys';

import {
  validateKeyFormat,
  detectProvider,
  maskAPIKey,
  generateKeyId,
} from '../types/apiKeys';

import { EncryptionService } from '../security/encryptionService';
import { dbInstance } from './indexedDB';
import * as chromeStorage from './chromeStorage';
import { hashData } from '../security/crypto';
import { OBJECT_STORES } from './schema';

// =============================================================================
// Constants and Configuration
// =============================================================================

/** Storage keys for Chrome storage */
const STORAGE_KEYS = {
  API_KEY: 'api_key_',
  API_KEY_CACHE: 'api_key_cache_',
  API_KEY_INDEX: 'api_key_index',
  MIGRATION_STATUS: 'api_key_migration_status'
} as const;

/** Database store names */
const DB_STORES = {
  METADATA: OBJECT_STORES.API_KEYS,
  USAGE_STATS: OBJECT_STORES.API_KEY_USAGE,
  AUDIT_LOG: OBJECT_STORES.API_KEY_AUDIT
} as const;

/** Cache configuration */
const CACHE_CONFIG = {
  MAX_SIZE: 100,
  TTL_MS: 30 * 60 * 1000, // 30 minutes
  CLEANUP_INTERVAL_MS: 5 * 60 * 1000 // 5 minutes
} as const;

/** Performance thresholds */
const PERFORMANCE_THRESHOLDS = {
  BATCH_SIZE: 50,
  QUERY_TIMEOUT_MS: 5000,
  CONNECTION_TIMEOUT_MS: 10000
} as const;

/** Provider API endpoints for connection testing */
const PROVIDER_ENDPOINTS = {
  openai: 'https://api.openai.com/v1/models',
  anthropic: 'https://api.anthropic.com/v1/complete',
  google: 'https://generativelanguage.googleapis.com/v1/models',
  custom: null
} as const;

// =============================================================================
// State Management
// =============================================================================

/** Service state */
interface ServiceState {
  isInitialized: boolean;
  encryptionService: EncryptionService;
  cache: Map<string, CacheEntry>;
  cacheCleanupInterval: NodeJS.Timeout | null;
  metrics: ServiceMetrics;
}

/** Cache entry structure */
interface CacheEntry {
  key: EncryptedAPIKey;
  timestamp: number;
  accessCount: number;
}

/** Service metrics for monitoring */
interface ServiceMetrics {
  totalKeys: number;
  cacheHits: number;
  cacheMisses: number;
  operationCounts: Record<string, number>;
  lastCleanup: number;
}

/** Global service state */
let serviceState: ServiceState = {
  isInitialized: false,
  encryptionService: EncryptionService.getInstance(),
  cache: new Map(),
  cacheCleanupInterval: null,
  metrics: {
    totalKeys: 0,
    cacheHits: 0,
    cacheMisses: 0,
    operationCounts: {},
    lastCleanup: Date.now()
  }
};

// =============================================================================
// Service Management
// =============================================================================

/**
 * Initialize the API key storage service
 */
export async function initializeStorage(password: string): Promise<void> {
  if (serviceState.isInitialized) {
    throw new Error('API key storage already initialized');
  }

  // Validate password strength
  if (password.length < 8) {
    throw new Error('Password too weak. Must be at least 8 characters long');
  }

  try {
    // Initialize encryption service
    await serviceState.encryptionService.initialize(password);

    // Perform data migration if needed
    await performMigrations();

    // Initialize cache cleanup
    startCacheCleanup();

    // Update metrics
    await updateMetrics();

    serviceState.isInitialized = true;

    await auditLog('service_initialized', 'system', { timestamp: Date.now() });

  } catch (error) {
    throw new Error(`Failed to initialize API key storage: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Shutdown the storage service
 */
export async function shutdown(): Promise<void> {
  if (!serviceState.isInitialized) {
    return;
  }

  // Stop cache cleanup
  if (serviceState.cacheCleanupInterval) {
    clearInterval(serviceState.cacheCleanupInterval);
    serviceState.cacheCleanupInterval = null;
  }

  // Clear cache
  serviceState.cache.clear();

  // Shutdown encryption service
  await serviceState.encryptionService.shutdown();

  serviceState.isInitialized = false;

  await auditLog('service_shutdown', 'system', { timestamp: Date.now() });
}

// =============================================================================
// Core API Key Operations
// =============================================================================

/**
 * Add a new API key with encryption and validation
 */
export async function addAPIKey(input: CreateAPIKeyInput): Promise<EncryptedAPIKey> {
  requireInitialized();
  incrementOperationCount('add');

  try {
    // Validate API key format
    const provider = input.provider || detectProvider(input.key);
    if (!provider) {
      throw new Error('Invalid API key format - could not detect provider');
    }

    const validation = validateKeyFormat(input.key, provider);
    if (!validation.isValid) {
      throw new Error(`Invalid API key format: ${validation.errors.join(', ')}`);
    }

    // Check for duplicates
    const keyHash = await createKeyHash(input.key);
    const existingKey = await findKeyByHash(keyHash);
    if (existingKey) {
      throw new Error('API key already exists');
    }

    // Generate unique ID
    const keyId = generateKeyId(provider, keyHash);

    // Create metadata
    const metadata: APIKeyMetadata = {
      id: keyId,
      provider,
      keyType: validation.keyType || 'standard',
      status: 'active',
      name: input.name,
      description: input.description,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      maskedKey: maskAPIKey(input.key),
      permissions: input.permissions || ['read', 'write'],
      tags: input.tags || [],
      userId: undefined,
      organizationId: undefined
    };

    // Encrypt the API key
    const encryptedData = await serviceState.encryptionService.encryptData(input.key, 'text');
    
    // Create integrity checksum
    const checksum = await serviceState.encryptionService.createIntegrityChecksum(encryptedData);

    // Initialize usage stats
    const usageStats: APIKeyUsageStats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalCost: 0,
      avgRequestTime: 0,
      lastResetAt: Date.now(),
      dailyStats: [],
      weeklyStats: [],
      monthlyStats: []
    };

    // Initialize rotation status
    const rotationStatus = {
      status: 'none' as const,
      rotationHistory: []
    };

    // Create the encrypted API key object
    const encryptedAPIKey: APIKeyStorage = {
      id: keyId,
      metadata,
      encryptedData,
      keyHash,
      checksum,
      storageVersion: 1,
      configuration: input.configuration || {
        security: { encryptionLevel: 'standard' }
      },
      usageStats,
      rotationStatus
    };

    // Store in IndexedDB (metadata only)
    await dbInstance.add(DB_STORES.METADATA, metadata);

    // Store encrypted data in Chrome storage
    await chromeStorage.set(`${STORAGE_KEYS.API_KEY}${keyId}`, encryptedAPIKey);

    // Update metrics
    serviceState.metrics.totalKeys++;

    await auditLog('key_added', keyId, { 
      provider, 
      name: input.name,
      hasDescription: !!input.description,
      tags: input.tags?.length || 0
    });

    return encryptedAPIKey;

  } catch (error) {
    await auditLog('key_add_failed', 'unknown', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      provider: input.provider
    });
    
    if (error instanceof Error) {
      if (error.message.includes('Invalid API key format')) {
        throw error;
      }
      if (error.message.includes('already exists')) {
        throw error;
      }
      if (error.message.includes('Encryption failed')) {
        throw new Error('Failed to encrypt API key');
      }
      if (error.message.includes('Database error')) {
        throw new Error('Failed to store API key');
      }
      if (error.message.includes('Storage quota exceeded')) {
        throw new Error('Failed to store encrypted data');
      }
    }
    
    throw new Error(`Failed to add API key: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get and decrypt an API key by ID
 */
export async function getAPIKey(id: string): Promise<EncryptedAPIKey | null> {
  requireInitialized();
  incrementOperationCount('get');

  try {
    // Check cache first
    const cached = getCachedKey(id);
    if (cached) {
      serviceState.metrics.cacheHits++;
      await updateLastUsed(id);
      return cached;
    }

    serviceState.metrics.cacheMisses++;

    // Get metadata from IndexedDB
    const metadata = await dbInstance.get<APIKeyMetadata>(DB_STORES.METADATA, id);
    if (!metadata) {
      return null;
    }

    // Get encrypted data from Chrome storage
    const encryptedKey = await chromeStorage.get<APIKeyStorage>(`${STORAGE_KEYS.API_KEY}${id}`);
    if (!encryptedKey) {
      return null;
    }

    // Verify data integrity
    const isValid = await serviceState.encryptionService.validateIntegrityChecksum(
      encryptedKey.encryptedData,
      encryptedKey.checksum
    );

    if (!isValid) {
      await auditLog('integrity_check_failed', id, { timestamp: Date.now() });
      throw new Error('Data integrity check failed');
    }

    // Update last used timestamp
    await updateLastUsed(id);

    // Cache the result
    setCachedKey(id, encryptedKey);

    await auditLog('key_accessed', id, { timestamp: Date.now() });

    return encryptedKey;

  } catch (error) {
    await auditLog('key_access_failed', id, { 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

/**
 * Update an existing API key
 */
export async function updateAPIKey(id: string, updates: UpdateAPIKeyInput): Promise<EncryptedAPIKey> {
  requireInitialized();
  incrementOperationCount('update');

  try {
    // Get existing key
    const existingKey = await getAPIKey(id);
    if (!existingKey) {
      throw new Error('API key not found');
    }

    // Update metadata
    const updatedMetadata: APIKeyMetadata = {
      ...existingKey.metadata,
      ...updates,
      id, // Preserve ID
      provider: existingKey.metadata.provider, // Don't allow provider changes
      keyType: existingKey.metadata.keyType, // Don't allow type changes
      createdAt: existingKey.metadata.createdAt, // Preserve creation time
      lastUsed: Date.now() // Update last used
    };

    // Merge configuration
    const updatedConfiguration = {
      ...existingKey.configuration,
      ...updates.configuration
    };

    // Create updated key object
    const updatedKey: APIKeyStorage = {
      ...existingKey,
      metadata: updatedMetadata,
      configuration: updatedConfiguration
    };

    // Update in IndexedDB
    await dbInstance.update(DB_STORES.METADATA, id, updatedMetadata);

    // Update in Chrome storage
    await chromeStorage.set(`${STORAGE_KEYS.API_KEY}${id}`, updatedKey);

    // Invalidate cache
    invalidateCachedKey(id);

    await auditLog('key_updated', id, { 
      changes: Object.keys(updates),
      timestamp: Date.now()
    });

    return updatedKey;

  } catch (error) {
    await auditLog('key_update_failed', id, { 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

/**
 * Delete an API key permanently
 */
export async function deleteAPIKey(id: string): Promise<boolean> {
  requireInitialized();
  incrementOperationCount('delete');

  try {
    // Check if key exists
    const existingKey = await getAPIKey(id);
    if (!existingKey) {
      return false;
    }

    // Delete from IndexedDB
    await dbInstance.delete(DB_STORES.METADATA, id);

    // Delete from Chrome storage
    await chromeStorage.remove(`${STORAGE_KEYS.API_KEY}${id}`);

    // Clear cache
    invalidateCachedKey(id);
    await chromeStorage.remove(`${STORAGE_KEYS.API_KEY_CACHE}${id}`);

    // Update metrics
    serviceState.metrics.totalKeys--;

    await auditLog('key_deleted', id, { 
      provider: existingKey.metadata.provider,
      timestamp: Date.now()
    });

    return true;

  } catch (error) {
    await auditLog('key_delete_failed', id, { 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw new Error('Failed to delete API key');
  }
}

// =============================================================================
// Query and List Operations
// =============================================================================

/**
 * List API keys with filtering and pagination
 */
export async function listAPIKeys(options: APIKeyQueryOptions = {}): Promise<APIKeyListResult> {
  requireInitialized();
  incrementOperationCount('list');

  try {
    let results: APIKeyMetadata[] = [];

    // Use appropriate query method based on filters
    if (options.provider) {
      results = await dbInstance.query<APIKeyMetadata>(
        DB_STORES.METADATA,
        'provider',
        options.provider,
        { limit: options.limit, offset: options.offset }
      );
    } else if (options.status) {
      results = await dbInstance.query<APIKeyMetadata>(
        DB_STORES.METADATA,
        'status',
        options.status,
        { limit: options.limit, offset: options.offset }
      );
    } else {
      results = await dbInstance.getAll<APIKeyMetadata>(DB_STORES.METADATA);
    }

    // Apply additional filters
    if (options.keyType) {
      results = results.filter(key => key.keyType === options.keyType);
    }

    if (options.tags && options.tags.length > 0) {
      results = results.filter(key => 
        options.tags!.some(tag => key.tags?.includes(tag))
      );
    }

    if (options.search) {
      const searchLower = options.search.toLowerCase();
      results = results.filter(key => 
        key.name.toLowerCase().includes(searchLower) ||
        key.description?.toLowerCase().includes(searchLower)
      );
    }

    // Apply sorting
    if (options.sortBy) {
      results.sort((a, b) => {
        const aVal = a[options.sortBy!];
        const bVal = b[options.sortBy!];
        
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          const comparison = aVal.localeCompare(bVal);
          return options.sortOrder === 'desc' ? -comparison : comparison;
        }
        
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          const comparison = aVal - bVal;
          return options.sortOrder === 'desc' ? -comparison : comparison;
        }
        
        return 0;
      });
    }

    // Apply pagination
    const offset = options.offset || 0;
    const limit = options.limit || results.length;
    const paginatedResults = results.slice(offset, offset + limit);
    const hasMore = offset + limit < results.length;

    // Convert to EncryptedAPIKey format (metadata only)
    const keys: EncryptedAPIKey[] = paginatedResults.map(metadata => ({
      id: metadata.id,
      metadata,
      encryptedData: { data: new Uint8Array(), iv: new Uint8Array(), algorithm: 'AES-GCM', version: 1 },
      keyHash: '',
      checksum: '',
      storageVersion: 1,
      configuration: {},
      usageStats: undefined,
      rotationStatus: undefined
    }));

    return {
      keys,
      total: results.length,
      hasMore,
      nextCursor: hasMore ? `${offset + limit}` : undefined
    };

  } catch (error) {
    throw new Error(`Failed to list API keys: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get API keys for a specific provider
 */
export async function getKeysByProvider(provider: APIProvider): Promise<EncryptedAPIKey[]> {
  requireInitialized();

  try {
    const results = await dbInstance.query<APIKeyMetadata>(
      DB_STORES.METADATA,
      'provider',
      provider
    );

    // Convert to EncryptedAPIKey format (metadata only)
    return results.map(metadata => ({
      id: metadata.id,
      metadata,
      encryptedData: { data: new Uint8Array(), iv: new Uint8Array(), algorithm: 'AES-GCM', version: 1 },
      keyHash: '',
      checksum: '',
      storageVersion: 1,
      configuration: {},
      usageStats: undefined,
      rotationStatus: undefined
    }));

  } catch (error) {
    throw new Error(`Failed to get keys for provider ${provider}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// =============================================================================
// Key Rotation
// =============================================================================

/**
 * Rotate an API key with a new key value
 */
export async function rotateAPIKey(id: string, newKey: string): Promise<KeyRotationResult> {
  requireInitialized();
  incrementOperationCount('rotate');

  try {
    // Get existing key
    const existingKey = await getAPIKey(id);
    if (!existingKey) {
      throw new Error('API key not found');
    }

    // Validate new key format
    const validation = validateKeyFormat(newKey, existingKey.metadata.provider);
    if (!validation.isValid) {
      throw new Error(`Invalid API key format: ${validation.errors.join(', ')}`);
    }

    // Generate new key ID and hash
    const newKeyId = generateKeyId(existingKey.metadata.provider);
    const newKeyHash = await createKeyHash(newKey);

    // Encrypt new key
    const newEncryptedData = await serviceState.encryptionService.encryptData(newKey, 'text');
    const newChecksum = await serviceState.encryptionService.createIntegrityChecksum(newEncryptedData);

    // Create new key metadata
    const newMetadata: APIKeyMetadata = {
      ...existingKey.metadata,
      id: newKeyId,
      maskedKey: maskAPIKey(newKey),
      lastUsed: Date.now()
    };

    // Update rotation status
    const rotationStatus = {
      ...existingKey.rotationStatus,
      status: 'completed' as const,
      lastRotation: Date.now(),
      rotationHistory: [
        ...existingKey.rotationStatus?.rotationHistory || [],
        {
          timestamp: Date.now(),
          success: true,
          reason: 'Manual rotation',
          oldKeyId: id,
          newKeyId: newKeyId
        }
      ]
    };

    // Create new key object
    const newAPIKey: APIKeyStorage = {
      ...existingKey,
      id: newKeyId,
      metadata: newMetadata,
      encryptedData: newEncryptedData,
      keyHash: newKeyHash,
      checksum: newChecksum,
      rotationStatus
    };

    // Store new key
    await dbInstance.add(DB_STORES.METADATA, newMetadata);
    await chromeStorage.set(`${STORAGE_KEYS.API_KEY}${newKeyId}`, newAPIKey);

    // Invalidate old key cache
    invalidateCachedKey(id);

    await auditLog('key_rotated', id, { 
      newKeyId,
      timestamp: Date.now()
    });

    return {
      success: true,
      newKeyId,
      rollbackAvailable: true
    };

  } catch (error) {
    // Update rotation status to failed
    try {
      const existingKey = await getAPIKey(id);
      if (existingKey?.rotationStatus) {
        await updateAPIKey(id, { status: 'active' });
      }
    } catch {
      // Ignore errors in failure handling
    }

    await auditLog('key_rotation_failed', id, { 
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      rollbackAvailable: false
    };
  }
}

// =============================================================================
// Usage Statistics
// =============================================================================

/**
 * Record usage statistics for an API key
 */
export async function recordUsage(
  id: string,
  usage: {
    requests: number;
    tokens: number;
    cost: number;
    responseTime: number;
  }
): Promise<void> {
  requireInitialized();

  try {
    const existingKey = await getAPIKey(id);
    if (!existingKey) {
      throw new Error('API key not found');
    }

    // Calculate new statistics
    const currentStats = existingKey.usageStats;
    const newTotalRequests = currentStats.totalRequests + usage.requests;
    
    // Calculate new average response time
    const newAvgRequestTime = currentStats.totalRequests === 0 
      ? usage.responseTime
      : ((currentStats.avgRequestTime * currentStats.totalRequests) + (usage.responseTime * usage.requests)) / newTotalRequests;

    const updatedStats: APIKeyUsageStats = {
      ...currentStats,
      totalRequests: newTotalRequests,
      successfulRequests: currentStats.successfulRequests + usage.requests,
      totalTokens: currentStats.totalTokens + usage.tokens,
      totalCost: currentStats.totalCost + usage.cost,
      avgRequestTime: newAvgRequestTime
    };

    // Update the key
    await updateAPIKey(id, {
      status: existingKey.metadata.status // Trigger update
    });

    // Update in storage with new stats
    const updatedKey: APIKeyStorage = {
      ...existingKey,
      usageStats: updatedStats
    };

    await chromeStorage.set(`${STORAGE_KEYS.API_KEY}${id}`, updatedKey);
    await dbInstance.update(DB_STORES.METADATA, id, {
      ...existingKey.metadata,
      lastUsed: Date.now(),
      usageStats: updatedStats
    });

    invalidateCachedKey(id);

  } catch (error) {
    throw new Error(`Failed to record usage: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get usage statistics for an API key
 */
export async function getKeyUsageStats(id: string): Promise<APIKeyUsageStats> {
  requireInitialized();

  try {
    const key = await getAPIKey(id);
    if (!key) {
      throw new Error('API key not found');
    }

    return key.usageStats;

  } catch (error) {
    throw new Error(`Failed to get usage stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// =============================================================================
// Cache Management
// =============================================================================

/**
 * Clear all cached API keys
 */
export async function clearCache(): Promise<void> {
  serviceState.cache.clear();
  
  // Also clear Chrome storage cache
  const keys = await chromeStorage.getBatch([]);
  const cacheKeys = Object.keys(keys).filter(key => key.startsWith(STORAGE_KEYS.API_KEY_CACHE));
  
  for (const key of cacheKeys) {
    await chromeStorage.remove(key);
  }
}

// =============================================================================
// Import/Export
// =============================================================================

/**
 * Export API keys with optional secret inclusion
 */
export async function exportKeys(includeSecrets: boolean = false): Promise<Record<string, any>> {
  requireInitialized();

  try {
    // Get all metadata
    const allMetadata = await dbInstance.getAll<APIKeyMetadata>(DB_STORES.METADATA);
    
    // Get encrypted data if secrets are requested
    const keys = [];
    
    if (includeSecrets) {
      // Get all encrypted keys
      const encryptedKeys = await chromeStorage.getBatch(
        allMetadata.map(meta => `${STORAGE_KEYS.API_KEY}${meta.id}`)
      );
      
      for (const metadata of allMetadata) {
        const encryptedKey = encryptedKeys[`${STORAGE_KEYS.API_KEY}${metadata.id}`];
        if (encryptedKey) {
          keys.push(encryptedKey);
        }
      }
    } else {
      // Export metadata only
      for (const metadata of allMetadata) {
        keys.push({
          metadata,
          // Don't include encrypted data
          storageVersion: 1
        });
      }
    }

    return {
      version: 1,
      timestamp: Date.now(),
      keys,
      includeSecrets
    };

  } catch (error) {
    throw new Error(`Failed to export keys: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Import API keys from backup data
 */
export async function importKeys(data: Record<string, any>): Promise<ImportResult> {
  requireInitialized();

  const result: ImportResult = {
    success: 0,
    failed: 0,
    errors: []
  };

  try {
    const keys = data.keys || [];
    
    for (const keyData of keys) {
      try {
        if (keyData.metadata) {
          // Add metadata to IndexedDB
          await dbInstance.add(DB_STORES.METADATA, keyData.metadata);
          
          // Add encrypted data to Chrome storage if present
          if (keyData.encryptedData) {
            await chromeStorage.set(
              `${STORAGE_KEYS.API_KEY}${keyData.metadata.id}`,
              keyData
            );
          }
          
          result.success++;
        }
      } catch (error) {
        result.failed++;
        result.errors.push({
          key: keyData.metadata?.id || 'unknown',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    await auditLog('keys_imported', 'system', { 
      success: result.success,
      failed: result.failed,
      timestamp: Date.now()
    });

    return result;

  } catch (error) {
    throw new Error(`Failed to import keys: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// =============================================================================
// Connection Testing
// =============================================================================

/**
 * Test API key connection to provider
 */
export async function testKeyConnection(id: string): Promise<ConnectionTestResult> {
  requireInitialized();

  try {
    const key = await getAPIKey(id);
    if (!key) {
      throw new Error('API key not found');
    }

    // Decrypt the key for testing
    const decryptedKey = await serviceState.encryptionService.decryptData(
      key.encryptedData,
      'text'
    );

    const endpoint = PROVIDER_ENDPOINTS[key.metadata.provider];
    if (!endpoint) {
      return {
        success: false,
        responseTime: 0,
        error: 'Connection testing not supported for this provider'
      };
    }

    const startTime = Date.now();

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${decryptedKey}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(PERFORMANCE_THRESHOLDS.CONNECTION_TIMEOUT_MS)
      });

      const responseTime = Date.now() - startTime;

      if (response.ok) {
        return {
          success: true,
          responseTime,
          metadata: {
            status: response.status,
            statusText: response.statusText
          }
        };
      } else {
        return {
          success: false,
          responseTime,
          error: `${response.status} ${response.statusText}`
        };
      }

    } catch (fetchError) {
      const responseTime = Date.now() - startTime;
      return {
        success: false,
        responseTime,
        error: fetchError instanceof Error ? fetchError.message : 'Network error'
      };
    }

  } catch (error) {
    return {
      success: false,
      responseTime: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// =============================================================================
// Health Status
// =============================================================================

/**
 * Get system health status
 */
export async function getHealthStatus(): Promise<HealthCheckResult> {
  const checks = [];

  // Check encryption service
  checks.push({
    name: 'encryption_service',
    status: serviceState.encryptionService.isInitialized() ? 'pass' : 'fail',
    message: serviceState.encryptionService.isInitialized() 
      ? 'Encryption service operational' 
      : 'Encryption service not initialized'
  });

  // Check session status
  checks.push({
    name: 'session_status',
    status: serviceState.encryptionService.isSessionActive() ? 'pass' : 'fail',
    message: serviceState.encryptionService.isSessionActive() 
      ? 'Session active' 
      : 'Session expired'
  });

  // Check database connectivity
  try {
    await dbInstance.openDatabase();
    checks.push({
      name: 'database_connectivity',
      status: 'pass',
      message: 'Database accessible'
    });
  } catch {
    checks.push({
      name: 'database_connectivity',
      status: 'fail',
      message: 'Database connection failed'
    });
  }

  // Check Chrome storage
  try {
    await chromeStorage.get('health_check');
    checks.push({
      name: 'chrome_storage',
      status: 'pass',
      message: 'Chrome storage accessible'
    });
  } catch {
    checks.push({
      name: 'chrome_storage',
      status: 'fail',
      message: 'Chrome storage access failed'
    });
  }

  const healthy = checks.every(check => check.status === 'pass');

  return {
    healthy,
    checks
  };
}

// =============================================================================
// Private Helper Functions
// =============================================================================

/**
 * Require service to be initialized
 */
function requireInitialized(): void {
  if (!serviceState.isInitialized) {
    throw new Error('API key storage not initialized. Call initializeStorage() first.');
  }

  if (!serviceState.encryptionService.isSessionActive()) {
    throw new Error('Session expired. Please reinitialize the service.');
  }
}

/**
 * Create hash of API key for duplicate detection
 */
async function createKeyHash(key: string): Promise<string> {
  const hashBytes = await hashData(key);
  return Array.from(hashBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Find existing key by hash
 */
async function findKeyByHash(keyHash: string): Promise<string | null> {
  try {
    const keys = await chromeStorage.getBatch([]);
    for (const [storageKey, keyData] of Object.entries(keys)) {
      if (storageKey.startsWith(STORAGE_KEYS.API_KEY) && 
          keyData && 
          typeof keyData === 'object' && 
          'keyHash' in keyData &&
          keyData.keyHash === keyHash) {
        return keyData.id;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Update last used timestamp for a key
 */
async function updateLastUsed(id: string): Promise<void> {
  try {
    const metadata = await dbInstance.get<APIKeyMetadata>(DB_STORES.METADATA, id);
    if (metadata) {
      await dbInstance.update(DB_STORES.METADATA, id, {
        ...metadata,
        lastUsed: Date.now()
      });
    }
  } catch {
    // Ignore errors in last used updates
  }
}

/**
 * Get cached key
 */
function getCachedKey(id: string): EncryptedAPIKey | null {
  const entry = serviceState.cache.get(id);
  if (!entry) {
    return null;
  }

  // Check TTL
  if (Date.now() - entry.timestamp > CACHE_CONFIG.TTL_MS) {
    serviceState.cache.delete(id);
    return null;
  }

  entry.accessCount++;
  return entry.key;
}

/**
 * Set cached key
 */
function setCachedKey(id: string, key: EncryptedAPIKey): void {
  // Implement LRU eviction if cache is full
  if (serviceState.cache.size >= CACHE_CONFIG.MAX_SIZE) {
    // Find least recently used entry
    let oldestKey = '';
    let oldestTime = Date.now();
    
    for (const [cacheId, entry] of serviceState.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = cacheId;
      }
    }
    
    if (oldestKey) {
      serviceState.cache.delete(oldestKey);
    }
  }

  serviceState.cache.set(id, {
    key,
    timestamp: Date.now(),
    accessCount: 1
  });
}

/**
 * Invalidate cached key
 */
function invalidateCachedKey(id: string): void {
  serviceState.cache.delete(id);
}

/**
 * Start cache cleanup interval
 */
function startCacheCleanup(): void {
  if (serviceState.cacheCleanupInterval) {
    clearInterval(serviceState.cacheCleanupInterval);
  }

  serviceState.cacheCleanupInterval = setInterval(() => {
    const now = Date.now();
    
    for (const [id, entry] of serviceState.cache.entries()) {
      if (now - entry.timestamp > CACHE_CONFIG.TTL_MS) {
        serviceState.cache.delete(id);
      }
    }
    
    serviceState.metrics.lastCleanup = now;
  }, CACHE_CONFIG.CLEANUP_INTERVAL_MS);
}

/**
 * Update service metrics
 */
async function updateMetrics(): Promise<void> {
  try {
    const allKeys = await dbInstance.getAll<APIKeyMetadata>(DB_STORES.METADATA);
    serviceState.metrics.totalKeys = allKeys.length;
  } catch {
    // Ignore metrics errors
  }
}

/**
 * Increment operation count for metrics
 */
function incrementOperationCount(operation: string): void {
  serviceState.metrics.operationCounts[operation] = 
    (serviceState.metrics.operationCounts[operation] || 0) + 1;
}

/**
 * Log audit event
 */
async function auditLog(
  event: string, 
  keyId: string, 
  details: Record<string, any>
): Promise<void> {
  try {
    const auditEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      event,
      keyId,
      timestamp: Date.now(),
      details
    };

    await dbInstance.add(DB_STORES.AUDIT_LOG, auditEntry);
  } catch {
    // Don't fail operations due to audit logging errors
  }
}

/**
 * Perform data migrations from older versions
 */
async function performMigrations(): Promise<void> {
  try {
    const migrationStatus = await chromeStorage.get(STORAGE_KEYS.MIGRATION_STATUS);
    
    if (!migrationStatus || migrationStatus.version < 1) {
      // Perform migration from unencrypted storage
      const legacyKeys = await chromeStorage.getBatch([]);
      
      for (const [key, value] of Object.entries(legacyKeys)) {
        if (key.startsWith('api_key_') && 
            value && 
            typeof value === 'object' && 
            'key' in value &&
            typeof value.key === 'string' &&
            !('encryptedData' in value)) {
          
          // This is legacy unencrypted data
          const legacyKey = value as any;
          
          try {
            // Encrypt the key
            const encryptedData = await serviceState.encryptionService.encryptData(
              legacyKey.key, 
              'text'
            );
            
            // Create new format
            const migratedKey = {
              ...legacyKey,
              encryptedData,
              keyHash: await createKeyHash(legacyKey.key),
              checksum: await serviceState.encryptionService.createIntegrityChecksum(encryptedData),
              storageVersion: 1
            };
            
            // Remove the raw key
            delete migratedKey.key;
            
            // Update storage
            await chromeStorage.set(key, migratedKey);
            
          } catch (error) {
            console.warn(`Failed to migrate key ${key}:`, error);
          }
        }
      }
      
      // Mark migration as complete
      await chromeStorage.set(STORAGE_KEYS.MIGRATION_STATUS, { 
        version: 1, 
        migratedAt: Date.now() 
      });
    }
  } catch (error) {
    console.warn('Migration failed:', error);
    // Don't fail initialization due to migration errors
  }
}

// =============================================================================
// Export API
// =============================================================================

export type { APIKeyStorage };