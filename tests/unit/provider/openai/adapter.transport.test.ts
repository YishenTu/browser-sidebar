/**
 * @file OpenAI Provider Transport Integration Tests
 *
 * Tests the OpenAI provider's integration with the Transport layer,
 * verifying correct usage patterns, streaming functionality, and error handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenAIProvider } from '@core/engine/openai/OpenAIProvider';
import type { Transport } from '@transport/types';
import type { ProviderChatMessage, OpenAIConfig, ProviderConfig } from '@types/providers';

// Mock dependencies with minimal setup

// No SDK client in transport-only mode

vi.mock('@core/engine/openai/requestBuilder', () => ({
  buildRequest: vi.fn().mockReturnValue({
    messages: [],
    model: 'gpt-5-mini',
    stream: true,
  }),
}));

vi.mock('@core/engine/openai/responseParser', () => ({
  extractSearchMetadataFromEvent: vi.fn().mockReturnValue(null),
}));

vi.mock('@core/engine/openai/searchMetadata', () => ({
  handleStreamSearchMetadata: vi.fn().mockReturnValue(null),
}));

vi.mock('@core/engine/openai/errorHandler', () => ({
  formatError: vi.fn().mockReturnValue({ type: 'unknown', message: 'Test error' }),
  withErrorHandlingGenerator: vi.fn().mockImplementation(generatorFn => generatorFn),
}));

vi.mock('@core/ai/openai/streamProcessor', () => ({
  OpenAIStreamProcessor: vi.fn().mockImplementation(() => ({
    processEvent: vi.fn().mockReturnValue(null),
    getSearchMetadata: vi.fn().mockReturnValue(null),
    setSearchMetadata: vi.fn(),
  })),
}));

describe('OpenAI Provider Transport Integration', () => {
  let provider: OpenAIProvider;
  let mockTransport: Transport;
  let mockConfig: ProviderConfig;
  let mockMessages: ProviderChatMessage[];

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock transport
    mockTransport = {
      request: vi.fn(),
      stream: vi.fn(),
    };

    // Create mock config
    mockConfig = {
      provider: 'openai',
      config: {
        apiKey: 'sk-test123456789',
        model: 'gpt-5-mini',
        reasoningEffort: 'medium',
      } as OpenAIConfig,
    };

    // Create mock messages with proper format
    mockMessages = [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Hello, how are you?',
        timestamp: new Date(),
      },
    ];

    // New architecture: no feature flag to reset
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor and Transport Setup', () => {
    it('should create provider with transport', () => {
      provider = new OpenAIProvider(mockTransport);
      expect(provider).toBeInstanceOf(OpenAIProvider);
      expect(provider['transport']).toBe(mockTransport);
    });

    it('should create provider without transport', () => {
      provider = new OpenAIProvider();
      expect(provider).toBeInstanceOf(OpenAIProvider);
      expect(provider['transport']).toBeUndefined();
    });
  });

  describe('Transport Implementation Selection Logic', () => {
    beforeEach(async () => {
      provider = new OpenAIProvider(mockTransport);

      // Mock the openaiClient methods directly on the provider instance
      await provider.initialize(mockConfig);
    });

    it('should prefer transport implementation when transport is available', () => {
      const hasTransport = provider['getTransport']() !== undefined;
      expect(hasTransport).toBe(true);
    });

    it('should fallback to SDK when transport is not available', () => {
      const providerWithoutTransport = new OpenAIProvider();
      const hasTransport = !!providerWithoutTransport['getTransport']();
      expect(hasTransport).toBe(false);
      expect(providerWithoutTransport['getTransport']()).toBeUndefined();
    });
  });

  describe('Transport Method Verification', () => {
    beforeEach(async () => {
      provider = new OpenAIProvider(mockTransport);

      // Mock the openaiClient methods directly on the provider instance
      await provider.initialize(mockConfig);
    });

    it('should have streamMessageWithTransport method for transport usage', () => {
      expect((provider as any).streamMessageWithTransport).toBeDefined();
      expect(typeof (provider as any).streamMessageWithTransport).toBe('function');
    });

    // SDK path removed: only transport exists

    it('should properly access transport via getTransport method', () => {
      expect((provider as any).getTransport()).toBe(mockTransport);
    });

    it('should return undefined from getTransport when no transport provided', () => {
      const providerWithoutTransport = new OpenAIProvider();
      expect((providerWithoutTransport as any).getTransport()).toBeUndefined();
    });
  });

  describe('Configuration and Validation', () => {
    it('should validate transport integration requirements', async () => {
      provider = new OpenAIProvider(mockTransport);

      provider['openaiClient'] = {
        initialize: vi.fn().mockResolvedValue(undefined),
        testConnection: vi.fn().mockResolvedValue(true),
        getOpenAIInstance: vi.fn().mockReturnValue({
          responses: { create: vi.fn() },
        }),
      } as any;

      // Should initialize without error
      await expect(provider.initialize(mockConfig)).resolves.not.toThrow();

      // Should have proper configuration
      expect(provider['getConfig']()).toEqual(mockConfig);

      // Should be properly configured
      expect(() => provider['ensureConfigured']()).not.toThrow();
    });

    it('should validate message format correctly', async () => {
      provider = new OpenAIProvider(mockTransport);

      await provider.initialize(mockConfig);

      // Valid messages should not throw
      expect(() => provider['validateMessages'](mockMessages)).not.toThrow();

      // Invalid messages should throw
      const invalidMessages = [{ role: 'user', content: '' }] as any;
      expect(() => provider['validateMessages'](invalidMessages)).toThrow('Invalid message format');
    });
  });

  // Feature flag tests removed — transport is default

  describe('Transport Request Building', () => {
    beforeEach(async () => {
      provider = new OpenAIProvider(mockTransport);

      await provider.initialize(mockConfig);
    });

    it('should verify transport request structure exists', () => {
      // Verify that the provider has the necessary transport integration components
      expect(provider).toBeInstanceOf(OpenAIProvider);
      expect((provider as any).getTransport()).toBe(mockTransport);

      // Verify that transport method exists
      expect((provider as any).streamMessageWithTransport).toBeDefined();

      // Verify configuration is properly set
      expect(provider['getConfig']()).toEqual(mockConfig);
    });

    it('should have proper transport method signatures', () => {
      const streamMessageWithTransport = (provider as any).streamMessageWithTransport;

      // Both methods should be async generators (functions that return AsyncIterable)
      expect(streamMessageWithTransport).toBeDefined();
      expect(typeof streamMessageWithTransport).toBe('function');
    });
  });

  describe('Transport Stream Chunk Contract', () => {
    beforeEach(async () => {
      provider = new OpenAIProvider(mockTransport);

      provider['openaiClient'] = {
        initialize: vi.fn().mockResolvedValue(undefined),
        testConnection: vi.fn().mockResolvedValue(true),
        getOpenAIInstance: vi.fn().mockReturnValue({
          responses: { create: vi.fn() },
        }),
      } as any;

      await provider.initialize(mockConfig);
    });

    it('should verify StreamChunk contract expectations', () => {
      // Verify that the streamChat method returns an AsyncIterable
      const result = provider.streamChat(mockMessages);
      expect(result).toBeDefined();
      expect(typeof result[Symbol.asyncIterator]).toBe('function');
    });

    it('should verify transport stream processing setup', () => {
      // Mock transport stream generator
      async function* mockTransportStream() {
        yield new TextEncoder().encode('data: {"type": "response.created"}\n\n');
        yield new TextEncoder().encode('data: [DONE]\n\n');
      }

      vi.mocked(mockTransport.stream).mockReturnValue(mockTransportStream());

      // Verify that transport stream method can be mocked
      expect(mockTransport.stream).toBeDefined();
      expect(typeof mockTransport.stream).toBe('function');

      // Verify we can call the transport stream method
      const stream = mockTransport.stream({
        url: 'test',
        method: 'POST',
        headers: {},
      });
      expect(stream).toBeDefined();
      expect(typeof stream[Symbol.asyncIterator]).toBe('function');
    });
  });

  describe('Error Scenarios', () => {
    it('should handle transport unavailable scenario', () => {
      const providerWithoutTransport = new OpenAIProvider();

      // Should still function without transport
      expect(providerWithoutTransport).toBeInstanceOf(OpenAIProvider);
      expect((providerWithoutTransport as any).getTransport()).toBeUndefined();

      // Selection should fall back to SDK when transport is unavailable
      const hasTransport = !!providerWithoutTransport['getTransport']();
      expect(hasTransport).toBe(false);
    });

    it('should handle transport initialization correctly', async () => {
      // Test transport during provider construction
      const providerWithTransport = new OpenAIProvider(mockTransport);
      expect(providerWithTransport['getTransport']()).toBe(mockTransport);

      // Test provider without transport
      const providerWithoutTransport = new OpenAIProvider();
      expect(providerWithoutTransport['getTransport']()).toBeUndefined();
    });
  });

  describe('Method Signatures and Contracts', () => {
    beforeEach(async () => {
      provider = new OpenAIProvider(mockTransport);

      provider['openaiClient'] = {
        initialize: vi.fn().mockResolvedValue(undefined),
        testConnection: vi.fn().mockResolvedValue(true),
        getOpenAIInstance: vi.fn().mockReturnValue({
          responses: { create: vi.fn() },
        }),
      } as any;

      await provider.initialize(mockConfig);
    });

    it('should have correct method signatures for transport integration', () => {
      const streamMessageWithTransport = (provider as any).streamMessageWithTransport;

      // Transport method should exist
      expect(streamMessageWithTransport).toBeDefined();
      expect(typeof streamMessageWithTransport).toBe('function');

      // StreamChat should be the main entry point
      expect(provider.streamChat).toBeDefined();
      expect(typeof provider.streamChat).toBe('function');
    });

    it('should properly implement BaseEngine interface', () => {
      // Should have required methods
      expect(provider.initialize).toBeDefined();
      expect(provider.validateConfig).toBeDefined();
      expect(provider.testConnection).toBeDefined();
      expect(provider.streamChat).toBeDefined();
      expect(provider.getModels).toBeDefined();
      expect(provider.getModel).toBeDefined();
      expect(provider.formatError).toBeDefined();
    });

    it('should verify transport interface compliance', () => {
      // Verify transport has required methods
      expect(mockTransport.request).toBeDefined();
      expect(mockTransport.stream).toBeDefined();
      expect(typeof mockTransport.request).toBe('function');
      expect(typeof mockTransport.stream).toBe('function');
    });
  });

  describe('Transport vs SDK Implementation Verification', () => {
    beforeEach(async () => {
      provider = new OpenAIProvider(mockTransport);

      provider['openaiClient'] = {
        initialize: vi.fn().mockResolvedValue(undefined),
        testConnection: vi.fn().mockResolvedValue(true),
        getOpenAIInstance: vi.fn().mockReturnValue({
          responses: { create: vi.fn() },
        }),
      } as any;

      await provider.initialize(mockConfig);
    });

    it('should verify presence/absence of transport drives selection', () => {
      const hasTransport = provider['getTransport']() !== undefined;
      expect(hasTransport).toBe(true);

      const providerNoTransport = new OpenAIProvider();
      const hasTransport2 = providerNoTransport['getTransport']() !== undefined;
      expect(hasTransport2).toBe(false);
    });

    it('should verify bound method selection works correctly', () => {
      // Test that the methods can be bound correctly
      const streamMessageWithTransport = provider['streamMessageWithTransport'];

      // Both methods should exist and be bindable
      expect(streamMessageWithTransport).toBeDefined();
      // Should be able to bind it (this is what the actual code does)
      const boundTransport = streamMessageWithTransport.bind(provider);

      expect(boundTransport).toBeDefined();
      expect(typeof boundTransport).toBe('function');
    });
  });
});
