/**
 * @file IndexedDB Schema Definition
 *
 * Comprehensive IndexedDB schema for the AI Browser Sidebar extension.
 * Includes database configuration, object store definitions, indexes,
 * version management, and schema validation.
 */

import type { Conversation } from '@/types/chat';

// =============================================================================
// Database Configuration
// =============================================================================

export const DATABASE_CONFIG = {
  name: 'BrowserSidebar',
  version: 1,
  description:
    'AI Browser Sidebar Extension - Encrypted local storage for conversations, settings, and API keys',
} as const;

export const OBJECT_STORES = {
  CONVERSATIONS: 'conversations',
  SETTINGS: 'settings',
  API_KEYS: 'apiKeys',
  CACHE: 'cache',
  TAB_CONTENT: 'tabContent',
} as const;

// =============================================================================
// Type Definitions for Store Data
// =============================================================================

/**
 * Conversation store data structure
 * Extends the base Conversation type from chat.ts
 */
export interface ConversationStore extends Conversation {
  // All properties inherited from Conversation type
}

/**
 * Settings store data structure
 * Key-value pairs for all application settings
 */
export interface SettingsStore {
  key: string;
  value: unknown;
  updatedAt: number;
}

/**
 * API key store data structure
 * Encrypted API keys with metadata
 */
export interface APIKeyStore {
  provider: string;
  encryptedKey: string;
  createdAt: number;
  lastUsed?: number;
}

/**
 * Cache store data structure
 * Temporary data storage with TTL
 */
export interface CacheStore {
  key: string;
  value: unknown;
  ttl: number;
  createdAt: number;
}

/**
 * Tab content store data structure
 * Captured web page content for AI analysis
 */
export interface TabContentStore {
  tabId: number;
  url: string;
  title: string;
  content: string;
  timestamp: number;
  metadata?: {
    wordCount?: number;
    language?: string;
    [key: string]: unknown;
  };
}

// =============================================================================
// Schema Definition Types
// =============================================================================

export interface IndexDefinition {
  name: string;
  keyPath: string | string[];
  options?: {
    unique?: boolean;
    multiEntry?: boolean;
  };
}

export interface ObjectStoreDefinition {
  keyPath: string;
  autoIncrement: boolean;
  indexes: IndexDefinition[];
}

export interface DatabaseSchema {
  version: number;
  stores: Record<string, ObjectStoreDefinition>;
}

// =============================================================================
// Schema Definition Constants
// =============================================================================

const REQUIRED_STORES = [
  OBJECT_STORES.CONVERSATIONS,
  OBJECT_STORES.SETTINGS,
  OBJECT_STORES.API_KEYS,
  OBJECT_STORES.CACHE,
  OBJECT_STORES.TAB_CONTENT,
] as const;

const SCHEMA_DEFINITION: DatabaseSchema = {
  version: DATABASE_CONFIG.version,
  stores: {
    [OBJECT_STORES.CONVERSATIONS]: {
      keyPath: 'id',
      autoIncrement: false,
      indexes: [
        { name: 'timestamp', keyPath: 'metadata.updatedAt', options: { unique: false } },
        { name: 'archived', keyPath: 'archived', options: { unique: false } },
      ],
    },
    [OBJECT_STORES.SETTINGS]: {
      keyPath: 'key',
      autoIncrement: false,
      indexes: [],
    },
    [OBJECT_STORES.API_KEYS]: {
      keyPath: 'provider',
      autoIncrement: false,
      indexes: [],
    },
    [OBJECT_STORES.CACHE]: {
      keyPath: 'key',
      autoIncrement: false,
      indexes: [{ name: 'ttl', keyPath: 'ttl', options: { unique: false } }],
    },
    [OBJECT_STORES.TAB_CONTENT]: {
      keyPath: 'tabId',
      autoIncrement: false,
      indexes: [
        { name: 'timestamp', keyPath: 'timestamp', options: { unique: false } },
        { name: 'url', keyPath: 'url', options: { unique: false } },
      ],
    },
  },
};

