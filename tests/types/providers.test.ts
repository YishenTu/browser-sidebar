/**
 * @file Tests for provider type definitions
 *
 * These tests verify that all provider types are correctly defined,
 * type guards work properly, and configuration types have proper
 * constraints and validation.
 *
 * Following TDD methodology - these tests are written first and will
 * initially fail until the implementation is complete.
 */

import { describe, it, expect } from 'vitest';

// Import types that will be implemented
import type {
  AIProvider,
  ProviderConfig,
  ProviderResponse,
  StreamingResponse,
  ProviderError,
  OpenAIConfig,
  GeminiConfig,
  OpenRouterConfig,
  ModelConfig,
  TemperatureConfig,
  ReasoningEffort,
  ThinkingMode,
  ProviderType,
  ProviderCapabilities,
  ProviderMetadata,
  StreamChunk,
  ErrorType,
  ProviderValidationResult,
  ProviderChatMessage,
  ProviderChatRole,
} from '@types/providers';

// Import type guards that will be implemented
import {
  isProviderType,
  isProviderError,
  isStreamChunk,
  isProviderResponse,
  isStreamingResponse,
  isValidTemperature,
  isValidReasoningEffort,
  isValidThinkingMode,
  isValidMaxThinkingTokens,
  validateOpenAIConfig,
  validateGeminiConfig,
  validateOpenRouterConfig,
  validateProviderConfig,
} from '@types/providers';

