/**
 * @file Providers Validation Tests
 *
 * Tests for provider configuration validators.
 */

import { describe, it, expect } from 'vitest';
import {
  isProviderType,
  isProviderError,
  isStreamChunk,
  isProviderResponse,
  isStreamingResponse,
  isValidTemperature,
  isValidReasoningEffort,
  isValidThinkingBudget,
  isValidMaxThinkingTokens,
  validateOpenAIConfig,
  validateGeminiConfig,
  validateOpenRouterConfig,
  validateOpenAICompatibleConfig,
  validateGrokConfig,
  validateProviderConfig,
  type ProviderError,
  type StreamChunk,
  type ProviderResponse,
  type StreamingResponse,
  type ProviderConfig,
} from '@/types/providers';

describe('isProviderType', () => {
  it('should return true for valid provider types', () => {
    expect(isProviderType('openai')).toBe(true);
    expect(isProviderType('gemini')).toBe(true);
    expect(isProviderType('openrouter')).toBe(true);
    expect(isProviderType('openai_compat')).toBe(true);
    expect(isProviderType('grok')).toBe(true);
  });

  it('should return false for invalid provider types', () => {
    expect(isProviderType('invalid')).toBe(false);
    expect(isProviderType('')).toBe(false);
    expect(isProviderType(null)).toBe(false);
    expect(isProviderType(undefined)).toBe(false);
    expect(isProviderType(123)).toBe(false);
  });
});

describe('isProviderError', () => {
  const validError: ProviderError = {
    type: 'authentication',
    message: 'Invalid API key',
    code: 'AUTH_ERROR',
    provider: 'openai',
  };

  it('should return true for valid provider error', () => {
    expect(isProviderError(validError)).toBe(true);
  });

  it('should return true for all error types', () => {
    const types = ['authentication', 'rate_limit', 'network', 'validation', 'unknown'];
    types.forEach(type => {
      expect(isProviderError({ ...validError, type })).toBe(true);
    });
  });

  it('should return false for invalid error type', () => {
    expect(isProviderError({ ...validError, type: 'invalid' })).toBe(false);
  });

  it('should return false for missing provider', () => {
    const { provider, ...rest } = validError;
    expect(isProviderError(rest)).toBe(false);
  });

  it('should return false for null', () => {
    expect(isProviderError(null)).toBe(false);
  });
});

describe('isStreamChunk', () => {
  const validChunk: StreamChunk = {
    id: 'chunk-1',
    object: 'chat.completion.chunk',
    created: Date.now(),
    model: 'gpt-4',
    choices: [
      {
        index: 0,
        delta: { content: 'Hello' },
        finishReason: null,
      },
    ],
  };

  it('should return true for valid stream chunk', () => {
    expect(isStreamChunk(validChunk)).toBe(true);
  });

  it('should return false for missing id', () => {
    const { id, ...rest } = validChunk;
    expect(isStreamChunk(rest)).toBe(false);
  });

  it('should return false for missing object', () => {
    const { object, ...rest } = validChunk;
    expect(isStreamChunk(rest)).toBe(false);
  });

  it('should return false for invalid choices', () => {
    expect(isStreamChunk({ ...validChunk, choices: 'invalid' })).toBe(false);
  });

  it('should return false for invalid choice structure', () => {
    expect(isStreamChunk({ ...validChunk, choices: [{ invalid: true }] })).toBe(false);
  });

  it('should return false for null', () => {
    expect(isStreamChunk(null)).toBe(false);
  });
});

describe('isProviderResponse', () => {
  const validResponse: ProviderResponse = {
    id: 'resp-1',
    content: 'Hello world',
    model: 'gpt-4',
    usage: {
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
    },
    finishReason: 'stop',
    metadata: {
      provider: 'openai',
      timestamp: new Date(),
    },
  };

  it('should return true for valid response', () => {
    expect(isProviderResponse(validResponse)).toBe(true);
  });

  it('should return false for missing usage', () => {
    const { usage, ...rest } = validResponse;
    expect(isProviderResponse(rest)).toBe(false);
  });

  it('should return false for invalid metadata provider', () => {
    expect(
      isProviderResponse({
        ...validResponse,
        metadata: { provider: 'invalid' },
      })
    ).toBe(false);
  });

  it('should return false for null', () => {
    expect(isProviderResponse(null)).toBe(false);
  });
});

