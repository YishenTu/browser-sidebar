/**
 * @file AI Provider type definitions and validation
 *
 * This file contains comprehensive type definitions for the AI provider system,
 * including interfaces for OpenAI, Gemini, and OpenRouter providers, along with
 * configuration types, response types, and validation utilities.
 *
 * Supports all provider-specific configuration options:
 * - OpenAI: temperature (0.0-2.0), reasoning_effort (low/medium/high)
 * - Gemini: temperature (0.0-2.0), thinking_mode (off/dynamic), thought visibility
 * - OpenRouter/Claude: temperature (0.0-2.0), max_thinking_tokens (5k-100k)
 */

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
export type ReasoningEffort = 'low' | 'medium' | 'high';

/**
 * Thinking modes for Gemini models
 */
export type ThinkingMode = 'off' | 'dynamic';

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
  temperature: number;
  reasoningEffort: ReasoningEffort;
  model: string;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  seed?: number;
  user?: string;
}

/**
 * Gemini provider configuration
 */
export interface GeminiConfig {
  apiKey: string;
  temperature: number;
  thinkingMode: ThinkingMode;
  showThoughts: boolean;
  model: string;
  maxTokens: number;
  topP: number;
  topK: number;
  safetySettings?: Array<{
    category: string;
    threshold: string;
  }>;
  stopSequences?: string[];
}

/**
 * OpenRouter provider configuration
 */
export interface OpenRouterConfig {
  apiKey: string;
  temperature: number;
  maxThinkingTokens: number;
  model: string;
  maxTokens: number;
  topP: number;
  endpoint: string;
  headers?: Record<string, string>;
  transforms?: string[];
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
    [key: string]: any;
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
 * Response metadata
 */
export interface ResponseMetadata {
  provider: ProviderType;
  timestamp: Date;
  requestId?: string;
  model?: string;
  [key: string]: any;
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
    [key: string]: any;
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
    [key: string]: any;
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
  thinking: boolean; // Gemini thinking mode or Claude thinking tokens
  multimodal: boolean;
  functionCalling: boolean;
  maxContextLength: number;
  supportedModels: string[];
}

/**
 * Model configuration
 */
export interface ModelConfig {
  id: string;
  name: string;
  provider: ProviderType;
  maxTokens: number;
  contextLength: number;
  costPer1kTokens: {
    input: number;
    output: number;
  };
  capabilities: {
    streaming: boolean;
    temperature: boolean;
    reasoning: boolean;
    thinking: boolean;
    multimodal: boolean;
    functionCalling: boolean;
  };
  parameters: {
    temperature: { min: number; max: number; default: number };
    topP?: { min: number; max: number; default: number };
    reasoningEffort?: ReasoningEffort[]; // Available for OpenAI
    thinkingMode?: ThinkingMode[]; // Available for Gemini
    maxThinkingTokens?: { min: number; max: number; default: number }; // OpenRouter/Claude
  };
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
  validateConfig(config: any): ProviderValidationResult;
  testConnection(): Promise<boolean>;

  // Chat methods
  chat(messages: ProviderChatMessage[], config?: any): Promise<ProviderResponse>;
  streamChat(messages: ProviderChatMessage[], config?: any): AsyncIterable<StreamChunk>;

  // Model methods
  getModels(): ModelConfig[];
  getModel(id: string): ModelConfig | undefined;

  // Utility methods
  estimateTokens(text: string): number;
  formatError(error: any): ProviderError;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for provider types
 */
export function isProviderType(value: any): value is ProviderType {
  return typeof value === 'string' && ['openai', 'gemini', 'openrouter'].includes(value);
}

/**
 * Type guard for provider errors
 */
export function isProviderError(value: any): value is ProviderError {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.type === 'string' &&
    ['authentication', 'rate_limit', 'network', 'validation', 'unknown'].includes(value.type) &&
    typeof value.message === 'string' &&
    typeof value.code === 'string' &&
    isProviderType(value.provider)
  );
}

/**
 * Type guard for stream chunks
 */
export function isStreamChunk(value: any): value is StreamChunk {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.id === 'string' &&
    typeof value.object === 'string' &&
    typeof value.created === 'number' &&
    typeof value.model === 'string' &&
    Array.isArray(value.choices) &&
    value.choices.every(
      (choice: any) =>
        typeof choice.index === 'number' &&
        typeof choice.delta === 'object' &&
        choice.delta !== null
    )
  );
}

/**
 * Type guard for provider responses
 */