describe('Provider Type Definitions', () => {
  describe('Basic Types', () => {
    it('should define all provider types correctly', () => {
      const openai: ProviderType = 'openai';
      const gemini: ProviderType = 'gemini';
      const openrouter: ProviderType = 'openrouter';

      expect(openai).toBe('openai');
      expect(gemini).toBe('gemini');
      expect(openrouter).toBe('openrouter');
    });

    it('should define chat roles correctly', () => {
      const user: ProviderChatRole = 'user';
      const assistant: ProviderChatRole = 'assistant';
      const system: ProviderChatRole = 'system';

      expect(user).toBe('user');
      expect(assistant).toBe('assistant');
      expect(system).toBe('system');
    });

    it('should define error types correctly', () => {
      const auth: ErrorType = 'authentication';
      const rate: ErrorType = 'rate_limit';
      const network: ErrorType = 'network';
      const validation: ErrorType = 'validation';
      const unknown: ErrorType = 'unknown';

      expect(auth).toBe('authentication');
      expect(rate).toBe('rate_limit');
      expect(network).toBe('network');
      expect(validation).toBe('validation');
      expect(unknown).toBe('unknown');
    });
  });

  describe('Configuration Types', () => {
    it('should define temperature configuration', () => {
      const tempConfig: TemperatureConfig = {
        temperature: 0.7,
        min: 0.0,
        max: 2.0,
        step: 0.1,
        default: 0.7,
      };

      expect(tempConfig.temperature).toBe(0.7);
      expect(tempConfig.min).toBe(0.0);
      expect(tempConfig.max).toBe(2.0);
    });

    it('should define reasoning effort types', () => {
      const low: ReasoningEffort = 'low';
      const medium: ReasoningEffort = 'medium';
      const high: ReasoningEffort = 'high';

      expect(low).toBe('low');
      expect(medium).toBe('medium');
      expect(high).toBe('high');
    });

    it('should define thinking mode types', () => {
      const off: ThinkingMode = 'off';
      const dynamic: ThinkingMode = 'dynamic';

      expect(off).toBe('off');
      expect(dynamic).toBe('dynamic');
    });

    it('should define OpenAI configuration', () => {
      const config: OpenAIConfig = {
        apiKey: 'test-key',
        temperature: 0.7,
        reasoningEffort: 'medium',
        model: 'gpt-4',
        maxTokens: 4000,
        topP: 1.0,
        frequencyPenalty: 0.0,
        presencePenalty: 0.0,
      };

      expect(config.apiKey).toBe('test-key');
      expect(config.reasoningEffort).toBe('medium');
    });

    it('should define Gemini configuration', () => {
      const config: GeminiConfig = {
        apiKey: 'test-key',
        temperature: 0.7,
        thinkingMode: 'dynamic',
        showThoughts: true,
        model: 'gemini-2.0-flash-thinking-exp',
        maxTokens: 8000,
        topP: 0.95,
        topK: 40,
      };

      expect(config.apiKey).toBe('test-key');
      expect(config.thinkingMode).toBe('dynamic');
      expect(config.showThoughts).toBe(true);
    });

    it('should define OpenRouter configuration', () => {
      const config: OpenRouterConfig = {
        apiKey: 'test-key',
        temperature: 0.7,
        maxThinkingTokens: 25000,
        model: 'anthropic/claude-3.5-sonnet',
        maxTokens: 4000,
        topP: 1.0,
        endpoint: 'https://openrouter.ai/api/v1',
      };

      expect(config.apiKey).toBe('test-key');
      expect(config.maxThinkingTokens).toBe(25000);
    });
  });

  describe('Message Types', () => {
    it('should define chat message structure', () => {
      const message: ProviderChatMessage = {
        id: 'msg-1',
        role: 'user',
        content: 'Hello, AI!',
        timestamp: new Date(),
        metadata: {
          tokens: 10,
          model: 'gpt-4',
        },
      };

      expect(message.role).toBe('user');
      expect(message.content).toBe('Hello, AI!');
      expect(message.metadata?.tokens).toBe(10);
    });

    it('should support thinking tokens in messages', () => {
      const message: ProviderChatMessage = {
        id: 'msg-2',
        role: 'assistant',
        content: 'Here is my response',
        timestamp: new Date(),
        thinking: 'Let me think about this...',
        metadata: {
          tokens: 20,
          thinkingTokens: 50,
          model: 'claude-3.5-sonnet',
        },
      };

      expect(message.thinking).toBe('Let me think about this...');
      expect(message.metadata?.thinkingTokens).toBe(50);
    });
  });

  describe('Response Types', () => {
    it('should define provider response structure', () => {
      const response: ProviderResponse = {
        id: 'resp-1',
        content: 'AI response content',
        model: 'gpt-4',
        usage: {
          promptTokens: 100,
          completionTokens: 150,
          totalTokens: 250,
        },
        finishReason: 'stop',
        metadata: {
          provider: 'openai',
          timestamp: new Date(),
        },
      };

      expect(response.content).toBe('AI response content');
      expect(response.usage.totalTokens).toBe(250);
    });

    it('should define streaming response structure', () => {
      const streamResponse: StreamingResponse = {
        id: 'stream-1',
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            delta: {
              role: 'assistant',
              content: 'Streaming text...',
            },
            finishReason: null,
          },
        ],
        usage: null, // Usage not available during streaming
        metadata: {
          provider: 'openai',
          timestamp: new Date(),
        },
      };

      expect(streamResponse.choices[0].delta.content).toBe('Streaming text...');
    });

    it('should define stream chunk structure', () => {
      const chunk: StreamChunk = {
        id: 'chunk-1',
        object: 'chat.completion.chunk',
        created: Date.now(),
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            delta: {
              content: 'Hello',
            },
            finishReason: null,
          },
        ],
      };

      expect(chunk.choices[0].delta.content).toBe('Hello');
    });
  });

  describe('Error Types', () => {
    it('should define provider error structure', () => {
      const error: ProviderError = {
        type: 'authentication',
        message: 'Invalid API key',
        code: 'INVALID_API_KEY',
        provider: 'openai',
        details: {
          statusCode: 401,
          timestamp: new Date(),
        },
      };

      expect(error.type).toBe('authentication');
      expect(error.code).toBe('INVALID_API_KEY');
      expect(error.details?.statusCode).toBe(401);
    });

    it('should define different error types', () => {
      const rateLimitError: ProviderError = {
        type: 'rate_limit',
        message: 'Rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED',
        provider: 'openai',
        retryAfter: 60,
      };

      const networkError: ProviderError = {
        type: 'network',
        message: 'Network connection failed',
        code: 'NETWORK_ERROR',
        provider: 'gemini',
      };

      expect(rateLimitError.retryAfter).toBe(60);
      expect(networkError.type).toBe('network');
    });
  });

  describe('Provider Interface', () => {
    it('should define provider capabilities', () => {
      const capabilities: ProviderCapabilities = {
        streaming: true,
        temperature: true,
        reasoning: true,
        thinking: false,
        multimodal: true,
        functionCalling: true,
        maxContextLength: 128000,
        supportedModels: ['gpt-4', 'gpt-4-turbo'],
      };

      expect(capabilities.streaming).toBe(true);
      expect(capabilities.maxContextLength).toBe(128000);
    });

    it('should define provider metadata', () => {
      const metadata: ProviderMetadata = {
        name: 'OpenAI',
        description: 'OpenAI GPT models',
        website: 'https://openai.com',
        documentation: 'https://platform.openai.com/docs',
        version: '1.0.0',
        capabilities: {
          streaming: true,
          temperature: true,
          reasoning: true,
          thinking: false,
          multimodal: true,
          functionCalling: true,
          maxContextLength: 128000,
          supportedModels: ['gpt-4'],
        },
      };

      expect(metadata.name).toBe('OpenAI');
      expect(metadata.capabilities.streaming).toBe(true);
    });

    it('should define model configuration', () => {
      const modelConfig: ModelConfig = {
        id: 'gpt-4',
        name: 'GPT-4',
        provider: 'openai',
        maxTokens: 8192,
        contextLength: 128000,
        costPer1kTokens: {
          input: 0.03,
          output: 0.06,
        },
        capabilities: {
          streaming: true,
          temperature: true,
          reasoning: false,
          thinking: false,
          multimodal: true,
          functionCalling: true,
        },
        parameters: {
          temperature: { min: 0.0, max: 2.0, default: 0.7 },
          topP: { min: 0.0, max: 1.0, default: 1.0 },
        },
      };

      expect(modelConfig.id).toBe('gpt-4');
      expect(modelConfig.costPer1kTokens.input).toBe(0.03);
    });
  });
});

