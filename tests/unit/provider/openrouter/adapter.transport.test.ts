import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Transport, TransportRequest } from '@transport/types';
import {
  TransportNetworkError,
  TransportTimeoutError,
  TransportAbortError,
} from '@transport/types';
import type {
  ProviderChatMessage,
  StreamChunk,
  ProviderConfig,
  OpenRouterConfig,
} from '@/types/providers';

// Transport is enabled by default in new architecture

// Mock models
vi.mock('@config/models', () => ({
  DEFAULT_MODELS: [
    { id: 'openai/gpt-4o-mini', name: 'GPT-4O Mini', provider: 'openrouter' },
    { id: 'anthropic/claude-3-sonnet', name: 'Claude 3 Sonnet', provider: 'openrouter' },
  ],
  DEFAULT_MODEL_ID: 'openai/gpt-4o-mini',
  DEFAULT_OPENROUTER_MODEL_ID: 'openai/gpt-4o-mini',
  getModelsByProvider: () => [
    { id: 'openai/gpt-4o-mini', name: 'GPT-4O Mini' },
    { id: 'anthropic/claude-3-sonnet', name: 'Claude 3 Sonnet' },
  ],
  getModelById: () => ({
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4O Mini',
  }),
}));

// Mock provider dependencies
vi.mock('@core/engine/openrouter/OpenRouterClient');
vi.mock('@core/ai/openrouter/requestBuilder');
vi.mock('@core/ai/openrouter/streamProcessor');
vi.mock('@core/ai/openrouter/errorHandler');
vi.mock('@/types/providers', async importOriginal => {
  const actual = await importOriginal();
  return {
    ...(actual as any),
    validateOpenRouterConfig: () => ({ isValid: true, errors: [] }),
  };
});

// Mock chrome runtime
global.chrome = {
  runtime: {
    id: 'test-extension-id',
  },
} as any;

// Import after mocks
const { OpenRouterProvider } = await import('@core/engine/openrouter/OpenRouterProvider');
const { buildRequest } = await import('@core/ai/openrouter/requestBuilder');
const { processStreamChunk } = await import('@core/ai/openrouter/streamProcessor');
const { mapErrorToProviderError } = await import('@core/ai/openrouter/errorHandler');
const { OpenRouterClient } = await import('@core/engine/openrouter/OpenRouterClient');

const mockBuildRequest = vi.mocked(buildRequest);
const mockProcessStreamChunk = vi.mocked(processStreamChunk);
const mockMapErrorToProviderError = vi.mocked(mapErrorToProviderError);
const MockedOpenRouterClient = vi.mocked(OpenRouterClient);

