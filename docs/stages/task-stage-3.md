# Stage 3: Storage & Security - Detailed Task Breakdown

## Stage Overview
**Goal:** Implement secure storage layer with encryption for API keys, conversation persistence, and sensitive data protection using Test-Driven Development.

**Duration:** Estimated 1.5 weeks
**Total Tasks:** 18
**Parallelizable:** 10 (56%)
**Sequential:** 8 (44%)

## Prerequisites from Previous Stages
- [x] Chrome extension APIs mocked (Stage 1)
- [x] Message passing system working (Stage 1)
- [x] TypeScript configured with strict mode (Stage 1)
- [x] Testing infrastructure ready (Stage 1)
- [x] Basic UI components available (Stage 2)

## Stage 3 Deliverables
By the end of this stage, you will have:
1. ✅ Chrome storage wrapper with migrations
2. ✅ IndexedDB for conversation storage
3. ✅ AES-256-GCM encryption for API keys
4. ✅ Sensitive data detection and masking
5. ✅ Cache management with TTL
6. ✅ Data cleanup utilities
7. ✅ Complete test coverage for security features

---

## Phase 3.1: Storage Foundation (6 tasks)
**Goal:** Set up storage infrastructure with Chrome Storage API and IndexedDB

### 🔄 Parallel Block A: Chrome Storage (3 tasks)

#### Task 3.1.1a - Storage Types 🧪
**Status:** [ ] Not Started
**Assignee:** 
**Dependencies:** Stage 1 complete

**Test Requirements:**
```typescript
// tests/types/storage.test.ts
import { describe, it, expect } from 'vitest';
import {
  StorageSchema,
  validateStorageData,
  migrateStorageData,
  serializeForStorage,
  deserializeFromStorage
} from '@/types/storage';

describe('Storage Types', () => {
  it('should validate storage schema', () => {
    const validData: StorageSchema = {
      version: 1,
      settings: {
        theme: 'dark',
        provider: 'openai',
        fontSize: 'medium'
      },
      apiKeys: {},
      cache: {}
    };
    
    expect(validateStorageData(validData)).toBe(true);
  });
  
  it('should reject invalid storage data', () => {
    const invalidData = {
      version: 'invalid',
      settings: null
    };
    
    expect(validateStorageData(invalidData)).toBe(false);
  });
  
  it('should serialize and deserialize correctly', () => {
    const original = {
      settings: { theme: 'dark' },
      timestamp: Date.now(),
      metadata: new Map([['key', 'value']])
    };
    
    const serialized = serializeForStorage(original);
    expect(typeof serialized).toBe('string');
    
    const deserialized = deserializeFromStorage(serialized);
    expect(deserialized.settings.theme).toBe('dark');
    expect(deserialized.metadata.get('key')).toBe('value');
  });
  
  it('should handle circular references in serialization', () => {
    const obj: any = { name: 'test' };
    obj.circular = obj;
    
    expect(() => serializeForStorage(obj)).not.toThrow();
  });
});
```

**Implementation Steps:**
1. Create storage type definitions:
   ```typescript
   // src/types/storage.ts
   export interface StorageSchema {
     version: number;
     settings: {
       theme: 'light' | 'dark' | 'auto';
       provider: string;
       model?: string;
       fontSize: 'small' | 'medium' | 'large';
       [key: string]: any;
     };
     apiKeys: {
       [provider: string]: string; // Encrypted
     };
     cache: {
       [key: string]: {
         data: any;
         expiry: number;
       };
     };
     conversations?: {
       lastConversationId?: string;
       conversationIds?: string[];
     };
   }

   export interface StorageMetadata {
     lastModified: number;
     syncStatus?: 'synced' | 'pending' | 'error';
     deviceId?: string;
   }

   export const STORAGE_VERSION = 1;

   export function validateStorageData(data: any): data is StorageSchema {
     return (
       typeof data === 'object' &&
       typeof data.version === 'number' &&
       typeof data.settings === 'object' &&
       typeof data.apiKeys === 'object' &&
       typeof data.cache === 'object'
     );
   }

   export function createDefaultStorage(): StorageSchema {
     return {
       version: STORAGE_VERSION,
       settings: {
         theme: 'auto',
         provider: 'openai',
         fontSize: 'medium',
       },
       apiKeys: {},
       cache: {},
       conversations: {
         conversationIds: [],
       },
     };
   }

   // Serialization utilities for complex types
   export function serializeForStorage(data: any): string {
     return JSON.stringify(data, (key, value) => {
       // Handle Map
       if (value instanceof Map) {
         return {
           _type: 'Map',
           data: Array.from(value.entries()),
         };
       }
       // Handle Set
       if (value instanceof Set) {
         return {
           _type: 'Set',
           data: Array.from(value),
         };
       }
       // Handle Date
       if (value instanceof Date) {
         return {
           _type: 'Date',
           data: value.toISOString(),
         };
       }
       // Handle undefined (JSON.stringify removes undefined)
       if (value === undefined) {
         return {
           _type: 'undefined',
         };
       }
       return value;
     });
   }

   export function deserializeFromStorage(json: string): any {
     return JSON.parse(json, (key, value) => {
       if (value && typeof value === 'object' && value._type) {
         switch (value._type) {
           case 'Map':
             return new Map(value.data);
           case 'Set':
             return new Set(value.data);
           case 'Date':
             return new Date(value.data);
           case 'undefined':
             return undefined;
         }
       }
       return value;
     });
   }
   ```

