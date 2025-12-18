/**
 * @file OpenAI Response Parser Tests
 *
 * Tests for parsing and normalization of OpenAI API responses.
 */

import { describe, it, expect } from 'vitest';
import {
  extractContentAndMetadata,
  extractReasoningSummary,
  convertUsage,
  normalizeFinishReason,
  extractSearchMetadataFromEvent,
} from '@core/ai/openai/responseParser';
import type { OpenAIResponse, OpenAIStreamEvent } from '@core/ai/openai/types';

// Helper to create partial OpenAIResponse for testing
const createTestResponse = (
  overrides: Partial<OpenAIResponse> & Record<string, unknown>
): OpenAIResponse =>
  ({
    id: 'test-id',
    model: 'gpt-4o',
    ...overrides,
  }) as OpenAIResponse;

describe('extractContentAndMetadata', () => {
  it('should extract content from Responses API output array', () => {
    const response = createTestResponse({
      output: [
        {
          type: 'message',
          content: [
            {
              type: 'output_text',
              text: 'Hello, world!',
            },
          ],
        },
      ],
    });

    const result = extractContentAndMetadata(response);
    expect(result.content).toBe('Hello, world!');
  });

  it('should concatenate multiple text parts', () => {
    const response = createTestResponse({
      output: [
        {
          type: 'message',
          content: [
            { type: 'output_text', text: 'Part 1. ' },
            { type: 'output_text', text: 'Part 2.' },
          ],
        },
      ],
    });

    const result = extractContentAndMetadata(response);
    expect(result.content).toBe('Part 1. Part 2.');
  });

  it('should extract citations from annotations', () => {
    const response = createTestResponse({
      output: [
        {
          type: 'message',
          content: [
            {
              type: 'output_text',
              text: 'Response with citations',
              annotations: [
                {
                  type: 'url_citation',
                  url: 'https://example.com',
                  title: 'Example Site',
                },
                {
                  type: 'url_citation',
                  url: 'https://test.com',
                  title: 'Test Site',
                },
              ],
            },
          ],
        },
      ],
    });

    const result = extractContentAndMetadata(response);
    expect(result.searchMetadata).not.toBeNull();
    expect(result.searchMetadata?.sources).toHaveLength(2);
    expect(result.searchMetadata?.sources?.[0]?.url).toBe('https://example.com');
    expect(result.searchMetadata?.sources?.[1]?.url).toBe('https://test.com');
  });

  it('should fallback to output_text convenience field', () => {
    const response = createTestResponse({
      output_text: 'Convenience field content',
    });

    const result = extractContentAndMetadata(response);
    expect(result.content).toBe('Convenience field content');
  });

  it('should fallback to content array', () => {
    const response = createTestResponse({
      content: [{ text: 'Content array fallback' }],
    });

    const result = extractContentAndMetadata(response);
    expect(result.content).toBe('Content array fallback');
  });

  it('should handle empty outputs', () => {
    const response = createTestResponse({
      output: [],
    });

    const result = extractContentAndMetadata(response);
    expect(result.content).toBe('');
  });

  it('should handle outputs field alias', () => {
    const response = createTestResponse({
      outputs: [
        {
          type: 'message',
          content: [{ type: 'output_text', text: 'From outputs field' }],
        },
      ],
    });

    const result = extractContentAndMetadata(response);
    expect(result.content).toBe('From outputs field');
  });

  it('should filter non-output_text content types', () => {
    const response = createTestResponse({
      output: [
        {
          type: 'message',
          content: [
            { type: 'output_text', text: 'Text content' },
            { type: 'image' as 'output_text', data: 'base64...' } as {
              type: 'output_text';
              text?: string;
            },
          ],
        },
      ],
    });

    const result = extractContentAndMetadata(response);
    expect(result.content).toBe('Text content');
  });
});

