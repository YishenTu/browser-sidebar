/**
 * @file Key Derivation Tests
 *
 * Comprehensive test suite for advanced key derivation functionality using TDD approach.
 * Tests cover PBKDF2 derivation, salt generation, key consistency, multiple key derivation,
 * key versioning, error handling, and security properties.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Import the key derivation utilities we'll implement
import {
  deriveMasterKey,
  deriveMultipleKeys,
  generateSalt,
  KeyDerivationManager,
  KeyPurpose,
  DerivedKey,
  MasterKeyResult,
  MultiKeyResult,
  SaltInfo,
  KeyDerivationConfig,
  KeyVersionInfo,
} from '@/security/keyDerivation';

import { CryptoKey } from '@/security/crypto';

// Mock Web Crypto API for testing
const mockSubtleCrypto = {
  generateKey: vi.fn(),
  encrypt: vi.fn(),
  decrypt: vi.fn(),
  digest: vi.fn(),
  deriveKey: vi.fn(),
  importKey: vi.fn(),
  exportKey: vi.fn(),
  wrapKey: vi.fn(),
  unwrapKey: vi.fn(),
};

const mockCrypto = {
  subtle: mockSubtleCrypto,
  getRandomValues: vi.fn(),
};

// Helper function to create mock CryptoKey
function createMockCryptoKey(purpose: string = 'encrypt'): CryptoKey {
  return {
    type: 'secret',
    extractable: false,
    algorithm: { name: 'AES-GCM', length: 256 },
    usages: [purpose, 'decrypt'],
  } as CryptoKey;
}

// Helper function to create mock salt
function createMockSalt(size: number = 32): Uint8Array {
  return new Uint8Array(Array.from({ length: size }, (_, i) => i % 256));
}

describe('Key Derivation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock global crypto object
    Object.defineProperty(globalThis, 'crypto', {
      value: mockCrypto,
      writable: true,
      configurable: true
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('salt generation', () => {
    describe('generateSalt', () => {
      it('should generate cryptographically secure salt', () => {
        const mockSalt = createMockSalt();
        mockCrypto.getRandomValues.mockImplementation((array: Uint8Array) => {
          for (let i = 0; i < array.length && i < mockSalt.length; i++) {
            array[i] = mockSalt[i];
          }
          return array;
        });

        const result = generateSalt();

        expect(mockCrypto.getRandomValues).toHaveBeenCalledWith(expect.any(Uint8Array));
        expect(Array.from(result.salt)).toEqual(Array.from(mockSalt));
        expect(result.salt.length).toBe(32);
        expect(result.algorithm).toBe('CSPRNG');
        expect(result.createdAt).toBeInstanceOf(Date);
      });

      it('should support custom salt size', () => {
        const customSize = 64;
        const mockSalt = createMockSalt(customSize);
        mockCrypto.getRandomValues.mockReturnValue(mockSalt);

        const result = generateSalt(customSize);

        const callArg = mockCrypto.getRandomValues.mock.calls[0][0];
        expect(callArg.length).toBe(customSize);
        expect(result.salt.length).toBe(customSize);
      });

      it('should include metadata in salt info', () => {
        const mockSalt = createMockSalt();
        mockCrypto.getRandomValues.mockImplementation((array: Uint8Array) => {
          for (let i = 0; i < array.length && i < mockSalt.length; i++) {
            array[i] = mockSalt[i];
          }
          return array;
        });

        const result = generateSalt();

        expect(result).toMatchObject({
          size: 32,
          algorithm: 'CSPRNG',
          createdAt: expect.any(Date),
        });
        expect(Array.from(result.salt)).toEqual(Array.from(mockSalt));
      });

      it('should generate different salts each time', () => {
        const salt1 = createMockSalt();
        const salt2 = createMockSalt();
        salt2[0] = 255; // Make them different

        mockCrypto.getRandomValues
          .mockImplementationOnce((array: Uint8Array) => {
            for (let i = 0; i < array.length && i < salt1.length; i++) {
              array[i] = salt1[i];
            }
            return array;
          })
          .mockImplementationOnce((array: Uint8Array) => {
            for (let i = 0; i < array.length && i < salt2.length; i++) {
              array[i] = salt2[i];
            }
            return array;
          });

        const result1 = generateSalt();
        const result2 = generateSalt();

        expect(result1.salt).not.toEqual(result2.salt);
      });

      it('should validate salt size constraints', () => {
        expect(() => generateSalt(0)).toThrow('Invalid salt size: must be at least 16 bytes');
        expect(() => generateSalt(15)).toThrow('Invalid salt size: must be at least 16 bytes');
        expect(() => generateSalt(-1)).toThrow('Invalid salt size: must be at least 16 bytes');
      });
    });
  });

  describe('master key derivation', () => {
    describe('deriveMasterKey', () => {
      it('should derive master key from password using PBKDF2', async () => {
        const mockKey = createMockCryptoKey();
        const mockSalt = createMockSalt();
        const password = 'strongPassword123!';

        mockSubtleCrypto.importKey.mockResolvedValue(mockKey);
        mockSubtleCrypto.deriveKey.mockResolvedValue(mockKey);

        const result = await deriveMasterKey(password, { salt: mockSalt });

        expect(mockSubtleCrypto.importKey).toHaveBeenCalledWith(
          'raw',
          new TextEncoder().encode(password),
          'PBKDF2',
          false,
          ['deriveKey']
        );

        expect(mockSubtleCrypto.deriveKey).toHaveBeenCalledWith(
          {
            name: 'PBKDF2',
            salt: mockSalt,
            iterations: 100000,
            hash: 'SHA-256',
          },
          mockKey,
          {
            name: 'AES-GCM',
            length: 256,
          },
          false,
          ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
        );

        expect(result).toMatchObject({
          masterKey: mockKey,
          salt: mockSalt,
          iterations: 100000,
          algorithm: 'PBKDF2',
          hashAlgorithm: 'SHA-256',
          keySize: 256,
          version: 1,
          createdAt: expect.any(Date),
        });
      });

      it('should support custom derivation parameters', async () => {
        const mockKey = createMockCryptoKey();
        const customSalt = createMockSalt();
        const config: KeyDerivationConfig = {
          salt: customSalt,
          iterations: 200000,
          hashAlgorithm: 'SHA-512',
          keySize: 256,
        };

        mockSubtleCrypto.importKey.mockResolvedValue(mockKey);
        mockSubtleCrypto.deriveKey.mockResolvedValue(mockKey);

        const result = await deriveMasterKey('password123', config);

        expect(mockSubtleCrypto.deriveKey).toHaveBeenCalledWith(
          {
            name: 'PBKDF2',
            salt: customSalt,
            iterations: 200000,
            hash: 'SHA-512',
          },
          mockKey,
          {
            name: 'AES-GCM',
            length: 256,
          },
          false,
          ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
        );

        expect(result.iterations).toBe(200000);
        expect(result.hashAlgorithm).toBe('SHA-512');
      });

      it('should generate salt if not provided', async () => {
        const mockKey = createMockCryptoKey();
        const generatedSalt = createMockSalt();
        
        mockCrypto.getRandomValues.mockImplementation((array: Uint8Array) => {
          for (let i = 0; i < array.length && i < generatedSalt.length; i++) {
            array[i] = generatedSalt[i];
          }
          return array;
        });
        mockSubtleCrypto.importKey.mockResolvedValue(mockKey);
        mockSubtleCrypto.deriveKey.mockResolvedValue(mockKey);

        const result = await deriveMasterKey('password123');

        expect(mockCrypto.getRandomValues).toHaveBeenCalledWith(expect.any(Uint8Array));
        expect(Array.from(result.salt)).toEqual(Array.from(generatedSalt));
      });

      it('should derive consistent keys with same password and salt', async () => {
        const mockKey1 = createMockCryptoKey();
        const mockKey2 = createMockCryptoKey();
        const salt = createMockSalt();
        const password = 'consistentPassword';

        mockSubtleCrypto.importKey.mockResolvedValue(mockKey1);
        mockSubtleCrypto.deriveKey
          .mockResolvedValueOnce(mockKey1)
          .mockResolvedValueOnce(mockKey2);

        const result1 = await deriveMasterKey(password, { salt });
        
        // Reset mocks but use same returns for consistency
        vi.clearAllMocks();
        mockSubtleCrypto.importKey.mockResolvedValue(mockKey1);
        mockSubtleCrypto.deriveKey.mockResolvedValue(mockKey2);
        
        const result2 = await deriveMasterKey(password, { salt });

        // Should call with same parameters
        expect(mockSubtleCrypto.deriveKey).toHaveBeenCalledWith(
          {
            name: 'PBKDF2',
            salt,
            iterations: 100000,
            hash: 'SHA-256',
          },
          expect.anything(),
          expect.anything(),
          false,
          ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
        );

        expect(result1.salt).toEqual(result2.salt);
        expect(result1.iterations).toBe(result2.iterations);
      });

      it('should validate password strength', async () => {
        await expect(deriveMasterKey('')).rejects.toThrow('Password too weak');
        await expect(deriveMasterKey('weak')).rejects.toThrow('Password too weak');
        await expect(deriveMasterKey('1234567')).rejects.toThrow('Password too weak');
      });

      it('should handle key derivation errors', async () => {
        const error = new Error('Key derivation failed');
        mockSubtleCrypto.importKey.mockRejectedValue(error);

        await expect(deriveMasterKey('password123')).rejects.toThrow(
          'Failed to derive master key: Key derivation failed'
        );
      });

      it('should support different key algorithms', async () => {
        const mockKey = createMockCryptoKey();
        const salt = createMockSalt();

        mockSubtleCrypto.importKey.mockResolvedValue(mockKey);
        mockSubtleCrypto.deriveKey.mockResolvedValue(mockKey);

        await deriveMasterKey('password123', { 
          salt, 
          algorithm: 'AES-CBC',
          keySize: 256 
        });

        expect(mockSubtleCrypto.deriveKey).toHaveBeenCalledWith(
          expect.anything(),
          mockKey,
          {
            name: 'AES-CBC',
            length: 256,
          },
          false,
          ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
        );
      });
    });
  });

  describe('multiple key derivation', () => {
    describe('deriveMultipleKeys', () => {
      it('should derive multiple keys from master key', async () => {
        const masterKey = createMockCryptoKey();
        const encryptionKey = createMockCryptoKey('encrypt');
        const authKey = createMockCryptoKey('sign');
        const storageKey = createMockCryptoKey('encrypt');

        mockSubtleCrypto.deriveKey
          .mockResolvedValueOnce(encryptionKey)
          .mockResolvedValueOnce(authKey)
          .mockResolvedValueOnce(storageKey);

        const purposes: KeyPurpose[] = ['encryption', 'authentication', 'storage'];
        const result = await deriveMultipleKeys(masterKey, purposes);

        expect(mockSubtleCrypto.deriveKey).toHaveBeenCalledTimes(3);
        expect(result.keys).toHaveLength(3);
        
        expect(result.keys[0]).toMatchObject({
          purpose: 'encryption',
          key: encryptionKey,
          algorithm: 'AES-GCM',
          keySize: 256,
          derivedAt: expect.any(Date),
        });

        expect(result.keys[1]).toMatchObject({
          purpose: 'authentication',
          key: authKey,
          algorithm: 'HMAC',
          keySize: 256,
          derivedAt: expect.any(Date),
        });

        expect(result.keys[2]).toMatchObject({
          purpose: 'storage',
          key: storageKey,
          algorithm: 'AES-GCM',
          keySize: 256,
          derivedAt: expect.any(Date),
        });
      });

      it('should use different info for each key purpose', async () => {
        const masterKey = createMockCryptoKey();
        const derivedKey = createMockCryptoKey();

        mockSubtleCrypto.deriveKey.mockResolvedValue(derivedKey);

        await deriveMultipleKeys(masterKey, ['encryption', 'authentication']);

        expect(mockSubtleCrypto.deriveKey).toHaveBeenNthCalledWith(
          1,
          {
            name: 'HKDF',
            hash: 'SHA-256',
            salt: new Uint8Array(),
            info: new TextEncoder().encode('encryption-v1'),
          },
          masterKey,
          { name: 'AES-GCM', length: 256 },
          false,
          ['encrypt', 'decrypt']
        );

        expect(mockSubtleCrypto.deriveKey).toHaveBeenNthCalledWith(
          2,
          {
            name: 'HKDF',
            hash: 'SHA-256',
            salt: new Uint8Array(),
            info: new TextEncoder().encode('authentication-v1'),
          },
          masterKey,
          { name: 'HMAC', hash: 'SHA-256', length: 256 },
          false,
          ['sign', 'verify']
        );
      });

      it('should handle custom key configurations', async () => {
        const masterKey = createMockCryptoKey();
        const derivedKey = createMockCryptoKey();

        mockSubtleCrypto.deriveKey.mockResolvedValue(derivedKey);

        const customConfig = {
          version: 2,
          hashAlgorithm: 'SHA-512' as const,
          keyConfigs: {
            encryption: { algorithm: 'AES-CBC', keySize: 192 },
          },
        };

        await deriveMultipleKeys(masterKey, ['encryption'], customConfig);

        expect(mockSubtleCrypto.deriveKey).toHaveBeenCalledWith(
          {
            name: 'HKDF',
            hash: 'SHA-512',
            salt: new Uint8Array(),
            info: new TextEncoder().encode('encryption-v2'),
          },
          masterKey,
          { name: 'AES-CBC', length: 192 },
          false,
          ['encrypt', 'decrypt']
        );
      });

      it('should support key versioning', async () => {
        const masterKey = createMockCryptoKey();
        const derivedKey = createMockCryptoKey();

        mockSubtleCrypto.deriveKey.mockResolvedValue(derivedKey);

        await deriveMultipleKeys(masterKey, ['encryption'], { version: 3 });

        expect(mockSubtleCrypto.deriveKey).toHaveBeenCalledWith(
          expect.objectContaining({
            info: new TextEncoder().encode('encryption-v3'),
          }),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything()
        );
      });

      it('should handle derivation errors gracefully', async () => {
        const masterKey = createMockCryptoKey();
        const error = new Error('Key derivation failed');

        mockSubtleCrypto.deriveKey.mockRejectedValue(error);

        await expect(deriveMultipleKeys(masterKey, ['encryption'])).rejects.toThrow(
          'Failed to derive keys: Key derivation failed'
        );
      });

      it('should validate input parameters', async () => {
        const masterKey = createMockCryptoKey();

        await expect(deriveMultipleKeys(masterKey, [])).rejects.toThrow(
          'At least one key purpose must be specified'
        );

        // @ts-expect-error Testing invalid purpose
        await expect(deriveMultipleKeys(masterKey, ['invalid'])).rejects.toThrow(
          'Invalid key purpose: invalid'
        );
      });
    });
  });

  describe('KeyDerivationManager', () => {
    let manager: KeyDerivationManager;

    beforeEach(() => {
      manager = new KeyDerivationManager();
    });

    describe('construction and configuration', () => {
      it('should initialize with default configuration', () => {
        expect(manager.getConfig()).toMatchObject({
          iterations: 100000,
          hashAlgorithm: 'SHA-256',
          keySize: 256,
          algorithm: 'AES-GCM',
          version: 1,
        });
      });

      it('should accept custom configuration', () => {
        const customConfig: KeyDerivationConfig = {
          iterations: 200000,
          hashAlgorithm: 'SHA-512',
          keySize: 256,
          algorithm: 'AES-CBC',
          version: 2,
        };

        const customManager = new KeyDerivationManager(customConfig);
        
        expect(customManager.getConfig()).toMatchObject(customConfig);
      });

      it('should validate configuration parameters', () => {
        expect(() => new KeyDerivationManager({ iterations: 0 })).toThrow(
          'Invalid iterations: must be at least 10000'
        );

        expect(() => new KeyDerivationManager({ keySize: 64 })).toThrow(
          'Invalid key size: must be 128, 192, or 256'
        );
      });
    });

    describe('master key operations', () => {
      it('should create master key from password', async () => {
        const mockKey = createMockCryptoKey();
        const mockSalt = createMockSalt();

        mockCrypto.getRandomValues.mockImplementation((array: Uint8Array) => {
          for (let i = 0; i < array.length && i < mockSalt.length; i++) {
            array[i] = mockSalt[i];
          }
          return array;
        });
        mockSubtleCrypto.importKey.mockResolvedValue(mockKey);
        mockSubtleCrypto.deriveKey.mockResolvedValue(mockKey);

        const result = await manager.createMasterKey('password123');

        expect(result).toMatchObject({
          masterKey: mockKey,
          iterations: 100000,
          algorithm: 'PBKDF2',
          hashAlgorithm: 'SHA-256',
          keySize: 256,
          version: 1,
        });
        expect(Array.from(result.salt)).toEqual(Array.from(mockSalt));
      });

      it('should restore master key from existing salt', async () => {
        const mockKey = createMockCryptoKey();
        const existingSalt = createMockSalt();

        mockSubtleCrypto.importKey.mockResolvedValue(mockKey);
        mockSubtleCrypto.deriveKey.mockResolvedValue(mockKey);

        const result = await manager.restoreMasterKey('password123', existingSalt);

        expect(mockSubtleCrypto.deriveKey).toHaveBeenCalledWith(
          expect.objectContaining({
            salt: existingSalt,
          }),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything()
        );

        expect(result.salt).toBe(existingSalt);
      });

      it('should cache master key for reuse', async () => {
        const mockKey = createMockCryptoKey();
        const mockSalt = createMockSalt();

        mockCrypto.getRandomValues.mockReturnValue(mockSalt);
        mockSubtleCrypto.importKey.mockResolvedValue(mockKey);
        mockSubtleCrypto.deriveKey.mockResolvedValue(mockKey);

        const result1 = await manager.createMasterKey('password123');
        const result2 = await manager.getMasterKey();

        expect(result1.masterKey).toBe(result2?.masterKey);
        expect(mockSubtleCrypto.deriveKey).toHaveBeenCalledTimes(1);
      });

      it('should clear cached master key', async () => {
        const mockKey = createMockCryptoKey();
        mockCrypto.getRandomValues.mockReturnValue(createMockSalt());
        mockSubtleCrypto.importKey.mockResolvedValue(mockKey);
        mockSubtleCrypto.deriveKey.mockResolvedValue(mockKey);

        await manager.createMasterKey('password123');
        expect(manager.getMasterKey()).toBeDefined();

        manager.clearMasterKey();
        expect(manager.getMasterKey()).toBeNull();
      });
    });

    describe('derived key operations', () => {
      it('should derive and cache purpose-specific keys', async () => {
        const masterKey = createMockCryptoKey();
        const derivedKey = createMockCryptoKey();

        // Setup master key
        mockCrypto.getRandomValues.mockReturnValue(createMockSalt());
        mockSubtleCrypto.importKey.mockResolvedValue(masterKey);
        mockSubtleCrypto.deriveKey.mockResolvedValue(masterKey);

        await manager.createMasterKey('password123');

        // Derive specific key
        mockSubtleCrypto.deriveKey.mockResolvedValue(derivedKey);

        const result = await manager.deriveKey('encryption');

        expect(result).toMatchObject({
          purpose: 'encryption',
          key: derivedKey,
          algorithm: 'AES-GCM',
          keySize: 256,
        });
      });

      it('should return cached derived keys', async () => {
        const masterKey = createMockCryptoKey();
        const derivedKey = createMockCryptoKey();

        // Setup master key
        mockCrypto.getRandomValues.mockReturnValue(createMockSalt());
        mockSubtleCrypto.importKey.mockResolvedValue(masterKey);
        mockSubtleCrypto.deriveKey.mockResolvedValue(masterKey);

        await manager.createMasterKey('password123');

        // First derivation
        mockSubtleCrypto.deriveKey.mockResolvedValue(derivedKey);
        const result1 = await manager.deriveKey('encryption');

        // Second call should return cached
        const result2 = await manager.deriveKey('encryption');

        expect(result1.key).toBe(result2.key);
        expect(mockSubtleCrypto.deriveKey).toHaveBeenCalledTimes(2); // Once for master, once for derived
      });

      it('should derive multiple keys at once', async () => {
        const masterKey = createMockCryptoKey();
        const encryptionKey = createMockCryptoKey();
        const authKey = createMockCryptoKey();

        // Setup master key
        mockCrypto.getRandomValues.mockReturnValue(createMockSalt());
        mockSubtleCrypto.importKey.mockResolvedValue(masterKey);
        mockSubtleCrypto.deriveKey.mockResolvedValue(masterKey);

        await manager.createMasterKey('password123');

        // Derive multiple keys
        mockSubtleCrypto.deriveKey
          .mockResolvedValueOnce(encryptionKey)
          .mockResolvedValueOnce(authKey);

        const result = await manager.deriveMultipleKeys(['encryption', 'authentication']);

        expect(result.keys).toHaveLength(2);
        expect(result.keys[0].purpose).toBe('encryption');
        expect(result.keys[1].purpose).toBe('authentication');
      });

      it('should handle missing master key', async () => {
        await expect(manager.deriveKey('encryption')).rejects.toThrow(
          'No master key available. Create or restore a master key first.'
        );
      });
    });

    describe('key wrapping and unwrapping', () => {
      it('should wrap keys for storage', async () => {
        const masterKey = createMockCryptoKey();
        const keyToWrap = createMockCryptoKey();
        const wrappedKey = new Uint8Array([1, 2, 3, 4]);

        // Setup master key
        mockCrypto.getRandomValues.mockReturnValue(createMockSalt());
        mockSubtleCrypto.importKey.mockResolvedValue(masterKey);
        mockSubtleCrypto.deriveKey.mockResolvedValue(masterKey);
        mockSubtleCrypto.wrapKey.mockResolvedValue(wrappedKey.buffer);

        await manager.createMasterKey('password123');

        const result = await manager.wrapKey(keyToWrap, 'encryption');

        expect(mockSubtleCrypto.wrapKey).toHaveBeenCalledWith(
          'raw',
          keyToWrap,
          masterKey,
          'AES-GCM'
        );

        expect(result).toMatchObject({
          wrappedKey,
          purpose: 'encryption',
          algorithm: 'AES-GCM',
          wrapAlgorithm: 'AES-GCM',
          wrappedAt: expect.any(Date),
        });
      });

      it('should unwrap keys from storage', async () => {
        const masterKey = createMockCryptoKey();
        const unwrappedKey = createMockCryptoKey();
        const wrappedKeyData = new Uint8Array([1, 2, 3, 4]);

        // Setup master key
        mockCrypto.getRandomValues.mockReturnValue(createMockSalt());
        mockSubtleCrypto.importKey.mockResolvedValue(masterKey);
        mockSubtleCrypto.deriveKey.mockResolvedValue(masterKey);
        mockSubtleCrypto.unwrapKey.mockResolvedValue(unwrappedKey);

        await manager.createMasterKey('password123');

        const wrappedKey = {
          wrappedKey: wrappedKeyData,
          purpose: 'encryption' as KeyPurpose,
          algorithm: 'AES-GCM' as const,
          wrapAlgorithm: 'AES-GCM' as const,
          wrappedAt: new Date(),
        };

        const result = await manager.unwrapKey(wrappedKey);

        expect(mockSubtleCrypto.unwrapKey).toHaveBeenCalledWith(
          'raw',
          wrappedKeyData,
          masterKey,
          'AES-GCM',
          { name: 'AES-GCM', length: 256 },
          false,
          ['encrypt', 'decrypt']
        );

        expect(result.key).toBe(unwrappedKey);
        expect(result.purpose).toBe('encryption');
      });
    });

    describe('version management', () => {
      it('should support key version upgrades', async () => {
        const oldManager = new KeyDerivationManager({ version: 1 });
        const newManager = new KeyDerivationManager({ version: 2 });

        const masterKey = createMockCryptoKey();
        mockCrypto.getRandomValues.mockReturnValue(createMockSalt());
        mockSubtleCrypto.importKey.mockResolvedValue(masterKey);
        mockSubtleCrypto.deriveKey.mockResolvedValue(masterKey);

        const oldMaster = await oldManager.createMasterKey('password123');
        const newMaster = await newManager.restoreMasterKey('password123', oldMaster.salt);

        expect(oldMaster.version).toBe(1);
        expect(newMaster.version).toBe(2);
      });

      it('should derive different keys for different versions', async () => {
        const masterKey = createMockCryptoKey();
        const v1Key = createMockCryptoKey();
        const v2Key = createMockCryptoKey();

        const v1Manager = new KeyDerivationManager({ version: 1 });
        const v2Manager = new KeyDerivationManager({ version: 2 });

        // Setup master keys
        mockCrypto.getRandomValues.mockReturnValue(createMockSalt());
        mockSubtleCrypto.importKey.mockResolvedValue(masterKey);
        mockSubtleCrypto.deriveKey.mockResolvedValue(masterKey);

        await v1Manager.createMasterKey('password123');
        await v2Manager.createMasterKey('password123');

        // Derive keys with different versions
        mockSubtleCrypto.deriveKey
          .mockResolvedValueOnce(v1Key)
          .mockResolvedValueOnce(v2Key);

        await v1Manager.deriveKey('encryption');
        await v2Manager.deriveKey('encryption');

        // Should use different info strings
        expect(mockSubtleCrypto.deriveKey).toHaveBeenCalledWith(
          expect.objectContaining({
            info: new TextEncoder().encode('encryption-v1'),
          }),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything()
        );

        expect(mockSubtleCrypto.deriveKey).toHaveBeenCalledWith(
          expect.objectContaining({
            info: new TextEncoder().encode('encryption-v2'),
          }),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything()
        );
      });
    });

    describe('error handling and edge cases', () => {
      it('should handle Web Crypto API unavailable', async () => {
        Object.defineProperty(globalThis, 'crypto', {
          value: undefined,
          writable: true,
          configurable: true
        });

        await expect(manager.createMasterKey('password123')).rejects.toThrow(
          'Web Crypto API not available'
        );
      });

      it('should handle invalid configuration updates', () => {
        expect(() => manager.updateConfig({ iterations: -1 })).toThrow(
          'Invalid iterations: must be at least 10000'
        );

        expect(() => manager.updateConfig({ keySize: 512 })).toThrow(
          'Invalid key size: must be 128, 192, or 256'
        );
      });

      it('should clear all cached data on configuration change', async () => {
        const masterKey = createMockCryptoKey();
        mockCrypto.getRandomValues.mockReturnValue(createMockSalt());
        mockSubtleCrypto.importKey.mockResolvedValue(masterKey);
        mockSubtleCrypto.deriveKey.mockResolvedValue(masterKey);

        await manager.createMasterKey('password123');
        expect(manager.getMasterKey()).toBeDefined();

        manager.updateConfig({ iterations: 200000 });
        expect(manager.getMasterKey()).toBeNull();
      });

      it('should handle concurrent key derivation requests', async () => {
        const masterKey = createMockCryptoKey();
        const derivedKey1 = createMockCryptoKey();
        const derivedKey2 = createMockCryptoKey();

        // Setup master key
        mockCrypto.getRandomValues.mockReturnValue(createMockSalt());
        mockSubtleCrypto.importKey.mockResolvedValue(masterKey);
        mockSubtleCrypto.deriveKey.mockResolvedValue(masterKey);

        await manager.createMasterKey('password123');

        // Simulate concurrent derivation
        mockSubtleCrypto.deriveKey
          .mockResolvedValueOnce(derivedKey1)
          .mockResolvedValueOnce(derivedKey2);

        const [result1, result2] = await Promise.all([
          manager.deriveKey('encryption'),
          manager.deriveKey('authentication'),
        ]);

        expect(result1.purpose).toBe('encryption');
        expect(result2.purpose).toBe('authentication');
        expect(result1.key).not.toBe(result2.key);
      });
    });
  });

  describe('integration and security tests', () => {
    it('should derive deterministic keys', async () => {
      const password = 'testPassword123!';
      const salt = createMockSalt();
      const mockKey = createMockCryptoKey();

      mockSubtleCrypto.importKey.mockResolvedValue(mockKey);
      mockSubtleCrypto.deriveKey.mockResolvedValue(mockKey);

      const result1 = await deriveMasterKey(password, { salt });
      
      // Reset mocks but use same returns
      vi.clearAllMocks();
      mockSubtleCrypto.importKey.mockResolvedValue(mockKey);
      mockSubtleCrypto.deriveKey.mockResolvedValue(mockKey);
      
      const result2 = await deriveMasterKey(password, { salt });

      // Should call with identical parameters
      expect(mockSubtleCrypto.deriveKey).toHaveBeenCalledWith(
        {
          name: 'PBKDF2',
          salt,
          iterations: 100000,
          hash: 'SHA-256',
        },
        expect.anything(),
        expect.anything(),
        false,
        ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
      );
    });

    it('should use secure iteration counts', async () => {
      const mockKey = createMockCryptoKey();
      mockCrypto.getRandomValues.mockReturnValue(createMockSalt());
      mockSubtleCrypto.importKey.mockResolvedValue(mockKey);
      mockSubtleCrypto.deriveKey.mockResolvedValue(mockKey);

      await deriveMasterKey('password123');

      expect(mockSubtleCrypto.deriveKey).toHaveBeenCalledWith(
        expect.objectContaining({
          iterations: 100000, // Secure minimum
        }),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
    });

    it('should use non-extractable keys for security', async () => {
      const mockKey = createMockCryptoKey();
      mockCrypto.getRandomValues.mockReturnValue(createMockSalt());
      mockSubtleCrypto.importKey.mockResolvedValue(mockKey);
      mockSubtleCrypto.deriveKey.mockResolvedValue(mockKey);

      await deriveMasterKey('password123');

      expect(mockSubtleCrypto.deriveKey).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        false, // non-extractable
        expect.anything()
      );
    });

    it('should handle memory pressure gracefully', async () => {
      const manager = new KeyDerivationManager();
      const mockKey = createMockCryptoKey();
      
      mockCrypto.getRandomValues.mockReturnValue(createMockSalt());
      mockSubtleCrypto.importKey.mockResolvedValue(mockKey);
      mockSubtleCrypto.deriveKey.mockResolvedValue(mockKey);

      // Create master key
      await manager.createMasterKey('password123');

      // Derive many keys to simulate memory pressure
      const purposes: KeyPurpose[] = ['encryption', 'authentication', 'storage'];
      
      for (let i = 0; i < 100; i++) {
        const randomPurpose = purposes[i % purposes.length];
        await manager.deriveKey(randomPurpose);
      }

      // Should still work correctly
      expect(manager.getMasterKey()).toBeDefined();
    });
  });
});