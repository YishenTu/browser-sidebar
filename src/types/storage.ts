/**
 * @file Storage Type Definitions
 *
 * Comprehensive TypeScript type definitions for storage management including
 * conversation storage, settings storage, API key storage, cache management,
 * serialization utilities, and migration system.
 *
 * This module provides type-safe interfaces for all persistent data storage
 * needs in the browser extension with support for encryption, versioning,
 * and data migrations.
 */

import type { ChatMessage, ConversationMetadata } from './chat';
import type { Settings } from './settings';
import type { APIKeyStorage } from './apiKeys';
import { isAPIKeyStorage as isAPIKeyStorageFn } from './apiKeys';

// =============================================================================
// Storage Version Management
// =============================================================================

/**
 * Storage version number for migration management
 */
export type StorageVersion = number;

/**
 * Current storage version - increment when making breaking changes
 */
export const CURRENT_STORAGE_VERSION: StorageVersion = 1;

// =============================================================================
// Storage Area Types
// =============================================================================

/**
 * Chrome storage areas available for use
 */
export type StorageArea = 'sync' | 'local';

/**
 * Storage key with namespace prefix
 */
export type StorageKey = `${string}:${string}` | string;

// =============================================================================
// Serialization Types
// =============================================================================

/**
 * Types that can be safely serialized to JSON
 */
export type SerializableValue =
  | string
  | number
  | boolean
  | null
  | SerializableValue[]
  | { [key: string]: SerializableValue };

/**
 * Serialized container with type metadata for complex objects
 */
export interface SerializableContainer {
  __type: 'SerializedContainer';
  version: StorageVersion;
  data: SerializableValue;
  metadata: {
    createdAt: number;
    serializedAt: number;
    compressionUsed: boolean;
    originalSize: number;
    compressedSize: number;
  };
}

/**
 * Storage container wrapper for versioned data
 */
export interface StorageContainer<T = unknown> {
  version: StorageVersion;
  data: T;
  metadata: {
    createdAt: number;
    serializedAt: number;
    compressionUsed: boolean;
    originalSize: number;
    compressedSize: number;
  };
}

// =============================================================================
// Core Storage Interfaces
// =============================================================================

/**
 * Enhanced conversation storage with encryption and versioning
 */
export interface ConversationStorage {
  /** Conversation identifier */
  id: string;
  /** Conversation title */
  title: string;
  /** Array of messages */
  messages: ChatMessage[];
  /** Conversation metadata */
  metadata: ConversationMetadata;
  /** Whether conversation is archived */
  archived?: boolean;
  /** Whether conversation is pinned */
  pinned?: boolean;
  /** Whether conversation data is encrypted */
  encrypted: boolean;
  /** Last access timestamp for cleanup */
  lastAccessed: number;
  /** Storage schema version */
  storageVersion: StorageVersion;
}

/**
 * Enhanced settings storage with encryption and versioning
 */
export interface SettingsStorage extends Settings {
  /** Whether settings data is encrypted */
  encrypted: boolean;
  /** Last modification timestamp */
  lastModified: number;
  /** Storage schema version */
  storageVersion: StorageVersion;
}

/**
 * Cache entry metadata
 */
export interface CacheMetadata {
  /** Creation timestamp */
  createdAt: number;
  /** Expiration timestamp */
  expiresAt: number;
  /** Access count for LRU */
  accessCount: number;
  /** Last access timestamp */
  lastAccessed: number;
  /** Optional tags for categorization */
  tags?: string[];
  /** Size in bytes */
  size: number;
}

/**
 * Generic cache entry with metadata
 */
export interface CacheEntry<T = unknown> {
  /** Cache key */
  key: string;
  /** Cached value */
  value: T;
  /** Cache metadata */
  metadata: CacheMetadata;
  /** Storage schema version */
  storageVersion: StorageVersion;
}

/**
 * Cache storage container
 */
export interface CacheStorage {
  /** Map of cache entries by key */
  entries: Record<string, CacheEntry>;
  /** Maximum cache size in bytes */
  maxSize: number;
  /** Current cache size in bytes */
  currentSize: number;
  /** Cleanup interval in milliseconds */
  cleanupInterval: number;
  /** Storage schema version */
  storageVersion: StorageVersion;
}

/**
 * Main storage schema containing all data
 */
