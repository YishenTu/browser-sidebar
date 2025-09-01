/**
 * @file AI Provider type definitions and validation
 *
 * This file contains comprehensive type definitions for the AI provider system,
 * including interfaces for OpenAI and Gemini providers, along with
 * configuration types, response types, and validation utilities.
 *
 * Supports all provider-specific configuration options:
 * - OpenAI: reasoning_effort (low/medium/high)
 * - Gemini: thinking_budget ('0'=off, '-1'=dynamic), thought visibility
 */

// Import and re-export ModelConfig from centralized location
import type { ModelConfig } from '../config/models';
export type { ModelConfig };

// ============================================================================
// Core Types
// ============================================================================

/**
 * Supported AI provider types
 */
export type ProviderType = 'openai' | 'gemini' | 'openrouter';

/**
 * Chat message roles for AI providers
 */
export type ProviderChatRole = 'user' | 'assistant' | 'system';

/**
 * Error types for provider failures
 */
export type ErrorType = 'authentication' | 'rate_limit' | 'network' | 'validation' | 'unknown';

/**
 * Reasoning effort levels for OpenAI models
 */
export type ReasoningEffort = 'minimal' | 'low' | 'medium' | 'high';

/**
 * OpenRouter reasoning configuration
 */
export interface OpenRouterReasoningConfig {
  effort?: 'low' | 'medium' | 'high';
  maxTokens?: number;
  exclude?: boolean;
}

/**
 * Thinking budget for Gemini models
 * '0' = off, '-1' = dynamic
 */
export type ThinkingBudget = '0' | '-1';

/**
 * Finish reasons for completion responses
 */
export type FinishReason = 'stop' | 'length' | 'content_filter' | 'tool_calls' | null;

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Temperature configuration with validation constraints
 */
export interface TemperatureConfig {
  temperature: number;
  min: number;
  max: number;
  step: number;
  default: number;
}

/**
 * OpenAI provider configuration
 */
export interface OpenAIConfig {
  apiKey: string;
  model: string;
  reasoningEffort?: ReasoningEffort;
  seed?: number;
  user?: string;
  customOptions?: Record<string, unknown>;
  [key: string]: unknown; // Index signature for compatibility with Record<string, unknown>
}

/**
 * Gemini provider configuration
 */
export interface GeminiConfig {
  apiKey: string;
  model: string;
  thinkingBudget?: ThinkingBudget;
  showThoughts?: boolean;
  safetySettings?: Array<{
    category: string;
    threshold: string;
  }>;
  stopSequences?: string[];
  endpoint?: string; // Optional custom endpoint for testing
  [key: string]: unknown; // Index signature for compatibility with Record<string, unknown>
}

/**
 * OpenRouter provider configuration
 */
export interface OpenRouterConfig {
  apiKey: string;
  model: string;
  reasoning?: OpenRouterReasoningConfig;
  headers?: {
    referer?: string;
    title?: string;
  };
  [key: string]: unknown; // Index signature for compatibility with Record<string, unknown>
}

/**
 * Generic provider configuration wrapper
 */
export interface ProviderConfig {
  type: ProviderType;
  config: OpenAIConfig | GeminiConfig | OpenRouterConfig;
}

// ============================================================================
// Message Types
// ============================================================================

/**
 * Provider chat message structure
 */
export interface ProviderChatMessage {
  id: string;
  role: ProviderChatRole;
  content: string;
  timestamp: Date;
  thinking?: string; // For models that support thinking tokens
  metadata?: {
    tokens?: number;
    thinkingTokens?: number;
    model?: string;
    [key: string]: unknown;
  };
}

/**
 * Delta content for streaming responses
 */
export interface Delta {
  role?: ProviderChatRole;
  content?: string;
  thinking?: string;
}

/**
 * Choice in streaming response
 */
export interface StreamChoice {
  index: number;
  delta: Delta;
  finishReason: FinishReason;
}