describe('isStreamingResponse', () => {
  const validResponse: StreamingResponse = {
    id: 'stream-1',
    model: 'gpt-4',
    choices: [],
    usage: null,
    metadata: {
      provider: 'openai',
      timestamp: new Date(),
    },
  };

  it('should return true for valid streaming response', () => {
    expect(isStreamingResponse(validResponse)).toBe(true);
  });

  it('should return false for invalid provider in metadata', () => {
    expect(
      isStreamingResponse({
        ...validResponse,
        metadata: { provider: 'invalid' },
      })
    ).toBe(false);
  });

  it('should return false for null', () => {
    expect(isStreamingResponse(null)).toBe(false);
  });
});

describe('isValidTemperature', () => {
  it('should return true for valid temperatures', () => {
    expect(isValidTemperature(0)).toBe(true);
    expect(isValidTemperature(0.7)).toBe(true);
    expect(isValidTemperature(1.0)).toBe(true);
    expect(isValidTemperature(2.0)).toBe(true);
  });

  it('should return false for out of range temperatures', () => {
    expect(isValidTemperature(-0.1)).toBe(false);
    expect(isValidTemperature(2.1)).toBe(false);
  });

  it('should return false for non-numbers', () => {
    expect(isValidTemperature('0.7')).toBe(false);
    expect(isValidTemperature(NaN)).toBe(false);
    expect(isValidTemperature(null)).toBe(false);
  });
});

describe('isValidReasoningEffort', () => {
  it('should return true for valid efforts', () => {
    expect(isValidReasoningEffort('low')).toBe(true);
    expect(isValidReasoningEffort('medium')).toBe(true);
    expect(isValidReasoningEffort('high')).toBe(true);
  });

  it('should return false for invalid efforts', () => {
    expect(isValidReasoningEffort('minimal')).toBe(false);
    expect(isValidReasoningEffort('extreme')).toBe(false);
    expect(isValidReasoningEffort('')).toBe(false);
    expect(isValidReasoningEffort(null)).toBe(false);
  });
});

describe('isValidThinkingBudget', () => {
  it('should return true for valid budgets', () => {
    expect(isValidThinkingBudget(0)).toBe(true);
    expect(isValidThinkingBudget(-1)).toBe(true);
    expect(isValidThinkingBudget(128)).toBe(true);
    expect(isValidThinkingBudget(4096)).toBe(true);
  });

  it('should return false for non-integers', () => {
    expect(isValidThinkingBudget(0.5)).toBe(false);
    expect(isValidThinkingBudget(128.5)).toBe(false);
  });

  it('should return false for non-numbers', () => {
    expect(isValidThinkingBudget('128')).toBe(false);
    expect(isValidThinkingBudget(NaN)).toBe(false);
    expect(isValidThinkingBudget(null)).toBe(false);
  });
});

describe('isValidMaxThinkingTokens', () => {
  it('should return true for valid token counts', () => {
    expect(isValidMaxThinkingTokens(5000)).toBe(true);
    expect(isValidMaxThinkingTokens(50000)).toBe(true);
    expect(isValidMaxThinkingTokens(100000)).toBe(true);
  });

  it('should return false for out of range values', () => {
    expect(isValidMaxThinkingTokens(4999)).toBe(false);
    expect(isValidMaxThinkingTokens(100001)).toBe(false);
  });

  it('should return false for non-numbers', () => {
    expect(isValidMaxThinkingTokens('10000')).toBe(false);
    expect(isValidMaxThinkingTokens(NaN)).toBe(false);
  });
});

