/**
 * @file Storage Types Tests
 *
 * Test-driven development for storage type definitions.
 * These tests are written FIRST to drive implementation (RED phase).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Import the storage types (will fail initially - RED phase)
import type {
  // Core storage interfaces
  StorageSchema,
  ConversationStorage,
  SettingsStorage,
  APIKeyStorage,
  CacheStorage,

  // Migration types
  StorageVersion,
  MigrationScript,

  // Serialization types
  SerializableValue,
  StorageContainer,

  // Utility types
  StorageKey,
  StorageArea,

  // Cache types
  CacheEntry,
  CacheMetadata,
} from '../../src/types/storage';

import {
  // Type guards
  isStorageSchema,
  isConversationStorage,
  isSettingsStorage,
  isAPIKeyStorage,
  isCacheEntry,
  isCacheStorage,
  isSerializableValue,
  isStorageContainer,

  // Serialization utilities
  serialize,
  deserialize,
  serializeDate,
  deserializeDate,
  serializeMap,
  deserializeMap,
  serializeSet,
  deserializeSet,

  // Storage utilities
  createStorageKey,
  validateStorageKey,
  getStorageArea,

  // Migration utilities
  getCurrentVersion,
  needsMigration,
  applyMigrations,

  // Cache utilities
  createCacheEntry,
  isCacheExpired,
  cleanExpiredCache,
} from '../../src/types/storage';

describe('Storage Types - Core Interfaces', () => {
  describe('StorageSchema', () => {
    it('should define correct storage schema structure', () => {
      const schema: StorageSchema = {
        version: 1,
        conversations: {},
        settings: {
          version: 1,
          theme: 'auto',
          ui: {
            fontSize: 'medium',
            compactMode: false,
            showTimestamps: true,
            showAvatars: true,
            animationsEnabled: true,
          },
          ai: {
            defaultProvider: null,
            temperature: 0.7,
            maxTokens: 2048,
            streamResponse: true,
          },
          privacy: {
            saveConversations: true,
            shareAnalytics: false,
            clearOnClose: false,
          },
          apiKeys: {
            openai: null,
            anthropic: null,
            google: null,
          },
          selectedModel: 'gpt-4',
          availableModels: [],
        },
        apiKeys: {},
        cache: {},
        migrations: [],
      };

      expect(typeof schema.version).toBe('number');
      expect(typeof schema.conversations).toBe('object');
      expect(typeof schema.settings).toBe('object');
      expect(typeof schema.apiKeys).toBe('object');
      expect(typeof schema.cache).toBe('object');
      expect(Array.isArray(schema.migrations)).toBe(true);
    });

    it('should validate storage schema with type guard', () => {
      const validSchema: StorageSchema = {
        version: 1,
        conversations: {},
        settings: {
          version: 1,
          theme: 'auto',
          ui: {
            fontSize: 'medium',
            compactMode: false,
            showTimestamps: true,
            showAvatars: true,
            animationsEnabled: true,
          },
          ai: {
            defaultProvider: null,
            temperature: 0.7,
            maxTokens: 2048,
            streamResponse: true,
          },
          privacy: {
            saveConversations: true,
            shareAnalytics: false,
            clearOnClose: false,
          },
          apiKeys: {
            openai: null,
            anthropic: null,
            google: null,
          },
          selectedModel: 'gpt-4',
          availableModels: [],
        },
        apiKeys: {},
        cache: {},
        migrations: [],
      };

      expect(isStorageSchema(validSchema)).toBe(true);
      expect(isStorageSchema(null)).toBe(false);
      expect(isStorageSchema(undefined)).toBe(false);
      expect(isStorageSchema({})).toBe(false);
      expect(isStorageSchema({ version: 'invalid' })).toBe(false);
    });
  });

  describe('ConversationStorage', () => {
    it('should define correct conversation storage structure', () => {
      const storage: ConversationStorage = {
        id: 'conv_123',
        title: 'Test Conversation',
        messages: [
          {
            id: 'msg_1',
            role: 'user',
            content: 'Hello',
            timestamp: Date.now(),
            status: 'sent',
          },
        ],
        metadata: {
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messageCount: 1,
          model: 'gpt-4',
          totalTokens: 10,
        },
        archived: false,
        pinned: false,
        encrypted: false,
        lastAccessed: Date.now(),
        storageVersion: 1,
      };

      expect(typeof storage.id).toBe('string');
      expect(typeof storage.title).toBe('string');
      expect(Array.isArray(storage.messages)).toBe(true);
      expect(typeof storage.metadata).toBe('object');
      expect(typeof storage.encrypted).toBe('boolean');
      expect(typeof storage.lastAccessed).toBe('number');
      expect(typeof storage.storageVersion).toBe('number');
    });

    it('should validate conversation storage with type guard', () => {
      const validStorage: ConversationStorage = {
        id: 'conv_123',
        title: 'Test',
        messages: [],
        metadata: {
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messageCount: 0,
        },
        encrypted: false,
        lastAccessed: Date.now(),
        storageVersion: 1,
      };

      expect(isConversationStorage(validStorage)).toBe(true);
      expect(isConversationStorage(null)).toBe(false);
      expect(isConversationStorage({ id: 'test' })).toBe(false);
    });
  });

  describe('SettingsStorage', () => {
    it('should define correct settings storage structure', () => {
      const storage: SettingsStorage = {
        version: 1,
        theme: 'dark',
        ui: {
          fontSize: 'large',
          compactMode: true,
          showTimestamps: false,
          showAvatars: false,
          animationsEnabled: false,
        },
        ai: {
          defaultProvider: 'openai',
          temperature: 0.8,
          maxTokens: 4096,
          streamResponse: false,
        },
        privacy: {
          saveConversations: false,
          shareAnalytics: true,
          clearOnClose: true,
        },
        apiKeys: {
          openai: 'key_ref_1',
          anthropic: 'key_ref_2',
          google: null,
        },
        selectedModel: 'claude-3',
        availableModels: [],
        encrypted: true,
        lastModified: Date.now(),
        storageVersion: 1,
      };

      expect(typeof storage.version).toBe('number');
      expect(typeof storage.theme).toBe('string');
      expect(typeof storage.encrypted).toBe('boolean');
      expect(typeof storage.lastModified).toBe('number');
      expect(typeof storage.storageVersion).toBe('number');
    });

    it('should validate settings storage with type guard', () => {
      const validStorage: SettingsStorage = {
        version: 1,
        theme: 'auto',
        ui: {
          fontSize: 'medium',
          compactMode: false,
          showTimestamps: true,
          showAvatars: true,
          animationsEnabled: true,
        },
        ai: {
          defaultProvider: null,
          temperature: 0.7,
          maxTokens: 2048,
          streamResponse: true,
        },
        privacy: {
          saveConversations: true,
          shareAnalytics: false,
          clearOnClose: false,
        },
        apiKeys: {
          openai: null,
          anthropic: null,
          google: null,
        },
        selectedModel: 'gpt-4',
        availableModels: [],
        encrypted: false,
        lastModified: Date.now(),
        storageVersion: 1,
      };

      expect(isSettingsStorage(validStorage)).toBe(true);
      expect(isSettingsStorage(null)).toBe(false);
      expect(isSettingsStorage({})).toBe(false);
    });
  });

  describe('APIKeyStorage', () => {
    it('should define correct API key storage structure', () => {
      const storage: APIKeyStorage = {
        id: 'api_key_1',
        metadata: {
          id: 'api_key_1',
          provider: 'openai',
          keyType: 'standard',
          status: 'active',
          name: 'Test OpenAI Key',
          createdAt: Date.now(),
          lastUsed: Date.now(),
          maskedKey: 'sk-...abc123',
          expiresAt: Date.now() + 86400000, // 24 hours
          permissions: ['read', 'write'],
          tags: ['production']
        },
        encryptedData: {
          algorithm: 'AES-GCM',
          iv: new Uint8Array(12),
          data: new Uint8Array(32),
          version: 1
        },
        keyHash: 'hash_for_verification',
        checksum: 'integrity_checksum',
        storageVersion: 1,
        configuration: {
          rateLimit: {
            requestsPerMinute: 1000,
            enforceLimit: true
          }
        },
        usageStats: {
          totalRequests: 100,
          successfulRequests: 95,
          failedRequests: 5,
          totalTokens: 10000,
          inputTokens: 6000,
          outputTokens: 4000,
          totalCost: 2.50,
          avgRequestTime: 500,
          lastResetAt: Date.now()
        },
        rotationStatus: {
          status: 'none',
          rotationHistory: []
        }
      };

      expect(typeof storage.id).toBe('string');
      expect(storage.metadata.provider).toBe('openai');
      expect(typeof storage.keyHash).toBe('string');
      expect(typeof storage.metadata.createdAt).toBe('number');
      expect(typeof storage.storageVersion).toBe('number');
      expect(typeof storage.usageStats.totalRequests).toBe('number');
      expect(storage.rotationStatus.status).toBe('none');
    });

    it('should validate API key storage with type guard', () => {
      const validStorage: APIKeyStorage = {
        id: 'key_1',
        metadata: {
          id: 'key_1',
          provider: 'openai',
          keyType: 'standard',
          status: 'active',
          name: 'Test Key',
          createdAt: Date.now(),
          lastUsed: Date.now(),
          maskedKey: 'sk-...test'
        },
        encryptedData: {
          algorithm: 'AES-GCM',
          iv: new Uint8Array(12),
          data: new Uint8Array(32),
          version: 1
        },
        keyHash: 'hash',
        checksum: 'checksum',
        storageVersion: 1,
        configuration: {},
        usageStats: {
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
          totalTokens: 0,
          inputTokens: 0,
          outputTokens: 0,
          totalCost: 0,
          avgRequestTime: 0,
          lastResetAt: Date.now()
        },
        rotationStatus: {
          status: 'none',
          rotationHistory: []
        }
      };

      expect(isAPIKeyStorage(validStorage)).toBe(true);
      expect(isAPIKeyStorage(null)).toBe(false);
      expect(isAPIKeyStorage({ provider: 'openai' })).toBe(false);
    });
  });

  describe('CacheStorage', () => {
    it('should define correct cache storage structure', () => {
      const storage: CacheStorage = {
        entries: {
          cache_key_1: {
            key: 'cache_key_1',
            value: { data: 'cached_data' },
            metadata: {
              createdAt: Date.now(),
              expiresAt: Date.now() + 3600000,
              accessCount: 1,
              lastAccessed: Date.now(),
              tags: ['api_response'],
              size: 100,
            },
            storageVersion: 1,
          },
        },
        maxSize: 10485760, // 10MB
        currentSize: 100,
        cleanupInterval: 3600000, // 1 hour
        storageVersion: 1,
      };

      expect(typeof storage.entries).toBe('object');
      expect(typeof storage.maxSize).toBe('number');
      expect(typeof storage.currentSize).toBe('number');
      expect(typeof storage.storageVersion).toBe('number');
    });

    it('should validate cache storage with type guard', () => {
      const validStorage: CacheStorage = {
        entries: {},
        maxSize: 1048576,
        currentSize: 0,
        cleanupInterval: 3600000,
        storageVersion: 1,
      };

      expect(isCacheStorage(validStorage)).toBe(true);
      expect(isCacheStorage(null)).toBe(false);
      expect(isCacheStorage({})).toBe(false);
    });
  });
});

describe('Storage Types - Cache Management', () => {
  describe('CacheEntry', () => {
    it('should define correct cache entry structure', () => {
      const entry: CacheEntry<string> = {
        key: 'test_key',
        value: 'test_value',
        metadata: {
          createdAt: Date.now(),
          expiresAt: Date.now() + 3600000,
          accessCount: 1,
          lastAccessed: Date.now(),
          tags: ['test'],
          size: 10,
        },
        storageVersion: 1,
      };

      expect(typeof entry.key).toBe('string');
      expect(typeof entry.value).toBe('string');
      expect(typeof entry.metadata).toBe('object');
      expect(typeof entry.storageVersion).toBe('number');
    });

    it('should validate cache entry with type guard', () => {
      const validEntry: CacheEntry<object> = {
        key: 'key',
        value: { data: 'test' },
        metadata: {
          createdAt: Date.now(),
          expiresAt: Date.now() + 1000,
          accessCount: 0,
          lastAccessed: Date.now(),
          size: 20,
        },
        storageVersion: 1,
      };

      expect(isCacheEntry(validEntry)).toBe(true);
      expect(isCacheEntry(null)).toBe(false);
      expect(isCacheEntry({ key: 'test' })).toBe(false);
    });

    it('should support generic type parameters', () => {
      const stringEntry: CacheEntry<string> = {
        key: 'str_key',
        value: 'string_value',
        metadata: {
          createdAt: Date.now(),
          expiresAt: Date.now() + 1000,
          accessCount: 1,
          lastAccessed: Date.now(),
          size: 12,
        },
        storageVersion: 1,
      };

      const objectEntry: CacheEntry<{ id: number; name: string }> = {
        key: 'obj_key',
        value: { id: 1, name: 'test' },
        metadata: {
          createdAt: Date.now(),
          expiresAt: Date.now() + 1000,
          accessCount: 1,
          lastAccessed: Date.now(),
          size: 30,
        },
        storageVersion: 1,
      };

      expect(typeof stringEntry.value).toBe('string');
      expect(typeof objectEntry.value).toBe('object');
      expect(typeof objectEntry.value.id).toBe('number');
    });
  });

  describe('Cache Utilities', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should create cache entries with proper structure', () => {
      const entry = createCacheEntry(
        'test_key',
        { data: 'test' },
        {
          expiresIn: 3600000,
          tags: ['test_tag'],
        }
      );

      expect(entry.key).toBe('test_key');
      expect(entry.value).toEqual({ data: 'test' });
      expect(entry.metadata.createdAt).toBe(Date.now());
      expect(entry.metadata.expiresAt).toBe(Date.now() + 3600000);
      expect(entry.metadata.tags).toEqual(['test_tag']);
      expect(entry.metadata.accessCount).toBe(0);
      expect(typeof entry.metadata.size).toBe('number');
    });

    it('should check cache expiration correctly', () => {
      const currentTime = Date.now();

      const expiredEntry = createCacheEntry('expired', 'data', {
        expiresIn: -1000, // Already expired
      });

      const validEntry = createCacheEntry('valid', 'data', {
        expiresIn: 3600000, // 1 hour from now
      });

      expect(isCacheExpired(expiredEntry)).toBe(true);
      expect(isCacheExpired(validEntry)).toBe(false);
    });

    it('should clean expired cache entries', () => {
      const cache: CacheStorage = {
        entries: {
          expired1: createCacheEntry('expired1', 'data', { expiresIn: -1000 }),
          expired2: createCacheEntry('expired2', 'data', { expiresIn: -2000 }),
          valid1: createCacheEntry('valid1', 'data', { expiresIn: 3600000 }),
          valid2: createCacheEntry('valid2', 'data', { expiresIn: 7200000 }),
        },
        maxSize: 1048576,
        currentSize: 400,
        cleanupInterval: 3600000,
        storageVersion: 1,
      };

      const cleaned = cleanExpiredCache(cache);

      expect(Object.keys(cleaned.entries)).toHaveLength(2);
      expect(cleaned.entries.valid1).toBeDefined();
      expect(cleaned.entries.valid2).toBeDefined();
      expect(cleaned.entries.expired1).toBeUndefined();
      expect(cleaned.entries.expired2).toBeUndefined();
      expect(cleaned.currentSize).toBeLessThan(cache.currentSize);
    });
  });
});

describe('Storage Types - Serialization', () => {
  describe('SerializableValue', () => {
    it('should accept primitive types', () => {
      const stringVal: SerializableValue = 'test string';
      const numberVal: SerializableValue = 42;
      const boolVal: SerializableValue = true;
      const nullVal: SerializableValue = null;

      expect(isSerializableValue(stringVal)).toBe(true);
      expect(isSerializableValue(numberVal)).toBe(true);
      expect(isSerializableValue(boolVal)).toBe(true);
      expect(isSerializableValue(nullVal)).toBe(true);
    });

    it('should accept arrays and objects', () => {
      const arrayVal: SerializableValue = [1, 2, 'three'];
      const objectVal: SerializableValue = { id: 1, name: 'test' };

      expect(isSerializableValue(arrayVal)).toBe(true);
      expect(isSerializableValue(objectVal)).toBe(true);
    });

    it('should reject non-serializable types', () => {
      const func = () => {};
      const symbol = Symbol('test');
      const date = new Date();

      expect(isSerializableValue(func)).toBe(false);
      expect(isSerializableValue(symbol)).toBe(false);
      expect(isSerializableValue(date)).toBe(false); // Raw dates not serializable
    });
  });

  describe('Serialization Utilities', () => {
    it('should serialize and deserialize basic values', () => {
      const testValues = ['string', 42, true, null, { id: 1, name: 'test' }, [1, 2, 3]];

      testValues.forEach(value => {
        const serialized = serialize(value);
        const deserialized = deserialize(serialized);
        expect(deserialized).toEqual(value);
      });
    });

    it('should handle Date serialization', () => {
      const testDate = new Date('2024-01-01T12:00:00Z');

      const serialized = serializeDate(testDate);
      const deserialized = deserializeDate(serialized);

      expect(deserialized).toBeInstanceOf(Date);
      expect(deserialized.getTime()).toBe(testDate.getTime());
    });

    it('should handle Map serialization', () => {
      const testMap = new Map([
        ['key1', 'value1'],
        ['key2', 42],
        ['key3', { nested: true }],
      ]);

      const serialized = serializeMap(testMap);
      const deserialized = deserializeMap(serialized);

      expect(deserialized).toBeInstanceOf(Map);
      expect(deserialized.get('key1')).toBe('value1');
      expect(deserialized.get('key2')).toBe(42);
      expect(deserialized.get('key3')).toEqual({ nested: true });
    });

    it('should handle Set serialization', () => {
      const testSet = new Set(['value1', 42, { nested: true }]);

      const serialized = serializeSet(testSet);
      const deserialized = deserializeSet(serialized);

      expect(deserialized).toBeInstanceOf(Set);
      expect(deserialized.has('value1')).toBe(true);
      expect(deserialized.has(42)).toBe(true);
      expect(Array.from(deserialized)).toHaveLength(3);
    });

    it('should handle complex nested structures', () => {
      const complexObject = {
        id: 1,
        name: 'test',
        date: new Date('2024-01-01'),
        map: new Map([['key', 'value']]),
        set: new Set([1, 2, 3]),
        nested: {
          array: [1, 2, { deep: true }],
          nullValue: null,
        },
      };

      const serialized = serialize(complexObject);
      const deserialized = deserialize(serialized);

      expect(deserialized.id).toBe(1);
      expect(deserialized.name).toBe('test');
      expect(deserialized.date).toBeInstanceOf(Date);
      expect(deserialized.map).toBeInstanceOf(Map);
      expect(deserialized.set).toBeInstanceOf(Set);
      expect(deserialized.nested.array).toHaveLength(3);
    });

    it('should preserve type information during serialization', () => {
      const data = {
        date: new Date('2024-01-01'),
        map: new Map([['key', 'value']]),
        set: new Set([1, 2, 3]),
      };

      const serialized = serialize(data);

      // Check that type information is preserved in serialized form
      expect(typeof serialized).toBe('string');
      const parsed = JSON.parse(serialized);
      expect(parsed.__type).toBe('SerializedContainer');
      expect(parsed.data.date.__type).toBe('Date');
      expect(parsed.data.map.__type).toBe('Map');
      expect(parsed.data.set.__type).toBe('Set');
    });
  });

  describe('StorageContainer', () => {
    it('should wrap data with version and metadata', () => {
      const data = { test: 'value' };
      const container: StorageContainer<typeof data> = {
        version: 1,
        data,
        metadata: {
          createdAt: Date.now(),
          serializedAt: Date.now(),
          compressionUsed: false,
          originalSize: 100,
          compressedSize: 100,
        },
      };

      expect(container.version).toBe(1);
      expect(container.data).toEqual(data);
      expect(typeof container.metadata.createdAt).toBe('number');
    });

    it('should validate storage container with type guard', () => {
      const validContainer: StorageContainer<string> = {
        version: 1,
        data: 'test',
        metadata: {
          createdAt: Date.now(),
          serializedAt: Date.now(),
          compressionUsed: false,
          originalSize: 4,
          compressedSize: 4,
        },
      };

      expect(isStorageContainer(validContainer)).toBe(true);
      expect(isStorageContainer(null)).toBe(false);
      expect(isStorageContainer({})).toBe(false);
      expect(isStorageContainer({ version: 1 })).toBe(false);
    });
  });
});

describe('Storage Types - Migration System', () => {
  describe('StorageVersion', () => {
    it('should define version as number', () => {
      const version: StorageVersion = 1;
      expect(typeof version).toBe('number');
      expect(version).toBeGreaterThan(0);
    });
  });

  describe('MigrationScript', () => {
    it('should define correct migration script structure', () => {
      const migration: MigrationScript = {
        version: 2,
        description: 'Add new settings field',
        up: (data: any) => ({
          ...data,
          newField: 'defaultValue',
        }),
        down: (data: any) => {
          const { newField, ...rest } = data;
          return rest;
        },
        validation: (data: any) => {
          return typeof data === 'object' && data !== null;
        },
      };

      expect(typeof migration.version).toBe('number');
      expect(typeof migration.description).toBe('string');
      expect(typeof migration.up).toBe('function');
      expect(typeof migration.down).toBe('function');
      expect(typeof migration.validation).toBe('function');
    });

    it('should execute migration up correctly', () => {
      const migration: MigrationScript = {
        version: 2,
        description: 'Test migration',
        up: (data: any) => ({ ...data, migrated: true }),
        down: (data: any) => {
          const { migrated, ...rest } = data;
          return rest;
        },
      };

      const originalData = { id: 1, name: 'test' };
      const migratedData = migration.up(originalData);

      expect(migratedData.migrated).toBe(true);
      expect(migratedData.id).toBe(1);
      expect(migratedData.name).toBe('test');
    });

    it('should execute migration down correctly', () => {
      const migration: MigrationScript = {
        version: 2,
        description: 'Test migration',
        up: (data: any) => ({ ...data, migrated: true }),
        down: (data: any) => {
          const { migrated, ...rest } = data;
          return rest;
        },
      };

      const migratedData = { id: 1, name: 'test', migrated: true };
      const rolledBackData = migration.down(migratedData);

      expect(rolledBackData.migrated).toBeUndefined();
      expect(rolledBackData.id).toBe(1);
      expect(rolledBackData.name).toBe('test');
    });
  });

  describe('Migration Utilities', () => {
    it('should get current version correctly', () => {
      const version = getCurrentVersion();
      expect(typeof version).toBe('number');
      expect(version).toBeGreaterThan(0);
    });

    it('should check if migration is needed', () => {
      const data = { version: 1 };
      const currentVersion = 2;

      expect(needsMigration(data, currentVersion)).toBe(true);
      expect(needsMigration({ version: 2 }, currentVersion)).toBe(false);
      expect(needsMigration({ version: 3 }, currentVersion)).toBe(false);
    });

    it('should apply migrations in sequence', async () => {
      const migrations: MigrationScript[] = [
        {
          version: 2,
          description: 'Add field A',
          up: (data: any) => ({ ...data, fieldA: 'valueA' }),
          down: (data: any) => {
            const { fieldA, ...rest } = data;
            return rest;
          },
        },
        {
          version: 3,
          description: 'Add field B',
          up: (data: any) => ({ ...data, fieldB: 'valueB' }),
          down: (data: any) => {
            const { fieldB, ...rest } = data;
            return rest;
          },
        },
      ];

      const originalData = { version: 1, id: 'test' };
      const migratedData = await applyMigrations(originalData, migrations);

      expect(migratedData.version).toBe(3);
      expect(migratedData.fieldA).toBe('valueA');
      expect(migratedData.fieldB).toBe('valueB');
      expect(migratedData.id).toBe('test');
    });

    it('should handle migration errors gracefully', async () => {
      const faultyMigration: MigrationScript = {
        version: 2,
        description: 'Faulty migration',
        up: () => {
          throw new Error('Migration failed');
        },
        down: (data: any) => data,
      };

      const originalData = { version: 1 };

      await expect(applyMigrations(originalData, [faultyMigration])).rejects.toThrow(
        'Migration failed'
      );
    });
  });
});

describe('Storage Types - Utilities', () => {
  describe('Storage Key Management', () => {
    it('should create valid storage keys', () => {
      const key = createStorageKey('conversations', 'conv_123');
      expect(typeof key).toBe('string');
      expect(key).toContain('conversations');
      expect(key).toContain('conv_123');
    });

    it('should validate storage keys', () => {
      const validKey: StorageKey = 'conversations:conv_123' as StorageKey;
      const invalidKey = '';

      expect(validateStorageKey(validKey)).toBe(true);
      expect(validateStorageKey(invalidKey as StorageKey)).toBe(false);
    });

    it('should determine storage area correctly', () => {
      const conversationKey = createStorageKey('conversations', 'conv_123');
      const settingsKey = createStorageKey('settings');
      const cacheKey = createStorageKey('cache', 'temp_data');

      expect(getStorageArea(conversationKey)).toBe('local');
      expect(getStorageArea(settingsKey)).toBe('sync');
      expect(getStorageArea(cacheKey)).toBe('local');
    });
  });

  describe('Storage Area Types', () => {
    it('should define correct storage area types', () => {
      const syncArea: StorageArea = 'sync';
      const localArea: StorageArea = 'local';

      expect(['sync', 'local']).toContain(syncArea);
      expect(['sync', 'local']).toContain(localArea);
    });
  });
});

describe('Storage Types - Type Safety', () => {
  it('should enforce type constraints at compile time', () => {
    // These should compile without errors
    const conversationStorage: ConversationStorage = {
      id: 'conv_1',
      title: 'Test',
      messages: [],
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messageCount: 0,
      },
      encrypted: false,
      lastAccessed: Date.now(),
      storageVersion: 1,
    };

    const settingsStorage: SettingsStorage = {
      version: 1,
      theme: 'auto',
      ui: {
        fontSize: 'medium',
        compactMode: false,
        showTimestamps: true,
        showAvatars: true,
        animationsEnabled: true,
      },
      ai: {
        defaultProvider: null,
        temperature: 0.7,
        maxTokens: 2048,
        streamResponse: true,
      },
      privacy: {
        saveConversations: true,
        shareAnalytics: false,
        clearOnClose: false,
      },
      apiKeys: {
        openai: null,
        anthropic: null,
        google: null,
      },
      selectedModel: 'gpt-4',
      availableModels: [],
      encrypted: false,
      lastModified: Date.now(),
      storageVersion: 1,
    };

    expect(conversationStorage).toBeDefined();
    expect(settingsStorage).toBeDefined();
  });

  it('should provide proper TypeScript inference', () => {
    const cacheEntry = createCacheEntry('test', { data: 'value' });

    // TypeScript should infer the generic type correctly
    expect(cacheEntry.value.data).toBe('value');
    expect(typeof cacheEntry.key).toBe('string');
    expect(typeof cacheEntry.metadata.size).toBe('number');
  });
});

describe('Storage Types - Performance', () => {
  it('should handle large data structures efficiently', () => {
    const largeData = Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      data: `item_${i}`,
      nested: {
        values: Array.from({ length: 10 }, (_, j) => j),
      },
    }));

    const startTime = performance.now();
    const serialized = serialize(largeData);
    const deserialized = deserialize(serialized);
    const endTime = performance.now();

    expect(deserialized).toHaveLength(1000);
    expect(endTime - startTime).toBeLessThan(1000); // Should complete in < 1 second
  });

  it('should handle serialization within memory constraints', () => {
    const testData = {
      conversations: Array.from({ length: 100 }, (_, i) => ({
        id: `conv_${i}`,
        messages: Array.from({ length: 50 }, (_, j) => ({
          id: `msg_${j}`,
          content: `Message ${j}`,
          timestamp: Date.now(),
        })),
      })),
    };

    expect(() => serialize(testData)).not.toThrow();

    const serialized = serialize(testData);
    expect(typeof serialized).toBe('string');
    expect(serialized.length).toBeGreaterThan(0);
  });
});
