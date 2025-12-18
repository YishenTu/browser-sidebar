/**
 * @file Storage Fixtures
 *
 * Test fixtures for serialize/deserialize samples, migration test data,
 * and various storage-related test scenarios.
 */

import type {
  CacheEntry,
  CacheStorage,
  MigrationScript,
  ConversationStorage,
  SettingsStorage,
} from '@/types/storage';
import type { ChatMessage } from '@/types/chat';
import { CURRENT_STORAGE_VERSION } from '@/types/storage';

// =============================================================================
// Serialize/Deserialize Samples
// =============================================================================

/**
 * Primitive values for serialization tests.
 */
export const primitiveValues = {
  string: 'Hello, world!',
  number: 42,
  float: 3.14159,
  negative: -100,
  zero: 0,
  booleanTrue: true,
  booleanFalse: false,
  null: null,
  emptyString: '',
};

/**
 * Array values for serialization tests.
 */
export const arrayValues = {
  emptyArray: [],
  numberArray: [1, 2, 3, 4, 5],
  stringArray: ['a', 'b', 'c'],
  mixedArray: [1, 'two', true, null],
  nestedArray: [
    [1, 2],
    [3, 4],
    [5, 6],
  ],
  deepNestedArray: [[[1]], [[2]], [[3]]],
};

/**
 * Object values for serialization tests.
 */
export const objectValues = {
  emptyObject: {},
  simpleObject: { key: 'value' },
  nestedObject: {
    level1: {
      level2: {
        level3: 'deep value',
      },
    },
  },
  mixedObject: {
    string: 'text',
    number: 123,
    boolean: true,
    array: [1, 2, 3],
    nested: { inner: 'value' },
  },
};

/**
 * Date values for serialization tests.
 */
export const dateValues = {
  now: new Date(),
  epoch: new Date(0),
  specific: new Date('2024-01-15T10:30:00Z'),
  future: new Date('2030-12-31T23:59:59Z'),
};

/**
 * Map values for serialization tests.
 */
export const mapValues = {
  emptyMap: new Map(),
  stringKeyMap: new Map([
    ['key1', 'value1'],
    ['key2', 'value2'],
  ]),
  numberKeyMap: new Map([
    [1, 'one'],
    [2, 'two'],
  ]),
  mixedMap: new Map<string | number, unknown>([
    ['string', 'text'],
    [42, { nested: true }],
  ]),
  nestedMap: new Map([['outer', new Map([['inner', 'value']])]]),
};

/**
 * Set values for serialization tests.
 */
export const setValues = {
  emptySet: new Set(),
  numberSet: new Set([1, 2, 3, 4, 5]),
  stringSet: new Set(['a', 'b', 'c']),
  mixedSet: new Set([1, 'two', true]),
};

/**
 * Complex nested structures for roundtrip tests.
 */
export const complexStructures = {
  withDate: {
    name: 'Event',
    date: new Date('2024-06-15T14:00:00Z'),
    details: {
      location: 'Conference Room',
      attendees: 5,
    },
  },
  withMap: {
    type: 'collection',
    items: new Map([
      ['item1', { value: 100 }],
      ['item2', { value: 200 }],
    ]),
  },
  withSet: {
    type: 'unique',
    values: new Set([1, 2, 3]),
    metadata: { count: 3 },
  },
  combined: {
    timestamp: new Date('2024-01-01T00:00:00Z'),
    data: new Map([['users', new Set(['alice', 'bob', 'charlie'])]]),
    config: {
      enabled: true,
      settings: { theme: 'dark' },
    },
  },
};

// =============================================================================
// Serialized Format Samples
// =============================================================================

/**
 * Expected serialized format for Date.
 */
export const serializedDate = {
  __type: 'Date',
  value: '2024-01-15T10:30:00.000Z',
};

/**
 * Expected serialized format for Map.
 */
export const serializedMap = {
  __type: 'Map',
  entries: [
    ['key1', 'value1'],
    ['key2', 'value2'],
  ],
};

/**
 * Expected serialized format for Set.
 */
export const serializedSet = {
  __type: 'Set',
  values: [1, 2, 3],
};

// =============================================================================
// Unsupported/Invalid Values
// =============================================================================

/**
 * Values that should throw during serialization.
 */
export const unsupportedValues = {
  function: () => 'test',
  symbol: Symbol('test'),
  undefined: undefined,
  bigint: BigInt(9007199254740991),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  circular: {} as any, // Will be made circular in tests
};

/**
 * Create a circular reference for testing.
 */
export function createCircularReference(): object {
  const obj: Record<string, unknown> = { name: 'root' };
  obj['self'] = obj;
  return obj;
}

// =============================================================================
// Cache Entry Fixtures
// =============================================================================

/**
 * Valid cache entry.
 */
