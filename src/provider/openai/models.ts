/**
 * @file OpenAI Models Configuration
 * 
 * Comprehensive OpenAI model definitions with parameter constraints and capabilities.
 * This file implements the model configuration requirements for Task 4.2.1c.
 * 
 * Model Categories:
 * - GPT-5 series: Latest generation models with efficient performance
 * - o1 series: Reasoning models with thinking capabilities  
 * - GPT-4 series: Multimodal and function calling models
 * - GPT-3.5 series: Legacy models for basic use cases
 * 
 * Parameter Support Matrix:
 * - Temperature: All models (0.0-2.0)
 * - Reasoning Effort: Only o1 models (low/medium/high)
 * - Multimodal: GPT-4 series only
 * - Function Calling: GPT-4 and GPT-3.5 series
 */

import type { ModelConfig, ReasoningEffort } from '../../types/providers';

/**
 * OpenAI model configurations with complete parameter support matrix
 */
export const OPENAI_MODELS: ModelConfig[] = [
  // GPT-5 Series - Latest generation models
  {
    id: 'gpt-5-nano',
    name: 'GPT-5 Nano',
    provider: 'openai',
    maxTokens: 4096,
    contextLength: 128000,
    costPer1kTokens: { input: 0.05, output: 0.2 },
    capabilities: {
      streaming: true,
      temperature: true,
      reasoning: false,
      thinking: false,
      multimodal: false,
      functionCalling: false,
    },
    parameters: {
      temperature: { min: 0.0, max: 2.0, default: 1.0 },
    },
  },

  // o1 Series - Reasoning models with thinking capabilities
  {
    id: 'o1-preview',
    name: 'o1-preview',
    provider: 'openai',
    maxTokens: 32768,
    contextLength: 128000,
    costPer1kTokens: { input: 15.0, output: 60.0 },
    capabilities: {
      streaming: true,
      temperature: true,
      reasoning: true,
      thinking: false,
      multimodal: false,
      functionCalling: false,
    },
    parameters: {
      temperature: { min: 0.0, max: 2.0, default: 1.0 },
      reasoningEffort: ['low', 'medium', 'high'] as ReasoningEffort[],
    },
  },
  {
    id: 'o1-mini',
    name: 'o1-mini',
    provider: 'openai',
    maxTokens: 65536,
    contextLength: 128000,
    costPer1kTokens: { input: 3.0, output: 12.0 },
    capabilities: {
      streaming: true,
      temperature: true,
      reasoning: true,
      thinking: false,
      multimodal: false,
      functionCalling: false,
    },
    parameters: {
      temperature: { min: 0.0, max: 2.0, default: 1.0 },
      reasoningEffort: ['low', 'medium', 'high'] as ReasoningEffort[],
    },
  },

  // GPT-4 Series - Multimodal and function calling models
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    maxTokens: 16384,
    contextLength: 128000,
    costPer1kTokens: { input: 2.5, output: 10.0 },
    capabilities: {
      streaming: true,
      temperature: true,
      reasoning: false,
      thinking: false,
      multimodal: true,
      functionCalling: true,
    },
    parameters: {
      temperature: { min: 0.0, max: 2.0, default: 1.0 },
    },
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    maxTokens: 16384,
    contextLength: 128000,
    costPer1kTokens: { input: 0.15, output: 0.6 },
    capabilities: {
      streaming: true,
      temperature: true,
      reasoning: false,
      thinking: false,
      multimodal: true,
      functionCalling: true,
    },
    parameters: {
      temperature: { min: 0.0, max: 2.0, default: 1.0 },
    },
  },
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'openai',
    maxTokens: 4096,
    contextLength: 128000,
    costPer1kTokens: { input: 10.0, output: 30.0 },
    capabilities: {
      streaming: true,
      temperature: true,
      reasoning: false,
      thinking: false,
      multimodal: true,
      functionCalling: true,
    },
    parameters: {
      temperature: { min: 0.0, max: 2.0, default: 1.0 },
    },
  },
  {
    id: 'gpt-4',
    name: 'GPT-4',
    provider: 'openai',
    maxTokens: 8192,
    contextLength: 8192,
    costPer1kTokens: { input: 30.0, output: 60.0 },
    capabilities: {
      streaming: true,
      temperature: true,
      reasoning: false,
      thinking: false,
      multimodal: false,
      functionCalling: true,
    },
    parameters: {
      temperature: { min: 0.0, max: 2.0, default: 1.0 },
    },
  },

  // GPT-3.5 Series - Legacy models for basic use cases
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    provider: 'openai',
    maxTokens: 4096,
    contextLength: 16385,
    costPer1kTokens: { input: 0.5, output: 1.5 },
    capabilities: {
      streaming: true,
      temperature: true,
      reasoning: false,
      thinking: false,
      multimodal: false,
      functionCalling: true,
    },
    parameters: {
      temperature: { min: 0.0, max: 2.0, default: 1.0 },
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
  
  // Reasoning effort support (o1 models only)
  reasoningEffort: OPENAI_MODELS
    .filter(m => m.capabilities.reasoning)
    .map(m => m.id),
    
  // Multimodal support (GPT-4 series)
  multimodal: OPENAI_MODELS
    .filter(m => m.capabilities.multimodal)
    .map(m => m.id),
    
  // Function calling support (GPT-4 and GPT-3.5 series)
  functionCalling: OPENAI_MODELS
    .filter(m => m.capabilities.functionCalling)
    .map(m => m.id),
    
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
  
  // Legacy models (GPT-3.5 and older)
  legacy: OPENAI_MODELS.filter(m => m.id.startsWith('gpt-3.5-')),
} as const;

/**
 * Utility functions for model configuration
 */
export const OpenAIModelUtils = {
  /**
   * Check if a model supports a specific parameter
   */
  supportsParameter(modelId: string, parameter: keyof typeof OPENAI_PARAMETER_SUPPORT_MATRIX): boolean {
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
  validateModelParameters(modelId: string, parameters: Record<string, any>): string[] {
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
        errors.push(`Temperature must be between ${tempConfig.min} and ${tempConfig.max} for model ${modelId}`);
      }
    }
    
    // Validate reasoning effort (only for models that support it)
    if (parameters['reasoningEffort'] !== undefined && model.capabilities.reasoning) {
      const effort = parameters['reasoningEffort'];
      const validEfforts = model.parameters.reasoningEffort || [];
      if (!validEfforts.includes(effort)) {
        errors.push(`Invalid reasoning effort for model ${modelId}. Valid values: ${validEfforts.join(', ')}`);
      }
    }
    // Note: If model doesn't support reasoning effort, we silently ignore it (no error)
    
    return errors;
  },
} as const;