describe('extractReasoningSummary', () => {
  it('should extract reasoning from direct reasoning event', () => {
    const payload = {
      type: 'reasoning',
      summary: [{ type: 'summary_text', text: 'Thinking about the problem...' }],
    };

    const result = extractReasoningSummary(payload);
    expect(result).toBe('Thinking about the problem...');
  });

  it('should extract reasoning from output array', () => {
    const payload = {
      output: [
        {
          type: 'reasoning',
          summary: [
            { type: 'summary_text', text: 'Step 1: Analyze.' },
            { type: 'summary_text', text: 'Step 2: Conclude.' },
          ],
        },
      ],
    };

    const result = extractReasoningSummary(payload);
    expect(result).toBe('Step 1: Analyze.\nStep 2: Conclude.');
  });

  it('should extract reasoning from response.output path', () => {
    const payload = {
      response: {
        output: [
          {
            type: 'reasoning',
            summary: [{ text: 'Nested reasoning' }],
          },
        ],
      },
    };

    const result = extractReasoningSummary(payload);
    expect(result).toBe('Nested reasoning');
  });

  it('should extract from payload.reasoning.summary', () => {
    const payload = {
      reasoning: {
        summary: [{ text: 'Direct reasoning summary' }],
      },
    };

    const result = extractReasoningSummary(payload);
    expect(result).toBe('Direct reasoning summary');
  });

  it('should handle summary_text single field', () => {
    const payload = {
      summary_text: 'Single field summary',
    };

    const result = extractReasoningSummary(payload);
    expect(result).toBe('Single field summary');
  });

  it('should return undefined for missing reasoning', () => {
    const payload = {
      output: [{ type: 'message', content: 'No reasoning here' }],
    };

    const result = extractReasoningSummary(payload);
    expect(result).toBeUndefined();
  });

  it('should handle item_type alias for reasoning', () => {
    const payload = {
      output: [
        {
          item_type: 'reasoning',
          summary: [{ text: 'Item type reasoning' }],
        },
      ],
    };

    const result = extractReasoningSummary(payload);
    expect(result).toBe('Item type reasoning');
  });

  it('should handle data.summary nested path', () => {
    const payload = {
      output: [
        {
          type: 'reasoning',
          data: {
            summary: [{ text: 'Data nested summary' }],
          },
        },
      ],
    };

    const result = extractReasoningSummary(payload);
    expect(result).toBe('Data nested summary');
  });

  it('should handle content field in summary items', () => {
    const payload = {
      type: 'reasoning',
      summary: [{ content: 'Content field reasoning' }],
    };

    const result = extractReasoningSummary(payload);
    expect(result).toBe('Content field reasoning');
  });

  it('should return undefined for empty summary array', () => {
    const payload = {
      type: 'reasoning',
      summary: [],
    };

    const result = extractReasoningSummary(payload);
    expect(result).toBeUndefined();
  });
});

describe('convertUsage', () => {
  it('should convert Responses API usage format', () => {
    const usage = {
      input_tokens: 100,
      output_tokens: 50,
    };

    const result = convertUsage(usage);

    expect(result.promptTokens).toBe(100);
    expect(result.completionTokens).toBe(50);
    expect(result.totalTokens).toBe(150);
  });

  it('should convert Chat Completions API usage format', () => {
    const usage = {
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150,
    };

    const result = convertUsage(usage);

    expect(result.promptTokens).toBe(100);
    expect(result.completionTokens).toBe(50);
    expect(result.totalTokens).toBe(150);
  });

  it('should return zeros for undefined usage', () => {
    const result = convertUsage(undefined);

    expect(result.promptTokens).toBe(0);
    expect(result.completionTokens).toBe(0);
    expect(result.totalTokens).toBe(0);
  });

  it('should include thinking tokens when present', () => {
    const usage = {
      input_tokens: 100,
      output_tokens: 50,
      reasoning_tokens: 25,
    };

    const result = convertUsage(usage);
    expect(result.thinkingTokens).toBe(25);
  });

  it('should include thinking_tokens field alias', () => {
    const usage = {
      input_tokens: 100,
      output_tokens: 50,
      thinking_tokens: 30,
    };

    const result = convertUsage(usage);
    expect(result.thinkingTokens).toBe(30);
  });

  it('should prefer reasoning_tokens over thinking_tokens', () => {
    const usage = {
      input_tokens: 100,
      output_tokens: 50,
      reasoning_tokens: 25,
      thinking_tokens: 30,
    };

    const result = convertUsage(usage);
    expect(result.thinkingTokens).toBe(25);
  });

  it('should handle partial usage data', () => {
    const usage = {
      prompt_tokens: 100,
    };

    const result = convertUsage(usage);

    expect(result.promptTokens).toBe(100);
    expect(result.completionTokens).toBe(0);
    expect(result.totalTokens).toBe(0);
  });
});

