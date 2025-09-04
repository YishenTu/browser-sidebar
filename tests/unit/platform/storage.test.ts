/**
 * @file Chrome Storage Platform Wrapper Tests
 *
 * Comprehensive unit tests for the storage wrapper functions testing:
 * - Core storage operations (get/set/remove/clear)
 * - Batch operations with partial failure handling
 * - Storage quota management and estimation
 * - Change listeners and event handling
 * - High-level utility functions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ChromeStorageError,
  StorageQuotaError,
  get,
  getMultiple,
  getAll,
  set,
  setMultiple,
  remove,
  removeMultiple,
  clear,
  batchGet,
  batchSet,
  batchRemove,
  getStorageQuota,
  hasStorageSpace,
  estimateDataSize,
  addStorageListener,
  addKeyListener,
  addSingleKeyListener,
  has,
  getWithDefault,
  setIfNotExists,
  update,
  increment,
  toggle,
  type ChromeStorageArea,
  type StorageChange,
  type StorageChanges,
  type StorageQuota,
  type BatchResult,
} from '@/platform/chrome/storage';

// Mock Chrome APIs
const mockChrome = {
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
      getBytesInUse: vi.fn(),
      QUOTA_BYTES: 5242880, // 5MB
    },
    sync: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
      getBytesInUse: vi.fn(),
      QUOTA_BYTES: 102400, // 100KB
    },
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  runtime: {
    lastError: null as chrome.runtime.LastError | null,
  },
};

// Set up global chrome mock
Object.defineProperty(global, 'chrome', {
  value: mockChrome,
  writable: true,
});

describe('ChromeStorageError', () => {
  it('should create error with correct properties', () => {
    const cause = new Error('Original error');
    const error = new ChromeStorageError('Test error', 'get', 'local', cause);

    expect(error.message).toBe('Test error');
    expect(error.name).toBe('ChromeStorageError');
    expect(error.operation).toBe('get');
    expect(error.area).toBe('local');
    expect(error.cause).toBe(cause);
  });
});

describe('StorageQuotaError', () => {
  it('should create quota error', () => {
    const error = new StorageQuotaError('sync');

    expect(error.message).toBe('Storage quota exceeded for sync');
    expect(error.name).toBe('StorageQuotaError');
    expect(error.operation).toBe('quota_check');
    expect(error.area).toBe('sync');
  });
});

describe('get', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChrome.runtime.lastError = null;
  });

  it('should get value from local storage', async () => {
    const testValue = { data: 'test' };
    mockChrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({ testKey: testValue });
    });

    const result = await get<{ data: string }>('testKey');

    expect(mockChrome.storage.local.get).toHaveBeenCalledWith(['testKey'], expect.any(Function));
    expect(result).toEqual(testValue);
  });

  it('should get value from sync storage', async () => {
    const testValue = 'sync value';
    mockChrome.storage.sync.get.mockImplementation((keys, callback) => {
      callback({ testKey: testValue });
    });

    const result = await get<string>('testKey', 'sync');

    expect(mockChrome.storage.sync.get).toHaveBeenCalledWith(['testKey'], expect.any(Function));
    expect(result).toBe(testValue);
  });

  it('should return null when key not found', async () => {
    mockChrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({});
    });

    const result = await get('nonexistentKey');

    expect(result).toBeNull();
  });

  it('should handle chrome runtime errors', async () => {
    mockChrome.storage.local.get.mockImplementation((keys, callback) => {
      mockChrome.runtime.lastError = { message: 'Storage error' };
      callback({});
    });

    await expect(get('testKey')).rejects.toThrow(ChromeStorageError);
  });

  it('should handle quota exceeded errors', async () => {
    mockChrome.storage.local.get.mockImplementation((keys, callback) => {
      mockChrome.runtime.lastError = { message: 'QUOTA_BYTES exceeded' };
      callback({});
    });

    await expect(get('testKey')).rejects.toThrow(StorageQuotaError);
  });

  it('should wrap other errors', async () => {
    mockChrome.storage.local.get.mockImplementation(() => {
      throw new Error('Network error');
    });

    await expect(get('testKey')).rejects.toThrow(ChromeStorageError);
  });
});

describe('getMultiple', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChrome.runtime.lastError = null;
  });

  it('should get multiple values', async () => {
    const testData = { key1: 'value1', key2: 'value2' };
    mockChrome.storage.local.get.mockImplementation((keys, callback) => {
      callback(testData);
    });

    const result = await getMultiple<typeof testData>(['key1', 'key2']);

    expect(mockChrome.storage.local.get).toHaveBeenCalledWith(
      ['key1', 'key2'],
      expect.any(Function)
    );
    expect(result).toEqual(testData);
  });
});

describe('getAll', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChrome.runtime.lastError = null;
  });

  it('should get all storage contents', async () => {
    const allData = { key1: 'value1', key2: 'value2' };
    mockChrome.storage.local.get.mockImplementation((keys, callback) => {
      callback(allData);
    });

    const result = await getAll();

    expect(mockChrome.storage.local.get).toHaveBeenCalledWith(null, expect.any(Function));
    expect(result).toEqual(allData);
  });
});

describe('set', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChrome.runtime.lastError = null;
  });

  it('should set value in local storage', async () => {
    mockChrome.storage.local.set.mockImplementation((items, callback) => {
      callback();
    });

    await set('testKey', 'testValue');

    expect(mockChrome.storage.local.set).toHaveBeenCalledWith(
      { testKey: 'testValue' },
      expect.any(Function)
    );
  });

  it('should set value in sync storage', async () => {
    mockChrome.storage.sync.set.mockImplementation((items, callback) => {
      callback();
    });

    await set('testKey', 'testValue', 'sync');

    expect(mockChrome.storage.sync.set).toHaveBeenCalledWith(
      { testKey: 'testValue' },
      expect.any(Function)
    );
  });

  it('should handle storage errors', async () => {
    mockChrome.storage.local.set.mockImplementation((items, callback) => {
      mockChrome.runtime.lastError = { message: 'Set failed' };
      callback();
    });

    await expect(set('testKey', 'testValue')).rejects.toThrow(ChromeStorageError);
  });
});

describe('setMultiple', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChrome.runtime.lastError = null;
  });

  it('should set multiple values', async () => {
    const testData = { key1: 'value1', key2: 'value2' };
    mockChrome.storage.local.set.mockImplementation((items, callback) => {
      callback();
    });

    await setMultiple(testData);

    expect(mockChrome.storage.local.set).toHaveBeenCalledWith(testData, expect.any(Function));
  });
});

describe('remove', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChrome.runtime.lastError = null;
  });

  it('should remove key from storage', async () => {
    mockChrome.storage.local.remove.mockImplementation((keys, callback) => {
      callback();
    });

    await remove('testKey');

    expect(mockChrome.storage.local.remove).toHaveBeenCalledWith(['testKey'], expect.any(Function));
  });

  it('should handle remove errors', async () => {
    mockChrome.storage.local.remove.mockImplementation((keys, callback) => {
      mockChrome.runtime.lastError = { message: 'Remove failed' };
      callback();
    });

    await expect(remove('testKey')).rejects.toThrow(ChromeStorageError);
  });
});

describe('removeMultiple', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChrome.runtime.lastError = null;
  });

  it('should remove multiple keys', async () => {
    mockChrome.storage.local.remove.mockImplementation((keys, callback) => {
      callback();
    });

    await removeMultiple(['key1', 'key2']);

    expect(mockChrome.storage.local.remove).toHaveBeenCalledWith(
      ['key1', 'key2'],
      expect.any(Function)
    );
  });
});

describe('clear', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChrome.runtime.lastError = null;
  });

  it('should clear storage', async () => {
    mockChrome.storage.local.clear.mockImplementation(callback => {
      callback();
    });

    await clear();

    expect(mockChrome.storage.local.clear).toHaveBeenCalledWith(expect.any(Function));
  });

  it('should clear sync storage', async () => {
    mockChrome.storage.sync.clear.mockImplementation(callback => {
      callback();
    });

    await clear('sync');

    expect(mockChrome.storage.sync.clear).toHaveBeenCalledWith(expect.any(Function));
  });
});

describe('batchGet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChrome.runtime.lastError = null;
  });

  it('should perform batch get successfully', async () => {
    const testData = { key1: 'value1', key2: 'value2' };
    mockChrome.storage.local.get.mockImplementation((keys, callback) => {
      callback(testData);
    });

    const result = await batchGet<typeof testData>(['key1', 'key2']);

    expect(result.success).toEqual(testData);
    expect(result.errors).toEqual({});
    expect(result.allSucceeded).toBe(true);
  });

  it('should handle partial failures', async () => {
    mockChrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({ key1: 'value1' }); // key2 missing
    });

    const result = await batchGet(['key1', 'key2']);

    expect(result.success).toEqual({ key1: 'value1' });
    expect(result.errors).toEqual({ key2: 'Key not found' });
    expect(result.allSucceeded).toBe(false);
  });

  it('should handle complete failures', async () => {
    mockChrome.storage.local.get.mockImplementation(() => {
      throw new Error('Storage failed');
    });

    const result = await batchGet(['key1', 'key2']);

    expect(result.success).toEqual({});
    expect(result.errors.key1).toContain('Storage failed');
    expect(result.errors.key2).toContain('Storage failed');
    expect(result.allSucceeded).toBe(false);
  });
});

describe('batchSet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChrome.runtime.lastError = null;
  });

  it('should perform batch set successfully', async () => {
    const testData = { key1: 'value1', key2: 'value2' };
    mockChrome.storage.local.set.mockImplementation((items, callback) => {
      callback();
    });

    const result = await batchSet(testData);

    expect(result.success).toEqual(testData);
    expect(result.errors).toEqual({});
    expect(result.allSucceeded).toBe(true);
  });

  it('should fallback to individual operations on batch failure', async () => {
    const testData = { key1: 'value1', key2: 'value2' };
    mockChrome.storage.local.set
      .mockImplementationOnce(() => {
        // Batch operation fails
        throw new Error('Batch failed');
      })
      .mockImplementationOnce((items, callback) => {
        // key1 succeeds
        callback();
      })
      .mockImplementationOnce((items, callback) => {
        // key2 fails
        throw new Error('Individual failed');
      });

    const result = await batchSet(testData);

    expect(result.success).toEqual({ key1: 'value1' });
    expect(result.errors.key2).toContain('Individual failed');
    expect(result.allSucceeded).toBe(false);
  });
});

describe('batchRemove', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChrome.runtime.lastError = null;
  });

  it('should perform batch remove successfully', async () => {
    mockChrome.storage.local.remove.mockImplementation((keys, callback) => {
      callback();
    });

    const result = await batchRemove(['key1', 'key2']);

    expect(result.success).toEqual({ key1: true, key2: true });
    expect(result.errors).toEqual({});
    expect(result.allSucceeded).toBe(true);
  });
});

describe('getStorageQuota', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChrome.runtime.lastError = null;
  });

  it('should get local storage quota', async () => {
    if (mockChrome.storage.local.getBytesInUse) {
      mockChrome.storage.local.getBytesInUse.mockImplementation((keys, callback) => {
        callback(1048576); // 1MB used
      });
    }

    const result = await getStorageQuota('local');

    expect(result.used).toBe(1048576);
    expect(result.quota).toBe(5242880);
    expect(result.available).toBe(4194304);
    expect(result.usagePercent).toBeCloseTo(20, 1);
  });

  it('should get sync storage quota', async () => {
    if (mockChrome.storage.sync.getBytesInUse) {
      mockChrome.storage.sync.getBytesInUse.mockImplementation((keys, callback) => {
        callback(51200); // 50KB used
      });
    }

    const result = await getStorageQuota('sync');

    expect(result.used).toBe(51200);
    expect(result.quota).toBe(102400);
    expect(result.available).toBe(51200);
    expect(result.usagePercent).toBe(50);
  });

  it('should handle missing getBytesInUse', async () => {
    delete mockChrome.storage.local.getBytesInUse;

    const result = await getStorageQuota('local');

    expect(result.used).toBe(0);
    expect(result.quota).toBe(5242880);
    expect(result.available).toBe(5242880);
    expect(result.usagePercent).toBe(0);
  });
});

describe('hasStorageSpace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return true when space available', async () => {
    if (mockChrome.storage.local.getBytesInUse) {
      mockChrome.storage.local.getBytesInUse.mockImplementation((keys, callback) => {
        callback(1048576); // 1MB used
      });
    }

    const result = await hasStorageSpace(1048576); // Need 1MB more

    expect(result).toBe(true);
  });

  it('should return false when insufficient space', async () => {
    // Ensure getBytesInUse is available for this test
    mockChrome.storage.local.getBytesInUse = vi.fn((keys, callback) => {
      callback(5200000); // Almost full of 5MB quota (5242880)
    });

    const result = await hasStorageSpace(100000); // Need 100KB more, but only ~40KB available

    expect(result).toBe(false);
  });

  it('should return true on quota check errors', async () => {
    if (mockChrome.storage.local.getBytesInUse) {
      mockChrome.storage.local.getBytesInUse.mockImplementation(() => {
        throw new Error('Quota check failed');
      });
    }

    const result = await hasStorageSpace(1048576);

    expect(result).toBe(true);
  });
});

describe('estimateDataSize', () => {
  it('should estimate data size correctly', () => {
    const testData = { key: 'value', number: 123 };
    const size = estimateDataSize(testData);

    expect(size).toBeGreaterThan(0);
    expect(typeof size).toBe('number');
  });

  it('should handle serialization errors', () => {
    const circularObj: any = {};
    circularObj.self = circularObj; // Create circular reference

    // The function will throw because the fallback also uses JSON.stringify
    expect(() => estimateDataSize(circularObj)).toThrow();
  });
});

describe('addStorageListener', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should add storage change listener', () => {
    const callback = vi.fn();
    const cleanup = addStorageListener(callback);

    expect(mockChrome.storage.onChanged.addListener).toHaveBeenCalledWith(expect.any(Function));
    expect(typeof cleanup).toBe('function');
  });

  it('should filter by storage area', () => {
    const callback = vi.fn();
    addStorageListener(callback, 'sync');

    const listener = mockChrome.storage.onChanged.addListener.mock.calls[0][0];

    // Should not call callback for local changes
    listener({}, 'local');
    expect(callback).not.toHaveBeenCalled();

    // Should call callback for sync changes
    listener({}, 'sync');
    expect(callback).toHaveBeenCalledWith({}, 'sync');
  });

  it('should convert chrome storage changes to typed format', () => {
    const callback = vi.fn();
    addStorageListener(callback);

    const listener = mockChrome.storage.onChanged.addListener.mock.calls[0][0];

    const chromeChanges = {
      testKey: { oldValue: 'old', newValue: 'new' },
    };

    listener(chromeChanges, 'local');

    expect(callback).toHaveBeenCalledWith(
      { testKey: { oldValue: 'old', newValue: 'new' } },
      'local'
    );
  });

  it('should cleanup listener', () => {
    const callback = vi.fn();
    const cleanup = addStorageListener(callback);

    cleanup();

    expect(mockChrome.storage.onChanged.removeListener).toHaveBeenCalled();
  });
});

describe('addKeyListener', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should listen for specific keys', () => {
    const callback = vi.fn();
    addKeyListener(['key1', 'key2'], callback);

    const listener = mockChrome.storage.onChanged.addListener.mock.calls[0][0];

    listener(
      {
        key1: { newValue: 'value1' },
        key3: { newValue: 'value3' },
      },
      'local'
    );

    expect(callback).toHaveBeenCalledWith('key1', { newValue: 'value1' }, 'local');
    expect(callback).not.toHaveBeenCalledWith('key3', expect.anything(), 'local');
  });
});

describe('addSingleKeyListener', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should listen for single key', () => {
    const callback = vi.fn();
    addSingleKeyListener('testKey', callback);

    const listener = mockChrome.storage.onChanged.addListener.mock.calls[0][0];

    listener(
      {
        testKey: { oldValue: 'old', newValue: 'new' },
      },
      'local'
    );

    expect(callback).toHaveBeenCalledWith({ oldValue: 'old', newValue: 'new' }, 'local');
  });
});

describe('has', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return true when key exists', async () => {
    mockChrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({ testKey: 'value' });
    });

    const result = await has('testKey');

    expect(result).toBe(true);
  });

  it('should return false when key does not exist', async () => {
    mockChrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({});
    });

    const result = await has('testKey');

    expect(result).toBe(false);
  });
});

describe('getWithDefault', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return value when key exists', async () => {
    mockChrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({ testKey: 'stored value' });
    });

    const result = await getWithDefault('testKey', 'default value');

    expect(result).toBe('stored value');
  });

  it('should return default when key does not exist', async () => {
    mockChrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({});
    });

    const result = await getWithDefault('testKey', 'default value');

    expect(result).toBe('default value');
  });
});

describe('setIfNotExists', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChrome.runtime.lastError = null;
  });

  it('should set value when key does not exist', async () => {
    mockChrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({}); // Key doesn't exist
    });
    mockChrome.storage.local.set.mockImplementation((items, callback) => {
      callback();
    });

    const result = await setIfNotExists('testKey', 'new value');

    expect(result).toBe(true);
    expect(mockChrome.storage.local.set).toHaveBeenCalledWith(
      { testKey: 'new value' },
      expect.any(Function)
    );
  });

  it('should not set value when key exists', async () => {
    mockChrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({ testKey: 'existing value' });
    });

    const result = await setIfNotExists('testKey', 'new value');

    expect(result).toBe(false);
    expect(mockChrome.storage.local.set).not.toHaveBeenCalled();
  });
});

describe('update', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChrome.runtime.lastError = null;
  });

  it('should update value using transform function', async () => {
    mockChrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({ testKey: 5 });
    });
    mockChrome.storage.local.set.mockImplementation((items, callback) => {
      callback();
    });

    const result = await update('testKey', (current: number | null) => (current || 0) + 10);

    expect(result).toBe(15);
    expect(mockChrome.storage.local.set).toHaveBeenCalledWith(
      { testKey: 15 },
      expect.any(Function)
    );
  });

  it('should handle null current value', async () => {
    mockChrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({}); // Key doesn't exist
    });
    mockChrome.storage.local.set.mockImplementation((items, callback) => {
      callback();
    });

    const result = await update('testKey', (current: number | null) => (current || 0) + 10);

    expect(result).toBe(10);
  });
});

describe('increment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChrome.runtime.lastError = null;
  });

  it('should increment numeric value', async () => {
    mockChrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({ testKey: 5 });
    });
    mockChrome.storage.local.set.mockImplementation((items, callback) => {
      callback();
    });

    const result = await increment('testKey', 3);

    expect(result).toBe(8);
  });

  it('should use default delta of 1', async () => {
    mockChrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({ testKey: 5 });
    });
    mockChrome.storage.local.set.mockImplementation((items, callback) => {
      callback();
    });

    const result = await increment('testKey');

    expect(result).toBe(6);
  });
});

describe('toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChrome.runtime.lastError = null;
  });

  it('should toggle boolean value', async () => {
    mockChrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({ testKey: true });
    });
    mockChrome.storage.local.set.mockImplementation((items, callback) => {
      callback();
    });

    const result = await toggle('testKey');

    expect(result).toBe(false);
    expect(mockChrome.storage.local.set).toHaveBeenCalledWith(
      { testKey: false },
      expect.any(Function)
    );
  });

  it('should handle undefined value as false', async () => {
    mockChrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({});
    });
    mockChrome.storage.local.set.mockImplementation((items, callback) => {
      callback();
    });

    const result = await toggle('testKey');

    expect(result).toBe(true);
  });
});
