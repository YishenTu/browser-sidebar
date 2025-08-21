/**
 * @file Crypto Utilities
 *
 * Secure Web Crypto API wrapper for browser extension encryption needs.
 * Provides AES-256-GCM encryption, key generation, and utility functions
 * with comprehensive error handling and type safety.
 */

// =============================================================================
// Types and Interfaces
// =============================================================================

/**
 * Supported encryption algorithms
 */
export type Algorithm = 'AES-256-GCM' | 'AES-192-GCM' | 'AES-128-GCM' | 'AES-256-CBC' | 'AES-GCM' | 'AES-CBC';

/**
 * Supported hash algorithms
 */
export type HashAlgorithm = 'SHA-256' | 'SHA-384' | 'SHA-512' | 'SHA-1';

/**
 * Encrypted data container with metadata
 */
export interface EncryptedData {
  /** Encryption algorithm used */
  algorithm: Algorithm;
  /** Initialization Vector (IV) for encryption */
  iv: Uint8Array;
  /** Encrypted data */
  data: Uint8Array;
  /** Format version for future compatibility */
  version: number;
}

/**
 * Re-export CryptoKey type for convenience
 */
export type CryptoKey = globalThis.CryptoKey;

/**
 * Options for encryption/decryption operations
 */
export interface CryptoOptions {
  /** Custom initialization vector (will generate random if not provided) */
  iv?: Uint8Array;
  /** Algorithm to use (defaults to AES-GCM) */
  algorithm?: string;
}

/**
 * Options for key generation
 */
export interface KeyGenerationOptions {
  /** Key size in bits (defaults to 256) */
  keySize?: 128 | 192 | 256;
  /** Whether key should be extractable (defaults to false for security) */
  extractable?: boolean;
  /** Algorithm name (defaults to AES-GCM) */
  algorithm?: string;
}

/**
 * Options for key derivation
 */
export interface KeyDerivationOptions {
  /** Salt for key derivation (will generate random if not provided) */
  salt?: Uint8Array;
  /** Number of iterations (defaults to 100000) */
  iterations?: number;
  /** Hash algorithm (defaults to SHA-256) */
  algorithm?: string;
  /** Key size in bits (defaults to 256) */
  keySize?: 128 | 192 | 256;
}

/**
 * Key derivation result
 */
export interface KeyDerivationResult {
  /** Derived key */
  key: CryptoKey;
  /** Salt used for derivation */
  salt: Uint8Array;
}

// =============================================================================
// Constants
// =============================================================================

/** Current format version */
const CURRENT_VERSION = 1;

/** Default key size in bits */
const DEFAULT_KEY_SIZE = 256;

/** Default PBKDF2 iterations */
const DEFAULT_ITERATIONS = 100000;

/** Minimum password length for key derivation */
const MIN_PASSWORD_LENGTH = 8;

/** Default IV size for AES-GCM (12 bytes recommended) */
const AES_GCM_IV_SIZE = 12;

/** Default IV size for AES-CBC (16 bytes required) */
const AES_CBC_IV_SIZE = 16;

/** Default salt size for PBKDF2 */
const DEFAULT_SALT_SIZE = 32;

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
 * Get algorithm parameters for SubtleCrypto operations
 */
function getAlgorithmParams(algorithm: string, iv?: Uint8Array): AesGcmParams | AesCbcParams {
  const name = algorithm.includes('GCM') ? 'AES-GCM' : 'AES-CBC';
  
  if (name === 'AES-GCM') {
    return {
      name,
      iv: iv || secureRandom(AES_GCM_IV_SIZE),
    };
  } else {
    return {
      name,
      iv: iv || secureRandom(AES_CBC_IV_SIZE),
    };
  }
}

/**
 * Get key generation parameters
 */
function getKeyGenParams(algorithm: string, keySize: number): AesKeyGenParams {
  const name = algorithm.includes('GCM') ? 'AES-GCM' : 'AES-CBC';
  return {
    name,
    length: keySize,
  };
}

/**
 * Get algorithm name from full algorithm string
 */
function getAlgorithmName(algorithm: Algorithm): string {
  if (algorithm.includes('GCM')) return 'AES-GCM';
  if (algorithm.includes('CBC')) return 'AES-CBC';
  return algorithm;
}

