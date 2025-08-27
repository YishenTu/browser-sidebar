/**
 * @file Utility Functions
 *
 * Helper utilities for API key storage operations
 */

import { hashData } from '@/data/security/crypto';
import * as chromeStorage from '@/data/storage/chrome';
import { STORAGE_KEYS, DB_STORES } from './constants';
import { getDatabase } from './database';
import type { ServiceState, ServiceMetrics } from './types';

/**
 * Require service to be initialized
 */
export function requireInitialized(state: ServiceState): void {
  const enc = state.encryptionService;

  // Check if encryption service is initialized
  if (!enc || !enc.isInitialized) {
    throw new Error('API key storage not initialized. Call initializeStorage() first.');
  }

  // Check if storage service is initialized
  if (!state.isInitialized) {
    throw new Error('API key storage not initialized. Call initializeStorage() first.');
  }

  // Check if session is active
  if (!enc.isSessionActive) {
    throw new Error('Session expired. Please reinitialize the service.');
  }
}

/**
 * Create hash of API key for duplicate detection
 */
export async function createKeyHash(key: string): Promise<string> {
  const hashBytes = await hashData(key);
  return Array.from(hashBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Find existing key by hash
 */
export async function findKeyByHash(keyHash: string): Promise<string | null> {
  try {
    // Get all keys from storage
    const keys = await chromeStorage.getBatch([]);

    if (keys && typeof keys === 'object') {
      // Real implementation - scan all keys
      for (const [storageKey, keyData] of Object.entries(keys)) {
        if (
          storageKey.startsWith(STORAGE_KEYS.API_KEY) &&
          keyData &&
          typeof keyData === 'object' &&
          'keyHash' in keyData &&
          keyData.keyHash === keyHash
        ) {
          return (keyData as { id: string }).id;
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Update last used timestamp for a key
 */
export async function updateLastUsed(id: string): Promise<void> {
  try {
    const dbInstance = getDatabase();
    if (dbInstance) {
      await dbInstance.update(DB_STORES.METADATA, {
        id,
        lastUsed: Date.now(),
      } as APIKeyMetadata);
    }
  } catch {
    // Ignore errors in last used updates
  }
}

/**
 * Update service metrics
 */
export async function updateMetrics(metrics: ServiceMetrics): Promise<void> {
  try {
    const dbInstance = getDatabase();
    if (dbInstance) {
      const allKeys = await dbInstance.getAll(DB_STORES.METADATA);
      metrics.totalKeys = allKeys.length;
    }
  } catch {
    // Ignore metrics errors
  }
}

/**
 * Increment operation count for metrics
 */
export function incrementOperationCount(metrics: ServiceMetrics, operation: string): void {
  metrics.operationCounts[operation] = (metrics.operationCounts[operation] || 0) + 1;
}

/**
 * Log audit event
 */
export async function auditLog(
  event: string,
  keyId: string,
  details: Record<string, unknown>
): Promise<void> {
  try {
    const auditEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      event,
      keyId,
      timestamp: Date.now(),
      details,
    };

    const dbInstance = getDatabase();
    if (dbInstance) {
      await dbInstance.add(DB_STORES.AUDIT_LOG, auditEntry);
    }
  } catch {
    // Don't fail operations due to audit logging errors
  }
}

/**
 * Perform data migrations from older versions
 */
export async function performMigrations(encryptionService: EncryptionService): Promise<void> {
  try {
    const migrationStatus = await chromeStorage.get(STORAGE_KEYS.MIGRATION_STATUS);

    if (!migrationStatus || (migrationStatus as { version: number }).version < 1) {
      // Perform migration from unencrypted storage
      const legacyKeys = await chromeStorage.getBatch([]);

      for (const [key, value] of Object.entries(legacyKeys)) {
        if (
          key.startsWith('api_key_') &&
          value &&
          typeof value === 'object' &&
          'key' in value &&
          typeof value.key === 'string' &&
          !('encryptedData' in value)
        ) {
          // This is legacy unencrypted data
          const legacyKey = value as { key: string; provider?: string; metadata?: unknown };

          try {
            // Encrypt the key
            const encryptedData = await encryptionService.encryptData(legacyKey.key, 'text');

            // Create new format
            const migratedKey = {
              ...legacyKey,
              encryptedData,
              keyHash: await createKeyHash(legacyKey.key),
              checksum: await encryptionService.createIntegrityChecksum(encryptedData),
              storageVersion: 1,
            };

            // Remove the raw key
            delete migratedKey.key;

            // Update storage
            await chromeStorage.set(key, migratedKey);
            // Maintain hash → id mapping if id present on legacy entry
            if (migratedKey.keyHash && legacyKey.id) {
              await chromeStorage.set(`${STORAGE_KEYS.API_KEY_HASH_PREFIX}${migratedKey.keyHash}`, {
                id: legacyKey.id,
              });
            }
          } catch (error) {
            console.warn(`Failed to migrate key ${key}:`, error);
          }
        }
      }

      // Mark migration as complete
      await chromeStorage.set(STORAGE_KEYS.MIGRATION_STATUS, {
        version: 1,
        migratedAt: Date.now(),
      });
    }
  } catch (error) {
    console.warn('Migration failed:', error);
    // Don't fail initialization due to migration errors
  }
}