describe('OpenRouterProvider Transport Integration', () => {
  let provider: OpenRouterProvider;
  let mockTransport: { request: any; stream: any };
  let mockConfig: ProviderConfig;
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock client
    mockClient = {
      testConnection: vi.fn().mockResolvedValue(true),
      getClient: vi.fn().mockReturnValue({
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue({
              async *[Symbol.asyncIterator]() {
                yield {
                  id: 'test-chunk',
                  choices: [{ index: 0, delta: { content: 'Hello' } }],
                };
              },
            }),
          },
        },
      }),
      updateConfig: vi.fn(),
    };

    MockedOpenRouterClient.mockImplementation(() => mockClient);

    // Setup mock transport
    mockTransport = {
      request: vi.fn(),
      stream: vi.fn(),
    };

    // Create provider with transport
    provider = new OpenRouterProvider(mockTransport);

    // Setup mock config
    mockConfig = {
      type: 'openrouter',
      config: {
        apiKey: 'test-api-key',
        model: 'openai/gpt-4o-mini',
        reasoning: {
          effort: 'medium',
          exclude: false,
        },
        headers: {
          referer: 'https://example.com',
          title: 'Test App',
        },
      } as OpenRouterConfig,
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Transport Usage Logic', () => {
    it('should use transport when refactor mode is enabled and transport is available', async () => {
      await provider.initialize(mockConfig);

      const messages: ProviderChatMessage[] = [
        { id: '1', role: 'user', content: 'Hello', timestamp: new Date() },
      ];

      const mockRequest = {
        model: 'openai/gpt-4o-mini',
        messages: [{ id: '1', role: 'user', content: 'Hello', timestamp: new Date() }],
        stream: true,
      };

      mockBuildRequest.mockReturnValue(mockRequest);

      // Mock transport stream response
      const mockStreamChunks = [
        new TextEncoder().encode(
          'data: {"id":"chunk-1","choices":[{"delta":{"content":"Hello"}}]}\n\n'
        ),
        new TextEncoder().encode(
          'data: {"id":"chunk-2","choices":[{"delta":{"content":" there"}}]}\n\n'
        ),
        new TextEncoder().encode('data: [DONE]\n\n'),
      ];

      mockTransport.stream.mockImplementation(async function* () {
        for (const chunk of mockStreamChunks) {
          yield chunk;
        }
      });

      // Mock stream processor
      const mockStreamChunk: StreamChunk = {
        id: 'chunk-1',
        object: 'chat.completion.chunk',
        created: Date.now(),
        model: 'openai/gpt-4o-mini',
        choices: [
          {
            index: 0,
            delta: { content: 'Hello' },
            finishReason: null,
          },
        ],
      };

      mockProcessStreamChunk.mockReturnValue(mockStreamChunk);

      const chunks: StreamChunk[] = [];
      for await (const chunk of provider.streamChat(messages)) {
        chunks.push(chunk);
      }

      // Verify transport was called with correct request
      expect(mockTransport.stream).toHaveBeenCalledWith({
        url: 'https://openrouter.ai/api/v1/chat/completions',
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-api-key',
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://example.com',
          'X-Title': 'Test App',
        },
        body: JSON.stringify({ ...mockRequest, stream: true }),
        stream: true,
        signal: undefined,
      });

      // Verify OpenAI SDK was not called
      expect(mockClient.getClient).not.toHaveBeenCalled();
    });

    it('should throw when transport is not available', async () => {
      provider = new OpenRouterProvider();
      await provider.initialize(mockConfig);
      const messages: ProviderChatMessage[] = [
        { id: '1', role: 'user', content: 'Hello', timestamp: new Date() },
      ];
      // Ensure error mapping returns a ProviderError structure
      mockMapErrorToProviderError.mockReturnValue({
        type: 'unknown',
        message: 'Transport not available',
        code: 'UNKNOWN_ERROR',
        provider: 'openrouter',
      } as any);
      await expect(async () => {
        for await (const _ of provider.streamChat(messages)) {
          // no-op
        }
      }).rejects.toThrow('Transport not available');
    });
  });

  describe('Transport Request Format', () => {
    beforeEach(async () => {
      await provider.initialize(mockConfig);
    });

    it('should format request correctly for transport', async () => {
      const messages: ProviderChatMessage[] = [
        { id: '1', role: 'user', content: 'Test message', timestamp: new Date() },
      ];

      const mockRequest = {
        model: 'openai/gpt-4o-mini',
        messages: [{ id: '1', role: 'user', content: 'Test message', timestamp: new Date() }],
        stream: true,
        reasoning: { effort: 'medium' },
      };

      mockBuildRequest.mockReturnValue(mockRequest);
      mockTransport.stream.mockImplementation(async function* () {
        yield new TextEncoder().encode('data: {"id":"test"}\n\n');
      });
      mockProcessStreamChunk.mockReturnValue(null);

      for await (const _ of provider.streamChat(messages)) {
        break; // Just need one iteration
      }

      // Verify common request fields (ignore volatile timestamp)
      expect(mockTransport.stream).toHaveBeenCalled();
      const call = (mockTransport.stream as any).mock.calls[0][0];
      expect(call).toMatchObject({
        url: 'https://openrouter.ai/api/v1/chat/completions',
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-api-key',
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://example.com',
          'X-Title': 'Test App',
        },
        stream: true,
        signal: undefined,
      });
      const body = JSON.parse(call.body);
      expect(body).toMatchObject({
        model: 'openai/gpt-4o-mini',
        stream: true,
        reasoning: { effort: 'medium' },
      });
      expect(body.messages[0]).toMatchObject({ id: '1', role: 'user', content: 'Test message' });
    });

    it('should use default headers when not provided in config', async () => {
      const configWithoutHeaders: ProviderConfig = {
        type: 'openrouter',
        config: {
          apiKey: 'test-api-key',
          model: 'openai/gpt-4o-mini',
        } as OpenRouterConfig,
      };

      await provider.initialize(configWithoutHeaders);

      const messages: ProviderChatMessage[] = [
        { id: '1', role: 'user', content: 'Test', timestamp: new Date() },
      ];

      mockBuildRequest.mockReturnValue({
        model: 'openai/gpt-4o-mini',
        messages: [{ id: '1', role: 'user', content: 'Test', timestamp: new Date() }],
        stream: true,
      });

      mockTransport.stream.mockImplementation(async function* () {
        yield new TextEncoder().encode('data: {"id":"test"}\n\n');
      });
      mockProcessStreamChunk.mockReturnValue(null);

      for await (const _ of provider.streamChat(messages)) {
        break;
      }

      expect(mockTransport.stream).toHaveBeenCalledWith({
        url: 'https://openrouter.ai/api/v1/chat/completions',
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-api-key',
          'Content-Type': 'application/json',
          'HTTP-Referer': 'chrome-extension://test-extension-id',
          'X-Title': 'AI Browser Sidebar',
        },
        body: expect.any(String),
        stream: true,
        signal: undefined,
      });
    });

    it('should pass AbortSignal to transport', async () => {
      const messages: ProviderChatMessage[] = [
        { id: '1', role: 'user', content: 'Test', timestamp: new Date() },
      ];

      const controller = new AbortController();
      const signal = controller.signal;

      mockBuildRequest.mockReturnValue({
        model: 'openai/gpt-4o-mini',
        messages: [{ id: '1', role: 'user', content: 'Test', timestamp: new Date() }],
        stream: true,
      });

      mockTransport.stream.mockImplementation(async function* () {
        yield new TextEncoder().encode('data: {"id":"test"}\n\n');
      });
      mockProcessStreamChunk.mockReturnValue(null);

      const streamGenerator = provider.streamChat(messages, { signal });

      for await (const _ of streamGenerator) {
        break;
      }

      expect(mockTransport.stream).toHaveBeenCalledWith(
        expect.objectContaining({
          signal,
        })
      );
    });
  });

  describe('SSE Stream Processing', () => {
    beforeEach(async () => {
      await provider.initialize(mockConfig);
    });

    it('should correctly parse SSE stream chunks', async () => {
      const messages: ProviderChatMessage[] = [
        { id: '1', role: 'user', content: 'Hello', timestamp: new Date() },
      ];

      mockBuildRequest.mockReturnValue({
        model: 'openai/gpt-4o-mini',
        messages: [{ id: '1', role: 'user', content: 'Hello', timestamp: new Date() }],
        stream: true,
      });

      // Mock SSE data
      const mockSSEData = [
        'data: {"id":"chunk-1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"Hello"}}]}\n\n',
        'data: {"id":"chunk-2","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":" world"}}]}\n\n',
        'data: [DONE]\n\n',
      ];

      const mockStreamChunks = mockSSEData.map(data => new TextEncoder().encode(data));

      mockTransport.stream.mockImplementation(async function* () {
        for (const chunk of mockStreamChunks) {
          yield chunk;
        }
      });

      const mockStreamChunk1: StreamChunk = {
        id: 'chunk-1',
        object: 'chat.completion.chunk',
        created: Date.now(),
        model: 'openai/gpt-4o-mini',
        choices: [
          {
            index: 0,
            delta: { content: 'Hello' },
            finishReason: null,
          },
        ],
      };

      const mockStreamChunk2: StreamChunk = {
        id: 'chunk-2',
        object: 'chat.completion.chunk',
        created: Date.now(),
        model: 'openai/gpt-4o-mini',
        choices: [
          {
            index: 0,
            delta: { content: ' world' },
            finishReason: null,
          },
        ],
      };

      mockProcessStreamChunk
        .mockReturnValueOnce(mockStreamChunk1)
        .mockReturnValueOnce(mockStreamChunk2);

      const chunks: StreamChunk[] = [];
      for await (const chunk of provider.streamChat(messages)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toEqual(mockStreamChunk1);
      expect(chunks[1]).toEqual(mockStreamChunk2);
      expect(mockProcessStreamChunk).toHaveBeenCalledTimes(2);
    });

    it('should handle incomplete JSON gracefully', async () => {
      const messages: ProviderChatMessage[] = [
        { id: '1', role: 'user', content: 'Test', timestamp: new Date() },
      ];

      mockBuildRequest.mockReturnValue({
        model: 'openai/gpt-4o-mini',
        messages: [{ id: '1', role: 'user', content: 'Test', timestamp: new Date() }],
        stream: true,
      });

      const mockStreamChunks = [
        new TextEncoder().encode('data: {"invalid": json\n\n'),
        new TextEncoder().encode('data: {"id":"valid","choices":[{"delta":{"content":"Hi"}}]}\n\n'),
        new TextEncoder().encode('data: [DONE]\n\n'),
      ];

      mockTransport.stream.mockImplementation(async function* () {
        for (const chunk of mockStreamChunks) {
          yield chunk;
        }
      });

      const validStreamChunk: StreamChunk = {
        id: 'valid',
        object: 'chat.completion.chunk',
        created: Date.now(),
        model: 'openai/gpt-4o-mini',
        choices: [
          {
            index: 0,
            delta: { content: 'Hi' },
            finishReason: null,
          },
        ],
      };

      // Mock console.warn to track parse errors
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      mockProcessStreamChunk.mockReturnValueOnce(validStreamChunk).mockReturnValueOnce(null);

      const chunks: StreamChunk[] = [];
      for await (const chunk of provider.streamChat(messages)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toEqual(validStreamChunk);
      // Console warning removed for production, verify no console output
      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await provider.initialize(mockConfig);
    });

    it('should handle transport network errors', async () => {
      const messages: ProviderChatMessage[] = [
        { id: '1', role: 'user', content: 'Test', timestamp: new Date() },
      ];

      mockBuildRequest.mockReturnValue({
        model: 'openai/gpt-4o-mini',
        messages: [{ id: '1', role: 'user', content: 'Test', timestamp: new Date() }],
        stream: true,
      });

      const networkError = new TransportNetworkError('Network failed');
      mockTransport.stream.mockImplementation(async function* () {
        yield; // Satisfy require-yield rule
        throw networkError;
      });

      const providerError = {
        type: 'network_error',
        message: 'Network failed',
        originalError: networkError,
      };
      mockMapErrorToProviderError.mockReturnValue(providerError);

      const streamGenerator = provider.streamChat(messages);

      await expect(async () => {
        for await (const chunk of streamGenerator) {
          // Should not reach here
        }
      }).rejects.toThrow('Network failed');

      expect(mockMapErrorToProviderError).toHaveBeenCalledWith(networkError);
    });

    it('should handle transport abort errors', async () => {
      const messages: ProviderChatMessage[] = [
        { id: '1', role: 'user', content: 'Test', timestamp: new Date() },
      ];

      const controller = new AbortController();
      mockBuildRequest.mockReturnValue({
        model: 'openai/gpt-4o-mini',
        messages: [{ id: '1', role: 'user', content: 'Test', timestamp: new Date() }],
        stream: true,
      });

      const abortError = new TransportAbortError('Request was aborted');
      mockTransport.stream.mockImplementation(async function* () {
        yield; // Satisfy require-yield rule
        throw abortError;
      });

      const providerError = {
        type: 'abort_error',
        message: 'Request was aborted',
        originalError: abortError,
      };
      mockMapErrorToProviderError.mockReturnValue(providerError);

      const streamGenerator = provider.streamChat(messages, { signal: controller.signal });

      await expect(async () => {
        for await (const chunk of streamGenerator) {
          // Should not reach here
        }
      }).rejects.toThrow('Request was aborted');
    });
  });

  describe('Chunk Contract Verification', () => {
    beforeEach(async () => {
      await provider.initialize(mockConfig);
    });

    it('should return properly formatted StreamChunk objects', async () => {
      const messages: ProviderChatMessage[] = [
        { id: '1', role: 'user', content: 'Test', timestamp: new Date() },
      ];

      mockBuildRequest.mockReturnValue({
        model: 'openai/gpt-4o-mini',
        messages: [{ id: '1', role: 'user', content: 'Test', timestamp: new Date() }],
        stream: true,
      });

      mockTransport.stream.mockImplementation(async function* () {
        yield new TextEncoder().encode(
          'data: {"id":"test-chunk","object":"chat.completion.chunk","created":1234567890,"model":"openai/gpt-4o-mini","choices":[{"index":0,"delta":{"role":"assistant","content":"Hello"},"finish_reason":null}]}\n\n'
        );
      });

      const expectedChunk: StreamChunk = {
        id: 'test-chunk',
        object: 'chat.completion.chunk',
        created: 1234567890,
        model: 'openai/gpt-4o-mini',
        choices: [
          {
            index: 0,
            delta: {
              role: 'assistant',
              content: 'Hello',
            },
            finishReason: null,
          },
        ],
        usage: undefined,
      };

      mockProcessStreamChunk.mockReturnValue(expectedChunk);

      const chunks: StreamChunk[] = [];
      for await (const chunk of provider.streamChat(messages)) {
        chunks.push(chunk);

        // Verify chunk contract
        expect(chunk).toHaveProperty('id');
        expect(chunk).toHaveProperty('object');
        expect(chunk).toHaveProperty('created');
        expect(chunk).toHaveProperty('model');
        expect(chunk).toHaveProperty('choices');
        expect(Array.isArray(chunk.choices)).toBe(true);

        if (chunk.choices.length > 0) {
          const choice = chunk.choices[0];
          expect(choice).toHaveProperty('index');
          expect(choice).toHaveProperty('delta');
          expect(choice).toHaveProperty('finishReason');

          if (choice.delta) {
            expect(typeof choice.delta).toBe('object');
          }
        }

        break; // Test first chunk
      }

      expect(chunks[0]).toEqual(expectedChunk);
    });

    it('should handle chunks with thinking/reasoning content', async () => {
      const messages: ProviderChatMessage[] = [
        { id: '1', role: 'user', content: 'Test', timestamp: new Date() },
      ];

      mockBuildRequest.mockReturnValue({
        model: 'openai/gpt-4o-mini',
        messages: [{ id: '1', role: 'user', content: 'Test', timestamp: new Date() }],
        stream: true,
        reasoning: { effort: 'high' },
      });

      mockTransport.stream.mockImplementation(async function* () {
        yield new TextEncoder().encode(
          'data: {"id":"reasoning-chunk","choices":[{"delta":{"reasoning":"I need to think about this"}}]}\n\n'
        );
      });

      const reasoningChunk: StreamChunk = {
        id: 'reasoning-chunk',
        object: 'chat.completion.chunk',
        created: Date.now(),
        model: 'openai/gpt-4o-mini',
        choices: [
          {
            index: 0,
            delta: {
              thinking: 'I need to think about this',
            },
            finishReason: null,
          },
        ],
      };

      mockProcessStreamChunk.mockReturnValue(reasoningChunk);

      const chunks: StreamChunk[] = [];
      for await (const chunk of provider.streamChat(messages)) {
        chunks.push(chunk);

        // Verify thinking content is properly formatted
        if (chunk.choices[0]?.delta?.thinking) {
          expect(typeof chunk.choices[0].delta.thinking).toBe('string');
        }

        break;
      }

      expect(chunks[0]).toEqual(reasoningChunk);
    });

    it('should handle chunks with usage information', async () => {
      const messages: ProviderChatMessage[] = [
        { id: '1', role: 'user', content: 'Test', timestamp: new Date() },
      ];

      mockBuildRequest.mockReturnValue({
        model: 'openai/gpt-4o-mini',
        messages: [{ id: '1', role: 'user', content: 'Test', timestamp: new Date() }],
        stream: true,
      });

      mockTransport.stream.mockImplementation(async function* () {
        yield new TextEncoder().encode(
          'data: {"id":"usage-chunk","usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}\n\n'
        );
      });

      const usageChunk: StreamChunk = {
        id: 'usage-chunk',
        object: 'chat.completion.chunk',
        created: Date.now(),
        model: 'openai/gpt-4o-mini',
        choices: [],
        usage: {
          promptTokens: 10,
          completionTokens: 5,
          totalTokens: 15,
        },
      };

      mockProcessStreamChunk.mockReturnValue(usageChunk);

      const chunks: StreamChunk[] = [];
      for await (const chunk of provider.streamChat(messages)) {
        chunks.push(chunk);

        // Verify usage information format
        if (chunk.usage) {
          expect(chunk.usage).toHaveProperty('promptTokens');
          expect(chunk.usage).toHaveProperty('completionTokens');
          expect(chunk.usage).toHaveProperty('totalTokens');
          expect(typeof chunk.usage.promptTokens).toBe('number');
          expect(typeof chunk.usage.completionTokens).toBe('number');
          expect(typeof chunk.usage.totalTokens).toBe('number');
        }

        break;
      }

      expect(chunks[0]).toEqual(usageChunk);
    });
  });

  describe('Reasoning Effort Configuration', () => {
    beforeEach(async () => {
      await provider.initialize(mockConfig);
    });

    it('should pass reasoning configuration to transport', async () => {
      const messages: ProviderChatMessage[] = [
        { id: '1', role: 'user', content: 'Complex question', timestamp: new Date() },
      ];

      const requestWithReasoning = {
        model: 'openai/gpt-4o-mini',
        messages: [{ id: '1', role: 'user', content: 'Complex question', timestamp: new Date() }],
        stream: true,
        reasoning: {
          effort: 'high',
          max_tokens: 2000,
        },
      };

      mockBuildRequest.mockReturnValue(requestWithReasoning);

      mockTransport.stream.mockImplementation(async function* () {
        yield new TextEncoder().encode(
          'data: {"id":"reasoning-test","choices":[{"delta":{"content":"Answer"}}]}\n\n'
        );
      });

      mockProcessStreamChunk.mockReturnValue({
        id: 'reasoning-test',
        object: 'chat.completion.chunk',
        created: Date.now(),
        model: 'openai/gpt-4o-mini',
        choices: [
          {
            index: 0,
            delta: { content: 'Answer' },
            finishReason: null,
          },
        ],
      });

      for await (const _ of provider.streamChat(messages)) {
        break;
      }

      // Verify that reasoning config was included in the request body
      const transportCall = mockTransport.stream.mock.calls[0][0] as TransportRequest;
      const requestBody = JSON.parse(transportCall.body as string);

      expect(requestBody.reasoning).toEqual({
        effort: 'high',
        max_tokens: 2000,
      });
    });
  });
});
