/**
 * @file Chrome Storage Wrapper
 *
 * Type-safe wrapper around Chrome's storage APIs with error handling,
 * retries, migrations, and serialization support.
 */

import type { StorageArea, StorageSchema, MigrationScript } from '@/types/storage';
import { serialize, deserialize, getCurrentVersion, applyMigrations } from '@/types/storage';
import { DEFAULT_MODEL_ID } from '@/config/models';

// =============================================================================
// Configuration
// =============================================================================

let maxRetries = 3;
const retryDelayMs = 100;

/**
 * Set maximum number of retries for storage operations
 */
export function setMaxRetries(retries: number): void {
  maxRetries = Math.max(0, retries);
}

/**
 * Get current maximum number of retries
 */
export function getMaxRetries(): number {
  return maxRetries;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Retry wrapper for storage operations
 */
async function withRetry<T>(operation: () => Promise<T>, retryCount = 0): Promise<T> {
  try {
    const result = await operation();
    return result;
  } catch (error) {
    if (retryCount >= maxRetries) {
      throw error;
    }

    // Wait before retry
    await new Promise(resolve => setTimeout(resolve, retryDelayMs * (retryCount + 1)));
    return withRetry(operation, retryCount + 1);
  }
}

/**
 * Get storage area API
 */
function getStorageAreaAPI(area: StorageArea = 'local'): chrome.storage.StorageArea {
  return area === 'sync' ? chrome.storage.sync : chrome.storage.local;
}

// =============================================================================
// Basic Storage Operations
// =============================================================================

/**
 * Get a value from storage with type safety
 */
export async function get<T = unknown>(
  key: string,
  area: StorageArea = 'local'
): Promise<T | null> {
  return withRetry(async () => {
    const storageAPI = getStorageAreaAPI(area);
    const result = await storageAPI.get([key]);

    if (!(key in result)) {
      return null;
    }

    const value = result[key];

    // If it's a serialized string, deserialize it
    if (typeof value === 'string') {
      try {
        return deserialize<T>(value);
      } catch {
        // If deserialization fails, return the raw value
        return value as unknown as T;
      }
    }

    return value as T;
  });
}

/**
 * Set a value in storage with serialization
 */
export async function set<T = unknown>(
  key: string,
  value: T,
  area: StorageArea = 'local'
): Promise<void> {
  return withRetry(async () => {
    const storageAPI = getStorageAreaAPI(area);

    // Serialize complex objects
    let serializedValue: unknown = value;
    if (
      value !== null &&
      typeof value === 'object' &&
      !(value instanceof Date) &&
      !Array.isArray(value)
    ) {
      try {
        serializedValue = serialize(value);
      } catch (error) {
        // If serialization fails, use JSON.stringify as fallback
        serializedValue = JSON.stringify(value);
      }
    }

    await storageAPI.set({ [key]: serializedValue });
  });
}

/**
 * Remove a key from storage
 */
export async function remove(key: string, area: StorageArea = 'local'): Promise<void> {
  return withRetry(async () => {
    const storageAPI = getStorageAreaAPI(area);
    await storageAPI.remove([key]);
  });
}

/**
 * Clear all data from storage area
 */
export async function clear(area: StorageArea = 'local'): Promise<void> {
  return withRetry(async () => {
    const storageAPI = getStorageAreaAPI(area);
    await storageAPI.clear();
  });
}

// =============================================================================
// Batch Operations
// =============================================================================

/**
 * Get multiple values from storage
 */
export async function getBatch(
  keys: string[],
  area: StorageArea = 'local'
): Promise<Record<string, unknown>> {
  return withRetry(async () => {
    const storageAPI = getStorageAreaAPI(area);
    const result = await storageAPI.get(keys);

    // Deserialize any serialized values
    const deserializedResult: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(result)) {
      if (typeof value === 'string') {
        try {
          deserializedResult[key] = deserialize(value);
        } catch {
          deserializedResult[key] = value;
        }
      } else {
        deserializedResult[key] = value;
      }
    }

    return deserializedResult;
  });
}

/**
 * Set multiple values in storage
 */
