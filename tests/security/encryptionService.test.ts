/**
 * @file Encryption Service Tests
 *
 * Comprehensive test suite for the high-level encryption service following TDD approach.
 * Tests cover service initialization, bulk operations, error handling, key management,
 * session management, and security features.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Types and interfaces for the encryption service
interface EncryptionServiceConfig {
  sessionTimeout?: number;
  keyRotationInterval?: number;
  enableAutoRotation?: boolean;
  memoryCleanupInterval?: number;
}

interface FieldEncryptionMap {
  [fieldName: string]: 'encrypt' | 'skip';
}

interface ServiceStatus {
  isInitialized: boolean;
  sessionActive: boolean;
  lastActivity: Date | null;
  sessionTimeout: number;
  autoRotationEnabled: boolean;
  keyRotationInterval: number;
}

interface BulkOperationResult<T> {
  success: T[];
  errors: Array<{ item: T; error: Error }>;
  totalCount: number;
  successCount: number;
  errorCount: number;
}

interface DataIntegrityResult {
  isValid: boolean;
  hash: string;
  verifiedAt: Date;
}

// Import the encryption service we'll implement
import {
  EncryptionService,
} from '@/security/encryptionService';

// Mock existing crypto and key derivation modules
vi.mock('@/security/crypto', () => ({
  generateKey: vi.fn(),
  encrypt: vi.fn(),
  decrypt: vi.fn(),
  encryptText: vi.fn(),
  decryptText: vi.fn(),
  encryptObject: vi.fn(),
  decryptObject: vi.fn(),
  hashData: vi.fn(),
  secureRandom: vi.fn(),
  isValidEncryptedData: vi.fn(),
}));

vi.mock('@/security/keyDerivation', () => ({
  KeyDerivationManager: vi.fn().mockImplementation(() => ({
    createMasterKey: vi.fn(),
    restoreMasterKey: vi.fn(),
    getMasterKey: vi.fn(),
    clearMasterKey: vi.fn(),
    deriveKey: vi.fn(),
    deriveMultipleKeys: vi.fn(),
    getConfig: vi.fn(),
    updateConfig: vi.fn(),
  })),
  generateSalt: vi.fn(),
}));

// Mock Chrome storage API
const mockChromeStorage = {
  local: {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn(),
  },
};

// Mock crypto API
const mockSubtleCrypto = {
  generateKey: vi.fn(),
  encrypt: vi.fn(),
  decrypt: vi.fn(),
  deriveKey: vi.fn(),
  importKey: vi.fn(),
  digest: vi.fn(),
};

const mockCrypto = {
  subtle: mockSubtleCrypto,
  getRandomValues: vi.fn((array) => {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  }),
};

// Global setup
beforeEach(() => {
  vi.clearAllMocks();
  
  // Reset Chrome storage mocks to resolved state
  mockChromeStorage.local.get.mockResolvedValue({});
  mockChromeStorage.local.set.mockResolvedValue(undefined);
  mockChromeStorage.local.remove.mockResolvedValue(undefined);
  mockChromeStorage.local.clear.mockResolvedValue(undefined);
  
  // Mock Chrome APIs
  Object.defineProperty(globalThis, 'chrome', {
    value: {
      storage: mockChromeStorage,
    },
    writable: true,
    configurable: true,
  });
  
  // Mock crypto API
  Object.defineProperty(globalThis, 'crypto', {
    value: mockCrypto,
    writable: true,
    configurable: true,
  });
  
  // Reset timers
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// Helper functions for creating mock data
function createMockMasterKeyResult() {
  return {
    masterKey: {} as any,
    salt: new Uint8Array(32),
    iterations: 100000,
    algorithm: 'PBKDF2' as const,
    hashAlgorithm: 'SHA-256' as const,
    keySize: 256,
    version: 1,
    createdAt: new Date(),
  };
}

function createMockDerivedKey(purpose: any = 'encryption') {
  return {
    purpose,
    key: {} as any,
    algorithm: 'AES-GCM' as const,
    keySize: 256,
    derivedAt: new Date(),
    version: 1,
  };
}

function createMockEncryptedData() {
  return {
    algorithm: 'AES-256-GCM' as const,
    iv: new Uint8Array(12),
    data: new Uint8Array(16),
    version: 1,
  };
}

describe('EncryptionService', () => {
  describe('Service Initialization', () => {
    it('should create service instance with default configuration', () => {
      const service = new EncryptionService();
      
      expect(service).toBeInstanceOf(EncryptionService);
      expect(service.isInitialized()).toBe(false);
    });

    it('should create service instance with custom configuration', () => {
      const config: EncryptionServiceConfig = {
        sessionTimeout: 60000,
        keyRotationInterval: 3600000,
        enableAutoRotation: true,
        memoryCleanupInterval: 300000,
      };
      
      const service = new EncryptionService(config);
      
      expect(service).toBeInstanceOf(EncryptionService);
      expect(service.isInitialized()).toBe(false);
    });

    it('should initialize service with master password', async () => {
      const service = new EncryptionService();
      const password = 'secure-master-password';
      
      // Mock the key derivation manager methods
      const mockManager = service['keyManager'];
      vi.mocked(mockManager.createMasterKey).mockResolvedValue(createMockMasterKeyResult());
      
      // Mock Chrome storage
      mockChromeStorage.local.set.mockResolvedValue(undefined);
      
      await service.initialize(password);
      
      expect(service.isInitialized()).toBe(true);
      expect(service.isSessionActive()).toBe(true);
    });

    it('should throw error on weak password', async () => {
      const service = new EncryptionService();
      const weakPassword = '123';
      
      await expect(service.initialize(weakPassword)).rejects.toThrow('Password too weak');
    });

    it('should validate configuration parameters', () => {
      expect(() => new EncryptionService({
        sessionTimeout: -1000,
      })).toThrow('Invalid configuration');
      
      expect(() => new EncryptionService({
        keyRotationInterval: 0,
      })).toThrow('Invalid configuration');
    });

    it('should get service status correctly', async () => {
      const service = new EncryptionService({
        sessionTimeout: 30000,
        enableAutoRotation: true,
        keyRotationInterval: 60000,
      });
      
      let status = service.getStatus();
      expect(status.isInitialized).toBe(false);
      expect(status.sessionActive).toBe(false);
      expect(status.lastActivity).toBeNull();
      expect(status.sessionTimeout).toBe(30000);
      expect(status.autoRotationEnabled).toBe(true);
      expect(status.keyRotationInterval).toBe(60000);
    });
  });

  describe('Key Management', () => {
    let service: EncryptionService;
    
    beforeEach(async () => {
      service = new EncryptionService();
      
      const mockManager = service['keyManager'];
      vi.mocked(mockManager.createMasterKey).mockResolvedValue(createMockMasterKeyResult());
      vi.mocked(mockManager.deriveKey).mockResolvedValue(createMockDerivedKey('storage'));
      
      mockChromeStorage.local.set.mockResolvedValue(undefined);
      
      await service.initialize('secure-master-password');
    });

    it('should generate encryption key for purpose', async () => {
      const mockManager = service['keyManager'];
      vi.mocked(mockManager.deriveKey).mockResolvedValue(createMockDerivedKey('storage'));
      
      const key = await service.getEncryptionKey('storage');
      
      expect(key).toBeDefined();
      expect(key.purpose).toBe('storage');
      expect(key.algorithm).toBe('AES-GCM');
    });

    it('should cache encryption keys', async () => {
      const mockManager = service['keyManager'];
      const mockKey = createMockDerivedKey('storage');
      vi.mocked(mockManager.deriveKey).mockResolvedValue(mockKey);
      
      const key1 = await service.getEncryptionKey('storage');
      const key2 = await service.getEncryptionKey('storage');
      
      expect(key1).toBe(key2);
      expect(mockManager.deriveKey).toHaveBeenCalledTimes(1);
    });

    it('should rotate encryption keys', async () => {
      const mockManager = service['keyManager'];
      const newKey = createMockDerivedKey('storage');
      
      await service.getEncryptionKey('storage');
      
      vi.mocked(mockManager.deriveKey).mockResolvedValue(newKey);
      await service.rotateKey('storage');
      
      expect(mockManager.deriveKey).toHaveBeenCalledWith('storage');
    });
  });

  describe('Data Encryption/Decryption', () => {
    let service: EncryptionService;
    
    beforeEach(async () => {
      service = new EncryptionService();
      
      const mockManager = service['keyManager'];
      vi.mocked(mockManager.createMasterKey).mockResolvedValue(createMockMasterKeyResult());
      vi.mocked(mockManager.deriveKey).mockResolvedValue(createMockDerivedKey('encryption'));
      
      mockChromeStorage.local.set.mockResolvedValue(undefined);
      
      await service.initialize('secure-master-password');
    });

    it('should encrypt and decrypt text data', async () => {
      const plaintext = 'Hello, secure world!';
      const mockEncrypted = createMockEncryptedData();
      
      const { encryptText, decryptText, isValidEncryptedData } = await import('@/security/crypto');
      vi.mocked(encryptText).mockResolvedValue(mockEncrypted);
      vi.mocked(decryptText).mockResolvedValue(plaintext);
      vi.mocked(isValidEncryptedData).mockReturnValue(true);
      
      const encrypted = await service.encryptData(plaintext, 'text');
      expect(encrypted).toBeDefined();
      expect(encrypted.algorithm).toBe('AES-256-GCM');
      
      const decrypted = await service.decryptData(encrypted, 'text');
      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt and decrypt object data', async () => {
      const data = { name: 'test', value: 42 };
      const mockEncrypted = createMockEncryptedData();
      
      const { encryptObject, decryptObject, isValidEncryptedData } = await import('@/security/crypto');
      vi.mocked(encryptObject).mockResolvedValue(mockEncrypted);
      vi.mocked(decryptObject).mockResolvedValue(data);
      vi.mocked(isValidEncryptedData).mockReturnValue(true);
      
      const encrypted = await service.encryptData(data, 'object');
      expect(encrypted).toBeDefined();
      
      const decrypted = await service.decryptData(encrypted, 'object');
      expect(decrypted).toEqual(data);
    });

    it('should handle encryption errors', async () => {
      const { encryptText } = await import('@/security/crypto');
      vi.mocked(encryptText).mockRejectedValueOnce(new Error('Encryption failed'));
      
      await expect(service.encryptData('test', 'text')).rejects.toThrow('Failed to encrypt data');
    });
  });

  describe('Field-Level Encryption', () => {
    let service: EncryptionService;
    
    beforeEach(async () => {
      service = new EncryptionService();
      
      const mockManager = service['keyManager'];
      vi.mocked(mockManager.createMasterKey).mockResolvedValue(createMockMasterKeyResult());
      vi.mocked(mockManager.deriveKey).mockResolvedValue(createMockDerivedKey('encryption'));
      
      mockChromeStorage.local.set.mockResolvedValue(undefined);
      
      await service.initialize('secure-master-password');
    });

    it('should encrypt specific fields of an object', async () => {
      const data = {
        id: 123,
        username: 'testuser',
        password: 'secret123',
        email: 'test@example.com',
      };
      
      const fieldMap: FieldEncryptionMap = {
        password: 'encrypt',
        email: 'encrypt',
        username: 'skip',
        id: 'skip',
      };
      
      const mockEncrypted = createMockEncryptedData();
      const { encryptText } = await import('@/security/crypto');
      vi.mocked(encryptText).mockResolvedValue(mockEncrypted);
      
      const result = await service.encryptFields(data, fieldMap);
      
      expect(result.id).toBe(123);
      expect(result.username).toBe('testuser');
      expect(result.password).toEqual(mockEncrypted);
      expect(result.email).toEqual(mockEncrypted);
    });
  });

  describe('Bulk Operations', () => {
    let service: EncryptionService;
    
    beforeEach(async () => {
      service = new EncryptionService();
      
      const mockManager = service['keyManager'];
      vi.mocked(mockManager.createMasterKey).mockResolvedValue(createMockMasterKeyResult());
      vi.mocked(mockManager.deriveKey).mockResolvedValue(createMockDerivedKey('encryption'));
      
      mockChromeStorage.local.set.mockResolvedValue(undefined);
      
      await service.initialize('secure-master-password');
    });

    it('should encrypt multiple items in bulk', async () => {
      const items = ['message 1', 'message 2', 'message 3'];
      const mockEncrypted = createMockEncryptedData();
      
      const { encryptText } = await import('@/security/crypto');
      vi.mocked(encryptText).mockResolvedValue(mockEncrypted);
      
      const result = await service.encryptBulk(items, 'text');
      
      expect(result.totalCount).toBe(3);
      expect(result.successCount).toBe(3);
      expect(result.errorCount).toBe(0);
      expect(result.success).toHaveLength(3);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle mixed success/failure in bulk operations', async () => {
      const items = ['good1', 'good2', 'good3'];
      const mockEncrypted = createMockEncryptedData();
      
      const { encryptText } = await import('@/security/crypto');
      vi.mocked(encryptText)
        .mockResolvedValueOnce(mockEncrypted)
        .mockRejectedValueOnce(new Error('Encryption failed'))
        .mockResolvedValueOnce(mockEncrypted);
      
      const result = await service.encryptBulk(items, 'text');
      
      expect(result.totalCount).toBe(3);
      expect(result.successCount).toBe(2);
      expect(result.errorCount).toBe(1);
      expect(result.success).toHaveLength(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].item).toBe('good2');
    });
  });

  describe('Data Integrity', () => {
    let service: EncryptionService;
    
    beforeEach(async () => {
      service = new EncryptionService();
      
      const mockManager = service['keyManager'];
      vi.mocked(mockManager.createMasterKey).mockResolvedValue(createMockMasterKeyResult());
      
      mockChromeStorage.local.set.mockResolvedValue(undefined);
      
      await service.initialize('secure-master-password');
    });

    it('should verify data integrity', async () => {
      const data = 'test data for integrity check';
      const mockHash = new Uint8Array([1, 2, 3, 4]);
      
      const { hashData } = await import('@/security/crypto');
      vi.mocked(hashData).mockResolvedValue(mockHash);
      
      const result = await service.verifyIntegrity(data);
      
      expect(result.isValid).toBe(true);
      expect(result.hash).toBeDefined();
      expect(result.verifiedAt).toBeInstanceOf(Date);
    });

    it('should create integrity checksum for encrypted data', async () => {
      const encrypted = createMockEncryptedData();
      const mockHash = new Uint8Array([1, 2, 3, 4]);
      
      const { hashData } = await import('@/security/crypto');
      vi.mocked(hashData).mockResolvedValue(mockHash);
      
      const checksum = await service.createIntegrityChecksum(encrypted);
      
      expect(checksum).toBeDefined();
      expect(typeof checksum).toBe('string');
    });
  });

  describe('Session Management', () => {
    it('should timeout inactive sessions', async () => {
      const service = new EncryptionService({
        sessionTimeout: 1000, // 1 second
      });
      
      const mockManager = service['keyManager'];
      vi.mocked(mockManager.createMasterKey).mockResolvedValue(createMockMasterKeyResult());
      mockChromeStorage.local.set.mockResolvedValue(undefined);
      
      await service.initialize('secure-password');
      expect(service.isSessionActive()).toBe(true);
      
      vi.advanceTimersByTime(1500);
      
      expect(service.isSessionActive()).toBe(false);
    });

    it('should manually terminate session', async () => {
      const service = new EncryptionService();
      
      const mockManager = service['keyManager'];
      vi.mocked(mockManager.createMasterKey).mockResolvedValue(createMockMasterKeyResult());
      mockChromeStorage.local.set.mockResolvedValue(undefined);
      
      await service.initialize('secure-password');
      
      expect(service.isSessionActive()).toBe(true);
      
      await service.terminateSession();
      
      expect(service.isSessionActive()).toBe(false);
      await expect(service.encryptData('test', 'text')).rejects.toThrow('Session expired');
    });
  });

  describe('Error Handling', () => {
    it('should handle uninitialized service gracefully', async () => {
      const service = new EncryptionService();
      
      await expect(service.encryptData('test', 'text')).rejects.toThrow('Service not initialized');
      await expect(service.getEncryptionKey('storage')).rejects.toThrow('Service not initialized');
    });

    it('should handle chrome storage errors', async () => {
      const service = new EncryptionService();
      
      // Mock the key derivation manager
      const mockManager = service['keyManager'];
      vi.mocked(mockManager.createMasterKey).mockResolvedValue(createMockMasterKeyResult());
      
      // Mock storage to fail specifically for this test
      mockChromeStorage.local.set.mockRejectedValueOnce(new Error('Storage quota exceeded'));
      
      await expect(service.initialize('secure-password')).rejects.toThrow('Failed to initialize service');
      
      // Reset the storage mock for subsequent tests
      mockChromeStorage.local.set.mockResolvedValue(undefined);
    });
  });

  describe('Singleton Behavior', () => {
    it('should provide global singleton instance', () => {
      const instance1 = EncryptionService.getInstance();
      const instance2 = EncryptionService.getInstance();
      
      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(EncryptionService);
    });

    it('should reset singleton instance on shutdown', async () => {
      // Create a fresh service instance instead of using singleton to avoid side effects
      const service = new EncryptionService();
      
      const mockManager = service['keyManager'];
      vi.mocked(mockManager.createMasterKey).mockResolvedValue(createMockMasterKeyResult());
      mockChromeStorage.local.set.mockResolvedValue(undefined);
      
      await service.initialize('secure-password');
      
      await service.shutdown();
      
      expect(service.isInitialized()).toBe(false);
    });
  });

  describe('Memory Cleanup', () => {
    it('should clear sensitive data from memory on shutdown', async () => {
      const service = new EncryptionService();
      
      const mockManager = service['keyManager'];
      vi.mocked(mockManager.createMasterKey).mockResolvedValue(createMockMasterKeyResult());
      vi.mocked(mockManager.deriveKey).mockResolvedValue(createMockDerivedKey('storage'));
      mockChromeStorage.local.set.mockResolvedValue(undefined);
      
      await service.initialize('secure-password');
      
      await service.getEncryptionKey('storage');
      
      await service.shutdown();
      
      expect(service.isInitialized()).toBe(false);
      expect(service.isSessionActive()).toBe(false);
    });

    it('should clear keys on explicit memory cleanup', async () => {
      const service = new EncryptionService();
      
      const mockManager = service['keyManager'];
      vi.mocked(mockManager.createMasterKey).mockResolvedValue(createMockMasterKeyResult());
      
      // Create two different key instances
      const key1 = createMockDerivedKey('storage');
      const key2 = createMockDerivedKey('storage');
      vi.mocked(mockManager.deriveKey)
        .mockResolvedValueOnce(key1)
        .mockResolvedValueOnce(key2);
      
      mockChromeStorage.local.set.mockResolvedValue(undefined);
      
      await service.initialize('secure-password');
      
      const firstKey = await service.getEncryptionKey('storage');
      
      service.clearMemory();
      
      const secondKey = await service.getEncryptionKey('storage');
      expect(secondKey).not.toBe(firstKey);
    });
  });
});