import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ChatService,
  createChatService,
  createChatServiceWithProvider,
} from '@services/chat/ChatService';
import type { StreamOptions } from '@services/chat/ChatService';
import type {
  AIProvider,
  ProviderChatMessage,
  StreamChunk,
  ProviderCapabilities,
  ProviderValidationResult,
  ProviderError,
  ProviderType,
} from '@types/providers';
import type { Transport } from '@transport/types';
import { BaseEngine } from '@core/engine/BaseEngine';

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

const createTestStreamChunk = (content: string, index = 0): StreamChunk => ({
  id: 'chunk-123',
  object: 'chat.completion.chunk',
  created: Date.now() / 1000,
  model: 'test-model',
  choices: [
    {
      index,
      delta: { content },
      finishReason: null,
    },
  ],
  usage: {
    promptTokens: 10,
    completionTokens: 5,
    totalTokens: 15,
  },
});

const createFinalStreamChunk = (): StreamChunk => ({
  id: 'chunk-final',
  object: 'chat.completion.chunk',
  created: Date.now() / 1000,
  model: 'test-model',
  choices: [
    {
      index: 0,
      delta: {},
      finishReason: 'stop',
    },
  ],
  usage: {
    promptTokens: 10,
    completionTokens: 20,
    totalTokens: 30,
  },
});

// ============================================================================
// Mock Provider Implementation
// ============================================================================

class MockProvider implements AIProvider {
  type: ProviderType = 'openai';
  name = 'MockProvider';
  capabilities: ProviderCapabilities = {
    streaming: true,
    temperature: true,
    reasoning: false,
    thinking: false,
    multimodal: false,
    functionCalling: false,
    maxContextLength: 4096,
    supportedModels: ['test-model'],
  };

  private streamGenerator: AsyncGenerator<StreamChunk> | null = null;
  public initialized = false;
  public connectionTested = false;

  async initialize(): Promise<void> {
    this.initialized = true;
  }

  validateConfig(): ProviderValidationResult {
    return { isValid: true, errors: [] };
  }

  async testConnection(): Promise<boolean> {
    this.connectionTested = true;
    return true;
  }