describe('validateOpenAIConfig', () => {
  const validConfig = {
    apiKey: 'sk-1234567890',
    model: 'gpt-4',
    temperature: 0.7,
    reasoningEffort: 'medium',
    maxTokens: 1000,
    topP: 0.9,
    frequencyPenalty: 0,
    presencePenalty: 0,
  };

  it('should return valid for complete config', () => {
    const result = validateOpenAIConfig(validConfig);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should return error for empty API key', () => {
    const result = validateOpenAIConfig({ ...validConfig, apiKey: '' });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Invalid API key');
  });

  it('should return error for invalid temperature', () => {
    const result = validateOpenAIConfig({ ...validConfig, temperature: 3.0 });
    expect(result.errors).toContain('Invalid temperature');
  });

  it('should return error for invalid reasoning effort', () => {
    const result = validateOpenAIConfig({ ...validConfig, reasoningEffort: 'extreme' });
    expect(result.errors).toContain('Invalid reasoning effort');
  });

  it('should return error for invalid model', () => {
    const result = validateOpenAIConfig({ ...validConfig, model: '' });
    expect(result.errors).toContain('Invalid model');
  });

  it('should return error for invalid maxTokens', () => {
    const result = validateOpenAIConfig({ ...validConfig, maxTokens: -1 });
    expect(result.errors).toContain('Invalid max tokens');
  });

  it('should return error for invalid topP', () => {
    const result = validateOpenAIConfig({ ...validConfig, topP: 1.5 });
    expect(result.errors).toContain('Invalid top P');
  });

  it('should return error for invalid frequencyPenalty', () => {
    const result = validateOpenAIConfig({ ...validConfig, frequencyPenalty: 3 });
    expect(result.errors).toContain('Invalid frequency penalty');
  });

  it('should return error for invalid presencePenalty', () => {
    const result = validateOpenAIConfig({ ...validConfig, presencePenalty: -3 });
    expect(result.errors).toContain('Invalid presence penalty');
  });

  it('should aggregate multiple errors', () => {
    const result = validateOpenAIConfig({ apiKey: '', model: '', temperature: -1 });
    expect(result.errors.length).toBeGreaterThan(1);
  });
});

describe('validateGeminiConfig', () => {
  const validConfig = {
    apiKey: 'AIza1234567890',
    model: 'gemini-pro',
  };

  it('should return valid for minimal config', () => {
    const result = validateGeminiConfig(validConfig);
    expect(result.isValid).toBe(true);
  });

  it('should return error for empty API key', () => {
    const result = validateGeminiConfig({ ...validConfig, apiKey: '' });
    expect(result.errors).toContain('Invalid API key');
  });

  it('should return error for invalid thinkingBudget', () => {
    const result = validateGeminiConfig({ ...validConfig, thinkingBudget: 0.5 });
    expect(result.errors).toContain('Invalid thinking budget');
  });

  it('should validate optional maxTokens', () => {
    const result = validateGeminiConfig({ ...validConfig, maxTokens: -1 });
    expect(result.errors).toContain('Invalid max tokens');
  });

  it('should validate optional topP', () => {
    const result = validateGeminiConfig({ ...validConfig, topP: 2 });
    expect(result.errors).toContain('Invalid top P');
  });

  it('should validate optional topK', () => {
    const result = validateGeminiConfig({ ...validConfig, topK: 0 });
    expect(result.errors).toContain('Invalid top K');
  });
});

describe('validateOpenRouterConfig', () => {
  const validConfig = {
    apiKey: 'sk-or-v1-1234567890',
    model: 'anthropic/claude-3-opus',
  };

  it('should return valid for minimal config', () => {
    const result = validateOpenRouterConfig(validConfig);
    expect(result.isValid).toBe(true);
  });

  it('should return error for empty API key', () => {
    const result = validateOpenRouterConfig({ ...validConfig, apiKey: '' });
    expect(result.errors).toContain('Invalid API key');
  });

  it('should validate reasoning config', () => {
    const result = validateOpenRouterConfig({
      ...validConfig,
      reasoning: { effort: 'extreme' },
    });
    expect(result.errors).toContain('Invalid reasoning effort');
  });

  it('should validate reasoning maxTokens', () => {
    const result = validateOpenRouterConfig({
      ...validConfig,
      reasoning: { maxTokens: -1 },
    });
    expect(result.errors).toContain('Invalid reasoning max tokens');
  });
});

