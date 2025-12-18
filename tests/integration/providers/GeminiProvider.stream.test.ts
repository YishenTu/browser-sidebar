/**
 * @file Gemini Provider Stream Integration Test
 *
 * Integration test for GeminiProvider + GeminiStreamProcessor + response parsing.
 * Real: GeminiProvider + GeminiStreamProcessor + response parsing
 * Stub: transport stream() provides mixed chunk patterns
 * Assert: finish chunk behavior and no missing deltas
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTransportStub, type TransportStub } from '../../helpers/transport';

// Mock the models config to accept test model names
vi.mock('@config/models', async importOriginal => {
  const actual = await importOriginal<typeof import('@config/models')>();
  return {
    ...actual,
    modelExists: vi.fn((id: string) => {
      return (
        ['gemini-2.5-flash-lite', 'gemini-2.5-pro', 'gemini-3-flash'].includes(id) ||
        actual.modelExists(id)
      );
    }),
  };
});

import { GeminiProvider } from '@/core/engine/gemini/GeminiProvider';
import {
  simpleSSEStream,
  thinkingSSEStream,
  simpleNDJSONStream,
  partialJsonArrayChunks,
  splitMidKeyChunks,
  escapedStringSplitChunks,
  nestedBracesChunks,
  sseWithBlankLines,
  streamWithDoneMarker,
  createStreamSequence,
  createSSEFromResponses,
  createNDJSONFromResponses,
} from '../../fixtures/gemini';
import { collectAsyncIterable } from '../../helpers/streams';
import type { ProviderChatMessage, ProviderChatRole } from '@/types/providers';

describe('GeminiProvider.stream integration', () => {
  let transport: TransportStub;
  let provider: GeminiProvider;
  let messageCounter = 0;

  const chatMessage = (role: ProviderChatRole, content: string): ProviderChatMessage => ({
    id: `msg-${++messageCounter}`,
    role,
    content,
    timestamp: new Date(1700000000000 + messageCounter),
  });

  beforeEach(() => {
    messageCounter = 0;
    transport = createTransportStub();
    provider = new GeminiProvider(transport);
  });

  describe('SSE streaming', () => {
    it('yields correct StreamChunk sequence for simple SSE response', async () => {
      transport.configure({
        streamChunks: simpleSSEStream,
      });

      await provider.initialize({
        type: 'gemini',
        config: {
          apiKey: 'test-api-key',
          model: 'gemini-2.5-flash-lite',
        },
      });

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
      const finalChunks = chunks.filter(c => c.choices[0]?.finishReason !== null);
      expect(finalChunks.length).toBeGreaterThan(0);
    });

    it('handles SSE with blank line delimiters', async () => {
      transport.configure({
        streamChunks: sseWithBlankLines,
      });

      await provider.initialize({
        type: 'gemini',
        config: {
          apiKey: 'test-api-key',
          model: 'gemini-2.5-flash-lite',
        },
      });

      const chunks = await collectAsyncIterable(provider.streamChat([chatMessage('user', 'Test')]));

      // Should parse both events separated by blank lines
      const contentChunks = chunks.filter(c => c.choices[0]?.delta?.content !== undefined);
      expect(contentChunks.length).toBeGreaterThanOrEqual(2);
    });

    it('handles [DONE] marker correctly', async () => {
      transport.configure({
        streamChunks: streamWithDoneMarker,
      });

      await provider.initialize({
        type: 'gemini',
        config: {
          apiKey: 'test-api-key',
          model: 'gemini-2.5-flash-lite',
        },
      });

      const chunks = await collectAsyncIterable(provider.streamChat([chatMessage('user', 'Test')]));

      const contentChunks = chunks.filter(c => c.choices[0]?.delta?.content !== undefined);
      expect(contentChunks.length).toBeGreaterThan(0);

      const combinedContent = contentChunks.map(c => c.choices[0]?.delta?.content).join('');
      expect(combinedContent).toContain('Hello');
    });
  });

  describe('NDJSON streaming', () => {
    it('yields correct StreamChunk sequence for NDJSON response', async () => {
      transport.configure({
        streamChunks: simpleNDJSONStream,
      });

      await provider.initialize({
        type: 'gemini',
        config: {
          apiKey: 'test-api-key',
          model: 'gemini-2.5-flash-lite',
        },
      });

      const chunks = await collectAsyncIterable(
        provider.streamChat([chatMessage('user', 'Hello')])
      );

      // Verify we got chunks
      expect(chunks.length).toBeGreaterThan(0);

      // Verify content
      const contentChunks = chunks.filter(c => c.choices[0]?.delta?.content !== undefined);
      expect(contentChunks.length).toBeGreaterThan(0);
    });
  });

  describe('JSON array streaming', () => {
    it('handles partial JSON array chunks', async () => {
      transport.configure({
        streamChunks: partialJsonArrayChunks,
      });

      await provider.initialize({
        type: 'gemini',
        config: {
          apiKey: 'test-api-key',
          model: 'gemini-2.5-flash-lite',
        },
      });

      const chunks = await collectAsyncIterable(provider.streamChat([chatMessage('user', 'Test')]));

      // Should assemble partial chunks into complete responses
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('handles JSON split mid-key', async () => {
      transport.configure({
        streamChunks: splitMidKeyChunks,
      });

      await provider.initialize({
        type: 'gemini',
        config: {
          apiKey: 'test-api-key',
          model: 'gemini-2.5-flash-lite',
        },
      });

      const chunks = await collectAsyncIterable(provider.streamChat([chatMessage('user', 'Test')]));

      // Should correctly parse despite split
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('handles escaped strings split across chunks', async () => {
      transport.configure({
        streamChunks: escapedStringSplitChunks,
      });

      await provider.initialize({
        type: 'gemini',
        config: {
          apiKey: 'test-api-key',
          model: 'gemini-2.5-flash-lite',
        },
      });

      const chunks = await collectAsyncIterable(provider.streamChat([chatMessage('user', 'Test')]));

      // Should handle escaped quotes and newlines
      expect(chunks.length).toBeGreaterThan(0);

      // Verify content includes escaped characters when parsed
      const contentChunks = chunks.filter(c => c.choices[0]?.delta?.content !== undefined);
      expect(contentChunks.length).toBeGreaterThan(0);

      const combinedContent = contentChunks.map(c => c.choices[0]?.delta?.content).join('');
      expect(combinedContent).toContain('Hello"World');
      expect(combinedContent).toContain('New line');
    });

    it('handles nested braces without false object end', async () => {
      transport.configure({
        streamChunks: nestedBracesChunks,
      });

      await provider.initialize({
        type: 'gemini',
        config: {
          apiKey: 'test-api-key',
          model: 'gemini-2.5-flash-lite',
        },
      });

      const chunks = await collectAsyncIterable(provider.streamChat([chatMessage('user', 'Test')]));

      // Should correctly track brace depth
      expect(chunks.length).toBeGreaterThan(0);

      // Content should include the full code with nested braces
      const contentChunks = chunks.filter(c => c.choices[0]?.delta?.content !== undefined);
      expect(contentChunks.length).toBeGreaterThan(0);

      const combinedContent = contentChunks.map(c => c.choices[0]?.delta?.content).join('');
      expect(combinedContent).toContain('function');
    });
  });

  describe('thinking/reasoning streaming', () => {
    it('yields thinking chunks when present', async () => {
      transport.configure({
        streamChunks: thinkingSSEStream,
      });

      await provider.initialize({
        type: 'gemini',
        config: {
          apiKey: 'test-api-key',
          model: 'gemini-2.5-pro',
          thinkingBudget: 1024,
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

    it('handles thought signature in stream', async () => {
      transport.configure({
        streamChunks: thinkingSSEStream,
      });

      await provider.initialize({
        type: 'gemini',
        config: {
          apiKey: 'test-api-key',
          model: 'gemini-3-flash',
          thinkingBudget: 1024,
        },
      });

      const chunks = await collectAsyncIterable(provider.streamChat([chatMessage('user', 'Test')]));

      // Stream should complete successfully with thought signatures
      expect(chunks.length).toBeGreaterThan(0);

      // Final chunk should have finish reason
      const chunksWithFinish = chunks.filter(c => c.choices[0]?.finishReason !== null);
      expect(chunksWithFinish.length).toBeGreaterThan(0);
    });
  });

  describe('generated stream sequences', () => {
    it('handles multi-chunk text streaming correctly', async () => {
      const text =
        'This is a longer response that will be split into multiple chunks for streaming.';
      const responses = createStreamSequence(text, { chunkSize: 15 });
      const sseChunks = createSSEFromResponses(responses);

      transport.configure({
        streamChunks: sseChunks,
      });

      await provider.initialize({
        type: 'gemini',
        config: {
          apiKey: 'test-api-key',
          model: 'gemini-2.5-flash-lite',
        },
      });

      const chunks = await collectAsyncIterable(
        provider.streamChat([chatMessage('user', 'Generate text')])
      );

      // Combine all content
      const combinedContent = chunks
        .filter(c => c.choices[0]?.delta?.content)
        .map(c => c.choices[0]?.delta?.content)
        .join('');

      expect(combinedContent).toBe(text);
    });

    it('handles stream with thinking included', async () => {
      const text = 'The final answer is here.';
      const responses = createStreamSequence(text, {
        chunkSize: 10,
        includeThinking: true,
      });
      const sseChunks = createSSEFromResponses(responses);

      transport.configure({
        streamChunks: sseChunks,
      });

      await provider.initialize({
        type: 'gemini',
        config: {
          apiKey: 'test-api-key',
          model: 'gemini-2.5-pro',
          thinkingBudget: 512,
        },
      });

      const chunks = await collectAsyncIterable(
        provider.streamChat([chatMessage('user', 'Think and respond')])
      );

      // Should have both thinking and content
      const thinkingChunks = chunks.filter(c => c.choices[0]?.delta?.thinking !== undefined);
      const contentChunks = chunks.filter(c => c.choices[0]?.delta?.content !== undefined);

      expect(thinkingChunks.length).toBeGreaterThan(0);
      expect(contentChunks.length).toBeGreaterThan(0);

      // Verify final content
      const combinedContent = contentChunks.map(c => c.choices[0]?.delta?.content).join('');
      expect(combinedContent).toBe(text);
    });

    it('handles NDJSON format correctly', async () => {
      const text = 'NDJSON response content here.';
      const responses = createStreamSequence(text, { chunkSize: 10 });
      const ndjsonChunks = createNDJSONFromResponses(responses);

      transport.configure({
        streamChunks: ndjsonChunks,
      });

      await provider.initialize({
        type: 'gemini',
        config: {
          apiKey: 'test-api-key',
          model: 'gemini-2.5-flash-lite',
        },
      });

      const chunks = await collectAsyncIterable(
        provider.streamChat([chatMessage('user', 'Test NDJSON')])
      );

      const combinedContent = chunks
        .filter(c => c.choices[0]?.delta?.content)
        .map(c => c.choices[0]?.delta?.content)
        .join('');

      expect(combinedContent).toBe(text);
    });
  });

  describe('error handling', () => {
    it('handles transport stream errors', async () => {
      transport.configure({
        streamError: new Error('Stream connection failed'),
      });

      await provider.initialize({
        type: 'gemini',
        config: {
          apiKey: 'test-api-key',
          model: 'gemini-2.5-flash-lite',
        },
      });

      await expect(async () => {
        await collectAsyncIterable(provider.streamChat([chatMessage('user', 'Test')]));
      }).rejects.toThrow();
    });

    it('handles abort signal', async () => {
      transport.configure({
        streamChunks: simpleSSEStream,
        delay: 100,
      });

      await provider.initialize({
        type: 'gemini',
        config: {
          apiKey: 'test-api-key',
          model: 'gemini-2.5-flash-lite',
        },
      });

      const controller = new AbortController();

      const streamPromise = collectAsyncIterable(
        provider.streamChat([chatMessage('user', 'Test')], {
          signal: controller.signal,
        })
      );

      // Abort immediately
      controller.abort();

      await expect(streamPromise).rejects.toThrow();
    });
  });

  describe('transport request verification', () => {
    it('sends correct request to transport', async () => {
      transport.configure({
        streamChunks: simpleSSEStream,
      });

      await provider.initialize({
        type: 'gemini',
        config: {
          apiKey: 'test-api-key',
          model: 'gemini-2.5-flash-lite',
        },
      });

      await collectAsyncIterable(provider.streamChat([chatMessage('user', 'Hello world')]));

      // Verify transport was called
      expect(transport.streamCalls.length).toBe(1);

      // Verify request structure
      const call = transport.getLastStreamCall();
      expect(call).toBeDefined();
      expect(call?.request.url).toContain('generativelanguage.googleapis.com');
      expect(call?.request.url).toContain('gemini-2.5-flash-lite');
      expect(call?.request.url).toContain('streamGenerateContent');
      expect(call?.request.url).toContain('alt=sse');
      expect(call?.request.url).toContain('key=test-api-key');
      expect(call?.request.method).toBe('POST');
      expect(call?.request.headers['x-goog-api-key']).toBe('test-api-key');
      expect(call?.request.headers['Content-Type']).toBe('application/json');

      // Verify body structure
      const body = JSON.parse(call?.request.body as string);
      expect(body.contents).toBeDefined();
      expect(Array.isArray(body.contents)).toBe(true);
    });

    it('includes generation config when provided', async () => {
      transport.configure({
        streamChunks: simpleSSEStream,
      });

      await provider.initialize({
        type: 'gemini',
        config: {
          apiKey: 'test-api-key',
          model: 'gemini-2.5-pro',
          thinkingBudget: 2048,
        },
      });

      await collectAsyncIterable(provider.streamChat([chatMessage('user', 'Test')]));

      const call = transport.getLastStreamCall();
      const body = JSON.parse(call?.request.body as string);

      // Should include generation config
      expect(body.generationConfig).toBeDefined();
    });
  });

  describe('chunk structure validation', () => {
    it('all chunks have required fields', async () => {
      transport.configure({
        streamChunks: simpleSSEStream,
      });

      await provider.initialize({
        type: 'gemini',
        config: {
          apiKey: 'test-api-key',
          model: 'gemini-2.5-flash-lite',
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
        }
      }
    });

    it('finish reason is valid when present', async () => {
      transport.configure({
        streamChunks: simpleSSEStream,
      });

      await provider.initialize({
        type: 'gemini',
        config: {
          apiKey: 'test-api-key',
          model: 'gemini-2.5-flash-lite',
        },
      });

      const chunks = await collectAsyncIterable(provider.streamChat([chatMessage('user', 'Test')]));

      // Find chunks with finish reason
      const chunksWithFinishReason = chunks.filter(c => c.choices[0]?.finishReason !== null);

      // Valid Gemini finish reasons
      const validFinishReasons = [
        'stop',
        'STOP',
        'length',
        'content_filter',
        'safety',
        'recitation',
      ];

      for (const chunk of chunksWithFinishReason) {
        const reason = chunk.choices[0]?.finishReason;
        expect(validFinishReasons.includes(reason!) || reason === 'stop').toBe(true);
      }
    });
  });

  describe('no missing deltas', () => {
    it('does not drop any content deltas', async () => {
      const expectedText = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const responses = createStreamSequence(expectedText, { chunkSize: 1 });
      const sseChunks = createSSEFromResponses(responses);

      transport.configure({
        streamChunks: sseChunks,
      });

      await provider.initialize({
        type: 'gemini',
        config: {
          apiKey: 'test-api-key',
          model: 'gemini-2.5-flash-lite',
        },
      });

      const chunks = await collectAsyncIterable(
        provider.streamChat([chatMessage('user', 'Alphabet')])
      );

      // Combine all content
      const combinedContent = chunks
        .filter(c => c.choices[0]?.delta?.content)
        .map(c => c.choices[0]?.delta?.content)
        .join('');

      // Should have all characters in order
      expect(combinedContent).toBe(expectedText);
    });

    it('preserves order of chunks', async () => {
      const orderedParts = ['First', ' Second', ' Third', ' Fourth', ' Fifth'];
      const responses = orderedParts.map((text, index) => ({
        candidates: [
          {
            content: { parts: [{ text }], role: 'model' },
            index: 0,
            finishReason: index === orderedParts.length - 1 ? 'STOP' : undefined,
          },
        ],
        usageMetadata:
          index === orderedParts.length - 1
            ? { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 }
            : undefined,
      }));
      const sseChunks = createSSEFromResponses(responses);

      transport.configure({
        streamChunks: sseChunks,
      });

      await provider.initialize({
        type: 'gemini',
        config: {
          apiKey: 'test-api-key',
          model: 'gemini-2.5-flash-lite',
        },
      });

      const chunks = await collectAsyncIterable(
        provider.streamChat([chatMessage('user', 'Test ordering')])
      );

      const contentChunks = chunks
        .filter(c => c.choices[0]?.delta?.content)
        .map(c => c.choices[0]?.delta?.content);

      // Verify order is preserved
      expect(contentChunks).toEqual(orderedParts);
    });
  });
});
