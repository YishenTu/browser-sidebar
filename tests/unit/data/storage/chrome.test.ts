/**
 * @file Chrome Storage Wrapper Tests
 *
 * Tests for the Chrome storage wrapper that provides type-safe operations
 * with retry behavior, serialization/deserialization, and change listeners.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createChromeStub, type ChromeStubExtended } from '@tests/helpers/chrome';

// Mock the platform chrome storage module
vi.mock('@platform/chrome/storage', () => ({
  get: vi.fn(),
  getMultiple: vi.fn(),
  set: vi.fn(),
  setMultiple: vi.fn(),
  remove: vi.fn(),
  clear: vi.fn(),
  addStorageListener: vi.fn(),
  getStorageQuota: vi.fn(),
}));

// Import after mocks
import * as chromeStorage from '@/data/storage/chrome';
import * as platformStorage from '@platform/chrome/storage';

describe('Chrome Storage Wrapper', () => {
  let chromeStub: ChromeStubExtended;

  beforeEach(() => {
    chromeStub = createChromeStub();
    globalThis.chrome = chromeStub as unknown as typeof chrome;

    // Reset mocks
    vi.clearAllMocks();

    // Reset retry config
    chromeStorage.setMaxRetries(3);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('retry configuration', () => {
    it('should return getMaxRetries', () => {
      chromeStorage.setMaxRetries(5);
      expect(chromeStorage.getMaxRetries()).toBe(5);
    });

    it('should not allow negative maxRetries', () => {
      chromeStorage.setMaxRetries(-1);
      expect(chromeStorage.getMaxRetries()).toBe(0);
    });
  });

  describe('retry behavior', () => {
    it('should retry failed operations and eventually succeed', async () => {
      vi.useFakeTimers();
      chromeStorage.setMaxRetries(2);

      vi.mocked(platformStorage.get)
        .mockRejectedValueOnce(new Error('fail-1'))
        .mockRejectedValueOnce(new Error('fail-2'))
        .mockResolvedValueOnce('ok');

      const promise = chromeStorage.get('retry-key');
      const assertion = expect(promise).resolves.toBe('ok');

      await vi.runAllTimersAsync();
      await assertion;
      expect(platformStorage.get).toHaveBeenCalledTimes(3);

      vi.useRealTimers();
    });

    it('should throw after exceeding max retries', async () => {
      vi.useFakeTimers();
      chromeStorage.setMaxRetries(1);

      vi.mocked(platformStorage.get).mockRejectedValue(new Error('always-fail'));

      const promise = chromeStorage.get('retry-key');
      const assertion = expect(promise).rejects.toThrow('always-fail');

      await vi.runAllTimersAsync();
      await assertion;
      expect(platformStorage.get).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });
  });

  describe('serialization/deserialization paths', () => {
    describe('get', () => {
      it('should deserialize string values', async () => {
        const serialized =
          '{"__type":"SerializedContainer","version":1,"data":{"name":"test","count":42},"metadata":{"createdAt":0,"serializedAt":0,"compressionUsed":false,"originalSize":0,"compressedSize":0}}';

        vi.mocked(platformStorage.get).mockResolvedValue(serialized);

        const result = await chromeStorage.get<{ name: string; count: number }>('test-key');

        expect(result).toEqual({ name: 'test', count: 42 });
      });

      it('should return raw value if deserialization fails', async () => {
        vi.mocked(platformStorage.get).mockResolvedValue('not-valid-json{');

        const result = await chromeStorage.get('test-key');

        expect(result).toBe('not-valid-json{');
      });

      it('should return non-string values directly', async () => {
        vi.mocked(platformStorage.get).mockResolvedValue({ direct: 'object' });

        const result = await chromeStorage.get('test-key');

        expect(result).toEqual({ direct: 'object' });
      });

      it('should return null for missing values', async () => {
        vi.mocked(platformStorage.get).mockResolvedValue(null);

        const result = await chromeStorage.get('missing-key');

        expect(result).toBeNull();
      });

      it('should return null for undefined values', async () => {
        vi.mocked(platformStorage.get).mockResolvedValue(undefined);

        const result = await chromeStorage.get('undefined-key');

        expect(result).toBeNull();
      });
    });

    describe('set', () => {
      it('should serialize complex objects', async () => {
        vi.mocked(platformStorage.set).mockResolvedValue(undefined);

        await chromeStorage.set('test-key', { name: 'test', nested: { value: 123 } });

        expect(platformStorage.set).toHaveBeenCalledWith(
          'test-key',
          expect.stringContaining('SerializedContainer'),
          'local'
        );
      });

      it('should not serialize Date instances', async () => {
        vi.mocked(platformStorage.set).mockResolvedValue(undefined);
        const date = new Date('2024-01-01');

        await chromeStorage.set('date-key', date);

        expect(platformStorage.set).toHaveBeenCalledWith('date-key', date, 'local');
      });

      it('should not serialize arrays', async () => {
        vi.mocked(platformStorage.set).mockResolvedValue(undefined);
        const arr = [1, 2, 3];

        await chromeStorage.set('array-key', arr);

        expect(platformStorage.set).toHaveBeenCalledWith('array-key', arr, 'local');
      });

      it('should not serialize null', async () => {
        vi.mocked(platformStorage.set).mockResolvedValue(undefined);

        await chromeStorage.set('null-key', null);

        expect(platformStorage.set).toHaveBeenCalledWith('null-key', null, 'local');
      });

      it('should not serialize primitives', async () => {
        vi.mocked(platformStorage.set).mockResolvedValue(undefined);

        await chromeStorage.set('string-key', 'hello');
        await chromeStorage.set('number-key', 42);
        await chromeStorage.set('bool-key', true);

        expect(platformStorage.set).toHaveBeenCalledWith('string-key', 'hello', 'local');
        expect(platformStorage.set).toHaveBeenCalledWith('number-key', 42, 'local');
        expect(platformStorage.set).toHaveBeenCalledWith('bool-key', true, 'local');
      });
    });

    describe('getBatch', () => {
      it('should deserialize string values in batch', async () => {
        const serialized1 =
          '{"__type":"SerializedContainer","version":1,"data":{"a":1},"metadata":{"createdAt":0,"serializedAt":0,"compressionUsed":false,"originalSize":0,"compressedSize":0}}';
        const serialized2 =
          '{"__type":"SerializedContainer","version":1,"data":{"b":2},"metadata":{"createdAt":0,"serializedAt":0,"compressionUsed":false,"originalSize":0,"compressedSize":0}}';

        vi.mocked(platformStorage.getMultiple).mockResolvedValue({
          key1: serialized1,
          key2: serialized2,
        });

        const result = await chromeStorage.getBatch(['key1', 'key2']);

        expect(result).toEqual({
          key1: { a: 1 },
          key2: { b: 2 },
        });
      });

      it('should preserve non-string values in batch', async () => {
        vi.mocked(platformStorage.getMultiple).mockResolvedValue({
          key1: { direct: 'object' },
          key2: 123,
        });

        const result = await chromeStorage.getBatch(['key1', 'key2']);

        expect(result).toEqual({
          key1: { direct: 'object' },
          key2: 123,
        });
      });

      it('should return raw string if deserialization fails', async () => {
        vi.mocked(platformStorage.getMultiple).mockResolvedValue({
          key1: 'invalid-json{',
        });

        const result = await chromeStorage.getBatch(['key1']);

        expect(result).toEqual({
          key1: 'invalid-json{',
        });
      });
    });

    describe('setBatch', () => {
      it('should serialize complex objects in batch', async () => {
        vi.mocked(platformStorage.setMultiple).mockResolvedValue(undefined);

        await chromeStorage.setBatch({
          key1: { name: 'test1' },
          key2: { name: 'test2' },
        });

        const calledWith = vi.mocked(platformStorage.setMultiple).mock.calls[0]?.[0] as Record<
          string,
          unknown
        >;
        expect(typeof calledWith['key1']).toBe('string');
        expect(calledWith['key1']).toContain('SerializedContainer');
      });

      it('should not serialize non-objects in batch', async () => {
        vi.mocked(platformStorage.setMultiple).mockResolvedValue(undefined);

        await chromeStorage.setBatch({
          stringKey: 'hello',
          numberKey: 42,
          arrayKey: [1, 2, 3],
        });

        const calledWith = vi.mocked(platformStorage.setMultiple).mock.calls[0]?.[0] as Record<
          string,
          unknown
        >;
        expect(calledWith['stringKey']).toBe('hello');
        expect(calledWith['numberKey']).toBe(42);
        expect(calledWith['arrayKey']).toEqual([1, 2, 3]);
      });
    });
  });

  describe('onChanged listener wrapper', () => {
    it('should deserialize string oldValue and newValue', () => {
      const mockCallback = vi.fn();
      const mockRemoveListener = vi.fn();

      vi.mocked(platformStorage.addStorageListener).mockImplementation(callback => {
        const serializedOld =
          '{"__type":"SerializedContainer","version":1,"data":{"old":"value"},"metadata":{"createdAt":0,"serializedAt":0,"compressionUsed":false,"originalSize":0,"compressedSize":0}}';
        const serializedNew =
          '{"__type":"SerializedContainer","version":1,"data":{"new":"value"},"metadata":{"createdAt":0,"serializedAt":0,"compressionUsed":false,"originalSize":0,"compressedSize":0}}';

        callback(
          {
            testKey: { oldValue: serializedOld, newValue: serializedNew },
          },
          'local'
        );

        return mockRemoveListener;
      });

      chromeStorage.onChanged(mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(
        {
          testKey: {
            oldValue: { old: 'value' },
            newValue: { new: 'value' },
          },
        },
        'local'
      );
    });

    it('should pass through non-string values unchanged', () => {
      const mockCallback = vi.fn();

      vi.mocked(platformStorage.addStorageListener).mockImplementation(callback => {
        callback(
          {
            testKey: { oldValue: { direct: 'old' }, newValue: { direct: 'new' } },
          },
          'local'
        );
        return vi.fn();
      });

      chromeStorage.onChanged(mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(
        {
          testKey: {
            oldValue: { direct: 'old' },
            newValue: { direct: 'new' },
          },
        },
        'local'
      );
    });

    it('should handle undefined oldValue and newValue', () => {
      const mockCallback = vi.fn();

      vi.mocked(platformStorage.addStorageListener).mockImplementation(callback => {
        callback(
          {
            testKey: { oldValue: undefined, newValue: 'new' },
          },
          'local'
        );
        return vi.fn();
      });

      chromeStorage.onChanged(mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(
        {
          testKey: {
            newValue: 'new',
          },
        },
        'local'
      );
    });

    it('should return cleanup function', () => {
      const mockRemoveListener = vi.fn();

      vi.mocked(platformStorage.addStorageListener).mockReturnValue(mockRemoveListener);

      const cleanup = chromeStorage.onChanged(vi.fn());

      expect(typeof cleanup).toBe('function');
      expect(cleanup).toBe(mockRemoveListener);
    });

    it('should fallback to raw value if deserialization fails', () => {
      const mockCallback = vi.fn();

      vi.mocked(platformStorage.addStorageListener).mockImplementation(callback => {
        callback(
          {
            testKey: { oldValue: 'invalid-json{', newValue: 'also-invalid{' },
          },
          'local'
        );
        return vi.fn();
      });

      chromeStorage.onChanged(mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(
        {
          testKey: {
            oldValue: 'invalid-json{',
            newValue: 'also-invalid{',
          },
        },
        'local'
      );
    });
  });

  describe('basic operations', () => {
    it('should call remove with correct parameters', async () => {
      vi.mocked(platformStorage.remove).mockResolvedValue(undefined);

      await chromeStorage.remove('test-key', 'sync');

      expect(platformStorage.remove).toHaveBeenCalledWith('test-key', 'sync');
    });

    it('should call clear with correct parameters', async () => {
      vi.mocked(platformStorage.clear).mockResolvedValue(undefined);

      await chromeStorage.clear('local');

      expect(platformStorage.clear).toHaveBeenCalledWith('local');
    });

    it('should use local as default storage area', async () => {
      vi.mocked(platformStorage.get).mockResolvedValue('value');
      vi.mocked(platformStorage.set).mockResolvedValue(undefined);
      vi.mocked(platformStorage.remove).mockResolvedValue(undefined);
      vi.mocked(platformStorage.clear).mockResolvedValue(undefined);

      await chromeStorage.get('key');
      await chromeStorage.set('key', 'value');
      await chromeStorage.remove('key');
      await chromeStorage.clear();

      expect(platformStorage.get).toHaveBeenCalledWith('key', 'local');
      expect(platformStorage.set).toHaveBeenCalledWith('key', 'value', 'local');
      expect(platformStorage.remove).toHaveBeenCalledWith('key', 'local');
      expect(platformStorage.clear).toHaveBeenCalledWith('local');
    });
  });

  describe('getStorageInfo', () => {
    it('should return formatted storage info', async () => {
      vi.mocked(platformStorage.getStorageQuota).mockResolvedValue({
        used: 1000,
        quota: 5242880,
        available: 5241880,
        usagePercent: 0.019,
      });

      const info = await chromeStorage.getStorageInfo('local');

      expect(info).toEqual({
        used: 1000,
        quota: 5242880,
        available: 5241880,
        usagePercentage: 0.019,
      });
    });

    it('should use local as default storage area', async () => {
      vi.mocked(platformStorage.getStorageQuota).mockResolvedValue({
        used: 0,
        quota: 5242880,
        available: 5242880,
        usagePercent: 0,
      });

      await chromeStorage.getStorageInfo();

      expect(platformStorage.getStorageQuota).toHaveBeenCalledWith('local');
    });
  });

  describe('migrate', () => {
    it('should create default schema when none exists', async () => {
      vi.mocked(platformStorage.get).mockResolvedValue(null);
      vi.mocked(platformStorage.set).mockResolvedValue(undefined);

      const result = await chromeStorage.migrate([]);

      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('conversations');
      expect(result).toHaveProperty('settings');
      expect(result).toHaveProperty('apiKeys');
      expect(result).toHaveProperty('cache');
      expect(platformStorage.set).toHaveBeenCalled();
    });

    it('should apply migrations to existing data', async () => {
      const existingData = {
        version: 0,
        conversations: {},
        settings: { version: 0 },
        apiKeys: {},
        cache: { entries: {} },
        migrations: [],
      };

      vi.mocked(platformStorage.get).mockResolvedValue(existingData);
      vi.mocked(platformStorage.set).mockResolvedValue(undefined);

      const migrations = [
        {
          version: 1,
          description: 'Add new field',
          up: (data: unknown) => ({ ...(data as object), newField: true, version: 1 }),
          down: (data: unknown) => {
            const { newField: _, ...rest } = data as { newField: boolean };
            return rest;
          },
        },
      ];

      const result = await chromeStorage.migrate(migrations);

      expect(result).toHaveProperty('newField', true);
      expect(result.version).toBe(1);
    });

    it('should not save when no changes needed', async () => {
      const existingData = {
        version: 5,
        conversations: {},
        settings: {},
        apiKeys: {},
        cache: { entries: {} },
        migrations: [],
      };

      vi.mocked(platformStorage.get).mockResolvedValue(existingData);

      const migrations = [
        {
          version: 1,
          description: 'Old migration',
          up: (data: unknown) => data,
          down: (data: unknown) => data,
        },
      ];

      await chromeStorage.migrate(migrations);

      expect(platformStorage.set).not.toHaveBeenCalled();
    });
  });
});
