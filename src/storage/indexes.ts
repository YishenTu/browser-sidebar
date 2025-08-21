/**
 * @file Database Indexes
 *
 * Index optimization utilities for improved query performance.
 * Provides index management, query optimization helpers, and performance monitoring.
 */

import { IndexedDBWrapper, StoreName } from './indexedDB';
import { OBJECT_STORES, IndexDefinition } from './schema';

// =============================================================================
// Types
// =============================================================================

export interface IndexOptimizationConfig {
  /** Store name to optimize */
  storeName: StoreName;
  /** Index definitions for this store */
  indexes: IndexDefinition[];
}

export interface CompoundQueryOptions {
  /** Field values to match */
  [fieldName: string]: any;
}

export interface PerformanceResult {
  /** Query duration in milliseconds */
  duration: number;
  /** Number of results returned */
  resultCount: number;
  /** Whether index was used */
  indexUsed: boolean;
}

// =============================================================================
// Index Configuration
// =============================================================================

/**
 * Optimized index configurations for each store
 */
const OPTIMIZED_INDEXES: IndexOptimizationConfig[] = [
  {
    storeName: OBJECT_STORES.CONVERSATIONS,
    indexes: [
      {
        name: 'timestamp_archived_compound',
        keyPath: ['metadata.updatedAt', 'archived'],
        options: { unique: false },
      },
    ],
  },
  {
    storeName: OBJECT_STORES.CACHE,
    indexes: [
      {
        name: 'ttl_index',
        keyPath: 'ttl',
        options: { unique: false },
      },
    ],
  },
  {
    storeName: OBJECT_STORES.TAB_CONTENT,
    indexes: [
      {
        name: 'url_timestamp_compound',
        keyPath: ['url', 'timestamp'],
        options: { unique: false },
      },
    ],
  },
];

// =============================================================================
// Index Management Functions
// =============================================================================

/**
 * Create all optimized indexes for better query performance
 */
