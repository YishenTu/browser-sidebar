/**
 * @file Crypto Utilities Tests
 *
 * Tests for the Web Crypto API wrapper including key generation,
 * encryption, decryption, and validation functions.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateKey,
  deriveKey,
  encrypt,
  decrypt,
  encryptText,
  decryptText,
  encryptObject,
  decryptObject,
  hashData,
  secureRandom,
  isValidEncryptedData,
} from '@data/security/crypto';

describe('generateKey', () => {
  it('should generate a CryptoKey', async () => {
    const key = await generateKey();

    expect(key).toBeDefined();
    expect(key.type).toBe('secret');
    expect(key.algorithm.name).toBe('AES-GCM');
  });

  it('should generate non-extractable key by default', async () => {
    const key = await generateKey();

    expect(key.extractable).toBe(false);
  });

  it('should generate extractable key when requested', async () => {
    const key = await generateKey({ extractable: true });

    expect(key.extractable).toBe(true);
  });

  it('should support different key sizes', async () => {
    const key128 = await generateKey({ keySize: 128 });
    const key192 = await generateKey({ keySize: 192 });
    const key256 = await generateKey({ keySize: 256 });

    expect((key128.algorithm as AesKeyAlgorithm).length).toBe(128);
    expect((key192.algorithm as AesKeyAlgorithm).length).toBe(192);
    expect((key256.algorithm as AesKeyAlgorithm).length).toBe(256);
  });
});

describe('deriveKey', () => {
  it('should derive key from password', async () => {
    const result = await deriveKey('secure-password-123');

    expect(result.key).toBeDefined();
    expect(result.salt).toBeDefined();
    expect(result.salt.length).toBe(32); // Default salt size
  });

  it('should derive same key with same password and salt', async () => {
    const password = 'test-password-12345';
    const { key: key1, salt } = await deriveKey(password);
    const { key: key2 } = await deriveKey(password, salt);

    // Export keys to compare (need extractable keys for this)
    // Since keys are not extractable by default, we just verify they work
    const testData = new TextEncoder().encode('test');
    const encrypted1 = await encrypt(testData, key1);
    const decrypted = await decrypt(encrypted1, key2);

    expect(new TextDecoder().decode(decrypted)).toBe('test');
  });

  it('should throw error for weak password', async () => {
    await expect(deriveKey('short')).rejects.toThrow('Password too weak');
  });

  it('should accept custom salt', async () => {
    const customSalt = new Uint8Array(32);
    crypto.getRandomValues(customSalt);

    const result = await deriveKey('test-password-12345', customSalt);

    expect(result.salt).toEqual(customSalt);
  });

  it('should support custom iterations', async () => {
    // Lower iterations for faster test, but still works
    const result = await deriveKey('test-password-12345', undefined, {
      iterations: 10000,
    });

    expect(result.key).toBeDefined();
  });
});

describe('encrypt/decrypt', () => {
  let key: CryptoKey;

  beforeEach(async () => {
    key = await generateKey();
  });

  it('should encrypt and decrypt data', async () => {
    const originalData = new TextEncoder().encode('Hello, World!');

    const encrypted = await encrypt(originalData, key);
    const decrypted = await decrypt(encrypted, key);

    expect(new TextDecoder().decode(decrypted)).toBe('Hello, World!');
  });

  it('should produce different ciphertext for same plaintext', async () => {
    const data = new TextEncoder().encode('Same data');

    const encrypted1 = await encrypt(data, key);
    const encrypted2 = await encrypt(data, key);

    // IVs should be different, so ciphertext differs
    expect(encrypted1.iv).not.toEqual(encrypted2.iv);
    expect(encrypted1.data).not.toEqual(encrypted2.data);
  });

  it('should include algorithm in encrypted data', async () => {
    const data = new TextEncoder().encode('Test');

    const encrypted = await encrypt(data, key);

    expect(encrypted.algorithm).toContain('GCM');
  });

  it('should include version in encrypted data', async () => {
    const data = new TextEncoder().encode('Test');

    const encrypted = await encrypt(data, key);

    expect(encrypted.version).toBe(1);
  });

  it('should fail decryption with wrong key', async () => {
    const data = new TextEncoder().encode('Secret');
    const wrongKey = await generateKey();

    const encrypted = await encrypt(data, key);

    await expect(decrypt(encrypted, wrongKey)).rejects.toThrow();
  });

  it('should fail decryption with tampered data', async () => {
    const data = new TextEncoder().encode('Secret');

    const encrypted = await encrypt(data, key);
    if (encrypted.data[0] !== undefined) {
      encrypted.data[0] = encrypted.data[0] ^ 0xff; // Tamper with data
    }

    await expect(decrypt(encrypted, key)).rejects.toThrow();
  });

  it('should use custom IV when provided', async () => {
    const customIv = new Uint8Array(12);
    crypto.getRandomValues(customIv);

    const data = new TextEncoder().encode('Test');
    const encrypted = await encrypt(data, key, { iv: customIv });

    expect(encrypted.iv).toEqual(customIv);
  });
});

describe('encryptText/decryptText', () => {
  let key: CryptoKey;

  beforeEach(async () => {
    key = await generateKey();
  });

  it('should encrypt and decrypt text', async () => {
    const originalText = 'Hello, World!';

    const encrypted = await encryptText(originalText, key);
    const decrypted = await decryptText(encrypted, key);

    expect(decrypted).toBe(originalText);
  });

  it('should handle unicode text', async () => {
    const unicodeText = 'Hello café 🌍 مرحبا';

    const encrypted = await encryptText(unicodeText, key);
    const decrypted = await decryptText(encrypted, key);

    expect(decrypted).toBe(unicodeText);
  });

  it('should handle empty string', async () => {
    const encrypted = await encryptText('', key);
    const decrypted = await decryptText(encrypted, key);

    expect(decrypted).toBe('');
  });
});

describe('encryptObject/decryptObject', () => {
  let key: CryptoKey;

  beforeEach(async () => {
    key = await generateKey();
  });

  it('should encrypt and decrypt objects', async () => {
    const originalObject = {
      name: 'Test',
      value: 123,
      nested: { deep: true },
    };

    const encrypted = await encryptObject(originalObject, key);
    const decrypted = await decryptObject<typeof originalObject>(encrypted, key);

    expect(decrypted).toEqual(originalObject);
  });

  it('should handle arrays', async () => {
    const originalArray = [1, 2, 3, 'test', { nested: true }];

    const encrypted = await encryptObject(originalArray, key);
    const decrypted = await decryptObject<typeof originalArray>(encrypted, key);

    expect(decrypted).toEqual(originalArray);
  });

  it('should handle null values in objects', async () => {
    const obj = { nullValue: null, regularValue: 'test' };

    const encrypted = await encryptObject(obj, key);
    const decrypted = await decryptObject<typeof obj>(encrypted, key);

    expect(decrypted.nullValue).toBeNull();
  });
});

describe('hashData', () => {
  it('should hash string data', async () => {
    const hash = await hashData('test string');

    expect(hash).toBeInstanceOf(Uint8Array);
    expect(hash.length).toBe(32); // SHA-256 = 256 bits = 32 bytes
  });

  it('should hash binary data', async () => {
    const binaryData = new Uint8Array([1, 2, 3, 4, 5]);
    const hash = await hashData(binaryData);

    expect(hash).toBeInstanceOf(Uint8Array);
    expect(hash.length).toBe(32);
  });

  it('should hash objects', async () => {
    const obj = { key: 'value' };
    const hash = await hashData(obj);

    expect(hash).toBeInstanceOf(Uint8Array);
    expect(hash.length).toBe(32);
  });

  it('should produce same hash for same input', async () => {
    const hash1 = await hashData('same input');
    const hash2 = await hashData('same input');

    expect(hash1).toEqual(hash2);
  });

  it('should produce different hash for different input', async () => {
    const hash1 = await hashData('input 1');
    const hash2 = await hashData('input 2');

    expect(hash1).not.toEqual(hash2);
  });

  it('should support SHA-384', async () => {
    const hash = await hashData('test', 'SHA-384');

    expect(hash.length).toBe(48); // 384 bits = 48 bytes
  });

  it('should support SHA-512', async () => {
    const hash = await hashData('test', 'SHA-512');

    expect(hash.length).toBe(64); // 512 bits = 64 bytes
  });
});

describe('secureRandom', () => {
  it('should generate random bytes of specified size', () => {
    const random32 = secureRandom(32);
    const random16 = secureRandom(16);

    expect(random32.length).toBe(32);
    expect(random16.length).toBe(16);
  });

  it('should default to 32 bytes', () => {
    const random = secureRandom();

    expect(random.length).toBe(32);
  });

  it('should produce different values on each call', () => {
    const random1 = secureRandom();
    const random2 = secureRandom();

    expect(random1).not.toEqual(random2);
  });
});

describe('isValidEncryptedData', () => {
  it('should return true for valid GCM encrypted data', () => {
    const validData = {
      algorithm: 'AES-256-GCM',
      iv: new Uint8Array(12),
      data: new Uint8Array(32),
      version: 1,
    };

    expect(isValidEncryptedData(validData)).toBe(true);
  });

  it('should return true for valid CBC encrypted data', () => {
    const validData = {
      algorithm: 'AES-256-CBC',
      iv: new Uint8Array(16),
      data: new Uint8Array(32),
      version: 1,
    };

    expect(isValidEncryptedData(validData)).toBe(true);
  });

  it('should return false for null', () => {
    expect(isValidEncryptedData(null)).toBe(false);
  });

  it('should return false for non-object', () => {
    expect(isValidEncryptedData('string')).toBe(false);
    expect(isValidEncryptedData(123)).toBe(false);
  });

  it('should return false for missing algorithm', () => {
    const invalidData = {
      iv: new Uint8Array(12),
      data: new Uint8Array(32),
      version: 1,
    };

    expect(isValidEncryptedData(invalidData)).toBe(false);
  });

  it('should return false for missing iv', () => {
    const invalidData = {
      algorithm: 'AES-256-GCM',
      data: new Uint8Array(32),
      version: 1,
    };

    expect(isValidEncryptedData(invalidData)).toBe(false);
  });

  it('should return false for missing data', () => {
    const invalidData = {
      algorithm: 'AES-256-GCM',
      iv: new Uint8Array(12),
      version: 1,
    };

    expect(isValidEncryptedData(invalidData)).toBe(false);
  });

  it('should return false for missing version', () => {
    const invalidData = {
      algorithm: 'AES-256-GCM',
      iv: new Uint8Array(12),
      data: new Uint8Array(32),
    };

    expect(isValidEncryptedData(invalidData)).toBe(false);
  });

  it('should return false for unsupported algorithm', () => {
    const invalidData = {
      algorithm: 'AES-256-ECB', // ECB not supported
      iv: new Uint8Array(12),
      data: new Uint8Array(32),
      version: 1,
    };

    expect(isValidEncryptedData(invalidData)).toBe(false);
  });

  it('should return false for wrong GCM IV length', () => {
    const invalidData = {
      algorithm: 'AES-256-GCM',
      iv: new Uint8Array(16), // Should be 12 for GCM
      data: new Uint8Array(32),
      version: 1,
    };

    expect(isValidEncryptedData(invalidData)).toBe(false);
  });

  it('should return false for wrong CBC IV length', () => {
    const invalidData = {
      algorithm: 'AES-256-CBC',
      iv: new Uint8Array(12), // Should be 16 for CBC
      data: new Uint8Array(32),
      version: 1,
    };

    expect(isValidEncryptedData(invalidData)).toBe(false);
  });
});

describe('error handling', () => {
  it('should throw descriptive error for missing crypto', async () => {
    const originalCrypto = globalThis.crypto;
    // @ts-expect-error - Testing error case
    delete globalThis.crypto;

    await expect(generateKey()).rejects.toThrow('Web Crypto API not available');

    globalThis.crypto = originalCrypto;
  });

  it('should handle decrypt with invalid data structure', async () => {
    const key = await generateKey();

    await expect(decrypt({ algorithm: 'invalid' } as never, key)).rejects.toThrow();
  });
});