/**
 * Choice in complete response
 */
export interface Choice {
  index: number;
  message: ProviderChatMessage;
  finishReason: FinishReason;
}

/**
 * Token usage information
 */
export interface Usage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  thinkingTokens?: number; // For models with reasoning/thinking tokens
}

/**
 * Search result from web search
 */
export interface SearchResult {
  title: string;
  url: string;
  snippet?: string;
  domain?: string;
}

/**
 * Response metadata
 */
export interface ResponseMetadata {
  provider: ProviderType;
  timestamp: Date;
  requestId?: string;
  model?: string;
  // Some providers (OpenRouter web search) surface citations as an object
  // like { sources: SearchResult[] } that our UI reads directly.
  // Keep union for forward compatibility while not breaking existing callers.
  searchResults?: SearchResult[] | { sources: SearchResult[] };
  cacheDiscount?: number;
  [key: string]: unknown;
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * Complete provider response
 */
export interface ProviderResponse {
  id: string;
  content: string;
  model: string;
  usage: Usage;
  finishReason: FinishReason;
  thinking?: string; // For models that support reasoning
  metadata: ResponseMetadata;
  choices?: Choice[];
}

/**
 * Streaming response chunk
 */
export interface StreamingResponse {
  id: string;
  model: string;
  choices: StreamChoice[];
  usage: Usage | null; // Usually null during streaming
  metadata: ResponseMetadata;
}

/**
 * Individual stream chunk (SSE format)
 */
export interface StreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: StreamChoice[];
  usage?: Usage;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Provider error structure
 */
export interface ProviderError {
  type: ErrorType;
  message: string;
  code: string;
  provider: ProviderType;
  retryAfter?: number; // For rate limit errors
  details?: {
    statusCode?: number;
    timestamp?: Date;
    requestId?: string;
    [key: string]: unknown;
  };
}

/**
 * Validation result structure
 */
export interface ProviderValidationResult {
  isValid: boolean;
  errors: string[];
  details?: {
    field?: string;
    code?: string;
    [key: string]: unknown;
  };
}

// ============================================================================
// Provider Capability Types
// ============================================================================

/**
 * Provider capabilities
 */
export interface ProviderCapabilities {
  streaming: boolean;
  temperature: boolean;
  reasoning: boolean; // OpenAI reasoning_effort
  thinking: boolean; // Gemini thinking budget or Claude thinking tokens
  multimodal: boolean;
  functionCalling: boolean;
  maxContextLength: number;
  supportedModels: string[];
}

/**
 * Provider metadata
 */
export interface ProviderMetadata {
  name: string;
  description: string;
  website: string;
  documentation: string;
  version: string;
  capabilities: ProviderCapabilities;
}

// ============================================================================
// Provider Interface
// ============================================================================

/**
 * Base AI provider interface
 */
export interface AIProvider {
  type: ProviderType;
  name: string;
  capabilities: ProviderCapabilities;

  // Core methods
  initialize(config: ProviderConfig): Promise<void>;
  validateConfig(config: unknown): ProviderValidationResult;
  testConnection(): Promise<boolean>;

  // Chat method - streaming only
  streamChat(messages: ProviderChatMessage[], config?: unknown): AsyncIterable<StreamChunk>;

  // Model methods
  getModels(): ModelConfig[];
  getModel(id: string): ModelConfig | undefined;

  // Utility methods
  formatError(error: unknown): ProviderError;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for provider types
 */
export function isProviderType(value: unknown): value is ProviderType {
  return typeof value === 'string' && ['openai', 'gemini', 'openrouter'].includes(value);
}

/**
 * Type guard for provider errors
 */
export function isProviderError(value: unknown): value is ProviderError {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as any).type === 'string' &&
    ['authentication', 'rate_limit', 'network', 'validation', 'unknown'].includes(
      (value as any).type
    ) &&
    typeof (value as any).message === 'string' &&
    typeof (value as any).code === 'string' &&
    isProviderType((value as any).provider)
  );
}

