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
  ThinkingBudget,
  FinishReason,
  TemperatureConfig,
  OpenAIConfig,
  GeminiConfig,
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

// Extraction types and interfaces
export type { ExtractionMethod, ExtractedContent, ExtractionOptions } from './extraction';
export { ExtractionMode } from './extraction';

export {
  isProviderType,
  isProviderError,
  isStreamChunk,
  isProviderResponse,
  isStreamingResponse,
  isValidTemperature,
  isValidReasoningEffort,
  isValidThinkingBudget,
  isValidMaxThinkingTokens,
  validateOpenAIConfig,
  validateGeminiConfig,
  validateProviderConfig,
  TEMPERATURE_CONFIG,
  REASONING_EFFORTS,
  THINKING_BUDGETS,
  MAX_THINKING_TOKENS_RANGE,
} from './providers';

export {
  DEFAULT_EXTRACTION_OPTIONS,
  isExtractedContent,
  isExtractionOptions,
  validateExtractionOptions,
} from './extraction';

// Tab types and interfaces
export type {
  TabInfo,
  TabContent,
  TabExtractionState,
  TabSelectionCriteria,
  TabGrouping,
} from './tabs';

export {
  isTabInfo,
  isTabContent,
  isTabExtractionState,
  createTabInfoFromChromeTab,
  filterTabs,
  createEmptyTabState,
  serializeTabState,
  deserializeTabState,
} from './tabs';

// Note: CSS module declarations are in css.d.ts as ambient declarations
// and don't need to be re-exported here
