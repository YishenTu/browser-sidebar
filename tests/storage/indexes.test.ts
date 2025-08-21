/**
 * @file Database Indexes Tests
 *
 * Test suite for database index optimization functionality following TDD approach.
 * Tests index management, query optimization, and performance monitoring.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock IndexedDB APIs
const mockIndex = {
  get: vi.fn(),
  getAll: vi.fn(),
  getAllKeys: vi.fn(),
  count: vi.fn(),
  keyPath: 'timestamp',
  unique: false,
  multiEntry: false,
  name: 'timestamp',
};

const mockStore = {
  add: vi.fn(),
  put: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
  getAll: vi.fn(),
  index: vi.fn(),
  createIndex: vi.fn(),
  indexNames: {
    contains: vi.fn(),
    length: 0,
    item: vi.fn(),
  },
  keyPath: 'id',
  autoIncrement: false,
};

const mockTransaction = {
  objectStore: vi.fn(),
  onerror: null as any,
  oncomplete: null as any,
  onabort: null as any,
  error: null,
};

const mockDB = {
  transaction: vi.fn(),
  close: vi.fn(),
  version: 1,
  name: 'BrowserSidebar',
  objectStoreNames: {
    contains: vi.fn(),
    length: 5,
    item: vi.fn(),
  },
};

const mockIndexedDB = {
  open: vi.fn(),
  deleteDatabase: vi.fn(),
};

const mockIDBKeyRange = {
  bound: vi.fn(),
  only: vi.fn(),
  upperBound: vi.fn(),
  lowerBound: vi.fn(),
};

// Set up globals
global.indexedDB = mockIndexedDB as any;
global.IDBKeyRange = mockIDBKeyRange as any;
global.performance = {
  now: vi.fn(() => Date.now()),
} as any;

import {
  createOptimizedIndexes,
  validateIndexes,
  optimizeQuery,
  queryByCompoundIndex,
  measureQueryPerformance,
  IndexOptimizer,
} from '../../src/storage/indexes';
import { IndexedDBWrapper } from '../../src/storage/indexedDB';
import { OBJECT_STORES } from '../../src/storage/schema';

describe('Database Indexes', () => {
  let dbWrapper: IndexedDBWrapper;
  let indexOptimizer: IndexOptimizer;

  beforeEach(() => {
    vi.clearAllMocks();
    dbWrapper = new IndexedDBWrapper();
    indexOptimizer = new IndexOptimizer(dbWrapper);

    // Reset transaction error state
    mockTransaction.error = null;

    // Setup successful database open
    mockIndexedDB.open.mockImplementation(() => {
      const request = {
        result: mockDB,
        onerror: null as any,
        onsuccess: null as any,
        onupgradeneeded: null as any,
        error: null,
      };

      setTimeout(() => {
        if (request.onsuccess) {
          request.onsuccess();
        }
      }, 0);

      return request;
    });

    // Setup mocks - create fresh transaction for each test
    mockDB.transaction.mockImplementation(() => ({
      objectStore: vi.fn(() => mockStore),
      onerror: null as any,
      oncomplete: null as any,
      onabort: null as any,
      error: null,
    }));
    mockStore.index.mockReturnValue(mockIndex);
    mockDB.objectStoreNames.contains.mockReturnValue(true);
    mockStore.indexNames.contains.mockReturnValue(false);
    mockStore.createIndex.mockReturnValue(mockIndex);

    // Setup performance.now mock
    let mockTime = 1000;
    vi.mocked(performance.now).mockImplementation(() => mockTime++);

    // Default getAll implementation
    mockStore.getAll.mockImplementation(() => ({
      result: [],
      onerror: null as any,
      onsuccess: null as any,
      error: null,
    }));

    mockIndex.getAll.mockImplementation(() => ({
      result: [],
      onerror: null as any,
      onsuccess: null as any,
      error: null,
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Index Creation and Management', () => {
    it('should create optimized indexes successfully', async () => {
      let testTransaction: any;

      mockDB.transaction.mockImplementation(() => {
        testTransaction = {
          objectStore: vi.fn(() => mockStore),
          onerror: null as any,
          oncomplete: null as any,
          onabort: null as any,
          error: null,
        };
        return testTransaction;
      });

      // Setup transaction completion
      const promise = createOptimizedIndexes();

      // Manually trigger oncomplete after createIndex calls
      setTimeout(() => {
        if (testTransaction.oncomplete) {
          testTransaction.oncomplete();
        }
      }, 10);

      await expect(promise).resolves.not.toThrow();

      // Verify createIndex was called for expected indexes
      expect(mockStore.createIndex).toHaveBeenCalledWith(
        'timestamp_archived_compound',
        ['metadata.updatedAt', 'archived'],
        { unique: false }
      );
      expect(mockStore.createIndex).toHaveBeenCalledWith('ttl_index', 'ttl', { unique: false });
      expect(mockStore.createIndex).toHaveBeenCalledWith(
        'url_timestamp_compound',
        ['url', 'timestamp'],
        { unique: false }
      );
    });

    it('should handle index creation errors gracefully', async () => {
      mockStore.createIndex.mockImplementation(() => {
        throw new Error('Index creation failed');
      });

      await expect(createOptimizedIndexes()).rejects.toThrow('Index creation failed');
    });

    it('should validate indexes correctly', async () => {
      let testTransaction: any;

      mockDB.transaction.mockImplementation(() => {
        testTransaction = {
          objectStore: vi.fn(() => mockStore),
          onerror: null as any,
          oncomplete: null as any,
          onabort: null as any,
          error: null,
        };
        return testTransaction;
      });

      // Setup existing indexes
      mockStore.indexNames.contains.mockImplementation((name: string) => {
        return (
          name === 'timestamp_archived_compound' ||
          name === 'ttl_index' ||
          name === 'url_timestamp_compound'
        );
      });

      const promise = validateIndexes();

      // Trigger transaction completion
      setTimeout(() => {
        if (testTransaction.oncomplete) {
          testTransaction.oncomplete();
        }
      }, 10);

      const isValid = await promise;
      expect(isValid).toBe(true);
    });

    it('should detect missing indexes during validation', async () => {
      let testTransaction: any;

      mockDB.transaction.mockImplementation(() => {
        testTransaction = {
          objectStore: vi.fn(() => mockStore),
          onerror: null as any,
          oncomplete: null as any,
          onabort: null as any,
          error: null,
        };
        return testTransaction;
      });

      // Setup missing indexes
      mockStore.indexNames.contains.mockReturnValue(false);

      const promise = validateIndexes();

      // Trigger transaction completion
      setTimeout(() => {
        if (testTransaction.oncomplete) {
          testTransaction.oncomplete();
        }
      }, 10);

      const isValid = await promise;
      expect(isValid).toBe(false);
    });
  });

  describe('Query Optimization', () => {
    it('should optimize single index queries', async () => {
      const mockResults = [
        { id: '1', timestamp: 1000, content: 'test1' },
        { id: '2', timestamp: 2000, content: 'test2' },
      ];

      mockIndex.getAll.mockImplementation(() => {
        const request = {
          result: mockResults,
          onerror: null as any,
          onsuccess: null as any,
          error: null,
        };

        setTimeout(() => {
          if (request.onsuccess) {
            request.onsuccess();
          }
        }, 0);

        return request;
      });

      const results = await optimizeQuery(OBJECT_STORES.CONVERSATIONS, 'timestamp', 1500);

      expect(results).toEqual(mockResults);
      expect(mockStore.index).toHaveBeenCalledWith('timestamp');
      expect(mockIndex.getAll).toHaveBeenCalledWith(1500);
    });

    it('should handle non-existent index in optimized query', async () => {
      mockStore.index.mockImplementation(() => {
        throw new Error('Index not found');
      });

      await expect(
        optimizeQuery(OBJECT_STORES.CONVERSATIONS, 'nonexistent_index', 'value')
      ).rejects.toThrow('nonexistent_index not found');
    });

    it('should perform compound index queries with existing index', async () => {
      const mockResults = [
        { id: '1', metadata: { updatedAt: 1500 }, archived: false },
        { id: '2', metadata: { updatedAt: 1600 }, archived: false },
      ];

      mockIndex.getAll.mockImplementation(() => {
        const request = {
          result: mockResults,
          onerror: null as any,
          onsuccess: null as any,
          error: null,
        };

        setTimeout(() => {
          if (request.onsuccess) {
            request.onsuccess();
          }
        }, 0);

        return request;
      });

      const results = await queryByCompoundIndex(OBJECT_STORES.CONVERSATIONS, {
        'metadata.updatedAt': 1500,
        archived: false,
      });

      expect(results).toEqual(mockResults);
      expect(mockStore.index).toHaveBeenCalledWith('timestamp_archived_compound');
    });

    it('should fall back to table scan for unsupported compound queries', async () => {
      const mockResults = [
        { id: '1', title: 'Test', archived: false },
        { id: '2', title: 'Other', archived: true },
        { id: '3', title: 'Test', archived: true },
      ];

      mockStore.getAll.mockImplementation(() => {
        const request = {
          result: mockResults,
          onerror: null as any,
          onsuccess: null as any,
          error: null,
        };

        setTimeout(() => {
          if (request.onsuccess) {
            request.onsuccess();
          }
        }, 0);

        return request;
      });

      const results = await queryByCompoundIndex(OBJECT_STORES.CONVERSATIONS, {
        title: 'Test',
        archived: false,
      });

      // Should filter to only records matching both criteria
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ id: '1', title: 'Test', archived: false });
      expect(mockStore.getAll).toHaveBeenCalled();
    });
  });

  describe('Performance Monitoring', () => {
    it('should measure query performance', async () => {
      const mockQuery = vi.fn().mockResolvedValue(['result1', 'result2']);

      const duration = await measureQueryPerformance(mockQuery);

      expect(typeof duration).toBe('number');
      expect(duration).toBeGreaterThanOrEqual(0);
      expect(mockQuery).toHaveBeenCalledOnce();
    });

    it('should measure performance of failed queries', async () => {
      const mockQuery = vi.fn().mockRejectedValue(new Error('Query failed'));

      await expect(measureQueryPerformance(mockQuery)).rejects.toThrow('Query failed');

      expect(mockQuery).toHaveBeenCalledOnce();
    });

    it('should handle performance measurement with multiple calls', async () => {
      const mockQuery = vi.fn().mockResolvedValue(['result']);

      const duration1 = await measureQueryPerformance(mockQuery);
      const duration2 = await measureQueryPerformance(mockQuery);

      expect(duration1).toBeGreaterThanOrEqual(0);
      expect(duration2).toBeGreaterThanOrEqual(0);
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });
  });

  describe('IndexOptimizer Class', () => {
    it('should create IndexOptimizer instance', () => {
      expect(indexOptimizer).toBeInstanceOf(IndexOptimizer);
    });

    it('should optimize conversations query with compound index', async () => {
      const mockResults = [
        { id: '1', metadata: { updatedAt: 1500 }, archived: false },
        { id: '2', metadata: { updatedAt: 1600 }, archived: false },
      ];

      mockIndex.getAll.mockImplementation(() => {
        const request = {
          result: mockResults,
          onerror: null as any,
          onsuccess: null as any,
          error: null,
        };

        setTimeout(() => {
          if (request.onsuccess) {
            request.onsuccess();
          }
        }, 0);

        return request;
      });

      const results = await indexOptimizer.optimizeConversationsQuery({
        timestamp: 1500,
        archived: false,
      });

      expect(results).toEqual(mockResults);
    });

    it('should optimize cache cleanup with TTL index', async () => {
      const expiredTime = Date.now();
      const mockResults = [
        { key: 'expired1', ttl: expiredTime - 1000 },
        { key: 'expired2', ttl: expiredTime - 2000 },
      ];

      mockIndex.getAll.mockImplementation(() => {
        const request = {
          result: mockResults,
          onerror: null as any,
          onsuccess: null as any,
          error: null,
        };

        setTimeout(() => {
          if (request.onsuccess) {
            request.onsuccess();
          }
        }, 0);

        return request;
      });

      const results = await indexOptimizer.optimizeCacheCleanup(expiredTime);

      expect(results).toEqual(mockResults);
      expect(mockIDBKeyRange.upperBound).toHaveBeenCalledWith(expiredTime, false);
    });

    it('should fall back to table scan when TTL index is missing', async () => {
      const expiredTime = Date.now();
      const mockResults = [
        { key: 'expired1', ttl: expiredTime - 1000 },
        { key: 'valid1', ttl: expiredTime + 1000 },
        { key: 'expired2', ttl: expiredTime - 2000 },
      ];

      // Make index throw error
      mockStore.index.mockImplementation(() => {
        throw new Error('Index not found');
      });

      mockStore.getAll.mockImplementation(() => {
        const request = {
          result: mockResults,
          onerror: null as any,
          onsuccess: null as any,
          error: null,
        };

        setTimeout(() => {
          if (request.onsuccess) {
            request.onsuccess();
          }
        }, 0);

        return request;
      });

      const results = await indexOptimizer.optimizeCacheCleanup(expiredTime);

      // Should return only expired items
      expect(results).toHaveLength(2);
      expect(results).toEqual([
        { key: 'expired1', ttl: expiredTime - 1000 },
        { key: 'expired2', ttl: expiredTime - 2000 },
      ]);
      expect(mockStore.getAll).toHaveBeenCalled();
    });

    it('should optimize tab content queries', async () => {
      const mockResults = [
        { tabId: 1, url: 'https://example.com', timestamp: 1000 },
        { tabId: 2, url: 'https://example.com', timestamp: 2000 },
      ];

      mockIndex.getAll.mockImplementation(() => {
        const request = {
          result: mockResults,
          onerror: null as any,
          onsuccess: null as any,
          error: null,
        };

        setTimeout(() => {
          if (request.onsuccess) {
            request.onsuccess();
          }
        }, 0);

        return request;
      });

      const results = await indexOptimizer.optimizeTabContentQuery({
        url: 'https://example.com',
        timestamp: 1500,
      });

      expect(results).toEqual(mockResults);
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors during index operations', async () => {
      mockIndexedDB.open.mockImplementation(() => {
        const request = {
          result: null,
          onerror: null as any,
          onsuccess: null as any,
          onupgradeneeded: null as any,
          error: new Error('Connection failed'),
        };

        setTimeout(() => {
          if (request.onerror) {
            request.onerror();
          }
        }, 0);

        return request;
      });

      await expect(createOptimizedIndexes()).rejects.toThrow('Connection failed');
    });

    it('should handle transaction errors during index validation', async () => {
      let errorTransaction: any;

      mockDB.transaction.mockImplementation(() => {
        errorTransaction = {
          objectStore: vi.fn(() => mockStore),
          onerror: null as any,
          oncomplete: null as any,
          onabort: null as any,
          error: new Error('Transaction failed'),
        };
        return errorTransaction;
      });

      const promise = validateIndexes();

      setTimeout(() => {
        if (errorTransaction.onerror) {
          errorTransaction.onerror();
        }
      }, 10);

      await expect(promise).rejects.toThrow('Transaction failed');
    });
  });

  describe('Integration Tests', () => {
    it('should create indexes and validate them in sequence', async () => {
      let createTransaction: any;
      let validateTransaction: any;
      let transactionCount = 0;

      mockDB.transaction.mockImplementation(() => {
        transactionCount++;
        if (transactionCount === 1) {
          createTransaction = {
            objectStore: vi.fn(() => mockStore),
            onerror: null as any,
            oncomplete: null as any,
            onabort: null as any,
            error: null,
          };
          return createTransaction;
        } else {
          validateTransaction = {
            objectStore: vi.fn(() => mockStore),
            onerror: null as any,
            oncomplete: null as any,
            onabort: null as any,
            error: null,
          };
          return validateTransaction;
        }
      });

      // First create indexes
      const createPromise = createOptimizedIndexes();

      setTimeout(() => {
        if (createTransaction.oncomplete) {
          createTransaction.oncomplete();
        }
      }, 10);

      await createPromise;

      // Then validate - update mock to return true
      mockStore.indexNames.contains.mockReturnValue(true);

      const validatePromise = validateIndexes();

      setTimeout(() => {
        if (validateTransaction.oncomplete) {
          validateTransaction.oncomplete();
        }
      }, 20);

      const isValid = await validatePromise;
      expect(isValid).toBe(true);
    });

    it('should measure performance of optimized queries', async () => {
      const mockData = [{ id: '1', timestamp: 1000 }];

      mockIndex.getAll.mockImplementation(() => {
        const request = {
          result: mockData,
          onerror: null as any,
          onsuccess: null as any,
          error: null,
        };

        setTimeout(() => {
          if (request.onsuccess) {
            request.onsuccess();
          }
        }, 5); // 5ms delay

        return request;
      });

      const optimizedDuration = await measureQueryPerformance(async () => {
        return optimizeQuery(OBJECT_STORES.CONVERSATIONS, 'timestamp', 5000);
      });

      expect(optimizedDuration).toBeGreaterThan(0);
    });
  });
});