export const validCacheEntry: CacheEntry = {
  key: 'cache-key-001',
  value: { data: 'cached value', count: 42 },
  metadata: {
    createdAt: 1705315800000,
    expiresAt: 1705319400000, // 1 hour later
    accessCount: 5,
    lastAccessed: 1705316000000,
    tags: ['api', 'response'],
    size: 128,
  },
  storageVersion: CURRENT_STORAGE_VERSION,
};

/**
 * Expired cache entry.
 */
export const expiredCacheEntry: CacheEntry = {
  key: 'cache-expired',
  value: 'old data',
  metadata: {
    createdAt: 1700000000000,
    expiresAt: 1700003600000, // Already passed
    accessCount: 10,
    lastAccessed: 1700002000000,
    size: 64,
  },
  storageVersion: CURRENT_STORAGE_VERSION,
};

/**
 * Cache entry about to expire.
 */
export const almostExpiredCacheEntry: CacheEntry = {
  key: 'cache-almost-expired',
  value: 'still valid',
  metadata: {
    createdAt: Date.now() - 3500000, // Almost 1 hour ago
    expiresAt: Date.now() + 100000, // Expires in ~1.5 minutes
    accessCount: 1,
    lastAccessed: Date.now() - 60000,
    size: 32,
  },
  storageVersion: CURRENT_STORAGE_VERSION,
};

// =============================================================================
// Cache Storage Fixtures
// =============================================================================

/**
 * Empty cache storage.
 */
export const emptyCacheStorage: CacheStorage = {
  entries: {},
  maxSize: 5242880, // 5MB
  currentSize: 0,
  cleanupInterval: 3600000, // 1 hour
  storageVersion: CURRENT_STORAGE_VERSION,
};

/**
 * Cache storage with entries.
 */
export const populatedCacheStorage: CacheStorage = {
  entries: {
    key1: validCacheEntry,
    key2: {
      ...validCacheEntry,
      key: 'key2',
      value: { different: 'data' },
      metadata: { ...validCacheEntry.metadata, size: 256 },
    },
  },
  maxSize: 5242880,
  currentSize: 384,
  cleanupInterval: 3600000,
  storageVersion: CURRENT_STORAGE_VERSION,
};

/**
 * Cache storage with expired entries.
 */
export const cacheWithExpired: CacheStorage = {
  entries: {
    valid: validCacheEntry,
    expired1: expiredCacheEntry,
    expired2: {
      ...expiredCacheEntry,
      key: 'expired2',
      metadata: { ...expiredCacheEntry.metadata, expiresAt: Date.now() - 1000 },
    },
  },
  maxSize: 5242880,
  currentSize: 256,
  cleanupInterval: 3600000,
  storageVersion: CURRENT_STORAGE_VERSION,
};

// =============================================================================
// Migration Test Data
// =============================================================================

/**
 * Version 0 data (legacy format).
 */
export const v0Data = {
  // No version field
  conversations: [],
  settings: {
    theme: 'light',
    apiKey: 'sk-test123',
  },
};

/**
 * Version 1 data.
 */
export const v1Data = {
  version: 1,
  conversations: {},
  settings: {
    version: 1,
    ui: { fontSize: 'medium' },
    ai: { defaultProvider: null },
    privacy: { saveConversations: true },
    apiKeys: { openai: null },
    selectedModel: 'gpt-4o',
    availableModels: [],
  },
  apiKeys: {},
  cache: emptyCacheStorage,
  migrations: [1],
};

/**
 * Sample migration scripts.
 */
export const sampleMigrations: MigrationScript[] = [
  {
    version: 1,
    description: 'Initial schema setup',
    up: (data: unknown) => ({
      ...(data as Record<string, unknown>),
      version: 1,
      migratedAt: Date.now(),
    }),
    down: (data: unknown) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { version, migratedAt, ...rest } = data as Record<string, unknown>;
      return rest;
    },
  },
  {
    version: 2,
    description: 'Add user preferences',
    up: (data: unknown) => ({
      ...(data as Record<string, unknown>),
      version: 2,
      preferences: { theme: 'system' },
    }),
    down: (data: unknown) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { preferences, ...rest } = data as Record<string, unknown>;
      return { ...rest, version: 1 };
    },
    dependencies: [1],
  },
  {
    version: 3,
    description: 'Add analytics settings',
    up: (data: unknown) => ({
      ...(data as Record<string, unknown>),
      version: 3,
      analytics: { enabled: false },
    }),
    down: (data: unknown) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { analytics, ...rest } = data as Record<string, unknown>;
      return { ...rest, version: 2 };
    },
    dependencies: [1, 2],
    validation: (data: unknown) => {
      const d = data as Record<string, unknown>;
      return d['version'] === 2 || d['version'] === 3;
    },
  },
];

/**
 * Migration that fails validation.
 */
export const failingMigration: MigrationScript = {
  version: 99,
  description: 'Migration that always fails',
  up: (data: unknown) => data,
  down: (data: unknown) => data,
  validation: () => false, // Always fails
};

// =============================================================================
// Conversation Storage Fixtures
// =============================================================================

