/**
 * @file Key Rotation
 *
 * API key rotation functionality
 */

import type { KeyRotationResult, APIKeyMetadata, APIKeyStorage } from '@/types/apiKeys';

import { validateKeyFormat, maskAPIKey, generateKeyId } from '@/types/apiKeys';
import * as chromeStorage from '@/data/storage/chrome';
import { STORAGE_KEYS, DB_STORES } from './constants';
import { getDatabase } from './database';
import type { ServiceState } from './types';
import { requireInitialized, createKeyHash, incrementOperationCount, auditLog } from './utils';
import { getAPIKey, updateAPIKey } from './operations';
import { invalidateCachedKey } from './cache';

/**
 * Rotate an API key with a new key value
 */
export async function rotateAPIKey(
  state: ServiceState,
  id: string,
  newKey: string
): Promise<KeyRotationResult> {
  requireInitialized(state);
  incrementOperationCount(state.metrics, 'rotate');
  const enc = state.encryptionService!;
  const dbInstance = getDatabase();

  // Validate new key format before try/catch so tests see thrown error
  // Fetch provider first to validate against correct rules
  // If key not found, we will throw inside try as before
  let providerForValidation = null;
  try {
    const existingForProvider = await getAPIKey(state, id);
    providerForValidation = existingForProvider?.metadata.provider ?? null;
  } catch {
    // ignore; will be handled in main try
  }
  if (providerForValidation) {
    const validationPre = validateKeyFormat(newKey, providerForValidation);
    if (!validationPre.isValid) {
      throw new Error(`Invalid API key format: ${validationPre.errors.join(', ')}`);
    }
  }

  try {
    // Get existing key
    const existingKey = await getAPIKey(state, id);
    if (!existingKey) {
      throw new Error('API key not found');
    }

    // Generate new key ID and hash
    const newKeyId = generateKeyId(existingKey.metadata.provider);
    const newKeyHash = await createKeyHash(newKey);

    // Encrypt new key
    const newEncryptedData = await enc.encryptData(newKey, 'text');
    const newChecksum = await enc.createIntegrityChecksum(newEncryptedData);

    // Create new key metadata
    const newMetadata: APIKeyMetadata = {
      ...existingKey.metadata,
      id: newKeyId,
      maskedKey: maskAPIKey(newKey),
      lastUsed: Date.now(),
    };

    // Update rotation status
    const rotationStatus = {
      ...existingKey.rotationStatus,
      status: 'completed' as const,
      lastRotation: Date.now(),
      rotationHistory: [
        ...(existingKey.rotationStatus?.rotationHistory || []),
        {
          timestamp: Date.now(),
          success: true,
          reason: 'Manual rotation',
          oldKeyId: id,
          newKeyId: newKeyId,
        },
      ],
    };

    // Create new key object
    const newAPIKey: APIKeyStorage = {
      id: newKeyId,
      metadata: newMetadata,
      encryptedData: newEncryptedData,
      keyHash: newKeyHash,
      checksum: newChecksum,
      storageVersion: existingKey.storageVersion || 1,
      configuration: existingKey.configuration,
      usageStats: existingKey.usageStats || {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalCost: 0,
        avgRequestTime: 0,
        lastResetAt: Date.now(),
        dailyStats: [],
        weeklyStats: [],
        monthlyStats: [],
      },
      rotationStatus,
    };

    // Store new key
    if (dbInstance) {
      await dbInstance.add(DB_STORES.METADATA, newMetadata);
    }
    await chromeStorage.set(`${STORAGE_KEYS.API_KEY}${newKeyId}`, newAPIKey);

    // Store new hash mapping
    await chromeStorage.set(`${STORAGE_KEYS.API_KEY_HASH_PREFIX}${newKeyHash}`, { id: newKeyId });

    // Invalidate old key cache
    invalidateCachedKey(state, id);

    await auditLog('key_rotated', id, {
      newKeyId,
      timestamp: Date.now(),
    });

    return {
      success: true,
      newKeyId,
      rollbackAvailable: true,
    };
  } catch (error) {
    // Update rotation status to failed
    try {
      const existingKey = await getAPIKey(state, id);
      if (existingKey?.rotationStatus) {
        await updateAPIKey(state, id, { status: 'active' });
      }
    } catch {
      // Ignore errors in failure handling
    }

    await auditLog('key_rotation_failed', id, {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      rollbackAvailable: false,
    };
  }
}
