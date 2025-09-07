/**
 * @file Chrome Storage Platform Wrapper
 *
 * Strongly typed wrapper around Chrome's storage APIs providing type-safe
 * operations, batch processing, error handling, and storage change listeners.
 *
 * This wrapper provides a clean abstraction over chrome.storage.local and
 * chrome.storage.sync APIs with full TypeScript type safety, quota management,
 * and graceful error handling.
 */

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Chrome storage areas
 */
export type ChromeStorageArea = 'local' | 'sync' | 'session';

/**
 * Storage change event data
 */
export interface StorageChange<T = unknown> {
  oldValue?: T;
  newValue?: T;
}

/**
 * Storage changes record
 */
export type StorageChanges<T extends Record<string, unknown> = Record<string, unknown>> = {
  [K in keyof T]?: StorageChange<T[K]>;
};

/**
 * Storage listener callback
 */
export type StorageListener<T extends Record<string, unknown> = Record<string, unknown>> = (
  changes: StorageChanges<T>,
  areaName: ChromeStorageArea
) => void;

/**
 * Storage quota information
 */
export interface StorageQuota {
  /** Used bytes */
  used: number;
  /** Total quota in bytes */
  quota: number;
  /** Available bytes */
  available: number;
  /** Usage as percentage (0-100) */
  usagePercent: number;
}

/**
 * Batch operation result
 */
export interface BatchResult<T extends Record<string, unknown>> {
  /** Successfully processed items */
  success: Partial<T>;
  /** Failed items with error messages */
  errors: Partial<Record<keyof T, string>>;
  /** Whether all operations succeeded */
  allSucceeded: boolean;
}

// =============================================================================
// Error Handling
// =============================================================================

/**
 * Chrome storage error types
 */
export class ChromeStorageError extends Error {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly area: ChromeStorageArea,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'ChromeStorageError';
  }
}

/**
 * Storage quota exceeded error
 */
