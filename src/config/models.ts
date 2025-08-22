/**
 * Centralized configuration for supported AI models
 * This is the single source of truth for available models across the application
 */

export interface ModelConfig {
  id: string;
  name: string;
  provider: 'OpenAI' | 'Google';
  providerType: 'openai' | 'gemini';
  maxTokens: number;
  available: boolean;
}

export const SUPPORTED_MODELS: ModelConfig[] = [
  {
    id: 'gpt-5-nano',
    name: 'GPT-5 Nano',
    provider: 'OpenAI',
    providerType: 'openai',
    maxTokens: 4096,
    available: true,
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    provider: 'Google',
    providerType: 'gemini',
    maxTokens: 8192,
    available: true,
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
  return model?.providerType;
}

/**
 * Get max tokens for a given model ID
 */
export function getMaxTokensForModelId(modelId: string): number {
  const model = getModelById(modelId);
  return model?.maxTokens ?? 4096; // Default to 4096 if model not found
}
