/**
 * @file Conversation Type Definitions
 *
 * Comprehensive conversation type definitions for IndexedDB storage compatibility.
 * Includes tab context, model settings, serialization utilities, and type guards.
 *
 * Features:
 * - Complete conversation data structure with metadata
 * - Tab context for web page information
 * - Model/provider settings for AI interactions
 * - Serialization/deserialization for IndexedDB storage
 * - Runtime type validation with type guards
 * - Helper functions for creating and updating conversations
 */

import type { ChatMessage } from './chat';
import { DEFAULT_MODEL_ID } from '../config/models';

// =============================================================================
// Core Type Definitions
// =============================================================================

/**
 * Tab context information for conversation origin
 */
export interface TabContext {
  /** URL of the web page */
  url: string;
  /** Title of the web page */
  title: string;
  /** Timestamp when context was captured */
  timestamp: number;
  /** Selected text from the page (optional) */
  selectedText?: string;
  /** Favicon URL (optional) */
  favicon?: string;
  /** Page language (optional) */
  language?: string;
  /** Additional metadata (optional) */
  metadata?: {
    /** Word count of the page */
    wordCount?: number;
    /** Estimated reading time in minutes */
    readingTime?: number;
    /** Custom metadata fields */
    [key: string]: unknown;
  };
}

/**
 * AI model and provider settings
 */
export interface ModelSettings {
  /** AI provider name */
  provider: string;
  /** Model name */
  model: string;
  /** Temperature setting for randomness */
  temperature: number;
  /** Maximum tokens for response (optional) */
  maxTokens?: number;
  /** Top-p sampling parameter (optional) */
  topP?: number;
  /** Frequency penalty (optional) */
  frequencyPenalty?: number;
  /** Presence penalty (optional) */
  presencePenalty?: number;
  /** System prompt (optional) */
  systemPrompt?: string;
  /** Custom provider-specific settings (optional) */
  customSettings?: {
    [key: string]: unknown;
  };
}

/**
 * Conversation metadata with storage and indexing support
 */
export interface ConversationStorageMetadata {
  /** Creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
  /** Total number of messages */
  messageCount: number;
  /** Conversation tags (optional) */
  tags?: string[];
  /** Whether conversation is archived (optional) */
  archived?: boolean;
  /** Whether conversation is pinned (optional) */
  pinned?: boolean;
  /** Last activity timestamp (optional) */
  lastActivity?: number;
}

/**
 * Complete conversation data structure for IndexedDB storage
 */
export interface ConversationData {
  /** Unique conversation identifier (IndexedDB keyPath) */
  id: string;
  /** Conversation title */
  title: string;
  /** Array of chat messages */
  messages: ChatMessage[];
  /** Conversation metadata */
  metadata: ConversationStorageMetadata;
  /** Tab context where conversation originated (optional) */
  tabContext?: TabContext;
  /** Model settings used for this conversation (optional) */
  modelSettings?: ModelSettings;
}

/**
 * Conversation creation parameters
 */
export interface ConversationStorageCreate {
  /** Custom ID (optional, auto-generated if not provided) */
  id?: string;
  /** Initial messages (optional) */
  messages?: ChatMessage[];
  /** Tab context (optional) */
  tabContext?: TabContext;
  /** Model settings (optional) */
  modelSettings?: ModelSettings;
  /** Additional metadata (optional) */
  metadata?: Partial<ConversationStorageMetadata>;
}

/**
 * Conversation update parameters (partial update)
 */
export interface ConversationStorageUpdate {
  /** Updated title (optional) */
  title?: string;
  /** Updated tab context (optional) */
  tabContext?: TabContext;
  /** Updated model settings (optional) */
  modelSettings?: ModelSettings;
  /** Updated metadata (optional) */
  metadata?: Partial<ConversationStorageMetadata>;
}

/**
 * Serialized conversation type for JSON storage
 */
export interface ConversationSerialized {
  id: string;
  title: string;
  messages: ChatMessage[];
  metadata: ConversationStorageMetadata;
  tabContext?: TabContext;
  modelSettings?: ModelSettings;
}

/**
 * Validation result for storage compatibility
 */