**Deliverables:**
- `src/types/storage.ts` - Storage type definitions
- Schema validation functions
- Serialization/deserialization utilities
- Default storage factory
- Type guards

**Acceptance Criteria:**
- [ ] Types cover all storage needs
- [ ] Validation functions work correctly
- [ ] Serialization handles complex types
- [ ] No circular reference issues
- [ ] Tests pass

---

#### Task 3.1.1b - Chrome Storage Wrapper 🧪
**Status:** [ ] Not Started
**Assignee:** 
**Dependencies:** Task 3.1.1a, Chrome API mocks from Stage 1

**Test Requirements:**
```typescript
// tests/storage/chromeStorage.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChromeStorage } from '@/storage/chromeStorage';

describe('Chrome Storage Wrapper', () => {
  let storage: ChromeStorage;
  
  beforeEach(() => {
    storage = new ChromeStorage();
    chrome.storage.local.clear();
  });
  
  it('should get and set values', async () => {
    await storage.set('testKey', { value: 'test' });
    const result = await storage.get('testKey');
    
    expect(result).toEqual({ value: 'test' });
  });
  
  it('should get multiple values', async () => {
    await storage.set('key1', 'value1');
    await storage.set('key2', 'value2');
    
    const result = await storage.getMultiple(['key1', 'key2']);
    
    expect(result.key1).toBe('value1');
    expect(result.key2).toBe('value2');
  });
  
  it('should return default value if key not found', async () => {
    const result = await storage.get('nonexistent', 'default');
    expect(result).toBe('default');
  });
  
  it('should remove values', async () => {
    await storage.set('toRemove', 'value');
    await storage.remove('toRemove');
    
    const result = await storage.get('toRemove');
    expect(result).toBeUndefined();
  });
  
  it('should clear all storage', async () => {
    await storage.set('key1', 'value1');
    await storage.set('key2', 'value2');
    await storage.clear();
    
    const result = await storage.getMultiple(['key1', 'key2']);
    expect(result).toEqual({});
  });
  
  it('should handle storage quota errors', async () => {
    // Mock quota exceeded error
    chrome.storage.local.set = vi.fn().mockRejectedValue(
      new Error('QUOTA_BYTES quota exceeded')
    );
    
    await expect(storage.set('key', 'value')).rejects.toThrow('Storage quota exceeded');
  });
  
  it('should emit change events', async () => {
    const listener = vi.fn();
    storage.onChange('testKey', listener);
    
    await storage.set('testKey', 'newValue');
    
    expect(listener).toHaveBeenCalledWith('newValue', undefined);
  });
  
  it('should calculate storage usage', async () => {
    await storage.set('key1', 'a'.repeat(1000));
    await storage.set('key2', 'b'.repeat(2000));
    
    const usage = await storage.getUsage();
    
    expect(usage.bytesUsed).toBeGreaterThan(3000);
    expect(usage.quota).toBeDefined();
    expect(usage.percentUsed).toBeDefined();
  });
});
```

