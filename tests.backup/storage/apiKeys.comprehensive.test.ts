/**
 * @file Comprehensive API Key Storage Tests
 *
 * Extended test suite covering additional functionality for better coverage.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  initializeStorage,
  addAPIKey,
  getAPIKey,
  updateAPIKey,
  deleteAPIKey,
  listAPIKeys,
  getKeysByProvider,
  rotateAPIKey,
  recordUsage,
  getKeyUsageStats,
  clearCache,
  exportKeys,
  importKeys,
  testKeyConnection,
  getHealthStatus,
  shutdown,
} from '../../src/storage/apiKeys';

import type {
  CreateAPIKeyInput,
  UpdateAPIKeyInput,
  APIKeyQueryOptions,
} from '../../src/types/apiKeys';

// Mock EncryptionService to always return the same instance
vi.mock('../../src/security/encryptionService', () => {
  const instance = {
    initialize: vi.fn(),
    isInitialized: vi.fn(() => true),
    isSessionActive: vi.fn(() => true),
    encryptData: vi.fn(() =>
      Promise.resolve({
        data: new Uint8Array([1, 2, 3, 4]),
        iv: new Uint8Array([5, 6, 7, 8]),
        algorithm: 'AES-GCM' as const,
        version: 1,
      })
    ),
    decryptData: vi.fn(() =>
      Promise.resolve('sk-123456789012345678901234567890123456789012345678')
    ),
    createIntegrityChecksum: vi.fn(() => Promise.resolve('mock-checksum')),
    validateIntegrityChecksum: vi.fn(() => Promise.resolve(true)),
    shutdown: vi.fn(),
  } as any;
  return {
    EncryptionService: {
      getInstance: vi.fn(() => instance),
    },
  };
});

vi.mock('../../src/storage/indexedDB', () => ({
  dbInstance: {
    openDatabase: vi.fn(() => Promise.resolve({})),
    add: vi.fn(() => Promise.resolve('key-id-123')),
    get: vi.fn(() => Promise.resolve(null)),
    update: vi.fn(() => Promise.resolve()),
    delete: vi.fn(() => Promise.resolve()),
    getAll: vi.fn(() => Promise.resolve([])),
    query: vi.fn(() => Promise.resolve([])),
    batchAdd: vi.fn(() => Promise.resolve()),
    batchDelete: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock('../../src/storage/chromeStorage', () => ({
  get: vi.fn(() => Promise.resolve(null)),
  set: vi.fn(() => Promise.resolve()),
  remove: vi.fn(() => Promise.resolve()),
  getBatch: vi.fn(() => Promise.resolve({})),
  setBatch: vi.fn(() => Promise.resolve()),
}));

// Mock Chrome APIs
global.chrome = {
  storage: { local: { get: vi.fn(), set: vi.fn(), remove: vi.fn(), clear: vi.fn() } },
} as any;

// Mock fetch for connection testing
global.fetch = vi.fn();

describe('API Key Storage - Comprehensive Tests', () => {
  const mockAPIKey: CreateAPIKeyInput = {
    key: 'sk-123456789012345678901234567890123456789012345678',
    provider: 'openai',
    name: 'Test OpenAI Key',
    description: 'Test key for unit tests',
  };

  const mockAnthropicKey: CreateAPIKeyInput = {
    key: 'sk-ant-1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKL',
    provider: 'anthropic',
    name: 'Test Anthropic Key',
  };

  // Get references to the mocked modules
  let mockEncryptionService: any;
  let mockDBInstance: any;
  let mockChromeStorage: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Get fresh references to mocked modules
    const { EncryptionService } = await import('../../src/security/encryptionService');
    const { dbInstance } = await import('../../src/storage/indexedDB');
    const chromeStorage = await import('../../src/storage/chromeStorage');

    mockEncryptionService = vi.mocked(EncryptionService.getInstance)();
    mockDBInstance = vi.mocked(dbInstance);
    mockChromeStorage = vi.mocked(chromeStorage);

    // Reset mock return values
    mockEncryptionService.isInitialized.mockReturnValue(true);
    mockEncryptionService.isSessionActive.mockReturnValue(true);
    mockDBInstance.get.mockResolvedValue(null);
    mockChromeStorage.get.mockResolvedValue(null);

    await initializeStorage('test-password-123');
  });

  afterEach(async () => {
    try {
      await shutdown();
    } catch {
      // Ignore shutdown errors
    }
  });

  describe('Initialization and Validation', () => {
    it('should require strong password', async () => {
      await shutdown();
      await expect(initializeStorage('weak')).rejects.toThrow('Password too weak');
    });

    it('should prevent re-initialization', async () => {
      await expect(initializeStorage('test-password-123')).rejects.toThrow('already initialized');
    });

    it('should validate service state before operations', async () => {
      mockEncryptionService.isInitialized.mockReturnValue(false);
      await expect(addAPIKey(mockAPIKey)).rejects.toThrow('not initialized');
    });

    it('should validate session state before operations', async () => {
      mockEncryptionService.isSessionActive.mockReturnValue(false);
      await expect(addAPIKey(mockAPIKey)).rejects.toThrow('Session expired');
    });
  });

  describe('API Key CRUD Operations', () => {
    it('should add API key with all features', async () => {
      const result = await addAPIKey(mockAPIKey);

      expect(result).toBeDefined();
      expect(result.id).toBeTruthy();
      expect(result.metadata.provider).toBe('openai');
      expect(result.metadata.name).toBe('Test OpenAI Key');
      expect(result.metadata.status).toBe('active');
      expect(result.metadata.maskedKey).toMatch(/^sk-....*...$/);
      expect(result.usageStats.totalRequests).toBe(0);
      expect(result.rotationStatus.status).toBe('none');
    });

    it('should detect provider automatically', async () => {
      const keyWithoutProvider = { ...mockAPIKey, provider: undefined as any };
      const result = await addAPIKey(keyWithoutProvider);
      expect(result.metadata.provider).toBe('openai');
    });

    it('should prevent duplicate keys', async () => {
      await addAPIKey(mockAPIKey);
      // Compute real keyHash and mock hash mapping
      const { hashData } = await import('../../src/security/crypto');
      const hashBytes = await hashData(mockAPIKey.key);
      const keyHash = Array.from(hashBytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      mockChromeStorage.get.mockImplementation(async (key: string) => {
        if (key === `api_key_hash_${keyHash}`) return { id: 'existing-id' } as any;
        return null as any;
      });
      await expect(addAPIKey(mockAPIKey)).rejects.toThrow('API key already exists');
    });

    it('should validate key format', async () => {
      const invalidKey = { ...mockAPIKey, key: 'invalid-key' };
      await expect(addAPIKey(invalidKey)).rejects.toThrow('Invalid API key format');
    });

    it('should update API key metadata', async () => {
      const storedKey = await addAPIKey(mockAPIKey);

      // Mock get operations
      mockDBInstance.get.mockResolvedValueOnce(storedKey.metadata);
      mockChromeStorage.get.mockResolvedValueOnce(storedKey);

      const updates: UpdateAPIKeyInput = {
        name: 'Updated Key Name',
        description: 'Updated description',
        status: 'inactive',
      };

      const result = await updateAPIKey(storedKey.id, updates);

      expect(result.metadata.name).toBe('Updated Key Name');
      expect(result.metadata.description).toBe('Updated description');
      expect(result.metadata.status).toBe('inactive');
    });

    it('should delete API key completely', async () => {
      const storedKey = await addAPIKey(mockAPIKey);

      // Mock get operation
      mockDBInstance.get.mockResolvedValueOnce(storedKey.metadata);
      mockChromeStorage.get.mockResolvedValueOnce(storedKey);

      const result = await deleteAPIKey(storedKey.id);

      expect(result).toBe(true);
      expect(mockDBInstance.delete).toHaveBeenCalledWith('apiKeys', storedKey.id);
      expect(mockChromeStorage.remove).toHaveBeenCalled();
    });

    it('should return false when deleting non-existent key', async () => {
      const result = await deleteAPIKey('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('Query and Listing Operations', () => {
    it('should list all API keys', async () => {
      const mockMetadata = [
        { id: 'key1', provider: 'openai', name: 'Key 1' },
        { id: 'key2', provider: 'anthropic', name: 'Key 2' },
      ];

      mockDBInstance.getAll.mockResolvedValueOnce(mockMetadata);

      const result = await listAPIKeys();

      expect(result.keys).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.hasMore).toBe(false);
    });

    it('should filter keys by provider', async () => {
      const openAIKeys = [{ id: 'key1', provider: 'openai', name: 'Key 1' }];
      mockDBInstance.query.mockResolvedValueOnce(openAIKeys);

      const options: APIKeyQueryOptions = { provider: 'openai' };
      const result = await listAPIKeys(options);

      expect(result.keys).toHaveLength(1);
      expect(mockDBInstance.query).toHaveBeenCalledWith(
        'apiKeys',
        'provider',
        'openai',
        expect.any(Object)
      );
    });

    it('should filter keys by status', async () => {
      const activeKeys = [{ id: 'key1', provider: 'openai', status: 'active' }];
      mockDBInstance.query.mockResolvedValueOnce(activeKeys);

      const options: APIKeyQueryOptions = { status: 'active' };
      await listAPIKeys(options);

      expect(mockDBInstance.query).toHaveBeenCalledWith(
        'apiKeys',
        'status',
        'active',
        expect.any(Object)
      );
    });

    it('should search keys by name and description', async () => {
      const allKeys = [
        { id: 'key1', provider: 'openai', name: 'Test Key', description: 'Test description' },
        { id: 'key2', provider: 'anthropic', name: 'Production Key', description: 'Prod env' },
      ];
      mockDBInstance.getAll.mockResolvedValueOnce(allKeys);

      const options: APIKeyQueryOptions = { search: 'test' };
      const result = await listAPIKeys(options);

      expect(result.keys).toHaveLength(1);
      expect(result.keys[0].metadata.name).toBe('Test Key');
    });

    it('should get keys by provider', async () => {
      const openAIKeys = [{ id: 'key1', provider: 'openai', name: 'Key 1' }];
      mockDBInstance.query.mockResolvedValueOnce(openAIKeys);

      const result = await getKeysByProvider('openai');

      expect(result).toHaveLength(1);
      expect(result[0].metadata.provider).toBe('openai');
    });
  });

  describe('Key Rotation', () => {
    it('should rotate API key successfully', async () => {
      const storedKey = await addAPIKey(mockAPIKey);
      const newKey = 'sk-987654321098765432109876543210987654321098765432';

      // Mock get operations
      mockDBInstance.get.mockResolvedValueOnce(storedKey.metadata);
      mockChromeStorage.get.mockResolvedValueOnce(storedKey);

      const result = await rotateAPIKey(storedKey.id, newKey);

      expect(result.success).toBe(true);
      expect(result.newKeyId).toBeTruthy();
      expect(result.rollbackAvailable).toBe(true);
    });

    it('should validate new key format during rotation', async () => {
      const storedKey = await addAPIKey(mockAPIKey);

      mockDBInstance.get.mockResolvedValueOnce(storedKey.metadata);
      mockChromeStorage.get.mockResolvedValueOnce(storedKey);

      await expect(rotateAPIKey(storedKey.id, 'invalid-key')).rejects.toThrow(
        'Invalid API key format'
      );
    });

    it('should handle rotation failure gracefully', async () => {
      const storedKey = await addAPIKey(mockAPIKey);
      const newKey = 'sk-987654321098765432109876543210987654321098765432';

      mockDBInstance.get.mockResolvedValueOnce(storedKey.metadata);
      mockChromeStorage.get.mockResolvedValueOnce(storedKey);
      mockEncryptionService.encryptData.mockRejectedValueOnce(new Error('Encryption failed'));

      const result = await rotateAPIKey(storedKey.id, newKey);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Encryption failed');
    });
  });

  describe('Usage Statistics', () => {
    it('should record usage statistics', async () => {
      const storedKey = await addAPIKey(mockAPIKey);

      mockDBInstance.get.mockResolvedValueOnce(storedKey.metadata);
      mockChromeStorage.get.mockResolvedValueOnce(storedKey);

      const usage = {
        requests: 5,
        tokens: 1000,
        cost: 0.02,
        responseTime: 150,
      };

      await recordUsage(storedKey.id, usage);

      expect(mockDBInstance.update).toHaveBeenCalled();
      expect(mockChromeStorage.set).toHaveBeenCalled();
    });

    it('should get usage statistics', async () => {
      const storedKey = await addAPIKey(mockAPIKey);

      mockDBInstance.get.mockResolvedValueOnce(storedKey.metadata);
      mockChromeStorage.get.mockResolvedValueOnce(storedKey);

      const stats = await getKeyUsageStats(storedKey.id);

      expect(stats).toBeDefined();
      expect(stats.totalRequests).toBe(0);
      expect(stats.totalTokens).toBe(0);
    });
  });

  describe('Import/Export', () => {
    it('should export keys without secrets', async () => {
      const mockMetadata = [{ id: 'key1', provider: 'openai', name: 'Key 1' }];
      mockDBInstance.getAll.mockResolvedValueOnce(mockMetadata);

      const exported = await exportKeys(false);

      expect(exported).toBeDefined();
      expect(exported.keys).toHaveLength(1);
      expect(exported.includeSecrets).toBe(false);
    });

    it('should export keys with secrets', async () => {
      const mockMetadata = [{ id: 'key1', provider: 'openai', name: 'Key 1' }];
      const mockEncryptedKeys = { api_key_key1: { metadata: mockMetadata[0], encryptedData: {} } };

      mockDBInstance.getAll.mockResolvedValueOnce(mockMetadata);
      mockChromeStorage.getBatch.mockResolvedValueOnce(mockEncryptedKeys);

      const exported = await exportKeys(true);

      expect(exported).toBeDefined();
      expect(exported.keys).toHaveLength(1);
      expect(exported.includeSecrets).toBe(true);
    });

    it('should import keys successfully', async () => {
      const importData = {
        keys: [
          {
            metadata: { id: 'imported-key', provider: 'openai', name: 'Imported Key' },
            encryptedData: { data: new Uint8Array([1, 2, 3]) },
          },
        ],
      };

      const result = await importKeys(importData);

      expect(result.success).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle import errors', async () => {
      mockDBInstance.add.mockRejectedValueOnce(new Error('Import failed'));

      const importData = {
        keys: [{ metadata: { id: 'bad-key', provider: 'openai' } }],
      };

      const result = await importKeys(importData);

      expect(result.success).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('Connection Testing', () => {
    it('should test key connection successfully', async () => {
      const storedKey = await addAPIKey(mockAPIKey);

      mockDBInstance.get.mockResolvedValueOnce(storedKey.metadata);
      mockChromeStorage.get.mockResolvedValueOnce(storedKey);

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
      } as Response);

      const result = await testKeyConnection(storedKey.id);

      expect(result.success).toBe(true);
      expect(result.responseTime).toBeGreaterThan(0);
    });

    it('should handle connection failure', async () => {
      const storedKey = await addAPIKey(mockAPIKey);

      mockDBInstance.get.mockResolvedValueOnce(storedKey.metadata);
      mockChromeStorage.get.mockResolvedValueOnce(storedKey);

      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

      const result = await testKeyConnection(storedKey.id);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('should handle unauthorized response', async () => {
      const storedKey = await addAPIKey(mockAPIKey);

      mockDBInstance.get.mockResolvedValueOnce(storedKey.metadata);
      mockChromeStorage.get.mockResolvedValueOnce(storedKey);

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      } as Response);

      const result = await testKeyConnection(storedKey.id);

      expect(result.success).toBe(false);
      expect(result.error).toContain('401 Unauthorized');
    });
  });

  describe('Health Status', () => {
    it('should report healthy status', async () => {
      const result = await getHealthStatus();

      expect(result.healthy).toBe(true);
      expect(result.checks).toBeInstanceOf(Array);
      expect(result.checks.length).toBeGreaterThan(0);
    });

    it('should report unhealthy when encryption service is down', async () => {
      mockEncryptionService.isInitialized.mockReturnValue(false);

      const result = await getHealthStatus();

      expect(result.healthy).toBe(false);
      expect(
        result.checks.some(check => check.name === 'encryption_service' && check.status === 'fail')
      ).toBe(true);
    });
  });

  describe('Cache Management', () => {
    it('should clear cache', async () => {
      await clearCache();
      expect(mockChromeStorage.getBatch).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle encryption service errors', async () => {
      mockEncryptionService.encryptData.mockRejectedValueOnce(new Error('Encryption failed'));

      await expect(addAPIKey(mockAPIKey)).rejects.toThrow('Failed to add API key');
    });

    it('should handle database errors', async () => {
      mockDBInstance.add.mockRejectedValueOnce(new Error('Database error'));

      await expect(addAPIKey(mockAPIKey)).rejects.toThrow('Failed to add API key');
    });

    it('should handle Chrome storage errors', async () => {
      mockChromeStorage.set.mockRejectedValueOnce(new Error('Storage quota exceeded'));

      await expect(addAPIKey(mockAPIKey)).rejects.toThrow('Failed to add API key');
    });
  });

  describe('Data Integrity', () => {
    it('should verify data integrity on retrieval', async () => {
      const storedKey = await addAPIKey(mockAPIKey);

      mockDBInstance.get.mockResolvedValueOnce(storedKey.metadata);
      mockChromeStorage.get.mockResolvedValueOnce(storedKey);

      await getAPIKey(storedKey.id);

      expect(mockEncryptionService.validateIntegrityChecksum).toHaveBeenCalled();
    });

    it('should handle corrupted data', async () => {
      const storedKey = await addAPIKey(mockAPIKey);

      mockDBInstance.get.mockResolvedValueOnce(storedKey.metadata);
      mockChromeStorage.get.mockResolvedValueOnce(storedKey);
      mockEncryptionService.validateIntegrityChecksum.mockResolvedValueOnce(false);

      await expect(getAPIKey(storedKey.id)).rejects.toThrow('Data integrity check failed');
    });
  });
});
