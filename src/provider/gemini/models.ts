/**
 * @file Gemini Models Configuration
 *
 * Configuration for all supported Gemini models including:
 * - Model specifications (context window, max tokens, costs)
 * - Thinking mode support matrix
 * - Multimodal capabilities
 * - Temperature and parameter configurations
 * - Function calling support
 *
 * Task 4.2.2c - Gemini Models Configuration
 * Defines comprehensive model configurations with thinking capabilities,
 * context limits, and thought visibility configuration.
 */

import type { ModelConfig, ThinkingMode } from '../../types/providers';

/**
 * Gemini model configuration data with thinking mode support
 */
export const GEMINI_MODELS: Omit<ModelConfig, 'provider'>[] = [
  {
    id: 'gemini-pro',
    name: 'Gemini Pro',
    maxTokens: 30720,
    contextLength: 1000000,
    costPer1kTokens: { input: 0.00025, output: 0.0005 },
    capabilities: {
      streaming: true,
      temperature: true,
      reasoning: false,
      thinking: true,
      multimodal: false,
      functionCalling: true,
    },
    parameters: {
      temperature: { min: 0.0, max: 2.0, default: 0.9 },
      topP: { min: 0.1, max: 1.0, default: 1.0 },
      thinkingMode: ['off', 'dynamic'] as ThinkingMode[],
    },
  },
  {
    id: 'gemini-pro-vision',
    name: 'Gemini Pro Vision',
    maxTokens: 16384,
    contextLength: 128000,
    costPer1kTokens: { input: 0.00025, output: 0.0005 },
    capabilities: {
      streaming: true,
      temperature: true,
      reasoning: false,
      thinking: true,
      multimodal: true,
      functionCalling: false,
    },
    parameters: {
      temperature: { min: 0.0, max: 2.0, default: 0.4 },
      topP: { min: 0.1, max: 1.0, default: 1.0 },
      thinkingMode: ['off', 'dynamic'] as ThinkingMode[],
    },
  },
  {
    id: 'gemini-pro-1.5',
    name: 'Gemini 1.5 Pro',
    maxTokens: 8192,
    contextLength: 2000000,
    costPer1kTokens: { input: 0.00125, output: 0.0025 },
    capabilities: {
      streaming: true,
      temperature: true,
      reasoning: false,
      thinking: true,
      multimodal: true,
      functionCalling: true,
    },
    parameters: {
      temperature: { min: 0.0, max: 2.0, default: 1.0 },
      topP: { min: 0.1, max: 1.0, default: 0.95 },
      thinkingMode: ['off', 'dynamic'] as ThinkingMode[],
    },
  },
  {
    id: 'gemini-flash',
    name: 'Gemini Flash',
    maxTokens: 8192,
    contextLength: 1000000,
    costPer1kTokens: { input: 0.000075, output: 0.00015 },
    capabilities: {
      streaming: true,
      temperature: true,
      reasoning: false,
      thinking: true,
      multimodal: true,
      functionCalling: true,
    },
    parameters: {
      temperature: { min: 0.0, max: 2.0, default: 1.0 },
      topP: { min: 0.1, max: 1.0, default: 0.95 },
      thinkingMode: ['off', 'dynamic'] as ThinkingMode[],
    },
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    maxTokens: 8192,
    contextLength: 1000000,
    costPer1kTokens: { input: 0.00005, output: 0.0001 },
    capabilities: {
      streaming: true,
      temperature: true,
      reasoning: false,
      thinking: true,
      multimodal: true,
      functionCalling: true,
    },
    parameters: {
      temperature: { min: 0.0, max: 2.0, default: 1.0 },
      topP: { min: 0.1, max: 1.0, default: 0.95 },
      thinkingMode: ['off', 'dynamic'] as ThinkingMode[],
    },
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    maxTokens: 8192,
    contextLength: 2000000,
    costPer1kTokens: { input: 0.001, output: 0.002 },
    capabilities: {
      streaming: true,
      temperature: true,
      reasoning: false,
      thinking: true,
      multimodal: true,
      functionCalling: true,
    },
    parameters: {
      temperature: { min: 0.0, max: 2.0, default: 0.8 },
      topP: { min: 0.1, max: 1.0, default: 0.95 },
      thinkingMode: ['off', 'dynamic'] as ThinkingMode[],
    },
  },
] as const;

/**
 * Thinking mode support matrix for different Gemini models
 * 
 * All current Gemini models support both 'off' and 'dynamic' thinking modes:
 * - 'off': No thinking tokens generated
 * - 'dynamic': Model can generate internal reasoning thoughts
 */
