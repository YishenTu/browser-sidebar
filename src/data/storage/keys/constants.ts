/**
 * @file API Key Storage Constants
 *
 * Configuration constants and settings for the API key storage system
 */

/** Object store names for IndexedDB */
export const OBJECT_STORES = {
  API_KEYS: 'api_keys',
  API_KEY_USAGE: 'api_key_usage',
  API_KEY_AUDIT: 'api_key_audit',
} as const;

/** Storage keys for Chrome storage */
export const STORAGE_KEYS = {
  API_KEY: 'api_key_',
  API_KEY_CACHE: 'api_key_cache_',
  API_KEY_INDEX: 'api_key_index',
  MIGRATION_STATUS: 'api_key_migration_status',
  API_KEY_HASH_PREFIX: 'api_key_hash_',
} as const;

/** Database store names */
export const DB_STORES = {
  METADATA: OBJECT_STORES.API_KEYS,
  USAGE_STATS: OBJECT_STORES.API_KEY_USAGE,
  AUDIT_LOG: OBJECT_STORES.API_KEY_AUDIT,
} as const;

/** Cache configuration */
export const CACHE_CONFIG = {
  MAX_SIZE: 100,
  TTL_MS: 30 * 60 * 1000, // 30 minutes
  CLEANUP_INTERVAL_MS: 5 * 60 * 1000, // 5 minutes
} as const;

/** Performance thresholds */
export const PERFORMANCE_THRESHOLDS = {
  BATCH_SIZE: 50,
  QUERY_TIMEOUT_MS: 5000,
  CONNECTION_TIMEOUT_MS: 10000,
} as const;

/** Provider API endpoints for connection testing */
export const PROVIDER_ENDPOINTS = {
  openai: 'https://api.openai.com/v1/models',
  anthropic: 'https://api.anthropic.com/v1/complete',
  google: 'https://generativelanguage.googleapis.com/v1/models',
  custom: null,
} as const;
