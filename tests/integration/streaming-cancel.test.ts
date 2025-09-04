/**
 * Integration tests for streaming cancellation
 *
 * Tests the abort signal propagation through all layers of the architecture:
 * UI → ChatService → Provider → Transport
 *
 * Verifies proper cancellation behavior, resource cleanup, and error handling
 * across the entire streaming pipeline.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChatService, createChatService, type StreamOptions } from '@services/chat/ChatService';
import { BaseEngine } from '@core/engine/BaseEngine';
import type {
  AIProvider,
  ProviderChatMessage,
  StreamChunk,
  ProviderCapabilities,
  ProviderValidationResult,
  ProviderError,
  ProviderType,
} from '@types/providers';
import type { Transport, TransportRequest, TransportResponse } from '@transport/types';
import { mockChrome } from '../setup/setup';

// ============================================================================
// Test Data and Fixtures
// ============================================================================

const createTestMessage = (
  id: string,
  role: 'user' | 'assistant' | 'system',
  content: string
): ProviderChatMessage => ({
  id,
  role,
  content,
  timestamp: new Date('2024-01-01T00:00:00Z'),
  metadata: { tokens: content.length },
});

const createTestStreamChunk = (
  content: string,
  index = 0,
  finishReason: string | null = null
): StreamChunk => ({
  id: 'chunk-123',
  object: 'chat.completion.chunk',
  created: Date.now() / 1000,
  model: 'test-model',
  choices: [
    {
      index,
      delta: { content },
      finishReason,
    },
  ],
  usage: {
    promptTokens: 10,
    completionTokens: 5,
    totalTokens: 15,
  },
});

const createFinalStreamChunk = (): StreamChunk => createTestStreamChunk('', 0, 'stop');

// ============================================================================
// Mock Transport Implementation with Cancellation Support
// ============================================================================

class MockStreamingTransport implements Transport {
  private activeRequests = new Map<
    string,
    { abortController: AbortController; stream: AsyncGenerator }
  >();
  public requestCount = 0;
  public streamCount = 0;
  public cancelledCount = 0;

  async request(request: TransportRequest): Promise<TransportResponse> {
    this.requestCount++;

    // Simulate cancellation check
    if (request.signal?.aborted) {
      throw new Error('Request was cancelled');
    }

    return {
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      body: JSON.stringify({ message: 'mock response' }),
    };
  }

  async *stream(request: TransportRequest): AsyncIterable<Uint8Array> {
    this.streamCount++;
    const requestId = `request-${this.streamCount}`;

    // Create internal abort controller that's linked to the request signal
    const abortController = new AbortController();
    const signal = request.signal;

    // Link external signal to internal controller
    if (signal) {
      if (signal.aborted) {
        throw new Error('Transport stream was cancelled');
      }

      signal.addEventListener('abort', () => {
        this.cancelledCount++;
        abortController.abort();
      });
    }

    const streamGenerator = this.createStreamGenerator(abortController.signal);
    this.activeRequests.set(requestId, { abortController, stream: streamGenerator });

    try {
      for await (const chunk of streamGenerator) {
        // Check for cancellation before yielding each chunk
        if (abortController.signal.aborted || signal?.aborted) {
          throw new Error('Transport stream was cancelled');
        }
        yield chunk;
      }
    } finally {
      this.activeRequests.delete(requestId);
    }
  }

  private async *createStreamGenerator(signal: AbortSignal): AsyncGenerator<Uint8Array> {
    const chunks = [
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" there"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"!"}}]}\n\n',
      'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
      'data: [DONE]\n\n',
    ];

    for (const [index, chunk] of chunks.entries()) {
      // Simulate async delay
      await new Promise(resolve => setTimeout(resolve, 10));

      // Check for cancellation
      if (signal.aborted) {
        throw new Error('Stream generator was cancelled');
      }

      yield new TextEncoder().encode(chunk);

      // Add extra delay after first chunk to allow cancellation tests
      if (index === 0) {
        await new Promise(resolve => setTimeout(resolve, 20));
      }
    }
  }

  // Test utilities
  getActiveRequestCount(): number {
    return this.activeRequests.size;
  }

  getStats() {
    return {
      requestCount: this.requestCount,
      streamCount: this.streamCount,
      cancelledCount: this.cancelledCount,
      activeRequests: this.activeRequests.size,
    };
  }

  reset() {
    this.requestCount = 0;
    this.streamCount = 0;
    this.cancelledCount = 0;
    this.activeRequests.clear();
  }
}

// ============================================================================
// Mock Provider with Cancellation Support
// ============================================================================

class MockStreamingProvider extends BaseEngine {
  private activeStreams = new Map<string, AbortController>();
  public streamStartCount = 0;
  public streamCancelCount = 0;

  constructor(transport?: Transport) {
    super(
      'openai',
      'MockStreamingProvider',
      {
        streaming: true,
        temperature: true,
        reasoning: false,
        thinking: false,
        multimodal: false,
        functionCalling: false,
        maxContextLength: 4096,
        supportedModels: ['test-model'],
      },
      transport
    );
  }

  async initialize(): Promise<void> {
    // Mock initialization
  }

  validateConfig(): ProviderValidationResult {
    return { isValid: true, errors: [] };
  }

  async testConnection(): Promise<boolean> {
    return true;
  }

  async *streamChat(
    messages: ProviderChatMessage[],
    config?: Record<string, unknown>
  ): AsyncIterable<StreamChunk> {
    this.streamStartCount++;
    const streamId = `stream-${this.streamStartCount}`;
    const signal = config?.signal as AbortSignal | undefined;

    // Create internal controller for this stream
    const internalController = new AbortController();
    this.activeStreams.set(streamId, internalController);

    // Link external signal to internal controller
    if (signal) {
      if (signal.aborted) {
        throw new Error('Provider stream was cancelled');
      }

      signal.addEventListener('abort', () => {
        this.streamCancelCount++;
        internalController.abort();
      });
    }

    try {
      // If transport is available, use it for streaming
      if (this.transport) {
        const request: TransportRequest = {
          url: 'https://api.openai.com/v1/chat/completions',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer mock-key',
          },
          body: JSON.stringify({ messages, stream: true }),
          signal: signal,
        };

        // Stream through transport
        const encoder = new TextDecoder();
        for await (const chunk of this.transport.stream(request)) {
          // Check for cancellation before processing each chunk
          if (internalController.signal.aborted || signal?.aborted) {
            throw new Error('Provider stream was cancelled');
          }

          // Parse streaming response
          const text = encoder.decode(chunk);
          const lines = text.split('\n').filter(line => line.trim());

          for (const line of lines) {
            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.choices?.[0]?.delta) {
                  const streamChunk = createTestStreamChunk(
                    data.choices[0].delta.content || '',
                    0,
                    data.choices[0].finish_reason || null
                  );
                  yield streamChunk;
                }
              } catch {
                // Ignore parsing errors for malformed chunks
              }
            }
          }
        }
      } else {
        // Fallback to direct chunk generation
        const chunks = [
          createTestStreamChunk('Hello'),
          createTestStreamChunk(' world'),
          createTestStreamChunk('!'),
          createFinalStreamChunk(),
        ];

        for (const chunk of chunks) {
          // Simulate async delay
          await new Promise(resolve => setTimeout(resolve, 10));

          // Check for cancellation
          if (internalController.signal.aborted || signal?.aborted) {
            throw new Error('Provider stream was cancelled');
          }

          yield chunk;
        }
      }
    } finally {
      this.activeStreams.delete(streamId);
    }
  }

  getModels() {
    return [
      {
        id: 'test-model',
        name: 'Test Model',
        provider: 'openai' as ProviderType,
        capabilities: this.capabilities,
        description: 'Test model for cancellation tests',
        contextWindow: 4096,
        temperature: { min: 0, max: 2, step: 0.1, default: 1 },
      },
    ];
  }

  getModel(id: string) {
    const models = this.getModels();
    return models.find(m => m.id === id);
  }

  formatError(error: unknown): ProviderError {
    return {
      type: 'unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'TEST_ERROR',
      provider: this.type,
    };
  }

  // Test utilities
  getActiveStreamCount(): number {
    return this.activeStreams.size;
  }

  getStats() {
    return {
      streamStartCount: this.streamStartCount,
      streamCancelCount: this.streamCancelCount,
      activeStreams: this.activeStreams.size,
    };
  }

  reset() {
    this.streamStartCount = 0;
    this.streamCancelCount = 0;
    this.activeStreams.clear();
  }
}

// ============================================================================
// Test Suite
// ============================================================================

describe('Streaming Cancellation Integration Tests', () => {
  let chatService: ChatService;
  let mockProvider: MockStreamingProvider;
  let mockTransport: MockStreamingTransport;
  let testMessages: ProviderChatMessage[];

  beforeEach(() => {
    vi.clearAllMocks();
    mockTransport = new MockStreamingTransport();
    mockProvider = new MockStreamingProvider(mockTransport);
    chatService = createChatService(mockProvider, mockTransport);

    testMessages = [
      createTestMessage('1', 'user', 'Hello, how are you?'),
      createTestMessage('2', 'assistant', 'I am doing well, thank you!'),
    ];

    // Clear chrome API mocks
    mockChrome.runtime.sendMessage.mockClear();
    mockChrome.runtime.connect.mockClear();
    mockChrome.runtime.lastError = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();

    // Ensure all streams are cancelled
    chatService?.cancel();

    // Wait a bit for cleanup
    return new Promise(resolve => setTimeout(resolve, 50));
  });

  // ============================================================================
  // Basic Cancellation Tests
  // ============================================================================

  describe('basic cancellation behavior', () => {
    it('should cancel stream through ChatService.cancel()', async () => {
      expect(chatService.isStreaming()).toBe(false);

      let streamCancelled = false;
      const streamPromise = (async () => {
        try {
          const chunks: StreamChunk[] = [];
          for await (const chunk of chatService.stream(testMessages)) {
            chunks.push(chunk);

            // Cancel after first chunk
            if (chunks.length === 1) {
              expect(chatService.isStreaming()).toBe(true);
              chatService.cancel();
            }
          }
          return chunks;
        } catch (error) {
          streamCancelled = true;
          throw error;
        }
      })();

      await expect(streamPromise).rejects.toThrow(/cancelled/i);
      expect(streamCancelled).toBe(true);
      expect(chatService.isStreaming()).toBe(false);
    });

    it('should cancel stream through external AbortController', async () => {
      const controller = new AbortController();
      const options: StreamOptions = { signal: controller.signal };

      let streamCancelled = false;
      const streamPromise = (async () => {
        try {
          const chunks: StreamChunk[] = [];
          for await (const chunk of chatService.stream(testMessages, options)) {
            chunks.push(chunk);

            // Cancel after first chunk
            if (chunks.length === 1) {
              controller.abort();
            }
          }
          return chunks;
        } catch (error) {
          streamCancelled = true;
          throw error;
        }
      })();

      await expect(streamPromise).rejects.toThrow(/cancelled/i);
      expect(streamCancelled).toBe(true);
      expect(chatService.isStreaming()).toBe(false);
    });

    it('should handle pre-cancelled AbortSignal', async () => {
      const controller = new AbortController();
      controller.abort(); // Pre-cancel the signal

      const options: StreamOptions = { signal: controller.signal };

      await expect(async () => {
        for await (const chunk of chatService.stream(testMessages, options)) {
          // Should not reach here
        }
      }).rejects.toThrow(/cancelled/i);

      expect(chatService.isStreaming()).toBe(false);
    });

    it('should cancel multiple concurrent streams', async () => {
      const streamPromises = Array.from({ length: 3 }, async (_, index) => {
        try {
          const chunks: StreamChunk[] = [];
          for await (const chunk of chatService.stream(testMessages)) {
            chunks.push(chunk);
          }
          return { index, result: 'completed', chunks };
        } catch (error) {
          return { index, result: 'cancelled', error: error.message };
        }
      });

      // Start all streams, then cancel after a short delay
      setTimeout(() => chatService.cancel(), 15);

      const results = await Promise.all(streamPromises);

      // Only one stream should complete, others should be cancelled
      const completed = results.filter(r => r.result === 'completed');
      const cancelled = results.filter(r => r.result === 'cancelled');

      expect(completed.length).toBeLessThanOrEqual(1);
      expect(cancelled.length).toBeGreaterThanOrEqual(2);
      expect(chatService.isStreaming()).toBe(false);
    });
  });

  // ============================================================================
  // Abort Signal Propagation Tests
  // ============================================================================

  describe('abort signal propagation', () => {
    it('should propagate abort signal from UI to transport layer', async () => {
      const controller = new AbortController();
      const options: StreamOptions = { signal: controller.signal };

      const streamPromise = (async () => {
        const chunks: StreamChunk[] = [];
        for await (const chunk of chatService.stream(testMessages, options)) {
          chunks.push(chunk);
          if (chunks.length === 1) {
            // Cancel from UI level
            controller.abort();
          }
        }
        return chunks;
      })();

      await expect(streamPromise).rejects.toThrow(/cancelled/i);

      // Verify cancellation propagated through all layers
      const transportStats = mockTransport.getStats();
      const providerStats = mockProvider.getStats();

      expect(transportStats.cancelledCount).toBeGreaterThan(0);
      expect(providerStats.streamCancelCount).toBeGreaterThan(0);
      expect(mockTransport.getActiveRequestCount()).toBe(0);
      expect(mockProvider.getActiveStreamCount()).toBe(0);
    });

    it('should handle cancellation at transport layer', async () => {
      // Create a transport that cancels itself
      const autoCanelTransport = new MockStreamingTransport();
      const autoCanelProvider = new MockStreamingProvider(autoCanelTransport);
      const autoCanelService = createChatService(autoCanelProvider, autoCanelTransport);

      // Override stream method to auto-cancel after first chunk
      const originalStream = autoCanelTransport.stream.bind(autoCanelTransport);
      autoCanelTransport.stream = async function* (request: TransportRequest) {
        let chunkCount = 0;
        for await (const chunk of originalStream(request)) {
          yield chunk;
          chunkCount++;
          if (chunkCount === 1) {
            // Simulate transport-level cancellation
            request.signal?.dispatchEvent(new Event('abort'));
            throw new Error('Transport stream was cancelled');
          }
        }
      };

      await expect(async () => {
        for await (const chunk of autoCanelService.stream(testMessages)) {
          // Should not complete
        }
      }).rejects.toThrow(/cancelled/i);
    });

    it('should handle cascading cancellation from provider to transport', async () => {
      // Create a provider that cancels during streaming
      const cascadingProvider = new MockStreamingProvider(mockTransport);
      const cascadingService = createChatService(cascadingProvider, mockTransport);

      // Override provider to cancel after first chunk
      const originalStreamChat = cascadingProvider.streamChat.bind(cascadingProvider);
      cascadingProvider.streamChat = async function* (messages, config) {
        let chunkCount = 0;
        for await (const chunk of originalStreamChat(messages, config)) {
          yield chunk;
          chunkCount++;
          if (chunkCount === 1) {
            // Provider-level cancellation should cascade to transport
            const signal = config?.signal as AbortSignal;
            if (signal) {
              signal.dispatchEvent(new Event('abort'));
            }
            throw new Error('Provider stream was cancelled');
          }
        }
      };

      await expect(async () => {
        for await (const chunk of cascadingService.stream(testMessages)) {
          // Should not complete
        }
      }).rejects.toThrow(/cancelled/i);

      // Verify cascading effect
      expect(mockTransport.getStats().cancelledCount).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Cancellation Timing Tests
  // ============================================================================

  describe('cancellation timing', () => {
    it('should cancel before first chunk', async () => {
      const controller = new AbortController();
      const options: StreamOptions = { signal: controller.signal };

      // Cancel immediately
      controller.abort();

      await expect(async () => {
        for await (const chunk of chatService.stream(testMessages, options)) {
          // Should never reach here
        }
      }).rejects.toThrow(/cancelled/i);

      // No chunks should be processed
      const transportStats = mockTransport.getStats();
      expect(transportStats.streamCount).toBe(0);
    });

    it('should cancel after first chunk', async () => {
      let cancelledAfterChunk = false;

      const streamPromise = (async () => {
        const chunks: StreamChunk[] = [];
        for await (const chunk of chatService.stream(testMessages)) {
          chunks.push(chunk);
          if (chunks.length === 1) {
            chatService.cancel();
            cancelledAfterChunk = true;
          }
        }
        return chunks;
      })();

      await expect(streamPromise).rejects.toThrow(/cancelled/i);
      expect(cancelledAfterChunk).toBe(true);
    });

    it('should cancel mid-stream', async () => {
      const controller = new AbortController();
      const options: StreamOptions = { signal: controller.signal };

      let chunkCount = 0;
      const streamPromise = (async () => {
        const chunks: StreamChunk[] = [];
        for await (const chunk of chatService.stream(testMessages, options)) {
          chunks.push(chunk);
          chunkCount++;

          // Cancel after 2 chunks
          if (chunkCount === 2) {
            controller.abort();
          }
        }
        return chunks;
      })();

      await expect(streamPromise).rejects.toThrow(/cancelled/i);
      expect(chunkCount).toBeGreaterThan(0);
      expect(chunkCount).toBeLessThan(4); // Should not complete all chunks
    });

    it('should handle late cancellation (after stream completion)', async () => {
      const controller = new AbortController();
      const options: StreamOptions = { signal: controller.signal };

      // Let stream complete first
      const chunks: StreamChunk[] = [];
      for await (const chunk of chatService.stream(testMessages, options)) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);

      // Late cancellation should be safe
      expect(() => controller.abort()).not.toThrow();
      expect(() => chatService.cancel()).not.toThrow();
    });
  });

  // ============================================================================
  // Resource Cleanup Tests
  // ============================================================================

  describe('resource cleanup', () => {
    it('should clean up resources after successful cancellation', async () => {
      const streamPromise = (async () => {
        const chunks: StreamChunk[] = [];
        for await (const chunk of chatService.stream(testMessages)) {
          chunks.push(chunk);
          if (chunks.length === 1) {
            chatService.cancel();
          }
        }
        return chunks;
      })();

      await expect(streamPromise).rejects.toThrow(/cancelled/i);

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify all resources are cleaned up
      expect(chatService.isStreaming()).toBe(false);
      expect(mockTransport.getActiveRequestCount()).toBe(0);
      expect(mockProvider.getActiveStreamCount()).toBe(0);
    });

    it('should clean up resources after failed cancellation', async () => {
      // Create a provider that throws during cancellation cleanup
      const faultyProvider = new MockStreamingProvider(mockTransport);
      const faultyService = createChatService(faultyProvider, mockTransport);

      const originalCancel = faultyService.cancel.bind(faultyService);
      faultyService.cancel = () => {
        try {
          originalCancel();
        } catch {
          // Simulate cancellation failure
        }
      };

      const streamPromise = (async () => {
        const chunks: StreamChunk[] = [];
        for await (const chunk of faultyService.stream(testMessages)) {
          chunks.push(chunk);
          if (chunks.length === 1) {
            faultyService.cancel();
          }
        }
        return chunks;
      })();

      // Even if cancellation throws, resources should be cleaned up
      await expect(streamPromise).rejects.toThrow();

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 50));

      // Verify cleanup despite errors
      expect(mockTransport.getActiveRequestCount()).toBe(0);
    });

    it('should handle cleanup of multiple cancelled streams', async () => {
      const streams = Array.from({ length: 5 }, () => {
        return (async () => {
          try {
            const chunks: StreamChunk[] = [];
            for await (const chunk of chatService.stream(testMessages)) {
              chunks.push(chunk);
            }
            return chunks;
          } catch {
            return 'cancelled';
          }
        })();
      });

      // Let streams start, then cancel all
      setTimeout(() => chatService.cancel(), 15);

      await Promise.all(streams);

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 50));

      // All resources should be cleaned up
      expect(chatService.isStreaming()).toBe(false);
      expect(mockTransport.getActiveRequestCount()).toBe(0);
      expect(mockProvider.getActiveStreamCount()).toBe(0);
    });

    it('should not leak memory with repeated cancellations', async () => {
      // Perform many cancellation cycles
      for (let i = 0; i < 50; i++) {
        const streamPromise = (async () => {
          const chunks: StreamChunk[] = [];
          for await (const chunk of chatService.stream(testMessages)) {
            chunks.push(chunk);
            // Cancel after first chunk to ensure stream starts
            if (chunks.length === 1) {
              chatService.cancel();
            }
          }
          return chunks;
        })();

        await expect(streamPromise).rejects.toThrow();
      }

      // Wait for all cleanup
      await new Promise(resolve => setTimeout(resolve, 100));

      // No resources should be leaking
      expect(chatService.isStreaming()).toBe(false);
      expect(mockTransport.getActiveRequestCount()).toBe(0);
      expect(mockProvider.getActiveStreamCount()).toBe(0);
    });
  });

  // ============================================================================
  // Multiple Rapid Cancellation Tests
  // ============================================================================

  describe('multiple rapid cancellations', () => {
    it('should handle rapid successive cancel calls', async () => {
      const streamPromise = (async () => {
        const chunks: StreamChunk[] = [];
        for await (const chunk of chatService.stream(testMessages)) {
          chunks.push(chunk);
          if (chunks.length === 1) {
            // Rapid fire cancellation
            chatService.cancel();
            chatService.cancel();
            chatService.cancel();
          }
        }
        return chunks;
      })();

      await expect(streamPromise).rejects.toThrow(/cancelled/i);
      expect(chatService.isStreaming()).toBe(false);
    });

    it('should handle rapid stream start/cancel cycles', async () => {
      const results: Array<'completed' | 'cancelled'> = [];

      // Start multiple streams with rapid cancellations
      for (let i = 0; i < 10; i++) {
        const streamPromise = (async () => {
          try {
            const chunks: StreamChunk[] = [];
            for await (const chunk of chatService.stream(testMessages)) {
              chunks.push(chunk);
            }
            return 'completed';
          } catch {
            return 'cancelled';
          }
        })();

        // Cancel almost immediately
        setTimeout(() => chatService.cancel(), 1);

        const result = await streamPromise;
        results.push(result);
      }

      // Most should be cancelled
      const cancelledCount = results.filter(r => r === 'cancelled').length;
      expect(cancelledCount).toBeGreaterThan(5);
      expect(chatService.isStreaming()).toBe(false);
    });

    it('should handle concurrent controllers cancelling simultaneously', async () => {
      const controllers = Array.from({ length: 5 }, () => new AbortController());

      const streamPromises = controllers.map(async (controller, index) => {
        try {
          const options: StreamOptions = { signal: controller.signal };
          const chunks: StreamChunk[] = [];
          for await (const chunk of chatService.stream(testMessages, options)) {
            chunks.push(chunk);

            // Each controller cancels itself after different delays
            if (chunks.length === 1) {
              setTimeout(() => controller.abort(), index * 5);
            }
          }
          return 'completed';
        } catch {
          return 'cancelled';
        }
      });

      const results = await Promise.all(streamPromises);

      // Most should be cancelled due to overlapping streams
      const cancelledCount = results.filter(r => r === 'cancelled').length;
      expect(cancelledCount).toBeGreaterThan(0);
      expect(chatService.isStreaming()).toBe(false);
    });
  });

  // ============================================================================
  // Error Handling During Cancellation Tests
  // ============================================================================

  describe('cancellation error handling', () => {
    it('should handle transport errors during cancellation', async () => {
      // Create a transport that throws during cancellation
      const errorTransport = new MockStreamingTransport();
      const errorProvider = new MockStreamingProvider(errorTransport);
      const errorService = createChatService(errorProvider, errorTransport);

      // Override stream to throw during cancellation
      const originalStream = errorTransport.stream.bind(errorTransport);
      errorTransport.stream = async function* (request: TransportRequest) {
        const signal = request.signal;
        if (signal) {
          signal.addEventListener('abort', () => {
            throw new Error('Transport cancellation error');
          });
        }

        for await (const chunk of originalStream(request)) {
          yield chunk;
        }
      };

      const streamPromise = (async () => {
        const chunks: StreamChunk[] = [];
        for await (const chunk of errorService.stream(testMessages)) {
          chunks.push(chunk);
          if (chunks.length === 1) {
            errorService.cancel();
          }
        }
        return chunks;
      })();

      // Should still handle cancellation despite transport errors
      await expect(streamPromise).rejects.toThrow();
      expect(errorService.isStreaming()).toBe(false);
    });

    it('should handle provider errors during cancellation', async () => {
      // Create a provider that throws during cancellation
      const errorProvider = new MockStreamingProvider(mockTransport);
      const errorService = createChatService(errorProvider, mockTransport);

      // Override stream to throw on cancellation
      const originalStreamChat = errorProvider.streamChat.bind(errorProvider);
      errorProvider.streamChat = async function* (messages, config) {
        const signal = config?.signal as AbortSignal;
        if (signal) {
          signal.addEventListener('abort', () => {
            throw new Error('Provider cancellation error');
          });
        }

        for await (const chunk of originalStreamChat(messages, config)) {
          yield chunk;
        }
      };

      const streamPromise = (async () => {
        const chunks: StreamChunk[] = [];
        for await (const chunk of errorService.stream(testMessages)) {
          chunks.push(chunk);
          if (chunks.length === 1) {
            errorService.cancel();
          }
        }
        return chunks;
      })();

      await expect(streamPromise).rejects.toThrow();
      expect(errorService.isStreaming()).toBe(false);
    });

    it('should gracefully handle cancellation of already errored streams', async () => {
      // Create a provider that errors during normal streaming
      const errorProvider = new MockStreamingProvider(mockTransport);
      const errorService = createChatService(errorProvider, mockTransport);

      errorProvider.streamChat = vi.fn().mockImplementation(async function* () {
        yield createTestStreamChunk('Hello');
        throw new Error('Stream error during normal operation');
      });

      const streamPromise = (async () => {
        const chunks: StreamChunk[] = [];
        for await (const chunk of errorService.stream(testMessages)) {
          chunks.push(chunk);

          // Try to cancel after first chunk, but stream will error
          if (chunks.length === 1) {
            setTimeout(() => errorService.cancel(), 5);
          }
        }
        return chunks;
      })();

      // Should handle both the stream error and cancellation
      await expect(streamPromise).rejects.toThrow();

      // Service should be in clean state
      expect(errorService.isStreaming()).toBe(false);
    });

    it('should handle network timeouts during cancellation', async () => {
      // Create a slow transport that gets cancelled
      const slowTransport = new MockStreamingTransport();
      const slowProvider = new MockStreamingProvider(slowTransport);
      const slowService = createChatService(slowProvider, slowTransport);

      // Override to be very slow
      const originalStream = slowTransport.stream.bind(slowTransport);
      slowTransport.stream = async function* (request: TransportRequest) {
        // First chunk is slow
        await new Promise(resolve => setTimeout(resolve, 200));

        if (request.signal?.aborted) {
          throw new Error('Transport stream was cancelled');
        }

        yield new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Slow"}}]}\n\n');

        // Second chunk would be even slower, but should be cancelled
        await new Promise(resolve => setTimeout(resolve, 1000));
        yield new TextEncoder().encode('data: [DONE]\n\n');
      };

      const streamPromise = (async () => {
        const chunks: StreamChunk[] = [];
        for await (const chunk of slowService.stream(testMessages)) {
          chunks.push(chunk);
        }
        return chunks;
      })();

      // Cancel after short delay (before first chunk arrives)
      setTimeout(() => slowService.cancel(), 50);

      await expect(streamPromise).rejects.toThrow(/cancelled/i);
      expect(slowService.isStreaming()).toBe(false);
    });
  });

  // ============================================================================
  // Edge Cases and Complex Scenarios
  // ============================================================================

  describe('edge cases and complex scenarios', () => {
    it('should handle cancellation during provider switching', async () => {
      const newProvider = new MockStreamingProvider(mockTransport);

      const streamPromise = (async () => {
        const chunks: StreamChunk[] = [];
        for await (const chunk of chatService.stream(testMessages)) {
          chunks.push(chunk);
          if (chunks.length === 1) {
            // Switch provider mid-stream (this should cancel current stream)
            chatService.setProvider(newProvider);
          }
        }
        return chunks;
      })();

      await expect(streamPromise).rejects.toThrow();
      expect(chatService.getProvider()).toBe(newProvider);
      expect(chatService.isStreaming()).toBe(false);
    });

    it('should handle cancellation with custom abort reasons', async () => {
      const controller = new AbortController();
      const options: StreamOptions = { signal: controller.signal };

      const streamPromise = (async () => {
        const chunks: StreamChunk[] = [];
        for await (const chunk of chatService.stream(testMessages, options)) {
          chunks.push(chunk);
          if (chunks.length === 1) {
            // Abort with custom reason
            controller.abort('Custom cancellation reason');
          }
        }
        return chunks;
      })();

      await expect(streamPromise).rejects.toThrow(/cancelled/i);

      // Signal should be aborted with reason
      expect(controller.signal.aborted).toBe(true);
      if ('reason' in controller.signal) {
        expect(controller.signal.reason).toBe('Custom cancellation reason');
      }
    });

    it('should handle cancellation in nested stream processing', async () => {
      // Simulate nested processing where inner cancellation affects outer stream
      const outerController = new AbortController();
      const innerController = new AbortController();

      // Link controllers
      outerController.signal.addEventListener('abort', () => {
        innerController.abort();
      });

      const options: StreamOptions = { signal: outerController.signal };

      const streamPromise = (async () => {
        const chunks: StreamChunk[] = [];
        for await (const chunk of chatService.stream(testMessages, options)) {
          chunks.push(chunk);

          // Simulate inner processing that gets cancelled
          if (chunks.length === 1) {
            await new Promise((resolve, reject) => {
              const timeout = setTimeout(resolve, 100);
              innerController.signal.addEventListener('abort', () => {
                clearTimeout(timeout);
                reject(new Error('Inner processing cancelled'));
              });
            }).catch(() => {
              // Inner processing was cancelled, cancel outer
              outerController.abort();
            });
          }
        }
        return chunks;
      })();

      // Cancel the inner controller
      setTimeout(() => innerController.abort(), 20);

      await expect(streamPromise).rejects.toThrow(/cancelled/i);
      expect(outerController.signal.aborted).toBe(true);
      expect(innerController.signal.aborted).toBe(true);
    });

    it('should handle cancellation during error recovery', async () => {
      // Create a provider that retries on errors
      const retryProvider = new MockStreamingProvider(mockTransport);
      const retryService = createChatService(retryProvider, mockTransport);

      let attemptCount = 0;
      const originalStreamChat = retryProvider.streamChat.bind(retryProvider);
      retryProvider.streamChat = async function* (messages, config) {
        attemptCount++;
        if (attemptCount === 1) {
          // First attempt fails
          throw new Error('First attempt failed');
        } else {
          // Second attempt succeeds but gets cancelled
          for await (const chunk of originalStreamChat(messages, config)) {
            yield chunk;
          }
        }
      };

      const streamPromise = (async () => {
        const chunks: StreamChunk[] = [];

        try {
          for await (const chunk of retryService.stream(testMessages)) {
            chunks.push(chunk);
          }
        } catch (error) {
          // Simulate retry logic
          if (error.message === 'First attempt failed') {
            // Retry, but cancel during retry
            setTimeout(() => retryService.cancel(), 10);

            for await (const chunk of retryService.stream(testMessages)) {
              chunks.push(chunk);
            }
          } else {
            throw error;
          }
        }

        return chunks;
      })();

      await expect(streamPromise).rejects.toThrow(/cancelled/i);
      expect(attemptCount).toBe(2); // Should have attempted retry
      expect(retryService.isStreaming()).toBe(false);
    });
  });

  // ============================================================================
  // Performance and Resource Management Tests
  // ============================================================================

  describe('performance and resource management', () => {
    it('should efficiently cancel large numbers of concurrent streams', async () => {
      const startTime = Date.now();
      const streamCount = 100;

      const streamPromises = Array.from({ length: streamCount }, async (_, index) => {
        try {
          const chunks: StreamChunk[] = [];
          for await (const chunk of chatService.stream(testMessages)) {
            chunks.push(chunk);
          }
          return 'completed';
        } catch {
          return 'cancelled';
        }
      });

      // Cancel all streams quickly
      setTimeout(() => chatService.cancel(), 10);

      const results = await Promise.all(streamPromises);
      const duration = Date.now() - startTime;

      // Should complete quickly even with many streams
      expect(duration).toBeLessThan(1000);

      // Most should be cancelled
      const cancelledCount = results.filter(r => r === 'cancelled').length;
      expect(cancelledCount).toBeGreaterThan(streamCount * 0.8);

      // All resources should be cleaned up
      expect(chatService.isStreaming()).toBe(false);
      expect(mockTransport.getActiveRequestCount()).toBe(0);
      expect(mockProvider.getActiveStreamCount()).toBe(0);
    });

    it('should handle memory pressure during cancellation', async () => {
      // Simulate memory pressure by creating many objects
      const largeObjects: Array<{ data: Uint8Array }> = [];

      // Create memory pressure
      for (let i = 0; i < 1000; i++) {
        largeObjects.push({ data: new Uint8Array(1024) });
      }

      const streamPromise = (async () => {
        const chunks: StreamChunk[] = [];
        for await (const chunk of chatService.stream(testMessages)) {
          chunks.push(chunk);
          if (chunks.length === 1) {
            // Cancel under memory pressure
            chatService.cancel();
          }
        }
        return chunks;
      })();

      await expect(streamPromise).rejects.toThrow(/cancelled/i);

      // Should still clean up properly under memory pressure
      expect(chatService.isStreaming()).toBe(false);

      // Clean up test objects
      largeObjects.length = 0;
    });

    it('should maintain consistent performance across multiple cancellation cycles', async () => {
      const cycleTimes: number[] = [];

      for (let cycle = 0; cycle < 20; cycle++) {
        const startTime = Date.now();

        const streamPromise = (async () => {
          const chunks: StreamChunk[] = [];
          for await (const chunk of chatService.stream(testMessages)) {
            chunks.push(chunk);
            if (chunks.length === 1) {
              chatService.cancel();
            }
          }
          return chunks;
        })();

        await expect(streamPromise).rejects.toThrow(/cancelled/i);

        const cycleTime = Date.now() - startTime;
        cycleTimes.push(cycleTime);

        // Brief pause between cycles
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Performance should remain consistent (no significant degradation)
      const averageTime = cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length;
      const maxTime = Math.max(...cycleTimes);

      expect(averageTime).toBeLessThan(200);
      expect(maxTime).toBeLessThan(500);

      // No performance degradation over time
      const firstHalf = cycleTimes.slice(0, 10);
      const secondHalf = cycleTimes.slice(10);
      const firstHalfAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

      // Second half should not be significantly slower (within 50% tolerance)
      expect(secondHalfAvg).toBeLessThan(firstHalfAvg * 1.5);
    });
  });
});