export async function setBatch(
  items: Record<string, unknown>,
  area: StorageArea = 'local'
): Promise<void> {
  return withRetry(async () => {
    const storageAPI = getStorageAreaAPI(area);

    // Serialize complex objects
    const serializedItems: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(items)) {
      if (
        value !== null &&
        typeof value === 'object' &&
        !(value instanceof Date) &&
        !Array.isArray(value)
      ) {
        try {
          serializedItems[key] = serialize(value);
        } catch {
          serializedItems[key] = JSON.stringify(value);
        }
      } else {
        serializedItems[key] = value;
      }
    }

    await storageAPI.set(serializedItems);
  });
}

// =============================================================================
// Storage Listeners
// =============================================================================

/**
 * Listen for storage changes with deserialized values
 */
export function onChanged(
  callback: (
    changes: Record<string, { oldValue?: unknown; newValue?: unknown }>,
    area: string
  ) => void
): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
    const deserializedChanges: Record<string, { oldValue?: unknown; newValue?: unknown }> = {};

    for (const [key, change] of Object.entries(changes)) {
      deserializedChanges[key] = {};

      if (change.oldValue !== undefined) {
        if (typeof change.oldValue === 'string') {
          try {
            deserializedChanges[key].oldValue = deserialize(change.oldValue);
          } catch {
            deserializedChanges[key].oldValue = change.oldValue;
          }
        } else {
          deserializedChanges[key].oldValue = change.oldValue;
        }
      }

      if (change.newValue !== undefined) {
        if (typeof change.newValue === 'string') {
          try {
            deserializedChanges[key].newValue = deserialize(change.newValue);
          } catch {
            deserializedChanges[key].newValue = change.newValue;
          }
        } else {
          deserializedChanges[key].newValue = change.newValue;
        }
      }
    }

    callback(deserializedChanges, 'local');
  };

  // Add listener to local storage changes
  if (chrome.storage.local.onChanged) {
    chrome.storage.local.onChanged.addListener(listener);
  }

  // Return unsubscribe function
  return () => {
    if (chrome.storage.local.onChanged) {
      chrome.storage.local.onChanged.removeListener(listener);
    }
  };
}

// =============================================================================
// Migration System
// =============================================================================

/**
 * Apply migrations to storage data
 */
export async function migrate(migrations: MigrationScript[]): Promise<StorageSchema> {
  return withRetry(async () => {
    // Get current storage schema
    const existingData = await get<StorageSchema>('storage-schema');

    let currentData: unknown;
    let needsDefaultCreation = false;

    if (!existingData) {
      // Create default storage schema
      needsDefaultCreation = true;
      currentData = {
        version: getCurrentVersion(),
        conversations: {},
        settings: {
          version: getCurrentVersion(),
          theme: 'system',
          defaultModel: DEFAULT_MODEL_ID,
          encrypted: false,
          lastModified: Date.now(),
          storageVersion: getCurrentVersion(),
        },
        apiKeys: {},
        cache: {
          entries: {},
          maxSize: 50 * 1024 * 1024, // 50MB
          currentSize: 0,
          cleanupInterval: 3600000, // 1 hour
          storageVersion: getCurrentVersion(),
        },
        migrations: [],
      };
    } else {
      currentData = existingData;
    }

    const currentVersion = (currentData as any).version || 0;

    // Apply migrations if needed
    let migratedData = currentData;
    let needsSaving = needsDefaultCreation;

    if (migrations.length > 0 && currentVersion < Math.max(...migrations.map(m => m.version))) {
      migratedData = await applyMigrations(currentData, migrations);
      needsSaving = true;
    }

    // Save only if data changed
    if (needsSaving) {
      await set('storage-schema', migratedData);
    }

    return migratedData as StorageSchema;
  });
}

// =============================================================================
// Storage Information & Utilities
// =============================================================================

/**
 * Storage quota information
 */
export interface StorageInfo {
  used: number;
  quota: number;
  available: number;
  usagePercentage: number;
}

/**
 * Get storage quota information
 */
export async function getStorageInfo(area: StorageArea = 'local'): Promise<StorageInfo> {
  return withRetry(async () => {
    const storageAPI = getStorageAreaAPI(area);

    let used = 0;
    if (storageAPI.getBytesInUse) {
      used = await storageAPI.getBytesInUse();
    }

    // Get quota from storage API constants
    const quota =
      (storageAPI as chrome.storage.StorageArea & { QUOTA_BYTES?: number }).QUOTA_BYTES || 5242880; // Default 5MB for local

    const available = quota - used;
    const usagePercentage = (used / quota) * 100;

    return {
      used,
      quota,
      available,
      usagePercentage,
    };
  });
}