**Implementation Steps:**
1. Create Chrome storage wrapper:
   ```typescript
   // src/storage/chromeStorage.ts
   import { StorageSchema } from '@/types/storage';

   export class ChromeStorage {
     private listeners = new Map<string, Set<Function>>();
     private cache = new Map<string, { value: any; timestamp: number }>();
     private readonly CACHE_TTL = 5000; // 5 seconds
     
     constructor() {
       this.setupChangeListener();
     }
     
     private setupChangeListener() {
       chrome.storage.onChanged.addListener((changes, areaName) => {
         if (areaName !== 'local') return;
         
         Object.entries(changes).forEach(([key, change]) => {
           const listeners = this.listeners.get(key);
           if (listeners) {
             listeners.forEach(listener => {
               listener(change.newValue, change.oldValue);
             });
           }
         });
       });
     }
     
     async get<T = any>(key: string, defaultValue?: T): Promise<T | undefined> {
       // Check cache first
       const cached = this.cache.get(key);
       if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
         return cached.value;
       }
       
       try {
         const result = await chrome.storage.local.get(key);
         const value = result[key] ?? defaultValue;
         
         // Update cache
         if (value !== undefined) {
           this.cache.set(key, { value, timestamp: Date.now() });
         }
         
         return value;
       } catch (error) {
         this.handleStorageError(error);
         return defaultValue;
       }
     }
     
     async getMultiple(keys: string[]): Promise<Record<string, any>> {
       try {
         return await chrome.storage.local.get(keys);
       } catch (error) {
         this.handleStorageError(error);
         return {};
       }
     }
     
     async set(key: string, value: any): Promise<void> {
       try {
         await chrome.storage.local.set({ [key]: value });
         
         // Update cache
         this.cache.set(key, { value, timestamp: Date.now() });
       } catch (error) {
         this.handleStorageError(error);
       }
     }
     
     async setMultiple(items: Record<string, any>): Promise<void> {
       try {
         await chrome.storage.local.set(items);
         
         // Update cache
         Object.entries(items).forEach(([key, value]) => {
           this.cache.set(key, { value, timestamp: Date.now() });
         });
       } catch (error) {
         this.handleStorageError(error);
       }
     }
     
     async remove(key: string | string[]): Promise<void> {
       try {
         const keys = Array.isArray(key) ? key : [key];
         await chrome.storage.local.remove(keys);
         
         // Clear from cache
         keys.forEach(k => this.cache.delete(k));
       } catch (error) {
         this.handleStorageError(error);
       }
     }
     
     async clear(): Promise<void> {
       try {
         await chrome.storage.local.clear();
         this.cache.clear();
       } catch (error) {
         this.handleStorageError(error);
       }
     }
     
     async getUsage(): Promise<{
       bytesUsed: number;
       quota: number;
       percentUsed: number;
     }> {
       const bytesUsed = await chrome.storage.local.getBytesInUse();
       const quota = chrome.storage.local.QUOTA_BYTES || 10485760; // 10MB default
       
       return {
         bytesUsed,
         quota,
         percentUsed: (bytesUsed / quota) * 100,
       };
     }
     
     onChange(key: string, callback: (newValue: any, oldValue: any) => void): () => void {
       if (!this.listeners.has(key)) {
         this.listeners.set(key, new Set());
       }
       
       this.listeners.get(key)!.add(callback);
       
       // Return unsubscribe function
       return () => {
         const listeners = this.listeners.get(key);
         if (listeners) {
           listeners.delete(callback);
           if (listeners.size === 0) {
             this.listeners.delete(key);
           }
         }
       };
     }
     
     private handleStorageError(error: any): void {
       const message = error?.message || error?.toString() || 'Unknown storage error';
       
       if (message.includes('QUOTA_BYTES')) {
         throw new Error('Storage quota exceeded');
       }
       
       throw new Error(`Storage error: ${message}`);
     }
     
     // Batch operations for efficiency
     async transaction<T>(
       operation: (storage: ChromeStorage) => Promise<T>
     ): Promise<T> {
       // Disable cache during transaction
       const originalTTL = this.CACHE_TTL;
       (this as any).CACHE_TTL = 0;
       
       try {
         return await operation(this);
       } finally {
         (this as any).CACHE_TTL = originalTTL;
       }
     }
   }

   // Export singleton instance
   export const chromeStorage = new ChromeStorage();
   ```

**Deliverables:**
- `src/storage/chromeStorage.ts` - Chrome storage wrapper
- Get/set/remove operations
- Multiple key operations
- Change listeners
- Storage usage tracking
- Cache layer for performance
- Error handling

**Acceptance Criteria:**
- [ ] All CRUD operations work
- [ ] Change events fire correctly
- [ ] Cache improves performance
- [ ] Quota errors handled
- [ ] Tests pass

---

#### Task 3.1.1c - Storage Migrations 🧪
**Status:** [ ] Not Started
**Assignee:** 
**Dependencies:** Task 3.1.1b