export interface StorageSchema {
  /** Schema version */
  version: StorageVersion;
  /** Conversations by ID */
  conversations: Record<string, ConversationStorage>;
  /** Application settings */
  settings: SettingsStorage;
  /** API keys by reference ID */
  apiKeys: Record<string, APIKeyStorage>;
  /** Cache storage */
  cache: CacheStorage;
  /** Migration history */
  migrations: StorageVersion[];
}

// =============================================================================
// Migration System
// =============================================================================

/**
 * Migration script for data transformation
 */
export interface MigrationScript {
  /** Target version number */
  version: StorageVersion;
  /** Human-readable description */
  description: string;
  /** Forward migration function */
  up: (data: unknown) => unknown;
  /** Rollback migration function */
  down: (data: unknown) => unknown;
  /** Optional validation function */
  validation?: (data: unknown) => boolean;
  /** Optional dependencies (version numbers that must run first) */
  dependencies?: StorageVersion[];
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard for SerializableValue
 */
export function isSerializableValue(value: unknown): value is SerializableValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every(isSerializableValue);
  }

  if (typeof value === 'object' && value !== null) {
    // Check for non-serializable types
    if (
      value instanceof Date ||
      value instanceof Map ||
      value instanceof Set ||
      typeof value === 'function'
    ) {
      return false;
    }

    return Object.values(value).every(isSerializableValue);
  }

  return false;
}

/**
 * Type guard for StorageContainer
 */
export function isStorageContainer(value: unknown): value is StorageContainer {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;
  const metadata = obj['metadata'] as Record<string, unknown> | null;

  return (
    typeof obj['version'] === 'number' &&
    obj['data'] !== undefined &&
    typeof metadata === 'object' &&
    metadata !== null &&
    typeof metadata['createdAt'] === 'number' &&
    typeof metadata['serializedAt'] === 'number'
  );
}

/**
 * Type guard for ConversationStorage
 */
export function isConversationStorage(value: unknown): value is ConversationStorage {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  return (
    typeof obj['id'] === 'string' &&
    typeof obj['title'] === 'string' &&
    Array.isArray(obj['messages']) &&
    typeof obj['metadata'] === 'object' &&
    typeof obj['encrypted'] === 'boolean' &&
    typeof obj['lastAccessed'] === 'number' &&
    typeof obj['storageVersion'] === 'number'
  );
}

/**
 * Type guard for SettingsStorage
 */
export function isSettingsStorage(value: unknown): value is SettingsStorage {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  return (
    typeof obj['version'] === 'number' &&
    typeof obj['encrypted'] === 'boolean' &&
    typeof obj['lastModified'] === 'number' &&
    typeof obj['storageVersion'] === 'number' &&
    typeof obj['theme'] === 'string'
  );
}

/**
 * Type guard for APIKeyStorage (re-exported from apiKeys module)
 */
export const isAPIKeyStorage = isAPIKeyStorageFn;

/**
 * Type guard for CacheEntry
 */
export function isCacheEntry(value: unknown): value is CacheEntry {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;
  const metadata = obj['metadata'] as Record<string, unknown> | null;

  return (
    typeof obj['key'] === 'string' &&
    obj['value'] !== undefined &&
    typeof metadata === 'object' &&
    metadata !== null &&
    typeof metadata['createdAt'] === 'number' &&
    typeof metadata['expiresAt'] === 'number' &&
    typeof obj['storageVersion'] === 'number'
  );
}

/**
 * Type guard for CacheStorage
 */
export function isCacheStorage(value: unknown): value is CacheStorage {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  return (
    typeof obj['entries'] === 'object' &&
    typeof obj['maxSize'] === 'number' &&
    typeof obj['currentSize'] === 'number' &&
    typeof obj['cleanupInterval'] === 'number' &&
    typeof obj['storageVersion'] === 'number'
  );
}

/**
 * Type guard for StorageSchema
 */
export function isStorageSchema(value: unknown): value is StorageSchema {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  return (
    typeof obj['version'] === 'number' &&
    typeof obj['conversations'] === 'object' &&
    typeof obj['settings'] === 'object' &&
    typeof obj['apiKeys'] === 'object' &&
    typeof obj['cache'] === 'object' &&
    Array.isArray(obj['migrations'])
  );
}

// =============================================================================
// Serialization Utilities
// =============================================================================

/**
 * Serialize complex objects with type preservation
 */