export const THINKING_MODE_SUPPORT: Record<string, ThinkingMode[]> = {
  'gemini-pro': ['off', 'dynamic'],
  'gemini-pro-vision': ['off', 'dynamic'],
  'gemini-pro-1.5': ['off', 'dynamic'],
  'gemini-flash': ['off', 'dynamic'],
  'gemini-2.5-flash-lite': ['off', 'dynamic'],
  'gemini-2.5-pro': ['off', 'dynamic'],
};

/**
 * Context window limits for Gemini models
 */
export const CONTEXT_LIMITS: Record<string, number> = {
  'gemini-pro': 1000000,
  'gemini-pro-vision': 128000,
  'gemini-pro-1.5': 2000000,
  'gemini-flash': 1000000,
  'gemini-2.5-flash-lite': 1000000,
  'gemini-2.5-pro': 2000000,
};

/**
 * Multimodal capability matrix
 */
export const MULTIMODAL_SUPPORT: Record<string, boolean> = {
  'gemini-pro': false,
  'gemini-pro-vision': true,
  'gemini-pro-1.5': true,
  'gemini-flash': true,
  'gemini-2.5-flash-lite': true,
  'gemini-2.5-pro': true,
};

/**
 * Function calling capability matrix
 */
export const FUNCTION_CALLING_SUPPORT: Record<string, boolean> = {
  'gemini-pro': true,
  'gemini-pro-vision': false, // Vision models don't support function calling
  'gemini-pro-1.5': true,
  'gemini-flash': true,
  'gemini-2.5-flash-lite': true,
  'gemini-2.5-pro': true,
};

/**
 * Default temperature settings per model optimized for their use cases
 */
export const DEFAULT_TEMPERATURES: Record<string, number> = {
  'gemini-pro': 0.9,
  'gemini-pro-vision': 0.4, // Lower for vision tasks requiring precision
  'gemini-pro-1.5': 1.0,
  'gemini-flash': 1.0,
  'gemini-2.5-flash-lite': 1.0,
  'gemini-2.5-pro': 0.8, // Slightly lower for balanced reasoning
};

/**
 * Get all available Gemini models with provider type
 */
export function getGeminiModels(): ModelConfig[] {
  return GEMINI_MODELS.map(model => ({
    ...model,
    provider: 'gemini' as const,
  }));
}

/**
 * Get specific Gemini model by ID
 */
export function getGeminiModel(id: string): ModelConfig | undefined {
  const model = GEMINI_MODELS.find(m => m.id === id);
  if (!model) return undefined;
  
  return {
    ...model,
    provider: 'gemini' as const,
  };
}

/**
 * Check if a model supports thinking mode
 */
export function supportsThinkingMode(modelId: string, mode: ThinkingMode): boolean {
  const supportedModes = THINKING_MODE_SUPPORT[modelId];
  return supportedModes?.includes(mode) ?? false;
}

/**
 * Check if a model supports multimodal input
 */
export function isMultimodalModel(modelId: string): boolean {
  return MULTIMODAL_SUPPORT[modelId] ?? false;
}

/**
 * Check if a model supports function calling
 */
export function supportsFunctionCalling(modelId: string): boolean {
  return FUNCTION_CALLING_SUPPORT[modelId] ?? false;
}

/**
 * Get context window limit for a model
 */
export function getContextLimit(modelId: string): number {
  return CONTEXT_LIMITS[modelId] ?? 1000000; // Default to 1M tokens
}

/**
 * Validate model configuration
 */
export function validateModelConfig(modelId: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  const model = GEMINI_MODELS.find(m => m.id === modelId);
  if (!model) {
    errors.push(`Model ${modelId} not found`);
    return { isValid: false, errors };
  }
  
  // Validate thinking mode configuration
  if (model.capabilities.thinking) {
    const supportedModes = THINKING_MODE_SUPPORT[modelId];
    if (!supportedModes || supportedModes.length === 0) {
      errors.push(`Model ${modelId} claims thinking support but has no supported modes`);
    }
  }
  
  // Validate context limits
  const contextLimit = CONTEXT_LIMITS[modelId];
  if (!contextLimit || contextLimit <= 0) {
    errors.push(`Model ${modelId} has invalid context limit`);
    return { isValid: false, errors };
  }
  
  // Validate max tokens don't exceed context window
  if (model.maxTokens > contextLimit) {
    errors.push(`Model ${modelId} max tokens (${model.maxTokens}) exceed context window (${contextLimit})`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}