**Test Requirements:**
```typescript
// tests/storage/migrations.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { MigrationManager } from '@/storage/migrations';
import { chromeStorage } from '@/storage/chromeStorage';

describe('Storage Migrations', () => {
  let migrationManager: MigrationManager;
  
  beforeEach(async () => {
    await chromeStorage.clear();
    migrationManager = new MigrationManager();
  });
  
  it('should detect current version', async () => {
    await chromeStorage.set('storage_version', 2);
    const version = await migrationManager.getCurrentVersion();
    expect(version).toBe(2);
  });
  
  it('should run migrations in order', async () => {
    const migrations = [
      {
        version: 1,
        up: vi.fn(async (data) => ({ ...data, v1: true })),
        down: vi.fn(),
      },
      {
        version: 2,
        up: vi.fn(async (data) => ({ ...data, v2: true })),
        down: vi.fn(),
      },
    ];
    
    migrationManager.register(migrations);
    
    const result = await migrationManager.migrate(0, 2, {});
    
    expect(migrations[0].up).toHaveBeenCalled();
    expect(migrations[1].up).toHaveBeenCalled();
    expect(result.v1).toBe(true);
    expect(result.v2).toBe(true);
  });
  
  it('should skip already applied migrations', async () => {
    await chromeStorage.set('storage_version', 1);
    
    const migration = {
      version: 1,
      up: vi.fn(),
      down: vi.fn(),
    };
    
    migrationManager.register([migration]);
    await migrationManager.runMigrations();
    
    expect(migration.up).not.toHaveBeenCalled();
  });
  
  it('should rollback on migration failure', async () => {
    const migrations = [
      {
        version: 1,
        up: vi.fn(async (data) => ({ ...data, v1: true })),
        down: vi.fn(async (data) => {
          delete data.v1;
          return data;
        }),
      },
      {
        version: 2,
        up: vi.fn().mockRejectedValue(new Error('Migration failed')),
        down: vi.fn(),
      },
    ];
    
    migrationManager.register(migrations);
    
    await expect(migrationManager.migrate(0, 2, {})).rejects.toThrow();
    expect(migrations[0].down).toHaveBeenCalled();
  });
  
  it('should backup data before migration', async () => {
    const testData = { settings: { theme: 'dark' } };
    await chromeStorage.set('app_data', testData);
    
    await migrationManager.createBackup();
    
    const backup = await chromeStorage.get('storage_backup');
    expect(backup.data.app_data).toEqual(testData);
    expect(backup.timestamp).toBeDefined();
  });
});
```

**Implementation Steps:**
1. Create migration manager:
   ```typescript
   // src/storage/migrations.ts
   import { chromeStorage } from './chromeStorage';
   import { StorageSchema, STORAGE_VERSION } from '@/types/storage';

   export interface Migration {
     version: number;
     description?: string;
     up: (data: any) => Promise<any>;
     down: (data: any) => Promise<any>;
   }

   export class MigrationManager {
     private migrations: Migration[] = [];
     
     constructor() {
       this.registerBuiltInMigrations();
     }
     
     private registerBuiltInMigrations() {
       // V0 -> V1: Initial schema
       this.migrations.push({
         version: 1,
         description: 'Initial storage schema',
         up: async (data) => {
           return {
             version: 1,
             settings: data.settings || {
               theme: 'auto',
               provider: 'openai',
               fontSize: 'medium',
             },
             apiKeys: data.apiKeys || {},
             cache: {},
             conversations: {
               conversationIds: [],
             },
           };
         },
         down: async (data) => {
           const { version, ...rest } = data;
           return rest;
         },
       });
       
       // Add future migrations here
     }
     
     register(migrations: Migration | Migration[]): void {
       const toAdd = Array.isArray(migrations) ? migrations : [migrations];
       this.migrations.push(...toAdd);
       this.migrations.sort((a, b) => a.version - b.version);
     }
     
     async getCurrentVersion(): Promise<number> {
       const version = await chromeStorage.get('storage_version');
       return version || 0;
     }
     
     async runMigrations(): Promise<void> {
       const currentVersion = await this.getCurrentVersion();
       const targetVersion = STORAGE_VERSION;
       
       if (currentVersion >= targetVersion) {
         return; // No migrations needed
       }
       
       console.log(`Migrating storage from v${currentVersion} to v${targetVersion}`);
       
       // Create backup before migration
       await this.createBackup();
       
       try {
         // Get all current data
         const allData = await chrome.storage.local.get(null);
         
         // Run migrations
         const migrated = await this.migrate(currentVersion, targetVersion, allData);
         
         // Clear and set new data
         await chromeStorage.clear();
         await chromeStorage.setMultiple(migrated);
         await chromeStorage.set('storage_version', targetVersion);
         
         console.log('Migration completed successfully');
       } catch (error) {
         console.error('Migration failed:', error);
         await this.restoreBackup();
         throw error;
       }
     }
     
     async migrate(fromVersion: number, toVersion: number, data: any): Promise<any> {
       let currentData = { ...data };
       const appliedMigrations: Migration[] = [];
       
       try {
         for (const migration of this.migrations) {
           if (migration.version > fromVersion && migration.version <= toVersion) {
             console.log(`Applying migration v${migration.version}: ${migration.description}`);
             currentData = await migration.up(currentData);
             appliedMigrations.push(migration);
           }
         }
         
         return currentData;
       } catch (error) {
         // Rollback applied migrations
         console.error('Migration failed, rolling back...');
         
         for (const migration of appliedMigrations.reverse()) {
           try {
             currentData = await migration.down(currentData);
           } catch (rollbackError) {
             console.error(`Rollback failed for v${migration.version}:`, rollbackError);
           }
         }
         
         throw error;
       }
     }
     
     async createBackup(): Promise<void> {
       const allData = await chrome.storage.local.get(null);
       const backup = {
         timestamp: Date.now(),
         version: await this.getCurrentVersion(),
         data: allData,
       };
       
       await chromeStorage.set('storage_backup', backup);
     }
     
     async restoreBackup(): Promise<void> {
       const backup = await chromeStorage.get('storage_backup');
       
       if (!backup) {
         throw new Error('No backup found');
       }
       
       await chromeStorage.clear();
       await chromeStorage.setMultiple(backup.data);
       
       console.log('Backup restored successfully');
     }
     
     async clearBackup(): Promise<void> {
       await chromeStorage.remove('storage_backup');
     }
   }

   // Export singleton instance
   export const migrationManager = new MigrationManager();
   ```

