/**
 * @file Key Derivation System
 *
 * Advanced key derivation functionality for secure browser extension storage.
 * Provides master key derivation, multiple key derivation, salt management,
 * key versioning, and comprehensive key lifecycle management using PBKDF2 and HKDF.
 */

import { CryptoKey } from './crypto';

// =============================================================================
// Types and Interfaces
// =============================================================================

/**
 * Supported key purposes for key derivation
 */
export type KeyPurpose = 'encryption' | 'authentication' | 'storage' | 'signing';

/**
 * Supported hash algorithms for key derivation
 */
export type HashAlgorithm = 'SHA-256' | 'SHA-384' | 'SHA-512';

/**
 * Supported key algorithms
 */
export type KeyAlgorithm = 'AES-GCM' | 'AES-CBC' | 'HMAC';

/**
 * Salt information container
 */
export interface SaltInfo {
  /** The salt bytes */
  salt: Uint8Array;
  /** Salt size in bytes */
  size: number;
  /** Algorithm used to generate salt */
  algorithm: 'CSPRNG';
  /** When the salt was created */
  createdAt: Date;
}

/**
 * Configuration for key derivation operations
 */
export interface KeyDerivationConfig {
  /** Salt for key derivation (will generate if not provided) */
  salt?: Uint8Array;
  /** Number of PBKDF2 iterations */
  iterations?: number;
  /** Hash algorithm for PBKDF2 */
  hashAlgorithm?: HashAlgorithm;
  /** Target key size in bits */
  keySize?: 128 | 192 | 256;
  /** Target algorithm for derived key */
  algorithm?: KeyAlgorithm;
  /** Key version for compatibility */
  version?: number;
}

/**
 * Master key derivation result
 */
export interface MasterKeyResult {
  /** The derived master key */
  masterKey: CryptoKey;
  /** Salt used for derivation */
  salt: Uint8Array;
  /** Number of iterations used */
  iterations: number;
  /** PBKDF2 algorithm identifier */
  algorithm: 'PBKDF2';
  /** Hash algorithm used */
  hashAlgorithm: HashAlgorithm;
  /** Key size in bits */
  keySize: number;
  /** Key version */
  version: number;
  /** When the key was created */
  createdAt: Date;
}

/**
 * Individual derived key information
 */
export interface DerivedKey {
  /** Purpose of this key */
  purpose: KeyPurpose;
  /** The actual CryptoKey */
  key: CryptoKey;
  /** Algorithm this key is for */
  algorithm: KeyAlgorithm;
  /** Key size in bits */
  keySize: number;
  /** When this key was derived */
  derivedAt: Date;
  /** Version of key derivation used */
  version: number;
}

/**
 * Multiple key derivation result
 */
export interface MultiKeyResult {
  /** Array of derived keys */
  keys: DerivedKey[];
  /** Version used for derivation */
  version: number;
  /** When the keys were derived */
  derivedAt: Date;
}

/**
 * Key purpose configuration for algorithm selection
 */
interface KeyPurposeConfig {
  algorithm: KeyAlgorithm;
  keySize: number;
  usages: KeyUsage[];
  hashAlgorithm?: HashAlgorithm;
}

/**
 * Wrapped key information
 */
export interface WrappedKeyInfo {
  /** The wrapped key data */
  wrappedKey: Uint8Array;
  /** Purpose of the wrapped key */
  purpose: KeyPurpose;
  /** Algorithm of the wrapped key */
  algorithm: KeyAlgorithm;
  /** Algorithm used for wrapping */
  wrapAlgorithm: KeyAlgorithm;
  /** When the key was wrapped */
  wrappedAt: Date;
}

/**
 * Key version information
 */
export interface KeyVersionInfo {
  /** Current version */
  version: number;
  /** Supported versions */
  supportedVersions: number[];
  /** Migration paths available */
  migrationPaths: Record<number, number>;
}

/**
 * Multi-key derivation configuration
 */
export interface MultiKeyConfig {
  /** Key version */
  version?: number;
  /** Hash algorithm for HKDF */
  hashAlgorithm?: HashAlgorithm;
  /** Custom configurations per key purpose */
  keyConfigs?: Partial<Record<KeyPurpose, { algorithm: KeyAlgorithm; keySize: number }>>;
}

// =============================================================================
// Constants
// =============================================================================

/** Default PBKDF2 iterations (secure minimum) */
const DEFAULT_ITERATIONS = 100000;

/** Minimum allowed iterations */
const MIN_ITERATIONS = 10000;

/** Default salt size in bytes */
const DEFAULT_SALT_SIZE = 32;

