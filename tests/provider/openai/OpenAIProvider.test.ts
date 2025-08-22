/**
 * @file OpenAI Provider Tests
 *
 * Test-first implementation (TDD) for the OpenAI Response API Provider.
 * Tests OpenAI Response API integration, streaming, temperature, reasoning_effort, and error handling.
 *
 * Following TDD methodology:
 * - RED: Write comprehensive tests first
 * - GREEN: Implement minimal code to pass tests
 * - REFACTOR: Optimize while maintaining test coverage
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenAIProvider } from '../../../src/provider/openai/OpenAIProvider';
import { OpenAIClient } from '../../../src/provider/openai/OpenAIClient';
import { StreamParser } from '../../../src/provider/streamParser';
import { TokenBuffer } from '../../../src/provider/tokenBuffer';
import type {
  ProviderConfig,
  ProviderChatMessage,
  ProviderResponse,
  StreamChunk,
  OpenAIConfig,
  ProviderValidationResult,
  ProviderError,
  ModelConfig,
} from '../../../src/types/providers';

// Mock dependencies
vi.mock('../../../src/provider/openai/OpenAIClient');
vi.mock('../../../src/provider/streamParser');
vi.mock('../../../src/provider/tokenBuffer');

// Mock OpenAI SDK (structure not critically used here)
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    responses: {
      create: vi.fn(),
    },
    models: {
      list: vi.fn(),
    },
  })),
}));

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider;
  let mockOpenAIClient: any;
  let mockStreamParser: any;
  let mockTokenBuffer: any;

  const validConfig: ProviderConfig = {
    type: 'openai',
    config: {
      apiKey: 'sk-test-key-123',
      temperature: 0.7,
      reasoningEffort: 'medium',
      model: 'o1-preview',
      maxTokens: 4000,
      topP: 1.0,
      frequencyPenalty: 0.0,
      presencePenalty: 0.0,
    } as OpenAIConfig,
  };

  const validMessages: ProviderChatMessage[] = [
    {
      id: 'msg-1',
      role: 'user',
      content: 'Hello, how are you?',
      timestamp: new Date(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup OpenAIClient mock
    mockOpenAIClient = {
      initialize: vi.fn().mockResolvedValue(undefined),
      isInitialized: vi.fn().mockReturnValue(true),
      getOpenAIInstance: vi.fn().mockReturnValue({
        responses: {
          create: vi.fn(),
        },
      }),
      validateConfiguration: vi.fn().mockReturnValue({ isValid: true, errors: [] }),
      testConnection: vi.fn().mockResolvedValue(true),
    };
    (OpenAIClient as any).mockImplementation(() => mockOpenAIClient);

    // Setup StreamParser mock
    mockStreamParser = {
      parse: vi.fn().mockReturnValue([]),
      reset: vi.fn(),
    };
    (StreamParser as any).mockImplementation(() => mockStreamParser);

    // Setup TokenBuffer mock
    mockTokenBuffer = {
      addStreamChunk: vi.fn(),
      forceFlush: vi.fn(),
      getStats: vi.fn().mockReturnValue({
        totalTokensProcessed: 0,
        totalFlushes: 0,
        averageFlushSize: 0,
      }),
    };
    (TokenBuffer as any).mockImplementation(() => mockTokenBuffer);

    provider = new OpenAIProvider();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor and Initialization', () => {
    it('should create an OpenAIProvider instance with correct properties', () => {
      expect(provider).toBeInstanceOf(OpenAIProvider);
      expect(provider.type).toBe('openai');
      expect(provider.name).toBe('OpenAI');
      expect(provider.capabilities).toEqual({
        streaming: true,
        temperature: true,
        reasoning: true,
        thinking: false,
        multimodal: true,
        functionCalling: true,
        maxContextLength: 128000,
        supportedModels: [
          'gpt-5-nano',
          'o1-preview',
          'o1-mini',
          'gpt-4o',
          'gpt-4o-mini',
          'gpt-4-turbo',
          'gpt-4',
          'gpt-3.5-turbo',
        ],
      });
    });

    it('should initialize OpenAI client with valid configuration', async () => {
      await provider.initialize(validConfig);

      expect(mockOpenAIClient.initialize).toHaveBeenCalledWith({
        ...validConfig.config,
        customOptions: {
          timeout: 120000, // 2 minutes for Response API
          maxRetries: 3,
        },
      });
      expect(provider.isConfigured()).toBe(true);
    });

    it('should throw error when initializing with invalid configuration', async () => {
      const invalidConfig = {
        ...validConfig,
        config: {
          ...validConfig.config,
          apiKey: 'invalid-key',
        },
      };

      // The provider should use its own validation, not the client's
      // This test should work with the provider's validateConfig method

      await expect(provider.initialize(invalidConfig)).rejects.toThrow(
        'Configuration validation failed: API key must start with "sk-"'
      );
      expect(provider.isConfigured()).toBe(false);
    });

    it('should handle client initialization errors', async () => {
      mockOpenAIClient.initialize.mockRejectedValue(new Error('Client initialization failed'));

      await expect(provider.initialize(validConfig)).rejects.toThrow('Client initialization failed');
      expect(provider.isConfigured()).toBe(false);
    });
  });

  describe('Configuration Validation', () => {
    it('should validate correct OpenAI configuration', () => {
      const result = provider.validateConfig(validConfig.config);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate temperature parameter range (0.0-2.0)', () => {
      const invalidConfigs = [
        { ...validConfig.config, temperature: -0.1 },
        { ...validConfig.config, temperature: 2.1 },
        { ...validConfig.config, temperature: 'invalid' as any },
      ];

      invalidConfigs.forEach(config => {
        const result = provider.validateConfig(config);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Invalid temperature');
      });
    });

    it('should validate reasoning effort parameter', () => {
      const invalidConfigs = [
        { ...validConfig.config, reasoningEffort: 'invalid' as any },
        { ...validConfig.config, reasoningEffort: 'ultra' as any },
        { ...validConfig.config, reasoningEffort: null as any },
      ];

      invalidConfigs.forEach(config => {
        const result = provider.validateConfig(config);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Invalid reasoning effort');
      });
    });

    it('should validate API key requirement', () => {
      const invalidConfigs = [
        { ...validConfig.config, apiKey: '' },
        { ...validConfig.config, apiKey: null as any },
        { ...validConfig.config, apiKey: undefined as any },
      ];

      invalidConfigs.forEach(config => {
        const result = provider.validateConfig(config);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Invalid API key');
      });
    });

    it('should validate model parameter', () => {
      const invalidConfigs = [
        { ...validConfig.config, model: '' },
        { ...validConfig.config, model: null as any },
        { ...validConfig.config, model: undefined as any },
      ];

      invalidConfigs.forEach(config => {
        const result = provider.validateConfig(config);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Invalid model');
      });
    });

    it('should validate maxTokens parameter', () => {
      const invalidConfigs = [
        { ...validConfig.config, maxTokens: 0 },
        { ...validConfig.config, maxTokens: -100 },
        { ...validConfig.config, maxTokens: 'invalid' as any },
      ];

      invalidConfigs.forEach(config => {
        const result = provider.validateConfig(config);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Invalid max tokens');
      });
    });
  });

  describe('Connection Testing', () => {
    beforeEach(async () => {
      await provider.initialize(validConfig);
    });

    it('should test connection successfully with valid configuration', async () => {
      mockOpenAIClient.testConnection.mockResolvedValue(true);

      const result = await provider.testConnection();
      expect(result).toBe(true);
      expect(mockOpenAIClient.testConnection).toHaveBeenCalled();
    });

    it('should fail connection test with invalid API key', async () => {
      mockOpenAIClient.testConnection.mockResolvedValue(false);

      const result = await provider.testConnection();
      expect(result).toBe(false);
    });

    it('should handle connection test errors', async () => {
      mockOpenAIClient.testConnection.mockRejectedValue(new Error('Network error'));

      const result = await provider.testConnection();
      expect(result).toBe(false);
    });

    it('should throw error when testing connection without initialization', async () => {
      const uninitializedProvider = new OpenAIProvider();
      await expect(uninitializedProvider.testConnection()).rejects.toThrow(
        'Provider not initialized'
      );
    });
  });

  describe('Response API Chat Implementation', () => {
    beforeEach(async () => {
      await provider.initialize(validConfig);
    });

    it('should send messages using OpenAI Responses API', async () => {
      const mockResponse = {
        id: 'resp-123',
        object: 'response',
        created: Date.now(),
        model: 'o1-preview',
        output_text: 'Hello! I am doing well, thank you for asking.',
        finish_reason: 'stop',
        usage: {
          input_tokens: 10,
          output_tokens: 15,
          total_tokens: 25,
        },
      };

      mockOpenAIClient.getOpenAIInstance().responses.create.mockResolvedValue(mockResponse);

      const response = await provider.chat(validMessages);

      expect(response).toEqual({
        id: 'resp-123',
        content: 'Hello! I am doing well, thank you for asking.',
        model: 'o1-preview',
        usage: {
          promptTokens: 10,
          completionTokens: 15,
          totalTokens: 25,
        },
        finishReason: 'stop',
        metadata: {
          provider: 'openai',
          timestamp: expect.any(Date),
          model: 'o1-preview',
          requestId: 'resp-123',
        },
      });

      expect(mockOpenAIClient.getOpenAIInstance().responses.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'o1-preview',
          input: expect.stringContaining('User: Hello, how are you?'),
          temperature: 0.7,
          reasoning: { effort: 'medium' },
          max_output_tokens: 4000,
          top_p: 1.0,
          frequency_penalty: 0.0,
          presence_penalty: 0.0,
        })
      );
    });

    it('should handle temperature parameter correctly', async () => {
      const temperatures = [0.0, 0.5, 1.0, 1.5, 2.0];

      for (const temperature of temperatures) {
        const configWithTemp = {
          ...validConfig,
          config: { ...validConfig.config, temperature },
        };
        await provider.initialize(configWithTemp);

        mockOpenAIClient.getOpenAIInstance().responses.create.mockResolvedValue({
          id: 'resp-123',
          output_text: 'Test response',
          finish_reason: 'stop',
          usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
        });

        await provider.chat(validMessages);

        expect(
          mockOpenAIClient.getOpenAIInstance().responses.create
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            temperature,
          })
        );
      }
    });

    it('should handle reasoning effort parameter correctly', async () => {
      const reasoningEfforts = ['low', 'medium', 'high'] as const;

      for (const reasoningEffort of reasoningEfforts) {
        const configWithReasoning = {
          ...validConfig,
          config: { ...validConfig.config, reasoningEffort },
        };
        await provider.initialize(configWithReasoning);

        mockOpenAIClient.getOpenAIInstance().responses.create.mockResolvedValue({
          id: 'resp-123',
          output_text: 'Test response',
          finish_reason: 'stop',
          usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
        });

        await provider.chat(validMessages);

        expect(
          mockOpenAIClient.getOpenAIInstance().responses.create
        ).toHaveBeenCalledWith(
          expect.objectContaining({ reasoning: { effort: reasoningEffort } })
        );
      }
    });

    it('should handle API errors properly', async () => {
      const apiError = {
        error: {
          message: 'Invalid API key',
          type: 'invalid_request_error',
          code: 'invalid_api_key',
        },
      };

      mockOpenAIClient.getOpenAIInstance().responses.create.mockRejectedValue(apiError);

      await expect(provider.chat(validMessages)).rejects.toThrow();
    });

    it('should handle rate limit errors with retry information', async () => {
      const rateLimitError = {
        error: {
          message: 'Rate limit exceeded',
          type: 'rate_limit_error',
          code: 'rate_limit_exceeded',
        },
        headers: {
          'retry-after': '60',
        },
      };

      mockOpenAIClient.getOpenAIInstance().responses.create.mockRejectedValue(rateLimitError);

      await expect(provider.chat(validMessages)).rejects.toThrow();
    });

    it('should validate messages before sending', async () => {
      const invalidMessages = [];

      await expect(provider.chat(invalidMessages)).rejects.toThrow(
        'Messages array cannot be empty'
      );
    });

    it('should handle multiple message roles correctly', async () => {
      const multipleMessages: ProviderChatMessage[] = [
        {
          id: 'msg-1',
          role: 'system',
          content: 'You are a helpful assistant.',
          timestamp: new Date(),
        },
        {
          id: 'msg-2',
          role: 'user',
          content: 'Hello!',
          timestamp: new Date(),
        },
        {
          id: 'msg-3',
          role: 'assistant',
          content: 'Hello! How can I help you?',
          timestamp: new Date(),
        },
        {
          id: 'msg-4',
          role: 'user',
          content: 'What is the weather like?',
          timestamp: new Date(),
        },
      ];

      mockOpenAIClient.getOpenAIInstance().responses.create.mockResolvedValue({
        id: 'resp-123',
        output_text: 'I cannot check the weather.',
        finish_reason: 'stop',
        usage: { input_tokens: 20, output_tokens: 10, total_tokens: 30 },
      });

      await provider.chat(multipleMessages);

      expect(
        mockOpenAIClient.getOpenAIInstance().responses.create
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.stringContaining('System: You are a helpful assistant.'),
        })
      );
    });
  });

  describe('Streaming Response API Implementation', () => {
    beforeEach(async () => {
      await provider.initialize(validConfig);
    });

    it('should stream responses using OpenAI Response API', async () => {
      const mockStreamChunks = [
        {
          id: 'resp-123',
          object: 'response.chunk',
          created: Date.now(),
          model: 'o1-preview',
          delta: { output_text: 'Hello' },
        },
        {
          id: 'resp-123',
          object: 'response.chunk',
          created: Date.now(),
          model: 'o1-preview',
          delta: { output_text: ' world!' },
          finish_reason: 'stop',
        },
      ];

      // Mock the stream generator
      async function* mockStreamGenerator() {
        for (const chunk of mockStreamChunks) {
          yield chunk;
        }
      }

      mockOpenAIClient.getOpenAIInstance().responses.create.mockResolvedValue(
        mockStreamGenerator()
      );

      const chunks: StreamChunk[] = [];
      for await (const chunk of provider.streamChat(validMessages)) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle streaming with token buffer', async () => {
      async function* mockStreamGenerator() {
        yield {
          id: 'resp-123',
          object: 'response.chunk',
          created: Date.now(),
          model: 'o1-preview',
          delta: { output_text: 'Hello' },
        };
      }

      mockOpenAIClient.getOpenAIInstance().responses.create.mockResolvedValue(
        mockStreamGenerator()
      );

      const chunks: StreamChunk[] = [];
      for await (const chunk of provider.streamChat(validMessages)) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle streaming errors gracefully', async () => {
      async function* mockErrorStreamGenerator() {
        throw new Error('Streaming error');
      }

      mockOpenAIClient.getOpenAIInstance().responses.create.mockResolvedValue(
        mockErrorStreamGenerator()
      );

      const stream = provider.streamChat(validMessages);
      await expect(stream.next()).rejects.toThrow('Streaming error');
    });

    it('should handle partial stream chunks correctly', async () => {
      async function* mockPartialStreamGenerator() {
        yield { partial: 'data', incomplete: true } as any;
        yield {
          id: 'resp-123',
          object: 'response.chunk',
          created: Date.now(),
          model: 'o1-preview',
          delta: { output_text: 'Complete chunk' },
          finish_reason: 'stop',
        } as any;
      }

      mockOpenAIClient.getOpenAIInstance().responses.create.mockResolvedValue(
        mockPartialStreamGenerator()
      );

      const chunks: StreamChunk[] = [];
      for await (const chunk of provider.streamChat(validMessages)) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('Request Cancellation', () => {
    beforeEach(async () => {
      await provider.initialize(validConfig);
    });

    it('should support request cancellation with AbortController', async () => {
      const abortController = new AbortController();

      // Setup mock to simulate long-running request
      mockOpenAIClient.getOpenAIInstance().responses.create.mockImplementation(
        () =>
          new Promise((resolve, reject) => {
            setTimeout(resolve, 1000); // 1 second delay
            abortController.signal.addEventListener('abort', () => {
              reject(new Error('Request was aborted'));
            });
          })
      );

      // Start the request
      const requestPromise = provider.chat(validMessages, { signal: abortController.signal });

      // Cancel after 100ms
      setTimeout(() => abortController.abort(), 100);

      await expect(requestPromise).rejects.toThrow('Request was aborted');
    });

    it('should handle cancellation during streaming', async () => {
      const abortController = new AbortController();

      async function* mockCancellableStreamGenerator() {
        let counter = 0;
        while (counter < 10) {
          if (abortController.signal.aborted) {
            throw new Error('Stream was aborted');
          }
          yield {
            id: 'resp-123',
            object: 'response.chunk',
            created: Date.now(),
            model: 'o1-preview',
            delta: { output_text: `chunk ${counter}` },
          } as any;
          counter++;
          await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
        }
      }

      mockOpenAIClient.getOpenAIInstance().responses.create.mockResolvedValue(
        mockCancellableStreamGenerator()
      );

      const stream = provider.streamChat(validMessages, { signal: abortController.signal });

      // Start consuming stream and cancel after first chunk
      let chunkCount = 0;
      try {
        for await (const chunk of stream) {
          chunkCount++;
          if (chunkCount === 1) {
            abortController.abort();
            // Continue to trigger the abort
          }
        }
      } catch (error) {
        // The error might be a ProviderError object or an Error
        if (error && typeof error === 'object' && 'message' in error) {
          expect((error as any).message).toContain('aborted');
        } else {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toContain('aborted');
        }
      }

      expect(chunkCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Model Management', () => {
    it('should provide list of supported OpenAI models', () => {
      const models = provider.getModels();

      expect(models).toHaveLength(8);
      expect(models.map(m => m.id)).toEqual([
        'gpt-5-nano',
        'o1-preview',
        'o1-mini',
        'gpt-4o',
        'gpt-4o-mini',
        'gpt-4-turbo',
        'gpt-4',
        'gpt-3.5-turbo',
      ]);

      // Check first model structure (gpt-5-nano)
      expect(models[0]).toEqual({
        id: 'gpt-5-nano',
        name: 'GPT-5 Nano',
        provider: 'openai',
        maxTokens: 4096,
        contextLength: 128000,
        costPer1kTokens: {
          input: 0.05,
          output: 0.2,
        },
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
      });
    });

    it('should find specific model by ID', () => {
      const model = provider.getModel('gpt-4o');

      expect(model).toBeDefined();
      expect(model?.id).toBe('gpt-4o');
      expect(model?.name).toBe('GPT-4o');
      expect(model?.capabilities.multimodal).toBe(true);
    });

    it('should return undefined for non-existent model', () => {
      const model = provider.getModel('non-existent-model');
      expect(model).toBeUndefined();
    });

    it('should provide correct model capabilities', () => {
      const o1Model = provider.getModel('o1-preview');
      const gpt4oModel = provider.getModel('gpt-4o');

      expect(o1Model?.capabilities.reasoning).toBe(true);
      expect(o1Model?.capabilities.functionCalling).toBe(false);

      expect(gpt4oModel?.capabilities.multimodal).toBe(true);
      expect(gpt4oModel?.capabilities.functionCalling).toBe(true);
    });
  });

  describe('Token Estimation', () => {
    it('should estimate tokens for text input', () => {
      const shortText = 'Hello world';
      const longText = 'This is a much longer text that should result in more tokens being estimated for the OpenAI API call.';

      const shortTokens = provider.estimateTokens(shortText);
      const longTokens = provider.estimateTokens(longText);

      expect(typeof shortTokens).toBe('number');
      expect(typeof longTokens).toBe('number');
      expect(shortTokens).toBeGreaterThan(0);
      expect(longTokens).toBeGreaterThan(shortTokens);
    });

    it('should handle empty text', () => {
      const tokens = provider.estimateTokens('');
      expect(tokens).toBe(0);
    });

    it('should handle special characters and unicode', () => {
      const unicodeText = '🌟 Hello 世界! 🚀';
      const tokens = provider.estimateTokens(unicodeText);
      expect(tokens).toBeGreaterThan(0);
    });
  });

  describe('Error Formatting', () => {
    it('should format OpenAI API errors correctly', () => {
      const openaiError = {
        error: {
          message: 'Invalid API key provided',
          type: 'invalid_request_error',
          code: 'invalid_api_key',
        },
        status: 401,
      };

      const formattedError = provider.formatError(openaiError);

      expect(formattedError).toEqual({
        type: 'authentication',
        message: 'Invalid API key provided',
        code: 'invalid_api_key',
        provider: 'openai',
        details: {
          timestamp: expect.any(Date),
          statusCode: 401,
          originalError: openaiError,
        },
      });
    });

    it('should format rate limit errors with retry information', () => {
      const rateLimitError = {
        error: {
          message: 'Rate limit exceeded',
          type: 'rate_limit_error',
          code: 'rate_limit_exceeded',
        },
        headers: {
          'retry-after': '60',
        },
        status: 429,
      };

      const formattedError = provider.formatError(rateLimitError);

      expect(formattedError.type).toBe('rate_limit');
      expect(formattedError.retryAfter).toBe(60);
    });

    it('should format network errors', () => {
      const networkError = new Error('Network connection failed');
      networkError.name = 'NetworkError';

      const formattedError = provider.formatError(networkError);

      expect(formattedError.type).toBe('network');
      expect(formattedError.message).toBe('Network connection failed');
      expect(formattedError.provider).toBe('openai');
    });

    it('should handle unknown errors gracefully', () => {
      const unknownError = { someProperty: 'unexpected error' };

      const formattedError = provider.formatError(unknownError);

      expect(formattedError.type).toBe('unknown');
      expect(formattedError.provider).toBe('openai');
      expect(formattedError.details?.originalError).toBe(unknownError);
    });
  });

  describe('Provider State Management', () => {
    it('should reset provider state correctly', async () => {
      await provider.initialize(validConfig);
      expect(provider.isConfigured()).toBe(true);

      provider.reset();

      expect(provider.isConfigured()).toBe(false);
      expect(provider.getConfig()).toBeNull();
    });

    it('should maintain request history for rate limiting', async () => {
      await provider.initialize(validConfig);

      mockOpenAIClient.getOpenAIInstance().responses.create.mockResolvedValue({
        id: 'resp-123',
        output_text: 'Test',
        finish_reason: 'stop',
        usage: { input_tokens: 5, output_tokens: 5, total_tokens: 10 },
      });

      await provider.chat(validMessages);
      await provider.chat(validMessages);

      const requestHistory = provider.getRequestHistory();
      expect(requestHistory.length).toBe(2);

      const rateLimitStatus = provider.getRateLimitStatus();
      expect(rateLimitStatus.requestCount).toBe(2);
    });

    it('should handle concurrent requests properly', async () => {
      await provider.initialize(validConfig);

      mockOpenAIClient.getOpenAIInstance().responses.create.mockImplementation(
        () =>
          new Promise(resolve =>
            setTimeout(
              () =>
                resolve({
                  id: 'resp-123',
                  output_text: 'Concurrent response',
                  finish_reason: 'stop',
                  usage: { input_tokens: 5, output_tokens: 5, total_tokens: 10 },
                }),
              100
            )
          )
      );

      const requests = [
        provider.chat(validMessages),
        provider.chat(validMessages),
        provider.chat(validMessages),
      ];

      const responses = await Promise.all(requests);

      expect(responses).toHaveLength(3);
      responses.forEach(response => {
        expect(response.content).toBe('Concurrent response');
      });
    });
  });

  describe('Integration with Base Provider', () => {
    it('should properly extend BaseProvider functionality', async () => {
      await provider.initialize(validConfig);

      // Test inherited methods work correctly
      expect(provider.type).toBe('openai');
      expect(provider.isConfigured()).toBe(true);
      
      const config = provider.getConfig();
      expect(config).toEqual(validConfig);

      // Test validation wrapper
      mockOpenAIClient.getOpenAIInstance().responses.create.mockResolvedValue({
        id: 'resp-123',
        output_text: 'Base provider test',
        finish_reason: 'stop',
        usage: { input_tokens: 5, output_tokens: 5, total_tokens: 10 },
      });

      const response = await provider.chat(validMessages);
      expect(response).toBeDefined();

      // Verify request tracking
      const requestHistory = provider.getRequestHistory();
      expect(requestHistory.length).toBe(1);
    });

    it('should handle message validation from base provider', async () => {
      await provider.initialize(validConfig);

      // Test empty messages array
      await expect(provider.chat([])).rejects.toThrow('Messages array cannot be empty');

      // Test invalid message format
      const invalidMessages = [
        {
          id: 'msg-1',
          role: 'invalid' as any,
          content: 'Test',
          timestamp: new Date(),
        },
      ];

      await expect(provider.chat(invalidMessages)).rejects.toThrow('Invalid message format');
    });
  });
});