export interface ConversationValidationResult {
  isValid: boolean;
  errors: string[];
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard to check if a value is a valid TabContext
 */
export function isTabContext(value: unknown): value is TabContext {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  return (
    typeof obj['url'] === 'string' &&
    typeof obj['title'] === 'string' &&
    typeof obj['timestamp'] === 'number' &&
    (obj['timestamp'] as number) > 0 &&
    (obj['selectedText'] === undefined || typeof obj['selectedText'] === 'string') &&
    (obj['favicon'] === undefined || typeof obj['favicon'] === 'string') &&
    (obj['language'] === undefined || typeof obj['language'] === 'string') &&
    (obj['metadata'] === undefined ||
      (typeof obj['metadata'] === 'object' && obj['metadata'] !== null))
  );
}

/**
 * Type guard to check if a value is a valid ModelSettings
 */
export function isModelSettings(value: unknown): value is ModelSettings {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  return (
    typeof obj['provider'] === 'string' &&
    typeof obj['model'] === 'string' &&
    typeof obj['temperature'] === 'number' &&
    (obj['temperature'] as number) >= 0 &&
    (obj['temperature'] as number) <= 2 &&
    (obj['maxTokens'] === undefined ||
      (typeof obj['maxTokens'] === 'number' && (obj['maxTokens'] as number) > 0)) &&
    (obj['topP'] === undefined ||
      (typeof obj['topP'] === 'number' &&
        (obj['topP'] as number) >= 0 &&
        (obj['topP'] as number) <= 1)) &&
    (obj['frequencyPenalty'] === undefined ||
      (typeof obj['frequencyPenalty'] === 'number' &&
        (obj['frequencyPenalty'] as number) >= -2 &&
        (obj['frequencyPenalty'] as number) <= 2)) &&
    (obj['presencePenalty'] === undefined ||
      (typeof obj['presencePenalty'] === 'number' &&
        (obj['presencePenalty'] as number) >= -2 &&
        (obj['presencePenalty'] as number) <= 2)) &&
    (obj['systemPrompt'] === undefined || typeof obj['systemPrompt'] === 'string') &&
    (obj['customSettings'] === undefined ||
      (typeof obj['customSettings'] === 'object' && obj['customSettings'] !== null))
  );
}

/**
 * Type guard to check if a value is a valid ConversationStorageMetadata
 */
export function isConversationStorageMetadata(
  value: unknown
): value is ConversationStorageMetadata {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  return (
    typeof obj['createdAt'] === 'number' &&
    (obj['createdAt'] as number) > 0 &&
    typeof obj['updatedAt'] === 'number' &&
    (obj['updatedAt'] as number) > 0 &&
    typeof obj['messageCount'] === 'number' &&
    (obj['messageCount'] as number) >= 0 &&
    (obj['tags'] === undefined ||
      (Array.isArray(obj['tags']) &&
        (obj['tags'] as unknown[]).every(tag => typeof tag === 'string'))) &&
    (obj['archived'] === undefined || typeof obj['archived'] === 'boolean') &&
    (obj['pinned'] === undefined || typeof obj['pinned'] === 'boolean') &&
    (obj['lastActivity'] === undefined ||
      (typeof obj['lastActivity'] === 'number' && (obj['lastActivity'] as number) > 0))
  );
}

/**
 * Type guard to check if a value is a valid ConversationData
 */
export function isConversationData(value: unknown): value is ConversationData {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  return (
    typeof obj['id'] === 'string' &&
    (obj['id'] as string).length > 0 &&
    typeof obj['title'] === 'string' &&
    Array.isArray(obj['messages']) &&
    // We'll assume messages are valid ChatMessages (would need to import type guard from chat.ts)
    isConversationStorageMetadata(obj['metadata']) &&
    (obj['tabContext'] === undefined || isTabContext(obj['tabContext'])) &&
    (obj['modelSettings'] === undefined || isModelSettings(obj['modelSettings']))
  );
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate a unique conversation ID
 */
export function generateConversationId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `conv_${timestamp}_${random}`;
}

/**
 * Create a new TabContext
 */
export function createTabContext(
  url: string,
  title: string,
  options: Partial<Omit<TabContext, 'url' | 'title' | 'timestamp'>> = {}
): TabContext {
  return {
    url,
    title,
    timestamp: Date.now(),
    ...options,
  };
}

/**
 * Create new ModelSettings
 */
export function createModelSettings(
  provider: string,
  model: string,
  options: Partial<Omit<ModelSettings, 'provider' | 'model' | 'temperature'>> & {
    temperature?: number;
  } = {}
): ModelSettings {
  return {
    provider,
    model,
    temperature: options.temperature ?? 0.7,
    ...options,
  };
}

/**
 * Create a new conversation for storage
 */
export function createStorageConversation(
  title: string,
  options: ConversationStorageCreate = {}
): ConversationData {
  const now = Date.now();
  const messages = options.messages || [];

  return {
    id: options.id || generateConversationId(),
    title,
    messages,
    metadata: {
      createdAt: now,
      updatedAt: now,
      messageCount: messages.length,
      ...options.metadata,
    },
    tabContext: options.tabContext,
    modelSettings: options.modelSettings,
  };
}

/**
 * Update an existing conversation
 */
export function updateStorageConversation(
  conversation: ConversationData,
  updates: ConversationStorageUpdate
): ConversationData {
  const now = Date.now();
  // Ensure updatedAt is always greater than original
  const updatedAt = Math.max(now, conversation.metadata.updatedAt + 1);

  return {
    ...conversation,
    title: updates.title ?? conversation.title,
    tabContext: updates.tabContext ?? conversation.tabContext,
    modelSettings: updates.modelSettings ?? conversation.modelSettings,
    metadata: {
      ...conversation.metadata,
      ...updates.metadata,
      updatedAt,
    },
  };
}

// =============================================================================
// Serialization Functions
// =============================================================================

/**
 * Serialize conversation for IndexedDB storage
 */
export function serializeConversation(conversation: ConversationData): string {
  try {
    const serializable: ConversationSerialized = {
      id: conversation.id,
      title: conversation.title,
      messages: conversation.messages,
      metadata: conversation.metadata,
      tabContext: conversation.tabContext,
      modelSettings: conversation.modelSettings,
    };

    return JSON.stringify(serializable);
  } catch (error) {
    throw new Error(
      `Failed to serialize conversation: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Deserialize conversation from IndexedDB storage
 */
export function deserializeConversation(serialized: string): ConversationData {
  try {
    const parsed = JSON.parse(serialized);

    if (!isConversationData(parsed)) {
      throw new Error('Invalid conversation data structure');
    }

    return parsed;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON format: ${error.message}`);
    }
    throw error;
  }
}

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Validate conversation data for IndexedDB storage compatibility
 */
