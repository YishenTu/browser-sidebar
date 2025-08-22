/**
 * @file OpenAI Models Configuration
 *
 * OpenAI model definitions with parameter constraints and capabilities.
 * This file implements the model configuration requirements for Task 4.2.1c.
 *
 * Model Categories:
 * - GPT-5 series: Latest generation models with reasoning capabilities
 *
 * Parameter Support Matrix:
 * - Temperature: All models (0.0-2.0)
 * - Reasoning Effort: GPT-5 nano (low/medium/high)
 * - Multimodal: GPT-5 nano (text and image input)
 * - Function Calling: Not supported by current models
 *
 * GPT-5 Nano Specifications:
 * - Context Window: 400,000 tokens
 * - Max Output: 128,000 tokens
 * - Knowledge Cutoff: May 31, 2024
 * - Pricing: $0.05 per 1M input tokens, $0.40 per 1M output tokens
 */

import type { ModelConfig, ReasoningEffort } from '../../types/providers';

/**
 * OpenAI model configurations with complete parameter support matrix
 */
export const OPENAI_MODELS: ModelConfig[] = [
  // GPT-5 Series - Latest generation models with reasoning
  {
    id: 'gpt-5-nano',
    name: 'GPT-5 Nano',
    provider: 'openai',
    maxTokens: 128000, // 128,000 max output tokens per documentation
    contextLength: 400000, // 400,000 context window per documentation
    costPer1kTokens: { input: 0.05, output: 0.4 }, // $0.05 input, $0.40 output per documentation
    capabilities: {
      streaming: true,
      temperature: true,
      reasoning: true, // Reasoning token support per documentation
      thinking: false,
      multimodal: true, // Supports text and image input per documentation
      functionCalling: false,
    },
    parameters: {
      temperature: { min: 0.0, max: 2.0, default: 1.0 },
      reasoningEffort: ['low', 'medium', 'high'] as ReasoningEffort[],
    },
  },
];

/**
 * Parameter support matrix for OpenAI models
 *
 * This matrix provides a clear overview of which parameters each model supports,
 * enabling proper validation and UI configuration.
 */
export const OPENAI_PARAMETER_SUPPORT_MATRIX = {
  // Temperature support (all models)
  temperature: OPENAI_MODELS.map(m => m.id),

  // Reasoning effort support (gpt-5-nano)
  reasoningEffort: OPENAI_MODELS.filter(m => m.capabilities.reasoning).map(m => m.id),

  // Multimodal support (gpt-5-nano)
  multimodal: OPENAI_MODELS.filter(m => m.capabilities.multimodal).map(m => m.id),

  // Function calling support (none currently)
  functionCalling: OPENAI_MODELS.filter(m => m.capabilities.functionCalling).map(m => m.id),

  // Streaming support (all models)
  streaming: OPENAI_MODELS.map(m => m.id),
} as const;

/**
 * Model capability groups for easy categorization
 */
export const OPENAI_MODEL_GROUPS = {
  // Reasoning models with thinking capabilities
  reasoning: OPENAI_MODELS.filter(m => m.capabilities.reasoning),

  // Multimodal models (vision, image understanding)
  multimodal: OPENAI_MODELS.filter(m => m.capabilities.multimodal),

  // Function calling models (tool use)
  functionCalling: OPENAI_MODELS.filter(m => m.capabilities.functionCalling),

  // Latest generation models (GPT-5 series)
  latest: OPENAI_MODELS.filter(m => m.id.startsWith('gpt-5-')),

  // Legacy models (none currently)
  legacy: OPENAI_MODELS.filter(m => m.id.startsWith('gpt-3.5-')),
} as const;

/**
 * Utility functions for model configuration
 */
export const OpenAIModelUtils = {
  /**
   * Check if a model supports a specific parameter
   */
  supportsParameter(
    modelId: string,
    parameter: keyof typeof OPENAI_PARAMETER_SUPPORT_MATRIX
  ): boolean {
    return OPENAI_PARAMETER_SUPPORT_MATRIX[parameter].includes(modelId);
  },

  /**
   * Get model by ID with type safety
   */
  getModel(modelId: string): ModelConfig | undefined {
    return OPENAI_MODELS.find(m => m.id === modelId);
  },

  /**
   * Get all model IDs
   */
  getModelIds(): string[] {
    return OPENAI_MODELS.map(m => m.id);
  },

  /**
   * Get models by capability
   */
  getModelsByCapability(capability: keyof ModelConfig['capabilities']): ModelConfig[] {
    return OPENAI_MODELS.filter(m => m.capabilities[capability]);
  },

  /**
   * Validate model-specific parameters
   * Only validates parameters that the model supports; ignores unsupported parameters
   */
  validateModelParameters(modelId: string, parameters: Record<string, unknown>): string[] {
    const model = this.getModel(modelId);
    if (!model) {
      return [`Unknown model: ${modelId}`];
    }

    const errors: string[] = [];

    // Validate temperature (all models support temperature)
    if (parameters['temperature'] !== undefined) {
      const temp = parameters['temperature'];
      const tempConfig = model.parameters.temperature;
      if (typeof temp !== 'number' || temp < tempConfig.min || temp > tempConfig.max) {
        errors.push(
          `Temperature must be between ${tempConfig.min} and ${tempConfig.max} for model ${modelId}`
        );
      }
    }

    // Validate reasoning effort (only for models that support it)
    if (parameters['reasoningEffort'] !== undefined && model.capabilities.reasoning) {
      const effort = parameters['reasoningEffort'] as string;
      const validEfforts = model.parameters.reasoningEffort || [];
      if (!validEfforts.includes(effort as ReasoningEffort)) {
        errors.push(
          `Invalid reasoning effort for model ${modelId}. Valid values: ${validEfforts.join(', ')}`
        );
      }
    }
    // Note: If model doesn't support reasoning effort, we silently ignore it (no error)

    return errors;
  },
} as const;
