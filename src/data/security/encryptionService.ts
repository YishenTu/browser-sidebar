/**
 * @file Encryption Service
 *
 * High-level encryption service that wraps the low-level crypto utilities.
 * Provides a simple interface for encrypting and decrypting various data types
 * with automatic key management.
 */

import {
  generateKey,
  deriveKey,
  encryptText,
  decryptText,
  encryptObject,
  decryptObject,
  encryptBinary,
  decryptBinary,
  hashData,
  secureRandom,
  type EncryptedData,
  type CryptoKey,
  type KeyDerivationResult,
} from './crypto';

// =============================================================================
// Types and Interfaces
// =============================================================================

/**
 * Data types supported by the encryption service
 */
export type DataType = 'text' | 'object' | 'binary';

/**
 * Encryption service configuration
 */
export interface EncryptionServiceConfig {
  /** Default key size (128, 192, or 256) */
  keySize?: 128 | 192 | 256;
  /** PBKDF2 iterations for password-based keys */
  iterations?: number;
  /** Cache keys in memory (defaults to true) */
  cacheKeys?: boolean;
  /** Maximum cached keys (defaults to 10) */
  maxCachedKeys?: number;
}

/**
 * Key info stored in the cache
 */
interface CachedKey {
  key: CryptoKey;
  createdAt: number;
  lastUsed: number;
  purpose?: string;
}

// =============================================================================
// Encryption Service Class
// =============================================================================

/**
 * High-level encryption service for easy data encryption/decryption
 *
 * @example
 * ```ts
 * const service = new EncryptionService();
 *
 * // Initialize with password
 * await service.initializeWithPassword('secure-password');
 *
 * // Encrypt text
 * const encrypted = await service.encryptData('sensitive data', 'text');
 *
 * // Decrypt text
 * const decrypted = await service.decryptData(encrypted, 'text');
 * ```
 */
export class EncryptionService {
  private readonly config: Required<EncryptionServiceConfig>;
  private currentKey: CryptoKey | null = null;
  private keySalt: Uint8Array | null = null;
  private keyCache: Map<string, CachedKey> = new Map();
  private initialized: boolean = false;

  constructor(config: EncryptionServiceConfig = {}) {
    this.config = {
      keySize: config.keySize ?? 256,
      iterations: config.iterations ?? 100000,
      cacheKeys: config.cacheKeys ?? true,
      maxCachedKeys: config.maxCachedKeys ?? 10,
    };
  }

  // ===========================================================================
  // Initialization Methods
  // ===========================================================================

  /**
   * Initialize the service with a generated key
   */
  async initialize(): Promise<void> {
    this.currentKey = await generateKey({
      keySize: this.config.keySize,
      extractable: false,
    });
    this.initialized = true;
  }

  /**
   * Initialize the service with a password-derived key
   */
  async initializeWithPassword(password: string, salt?: Uint8Array): Promise<Uint8Array> {
    const result: KeyDerivationResult = await deriveKey(password, salt, {
      iterations: this.config.iterations,
      keySize: this.config.keySize,
    });

    this.currentKey = result.key;
    this.keySalt = result.salt;
    this.initialized = true;

    return result.salt;
  }

  /**
   * Check if the service is initialized
   */
  isInitialized(): boolean {
    return this.initialized && this.currentKey !== null;
  }

  /**
   * Get the current salt (if using password-derived key)
   */
  getSalt(): Uint8Array | null {
    return this.keySalt;
  }

  // ===========================================================================
  // Encryption/Decryption Methods
  // ===========================================================================

  /**
   * Encrypt data of any supported type
   */
  async encryptData(data: string | object | Uint8Array, type: DataType): Promise<EncryptedData> {
    this.ensureInitialized();

    switch (type) {
      case 'text':
        if (typeof data !== 'string') {
          throw new Error('Expected string data for text encryption');
        }
        return encryptText(data, this.currentKey!);

      case 'object':
        if (typeof data !== 'object' || data instanceof Uint8Array) {
          throw new Error('Expected object data for object encryption');
        }
        return encryptObject(data, this.currentKey!);

      case 'binary':
        if (!(data instanceof Uint8Array)) {
          throw new Error('Expected Uint8Array data for binary encryption');
        }
        return encryptBinary(data, this.currentKey!);

      default:
        throw new Error(`Unsupported data type: ${type}`);
    }
  }

