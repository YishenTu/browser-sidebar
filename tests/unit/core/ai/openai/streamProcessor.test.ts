/**
 * @file OpenAI Stream Processor Unit Tests
 *
 * Comprehensive unit tests for the OpenAI stream processor,
 * covering event processing, stream handling, response parsing,
 * error scenarios, and search metadata handling.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OpenAIStreamProcessor } from '@/core/ai/openai/streamProcessor';
import type { OpenAIStreamEvent, SearchMetadata } from '@/core/ai/openai/types';
import type { StreamChunk } from '@/types/providers';

// Mock dependencies
vi.mock('@/core/ai/openai/responseParser', () => ({
  extractSearchMetadataFromEvent: vi.fn(),
  extractReasoningSummary: vi.fn(),
  convertUsage: vi.fn(),
  normalizeFinishReason: vi.fn(),
}));

import {
  extractSearchMetadataFromEvent,
  extractReasoningSummary,
  convertUsage,
  normalizeFinishReason,
} from '@/core/ai/openai/responseParser';

describe('OpenAIStreamProcessor', () => {
  let processor: OpenAIStreamProcessor;
  const mockModel = 'gpt-5';

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks
    vi.mocked(extractSearchMetadataFromEvent).mockReturnValue(null);
    vi.mocked(extractReasoningSummary).mockReturnValue(undefined);
    vi.mocked(convertUsage).mockReturnValue({
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
    });
    vi.mocked(normalizeFinishReason).mockReturnValue('stop');
  });

  describe('Constructor', () => {
    it('should create processor with model name and default showThinking=false', () => {
      processor = new OpenAIStreamProcessor(mockModel);

      expect(processor).toBeInstanceOf(OpenAIStreamProcessor);
      expect(processor['model']).toBe(mockModel);
      expect(processor['showThinking']).toBe(false);
      expect(processor['lastSeenContent']).toBe('');
      expect(processor['emittedReasoning']).toBe(false);
      expect(processor['searchMetadata']).toBeNull();
    });

    it('should create processor with showThinking=true when specified', () => {
      processor = new OpenAIStreamProcessor(mockModel, true);

      expect(processor['showThinking']).toBe(true);
    });
  });

  describe('reset()', () => {
    it('should reset all internal state', () => {
      processor = new OpenAIStreamProcessor(mockModel, true);

      // Set some state
      processor['lastSeenContent'] = 'some content';
      processor['emittedReasoning'] = true;
      processor.setSearchMetadata({ sources: [{ title: 'Test', url: 'https://test.com' }] });

      // Reset
      processor.reset();

      // Verify reset
      expect(processor['lastSeenContent']).toBe('');
      expect(processor['emittedReasoning']).toBe(false);
      expect(processor['searchMetadata']).toBeNull();
    });
  });

  describe('Search Metadata Management', () => {
    beforeEach(() => {
      processor = new OpenAIStreamProcessor(mockModel);
    });

    it('should get initial search metadata as null', () => {
      expect(processor.getSearchMetadata()).toBeNull();
    });

    it('should set and get search metadata', () => {
      const metadata: SearchMetadata = {
        sources: [{ title: 'Test Source', url: 'https://example.com', snippet: 'Test snippet' }],
      };

      processor.setSearchMetadata(metadata);
      expect(processor.getSearchMetadata()).toEqual(metadata);
    });

    it('should set search metadata to null', () => {
      const metadata: SearchMetadata = {
        sources: [{ title: 'Test', url: 'https://test.com' }],
      };

      processor.setSearchMetadata(metadata);
      expect(processor.getSearchMetadata()).toEqual(metadata);

      processor.setSearchMetadata(null);
      expect(processor.getSearchMetadata()).toBeNull();
    });
  });

  describe('Web Search Event Processing', () => {
    beforeEach(() => {
      processor = new OpenAIStreamProcessor(mockModel);
    });

    it('should handle web search completion events', () => {
      const mockMetadata: SearchMetadata = {
        sources: [{ title: 'Search Result', url: 'https://search.com' }],
      };
      vi.mocked(extractSearchMetadataFromEvent).mockReturnValue(mockMetadata);

      const event: OpenAIStreamEvent = {
        type: 'response.web_search_call.completed',
        id: 'search-123',
      };

      const result = processor.processEvent(event);

      expect(extractSearchMetadataFromEvent).toHaveBeenCalledWith(event);
      expect(processor.getSearchMetadata()).toEqual(mockMetadata);
      expect(result).toBeNull(); // Should not yield chunk for search events
    });

    it('should handle output item done events with web search type', () => {
      const event: OpenAIStreamEvent = {
        type: 'response.output_item.done',
        item: { type: 'web_search_call' },
      };

      const result = processor.processEvent(event);

      expect(extractSearchMetadataFromEvent).toHaveBeenCalledWith(event);
      expect(result).toBeNull();
    });

    it('should handle output item done events with message type', () => {
      const event: OpenAIStreamEvent = {
        type: 'response.output_item.done',
        item: { type: 'message' },
      };

      const result = processor.processEvent(event);

      expect(extractSearchMetadataFromEvent).toHaveBeenCalledWith(event);
      expect(result).toBeNull();
    });

    it('should not set search metadata when extractor returns null', () => {
      vi.mocked(extractSearchMetadataFromEvent).mockReturnValue(null);

      const event: OpenAIStreamEvent = {
        type: 'response.web_search_call.completed',
      };

      processor.processEvent(event);

      expect(processor.getSearchMetadata()).toBeNull();
    });
  });

  describe('Reasoning Delta Processing', () => {
    beforeEach(() => {
      processor = new OpenAIStreamProcessor(mockModel, true); // showThinking = true
    });

    it('should process reasoning summary text delta events when showThinking=true', () => {
      const beforeTime = Date.now();

      const event: OpenAIStreamEvent = {
        type: 'response.reasoning_summary_text.delta',
        delta: 'Let me think about this...',
        id: 'reasoning-123',
        created: 1234567890,
        model: 'gpt-5',
      };

      const result = processor.processEvent(event);
      const afterTime = Date.now();

      expect(result).not.toBeNull();
      expect(result!.choices[0].delta.thinking).toBe('Let me think about this...');
      // Delta events generate fallback IDs because createThinkingChunk is called without the event parameter
      expect(result!.id).toMatch(/^resp-chunk-\d+-thinking$/);
      expect(result!.model).toBe(mockModel); // Uses processor model, not event model
      expect(result!.created).toBeGreaterThanOrEqual(Math.floor(beforeTime / 1000));
      expect(result!.created).toBeLessThanOrEqual(Math.floor(afterTime / 1000));
      expect(processor['emittedReasoning']).toBe(true);
    });

    it('should not process reasoning delta when showThinking=false', () => {
      processor = new OpenAIStreamProcessor(mockModel, false);

      const event: OpenAIStreamEvent = {
        type: 'response.reasoning_summary_text.delta',
        delta: 'Let me think about this...',
      };

      const result = processor.processEvent(event);

      // When showThinking=false, reasoning delta events are treated as regular content
      // because extractDeltaContent falls through to the generic delta handling
      expect(result).not.toBeNull();
      expect(result!.choices[0].delta.content).toBe('Let me think about this...');
      expect(processor['emittedReasoning']).toBe(false);
    });

    it('should handle non-string delta in reasoning events', () => {
      const event: OpenAIStreamEvent = {
        type: 'response.reasoning_summary_text.delta',
        delta: { some: 'object' } as any,
      };

      const result = processor.processEvent(event);

      expect(result).not.toBeNull();
      expect(result!.choices[0].delta.thinking).toBe('[object Object]');
    });

    it('should handle empty delta in reasoning events', () => {
      const event: OpenAIStreamEvent = {
        type: 'response.reasoning_summary_text.delta',
        delta: '',
      };

      const result = processor.processEvent(event);

      // Empty string is falsy, so the reasoning condition fails
      // The event then continues to extractDeltaContent which also rejects empty delta
      expect(result).toBeNull();
    });

    it('should handle falsy delta in reasoning events', () => {
      const event: OpenAIStreamEvent = {
        type: 'response.reasoning_summary_text.delta',
        delta: null as any,
      };

      const result = processor.processEvent(event);

      expect(result).toBeNull(); // Should return null when delta is falsy
      expect(processor['emittedReasoning']).toBe(false);
    });

    it('should generate fallback ID and timestamp when not provided', () => {
      const beforeTime = Date.now();

      const event: OpenAIStreamEvent = {
        type: 'response.reasoning_summary_text.delta',
        delta: 'thinking...',
      };

      const result = processor.processEvent(event);
      const afterTime = Date.now();

      expect(result).not.toBeNull();
      expect(result!.id).toMatch(/^resp-chunk-\d+-thinking$/);
      expect(result!.created).toBeGreaterThanOrEqual(Math.floor(beforeTime / 1000));
      expect(result!.created).toBeLessThanOrEqual(Math.floor(afterTime / 1000));
      expect(result!.model).toBe(mockModel);
    });

    it('should not include usage in reasoning delta events', () => {
      const event: OpenAIStreamEvent = {
        type: 'response.reasoning_summary_text.delta',
        delta: 'thinking...',
        usage: { prompt_tokens: 5, completion_tokens: 10, total_tokens: 15 },
      };

      const result = processor.processEvent(event);

      // Reasoning delta events call createThinkingChunk without the event parameter,
      // so usage is not included (it would be undefined)
      expect(convertUsage).not.toHaveBeenCalled();
      expect(result!.usage).toBeUndefined();
    });
  });

  describe('Reasoning Completion Events', () => {
    beforeEach(() => {
      processor = new OpenAIStreamProcessor(mockModel, true);
    });

    it('should handle reasoning summary done events without emitting chunk', () => {
      const event: OpenAIStreamEvent = {
        type: 'response.reasoning_summary_text.done',
      };

      const result = processor.processEvent(event);
      expect(result).toBeNull();
    });

    it('should handle reasoning summary part done events without emitting chunk', () => {
      const event: OpenAIStreamEvent = {
        type: 'response.reasoning_summary_part.done',
      };

      const result = processor.processEvent(event);
      expect(result).toBeNull();
    });
  });

  describe('Standalone Reasoning Events', () => {
    beforeEach(() => {
      processor = new OpenAIStreamProcessor(mockModel, true);
    });

    it('should process standalone reasoning events with summary', () => {
      const mockSummary = 'This is my reasoning summary';
      vi.mocked(extractReasoningSummary).mockReturnValue(mockSummary);

      const event: OpenAIStreamEvent = {
        type: 'reasoning',
        id: 'reasoning-456',
      };

      const result = processor.processEvent(event);

      expect(extractReasoningSummary).toHaveBeenCalledWith(event);
      expect(result).not.toBeNull();
      expect(result!.choices[0].delta.thinking).toBe(mockSummary);
      expect(processor['emittedReasoning']).toBe(true);
    });

    it('should process reasoning events with item_type=reasoning', () => {
      const mockSummary = 'Reasoning via item_type';
      vi.mocked(extractReasoningSummary).mockReturnValue(mockSummary);

      const event: OpenAIStreamEvent = {
        item_type: 'reasoning',
        id: 'reasoning-789',
      };

      const result = processor.processEvent(event);

      expect(result).not.toBeNull();
      expect(result!.choices[0].delta.thinking).toBe(mockSummary);
    });

    it('should not emit reasoning if already emitted', () => {
      processor['emittedReasoning'] = true;

      const mockSummary = 'This should not be emitted';
      vi.mocked(extractReasoningSummary).mockReturnValue(mockSummary);

      const event: OpenAIStreamEvent = {
        type: 'reasoning',
      };

      const result = processor.processEvent(event);
      expect(result).toBeNull();
    });

    it('should not emit reasoning with empty summary', () => {
      vi.mocked(extractReasoningSummary).mockReturnValue('   '); // whitespace only

      const event: OpenAIStreamEvent = {
        type: 'reasoning',
      };

      const result = processor.processEvent(event);
      expect(result).toBeNull();
      expect(processor['emittedReasoning']).toBe(false);
    });

    it('should not emit reasoning when showThinking=false', () => {
      processor = new OpenAIStreamProcessor(mockModel, false);

      const mockSummary = 'This should not be emitted';
      vi.mocked(extractReasoningSummary).mockReturnValue(mockSummary);

      const event: OpenAIStreamEvent = {
        type: 'reasoning',
      };

      const result = processor.processEvent(event);
      expect(result).toBeNull();
    });
  });

  describe('Content Delta Processing', () => {
    beforeEach(() => {
      processor = new OpenAIStreamProcessor(mockModel);
    });

    it('should process output text delta events', () => {
      const event: OpenAIStreamEvent = {
        type: 'response.output_text.delta',
        delta: 'Hello, world!',
        id: 'content-123',
        model: 'gpt-5',
        created: 1234567890,
      };

      const result = processor.processEvent(event);

      expect(result).not.toBeNull();
      expect(result!.choices[0].delta.content).toBe('Hello, world!');
      expect(result!.id).toBe('content-123');
      expect(result!.model).toBe('gpt-5');
      expect(result!.created).toBe(1234567890);
    });

    it('should process output_text field with incremental content extraction', () => {
      const event1: OpenAIStreamEvent = {
        output_text: 'Hello',
      };

      const event2: OpenAIStreamEvent = {
        output_text: 'Hello, world!',
      };

      // First event should return full content
      const result1 = processor.processEvent(event1);
      expect(result1!.choices[0].delta.content).toBe('Hello');

      // Second event should return only the delta
      const result2 = processor.processEvent(event2);
      expect(result2!.choices[0].delta.content).toBe(', world!');
    });

    it('should handle output_text with no new content', () => {
      const event1: OpenAIStreamEvent = {
        output_text: 'Hello, world!',
      };

      const event2: OpenAIStreamEvent = {
        output_text: 'Hello, world!', // Same content
      };

      processor.processEvent(event1);
      const result2 = processor.processEvent(event2);

      expect(result2).toBeNull(); // No new content, no chunk
    });

    it('should handle output_text shorter than previous (edge case)', () => {
      const event1: OpenAIStreamEvent = {
        output_text: 'Hello, world!',
      };

      const event2: OpenAIStreamEvent = {
        output_text: 'Hello', // Shorter content
      };

      processor.processEvent(event1);
      const result2 = processor.processEvent(event2);

      expect(result2).toBeNull(); // No delta when content is shorter
    });

    it('should handle generic delta field', () => {
      const event: OpenAIStreamEvent = {
        delta: 'Generic delta content',
      };

      const result = processor.processEvent(event);

      expect(result).not.toBeNull();
      expect(result!.choices[0].delta.content).toBe('Generic delta content');
    });

    it('should ignore non-string delta', () => {
      const event: OpenAIStreamEvent = {
        delta: { some: 'object' } as any,
      };

      const result = processor.processEvent(event);
      expect(result).toBeNull();
    });

    it('should include search metadata in content chunks', () => {
      const metadata: SearchMetadata = {
        sources: [{ title: 'Test', url: 'https://test.com' }],
      };
      processor.setSearchMetadata(metadata);

      const event: OpenAIStreamEvent = {
        type: 'response.output_text.delta',
        delta: 'Content with metadata',
        id: 'content-with-meta',
      };

      const result = processor.processEvent(event);

      expect(result!.metadata).toEqual({
        searchResults: metadata,
        responseId: 'content-with-meta',
      });
    });

    it('should handle finish reason in content chunks', () => {
      vi.mocked(normalizeFinishReason).mockReturnValue('length');

      const event: OpenAIStreamEvent = {
        type: 'response.output_text.delta',
        delta: 'Final content',
        finish_reason: 'max_tokens',
      };

      const result = processor.processEvent(event);

      expect(normalizeFinishReason).toHaveBeenCalledWith('max_tokens');
      expect(result!.choices[0].finishReason).toBe('length'); // Should be the normalized reason for non-stop reasons
    });

    it('should set finishReason to null for stop reason during streaming', () => {
      vi.mocked(normalizeFinishReason).mockReturnValue('stop');

      const event: OpenAIStreamEvent = {
        type: 'response.output_text.delta',
        delta: 'Final content',
        finish_reason: 'stop',
      };

      const result = processor.processEvent(event);

      expect(result!.choices[0].finishReason).toBeNull(); // stop reason becomes null during streaming
    });
  });

  describe('Completion Event Processing', () => {
    beforeEach(() => {
      processor = new OpenAIStreamProcessor(mockModel);
    });

    it('should process response.completed events', () => {
      vi.mocked(normalizeFinishReason).mockReturnValue('stop');
      const mockUsage = { promptTokens: 100, completionTokens: 50, totalTokens: 150 };
      vi.mocked(convertUsage).mockReturnValue(mockUsage);

      const event: OpenAIStreamEvent = {
        type: 'response.completed',
        id: 'completion-123',
        usage: { total_tokens: 150 },
      };

      const result = processor.processEvent(event);

      expect(result).not.toBeNull();
      expect(result!.choices[0].delta).toEqual({});
      expect(result!.choices[0].finishReason).toBe('stop');
      expect(result!.usage).toEqual(mockUsage);
      expect(convertUsage).toHaveBeenCalledWith(event.usage);
    });

    it('should process events with finish_reason field', () => {
      vi.mocked(normalizeFinishReason).mockReturnValue('length');

      const event: OpenAIStreamEvent = {
        finish_reason: 'max_tokens',
        id: 'finish-456',
      };

      const result = processor.processEvent(event);

      expect(result).not.toBeNull();
      expect(result!.choices[0].finishReason).toBe('length');
      expect(normalizeFinishReason).toHaveBeenCalledWith('max_tokens');
    });

    it('should process events with status=completed', () => {
      vi.mocked(normalizeFinishReason).mockReturnValue('stop');

      const event: OpenAIStreamEvent = {
        status: 'completed',
        id: 'status-789',
      };

      const result = processor.processEvent(event);

      expect(result).not.toBeNull();
      expect(result!.choices[0].finishReason).toBe('stop');
    });

    it('should include search metadata in completion chunks', () => {
      const metadata: SearchMetadata = {
        sources: [{ title: 'Final', url: 'https://final.com' }],
      };
      processor.setSearchMetadata(metadata);

      const event: OpenAIStreamEvent = {
        type: 'response.completed',
        id: 'final-123',
      };

      const result = processor.processEvent(event);

      expect(result!.metadata).toEqual({
        searchResults: metadata,
        responseId: 'final-123',
      });
    });

    it('should generate fallback ID for completion chunks', () => {
      const event: OpenAIStreamEvent = {
        type: 'response.completed',
      };

      const result = processor.processEvent(event);

      expect(result!.id).toMatch(/^resp-chunk-\d+$/);
    });
  });

  describe('Event Classification Helpers', () => {
    beforeEach(() => {
      processor = new OpenAIStreamProcessor(mockModel);
    });

    it('should correctly identify web search events', () => {
      expect(
        processor['isWebSearchEvent']({
          type: 'response.web_search_call.completed',
        })
      ).toBe(true);

      expect(
        processor['isWebSearchEvent']({
          type: 'response.output_item.done',
          item: { type: 'web_search_call' },
        })
      ).toBe(true);

      expect(
        processor['isWebSearchEvent']({
          type: 'response.output_item.done',
          item: { type: 'message' },
        })
      ).toBe(true);

      expect(
        processor['isWebSearchEvent']({
          type: 'response.output_text.delta',
        })
      ).toBe(false);
    });

    it('should correctly identify reasoning completion events', () => {
      expect(
        processor['isReasoningCompletionEvent']({
          type: 'response.reasoning_summary_text.done',
        })
      ).toBe(true);

      expect(
        processor['isReasoningCompletionEvent']({
          type: 'response.reasoning_summary_part.done',
        })
      ).toBe(true);

      expect(
        processor['isReasoningCompletionEvent']({
          type: 'response.output_text.delta',
        })
      ).toBe(false);
    });

    it('should correctly identify standalone reasoning events', () => {
      expect(
        processor['isStandaloneReasoningEvent']({
          type: 'reasoning',
        })
      ).toBe(true);

      expect(
        processor['isStandaloneReasoningEvent']({
          item_type: 'reasoning',
        })
      ).toBe(true);

      expect(
        processor['isStandaloneReasoningEvent']({
          type: 'response.output_text.delta',
        })
      ).toBe(false);
    });

    it('should correctly identify completion events', () => {
      expect(
        processor['isCompletionEvent']({
          type: 'response.completed',
        })
      ).toBe(true);

      expect(
        processor['isCompletionEvent']({
          finish_reason: 'stop',
        })
      ).toBe(true);

      expect(
        processor['isCompletionEvent']({
          status: 'completed',
        })
      ).toBe(true);

      expect(
        processor['isCompletionEvent']({
          type: 'response.output_text.delta',
        })
      ).toBe(false);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    beforeEach(() => {
      processor = new OpenAIStreamProcessor(mockModel);
    });

    it('should handle empty events gracefully', () => {
      const result = processor.processEvent({});
      expect(result).toBeNull();
    });

    it('should handle null/undefined event properties', () => {
      const event: OpenAIStreamEvent = {
        type: 'response.output_text.delta',
        delta: null as any,
      };

      const result = processor.processEvent(event);
      expect(result).toBeNull();
    });

    it('should handle events with undefined delta', () => {
      const event: OpenAIStreamEvent = {
        type: 'response.output_text.delta',
        delta: undefined,
      };

      const result = processor.processEvent(event);
      expect(result).toBeNull();
    });

    it('should handle malformed response_id', () => {
      const event: OpenAIStreamEvent = {
        type: 'response.output_text.delta',
        delta: 'test',
        response_id: null as any,
      };

      const result = processor.processEvent(event);
      expect(result).not.toBeNull();
      expect(result!.id).toMatch(/^resp-chunk-\d+$/);
    });

    it('should handle events with missing model field', () => {
      const event: OpenAIStreamEvent = {
        type: 'response.output_text.delta',
        delta: 'test',
      };

      const result = processor.processEvent(event);
      expect(result!.model).toBe(mockModel);
    });

    it('should handle events with null usage', () => {
      vi.mocked(normalizeFinishReason).mockReturnValue('stop');

      const event: OpenAIStreamEvent = {
        type: 'response.completed',
        usage: null as any,
      };

      const result = processor.processEvent(event);
      expect(result).not.toBeNull(); // Should create a completion chunk
      // convertUsage is not called when usage is falsy (null), it just sets usage to undefined
      expect(convertUsage).not.toHaveBeenCalled();
      expect(result!.usage).toBeUndefined();
    });

    it('should handle complex nested event structures', () => {
      const event: OpenAIStreamEvent = {
        type: 'response.output_item.done',
        item: {
          type: 'web_search_call',
          action: {
            type: 'search',
            query: 'test query',
          },
        },
      };

      const result = processor.processEvent(event);
      expect(extractSearchMetadataFromEvent).toHaveBeenCalledWith(event);
      expect(result).toBeNull();
    });
  });

  describe('State Persistence Across Events', () => {
    beforeEach(() => {
      processor = new OpenAIStreamProcessor(mockModel, true);
    });

    it('should maintain emittedReasoning state across multiple events', () => {
      // First reasoning event
      vi.mocked(extractReasoningSummary).mockReturnValue('First reasoning');
      const event1: OpenAIStreamEvent = { type: 'reasoning' };

      const result1 = processor.processEvent(event1);
      expect(result1).not.toBeNull();
      expect(processor['emittedReasoning']).toBe(true);

      // Second reasoning event should be ignored
      vi.mocked(extractReasoningSummary).mockReturnValue('Second reasoning');
      const event2: OpenAIStreamEvent = { type: 'reasoning' };

      const result2 = processor.processEvent(event2);
      expect(result2).toBeNull();
    });

    it('should maintain lastSeenContent for incremental updates', () => {
      const event1: OpenAIStreamEvent = { output_text: 'Hello' };
      const event2: OpenAIStreamEvent = { output_text: 'Hello, world' };
      const event3: OpenAIStreamEvent = { output_text: 'Hello, world!' };

      processor.processEvent(event1);
      expect(processor['lastSeenContent']).toBe('Hello');

      processor.processEvent(event2);
      expect(processor['lastSeenContent']).toBe('Hello, world');

      processor.processEvent(event3);
      expect(processor['lastSeenContent']).toBe('Hello, world!');
    });

    it('should maintain search metadata across content chunks', () => {
      const metadata: SearchMetadata = {
        sources: [{ title: 'Persistent', url: 'https://persistent.com' }],
      };
      processor.setSearchMetadata(metadata);

      // Multiple content events should all include the metadata
      const events = [
        { type: 'response.output_text.delta', delta: 'Part 1' },
        { type: 'response.output_text.delta', delta: 'Part 2' },
        { type: 'response.completed' },
      ];

      events.forEach((event, index) => {
        const result = processor.processEvent(event as OpenAIStreamEvent);
        if (result) {
          expect(result.metadata?.searchResults).toEqual(metadata);
        }
      });
    });
  });

  describe('Multiple Processor Instances', () => {
    it('should maintain independent state across instances', () => {
      const processor1 = new OpenAIStreamProcessor('gpt-5', true);
      const processor2 = new OpenAIStreamProcessor('gpt-5-mini', false);

      // Set different states
      processor1.setSearchMetadata({ sources: [{ title: 'P1', url: 'https://p1.com' }] });
      processor2.setSearchMetadata({ sources: [{ title: 'P2', url: 'https://p2.com' }] });

      processor1['lastSeenContent'] = 'Content 1';
      processor2['lastSeenContent'] = 'Content 2';

      // Verify independence
      expect(processor1.getSearchMetadata()?.sources[0].title).toBe('P1');
      expect(processor2.getSearchMetadata()?.sources[0].title).toBe('P2');
      expect(processor1['lastSeenContent']).toBe('Content 1');
      expect(processor2['lastSeenContent']).toBe('Content 2');
      expect(processor1['showThinking']).toBe(true);
      expect(processor2['showThinking']).toBe(false);
    });
  });

  describe('Stream Chunk Structure Validation', () => {
    beforeEach(() => {
      processor = new OpenAIStreamProcessor(mockModel);
    });

    it('should create valid StreamChunk structure for content', () => {
      const event: OpenAIStreamEvent = {
        type: 'response.output_text.delta',
        delta: 'test content',
        id: 'test-id',
        created: 1234567890,
        model: 'test-model',
      };

      const result = processor.processEvent(event);

      // Validate required StreamChunk fields
      expect(result).toMatchObject({
        id: 'test-id',
        object: 'response.chunk',
        created: 1234567890,
        model: 'test-model',
        choices: [
          {
            index: 0,
            delta: { content: 'test content' },
            finishReason: null,
          },
        ],
      });
    });

    it('should create valid StreamChunk structure for thinking', () => {
      processor = new OpenAIStreamProcessor(mockModel, true);

      const event: OpenAIStreamEvent = {
        type: 'response.reasoning_summary_text.delta',
        delta: 'thinking content',
        id: 'thinking-id',
      };

      const result = processor.processEvent(event);

      expect(result).toMatchObject({
        // Delta events generate fallback IDs because createThinkingChunk is called without event
        id: expect.stringMatching(/^resp-chunk-\d+-thinking$/),
        object: 'response.chunk',
        model: mockModel,
        choices: [
          {
            index: 0,
            delta: { thinking: 'thinking content' },
            finishReason: null,
          },
        ],
      });
    });

    it('should create valid StreamChunk structure for completion', () => {
      vi.mocked(normalizeFinishReason).mockReturnValue('stop');

      const event: OpenAIStreamEvent = {
        type: 'response.completed',
        id: 'completion-id',
        finish_reason: 'stop',
      };

      const result = processor.processEvent(event);

      expect(result).toMatchObject({
        id: 'completion-id',
        object: 'response.chunk',
        model: mockModel,
        choices: [
          {
            index: 0,
            delta: {},
            finishReason: 'stop',
          },
        ],
      });
    });

    it('should include usage in chunks when available', () => {
      const mockUsage = { promptTokens: 10, completionTokens: 5, totalTokens: 15 };
      vi.mocked(convertUsage).mockReturnValue(mockUsage);

      const event: OpenAIStreamEvent = {
        type: 'response.output_text.delta',
        delta: 'content',
        usage: { total_tokens: 15 },
      };

      const result = processor.processEvent(event);

      expect(result!.usage).toEqual(mockUsage);
    });

    it('should not include usage when not available', () => {
      const event: OpenAIStreamEvent = {
        type: 'response.output_text.delta',
        delta: 'content',
      };

      const result = processor.processEvent(event);

      expect(result!.usage).toBeUndefined();
    });
  });
});