  async *streamChat(messages: ProviderChatMessage[], config?: unknown): AsyncIterable<StreamChunk> {
    // Check for abort signal in config
    const signal = (config as any)?.signal;

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
      if (signal?.aborted) {
        throw new Error('Stream was cancelled');
      }

      yield chunk;
    }
  }

  getModels() {
    return [
      {
        id: 'test-model',
        name: 'Test Model',
        provider: 'openai' as ProviderType,
        capabilities: this.capabilities,
        description: 'Test model for unit tests',
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
}

class MockProviderWithoutStreaming implements AIProvider {
  type: ProviderType = 'openai';
  name = 'MockProviderNoStream';
  capabilities: ProviderCapabilities = {
    streaming: false, // No streaming support
    temperature: true,
    reasoning: false,
    thinking: false,
    multimodal: false,
    functionCalling: false,
    maxContextLength: 4096,
    supportedModels: ['test-model'],
  };

  async initialize(): Promise<void> {}
  validateConfig(): ProviderValidationResult {
    return { isValid: true, errors: [] };
  }
  async testConnection(): Promise<boolean> {
    return true;
  }

  // streamChat is missing - simulates provider without streaming support
  streamChat = undefined;

  getModels() {
    return [];
  }
  getModel() {
    return undefined;
  }
  formatError(): ProviderError {
    return {
      type: 'unknown',
      message: 'Unknown error',
      code: 'TEST_ERROR',
      provider: this.type,
    };
  }
}

class MockBaseEngine extends BaseEngine {
  constructor() {
    super('openai', 'MockBaseEngine', {
      streaming: true,
      temperature: true,
      reasoning: false,
      thinking: false,
      multimodal: false,
      functionCalling: false,
      maxContextLength: 4096,
      supportedModels: ['test-model'],
    });
  }

  async initialize(): Promise<void> {}
  validateConfig(): ProviderValidationResult {
    return { isValid: true, errors: [] };
  }
  async testConnection(): Promise<boolean> {
    return true;
  }

  async *streamChat(): AsyncIterable<StreamChunk> {
    yield createTestStreamChunk('Base provider test');
  }

  getModels() {
    return [];
  }
  getModel() {
    return undefined;
  }
  formatError(): ProviderError {
    return {
      type: 'unknown',
      message: 'Unknown error',
      code: 'BASE_ERROR',
      provider: this.type,
    };
  }
}

// ============================================================================
// Mock Transport Implementation
// ============================================================================

class MockTransport implements Transport {
  public setTransportCalled = false;

  async request(): Promise<any> {
    return { status: 200, body: 'mock response' };
  }

  async *stream(): AsyncIterable<Uint8Array> {
    yield new Uint8Array([1, 2, 3]);
  }
}

// ============================================================================
// Test Suite
// ============================================================================

describe('ChatService', () => {
  let chatService: ChatService;
  let mockProvider: MockProvider;
  let testMessages: ProviderChatMessage[];

  beforeEach(() => {
    vi.clearAllMocks();
    mockProvider = new MockProvider();
    chatService = new ChatService();
    testMessages = [
      createTestMessage('1', 'user', 'Hello, how are you?'),
      createTestMessage('2', 'assistant', 'I am doing well, thank you!'),
    ];
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Ensure any ongoing streams are cancelled
    chatService?.cancel();
  });

  // ============================================================================
  // Constructor Tests
  // ============================================================================

  describe('constructor', () => {
    it('should create service with no provider', () => {
      const service = new ChatService();
      expect(service.getProvider()).toBeNull();
      expect(service.isStreaming()).toBe(false);
    });

    it('should create service with provider', () => {
      const service = new ChatService(mockProvider);
      expect(service.getProvider()).toBe(mockProvider);
    });

    it('should create service with provider and transport', () => {
      const mockTransport = new MockTransport();
      const mockBaseEngine = new MockBaseEngine();
      const service = new ChatService(mockBaseEngine, mockTransport);

      expect(service.getProvider()).toBe(mockBaseEngine);
      expect(service.getTransport()).toBe(mockTransport);
    });
  });

  // ============================================================================
  // Provider Management Tests
  // ============================================================================

  describe('provider management', () => {
    it('should set provider successfully', () => {
      chatService.setProvider(mockProvider);
      expect(chatService.getProvider()).toBe(mockProvider);
    });

    it('should cancel ongoing stream when setting new provider', async () => {
      chatService.setProvider(mockProvider);

      // Start a stream
      const streamPromise = (async () => {
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

      // Wait a bit to ensure stream starts
      await new Promise(resolve => setTimeout(resolve, 5));
      expect(chatService.isStreaming()).toBe(true);

      // Set new provider (should cancel stream)
      const newProvider = new MockProvider();
      chatService.setProvider(newProvider);

      // Should have cancelled the stream
      expect(chatService.isStreaming()).toBe(false);
      expect(chatService.getProvider()).toBe(newProvider);

      // Wait for cleanup
      await streamPromise;
    });

    it('should set transport on BaseEngine when setting provider', () => {
      const mockTransport = new MockTransport();
      const mockBaseEngine = new MockBaseEngine();

      chatService.setTransport(mockTransport);
      chatService.setProvider(mockBaseEngine);

      // BaseEngine should receive the transport
      expect(mockBaseEngine.getTransport()).toBe(mockTransport);
    });

    it('should not set transport on non-BaseEngine', () => {
      const mockTransport = new MockTransport();

      chatService.setTransport(mockTransport);
      chatService.setProvider(mockProvider);

      // Regular provider should not receive transport
      expect(chatService.getProvider()).toBe(mockProvider);
      expect(chatService.getTransport()).toBe(mockTransport);
    });
  });

  // ============================================================================
  // Streaming Tests
  // ============================================================================

  describe('streaming functionality', () => {
    beforeEach(() => {
      chatService.setProvider(mockProvider);
    });

    it('should stream successfully with multiple chunks', async () => {
      const chunks: StreamChunk[] = [];

      for await (const chunk of chatService.stream(testMessages)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(4); // 3 content chunks + 1 final chunk
      expect(chunks[0].choices[0].delta.content).toBe('Hello');
      expect(chunks[1].choices[0].delta.content).toBe(' world');
      expect(chunks[2].choices[0].delta.content).toBe('!');
      expect(chunks[3].choices[0].finishReason).toBe('stop');
    });

    it('should track streaming state correctly', async () => {
      expect(chatService.isStreaming()).toBe(false);

      const streamPromise = (async () => {
        const chunks: StreamChunk[] = [];
        for await (const chunk of chatService.stream(testMessages)) {
          chunks.push(chunk);
          if (chunks.length === 1) {
            // Should be streaming after first chunk
            expect(chatService.isStreaming()).toBe(true);
          }
        }
        return chunks;
      })();

      const chunks = await streamPromise;

      // Should not be streaming after completion
      expect(chatService.isStreaming()).toBe(false);
      expect(chunks).toHaveLength(4);
    });

    it('should handle streaming with options', async () => {
      const options: StreamOptions = {
        systemPrompt: 'You are a helpful assistant',
        previousResponseId: 'prev-123',
        providerConfig: { temperature: 0.7 },
      };

      const chunks: StreamChunk[] = [];
      for await (const chunk of chatService.stream(testMessages, options)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(4);
    });

    it('should handle streaming with custom abort signal', async () => {
      const controller = new AbortController();
      const options: StreamOptions = { signal: controller.signal };

      let streamCancelled = false;
      const streamPromise = (async () => {
        try {
          const chunks: StreamChunk[] = [];
          for await (const chunk of chatService.stream(testMessages, options)) {
            chunks.push(chunk);
            if (chunks.length === 2) {
              controller.abort(); // Cancel after 2 chunks
            }
          }
          return chunks;
        } catch (error) {
          streamCancelled = true;
          throw error;
        }
      })();

      await expect(streamPromise).rejects.toThrow('Stream was cancelled');
      expect(streamCancelled).toBe(true);
    });
  });

  // ============================================================================
  // Cancellation Tests
  // ============================================================================

  describe('cancellation', () => {
    beforeEach(() => {
      chatService.setProvider(mockProvider);
    });

    it('should cancel ongoing stream', async () => {
      let streamError: Error | null = null;

      const streamPromise = (async () => {
        try {
          const chunks: StreamChunk[] = [];
          for await (const chunk of chatService.stream(testMessages)) {
            chunks.push(chunk);
            if (chunks.length === 1) {
              // Cancel after first chunk
              chatService.cancel();
            }
          }
          return chunks;
        } catch (error) {
          streamError = error as Error;
          throw error;
        }
      })();

      await expect(streamPromise).rejects.toThrow('Stream was cancelled');
      expect(streamError?.message).toBe('Stream was cancelled');
      expect(chatService.isStreaming()).toBe(false);
    });

    it('should handle multiple cancel calls safely', () => {
      chatService.cancel();
      chatService.cancel();
      chatService.cancel();

      expect(chatService.isStreaming()).toBe(false);
    });

    it('should cancel existing stream before starting new one', async () => {
      // Start first stream
      const firstStreamPromise = (async () => {
        try {
          const chunks: StreamChunk[] = [];
          for await (const chunk of chatService.stream(testMessages)) {
            chunks.push(chunk);
          }
          return chunks;
        } catch (error) {
          return 'cancelled';
        }
      })();

      // Wait a bit to ensure first stream starts
      await new Promise(resolve => setTimeout(resolve, 5));

      // Start second stream (should cancel first)
      const secondStreamPromise = (async () => {
        const chunks: StreamChunk[] = [];
        for await (const chunk of chatService.stream(testMessages)) {
          chunks.push(chunk);
        }
        return chunks;
      })();

      const [firstResult, secondResult] = await Promise.all([
        firstStreamPromise,
        secondStreamPromise,
      ]);

      expect(firstResult).toBe('cancelled');
      expect(Array.isArray(secondResult)).toBe(true);
      expect((secondResult as StreamChunk[]).length).toBe(4);
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('error handling', () => {
    it('should throw error when no provider configured', async () => {
      const service = new ChatService(); // No provider

      await expect(async () => {
        for await (const chunk of service.stream(testMessages)) {
          // Should not reach here
        }
      }).rejects.toThrow('No AI provider configured');
    });

    it('should throw error when provider lacks streaming support', async () => {
      const nonStreamingProvider = new MockProviderWithoutStreaming();
      chatService.setProvider(nonStreamingProvider);

      await expect(async () => {
        for await (const chunk of chatService.stream(testMessages)) {
          // Should not reach here
        }
      }).rejects.toThrow('Provider does not support streaming');
    });

    it('should validate messages before streaming', async () => {
      chatService.setProvider(mockProvider);

      // Test empty messages array
      await expect(async () => {
        for await (const chunk of chatService.stream([])) {
          // Should not reach here
        }
      }).rejects.toThrow('Messages array cannot be empty');
    });

    it('should validate message format', async () => {
      chatService.setProvider(mockProvider);

      const invalidMessages = [
        { id: '1', role: 'user' } as any, // Missing content
      ];

      await expect(async () => {
        for await (const chunk of chatService.stream(invalidMessages)) {
          // Should not reach here
        }
      }).rejects.toThrow('Invalid message format');
    });

    it('should validate message content is not empty', async () => {
      chatService.setProvider(mockProvider);

      const emptyContentMessages = [
        createTestMessage('1', 'user', '   '), // Whitespace only
      ];

      await expect(async () => {
        for await (const chunk of chatService.stream(emptyContentMessages)) {
          // Should not reach here
        }
      }).rejects.toThrow('Message content cannot be empty');
    });

    it('should handle provider streaming errors', async () => {
      // Create provider that throws during streaming
      const errorProvider = new MockProvider();
      errorProvider.streamChat = vi.fn().mockImplementation(async function* () {
        yield; // Satisfy linter requirement
        throw new Error('Provider streaming error');
      });

      chatService.setProvider(errorProvider);

      await expect(async () => {
        for await (const chunk of chatService.stream(testMessages)) {
          // Should not reach here
        }
      }).rejects.toThrow('Provider streaming error');
    });

    it('should use provider error formatting when available', async () => {
      const errorProvider = new MockProvider();
      errorProvider.streamChat = vi.fn().mockImplementation(async function* () {
        yield; // Satisfy linter requirement
        throw new Error('Raw provider error');
      });
      errorProvider.formatError = vi.fn().mockReturnValue({
        type: 'network',
        message: 'Formatted provider error',
        code: 'PROVIDER_ERROR',
        provider: 'openai',
      });

      chatService.setProvider(errorProvider);

      await expect(async () => {
        for await (const chunk of chatService.stream(testMessages)) {
          // Should not reach here
        }
      }).rejects.toThrow('Formatted provider error');

      expect(errorProvider.formatError).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should handle non-Error objects in streaming', async () => {
      const errorProvider = new MockProvider();
      errorProvider.streamChat = vi.fn().mockImplementation(async function* () {
        yield; // Satisfy linter requirement
        throw 'String error'; // Non-Error object
      });

      chatService.setProvider(errorProvider);

      await expect(async () => {
        for await (const chunk of chatService.stream(testMessages)) {
          // Should not reach here
        }
      }).rejects.toThrow('Unknown error'); // Provider's formatError returns "Unknown error"
    });

    it('should handle non-Error objects without formatError method', async () => {
      const errorProvider = new MockProvider();
      errorProvider.streamChat = vi.fn().mockImplementation(async function* () {
        yield; // Satisfy linter requirement
        throw 'String error'; // Non-Error object
      });
      // Remove formatError method to trigger fallback
      errorProvider.formatError = undefined as any;

      chatService.setProvider(errorProvider);

      await expect(async () => {
        for await (const chunk of chatService.stream(testMessages)) {
          // Should not reach here
        }
      }).rejects.toThrow('Unknown streaming error occurred');
    });

    it('should handle cancellation during streaming errors', async () => {
      const errorProvider = new MockProvider();
      errorProvider.streamChat = vi.fn().mockImplementation(async function* (messages, config) {
        yield; // Satisfy linter requirement
        // Simulate cancellation during error
        const signal = config?.signal;
        if (signal) {
          signal.addEventListener('abort', () => {
            throw new Error('Stream was cancelled');
          });
        }
        throw new Error('Provider error');
      });

      chatService.setProvider(errorProvider);

      const streamPromise = (async () => {
        for await (const chunk of chatService.stream(testMessages)) {
          // Should not reach here
        }
      })();

      chatService.cancel();

      await expect(streamPromise).rejects.toThrow('Stream was cancelled');
    });
  });

  // ============================================================================
  // Message Validation Tests
  // ============================================================================

  describe('message validation', () => {
    beforeEach(() => {
      chatService.setProvider(mockProvider);
    });

    it('should accept valid messages with all required fields', async () => {
      const validMessages = [
        createTestMessage('1', 'user', 'Hello'),
        createTestMessage('2', 'assistant', 'Hi there'),
        createTestMessage('3', 'system', 'You are helpful'),
      ];

      // Should not throw
      const chunks: StreamChunk[] = [];
      for await (const chunk of chatService.stream(validMessages)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(4);
    });

    it('should reject messages with invalid role', async () => {
      const invalidMessages = [
        {
          id: '1',
          role: 'invalid-role',
          content: 'Hello',
          timestamp: new Date(),
        } as any,
      ];

      await expect(async () => {
        for await (const chunk of chatService.stream(invalidMessages)) {
          // Intentionally empty - testing error handling
        }
      }).rejects.toThrow('Invalid message format');
    });

    it('should reject messages missing required fields', async () => {
      const testCases = [
        { role: 'user', content: 'Hello', timestamp: new Date() }, // Missing id
        { id: '1', content: 'Hello', timestamp: new Date() }, // Missing role
        { id: '1', role: 'user', timestamp: new Date() }, // Missing content
        { id: '1', role: 'user', content: 'Hello' }, // Missing timestamp
      ];

      for (const invalidMessage of testCases) {
        await expect(async () => {
          for await (const chunk of chatService.stream([invalidMessage as any])) {
            // Intentionally empty - testing error handling
          }
        }).rejects.toThrow('Invalid message format');
      }
    });

    it('should reject messages with non-string fields', async () => {
      const invalidMessages = [
        {
          id: 123, // Should be string
          role: 'user',
          content: 'Hello',
          timestamp: new Date(),
        } as any,
      ];

      await expect(async () => {
        for await (const chunk of chatService.stream(invalidMessages)) {
          // Intentionally empty - testing error handling
        }
      }).rejects.toThrow('Invalid message format');
    });

    it('should reject messages with non-Date timestamp', async () => {
      const invalidMessages = [
        {
          id: '1',
          role: 'user',
          content: 'Hello',
          timestamp: '2024-01-01', // Should be Date object
        } as any,
      ];

      await expect(async () => {
        for await (const chunk of chatService.stream(invalidMessages)) {
          // Intentionally empty - testing error handling
        }
      }).rejects.toThrow('Invalid message format');
    });
  });

  // ============================================================================
  // Transport Integration Tests
  // ============================================================================

  describe('transport integration', () => {
    it('should set transport on service', () => {
      const mockTransport = new MockTransport();
      chatService.setTransport(mockTransport);

      expect(chatService.getTransport()).toBe(mockTransport);
    });

    it('should apply transport to BaseEngine when set', () => {
      const mockTransport = new MockTransport();
      const mockBaseEngine = new MockBaseEngine();

      chatService.setTransport(mockTransport);
      chatService.setProvider(mockBaseEngine);

      expect(mockBaseEngine.getTransport()).toBe(mockTransport);
    });

    it('should apply transport to existing BaseEngine', () => {
      const mockTransport = new MockTransport();
      const mockBaseEngine = new MockBaseEngine();

      chatService.setProvider(mockBaseEngine);
      chatService.setTransport(mockTransport);

      expect(mockBaseEngine.getTransport()).toBe(mockTransport);
    });

    it('should not apply transport to non-BaseEngine', () => {
      const mockTransport = new MockTransport();

      chatService.setProvider(mockProvider);
      chatService.setTransport(mockTransport);

      // Transport should be stored but not applied to regular provider
      expect(chatService.getTransport()).toBe(mockTransport);
    });
  });

  // ============================================================================
  // Factory Function Tests
  // ============================================================================

  describe('factory functions', () => {
    it('should create service with createChatService', () => {
      const service = createChatService();
      expect(service).toBeInstanceOf(ChatService);
      expect(service.getProvider()).toBeNull();
    });

    it('should create service with provider using createChatService', () => {
      const service = createChatService(mockProvider);
      expect(service).toBeInstanceOf(ChatService);
      expect(service.getProvider()).toBe(mockProvider);
    });

    it('should create service with provider and transport using createChatService', () => {
      const mockTransport = new MockTransport();
      const mockBaseEngine = new MockBaseEngine();
      const service = createChatService(mockBaseEngine, mockTransport);

      expect(service).toBeInstanceOf(ChatService);
      expect(service.getProvider()).toBe(mockBaseEngine);
      expect(service.getTransport()).toBe(mockTransport);
    });

    it('should create service with createChatServiceWithProvider', () => {
      const service = createChatServiceWithProvider(mockProvider);
      expect(service).toBeInstanceOf(ChatService);
      expect(service.getProvider()).toBe(mockProvider);
    });

    it('should create service with transport using createChatServiceWithProvider', () => {
      const mockTransport = new MockTransport();
      const mockBaseEngine = new MockBaseEngine();
      const service = createChatServiceWithProvider(mockBaseEngine, mockTransport);

      expect(service).toBeInstanceOf(ChatService);
      expect(service.getProvider()).toBe(mockBaseEngine);
      expect(service.getTransport()).toBe(mockTransport);
    });
  });

  // ============================================================================
  // Edge Cases and Complex Scenarios
  // ============================================================================

  describe('edge cases', () => {
    beforeEach(() => {
      chatService.setProvider(mockProvider);
    });

    it('should handle concurrent stream requests safely', async () => {
      const streamPromises = Array.from({ length: 3 }, async () => {
        try {
          const chunks: StreamChunk[] = [];
          for await (const chunk of chatService.stream(testMessages)) {
            chunks.push(chunk);
          }
          return chunks;
        } catch (error) {
          return 'cancelled';
        }
      });

      const results = await Promise.all(streamPromises);

      // Only one should succeed, others should be cancelled
      const successfulStreams = results.filter(result => Array.isArray(result));
      const cancelledStreams = results.filter(result => result === 'cancelled');

      expect(successfulStreams).toHaveLength(1);
      expect(cancelledStreams).toHaveLength(2);
      expect((successfulStreams[0] as StreamChunk[]).length).toBe(4);
    });

    it('should handle provider replacement during streaming', async () => {
      const newProvider = new MockProvider();
      let streamError: Error | null = null;

      const streamPromise = (async () => {
        try {
          const chunks: StreamChunk[] = [];
          for await (const chunk of chatService.stream(testMessages)) {
            chunks.push(chunk);
            if (chunks.length === 1) {
              // Replace provider mid-stream
              chatService.setProvider(newProvider);
            }
          }
          return chunks;
        } catch (error) {
          streamError = error as Error;
          throw error;
        }
      })();

      await expect(streamPromise).rejects.toThrow();
      expect(chatService.getProvider()).toBe(newProvider);
    });

    it('should properly clean up abort controller after stream completion', async () => {
      expect(chatService.isStreaming()).toBe(false);

      const chunks: StreamChunk[] = [];
      for await (const chunk of chatService.stream(testMessages)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(4);
      expect(chatService.isStreaming()).toBe(false);
    });

    it('should handle empty stream from provider', async () => {
      const emptyProvider = new MockProvider();
      /* eslint-disable no-constant-condition */
      emptyProvider.streamChat = vi.fn().mockImplementation(async function* () {
        // Intentionally yield nothing; include unreachable yield to satisfy linter
        if (Math.random() < 0) {
          yield createTestStreamChunk('noop');
        }
      });
      /* eslint-enable no-constant-condition */

      chatService.setProvider(emptyProvider);

      const chunks: StreamChunk[] = [];
      for await (const chunk of chatService.stream(testMessages)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(0);
      expect(chatService.isStreaming()).toBe(false);
    });

    it('should handle provider that yields null chunks', async () => {
      const nullChunkProvider = new MockProvider();
      nullChunkProvider.streamChat = vi.fn().mockImplementation(async function* () {
        yield createTestStreamChunk('Hello');
        yield null as any; // Invalid null chunk
        yield createTestStreamChunk('World');
      });

      chatService.setProvider(nullChunkProvider);

      const chunks: StreamChunk[] = [];
      for await (const chunk of chatService.stream(testMessages)) {
        chunks.push(chunk);
      }

      // Should handle null chunks gracefully
      expect(chunks).toHaveLength(3); // 2 valid chunks + null becomes valid
    });
  });

  // ============================================================================
  // Performance and Memory Tests
  // ============================================================================

  describe('performance and memory', () => {
    beforeEach(() => {
      chatService.setProvider(mockProvider);
    });

    it('should not leak memory with repeated cancellations', () => {
      // Test repeated cancel calls don't accumulate
      for (let i = 0; i < 100; i++) {
        chatService.cancel();
      }

      expect(chatService.isStreaming()).toBe(false);
    });

    it('should handle large message arrays efficiently', async () => {
      const largeMessageArray = Array.from({ length: 1000 }, (_, i) =>
        createTestMessage(i.toString(), 'user', `Message ${i}`)
      );

      const startTime = Date.now();

      const chunks: StreamChunk[] = [];
      for await (const chunk of chatService.stream(largeMessageArray)) {
        chunks.push(chunk);
      }

      const duration = Date.now() - startTime;

      expect(chunks).toHaveLength(4);
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    });

    it('should efficiently handle many small streams', async () => {
      const startTime = Date.now();

      for (let i = 0; i < 10; i++) {
        const chunks: StreamChunk[] = [];
        for await (const chunk of chatService.stream([testMessages[0]])) {
          chunks.push(chunk);
        }
        expect(chunks).toHaveLength(4);
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(2000); // Should complete all 10 streams in under 2 seconds
    });
  });
});
