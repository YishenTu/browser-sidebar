/**
 * @file Storage Types Tests
 *
 * Tests for storage type utilities including serialization,
 * deserialization, type guards, cache helpers, and migrations.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  serialize,
  deserialize,
  serializeDate,
  deserializeDate,
  serializeMap,
  deserializeMap,
  serializeSet,
  deserializeSet,
  createCacheEntry,
  isCacheExpired,
  cleanExpiredCache,
  applyMigrations,
  isSerializableValue,
  isStorageContainer,
  isCacheEntry,
  createStorageKey,
  validateStorageKey,
  getStorageArea,
} from '@/types/storage';
import type { MigrationScript, CacheStorage } from '@/types/storage';

describe('serialize/deserialize', () => {
  describe('basic types', () => {
    it('should serialize and deserialize strings', () => {
      const original = 'Hello, World!';
      const serialized = serialize(original);
      const deserialized = deserialize<string>(serialized);

      expect(deserialized).toBe(original);
    });

    it('should serialize and deserialize numbers', () => {
      const original = 42.5;
      const serialized = serialize(original);
      const deserialized = deserialize<number>(serialized);

      expect(deserialized).toBe(original);
    });

    it('should serialize and deserialize booleans', () => {
      expect(deserialize<boolean>(serialize(true))).toBe(true);
      expect(deserialize<boolean>(serialize(false))).toBe(false);
    });

    it('should serialize and deserialize null', () => {
      const serialized = serialize(null);
      const deserialized = deserialize(serialized);

      expect(deserialized).toBeNull();
    });

    it('should serialize and deserialize arrays', () => {
      const original = [1, 'two', 3, null];
      const serialized = serialize(original);
      const deserialized = deserialize<typeof original>(serialized);

      expect(deserialized).toEqual(original);
    });

    it('should serialize and deserialize objects', () => {
      const original = { name: 'test', value: 123, nested: { deep: true } };
      const serialized = serialize(original);
      const deserialized = deserialize<typeof original>(serialized);

      expect(deserialized).toEqual(original);
    });
  });

  describe('special types', () => {
    it('should serialize and deserialize Date objects', () => {
      const original = new Date('2024-01-15T12:00:00Z');
      const serialized = serialize(original);
      const deserialized = deserialize<Date>(serialized);

      expect(deserialized).toBeInstanceOf(Date);
      expect(deserialized.toISOString()).toBe(original.toISOString());
    });

    it('should serialize and deserialize Map objects', () => {
      const original = new Map<string, number>([
        ['a', 1],
        ['b', 2],
      ]);
      const serialized = serialize(original);
      const deserialized = deserialize<Map<string, number>>(serialized);

      expect(deserialized).toBeInstanceOf(Map);
      expect(deserialized.get('a')).toBe(1);
      expect(deserialized.get('b')).toBe(2);
    });

    it('should serialize and deserialize Set objects', () => {
      const original = new Set([1, 2, 3, 'four']);
      const serialized = serialize(original);
      const deserialized = deserialize<Set<string | number>>(serialized);

      expect(deserialized).toBeInstanceOf(Set);
      expect(deserialized.has(1)).toBe(true);
      expect(deserialized.has('four')).toBe(true);
    });

    it('should serialize nested special types', () => {
      const original = {
        date: new Date('2024-01-15'),
        map: new Map([['key', 'value']]),
        set: new Set([1, 2, 3]),
      };

      const serialized = serialize(original);
      const deserialized = deserialize<typeof original>(serialized);

      expect(deserialized.date).toBeInstanceOf(Date);
      expect(deserialized.map).toBeInstanceOf(Map);
      expect(deserialized.set).toBeInstanceOf(Set);
    });
  });

  describe('error cases', () => {
    it('should throw for unsupported types', () => {
      const func = () => {};

      expect(() => serialize(func)).toThrow('Cannot serialize value');
    });

    it('should throw for invalid serialized data', () => {
      expect(() => deserialize('not valid json{')).toThrow('Failed to deserialize');
    });
  });
});

describe('serializeDate/deserializeDate', () => {
  it('should serialize Date to ISO string format', () => {
    const date = new Date('2024-06-15T10:30:00Z');
    const serialized = serializeDate(date);

    expect(serialized).toEqual({
      __type: 'Date',
      value: '2024-06-15T10:30:00.000Z',
    });
  });

  it('should deserialize back to Date', () => {
    const serialized = { __type: 'Date', value: '2024-06-15T10:30:00.000Z' };
    const date = deserializeDate(serialized);

    expect(date).toBeInstanceOf(Date);
    expect(date.toISOString()).toBe('2024-06-15T10:30:00.000Z');
  });

  it('should throw for invalid format', () => {
    expect(() => deserializeDate('invalid')).toThrow('Invalid serialized Date');
    expect(() => deserializeDate({ __type: 'NotDate', value: '' })).toThrow();
  });
});

describe('serializeMap/deserializeMap', () => {
  it('should serialize Map to entries array', () => {
    const map = new Map([
      ['a', 1],
      ['b', 2],
    ]);
    const serialized = serializeMap(map);

    expect(serialized).toHaveProperty('__type', 'Map');
    expect(serialized).toHaveProperty('entries');
  });

  it('should deserialize back to Map', () => {
    const serialized = {
      __type: 'Map',
      entries: [
        ['a', 1],
        ['b', 2],
      ],
    };
    const map = deserializeMap<string, number>(serialized);

    expect(map).toBeInstanceOf(Map);
    expect(map.get('a')).toBe(1);
  });

  it('should throw for invalid format', () => {
    expect(() => deserializeMap('invalid')).toThrow('Invalid serialized Map');
  });
});

describe('serializeSet/deserializeSet', () => {
  it('should serialize Set to values array', () => {
    const set = new Set([1, 2, 3]);
    const serialized = serializeSet(set);

    expect(serialized).toHaveProperty('__type', 'Set');
    expect(serialized).toHaveProperty('values');
  });

  it('should deserialize back to Set', () => {
    const serialized = { __type: 'Set', values: [1, 2, 3] };
    const set = deserializeSet<number>(serialized);

    expect(set).toBeInstanceOf(Set);
    expect(set.has(2)).toBe(true);
  });

  it('should throw for invalid format', () => {
    expect(() => deserializeSet('invalid')).toThrow('Invalid serialized Set');
  });
});

describe('createCacheEntry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
  });

  it('should create cache entry with default expiration', () => {
    const entry = createCacheEntry('test-key', { data: 'test' });

    expect(entry.key).toBe('test-key');
    expect(entry.value).toEqual({ data: 'test' });
    expect(entry.metadata.createdAt).toBe(Date.now());
    expect(entry.metadata.expiresAt).toBe(Date.now() + 3600000); // 1 hour default
    expect(entry.metadata.accessCount).toBe(0);
    expect(entry.storageVersion).toBeDefined();
  });

  it('should create cache entry with custom expiration', () => {
    const entry = createCacheEntry('test-key', 'value', {
      expiresIn: 60000, // 1 minute
    });

    expect(entry.metadata.expiresAt).toBe(Date.now() + 60000);
  });

  it('should include tags when provided', () => {
    const entry = createCacheEntry('test-key', 'value', {
      tags: ['tag1', 'tag2'],
    });

    expect(entry.metadata.tags).toEqual(['tag1', 'tag2']);
  });
});

describe('isCacheExpired', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
  });

  it('should return false for non-expired entry', () => {
    const entry = createCacheEntry('key', 'value', { expiresIn: 3600000 });

    expect(isCacheExpired(entry)).toBe(false);
  });

  it('should return true for expired entry', () => {
    const entry = createCacheEntry('key', 'value', { expiresIn: 1000 });

    vi.advanceTimersByTime(2000);

    expect(isCacheExpired(entry)).toBe(true);
  });

  it('should return false at exact expiration time', () => {
    const entry = createCacheEntry('key', 'value', { expiresIn: 1000 });

    vi.advanceTimersByTime(1000);

    // At exact expiration time, Date.now() === expiresAt, so NOT expired yet
    expect(isCacheExpired(entry)).toBe(false);
  });
});

describe('cleanExpiredCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
  });

  it('should remove expired entries', () => {
    const expiredEntry = createCacheEntry('expired', 'value1', { expiresIn: 1000 });
    const validEntry = createCacheEntry('valid', 'value2', { expiresIn: 3600000 });

    const cache: CacheStorage = {
      entries: { expired: expiredEntry, valid: validEntry },
      maxSize: 1000000,
      currentSize: 100,
      cleanupInterval: 3600000,
      storageVersion: 1,
    };

    vi.advanceTimersByTime(2000);
    const cleaned = cleanExpiredCache(cache);

    expect(cleaned.entries['expired']).toBeUndefined();
    expect(cleaned.entries['valid']).toBeDefined();
  });

  it('should update currentSize after cleanup', () => {
    const entry = createCacheEntry('key', 'value', { expiresIn: 1000 });

    const cache: CacheStorage = {
      entries: { key: entry },
      maxSize: 1000000,
      currentSize: entry.metadata.size,
      cleanupInterval: 3600000,
      storageVersion: 1,
    };

    vi.advanceTimersByTime(2000);
    const cleaned = cleanExpiredCache(cache);

    expect(cleaned.currentSize).toBe(0);
  });
});

describe('applyMigrations', () => {
  it('should apply migrations in version order', async () => {
    const data = { version: 0, value: 'initial' };

    const migrations: MigrationScript[] = [
      {
        version: 2,
        description: 'Add second field',
        up: d => ({ ...(d as object), second: true }),
        down: d => {
          const { second: _, ...rest } = d as { second?: boolean };
          return rest;
        },
      },
      {
        version: 1,
        description: 'Add first field',
        up: d => ({ ...(d as object), first: true }),
        down: d => {
          const { first: _, ...rest } = d as { first?: boolean };
          return rest;
        },
      },
    ];

    const result = (await applyMigrations(data, migrations)) as {
      version: number;
      first: boolean;
      second: boolean;
    };

    expect(result.version).toBe(2);
    expect(result.first).toBe(true);
    expect(result.second).toBe(true);
  });

  it('should skip already applied migrations', async () => {
    const data = { version: 1, value: 'already migrated' };

    const migrations: MigrationScript[] = [
      {
        version: 1,
        description: 'Already applied',
        up: () => {
          throw new Error('Should not run');
        },
        down: d => d,
      },
      {
        version: 2,
        description: 'New migration',
        up: d => ({ ...(d as object), newField: true }),
        down: d => d,
      },
    ];

    const result = (await applyMigrations(data, migrations)) as {
      version: number;
      newField: boolean;
    };

    expect(result.version).toBe(2);
    expect(result.newField).toBe(true);
  });

  it('should run validation before migration', async () => {
    const data = { version: 0 };

    const migrations: MigrationScript[] = [
      {
        version: 1,
        description: 'With validation',
        up: d => ({ ...(d as object), migrated: true }),
        down: d => d,
        validation: d => (d as { valid?: boolean }).valid === true,
      },
    ];

    await expect(applyMigrations(data, migrations)).rejects.toThrow(
      'Pre-migration validation failed'
    );
  });

  it('should throw descriptive error on migration failure', async () => {
    const data = { version: 0 };

    const migrations: MigrationScript[] = [
      {
        version: 1,
        description: 'Failing migration',
        up: () => {
          throw new Error('Migration error');
        },
        down: d => d,
      },
    ];

    await expect(applyMigrations(data, migrations)).rejects.toThrow(
      'Migration to version 1 failed'
    );
  });
});

describe('isSerializableValue', () => {
  it('should return true for primitives', () => {
    expect(isSerializableValue('string')).toBe(true);
    expect(isSerializableValue(123)).toBe(true);
    expect(isSerializableValue(true)).toBe(true);
    expect(isSerializableValue(null)).toBe(true);
  });

  it('should return true for arrays of primitives', () => {
    expect(isSerializableValue([1, 2, 3])).toBe(true);
    expect(isSerializableValue(['a', 'b'])).toBe(true);
  });

  it('should return true for plain objects', () => {
    expect(isSerializableValue({ key: 'value' })).toBe(true);
    expect(isSerializableValue({ nested: { deep: true } })).toBe(true);
  });

  it('should return false for non-serializable types', () => {
    expect(isSerializableValue(new Date())).toBe(false);
    expect(isSerializableValue(new Map())).toBe(false);
    expect(isSerializableValue(new Set())).toBe(false);
    expect(isSerializableValue(() => {})).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isSerializableValue(undefined)).toBe(false);
  });
});

describe('isStorageContainer', () => {
  it('should return true for valid container', () => {
    const container = {
      version: 1,
      data: { test: true },
      metadata: {
        createdAt: Date.now(),
        serializedAt: Date.now(),
        compressionUsed: false,
        originalSize: 100,
        compressedSize: 100,
      },
    };

    expect(isStorageContainer(container)).toBe(true);
  });

  it('should return false for missing version', () => {
    const container = {
      data: { test: true },
      metadata: { createdAt: Date.now(), serializedAt: Date.now() },
    };

    expect(isStorageContainer(container)).toBe(false);
  });

  it('should return false for null', () => {
    expect(isStorageContainer(null)).toBe(false);
  });
});

describe('isCacheEntry', () => {
  it('should return true for valid cache entry', () => {
    const entry = createCacheEntry('key', 'value');
    expect(isCacheEntry(entry)).toBe(true);
  });

  it('should return false for missing key', () => {
    const entry = { value: 'test', metadata: {}, storageVersion: 1 };
    expect(isCacheEntry(entry)).toBe(false);
  });
});

describe('createStorageKey', () => {
  it('should create namespaced key with id', () => {
    const key = createStorageKey('conversations', '12345');
    expect(key).toBe('conversations:12345');
  });

  it('should create key without id', () => {
    const key = createStorageKey('settings');
    expect(key).toBe('settings');
  });
});

describe('validateStorageKey', () => {
  it('should return true for valid keys', () => {
    expect(validateStorageKey('settings')).toBe(true);
    expect(validateStorageKey('conversations:123')).toBe(true);
  });

  it('should return false for empty string', () => {
    expect(validateStorageKey('')).toBe(false);
  });
});

describe('getStorageArea', () => {
  it('should return sync for settings keys', () => {
    expect(getStorageArea('settings')).toBe('sync');
    expect(getStorageArea('settings:theme')).toBe('sync');
  });

  it('should return sync for apiKeys', () => {
    expect(getStorageArea('apiKeys')).toBe('sync');
  });

  it('should return local for other keys', () => {
    expect(getStorageArea('conversations')).toBe('local');
    expect(getStorageArea('cache')).toBe('local');
  });
});