export function serialize(value: unknown): string {
  const container: SerializableContainer = {
    __type: 'SerializedContainer',
    version: CURRENT_STORAGE_VERSION,
    data: serializeValue(value),
    metadata: {
      createdAt: Date.now(),
      serializedAt: Date.now(),
      compressionUsed: false,
      originalSize: 0,
      compressedSize: 0,
    },
  };

  const serialized = JSON.stringify(container);
  container.metadata.originalSize = serialized.length;
  container.metadata.compressedSize = serialized.length;

  return JSON.stringify(container);
}

/**
 * Deserialize complex objects with type restoration
 */
export function deserialize<T = unknown>(serialized: string): T {
  try {
    const container = JSON.parse(serialized);

    if (container.__type === 'SerializedContainer') {
      return deserializeValue(container.data) as T;
    }

    // Fallback for direct JSON values
    return deserializeValue(container) as T;
  } catch (error) {
    throw new Error(
      `Failed to deserialize data: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Internal value serialization with type tracking
 */
function serializeValue(value: unknown): SerializableValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value as SerializableValue;
  }

  if (value instanceof Date) {
    return {
      __type: 'Date',
      value: value.toISOString(),
    };
  }

  if (value instanceof Map) {
    return {
      __type: 'Map',
      entries: Array.from(value.entries()).map(([k, v]) => [serializeValue(k), serializeValue(v)]),
    };
  }

  if (value instanceof Set) {
    return {
      __type: 'Set',
      values: Array.from(value).map(serializeValue),
    };
  }

  if (Array.isArray(value)) {
    return value.map(serializeValue);
  }

  if (typeof value === 'object' && value !== null) {
    const result: { [key: string]: SerializableValue } = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = serializeValue(val);
    }
    return result;
  }

  throw new Error(`Cannot serialize value of type ${typeof value}`);
}

/**
 * Internal value deserialization with type restoration
 */
function deserializeValue(value: SerializableValue): unknown {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(deserializeValue);
  }

  if (typeof value === 'object' && value !== null) {
    const obj = value as { [key: string]: SerializableValue };

    // Handle special types
    if (obj['__type'] === 'Date') {
      return new Date(obj['value'] as string);
    }

    if (obj['__type'] === 'Map') {
      const entries = obj['entries'] as [SerializableValue, SerializableValue][];
      return new Map(entries.map(([k, v]) => [deserializeValue(k), deserializeValue(v)]));
    }

    if (obj['__type'] === 'Set') {
      const values = obj['values'] as SerializableValue[];
      return new Set(values.map(deserializeValue));
    }

    // Regular object
    const result: { [key: string]: unknown } = {};
    for (const [key, val] of Object.entries(obj)) {
      if (key !== '__type') {
        result[key] = deserializeValue(val);
      }
    }
    return result;
  }

  return value;
}

/**
 * Serialize Date objects
 */
export function serializeDate(date: Date): SerializableValue {
  return {
    __type: 'Date',
    value: date.toISOString(),
  };
}

/**
 * Deserialize Date objects
 */
export function deserializeDate(serialized: SerializableValue): Date {
  if (
    typeof serialized === 'object' &&
    serialized !== null &&
    (serialized as Record<string, unknown>)['__type'] === 'Date'
  ) {
    return new Date((serialized as Record<string, unknown>)['value'] as string);
  }
  throw new Error('Invalid serialized Date format');
}

/**
 * Serialize Map objects
 */
export function serializeMap<K, V>(map: Map<K, V>): SerializableValue {
  return {
    __type: 'Map',
    entries: Array.from(map.entries()).map(([k, v]) => [serializeValue(k), serializeValue(v)]),
  };
}

/**
 * Deserialize Map objects
 */
export function deserializeMap<K = unknown, V = unknown>(serialized: SerializableValue): Map<K, V> {
  if (
    typeof serialized === 'object' &&
    serialized !== null &&
    (serialized as Record<string, unknown>)['__type'] === 'Map'
  ) {
    const entries = (serialized as Record<string, unknown>)['entries'] as [
      SerializableValue,
      SerializableValue,
    ][];
    return new Map(entries.map(([k, v]) => [deserializeValue(k) as K, deserializeValue(v) as V]));
  }
  throw new Error('Invalid serialized Map format');
}

/**
 * Serialize Set objects
 */
export function serializeSet<T>(set: Set<T>): SerializableValue {
  return {
    __type: 'Set',
    values: Array.from(set).map(serializeValue),
  };
}

/**
 * Deserialize Set objects
 */
export function deserializeSet<T = unknown>(serialized: SerializableValue): Set<T> {
  if (
    typeof serialized === 'object' &&
    serialized !== null &&
    (serialized as Record<string, unknown>)['__type'] === 'Set'
  ) {
    const values = (serialized as Record<string, unknown>)['values'] as SerializableValue[];
    return new Set(values.map(v => deserializeValue(v) as T));
  }
  throw new Error('Invalid serialized Set format');
}

// =============================================================================
// Storage Utilities
// =============================================================================

/**
 * Create a namespaced storage key
 */
export function createStorageKey(namespace: string, id?: string): StorageKey {
  return id ? `${namespace}:${id}` : namespace;
}

/**
 * Validate storage key format
 */
export function validateStorageKey(key: StorageKey): boolean {
  return typeof key === 'string' && key.length > 0;
}

/**
 * Determine appropriate storage area for a key
 */
export function getStorageArea(key: StorageKey): StorageArea {
  if (key.startsWith('settings') || key.startsWith('apiKeys')) {
    return 'sync';
  }
  return 'local';
}

// =============================================================================
// Cache Utilities
// =============================================================================

/**
 * Create a new cache entry
 */
export function createCacheEntry<T>(
  key: string,
  value: T,
  options: {
    expiresIn?: number;
    tags?: string[];
  } = {}
): CacheEntry<T> {
  const now = Date.now();
  const size = calculateSize(value);

  return {
    key,
    value,
    metadata: {
      createdAt: now,
      expiresAt: now + (options.expiresIn || 3600000), // Default 1 hour
      accessCount: 0,
      lastAccessed: now,
      tags: options.tags,
      size,
    },
    storageVersion: CURRENT_STORAGE_VERSION,
  };
}

/**
 * Check if a cache entry has expired
 */
export function isCacheExpired(entry: CacheEntry): boolean {
  return Date.now() > entry.metadata.expiresAt;
}

/**
 * Clean expired entries from cache storage
 */
export function cleanExpiredCache(cache: CacheStorage): CacheStorage {
  const cleanedEntries: Record<string, CacheEntry> = {};
  let newSize = 0;

  for (const [key, entry] of Object.entries(cache.entries)) {
    if (!isCacheExpired(entry)) {
      cleanedEntries[key] = entry;
      newSize += entry.metadata.size;
    }
  }

  return {
    ...cache,
    entries: cleanedEntries,
    currentSize: newSize,
  };
}

/**
 * Calculate approximate size of a value in bytes
 */
function calculateSize(value: unknown): number {
  try {
    return new Blob([JSON.stringify(value)]).size;
  } catch {
    // Fallback calculation
    return JSON.stringify(value).length * 2; // Approximate UTF-16 encoding
  }
}

// =============================================================================
// Migration Utilities
// =============================================================================

/**
 * Get current storage version
 */
export function getCurrentVersion(): StorageVersion {
  return CURRENT_STORAGE_VERSION;
}

/**
 * Check if data needs migration
 */
export function needsMigration(data: { version?: number }, targetVersion: number): boolean {
  return (data.version || 0) < targetVersion;
}

/**
 * Apply migrations to data
 */
export async function applyMigrations(
  data: unknown,
  migrations: MigrationScript[]
): Promise<unknown> {
  let currentData = { ...(data as Record<string, unknown>) };
  const currentVersion = (currentData['version'] as number) || 0;

  // Sort migrations by version
  const sortedMigrations = migrations
    .filter(m => m.version > currentVersion)
    .sort((a, b) => a.version - b.version);

  for (const migration of sortedMigrations) {
    try {
      // Validate before migration if validator exists
      if (migration.validation && !migration.validation(currentData)) {
        throw new Error(`Pre-migration validation failed for version ${migration.version}`);
      }

      currentData = migration.up(currentData) as Record<string, unknown>;
      currentData['version'] = migration.version;
    } catch (error) {
      throw new Error(
        `Migration to version ${migration.version} failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  return currentData;
}

// =============================================================================
// Default Export
// =============================================================================

export default {
  // Types are exported as named exports above
  serialize,
  deserialize,
  createStorageKey,
  validateStorageKey,
  getStorageArea,
  createCacheEntry,
  isCacheExpired,
  cleanExpiredCache,
  getCurrentVersion,
  needsMigration,
  applyMigrations,
};
