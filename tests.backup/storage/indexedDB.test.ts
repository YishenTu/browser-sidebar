/**
 * @file IndexedDB Wrapper Tests
 *
 * Test suite for IndexedDB wrapper functionality following TDD approach.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Simple mocks
const mockStore = {
  add: vi.fn(),
  put: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
  getAll: vi.fn(),
  index: vi.fn(),
  keyPath: 'key',
};

const mockTransaction = {
  objectStore: vi.fn(() => mockStore),
  onerror: null as any,
  oncomplete: null as any,
  onabort: null as any,
  error: null,
};

const mockDB = {
  transaction: vi.fn(() => mockTransaction),
  close: vi.fn(),
  version: 1,
  name: 'BrowserSidebar',
  objectStoreNames: {
    contains: vi.fn(() => true),
    length: 5,
  },
};

const mockIndexedDB = {
  open: vi.fn(),
  deleteDatabase: vi.fn(),
};

const mockIDBKeyRange = {
  bound: vi.fn(),
};

// Set up globals
global.indexedDB = mockIndexedDB as any;
global.IDBKeyRange = mockIDBKeyRange as any;
global.navigator = { onLine: true } as any;

import { IndexedDBWrapper } from '../../src/storage/indexedDB';
import { OBJECT_STORES } from '../../src/storage/schema';

describe('IndexedDBWrapper', () => {
  let dbWrapper: IndexedDBWrapper;

  beforeEach(() => {
    vi.clearAllMocks();
    dbWrapper = new IndexedDBWrapper();

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
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Database Management', () => {
    it('should open database successfully', async () => {
      const db = await dbWrapper.openDatabase();

      expect(mockIndexedDB.open).toHaveBeenCalled();
      expect(db).toBe(mockDB);
    });

    it('should handle database connection errors', async () => {
      mockIndexedDB.open.mockImplementation(() => {
        const request = {
          result: null,
          onerror: null as any,
          onsuccess: null as any,
          onupgradeneeded: null as any,
          error: new Error('Database connection failed'),
        };

        setTimeout(() => {
          if (request.onerror) {
            request.onerror();
          }
        }, 0);

        return request;
      });

      await expect(dbWrapper.openDatabase()).rejects.toThrow();
    });

    it('should close database properly', async () => {
      await dbWrapper.openDatabase();
      await dbWrapper.closeDatabase();

      expect(mockDB.close).toHaveBeenCalled();
    });

    it('should delete database', async () => {
      mockIndexedDB.deleteDatabase.mockImplementation(() => {
        const request = {
          onerror: null as any,
          onsuccess: null as any,
          onblocked: null as any,
          error: null,
        };

        setTimeout(() => {
          if (request.onsuccess) {
            request.onsuccess();
          }
        }, 0);

        return request;
      });

      await dbWrapper.deleteDatabase();
      expect(mockIndexedDB.deleteDatabase).toHaveBeenCalled();
    });
  });

  describe('CRUD Operations', () => {
    beforeEach(async () => {
      await dbWrapper.openDatabase();
    });

    it('should add data successfully', async () => {
      const testData = { key: 'test-1', value: 'test data' };

      mockStore.add.mockImplementation(() => {
        const request = {
          result: 'test-1',
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

      mockTransaction.oncomplete = null;
      mockTransaction.onerror = null;

      const result = await dbWrapper.add(OBJECT_STORES.SETTINGS, testData);

      expect(result).toBe('test-1');
      expect(mockStore.add).toHaveBeenCalledWith(testData);
    });

    it('should get data successfully', async () => {
      const testData = { key: 'test-1', value: 'test data' };

      mockStore.get.mockImplementation(() => {
        const request = {
          result: testData,
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

      const result = await dbWrapper.get(OBJECT_STORES.SETTINGS, 'test-1');

      expect(result).toEqual(testData);
      expect(mockStore.get).toHaveBeenCalledWith('test-1');
    });

    it('should return null for non-existent data', async () => {
      mockStore.get.mockImplementation(() => {
        const request = {
          result: null,
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

      const result = await dbWrapper.get(OBJECT_STORES.SETTINGS, 'non-existent');

      expect(result).toBeNull();
    });

    it('should update data successfully', async () => {
      const testData = { key: 'test-1', value: 'updated data' };

      // Mock get to return existing data
      mockStore.get.mockImplementation(() => {
        const request = {
          result: { key: 'test-1', value: 'old data' },
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

      // Mock put to succeed
      mockStore.put.mockImplementation(() => {
        const request = {
          result: 'test-1',
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

      await dbWrapper.update(OBJECT_STORES.SETTINGS, 'test-1', testData);

      expect(mockStore.get).toHaveBeenCalledWith('test-1');
      expect(mockStore.put).toHaveBeenCalledWith(testData);
    });

    it('should delete data successfully', async () => {
      mockStore.delete.mockImplementation(() => {
        const request = {
          result: undefined,
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

      await dbWrapper.delete(OBJECT_STORES.SETTINGS, 'test-1');

      expect(mockStore.delete).toHaveBeenCalledWith('test-1');
    });

    it('should get all data successfully', async () => {
      const testData = [
        { key: 'test-1', value: 'data 1' },
        { key: 'test-2', value: 'data 2' },
      ];

      mockStore.getAll.mockImplementation(() => {
        const request = {
          result: testData,
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

      const result = await dbWrapper.getAll(OBJECT_STORES.SETTINGS);

      expect(result).toEqual(testData);
      expect(mockStore.getAll).toHaveBeenCalled();
    });
  });

  describe('Error Recovery', () => {
    beforeEach(async () => {
      await dbWrapper.openDatabase();
    });

    it('should implement retry logic', async () => {
      let callCount = 0;
      const mockOperation = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          throw new Error('Temporary failure');
        }
        return Promise.resolve('success');
      });

      const result = await dbWrapper.withRetry(mockOperation, 3);

      expect(result).toBe('success');
      expect(callCount).toBe(3);
    });

    it('should fail after max retry attempts', async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error('Persistent failure'));

      await expect(dbWrapper.withRetry(mockOperation, 2)).rejects.toThrow('Persistent failure');

      expect(mockOperation).toHaveBeenCalledTimes(2);
    });
  });

  describe('Batch Operations', () => {
    beforeEach(async () => {
      await dbWrapper.openDatabase();
    });

    it('should perform batch add operations', async () => {
      const testItems = [
        { key: 'item1', value: 'value1' },
        { key: 'item2', value: 'value2' },
      ];

      // Mock successful add operations
      mockStore.add.mockImplementation(() => {
        const request = {
          result: 'success',
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

      // Mock transaction completion
      setTimeout(() => {
        if (mockTransaction.oncomplete) {
          mockTransaction.oncomplete();
        }
      }, 10);

      await dbWrapper.batchAdd(OBJECT_STORES.SETTINGS, testItems);

      expect(mockStore.add).toHaveBeenCalledTimes(2);
      expect(mockStore.add).toHaveBeenCalledWith(testItems[0]);
      expect(mockStore.add).toHaveBeenCalledWith(testItems[1]);
    });

    it('should perform batch delete operations', async () => {
      const testKeys = ['key1', 'key2', 'key3'];

      // Mock successful delete operations
      mockStore.delete.mockImplementation(() => {
        const request = {
          result: undefined,
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

      // Mock transaction completion
      setTimeout(() => {
        if (mockTransaction.oncomplete) {
          mockTransaction.oncomplete();
        }
      }, 10);

      await dbWrapper.batchDelete(OBJECT_STORES.SETTINGS, testKeys);

      expect(mockStore.delete).toHaveBeenCalledTimes(3);
      testKeys.forEach(key => {
        expect(mockStore.delete).toHaveBeenCalledWith(key);
      });
    });
  });

  describe('Transaction Management', () => {
    beforeEach(async () => {
      await dbWrapper.openDatabase();
    });

    it('should execute transaction callback', async () => {
      const callback = vi.fn();

      // Mock transaction completion
      setTimeout(() => {
        if (mockTransaction.oncomplete) {
          mockTransaction.oncomplete();
        }
      }, 0);

      await dbWrapper.transaction([OBJECT_STORES.SETTINGS], 'readwrite', callback);

      expect(callback).toHaveBeenCalledWith(mockTransaction);
      expect(mockDB.transaction).toHaveBeenCalledWith([OBJECT_STORES.SETTINGS], 'readwrite');
    });
  });
});