export function isProviderResponse(value: any): value is ProviderResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.id === 'string' &&
    typeof value.content === 'string' &&
    typeof value.model === 'string' &&
    typeof value.usage === 'object' &&
    value.usage !== null &&
    typeof value.usage.promptTokens === 'number' &&
    typeof value.usage.completionTokens === 'number' &&
    typeof value.usage.totalTokens === 'number' &&
    typeof value.metadata === 'object' &&
    value.metadata !== null &&
    isProviderType(value.metadata.provider)
  );
}

/**
 * Type guard for streaming responses
 */
export function isStreamingResponse(value: any): value is StreamingResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.id === 'string' &&
    typeof value.model === 'string' &&
    Array.isArray(value.choices) &&
    typeof value.metadata === 'object' &&
    value.metadata !== null &&
    isProviderType(value.metadata.provider)
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
 * Validate thinking mode value
 */
export function isValidThinkingMode(value: any): value is ThinkingMode {
  return typeof value === 'string' && ['off', 'dynamic'].includes(value);
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
export function validateOpenAIConfig(config: any): ProviderValidationResult {
  const errors: string[] = [];

  if (!config.apiKey || typeof config.apiKey !== 'string' || config.apiKey.trim() === '') {
    errors.push('Invalid API key');
  }

  if (!isValidTemperature(config.temperature)) {
    errors.push('Invalid temperature');
  }

  if (!isValidReasoningEffort(config.reasoningEffort)) {
    errors.push('Invalid reasoning effort');
  }

  if (!config.model || typeof config.model !== 'string') {
    errors.push('Invalid model');
  }

  if (typeof config.maxTokens !== 'number' || config.maxTokens <= 0) {
    errors.push('Invalid max tokens');
  }

  if (typeof config.topP !== 'number' || config.topP < 0 || config.topP > 1) {
    errors.push('Invalid top P');
  }

  if (
    typeof config.frequencyPenalty !== 'number' ||
    config.frequencyPenalty < -2 ||
    config.frequencyPenalty > 2
  ) {
    errors.push('Invalid frequency penalty');
  }

  if (
    typeof config.presencePenalty !== 'number' ||
    config.presencePenalty < -2 ||
    config.presencePenalty > 2
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
export function validateGeminiConfig(config: any): ProviderValidationResult {
  const errors: string[] = [];

  if (!config.apiKey || typeof config.apiKey !== 'string' || config.apiKey.trim() === '') {
    errors.push('Invalid API key');
  }

  if (!isValidTemperature(config.temperature)) {
    errors.push('Invalid temperature');
  }

  if (!isValidThinkingMode(config.thinkingMode)) {
    errors.push('Invalid thinking mode');
  }

  if (typeof config.showThoughts !== 'boolean') {
    errors.push('Invalid show thoughts setting');
  }

  if (!config.model || typeof config.model !== 'string') {
    errors.push('Invalid model');
  }

  if (typeof config.maxTokens !== 'number' || config.maxTokens <= 0) {
    errors.push('Invalid max tokens');
  }

  if (typeof config.topP !== 'number' || config.topP <= 0 || config.topP > 1) {
    errors.push('Invalid top P');
  }

  if (typeof config.topK !== 'number' || config.topK <= 0) {
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
export function validateOpenRouterConfig(config: any): ProviderValidationResult {
  const errors: string[] = [];

  if (!config.apiKey || typeof config.apiKey !== 'string' || config.apiKey.trim() === '') {
    errors.push('Invalid API key');
  }

  if (!isValidTemperature(config.temperature)) {
    errors.push('Invalid temperature');
  }

  if (!isValidMaxThinkingTokens(config.maxThinkingTokens)) {
    errors.push('Invalid max thinking tokens');
  }

  if (!config.model || typeof config.model !== 'string') {
    errors.push('Invalid model');
  }

  if (typeof config.maxTokens !== 'number' || config.maxTokens <= 0) {
    errors.push('Invalid max tokens');
  }

  if (typeof config.topP !== 'number' || config.topP < 0 || config.topP > 1) {
    errors.push('Invalid top P');
  }

  if (!config.endpoint || typeof config.endpoint !== 'string') {
    errors.push('Invalid endpoint URL');
  } else {
    try {
      new URL(config.endpoint);
    } catch {
      errors.push('Invalid endpoint URL format');
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
 * Gemini thinking mode options
 */
export const THINKING_MODES: ThinkingMode[] = ['off', 'dynamic'];

/**
 * Max thinking tokens range for Claude via OpenRouter
 */
export const MAX_THINKING_TOKENS_RANGE = {
  min: 5000,
  max: 100000,
  default: 25000,
  step: 5000,
} as const;
