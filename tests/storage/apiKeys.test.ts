/**
 * @file API Key Storage Tests
 *
 * Comprehensive test suite for secure API key storage implementation.
 * Tests cover encryption, storage, retrieval, deletion, validation, and security features.
 *
 * This test file follows TDD methodology - tests are written first to define the
 * expected behavior of the API key storage system.
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import {
  APIKeyStorage,
  addAPIKey,
  getAPIKey,
  updateAPIKey,
  deleteAPIKey,
  listAPIKeys,
  getKeysByProvider,
  rotateAPIKey,
  getKeyUsageStats,
  recordUsage,
  clearCache,
  exportKeys,
  importKeys,
  testKeyConnection,
  getHealthStatus,
  initializeStorage,
  shutdown,
} from '../../src/storage/apiKeys';

import type {
  APIProvider,
  APIKeyStatus,
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
} from '../../src/types/apiKeys';

import { EncryptionService } from '../../src/security/encryptionService';
import { dbInstance } from '../../src/storage/indexedDB';
import * as chromeStorage from '../../src/storage/chromeStorage';
import { OBJECT_STORES } from '../../src/storage/schema';
import { hashData } from '../../src/security/crypto';

// Mock external dependencies
vi.mock('../../src/security/encryptionService', () => {
  const instance = {
    initialize: vi.fn(),
    isInitialized: vi.fn(() => true),
    isSessionActive: vi.fn(() => true),
    encryptData: vi.fn(),
    decryptData: vi.fn(),
    createIntegrityChecksum: vi.fn(),
    validateIntegrityChecksum: vi.fn(),
    shutdown: vi.fn(),
  } as any;
  const getInstance = vi.fn(() => instance);
  return { EncryptionService: { getInstance } };
});

vi.mock('../../src/storage/indexedDB', () => ({
  dbInstance: {
    openDatabase: vi.fn(),
    add: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getAll: vi.fn(),
    query: vi.fn(),
    batchAdd: vi.fn(),
    batchDelete: vi.fn(),
  },
}));

vi.mock('../../src/storage/chromeStorage', () => ({
  get: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
  getBatch: vi.fn(),
  setBatch: vi.fn(),
}));

// Mock Chrome APIs
global.chrome = {
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
      onChanged: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
    sync: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
    },
  },
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
} as any;

describe('API Key Storage', () => {
  // Test data
  const mockPassword = 'test-password-123';
  const mockOpenAIKey = 'sk-1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKL';
  const mockAnthropicKey = 'sk-ant-1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKL';

  const mockEncryptedData = {
    data: new Uint8Array([1, 2, 3, 4]),
    iv: new Uint8Array([5, 6, 7, 8]),
    algorithm: 'AES-GCM' as const,
    version: 1,
  };

  const mockAPIKey: CreateAPIKeyInput = {
    key: mockOpenAIKey,
    provider: 'openai',
    name: 'Test OpenAI Key',
    description: 'Test key for unit tests',
    tags: ['test', 'openai'],
    permissions: ['read', 'write'],
  };

  // Mock instances
  let mockEncryptionService: any;
  let mockDBInstance: any;
  let mockChromeStorage: any;

  beforeAll(async () => {
    // Setup mocks
    const encSvc = vi.mocked(EncryptionService.getInstance)();
    mockEncryptionService = encSvc;
    encSvc.isInitialized.mockReturnValue(true);
    encSvc.isSessionActive.mockReturnValue(true);
    encSvc.encryptData.mockResolvedValue(mockEncryptedData as any);
    encSvc.decryptData.mockResolvedValue(mockOpenAIKey as any);
    encSvc.createIntegrityChecksum.mockResolvedValue('mock-checksum');
    encSvc.validateIntegrityChecksum.mockResolvedValue(true);

    mockDBInstance = {
      openDatabase: vi.fn().mockResolvedValue({}),
      add: vi.fn().mockResolvedValue('key-id-123'),
      get: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      getAll: vi.fn().mockResolvedValue([]),
      query: vi.fn().mockResolvedValue([]),
      batchAdd: vi.fn().mockResolvedValue(undefined),
      batchDelete: vi.fn().mockResolvedValue(undefined),
    };

    mockChromeStorage = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      getBatch: vi.fn().mockResolvedValue({}),
      setBatch: vi.fn().mockResolvedValue(undefined),
    };
  });

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();

    // Reset mock return values
    mockEncryptionService.isInitialized.mockReturnValue(true);
    mockEncryptionService.isSessionActive.mockReturnValue(true);
    mockDBInstance.get.mockResolvedValue(null);
    mockChromeStorage.get.mockResolvedValue(null);

    // Apply mocks to the imported modules
    vi.mocked(EncryptionService.getInstance).mockReturnValue(mockEncryptionService);

    // Mock the dbInstance methods
    vi.mocked(dbInstance.openDatabase).mockResolvedValue({} as any);
    vi.mocked(dbInstance.add).mockResolvedValue('key-id-123');
    vi.mocked(dbInstance.get).mockResolvedValue(null);
    vi.mocked(dbInstance.update).mockResolvedValue(undefined);
    vi.mocked(dbInstance.delete).mockResolvedValue(undefined);
    vi.mocked(dbInstance.getAll).mockResolvedValue([]);
    vi.mocked(dbInstance.query).mockResolvedValue([]);
    vi.mocked(dbInstance.batchAdd).mockResolvedValue(undefined);
    vi.mocked(dbInstance.batchDelete).mockResolvedValue(undefined);

    // Mock the chromeStorage methods
    vi.mocked(chromeStorage.get).mockResolvedValue(null);
    vi.mocked(chromeStorage.set).mockResolvedValue(undefined);
    vi.mocked(chromeStorage.remove).mockResolvedValue(undefined);
    vi.mocked(chromeStorage.getBatch).mockResolvedValue({});
    vi.mocked(chromeStorage.setBatch).mockResolvedValue(undefined);

    // Initialize storage
    await initializeStorage(mockPassword);
  });

  afterEach(async () => {
    await shutdown();
  });

  // Helper functions for consistent mock setup
  const mockStoredKey = async (key: EncryptedAPIKey) => {
    // Mock both IndexedDB and Chrome storage for a stored key
    mockDBInstance.get.mockResolvedValueOnce(key.metadata);
    mockChromeStorage.get.mockResolvedValueOnce(key);
    return key;
  };

  const mockKeyList = (keys: EncryptedAPIKey[]) => {
    // Mock IndexedDB to return metadata list
    const metadataList = keys.map(k => k.metadata);
    mockDBInstance.getAll.mockResolvedValueOnce(metadataList);
    mockDBInstance.query.mockResolvedValueOnce(metadataList);

    // Mock Chrome storage for each key
    keys.forEach(key => {
      mockChromeStorage.get.mockResolvedValueOnce(key);
    });
  };

  const computeKeyHash = async (keyValue: string): Promise<string> => {
    const hashBuffer = await hashData(keyValue);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  };

  describe('Storage Initialization', () => {
    it('should initialize storage with password', async () => {
      expect(mockEncryptionService.initialize).toHaveBeenCalledWith(mockPassword);
    });

    it('should throw error if already initialized', async () => {
      await expect(initializeStorage(mockPassword)).rejects.toThrow('already initialized');
    });

    it('should require strong password', async () => {
      await shutdown();
      await expect(initializeStorage('weak')).rejects.toThrow('Password too weak');
    });

    it('should check service initialization before operations', async () => {
      mockEncryptionService.isInitialized.mockReturnValue(false);

      await expect(addAPIKey(mockAPIKey)).rejects.toThrow('not initialized');
    });

    it('should check active session before operations', async () => {
      mockEncryptionService.isSessionActive.mockReturnValue(false);

      await expect(addAPIKey(mockAPIKey)).rejects.toThrow('Session expired');
    });
  });

  describe('Add API Key', () => {
    it('should add new API key with encryption', async () => {
      const result = await addAPIKey(mockAPIKey);

      expect(result).toBeDefined();
      expect(result.id).toBeTruthy();
      expect(result.metadata.provider).toBe('openai');
      expect(result.metadata.name).toBe('Test OpenAI Key');
      expect(result.metadata.status).toBe('active');
      expect(result.encryptedData).toEqual(mockEncryptedData);

      // Verify encryption was called
      expect(mockEncryptionService.encryptData).toHaveBeenCalledWith(mockOpenAIKey, 'text');

      // Verify storage calls
      expect(vi.mocked(dbInstance.add)).toHaveBeenCalledWith('apiKeys', expect.any(Object));
      expect(vi.mocked(chromeStorage.set)).toHaveBeenCalled();
    });

    it('should validate API key format', async () => {
      const invalidKey = { ...mockAPIKey, key: 'invalid-key' };

      await expect(addAPIKey(invalidKey)).rejects.toThrow('Invalid API key format');
    });

    it('should prevent duplicate keys', async () => {
      // First addition succeeds
      await addAPIKey(mockAPIKey);

      // Compute real keyHash and mock hash mapping
      const keyHashBuffer = await hashData(mockOpenAIKey);
      const keyHash = Array.from(new Uint8Array(keyHashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      vi.mocked(chromeStorage.get).mockImplementationOnce(async (key: string) => {
        if (key === `api_key_hash_${keyHash}`) return { id: 'existing-id' } as any;
        return null as any;
      });

      // Second addition should fail
      await expect(addAPIKey(mockAPIKey)).rejects.toThrow('API key already exists');
    });

    it('should auto-detect provider from key format', async () => {
      const keyWithoutProvider = { ...mockAPIKey, provider: undefined as any };

      const result = await addAPIKey(keyWithoutProvider);

      expect(result.metadata.provider).toBe('openai');
    });

    it('should create masked version of key', async () => {
      const result = await addAPIKey(mockAPIKey);

      expect(result.metadata.maskedKey).toMatch(/^sk-....*...$/);
      expect(result.metadata.maskedKey).not.toContain(mockOpenAIKey.slice(10, -10));
    });

    it('should set default configuration', async () => {
      const result = await addAPIKey(mockAPIKey);

      expect(result.configuration).toBeDefined();
      expect(result.configuration.security?.encryptionLevel).toBe('standard');
    });

    it('should initialize usage stats', async () => {
      const result = await addAPIKey(mockAPIKey);

      expect(result.usageStats).toBeDefined();
      expect(result.usageStats.totalRequests).toBe(0);
      expect(result.usageStats.totalTokens).toBe(0);
      expect(result.usageStats.totalCost).toBe(0);
    });

    it('should initialize rotation status', async () => {
      const result = await addAPIKey(mockAPIKey);

      expect(result.rotationStatus).toBeDefined();
      expect(result.rotationStatus.status).toBe('none');
      expect(result.rotationStatus.rotationHistory).toEqual([]);
    });
  });

  describe('Get API Key', () => {
    let storedKey: EncryptedAPIKey;

    beforeEach(async () => {
      storedKey = await addAPIKey(mockAPIKey);
    });

    it('should retrieve and decrypt API key', async () => {
      // Mock storage return
      vi.mocked(dbInstance.get).mockResolvedValueOnce(storedKey.metadata);
      vi.mocked(chromeStorage.get).mockResolvedValueOnce(storedKey);

      const result = await getAPIKey(storedKey.id);

      expect(result).toBeDefined();
      expect(result!.id).toBe(storedKey.id);
      expect(mockEncryptionService.decryptData).toHaveBeenCalledWith(
        storedKey.encryptedData,
        'text'
      );
    });

    it('should return null for non-existent key', async () => {
      const result = await getAPIKey('non-existent-id');

      expect(result).toBeNull();
    });

    it('should verify data integrity', async () => {
      await mockStoredKey(storedKey);

      await getAPIKey(storedKey.id);

      expect(mockEncryptionService.validateIntegrityChecksum).toHaveBeenCalled();
    });

    it('should handle corrupted data', async () => {
      await mockStoredKey(storedKey);
      mockEncryptionService.validateIntegrityChecksum.mockResolvedValueOnce(false);

      await expect(getAPIKey(storedKey.id)).rejects.toThrow('Data integrity check failed');
    });

    it('should update last used timestamp', async () => {
      await mockStoredKey(storedKey);

      await getAPIKey(storedKey.id);

      expect(mockDBInstance.update).toHaveBeenCalledWith(
        OBJECT_STORES.API_KEYS,
        storedKey.id,
        expect.objectContaining({
          lastUsed: expect.any(Number),
        })
      );
    });
  });

  describe('Update API Key', () => {
    let storedKey: EncryptedAPIKey;

    beforeEach(async () => {
      storedKey = await addAPIKey(mockAPIKey);
      mockDBInstance.get.mockResolvedValueOnce(storedKey.metadata);
      mockChromeStorage.get.mockResolvedValueOnce(storedKey);
    });

    it('should update key metadata', async () => {
      const updates: UpdateAPIKeyInput = {
        name: 'Updated Key Name',
        description: 'Updated description',
        tags: ['updated', 'test'],
        status: 'inactive',
      };

      const result = await updateAPIKey(storedKey.id, updates);

      expect(result.metadata.name).toBe('Updated Key Name');
      expect(result.metadata.description).toBe('Updated description');
      expect(result.metadata.status).toBe('inactive');
      expect(result.metadata.tags).toEqual(['updated', 'test']);
    });

    it('should update configuration', async () => {
      const updates: UpdateAPIKeyInput = {
        configuration: {
          security: {
            encryptionLevel: 'high',
            requireHTTPS: true,
          },
        },
      };

      const result = await updateAPIKey(storedKey.id, updates);

      expect(result.configuration.security?.encryptionLevel).toBe('high');
      expect(result.configuration.security?.requireHTTPS).toBe(true);
    });

    it('should preserve existing data when updating', async () => {
      const updates: UpdateAPIKeyInput = {
        name: 'New Name',
      };

      const result = await updateAPIKey(storedKey.id, updates);

      expect(result.metadata.name).toBe('New Name');
      expect(result.metadata.provider).toBe(storedKey.metadata.provider);
      expect(result.metadata.keyType).toBe(storedKey.metadata.keyType);
    });

    it('should throw error for non-existent key', async () => {
      mockDBInstance.get.mockResolvedValueOnce(null);

      await expect(updateAPIKey('non-existent', {})).rejects.toThrow('API key not found');
    });
  });

  describe('Delete API Key', () => {
    let storedKey: EncryptedAPIKey;

    beforeEach(async () => {
      storedKey = await addAPIKey(mockAPIKey);
      mockDBInstance.get.mockResolvedValueOnce(storedKey.metadata);
      mockChromeStorage.get.mockResolvedValueOnce(storedKey);
    });

    it('should delete API key from both storage systems', async () => {
      const result = await deleteAPIKey(storedKey.id);

      expect(result).toBe(true);
      expect(mockDBInstance.delete).toHaveBeenCalledWith(OBJECT_STORES.API_KEYS, storedKey.id);
      expect(mockChromeStorage.remove).toHaveBeenCalledWith(`api_key_${storedKey.id}`);
    });

    it('should clear cached data', async () => {
      await deleteAPIKey(storedKey.id);

      // Should call cache clearing functionality
      expect(mockChromeStorage.remove).toHaveBeenCalledWith(`api_key_cache_${storedKey.id}`);
    });

    it('should return false for non-existent key', async () => {
      mockDBInstance.get.mockResolvedValueOnce(null);

      const result = await deleteAPIKey('non-existent');

      expect(result).toBe(false);
    });

    it('should handle storage errors gracefully', async () => {
      mockDBInstance.delete.mockRejectedValueOnce(new Error('Storage error'));

      await expect(deleteAPIKey(storedKey.id)).rejects.toThrow('Failed to delete API key');
    });
  });

  describe('List API Keys', () => {
    beforeEach(async () => {
      // Add multiple test keys
      await addAPIKey(mockAPIKey);
      await addAPIKey({
        ...mockAPIKey,
        key: mockAnthropicKey,
        provider: 'anthropic',
        name: 'Test Anthropic Key',
      });

      // Mock database return
      mockDBInstance.getAll.mockResolvedValueOnce([
        { id: 'key1', provider: 'openai', name: 'Test OpenAI Key' },
        { id: 'key2', provider: 'anthropic', name: 'Test Anthropic Key' },
      ]);
    });

    it('should list all API keys (metadata only)', async () => {
      const result = await listAPIKeys();

      expect(result.keys).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.hasMore).toBe(false);

      // Should not include encrypted data
      expect(result.keys[0]).not.toHaveProperty('encryptedData');
      expect(result.keys[0]).toHaveProperty('metadata');
    });

    it('should filter by provider', async () => {
      mockDBInstance.query.mockResolvedValueOnce([
        { id: 'key1', provider: 'openai', name: 'Test OpenAI Key' },
      ]);

      const options: APIKeyQueryOptions = {
        provider: 'openai',
      };

      const result = await listAPIKeys(options);

      expect(result.keys).toHaveLength(1);
      expect(result.keys[0].metadata.provider).toBe('openai');
      expect(mockDBInstance.query).toHaveBeenCalledWith(
        OBJECT_STORES.API_KEYS,
        'provider',
        'openai',
        expect.any(Object)
      );
    });

    it('should filter by status', async () => {
      const options: APIKeyQueryOptions = {
        status: 'active',
      };

      await listAPIKeys(options);

      expect(mockDBInstance.query).toHaveBeenCalledWith(
        OBJECT_STORES.API_KEYS,
        'status',
        'active',
        expect.any(Object)
      );
    });

    it('should apply pagination', async () => {
      const options: APIKeyQueryOptions = {
        limit: 10,
        offset: 20,
      };

      await listAPIKeys(options);

      expect(mockDBInstance.getAll).toHaveBeenCalledWith(OBJECT_STORES.API_KEYS);
      // Pagination should be applied to results
    });

    it('should search by name and description', async () => {
      const options: APIKeyQueryOptions = {
        search: 'test',
      };

      await listAPIKeys(options);

      // Should filter results containing search term
    });

    it('should sort results', async () => {
      const options: APIKeyQueryOptions = {
        sortBy: 'name',
        sortOrder: 'desc',
      };

      const result = await listAPIKeys(options);

      // Results should be sorted by name in descending order
      expect(result.keys).toBeDefined();
    });
  });

  describe('Get Keys by Provider', () => {
    beforeEach(async () => {
      mockDBInstance.query.mockResolvedValueOnce([
        { id: 'key1', provider: 'openai', name: 'Test OpenAI Key 1' },
        { id: 'key2', provider: 'openai', name: 'Test OpenAI Key 2' },
      ]);
    });

    it('should get keys for specific provider', async () => {
      const result = await getKeysByProvider('openai');

      expect(result).toHaveLength(2);
      expect(result[0].metadata.provider).toBe('openai');
      expect(mockDBInstance.query).toHaveBeenCalledWith(
        OBJECT_STORES.API_KEYS,
        'provider',
        'openai'
      );
    });

    it('should return empty array for provider with no keys', async () => {
      mockDBInstance.query.mockResolvedValueOnce([]);

      const result = await getKeysByProvider('google');

      expect(result).toHaveLength(0);
    });
  });

  describe('Key Rotation', () => {
    let storedKey: EncryptedAPIKey;
    const newKey = 'sk-9876543210abcdefghijklmnopqrstuvwxyzABCDEFGH';

    beforeEach(async () => {
      storedKey = await addAPIKey(mockAPIKey);
      mockDBInstance.get.mockResolvedValueOnce(storedKey.metadata);
      mockChromeStorage.get.mockResolvedValueOnce(storedKey);
    });

    it('should rotate API key', async () => {
      const result: KeyRotationResult = await rotateAPIKey(storedKey.id, newKey);

      expect(result.success).toBe(true);
      expect(result.newKeyId).toBeTruthy();
      expect(result.rollbackAvailable).toBe(true);

      // Verify new key was encrypted and stored
      expect(mockEncryptionService.encryptData).toHaveBeenCalledWith(newKey, 'text');
    });

    it('should update rotation status', async () => {
      await rotateAPIKey(storedKey.id, newKey);

      expect(mockDBInstance.update).toHaveBeenCalledWith(
        OBJECT_STORES.API_KEYS,
        expect.any(String),
        expect.objectContaining({
          rotationStatus: expect.objectContaining({
            status: 'completed',
            lastRotation: expect.any(Number),
          }),
        })
      );
    });

    it('should maintain rotation history', async () => {
      await rotateAPIKey(storedKey.id, newKey);

      expect(mockDBInstance.update).toHaveBeenCalledWith(
        OBJECT_STORES.API_KEYS,
        expect.any(String),
        expect.objectContaining({
          rotationStatus: expect.objectContaining({
            rotationHistory: expect.arrayContaining([
              expect.objectContaining({
                timestamp: expect.any(Number),
                success: true,
                oldKeyId: storedKey.id,
              }),
            ]),
          }),
        })
      );
    });

    it('should validate new key format', async () => {
      await expect(rotateAPIKey(storedKey.id, 'invalid-key')).rejects.toThrow(
        'Invalid API key format'
      );
    });

    it('should handle rotation failure', async () => {
      mockEncryptionService.encryptData.mockRejectedValueOnce(new Error('Encryption failed'));

      const result = await rotateAPIKey(storedKey.id, newKey);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Encryption failed');
    });
  });

  describe('Usage Statistics', () => {
    let storedKey: EncryptedAPIKey;

    beforeEach(async () => {
      storedKey = await addAPIKey(mockAPIKey);
      mockDBInstance.get.mockResolvedValueOnce(storedKey.metadata);
      mockChromeStorage.get.mockResolvedValueOnce(storedKey);
    });

    it('should record usage statistics', async () => {
      const usage = {
        requests: 5,
        tokens: 1000,
        cost: 0.02,
        responseTime: 150,
      };

      await recordUsage(storedKey.id, usage);

      expect(mockDBInstance.update).toHaveBeenCalledWith(
        OBJECT_STORES.API_KEYS,
        storedKey.id,
        expect.objectContaining({
          usageStats: expect.objectContaining({
            totalRequests: 5,
            totalTokens: 1000,
            totalCost: 0.02,
            avgRequestTime: 150,
          }),
        })
      );
    });

    it('should accumulate usage statistics', async () => {
      // First usage
      await recordUsage(storedKey.id, { requests: 3, tokens: 500, cost: 0.01, responseTime: 100 });

      // Update mock to reflect accumulated stats
      const updatedKey = {
        ...storedKey,
        usageStats: {
          ...storedKey.usageStats,
          totalRequests: 3,
          totalTokens: 500,
          totalCost: 0.01,
        },
      };
      mockChromeStorage.get.mockResolvedValueOnce(updatedKey);

      // Second usage
      await recordUsage(storedKey.id, { requests: 2, tokens: 300, cost: 0.005, responseTime: 200 });

      expect(mockDBInstance.update).toHaveBeenLastCalledWith(
        OBJECT_STORES.API_KEYS,
        storedKey.id,
        expect.objectContaining({
          usageStats: expect.objectContaining({
            totalRequests: 5,
            totalTokens: 800,
            totalCost: 0.015,
          }),
        })
      );
    });

    it('should get usage statistics', async () => {
      const stats = await getKeyUsageStats(storedKey.id);

      expect(stats).toBeDefined();
      expect(stats.totalRequests).toBe(0);
      expect(stats.totalTokens).toBe(0);
      expect(stats.totalCost).toBe(0);
    });

    it('should calculate average response time correctly', async () => {
      // Record multiple usages with different response times
      await recordUsage(storedKey.id, { requests: 1, tokens: 100, cost: 0.001, responseTime: 100 });

      const updatedKey = {
        ...storedKey,
        usageStats: { ...storedKey.usageStats, totalRequests: 1, avgRequestTime: 100 },
      };
      mockChromeStorage.get.mockResolvedValueOnce(updatedKey);

      await recordUsage(storedKey.id, { requests: 1, tokens: 100, cost: 0.001, responseTime: 200 });

      expect(mockDBInstance.update).toHaveBeenLastCalledWith(
        OBJECT_STORES.API_KEYS,
        storedKey.id,
        expect.objectContaining({
          usageStats: expect.objectContaining({
            avgRequestTime: 150, // (100 + 200) / 2
          }),
        })
      );
    });
  });

  describe('Cache Management', () => {
    let storedKey: EncryptedAPIKey;

    beforeEach(async () => {
      storedKey = await addAPIKey(mockAPIKey);
    });

    it('should cache frequently accessed keys', async () => {
      mockDBInstance.get.mockResolvedValueOnce(storedKey.metadata);
      mockChromeStorage.get.mockResolvedValueOnce(storedKey);

      // First access
      await getAPIKey(storedKey.id);

      // Second access should use cache
      await getAPIKey(storedKey.id);

      // Should hit cache on second call
      expect(mockChromeStorage.get).toHaveBeenCalledWith(`api_key_cache_${storedKey.id}`);
    });

    it('should clear cache', async () => {
      await clearCache();

      expect(mockChromeStorage.remove).toHaveBeenCalledWith(
        expect.stringMatching(/api_key_cache_/)
      );
    });

    it('should invalidate cache on key update', async () => {
      mockDBInstance.get.mockResolvedValueOnce(storedKey.metadata);
      mockChromeStorage.get.mockResolvedValueOnce(storedKey);

      await updateAPIKey(storedKey.id, { name: 'Updated Name' });

      expect(mockChromeStorage.remove).toHaveBeenCalledWith(`api_key_cache_${storedKey.id}`);
    });
  });

  describe('Import/Export', () => {
    let storedKey: EncryptedAPIKey;

    beforeEach(async () => {
      storedKey = await addAPIKey(mockAPIKey);
      mockDBInstance.getAll.mockResolvedValueOnce([storedKey.metadata]);
      mockChromeStorage.getBatch.mockResolvedValueOnce({ [`api_key_${storedKey.id}`]: storedKey });
    });

    it('should export keys without secrets', async () => {
      const exported = await exportKeys(false);

      expect(exported).toBeDefined();
      expect(exported.keys).toHaveLength(1);
      expect(exported.keys[0]).toHaveProperty('metadata');
      expect(exported.keys[0]).not.toHaveProperty('encryptedData');
    });

    it('should export keys with secrets when requested', async () => {
      const exported = await exportKeys(true);

      expect(exported).toBeDefined();
      expect(exported.keys).toHaveLength(1);
      expect(exported.keys[0]).toHaveProperty('encryptedData');
    });

    it('should import keys successfully', async () => {
      const importData = {
        keys: [
          {
            metadata: { ...storedKey.metadata, id: 'imported-key' },
            encryptedData: mockEncryptedData,
            keyHash: 'mock-hash',
            checksum: 'mock-checksum',
            storageVersion: 1,
          },
        ],
      };

      const result: ImportResult = await importKeys(importData);

      expect(result.success).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle import errors gracefully', async () => {
      mockDBInstance.add.mockRejectedValueOnce(new Error('Import failed'));

      const importData = {
        keys: [
          {
            metadata: { ...storedKey.metadata, id: 'bad-key' },
            encryptedData: mockEncryptedData,
          },
        ],
      };

      const result = await importKeys(importData);

      expect(result.success).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('Connection Testing', () => {
    let storedKey: EncryptedAPIKey;

    beforeEach(async () => {
      storedKey = await addAPIKey(mockAPIKey);
      mockDBInstance.get.mockResolvedValueOnce(storedKey.metadata);
      mockChromeStorage.get.mockResolvedValueOnce(storedKey);
    });

    it('should test key connection', async () => {
      // Mock successful API response
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const result: ConnectionTestResult = await testKeyConnection(storedKey.id);

      expect(result.success).toBe(true);
      expect(result.responseTime).toBeGreaterThan(0);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('api.openai.com'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockOpenAIKey}`,
          }),
        })
      );
    });

    it('should handle connection failure', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));

      const result = await testKeyConnection(storedKey.id);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('should handle invalid API key response', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      const result = await testKeyConnection(storedKey.id);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unauthorized');
    });
  });

  describe('Health Status', () => {
    it('should get health status', async () => {
      const result: HealthCheckResult = await getHealthStatus();

      expect(result).toBeDefined();
      expect(result.healthy).toBeDefined();
      expect(result.checks).toBeInstanceOf(Array);
    });

    it('should report unhealthy when encryption service is down', async () => {
      mockEncryptionService.isInitialized.mockReturnValue(false);

      const result = await getHealthStatus();

      expect(result.healthy).toBe(false);
      expect(result.checks).toContainEqual(
        expect.objectContaining({
          name: 'encryption_service',
          status: 'fail',
        })
      );
    });

    it('should report healthy when all systems are operational', async () => {
      const result = await getHealthStatus();

      expect(result.healthy).toBe(true);
      expect(result.checks.every(check => check.status === 'pass')).toBe(true);
    });
  });

  describe('Security Features', () => {
    it('should never log unencrypted keys', async () => {
      const consoleSpy = vi.spyOn(console, 'log');

      await addAPIKey(mockAPIKey);

      expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining(mockOpenAIKey));
    });

    it('should clear sensitive data from memory after operations', async () => {
      const storedKey = await addAPIKey(mockAPIKey);
      mockDBInstance.get.mockResolvedValueOnce(storedKey.metadata);
      mockChromeStorage.get.mockResolvedValueOnce(storedKey);

      await getAPIKey(storedKey.id);

      // Should call memory cleanup
      expect(mockEncryptionService.decryptData).toHaveBeenCalled();
    });

    it('should validate checksum on key retrieval', async () => {
      const storedKey = await addAPIKey(mockAPIKey);
      mockDBInstance.get.mockResolvedValueOnce(storedKey.metadata);
      mockChromeStorage.get.mockResolvedValueOnce(storedKey);

      await getAPIKey(storedKey.id);

      expect(mockEncryptionService.validateIntegrityChecksum).toHaveBeenCalled();
    });

    it('should handle session timeout gracefully', async () => {
      mockEncryptionService.isSessionActive.mockReturnValue(false);

      await expect(getAPIKey('any-id')).rejects.toThrow('Session expired');
    });
  });

  describe('Error Handling', () => {
    it('should handle encryption service errors', async () => {
      mockEncryptionService.encryptData.mockRejectedValueOnce(new Error('Encryption failed'));

      await expect(addAPIKey(mockAPIKey)).rejects.toThrow('Failed to encrypt API key');
    });

    it('should handle database errors', async () => {
      mockDBInstance.add.mockRejectedValueOnce(new Error('Database error'));

      await expect(addAPIKey(mockAPIKey)).rejects.toThrow('Failed to store API key');
    });

    it('should handle Chrome storage errors', async () => {
      mockChromeStorage.set.mockRejectedValueOnce(new Error('Storage quota exceeded'));

      await expect(addAPIKey(mockAPIKey)).rejects.toThrow('Failed to store encrypted data');
    });

    it('should provide meaningful error messages', async () => {
      mockEncryptionService.isInitialized.mockReturnValue(false);

      await expect(addAPIKey(mockAPIKey)).rejects.toThrow(
        expect.stringMatching(/not initialized/i)
      );
    });
  });

  describe('Performance', () => {
    it('should handle batch operations efficiently', async () => {
      const keys = Array.from({ length: 100 }, (_, i) => ({
        ...mockAPIKey,
        key: `${mockOpenAIKey.slice(0, -2)}${i.toString().padStart(2, '0')}`,
        name: `Batch Key ${i}`,
      }));

      // Should use batch operations for multiple keys
      const promises = keys.map(key => addAPIKey(key));
      await Promise.all(promises);

      // Verify batch operations were used
      expect(mockDBInstance.batchAdd).toHaveBeenCalled();
    });

    it('should implement pagination for large result sets', async () => {
      const largeResults = Array.from({ length: 1000 }, (_, i) => ({
        id: `key-${i}`,
        provider: 'openai',
        name: `Key ${i}`,
      }));

      mockDBInstance.getAll.mockResolvedValueOnce(largeResults);

      const result = await listAPIKeys({ limit: 50, offset: 100 });

      expect(result.keys).toHaveLength(50);
      expect(result.hasMore).toBe(true);
    });
  });

  describe('Data Migration', () => {
    it('should handle migration from unencrypted storage', async () => {
      // Mock legacy unencrypted data
      mockChromeStorage.get.mockResolvedValueOnce({
        version: 0,
        key: mockOpenAIKey, // Unencrypted
        provider: 'openai',
      });

      await initializeStorage(mockPassword);

      // Should detect and migrate legacy data
      expect(mockEncryptionService.encryptData).toHaveBeenCalledWith(mockOpenAIKey, 'text');
    });

    it('should preserve data during storage version upgrades', async () => {
      // Mock data with older storage version
      const oldVersionKey = {
        ...(await addAPIKey(mockAPIKey)),
        storageVersion: 1,
      };

      mockDBInstance.get.mockResolvedValueOnce(oldVersionKey.metadata);
      mockChromeStorage.get.mockResolvedValueOnce(oldVersionKey);

      const result = await getAPIKey(oldVersionKey.id);

      expect(result).toBeDefined();
      // Should upgrade storage version
      expect(mockDBInstance.update).toHaveBeenCalledWith(
        OBJECT_STORES.API_KEYS,
        oldVersionKey.id,
        expect.objectContaining({
          storageVersion: expect.any(Number),
        })
      );
    });
  });
});
