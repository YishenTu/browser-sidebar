/**
 * @file Chrome Storage Wrapper Tests
 *
 * Comprehensive test suite for Chrome storage wrapper following TDD approach.
 * Tests cover basic operations, error handling, migrations, and edge cases.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type {
  StorageArea,
  StorageSchema,
  MigrationScript,
  CURRENT_STORAGE_VERSION,
} from '@types/storage';

// Import the functions we'll implement
import {
  get,
  set,
  remove,
  clear,
  getBatch,
  setBatch,
  onChanged,
  migrate,
  getStorageInfo,
  setMaxRetries,
  getMaxRetries,
} from '@/storage/chromeStorage';

describe('chromeStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Add getBytesInUse mock
    (chrome.storage.local as any).getBytesInUse = vi.fn().mockResolvedValue(0);
    (chrome.storage.sync as any).getBytesInUse = vi.fn().mockResolvedValue(0);
    // Add QUOTA_BYTES constants
    Object.defineProperty(chrome.storage.local, 'QUOTA_BYTES', {
      value: 5242880, // 5MB
      configurable: true,
    });
    Object.defineProperty(chrome.storage.sync, 'QUOTA_BYTES', {
      value: 102400, // 100KB
      configurable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('basic operations', () => {
    describe('get', () => {
      it('should retrieve a value from local storage by default', async () => {
        const testData = { id: 'test', name: 'Test Item' };
        vi.mocked(chrome.storage.local.get).mockResolvedValue({ 'test-key': testData });

        const result = await get<typeof testData>('test-key');

        expect(result).toEqual(testData);
        expect(chrome.storage.local.get).toHaveBeenCalledWith(['test-key']);
      });

      it('should retrieve a value from sync storage when specified', async () => {
        const testData = { theme: 'dark' };
        vi.mocked(chrome.storage.sync.get).mockResolvedValue({ 'settings:theme': testData });

        const result = await get<typeof testData>('settings:theme', 'sync');

        expect(result).toEqual(testData);
        expect(chrome.storage.sync.get).toHaveBeenCalledWith(['settings:theme']);
      });

      it('should return null when key does not exist', async () => {
        vi.mocked(chrome.storage.local.get).mockResolvedValue({});

        const result = await get('nonexistent-key');

        expect(result).toBeNull();
      });

      it('should handle Chrome runtime errors', async () => {
        // Mock chrome.runtime.lastError
        const mockError = new Error('Storage quota exceeded');
        vi.mocked(chrome.storage.local.get).mockImplementation(() => {
          (chrome as any).runtime.lastError = mockError;
          return Promise.reject(mockError);
        });

        await expect(get('test-key')).rejects.toThrow('Storage quota exceeded');
      });
    });

    describe('set', () => {
      it('should store a value to local storage by default', async () => {
        const testData = { id: 'test', name: 'Test Item' };
        vi.mocked(chrome.storage.local.set).mockResolvedValue();

        await set('test-key', testData);

        const [[setArgs]] = vi.mocked(chrome.storage.local.set).mock.calls;
        expect(setArgs).toHaveProperty('test-key');
        expect(typeof setArgs['test-key']).toBe('string');
      });

      it('should store a value to sync storage when specified', async () => {
        const testData = { theme: 'dark' };
        vi.mocked(chrome.storage.sync.set).mockResolvedValue();

        await set('settings:theme', testData, 'sync');

        const [[setArgs]] = vi.mocked(chrome.storage.sync.set).mock.calls;
        expect(setArgs).toHaveProperty('settings:theme');
        expect(typeof setArgs['settings:theme']).toBe('string');
      });

      it('should handle Chrome runtime errors', async () => {
        const mockError = new Error('Storage quota exceeded');
        vi.mocked(chrome.storage.local.set).mockImplementation(() => {
          (chrome as any).runtime.lastError = mockError;
          return Promise.reject(mockError);
        });

        await expect(set('test-key', 'test-value')).rejects.toThrow('Storage quota exceeded');
      });

      it('should serialize complex objects correctly', async () => {
        const complexData = {
          date: new Date('2023-01-01'),
          map: new Map([['key', 'value']]),
          set: new Set(['item1', 'item2']),
          nested: { array: [1, 2, 3] },
        };
        vi.mocked(chrome.storage.local.set).mockResolvedValue();

        await set('complex-key', complexData);

        const [[setArgs]] = vi.mocked(chrome.storage.local.set).mock.calls;
        expect(setArgs).toHaveProperty('complex-key');
        // The serialized data should be a string
        expect(typeof setArgs['complex-key']).toBe('string');
        // Should contain serialized container structure
        expect(setArgs['complex-key']).toContain('SerializedContainer');
      });
    });

    describe('remove', () => {
      it('should remove a key from local storage by default', async () => {
        vi.mocked(chrome.storage.local.remove).mockResolvedValue();

        await remove('test-key');

        expect(chrome.storage.local.remove).toHaveBeenCalledWith(['test-key']);
      });

      it('should remove a key from sync storage when specified', async () => {
        vi.mocked(chrome.storage.sync.remove).mockResolvedValue();

        await remove('settings:theme', 'sync');

        expect(chrome.storage.sync.remove).toHaveBeenCalledWith(['settings:theme']);
      });

      it('should handle Chrome runtime errors', async () => {
        const mockError = new Error('Permission denied');
        vi.mocked(chrome.storage.local.remove).mockImplementation(() => {
          (chrome as any).runtime.lastError = mockError;
          return Promise.reject(mockError);
        });

        await expect(remove('test-key')).rejects.toThrow('Permission denied');
      });
    });

    describe('clear', () => {
      it('should clear local storage by default', async () => {
        vi.mocked(chrome.storage.local.clear).mockResolvedValue();

        await clear();

        expect(chrome.storage.local.clear).toHaveBeenCalled();
      });

      it('should clear sync storage when specified', async () => {
        vi.mocked(chrome.storage.sync.clear).mockResolvedValue();

        await clear('sync');

        expect(chrome.storage.sync.clear).toHaveBeenCalled();
      });

      it('should handle Chrome runtime errors', async () => {
        const mockError = new Error('Permission denied');
        vi.mocked(chrome.storage.local.clear).mockImplementation(() => {
          (chrome as any).runtime.lastError = mockError;
          return Promise.reject(mockError);
        });

        await expect(clear()).rejects.toThrow('Permission denied');
      });
    });
  });

  describe('batch operations', () => {
    describe('getBatch', () => {
      it('should retrieve multiple values from local storage', async () => {
        const testData = {
          key1: { value: 'data1' },
          key2: { value: 'data2' },
          key3: { value: 'data3' },
        };
        vi.mocked(chrome.storage.local.get).mockResolvedValue(testData);

        const result = await getBatch(['key1', 'key2', 'key3']);

        expect(result).toEqual(testData);
        expect(chrome.storage.local.get).toHaveBeenCalledWith(['key1', 'key2', 'key3']);
      });

      it('should retrieve multiple values from sync storage', async () => {
        const testData = {
          'settings:theme': { theme: 'dark' },
          'settings:model': { model: 'gpt-4' },
        };
        vi.mocked(chrome.storage.sync.get).mockResolvedValue(testData);

        const result = await getBatch(['settings:theme', 'settings:model'], 'sync');

        expect(result).toEqual(testData);
        expect(chrome.storage.sync.get).toHaveBeenCalledWith(['settings:theme', 'settings:model']);
      });

      it('should handle missing keys by excluding them from results', async () => {
        const testData = { key1: { value: 'data1' } };
        vi.mocked(chrome.storage.local.get).mockResolvedValue(testData);

        const result = await getBatch(['key1', 'key2', 'key3']);

        expect(result).toEqual({ key1: { value: 'data1' } });
      });

      it('should handle Chrome runtime errors', async () => {
        const mockError = new Error('Storage quota exceeded');
        vi.mocked(chrome.storage.local.get).mockImplementation(() => {
          (chrome as any).runtime.lastError = mockError;
          return Promise.reject(mockError);
        });

        await expect(getBatch(['key1', 'key2'])).rejects.toThrow('Storage quota exceeded');
      });
    });

    describe('setBatch', () => {
      it('should store multiple values to local storage', async () => {
        const testData = {
          key1: { value: 'data1' },
          key2: { value: 'data2' },
        };
        vi.mocked(chrome.storage.local.set).mockResolvedValue();

        await setBatch(testData);

        const [[setArgs]] = vi.mocked(chrome.storage.local.set).mock.calls;
        expect(setArgs).toHaveProperty('key1');
        expect(setArgs).toHaveProperty('key2');
        expect(typeof setArgs['key1']).toBe('string');
        expect(typeof setArgs['key2']).toBe('string');
      });

      it('should store multiple values to sync storage', async () => {
        const testData = {
          'settings:theme': { theme: 'dark' },
          'settings:model': { model: 'gpt-4' },
        };
        vi.mocked(chrome.storage.sync.set).mockResolvedValue();

        await setBatch(testData, 'sync');

        const [[setArgs]] = vi.mocked(chrome.storage.sync.set).mock.calls;
        expect(setArgs).toHaveProperty('settings:theme');
        expect(setArgs).toHaveProperty('settings:model');
        expect(typeof setArgs['settings:theme']).toBe('string');
        expect(typeof setArgs['settings:model']).toBe('string');
      });

      it('should serialize complex objects in batch', async () => {
        const testData = {
          key1: { date: new Date('2023-01-01'), map: new Map([['k', 'v']]) },
          key2: { set: new Set(['a', 'b']) },
        };
        vi.mocked(chrome.storage.local.set).mockResolvedValue();

        await setBatch(testData);

        const [[setArgs]] = vi.mocked(chrome.storage.local.set).mock.calls;
        expect(typeof setArgs['key1']).toBe('string');
        expect(typeof setArgs['key2']).toBe('string');
      });

      it('should handle Chrome runtime errors', async () => {
        const mockError = new Error('Storage quota exceeded');
        vi.mocked(chrome.storage.local.set).mockImplementation(() => {
          (chrome as any).runtime.lastError = mockError;
          return Promise.reject(mockError);
        });

        await expect(setBatch({ key: 'value' })).rejects.toThrow('Storage quota exceeded');
      });
    });
  });

  describe('storage listeners', () => {
    describe('onChanged', () => {
      it('should add a listener for storage changes', () => {
        const mockCallback = vi.fn();
        const mockOnChanged = {
          addListener: vi.fn(),
          removeListener: vi.fn(),
          hasListener: vi.fn(),
        };
        (chrome.storage.local as any).onChanged = mockOnChanged;

        const unsubscribe = onChanged(mockCallback);

        expect(mockOnChanged.addListener).toHaveBeenCalledWith(expect.any(Function));
        expect(typeof unsubscribe).toBe('function');
      });

      it('should call callback with parsed storage changes', () => {
        const mockCallback = vi.fn();
        let storageListener: (...args: any[]) => void;

        const mockOnChanged = {
          addListener: vi.fn(listener => {
            storageListener = listener;
          }),
          removeListener: vi.fn(),
          hasListener: vi.fn(),
        };
        (chrome.storage.local as any).onChanged = mockOnChanged;

        onChanged(mockCallback);

        // Simulate storage change
        const changes = {
          'test-key': {
            oldValue: JSON.stringify('old-value'),
            newValue: JSON.stringify('new-value'),
          },
        };
        storageListener!(changes, 'local');

        expect(mockCallback).toHaveBeenCalledWith(
          {
            'test-key': {
              oldValue: 'old-value',
              newValue: 'new-value',
            },
          },
          'local'
        );
      });

      it('should return unsubscribe function that removes the listener', () => {
        const mockCallback = vi.fn();
        let addedListener: (...args: any[]) => void;

        const mockOnChanged = {
          addListener: vi.fn(listener => {
            addedListener = listener;
          }),
          removeListener: vi.fn(),
          hasListener: vi.fn(),
        };
        (chrome.storage.local as any).onChanged = mockOnChanged;

        const unsubscribe = onChanged(mockCallback);
        unsubscribe();

        expect(mockOnChanged.removeListener).toHaveBeenCalledWith(addedListener!);
      });
    });
  });

  describe('migration system', () => {
    describe('migrate', () => {
      it('should apply migrations to data that needs updating', async () => {
        const oldData = { version: 0, settings: { theme: 'light' } };
        const migrations: MigrationScript[] = [
          {
            version: 1,
            description: 'Add default model setting',
            up: data => ({
              ...data,
              settings: { ...data.settings, defaultModel: 'gpt-4' },
            }),
            down: data => {
              const { defaultModel, ...settings } = data.settings;
              return { ...data, settings };
            },
          },
        ];

        vi.mocked(chrome.storage.local.get).mockResolvedValue({
          'storage-schema': JSON.stringify(oldData),
        });
        vi.mocked(chrome.storage.local.set).mockResolvedValue();

        const result = await migrate(migrations);

        expect(result.version).toBe(1);
        expect(result.settings.defaultModel).toBe('gpt-4');
        expect(chrome.storage.local.set).toHaveBeenCalledWith({
          'storage-schema': expect.stringContaining('"version":1'),
        });
      });

      it('should skip migrations when data is already up to date', async () => {
        const currentData = { version: 1, settings: { theme: 'dark' } };
        const migrations: MigrationScript[] = [
          {
            version: 1,
            description: 'Old migration',
            up: data => data,
            down: data => data,
          },
        ];

        vi.mocked(chrome.storage.local.get).mockResolvedValue({
          'storage-schema': JSON.stringify(currentData),
        });

        const result = await migrate(migrations);

        expect(result.version).toBe(1);
        expect(chrome.storage.local.set).not.toHaveBeenCalled();
      });

      it('should handle migration validation failures', async () => {
        const oldData = { version: 0, settings: {} };
        const migrations: MigrationScript[] = [
          {
            version: 1,
            description: 'Migration with validation',
            up: data => ({ ...data, newField: 'value' }),
            down: data => data,
            validation: data => data.settings !== undefined, // This should pass
          },
        ];

        vi.mocked(chrome.storage.local.get).mockResolvedValue({
          'storage-schema': JSON.stringify(oldData),
        });
        vi.mocked(chrome.storage.local.set).mockResolvedValue();

        await expect(migrate(migrations)).resolves.toBeDefined();
      });

      it('should handle missing storage schema by creating default', async () => {
        vi.mocked(chrome.storage.local.get).mockResolvedValue({});
        vi.mocked(chrome.storage.local.set).mockResolvedValue();

        const result = await migrate([]);

        expect(result.version).toBe(1); // CURRENT_STORAGE_VERSION
        expect(chrome.storage.local.set).toHaveBeenCalled();
      });

      it('should handle migration errors gracefully', async () => {
        const oldData = { version: 0 };
        const migrations: MigrationScript[] = [
          {
            version: 1,
            description: 'Failing migration',
            up: () => {
              throw new Error('Migration failed');
            },
            down: data => data,
          },
        ];

        vi.mocked(chrome.storage.local.get).mockResolvedValue({
          'storage-schema': JSON.stringify(oldData),
        });

        await expect(migrate(migrations)).rejects.toThrow('Migration to version 1 failed');
      });
    });
  });

  describe('storage utilities', () => {
    describe('getStorageInfo', () => {
      it('should return storage quota information', async () => {
        vi.mocked(chrome.storage.local.getBytesInUse).mockResolvedValue(1024);
        const mockQuota = 5242880; // 5MB

        Object.defineProperty(chrome.storage.local, 'QUOTA_BYTES', {
          value: mockQuota,
          configurable: true,
        });

        const info = await getStorageInfo();

        expect(info.used).toBe(1024);
        expect(info.quota).toBe(mockQuota);
        expect(info.available).toBe(mockQuota - 1024);
        expect(info.usagePercentage).toBe((1024 / mockQuota) * 100);
      });

      it('should handle missing getBytesInUse method', async () => {
        delete (chrome.storage.local as any).getBytesInUse;

        const info = await getStorageInfo();

        expect(info.used).toBe(0);
        expect(info.available).toBeGreaterThan(0);
      });
    });
  });

  describe('error handling and retries', () => {
    describe('setMaxRetries', () => {
      it('should set the maximum number of retries', () => {
        setMaxRetries(5);
        expect(getMaxRetries()).toBe(5);
      });
    });

    describe('retry mechanism', () => {
      it('should retry failed operations up to max retries', async () => {
        let callCount = 0;
        vi.mocked(chrome.storage.local.get).mockImplementation(() => {
          callCount++;
          if (callCount < 3) {
            return Promise.reject(new Error('Network error'));
          }
          return Promise.resolve({ 'test-key': 'test-value' });
        });

        setMaxRetries(3);
        const result = await get('test-key');

        expect(result).toBe('test-value');
        expect(callCount).toBe(3);
      });

      it('should fail after max retries exceeded', async () => {
        vi.mocked(chrome.storage.local.get).mockRejectedValue(new Error('Persistent error'));

        setMaxRetries(2);
        await expect(get('test-key')).rejects.toThrow('Persistent error');
        expect(chrome.storage.local.get).toHaveBeenCalledTimes(3); // Initial + 2 retries
      });
    });
  });

  describe('type safety', () => {
    it('should maintain type information through get/set cycle', async () => {
      interface TestData {
        id: string;
        count: number;
        active: boolean;
      }

      const testData: TestData = { id: 'test', count: 42, active: true };

      vi.mocked(chrome.storage.local.set).mockResolvedValue();
      vi.mocked(chrome.storage.local.get).mockResolvedValue({
        'test-key': JSON.stringify(testData),
      });

      await set('test-key', testData);
      const result = await get<TestData>('test-key');

      expect(result).toEqual(testData);
      expect(typeof result?.id).toBe('string');
      expect(typeof result?.count).toBe('number');
      expect(typeof result?.active).toBe('boolean');
    });
  });
});
