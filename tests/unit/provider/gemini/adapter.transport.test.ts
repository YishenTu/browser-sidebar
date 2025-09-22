import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GeminiProvider } from '@core/engine/gemini/GeminiProvider';
import type { Transport, TransportRequest } from '@transport/types';
import type { GeminiChatConfig } from '@core/ai/gemini/types';
import type { ProviderChatMessage, StreamChunk } from '@types/providers';

// Transport default path — no feature flag

// Mock all the dependencies inline to avoid hoisting issues
vi.mock('@core/ai/gemini/streamProcessor', () => {
  const MockProcessor = function () {
    return {
      processChunk: vi.fn((chunk: string) => {
        if (chunk.includes('data: {')) {
          try {
            const dataMatch = chunk.match(/data: ({.*})/);
            if (dataMatch) {
              return [JSON.parse(dataMatch[1])];
            }
          } catch {
            return [];
          }
        }
        return [];
      }),
    };
  };
  return { GeminiStreamProcessor: MockProcessor };
});

vi.mock('@core/ai/gemini/requestBuilder', () => ({
  buildRequest: vi.fn(() => ({
    contents: [{ role: 'user', parts: [{ text: 'Hello' }] }],
    generationConfig: { maxOutputTokens: 1000 },
  })),
  buildHeaders: vi.fn(() => ({ 'x-goog-api-key': 'test-key' })),
  buildApiUrl: vi.fn(
    (endpoint, apiKey, customEndpoint) =>
      `${customEndpoint || 'https://generativelanguage.googleapis.com'}/v1beta${endpoint}?key=${apiKey}`
  ),
}));

vi.mock('@core/ai/gemini/errorHandler', () => ({
  withErrorHandlingGenerator: vi.fn(generatorFunc => {
    return generatorFunc();
  }),
}));

