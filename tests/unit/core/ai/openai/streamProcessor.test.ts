/**
 * @file OpenAI Stream Processor Tests
 *
 * Tests for the OpenAIStreamProcessor class which handles streaming responses
 * from OpenAI's Responses API.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OpenAIStreamProcessor } from '@core/ai/openai/streamProcessor';
import type { OpenAIStreamEvent } from '@core/ai/openai/types';

describe('OpenAIStreamProcessor', () => {
  let processor: OpenAIStreamProcessor;
  const defaultModel = 'gpt-4o';

  beforeEach(() => {
    processor = new OpenAIStreamProcessor(defaultModel, false);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
  });

  describe('reasoning delta streaming', () => {
    it('should emit thinking chunks when showThinking is true', () => {
      processor = new OpenAIStreamProcessor(defaultModel, true);

      const event: OpenAIStreamEvent = {
        type: 'response.reasoning_summary_text.delta',
        delta: 'Analyzing the question...',
        id: 'resp-123',
        created: 1705320000,
        model: defaultModel,
      };

      const chunk = processor.processEvent(event);

      expect(chunk).not.toBeNull();
      expect(chunk?.choices[0]?.delta?.thinking).toBe('Analyzing the question...');
    });

    it('should not emit thinking chunks when showThinking is false', () => {
      processor = new OpenAIStreamProcessor(defaultModel, false);

      const event: OpenAIStreamEvent = {
        type: 'response.reasoning_summary_text.delta',
        delta: 'Analyzing the question...',
      };

      const chunk = processor.processEvent(event);
      // When showThinking is false, reasoning events don't produce thinking output
      // but may still produce a chunk due to the generic delta handler
      // The key is that no thinking field should be present
      if (chunk) {
        expect(chunk.choices[0]?.delta?.thinking).toBeUndefined();
      }
    });

    it('should handle non-string delta values in reasoning events', () => {
      processor = new OpenAIStreamProcessor(defaultModel, true);

      const event: OpenAIStreamEvent = {
        type: 'response.reasoning_summary_text.delta',
        delta: 123 as unknown as string, // Edge case: non-string delta
      };

      const chunk = processor.processEvent(event);
      expect(chunk?.choices[0]?.delta?.thinking).toBe('123');
    });
  });

  describe('web search events', () => {
    it('should not yield chunk for web search call completed', () => {
      const event: OpenAIStreamEvent = {
        type: 'response.web_search_call.completed',
      };

      const chunk = processor.processEvent(event);
      expect(chunk).toBeNull();
    });

    it('should extract search metadata from web_search_call output item', () => {
      const event: OpenAIStreamEvent = {
        type: 'response.output_item.done',
        item: {
          type: 'web_search_call',
          action: {
            query: 'test search query',
          },
        },
      };

      processor.processEvent(event);
      const metadata = processor.getSearchMetadata();

      expect(metadata).not.toBeNull();
      expect(metadata?.sources[0]?.title).toContain('test search query');
    });

    it('should extract citations from message annotations', () => {
      const event: OpenAIStreamEvent = {
        type: 'response.output_item.done',
        item: {
          type: 'message',
          content: [
            {
              type: 'output_text',
              text: 'Some response',
              annotations: [
                {
                  type: 'url_citation',
                  url: 'https://example.com',
                  title: 'Example Site',
                },
              ],
            },
          ],
        },
      };

      processor.processEvent(event);
      const metadata = processor.getSearchMetadata();

      expect(metadata).not.toBeNull();
      expect(metadata?.sources[0]?.url).toBe('https://example.com');
      expect(metadata?.sources[0]?.title).toBe('Example Site');
    });
  });

  describe('content delta extraction', () => {
    it('should extract content from output_text.delta events', () => {
      const event: OpenAIStreamEvent = {
        type: 'response.output_text.delta',
        delta: 'Hello, world!',
        id: 'resp-123',
        created: 1705320000,
        model: defaultModel,
      };

      const chunk = processor.processEvent(event);

      expect(chunk).not.toBeNull();
      expect(chunk?.choices[0]?.delta?.content).toBe('Hello, world!');
    });

    it('should extract incremental content from output_text field', () => {
      // First event with cumulative text
      const event1: OpenAIStreamEvent = {
        output_text: 'Hello',
        id: 'resp-123',
        created: 1705320000,
        model: defaultModel,
      };

      const chunk1 = processor.processEvent(event1);
      expect(chunk1?.choices[0]?.delta?.content).toBe('Hello');

      // Second event with more cumulative text
      const event2: OpenAIStreamEvent = {
        output_text: 'Hello, world!',
        id: 'resp-123',
        created: 1705320000,
        model: defaultModel,
      };

      const chunk2 = processor.processEvent(event2);
      expect(chunk2?.choices[0]?.delta?.content).toBe(', world!');
    });

    it('should not emit duplicate content for same cumulative text', () => {
      const event1: OpenAIStreamEvent = {
        output_text: 'Hello',
        id: 'resp-123',
        created: 1705320000,
        model: defaultModel,
      };

      processor.processEvent(event1);

      // Same text again
      const event2: OpenAIStreamEvent = {
        output_text: 'Hello',
        id: 'resp-123',
        created: 1705320000,
        model: defaultModel,
      };

      const chunk2 = processor.processEvent(event2);
      expect(chunk2).toBeNull();
    });

    it('should handle generic delta string field', () => {
      const event: OpenAIStreamEvent = {
        delta: 'Generic delta content',
        id: 'resp-123',
        created: 1705320000,
        model: defaultModel,
      };

      const chunk = processor.processEvent(event);
      expect(chunk?.choices[0]?.delta?.content).toBe('Generic delta content');
    });
  });

  describe('completion events', () => {
    it('should create completion chunk for response.completed', () => {
      const event: OpenAIStreamEvent = {
        type: 'response.completed',
        id: 'resp-123',
        created: 1705320000,
        model: defaultModel,
        usage: {
          input_tokens: 100,
          output_tokens: 50,
        },
      };

      const chunk = processor.processEvent(event);

      expect(chunk).not.toBeNull();
      expect(chunk?.choices[0]?.finishReason).toBe('stop');
      expect(chunk?.usage?.promptTokens).toBe(100);
      expect(chunk?.usage?.completionTokens).toBe(50);
    });

    it('should create completion chunk for finish_reason', () => {
      const event: OpenAIStreamEvent = {
        finish_reason: 'stop',
        id: 'resp-123',
        created: 1705320000,
        model: defaultModel,
      };

      const chunk = processor.processEvent(event);
      expect(chunk?.choices[0]?.finishReason).toBe('stop');
    });

    it('should create completion chunk for status=completed', () => {
      const event: OpenAIStreamEvent = {
        status: 'completed',
        id: 'resp-123',
        created: 1705320000,
        model: defaultModel,
      };

      const chunk = processor.processEvent(event);
      expect(chunk?.choices[0]?.finishReason).toBe('stop');
    });

    it('should include metadata in completion chunk', () => {
      // Set up search metadata first
      const searchEvent: OpenAIStreamEvent = {
        type: 'response.output_item.done',
        item: {
          type: 'message',
          content: [
            {
              type: 'output_text',
              text: 'Response',
              annotations: [
                {
                  type: 'url_citation',
                  url: 'https://example.com',
                  title: 'Example',
                },
              ],
            },
          ],
        },
      };
      processor.processEvent(searchEvent);

      const completionEvent: OpenAIStreamEvent = {
        type: 'response.completed',
        id: 'resp-123',
        response_id: 'resp-final',
        created: 1705320000,
        model: defaultModel,
      };

      const chunk = processor.processEvent(completionEvent);

      expect(chunk?.metadata?.['searchResults']).toBeDefined();
      expect(chunk?.metadata?.['responseId']).toBe('resp-123');
    });
  });

  describe('reasoning completion events', () => {
    it('should return null for reasoning_summary_text.done', () => {
      const event: OpenAIStreamEvent = {
        type: 'response.reasoning_summary_text.done',
      };

      const chunk = processor.processEvent(event);
      expect(chunk).toBeNull();
    });

    it('should return null for reasoning_summary_part.done', () => {
      const event: OpenAIStreamEvent = {
        type: 'response.reasoning_summary_part.done',
      };

      const chunk = processor.processEvent(event);
      expect(chunk).toBeNull();
    });
  });

  describe('standalone reasoning events', () => {
    it('should handle reasoning event type when showThinking is true', () => {
      processor = new OpenAIStreamProcessor(defaultModel, true);

      const event: OpenAIStreamEvent = {
        type: 'reasoning',
        summary: [{ text: 'Standalone reasoning' }] as Array<{ text: string }>,
        id: 'resp-123',
        created: 1705320000,
        model: defaultModel,
      };

      const chunk = processor.processEvent(event);
      expect(chunk?.choices[0]?.delta?.thinking).toBe('Standalone reasoning');
    });

    it('should not emit standalone reasoning when already emitted via delta', () => {
      processor = new OpenAIStreamProcessor(defaultModel, true);

      // First, emit via delta
      const deltaEvent: OpenAIStreamEvent = {
        type: 'response.reasoning_summary_text.delta',
        delta: 'Delta reasoning',
      };
      processor.processEvent(deltaEvent);

      // Then try standalone reasoning - should not emit again
      const standaloneEvent: OpenAIStreamEvent = {
        type: 'reasoning',
        summary: [{ text: 'Standalone reasoning' }] as Array<{ text: string }>,
        id: 'resp-123',
        created: 1705320000,
        model: defaultModel,
      };

      const chunk = processor.processEvent(standaloneEvent);
      expect(chunk).toBeNull();
    });
  });

  describe('reset', () => {
    it('should clear all state when reset is called', () => {
      // Accumulate some state
      processor.processEvent({
        output_text: 'Hello',
        id: 'resp-123',
        created: 1705320000,
        model: defaultModel,
      });

      processor.setSearchMetadata({
        sources: [{ url: 'https://example.com', title: 'Test' }],
      });

      processor.reset();

      expect(processor.getSearchMetadata()).toBeNull();

      // After reset, should start fresh with output_text tracking
      const event: OpenAIStreamEvent = {
        output_text: 'Hello',
        id: 'resp-456',
        created: 1705320000,
        model: defaultModel,
      };

      const chunk = processor.processEvent(event);
      expect(chunk?.choices[0]?.delta?.content).toBe('Hello');
    });
  });

  describe('chunk structure', () => {
    it('should include correct object type', () => {
      const event: OpenAIStreamEvent = {
        type: 'response.output_text.delta',
        delta: 'Test',
        id: 'resp-123',
        created: 1705320000,
        model: defaultModel,
      };

      const chunk = processor.processEvent(event);
      expect(chunk?.object).toBe('response.chunk');
    });

    it('should use fallback id when not provided', () => {
      const event: OpenAIStreamEvent = {
        type: 'response.output_text.delta',
        delta: 'Test',
      };

      const chunk = processor.processEvent(event);
      expect(chunk?.id).toMatch(/^resp-chunk-/);
    });

    it('should use fallback model when not provided in event', () => {
      const event: OpenAIStreamEvent = {
        type: 'response.output_text.delta',
        delta: 'Test',
      };

      const chunk = processor.processEvent(event);
      expect(chunk?.model).toBe(defaultModel);
    });

    it('should include response_id in chunk id', () => {
      const event: OpenAIStreamEvent = {
        type: 'response.output_text.delta',
        delta: 'Test',
        response_id: 'resp-abc',
      };

      const chunk = processor.processEvent(event);
      expect(chunk?.id).toBe('resp-abc');
    });
  });

  describe('usage conversion', () => {
    it('should convert Responses API usage format', () => {
      const event: OpenAIStreamEvent = {
        type: 'response.completed',
        id: 'resp-123',
        created: 1705320000,
        model: defaultModel,
        usage: {
          input_tokens: 100,
          output_tokens: 50,
        },
      };

      const chunk = processor.processEvent(event);

      expect(chunk?.usage?.promptTokens).toBe(100);
      expect(chunk?.usage?.completionTokens).toBe(50);
      expect(chunk?.usage?.totalTokens).toBe(150);
    });

    it('should convert Chat Completions API usage format', () => {
      const event: OpenAIStreamEvent = {
        type: 'response.completed',
        id: 'resp-123',
        created: 1705320000,
        model: defaultModel,
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
        },
      };

      const chunk = processor.processEvent(event);

      expect(chunk?.usage?.promptTokens).toBe(100);
      expect(chunk?.usage?.completionTokens).toBe(50);
      expect(chunk?.usage?.totalTokens).toBe(150);
    });
  });

  describe('finish reason normalization', () => {
    it('should normalize "stop" finish reason', () => {
      const event: OpenAIStreamEvent = {
        finish_reason: 'stop',
        id: 'resp-123',
        created: 1705320000,
        model: defaultModel,
      };

      const chunk = processor.processEvent(event);
      expect(chunk?.choices[0]?.finishReason).toBe('stop');
    });

    it('should normalize "length" finish reason', () => {
      const event: OpenAIStreamEvent = {
        finish_reason: 'length',
        id: 'resp-123',
        created: 1705320000,
        model: defaultModel,
      };

      const chunk = processor.processEvent(event);
      expect(chunk?.choices[0]?.finishReason).toBe('length');
    });

    it('should normalize "content_filter" finish reason', () => {
      const event: OpenAIStreamEvent = {
        finish_reason: 'content_filter',
        id: 'resp-123',
        created: 1705320000,
        model: defaultModel,
      };

      const chunk = processor.processEvent(event);
      expect(chunk?.choices[0]?.finishReason).toBe('content_filter');
    });
  });
});
