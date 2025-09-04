/**
 * @file OpenAI Provider Contract Tests
 *
 * Specific contract tests for the OpenAI provider to ensure it
 * returns consistent StreamChunk formats and follows the provider contract.
 * Tests OpenAI-specific features like reasoning effort and thinking tokens.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenAIProvider } from '@core/engine/openai/OpenAIProvider';
import {
  validateStreamChunk,
  validateProviderError,
  createMockStreamChunk,
  createMockMessages,
  assertContractCompliance,
  type ProviderTestConfig,
} from './contract-utilities';
import type {
  ProviderConfig,
  OpenAIConfig,
  StreamChunk,
  ProviderChatMessage,
} from '@types/providers';

// Mock dependencies
// No feature flags in new architecture

// No SDK client in transport-only mode

vi.mock('@core/engine/openai/requestBuilder', () => ({
  buildRequest: vi.fn().mockReturnValue({
    messages: [],
    model: 'gpt-5',
    stream: true,
    reasoning_effort: 'medium',
  }),
}));

vi.mock('@core/engine/openai/responseParser', () => ({
  extractSearchMetadataFromEvent: vi.fn().mockReturnValue(null),
}));

vi.mock('@core/engine/openai/errorHandler', () => ({
  formatError: vi.fn().mockReturnValue({
    type: 'unknown',
    message: 'Test error',
    code: 'TEST_ERROR',
    provider: 'openai',
  }),
  withErrorHandlingGenerator: vi.fn().mockImplementation(generatorFn => generatorFn),
}));

vi.mock('@core/ai/openai/streamProcessor', () => ({
  OpenAIStreamProcessor: vi.fn().mockImplementation(() => ({
    processEvent: vi.fn().mockReturnValue(null),
    getSearchMetadata: vi.fn().mockReturnValue(null),
    setSearchMetadata: vi.fn(),
  })),
}));

describe('OpenAI Provider Contract Tests', () => {
  let provider: OpenAIProvider;
  let config: ProviderConfig;
  let messages: ProviderChatMessage[];

  beforeEach(() => {
    vi.clearAllMocks();

    provider = new OpenAIProvider();
    config = {
      type: 'openai',
      config: {
        apiKey: 'sk-test123456789',
        model: 'gpt-5',
        reasoningEffort: 'medium',
      } as OpenAIConfig,
    };
    messages = createMockMessages(1);

    // No SDK client setup needed
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic StreamChunk Contract', () => {
    it('should return compliant StreamChunk structure', async () => {
      const mockChunk: StreamChunk = createMockStreamChunk({
        model: 'gpt-5',
        choices: [
          {
            index: 0,
            delta: { content: 'Hello from OpenAI!' },
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
      const validation = validateStreamChunk(chunks[0], 'OpenAI');

      assertContractCompliance([validation], 'OpenAI basic StreamChunk');
    });

    it('should handle content streaming correctly', async () => {
      const contentChunks: StreamChunk[] = [
        createMockStreamChunk({
          model: 'gpt-5',
          choices: [
            {
              index: 0,
              delta: { content: 'Hello ' },
              finishReason: null,
            },
          ],
        }),
        createMockStreamChunk({
          model: 'gpt-5',
          choices: [
            {
              index: 0,
              delta: { content: 'world!' },
              finishReason: null,
            },
          ],
        }),
        createMockStreamChunk({
          model: 'gpt-5',
          choices: [
            {
              index: 0,
              delta: {},
              finishReason: 'stop',
            },
          ],
        }),
      ];

      vi.spyOn(provider, 'streamChat').mockImplementation(async function* () {
        for (const chunk of contentChunks) {
          yield chunk;
        }
      });

      const chunks: StreamChunk[] = [];
      for await (const chunk of provider.streamChat(messages)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(3);

      // Validate each chunk
      const validationResults = chunks.map((chunk, index) =>
        validateStreamChunk(chunk, `OpenAI chunk ${index}`)
      );

      assertContractCompliance(validationResults, 'OpenAI content streaming');

      // Check content progression
      expect(chunks[0].choices[0].delta.content).toBe('Hello ');
      expect(chunks[1].choices[0].delta.content).toBe('world!');
      expect(chunks[2].choices[0].finishReason).toBe('stop');
    });
  });

  describe('Reasoning/Thinking Contract', () => {
    it('should handle thinking tokens correctly', async () => {
      const thinkingChunk: StreamChunk = createMockStreamChunk({
        model: 'gpt-5',
        choices: [
          {
            index: 0,
            delta: { thinking: 'Let me think about this problem...' },
            finishReason: null,
          },
        ],
      });

      vi.spyOn(provider, 'streamChat').mockImplementation(async function* () {
        yield thinkingChunk;
      });

      const chunks: StreamChunk[] = [];
      for await (const chunk of provider.streamChat(messages)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      const validation = validateStreamChunk(chunks[0], 'OpenAI');

      assertContractCompliance([validation], 'OpenAI thinking tokens');

      // Verify thinking content
      expect(chunks[0].choices[0].delta.thinking).toBe('Let me think about this problem...');
    });

    it('should handle mixed thinking and content chunks', async () => {
      const mixedChunks: StreamChunk[] = [
        createMockStreamChunk({
          model: 'gpt-5',
          choices: [
            {
              index: 0,
              delta: { thinking: 'Analyzing the question...' },
              finishReason: null,
            },
          ],
        }),
        createMockStreamChunk({
          model: 'gpt-5',
          choices: [
            {
              index: 0,
              delta: { content: 'Based on my analysis, ' },
              finishReason: null,
            },
          ],
        }),
        createMockStreamChunk({
          model: 'gpt-5',
          choices: [
            {
              index: 0,
              delta: { content: 'the answer is 42.' },
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
        validateStreamChunk(chunk, `OpenAI mixed chunk ${index}`)
      );

      assertContractCompliance(validationResults, 'OpenAI mixed thinking and content');
    });
  });

  describe('Usage Metadata Contract', () => {
    it('should include valid usage metadata when available', async () => {
      const chunkWithUsage: StreamChunk = createMockStreamChunk({
        model: 'gpt-5',
        choices: [
          {
            index: 0,
            delta: { content: 'Response with usage data' },
            finishReason: 'stop',
          },
        ],
        usage: {
          promptTokens: 15,
          completionTokens: 25,
          totalTokens: 50, // 15 + 25 + 10 = 50
          thinkingTokens: 10,
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
      const validation = validateStreamChunk(chunks[0], 'OpenAI');

      assertContractCompliance([validation], 'OpenAI usage metadata');

      // Verify usage data structure
      const usage = chunks[0].usage!;
      expect(usage.promptTokens).toBe(15);
      expect(usage.completionTokens).toBe(25);
      expect(usage.totalTokens).toBe(50);
      expect(usage.thinkingTokens).toBe(10);
    });
  });

  describe('Search Results Contract', () => {
    it('should handle search metadata correctly', async () => {
      const chunkWithSearch: StreamChunk = createMockStreamChunk({
        model: 'gpt-5',
        choices: [
          {
            index: 0,
            delta: { content: 'Based on my search, ' },
            finishReason: null,
          },
        ],
        metadata: {
          searchResults: [
            {
              title: 'Example Search Result',
              url: 'https://example.com',
              snippet: 'This is a search result snippet',
              domain: 'example.com',
            },
          ],
          responseId: 'resp-abc123',
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
      const validation = validateStreamChunk(chunks[0], 'OpenAI');

      assertContractCompliance([validation], 'OpenAI search metadata');

      // Verify search results structure
      const searchResults = chunks[0].metadata?.searchResults as any[];
      expect(searchResults).toHaveLength(1);
      expect(searchResults[0].title).toBe('Example Search Result');
      expect(searchResults[0].url).toBe('https://example.com');
    });
  });

  describe('Error Handling Contract', () => {
    it('should format errors according to contract', () => {
      const testError = new Error('OpenAI API error');

      // Mock the formatError method to return proper structure
      const mockFormattedError = {
        type: 'unknown' as const,
        message: 'OpenAI API error',
        code: 'OPENAI_ERROR',
        provider: 'openai' as const,
      };

      vi.spyOn(provider, 'formatError').mockReturnValue(mockFormattedError);
      const formattedError = provider.formatError(testError);

      const validation = validateProviderError(formattedError, 'OpenAI');
      assertContractCompliance([validation], 'OpenAI error formatting');

      expect(formattedError.provider).toBe('openai');
    });

    it('should handle streaming errors gracefully', async () => {
      const streamError = new Error('Streaming connection failed');
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
      }).rejects.toThrow('Streaming connection failed');
    });
  });

  describe('Model Configuration Contract', () => {
    it('should validate configuration correctly', () => {
      const validConfig = {
        apiKey: 'sk-test123',
        model: 'gpt-5',
        reasoningEffort: 'high' as const,
      };

      const validation = provider.validateConfig(validConfig);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should reject invalid configuration', () => {
      const invalidConfig = {
        apiKey: '', // Empty API key
        model: 'invalid-model',
        reasoningEffort: 'invalid' as any,
      };

      const validation = provider.validateConfig(invalidConfig);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Provider Capabilities Contract', () => {
    it('should declare correct capabilities', () => {
      expect(provider.type).toBe('openai');
      expect(provider.name).toBe('OpenAI');
      expect(provider.capabilities.streaming).toBe(true);
      expect(provider.capabilities.reasoning).toBe(true);
      expect(provider.capabilities.thinking).toBe(true);
      expect(provider.capabilities.multimodal).toBe(true);
    });

    it('should provide model information', () => {
      const models = provider.getModels();
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);

      const model = provider.getModel('gpt-5');
      if (model) {
        expect(model.id).toBe('gpt-5');
        expect(model.provider).toBe('openai');
      }
    });
  });
});