describe('normalizeFinishReason', () => {
  it('should normalize "stop" reason', () => {
    expect(normalizeFinishReason('stop')).toBe('stop');
    expect(normalizeFinishReason('STOP')).toBe('stop');
  });

  it('should normalize "completed" to "stop"', () => {
    expect(normalizeFinishReason('completed')).toBe('stop');
    expect(normalizeFinishReason('Completed')).toBe('stop');
  });

  it('should normalize "length" reason', () => {
    expect(normalizeFinishReason('length')).toBe('length');
    expect(normalizeFinishReason('max_length')).toBe('length');
  });

  it('should normalize "content_filter" reason', () => {
    expect(normalizeFinishReason('content_filter')).toBe('content_filter');
    expect(normalizeFinishReason('filter')).toBe('content_filter');
  });

  it('should normalize "tool_calls" reason', () => {
    expect(normalizeFinishReason('tool_calls')).toBe('tool_calls');
    expect(normalizeFinishReason('tool')).toBe('tool_calls');
  });

  it('should default to "stop" for null or undefined', () => {
    expect(normalizeFinishReason(null)).toBe('stop');
    expect(normalizeFinishReason(undefined)).toBe('stop');
  });

  it('should default to "stop" for unknown reasons', () => {
    expect(normalizeFinishReason('unknown_reason')).toBe('stop');
    expect(normalizeFinishReason('')).toBe('stop');
  });
});

describe('extractSearchMetadataFromEvent', () => {
  it('should extract metadata from web_search_call output item', () => {
    const event: OpenAIStreamEvent = {
      type: 'response.output_item.done',
      item: {
        type: 'web_search_call',
        action: {
          query: 'test query',
        },
      },
    };

    const result = extractSearchMetadataFromEvent(event);

    expect(result).not.toBeNull();
    expect(result?.sources?.[0]?.title).toContain('test query');
    expect(result?.sources?.[0]?.url).toContain('google.com/search');
  });

  it('should return null for web_search_call without query', () => {
    const event: OpenAIStreamEvent = {
      type: 'response.output_item.done',
      item: {
        type: 'web_search_call',
        action: {},
      },
    };

    const result = extractSearchMetadataFromEvent(event);
    expect(result).toBeNull();
  });

  it('should extract citations from message content', () => {
    const event: OpenAIStreamEvent = {
      type: 'response.output_item.done',
      item: {
        type: 'message',
        content: [
          {
            type: 'output_text',
            text: 'Response text',
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

    const result = extractSearchMetadataFromEvent(event);

    expect(result).not.toBeNull();
    expect(result?.sources).toHaveLength(1);
    expect(result?.sources?.[0]?.url).toBe('https://example.com');
  });

  it('should use "Untitled" for citations without title', () => {
    const event: OpenAIStreamEvent = {
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
              },
            ],
          },
        ],
      },
    };

    const result = extractSearchMetadataFromEvent(event);
    expect(result?.sources?.[0]?.title).toBe('Untitled');
  });

  it('should filter non-url_citation annotations', () => {
    const event: OpenAIStreamEvent = {
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
                title: 'Valid',
              },
              // Intentionally include non-url_citation type
              { type: 'url_citation', url: '', title: '' } as unknown as {
                type: 'url_citation';
                url: string;
                title?: string;
              },
            ],
          },
        ],
      },
    };

    const result = extractSearchMetadataFromEvent(event);
    expect(result?.sources).toBeDefined();
    expect(result?.sources?.[0]?.title).toBe('Valid');
  });

  it('should return null for unrelated event types', () => {
    const event: OpenAIStreamEvent = {
      type: 'response.output_text.delta',
      delta: 'Some text',
    };

    const result = extractSearchMetadataFromEvent(event);
    expect(result).toBeNull();
  });

  it('should return null for message without annotations', () => {
    const event: OpenAIStreamEvent = {
      type: 'response.output_item.done',
      item: {
        type: 'message',
        content: [
          {
            type: 'output_text',
            text: 'Response without citations',
          },
        ],
      },
    };

    const result = extractSearchMetadataFromEvent(event);
    expect(result).toBeNull();
  });
});
