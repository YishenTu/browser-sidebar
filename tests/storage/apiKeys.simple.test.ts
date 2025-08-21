/**
 * @file Simple API Key Storage Tests
 *
 * Basic test suite to verify the core functionality works.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  initializeStorage,
  addAPIKey,
  getAPIKey,
  shutdown
} from '../../src/storage/apiKeys';

import type { CreateAPIKeyInput } from '../../src/types/apiKeys';

// Mock the dependencies
vi.mock('../../src/security/encryptionService', () => ({
  EncryptionService: {
    getInstance: vi.fn(() => ({
      initialize: vi.fn(),
      isInitialized: vi.fn(() => true),
      isSessionActive: vi.fn(() => true),
      encryptData: vi.fn(() => Promise.resolve({
        data: new Uint8Array([1, 2, 3, 4]),
        iv: new Uint8Array([5, 6, 7, 8]),
        algorithm: 'AES-GCM',
        version: 1
      })),
      decryptData: vi.fn(() => Promise.resolve('sk-1234567890abcdefghijklmnopqrstuvwxyzABCDEFGH')),
      createIntegrityChecksum: vi.fn(() => Promise.resolve('mock-checksum')),
      validateIntegrityChecksum: vi.fn(() => Promise.resolve(true)),
      shutdown: vi.fn()
    }))
  }
}));

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
    batchDelete: vi.fn(() => Promise.resolve())
  }
}));

vi.mock('../../src/storage/chromeStorage', () => ({
  get: vi.fn(() => Promise.resolve(null)),
  set: vi.fn(() => Promise.resolve()),
  remove: vi.fn(() => Promise.resolve()),
  getBatch: vi.fn(() => Promise.resolve({})),
  setBatch: vi.fn(() => Promise.resolve())
}));

// Mock Chrome APIs
global.chrome = {
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn()
    }
  }
} as any;

describe('API Key Storage - Basic Tests', () => {
  const mockAPIKey: CreateAPIKeyInput = {
    key: 'sk-123456789012345678901234567890123456789012345678',
    provider: 'openai',
    name: 'Test OpenAI Key',
    description: 'Test key for unit tests'
  };

  beforeEach(async () => {
    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(async () => {
    try {
      await shutdown();
    } catch {
      // Ignore shutdown errors in tests
    }
  });

  it('should initialize storage', async () => {
    await expect(initializeStorage('test-password-123')).resolves.not.toThrow();
  });

  it('should add API key', async () => {
    await initializeStorage('test-password-123');
    
    const result = await addAPIKey(mockAPIKey);
    
    expect(result).toBeDefined();
    expect(result.id).toBeTruthy();
    expect(result.metadata.provider).toBe('openai');
    expect(result.metadata.name).toBe('Test OpenAI Key');
  });

  it('should get API key', async () => {
    await initializeStorage('test-password-123');
    
    const storedKey = await addAPIKey(mockAPIKey);
    
    // Mock the get operations to return the stored key
    const { dbInstance } = await import('../../src/storage/indexedDB');
    const chromeStorage = await import('../../src/storage/chromeStorage');
    
    vi.mocked(dbInstance.get).mockResolvedValueOnce(storedKey.metadata);
    vi.mocked(chromeStorage.get).mockResolvedValueOnce(storedKey);
    
    const result = await getAPIKey(storedKey.id);
    
    expect(result).toBeDefined();
    expect(result!.id).toBe(storedKey.id);
  });
});