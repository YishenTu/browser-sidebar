/**
 * @file API Key Operations Tests
 *
 * Tests for the API key storage operations including add, get, update, delete
 * with encryption, integrity validation, and cache behavior.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { freezeTime, unfreezeTime, mockMathRandom } from '@tests/helpers/time';
import type { EncryptedData } from '@/data/security/crypto';
import type { ServiceState, EncryptionService, DatabaseService } from '@/data/storage/keys/types';
import type { CreateAPIKeyInput, EncryptedAPIKey, APIKeyStorage } from '@/types/apiKeys';

// Mock modules with inline implementations to avoid hoisting issues
vi.mock('@/data/storage/chrome', () => ({
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(undefined),
  remove: vi.fn().mockResolvedValue(undefined),
  getBatch: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/data/storage/keys/database', () => ({
  getDatabase: vi.fn(),
  setDatabase: vi.fn(),
}));

vi.mock('@/data/storage/keys/utils', async importOriginal => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    auditLog: vi.fn().mockResolvedValue(undefined),
    updateLastUsed: vi.fn().mockResolvedValue(undefined),
  };
});

// Import after mocks
import * as chromeStorage from '@/data/storage/chrome';
import { getDatabase } from '@/data/storage/keys/database';
import { addAPIKey, getAPIKey, updateAPIKey, deleteAPIKey } from '@/data/storage/keys/operations';
import { getCachedKey, setCachedKey } from '@/data/storage/keys/cache';
import { STORAGE_KEYS } from '@/data/storage/keys/constants';

// Helper to create mock encryption service
function createEncryptionServiceStub(
  overrides: Partial<EncryptionService> = {}
): EncryptionService {
  const defaultEncryptedData: EncryptedData = {
    data: new Uint8Array([1, 2, 3, 4]),
    iv: new Uint8Array([5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]),
    algorithm: 'AES-GCM',
    version: 1,
  };

  return {
    initialize: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(undefined),
    encryptData: vi.fn().mockResolvedValue(defaultEncryptedData),
    decryptData: vi.fn().mockResolvedValue('decrypted-api-key'),
    createIntegrityChecksum: vi.fn().mockResolvedValue('mock-checksum-123'),
    verifyIntegrity: vi.fn().mockResolvedValue(true),
    validateIntegrityChecksum: vi.fn().mockResolvedValue(true),
    getInstance: vi.fn().mockReturnThis(),
    isInitialized: true,
    isSessionActive: true,
    openDatabase: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// Helper to create mock database service
function createDatabaseServiceStub(overrides: Partial<DatabaseService> = {}): DatabaseService {
  return {
    add: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    getAll: vi.fn().mockResolvedValue([]),
    query: vi.fn().mockResolvedValue([]),
    openDatabase: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// Helper to create service state
function createServiceState(overrides: Partial<ServiceState> = {}): ServiceState {
  return {
    isInitialized: true,
    encryptionService: createEncryptionServiceStub(),
    cache: new Map(),
    cacheCleanupInterval: null,
    metrics: {
      totalKeys: 0,
      cacheHits: 0,
      cacheMisses: 0,
      operationCounts: {},
      lastCleanup: 0,
    },
    ...overrides,
  };
}

describe('API Key Operations', () => {
  let state: ServiceState;
  let dbStub: DatabaseService;
  let cleanupRandom: (() => void) | null = null;

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up deterministic time and random
    freezeTime(1700000000000);
    cleanupRandom = mockMathRandom([0.5, 0.6, 0.7, 0.8, 0.9]);

    // Create fresh state and stubs
    dbStub = createDatabaseServiceStub();
    vi.mocked(getDatabase).mockReturnValue(dbStub);

    state = createServiceState();

    // Reset chrome storage mocks
    vi.mocked(chromeStorage.get).mockResolvedValue(null);
    vi.mocked(chromeStorage.set).mockResolvedValue(undefined);
    vi.mocked(chromeStorage.remove).mockResolvedValue(undefined);
    vi.mocked(chromeStorage.getBatch).mockResolvedValue({});
  });

  afterEach(() => {
    unfreezeTime();
    if (cleanupRandom) {
      cleanupRandom();
      cleanupRandom = null;
    }
  });

  describe('addAPIKey', () => {
    const validInput: CreateAPIKeyInput = {
      key: 'sk-test-api-key-12345678',
      provider: 'openai',
      name: 'Test Key',
      description: 'A test API key',
      tags: ['test', 'development'],
    };

    it('should add a new API key successfully', async () => {
      const result = await addAPIKey(state, validInput);

      expect(result).toHaveProperty('id');
      expect(result.metadata.provider).toBe('openai');
      expect(result.metadata.name).toBe('Test Key');
      expect(result.metadata.status).toBe('active');
      expect(result.keyHash).toBeDefined();
      expect(result.checksum).toBe('mock-checksum-123');
    });

    it('should require provider', async () => {
      const inputWithoutProvider = {
        ...validInput,
        provider: undefined as unknown as 'openai',
      };

      // Error is normalized to generic message
      await expect(addAPIKey(state, inputWithoutProvider)).rejects.toThrow('Failed to add API key');
    });

    it('should detect duplicate keys via hash mapping', async () => {
      vi.mocked(chromeStorage.get).mockImplementation(async (key: string) => {
        if (key.startsWith(STORAGE_KEYS.API_KEY_HASH_PREFIX)) {
          return { id: 'existing-key-id' };
        }
        return null;
      });

      await expect(addAPIKey(state, validInput)).rejects.toThrow('API key already exists');
    });

    it('should store encrypted data in Chrome storage', async () => {
      await addAPIKey(state, validInput);

      expect(chromeStorage.set).toHaveBeenCalledWith(
        expect.stringContaining(STORAGE_KEYS.API_KEY),
        expect.objectContaining({
          encryptedData: expect.any(Object),
          keyHash: expect.any(String),
        })
      );
    });

    it('should store hash → id mapping for duplicate detection', async () => {
      const result = await addAPIKey(state, validInput);

      const calls = vi.mocked(chromeStorage.set).mock.calls;
      const hashSetCall = calls.find(call =>
        (call[0] as string).startsWith(STORAGE_KEYS.API_KEY_HASH_PREFIX)
      );

      expect(hashSetCall).toBeDefined();
      expect(hashSetCall![1]).toEqual({ id: result.id });
    });

    it('should add metadata to IndexedDB', async () => {
      await addAPIKey(state, validInput);

      expect(dbStub.add).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          provider: 'openai',
          name: 'Test Key',
        })
      );
    });

    it('should increment totalKeys metric', async () => {
      const initialCount = state.metrics.totalKeys;

      await addAPIKey(state, validInput);

      expect(state.metrics.totalKeys).toBe(initialCount + 1);
    });

    it('should throw when not initialized', async () => {
      state.isInitialized = false;

      await expect(addAPIKey(state, validInput)).rejects.toThrow(/not initialized/);
    });

    it('should throw when encryption service not initialized', async () => {
      state.encryptionService!.isInitialized = false;

      await expect(addAPIKey(state, validInput)).rejects.toThrow(/not initialized/);
    });

    it('should throw when session expired', async () => {
      state.encryptionService!.isSessionActive = false;

      await expect(addAPIKey(state, validInput)).rejects.toThrow(/expired/);
    });

    it('should normalize encryption errors', async () => {
      state.encryptionService!.encryptData = vi
        .fn()
        .mockRejectedValue(new Error('Encryption failed'));

      await expect(addAPIKey(state, validInput)).rejects.toThrow('Failed to add API key');
    });

    it('should initialize usage stats', async () => {
      const result = await addAPIKey(state, validInput);

      expect(result.usageStats).toBeDefined();
      expect(result.usageStats!.totalRequests).toBe(0);
      expect(result.usageStats!.lastResetAt).toBe(1700000000000);
    });

    it('should create masked key', async () => {
      const result = await addAPIKey(state, validInput);

      expect(result.metadata.maskedKey).toBeDefined();
      expect(result.metadata.maskedKey).toContain('...');
      expect(result.metadata.maskedKey).not.toBe(validInput.key);
    });
  });

  describe('getAPIKey', () => {
    const mockStoredKey: APIKeyStorage = {
      id: 'openai-123-abc',
      metadata: {
        id: 'openai-123-abc',
        provider: 'openai',
        keyType: 'standard',
        status: 'active',
        name: 'Test Key',
        createdAt: 1700000000000,
        lastUsed: 1700000000000,
        maskedKey: 'sk-...5678',
      },
      encryptedData: {
        data: new Uint8Array([1, 2, 3, 4]),
        iv: new Uint8Array([5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]),
        algorithm: 'AES-GCM',
        version: 1,
      },
      keyHash: 'hash123',
      checksum: 'checksum123',
      storageVersion: 1,
      configuration: { security: { encryptionLevel: 'standard' } },
      usageStats: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalCost: 0,
        avgRequestTime: 0,
        lastResetAt: 1700000000000,
      },
      rotationStatus: { status: 'none', rotationHistory: [] },
    };

    it('should get API key by ID from storage', async () => {
      vi.mocked(chromeStorage.get).mockResolvedValue(mockStoredKey);

      const result = await getAPIKey(state, 'openai-123-abc');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('openai-123-abc');
      expect(result!.metadata.name).toBe('Test Key');
    });

    it('should return null for non-existent key', async () => {
      vi.mocked(chromeStorage.get).mockResolvedValue(null);

      const result = await getAPIKey(state, 'non-existent');

      expect(result).toBeNull();
    });

    it('should validate integrity checksum', async () => {
      vi.mocked(chromeStorage.get).mockResolvedValue(mockStoredKey);

      await getAPIKey(state, 'openai-123-abc');

      expect(state.encryptionService!.validateIntegrityChecksum).toHaveBeenCalled();
    });

    it('should throw on integrity check failure', async () => {
      vi.mocked(chromeStorage.get).mockResolvedValue(mockStoredKey);
      state.encryptionService!.validateIntegrityChecksum = vi.fn().mockResolvedValue(false);

      await expect(getAPIKey(state, 'openai-123-abc')).rejects.toThrow(
        'Data integrity check failed'
      );
    });

    it('should serve from cache on hit', async () => {
      setCachedKey(state, 'openai-123-abc', mockStoredKey as EncryptedAPIKey);

      await getAPIKey(state, 'openai-123-abc');

      expect(state.metrics.cacheHits).toBe(1);
      expect(state.metrics.cacheMisses).toBe(0);
    });

    it('should populate cache on miss', async () => {
      vi.mocked(chromeStorage.get).mockResolvedValue(mockStoredKey);

      await getAPIKey(state, 'openai-123-abc');

      expect(state.metrics.cacheMisses).toBe(1);

      const cached = getCachedKey(state, 'openai-123-abc');
      expect(cached).not.toBeNull();
    });

    it('should increment operation count', async () => {
      vi.mocked(chromeStorage.get).mockResolvedValue(mockStoredKey);

      await getAPIKey(state, 'openai-123-abc');

      expect(state.metrics.operationCounts['get']).toBe(1);
    });

    it('should remove corrupted entry from cache', async () => {
      setCachedKey(state, 'openai-123-abc', mockStoredKey as EncryptedAPIKey);
      state.encryptionService!.validateIntegrityChecksum = vi.fn().mockResolvedValue(false);

      await expect(getAPIKey(state, 'openai-123-abc')).rejects.toThrow(
        'Data integrity check failed'
      );

      const cached = getCachedKey(state, 'openai-123-abc');
      expect(cached).toBeNull();
    });
  });

  describe('updateAPIKey', () => {
    const existingKey: APIKeyStorage = {
      id: 'openai-123-abc',
      metadata: {
        id: 'openai-123-abc',
        provider: 'openai',
        keyType: 'standard',
        status: 'active',
        name: 'Original Name',
        createdAt: 1700000000000,
        lastUsed: 1700000000000,
        maskedKey: 'sk-...5678',
      },
      encryptedData: {
        data: new Uint8Array([1, 2, 3, 4]),
        iv: new Uint8Array([5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]),
        algorithm: 'AES-GCM',
        version: 1,
      },
      keyHash: 'hash123',
      checksum: 'checksum123',
      storageVersion: 1,
      configuration: { security: { encryptionLevel: 'standard' } },
      usageStats: {
        totalRequests: 10,
        successfulRequests: 9,
        failedRequests: 1,
        totalTokens: 1000,
        inputTokens: 500,
        outputTokens: 500,
        totalCost: 0.5,
        avgRequestTime: 200,
        lastResetAt: 1700000000000,
      },
      rotationStatus: { status: 'none', rotationHistory: [] },
    };

    beforeEach(() => {
      vi.mocked(chromeStorage.get).mockResolvedValue(existingKey);
    });

    it('should update metadata fields', async () => {
      const result = await updateAPIKey(state, 'openai-123-abc', {
        name: 'Updated Name',
        description: 'New description',
      });

      expect(result.metadata.name).toBe('Updated Name');
      expect(result.metadata.description).toBe('New description');
    });

    it('should preserve unchanged fields', async () => {
      const result = await updateAPIKey(state, 'openai-123-abc', {
        name: 'Updated Name',
      });

      expect(result.metadata.provider).toBe('openai');
      expect(result.metadata.keyType).toBe('standard');
      expect(result.metadata.createdAt).toBe(1700000000000);
    });

    it('should throw for non-existent key', async () => {
      vi.mocked(chromeStorage.get).mockResolvedValue(null);

      await expect(updateAPIKey(state, 'non-existent', { name: 'New' })).rejects.toThrow(
        'API key not found'
      );
    });

    it('should update lastUsed timestamp', async () => {
      const result = await updateAPIKey(state, 'openai-123-abc', { name: 'Updated' });

      expect(result.metadata.lastUsed).toBe(1700000000000);
    });

    it('should invalidate cache after update', async () => {
      setCachedKey(state, 'openai-123-abc', existingKey as EncryptedAPIKey);

      await updateAPIKey(state, 'openai-123-abc', { name: 'Updated' });

      const cached = getCachedKey(state, 'openai-123-abc');
      expect(cached).toBeNull();
    });

    it('should merge configuration updates', async () => {
      const result = await updateAPIKey(state, 'openai-123-abc', {
        configuration: {
          endpoint: { baseUrl: 'https://custom.api.com' },
        },
      });

      expect(result.configuration.security).toBeDefined();
      expect(result.configuration.endpoint?.baseUrl).toBe('https://custom.api.com');
    });

    it('should update IndexedDB metadata', async () => {
      await updateAPIKey(state, 'openai-123-abc', { name: 'Updated' });

      expect(dbStub.update).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ name: 'Updated' })
      );
    });

    it('should store updated key in Chrome storage', async () => {
      await updateAPIKey(state, 'openai-123-abc', { name: 'Updated' });

      expect(chromeStorage.set).toHaveBeenCalledWith(
        `${STORAGE_KEYS.API_KEY}openai-123-abc`,
        expect.objectContaining({
          metadata: expect.objectContaining({ name: 'Updated' }),
        })
      );
    });
  });

  describe('deleteAPIKey', () => {
    const existingKey: APIKeyStorage = {
      id: 'openai-123-abc',
      metadata: {
        id: 'openai-123-abc',
        provider: 'openai',
        keyType: 'standard',
        status: 'active',
        name: 'To Delete',
        createdAt: 1700000000000,
        lastUsed: 1700000000000,
        maskedKey: 'sk-...5678',
      },
      encryptedData: {
        data: new Uint8Array([1, 2, 3, 4]),
        iv: new Uint8Array([5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]),
        algorithm: 'AES-GCM',
        version: 1,
      },
      keyHash: 'hash123',
      checksum: 'checksum123',
      storageVersion: 1,
      configuration: {},
      usageStats: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalCost: 0,
        avgRequestTime: 0,
        lastResetAt: 1700000000000,
      },
      rotationStatus: { status: 'none', rotationHistory: [] },
    };

    beforeEach(() => {
      vi.mocked(chromeStorage.get).mockResolvedValue(existingKey);
    });

    it('should delete existing key', async () => {
      const result = await deleteAPIKey(state, 'openai-123-abc');

      expect(result).toBe(true);
    });

    it('should return false for non-existent key', async () => {
      vi.mocked(chromeStorage.get).mockResolvedValue(null);

      const result = await deleteAPIKey(state, 'non-existent');

      expect(result).toBe(false);
    });

    it('should remove from Chrome storage', async () => {
      await deleteAPIKey(state, 'openai-123-abc');

      expect(chromeStorage.remove).toHaveBeenCalledWith(`${STORAGE_KEYS.API_KEY}openai-123-abc`);
    });

    it('should remove hash mapping', async () => {
      await deleteAPIKey(state, 'openai-123-abc');

      expect(chromeStorage.remove).toHaveBeenCalledWith(
        `${STORAGE_KEYS.API_KEY_HASH_PREFIX}hash123`
      );
    });

    it('should remove from IndexedDB', async () => {
      await deleteAPIKey(state, 'openai-123-abc');

      expect(dbStub.delete).toHaveBeenCalledWith(expect.any(String), 'openai-123-abc');
    });

    it('should invalidate cache', async () => {
      setCachedKey(state, 'openai-123-abc', existingKey as EncryptedAPIKey);

      await deleteAPIKey(state, 'openai-123-abc');

      const cached = getCachedKey(state, 'openai-123-abc');
      expect(cached).toBeNull();
    });

    it('should remove cache key from Chrome storage', async () => {
      await deleteAPIKey(state, 'openai-123-abc');

      expect(chromeStorage.remove).toHaveBeenCalledWith(
        `${STORAGE_KEYS.API_KEY_CACHE}openai-123-abc`
      );
    });

    it('should decrement totalKeys metric', async () => {
      state.metrics.totalKeys = 5;

      await deleteAPIKey(state, 'openai-123-abc');

      expect(state.metrics.totalKeys).toBe(4);
    });

    it('should normalize errors', async () => {
      vi.mocked(chromeStorage.remove).mockRejectedValue(new Error('Storage error'));

      await expect(deleteAPIKey(state, 'openai-123-abc')).rejects.toThrow(
        'Failed to delete API key'
      );
    });
  });

  describe('cache behavior', () => {
    const mockKey: APIKeyStorage = {
      id: 'openai-123-abc',
      metadata: {
        id: 'openai-123-abc',
        provider: 'openai',
        keyType: 'standard',
        status: 'active',
        name: 'Cached Key',
        createdAt: 1700000000000,
        lastUsed: 1700000000000,
        maskedKey: 'sk-...5678',
      },
      encryptedData: {
        data: new Uint8Array([1, 2, 3, 4]),
        iv: new Uint8Array([5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]),
        algorithm: 'AES-GCM',
        version: 1,
      },
      keyHash: 'hash123',
      checksum: 'checksum123',
      storageVersion: 1,
      configuration: {},
      usageStats: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalCost: 0,
        avgRequestTime: 0,
        lastResetAt: 1700000000000,
      },
      rotationStatus: { status: 'none', rotationHistory: [] },
    };

    it('should track cache hits', async () => {
      setCachedKey(state, 'openai-123-abc', mockKey as EncryptedAPIKey);

      await getAPIKey(state, 'openai-123-abc');
      await getAPIKey(state, 'openai-123-abc');
      await getAPIKey(state, 'openai-123-abc');

      expect(state.metrics.cacheHits).toBe(3);
    });

    it('should track cache misses', async () => {
      vi.mocked(chromeStorage.get).mockResolvedValue(mockKey);

      await getAPIKey(state, 'key-1');
      await getAPIKey(state, 'key-2');

      expect(state.metrics.cacheMisses).toBe(2);
    });

    it('should invalidate cache on update', async () => {
      vi.mocked(chromeStorage.get).mockResolvedValue(mockKey);
      setCachedKey(state, 'openai-123-abc', mockKey as EncryptedAPIKey);

      await updateAPIKey(state, 'openai-123-abc', { name: 'Updated' });

      expect(getCachedKey(state, 'openai-123-abc')).toBeNull();
    });

    it('should invalidate cache on delete', async () => {
      vi.mocked(chromeStorage.get).mockResolvedValue(mockKey);
      setCachedKey(state, 'openai-123-abc', mockKey as EncryptedAPIKey);

      await deleteAPIKey(state, 'openai-123-abc');

      expect(getCachedKey(state, 'openai-123-abc')).toBeNull();
    });
  });

  describe('error normalization', () => {
    const validInput: CreateAPIKeyInput = {
      key: 'sk-test-key',
      provider: 'openai',
      name: 'Test',
    };

    it('should preserve "already exists" error message', async () => {
      vi.mocked(chromeStorage.get).mockImplementation(async (key: string) => {
        if (key.startsWith(STORAGE_KEYS.API_KEY_HASH_PREFIX)) {
          return { id: 'existing' };
        }
        return null;
      });

      await expect(addAPIKey(state, validInput)).rejects.toThrow('API key already exists');
    });

    it('should normalize encryption errors', async () => {
      state.encryptionService!.encryptData = vi
        .fn()
        .mockRejectedValue(new Error('Encryption failed: invalid key'));

      await expect(addAPIKey(state, validInput)).rejects.toThrow('Failed to add API key');
    });

    it('should normalize database errors', async () => {
      dbStub.add = vi.fn().mockRejectedValue(new Error('Database error: constraint violation'));

      await expect(addAPIKey(state, validInput)).rejects.toThrow('Failed to add API key');
    });

    it('should normalize storage quota errors', async () => {
      vi.mocked(chromeStorage.set).mockRejectedValue(new Error('Storage quota exceeded'));

      await expect(addAPIKey(state, validInput)).rejects.toThrow('Failed to add API key');
    });
  });
});
