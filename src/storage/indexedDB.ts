/**
 * @file IndexedDB Wrapper
 *
 * High-performance IndexedDB wrapper with TypeScript generics, transaction helpers,
 * query builders, batch operations, error recovery, and connection pooling.
 *
 * Features:
 * - Type-safe CRUD operations
 * - Transaction management
 * - Query builders with index support
 * - Batch operations for performance
 * - Retry logic and error recovery
 * - Connection pooling
 * - Offline queue support
 */

import { DATABASE_CONFIG, OBJECT_STORES, createDatabase } from './schema';

// =============================================================================
// Types
// =============================================================================

export type StoreName = (typeof OBJECT_STORES)[keyof typeof OBJECT_STORES];

export interface QueryOptions {
  limit?: number;
  offset?: number;
  direction?: 'next' | 'prev';
}

export interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
}

interface QueuedOperation {
  id: string;
  operation: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
}

// =============================================================================
// IndexedDB Wrapper Class
// =============================================================================

export class IndexedDBWrapper {
  private db: IDBDatabase | null = null;
  private isOpening = false;
  private openPromise: Promise<IDBDatabase> | null = null;
  private offlineQueue: QueuedOperation[] = [];
  private isProcessingQueue = false;

  private readonly defaultRetryOptions: RetryOptions = {
    maxRetries: 3,
    baseDelay: 100,
    maxDelay: 2000,
  };

  // ==========================================================================
  // Database Management
  // ==========================================================================

  /**
   * Open database connection with connection pooling
   */
  async openDatabase(): Promise<IDBDatabase> {
    // Return existing connection if available
    if (this.db && this.db.objectStoreNames.length > 0) {
      return this.db;
    }

    // Return pending open promise if already opening
    if (this.isOpening && this.openPromise) {
      return this.openPromise;
    }

    this.isOpening = true;
    this.openPromise = this._openDatabase();

    try {
      this.db = await this.openPromise;
      this.isOpening = false;
      return this.db;
    } catch (error) {
      this.isOpening = false;
      this.openPromise = null;
      throw error;
    }
  }

  /**
   * Internal database opening logic
   */
  private async _openDatabase(): Promise<IDBDatabase> {
    return createDatabase();
  }

