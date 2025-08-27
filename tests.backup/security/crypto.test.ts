/**
 * @file Crypto Utilities Tests
 *
 * Comprehensive test suite for Web Crypto API wrapper following TDD approach.
 * Tests cover key generation, encryption/decryption, different data types,
 * error handling, edge cases, and security properties.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Import the crypto utilities we'll implement
import {
  generateKey,
  encrypt,
  decrypt,
  encryptText,
  decryptText,
  encryptObject,
  decryptObject,
  encryptBinary,
  decryptBinary,
  hashData,
  deriveKey,
  secureRandom,
  isValidEncryptedData,
  EncryptedData,
  CryptoKey,
  CryptoOptions,
  HashAlgorithm,
  KeyDerivationOptions,
} from '@/security/crypto';

// Mock Web Crypto API for testing
const mockSubtleCrypto = {
  generateKey: vi.fn(),
  encrypt: vi.fn(),
  decrypt: vi.fn(),
  digest: vi.fn(),
  deriveKey: vi.fn(),
  importKey: vi.fn(),
  exportKey: vi.fn(),
};

const mockCrypto = {
  subtle: mockSubtleCrypto,
  getRandomValues: vi.fn(),
};

// Helper function to create mock encrypted data
function createMockEncryptedData(data: string = 'encrypted-data'): EncryptedData {
  return {
    algorithm: 'AES-256-GCM',
    iv: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
    data: new TextEncoder().encode(data),
    version: 1,
  };
}

// Helper function to create mock CryptoKey
function createMockCryptoKey(): CryptoKey {
  return {
    type: 'secret',
    extractable: false,
    algorithm: { name: 'AES-GCM', length: 256 },
    usages: ['encrypt', 'decrypt'],
  } as CryptoKey;
}

describe('crypto utilities', () => {
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

  describe('key generation', () => {
    describe('generateKey', () => {
      it('should generate a new AES-256-GCM key by default', async () => {
        const mockKey = createMockCryptoKey();
        mockSubtleCrypto.generateKey.mockResolvedValue(mockKey);

        const key = await generateKey();

        expect(mockSubtleCrypto.generateKey).toHaveBeenCalledWith(
          {
            name: 'AES-GCM',
            length: 256,
          },
          false, // non-extractable
          ['encrypt', 'decrypt']
        );
        expect(key).toBe(mockKey);
      });

      it('should generate extractable key when specified', async () => {
        const mockKey = createMockCryptoKey();
        mockSubtleCrypto.generateKey.mockResolvedValue(mockKey);

        const key = await generateKey({ extractable: true });

        expect(mockSubtleCrypto.generateKey).toHaveBeenCalledWith(
          {
            name: 'AES-GCM',
            length: 256,
          },
          true, // extractable
          ['encrypt', 'decrypt']
        );
      });

      it('should support different key sizes', async () => {
        const mockKey = createMockCryptoKey();
        mockSubtleCrypto.generateKey.mockResolvedValue(mockKey);

        await generateKey({ keySize: 128 });

        expect(mockSubtleCrypto.generateKey).toHaveBeenCalledWith(
          {
            name: 'AES-GCM',
            length: 128,
          },
          false,
          ['encrypt', 'decrypt']
        );
      });

      it('should handle key generation errors', async () => {
        const error = new Error('Key generation failed');
        mockSubtleCrypto.generateKey.mockRejectedValue(error);

        await expect(generateKey()).rejects.toThrow('Failed to generate encryption key: Key generation failed');
      });

      it('should support custom algorithm', async () => {
        const mockKey = createMockCryptoKey();
        mockSubtleCrypto.generateKey.mockResolvedValue(mockKey);

        await generateKey({ algorithm: 'AES-CBC' });

        expect(mockSubtleCrypto.generateKey).toHaveBeenCalledWith(
          {
            name: 'AES-CBC',
            length: 256,
          },
          false,
          ['encrypt', 'decrypt']
        );
      });
    });

    describe('deriveKey', () => {
      it('should derive key from password using PBKDF2', async () => {
        const mockKey = createMockCryptoKey();
        const mockSalt = new Uint8Array([1, 2, 3, 4]);
        mockCrypto.getRandomValues.mockReturnValue(mockSalt);
        mockSubtleCrypto.importKey.mockResolvedValue(mockKey);
        mockSubtleCrypto.deriveKey.mockResolvedValue(mockKey);

        const result = await deriveKey('password123', mockSalt);

        expect(mockSubtleCrypto.importKey).toHaveBeenCalledWith(
          'raw',
          new TextEncoder().encode('password123'),
          'PBKDF2',
          false,
          ['deriveKey']
        );
        expect(result).toEqual({
          key: mockKey,
          salt: mockSalt,
        });
      });

      it('should use custom options for key derivation', async () => {
        const mockKey = createMockCryptoKey();
        const customSalt = new Uint8Array([5, 6, 7, 8]);
        const options: KeyDerivationOptions = {
          salt: customSalt,
          iterations: 200000,
          algorithm: 'SHA-512',
        };
        
        mockSubtleCrypto.importKey.mockResolvedValue(mockKey);
        mockSubtleCrypto.deriveKey.mockResolvedValue(mockKey);

        await deriveKey('password123', customSalt, options);

        expect(mockSubtleCrypto.deriveKey).toHaveBeenCalledWith(
          {
            name: 'PBKDF2',
            salt: customSalt,
            iterations: 200000,
            hash: 'SHA-512',
          },
          expect.anything(),
          {
            name: 'AES-GCM',
            length: 256,
          },
          false,
          ['encrypt', 'decrypt']
        );
      });

      it('should handle key derivation errors', async () => {
        const error = new Error('Key derivation failed');
        mockSubtleCrypto.importKey.mockRejectedValue(error);

        await expect(deriveKey('password', new Uint8Array([1, 2, 3, 4]))).rejects.toThrow(
          'Failed to derive key: Key derivation failed'
        );
      });

      it('should validate password strength', async () => {
        await expect(deriveKey('weak')).rejects.toThrow(
          'Password too weak. Must be at least 8 characters long'
        );
      });

      it('should generate salt if not provided', async () => {
        const mockKey = createMockCryptoKey();
        const mockSalt = new Uint8Array(32);
        mockCrypto.getRandomValues.mockReturnValue(mockSalt);
        mockSubtleCrypto.importKey.mockResolvedValue(mockKey);
        mockSubtleCrypto.deriveKey.mockResolvedValue(mockKey);

        await deriveKey('password123');

        expect(mockCrypto.getRandomValues).toHaveBeenCalledWith(expect.any(Uint8Array));
      });
    });
  });

  describe('encryption/decryption', () => {
    describe('encrypt', () => {
      it('should encrypt data with AES-256-GCM', async () => {
        const mockKey = createMockCryptoKey();
        const mockIv = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
        const mockEncryptedData = new Uint8Array([10, 20, 30, 40]);
        
        mockCrypto.getRandomValues.mockReturnValue(mockIv);
        mockSubtleCrypto.encrypt.mockResolvedValue(mockEncryptedData);

        const data = new TextEncoder().encode('test data');
        const result = await encrypt(data, mockKey);

        expect(mockCrypto.getRandomValues).toHaveBeenCalledWith(expect.any(Uint8Array));
        expect(mockSubtleCrypto.encrypt).toHaveBeenCalledWith(
          {
            name: 'AES-GCM',
            iv: mockIv,
          },
          mockKey,
          data
        );
        expect(result).toEqual({
          algorithm: 'AES-256-GCM',
          iv: mockIv,
          data: mockEncryptedData,
          version: 1,
        });
      });

      it('should use custom IV when provided', async () => {
        const mockKey = createMockCryptoKey();
        const customIv = new Uint8Array([9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 11, 12]);
        const mockEncryptedData = new Uint8Array([10, 20, 30, 40]);
        
        mockSubtleCrypto.encrypt.mockResolvedValue(mockEncryptedData);

        const data = new TextEncoder().encode('test data');
        const result = await encrypt(data, mockKey, { iv: customIv });

        expect(mockCrypto.getRandomValues).not.toHaveBeenCalled();
        expect(result.iv).toBe(customIv);
      });

      it('should handle encryption errors', async () => {
        const mockKey = createMockCryptoKey();
        const error = new Error('Encryption failed');
        mockSubtleCrypto.encrypt.mockRejectedValue(error);

        const data = new TextEncoder().encode('test data');

        await expect(encrypt(data, mockKey)).rejects.toThrow('Failed to encrypt data: Encryption failed');
      });

      it('should support different algorithms', async () => {
        const mockKey = createMockCryptoKey();
        const mockEncryptedData = new Uint8Array([10, 20, 30, 40]);
        
        mockSubtleCrypto.encrypt.mockResolvedValue(mockEncryptedData);

        const data = new TextEncoder().encode('test data');
        await encrypt(data, mockKey, { algorithm: 'AES-CBC' });

        expect(mockSubtleCrypto.encrypt).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'AES-CBC',
          }),
          mockKey,
          data
        );
      });
    });

    describe('decrypt', () => {
      it('should decrypt data with AES-256-GCM', async () => {
        const mockKey = createMockCryptoKey();
        const encryptedData = createMockEncryptedData();
        const mockDecryptedData = new TextEncoder().encode('test data');
        
        mockSubtleCrypto.decrypt.mockResolvedValue(mockDecryptedData);

        const result = await decrypt(encryptedData, mockKey);

        expect(mockSubtleCrypto.decrypt).toHaveBeenCalledWith(
          {
            name: 'AES-GCM',
            iv: encryptedData.iv,
          },
          mockKey,
          encryptedData.data
        );
        expect(Array.from(result)).toEqual(Array.from(mockDecryptedData));
      });

      it('should handle decryption errors', async () => {
        const mockKey = createMockCryptoKey();
        const encryptedData = createMockEncryptedData();
        const error = new Error('Decryption failed');
        
        mockSubtleCrypto.decrypt.mockRejectedValue(error);

        await expect(decrypt(encryptedData, mockKey)).rejects.toThrow('Failed to decrypt data: Decryption failed');
      });

      it('should validate encrypted data format', async () => {
        const mockKey = createMockCryptoKey();
        const invalidData = { invalid: 'data' } as any;

        await expect(decrypt(invalidData, mockKey)).rejects.toThrow('Invalid encrypted data format');
      });

      it('should support different algorithms', async () => {
        const mockKey = createMockCryptoKey();
        const encryptedData = { 
          ...createMockEncryptedData(), 
          algorithm: 'AES-256-CBC' as const,
          iv: new Uint8Array(16) // CBC needs 16-byte IV
        };
        const mockDecryptedData = new TextEncoder().encode('test data');
        
        mockSubtleCrypto.decrypt.mockResolvedValue(mockDecryptedData);

        await decrypt(encryptedData, mockKey);

        expect(mockSubtleCrypto.decrypt).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'AES-CBC',
          }),
          mockKey,
          encryptedData.data
        );
      });
    });
  });

  describe('text encryption/decryption', () => {
    describe('encryptText', () => {
      it('should encrypt text data', async () => {
        const mockKey = createMockCryptoKey();
        const mockEncryptedData = createMockEncryptedData();
        
        mockCrypto.getRandomValues.mockReturnValue(mockEncryptedData.iv);
        mockSubtleCrypto.encrypt.mockResolvedValue(mockEncryptedData.data);

        const result = await encryptText('Hello, World!', mockKey);

        expect(mockSubtleCrypto.encrypt).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'AES-GCM' }),
          mockKey,
          new TextEncoder().encode('Hello, World!')
        );
        expect(result.algorithm).toBe(mockEncryptedData.algorithm);
        expect(result.iv).toEqual(mockEncryptedData.iv);
        expect(result.version).toBe(mockEncryptedData.version);
      });

      it('should handle empty string', async () => {
        const mockKey = createMockCryptoKey();
        const mockEncryptedData = createMockEncryptedData();
        
        mockCrypto.getRandomValues.mockReturnValue(mockEncryptedData.iv);
        mockSubtleCrypto.encrypt.mockResolvedValue(mockEncryptedData.data);

        const result = await encryptText('', mockKey);

        expect(mockSubtleCrypto.encrypt).toHaveBeenCalledWith(
          expect.anything(),
          mockKey,
          new TextEncoder().encode('')
        );
        expect(result.algorithm).toBe(mockEncryptedData.algorithm);
        expect(result.iv).toEqual(mockEncryptedData.iv);
        expect(result.version).toBe(mockEncryptedData.version);
      });

      it('should handle Unicode text', async () => {
        const mockKey = createMockCryptoKey();
        const mockEncryptedData = createMockEncryptedData();
        const unicodeText = '🔒 Secure text with émojis and àccénts 中文';
        
        mockCrypto.getRandomValues.mockReturnValue(mockEncryptedData.iv);
        mockSubtleCrypto.encrypt.mockResolvedValue(mockEncryptedData.data);

        await encryptText(unicodeText, mockKey);

        expect(mockSubtleCrypto.encrypt).toHaveBeenCalledWith(
          expect.anything(),
          mockKey,
          new TextEncoder().encode(unicodeText)
        );
      });
    });

    describe('decryptText', () => {
      it('should decrypt text data', async () => {
        const mockKey = createMockCryptoKey();
        const encryptedData = createMockEncryptedData();
        const originalText = 'Hello, World!';
        
        mockSubtleCrypto.decrypt.mockResolvedValue(new TextEncoder().encode(originalText));

        const result = await decryptText(encryptedData, mockKey);

        expect(mockSubtleCrypto.decrypt).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'AES-GCM' }),
          mockKey,
          encryptedData.data
        );
        expect(result).toBe(originalText);
      });

      it('should handle Unicode text decryption', async () => {
        const mockKey = createMockCryptoKey();
        const encryptedData = createMockEncryptedData();
        const unicodeText = '🔒 Secure text with émojis and àccénts 中文';
        
        mockSubtleCrypto.decrypt.mockResolvedValue(new TextEncoder().encode(unicodeText));

        const result = await decryptText(encryptedData, mockKey);

        expect(result).toBe(unicodeText);
      });

      it('should handle decryption of empty string', async () => {
        const mockKey = createMockCryptoKey();
        const encryptedData = createMockEncryptedData();
        
        mockSubtleCrypto.decrypt.mockResolvedValue(new TextEncoder().encode(''));

        const result = await decryptText(encryptedData, mockKey);

        expect(result).toBe('');
      });
    });
  });

  describe('object encryption/decryption', () => {
    describe('encryptObject', () => {
      it('should encrypt JSON-serializable objects', async () => {
        const mockKey = createMockCryptoKey();
        const mockEncryptedData = createMockEncryptedData();
        const testObject = {
          name: 'John Doe',
          age: 30,
          active: true,
          metadata: { role: 'admin' },
        };
        
        mockCrypto.getRandomValues.mockReturnValue(mockEncryptedData.iv);
        mockSubtleCrypto.encrypt.mockResolvedValue(mockEncryptedData.data);

        const result = await encryptObject(testObject, mockKey);

        expect(mockSubtleCrypto.encrypt).toHaveBeenCalledWith(
          expect.anything(),
          mockKey,
          new TextEncoder().encode(JSON.stringify(testObject))
        );
        expect(result.algorithm).toBe(mockEncryptedData.algorithm);
        expect(result.iv).toEqual(mockEncryptedData.iv);
        expect(result.version).toBe(mockEncryptedData.version);
      });

      it('should encrypt arrays', async () => {
        const mockKey = createMockCryptoKey();
        const mockEncryptedData = createMockEncryptedData();
        const testArray = [1, 'two', { three: 3 }, [4, 5]];
        
        mockCrypto.getRandomValues.mockReturnValue(mockEncryptedData.iv);
        mockSubtleCrypto.encrypt.mockResolvedValue(mockEncryptedData.data);

        await encryptObject(testArray, mockKey);

        expect(mockSubtleCrypto.encrypt).toHaveBeenCalledWith(
          expect.anything(),
          mockKey,
          new TextEncoder().encode(JSON.stringify(testArray))
        );
      });

      it('should handle null and primitive values', async () => {
        const mockKey = createMockCryptoKey();
        const mockEncryptedData = createMockEncryptedData();
        
        mockCrypto.getRandomValues.mockReturnValue(mockEncryptedData.iv);
        mockSubtleCrypto.encrypt.mockResolvedValue(mockEncryptedData.data);

        await encryptObject(null, mockKey);
        await encryptObject(42, mockKey);
        await encryptObject('string', mockKey);
        await encryptObject(true, mockKey);

        expect(mockSubtleCrypto.encrypt).toHaveBeenCalledTimes(4);
      });

      it('should handle serialization errors', async () => {
        const mockKey = createMockCryptoKey();
        const circularObject: any = {};
        circularObject.self = circularObject;

        await expect(encryptObject(circularObject, mockKey)).rejects.toThrow('Failed to serialize object for encryption');
      });
    });

    describe('decryptObject', () => {
      it('should decrypt and parse JSON objects', async () => {
        const mockKey = createMockCryptoKey();
        const encryptedData = createMockEncryptedData();
        const originalObject = {
          name: 'John Doe',
          age: 30,
          active: true,
          metadata: { role: 'admin' },
        };
        
        mockSubtleCrypto.decrypt.mockResolvedValue(new TextEncoder().encode(JSON.stringify(originalObject)));

        const result = await decryptObject(encryptedData, mockKey);

        expect(result).toEqual(originalObject);
      });

      it('should handle complex nested structures', async () => {
        const mockKey = createMockCryptoKey();
        const encryptedData = createMockEncryptedData();
        const complexObject = {
          users: [
            { id: 1, name: 'Alice', roles: ['admin', 'user'] },
            { id: 2, name: 'Bob', roles: ['user'] },
          ],
          settings: {
            theme: 'dark',
            notifications: { email: true, push: false },
          },
          timestamp: 1672531200000,
        };
        
        mockSubtleCrypto.decrypt.mockResolvedValue(new TextEncoder().encode(JSON.stringify(complexObject)));

        const result = await decryptObject(encryptedData, mockKey);

        expect(result).toEqual(complexObject);
      });

      it('should handle parse errors gracefully', async () => {
        const mockKey = createMockCryptoKey();
        const encryptedData = createMockEncryptedData();
        
        mockSubtleCrypto.decrypt.mockResolvedValue(new TextEncoder().encode('invalid json'));

        await expect(decryptObject(encryptedData, mockKey)).rejects.toThrow('Failed to parse decrypted object');
      });

      it('should preserve type information with generics', async () => {
        interface User {
          id: number;
          name: string;
          active: boolean;
        }

        const mockKey = createMockCryptoKey();
        const encryptedData = createMockEncryptedData();
        const user: User = { id: 1, name: 'Alice', active: true };
        
        mockSubtleCrypto.decrypt.mockResolvedValue(new TextEncoder().encode(JSON.stringify(user)));

        const result = await decryptObject<User>(encryptedData, mockKey);

        expect(result).toEqual(user);
        expect(typeof result.id).toBe('number');
        expect(typeof result.name).toBe('string');
        expect(typeof result.active).toBe('boolean');
      });
    });
  });

  describe('binary data encryption/decryption', () => {
    describe('encryptBinary', () => {
      it('should encrypt binary data', async () => {
        const mockKey = createMockCryptoKey();
        const mockEncryptedData = createMockEncryptedData();
        const binaryData = new Uint8Array([1, 2, 3, 4, 5, 255, 128, 64]);
        
        mockCrypto.getRandomValues.mockReturnValue(mockEncryptedData.iv);
        mockSubtleCrypto.encrypt.mockResolvedValue(mockEncryptedData.data);

        const result = await encryptBinary(binaryData, mockKey);

        expect(mockSubtleCrypto.encrypt).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'AES-GCM' }),
          mockKey,
          binaryData
        );
        expect(result.algorithm).toBe(mockEncryptedData.algorithm);
        expect(result.iv).toEqual(mockEncryptedData.iv);
        expect(result.version).toBe(mockEncryptedData.version);
      });

      it('should handle empty binary data', async () => {
        const mockKey = createMockCryptoKey();
        const mockEncryptedData = createMockEncryptedData();
        const emptyData = new Uint8Array(0);
        
        mockCrypto.getRandomValues.mockReturnValue(mockEncryptedData.iv);
        mockSubtleCrypto.encrypt.mockResolvedValue(mockEncryptedData.data);

        await encryptBinary(emptyData, mockKey);

        expect(mockSubtleCrypto.encrypt).toHaveBeenCalledWith(
          expect.anything(),
          mockKey,
          emptyData
        );
      });

      it('should handle large binary data', async () => {
        const mockKey = createMockCryptoKey();
        const mockEncryptedData = createMockEncryptedData();
        const largeData = new Uint8Array(1024 * 1024); // 1MB
        largeData.fill(42);
        
        mockCrypto.getRandomValues.mockReturnValue(mockEncryptedData.iv);
        mockSubtleCrypto.encrypt.mockResolvedValue(mockEncryptedData.data);

        await encryptBinary(largeData, mockKey);

        expect(mockSubtleCrypto.encrypt).toHaveBeenCalledWith(
          expect.anything(),
          mockKey,
          largeData
        );
      });
    });

    describe('decryptBinary', () => {
      it('should decrypt binary data', async () => {
        const mockKey = createMockCryptoKey();
        const encryptedData = createMockEncryptedData();
        const originalBinaryData = new Uint8Array([1, 2, 3, 4, 5, 255, 128, 64]);
        
        mockSubtleCrypto.decrypt.mockResolvedValue(originalBinaryData.buffer);

        const result = await decryptBinary(encryptedData, mockKey);

        expect(mockSubtleCrypto.decrypt).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'AES-GCM' }),
          mockKey,
          encryptedData.data
        );
        expect(result).toEqual(originalBinaryData);
      });

      it('should return Uint8Array from ArrayBuffer', async () => {
        const mockKey = createMockCryptoKey();
        const encryptedData = createMockEncryptedData();
        const buffer = new Uint8Array([1, 2, 3, 4]).buffer;
        
        mockSubtleCrypto.decrypt.mockResolvedValue(buffer);

        const result = await decryptBinary(encryptedData, mockKey);

        expect(result).toBeInstanceOf(Uint8Array);
        expect(Array.from(result)).toEqual([1, 2, 3, 4]);
      });
    });
  });

  describe('hashing utilities', () => {
    describe('hashData', () => {
      it('should hash text data with SHA-256 by default', async () => {
        const mockHash = new Uint8Array([1, 2, 3, 4]);
        mockSubtleCrypto.digest.mockResolvedValue(mockHash.buffer);

        const result = await hashData('test data');

        expect(mockSubtleCrypto.digest).toHaveBeenCalledWith(
          'SHA-256',
          new TextEncoder().encode('test data')
        );
        expect(result).toEqual(mockHash);
      });

      it('should support different hash algorithms', async () => {
        const mockHash = new Uint8Array([5, 6, 7, 8]);
        mockSubtleCrypto.digest.mockResolvedValue(mockHash.buffer);

        await hashData('test data', 'SHA-512');

        expect(mockSubtleCrypto.digest).toHaveBeenCalledWith(
          'SHA-512',
          new TextEncoder().encode('test data')
        );
      });

      it('should hash binary data', async () => {
        const mockHash = new Uint8Array([9, 10, 11, 12]);
        const binaryData = new Uint8Array([1, 2, 3, 4]);
        mockSubtleCrypto.digest.mockResolvedValue(mockHash.buffer);

        const result = await hashData(binaryData);

        expect(mockSubtleCrypto.digest).toHaveBeenCalledWith('SHA-256', binaryData);
        expect(result).toEqual(mockHash);
      });

      it('should handle hashing errors', async () => {
        const error = new Error('Hashing failed');
        mockSubtleCrypto.digest.mockRejectedValue(error);

        await expect(hashData('test data')).rejects.toThrow('Failed to hash data: Hashing failed');
      });

      it('should hash objects by JSON serialization', async () => {
        const mockHash = new Uint8Array([13, 14, 15, 16]);
        const testObject = { name: 'test', value: 123 };
        mockSubtleCrypto.digest.mockResolvedValue(mockHash.buffer);

        await hashData(testObject);

        expect(mockSubtleCrypto.digest).toHaveBeenCalledWith(
          'SHA-256',
          new TextEncoder().encode(JSON.stringify(testObject))
        );
      });
    });
  });

  describe('utility functions', () => {
    describe('secureRandom', () => {
      it('should generate random bytes', () => {
        const mockRandomBytes = new Uint8Array([1, 2, 3, 4, 5]);
        mockCrypto.getRandomValues.mockReturnValue(mockRandomBytes);

        const result = secureRandom(5);

        expect(mockCrypto.getRandomValues).toHaveBeenCalledWith(expect.any(Uint8Array));
        expect(result).toBe(mockRandomBytes);
      });

      it('should generate default 32 bytes', () => {
        const mockRandomBytes = new Uint8Array(32);
        mockCrypto.getRandomValues.mockReturnValue(mockRandomBytes);

        secureRandom();

        expect(mockCrypto.getRandomValues).toHaveBeenCalledWith(expect.any(Uint8Array));
        const callArg = mockCrypto.getRandomValues.mock.calls[0][0];
        expect(callArg.length).toBe(32);
      });

      it('should handle different sizes', () => {
        const sizes = [1, 16, 64, 128];
        
        sizes.forEach(size => {
          mockCrypto.getRandomValues.mockClear();
          secureRandom(size);
          const callArg = mockCrypto.getRandomValues.mock.calls[0][0];
          expect(callArg.length).toBe(size);
        });
      });
    });

    describe('isValidEncryptedData', () => {
      it('should validate correct encrypted data format', () => {
        const validData = createMockEncryptedData();

        expect(isValidEncryptedData(validData)).toBe(true);
      });

      it('should reject invalid data formats', () => {
        const invalidCases = [
          null,
          undefined,
          'string',
          123,
          [],
          {},
          { algorithm: 'AES-256-GCM' }, // missing fields
          { ...createMockEncryptedData(), algorithm: 'INVALID' },
          { ...createMockEncryptedData(), iv: 'not-uint8array' },
          { ...createMockEncryptedData(), data: 'not-uint8array' },
          { ...createMockEncryptedData(), version: 'not-number' },
        ];

        invalidCases.forEach(invalidData => {
          expect(isValidEncryptedData(invalidData)).toBe(false);
        });
      });

      it('should validate IV length for AES-GCM', () => {
        const shortIv = createMockEncryptedData();
        shortIv.iv = new Uint8Array([1, 2, 3]); // Too short

        expect(isValidEncryptedData(shortIv)).toBe(false);

        const validIv = createMockEncryptedData();
        validIv.iv = new Uint8Array(12); // Correct length

        expect(isValidEncryptedData(validIv)).toBe(true);
      });

      it('should accept different supported algorithms', () => {
        const gcmAlgorithms = ['AES-256-GCM', 'AES-192-GCM', 'AES-128-GCM'] as const;
        const cbcAlgorithms = ['AES-256-CBC'] as const;
        
        gcmAlgorithms.forEach(algorithm => {
          const data = { ...createMockEncryptedData(), algorithm };
          expect(isValidEncryptedData(data)).toBe(true);
        });

        cbcAlgorithms.forEach(algorithm => {
          const data = { 
            ...createMockEncryptedData(), 
            algorithm,
            iv: new Uint8Array(16) // CBC needs 16-byte IV
          };
          expect(isValidEncryptedData(data)).toBe(true);
        });
      });
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle Web Crypto API not available', () => {
      Object.defineProperty(globalThis, 'crypto', {
        value: undefined,
        writable: true,
        configurable: true
      });

      expect(() => secureRandom()).toThrow('Web Crypto API not available');
    });

    it('should handle corrupted encrypted data', async () => {
      const mockKey = createMockCryptoKey();
      const corruptedData = createMockEncryptedData();
      corruptedData.data = new Uint8Array([255, 255, 255]); // Invalid encrypted data
      
      mockSubtleCrypto.decrypt.mockRejectedValue(new Error('Decryption failed'));

      await expect(decrypt(corruptedData, mockKey)).rejects.toThrow('Failed to decrypt data');
    });

    it('should handle invalid key for decryption', async () => {
      const mockKey = createMockCryptoKey();
      const encryptedData = createMockEncryptedData();
      
      mockSubtleCrypto.decrypt.mockRejectedValue(new Error('Invalid key'));

      await expect(decrypt(encryptedData, mockKey)).rejects.toThrow('Failed to decrypt data');
    });

    it('should handle very large data encryption', async () => {
      const mockKey = createMockCryptoKey();
      const largeData = new Uint8Array(10 * 1024 * 1024); // 10MB
      
      mockCrypto.getRandomValues.mockReturnValue(new Uint8Array(12));
      mockSubtleCrypto.encrypt.mockResolvedValue(new Uint8Array(100));

      await expect(encrypt(largeData, mockKey)).resolves.toBeDefined();
    });
  });

  describe('integration tests', () => {
    it('should encrypt and decrypt text round-trip', async () => {
      const mockKey = createMockCryptoKey();
      const originalText = 'Hello, World! 🌍';
      const mockEncryptedData = createMockEncryptedData();
      
      // Mock encryption
      mockCrypto.getRandomValues.mockReturnValue(mockEncryptedData.iv);
      mockSubtleCrypto.encrypt.mockResolvedValue(mockEncryptedData.data);
      
      // Mock decryption
      mockSubtleCrypto.decrypt.mockResolvedValue(new TextEncoder().encode(originalText));

      const encrypted = await encryptText(originalText, mockKey);
      const decrypted = await decryptText(encrypted, mockKey);

      expect(decrypted).toBe(originalText);
    });

    it('should encrypt and decrypt objects round-trip', async () => {
      const mockKey = createMockCryptoKey();
      const originalObject = {
        id: 123,
        name: 'Test User',
        settings: { theme: 'dark', lang: 'en' },
        tags: ['admin', 'user'],
      };
      const mockEncryptedData = createMockEncryptedData();
      
      // Mock encryption
      mockCrypto.getRandomValues.mockReturnValue(mockEncryptedData.iv);
      mockSubtleCrypto.encrypt.mockResolvedValue(mockEncryptedData.data);
      
      // Mock decryption
      mockSubtleCrypto.decrypt.mockResolvedValue(new TextEncoder().encode(JSON.stringify(originalObject)));

      const encrypted = await encryptObject(originalObject, mockKey);
      const decrypted = await decryptObject(encrypted, mockKey);

      expect(decrypted).toEqual(originalObject);
    });

    it('should encrypt and decrypt binary data round-trip', async () => {
      const mockKey = createMockCryptoKey();
      const originalBinary = new Uint8Array([1, 2, 3, 4, 5, 255, 128, 64]);
      const mockEncryptedData = createMockEncryptedData();
      
      // Mock encryption
      mockCrypto.getRandomValues.mockReturnValue(mockEncryptedData.iv);
      mockSubtleCrypto.encrypt.mockResolvedValue(mockEncryptedData.data);
      
      // Mock decryption
      mockSubtleCrypto.decrypt.mockResolvedValue(originalBinary.buffer);

      const encrypted = await encryptBinary(originalBinary, mockKey);
      const decrypted = await decryptBinary(encrypted, mockKey);

      expect(decrypted).toEqual(originalBinary);
    });
  });

  describe('performance and security', () => {
    it('should use different IVs for each encryption', async () => {
      const mockKey = createMockCryptoKey();
      const data = new TextEncoder().encode('test data');
      const iv1 = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
      const iv2 = new Uint8Array([12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
      
      mockCrypto.getRandomValues
        .mockReturnValueOnce(iv1)
        .mockReturnValueOnce(iv2);
      mockSubtleCrypto.encrypt.mockResolvedValue(new Uint8Array([1, 2, 3, 4]));

      const result1 = await encrypt(data, mockKey);
      const result2 = await encrypt(data, mockKey);

      expect(result1.iv).not.toEqual(result2.iv);
    });

    it('should generate cryptographically secure random values', () => {
      const randomValue1 = new Uint8Array([1, 2, 3, 4]);
      const randomValue2 = new Uint8Array([5, 6, 7, 8]);
      
      mockCrypto.getRandomValues
        .mockReturnValueOnce(randomValue1)
        .mockReturnValueOnce(randomValue2);

      const result1 = secureRandom(4);
      const result2 = secureRandom(4);

      expect(result1).not.toEqual(result2);
      expect(mockCrypto.getRandomValues).toHaveBeenCalledTimes(2);
    });

    it('should use non-extractable keys by default for security', async () => {
      const mockKey = createMockCryptoKey();
      mockSubtleCrypto.generateKey.mockResolvedValue(mockKey);

      await generateKey();

      expect(mockSubtleCrypto.generateKey).toHaveBeenCalledWith(
        expect.anything(),
        false, // non-extractable
        expect.anything()
      );
    });
  });
});