**Deliverables:**
- `src/storage/migrations.ts` - Migration manager
- Version detection
- Migration registration
- Backup/restore functionality
- Rollback on failure
- Built-in migrations

**Acceptance Criteria:**
- [ ] Migrations run in order
- [ ] Failed migrations rollback
- [ ] Backups created before migration
- [ ] Version tracking works
- [ ] Tests pass

---

### 🔄 Parallel Block B: IndexedDB (3 tasks)

#### Task 3.1.2a - IndexedDB Schema 🧪
**Status:** [ ] Not Started
**Assignee:** 
**Dependencies:** Task 3.1.1a

**Test Requirements:**
```typescript
// tests/storage/schema.test.ts
import { describe, it, expect } from 'vitest';
import { 
  DatabaseSchema,
  validateConversation,
  validateMessage,
  createIndexes
} from '@/storage/schema';

describe('IndexedDB Schema', () => {
  it('should define conversation schema', () => {
    const conversation = {
      id: 'conv-123',
      title: 'Test Conversation',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messageCount: 5,
      lastMessage: 'Hello',
      metadata: {
        model: 'gpt-4',
        tabContext: ['https://example.com']
      }
    };
    
    expect(validateConversation(conversation)).toBe(true);
  });
  
  it('should define message schema', () => {
    const message = {
      id: 'msg-123',
      conversationId: 'conv-123',
      content: 'Hello, world!',
      role: 'user',
      timestamp: Date.now(),
      metadata: {
        tokens: 10
      }
    };
    
    expect(validateMessage(message)).toBe(true);
  });
  
  it('should reject invalid schemas', () => {
    const invalidConversation = {
      id: 123, // Should be string
      title: null
    };
    
    expect(validateConversation(invalidConversation)).toBe(false);
  });
  
  it('should define proper indexes', () => {
    const indexes = createIndexes();
    
    expect(indexes.conversations).toContain('createdAt');
    expect(indexes.conversations).toContain('updatedAt');
    expect(indexes.messages).toContain('conversationId');
    expect(indexes.messages).toContain('timestamp');
  });
});
```