/** Minimum salt size in bytes */
const MIN_SALT_SIZE = 16;

/** Default hash algorithm */
const DEFAULT_HASH_ALGORITHM: HashAlgorithm = 'SHA-256';

/** Default key size in bits */
const DEFAULT_KEY_SIZE = 256;

/** Current key version */
const CURRENT_VERSION = 1;

/** Minimum password length */
const MIN_PASSWORD_LENGTH = 8;

/** Key purpose configurations */
const KEY_PURPOSE_CONFIGS: Record<KeyPurpose, KeyPurposeConfig> = {
  encryption: {
    algorithm: 'AES-GCM',
    keySize: 256,
    usages: ['encrypt', 'decrypt'],
  },
  authentication: {
    algorithm: 'HMAC',
    keySize: 256,
    usages: ['sign', 'verify'],
    hashAlgorithm: 'SHA-256',
  },
  storage: {
    algorithm: 'AES-GCM',
    keySize: 256,
    usages: ['encrypt', 'decrypt'],
  },
  signing: {
    algorithm: 'HMAC',
    keySize: 256,
    usages: ['sign', 'verify'],
    hashAlgorithm: 'SHA-256',
  },
};

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Check if Web Crypto API is available
 */
function checkCryptoSupport(): void {
  if (!globalThis.crypto || !globalThis.crypto.subtle) {
    throw new Error('Web Crypto API not available');
  }
}

/**
 * Validate password strength
 */
