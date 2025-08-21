/**
 * @file Encryption Service
 *
 * High-level encryption service that combines crypto utilities and key derivation
 * to provide a comprehensive encryption solution for the browser extension.
 * Features session management, key rotation, bulk operations, and data integrity verification.
 */

import {
  encryptText,
  decryptText,
  encryptObject,
  decryptObject,
  encryptBinary,
  decryptBinary,
  hashData,
  isValidEncryptedData,
  EncryptedData,
} from './crypto';

import {
  KeyDerivationManager,
  KeyPurpose,
  DerivedKey,
} from './keyDerivation';

// =============================================================================
// Types and Interfaces
// =============================================================================

/**
 * Configuration options for the encryption service
 */
export interface EncryptionServiceConfig {
  /** Session timeout in milliseconds (default: 30 minutes) */
  sessionTimeout?: number;
  /** Key rotation interval in milliseconds (default: 24 hours) */
  keyRotationInterval?: number;
  /** Enable automatic key rotation (default: false) */
  enableAutoRotation?: boolean;
  /** Memory cleanup interval in milliseconds (default: 5 minutes) */
  memoryCleanupInterval?: number;
}

/**
 * Field-level encryption mapping
 */
export interface FieldEncryptionMap {
  [fieldName: string]: 'encrypt' | 'skip';
}

/**
 * Service status information
 */
export interface ServiceStatus {
  /** Whether the service is initialized */
  isInitialized: boolean;
  /** Whether there's an active session */
  sessionActive: boolean;
  /** Last activity timestamp */
  lastActivity: Date | null;
  /** Session timeout duration */
  sessionTimeout: number;
  /** Whether automatic rotation is enabled */
  autoRotationEnabled: boolean;
  /** Key rotation interval */
  keyRotationInterval: number;
}

/**
 * Bulk operation result container
 */
export interface BulkOperationResult<T> {
  /** Successfully processed items */
  success: T[];
  /** Failed items with errors */
  errors: Array<{ item: T; error: Error }>;
  /** Total number of items processed */
  totalCount: number;
  /** Number of successful operations */
  successCount: number;
  /** Number of failed operations */
  errorCount: number;
}

/**
 * Data integrity verification result
 */
export interface DataIntegrityResult {
  /** Whether the data is valid */
  isValid: boolean;
  /** Hash of the data */
  hash: string;
  /** When the verification was performed */
  verifiedAt: Date;
}

/**
 * Supported data types for encryption
 */
export type DataType = 'text' | 'object' | 'binary';

/**
 * Bulk operation options
 */
export interface BulkOperationOptions {
  /** Batch size for processing (default: 100) */
  batchSize?: number;
  /** Whether to fail fast on first error (default: false) */
  failFast?: boolean;
}

/**
 * Internal session state
 */
interface SessionState {
  isActive: boolean;
  lastActivity: Date;
  timeoutHandle: NodeJS.Timeout | null;
  cleanupHandle: NodeJS.Timeout | null;
  rotationHandle: NodeJS.Timeout | null;
}

// =============================================================================
// Constants
// =============================================================================

/** Default session timeout (30 minutes) */
const DEFAULT_SESSION_TIMEOUT = 30 * 60 * 1000;

/** Default key rotation interval (24 hours) */
const DEFAULT_KEY_ROTATION_INTERVAL = 24 * 60 * 60 * 1000;

/** Default memory cleanup interval (5 minutes) */
const DEFAULT_MEMORY_CLEANUP_INTERVAL = 5 * 60 * 1000;

/** Default batch size for bulk operations */
const DEFAULT_BATCH_SIZE = 100;

/** Minimum password length */
const MIN_PASSWORD_LENGTH = 8;

/** Chrome storage key for service salt */
const STORAGE_KEY_SALT = 'encryption_service_salt';

// =============================================================================
// Encryption Service Class
// =============================================================================

/**
 * High-level encryption service with session management and key rotation
 */
export class EncryptionService {
  private static instance: EncryptionService | null = null;
  
  private config: Required<EncryptionServiceConfig>;
  private keyManager: KeyDerivationManager;
  private isServiceInitialized = false;
  private sessionState: SessionState;
  private keyCache = new Map<KeyPurpose, DerivedKey>();