**Implementation Steps:**
1. Create database schema:
   ```typescript
   // src/storage/schema.ts
   export interface Conversation {
     id: string;
     title: string;
     createdAt: number;
     updatedAt: number;
     messageCount: number;
     lastMessage?: string;
     metadata?: {
       model?: string;
       provider?: string;
       tabContext?: string[];
       tags?: string[];
     };
   }

   export interface Message {
     id: string;
     conversationId: string;
     content: string;
     role: 'user' | 'assistant' | 'system';
     timestamp: number;
     isStreaming?: boolean;
     error?: string;
     metadata?: {
       model?: string;
       tokens?: number;
       latency?: number;
       tabContext?: string[];
     };
   }

   export interface TabContext {
     id: string;
     url: string;
     title: string;
     content: string;
     extractedAt: number;
     metadata?: {
       contentType?: string;
       wordCount?: number;
       hasCode?: boolean;
       hasTables?: boolean;
     };
   }

   export const DATABASE_NAME = 'BrowserSidebarDB';
   export const DATABASE_VERSION = 1;

   export const OBJECT_STORES = {
     conversations: 'conversations',
     messages: 'messages',
     tabContext: 'tabContext',
   } as const;

   export function validateConversation(data: any): data is Conversation {
     return (
       typeof data === 'object' &&
       typeof data.id === 'string' &&
       typeof data.title === 'string' &&
       typeof data.createdAt === 'number' &&
       typeof data.updatedAt === 'number' &&
       typeof data.messageCount === 'number'
     );
   }

   export function validateMessage(data: any): data is Message {
     return (
       typeof data === 'object' &&
       typeof data.id === 'string' &&
       typeof data.conversationId === 'string' &&
       typeof data.content === 'string' &&
       ['user', 'assistant', 'system'].includes(data.role) &&
       typeof data.timestamp === 'number'
     );
   }

   export function createIndexes() {
     return {
       conversations: ['createdAt', 'updatedAt', 'messageCount'],
       messages: ['conversationId', 'timestamp', 'role'],
       tabContext: ['extractedAt', 'url'],
     };
   }

   export interface DatabaseMigration {
     version: number;
     upgrade: (db: IDBDatabase, transaction: IDBTransaction) => void;
   }

   export const databaseMigrations: DatabaseMigration[] = [
     {
       version: 1,
       upgrade: (db) => {
         // Create conversations store
         if (!db.objectStoreNames.contains(OBJECT_STORES.conversations)) {
           const conversationStore = db.createObjectStore(
             OBJECT_STORES.conversations,
             { keyPath: 'id' }
           );
           conversationStore.createIndex('createdAt', 'createdAt');
           conversationStore.createIndex('updatedAt', 'updatedAt');
           conversationStore.createIndex('messageCount', 'messageCount');
         }
         
         // Create messages store
         if (!db.objectStoreNames.contains(OBJECT_STORES.messages)) {
           const messageStore = db.createObjectStore(
             OBJECT_STORES.messages,
             { keyPath: 'id' }
           );
           messageStore.createIndex('conversationId', 'conversationId');
           messageStore.createIndex('timestamp', 'timestamp');
           messageStore.createIndex('role', 'role');
           messageStore.createIndex(
             'conversation_timestamp',
             ['conversationId', 'timestamp']
           );
         }
         
         // Create tab context store
         if (!db.objectStoreNames.contains(OBJECT_STORES.tabContext)) {
           const contextStore = db.createObjectStore(
             OBJECT_STORES.tabContext,
             { keyPath: 'id' }
           );
           contextStore.createIndex('url', 'url');
           contextStore.createIndex('extractedAt', 'extractedAt');
         }
       },
     },
   ];
   ```

**Deliverables:**
- `src/storage/schema.ts` - Database schema definitions
- Conversation, Message, and TabContext interfaces
- Validation functions
- Index definitions
- Migration structure

**Acceptance Criteria:**
- [ ] Schemas are well-defined
- [ ] Validation functions work
- [ ] Indexes optimize queries
- [ ] Migration structure ready
- [ ] Tests pass

---

#### Task 3.1.2b - IndexedDB Wrapper 🧪
**Status:** [ ] Not Started
**Assignee:** 
**Dependencies:** Task 3.1.2a

**Test Requirements:**
```typescript
// tests/storage/indexedDB.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IndexedDBWrapper } from '@/storage/indexedDB';
import { Conversation, Message } from '@/storage/schema';

describe('IndexedDB Wrapper', () => {
  let db: IndexedDBWrapper;
  
  beforeEach(async () => {
    db = new IndexedDBWrapper('TestDB');
    await db.open();
  });
  
  afterEach(async () => {
    await db.clear();
    await db.close();
  });
  
  it('should open database connection', async () => {
    expect(db.isOpen()).toBe(true);
  });
  
  it('should add and get items', async () => {
    const conversation: Conversation = {
      id: 'test-1',
      title: 'Test Conversation',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messageCount: 0,
    };
    
    await db.add('conversations', conversation);
    const retrieved = await db.get('conversations', 'test-1');
    
    expect(retrieved).toEqual(conversation);
  });
  
  it('should update items', async () => {
    const message: Message = {
      id: 'msg-1',
      conversationId: 'conv-1',
      content: 'Original',
      role: 'user',
      timestamp: Date.now(),
    };
    
    await db.add('messages', message);
    await db.update('messages', { ...message, content: 'Updated' });
    
    const updated = await db.get('messages', 'msg-1');
    expect(updated.content).toBe('Updated');
  });
  
  it('should delete items', async () => {
    await db.add('conversations', { id: 'to-delete', title: 'Delete me' });
    await db.delete('conversations', 'to-delete');
    
    const result = await db.get('conversations', 'to-delete');
    expect(result).toBeUndefined();
  });
  
  it('should query with indexes', async () => {
    const messages: Message[] = [
      {
        id: '1',
        conversationId: 'conv-1',
        content: 'First',
        role: 'user',
        timestamp: 1000,
      },
      {
        id: '2',
        conversationId: 'conv-1',
        content: 'Second',
        role: 'assistant',
        timestamp: 2000,
      },
      {
        id: '3',
        conversationId: 'conv-2',
        content: 'Third',
        role: 'user',
        timestamp: 3000,
      },
    ];
    
    for (const msg of messages) {
      await db.add('messages', msg);
    }
    
    const conv1Messages = await db.getAllByIndex(
      'messages',
      'conversationId',
      'conv-1'
    );
    
    expect(conv1Messages).toHaveLength(2);
    expect(conv1Messages[0].conversationId).toBe('conv-1');
  });
  
  it('should handle transactions', async () => {
    const result = await db.transaction(['conversations'], 'readwrite', async (tx) => {
      const store = tx.objectStore('conversations');
      
      await store.add({
        id: 'tx-1',
        title: 'Transaction Test',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messageCount: 0,
      });
      
      return await store.get('tx-1');
    });
    
    expect(result.title).toBe('Transaction Test');
  });
  
  it('should count items', async () => {
    await db.add('messages', { id: '1', content: 'Test 1' });
    await db.add('messages', { id: '2', content: 'Test 2' });
    
    const count = await db.count('messages');
    expect(count).toBe(2);
  });
});
```