describe('validateOpenAICompatibleConfig', () => {
  const validConfig = {
    apiKey: 'my-api-key',
    model: 'my-model',
    baseURL: 'https://api.example.com/v1',
  };

  it('should return valid for complete config', () => {
    const result = validateOpenAICompatibleConfig(validConfig);
    expect(result.isValid).toBe(true);
  });

  it('should return error for empty API key', () => {
    const result = validateOpenAICompatibleConfig({ ...validConfig, apiKey: '' });
    expect(result.errors).toContain('Invalid API key');
  });

  it('should return error for missing baseURL', () => {
    const result = validateOpenAICompatibleConfig({ ...validConfig, baseURL: '' });
    expect(result.errors).toContain('Invalid base URL');
  });

  it('should return error for invalid baseURL format', () => {
    const result = validateOpenAICompatibleConfig({ ...validConfig, baseURL: 'not-a-url' });
    expect(result.errors).toContain('Invalid base URL format');
  });
});

describe('validateGrokConfig', () => {
  const validConfig = {
    apiKey: 'xai-1234567890',
    model: 'grok-beta',
  };

  it('should return valid for complete config', () => {
    const result = validateGrokConfig(validConfig);
    expect(result.isValid).toBe(true);
  });

  it('should return error for empty API key', () => {
    const result = validateGrokConfig({ ...validConfig, apiKey: '' });
    expect(result.errors).toContain('Invalid API key');
  });

  it('should return error for missing model', () => {
    const result = validateGrokConfig({ ...validConfig, model: '' });
    expect(result.errors).toContain('Invalid model');
  });
});

describe('validateProviderConfig', () => {
  it('should validate openai config', () => {
    const config: ProviderConfig = {
      type: 'openai',
      config: {
        apiKey: 'sk-1234',
        model: 'gpt-4',
        temperature: 0.7,
        reasoningEffort: 'medium',
        maxTokens: 1000,
        topP: 0.9,
        frequencyPenalty: 0,
        presencePenalty: 0,
      },
    };
    const result = validateProviderConfig(config);
    expect(result.isValid).toBe(true);
  });

  it('should validate gemini config', () => {
    const config: ProviderConfig = {
      type: 'gemini',
      config: { apiKey: 'AIza1234', model: 'gemini-pro' },
    };
    const result = validateProviderConfig(config);
    expect(result.isValid).toBe(true);
  });

  it('should validate openrouter config', () => {
    const config: ProviderConfig = {
      type: 'openrouter',
      config: { apiKey: 'sk-or-v1-1234', model: 'model' },
    };
    const result = validateProviderConfig(config);
    expect(result.isValid).toBe(true);
  });

  it('should validate openai_compat config', () => {
    const config: ProviderConfig = {
      type: 'openai_compat',
      config: { apiKey: 'key', model: 'model', baseURL: 'https://api.example.com' },
    };
    const result = validateProviderConfig(config);
    expect(result.isValid).toBe(true);
  });

  it('should validate grok config', () => {
    const config: ProviderConfig = {
      type: 'grok',
      config: { apiKey: 'xai-1234', model: 'grok-beta' },
    };
    const result = validateProviderConfig(config);
    expect(result.isValid).toBe(true);
  });

  it('should return error for invalid provider type', () => {
    const config = {
      type: 'invalid',
      config: { apiKey: 'key', model: 'model' },
    };
    const result = validateProviderConfig(config as ProviderConfig);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Invalid provider type');
  });
});