describe('Type Guards', () => {
  describe('Basic Type Guards', () => {
    it('should validate provider types', () => {
      expect(isProviderType('openai')).toBe(true);
      expect(isProviderType('gemini')).toBe(true);
      expect(isProviderType('openrouter')).toBe(true);
      expect(isProviderType('invalid')).toBe(false);
      expect(isProviderType(null)).toBe(false);
      expect(isProviderType(undefined)).toBe(false);
    });

    it('should validate provider errors', () => {
      const validError: ProviderError = {
        type: 'authentication',
        message: 'Invalid key',
        code: 'INVALID_KEY',
        provider: 'openai',
      };

      const invalidError = {
        type: 'invalid_type',
        message: 'Error',
      };

      expect(isProviderError(validError)).toBe(true);
      expect(isProviderError(invalidError)).toBe(false);
      expect(isProviderError(null)).toBe(false);
    });

    it('should validate stream chunks', () => {
      const validChunk: StreamChunk = {
        id: 'chunk-1',
        object: 'chat.completion.chunk',
        created: Date.now(),
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            delta: { content: 'test' },
            finishReason: null,
          },
        ],
      };

      const invalidChunk = {
        id: 'chunk-1',
        // Missing required fields
      };

      expect(isStreamChunk(validChunk)).toBe(true);
      expect(isStreamChunk(invalidChunk)).toBe(false);
    });

    it('should validate provider responses', () => {
      const validResponse: ProviderResponse = {
        id: 'resp-1',
        content: 'Response',
        model: 'gpt-4',
        usage: {
          promptTokens: 10,
          completionTokens: 15,
          totalTokens: 25,
        },
        finishReason: 'stop',
        metadata: {
          provider: 'openai',
          timestamp: new Date(),
        },
      };

      expect(isProviderResponse(validResponse)).toBe(true);
      expect(isProviderResponse({})).toBe(false);
    });

    it('should validate streaming responses', () => {
      const validStreamResponse: StreamingResponse = {
        id: 'stream-1',
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            delta: { content: 'test' },
            finishReason: null,
          },
        ],
        usage: null,
        metadata: {
          provider: 'openai',
          timestamp: new Date(),
        },
      };

      expect(isStreamingResponse(validStreamResponse)).toBe(true);
      expect(isStreamingResponse({})).toBe(false);
    });
  });

  describe('Configuration Validation', () => {
    it('should validate temperature values', () => {
      expect(isValidTemperature(0.0)).toBe(true);
      expect(isValidTemperature(0.7)).toBe(true);
      expect(isValidTemperature(2.0)).toBe(true);
      expect(isValidTemperature(-0.1)).toBe(false);
      expect(isValidTemperature(2.1)).toBe(false);
      expect(isValidTemperature(NaN)).toBe(false);
    });

    it('should validate reasoning effort values', () => {
      expect(isValidReasoningEffort('low')).toBe(true);
      expect(isValidReasoningEffort('medium')).toBe(true);
      expect(isValidReasoningEffort('high')).toBe(true);
      expect(isValidReasoningEffort('invalid')).toBe(false);
      expect(isValidReasoningEffort(null)).toBe(false);
    });

    it('should validate thinking mode values', () => {
      expect(isValidThinkingMode('off')).toBe(true);
      expect(isValidThinkingMode('dynamic')).toBe(true);
      expect(isValidThinkingMode('invalid')).toBe(false);
      expect(isValidThinkingMode(null)).toBe(false);
    });

    it('should validate max thinking tokens', () => {
      expect(isValidMaxThinkingTokens(5000)).toBe(true);
      expect(isValidMaxThinkingTokens(25000)).toBe(true);
      expect(isValidMaxThinkingTokens(100000)).toBe(true);
      expect(isValidMaxThinkingTokens(4999)).toBe(false);
      expect(isValidMaxThinkingTokens(100001)).toBe(false);
      expect(isValidMaxThinkingTokens(NaN)).toBe(false);
    });
  });

  describe('Provider Config Validation', () => {
    it('should validate OpenAI configuration', () => {
      const validConfig: OpenAIConfig = {
        apiKey: 'sk-test-key',
        temperature: 0.7,
        reasoningEffort: 'medium',
        model: 'gpt-4',
        maxTokens: 4000,
        topP: 1.0,
        frequencyPenalty: 0.0,
        presencePenalty: 0.0,
      };

      const invalidConfig = {
        apiKey: '', // Empty key
        temperature: 3.0, // Invalid temperature
        reasoningEffort: 'invalid',
      };

      const validResult = validateOpenAIConfig(validConfig);
      const invalidResult = validateOpenAIConfig(invalidConfig as any);

      expect(validResult.isValid).toBe(true);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors).toContain('Invalid API key');
      expect(invalidResult.errors).toContain('Invalid temperature');
      expect(invalidResult.errors).toContain('Invalid reasoning effort');
    });

    it('should validate Gemini configuration', () => {
      const validConfig: GeminiConfig = {
        apiKey: 'test-key',
        temperature: 0.7,
        thinkingMode: 'dynamic',
        showThoughts: true,
        model: 'gemini-2.0-flash-thinking-exp',
        maxTokens: 8000,
        topP: 0.95,
        topK: 40,
      };

      const invalidConfig = {
        apiKey: '',
        temperature: -1.0,
        thinkingMode: 'invalid',
        topK: -5,
      };

      const validResult = validateGeminiConfig(validConfig);
      const invalidResult = validateGeminiConfig(invalidConfig as any);

      expect(validResult.isValid).toBe(true);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors.length).toBeGreaterThan(0);
    });

    it('should validate OpenRouter configuration', () => {
      const validConfig: OpenRouterConfig = {
        apiKey: 'sk-or-test-key',
        temperature: 0.7,
        maxThinkingTokens: 25000,
        model: 'anthropic/claude-3.5-sonnet',
        maxTokens: 4000,
        topP: 1.0,
        endpoint: 'https://openrouter.ai/api/v1',
      };

      const invalidConfig = {
        apiKey: '',
        maxThinkingTokens: 200000, // Too high
        endpoint: 'invalid-url',
      };

      const validResult = validateOpenRouterConfig(validConfig);
      const invalidResult = validateOpenRouterConfig(invalidConfig as any);

      expect(validResult.isValid).toBe(true);
      expect(invalidResult.isValid).toBe(false);
    });

    it('should validate generic provider configuration', () => {
      const validConfig: ProviderConfig = {
        type: 'openai',
        config: {
          apiKey: 'test-key',
          temperature: 0.7,
          reasoningEffort: 'medium',
          model: 'gpt-4',
          maxTokens: 4000,
          topP: 1.0,
          frequencyPenalty: 0.0,
          presencePenalty: 0.0,
        } as OpenAIConfig,
      };

      const result = validateProviderConfig(validConfig);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Validation Results', () => {
    it('should define validation result structure', () => {
      const successResult: ProviderValidationResult = {
        isValid: true,
        errors: [],
      };

      const errorResult: ProviderValidationResult = {
        isValid: false,
        errors: ['Error 1', 'Error 2'],
        details: {
          field: 'temperature',
          code: 'INVALID_RANGE',
        },
      };

      expect(successResult.isValid).toBe(true);
      expect(successResult.errors).toHaveLength(0);
      expect(errorResult.errors).toHaveLength(2);
      expect(errorResult.details?.field).toBe('temperature');
    });
  });
});