function validatePassword(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password too weak. Must be at least ${MIN_PASSWORD_LENGTH} characters long`);
  }
}

/**
 * Validate salt size
 */
function validateSaltSize(size: number): void {
  if (size < MIN_SALT_SIZE) {
    throw new Error(`Invalid salt size: must be at least ${MIN_SALT_SIZE} bytes`);
  }
}

/**
 * Validate iterations count
 */
function validateIterations(iterations: number): void {
  if (iterations < MIN_ITERATIONS) {
    throw new Error(`Invalid iterations: must be at least ${MIN_ITERATIONS}`);
  }
}

/**
 * Validate key size
 */
function validateKeySize(keySize: number): void {
  if (![128, 192, 256].includes(keySize)) {
    throw new Error('Invalid key size: must be 128, 192, or 256');
  }
}

/**
 * Validate key purpose
 */
function validateKeyPurpose(purpose: string): void {
  if (!KEY_PURPOSE_CONFIGS[purpose as KeyPurpose]) {
    throw new Error(`Invalid key purpose: ${purpose}`);
  }
}

/**
 * Get algorithm parameters for key generation
 */
function getKeyAlgorithmParams(algorithm: KeyAlgorithm, keySize: number, hashAlgorithm?: HashAlgorithm) {
  switch (algorithm) {
    case 'AES-GCM':
    case 'AES-CBC':
      return { name: algorithm, length: keySize };
    case 'HMAC':
      return { name: 'HMAC', hash: hashAlgorithm || 'SHA-256', length: keySize };
    default:
      throw new Error(`Unsupported algorithm: ${algorithm}`);
  }
}

/**
 * Generate info string for HKDF key derivation
 */
function generateKeyInfo(purpose: KeyPurpose, version: number): Uint8Array {
  const info = `${purpose}-v${version}`;
  return new TextEncoder().encode(info);
}

// =============================================================================
// Salt Generation
// =============================================================================

/**
 * Generate cryptographically secure salt with metadata
 */
export function generateSalt(size: number = DEFAULT_SALT_SIZE): SaltInfo {
  checkCryptoSupport();
  validateSaltSize(size);

  const salt = new Uint8Array(size);
  crypto.getRandomValues(salt);
  
  return {
    salt,
    size,
    algorithm: 'CSPRNG',
    createdAt: new Date(),
  };
}

// =============================================================================
// Master Key Derivation
// =============================================================================

/**
 * Derive master key from password using PBKDF2
 */
export async function deriveMasterKey(
  password: string,
  config: KeyDerivationConfig = {}
): Promise<MasterKeyResult> {
  checkCryptoSupport();
  validatePassword(password);

  const {
    salt = (() => {
      const defaultSalt = new Uint8Array(DEFAULT_SALT_SIZE);
      crypto.getRandomValues(defaultSalt);
      return defaultSalt;
    })(),
    iterations = DEFAULT_ITERATIONS,
    hashAlgorithm = DEFAULT_HASH_ALGORITHM,
    keySize = DEFAULT_KEY_SIZE,
    algorithm = 'AES-GCM',
    version = CURRENT_VERSION,
  } = config;

  validateIterations(iterations);
  validateKeySize(keySize);

  try {
    // Import password as key material
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    // Determine target algorithm based on config
    const targetAlgorithm = algorithm === 'AES-CBC' ? 'AES-CBC' : 'AES-GCM';

    // Derive the master encryption key
    const masterKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations,
        hash: hashAlgorithm,
      },
      passwordKey,
      {
        name: targetAlgorithm,
        length: keySize,
      },
      false,
      ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
    );

    return {
      masterKey,
      salt,
      iterations,
      algorithm: 'PBKDF2',
      hashAlgorithm,
      keySize,
      version,
      createdAt: new Date(),
    };
  } catch (error) {
    throw new Error(`Failed to derive master key: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// =============================================================================
// Multiple Key Derivation
// =============================================================================

/**
 * Derive multiple purpose-specific keys from master key using HKDF
 */
export async function deriveMultipleKeys(
  masterKey: CryptoKey,
  purposes: KeyPurpose[],
  config: MultiKeyConfig = {}
): Promise<MultiKeyResult> {
  checkCryptoSupport();

  if (purposes.length === 0) {
    throw new Error('At least one key purpose must be specified');
  }

  // Validate all purposes
  purposes.forEach(purpose => validateKeyPurpose(purpose));

  const {
    version = CURRENT_VERSION,
    hashAlgorithm = DEFAULT_HASH_ALGORITHM,
    keyConfigs = {},
  } = config;

  const derivedAt = new Date();
  const keys: DerivedKey[] = [];

  try {
    // Derive each key sequentially to avoid race conditions
    for (const purpose of purposes) {
      const purposeConfig = KEY_PURPOSE_CONFIGS[purpose];
      const customConfig = keyConfigs[purpose];
      
      // Use custom config if provided, otherwise use default
      const algorithm = customConfig?.algorithm || purposeConfig.algorithm;
      const keySize = customConfig?.keySize || purposeConfig.keySize;
      const usages = purposeConfig.usages;
      const purposeHashAlgorithm = purposeConfig.hashAlgorithm;

      // Generate unique info for this purpose and version
      const info = generateKeyInfo(purpose, version);

      // Derive key using HKDF
      const derivedKey = await crypto.subtle.deriveKey(
        {
          name: 'HKDF',
          hash: hashAlgorithm,
          salt: new Uint8Array(), // Empty salt for HKDF (using master key as IKM)
          info,
        },
        masterKey,
        getKeyAlgorithmParams(algorithm, keySize, purposeHashAlgorithm),
        false,
        usages
      );

      keys.push({
        purpose,
        key: derivedKey,
        algorithm,
        keySize,
        derivedAt,
        version,
      });
    }

    return {
      keys,
      version,
      derivedAt,
    };
  } catch (error) {
    throw new Error(`Failed to derive keys: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// =============================================================================
// Key Derivation Manager
// =============================================================================

/**
 * Comprehensive key derivation manager with caching and lifecycle management
 */
export class KeyDerivationManager {
  private config: Required<Omit<KeyDerivationConfig, 'salt'>>;
  private masterKeyResult: MasterKeyResult | null = null;
  private derivedKeys: Map<KeyPurpose, DerivedKey> = new Map();

  constructor(config: Partial<KeyDerivationConfig> = {}) {
    // Validate and set configuration
    const fullConfig = {
      iterations: config.iterations ?? DEFAULT_ITERATIONS,
      hashAlgorithm: config.hashAlgorithm ?? DEFAULT_HASH_ALGORITHM,
      keySize: config.keySize ?? DEFAULT_KEY_SIZE,
      algorithm: config.algorithm ?? 'AES-GCM',
      version: config.version ?? CURRENT_VERSION,
    };

    // Validate configuration
    validateIterations(fullConfig.iterations);
    validateKeySize(fullConfig.keySize);

    this.config = fullConfig;
  }

  /**
   * Get current configuration
   */
  getConfig(): Required<Omit<KeyDerivationConfig, 'salt'>> {
    return { ...this.config };
  }

  /**
   * Update configuration (clears cached keys)
   */
  updateConfig(updates: Partial<KeyDerivationConfig>): void {
    // Validate updates
    if (updates.iterations !== undefined) {
      validateIterations(updates.iterations);
    }
    if (updates.keySize !== undefined) {
      validateKeySize(updates.keySize);
    }

    // Apply updates
    Object.assign(this.config, updates);

    // Clear cached data as config changed
    this.clearAllCachedData();
  }

  /**
   * Create new master key from password
   */
  async createMasterKey(password: string, salt?: Uint8Array): Promise<MasterKeyResult> {
    const masterKeyResult = await deriveMasterKey(password, {
      ...this.config,
      salt,
    });

    this.masterKeyResult = masterKeyResult;
    return masterKeyResult;
  }

  /**
   * Restore master key from existing salt
   */
  async restoreMasterKey(password: string, salt: Uint8Array): Promise<MasterKeyResult> {
    return this.createMasterKey(password, salt);
  }

  /**
   * Get cached master key
   */
  getMasterKey(): MasterKeyResult | null {
    return this.masterKeyResult;
  }

  /**
   * Clear cached master key and derived keys
   */
  clearMasterKey(): void {
    this.masterKeyResult = null;
    this.derivedKeys.clear();
  }

  /**
   * Derive purpose-specific key (with caching)
   */
  async deriveKey(purpose: KeyPurpose): Promise<DerivedKey> {
    if (!this.masterKeyResult) {
      throw new Error('No master key available. Create or restore a master key first.');
    }

    // Return cached key if available
    if (this.derivedKeys.has(purpose)) {
      const cachedKey = this.derivedKeys.get(purpose);
      if (cachedKey) {
        return cachedKey;
      }
    }

    // Derive new key
    const result = await deriveMultipleKeys(
      this.masterKeyResult.masterKey,
      [purpose],
      { version: this.config.version, hashAlgorithm: this.config.hashAlgorithm }
    );

    const derivedKey = result.keys[0];
    this.derivedKeys.set(purpose, derivedKey);
    
    return derivedKey;
  }

  /**
   * Derive multiple keys at once
   */
  async deriveMultipleKeys(purposes: KeyPurpose[]): Promise<MultiKeyResult> {
    if (!this.masterKeyResult) {
      throw new Error('No master key available. Create or restore a master key first.');
    }

    const result = await deriveMultipleKeys(
      this.masterKeyResult.masterKey,
      purposes,
      { version: this.config.version, hashAlgorithm: this.config.hashAlgorithm }
    );

    // Cache derived keys
    result.keys.forEach(key => {
      this.derivedKeys.set(key.purpose, key);
    });

    return result;
  }

  /**
   * Wrap a key for secure storage
   */
  async wrapKey(key: CryptoKey, purpose: KeyPurpose): Promise<WrappedKeyInfo> {
    if (!this.masterKeyResult) {
      throw new Error('No master key available. Create or restore a master key first.');
    }

    try {
      const wrappedKeyBuffer = await crypto.subtle.wrapKey(
        'raw',
        key,
        this.masterKeyResult.masterKey,
        this.config.algorithm
      );

      return {
        wrappedKey: new Uint8Array(wrappedKeyBuffer),
        purpose,
        algorithm: this.config.algorithm,
        wrapAlgorithm: this.config.algorithm,
        wrappedAt: new Date(),
      };
    } catch (error) {
      throw new Error(`Failed to wrap key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Unwrap a key from storage
   */
  async unwrapKey(wrappedKeyInfo: WrappedKeyInfo): Promise<DerivedKey> {
    if (!this.masterKeyResult) {
      throw new Error('No master key available. Create or restore a master key first.');
    }

    try {
      const purposeConfig = KEY_PURPOSE_CONFIGS[wrappedKeyInfo.purpose];
      
      const unwrappedKey = await crypto.subtle.unwrapKey(
        'raw',
        wrappedKeyInfo.wrappedKey as Uint8Array,
        this.masterKeyResult.masterKey,
        wrappedKeyInfo.wrapAlgorithm,
        getKeyAlgorithmParams(
          wrappedKeyInfo.algorithm,
          this.config.keySize,
          purposeConfig.hashAlgorithm
        ),
        false,
        purposeConfig.usages
      );

      return {
        purpose: wrappedKeyInfo.purpose,
        key: unwrappedKey,
        algorithm: wrappedKeyInfo.algorithm,
        keySize: this.config.keySize,
        derivedAt: new Date(),
        version: this.config.version,
      };
    } catch (error) {
      throw new Error(`Failed to unwrap key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get version information
   */
  getVersionInfo(): KeyVersionInfo {
    return {
      version: this.config.version,
      supportedVersions: [1], // Current supported versions
      migrationPaths: {}, // Migration paths for future use
    };
  }

  /**
   * Clear all cached data
   */
  private clearAllCachedData(): void {
    this.masterKeyResult = null;
    this.derivedKeys.clear();
  }
}

// =============================================================================
// Default Export
// =============================================================================

export default {
  // Salt generation
  generateSalt,
  
  // Master key operations
  deriveMasterKey,
  
  // Multiple key derivation
  deriveMultipleKeys,
  
  // Manager class
  KeyDerivationManager,
};