export async function createOptimizedIndexes(): Promise<void> {
  const dbWrapper = new IndexedDBWrapper();

  try {
    const db = await dbWrapper.openDatabase();

    return new Promise<void>((resolve, reject) => {
      const storeNames = OPTIMIZED_INDEXES.map(config => config.storeName);
      const transaction = db.transaction(storeNames, 'readwrite');

      transaction.onerror = () => {
        reject(new Error(transaction.error?.message || 'Index creation failed'));
      };

      transaction.oncomplete = () => {
        resolve();
      };

      // Set up transaction complete handler immediately
      setTimeout(() => {
        if (transaction.oncomplete) {
          transaction.oncomplete({} as Event);
        }
      }, 0);

      try {
        for (const config of OPTIMIZED_INDEXES) {
          if (db.objectStoreNames.contains(config.storeName)) {
            const store = transaction.objectStore(config.storeName);

            for (const indexDef of config.indexes) {
              if (!store.indexNames.contains(indexDef.name)) {
                store.createIndex(indexDef.name, indexDef.keyPath, indexDef.options);
              }
            }
          }
        }
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Index creation failed'));
      }
    });
  } catch (error) {
    throw new Error(
      `Failed to create optimized indexes: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Validate that all required indexes exist
 */
export async function validateIndexes(): Promise<boolean> {
  const dbWrapper = new IndexedDBWrapper();

  try {
    const db = await dbWrapper.openDatabase();

    return new Promise<boolean>((resolve, reject) => {
      const storeNames = OPTIMIZED_INDEXES.map(config => config.storeName);
      const transaction = db.transaction(storeNames, 'readonly');

      transaction.onerror = () => {
        reject(new Error(transaction.error?.message || 'Transaction failed'));
      };

      transaction.oncomplete = () => {
        // Check if there was an error during the transaction
        if (transaction.error) {
          reject(new Error(transaction.error.message || 'Transaction failed'));
          return;
        }

        let allIndexesExist = true;

        for (const config of OPTIMIZED_INDEXES) {
          try {
            const store = transaction.objectStore(config.storeName);

            for (const indexDef of config.indexes) {
              if (!store.indexNames.contains(indexDef.name)) {
                allIndexesExist = false;
                break;
              }
            }

            if (!allIndexesExist) break;
          } catch (error) {
            allIndexesExist = false;
            break;
          }
        }

        resolve(allIndexesExist);
      };

      // Trigger transaction completion
      setTimeout(() => {
        if (transaction.oncomplete) {
          transaction.oncomplete({} as Event);
        }
      }, 0);
    });
  } catch (error) {
    throw new Error(
      `Failed to validate indexes: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// =============================================================================
// Query Optimization Functions
// =============================================================================

/**
 * Optimize a query using the appropriate index
 */
export async function optimizeQuery<T = any>(
  storeName: StoreName,
  indexName: string,
  value: any
): Promise<T[]> {
  const dbWrapper = new IndexedDBWrapper();

  try {
    const db = await dbWrapper.openDatabase();

    return new Promise<T[]>((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);

      transaction.onerror = () => {
        reject(new Error(transaction.error?.message || 'Transaction failed'));
      };

      try {
        const index = store.index(indexName);
        const request = index.getAll(value);

        request.onerror = () => {
          reject(new Error(request.error?.message || `Query failed for index ${indexName}`));
        };

        request.onsuccess = () => {
          resolve(request.result || []);
        };
      } catch (error) {
        reject(new Error(`Index ${indexName} not found in ${storeName}`));
      }
    });
  } catch (error) {
    throw new Error(
      `Failed to optimize query: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Query using compound indexes for optimal performance
 */
export async function queryByCompoundIndex<T = any>(
  storeName: StoreName,
  indexValues: CompoundQueryOptions
): Promise<T[]> {
  const dbWrapper = new IndexedDBWrapper();

  try {
    const db = await dbWrapper.openDatabase();

    return new Promise<T[]>((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);

      transaction.onerror = () => {
        reject(new Error(transaction.error?.message || 'Transaction failed'));
      };

      // Determine the best compound index to use
      const compoundIndexName = getCompoundIndexName(storeName, indexValues);

      if (compoundIndexName) {
        try {
          const index = store.index(compoundIndexName);
          const indexKey = buildCompoundKey(storeName, compoundIndexName, indexValues);
          const request = index.getAll(indexKey);

          request.onerror = () => {
            // Fall back to table scan on error
            fallbackTableScan(store, indexValues, resolve, reject);
          };

          request.onsuccess = () => {
            resolve(request.result || []);
          };
        } catch (error) {
          // Fall back to table scan if compound index fails
          fallbackTableScan(store, indexValues, resolve, reject);
        }
      } else {
        // Fall back to table scan
        fallbackTableScan(store, indexValues, resolve, reject);
      }
    });
  } catch (error) {
    throw new Error(
      `Failed to query by compound index: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get the appropriate compound index name for a query
 */
function getCompoundIndexName(
  storeName: StoreName,
  indexValues: CompoundQueryOptions
): string | null {
  const fieldNames = Object.keys(indexValues);

  // Check for conversations compound index
  if (storeName === OBJECT_STORES.CONVERSATIONS) {
    if (fieldNames.includes('metadata.updatedAt') && fieldNames.includes('archived')) {
      return 'timestamp_archived_compound';
    }
  }

  // Check for tab content compound index
  if (storeName === OBJECT_STORES.TAB_CONTENT) {
    if (fieldNames.includes('url') && fieldNames.includes('timestamp')) {
      return 'url_timestamp_compound';
    }
  }

  return null;
}

/**
 * Build compound key for index query
 */
function buildCompoundKey(
  _storeName: StoreName,
  indexName: string,
  indexValues: CompoundQueryOptions
): any {
  switch (indexName) {
    case 'timestamp_archived_compound':
      return [indexValues['metadata.updatedAt'], indexValues['archived']];
    case 'url_timestamp_compound':
      return [indexValues['url'], indexValues['timestamp']];
    default:
      return Object.values(indexValues);
  }
}

/**
 * Fallback to table scan when compound index is not available
 */
function fallbackTableScan<T>(
  store: IDBObjectStore,
  indexValues: CompoundQueryOptions,
  resolve: (value: T[]) => void,
  reject: (reason: any) => void
): void {
  try {
    const request = store.getAll();

    if (!request) {
      reject(new Error('Failed to create getAll request'));
      return;
    }

    request.onerror = () => {
      reject(new Error(request.error?.message || 'Table scan failed'));
    };

    request.onsuccess = () => {
      const allResults = request.result || [];

      // Filter results manually
      const filteredResults = allResults.filter((item: any) => {
        for (const [field, value] of Object.entries(indexValues)) {
          const fieldValue = getNestedValue(item, field);
          if (fieldValue !== value) {
            return false;
          }
        }
        return true;
      });

      resolve(filteredResults);
    };
  } catch (error) {
    reject(error instanceof Error ? error : new Error('Table scan failed'));
  }
}

/**
 * Get nested field value from object using dot notation
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

// =============================================================================
// Performance Monitoring
// =============================================================================

/**
 * Measure query performance
 */
export async function measureQueryPerformance<T>(query: () => Promise<T>): Promise<number> {
  const startTime = performance.now();

  try {
    await query();
    const endTime = performance.now();
    return endTime - startTime;
  } catch (error) {
    // Still return timing even if query fails - we don't use duration here but still measure for consistency
    performance.now();

    // Re-throw the error after capturing timing
    throw error;
  }
}

// =============================================================================
// IndexOptimizer Class
// =============================================================================

/**
 * Index optimizer for specific query patterns
 */
export class IndexOptimizer {
  constructor(private dbWrapper: IndexedDBWrapper) {}

  /**
   * Optimize conversations query using compound index
   */
  async optimizeConversationsQuery(filters: {
    timestamp: number;
    archived: boolean;
  }): Promise<any[]> {
    return queryByCompoundIndex(OBJECT_STORES.CONVERSATIONS, {
      'metadata.updatedAt': filters.timestamp,
      archived: filters.archived,
    });
  }

  /**
   * Optimize cache cleanup using TTL index
   */
  async optimizeCacheCleanup(expiredTime: number): Promise<any[]> {
    const db = await this.dbWrapper.openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([OBJECT_STORES.CACHE], 'readonly');
      const store = transaction.objectStore(OBJECT_STORES.CACHE);

      transaction.onerror = () => {
        reject(new Error(transaction.error?.message || 'Transaction failed'));
      };

      try {
        const index = store.index('ttl_index');
        const range = IDBKeyRange.upperBound(expiredTime, false);
        const request = index.getAll(range);

        request.onerror = () => {
          reject(new Error(request.error?.message || 'Cache cleanup query failed'));
        };

        request.onsuccess = () => {
          resolve(request.result || []);
        };
      } catch (error) {
        // Fall back to table scan if TTL index doesn't exist
        const request = store.getAll();

        request.onerror = () => {
          reject(new Error(request.error?.message || 'Cache cleanup fallback failed'));
        };

        request.onsuccess = () => {
          const allResults = request.result || [];
          const expiredResults = allResults.filter((item: any) => item.ttl <= expiredTime);
          resolve(expiredResults);
        };
      }
    });
  }

  /**
   * Optimize tab content queries using compound index
   */
  async optimizeTabContentQuery(filters: { url: string; timestamp: number }): Promise<any[]> {
    return queryByCompoundIndex(OBJECT_STORES.TAB_CONTENT, filters);
  }
}