/**
 * Type guard for stream chunks
 */
export function isStreamChunk(value: unknown): value is StreamChunk {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as any).id === 'string' &&
    typeof (value as any).object === 'string' &&
    typeof (value as any).created === 'number' &&
    typeof (value as any).model === 'string' &&
    Array.isArray((value as any).choices) &&
    (value as any).choices.every(
      (choice: unknown) =>
        typeof choice === 'object' &&
        choice !== null &&
        typeof (choice as { index?: unknown }).index === 'number' &&
        typeof (choice as { delta?: unknown }).delta === 'object' &&
        (choice as { delta?: unknown }).delta !== null
    )
  );
}

/**
 * Type guard for provider responses
 */
export function isProviderResponse(value: unknown): value is ProviderResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as any).id === 'string' &&
    typeof (value as any).content === 'string' &&
    typeof (value as any).model === 'string' &&
    typeof (value as any).usage === 'object' &&
    (value as any).usage !== null &&
    typeof (value as any).usage.promptTokens === 'number' &&
    typeof (value as any).usage.completionTokens === 'number' &&
    typeof (value as any).usage.totalTokens === 'number' &&
    typeof (value as any).metadata === 'object' &&
    (value as any).metadata !== null &&
    isProviderType((value as any).metadata.provider)
  );
}

/**
 * Type guard for streaming responses
 */
export function isStreamingResponse(value: unknown): value is StreamingResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as any).id === 'string' &&
    typeof (value as any).model === 'string' &&
    Array.isArray((value as any).choices) &&
    typeof (value as any).metadata === 'object' &&
    (value as any).metadata !== null &&
    isProviderType((value as any).metadata.provider)
  );
}

// ============================================================================
// Configuration Validators
// ============================================================================

/**
 * Validate temperature value (0.0 to 2.0)
 */
export function isValidTemperature(value: any): value is number {
  return typeof value === 'number' && !isNaN(value) && value >= 0.0 && value <= 2.0;
}

/**
 * Validate reasoning effort value
 */
export function isValidReasoningEffort(value: any): value is ReasoningEffort {
  return typeof value === 'string' && ['low', 'medium', 'high'].includes(value);
}

/**
 * Validate thinking budget value
 */
export function isValidThinkingBudget(value: any): value is ThinkingBudget {
  return typeof value === 'string' && ['0', '-1'].includes(value);
}

/**
 * Validate max thinking tokens (5000 to 100000)
 */
export function isValidMaxThinkingTokens(value: any): value is number {
  return typeof value === 'number' && !isNaN(value) && value >= 5000 && value <= 100000;
}

/**
 * Validate OpenAI configuration
 */
