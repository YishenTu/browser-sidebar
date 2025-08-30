/**
 * @file Import/Export Operations
 *
 * Functions for importing and exporting API keys
 */

import type { ImportResult, EncryptedAPIKey, APIKeyMetadata } from '@/types/apiKeys';
import * as chromeStorage from '@/data/storage/chrome';
import { STORAGE_KEYS, DB_STORES } from './constants';
import { getDatabase } from './database';
import type { ServiceState } from './types';
import { requireInitialized, auditLog } from './utils';

/**
 * Export API keys with optional secret inclusion
 */
export async function exportKeys(
  state: ServiceState,
  includeSecrets: boolean = false
): Promise<Record<string, unknown>> {
  requireInitialized(state);
  const dbInstance = getDatabase();

  try {
    // Get all metadata
    const allMetadata = dbInstance ? await dbInstance.getAll(DB_STORES.METADATA) : [];

    // Get encrypted data if secrets are requested
    const keys = [];

    if (includeSecrets) {
      // Get all encrypted keys
      const encryptedKeys = await chromeStorage.getBatch(
        allMetadata.map(meta => `${STORAGE_KEYS.API_KEY}${(meta as any).id}`)
      );

      for (const metadata of allMetadata) {
        const encryptedKey =
          encryptedKeys[`${STORAGE_KEYS.API_KEY}${(metadata as APIKeyMetadata).id}`];
        if (encryptedKey) {
          keys.push(encryptedKey);
        }
      }
    } else {
      // Export metadata only
      for (const metadata of allMetadata) {
        keys.push({
          metadata,
          // Don't include encrypted data
          storageVersion: 1,
        });
      }
    }

    return {
      version: 1,
      timestamp: Date.now(),
      keys,
      includeSecrets,
    };
  } catch (error) {
    throw new Error(
      `Failed to export keys: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Import API keys from backup data
 */
export async function importKeys(
  state: ServiceState,
  data: Record<string, unknown>
): Promise<ImportResult> {
  requireInitialized(state);
  const dbInstance = getDatabase();

  const result: ImportResult = {
    success: 0,
    failed: 0,
    errors: [],
  };

  try {
    const keys = (data['keys'] as EncryptedAPIKey[]) || [];

    for (const keyData of keys) {
      try {
        if (keyData.metadata) {
          // Add metadata to IndexedDB
          if (dbInstance) {
            await dbInstance.add(DB_STORES.METADATA, keyData.metadata);
          }

          // Add encrypted data to Chrome storage if present
          if (keyData.encryptedData) {
            await chromeStorage.set(`${STORAGE_KEYS.API_KEY}${keyData.metadata.id}`, keyData);
            // Maintain hash → id mapping if keyHash present
            if (keyData.keyHash && typeof keyData.keyHash === 'string') {
              await chromeStorage.set(`${STORAGE_KEYS.API_KEY_HASH_PREFIX}${keyData.keyHash}`, {
                id: keyData.metadata.id,
              });
            }
          }

          result.success++;
        }
      } catch (error) {
        result.failed++;
        result.errors.push({
          key: keyData.metadata?.id || 'unknown',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    await auditLog('keys_imported', 'system', {
      success: result.success,
      failed: result.failed,
      timestamp: Date.now(),
    });

    return result;
  } catch (error) {
    throw new Error(
      `Failed to import keys: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
