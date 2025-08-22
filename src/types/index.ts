/**
 * @file Main exports for all type definitions
 *
 * This file exports all TypeScript type definitions used throughout
 * the browser sidebar extension project.
 */

// Chrome manifest types and utilities
export * from './manifest';

// Message types and protocol
export * from './messages';

// Settings types and interfaces
export * from './settings';

// Chat types and interfaces
export * from './chat';

// Conversation types and storage utilities
export * from './conversation';

// API key types and management
export * from './apiKeys';

// Storage types and utilities (excluding conflicting exports)
export type {
  StorageVersion,
  StorageArea,
  StorageKey,
  SerializableValue,
  SerializableContainer,
  StorageContainer,
  ConversationStorage,
  SettingsStorage,
  CacheMetadata,
  CacheEntry,
  CacheStorage,
  StorageSchema,
  MigrationScript,
  LegacySettings
} from './storage';

export {
  CURRENT_STORAGE_VERSION,
  isSerializableValue,
  isStorageContainer,
  isConversationStorage,
  isSettingsStorage,
  isCacheEntry,
  isCacheStorage,
  isStorageSchema,
  serialize,
  deserialize,
  serializeDate,
  deserializeDate,
  serializeMap,
  deserializeMap,
  serializeSet,
  deserializeSet,
  createStorageKey,
  validateStorageKey,
  getStorageArea,
  createCacheEntry,
  isCacheExpired,
  cleanExpiredCache,
  getCurrentVersion,
  needsMigration,
  applyMigrations
} from './storage';

// Note: CSS module declarations are in css.d.ts as ambient declarations
// and don't need to be re-exported here
