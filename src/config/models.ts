/**
 * Centralized configuration for supported AI models
 * This is the single source of truth for available models across the application
 */

export interface ModelConfig {
  id: string;
  name: string;
  provider: 'openai' | 'gemini' | 'openrouter' | 'openai_compat' | string;
  // Gemini specific thinking budget (tokens)
  //  - 0  = off (where supported, e.g. Flash/Lite)
  //  - -1 = dynamic (model‑decides)
  //  - N  = explicit token budget
  thinkingBudget?: 0 | -1 | number;
  // OpenAI specific
  reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
  // OpenRouter specific - max tokens for Anthropic models
  reasoningMaxTokens?: number;
  // Note: OpenRouter models can use either reasoningEffort (for OpenAI/DeepSeek models)
  // or reasoningMaxTokens (for Anthropic models) depending on the underlying model type
}

/**
 * OpenAI-Compatible provider preset definition
 * Kept here to centralize all configuration in one file.
 */
export interface OpenAICompatPreset {
  id: string;
  name: string;
  baseURL: string;
}

/**
 * Built-in presets for popular OpenAI-compatible providers
 */
export const OPENAI_COMPAT_PRESETS: OpenAICompatPreset[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseURL: 'https://api.deepseek.com/v1',
  },
  {
    id: 'qwen',
    name: 'Qwen (Alibaba Cloud)',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  },
  {
    id: 'zhipu',
    name: 'Zhipu AI',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
  },
  {
    id: 'kimi',
    name: 'Kimi (Moonshot AI)',
    baseURL: 'https://api.moonshot.cn/v1',
  },
];

/**
 * Helper: get OpenAI-Compatible preset by id
 */
export function getPresetById(id: string): OpenAICompatPreset | undefined {
  return OPENAI_COMPAT_PRESETS.find(p => p.id === id);
}

/**
 * Helper: check if a provider id is one of the built-in OpenAI-Compatible presets
 */
export function isBuiltInPreset(id: string): boolean {
  return OPENAI_COMPAT_PRESETS.some(p => p.id === id);
}

export const DEFAULT_MODELS: ModelConfig[] = [
  // Gemini models
  {
    id: 'gemini-flash-lite-latest',
    name: 'Gemini 2.5 Flash Lite',
    provider: 'gemini',
    thinkingBudget: 0, // 512 to 24576 supported; default off
  },
  {
    id: 'gemini-flash-latest',
    name: 'Gemini 2.5 Flash',
    provider: 'gemini',
    thinkingBudget: -1, // 0 to 24576; dynamic by default
  },
  {
    id: 'gemini-pro-latest',
    name: 'Gemini 2.5 Pro',
    provider: 'gemini',
    thinkingBudget: -1, // 128 to 32768; cannot be 0
  },
  // OpenAI models
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
  // OpenRouter models
  {
    id: 'anthropic/claude-sonnet-4.5',
    name: 'Claude Sonnet 4.5 (OpenRouter)',
    provider: 'openrouter',
    reasoningMaxTokens: 8000, // Anthropic models use max_tokens for reasoning
  },
  {
    id: 'x-ai/grok-4-fast:free',
    name: 'Grok 4 Fast (OpenRouter)',
    provider: 'openrouter',
    reasoningEffort: 'low',
  },
  {
    id: 'openai/gpt-5-nano',
    name: 'GPT 5 Nano (OpenRouter)',
    provider: 'openrouter',
    reasoningEffort: 'low',
  },
  {
    id: 'openai/gpt-5-mini',
    name: 'GPT 5 Mini (OpenRouter)',
    provider: 'openrouter',
    reasoningEffort: 'low',
  },
  {
    id: 'openai/gpt-5',
    name: 'GPT 5 (OpenRouter)',
    provider: 'openrouter',
    reasoningEffort: 'medium',
  },
  // Add more OpenRouter models as needed - just specify either:
  // - reasoningEffort for OpenAI/DeepSeek/Grok models
  // - reasoningMaxTokens for Anthropic models
  // - neither if the model doesn't support reasoning

  // OpenAI-compatible provider models
  // DeepSeek
  {
    id: 'deepseek-chat',
    name: 'DeepSeek Chat',
    provider: 'deepseek',
  },
  // Qwen (Alibaba Cloud)
  {
    id: 'qwen3-235b-a22b-instruct-2507',
    name: 'Qwen3 235B A22B Instruct',
    provider: 'qwen',
  },
  {
    id: 'qwen3-max',
    name: 'Qwen3 Max',
    provider: 'qwen',
  },
  {
    id: 'qwen3-next-80b-a3b-instruct',
    name: 'Qwen3 Next Instruct',
    provider: 'qwen',
  },
  // Zhipu AI
  {
    id: 'glm-4.6',
    name: 'GLM 4.6',
    provider: 'zhipu',
  },
  // Kimi (Moonshot AI)
  {
    id: 'kimi-k2-turbo-preview',
    name: 'Kimi K2 Turbo',
    provider: 'kimi',
  },
];

/**
 * Get the default model - returns the first available model from the list
 */
export function getDefaultModel(): string {
  return DEFAULT_MODELS[0]!.id;
}

/**
 * @deprecated Use getDefaultModel() instead
 * Kept temporarily for backward compatibility during migration
 */
export const DEFAULT_MODEL_ID = getDefaultModel();

/**
 * Get model configuration by ID
 */
export function getModelById(id: string): ModelConfig | undefined {
  return DEFAULT_MODELS.find(model => model.id === id);
}

/**
 * Get provider type for a given model ID
 */
export function getProviderTypeForModelId(
  modelId: string
): 'openai' | 'gemini' | 'openrouter' | undefined {
  const model = getModelById(modelId);
  if (!model) return undefined;
  if (model.provider === 'openai') return 'openai';
  if (model.provider === 'gemini') return 'gemini';
  if (model.provider === 'openrouter') return 'openrouter';
  // For OpenAI‑compatible and any other providers, return undefined here.
  // Callers that need to distinguish compat providers should map them to
  // 'openai_compat' explicitly based on model.provider.
  return undefined;
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
export function getModelsByProvider(
  providerType: 'openai' | 'gemini' | 'openrouter' | string
): ModelConfig[] {
  return DEFAULT_MODELS.filter(model => model.provider === providerType);
}

/**
 * Check if a model exists
 */
export function modelExists(modelId: string): boolean {
  return DEFAULT_MODELS.some(model => model.id === modelId);
}

/**
 * Built-in OpenAI-compatible provider IDs
 */
// Derive built-in OpenAI-compatible provider IDs from presets to avoid drift
export const OPENAI_COMPAT_PROVIDER_IDS = OPENAI_COMPAT_PRESETS.map(p => p.id) as readonly string[];

/**
 * Check if a provider ID is an OpenAI-compatible provider
 */
export function isOpenAICompatProvider(providerId: string): boolean {
  return providerId === 'openai_compat' || OPENAI_COMPAT_PROVIDER_IDS.includes(providerId);
}

/**
 * Get models by provider ID (including OpenAI-compatible providers)
 */
export function getModelsByProviderId(providerId: string): ModelConfig[] {
  // For built-in OpenAI-compatible providers, we'll add their models later
  // For now, return models filtered by provider
  return DEFAULT_MODELS.filter(model => model.provider === providerId);
}

/**
 * Get the default model ID for a provider
 */
export function getDefaultModelForProvider(providerId: string): string | undefined {
  // Always return the first available model for the given provider
  const models = getModelsByProviderId(providerId);
  return models.length > 0 && models[0] ? models[0].id : undefined;
}