**Implementation Steps:**
1. Create IndexedDB wrapper:
   ```typescript
   // src/storage/indexedDB.ts
   import { 
     DATABASE_NAME, 
     DATABASE_VERSION,
     OBJECT_STORES,
     databaseMigrations 
   } from './schema';

   export class IndexedDBWrapper {
     private db: IDBDatabase | null = null;
     private readonly dbName: string;
     private readonly version: number;
     
     constructor(
       dbName: string = DATABASE_NAME,
       version: number = DATABASE_VERSION
     ) {
       this.dbName = dbName;
       this.version = version;
     }
     
     async open(): Promise<void> {
       return new Promise((resolve, reject) => {
         const request = indexedDB.open(this.dbName, this.version);
         
         request.onerror = () => {
           reject(new Error(`Failed to open database: ${request.error}`));
         };
         
         request.onsuccess = () => {
           this.db = request.result;
           resolve();
         };
         
         request.onupgradeneeded = (event) => {
           const db = (event.target as IDBOpenDBRequest).result;
           const transaction = (event.target as IDBOpenDBRequest).transaction!;
           
           // Run migrations
           const oldVersion = event.oldVersion;
           const newVersion = event.newVersion!;
           
           for (const migration of databaseMigrations) {
             if (migration.version > oldVersion && migration.version <= newVersion) {
               migration.upgrade(db, transaction);
             }
           }
         };
       });
     }
     
     async close(): Promise<void> {
       if (this.db) {
         this.db.close();
         this.db = null;
       }
     }
     
     isOpen(): boolean {
       return this.db !== null;
     }
     
     private ensureOpen(): void {
       if (!this.db) {
         throw new Error('Database is not open');
       }
     }
     
     async add<T>(storeName: string, item: T): Promise<void> {
       this.ensureOpen();
       
       return new Promise((resolve, reject) => {
         const transaction = this.db!.transaction([storeName], 'readwrite');
         const store = transaction.objectStore(storeName);
         const request = store.add(item);
         
         request.onsuccess = () => resolve();
         request.onerror = () => reject(request.error);
       });
     }
     
     async get<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
       this.ensureOpen();
       
       return new Promise((resolve, reject) => {
         const transaction = this.db!.transaction([storeName], 'readonly');
         const store = transaction.objectStore(storeName);
         const request = store.get(key);
         
         request.onsuccess = () => resolve(request.result);
         request.onerror = () => reject(request.error);
       });
     }
     
     async getAll<T>(storeName: string, count?: number): Promise<T[]> {
       this.ensureOpen();
       
       return new Promise((resolve, reject) => {
         const transaction = this.db!.transaction([storeName], 'readonly');
         const store = transaction.objectStore(storeName);
         const request = count ? store.getAll(null, count) : store.getAll();
         
         request.onsuccess = () => resolve(request.result);
         request.onerror = () => reject(request.error);
       });
     }
     
     async getAllByIndex<T>(
       storeName: string,
       indexName: string,
       value: IDBValidKey
     ): Promise<T[]> {
       this.ensureOpen();
       
       return new Promise((resolve, reject) => {
         const transaction = this.db!.transaction([storeName], 'readonly');
         const store = transaction.objectStore(storeName);
         const index = store.index(indexName);
         const request = index.getAll(value);
         
         request.onsuccess = () => resolve(request.result);
         request.onerror = () => reject(request.error);
       });
     }
     
     async update<T>(storeName: string, item: T): Promise<void> {
       this.ensureOpen();
       
       return new Promise((resolve, reject) => {
         const transaction = this.db!.transaction([storeName], 'readwrite');
         const store = transaction.objectStore(storeName);
         const request = store.put(item);
         
         request.onsuccess = () => resolve();
         request.onerror = () => reject(request.error);
       });
     }
     
     async delete(storeName: string, key: IDBValidKey): Promise<void> {
       this.ensureOpen();
       
       return new Promise((resolve, reject) => {
         const transaction = this.db!.transaction([storeName], 'readwrite');
         const store = transaction.objectStore(storeName);
         const request = store.delete(key);
         
         request.onsuccess = () => resolve();
         request.onerror = () => reject(request.error);
       });
     }
     
     async clear(storeName?: string): Promise<void> {
       this.ensureOpen();
       
       const storeNames = storeName 
         ? [storeName] 
         : Array.from(this.db!.objectStoreNames);
       
       return new Promise((resolve, reject) => {
         const transaction = this.db!.transaction(storeNames, 'readwrite');
         
         let pending = storeNames.length;
         let hasError = false;
         
         storeNames.forEach(name => {
           const store = transaction.objectStore(name);
           const request = store.clear();
           
           request.onsuccess = () => {
             pending--;
             if (pending === 0 && !hasError) resolve();
           };
           
           request.onerror = () => {
             hasError = true;
             reject(request.error);
           };
         });
       });
     }
     
     async count(storeName: string): Promise<number> {
       this.ensureOpen();
       
       return new Promise((resolve, reject) => {
         const transaction = this.db!.transaction([storeName], 'readonly');
         const store = transaction.objectStore(storeName);
         const request = store.count();
         
         request.onsuccess = () => resolve(request.result);
         request.onerror = () => reject(request.error);
       });
     }
     
     async transaction<T>(
       storeNames: string[],
       mode: IDBTransactionMode,
       callback: (tx: IDBTransaction) => Promise<T>
     ): Promise<T> {
       this.ensureOpen();
       
       const tx = this.db!.transaction(storeNames, mode);
       
       return new Promise((resolve, reject) => {
         tx.oncomplete = () => resolve(result);
         tx.onerror = () => reject(tx.error);
         tx.onabort = () => reject(new Error('Transaction aborted'));
         
         let result: T;
         callback(tx)
           .then(r => { result = r; })
           .catch(reject);
       });
     }
   }

   // Export singleton instance
   export const indexedDB = new IndexedDBWrapper();
   ```

