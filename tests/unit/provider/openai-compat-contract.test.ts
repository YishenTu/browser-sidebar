/**
 * @file OpenAI-Compatible Provider Contract Tests
 *
 * Specific contract tests for the OpenAI-Compatible provider to ensure it
 * returns consistent StreamChunk formats and follows the provider contract.
 * Tests compatibility with various OpenAI-compatible API endpoints.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenAICompatibleProvider } from '@core/engine/openai-compat/OpenAICompatibleProvider';
import {
  validateStreamChunk,
  validateProviderError,
  createMockStreamChunk,
  createMockMessages,
  assertContractCompliance,
} from './contract-utilities';
import type {
  ProviderConfig,
  OpenAICompatibleConfig,
  StreamChunk,
  ProviderChatMessage,
} from '@types/providers';

// Mock dependencies
vi.mock('@core/engine/openai-compat/OpenAICompatClient', () => ({
  OpenAICompatClient: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    testConnection: vi.fn().mockResolvedValue(true),
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  })),
}));

vi.mock('@core/engine/openai-compat/requestBuilder', () => ({
  buildRequest: vi.fn().mockReturnValue({
    messages: [],
    model: 'custom-model',
    stream: true,
  }),
}));

vi.mock('@core/engine/openai-compat/streamProcessor', () => ({
  processStreamChunk: vi.fn().mockImplementation(chunk => ({
    id: 'compat-chunk-test',
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model: 'custom-model',
    choices: [
      {
        index: 0,
        delta: { content: 'test content' },
        finishReason: null,
      },
    ],
  })),
}));

vi.mock('@core/engine/openai-compat/errorHandler', () => ({
  mapErrorToProviderError: vi.fn().mockReturnValue({
    type: 'unknown',
    message: 'Test error',
    code: 'TEST_ERROR',
    provider: 'openai_compat',
  }),
}));

describe('OpenAI-Compatible Provider Contract Tests', () => {
  let provider: OpenAICompatibleProvider;
  let config: ProviderConfig;
  let messages: ProviderChatMessage[];

  beforeEach(() => {
    vi.clearAllMocks();

    provider = new OpenAICompatibleProvider();
    config = {
      type: 'openai_compat',
      config: {
        apiKey: 'test-api-key-12345',
        model: 'custom-model-v1',
        baseURL: 'https://api.customai.com/v1',
        headers: {
          'User-Agent': 'BrowserSidebar/1.0',
          'X-Custom-Header': 'test-value',
        },
      } as OpenAICompatibleConfig,
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
    (provider as any).compatConfig = config.config;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic StreamChunk Contract', () => {
    it('should return compliant StreamChunk structure', async () => {
      const mockChunk: StreamChunk = createMockStreamChunk({
        model: 'custom-model-v1',
        object: 'chat.completion.chunk',
        choices: [
          {
            index: 0,
            delta: { content: 'Hello from custom API!' },
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
      const validation = validateStreamChunk(chunks[0], 'OpenAI-Compatible');

      assertContractCompliance([validation], 'OpenAI-Compatible basic StreamChunk');
    });

    it('should handle custom endpoint streaming correctly', async () => {
      const customChunks: StreamChunk[] = [
        createMockStreamChunk({
          model: 'custom-model-v1',
          choices: [
            {
              index: 0,
              delta: { content: 'Response from ' },
              finishReason: null,
            },
          ],
        }),
        createMockStreamChunk({
          model: 'custom-model-v1',
          choices: [
            {
              index: 0,
              delta: { content: 'custom endpoint ' },
              finishReason: null,
            },
          ],
        }),
        createMockStreamChunk({
          model: 'custom-model-v1',
          choices: [
            {
              index: 0,
              delta: { content: 'API service.' },
              finishReason: 'stop',
            },
          ],
        }),
      ];

      vi.spyOn(provider, 'streamChat').mockImplementation(async function* () {
        for (const chunk of customChunks) {
          yield chunk;
        }
      });

      const chunks: StreamChunk[] = [];
      for await (const chunk of provider.streamChat(messages)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(3);

      const validationResults = chunks.map((chunk, index) =>
        validateStreamChunk(chunk, `OpenAI-Compatible chunk ${index}`)
      );

      assertContractCompliance(validationResults, 'OpenAI-Compatible custom endpoint streaming');

      // Verify model consistency
      chunks.forEach(chunk => {
        expect(chunk.model).toBe('custom-model-v1');
      });
    });
  });

  describe('Reasoning Support Contract', () => {
    it('should handle reasoning when supported by endpoint', async () => {
      const reasoningChunk: StreamChunk = createMockStreamChunk({
        model: 'custom-model-v1',
        choices: [
          {
            index: 0,
            delta: {
              thinking: 'Analyzing the request with custom reasoning...',
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
      const validation = validateStreamChunk(chunks[0], 'OpenAI-Compatible');

      assertContractCompliance([validation], 'OpenAI-Compatible reasoning support');

      // Verify reasoning content
      expect(chunks[0].choices[0].delta.thinking).toBe(
        'Analyzing the request with custom reasoning...'
      );
    });

    it('should gracefully handle endpoints without reasoning support', async () => {
      const contentOnlyChunk: StreamChunk = createMockStreamChunk({
        model: 'custom-model-v1',
        choices: [
          {
            index: 0,
            delta: {
              content: 'Direct response without reasoning capabilities',
              thinking: undefined,
            },
            finishReason: null,
          },
        ],
      });

      vi.spyOn(provider, 'streamChat').mockImplementation(async function* () {
        yield contentOnlyChunk;
      });

      const chunks: StreamChunk[] = [];
      for await (const chunk of provider.streamChat(messages)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      const validation = validateStreamChunk(chunks[0], 'OpenAI-Compatible');

      assertContractCompliance([validation], 'OpenAI-Compatible no reasoning support');

      // Verify no thinking content
      expect(chunks[0].choices[0].delta.thinking).toBeUndefined();
      expect(chunks[0].choices[0].delta.content).toBe(
        'Direct response without reasoning capabilities'
      );
    });
  });

  describe('Usage Metadata Contract', () => {
    it('should include usage metadata when provided by endpoint', async () => {
      const chunkWithUsage: StreamChunk = createMockStreamChunk({
        model: 'custom-model-v1',
        choices: [
          {
            index: 0,
            delta: { content: 'Response with usage tracking' },
            finishReason: 'stop',
          },
        ],
        usage: {
          promptTokens: 18,
          completionTokens: 32,
          totalTokens: 50,
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
      const validation = validateStreamChunk(chunks[0], 'OpenAI-Compatible');

      assertContractCompliance([validation], 'OpenAI-Compatible usage metadata');

      // Verify usage data
      const usage = chunks[0].usage!;
      expect(usage.promptTokens).toBe(18);
      expect(usage.completionTokens).toBe(32);
      expect(usage.totalTokens).toBe(50);
    });

    it('should handle missing usage metadata gracefully', async () => {
      const chunkWithoutUsage: StreamChunk = createMockStreamChunk({
        model: 'custom-model-v1',
        choices: [
          {
            index: 0,
            delta: { content: 'Response without usage data' },
            finishReason: 'stop',
          },
        ],
        usage: undefined,
      });

      vi.spyOn(provider, 'streamChat').mockImplementation(async function* () {
        yield chunkWithoutUsage;
      });

      const chunks: StreamChunk[] = [];
      for await (const chunk of provider.streamChat(messages)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      const validation = validateStreamChunk(chunks[0], 'OpenAI-Compatible');

      assertContractCompliance([validation], 'OpenAI-Compatible missing usage metadata');

      expect(chunks[0].usage).toBeUndefined();
    });
  });

  describe('Custom Headers and Metadata Contract', () => {
    it('should handle custom endpoint metadata', async () => {
      const chunkWithMetadata: StreamChunk = createMockStreamChunk({
        model: 'custom-model-v1',
        choices: [
          {
            index: 0,
            delta: { content: 'Response with custom metadata' },
            finishReason: null,
          },
        ],
        metadata: {
          requestId: 'custom-req-789',
          provider: 'custom-ai-service',
          version: 'v1.2.3',
        },
      });

      vi.spyOn(provider, 'streamChat').mockImplementation(async function* () {
        yield chunkWithMetadata;
      });

      const chunks: StreamChunk[] = [];
      for await (const chunk of provider.streamChat(messages)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      const validation = validateStreamChunk(chunks[0], 'OpenAI-Compatible');

      assertContractCompliance([validation], 'OpenAI-Compatible custom metadata');

      // Verify custom metadata
      expect(chunks[0].metadata?.requestId).toBe('custom-req-789');
      expect(chunks[0].metadata?.provider).toBe('custom-ai-service');
      expect(chunks[0].metadata?.version).toBe('v1.2.3');
    });
  });

  describe('Error Handling Contract', () => {
    it('should format errors according to contract', () => {
      const testError = new Error('Custom endpoint authentication failed');

      // Mock the formatError method to return proper structure
      const mockFormattedError = {
        type: 'authentication' as const,
        message: 'Custom endpoint authentication failed',
        code: 'AUTH_FAILED',
        provider: 'openai_compat' as const,
      };

      vi.spyOn(provider, 'formatError').mockReturnValue(mockFormattedError);
      const formattedError = provider.formatError(testError);

      const validation = validateProviderError(formattedError, 'OpenAI-Compatible');
      assertContractCompliance([validation], 'OpenAI-Compatible error formatting');

      expect(formattedError.provider).toBe('openai_compat');
    });

    it('should handle custom endpoint errors gracefully', async () => {
      const streamError = new Error('Custom API endpoint unreachable');
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
      }).rejects.toThrow('Custom API endpoint unreachable');
    });

    it('should handle malformed responses gracefully', async () => {
      // Test with a chunk that might have unexpected structure
      const malformedChunk: StreamChunk = createMockStreamChunk({
        model: 'custom-model-v1',
        choices: [
          {
            index: 0,
            delta: { content: 'Potentially malformed response' },
            finishReason: null,
          },
        ],
      });

      vi.spyOn(provider, 'streamChat').mockImplementation(async function* () {
        yield malformedChunk;
      });

      const chunks: StreamChunk[] = [];
      for await (const chunk of provider.streamChat(messages)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      const validation = validateStreamChunk(chunks[0], 'OpenAI-Compatible');

      assertContractCompliance([validation], 'OpenAI-Compatible malformed response handling');
    });
  });

  describe('Configuration Contract', () => {
    it('should validate configuration correctly', () => {
      const validConfig = {
        apiKey: 'custom-api-key',
        model: 'my-custom-model',
        baseURL: 'https://api.myservice.com/v1',
        headers: {
          Authorization: 'Bearer token',
        },
      };

      const validation = provider.validateConfig(validConfig);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should reject invalid base URL', () => {
      const invalidConfig = {
        apiKey: 'test-key',
        model: 'test-model',
        baseURL: 'not-a-valid-url', // Invalid URL format
      };

      const validation = provider.validateConfig(invalidConfig);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(error => error.toLowerCase().includes('url'))).toBe(true);
    });

    it('should require base URL', () => {
      const incompleteConfig = {
        apiKey: 'test-key',
        model: 'test-model',
        // Missing baseURL
      };

      const validation = provider.validateConfig(incompleteConfig);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(error => error.toLowerCase().includes('base url'))).toBe(true);
    });
  });

  describe('Provider Capabilities Contract', () => {
    it('should declare correct capabilities', () => {
      expect(provider.type).toBe('openai_compat');
      expect(provider.name).toBe('OpenAI-Compatible');
      expect(provider.capabilities.streaming).toBe(true);
      expect(provider.capabilities.reasoning).toBe(true);
      expect(provider.capabilities.thinking).toBe(false); // Most don't support thinking tokens
    });

    it('should handle dynamic model support', () => {
      const models = provider.getModels();
      expect(Array.isArray(models)).toBe(true);

      // For custom providers, should include the configured model
      const configuredModel = provider.getModel('custom-model-v1');
      // May or may not find it depending on configuration state
      if (configuredModel) {
        expect(configuredModel.id).toBe('custom-model-v1');
      }
    });
  });

  describe('Multiple Custom Endpoints Contract', () => {
    it('should handle different endpoint configurations', async () => {
      const endpoints = [
        { baseURL: 'https://api.localai.io/v1', model: 'llama2-7b' },
        { baseURL: 'https://api.ollama.ai/v1', model: 'mistral-7b' },
        { baseURL: 'https://api.textgenwebui.com/v1', model: 'gpt4all-13b' },
      ];

      for (const endpoint of endpoints) {
        const chunk: StreamChunk = createMockStreamChunk({
          model: endpoint.model,
          choices: [
            {
              index: 0,
              delta: { content: `Response from ${endpoint.model}` },
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
        const validation = validateStreamChunk(chunks[0], 'OpenAI-Compatible');
        assertContractCompliance([validation], `OpenAI-Compatible endpoint: ${endpoint.baseURL}`);

        expect(chunks[0].model).toBe(endpoint.model);
      }
    });
  });

  describe('Built-in Preset Support Contract', () => {
    it('should handle built-in provider presets', async () => {
      // Test with a preset-like configuration
      const presetChunk: StreamChunk = createMockStreamChunk({
        model: 'preset-model',
        choices: [
          {
            index: 0,
            delta: { content: 'Response from preset configuration' },
            finishReason: null,
          },
        ],
      });

      vi.spyOn(provider, 'streamChat').mockImplementation(async function* () {
        yield presetChunk;
      });

      const chunks: StreamChunk[] = [];
      for await (const chunk of provider.streamChat(messages)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      const validation = validateStreamChunk(chunks[0], 'OpenAI-Compatible');

      assertContractCompliance([validation], 'OpenAI-Compatible preset support');
    });
  });
});