describe('Provider Interface Compliance', () => {
  it('should define AI provider interface', () => {
    // This test verifies that the AIProvider interface is properly defined
    // The actual implementation will be tested in the provider-specific tests

    const mockProvider: Partial<AIProvider> = {
      type: 'openai',
      name: 'OpenAI Provider',
      capabilities: {
        streaming: true,
        temperature: true,
        reasoning: true,
        thinking: false,
        multimodal: true,
        functionCalling: true,
        maxContextLength: 128000,
        supportedModels: ['gpt-4'],
      },
    };

    expect(mockProvider.type).toBe('openai');
    expect(mockProvider.capabilities?.streaming).toBe(true);
  });

  it('should support all required provider methods via interface', () => {
    // This is a compile-time test - if the interface is wrong, TypeScript will error
    // We're just verifying the structure exists

    interface TestProvider extends AIProvider {
      initialize(config: ProviderConfig): Promise<void>;
      validateConfig(config: any): ValidationResult;
      chat(messages: ChatMessage[], config?: any): Promise<ProviderResponse>;
      streamChat(messages: ChatMessage[], config?: any): AsyncIterable<StreamChunk>;
      getModels(): ModelConfig[];
      testConnection(): Promise<boolean>;
    }

    // If this compiles, the interface structure is correct
    const testType: keyof TestProvider = 'initialize';
    expect(testType).toBe('initialize');
  });
});
