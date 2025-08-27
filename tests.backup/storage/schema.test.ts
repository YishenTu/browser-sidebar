/**
 * @file IndexedDB Schema Tests
 *
 * Test-Driven Development (TDD) tests for IndexedDB schema implementation.
 * These tests define the expected behavior before implementing the actual schema.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import FDBFactory from 'fake-indexeddb/lib/FDBFactory';
import FDBKeyRange from 'fake-indexeddb/lib/FDBKeyRange';
import {
  DATABASE_CONFIG,
  OBJECT_STORES,
  createDatabase,
  validateSchema,
  migrateDatabase,
  getSchema,
  type DatabaseSchema,
  type ConversationStore,
  type SettingsStore,
  type APIKeyStore,
  type CacheStore,
  type TabContentStore,
} from '@/storage/schema';

// Setup fake IndexedDB for testing
let fakeIDB: IDBFactory;

beforeEach(() => {
  fakeIDB = new FDBFactory();
  // @ts-expect-error: Mock global indexedDB for tests
  global.indexedDB = fakeIDB;
  // @ts-expect-error: Mock global IDBKeyRange for tests
  global.IDBKeyRange = FDBKeyRange;
});

afterEach(async () => {
  // Clean up any open databases
  const databases = await fakeIDB.databases();
  for (const db of databases) {
    if (db.name) {
      const deleteReq = fakeIDB.deleteDatabase(db.name);
      await new Promise((resolve, reject) => {
        deleteReq.onsuccess = () => resolve(void 0);
        deleteReq.onerror = () => reject(deleteReq.error);
      });
    }
  }
});

describe('Database Configuration', () => {
  it('should have correct database configuration constants', () => {
    expect(DATABASE_CONFIG).toBeDefined();
    expect(DATABASE_CONFIG.name).toBe('BrowserSidebar');
    expect(DATABASE_CONFIG.version).toBe(1);
    expect(DATABASE_CONFIG.description).toContain('AI Browser Sidebar');
  });

  it('should define all required object stores', () => {
    expect(OBJECT_STORES).toBeDefined();
    expect(OBJECT_STORES.CONVERSATIONS).toBe('conversations');
    expect(OBJECT_STORES.SETTINGS).toBe('settings');
    expect(OBJECT_STORES.API_KEYS).toBe('apiKeys');
    expect(OBJECT_STORES.CACHE).toBe('cache');
    expect(OBJECT_STORES.TAB_CONTENT).toBe('tabContent');
  });
});

describe('Schema Validation', () => {
  it('should validate a correct schema', async () => {
    const validSchema: DatabaseSchema = {
      version: 1,
      stores: {
        conversations: {
          keyPath: 'id',
          autoIncrement: false,
          indexes: [
            { name: 'timestamp', keyPath: 'metadata.updatedAt', options: { unique: false } },
            { name: 'archived', keyPath: 'archived', options: { unique: false } },
          ],
        },
        settings: {
          keyPath: 'key',
          autoIncrement: false,
          indexes: [],
        },
        apiKeys: {
          keyPath: 'provider',
          autoIncrement: false,
          indexes: [],
        },
        cache: {
          keyPath: 'key',
          autoIncrement: false,
          indexes: [{ name: 'ttl', keyPath: 'ttl', options: { unique: false } }],
        },
        tabContent: {
          keyPath: 'tabId',
          autoIncrement: false,
          indexes: [
            { name: 'timestamp', keyPath: 'timestamp', options: { unique: false } },
            { name: 'url', keyPath: 'url', options: { unique: false } },
          ],
        },
      },
    };

    const result = await validateSchema(validSchema);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject schema with missing required stores', async () => {
    const invalidSchema: Partial<DatabaseSchema> = {
      version: 1,
      stores: {
        conversations: {
          keyPath: 'id',
          autoIncrement: false,
          indexes: [],
        },
        // Missing other required stores
      },
    };

    const result = await validateSchema(invalidSchema as DatabaseSchema);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Missing required store: settings');
    expect(result.errors).toContain('Missing required store: apiKeys');
  });

  it('should reject schema with invalid keyPath configurations', async () => {
    const invalidSchema: DatabaseSchema = {
      version: 1,
      stores: {
        conversations: {
          keyPath: '', // Invalid empty keyPath
          autoIncrement: false,
          indexes: [],
        },
        settings: {
          keyPath: 'key',
          autoIncrement: false,
          indexes: [],
        },
        apiKeys: {
          keyPath: 'provider',
          autoIncrement: false,
          indexes: [],
        },
        cache: {
          keyPath: 'key',
          autoIncrement: false,
          indexes: [],
        },
        tabContent: {
          keyPath: 'tabId',
          autoIncrement: false,
          indexes: [],
        },
      },
    };

    const result = await validateSchema(invalidSchema);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Invalid keyPath for store conversations');
  });
});

describe('Database Creation', () => {
  it('should create database with correct schema', async () => {
    const db = await createDatabase();

    expect(db.name).toBe(DATABASE_CONFIG.name);
    expect(db.version).toBe(DATABASE_CONFIG.version);

    // Verify all object stores exist
    expect(db.objectStoreNames).toContain(OBJECT_STORES.CONVERSATIONS);
    expect(db.objectStoreNames).toContain(OBJECT_STORES.SETTINGS);
    expect(db.objectStoreNames).toContain(OBJECT_STORES.API_KEYS);
    expect(db.objectStoreNames).toContain(OBJECT_STORES.CACHE);
    expect(db.objectStoreNames).toContain(OBJECT_STORES.TAB_CONTENT);

    db.close();
  });

  it('should create object stores with correct configurations', async () => {
    const db = await createDatabase();

    // Start transaction to inspect store configurations
    const transaction = db.transaction([OBJECT_STORES.CONVERSATIONS], 'readonly');
    const store = transaction.objectStore(OBJECT_STORES.CONVERSATIONS);

    expect(store.keyPath).toBe('id');
    expect(store.autoIncrement).toBe(false);

    db.close();
  });

  it('should create all required indexes', async () => {
    const db = await createDatabase();

    // Check conversations store indexes
    const conversationsTx = db.transaction([OBJECT_STORES.CONVERSATIONS], 'readonly');
    const conversationsStore = conversationsTx.objectStore(OBJECT_STORES.CONVERSATIONS);

    expect(conversationsStore.indexNames).toContain('timestamp');
    expect(conversationsStore.indexNames).toContain('archived');

    // Check cache store indexes
    const cacheTx = db.transaction([OBJECT_STORES.CACHE], 'readonly');
    const cacheStore = cacheTx.objectStore(OBJECT_STORES.CACHE);

    expect(cacheStore.indexNames).toContain('ttl');

    // Check tabContent store indexes
    const tabContentTx = db.transaction([OBJECT_STORES.TAB_CONTENT], 'readonly');
    const tabContentStore = tabContentTx.objectStore(OBJECT_STORES.TAB_CONTENT);

    expect(tabContentStore.indexNames).toContain('timestamp');
    expect(tabContentStore.indexNames).toContain('url');

    db.close();
  });

  it('should handle database creation errors gracefully', async () => {
    // Mock indexedDB to throw an error
    const originalIndexedDB = global.indexedDB;
    // @ts-expect-error: Mock error for test
    global.indexedDB = {
      open: () => {
        throw new Error('Database creation failed');
      },
    };

    await expect(createDatabase()).rejects.toThrow('Database creation failed');

    // Restore original indexedDB
    global.indexedDB = originalIndexedDB;
  });
});

describe('Version Management & Migration', () => {
  it('should migrate from version 0 to version 1', async () => {
    // Simulate an upgrade scenario by directly calling migrateDatabase
    // (fake-indexeddb doesn't allow version 0, so we simulate the upgrade)
    const migratedDb = await migrateDatabase(0, 1);

    expect(migratedDb.version).toBe(1);
    expect(migratedDb.objectStoreNames).toContain(OBJECT_STORES.CONVERSATIONS);
    expect(migratedDb.objectStoreNames).toContain(OBJECT_STORES.SETTINGS);

    migratedDb.close();
  });

  it('should handle multiple version migrations', async () => {
    // Test migrating through multiple versions
    const db = await migrateDatabase(0, 1);
    expect(db.version).toBe(1);

    db.close();

    // Future: test migration from v1 to v2 when implemented
    // const db2 = await migrateDatabase(1, 2);
    // expect(db2.version).toBe(2);
  });

  it('should skip migration if already at target version', async () => {
    // Create database at version 1
    const db1 = await createDatabase();
    db1.close();

    // Attempt to "migrate" to same version
    const db2 = await migrateDatabase(1, 1);
    expect(db2.version).toBe(1);

    db2.close();
  });

  it('should handle migration errors', async () => {
    // Mock a failed migration scenario
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // This should handle gracefully when migration fails
    await expect(migrateDatabase(-1, 1)).rejects.toThrow();

    consoleSpy.mockRestore();
  });
});

describe('Schema Introspection', () => {
  it('should return current database schema', async () => {
    const db = await createDatabase();
    const schema = await getSchema(db);

    expect(schema.version).toBe(DATABASE_CONFIG.version);
    expect(Object.keys(schema.stores)).toHaveLength(5);
    expect(schema.stores.conversations).toBeDefined();
    expect(schema.stores.settings).toBeDefined();
    expect(schema.stores.apiKeys).toBeDefined();
    expect(schema.stores.cache).toBeDefined();
    expect(schema.stores.tabContent).toBeDefined();

    db.close();
  });

  it('should include index information in schema', async () => {
    const db = await createDatabase();
    const schema = await getSchema(db);

    const conversationsStore = schema.stores.conversations;
    expect(conversationsStore.indexes).toBeDefined();
    expect(conversationsStore.indexes.length).toBeGreaterThan(0);

    const timestampIndex = conversationsStore.indexes.find(idx => idx.name === 'timestamp');
    expect(timestampIndex).toBeDefined();
    expect(timestampIndex!.keyPath).toBe('metadata.updatedAt');

    db.close();
  });
});

describe('Type Definitions', () => {
  it('should properly type conversation store data', () => {
    const conversationData: ConversationStore = {
      id: 'conv_123',
      title: 'Test Conversation',
      messages: [],
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messageCount: 0,
      },
      archived: false,
      pinned: false,
    };

    expect(conversationData.id).toBe('conv_123');
    expect(conversationData.metadata.messageCount).toBe(0);
  });

  it('should properly type settings store data', () => {
    const settingsData: SettingsStore = {
      key: 'theme',
      value: 'dark',
      updatedAt: Date.now(),
    };

    expect(settingsData.key).toBe('theme');
    expect(settingsData.value).toBe('dark');
  });

  it('should properly type API key store data', () => {
    const apiKeyData: APIKeyStore = {
      provider: 'openai',
      encryptedKey: 'encrypted_api_key_data',
      createdAt: Date.now(),
      lastUsed: Date.now(),
    };

    expect(apiKeyData.provider).toBe('openai');
    expect(apiKeyData.encryptedKey).toBeDefined();
  });

  it('should properly type cache store data', () => {
    const cacheData: CacheStore = {
      key: 'model_list_cache',
      value: { models: [] },
      ttl: Date.now() + 3600000, // 1 hour from now
      createdAt: Date.now(),
    };

    expect(cacheData.key).toBe('model_list_cache');
    expect(cacheData.ttl).toBeGreaterThan(Date.now());
  });

  it('should properly type tab content store data', () => {
    const tabContentData: TabContentStore = {
      tabId: 123,
      url: 'https://example.com',
      title: 'Example Page',
      content: 'Page content here',
      timestamp: Date.now(),
      metadata: {
        wordCount: 100,
        language: 'en',
      },
    };

    expect(tabContentData.tabId).toBe(123);
    expect(tabContentData.url).toBe('https://example.com');
  });
});