/**
 * Sample chat message for storage.
 */
const sampleMessage: ChatMessage = {
  id: 'msg-001',
  role: 'user',
  content: 'Hello, assistant!',
  timestamp: 1705315800000,
  status: 'sent',
};

/**
 * Valid conversation storage.
 */
export const validConversationStorage: ConversationStorage = {
  id: 'conv-001',
  title: 'Test Conversation',
  messages: [
    sampleMessage,
    {
      id: 'msg-002',
      role: 'assistant',
      content: 'Hello! How can I help you today?',
      timestamp: 1705315805000,
      status: 'sent',
    },
  ],
  metadata: {
    createdAt: 1705315800000,
    updatedAt: 1705315805000,
    messageCount: 2,
    model: 'gpt-4o',
  },
  encrypted: false,
  lastAccessed: 1705316000000,
  storageVersion: CURRENT_STORAGE_VERSION,
};

/**
 * Archived conversation storage.
 */
export const archivedConversation: ConversationStorage = {
  ...validConversationStorage,
  id: 'conv-archived',
  title: 'Archived Conversation',
  archived: true,
  pinned: false,
};

/**
 * Pinned conversation storage.
 */
export const pinnedConversation: ConversationStorage = {
  ...validConversationStorage,
  id: 'conv-pinned',
  title: 'Important Conversation',
  archived: false,
  pinned: true,
};

// =============================================================================
// Settings Storage Fixtures
// =============================================================================

/**
 * Default settings storage.
 */
export const defaultSettingsStorage: SettingsStorage = {
  version: 1,
  ui: {
    fontSize: 'medium',
    compactMode: false,
    showTimestamps: true,
    showAvatars: true,
    animationsEnabled: true,
    debugMode: false,
    autoScrollEnabled: true,
    screenshotHotkey: {
      enabled: true,
      modifiers: [],
      key: '',
    },
  },
  ai: {
    defaultProvider: null,
    streamResponse: true,
  },
  privacy: {
    saveConversations: true,
    shareAnalytics: false,
    clearOnClose: false,
  },
  apiKeys: {
    openai: null,
    google: null,
    openrouter: null,
    grok: null,
  },
  extraction: {
    domainRules: [
      { domain: 'x.com', mode: 'defuddle' },
      { domain: 'reddit.com', mode: 'defuddle' },
    ],
  },
  selectedModel: 'gpt-4o',
  availableModels: [],
  encrypted: false,
  lastModified: 1705315800000,
  storageVersion: CURRENT_STORAGE_VERSION,
};

/**
 * Custom settings storage.
 */
export const customSettingsStorage: SettingsStorage = {
  ...defaultSettingsStorage,
  ui: {
    ...defaultSettingsStorage.ui,
    fontSize: 'large',
    compactMode: true,
    debugMode: true,
  },
  ai: {
    defaultProvider: 'openai',
    streamResponse: true,
  },
  privacy: {
    saveConversations: false,
    shareAnalytics: true,
    clearOnClose: true,
  },
  selectedModel: 'gpt-4-turbo',
  lastModified: Date.now(),
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create a cache entry with custom options.
 */
export function createCacheEntry<T>(
  key: string,
  value: T,
  options: { ttl?: number; tags?: string[] } = {}
): CacheEntry<T> {
  const now = Date.now();
  const { ttl = 3600000, tags } = options;

  return {
    key,
    value,
    metadata: {
      createdAt: now,
      expiresAt: now + ttl,
      accessCount: 0,
      lastAccessed: now,
      tags,
      size: JSON.stringify(value).length * 2,
    },
    storageVersion: CURRENT_STORAGE_VERSION,
  };
}

/**
 * Create conversation storage with specified number of messages.
 */
export function createConversationStorage(
  messageCount: number,
  options: { archived?: boolean; pinned?: boolean } = {}
): ConversationStorage {
  const now = Date.now();
  const messages: ChatMessage[] = [];

  for (let i = 0; i < messageCount; i++) {
    messages.push({
      id: `msg-${i}`,
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Message ${i + 1}`,
      timestamp: now + i * 1000,
      status: 'sent',
    });
  }

  return {
    id: `conv-${Date.now()}`,
    title: `Conversation with ${messageCount} messages`,
    messages,
    metadata: {
      createdAt: now,
      updatedAt: now + messageCount * 1000,
      messageCount,
    },
    encrypted: false,
    lastAccessed: now + messageCount * 1000,
    storageVersion: CURRENT_STORAGE_VERSION,
    archived: options.archived,
    pinned: options.pinned,
  };
}

/**
 * Create multiple cache entries for testing.
 */
export function createMultipleCacheEntries(count: number): Record<string, CacheEntry> {
  const entries: Record<string, CacheEntry> = {};

  for (let i = 0; i < count; i++) {
    const key = `entry-${i}`;
    entries[key] = createCacheEntry(key, { index: i, data: `value-${i}` });
  }

  return entries;
}