export class StorageQuotaError extends ChromeStorageError {
  constructor(area: ChromeStorageArea, cause?: Error) {
    super(`Storage quota exceeded for ${area}`, 'quota_check', area, cause);
    this.name = 'StorageQuotaError';
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get Chrome storage area API
 */
function getStorageAPI(area: ChromeStorageArea): chrome.storage.StorageArea {
  if (area === 'sync') return chrome.storage.sync;
  if (area === 'session') return chrome.storage.session as unknown as chrome.storage.StorageArea;
  return chrome.storage.local;
}

/**
 * Handle Chrome runtime errors
 */
function handleChromeError(operation: string, area: ChromeStorageArea): void {
  if (chrome.runtime.lastError) {
    const error = chrome.runtime.lastError;
    if (error.message?.includes('QUOTA_BYTES')) {
      throw new StorageQuotaError(area, new Error(error.message));
    }
    throw new ChromeStorageError(error.message || 'Unknown Chrome error', operation, area);
  }
}

/**
 * Wrap Chrome storage operation with error handling
 */
async function wrapStorageOperation<T>(
  operation: string,
  area: ChromeStorageArea,
  callback: () => Promise<T>
): Promise<T> {
  try {
    const result = await callback();
    handleChromeError(operation, area);
    return result;
  } catch (error) {
    if (error instanceof ChromeStorageError) {
      throw error;
    }
    throw new ChromeStorageError(
      `Failed to ${operation}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      operation,
      area,
      error instanceof Error ? error : undefined
    );
  }
}

// =============================================================================
// Core Storage Operations
// =============================================================================

/**
 * Get a single value from storage with type safety
 */
export async function get<T = unknown>(
  key: string,
  area: ChromeStorageArea = 'local'
): Promise<T | null> {
  return wrapStorageOperation(`get key '${key}'`, area, async () => {
    const storageAPI = getStorageAPI(area);

    return new Promise<T | null>((resolve, reject) => {
      storageAPI.get([key], result => {
        try {
          handleChromeError(`get key '${key}'`, area);

          if (key in result) {
            resolve(result[key] as T);
          } else {
            resolve(null);
          }
        } catch (error) {
          reject(error);
        }
      });
    });
  });
}

/**
 * Get multiple values from storage with type safety
 */
export async function getMultiple<T extends Record<string, unknown>>(
  keys: (keyof T)[],
  area: ChromeStorageArea = 'local'
): Promise<Partial<T>> {
  return wrapStorageOperation(`get keys [${keys.join(', ')}]`, area, async () => {
    const storageAPI = getStorageAPI(area);
    const keyStrings = keys.map(k => String(k));

    return new Promise<Partial<T>>((resolve, reject) => {
      storageAPI.get(keyStrings, result => {
        try {
          handleChromeError(`get keys [${keys.join(', ')}]`, area);
          resolve(result as Partial<T>);
        } catch (error) {
          reject(error);
        }
      });
    });
  });
}

/**
 * Get all storage contents with type safety
 */
export async function getAll<T extends Record<string, unknown>>(
  area: ChromeStorageArea = 'local'
): Promise<T> {
  return wrapStorageOperation('get all', area, async () => {
    const storageAPI = getStorageAPI(area);

    return new Promise<T>((resolve, reject) => {
      storageAPI.get(null, result => {
        try {
          handleChromeError('get all', area);
          resolve(result as T);
        } catch (error) {
          reject(error);
        }
      });
    });
  });
}

/**
 * Set a single value in storage with type safety
 */
export async function set<T>(
  key: string,
  value: T,
  area: ChromeStorageArea = 'local'
): Promise<void> {
  return wrapStorageOperation(`set key '${key}'`, area, async () => {
    const storageAPI = getStorageAPI(area);

    return new Promise<void>((resolve, reject) => {
      storageAPI.set({ [key]: value }, () => {
        try {
          handleChromeError(`set key '${key}'`, area);
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  });
}

/**
 * Set multiple values in storage with type safety
 */
export async function setMultiple<T extends Record<string, unknown>>(
  items: T,
  area: ChromeStorageArea = 'local'
): Promise<void> {
  const keys = Object.keys(items);
  return wrapStorageOperation(`set keys [${keys.join(', ')}]`, area, async () => {
    const storageAPI = getStorageAPI(area);

    return new Promise<void>((resolve, reject) => {
      storageAPI.set(items, () => {
        try {
          handleChromeError(`set keys [${keys.join(', ')}]`, area);
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  });
}

/**
 * Remove a single key from storage
 */
export async function remove(key: string, area: ChromeStorageArea = 'local'): Promise<void> {
  return wrapStorageOperation(`remove key '${key}'`, area, async () => {
    const storageAPI = getStorageAPI(area);

    return new Promise<void>((resolve, reject) => {
      storageAPI.remove([key], () => {
        try {
          handleChromeError(`remove key '${key}'`, area);
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  });
}

/**
 * Remove multiple keys from storage
 */
export async function removeMultiple(
  keys: string[],
  area: ChromeStorageArea = 'local'
): Promise<void> {
  return wrapStorageOperation(`remove keys [${keys.join(', ')}]`, area, async () => {
    const storageAPI = getStorageAPI(area);

    return new Promise<void>((resolve, reject) => {
      storageAPI.remove(keys, () => {
        try {
          handleChromeError(`remove keys [${keys.join(', ')}]`, area);
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  });
}

/**
 * Clear all data from storage area
 */
export async function clear(area: ChromeStorageArea = 'local'): Promise<void> {
  return wrapStorageOperation('clear all', area, async () => {
    const storageAPI = getStorageAPI(area);

    return new Promise<void>((resolve, reject) => {
      storageAPI.clear(() => {
        try {
          handleChromeError('clear all', area);
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  });
}

// =============================================================================
// Batch Operations
// =============================================================================

/**
 * Perform batch get operations with partial failure handling
 */
export async function batchGet<T extends Record<string, unknown>>(
  keys: (keyof T)[],
  area: ChromeStorageArea = 'local'
): Promise<BatchResult<T>> {
  const result: BatchResult<T> = {
    success: {},
    errors: {},
    allSucceeded: true,
  };

  try {
    const values = await getMultiple<T>(keys, area);

    for (const key of keys) {
      if (key in values) {
        result.success[key] = values[key];
      } else {
        result.errors[key] = 'Key not found';
        result.allSucceeded = false;
      }
    }
  } catch (error) {
    // If the entire operation fails, mark all keys as failed
    for (const key of keys) {
      result.errors[key] = error instanceof Error ? error.message : 'Unknown error';
    }
    result.allSucceeded = false;
  }

  return result;
}

/**
 * Perform batch set operations with partial failure handling
 */
export async function batchSet<T extends Record<string, unknown>>(
  items: T,
  area: ChromeStorageArea = 'local'
): Promise<BatchResult<T>> {
  const result: BatchResult<T> = {
    success: {},
    errors: {},
    allSucceeded: true,
  };

  // Try to set all items at once first
  try {
    await setMultiple(items, area);
    result.success = { ...items };
    return result;
  } catch (error) {
    // If batch operation fails, try individual operations
    result.allSucceeded = false;

    for (const [key, value] of Object.entries(items)) {
      try {
        await set(key, value, area);
        (result.success as Record<string, unknown>)[key] = value;
      } catch (individualError) {
        (result.errors as Record<string, string>)[key] =
          individualError instanceof Error ? individualError.message : 'Unknown error';
      }
    }
  }

  return result;
}

/**
 * Perform batch remove operations with partial failure handling
 */
export async function batchRemove(
  keys: string[],
  area: ChromeStorageArea = 'local'
): Promise<BatchResult<Record<string, boolean>>> {
  const result: BatchResult<Record<string, boolean>> = {
    success: {},
    errors: {},
    allSucceeded: true,
  };

  try {
    await removeMultiple(keys, area);

    for (const key of keys) {
      result.success[key] = true;
    }
  } catch (error) {
    // If batch operation fails, try individual operations
    result.allSucceeded = false;

    for (const key of keys) {
      try {
        await remove(key, area);
        result.success[key] = true;
      } catch (individualError) {
        result.errors[key] =
          individualError instanceof Error ? individualError.message : 'Unknown error';
      }
    }
  }

  return result;
}

// =============================================================================
// Storage Information & Quota Management
// =============================================================================

/**
 * Get storage quota information
 */
export async function getStorageQuota(area: ChromeStorageArea = 'local'): Promise<StorageQuota> {
  return wrapStorageOperation('get quota info', area, async () => {
    const storageAPI = getStorageAPI(area);

    return new Promise<StorageQuota>((resolve, reject) => {
      // Get bytes in use
      if (storageAPI.getBytesInUse) {
        storageAPI.getBytesInUse(null, used => {
          try {
            handleChromeError('get bytes in use', area);

            // Get quota from storage constants
            const quota = (() => {
              if (area === 'sync') return chrome.storage.sync.QUOTA_BYTES || 102400;
              if (area === 'session')
                return (
                  (chrome.storage.session as { QUOTA_BYTES?: number }).QUOTA_BYTES ||
                  5 * 1024 * 1024
                );
              return chrome.storage.local.QUOTA_BYTES || 5242880;
            })();

            const available = quota - used;
            const usagePercent = (used / quota) * 100;

            resolve({
              used,
              quota,
              available,
              usagePercent,
            });
          } catch (error) {
            reject(error);
          }
        });
      } else {
        // Fallback if getBytesInUse is not available
        const quota = area === 'sync' ? 102400 : 5242880;
        resolve({
          used: 0,
          quota,
          available: quota,
          usagePercent: 0,
        });
      }
    });
  });
}

/**
 * Check if storage has enough space for data
 */
export async function hasStorageSpace(
  estimatedSize: number,
  area: ChromeStorageArea = 'local'
): Promise<boolean> {
  try {
    const quota = await getStorageQuota(area);
    return quota.available >= estimatedSize;
  } catch {
    // If we can't get quota info, assume space is available
    return true;
  }
}

/**
 * Get estimated size of data in bytes
 */
export function estimateDataSize(data: unknown): number {
  try {
    return new Blob([JSON.stringify(data)]).size;
  } catch {
    // Fallback: estimate based on string length (UTF-16)
    return JSON.stringify(data).length * 2;
  }
}

// =============================================================================
// Storage Change Listeners
// =============================================================================

/**
 * Add storage change listener with proper typing
 */
export function addStorageListener<T extends Record<string, unknown>>(
  callback: StorageListener<T>,
  area?: ChromeStorageArea
): () => void {
  const listener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
    // Filter by area if specified
    if (area && areaName !== area) {
      return;
    }

    // Convert Chrome storage changes to our typed format
    const typedChanges: StorageChanges<T> = {};
    for (const [key, change] of Object.entries(changes)) {
      (typedChanges as Record<string, { oldValue?: unknown; newValue?: unknown }>)[key] = {
        oldValue: change.oldValue,
        newValue: change.newValue,
      };
    }

    callback(typedChanges, areaName as ChromeStorageArea);
  };

  // Add listener
  chrome.storage.onChanged.addListener(listener);

  // Return cleanup function
  return () => {
    chrome.storage.onChanged.removeListener(listener);
  };
}

/**
 * Listen for changes to specific keys
 */
export function addKeyListener<T>(
  keys: string[],
  callback: (key: string, change: StorageChange<T>, area: ChromeStorageArea) => void,
  area?: ChromeStorageArea
): () => void {
  return addStorageListener((changes, areaName) => {
    for (const [key, change] of Object.entries(changes)) {
      if (keys.includes(key)) {
        callback(key, change as StorageChange<T>, areaName);
      }
    }
  }, area);
}

/**
 * Listen for changes to a single key
 */
export function addSingleKeyListener<T>(
  key: string,
  callback: (change: StorageChange<T>, area: ChromeStorageArea) => void,
  area?: ChromeStorageArea
): () => void {
  return addKeyListener<T>(
    [key],
    (changedKey, change, areaName) => {
      if (changedKey === key) {
        callback(change, areaName);
      }
    },
    area
  );
}

// =============================================================================
// High-Level Utilities
// =============================================================================

/**
 * Check if a key exists in storage
 */
export async function has(key: string, area: ChromeStorageArea = 'local'): Promise<boolean> {
  const value = await get(key, area);
  return value !== null;
}

/**
 * Get value with default fallback
 */
export async function getWithDefault<T>(
  key: string,
  defaultValue: T,
  area: ChromeStorageArea = 'local'
): Promise<T> {
  const value = await get<T>(key, area);
  return value !== null ? value : defaultValue;
}

/**
 * Set value only if key doesn't exist
 */
export async function setIfNotExists<T>(
  key: string,
  value: T,
  area: ChromeStorageArea = 'local'
): Promise<boolean> {
  const exists = await has(key, area);
  if (!exists) {
    await set(key, value, area);
    return true;
  }
  return false;
}

/**
 * Update value using a transform function
 */
export async function update<T>(
  key: string,
  transform: (current: T | null) => T,
  area: ChromeStorageArea = 'local'
): Promise<T> {
  const current = await get<T>(key, area);
  const updated = transform(current);
  await set(key, updated, area);
  return updated;
}

/**
 * Increment numeric value
 */
export async function increment(
  key: string,
  delta = 1,
  area: ChromeStorageArea = 'local'
): Promise<number> {
  return update<number>(key, current => (current || 0) + delta, area);
}

/**
 * Toggle boolean value
 */
export async function toggle(key: string, area: ChromeStorageArea = 'local'): Promise<boolean> {
  return update<boolean>(key, current => !current, area);
}

// =============================================================================
// Export All Functions
// =============================================================================

export default {
  // Core operations
  get,
  getMultiple,
  getAll,
  set,
  setMultiple,
  remove,
  removeMultiple,
  clear,

  // Batch operations
  batchGet,
  batchSet,
  batchRemove,

  // Quota management
  getStorageQuota,
  hasStorageSpace,
  estimateDataSize,

  // Listeners
  addStorageListener,
  addKeyListener,
  addSingleKeyListener,

  // Utilities
  has,
  getWithDefault,
  setIfNotExists,
  update,
  increment,
  toggle,

  // Error types
  ChromeStorageError,
  StorageQuotaError,
};
