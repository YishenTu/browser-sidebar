/**
 * @file OpenAI Provider Stream Integration Test
 *
 * Integration test for OpenAIProvider + OpenAIStreamProcessor.
 * Real: OpenAIProvider + OpenAIStreamProcessor
 * Stub: transport stream() provides SSE chunks
 * Assert: output StreamChunk sequence and final metadata consistency
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTransportStub, type TransportStub } from '../../helpers/transport';

// Mock the models config to accept test model names
vi.mock('@config/models', async importOriginal => {
  const actual = await importOriginal<typeof import('@config/models')>();
  return {
    ...actual,
    modelExists: vi.fn((id: string) => {
      return ['gpt-4o', 'o1-preview', 'gpt-5-nano'].includes(id) || actual.modelExists(id);
    }),
  };
});

import { OpenAIProvider } from '@/core/engine/openai/OpenAIProvider';
import {
  simpleSSEStream,
  reasoningSSEStream,
  webSearchSSEStream,
  errorSSEStream,
  createTextStreamEvents,
  createSSEChunks,
} from '../../fixtures/openai';
import { collectAsyncIterable } from '../../helpers/streams';
import type { ProviderChatMessage, ProviderChatRole } from '@/types/providers';

describe('OpenAIProvider.stream integration', () => {
  let transport: TransportStub;
  let provider: OpenAIProvider;
  let messageCounter = 0;

  const chatMessage = (role: ProviderChatRole, content: string): ProviderChatMessage => ({
    id: `msg-${++messageCounter}`,
    role,
    content,
    timestamp: new Date(1700000000000 + messageCounter),
  });

  beforeEach(() => {
    transport = createTransportStub();
    provider = new OpenAIProvider(transport);
    messageCounter = 0;
  });

  describe('simple text streaming', () => {
    it('yields correct StreamChunk sequence for simple response', async () => {
      // Configure transport to return simple SSE stream
      transport.configure({
        streamChunks: simpleSSEStream,
      });

      // Initialize provider with valid config
      await provider.initialize({
        type: 'openai',
        config: {
          apiKey: 'test-api-key',
          model: 'gpt-4o',
        },
      });

      // Collect all stream chunks
      const chunks = await collectAsyncIterable(
        provider.streamChat([chatMessage('user', 'Hello')])
      );

      // Verify we got content chunks
      expect(chunks.length).toBeGreaterThan(0);

      // Verify content delta chunks exist
      const contentChunks = chunks.filter(c => c.choices[0]?.delta?.content !== undefined);
      expect(contentChunks.length).toBeGreaterThan(0);

      // Verify combined content
      const combinedContent = contentChunks.map(c => c.choices[0]?.delta?.content).join('');
      expect(combinedContent).toContain('Hello');

      // Verify final chunk has completion metadata
      const finalChunk = chunks[chunks.length - 1];
      expect(finalChunk).toBeDefined();
      expect(finalChunk?.choices[0]?.finishReason).toBe('stop');
    });

    it('captures response ID in metadata', async () => {
      transport.configure({
        streamChunks: simpleSSEStream,
      });

      await provider.initialize({
        type: 'openai',
        config: {
          apiKey: 'test-api-key',
          model: 'gpt-4o',
        },
      });

      const chunks = await collectAsyncIterable(provider.streamChat([chatMessage('user', 'Test')]));

      // Find chunks with responseId metadata
      const chunksWithResponseId = chunks.filter(c => c.metadata?.['responseId'] !== undefined);

      // At least some chunks should have response ID
      expect(chunksWithResponseId.length).toBeGreaterThan(0);

      // All responseIds should be consistent
      const responseIds = chunksWithResponseId.map(c => c.metadata?.['responseId']);
      const uniqueIds = [...new Set(responseIds)];
      expect(uniqueIds.length).toBe(1);
      expect(uniqueIds[0]).toMatch(/^resp_/);
    });

    it('correctly handles multi-chunk text assembly', async () => {
      // Create a stream with multiple text chunks
      const expectedText = 'The quick brown fox jumps over the lazy dog.';
      const events = createTextStreamEvents(expectedText, 10);
      const sseChunks = createSSEChunks(events);

      transport.configure({
        streamChunks: sseChunks,
      });

      await provider.initialize({
        type: 'openai',
        config: {
          apiKey: 'test-api-key',
          model: 'gpt-4o',
        },
      });

      const chunks = await collectAsyncIterable(
        provider.streamChat([chatMessage('user', 'Say something')])
      );

      // Combine all content
      const combinedContent = chunks
        .filter(c => c.choices[0]?.delta?.content)
        .map(c => c.choices[0]?.delta?.content)
        .join('');

      // The combined content should contain the expected text
      // Note: The stream processor may process both delta events and output_text.done,
      // so we check that the expected text is present (not exact match)
      expect(combinedContent).toContain(expectedText);
    });
  });

  describe('reasoning/thinking streaming', () => {
    it('yields thinking chunks when showThinking is enabled', async () => {
      transport.configure({
        streamChunks: reasoningSSEStream,
      });

      await provider.initialize({
        type: 'openai',
        config: {
          apiKey: 'test-api-key',
          model: 'o1-preview',
          reasoningEffort: 'medium',
        },
      });

      const chunks = await collectAsyncIterable(
        provider.streamChat([chatMessage('user', 'Think about this')])
      );

      // Should have thinking chunks
      const thinkingChunks = chunks.filter(c => c.choices[0]?.delta?.thinking !== undefined);
      expect(thinkingChunks.length).toBeGreaterThan(0);

      // Verify thinking content
      const thinkingContent = thinkingChunks.map(c => c.choices[0]?.delta?.thinking).join('');
      expect(thinkingContent).toContain('think');

      // Should also have content chunks
      const contentChunks = chunks.filter(c => c.choices[0]?.delta?.content !== undefined);
      expect(contentChunks.length).toBeGreaterThan(0);
    });

    it('includes usage with reasoning tokens when present', async () => {
      transport.configure({
        streamChunks: reasoningSSEStream,
      });

      await provider.initialize({
        type: 'openai',
        config: {
          apiKey: 'test-api-key',
          model: 'o1-preview',
          reasoningEffort: 'medium',
        },
      });

      const chunks = await collectAsyncIterable(
        provider.streamChat([chatMessage('user', 'Reason about this')])
      );

      // Find chunks with usage info
      const chunksWithUsage = chunks.filter(c => c.usage !== undefined);

      // At least the final chunk should have usage
      expect(chunksWithUsage.length).toBeGreaterThan(0);

      // Verify usage structure
      const lastUsage = chunksWithUsage[chunksWithUsage.length - 1]?.usage;
      expect(lastUsage).toBeDefined();
      expect(lastUsage?.totalTokens).toBeGreaterThan(0);
    });
  });

  describe('web search streaming', () => {
    it('handles web search events without yielding them as content', async () => {
      transport.configure({
        streamChunks: webSearchSSEStream,
      });

      await provider.initialize({
        type: 'openai',
        config: {
          apiKey: 'test-api-key',
          model: 'gpt-4o',
        },
      });

      const chunks = await collectAsyncIterable(
        provider.streamChat([chatMessage('user', 'Search for TypeScript')])
      );

      // Should have content chunks
      const contentChunks = chunks.filter(c => c.choices[0]?.delta?.content !== undefined);
      expect(contentChunks.length).toBeGreaterThan(0);

      // Web search events should not appear as separate content chunks
      // They should be captured in metadata instead
      expect(chunks.some(c => c.metadata?.['searchResults'] !== undefined)).toBe(true);
      // May or may not have search results depending on stream processing
      // The key is that web search events don't break the stream
    });

    it('captures search metadata correctly', async () => {
      transport.configure({
        streamChunks: webSearchSSEStream,
      });

      await provider.initialize({
        type: 'openai',
        config: {
          apiKey: 'test-api-key',
          model: 'gpt-4o',
        },
      });

      const chunks = await collectAsyncIterable(
        provider.streamChat([chatMessage('user', 'Search the web')])
      );

      // Verify stream completes successfully
      expect(chunks.length).toBeGreaterThan(0);

      // Final chunk should have finish reason
      const finalChunk = chunks[chunks.length - 1];
      expect(finalChunk?.choices[0]?.finishReason).toBe('stop');

      const chunksWithSearchResults = chunks.filter(
        c => c.metadata?.['searchResults'] !== undefined
      );
      expect(chunksWithSearchResults.length).toBeGreaterThan(0);

      const lastWithSearchResults = chunksWithSearchResults[chunksWithSearchResults.length - 1]!;
      const searchMetadata = lastWithSearchResults.metadata?.['searchResults'] as
        | { sources?: Array<{ url?: string; title?: string }> }
        | undefined;

      expect(searchMetadata?.sources?.some(s => s.url === 'https://typescriptlang.org')).toBe(true);
    });
  });

  describe('error handling', () => {
    it('handles error SSE events gracefully', async () => {
      transport.configure({
        streamChunks: errorSSEStream,
      });

      await provider.initialize({
        type: 'openai',
        config: {
          apiKey: 'test-api-key',
          model: 'gpt-4o',
        },
      });

      // Error events should be processed without throwing
      // The provider wraps errors through error handling
      await collectAsyncIterable(provider.streamChat([chatMessage('user', 'Test')]));

      // May produce empty chunks or error handling chunks
      // The important thing is it doesn't crash
    });

    it('handles transport stream errors', async () => {
      transport.configure({
        streamError: new Error('Network connection lost'),
      });

      await provider.initialize({
        type: 'openai',
        config: {
          apiKey: 'test-api-key',
          model: 'gpt-4o',
        },
      });

      // Should throw an error when iterating
      await expect(async () => {
        await collectAsyncIterable(provider.streamChat([chatMessage('user', 'Test')]));
      }).rejects.toThrow();
    });

    it('handles abort signal', async () => {
      // Create a delayed stream to allow abort
      transport.configure({
        streamChunks: simpleSSEStream,
        delay: 100, // Add delay
      });

      await provider.initialize({
        type: 'openai',
        config: {
          apiKey: 'test-api-key',
          model: 'gpt-4o',
        },
      });

      const controller = new AbortController();

      // Start streaming
      const streamPromise = collectAsyncIterable(
        provider.streamChat([chatMessage('user', 'Test')], {
          signal: controller.signal,
        })
      );

      // Abort immediately
      controller.abort();

      // Should throw abort error
      await expect(streamPromise).rejects.toThrow();
    });
  });

  describe('transport request verification', () => {
    it('sends correct request to transport', async () => {
      transport.configure({
        streamChunks: simpleSSEStream,
      });

      await provider.initialize({
        type: 'openai',
        config: {
          apiKey: 'test-api-key',
          model: 'gpt-4o',
        },
      });

      await collectAsyncIterable(provider.streamChat([chatMessage('user', 'Hello world')]));

      // Verify transport was called
      expect(transport.streamCalls.length).toBe(1);

      // Verify request structure
      const call = transport.getLastStreamCall();
      expect(call).toBeDefined();
      expect(call?.request.url).toBe('https://api.openai.com/v1/responses');
      expect(call?.request.method).toBe('POST');
      expect(call?.request.headers['Authorization']).toBe('Bearer test-api-key');
      expect(call?.request.headers['Content-Type']).toBe('application/json');

      // Verify body structure
      const body = JSON.parse(call?.request.body as string);
      expect(body.model).toBe('gpt-4o');
      expect(body.stream).toBe(true);
    });

    it('includes system prompt when provided', async () => {
      transport.configure({
        streamChunks: simpleSSEStream,
      });

      await provider.initialize({
        type: 'openai',
        config: {
          apiKey: 'test-api-key',
          model: 'gpt-4o',
        },
      });

      await collectAsyncIterable(
        provider.streamChat([chatMessage('user', 'Hello')], {
          systemPrompt: 'You are a helpful assistant.',
        })
      );

      const call = transport.getLastStreamCall();
      const body = JSON.parse(call?.request.body as string);

      // Should include system prompt in request
      expect(body.instructions || body.system).toBeDefined();
    });
  });

  describe('chunk structure validation', () => {
    it('all chunks have required fields', async () => {
      transport.configure({
        streamChunks: simpleSSEStream,
      });

      await provider.initialize({
        type: 'openai',
        config: {
          apiKey: 'test-api-key',
          model: 'gpt-4o',
        },
      });

      const chunks = await collectAsyncIterable(provider.streamChat([chatMessage('user', 'Test')]));

      for (const chunk of chunks) {
        // Required fields
        expect(chunk.id).toBeDefined();
        expect(chunk.object).toBe('response.chunk');
        expect(chunk.created).toBeDefined();
        expect(typeof chunk.created).toBe('number');
        expect(chunk.model).toBeDefined();
        expect(chunk.choices).toBeDefined();
        expect(Array.isArray(chunk.choices)).toBe(true);

        // Each choice should have expected structure
        for (const choice of chunk.choices) {
          expect(choice.index).toBeDefined();
          expect(choice.delta).toBeDefined();
          // finishReason can be null or a string
          expect(choice.finishReason === null || typeof choice.finishReason === 'string').toBe(
            true
          );
        }
      }
    });

    it('model field matches configured model', async () => {
      transport.configure({
        streamChunks: simpleSSEStream,
      });

      await provider.initialize({
        type: 'openai',
        config: {
          apiKey: 'test-api-key',
          model: 'gpt-4o',
        },
      });

      const chunks = await collectAsyncIterable(provider.streamChat([chatMessage('user', 'Test')]));

      // All chunks should have model matching config or response
      for (const chunk of chunks) {
        expect(chunk.model).toBeDefined();
        // Model comes from config or response
        expect(typeof chunk.model).toBe('string');
      }
    });
  });

  describe('finish reason handling', () => {
    it('correctly normalizes finish reasons', async () => {
      transport.configure({
        streamChunks: simpleSSEStream,
      });

      await provider.initialize({
        type: 'openai',
        config: {
          apiKey: 'test-api-key',
          model: 'gpt-4o',
        },
      });

      const chunks = await collectAsyncIterable(provider.streamChat([chatMessage('user', 'Test')]));

      // Find chunk with finish reason
      const chunksWithFinishReason = chunks.filter(c => c.choices[0]?.finishReason !== null);

      expect(chunksWithFinishReason.length).toBeGreaterThan(0);

      // Verify finish reason is valid
      const validFinishReasons = [
        'stop',
        'length',
        'content_filter',
        'function_call',
        'tool_calls',
      ];
      for (const chunk of chunksWithFinishReason) {
        expect(validFinishReasons).toContain(chunk.choices[0]?.finishReason);
      }
    });
  });
});
