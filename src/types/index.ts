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
  applyMigrations,
} from './storage';

// Provider types and interfaces (specific exports to avoid conflicts)
export type {
  ProviderType,
  ProviderChatRole,
  ErrorType,
  ReasoningEffort,
  ThinkingMode,
  FinishReason,
  TemperatureConfig,
  OpenAIConfig,
  GeminiConfig,
  OpenRouterConfig,
  ProviderConfig,
  ProviderChatMessage,
  Delta,
  StreamChoice,
  Choice,
  Usage,
  ResponseMetadata,
  ProviderResponse,
  StreamingResponse,
  StreamChunk,
  ProviderError,
  ProviderValidationResult,
  ProviderCapabilities,
  ModelConfig,
  ProviderMetadata,
  AIProvider,
} from './providers';

export {
  isProviderType,
  isProviderError,
  isStreamChunk,
  isProviderResponse,
  isStreamingResponse,
  isValidTemperature,
  isValidReasoningEffort,
  isValidThinkingMode,
  isValidMaxThinkingTokens,
  validateOpenAIConfig,
  validateGeminiConfig,
  validateOpenRouterConfig,
  validateProviderConfig,
  TEMPERATURE_CONFIG,
  REASONING_EFFORTS,
  THINKING_MODES,
  MAX_THINKING_TOKENS_RANGE,
} from './providers';

// Note: CSS module declarations are in css.d.ts as ambient declarations
// and don't need to be re-exported here
