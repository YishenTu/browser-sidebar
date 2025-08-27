/**
 * @file API Key Storage Service
 *
 * Main entry point for the modularized API key storage system.
 * Provides a unified interface for all key management operations.
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
} from '@/types/apiKeys';

import type { ServiceState } from './types';
import { EncryptionServiceStub } from './encryption';
import { startCacheCleanup, stopCacheCleanup, clearCache as clearCacheInternal } from './cache';
import { performMigrations, updateMetrics, auditLog } from './utils';
import * as chromeStorage from '@/data/storage/chrome';
import { STORAGE_KEYS } from './constants';

// Import operation modules
import * as operations from './operations';
import * as query from './query';
import * as rotation from './rotation';
import * as usage from './usage';
import * as importExport from './importExport';
import * as health from './health';

// =============================================================================
// Service State Management
// =============================================================================

/** Global service state */
const serviceState: ServiceState = {
  isInitialized: false,
  encryptionService: null,
  cache: new Map(),
  cacheCleanupInterval: null,
  metrics: {
    totalKeys: 0,
    cacheHits: 0,
    cacheMisses: 0,
    operationCounts: {},
    lastCleanup: Date.now(),
  },
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
    // Initialize encryption service via singleton
    serviceState.encryptionService = EncryptionServiceStub.getInstance();
    await serviceState.encryptionService.initialize(password);

    // Perform data migration if needed
    await performMigrations(serviceState.encryptionService);

    // Initialize cache cleanup
    startCacheCleanup(serviceState);

    // Update metrics
    await updateMetrics(serviceState.metrics);

    serviceState.isInitialized = true;

    await auditLog('service_initialized', 'system', { timestamp: Date.now() });
  } catch (error) {
    throw new Error(
      `Failed to initialize API key storage: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
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
  stopCacheCleanup(serviceState);

  // Clear cache
  serviceState.cache.clear();

  // Shutdown encryption service
  if (serviceState.encryptionService) {
    await serviceState.encryptionService.shutdown();
  }

  serviceState.isInitialized = false;

  await auditLog('service_shutdown', 'system', { timestamp: Date.now() });
}

// =============================================================================
// Core API Key Operations (delegated to operations module)
// =============================================================================

/**
 * Add a new API key with encryption and validation
 */
export async function addAPIKey(input: CreateAPIKeyInput): Promise<EncryptedAPIKey> {
  return operations.addAPIKey(serviceState, input);
}

/**
 * Get and decrypt an API key by ID
 */
export async function getAPIKey(id: string): Promise<EncryptedAPIKey | null> {
  return operations.getAPIKey(serviceState, id);
}

/**
 * Update an existing API key
 */
export async function updateAPIKey(
  id: string,
  updates: UpdateAPIKeyInput
): Promise<EncryptedAPIKey> {
  return operations.updateAPIKey(serviceState, id, updates);
}

/**
 * Delete an API key permanently
 */
export async function deleteAPIKey(id: string): Promise<boolean> {
  return operations.deleteAPIKey(serviceState, id);
}

// =============================================================================
// Query and List Operations (delegated to query module)
// =============================================================================

/**
 * List API keys with filtering and pagination
 */
export async function listAPIKeys(options: APIKeyQueryOptions = {}): Promise<APIKeyListResult> {
  return query.listAPIKeys(serviceState, options);
}

/**
 * Get API keys for a specific provider
 */
export async function getKeysByProvider(provider: APIProvider): Promise<EncryptedAPIKey[]> {
  return query.getKeysByProvider(serviceState, provider);
}

// =============================================================================
// Key Rotation (delegated to rotation module)
// =============================================================================

/**
 * Rotate an API key with a new key value
 */
export async function rotateAPIKey(id: string, newKey: string): Promise<KeyRotationResult> {
  return rotation.rotateAPIKey(serviceState, id, newKey);
}

// =============================================================================
// Usage Statistics (delegated to usage module)
// =============================================================================

/**
 * Record usage statistics for an API key
 */
export async function recordUsage(
  id: string,
  usageData: {
    requests: number;
    tokens: number;
    cost: number;
    responseTime: number;
  }
): Promise<void> {
  return usage.recordUsage(serviceState, id, usageData);
}

/**
 * Get usage statistics for an API key
 */
export async function getKeyUsageStats(id: string): Promise<APIKeyUsageStats> {
  return usage.getKeyUsageStats(serviceState, id);
}

// =============================================================================
// Cache Management
// =============================================================================

/**
 * Clear all cached API keys
 */
export async function clearCache(): Promise<void> {
  clearCacheInternal(serviceState);

  // Also clear Chrome storage cache
  const keys = await chromeStorage.getBatch([]);
  const cacheKeys = Object.keys(keys).filter(key => key.startsWith(STORAGE_KEYS.API_KEY_CACHE));

  for (const key of cacheKeys) {
    await chromeStorage.remove(key);
  }

  // Best-effort removal using prefix marker for environments without listing
  try {
    await chromeStorage.remove(`${STORAGE_KEYS.API_KEY_CACHE}*`);
  } catch (e) {
    // noop: prefix removal is best-effort
    void e;
  }
}

// =============================================================================
// Import/Export (delegated to importExport module)
// =============================================================================

/**
 * Export API keys with optional secret inclusion
 */
export async function exportKeys(includeSecrets: boolean = false): Promise<Record<string, unknown>> {
  return importExport.exportKeys(serviceState, includeSecrets);
}

/**
 * Import API keys from backup data
 */
export async function importKeys(data: Record<string, unknown>): Promise<ImportResult> {
  return importExport.importKeys(serviceState, data);
}

// =============================================================================
// Connection Testing and Health (delegated to health module)
// =============================================================================

/**
 * Test API key connection to provider
 */
export async function testKeyConnection(id: string): Promise<ConnectionTestResult> {
  return health.testKeyConnection(serviceState, id);
}

/**
 * Get system health status
 */
export async function getHealthStatus(): Promise<HealthCheckResult> {
  return health.getHealthStatus(serviceState);
}

// =============================================================================
// Export Types
// =============================================================================

export type { APIKeyStorage };
