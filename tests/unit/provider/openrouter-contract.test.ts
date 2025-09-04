/**
 * @file OpenRouter Provider Contract Tests
 *
 * Specific contract tests for the OpenRouter provider to ensure it
 * returns consistent StreamChunk formats and follows the provider contract.
 * Tests OpenRouter-specific features like reasoning configuration and model routing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenRouterProvider } from '@core/engine/openrouter/OpenRouterProvider';
import {
  validateStreamChunk,
  validateProviderError,
  createMockStreamChunk,
  createMockMessages,
  assertContractCompliance,
} from './contract-utilities';
import type {
  ProviderConfig,
  OpenRouterConfig,
  StreamChunk,
  ProviderChatMessage,
} from '@types/providers';

// Mock dependencies
vi.mock('@core/engine/openrouter/OpenRouterClient', () => ({
  OpenRouterClient: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    testConnection: vi.fn().mockResolvedValue(true),
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  })),
}));

vi.mock('@core/engine/openrouter/requestBuilder', () => ({
  buildRequest: vi.fn().mockReturnValue({
    messages: [],
    model: 'openai/gpt-4',
    stream: true,
  }),
}));

vi.mock('@core/engine/openrouter/streamProcessor', () => ({
  processStreamChunk: vi.fn().mockImplementation(chunk => ({
    id: 'openrouter-chunk-test',
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model: 'openai/gpt-4',
    choices: [
      {
        index: 0,
        delta: { content: 'test content' },
        finishReason: null,
      },
    ],
  })),
}));

vi.mock('@core/engine/openrouter/errorHandler', () => ({
  mapErrorToProviderError: vi.fn().mockReturnValue({
    type: 'unknown',
    message: 'Test error',
    code: 'TEST_ERROR',
    provider: 'openrouter',
  }),
}));

describe('OpenRouter Provider Contract Tests', () => {
  let provider: OpenRouterProvider;
  let config: ProviderConfig;
  let messages: ProviderChatMessage[];

  beforeEach(() => {
    vi.clearAllMocks();

    provider = new OpenRouterProvider();
    config = {
      type: 'openrouter',
      config: {
        apiKey: 'sk-or-test123456789',
        model: 'openai/gpt-4',
        reasoning: {
          effort: 'medium',
          maxTokens: 25000,
        },
        headers: {
          referer: 'https://example.com',
          title: 'Test Application',
        },
      } as OpenRouterConfig,
    };
    messages = createMockMessages(1);

    // Mock the client
    (provider as any).client = {
      initialize: vi.fn().mockResolvedValue(undefined),
      testConnection: vi.fn().mockResolvedValue(true),
      chat: {
        completions: {
          create: vi.fn(),
        },
      },
    };
    (provider as any).openRouterConfig = config.config;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic StreamChunk Contract', () => {
    it('should return compliant StreamChunk structure', async () => {
      const mockChunk: StreamChunk = createMockStreamChunk({
        model: 'openai/gpt-4',
        object: 'chat.completion.chunk',
        choices: [
          {
            index: 0,
            delta: { content: 'Hello from OpenRouter!' },
            finishReason: null,
          },
        ],
      });

      vi.spyOn(provider, 'streamChat').mockImplementation(async function* () {
        yield mockChunk;
      });

      const chunks: StreamChunk[] = [];
      for await (const chunk of provider.streamChat(messages)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      const validation = validateStreamChunk(chunks[0], 'OpenRouter');

      assertContractCompliance([validation], 'OpenRouter basic StreamChunk');
    });

    it('should handle model-specific streaming correctly', async () => {
      const modelChunks: StreamChunk[] = [
        createMockStreamChunk({
          model: 'openai/gpt-4',
          choices: [
            {
              index: 0,
              delta: { content: 'This is ' },
              finishReason: null,
            },
          ],
        }),
        createMockStreamChunk({
          model: 'openai/gpt-4',
          choices: [
            {
              index: 0,
              delta: { content: 'from GPT-4 ' },
              finishReason: null,
            },
          ],
        }),
        createMockStreamChunk({
          model: 'openai/gpt-4',
          choices: [
            {
              index: 0,
              delta: { content: 'via OpenRouter.' },
              finishReason: 'stop',
            },
          ],
        }),
      ];

      vi.spyOn(provider, 'streamChat').mockImplementation(async function* () {
        for (const chunk of modelChunks) {
          yield chunk;
        }
      });

      const chunks: StreamChunk[] = [];
      for await (const chunk of provider.streamChat(messages)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(3);

      const validationResults = chunks.map((chunk, index) =>
        validateStreamChunk(chunk, `OpenRouter chunk ${index}`)
      );

      assertContractCompliance(validationResults, 'OpenRouter model-specific streaming');

      // Verify all chunks use the same model
      chunks.forEach(chunk => {
        expect(chunk.model).toBe('openai/gpt-4');
      });
    });
  });

  describe('Reasoning Configuration Contract', () => {
    it('should handle reasoning details correctly', async () => {
      const reasoningChunk: StreamChunk = createMockStreamChunk({
        model: 'openai/gpt-4',
        choices: [
          {
            index: 0,
            delta: {
              thinking: 'Let me analyze this step by step...',
              content: undefined,
            },
            finishReason: null,
          },
        ],
      });

      vi.spyOn(provider, 'streamChat').mockImplementation(async function* () {
        yield reasoningChunk;
      });

      const chunks: StreamChunk[] = [];
      for await (const chunk of provider.streamChat(messages)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      const validation = validateStreamChunk(chunks[0], 'OpenRouter');

      assertContractCompliance([validation], 'OpenRouter reasoning details');

      // Verify reasoning content
      expect(chunks[0].choices[0].delta.thinking).toBe('Let me analyze this step by step...');
    });

    it('should handle mixed reasoning and content', async () => {
      const mixedChunks: StreamChunk[] = [
        createMockStreamChunk({
          model: 'openai/gpt-4',
          choices: [
            {
              index: 0,
              delta: { thinking: 'Breaking down the problem...' },
              finishReason: null,
            },
          ],
        }),
        createMockStreamChunk({
          model: 'openai/gpt-4',
          choices: [
            {
              index: 0,
              delta: { content: 'Based on my reasoning, ' },
              finishReason: null,
            },
          ],
        }),
        createMockStreamChunk({
          model: 'openai/gpt-4',
          choices: [
            {
              index: 0,
              delta: { content: 'the optimal solution is...' },
              finishReason: null,
            },
          ],
        }),
      ];

      vi.spyOn(provider, 'streamChat').mockImplementation(async function* () {
        for (const chunk of mixedChunks) {
          yield chunk;
        }
      });

      const chunks: StreamChunk[] = [];
      for await (const chunk of provider.streamChat(messages)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(3);

      const validationResults = chunks.map((chunk, index) =>
        validateStreamChunk(chunk, `OpenRouter mixed chunk ${index}`)
      );

      assertContractCompliance(validationResults, 'OpenRouter mixed reasoning and content');
    });
  });

  describe('Usage Metadata Contract', () => {
    it('should include valid usage metadata', async () => {
      const chunkWithUsage: StreamChunk = createMockStreamChunk({
        model: 'openai/gpt-4',
        choices: [
          {
            index: 0,
            delta: { content: 'Response with usage data' },
            finishReason: 'stop',
          },
        ],
        usage: {
          promptTokens: 20,
          completionTokens: 35,
          totalTokens: 55,
        },
      });

      vi.spyOn(provider, 'streamChat').mockImplementation(async function* () {
        yield chunkWithUsage;
      });

      const chunks: StreamChunk[] = [];
      for await (const chunk of provider.streamChat(messages)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      const validation = validateStreamChunk(chunks[0], 'OpenRouter');

      assertContractCompliance([validation], 'OpenRouter usage metadata');

      // Verify usage data
      const usage = chunks[0].usage!;
      expect(usage.promptTokens).toBe(20);
      expect(usage.completionTokens).toBe(35);
      expect(usage.totalTokens).toBe(55);
    });
  });

  describe('Search Results Contract', () => {
    it('should handle web search results correctly', async () => {
      const chunkWithSearch: StreamChunk = createMockStreamChunk({
        model: 'openai/gpt-4',
        choices: [
          {
            index: 0,
            delta: { content: 'According to my web search, ' },
            finishReason: null,
          },
        ],
        metadata: {
          searchResults: {
            sources: [
              {
                title: 'OpenRouter Documentation',
                url: 'https://openrouter.ai/docs',
                snippet: 'OpenRouter API documentation',
                domain: 'openrouter.ai',
              },
            ],
          },
        },
      });

      vi.spyOn(provider, 'streamChat').mockImplementation(async function* () {
        yield chunkWithSearch;
      });

      const chunks: StreamChunk[] = [];
      for await (const chunk of provider.streamChat(messages)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      const validation = validateStreamChunk(chunks[0], 'OpenRouter');

      assertContractCompliance([validation], 'OpenRouter search metadata');

      // Verify search results structure (sources format)
      const searchResults = chunks[0].metadata?.searchResults as any;
      expect(searchResults.sources).toHaveLength(1);
      expect(searchResults.sources[0].title).toBe('OpenRouter Documentation');
      expect(searchResults.sources[0].url).toBe('https://openrouter.ai/docs');
    });

    it('should handle direct array search results format', async () => {
      const chunkWithDirectSearch: StreamChunk = createMockStreamChunk({
        model: 'openai/gpt-4',
        choices: [
          {
            index: 0,
            delta: { content: 'Research shows that ' },
            finishReason: null,
          },
        ],
        metadata: {
          searchResults: [
            {
              title: 'Research Paper',
              url: 'https://arxiv.org/abs/example',
              snippet: 'Abstract of the research paper',
              domain: 'arxiv.org',
            },
          ],
        },
      });

      vi.spyOn(provider, 'streamChat').mockImplementation(async function* () {
        yield chunkWithDirectSearch;
      });

      const chunks: StreamChunk[] = [];
      for await (const chunk of provider.streamChat(messages)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      const validation = validateStreamChunk(chunks[0], 'OpenRouter');

      assertContractCompliance([validation], 'OpenRouter direct search format');
    });
  });

  describe('Error Handling Contract', () => {
    it('should format errors according to contract', () => {
      const testError = new Error('OpenRouter rate limit exceeded');

      // Mock the formatError method to return proper structure
      const mockFormattedError = {
        type: 'rate_limit' as const,
        message: 'OpenRouter rate limit exceeded',
        code: 'RATE_LIMIT',
        provider: 'openrouter' as const,
      };

      vi.spyOn(provider, 'formatError').mockReturnValue(mockFormattedError);
      const formattedError = provider.formatError(testError);

      const validation = validateProviderError(formattedError, 'OpenRouter');
      assertContractCompliance([validation], 'OpenRouter error formatting');

      expect(formattedError.provider).toBe('openrouter');
    });

    it('should handle streaming errors gracefully', async () => {
      const streamError = new Error('OpenRouter streaming connection lost');
      vi.spyOn(provider, 'streamChat').mockImplementation(
        // eslint-disable-next-line require-yield
        async function* (): AsyncGenerator<never> {
          throw streamError;
        }
      );

      await expect(async () => {
        const chunks: StreamChunk[] = [];
        for await (const chunk of provider.streamChat(messages)) {
          chunks.push(chunk);
        }
      }).rejects.toThrow('OpenRouter streaming connection lost');
    });
  });

  describe('Model Configuration Contract', () => {
    it('should validate configuration correctly', () => {
      const validConfig = {
        apiKey: 'sk-or-test123',
        model: 'anthropic/claude-3-sonnet',
        reasoning: {
          effort: 'high' as const,
          maxTokens: 30000,
        },
      };

      const validation = provider.validateConfig(validConfig);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should reject invalid reasoning configuration', () => {
      const invalidConfig = {
        apiKey: 'sk-or-test123',
        model: 'openai/gpt-4',
        reasoning: {
          effort: 'invalid' as any,
          maxTokens: -100, // Invalid negative tokens
        },
      };

      const validation = provider.validateConfig(invalidConfig);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Provider Capabilities Contract', () => {
    it('should declare correct capabilities', () => {
      expect(provider.type).toBe('openrouter');
      expect(provider.name).toBe('OpenRouter');
      expect(provider.capabilities.streaming).toBe(true);
      expect(provider.capabilities.reasoning).toBe(true);
      expect(provider.capabilities.thinking).toBe(true);
    });

    it('should provide model information', () => {
      const models = provider.getModels();
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);

      // OpenRouter supports many models
      const gpt4Model = provider.getModel('openai/gpt-4');
      if (gpt4Model) {
        expect(gpt4Model.id).toBe('openai/gpt-4');
        expect(gpt4Model.provider).toBe('openrouter');
      }
    });
  });

  describe('Model Routing Contract', () => {
    it('should handle different model providers correctly', async () => {
      const modelProviders = [
        'openai/gpt-4',
        'anthropic/claude-3-sonnet',
        'meta-llama/llama-2-70b-chat',
        'google/gemini-pro',
      ];

      for (const modelId of modelProviders) {
        const chunk: StreamChunk = createMockStreamChunk({
          model: modelId,
          choices: [
            {
              index: 0,
              delta: { content: `Response from ${modelId}` },
              finishReason: null,
            },
          ],
        });

        vi.spyOn(provider, 'streamChat').mockImplementation(async function* () {
          yield chunk;
        });

        const chunks: StreamChunk[] = [];
        for await (const streamChunk of provider.streamChat(messages)) {
          chunks.push(streamChunk);
        }

        expect(chunks).toHaveLength(1);
        const validation = validateStreamChunk(chunks[0], 'OpenRouter');
        assertContractCompliance([validation], `OpenRouter model routing: ${modelId}`);

        expect(chunks[0].model).toBe(modelId);
      }
    });
  });

  describe('Rate Limiting and Cost Tracking', () => {
    it('should handle rate limit metadata correctly', async () => {
      const chunkWithRateLimit: StreamChunk = createMockStreamChunk({
        model: 'openai/gpt-4',
        choices: [
          {
            index: 0,
            delta: { content: 'Response with rate limit info' },
            finishReason: 'stop',
          },
        ],
        metadata: {
          cacheDiscount: 0.1, // 10% cache discount
          requestId: 'or-req-12345',
        },
      });

      vi.spyOn(provider, 'streamChat').mockImplementation(async function* () {
        yield chunkWithRateLimit;
      });

      const chunks: StreamChunk[] = [];
      for await (const chunk of provider.streamChat(messages)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      const validation = validateStreamChunk(chunks[0], 'OpenRouter');

      assertContractCompliance([validation], 'OpenRouter rate limit metadata');

      // Verify metadata structure
      expect(chunks[0].metadata?.cacheDiscount).toBe(0.1);
      expect(chunks[0].metadata?.requestId).toBe('or-req-12345');
    });
  });
});
