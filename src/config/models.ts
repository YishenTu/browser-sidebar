/**
 * Centralized configuration for supported AI models
 * This is the single source of truth for available models across the application
 */

export interface ModelConfig {
  id: string;
  name: string;
  provider: 'openai' | 'gemini';
  // OpenAI specific
  reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
  // Gemini specific - '0' for off, '-1' for dynamic
  thinkingBudget?: '0' | '-1' | '<thinkingbudget>';
}

export const SUPPORTED_MODELS: ModelConfig[] = [
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    provider: 'gemini',
    thinkingBudget: '0', // 512 to 24576
  },
  // Append more models as needed
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'gemini',
    thinkingBudget: '0', // 0 to 24576
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'gemini',
    thinkingBudget: '-1', // 128 to 32768
  },
  {
    id: 'gpt-5-nano',
    name: 'GPT 5 Nano',
    provider: 'openai',
    reasoningEffort: 'low',
  },
  {
    id: 'gpt-5-mini',
    name: 'GPT 5 Mini',
    provider: 'openai',
    reasoningEffort: 'low',
  },
  {
    id: 'gpt-5',
    name: 'GPT 5',
    provider: 'openai',
    reasoningEffort: 'medium',
  },
];

export const DEFAULT_MODEL_ID = 'gpt-5-nano';

/**
 * Get model configuration by ID
 */
export function getModelById(id: string): ModelConfig | undefined {
  return SUPPORTED_MODELS.find(model => model.id === id);
}

/**
 * Get provider type for a given model ID
 */
export function getProviderTypeForModelId(modelId: string): 'openai' | 'gemini' | undefined {
  const model = getModelById(modelId);
  return model?.provider;
}

/**
 * Check if a model supports reasoning (OpenAI feature)
 */
export function supportsReasoning(modelId: string): boolean {
  const model = getModelById(modelId);
  return model?.provider === 'openai';
}

/**
 * Check if a model supports thinking budget (Gemini feature)
 */
export function supportsThinking(modelId: string): boolean {
  const model = getModelById(modelId);
  return model?.provider === 'gemini';
}

/**
 * Get all models for a specific provider
 */
export function getModelsByProvider(providerType: 'openai' | 'gemini'): ModelConfig[] {
  return SUPPORTED_MODELS.filter(model => model.provider === providerType);
}

/**
 * Check if a model exists
 */
export function modelExists(modelId: string): boolean {
  return SUPPORTED_MODELS.some(model => model.id === modelId);
}