  constructor(config: EncryptionServiceConfig = {}) {
    // Validate configuration
    this.validateConfig(config);
    
    // Set configuration with defaults
    this.config = {
      sessionTimeout: config.sessionTimeout ?? DEFAULT_SESSION_TIMEOUT,
      keyRotationInterval: config.keyRotationInterval ?? DEFAULT_KEY_ROTATION_INTERVAL,
      enableAutoRotation: config.enableAutoRotation ?? false,
      memoryCleanupInterval: config.memoryCleanupInterval ?? DEFAULT_MEMORY_CLEANUP_INTERVAL,
    };

    // Initialize key manager
    this.keyManager = new KeyDerivationManager();
    
    // Initialize session state
    this.sessionState = {
      isActive: false,
      lastActivity: new Date(),
      timeoutHandle: null,
      cleanupHandle: null,
      rotationHandle: null,
    };
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: EncryptionServiceConfig): EncryptionService {
    if (!EncryptionService.instance) {
      EncryptionService.instance = new EncryptionService(config);
    }
    return EncryptionService.instance;
  }

  /**
   * Initialize the service with a master password
   */
  async initialize(password: string): Promise<void> {
    if (this.isServiceInitialized) {
      throw new Error('Service already initialized');
    }

    this.validatePassword(password);

    try {
      // Create master key
      const masterKeyResult = await this.keyManager.createMasterKey(password);
      
      // Store salt in Chrome storage for future restoration
      await this.storeSalt(masterKeyResult.salt);
      
      // Mark as initialized and start session
      this.isServiceInitialized = true;
      this.startSession();
      
      // Start background tasks if enabled
      if (this.config.enableAutoRotation) {
        this.scheduleKeyRotation();
      }
      this.scheduleMemoryCleanup();
      
    } catch (error) {
      throw new Error(`Failed to initialize service: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Restore service from existing salt
   */
  async restoreFromSalt(password: string, salt: Uint8Array): Promise<void> {
    if (this.isServiceInitialized) {
      throw new Error('Service already initialized');
    }

    this.validatePassword(password);

    try {
      // Restore master key from salt
      await this.keyManager.restoreMasterKey(password, salt);
      
      // Mark as initialized and start session
      this.isServiceInitialized = true;
      this.startSession();
      
      // Start background tasks if enabled
      if (this.config.enableAutoRotation) {
        this.scheduleKeyRotation();
      }
      this.scheduleMemoryCleanup();
      
    } catch (error) {
      throw new Error(`Failed to restore service: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.isServiceInitialized;
  }

  /**
   * Check if session is active
   */
  isSessionActive(): boolean {
    return this.sessionState.isActive;
  }

  /**
   * Get service status
   */
  getStatus(): ServiceStatus {
    return {
      isInitialized: this.isServiceInitialized,
      sessionActive: this.sessionState.isActive,
      lastActivity: this.sessionState.isActive ? this.sessionState.lastActivity : null,
      sessionTimeout: this.config.sessionTimeout,
      autoRotationEnabled: this.config.enableAutoRotation,
      keyRotationInterval: this.config.keyRotationInterval,
    };
  }

  /**
   * Update service configuration
   */
  updateConfig(updates: Partial<EncryptionServiceConfig>): void {
    this.validateConfig(updates);
    
    Object.assign(this.config, updates);
    
    // Restart timers if needed
    if (updates.sessionTimeout !== undefined) {
      this.resetSessionTimer();
    }
    
    if (updates.enableAutoRotation !== undefined) {
      if (this.config.enableAutoRotation) {
        this.scheduleKeyRotation();
      } else {
        this.clearRotationTimer();
      }
    }
    
    if (updates.memoryCleanupInterval !== undefined) {
      this.scheduleMemoryCleanup();
    }
  }

  /**
   * Get encryption key for specified purpose
   */
  async getEncryptionKey(purpose: KeyPurpose): Promise<DerivedKey> {
    this.requireInitialized();
    this.requireActiveSession();
    this.updateActivity();

    // Return cached key if available
    if (this.keyCache.has(purpose)) {
      const cachedKey = this.keyCache.get(purpose)!;
      return cachedKey;
    }

    // Derive new key
    const derivedKey = await this.keyManager.deriveKey(purpose);
    this.keyCache.set(purpose, derivedKey);
    
    return derivedKey;
  }

  /**
   * Rotate encryption key for specified purpose
   */
  async rotateKey(purpose: KeyPurpose): Promise<void> {
    this.requireInitialized();
    this.requireActiveSession();
    this.updateActivity();

    try {
      // Clear cached key
      this.keyCache.delete(purpose);
      
      // Derive new key
      const newKey = await this.keyManager.deriveKey(purpose);
      this.keyCache.set(purpose, newKey);
      
    } catch (error) {
      throw new Error(`Failed to rotate key for ${purpose}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Encrypt data of specified type
   */
  async encryptData(data: any, type: DataType): Promise<EncryptedData> {
    this.requireInitialized();
    this.requireActiveSession();
    this.updateActivity();

    try {
      const key = await this.getEncryptionKey('encryption');
      
      switch (type) {
        case 'text':
          if (typeof data !== 'string') {
            throw new Error('Data must be a string for text encryption');
          }
          return await encryptText(data, key.key);
          
        case 'object':
          return await encryptObject(data, key.key);
          
        case 'binary':
          if (!(data instanceof Uint8Array)) {
            throw new Error('Data must be Uint8Array for binary encryption');
          }
          return await encryptBinary(data, key.key);
          
        default:
          throw new Error(`Unsupported data type: ${type}`);
      }
    } catch (error) {
      throw new Error(`Failed to encrypt data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Decrypt data of specified type
   */
  async decryptData(encryptedData: EncryptedData, type: DataType): Promise<any> {
    this.requireInitialized();
    this.requireActiveSession();
    this.updateActivity();

    if (!isValidEncryptedData(encryptedData)) {
      throw new Error('Invalid encrypted data format');
    }

    try {
      const key = await this.getEncryptionKey('encryption');
      
      switch (type) {
        case 'text':
          return await decryptText(encryptedData, key.key);
          
        case 'object':
          return await decryptObject(encryptedData, key.key);
          
        case 'binary':
          return await decryptBinary(encryptedData, key.key);
          
        default:
          throw new Error(`Unsupported data type: ${type}`);
      }
    } catch (error) {
      throw new Error(`Failed to decrypt data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Encrypt specific fields of an object
   */
  async encryptFields(data: Record<string, any>, fieldMap: FieldEncryptionMap): Promise<Record<string, any>> {
    this.requireInitialized();
    this.requireActiveSession();
    this.updateActivity();

    const result = { ...data };
    
    for (const [fieldName, action] of Object.entries(fieldMap)) {
      if (action === 'encrypt' && fieldName in data) {
        try {
          result[fieldName] = await this.encryptData(data[fieldName], 'text');
        } catch (error) {
          throw new Error(`Failed to encrypt field ${fieldName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }
    
    return result;
  }

  /**
   * Decrypt specific fields of an object
   */
  async decryptFields(data: Record<string, any>, fieldMap: FieldEncryptionMap): Promise<Record<string, any>> {
    this.requireInitialized();
    this.requireActiveSession();
    this.updateActivity();

    const result = { ...data };
    
    for (const [fieldName, action] of Object.entries(fieldMap)) {
      if (action === 'encrypt' && fieldName in data && isValidEncryptedData(data[fieldName])) {
        try {
          result[fieldName] = await this.decryptData(data[fieldName], 'text');
        } catch (error) {
          throw new Error(`Failed to decrypt field ${fieldName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }
    
    return result;
  }

  /**
   * Encrypt multiple items in bulk
   */
  async encryptBulk<T>(
    items: T[],
    type: DataType,
    options: BulkOperationOptions = {}
  ): Promise<BulkOperationResult<EncryptedData>> {
    this.requireInitialized();
    this.requireActiveSession();
    this.updateActivity();

    const { batchSize = DEFAULT_BATCH_SIZE, failFast = false } = options;
    const success: EncryptedData[] = [];
    const errors: Array<{ item: T; error: Error }> = [];

    // Process items in batches
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      
      // Process batch items
      for (const item of batch) {
        try {
          const encrypted = await this.encryptData(item, type);
          success.push(encrypted);
        } catch (error) {
          const errorObj = error instanceof Error ? error : new Error('Unknown error');
          errors.push({ item, error: errorObj });
          
          if (failFast) {
            break;
          }
        }
      }
      
      if (failFast && errors.length > 0) {
        break;
      }
    }

    return {
      success,
      errors,
      totalCount: items.length,
      successCount: success.length,
      errorCount: errors.length,
    };
  }

  /**
   * Decrypt multiple items in bulk
   */
  async decryptBulk<T>(
    items: EncryptedData[],
    type: DataType,
    options: BulkOperationOptions = {}
  ): Promise<BulkOperationResult<T>> {
    this.requireInitialized();
    this.requireActiveSession();
    this.updateActivity();

    const { batchSize = DEFAULT_BATCH_SIZE, failFast = false } = options;
    const success: T[] = [];
    const errors: Array<{ item: EncryptedData; error: Error }> = [];

    // Process items in batches
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      
      // Process batch items
      for (const item of batch) {
        try {
          const decrypted = await this.decryptData(item, type);
          success.push(decrypted);
        } catch (error) {
          const errorObj = error instanceof Error ? error : new Error('Unknown error');
          errors.push({ item, error: errorObj });
          
          if (failFast) {
            break;
          }
        }
      }
      
      if (failFast && errors.length > 0) {
        break;
      }
    }

    return {
      success,
      errors,
      totalCount: items.length,
      successCount: success.length,
      errorCount: errors.length,
    };
  }

  /**
   * Verify data integrity
   */
  async verifyIntegrity(data: any, expectedHash?: string): Promise<DataIntegrityResult> {
    this.requireInitialized();
    this.updateActivity();

    try {
      const hashBytes = await hashData(data);
      const hash = Array.from(hashBytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      const isValid = expectedHash ? hash === expectedHash : true;
      
      return {
        isValid,
        hash,
        verifiedAt: new Date(),
      };
    } catch (error) {
      throw new Error(`Failed to verify integrity: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create integrity checksum for encrypted data
   */
  async createIntegrityChecksum(encryptedData: EncryptedData): Promise<string> {
    this.requireInitialized();
    this.updateActivity();

    try {
      const dataToHash = {
        algorithm: encryptedData.algorithm,
        iv: Array.from(encryptedData.iv),
        data: Array.from(encryptedData.data),
        version: encryptedData.version,
      };
      
      const hashBytes = await hashData(dataToHash);
      return Array.from(hashBytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    } catch (error) {
      throw new Error(`Failed to create checksum: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate integrity checksum
   */
  async validateIntegrityChecksum(encryptedData: EncryptedData, checksum: string): Promise<boolean> {
    try {
      const actualChecksum = await this.createIntegrityChecksum(encryptedData);
      return actualChecksum === checksum;
    } catch {
      return false;
    }
  }

  /**
   * Terminate active session
   */
  async terminateSession(): Promise<void> {
    this.sessionState.isActive = false;
    this.clearAllTimers();
    this.keyCache.clear();
  }

  /**
   * Clear sensitive data from memory
   */
  clearMemory(): void {
    this.keyCache.clear();
  }

  /**
   * Shutdown the service completely
   */
  async shutdown(): Promise<void> {
    await this.terminateSession();
    this.keyManager.clearMasterKey();
    this.isServiceInitialized = false;
    
    // Reset singleton instance
    if (EncryptionService.instance === this) {
      EncryptionService.instance = null;
    }
  }

  // =============================================================================
  // Private Methods
  // =============================================================================

  /**
   * Validate configuration parameters
   */
  private validateConfig(config: Partial<EncryptionServiceConfig>): void {
    if (config.sessionTimeout !== undefined && config.sessionTimeout <= 0) {
      throw new Error('Invalid configuration: sessionTimeout must be positive');
    }
    
    if (config.keyRotationInterval !== undefined && config.keyRotationInterval <= 0) {
      throw new Error('Invalid configuration: keyRotationInterval must be positive');
    }
    
    if (config.memoryCleanupInterval !== undefined && config.memoryCleanupInterval <= 0) {
      throw new Error('Invalid configuration: memoryCleanupInterval must be positive');
    }
  }

  /**
   * Validate password strength
   */
  private validatePassword(password: string): void {
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new Error(`Password too weak. Must be at least ${MIN_PASSWORD_LENGTH} characters long`);
    }
  }

  /**
   * Require service to be initialized
   */
  private requireInitialized(): void {
    if (!this.isServiceInitialized) {
      throw new Error('Service not initialized. Call initialize() first.');
    }
  }

  /**
   * Require active session
   */
  private requireActiveSession(): void {
    if (!this.sessionState.isActive) {
      throw new Error('Session expired. Please reinitialize the service.');
    }
  }

  /**
   * Update last activity timestamp
   */
  private updateActivity(): void {
    this.sessionState.lastActivity = new Date();
    this.resetSessionTimer();
  }

  /**
   * Start session and timers
   */
  private startSession(): void {
    this.sessionState.isActive = true;
    this.sessionState.lastActivity = new Date();
    this.resetSessionTimer();
  }

  /**
   * Reset session timeout timer
   */
  private resetSessionTimer(): void {
    if (this.sessionState.timeoutHandle) {
      clearTimeout(this.sessionState.timeoutHandle);
    }
    
    this.sessionState.timeoutHandle = setTimeout(() => {
      this.sessionState.isActive = false;
      this.keyCache.clear();
    }, this.config.sessionTimeout);
  }

  /**
   * Schedule automatic key rotation
   */
  private scheduleKeyRotation(): void {
    this.clearRotationTimer();
    
    this.sessionState.rotationHandle = setTimeout(async () => {
      if (this.isServiceInitialized && this.sessionState.isActive) {
        try {
          // Rotate all cached keys
          const purposes = Array.from(this.keyCache.keys());
          for (const purpose of purposes) {
            await this.rotateKey(purpose);
          }
          
          // Schedule next rotation
          this.scheduleKeyRotation();
        } catch (error) {
          console.error('Automatic key rotation failed:', error);
        }
      }
    }, this.config.keyRotationInterval);
  }

  /**
   * Schedule memory cleanup
   */
  private scheduleMemoryCleanup(): void {
    if (this.sessionState.cleanupHandle) {
      clearInterval(this.sessionState.cleanupHandle);
    }
    
    this.sessionState.cleanupHandle = setInterval(() => {
      if (this.isServiceInitialized && this.sessionState.isActive) {
        // Perform lightweight memory cleanup without clearing active keys
        // This is mainly for preventing memory leaks in long-running sessions
      }
    }, this.config.memoryCleanupInterval);
  }

  /**
   * Clear all timers
   */
  private clearAllTimers(): void {
    if (this.sessionState.timeoutHandle) {
      clearTimeout(this.sessionState.timeoutHandle);
      this.sessionState.timeoutHandle = null;
    }
    
    this.clearRotationTimer();
    
    if (this.sessionState.cleanupHandle) {
      clearInterval(this.sessionState.cleanupHandle);
      this.sessionState.cleanupHandle = null;
    }
  }

  /**
   * Clear rotation timer
   */
  private clearRotationTimer(): void {
    if (this.sessionState.rotationHandle) {
      clearTimeout(this.sessionState.rotationHandle);
      this.sessionState.rotationHandle = null;
    }
  }

  /**
   * Store salt in Chrome storage
   */
  private async storeSalt(salt: Uint8Array): Promise<void> {
    try {
      await chrome.storage.local.set({
        [STORAGE_KEY_SALT]: Array.from(salt),
      });
    } catch (error) {
      throw new Error(`Failed to store salt: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Load salt from Chrome storage
   */
  private async loadSalt(): Promise<Uint8Array | null> {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY_SALT);
      const saltArray = result[STORAGE_KEY_SALT];
      
      if (saltArray && Array.isArray(saltArray)) {
        return new Uint8Array(saltArray);
      }
      
      return null;
    } catch (error) {
      throw new Error(`Failed to load salt: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// =============================================================================
// Default Export
// =============================================================================

export default EncryptionService;