/**
 * Get IV size for algorithm
 */
function getIvSize(algorithm: string): number {
  return algorithm.includes('GCM') ? AES_GCM_IV_SIZE : AES_CBC_IV_SIZE;
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
 * Robust Uint8Array check that works across different contexts
 */
function isUint8Array(value: unknown): value is Uint8Array {
  return (
    value instanceof Uint8Array ||
    (value && 
     typeof value === 'object' && 
     value.constructor === Uint8Array) ||
    (value &&
     typeof value === 'object' &&
     value.constructor &&
     value.constructor.name === 'Uint8Array')
  );
}

// =============================================================================
// Core Crypto Functions
// =============================================================================

/**
 * Generate a new AES encryption key
 */
export async function generateKey(options: KeyGenerationOptions = {}): Promise<CryptoKey> {
  checkCryptoSupport();
  
  const {
    keySize = DEFAULT_KEY_SIZE,
    extractable = false,
    algorithm = 'AES-GCM',
  } = options;

  try {
    const keyGenParams = getKeyGenParams(algorithm, keySize);
    
    const key = await crypto.subtle.generateKey(
      keyGenParams,
      extractable,
      ['encrypt', 'decrypt']
    );

    return key;
  } catch (error) {
    throw new Error(`Failed to generate encryption key: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Derive a key from password using PBKDF2
 */
export async function deriveKey(
  password: string,
  salt?: Uint8Array,
  options: KeyDerivationOptions = {}
): Promise<KeyDerivationResult> {
  checkCryptoSupport();
  validatePassword(password);

  const {
    iterations = DEFAULT_ITERATIONS,
    algorithm = 'SHA-256',
    keySize = DEFAULT_KEY_SIZE,
  } = options;

  const actualSalt = salt || secureRandom(DEFAULT_SALT_SIZE);

  try {
    // Import password as key material
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    // Derive the actual encryption key
    const derivedKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: actualSalt,
        iterations,
        hash: algorithm,
      },
      passwordKey,
      {
        name: 'AES-GCM',
        length: keySize,
      },
      false,
      ['encrypt', 'decrypt']
    );

    return {
      key: derivedKey,
      salt: actualSalt,
    };
  } catch (error) {
    throw new Error(`Failed to derive key: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Encrypt data using AES-256-GCM
 */
export async function encrypt(
  data: Uint8Array,
  key: CryptoKey,
  options: CryptoOptions = {}
): Promise<EncryptedData> {
  checkCryptoSupport();

  const { algorithm = 'AES-GCM' } = options;
  const algorithmName = getAlgorithmName(algorithm as Algorithm);
  const iv = options.iv || secureRandom(getIvSize(algorithmName));

  try {
    const algorithmParams = getAlgorithmParams(algorithmName, iv);
    
    const encryptedData = await crypto.subtle.encrypt(
      algorithmParams,
      key,
      data
    );

    // Format algorithm name for display (e.g., 'AES-256-GCM')
    const displayAlgorithm = algorithmName === 'AES-GCM' ? 'AES-256-GCM' : 
                            algorithmName === 'AES-CBC' ? 'AES-256-CBC' : 
                            algorithmName + '-256';

    return {
      algorithm: displayAlgorithm as Algorithm,
      iv,
      data: new Uint8Array(encryptedData),
      version: CURRENT_VERSION,
    };
  } catch (error) {
    throw new Error(`Failed to encrypt data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Decrypt data using AES-256-GCM
 */
export async function decrypt(
  encryptedData: EncryptedData,
  key: CryptoKey
): Promise<Uint8Array> {
  checkCryptoSupport();

  if (!isValidEncryptedData(encryptedData)) {
    throw new Error('Invalid encrypted data format');
  }

  try {
    const algorithmName = getAlgorithmName(encryptedData.algorithm);
    const algorithmParams = getAlgorithmParams(algorithmName, encryptedData.iv);

    const decryptedData = await crypto.subtle.decrypt(
      algorithmParams,
      key,
      encryptedData.data
    );

    return new Uint8Array(decryptedData);
  } catch (error) {
    throw new Error(`Failed to decrypt data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// =============================================================================
// Text Encryption/Decryption
// =============================================================================

/**
 * Encrypt text data
 */
export async function encryptText(
  text: string,
  key: CryptoKey,
  options: CryptoOptions = {}
): Promise<EncryptedData> {
  const textData = new TextEncoder().encode(text);
  return encrypt(textData, key, options);
}

/**
 * Decrypt text data
 */
export async function decryptText(
  encryptedData: EncryptedData,
  key: CryptoKey
): Promise<string> {
  const decryptedData = await decrypt(encryptedData, key);
  return new TextDecoder().decode(decryptedData);
}

// =============================================================================
// Object Encryption/Decryption
// =============================================================================

/**
 * Encrypt JSON-serializable objects
 */
export async function encryptObject<T = any>(
  obj: T,
  key: CryptoKey,
  options: CryptoOptions = {}
): Promise<EncryptedData> {
  try {
    const jsonString = JSON.stringify(obj);
    return encryptText(jsonString, key, options);
  } catch (error) {
    throw new Error(`Failed to serialize object for encryption: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Decrypt and parse JSON objects
 */
export async function decryptObject<T = any>(
  encryptedData: EncryptedData,
  key: CryptoKey
): Promise<T> {
  const jsonString = await decryptText(encryptedData, key);
  
  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    throw new Error(`Failed to parse decrypted object: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// =============================================================================
// Binary Data Encryption/Decryption
// =============================================================================

/**
 * Encrypt binary data
 */
export async function encryptBinary(
  binaryData: Uint8Array,
  key: CryptoKey,
  options: CryptoOptions = {}
): Promise<EncryptedData> {
  return encrypt(binaryData, key, options);
}

/**
 * Decrypt binary data
 */
export async function decryptBinary(
  encryptedData: EncryptedData,
  key: CryptoKey
): Promise<Uint8Array> {
  return decrypt(encryptedData, key);
}

// =============================================================================
// Hashing Utilities
// =============================================================================

/**
 * Hash data using specified algorithm
 */
export async function hashData(
  data: string | Uint8Array | object,
  algorithm: HashAlgorithm = 'SHA-256'
): Promise<Uint8Array> {
  checkCryptoSupport();

  try {
    let inputData: Uint8Array;

    if (typeof data === 'string') {
      inputData = new TextEncoder().encode(data);
    } else if (data instanceof Uint8Array) {
      inputData = data;
    } else {
      // Serialize objects to JSON
      inputData = new TextEncoder().encode(JSON.stringify(data));
    }

    const hashBuffer = await crypto.subtle.digest(algorithm, inputData);
    return new Uint8Array(hashBuffer);
  } catch (error) {
    throw new Error(`Failed to hash data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// =============================================================================
// Random Utilities
// =============================================================================

/**
 * Generate cryptographically secure random bytes
 */
export function secureRandom(size: number = 32): Uint8Array {
  checkCryptoSupport();
  
  const randomBytes = new Uint8Array(size);
  return crypto.getRandomValues(randomBytes);
}

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Validate encrypted data format
 */
export function isValidEncryptedData(data: unknown): data is EncryptedData {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const obj = data as any;

  // Check required properties
  if (
    typeof obj.algorithm !== 'string' ||
    !isUint8Array(obj.iv) ||
    !isUint8Array(obj.data) ||
    typeof obj.version !== 'number'
  ) {
    return false;
  }

  // Validate algorithm format (should contain GCM or CBC)
  if (!obj.algorithm.includes('GCM') && !obj.algorithm.includes('CBC')) {
    return false;
  }

  // Validate IV length for known algorithms  
  if (obj.algorithm.includes('GCM') && obj.iv.length !== AES_GCM_IV_SIZE) {
    return false;
  }
  
  if (obj.algorithm.includes('CBC') && obj.iv.length !== AES_CBC_IV_SIZE) {
    return false;
  }

  return true;
}

// =============================================================================
// Default Export
// =============================================================================

export default {
  // Key management
  generateKey,
  deriveKey,
  
  // Core encryption/decryption
  encrypt,
  decrypt,
  
  // Text utilities
  encryptText,
  decryptText,
  
  // Object utilities
  encryptObject,
  decryptObject,
  
  // Binary utilities
  encryptBinary,
  decryptBinary,
  
  // Hashing
  hashData,
  
  // Random utilities
  secureRandom,
  
  // Validation
  isValidEncryptedData,
};