// =============================================================================
// Schema Validation
// =============================================================================

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export async function validateSchema(schema: DatabaseSchema): Promise<ValidationResult> {
  const errors: string[] = [];

  // Check if schema has required properties
  if (typeof schema.version !== 'number' || schema.version <= 0) {
    errors.push('Schema must have a valid version number');
  }

  if (!schema.stores || typeof schema.stores !== 'object') {
    errors.push('Schema must have a stores object');
    return { isValid: false, errors };
  }

  // Check all required stores exist
  for (const requiredStore of REQUIRED_STORES) {
    if (!schema.stores[requiredStore]) {
      errors.push(`Missing required store: ${requiredStore}`);
    }
  }

  // Validate each store configuration
  for (const [storeName, storeConfig] of Object.entries(schema.stores)) {
    if (
      !storeConfig.keyPath ||
      typeof storeConfig.keyPath !== 'string' ||
      storeConfig.keyPath.trim() === ''
    ) {
      errors.push(`Invalid keyPath for store ${storeName}`);
    }

    if (typeof storeConfig.autoIncrement !== 'boolean') {
      errors.push(`Invalid autoIncrement setting for store ${storeName}`);
    }

    if (!Array.isArray(storeConfig.indexes)) {
      errors.push(`Invalid indexes configuration for store ${storeName}`);
    } else {
      // Validate each index
      for (const index of storeConfig.indexes) {
        if (!index.name || typeof index.name !== 'string') {
          errors.push(`Invalid index name in store ${storeName}`);
        }
        if (
          !index.keyPath ||
          (typeof index.keyPath !== 'string' && !Array.isArray(index.keyPath))
        ) {
          errors.push(`Invalid index keyPath in store ${storeName}`);
        }
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// =============================================================================
// Database Operations
// =============================================================================

export async function createDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_CONFIG.name, DATABASE_CONFIG.version);

    request.onerror = () => {
      reject(new Error(request.error?.message || 'Database creation failed'));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = event => {
      const db = (event.target as IDBOpenDBRequest).result;
      const transaction = (event.target as IDBOpenDBRequest).transaction;

      if (!transaction) {
        reject(new Error('No transaction available during upgrade'));
        return;
      }

      try {
        // Create all object stores according to schema
        for (const [storeName, storeConfig] of Object.entries(SCHEMA_DEFINITION.stores)) {
          let objectStore: IDBObjectStore;

          // Create or get the object store
          if (!db.objectStoreNames.contains(storeName)) {
            objectStore = db.createObjectStore(storeName, {
              keyPath: storeConfig.keyPath,
              autoIncrement: storeConfig.autoIncrement,
            });
          } else {
            objectStore = transaction.objectStore(storeName);
          }

          // Create indexes for the store
          for (const indexConfig of storeConfig.indexes) {
            if (!objectStore.indexNames.contains(indexConfig.name)) {
              objectStore.createIndex(
                indexConfig.name,
                indexConfig.keyPath,
                indexConfig.options || {}
              );
            }
          }
        }
      } catch (error) {
        reject(error);
      }
    };
  });
}

export async function migrateDatabase(
  fromVersion: number,
  toVersion: number
): Promise<IDBDatabase> {
  // If versions are the same, just open the database
  if (fromVersion === toVersion) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_CONFIG.name, toVersion);

      request.onerror = () => {
        reject(new Error(request.error?.message || 'Database migration failed'));
      };

      request.onsuccess = () => {
        resolve(request.result);
      };
    });
  }

  // Handle version upgrades
  if (fromVersion < 0 || toVersion < 1) {
    throw new Error('Invalid version numbers for migration');
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_CONFIG.name, toVersion);

    request.onerror = () => {
      reject(new Error(request.error?.message || 'Database migration failed'));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = event => {
      const db = (event.target as IDBOpenDBRequest).result;
      const transaction = (event.target as IDBOpenDBRequest).transaction;
      const oldVersion = event.oldVersion;
      const newVersion = event.newVersion;

      if (!transaction || newVersion === null) {
        reject(new Error('No transaction available during migration'));
        return;
      }

      try {
        // Migration logic for version upgrades
        if (oldVersion < 1 && newVersion >= 1) {
          // Create initial schema (version 0 to 1)
          for (const [storeName, storeConfig] of Object.entries(SCHEMA_DEFINITION.stores)) {
            let objectStore: IDBObjectStore;

            if (!db.objectStoreNames.contains(storeName)) {
              objectStore = db.createObjectStore(storeName, {
                keyPath: storeConfig.keyPath,
                autoIncrement: storeConfig.autoIncrement,
              });
            } else {
              objectStore = transaction.objectStore(storeName);
            }

            // Create indexes
            for (const indexConfig of storeConfig.indexes) {
              if (!objectStore.indexNames.contains(indexConfig.name)) {
                objectStore.createIndex(
                  indexConfig.name,
                  indexConfig.keyPath,
                  indexConfig.options || {}
                );
              }
            }
          }
        }

        // Future migration logic can be added here
        // if (oldVersion < 2 && newVersion >= 2) { ... }
      } catch (error) {
        reject(error);
      }
    };
  });
}

export async function getSchema(db: IDBDatabase): Promise<DatabaseSchema> {
  const schema: DatabaseSchema = {
    version: db.version,
    stores: {},
  };

  // Inspect each object store
  for (let i = 0; i < db.objectStoreNames.length; i++) {
    const storeName = db.objectStoreNames[i];

    if (!storeName) continue;

    // We need to open a transaction to access store metadata
    const transaction = db.transaction([storeName], 'readonly');
    const objectStore = transaction.objectStore(storeName);

    const indexes: IndexDefinition[] = [];

    // Get all indexes for this store
    for (let j = 0; j < objectStore.indexNames.length; j++) {
      const indexName = objectStore.indexNames[j];

      if (!indexName) continue;

      const index = objectStore.index(indexName);

      indexes.push({
        name: indexName,
        keyPath: index.keyPath as string | string[],
        options: {
          unique: index.unique,
          multiEntry: index.multiEntry,
        },
      });
    }

    schema.stores[storeName] = {
      keyPath: objectStore.keyPath as string,
      autoIncrement: objectStore.autoIncrement,
      indexes,
    };
  }

  return schema;
}
