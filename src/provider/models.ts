/**
 * @file Centralized Model Configuration
 * 
 * Unified model registry and capability matrix for all AI providers.
 * This provides a single source of truth for model configurations,
 * constraints, and capabilities across the provider system.
 * 
 * Key Features:
 * - Centralized model definitions
 * - Capability matrix validation
 * - Configuration constraints enforcement
 * - Cross-provider model comparison
 */

import type { ModelConfig, ProviderType, ReasoningEffort, ThinkingMode } from '../types/providers';
import { OPENAI_MODELS } from './openai/models';
import { getGeminiModels } from './gemini/models';

/**
 * Unified model registry combining all provider models
 */
export const ALL_MODELS: ModelConfig[] = [
  ...OPENAI_MODELS,
  ...getGeminiModels(),
];

/**
 * Model capability matrix for quick lookups
 */
export const MODEL_CAPABILITIES = {
  // Temperature support (only models that support sampling params)
  temperature: {
    supported: ALL_MODELS.filter(m => m.capabilities.temperature).map(m => m.id),
    ranges: Object.fromEntries(
      ALL_MODELS.map(m => [m.id, m.parameters.temperature])
    ),
  },
  
  // Reasoning support (OpenAI models)
  reasoning: {
    supported: ALL_MODELS.filter(m => m.capabilities.reasoning).map(m => m.id),
    efforts: Object.fromEntries(
      ALL_MODELS
        .filter(m => m.capabilities.reasoning)
        .map(m => [m.id, m.parameters.reasoningEffort || []])
    ),
  },
  
  // Thinking mode support (Gemini models)
  thinking: {
    supported: ALL_MODELS.filter(m => m.capabilities.thinking).map(m => m.id),
    modes: Object.fromEntries(
      ALL_MODELS
        .filter(m => m.capabilities.thinking)
        .map(m => [m.id, m.parameters.thinkingMode || []])
    ),
  },
  
  // Multimodal support
  multimodal: {
    supported: ALL_MODELS.filter(m => m.capabilities.multimodal).map(m => m.id),
    types: {
      'gpt-5-nano': ['text', 'image'],
      'gemini-2.5-flash-lite': ['text', 'image', 'video', 'audio', 'pdf'],
    },
  },
  
  // Context limits
  contextLimits: Object.fromEntries(
    ALL_MODELS.map(m => [m.id, m.contextLength])
  ),
  
  // Max output tokens
  maxOutputTokens: Object.fromEntries(
    ALL_MODELS.map(m => [m.id, m.maxTokens])
  ),
  
  // Function calling support
  functionCalling: {
    supported: ALL_MODELS.filter(m => m.capabilities.functionCalling).map(m => m.id),
  },
  
  // Streaming support (all current models)
  streaming: {
    supported: ALL_MODELS.filter(m => m.capabilities.streaming).map(m => m.id),
  },
} as const;

/**
 * Model validation utilities
 */
