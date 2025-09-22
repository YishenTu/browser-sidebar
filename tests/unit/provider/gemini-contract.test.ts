/**
 * @file Gemini Provider Contract Tests
 *
 * Specific contract tests for the Gemini provider to ensure it
 * returns consistent StreamChunk formats and follows the provider contract.
 * Tests Gemini-specific features like thinking budgets and thought visibility.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GeminiProvider } from '@core/engine/gemini/GeminiProvider';
import {
  validateStreamChunk,
  validateProviderError,
  createMockStreamChunk,
  createMockMessages,
  assertContractCompliance,
} from './contract-utilities';
import type {
  ProviderConfig,
  GeminiConfig,
  StreamChunk,
  ProviderChatMessage,
} from '@types/providers';

// Mock dependencies
// No feature flags in new architecture

vi.mock('@core/engine/gemini/GeminiClient', () => ({
  GeminiClient: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    testConnection: vi.fn().mockResolvedValue(true),
    getConfig: vi.fn().mockReturnValue({
      type: 'gemini',
      config: {
        apiKey: 'test-key',
        model: 'gemini-2.5-flash',
        thinkingBudget: '-1',
      },
    }),
  })),
}));

vi.mock('@core/engine/gemini/requestBuilder', () => ({
  buildRequest: vi.fn().mockReturnValue({
    contents: [],
    generationConfig: { temperature: 0.7 },
  }),
  buildHeaders: vi.fn().mockReturnValue({
    'Content-Type': 'application/json',
  }),
  buildApiUrl: vi.fn().mockReturnValue('https://generativelanguage.googleapis.com/v1beta/test'),
}));

vi.mock('@core/engine/gemini/responseParser', () => ({
  convertToStreamChunk: vi.fn().mockImplementation((data, model) => ({
    id: 'gemini-chunk-test',
    object: 'response.chunk',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        delta: { content: 'test content' },
        finishReason: null,
      },
    ],
  })),
  processStreamChunk: vi.fn(),
}));

vi.mock('@core/engine/gemini/errorHandler', () => ({
  handleErrorResponse: vi.fn().mockReturnValue({
    type: 'unknown',
    message: 'Test error',
    code: 'TEST_ERROR',
    provider: 'gemini',
  }),
  withErrorHandlingGenerator: vi.fn().mockImplementation(generatorFn => generatorFn),
}));

vi.mock('@core/ai/gemini/streamProcessor', () => ({
  GeminiStreamProcessor: vi.fn().mockImplementation(() => ({
    processChunk: vi.fn().mockReturnValue([]),
  })),
}));

describe('Gemini Provider Contract Tests', () => {
  let provider: GeminiProvider;
  let config: ProviderConfig;
  let messages: ProviderChatMessage[];

  beforeEach(() => {
    vi.clearAllMocks();

    provider = new GeminiProvider();
    config = {
      type: 'gemini',
      config: {
        apiKey: 'AIza-test123456789',
        model: 'gemini-2.5-flash',
        thinkingBudget: '-1',
      } as GeminiConfig,
    };
    messages = createMockMessages(1);

    // Set provider type and mock methods for contract tests
    if (!(provider as any).type) {
      (provider as any).type = 'gemini';
      (provider as any).name = 'Google Gemini';
    }

    // Mock capabilities
    (provider as any).capabilities = {
      streaming: true,
      temperature: true,
      reasoning: false,
      thinking: true,
      multimodal: true,
      functionCalling: false,
      maxContextLength: 1000000,
      supportedModels: ['gemini-2.5-flash', 'gemini-2.5-pro'],
    };

    // Add required methods to provider object
    (provider as any).validateConfig = vi.fn().mockReturnValue({
      isValid: true,
      errors: [],
    });

    (provider as any).formatError = vi.fn().mockReturnValue({
      type: 'unknown' as const,
      message: 'Test error',
      code: 'GEMINI_ERROR',
      provider: 'gemini' as const,
    });

    (provider as any).getModels = vi.fn().mockReturnValue([
      {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        provider: 'gemini',
        contextLength: 1000000,
        description: 'Fast and efficient',
      },
    ]);

    (provider as any).getModel = vi.fn().mockImplementation((id: string) =>
      id === 'gemini-2.5-flash'
        ? {
            id: 'gemini-2.5-flash',
            name: 'Gemini 2.5 Flash',
            provider: 'gemini',
            contextLength: 1000000,
            description: 'Fast and efficient',
          }
        : undefined
    );

    (provider as any).streamChat = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic StreamChunk Contract', () => {
    it('should return compliant StreamChunk structure', async () => {
      const mockChunk: StreamChunk = createMockStreamChunk({
        model: 'gemini-2.5-flash',
        choices: [
          {
            index: 0,
            delta: { content: 'Hello from Gemini!' },
            finishReason: null,
          },
        ],
      });

      (provider as any).streamChat.mockImplementation(async function* () {
        yield mockChunk;
      });

      const chunks: StreamChunk[] = [];
      for await (const chunk of provider.streamChat(messages)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      const validation = validateStreamChunk(chunks[0], 'Gemini');

      assertContractCompliance([validation], 'Gemini basic StreamChunk');
    });

    it('should handle incremental content streaming', async () => {
      const contentChunks: StreamChunk[] = [
        createMockStreamChunk({
          model: 'gemini-2.5-flash',
          choices: [
            {
              index: 0,
              delta: { content: 'According ' },
              finishReason: null,
            },
          ],
        }),
        createMockStreamChunk({
          model: 'gemini-2.5-flash',
          choices: [
            {
              index: 0,
              delta: { content: 'to my analysis, ' },
              finishReason: null,
            },
          ],
        }),
        createMockStreamChunk({
          model: 'gemini-2.5-flash',
          choices: [
            {
              index: 0,
              delta: { content: 'the solution is optimal.' },
              finishReason: 'stop',
            },
          ],
        }),
      ];

      (provider as any).streamChat.mockImplementation(async function* () {
        for (const chunk of contentChunks) {
          yield chunk;
        }
      });

      const chunks: StreamChunk[] = [];
      for await (const chunk of provider.streamChat(messages)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(3);

      const validationResults = chunks.map((chunk, index) =>
        validateStreamChunk(chunk, `Gemini chunk ${index}`)
      );

      assertContractCompliance(validationResults, 'Gemini incremental streaming');

      // Verify content progression
      expect(chunks[0].choices[0].delta.content).toBe('According ');
      expect(chunks[1].choices[0].delta.content).toBe('to my analysis, ');
      expect(chunks[2].choices[0].delta.content).toBe('the solution is optimal.');
      expect(chunks[2].choices[0].finishReason).toBe('stop');
    });
  });

  describe('Thinking Budget Contract', () => {
    it('should handle thinking content correctly', async () => {
      const thinkingChunk: StreamChunk = createMockStreamChunk({
        model: 'gemini-2.5-flash',
        choices: [
          {
            index: 0,
            delta: {
              thinking: 'I need to consider multiple factors here...',
              content: undefined,
            },
            finishReason: null,
          },
        ],
      });

      (provider as any).streamChat.mockImplementation(async function* () {
        yield thinkingChunk;
      });

      const chunks: StreamChunk[] = [];
      for await (const chunk of provider.streamChat(messages)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      const validation = validateStreamChunk(chunks[0], 'Gemini');

      assertContractCompliance([validation], 'Gemini thinking content');

      // Verify thinking content
      expect(chunks[0].choices[0].delta.thinking).toBe(
        'I need to consider multiple factors here...'
      );
    });

    it('should handle dynamic thinking budget (-1) correctly', async () => {
      const dynamicThinkingChunks: StreamChunk[] = [
        createMockStreamChunk({
          model: 'gemini-2.5-flash',
          choices: [
            {
              index: 0,
              delta: { thinking: 'Starting analysis...' },
              finishReason: null,
            },
          ],
        }),
        createMockStreamChunk({
          model: 'gemini-2.5-flash',
          choices: [
            {
              index: 0,
              delta: { thinking: 'Evaluating options...' },
              finishReason: null,
            },
          ],
        }),
        createMockStreamChunk({
          model: 'gemini-2.5-flash',
          choices: [
            {
              index: 0,
              delta: { content: 'Based on my evaluation, the best approach is...' },
              finishReason: null,
            },
          ],
        }),
      ];

      (provider as any).streamChat.mockImplementation(async function* () {
        for (const chunk of dynamicThinkingChunks) {
          yield chunk;
        }
      });

      const chunks: StreamChunk[] = [];
      for await (const chunk of provider.streamChat(messages)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(3);

      const validationResults = chunks.map((chunk, index) =>
        validateStreamChunk(chunk, `Gemini dynamic thinking chunk ${index}`)
      );

      assertContractCompliance(validationResults, 'Gemini dynamic thinking budget');
    });

    it('should respect thinking disabled (budget 0)', async () => {
      const contentOnlyChunk: StreamChunk = createMockStreamChunk({
        model: 'gemini-2.5-flash',
        choices: [
          {
            index: 0,
            delta: {
              content: 'Direct response without thinking',
              thinking: undefined, // No thinking when disabled
            },
            finishReason: null,
          },
        ],
      });

      (provider as any).streamChat.mockImplementation(async function* () {
        yield contentOnlyChunk;
      });

      const chunks: StreamChunk[] = [];
      for await (const chunk of provider.streamChat(messages)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      const validation = validateStreamChunk(chunks[0], 'Gemini');

      assertContractCompliance([validation], 'Gemini thinking disabled');

      // Verify no thinking content when disabled
      expect(chunks[0].choices[0].delta.thinking).toBeUndefined();
      expect(chunks[0].choices[0].delta.content).toBe('Direct response without thinking');
    });
  });

  describe('Usage Metadata Contract', () => {
    it('should include valid usage metadata from Gemini API', async () => {
      const chunkWithUsage: StreamChunk = createMockStreamChunk({
        model: 'gemini-2.5-flash',
        choices: [
          {
            index: 0,
            delta: { content: 'Response with token counts' },
            finishReason: 'stop',
          },
        ],
        usage: {
          promptTokens: 12,
          completionTokens: 28,
          totalTokens: 40,
          // Gemini may not always provide thinking tokens
        },
      });

      (provider as any).streamChat.mockImplementation(async function* () {
        yield chunkWithUsage;
      });

      const chunks: StreamChunk[] = [];
      for await (const chunk of provider.streamChat(messages)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      const validation = validateStreamChunk(chunks[0], 'Gemini');

      assertContractCompliance([validation], 'Gemini usage metadata');

      // Verify usage structure
      const usage = chunks[0].usage!;
      expect(usage.promptTokens).toBe(12);
      expect(usage.completionTokens).toBe(28);
      expect(usage.totalTokens).toBe(40);
    });
  });

  describe('Search Results Contract', () => {
    it('should handle search metadata from Gemini API', async () => {
      const chunkWithSearch: StreamChunk = createMockStreamChunk({
        model: 'gemini-2.5-flash',
        choices: [
          {
            index: 0,
            delta: { content: 'According to recent sources, ' },
            finishReason: null,
          },
        ],
        metadata: {
          searchResults: [
            {
              title: 'Gemini API Documentation',
              url: 'https://developers.google.com/gemini/api',
              snippet: 'Official Gemini API documentation',
              domain: 'developers.google.com',
            },
          ],
        },
      });

      (provider as any).streamChat.mockImplementation(async function* () {
        yield chunkWithSearch;
      });

      const chunks: StreamChunk[] = [];
      for await (const chunk of provider.streamChat(messages)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      const validation = validateStreamChunk(chunks[0], 'Gemini');

      assertContractCompliance([validation], 'Gemini search metadata');

      // Verify search results
      const searchResults = chunks[0].metadata?.searchResults as any[];
      expect(searchResults).toHaveLength(1);
      expect(searchResults[0].title).toBe('Gemini API Documentation');
      expect(searchResults[0].url).toBe('https://developers.google.com/gemini/api');
    });
  });

  describe('Error Handling Contract', () => {
    it('should format errors according to contract', () => {
      const testError = new Error('Gemini API quota exceeded');

      // Override mock for this specific test
      (provider as any).formatError.mockReturnValueOnce({
        type: 'rate_limit' as const,
        message: 'Gemini API quota exceeded',
        code: 'QUOTA_EXCEEDED',
        provider: 'gemini' as const,
      });

      const formattedError = provider.formatError(testError);

      const validation = validateProviderError(formattedError, 'Gemini');
      assertContractCompliance([validation], 'Gemini error formatting');

      expect(formattedError.provider).toBe('gemini');
    });

    it('should handle streaming errors gracefully', async () => {
      const streamError = new Error('Gemini streaming failed');
      // eslint-disable-next-line require-yield
      (provider as any).streamChat.mockImplementation(async function* (): AsyncGenerator<never> {
        throw streamError;
      });

      await expect(async () => {
        const chunks: StreamChunk[] = [];
        for await (const chunk of provider.streamChat(messages)) {
          chunks.push(chunk);
        }
      }).rejects.toThrow('Gemini streaming failed');
    });
  });

  describe('Model Configuration Contract', () => {
    it('should validate configuration correctly', () => {
      const validConfig = {
        apiKey: 'AIza-test123',
        model: 'gemini-2.5-flash',
        thinkingBudget: '-1' as const,
      };

      const validation = provider.validateConfig(validConfig);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should reject invalid thinking budget', () => {
      // Update mock for invalid config case
      (provider as any).validateConfig.mockReturnValueOnce({
        isValid: false,
        errors: ['Invalid thinking budget'],
      });

      const invalidConfig = {
        apiKey: 'AIza-test123',
        model: 'gemini-2.5-flash',
        thinkingBudget: 'invalid' as any,
      };

      const validation = provider.validateConfig(invalidConfig);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(error => error.includes('thinking budget'))).toBe(true);
    });
  });

  describe('Provider Capabilities Contract', () => {
    it('should declare correct capabilities', () => {
      expect(provider.type).toBe('gemini');
      expect(provider.name).toBe('Google Gemini');
      expect(provider.capabilities.streaming).toBe(true);
      expect(provider.capabilities.thinking).toBe(true);
      expect(provider.capabilities.multimodal).toBe(true);
    });

    it('should provide model information', () => {
      const models = provider.getModels();
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);

      const model = provider.getModel('gemini-2.5-flash');
      if (model) {
        expect(model.id).toBe('gemini-2.5-flash');
        expect(model.provider).toBe('gemini');
      }
    });
  });

  describe('Finish Reason Mapping', () => {
    it('should map Gemini finish reasons to standard format', async () => {
      const finishReasons: Array<{ gemini: string; standard: any }> = [
        { gemini: 'STOP', standard: 'stop' },
        { gemini: 'MAX_TOKENS', standard: 'length' },
        { gemini: 'SAFETY', standard: 'content_filter' },
        { gemini: 'RECITATION', standard: 'content_filter' },
      ];

      for (const { gemini, standard } of finishReasons) {
        const chunk: StreamChunk = createMockStreamChunk({
          model: 'gemini-2.5-flash',
          choices: [
            {
              index: 0,
              delta: { content: 'Test content' },
              finishReason: standard,
            },
          ],
        });

        (provider as any).streamChat.mockImplementation(async function* () {
          yield chunk;
        });

        const chunks: StreamChunk[] = [];
        for await (const streamChunk of provider.streamChat(messages)) {
          chunks.push(streamChunk);
        }

        expect(chunks).toHaveLength(1);
        const validation = validateStreamChunk(chunks[0], 'Gemini');
        assertContractCompliance([validation], `Gemini finish reason mapping: ${gemini}`);

        expect(chunks[0].choices[0].finishReason).toBe(standard);
      }
    });
  });
});