  /**
   * Decrypt data of any supported type
   */
  async decryptData<T = string>(encryptedData: EncryptedData, type: DataType): Promise<T> {
    this.ensureInitialized();

    switch (type) {
      case 'text':
        return (await decryptText(encryptedData, this.currentKey!)) as T;

      case 'object':
        return decryptObject<T>(encryptedData, this.currentKey!);

      case 'binary':
        return (await decryptBinary(encryptedData, this.currentKey!)) as T;

      default:
        throw new Error(`Unsupported data type: ${type}`);
    }
  }

  /**
   * Encrypt text data (convenience method)
   */
  async encrypt(text: string): Promise<EncryptedData> {
    return this.encryptData(text, 'text');
  }

  /**
   * Decrypt text data (convenience method)
   */
  async decrypt(encryptedData: EncryptedData): Promise<string> {
    return this.decryptData<string>(encryptedData, 'text');
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  /**
   * Hash data using SHA-256
   */
  async hash(data: string | Uint8Array | object): Promise<string> {
    const hashBytes = await hashData(data, 'SHA-256');
    return Array.from(hashBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Generate secure random bytes
   */
  generateRandom(size: number = 32): Uint8Array {
    return secureRandom(size);
  }

  /**
   * Generate a random ID string
   */
  generateId(length: number = 16): string {
    const bytes = secureRandom(Math.ceil(length / 2));
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, length);
  }

  // ===========================================================================
  // Key Management Methods
  // ===========================================================================

  /**
   * Create and cache a key for a specific purpose
   */
  async createPurposeKey(purpose: string): Promise<void> {
    if (this.keyCache.size >= this.config.maxCachedKeys) {
      this.evictOldestKey();
    }

    const key = await generateKey({
      keySize: this.config.keySize,
      extractable: false,
    });

    this.keyCache.set(purpose, {
      key,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      purpose,
    });
  }

  /**
   * Encrypt data with a purpose-specific key
   */
  async encryptWithPurpose(
    data: string | object | Uint8Array,
    type: DataType,
    purpose: string
  ): Promise<EncryptedData> {
    const cachedKey = this.keyCache.get(purpose);
    if (!cachedKey) {
      throw new Error(`No key found for purpose: ${purpose}`);
    }

    cachedKey.lastUsed = Date.now();

    switch (type) {
      case 'text':
        if (typeof data !== 'string') {
          throw new Error('Expected string data for text encryption');
        }
        return encryptText(data, cachedKey.key);

      case 'object':
        if (typeof data !== 'object' || data instanceof Uint8Array) {
          throw new Error('Expected object data for object encryption');
        }
        return encryptObject(data, cachedKey.key);

      case 'binary':
        if (!(data instanceof Uint8Array)) {
          throw new Error('Expected Uint8Array data for binary encryption');
        }
        return encryptBinary(data, cachedKey.key);

      default:
        throw new Error(`Unsupported data type: ${type}`);
    }
  }

  /**
   * Decrypt data with a purpose-specific key
   */
  async decryptWithPurpose<T = string>(
    encryptedData: EncryptedData,
    type: DataType,
    purpose: string
  ): Promise<T> {
    const cachedKey = this.keyCache.get(purpose);
    if (!cachedKey) {
      throw new Error(`No key found for purpose: ${purpose}`);
    }

    cachedKey.lastUsed = Date.now();

    switch (type) {
      case 'text':
        return (await decryptText(encryptedData, cachedKey.key)) as T;

      case 'object':
        return decryptObject<T>(encryptedData, cachedKey.key);

      case 'binary':
        return (await decryptBinary(encryptedData, cachedKey.key)) as T;

      default:
        throw new Error(`Unsupported data type: ${type}`);
    }
  }

  /**
   * Remove a purpose-specific key
   */
  removePurposeKey(purpose: string): boolean {
    return this.keyCache.delete(purpose);
  }

  /**
   * Clear all cached keys
   */
  clearKeyCache(): void {
    this.keyCache.clear();
  }

  /**
   * Reset the service state
   */
  reset(): void {
    this.currentKey = null;
    this.keySalt = null;
    this.initialized = false;
    this.keyCache.clear();
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private ensureInitialized(): void {
    if (!this.initialized || !this.currentKey) {
      throw new Error('Encryption service not initialized. Call initialize() first.');
    }
  }

  private evictOldestKey(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [purpose, cached] of this.keyCache) {
      if (cached.lastUsed < oldestTime) {
        oldestTime = cached.lastUsed;
        oldestKey = purpose;
      }
    }

    if (oldestKey) {
      this.keyCache.delete(oldestKey);
    }
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create an encryption service with default settings
 */
export function createEncryptionService(config?: EncryptionServiceConfig): EncryptionService {
  return new EncryptionService(config);
}

// =============================================================================
// Default Export
// =============================================================================

export default {
  EncryptionService,
  createEncryptionService,
};