export const ModelValidator = {
  /**
   * Check if a model exists
   */
  modelExists(modelId: string): boolean {
    return ALL_MODELS.some(m => m.id === modelId);
  },
  
  /**
   * Get model by ID
   */
  getModel(modelId: string): ModelConfig | undefined {
    return ALL_MODELS.find(m => m.id === modelId);
  },
  
  /**
   * Get models by provider
   */
  getModelsByProvider(provider: ProviderType): ModelConfig[] {
    return ALL_MODELS.filter(m => m.provider === provider);
  },
  
  /**
   * Validate temperature for a model
   */
  validateTemperature(modelId: string, temperature: number): { valid: boolean; error?: string } {
    const model = this.getModel(modelId);
    if (!model) {
      return { valid: false, error: `Unknown model: ${modelId}` };
    }
    // If the model doesn't support temperature, surface that explicitly
    if (!model.capabilities.temperature) {
      return { valid: false, error: `Model ${modelId} does not support temperature` };
    }

    const range = model.parameters.temperature;
    if (temperature < range.min || temperature > range.max) {
      return { 
        valid: false, 
        error: `Temperature must be between ${range.min} and ${range.max} for ${modelId}` 
      };
    }
    
    return { valid: true };
  },
  
  /**
   * Validate reasoning effort for a model
   */
  validateReasoningEffort(modelId: string, effort: string): { valid: boolean; error?: string } {
    const model = this.getModel(modelId);
    if (!model) {
      return { valid: false, error: `Unknown model: ${modelId}` };
    }
    
    if (!model.capabilities.reasoning) {
      return { valid: false, error: `Model ${modelId} does not support reasoning` };
    }
    
    const validEfforts = model.parameters.reasoningEffort || [];
    if (!validEfforts.includes(effort as ReasoningEffort)) {
      return { 
        valid: false, 
        error: `Invalid reasoning effort. Valid values: ${validEfforts.join(', ')}` 
      };
    }
    
    return { valid: true };
  },
  
  /**
   * Validate thinking mode for a model
   */
  validateThinkingMode(modelId: string, mode: string): { valid: boolean; error?: string } {
    const model = this.getModel(modelId);
    if (!model) {
      return { valid: false, error: `Unknown model: ${modelId}` };
    }
    
    if (!model.capabilities.thinking) {
      return { valid: false, error: `Model ${modelId} does not support thinking mode` };
    }
    
    const validModes = model.parameters.thinkingMode || [];
    if (!validModes.includes(mode as ThinkingMode)) {
      return { 
        valid: false, 
        error: `Invalid thinking mode. Valid values: ${validModes.join(', ')}` 
      };
    }
    
    return { valid: true };
  },
  
  /**
   * Check if input size fits within context window
   */
  validateContextSize(modelId: string, inputTokens: number): { valid: boolean; error?: string } {
    const model = this.getModel(modelId);
    if (!model) {
      return { valid: false, error: `Unknown model: ${modelId}` };
    }
    
    if (inputTokens > model.contextLength) {
      return { 
        valid: false, 
        error: `Input size (${inputTokens} tokens) exceeds context window (${model.contextLength} tokens)` 
      };
    }
    
    return { valid: true };
  },
  
  /**
   * Check if output size is within limits
   */
  validateOutputSize(modelId: string, requestedTokens: number): { valid: boolean; error?: string } {
    const model = this.getModel(modelId);
    if (!model) {
      return { valid: false, error: `Unknown model: ${modelId}` };
    }
    
    if (requestedTokens > model.maxTokens) {
      return { 
        valid: false, 
        error: `Requested output (${requestedTokens} tokens) exceeds maximum (${model.maxTokens} tokens)` 
      };
    }
    
    return { valid: true };
  },
  
  /**
   * Get supported capabilities for a model
   */
  getCapabilities(modelId: string): Record<string, boolean> | undefined {
    const model = this.getModel(modelId);
    return model?.capabilities;
  },
  
  /**
   * Compare two models
   */
  compareModels(modelId1: string, modelId2: string): {
    model1: ModelConfig | undefined;
    model2: ModelConfig | undefined;
    comparison: {
      contextWindow: { model1: number; model2: number; winner: string };
      maxOutput: { model1: number; model2: number; winner: string };
      cost: { model1: { input: number; output: number }; model2: { input: number; output: number }; winner: string };
      capabilities: { model1: string[]; model2: string[]; unique1: string[]; unique2: string[]; shared: string[] };
    } | null;
  } {
    const model1 = this.getModel(modelId1);
    const model2 = this.getModel(modelId2);
    
    if (!model1 || !model2) {
      return { model1, model2, comparison: null };
    }
    
    const caps1 = Object.entries(model1.capabilities)
      .filter(([_, v]) => v)
      .map(([k]) => k);
    const caps2 = Object.entries(model2.capabilities)
      .filter(([_, v]) => v)
      .map(([k]) => k);
    
    const shared = caps1.filter(c => caps2.includes(c));
    const unique1 = caps1.filter(c => !caps2.includes(c));
    const unique2 = caps2.filter(c => !caps1.includes(c));
    
    return {
      model1,
      model2,
      comparison: {
        contextWindow: {
          model1: model1.contextLength,
          model2: model2.contextLength,
          winner: model1.contextLength > model2.contextLength ? modelId1 : modelId2,
        },
        maxOutput: {
          model1: model1.maxTokens,
          model2: model2.maxTokens,
          winner: model1.maxTokens > model2.maxTokens ? modelId1 : modelId2,
        },
        cost: {
          model1: model1.costPer1kTokens,
          model2: model2.costPer1kTokens,
          winner: model1.costPer1kTokens.input < model2.costPer1kTokens.input ? modelId1 : modelId2,
        },
        capabilities: {
          model1: caps1,
          model2: caps2,
          unique1,
          unique2,
          shared,
        },
      },
    };
  },
};

/**
 * Performance thresholds for monitoring
 */
export const PERFORMANCE_THRESHOLDS = {
  // First token latency targets (ms)
  firstTokenLatency: {
    target: 800,
    warning: 1500,
    critical: 3000,
  },
  
  // UI update intervals (ms)
  uiUpdateInterval: {
    target: 100,
    warning: 200,
    critical: 500,
  },
  
  // Provider RTT p95 (ms)
  providerRTT: {
    openai: { target: 2000, warning: 3000, critical: 5000 },
    gemini: { target: 1500, warning: 2500, critical: 4000 },
  },
  
  // Memory overhead per session (MB)
  memoryOverhead: {
    target: 50,
    warning: 100,
    critical: 200,
  },
  
  // Frame rate (FPS)
  frameRate: {
    target: 60,
    warning: 30,
    critical: 15,
  },
} as const;

/**
 * Default timeout configurations (ms)
 */
export const TIMEOUT_CONFIGS = {
  default: 30000, // 30 seconds
  streaming: 60000, // 60 seconds for streaming
  validation: 5000, // 5 seconds for validation
  test: 10000, // 10 seconds for connection tests
} as const;

/**
 * Export convenience functions
 */
export const getModelById = ModelValidator.getModel.bind(ModelValidator);
export const getModelsByProvider = ModelValidator.getModelsByProvider.bind(ModelValidator);
export const validateModelConfig = ModelValidator.validateTemperature.bind(ModelValidator);
