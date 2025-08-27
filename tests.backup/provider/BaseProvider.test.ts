/**
 * @file BaseProvider Tests
 *
 * Test-first implementation for the BaseProvider abstract class.
 * Tests abstract methods, shared functionality, configuration validation,
 * error handling, and subclass requirements.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseProvider } from '../../src/provider/BaseProvider';
import type {
  AIProvider,
  ProviderType,
  ProviderConfig,
  ProviderChatMessage,
  ProviderResponse,
  StreamChunk,
  ModelConfig,
  ProviderCapabilities,
  ProviderValidationResult,
  ProviderError,
  ErrorType,
} from '../../src/types/providers';

// Mock concrete implementation for testing abstract class
class MockProvider extends BaseProvider {
  constructor() {
    super('openai', 'Mock Provider', {
      streaming: true,
      temperature: true,
      reasoning: true,
      thinking: false,
      multimodal: false,
      functionCalling: true,
      maxContextLength: 4096,
      supportedModels: ['mock-model-1', 'mock-model-2'],
    });
  }

  async initialize(config: ProviderConfig): Promise<void> {
    this.setConfig(config);
  }

  validateConfig(config: any): ProviderValidationResult {
    const errors: string[] = [];

    if (!config.apiKey || typeof config.apiKey !== 'string') {
      errors.push('Invalid API key');
    }

    if (
      config.temperature !== undefined &&
      (typeof config.temperature !== 'number' || config.temperature < 0 || config.temperature > 2)
    ) {
      errors.push('Invalid temperature');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  async testConnection(): Promise<boolean> {
    return true;
  }

  async chat(messages: ProviderChatMessage[], config?: any): Promise<ProviderResponse> {
    return this.performChat(
      messages,
      async (msgs, cfg) => {
        return {
          id: 'mock-response-1',
          content: 'Mock response content',
          model: 'mock-model-1',
          usage: {
            promptTokens: 10,
            completionTokens: 20,
            totalTokens: 30,
          },
          finishReason: 'stop',
          metadata: {
            provider: this.type,
            timestamp: new Date(),
            model: 'mock-model-1',
          },
        };
      },
      config
    );
  }

  async *streamChat(messages: ProviderChatMessage[], config?: any): AsyncIterable<StreamChunk> {
    yield* this.performStreamChat(
      messages,
      async function* (msgs, cfg) {
        const chunks: StreamChunk[] = [
          {
            id: 'mock-stream-1',
            object: 'chat.completion.chunk',
            created: Date.now(),
            model: 'mock-model-1',
            choices: [
              {
                index: 0,
                delta: { content: 'Hello' },
                finishReason: null,
              },
            ],
          },
          {
            id: 'mock-stream-2',
            object: 'chat.completion.chunk',
            created: Date.now(),
            model: 'mock-model-1',
            choices: [
              {
                index: 0,
                delta: { content: ' world!' },
                finishReason: 'stop',
              },
            ],
          },
        ];

        for (const chunk of chunks) {
          yield chunk;
        }
      },
      config
    );
  }

  getModels(): ModelConfig[] {
    return [
      {
        id: 'mock-model-1',
        name: 'Mock Model 1',
        provider: this.type,
        maxTokens: 4096,
        contextLength: 4096,
        costPer1kTokens: {
          input: 0.01,
          output: 0.02,
        },
        capabilities: {
          streaming: true,
          temperature: true,
          reasoning: true,
          thinking: false,
          multimodal: false,
          functionCalling: true,
        },
        parameters: {
          temperature: { min: 0, max: 2, default: 0.7 },
        },
      },
      {
        id: 'mock-model-2',
        name: 'Mock Model 2',
        provider: this.type,
        maxTokens: 8192,
        contextLength: 8192,
        costPer1kTokens: {
          input: 0.02,
          output: 0.04,
        },
        capabilities: {
          streaming: true,
          temperature: true,
          reasoning: false,
          thinking: false,
          multimodal: true,
          functionCalling: false,
        },
        parameters: {
          temperature: { min: 0, max: 2, default: 0.7 },
        },
      },
    ];
  }

  getModel(id: string): ModelConfig | undefined {
    return this.getModels().find(model => model.id === id);
  }

  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  formatError(error: any): ProviderError {
    return {
      type: 'unknown' as ErrorType,
      message: error.message || 'Unknown error',
      code: 'UNKNOWN_ERROR',
      provider: this.type,
    };
  }
}

// Abstract provider that doesn't implement required methods (for testing abstract enforcement)
class IncompleteProvider extends BaseProvider {
  constructor() {
    super('gemini', 'Incomplete Provider', {
      streaming: false,
      temperature: true,
      reasoning: false,
      thinking: true,
      multimodal: false,
      functionCalling: false,
      maxContextLength: 2048,
      supportedModels: [],
    });
  }

  // Implement abstract methods with throwing implementations to test enforcement
  async initialize(config: ProviderConfig): Promise<void> {
    throw new Error('Method not implemented');
  }

  validateConfig(config: any): ProviderValidationResult {
    throw new Error('Method not implemented');
  }

  async testConnection(): Promise<boolean> {
    throw new Error('Method not implemented');
  }

  async chat(messages: ProviderChatMessage[], config?: any): Promise<ProviderResponse> {
    throw new Error('Method not implemented');
  }

  async *streamChat(messages: ProviderChatMessage[], config?: any): AsyncIterable<StreamChunk> {
    throw new Error('Method not implemented');
    // This unreachable yield is needed to satisfy the generator function requirement
    yield {} as StreamChunk;
  }

  getModels(): ModelConfig[] {
    throw new Error('Method not implemented');
  }

  getModel(id: string): ModelConfig | undefined {
    throw new Error('Method not implemented');
  }

  estimateTokens(text: string): number {
    throw new Error('Method not implemented');
  }

  formatError(error: any): ProviderError {
    throw new Error('Method not implemented');
  }
}

describe('BaseProvider', () => {
  let mockProvider: MockProvider;
  let mockConfig: ProviderConfig;
  let mockMessages: ProviderChatMessage[];

  beforeEach(() => {
    mockProvider = new MockProvider();
    mockConfig = {
      type: 'openai',
      config: {
        apiKey: 'test-api-key',
        temperature: 0.7,
        reasoningEffort: 'medium',
        model: 'mock-model-1',
        maxTokens: 4096,
        topP: 1,
        frequencyPenalty: 0,
        presencePenalty: 0,
      },
    };
    mockMessages = [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Hello, AI!',
        timestamp: new Date(),
      },
    ];
  });

  describe('Constructor and Properties', () => {
    it('should initialize with correct provider type, name, and capabilities', () => {
      expect(mockProvider.type).toBe('openai');
      expect(mockProvider.name).toBe('Mock Provider');
      expect(mockProvider.capabilities).toEqual({
        streaming: true,
        temperature: true,
        reasoning: true,
        thinking: false,
        multimodal: false,
        functionCalling: true,
        maxContextLength: 4096,
        supportedModels: ['mock-model-1', 'mock-model-2'],
      });
    });

    it('should start with no configuration', () => {
      expect(mockProvider.isConfigured()).toBe(false);
    });

    it('should be marked as configured after initialization', async () => {
      await mockProvider.initialize(mockConfig);
      expect(mockProvider.isConfigured()).toBe(true);
    });
  });

  describe('Configuration Management', () => {
    it('should store configuration after initialization', async () => {
      await mockProvider.initialize(mockConfig);
      expect(mockProvider.getConfig()).toEqual(mockConfig);
    });

    it('should validate configuration before storing', async () => {
      const invalidConfig = {
        type: 'openai' as ProviderType,
        config: {
          apiKey: '', // Invalid empty key
          temperature: 3, // Invalid temperature
          reasoningEffort: 'medium',
          model: 'mock-model-1',
          maxTokens: 4096,
          topP: 1,
          frequencyPenalty: 0,
          presencePenalty: 0,
        },
      };

      await expect(mockProvider.initialize(invalidConfig)).rejects.toThrow(
        'Configuration validation failed'
      );
      expect(mockProvider.isConfigured()).toBe(false);
    });

    it('should provide access to current configuration', async () => {
      await mockProvider.initialize(mockConfig);
      const storedConfig = mockProvider.getConfig();
      expect(storedConfig).toEqual(mockConfig);
    });

    it('should clear configuration when reset', async () => {
      await mockProvider.initialize(mockConfig);
      expect(mockProvider.isConfigured()).toBe(true);

      mockProvider.reset();
      expect(mockProvider.isConfigured()).toBe(false);
      expect(mockProvider.getConfig()).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should throw error when calling chat before initialization', async () => {
      await expect(mockProvider.chat(mockMessages)).rejects.toThrow('Provider not initialized');
    });

    it('should throw error when calling streamChat before initialization', async () => {
      const stream = mockProvider.streamChat(mockMessages);
      await expect(stream.next()).rejects.toThrow('Provider not initialized');
    });

    it('should format errors consistently', () => {
      const testError = new Error('Test error message');
      const formattedError = mockProvider.formatError(testError);

      expect(formattedError).toEqual({
        type: 'unknown',
        message: 'Test error message',
        code: 'UNKNOWN_ERROR',
        provider: 'openai',
      });
    });

    it('should handle unknown error types gracefully', () => {
      const unknownError = { someProperty: 'value' };
      const formattedError = mockProvider.formatError(unknownError);

      expect(formattedError.type).toBe('unknown');
      expect(formattedError.message).toBe('Unknown error');
      expect(formattedError.provider).toBe('openai');
    });

    it('should create provider error with proper context', () => {
      const error = mockProvider.createError('authentication', 'Invalid API key', 'AUTH_ERROR');

      expect(error).toEqual({
        type: 'authentication',
        message: 'Invalid API key',
        code: 'AUTH_ERROR',
        provider: 'openai',
      });
    });

    it('should create provider error with optional details', () => {
      const error = mockProvider.createError('rate_limit', 'Too many requests', 'RATE_LIMIT', {
        retryAfter: 60,
        details: {
          statusCode: 429,
          requestId: 'req-123',
        },
      });

      expect(error.retryAfter).toBe(60);
      expect(error.details?.statusCode).toBe(429);
      expect(error.details?.requestId).toBe('req-123');
    });
  });

  describe('Request Validation', () => {
    beforeEach(async () => {
      await mockProvider.initialize(mockConfig);
    });

    it('should validate messages array is not empty', async () => {
      await expect(mockProvider.chat([])).rejects.toThrow('Messages array cannot be empty');
    });

    it('should validate message format', async () => {
      const invalidMessages = [
        {
          id: 'msg-1',
          role: 'invalid' as any, // Invalid role
          content: 'Hello',
          timestamp: new Date(),
        },
      ];

      await expect(mockProvider.chat(invalidMessages)).rejects.toThrow('Invalid message format');
    });

    it('should validate message content is not empty', async () => {
      const invalidMessages = [
        {
          id: 'msg-1',
          role: 'user' as const,
          content: '', // Empty content
          timestamp: new Date(),
        },
      ];

      await expect(mockProvider.chat(invalidMessages)).rejects.toThrow(
        'Message content cannot be empty'
      );
    });

    it('should pass validation for valid messages', async () => {
      const response = await mockProvider.chat(mockMessages);
      expect(response).toBeDefined();
      expect(response.content).toBe('Mock response content');
    });
  });

  describe('Shared Functionality', () => {
    beforeEach(async () => {
      await mockProvider.initialize(mockConfig);
    });

    it('should provide token estimation', () => {
      const text = 'This is a test message with some content';
      const estimatedTokens = mockProvider.estimateTokens(text);
      expect(typeof estimatedTokens).toBe('number');
      expect(estimatedTokens).toBeGreaterThan(0);
    });

    it('should provide model listing', () => {
      const models = mockProvider.getModels();
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBe(2);
      expect(models[0].id).toBe('mock-model-1');
      expect(models[1].id).toBe('mock-model-2');
    });

    it('should find specific model by ID', () => {
      const model = mockProvider.getModel('mock-model-1');
      expect(model).toBeDefined();
      expect(model?.name).toBe('Mock Model 1');
    });

    it('should return undefined for non-existent model', () => {
      const model = mockProvider.getModel('non-existent-model');
      expect(model).toBeUndefined();
    });

    it('should test connection successfully when configured', async () => {
      const connectionResult = await mockProvider.testConnection();
      expect(connectionResult).toBe(true);
    });
  });

  describe('Rate Limiting Preparation', () => {
    beforeEach(async () => {
      await mockProvider.initialize(mockConfig);
    });

    it('should track request timestamps', async () => {
      const beforeRequest = Date.now();
      await mockProvider.chat(mockMessages);
      const afterRequest = Date.now();

      const requestHistory = mockProvider.getRequestHistory();
      expect(requestHistory.length).toBe(1);
      expect(requestHistory[0]).toBeGreaterThanOrEqual(beforeRequest);
      expect(requestHistory[0]).toBeLessThanOrEqual(afterRequest);
    });

    it('should maintain request history for rate limiting', async () => {
      await mockProvider.chat(mockMessages);
      await mockProvider.chat(mockMessages);

      const requestHistory = mockProvider.getRequestHistory();
      expect(requestHistory.length).toBe(2);
    });

    it('should clear old request history entries', async () => {
      // Mock older timestamp
      const oldTimestamp = Date.now() - 70000; // 70 seconds ago
      mockProvider['requestTimestamps'] = [oldTimestamp];

      await mockProvider.chat(mockMessages);

      const requestHistory = mockProvider.getRequestHistory();
      expect(requestHistory.length).toBe(1);
      expect(requestHistory[0]).not.toBe(oldTimestamp);
    });

    it('should provide rate limiting status', async () => {
      await mockProvider.chat(mockMessages);

      const rateLimitStatus = mockProvider.getRateLimitStatus();
      expect(rateLimitStatus.requestCount).toBe(1);
      expect(rateLimitStatus.windowStart).toBeInstanceOf(Date);
      expect(rateLimitStatus.nextResetTime).toBeInstanceOf(Date);
    });
  });

  describe('Streaming Helpers', () => {
    beforeEach(async () => {
      await mockProvider.initialize(mockConfig);
    });

    it('should stream chat responses', async () => {
      const stream = mockProvider.streamChat(mockMessages);
      const chunks: StreamChunk[] = [];

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBe(2);
      expect(chunks[0].choices[0].delta.content).toBe('Hello');
      expect(chunks[1].choices[0].delta.content).toBe(' world!');
      expect(chunks[1].choices[0].finishReason).toBe('stop');
    });

    it('should provide streaming utilities', async () => {
      const stream = mockProvider.streamChat(mockMessages);
      let fullContent = '';

      for await (const chunk of stream) {
        const content = mockProvider.extractContentFromChunk(chunk);
        if (content) {
          fullContent += content;
        }
      }

      expect(fullContent).toBe('Hello world!');
    });

    it('should detect stream completion', async () => {
      const stream = mockProvider.streamChat(mockMessages);
      let isComplete = false;

      for await (const chunk of stream) {
        isComplete = mockProvider.isStreamComplete(chunk);
        if (isComplete) break;
      }

      expect(isComplete).toBe(true);
    });
  });

  describe('Abstract Method Enforcement', () => {
    it('should enforce implementation of abstract methods', async () => {
      // TypeScript should prevent this at compile time, but we test runtime behavior
      expect(() => {
        new IncompleteProvider();
      }).not.toThrow(); // Constructor should work

      // But calling unimplemented methods should fail
      const incompleteProvider = new IncompleteProvider();

      // These should throw at runtime since they're not implemented
      expect(() => incompleteProvider.validateConfig({})).toThrow('Method not implemented');
      await expect(incompleteProvider.testConnection()).rejects.toThrow('Method not implemented');
      await expect(incompleteProvider.chat(mockMessages)).rejects.toThrow('Method not implemented');

      // Stream chat needs async iteration handling
      const streamGenerator = incompleteProvider.streamChat(mockMessages);
      await expect(streamGenerator.next()).rejects.toThrow('Method not implemented');

      expect(() => incompleteProvider.getModels()).toThrow('Method not implemented');
      expect(() => incompleteProvider.getModel('test')).toThrow('Method not implemented');
      expect(() => incompleteProvider.estimateTokens('test')).toThrow('Method not implemented');
      expect(() => incompleteProvider.formatError(new Error())).toThrow('Method not implemented');
    });

    it('should require subclasses to implement all abstract methods', () => {
      // This test ensures that concrete implementations provide all required methods
      const provider = new MockProvider();

      // All these methods should be available and functional
      expect(typeof provider.validateConfig).toBe('function');
      expect(typeof provider.testConnection).toBe('function');
      expect(typeof provider.chat).toBe('function');
      expect(typeof provider.streamChat).toBe('function');
      expect(typeof provider.getModels).toBe('function');
      expect(typeof provider.getModel).toBe('function');
      expect(typeof provider.estimateTokens).toBe('function');
      expect(typeof provider.formatError).toBe('function');
    });
  });

  describe('Provider Interface Compliance', () => {
    it('should implement all AIProvider interface methods', () => {
      const provider: AIProvider = mockProvider;

      // Verify all interface properties exist
      expect(provider.type).toBeDefined();
      expect(provider.name).toBeDefined();
      expect(provider.capabilities).toBeDefined();

      // Verify all interface methods exist
      expect(typeof provider.initialize).toBe('function');
      expect(typeof provider.validateConfig).toBe('function');
      expect(typeof provider.testConnection).toBe('function');
      expect(typeof provider.chat).toBe('function');
      expect(typeof provider.streamChat).toBe('function');
      expect(typeof provider.getModels).toBe('function');
      expect(typeof provider.getModel).toBe('function');
      expect(typeof provider.estimateTokens).toBe('function');
      expect(typeof provider.formatError).toBe('function');
    });

    it('should maintain consistent type signatures', async () => {
      await mockProvider.initialize(mockConfig);

      // Test return types match interface
      const validationResult = mockProvider.validateConfig(mockConfig.config);
      expect(typeof validationResult.isValid).toBe('boolean');
      expect(Array.isArray(validationResult.errors)).toBe(true);

      const connectionResult = await mockProvider.testConnection();
      expect(typeof connectionResult).toBe('boolean');

      const chatResponse = await mockProvider.chat(mockMessages);
      expect(typeof chatResponse.id).toBe('string');
      expect(typeof chatResponse.content).toBe('string');
      expect(typeof chatResponse.model).toBe('string');

      const models = mockProvider.getModels();
      expect(Array.isArray(models)).toBe(true);

      const tokenEstimate = mockProvider.estimateTokens('test');
      expect(typeof tokenEstimate).toBe('number');
    });
  });
});