  /**
   * Close database connection
   */
  async closeDatabase(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.openPromise = null;
      this.isOpening = false;
    }
  }

  /**
   * Delete database
   */
  async deleteDatabase(): Promise<void> {
    await this.closeDatabase();

    return new Promise<void>((resolve, reject) => {
      const deleteRequest = indexedDB.deleteDatabase(DATABASE_CONFIG.name);

      deleteRequest.onerror = event => {
        const error = (event.target as any)?.error || new Error('Database deletion failed');
        reject(error);
      };

      deleteRequest.onsuccess = () => {
        resolve();
      };

      deleteRequest.onblocked = () => {
        reject(new Error('Database deletion blocked'));
      };
    });
  }

  // ==========================================================================
  // CRUD Operations
  // ==========================================================================

  /**
   * Add data to object store
   */
  async add<T>(storeName: StoreName, data: T): Promise<string> {
    this.validateStoreName(storeName);

    return this.withRetry(async () => {
      const db = await this.openDatabase();

      return new Promise<string>((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);

        // Validate data has required key
        const keyPath = store.keyPath as string;
        if (!keyPath || !(data as any)[keyPath]) {
          reject(new Error(`Data must have ${keyPath} property for store ${storeName}`));
          return;
        }

        const request = store.add(data);
        const key = (data as any)[keyPath];

        request.onerror = () => {
          reject(new Error(request.error?.message || `Failed to add data to ${storeName}`));
        };

        request.onsuccess = () => {
          resolve(key);
        };

        transaction.onerror = () => {
          reject(new Error(transaction.error?.message || 'Transaction failed'));
        };
      });
    });
  }

  /**
   * Get data from object store by key
   */
  async get<T>(storeName: StoreName, key: string | number): Promise<T | null> {
    return this.withRetry(async () => {
      const db = await this.openDatabase();

      return new Promise<T | null>((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);

        request.onerror = () => {
          reject(new Error(request.error?.message || `Failed to get data from ${storeName}`));
        };

        request.onsuccess = () => {
          resolve(request.result || null);
        };

        transaction.onerror = () => {
          reject(new Error(transaction.error?.message || 'Transaction failed'));
        };
      });
    });
  }

  /**
   * Update data in object store
   */
  async update<T>(storeName: StoreName, key: string | number, data: T): Promise<void> {
    return this.withRetry(async () => {
      const db = await this.openDatabase();

      return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);

        // First check if key exists
        const getRequest = store.get(key);

        getRequest.onerror = () => {
          reject(
            new Error(getRequest.error?.message || `Failed to check existence in ${storeName}`)
          );
        };

        getRequest.onsuccess = () => {
          if (!getRequest.result) {
            reject(new Error(`Key ${key} not found in ${storeName}`));
            return;
          }

          const putRequest = store.put(data);

          putRequest.onerror = () => {
            reject(new Error(putRequest.error?.message || `Failed to update data in ${storeName}`));
          };

          putRequest.onsuccess = () => {
            resolve();
          };
        };

        transaction.onerror = () => {
          reject(new Error(transaction.error?.message || 'Transaction failed'));
        };
      });
    });
  }

  /**
   * Delete data from object store
   */
  async delete(storeName: StoreName, key: string | number): Promise<void> {
    return this.withRetry(async () => {
      const db = await this.openDatabase();

      return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(key);

        request.onerror = () => {
          reject(new Error(request.error?.message || `Failed to delete data from ${storeName}`));
        };

        request.onsuccess = () => {
          resolve();
        };

        transaction.onerror = () => {
          reject(new Error(transaction.error?.message || 'Transaction failed'));
        };
      });
    });
  }

  /**
   * Get all data from object store
   */
  async getAll<T>(storeName: StoreName): Promise<T[]> {
    return this.withRetry(async () => {
      const db = await this.openDatabase();

      return new Promise<T[]>((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();

        request.onerror = () => {
          reject(new Error(request.error?.message || `Failed to get all data from ${storeName}`));
        };

        request.onsuccess = () => {
          resolve(request.result || []);
        };

        transaction.onerror = () => {
          reject(new Error(transaction.error?.message || 'Transaction failed'));
        };
      });
    });
  }

  // ==========================================================================
  // Query Operations
  // ==========================================================================

  /**
   * Query data by index
   */
  async query<T>(
    storeName: StoreName,
    indexName: string,
    value: any,
    options: QueryOptions = {}
  ): Promise<T[]> {
    return this.withRetry(async () => {
      const db = await this.openDatabase();

      return new Promise<T[]>((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);

        let index: IDBIndex;
        try {
          index = store.index(indexName);
        } catch (error) {
          reject(new Error(`Index ${indexName} not found in ${storeName}`));
          return;
        }

        const request = index.getAll(value);

        request.onerror = () => {
          reject(
            new Error(request.error?.message || `Failed to query ${storeName} by ${indexName}`)
          );
        };

        request.onsuccess = () => {
          let results = request.result || [];

          // Apply options
          if (options.offset) {
            results = results.slice(options.offset);
          }
          if (options.limit) {
            results = results.slice(0, options.limit);
          }

          resolve(results);
        };

        transaction.onerror = () => {
          reject(new Error(transaction.error?.message || 'Transaction failed'));
        };
      });
    });
  }

  /**
   * Query data by index range
   */
  async queryRange<T>(
    storeName: StoreName,
    indexName: string,
    lower: any,
    upper: any,
    options: QueryOptions = {}
  ): Promise<T[]> {
    return this.withRetry(async () => {
      const db = await this.openDatabase();

      return new Promise<T[]>((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);

        let index: IDBIndex;
        try {
          index = store.index(indexName);
        } catch (error) {
          reject(new Error(`Index ${indexName} not found in ${storeName}`));
          return;
        }

        const range = IDBKeyRange.bound(lower, upper, false, false);
        const request = index.getAll(range);

        request.onerror = () => {
          reject(new Error(request.error?.message || `Failed to query range in ${storeName}`));
        };

        request.onsuccess = () => {
          let results = request.result || [];

          // Apply options
          if (options.offset) {
            results = results.slice(options.offset);
          }
          if (options.limit) {
            results = results.slice(0, options.limit);
          }

          resolve(results);
        };

        transaction.onerror = () => {
          reject(new Error(transaction.error?.message || 'Transaction failed'));
        };
      });
    });
  }

  // ==========================================================================
  // Batch Operations
  // ==========================================================================

  /**
   * Batch add multiple items
   */
  async batchAdd<T>(storeName: StoreName, items: T[]): Promise<void> {
    return this.withRetry(async () => {
      const db = await this.openDatabase();

      return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);

        let hasError = false;

        if (items.length === 0) {
          resolve();
          return;
        }

        transaction.oncomplete = () => {
          if (!hasError) {
            resolve();
          }
        };

        transaction.onerror = () => {
          hasError = true;
          reject(new Error(transaction.error?.message || 'Batch add transaction failed'));
        };

        transaction.onabort = () => {
          hasError = true;
          reject(new Error('Batch add transaction aborted'));
        };

        // Add all items
        for (const item of items) {
          const request = store.add(item);

          request.onerror = () => {
            hasError = true;
            transaction.abort();
            reject(new Error(request.error?.message || 'Failed to add item in batch'));
          };

          request.onsuccess = () => {
            // Success handled by transaction.oncomplete
          };
        }
      });
    });
  }

  /**
   * Batch delete multiple items
   */
  async batchDelete(storeName: StoreName, keys: (string | number)[]): Promise<void> {
    return this.withRetry(async () => {
      const db = await this.openDatabase();

      return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);

        let hasError = false;

        if (keys.length === 0) {
          resolve();
          return;
        }

        transaction.oncomplete = () => {
          if (!hasError) {
            resolve();
          }
        };

        transaction.onerror = () => {
          hasError = true;
          reject(new Error(transaction.error?.message || 'Batch delete transaction failed'));
        };

        transaction.onabort = () => {
          hasError = true;
          reject(new Error('Batch delete transaction aborted'));
        };

        // Delete all keys
        for (const key of keys) {
          const request = store.delete(key);

          request.onerror = () => {
            hasError = true;
            transaction.abort();
            reject(new Error(request.error?.message || 'Failed to delete item in batch'));
          };

          request.onsuccess = () => {
            // Success handled by transaction.oncomplete
          };
        }
      });
    });
  }

  // ==========================================================================
  // Transaction Helpers
  // ==========================================================================

  /**
   * Execute callback within a transaction
   */
  async transaction(
    storeNames: StoreName[],
    mode: IDBTransactionMode,
    callback: (transaction: IDBTransaction) => Promise<void> | void
  ): Promise<void> {
    return this.withRetry(async () => {
      const db = await this.openDatabase();

      return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(storeNames, mode);
        let callbackError: Error | null = null;

        transaction.oncomplete = () => {
          if (!callbackError) {
            resolve();
          }
        };

        transaction.onerror = () => {
          reject(callbackError || new Error(transaction.error?.message || 'Transaction failed'));
        };

        transaction.onabort = () => {
          reject(callbackError || new Error('Transaction aborted'));
        };

        // Execute callback
        try {
          const result = callback(transaction);

          // Handle async callbacks
          if (result instanceof Promise) {
            result.catch(error => {
              callbackError = error;
              transaction.abort();
            });
          }
        } catch (error) {
          callbackError = error instanceof Error ? error : new Error('Unknown callback error');
          transaction.abort();
        }
      });
    });
  }

  // ==========================================================================
  // Error Recovery and Utilities
  // ==========================================================================

  /**
   * Execute operation with retry logic
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = this.defaultRetryOptions.maxRetries
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Check if we're offline and should queue the operation
        if (!navigator.onLine && attempt === 0) {
          return this.queueOperation(operation);
        }

        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        // Don't retry on certain errors
        if (this.isNonRetryableError(lastError)) {
          throw lastError;
        }

        // Wait before retry with exponential backoff
        if (attempt < maxRetries - 1) {
          const delay = Math.min(
            this.defaultRetryOptions.baseDelay * Math.pow(2, attempt),
            this.defaultRetryOptions.maxDelay
          );
          await this.delay(delay);
        }
      }
    }

    throw lastError!;
  }

  /**
   * Check if error is non-retryable
   */
  private isNonRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return (
      message.includes('constraint') ||
      message.includes('duplicate') ||
      message.includes('not found') ||
      message.includes('validation')
    );
  }

  /**
   * Queue operation for offline execution
   */
  private async queueOperation<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const queuedOp: QueuedOperation = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        operation,
        resolve,
        reject,
      };

      this.offlineQueue.push(queuedOp);
    });
  }

  /**
   * Process queued operations when back online
   */
  async processOfflineQueue(): Promise<void> {
    if (this.isProcessingQueue || this.offlineQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      while (this.offlineQueue.length > 0) {
        const queuedOp = this.offlineQueue.shift()!;

        try {
          const result = await queuedOp.operation();
          queuedOp.resolve(result);
        } catch (error) {
          queuedOp.reject(error);
        }
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ==========================================================================
  // Validation
  // ==========================================================================

  /**
   * Validate store name
   */
  private validateStoreName(storeName: StoreName): void {
    if (!Object.values(OBJECT_STORES).includes(storeName)) {
      throw new Error(`Invalid store name: ${storeName}`);
    }
  }
}

// =============================================================================
// Export Default Instance
// =============================================================================

export const dbInstance = new IndexedDBWrapper();
export default dbInstance;