export function validateConversationForStorage(
  conversation: unknown
): ConversationValidationResult {
  const errors: string[] = [];

  // First check basic structure
  if (typeof conversation !== 'object' || conversation === null) {
    errors.push('Invalid conversation data structure');
    return { isValid: false, errors };
  }

  const obj = conversation as Record<string, unknown>;

  // Validate required fields for IndexedDB
  if (!obj['id'] || typeof obj['id'] !== 'string' || obj['id'].trim() === '') {
    errors.push('Conversation id is required and cannot be empty');
  }

  if (!obj['title'] || typeof obj['title'] !== 'string') {
    errors.push('Conversation title is required');
  }

  if (!Array.isArray(obj['messages'])) {
    errors.push('Messages must be an array');
  }

  if (!obj['metadata'] || typeof obj['metadata'] !== 'object') {
    errors.push('Metadata is required');
    return { isValid: false, errors };
  }

  const metadata = obj['metadata'] as Record<string, unknown>;

  if (typeof metadata['messageCount'] !== 'number' || metadata['messageCount'] < 0) {
    errors.push('messageCount must be a non-negative number');
  }

  if (typeof metadata['createdAt'] !== 'number' || metadata['createdAt'] <= 0) {
    errors.push('Created timestamp must be a positive number');
  }

  if (typeof metadata['updatedAt'] !== 'number' || metadata['updatedAt'] <= 0) {
    errors.push('Updated timestamp must be a positive number');
  }

  if (
    typeof metadata['createdAt'] === 'number' &&
    typeof metadata['updatedAt'] === 'number' &&
    metadata['createdAt'] > metadata['updatedAt']
  ) {
    errors.push('Created timestamp cannot be after updated timestamp');
  }

  // Validate messages array matches count if both are valid
  if (
    Array.isArray(obj['messages']) &&
    typeof metadata['messageCount'] === 'number' &&
    obj['messages'].length !== metadata['messageCount']
  ) {
    errors.push('Message count mismatch between metadata and actual messages');
  }

  // Only do full type validation if basic structure is valid
  if (errors.length === 0) {
    if (!isConversationData(conversation)) {
      errors.push('Invalid conversation data structure');
    }

    const conv = conversation as ConversationData;

    // Validate tab context if present
    if (conv.tabContext && !isTabContext(conv.tabContext)) {
      errors.push('Invalid tab context structure');
    }

    // Validate model settings if present
    if (conv.modelSettings && !isModelSettings(conv.modelSettings)) {
      errors.push('Invalid model settings structure');
    }

    // Check serialization compatibility
    try {
      const serialized = serializeConversation(conv);
      if (serialized.length > 10 * 1024 * 1024) {
        // 10MB limit
        errors.push('Serialized conversation exceeds size limit');
      }
    } catch (error) {
      errors.push(
        `Serialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// =============================================================================
// Utility Functions for Developer Experience
// =============================================================================

/**
 * Create a conversation with sensible defaults for development/testing
 */
export function createTestConversation(
  title: string = 'Test Conversation',
  overrides: Partial<ConversationStorageCreate> = {}
): ConversationData {
  return createStorageConversation(title, {
    tabContext: createTabContext('https://example.com/test', 'Example Test Page'),
    modelSettings: createModelSettings('openai', DEFAULT_MODEL_ID, { temperature: 0.7 }),
    ...overrides,
  });
}

/**
 * Get a summary of conversation for display purposes
 */
export function getConversationSummary(conversation: ConversationData): {
  id: string;
  title: string;
  messageCount: number;
  lastActivity: string;
  provider?: string;
  model?: string;
  url?: string;
} {
  return {
    id: conversation.id,
    title: conversation.title,
    messageCount: conversation.metadata.messageCount,
    lastActivity: new Date(conversation.metadata.updatedAt).toISOString(),
    provider: conversation.modelSettings?.provider,
    model: conversation.modelSettings?.model,
    url: conversation.tabContext?.url,
  };
}
