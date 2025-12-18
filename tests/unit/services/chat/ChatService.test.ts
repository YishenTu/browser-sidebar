/**
 * @file Chat Service Tests
 *
 * Tests for the ChatService including validation, cancel behavior,
 * formatError propagation, and signal composition.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ChatService,
  createChatService,
  createChatServiceWithProvider,
  type StreamOptions,
} from '@services/chat/ChatService';
import type { AIProvider, ProviderChatMessage, StreamChunk } from '@/types/providers';

// Helper to create mock provider
function createMockProvider(overrides: Partial<AIProvider> = {}): AIProvider {
  return {
    type: 'openai',
    name: 'OpenAI',
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
    initialize: vi.fn().mockResolvedValue(undefined),
    validateConfig: vi.fn().mockReturnValue({ isValid: true, errors: [] }),
    hasRequiredConfig: vi.fn().mockResolvedValue(true),
    streamChat: vi.fn().mockImplementation(async function* () {
      yield createMockChunk('Hello');
      yield createMockChunk(' World');
      yield createMockChunk('', 'stop');
    }),
    getModels: vi.fn().mockReturnValue([]),
    getModel: vi.fn().mockReturnValue(undefined),
    formatError: vi.fn().mockImplementation(error => ({
      type: 'unknown' as const,
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'ERROR',
      provider: 'openai' as const,
    })),
    ...overrides,
  };
}

// Helper to create mock stream chunk
function createMockChunk(content: string, finishReason: string | null = null): StreamChunk {
  return {
    id: 'chunk-1',
    object: 'chat.completion.chunk',
    created: Date.now(),
    model: 'gpt-4',
    choices: [
      {
        index: 0,
        delta: { content },
        finishReason: finishReason as StreamChunk['choices'][0]['finishReason'],
      },
    ],
  };
}

// Helper to create mock message
function createMockMessage(overrides: Partial<ProviderChatMessage> = {}): ProviderChatMessage {
  return {
    id: 'msg-1',
    role: 'user',
    content: 'Hello',
    timestamp: new Date(),
    ...overrides,
  };
}

describe('ChatService', () => {
  let service: ChatService;
  let mockProvider: AIProvider;

  beforeEach(() => {
    mockProvider = createMockProvider();
    service = new ChatService(mockProvider);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create service without provider', () => {
      const emptyService = new ChatService();
      expect(emptyService.getProvider()).toBeNull();
    });

    it('should create service with provider', () => {
      expect(service.getProvider()).toBe(mockProvider);
    });
  });

  describe('setProvider', () => {
    it('should set the provider', () => {
      const newProvider = createMockProvider({ name: 'New Provider' });
      service.setProvider(newProvider);

      expect(service.getProvider()).toBe(newProvider);
    });

    it('should cancel ongoing stream when switching providers', async () => {
      const cancelSpy = vi.spyOn(service, 'cancel');
      service.setProvider(createMockProvider());

      expect(cancelSpy).toHaveBeenCalled();
    });
  });

  describe('getProvider', () => {
    it('should return null when no provider set', () => {
      const emptyService = new ChatService();
      expect(emptyService.getProvider()).toBeNull();
    });

    it('should return the current provider', () => {
      expect(service.getProvider()).toBe(mockProvider);
    });
  });

  describe('stream', () => {
    describe('validation', () => {
      it('should throw when no provider configured', async () => {
        const emptyService = new ChatService();

        await expect(async () => {
          for await (const _ of emptyService.stream([createMockMessage()])) {
            // consume
          }
        }).rejects.toThrow('No AI provider configured');
      });

      it('should throw when provider does not support streaming', async () => {
        const nonStreamingProvider = createMockProvider({ streamChat: undefined });
        service.setProvider(nonStreamingProvider);

        await expect(async () => {
          for await (const _ of service.stream([createMockMessage()])) {
            // consume
          }
        }).rejects.toThrow('Provider does not support streaming');
      });

      it('should throw for empty messages array', async () => {
        await expect(async () => {
          for await (const _ of service.stream([])) {
            // consume
          }
        }).rejects.toThrow('Messages array cannot be empty');
      });

      it('should throw for invalid message format', async () => {
        const invalidMessage = { invalid: 'message' } as unknown as ProviderChatMessage;

        await expect(async () => {
          for await (const _ of service.stream([invalidMessage])) {
            // consume
          }
        }).rejects.toThrow('Invalid message format');
      });

      it('should throw for empty message content', async () => {
        const emptyMessage = createMockMessage({ content: '' });

        await expect(async () => {
          for await (const _ of service.stream([emptyMessage])) {
            // consume
          }
        }).rejects.toThrow('Message content cannot be empty');
      });

      it('should throw for whitespace-only message content', async () => {
        const whitespaceMessage = createMockMessage({ content: '   ' });

        await expect(async () => {
          for await (const _ of service.stream([whitespaceMessage])) {
            // consume
          }
        }).rejects.toThrow('Message content cannot be empty');
      });
    });

    describe('streaming behavior', () => {
      it('should yield chunks from provider', async () => {
        const chunks: StreamChunk[] = [];

        for await (const chunk of service.stream([createMockMessage()])) {
          chunks.push(chunk);
        }

        expect(chunks).toHaveLength(3);
        expect(chunks[0]!.choices[0]!.delta.content).toBe('Hello');
        expect(chunks[1]!.choices[0]!.delta.content).toBe(' World');
      });

      it('should set isStreaming during stream', async () => {
        expect(service.isStreaming()).toBe(false);

        const iterator = service.stream([createMockMessage()])[Symbol.asyncIterator]();
        await iterator.next();

        expect(service.isStreaming()).toBe(true);

        // Consume rest
        while (!(await iterator.next()).done) {
          // Drain iterator
        }

        expect(service.isStreaming()).toBe(false);
      });

      it('should pass options to provider', async () => {
        const options: StreamOptions = {
          previousResponseId: 'resp-123',
          systemPrompt: 'You are helpful',
          providerConfig: { temperature: 0.5 },
        };

        for await (const _ of service.stream([createMockMessage()], options)) {
          // consume
        }

        expect(mockProvider.streamChat).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            previousResponseId: 'resp-123',
            systemPrompt: 'You are helpful',
            temperature: 0.5,
          })
        );
      });
    });

    describe('cancellation', () => {
      it('should cancel ongoing stream', async () => {
        const slowProvider = createMockProvider({
          streamChat: vi.fn().mockImplementation(async function* () {
            yield createMockChunk('Start');
            await new Promise(resolve => setTimeout(resolve, 100));
            yield createMockChunk('End');
          }),
        });
        service.setProvider(slowProvider);

        const iterator = service.stream([createMockMessage()])[Symbol.asyncIterator]();
        await iterator.next();

        service.cancel();

        expect(service.isStreaming()).toBe(false);
      });

      it('should throw when cancelled via signal', async () => {
        const abortController = new AbortController();
        const slowProvider = createMockProvider({
          streamChat: vi.fn().mockImplementation(async function* (_messages, config) {
            yield createMockChunk('Start');
            // Check signal
            if (config.signal?.aborted) {
              throw new Error('Aborted');
            }
            yield createMockChunk('End');
          }),
        });
        service.setProvider(slowProvider);

        const options: StreamOptions = { signal: abortController.signal };

        setTimeout(() => abortController.abort(), 10);

        await expect(async () => {
          for await (const _ of service.stream([createMockMessage()], options)) {
            await new Promise(resolve => setTimeout(resolve, 20));
          }
        }).rejects.toThrow();
      });
    });

    describe('error handling', () => {
      it('should use provider formatError for errors', async () => {
        const errorProvider = createMockProvider({
          streamChat: vi.fn().mockImplementation(async function* () {
            yield createMockChunk(''); // Yield once before error
            throw new Error('Provider error');
          }),
        });
        service.setProvider(errorProvider);

        await expect(async () => {
          for await (const _ of service.stream([createMockMessage()])) {
            // consume
          }
        }).rejects.toThrow('Provider error');

        expect(errorProvider.formatError).toHaveBeenCalled();
      });

      it('should handle non-Error exceptions', async () => {
        const errorProvider = createMockProvider({
          streamChat: vi.fn().mockImplementation(async function* () {
            yield createMockChunk(''); // Yield once before error
            throw 'string error';
          }),
          formatError: undefined,
        });
        service.setProvider(errorProvider);

        await expect(async () => {
          for await (const _ of service.stream([createMockMessage()])) {
            // consume
          }
        }).rejects.toThrow('Unknown streaming error occurred');
      });
    });
  });

  describe('cancel', () => {
    it('should be safe to call when not streaming', () => {
      expect(() => service.cancel()).not.toThrow();
    });

    it('should cancel active abort controller', async () => {
      const iterator = service.stream([createMockMessage()])[Symbol.asyncIterator]();
      await iterator.next();

      expect(service.isStreaming()).toBe(true);

      service.cancel();

      expect(service.isStreaming()).toBe(false);
    });
  });

  describe('isStreaming', () => {
    it('should return false initially', () => {
      expect(service.isStreaming()).toBe(false);
    });

    it('should return true during stream', async () => {
      const iterator = service.stream([createMockMessage()])[Symbol.asyncIterator]();
      await iterator.next();

      expect(service.isStreaming()).toBe(true);
    });

    it('should return false after stream completes', async () => {
      for await (const _ of service.stream([createMockMessage()])) {
        // consume
      }

      expect(service.isStreaming()).toBe(false);
    });
  });
});

describe('factory functions', () => {
  describe('createChatService', () => {
    it('should create service without provider', () => {
      const service = createChatService();
      expect(service).toBeInstanceOf(ChatService);
      expect(service.getProvider()).toBeNull();
    });

    it('should create service with provider', () => {
      const provider = createMockProvider();
      const service = createChatService(provider);
      expect(service.getProvider()).toBe(provider);
    });
  });

  describe('createChatServiceWithProvider', () => {
    it('should create service and set provider', () => {
      const provider = createMockProvider();
      const service = createChatServiceWithProvider(provider);
      expect(service).toBeInstanceOf(ChatService);
      expect(service.getProvider()).toBe(provider);
    });
  });
});
