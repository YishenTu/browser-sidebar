/**
 * @file Gemini Models Configuration
 *
 * Configuration for Gemini 2.5 Flash Lite model including:
 * - Model specifications (context window: 1,048,576 tokens, max output: 65,536 tokens)
 * - Thinking mode support (off/dynamic)
 * - Multimodal capabilities (text, image, video, audio, PDF)
 * - Temperature and parameter configurations
 * - Function calling support
 *
 * Task 4.2.2c - Gemini Models Configuration
 * Model information from: https://ai.google.dev/gemini-api/docs/models#gemini-2.5-flash-lite
 */

import type { ModelConfig, ThinkingMode } from '../../types/providers';

/**
 * Gemini model configuration data with thinking mode support
 */
export const GEMINI_MODELS: Omit<ModelConfig, 'provider'>[] = [
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    maxTokens: 65536, // Updated from model card
    contextLength: 1048576, // Updated from model card (1,048,576 tokens)
    costPer1kTokens: { input: 0.00005, output: 0.0001 },
    capabilities: {
      streaming: true,
      temperature: true,
      reasoning: false,
      thinking: true,
      multimodal: true, // Supports text, image, video, audio, PDF
      functionCalling: true,
    },
    parameters: {
      temperature: { min: 0.0, max: 2.0, default: 1.0 },
      topP: { min: 0.1, max: 1.0, default: 0.95 },
      thinkingMode: ['off', 'dynamic'] as ThinkingMode[],
    },
  },
] as const;

/**
 * Thinking mode support matrix for different Gemini models
 *
 * Gemini 2.5 Flash Lite supports both 'off' and 'dynamic' thinking modes:
 * - 'off': No thinking tokens generated
 * - 'dynamic': Model can generate internal reasoning thoughts
 */
export const THINKING_MODE_SUPPORT: Record<string, ThinkingMode[]> = {
  'gemini-2.5-flash-lite': ['off', 'dynamic'],
};

/**
 * Context window limits for Gemini models
 */
export const CONTEXT_LIMITS: Record<string, number> = {
  'gemini-2.5-flash-lite': 1048576, // 1,048,576 tokens from model card
};

/**
 * Multimodal capability matrix
 */
export const MULTIMODAL_SUPPORT: Record<string, boolean> = {
  'gemini-2.5-flash-lite': true, // Supports text, image, video, audio, PDF
};

/**
 * Function calling capability matrix
 */
export const FUNCTION_CALLING_SUPPORT: Record<string, boolean> = {
  'gemini-2.5-flash-lite': true,
};

/**
 * Default temperature settings per model optimized for their use cases
 */
export const DEFAULT_TEMPERATURES: Record<string, number> = {
  'gemini-2.5-flash-lite': 1.0,
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
  return CONTEXT_LIMITS[modelId] ?? 1048576; // Default to 1,048,576 tokens
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
    errors.push(
      `Model ${modelId} max tokens (${model.maxTokens}) exceed context window (${contextLimit})`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