**Deliverables:**
- `src/storage/indexedDB.ts` - IndexedDB wrapper
- CRUD operations
- Index queries
- Transaction support
- Database versioning
- Error handling

**Acceptance Criteria:**
- [ ] Database opens/closes correctly
- [ ] CRUD operations work
- [ ] Indexes function properly
- [ ] Transactions complete
- [ ] Tests pass

---

Continue with Phase 3.2 (Security) and Phase 3.3 (Data Management)...

[Note: This is a partial file showing the detailed structure. The complete task-stage-3.md would include all 18 tasks with similar detail.]

---

## Stage 3 Completion Checklist

### Testing Requirements
- [ ] All unit tests written and passing
- [ ] Test coverage > 95% for Stage 3 code
- [ ] Security tests for encryption
- [ ] Integration tests for storage operations

### Documentation
- [ ] Storage API documentation
- [ ] Security best practices guide
- [ ] Migration guide
- [ ] IndexedDB schema documentation

### Quality Gates
- [ ] No TypeScript errors
- [ ] No ESLint warnings
- [ ] Security audit passed
- [ ] Performance benchmarks met
- [ ] Code reviewed

### Deliverables Verification
- [ ] Chrome storage working
- [ ] IndexedDB operational
- [ ] Encryption functioning
- [ ] Migrations tested
- [ ] Sensitive data detection working
- [ ] Cache management operational
- [ ] Data cleanup utilities working

## Next Stage Prerequisites
Before moving to Stage 4 (AI Provider System), ensure:
1. ✅ All Stage 3 tasks complete
2. ✅ Storage layer fully tested
3. ✅ Encryption working correctly
4. ✅ API keys stored securely
5. ✅ Conversations persist properly

---

*Stage 3 Task Guide Version: 1.0*
*Total Tasks: 18*
*Estimated Duration: 1.5 weeks*
*Dependencies: Stages 1-2 complete*