export function validateOpenAIConfig(config: unknown): ProviderValidationResult {
  const errors: string[] = [];
  const cfg = config as Record<string, unknown>;

  if (
    !cfg['apiKey'] ||
    typeof cfg['apiKey'] !== 'string' ||
    (cfg['apiKey'] as string).trim() === ''
  ) {
    errors.push('Invalid API key');
  }

  if (!isValidTemperature(cfg['temperature'])) {
    errors.push('Invalid temperature');
  }

  if (!isValidReasoningEffort(cfg['reasoningEffort'])) {
    errors.push('Invalid reasoning effort');
  }

  if (!cfg['model'] || typeof cfg['model'] !== 'string') {
    errors.push('Invalid model');
  }

  if (typeof cfg['maxTokens'] !== 'number' || cfg['maxTokens'] <= 0) {
    errors.push('Invalid max tokens');
  }

  if (typeof cfg['topP'] !== 'number' || cfg['topP'] < 0 || cfg['topP'] > 1) {
    errors.push('Invalid top P');
  }

  if (
    typeof cfg['frequencyPenalty'] !== 'number' ||
    cfg['frequencyPenalty'] < -2 ||
    cfg['frequencyPenalty'] > 2
  ) {
    errors.push('Invalid frequency penalty');
  }

  if (
    typeof cfg['presencePenalty'] !== 'number' ||
    cfg['presencePenalty'] < -2 ||
    cfg['presencePenalty'] > 2
  ) {
    errors.push('Invalid presence penalty');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate Gemini configuration
 */
export function validateGeminiConfig(config: unknown): ProviderValidationResult {
  const errors: string[] = [];
  const cfg = config as Record<string, unknown>;

  if (
    !cfg['apiKey'] ||
    typeof cfg['apiKey'] !== 'string' ||
    (cfg['apiKey'] as string).trim() === ''
  ) {
    errors.push('Invalid API key');
  }

  if (!isValidTemperature((config as any).temperature)) {
    errors.push('Invalid temperature');
  }

  if (!isValidThinkingBudget((config as any).thinkingBudget)) {
    errors.push('Invalid thinking budget');
  }

  if (typeof (config as any).showThoughts !== 'boolean') {
    errors.push('Invalid show thoughts setting');
  }

  if (!cfg['model'] || typeof cfg['model'] !== 'string') {
    errors.push('Invalid model');
  }

  if (typeof cfg['maxTokens'] !== 'number' || cfg['maxTokens'] <= 0) {
    errors.push('Invalid max tokens');
  }

  if (typeof cfg['topP'] !== 'number' || cfg['topP'] <= 0 || cfg['topP'] > 1) {
    errors.push('Invalid top P');
  }

  if (typeof cfg['topK'] !== 'number' || cfg['topK'] <= 0) {
    errors.push('Invalid top K');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate OpenRouter configuration
 */
export function validateOpenRouterConfig(config: unknown): ProviderValidationResult {
  const errors: string[] = [];
  const cfg = config as Record<string, unknown>;

  if (
    !cfg['apiKey'] ||
    typeof cfg['apiKey'] !== 'string' ||
    (cfg['apiKey'] as string).trim() === ''
  ) {
    errors.push('Invalid API key');
  }

  if (!cfg['model'] || typeof cfg['model'] !== 'string') {
    errors.push('Invalid model');
  }

  // Validate reasoning config if present
  if (cfg['reasoning']) {
    const reasoning = cfg['reasoning'] as any;
    if (reasoning.effort && !['low', 'medium', 'high'].includes(reasoning.effort)) {
      errors.push('Invalid reasoning effort');
    }
    if (reasoning.maxTokens !== undefined) {
      if (typeof reasoning.maxTokens !== 'number' || reasoning.maxTokens <= 0) {
        errors.push('Invalid reasoning max tokens');
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate generic provider configuration
 */
export function validateProviderConfig(config: ProviderConfig): ProviderValidationResult {
  if (!isProviderType(config.type)) {
    return {
      isValid: false,
      errors: ['Invalid provider type'],
    };
  }

  switch (config.type) {
    case 'openai':
      return validateOpenAIConfig(config.config);
    case 'gemini':
      return validateGeminiConfig(config.config);
    case 'openrouter':
      return validateOpenRouterConfig(config.config);
    default:
      return {
        isValid: false,
        errors: ['Unsupported provider type'],
      };
  }
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Temperature configuration constants
 */
export const TEMPERATURE_CONFIG: TemperatureConfig = {
  temperature: 0.7,
  min: 0.0,
  max: 2.0,
  step: 0.1,
  default: 0.7,
};

/**
 * OpenAI reasoning effort options
 */
export const REASONING_EFFORTS: ReasoningEffort[] = ['low', 'medium', 'high'];

/**
 * Gemini thinking budget options
 */
export const THINKING_BUDGETS: ThinkingBudget[] = ['0', '-1'];

/**
 * Max thinking tokens range for future use
 */
export const MAX_THINKING_TOKENS_RANGE = {
  min: 5000,
  max: 100000,
  default: 25000,
  step: 5000,
} as const;
