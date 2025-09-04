/**
 * @file Chrome Storage Wrapper
 *
 * Type-safe wrapper around Chrome's storage APIs with error handling,
 * retries, migrations, and serialization support.
 */

import type { StorageArea, StorageSchema, MigrationScript } from '@/types/storage';
import { serialize, deserialize, getCurrentVersion, applyMigrations } from '@/types/storage';
import * as ChromeStorage from '@platform/chrome/storage';
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

// (Deprecated) Direct chrome.storage usage removed in favor of @platform/chrome/storage

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
    const value = await ChromeStorage.get<unknown>(key, area);

    // If it's a serialized string, deserialize it
    if (typeof value === 'string') {
      try {
        return deserialize<T>(value);
      } catch {
        // If deserialization fails, return the raw value
        return value as unknown as T;
      }
    }

    return (value as T) ?? null;
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

    await ChromeStorage.set(key, serializedValue, area);
  });
}

/**
 * Remove a key from storage
 */
export async function remove(key: string, area: StorageArea = 'local'): Promise<void> {
  return withRetry(async () => {
    await ChromeStorage.remove(key, area);
  });
}

/**
 * Clear all data from storage area
 */
export async function clear(area: StorageArea = 'local'): Promise<void> {
  return withRetry(async () => {
    await ChromeStorage.clear(area);
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
    const result = (await ChromeStorage.getMultiple<Record<string, unknown>>(keys, area)) as Record<
      string,
      unknown
    >;

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

    await ChromeStorage.setMultiple(serializedItems as Record<string, unknown>, area);
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
  // Delegate to platform listener and deserialize string values
  return ChromeStorage.addStorageListener<Record<string, unknown>>((changes, areaName) => {
    const deserializedChanges: Record<string, { oldValue?: unknown; newValue?: unknown }> = {};
    for (const [key, change] of Object.entries(changes)) {
      if (!change) continue;
      const entry: { oldValue?: unknown; newValue?: unknown } = {};
      if (change.oldValue !== undefined) {
        entry.oldValue =
          typeof change.oldValue === 'string'
            ? (() => {
                try {
                  return deserialize(change.oldValue as string);
                } catch {
                  return change.oldValue;
                }
              })()
            : change.oldValue;
      }
      if (change.newValue !== undefined) {
        entry.newValue =
          typeof change.newValue === 'string'
            ? (() => {
                try {
                  return deserialize(change.newValue as string);
                } catch {
                  return change.newValue;
                }
              })()
            : change.newValue;
      }
      deserializedChanges[key] = entry;
    }
    callback(deserializedChanges, areaName);
  });
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

    const currentVersion = (currentData as StorageSchema).version || 0;

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
    const q = await ChromeStorage.getStorageQuota(area);
    return {
      used: q.used,
      quota: q.quota,
      available: q.available,
      usagePercentage: q.usagePercent,
    };
  });
}