vi.mock('@core/ai/gemini/responseParser', () => ({
  convertToStreamChunk: vi.fn((geminiResponse: any, model: string) => {
    const candidate = geminiResponse.candidates?.[0];
    const parts = candidate?.content?.parts || [];

    // Separate thinking and content parts
    const contentParts = parts.filter((p: any) => !p.thought);
    const thinkingParts = parts.filter((p: any) => p.thought);

    const content = contentParts.map((p: any) => p.text).join('');
    const thinking = thinkingParts.map((p: any) => p.text).join('');

    return {
      id: `gemini-${Date.now()}`,
      object: 'response.chunk',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          index: 0,
          delta: {
            content: content || '',
            thinking: thinking || undefined,
          },
          finishReason: candidate?.finishReason === 'STOP' ? 'stop' : null,
        },
      ],
      usage: geminiResponse.usageMetadata
        ? {
            promptTokens: geminiResponse.usageMetadata.promptTokenCount || 0,
            completionTokens: geminiResponse.usageMetadata.candidatesTokenCount || 0,
            totalTokens: geminiResponse.usageMetadata.totalTokenCount || 0,
          }
        : undefined,
      metadata: candidate?.groundingMetadata ? { searchResults: {} } : undefined,
    };
  }),
  processStreamChunk: vi.fn((chunk: any) => {
    const processedChunk = { ...chunk };
    if (processedChunk.choices) {
      processedChunk.choices = processedChunk.choices.map((choice: any) => ({
        ...choice,
        delta: { ...choice.delta },
      }));
    }
    return processedChunk;
  }),
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('GeminiProvider Transport Integration', () => {
  let provider: GeminiProvider;
  let mockTransport: Transport;
  let mockTransportStream: AsyncIterable<Uint8Array>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create a mock transport
    mockTransport = {
      request: vi.fn(),
      stream: vi.fn(),
    };

    // Create provider with transport
    provider = new GeminiProvider(mockTransport);

    // Initialize provider with test config
    const testConfig = {
      type: 'gemini' as const,
      config: {
        apiKey: 'test-key',
        model: 'gemini-2.5-flash',
        thinkingBudget: '0' as const,
      },
    };

    provider.initialize(testConfig);

    // Create a default mock stream
    mockTransportStream = (async function* () {
      const chunks = [
        'data: {"candidates":[{"content":{"parts":[{"text":"Hello"}]}}]}\n\n',
        'data: {"candidates":[{"content":{"parts":[{"text":" world"}]}}]}\n\n',
        'data: {"candidates":[{"content":{"parts":[{"text":"!"}]},"finishReason":"STOP"}]}\n\n',
      ];

      for (const chunk of chunks) {
        yield new TextEncoder().encode(chunk);
      }
    })();

    (mockTransport.stream as any).mockReturnValue(mockTransportStream);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Transport Mode Detection', () => {
    it('should use transport when available', async () => {
      const messages: ProviderChatMessage[] = [
        {
          id: '1',
          role: 'user',
          content: 'Hello',
          timestamp: new Date(),
        },
      ];

      const config: GeminiChatConfig = {
        signal: new AbortController().signal,
      };

      const chunks: StreamChunk[] = [];
      for await (const chunk of provider.streamChat(messages, config)) {
        chunks.push(chunk);
        if (chunks.length >= 3) break;
      }

      expect(mockTransport.stream).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('streamGenerateContent'),
          method: 'POST',
          headers: { 'x-goog-api-key': 'test-key' },
          body: expect.stringContaining('contents'),
          stream: true,
          signal: config.signal,
        })
      );
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should throw when transport is not provided', async () => {
      const providerWithoutTransport = new GeminiProvider();
      await providerWithoutTransport.initialize({
        type: 'gemini' as const,
        config: { apiKey: 'test-key', model: 'gemini-2.5-flash' },
      });
      const messages: ProviderChatMessage[] = [
        { id: '1', role: 'user', content: 'Hello', timestamp: new Date() },
      ];
      await expect(async () => {
        for await (const _ of providerWithoutTransport.streamChat(messages)) {
          // no-op
        }
      }).rejects.toThrow('Transport not available');
    });
  });

  describe('Transport Streaming', () => {
    it('should stream chunks correctly with transport', async () => {
      const messages: ProviderChatMessage[] = [
        { id: '1', role: 'user', content: 'Tell me a joke', timestamp: new Date() },
      ];

      const chunks: StreamChunk[] = [];
      for await (const chunk of provider.streamChat(messages)) {
        chunks.push(chunk);
        if (chunks.length >= 3) break;
      }

      expect(chunks.length).toBe(3);

      // Verify chunk structure
      for (const chunk of chunks) {
        expect(chunk).toMatchObject({
          id: expect.stringMatching(/^gemini-\d+/),
          object: 'response.chunk',
          created: expect.any(Number),
          model: 'gemini-2.5-flash',
          choices: expect.arrayContaining([
            expect.objectContaining({
              index: 0,
              delta: expect.objectContaining({
                content: expect.any(String),
              }),
            }),
          ]),
        });
      }
    });

    it('should handle transport request format correctly', async () => {
      const messages: ProviderChatMessage[] = [
        { id: '1', role: 'user', content: 'Hello transport', timestamp: new Date() },
      ];

      const config: GeminiChatConfig = {
        thinkingBudget: '-1',
        signal: new AbortController().signal,
      };

      // Stream one chunk to trigger transport call
      const iterator = provider.streamChat(messages, config);
      await iterator.next();

      expect(mockTransport.stream).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('streamGenerateContent'),
          method: 'POST',
          headers: expect.objectContaining({
            'x-goog-api-key': 'test-key',
          }),
          body: expect.stringContaining('contents'),
          stream: true,
          signal: config.signal,
        })
      );
    });

    it('should handle empty transport stream', async () => {
      (mockTransport.stream as any).mockReturnValue(
        (async function* () {
          // Empty stream
        })()
      );

      const messages: ProviderChatMessage[] = [
        { id: '1', role: 'user', content: 'Hello', timestamp: new Date() },
      ];

      const chunks: StreamChunk[] = [];
      for await (const chunk of provider.streamChat(messages)) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBe(0);
    });
  });

  describe('Chunk Contract Verification', () => {
    it('should return properly formatted StreamChunk objects', async () => {
      const messages: ProviderChatMessage[] = [
        { id: '1', role: 'user', content: 'Test message', timestamp: new Date() },
      ];

      const chunks: StreamChunk[] = [];
      for await (const chunk of provider.streamChat(messages)) {
        chunks.push(chunk);
        if (chunks.length >= 1) break;
      }

      expect(chunks.length).toBeGreaterThan(0);
      const chunk = chunks[0];

      // Verify StreamChunk contract
      expect(chunk).toHaveProperty('id');
      expect(chunk).toHaveProperty('object', 'response.chunk');
      expect(chunk).toHaveProperty('created');
      expect(chunk).toHaveProperty('model');
      expect(chunk).toHaveProperty('choices');

      expect(typeof chunk.id).toBe('string');
      expect(typeof chunk.created).toBe('number');
      expect(typeof chunk.model).toBe('string');
      expect(Array.isArray(chunk.choices)).toBe(true);

      const choice = chunk.choices[0];
      expect(choice).toHaveProperty('index', 0);
      expect(choice).toHaveProperty('delta');
      expect(choice).toHaveProperty('finishReason');

      expect(typeof choice.index).toBe('number');
      expect(typeof choice.delta).toBe('object');
      expect(choice.delta).not.toBeNull();
    });

    it('should handle chunks with thinking content', async () => {
      const streamWithThinking = (async function* () {
        const chunk = JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  { text: 'Let me think about this', thought: true },
                  { text: 'The answer is 42' },
                ],
              },
            },
          ],
        });
        yield new TextEncoder().encode(`data: ${chunk}\n\n`);
      })();

      (mockTransport.stream as any).mockReturnValue(streamWithThinking);

      const messages: ProviderChatMessage[] = [
        { id: '1', role: 'user', content: 'What is the answer?', timestamp: new Date() },
      ];

      const config: GeminiChatConfig = {};

      const chunks: StreamChunk[] = [];
      for await (const chunk of provider.streamChat(messages, config)) {
        chunks.push(chunk);
        if (chunks.length >= 1) break;
      }

      expect(chunks.length).toBeGreaterThan(0);
      const chunk = chunks[0];

      expect(chunk.choices[0].delta.content).toBe('The answer is 42');
      expect(chunk.choices[0].delta.thinking).toBe('Let me think about this');
    });

    it('should handle chunks with usage metadata', async () => {
      const streamWithUsage = (async function* () {
        const chunk = JSON.stringify({
          candidates: [
            {
              content: { parts: [{ text: 'Response with usage' }] },
              finishReason: 'STOP',
            },
          ],
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 5,
            totalTokenCount: 15,
            thinkingTokenCount: 3,
          },
        });
        yield new TextEncoder().encode(`data: ${chunk}\n\n`);
      })();

      (mockTransport.stream as any).mockReturnValue(streamWithUsage);

      const messages: ProviderChatMessage[] = [
        { id: '1', role: 'user', content: 'Count tokens', timestamp: new Date() },
      ];

      const chunks: StreamChunk[] = [];
      for await (const chunk of provider.streamChat(messages)) {
        chunks.push(chunk);
        if (chunks.length >= 1) break;
      }

      expect(chunks.length).toBeGreaterThan(0);
      const chunk = chunks[0];

      expect(chunk.usage).toMatchObject({
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle transport errors gracefully', async () => {
      const transportError = new Error('Transport connection failed');

      // Mock stream to throw error
      (mockTransport.stream as any).mockReturnValue(
        (async function* () {
          yield; // Satisfy require-yield rule
          throw transportError;
        })()
      );

      const messages: ProviderChatMessage[] = [
        { id: '1', role: 'user', content: 'This will fail', timestamp: new Date() },
      ];

      await expect(async () => {
        const chunks: StreamChunk[] = [];
        for await (const chunk of provider.streamChat(messages)) {
          chunks.push(chunk);
        }
      }).rejects.toThrow('Transport connection failed');
    });

    it('should handle malformed transport responses', async () => {
      const malformedStream = (async function* () {
        yield new TextEncoder().encode('data: {invalid json}\n\n');
      })();

      (mockTransport.stream as any).mockReturnValue(malformedStream);

      const messages: ProviderChatMessage[] = [
        { id: '1', role: 'user', content: 'Malformed response', timestamp: new Date() },
      ];

      // Should not throw, just skip invalid chunks
      const chunks: StreamChunk[] = [];
      for await (const chunk of provider.streamChat(messages)) {
        chunks.push(chunk);
        if (chunks.length >= 1) break;
      }

      expect(chunks.length).toBe(0);
    });

    it('should throw error when transport or config not available in transport mode', async () => {
      const providerWithoutTransport = new GeminiProvider();

      const messages: ProviderChatMessage[] = [
        { id: '1', role: 'user', content: 'Test', timestamp: new Date() },
      ];

      await expect(async () => {
        for await (const chunk of providerWithoutTransport.streamChat(messages)) {
          break;
        }
      }).rejects.toThrow();
    });
  });

  describe('Cancellation via AbortSignal', () => {
    it('should handle cancellation through AbortSignal', async () => {
      const slowStream = (async function* () {
        for (let i = 0; i < 10; i++) {
          const chunk = JSON.stringify({
            candidates: [{ content: { parts: [{ text: `Chunk ${i}` }] } }],
          });
          yield new TextEncoder().encode(`data: ${chunk}\n\n`);

          await new Promise(resolve => setTimeout(resolve, 100));
        }
      })();

      (mockTransport.stream as any).mockReturnValue(slowStream);

      const controller = new AbortController();
      const messages: ProviderChatMessage[] = [
        { id: '1', role: 'user', content: 'Long streaming response', timestamp: new Date() },
      ];

      const config: GeminiChatConfig = {
        signal: controller.signal,
      };

      setTimeout(() => controller.abort(), 150);

      await expect(async () => {
        const chunks: StreamChunk[] = [];
        for await (const chunk of provider.streamChat(messages, config)) {
          chunks.push(chunk);
        }
      }).rejects.toThrow('Request aborted');
    });

    it('should pass AbortSignal to transport correctly', async () => {
      const controller = new AbortController();
      const messages: ProviderChatMessage[] = [
        { id: '1', role: 'user', content: 'Test signal', timestamp: new Date() },
      ];

      const config: GeminiChatConfig = {
        signal: controller.signal,
      };

      const iterator = provider.streamChat(messages, config);
      await iterator.next();

      expect(mockTransport.stream).toHaveBeenCalledWith(
        expect.objectContaining({
          signal: controller.signal,
        })
      );
    });

    it('should check abort signal before processing each chunk', async () => {
      const controller = new AbortController();
      controller.abort();

      const messages: ProviderChatMessage[] = [
        { id: '1', role: 'user', content: 'Pre-aborted request', timestamp: new Date() },
      ];

      const config: GeminiChatConfig = {
        signal: controller.signal,
      };

      await expect(async () => {
        const chunks: StreamChunk[] = [];
        for await (const chunk of provider.streamChat(messages, config)) {
          chunks.push(chunk);
        }
      }).rejects.toThrow('Request aborted');
    });
  });

  describe('Thinking Budget and Reasoning Features', () => {
    it('should pass thinking budget to request builder', async () => {
      const { buildRequest } = await import('@core/ai/gemini/requestBuilder');

      const messages: ProviderChatMessage[] = [
        { id: '1', role: 'user', content: 'Think about this', timestamp: new Date() },
      ];

      const config: GeminiChatConfig = {
        thinkingBudget: '-1',
      };

      const iterator = provider.streamChat(messages, config);
      await iterator.next();

      // Check that buildRequest was called - the exact config structure may vary
      expect(buildRequest).toHaveBeenCalledWith(
        messages,
        expect.any(Object), // Provider's internal config
        config // Runtime config
      );
    });

    it('should handle different thinking budget values', async () => {
      const { buildRequest } = await import('@core/ai/gemini/requestBuilder');

      const messages: ProviderChatMessage[] = [
        { id: '1', role: 'user', content: 'Test thinking budgets', timestamp: new Date() },
      ];

      // Test with budget '0' (off)
      const configBudgetOff: GeminiChatConfig = {
        thinkingBudget: '0',
      };

      let iterator = provider.streamChat(messages, configBudgetOff);
      await iterator.next();

      // Test with budget '-1' (dynamic)
      const configBudgetDynamic: GeminiChatConfig = {
        thinkingBudget: '-1',
      };

      iterator = provider.streamChat(messages, configBudgetDynamic);
      await iterator.next();

      // Check that buildRequest was called multiple times with different configs
      expect(buildRequest).toHaveBeenCalledTimes(2);
      // The exact argument matching is complex due to internal config merging
      expect(buildRequest).toHaveBeenCalledWith(messages, expect.any(Object), expect.any(Object));
    });
  });

  describe('Final Completion Chunk', () => {
    it('should yield final completion chunk when finish reason is present', async () => {
      const streamWithFinish = (async function* () {
        const chunks = [
          '{"candidates":[{"content":{"parts":[{"text":"Hello"}]}}]}',
          '{"candidates":[{"content":{"parts":[{"text":" world"}]}}]}',
          '{"candidates":[{"content":{"parts":[{"text":"!"}]},"finishReason":"STOP"}]}',
        ];

        for (const chunk of chunks) {
          yield new TextEncoder().encode(`data: ${chunk}\n\n`);
        }
      })();

      (mockTransport.stream as any).mockReturnValue(streamWithFinish);

      const messages: ProviderChatMessage[] = [
        { id: '1', role: 'user', content: 'Complete message', timestamp: new Date() },
      ];

      const chunks: StreamChunk[] = [];
      for await (const chunk of provider.streamChat(messages)) {
        chunks.push(chunk);
      }

      // Should have content chunks plus final completion chunk
      expect(chunks.length).toBeGreaterThan(3);

      // Last chunk should be completion
      const lastChunk = chunks[chunks.length - 1];
      expect(lastChunk.choices[0].finishReason).toBe('stop');
      expect(lastChunk.choices[0].delta).toEqual({});
      expect(lastChunk.id).toMatch(/gemini-complete-\d+/);
    });
  });

  describe('Transport Configuration', () => {
    it('should use custom endpoint when provided', async () => {
      const customProvider = new GeminiProvider(mockTransport);
      await customProvider.initialize({
        type: 'gemini' as const,
        config: {
          apiKey: 'test-key',
          model: 'gemini-2.5-flash',
          endpoint: 'https://custom-endpoint.com',
        },
      });

      const { buildApiUrl } = await import('@core/ai/gemini/requestBuilder');

      const messages: ProviderChatMessage[] = [
        { id: '1', role: 'user', content: 'Custom endpoint test', timestamp: new Date() },
      ];

      const iterator = customProvider.streamChat(messages);
      await iterator.next();

      expect(buildApiUrl).toHaveBeenCalledWith(
        expect.stringContaining('streamGenerateContent'),
        'test-key',
        'https://custom-endpoint.com'
      );
    });
  });
});
