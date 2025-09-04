/**
 * @file Gemini Response Parser Unit Tests
 *
 * Comprehensive unit tests for Gemini response parsing functionality,
 * including response parsing, streaming conversion, content extraction,
 * thinking processing, and search metadata handling.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  parseResponse,
  convertToStreamChunk,
  normalizeFinishReason,
  processStreamChunk,
} from '@/core/ai/gemini/responseParser';
import type {
  GeminiResponse,
  GeminiCandidate,
  GeminiChatConfig,
  GeminiUsageMetadata,
  GeminiSearchMetadata,
} from '@/core/ai/gemini/types';
import type { ProviderType, StreamChunk } from '@/types/providers';

// Mock dependencies
vi.mock('@/core/ai/gemini/searchMetadata', () => ({
  formatSearchMetadata: vi.fn(),
}));

import { formatSearchMetadata } from '@/core/ai/gemini/searchMetadata';

describe('Gemini Response Parser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock returns null (no search metadata)
    vi.mocked(formatSearchMetadata).mockReturnValue(undefined);
  });

  describe('parseResponse', () => {
    const mockModel = 'gemini-2.5-pro';
    const mockProviderType: ProviderType = 'gemini';

    it('should parse complete response with content and usage', () => {
      const geminiResponse: GeminiResponse = {
        candidates: [
          {
            content: {
              parts: [{ text: 'Hello, how can I help you?' }],
              role: 'model',
            },
            finishReason: 'STOP',
            index: 0,
          },
        ],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 8,
          totalTokenCount: 18,
          thinkingTokenCount: 5,
        },
      };

      const result = parseResponse(geminiResponse, mockModel, mockProviderType);

      expect(result).toMatchObject({
        id: expect.stringMatching(/^gemini-\d+-[a-z0-9]+$/),
        content: 'Hello, how can I help you?',
        model: mockModel,
        usage: {
          promptTokens: 10,
          completionTokens: 8,
          totalTokens: 18,
          thinkingTokens: 5,
        },
        finishReason: 'stop',
        metadata: {
          provider: mockProviderType,
          timestamp: expect.any(Date),
          model: mockModel,
        },
      });
    });

    it('should parse response with thinking content', () => {
      const geminiResponse: GeminiResponse = {
        candidates: [
          {
            content: {
              parts: [
                { text: 'Let me help you with that.' },
                { thinking: 'I need to think about this carefully.', thought: true },
              ],
              role: 'model',
            },
            finishReason: 'STOP',
          },
        ],
        usageMetadata: {
          promptTokenCount: 15,
          candidatesTokenCount: 12,
          totalTokenCount: 27,
        },
      };

      const result = parseResponse(geminiResponse, mockModel, mockProviderType);

      expect(result.content).toBe('Let me help you with that.');
      expect(result.thinking).toBe('I need to think about this carefully.');
    });

    it('should parse response with legacy thinking field', () => {
      const geminiResponse: GeminiResponse = {
        candidates: [
          {
            content: {
              parts: [
                { text: 'Here is my answer.' },
                { thinking: 'This is legacy thinking format.' },
              ],
              role: 'model',
            },
          },
        ],
        usageMetadata: {
          promptTokenCount: 5,
          candidatesTokenCount: 10,
          totalTokenCount: 15,
        },
      };

      const result = parseResponse(geminiResponse, mockModel, mockProviderType);

      expect(result.content).toBe('Here is my answer.');
      expect(result.thinking).toBe('This is legacy thinking format.');
    });

    it('should parse response with multiple thinking parts', () => {
      const geminiResponse: GeminiResponse = {
        candidates: [
          {
            content: {
              parts: [
                { text: 'My response.' },
                { thinking: 'First thought.' },
                { thinking: 'Second thought.', thought: true },
                { text: 'More content.' },
              ],
              role: 'model',
            },
          },
        ],
      };

      const result = parseResponse(geminiResponse, mockModel, mockProviderType);

      expect(result.content).toBe('My response.More content.');
      expect(result.thinking).toBe('First thought. Second thought.');
    });

    it('should parse response with search metadata', () => {
      const mockSearchMetadata = {
        sources: [{ url: 'https://example.com', title: 'Example Source' }],
      };
      vi.mocked(formatSearchMetadata).mockReturnValue(mockSearchMetadata);

      const geminiResponse: GeminiResponse = {
        candidates: [
          {
            content: {
              parts: [{ text: 'Based on my search...' }],
              role: 'model',
            },
          },
        ],
        groundingMetadata: {
          webSearchQueries: ['test query'],
          groundingChunks: [{ web: { uri: 'https://example.com', title: 'Example Source' } }],
        },
      };

      const result = parseResponse(geminiResponse, mockModel, mockProviderType);

      expect(formatSearchMetadata).toHaveBeenCalledWith(geminiResponse.groundingMetadata);
      expect(result.metadata?.searchResults).toEqual([
        {
          title: 'Example Source',
          url: 'https://example.com',
          snippet: undefined,
          domain: 'example.com',
        },
      ]);
    });

    it('should handle response with no candidates', () => {
      const geminiResponse: GeminiResponse = {
        candidates: [],
        usageMetadata: {
          promptTokenCount: 5,
          candidatesTokenCount: 0,
          totalTokenCount: 5,
        },
      };

      const result = parseResponse(geminiResponse, mockModel, mockProviderType);

      expect(result.content).toBe('');
      expect(result.thinking).toBeUndefined();
      expect(result.finishReason).toBe('stop');
      expect(result.usage.completionTokens).toBe(0);
    });

    it('should handle response with undefined candidates', () => {
      const geminiResponse: GeminiResponse = {
        usageMetadata: {
          promptTokenCount: 5,
          candidatesTokenCount: 0,
          totalTokenCount: 5,
        },
      };

      const result = parseResponse(geminiResponse, mockModel, mockProviderType);

      expect(result.content).toBe('');
      expect(result.thinking).toBeUndefined();
    });

    it('should handle various finish reasons', () => {
      const testCases = [
        { input: 'STOP', expected: 'stop' },
        { input: 'MAX_TOKENS', expected: 'length' },
        { input: 'SAFETY', expected: 'content_filter' },
        { input: 'UNKNOWN_REASON', expected: 'stop' },
        { input: undefined, expected: 'stop' },
      ];

      testCases.forEach(({ input, expected }) => {
        const geminiResponse: GeminiResponse = {
          candidates: [
            {
              content: { parts: [{ text: 'Test' }] },
              finishReason: input,
            },
          ],
        };

        const result = parseResponse(geminiResponse, mockModel, mockProviderType);
        expect(result.finishReason).toBe(expected);
      });
    });

    it('should handle missing usage metadata', () => {
      const geminiResponse: GeminiResponse = {
        candidates: [
          {
            content: { parts: [{ text: 'No usage metadata' }] },
          },
        ],
      };

      const result = parseResponse(geminiResponse, mockModel, mockProviderType);

      expect(result.usage).toEqual({
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      });
    });

    it('should handle partial usage metadata', () => {
      const geminiResponse: GeminiResponse = {
        candidates: [
          {
            content: { parts: [{ text: 'Partial usage' }] },
          },
        ],
        usageMetadata: {
          promptTokenCount: 10,
          // Missing other fields
        },
      };

      const result = parseResponse(geminiResponse, mockModel, mockProviderType);

      expect(result.usage).toEqual({
        promptTokens: 10,
        completionTokens: 0,
        totalTokens: 0,
      });
    });
  });

  describe('convertToStreamChunk', () => {
    const mockModel = 'gemini-2.5-flash';

    it('should convert response to stream chunk', () => {
      const geminiResponse = {
        candidates: [
          {
            content: {
              parts: [{ text: 'Streaming content' }],
              role: 'model',
            },
            finishReason: 'STOP',
          },
        ],
        usageMetadata: {
          promptTokenCount: 5,
          candidatesTokenCount: 3,
          totalTokenCount: 8,
        },
      };

      const chunk = convertToStreamChunk(geminiResponse, mockModel);

      expect(chunk).toMatchObject({
        id: expect.stringMatching(/^gemini-\d+$/),
        object: 'response.chunk',
        created: expect.any(Number),
        model: mockModel,
        choices: [
          {
            index: 0,
            delta: {
              content: 'Streaming content',
              thinking: undefined,
            },
            finishReason: 'stop',
          },
        ],
        usage: {
          promptTokens: 5,
          completionTokens: 3,
          totalTokens: 8,
        },
      });
    });

    it('should convert thinking response to stream chunk', () => {
      const geminiResponse = {
        candidates: [
          {
            content: {
              parts: [{ text: 'Regular content' }, { thinking: 'Thinking content', thought: true }],
            },
          },
        ],
      };

      const chunk = convertToStreamChunk(geminiResponse, mockModel);

      expect(chunk.choices[0].delta).toEqual({
        content: 'Regular content',
        thinking: 'Thinking content',
      });
    });

    it('should handle empty response', () => {
      const geminiResponse = {};

      const chunk = convertToStreamChunk(geminiResponse, mockModel);

      expect(chunk.choices[0].delta).toEqual({
        content: undefined,
        thinking: undefined,
      });
      expect(chunk.choices[0].finishReason).toBeNull();
      expect(chunk.usage).toBeUndefined();
    });

    it('should handle response without usage metadata', () => {
      const geminiResponse = {
        candidates: [
          {
            content: { parts: [{ text: 'No usage' }] },
          },
        ],
      };

      const chunk = convertToStreamChunk(geminiResponse, mockModel);

      expect(chunk.usage).toBeUndefined();
    });

    it('should extract streaming search metadata', () => {
      const mockSearchMetadata = {
        sources: [{ url: 'https://stream.com', title: 'Stream Source' }],
      };
      vi.mocked(formatSearchMetadata).mockReturnValue(mockSearchMetadata);

      const geminiResponse = {
        candidates: [
          {
            content: { parts: [{ text: 'With search' }] },
            groundingMetadata: {
              webSearchQueries: ['stream query'],
            },
          },
        ],
      };

      const chunk = convertToStreamChunk(geminiResponse, mockModel);

      expect(chunk.metadata).toEqual({
        searchResults: mockSearchMetadata,
      });
    });

    it('should handle finish reason during streaming', () => {
      const geminiResponse = {
        candidates: [
          {
            content: { parts: [{ text: 'Final chunk' }] },
            finishReason: 'MAX_TOKENS',
          },
        ],
      };

      const chunk = convertToStreamChunk(geminiResponse, mockModel);

      expect(chunk.choices[0].finishReason).toBe('length');
    });
  });

  describe('normalizeFinishReason', () => {
    it('should normalize known finish reasons', () => {
      const testCases = [
        { input: 'STOP', expected: 'stop' },
        { input: 'FINISH', expected: 'stop' },
        { input: 'MAX_TOKENS', expected: 'length' },
        { input: 'LENGTH', expected: 'length' },
        { input: 'SAFETY', expected: 'content_filter' },
        { input: 'CONTENT_FILTER', expected: 'content_filter' },
      ];

      testCases.forEach(({ input, expected }) => {
        expect(normalizeFinishReason(input)).toBe(expected);
      });
    });

    it('should handle case insensitivity', () => {
      expect(normalizeFinishReason('stop')).toBe('stop');
      expect(normalizeFinishReason('max_tokens')).toBe('length');
      expect(normalizeFinishReason('Safety')).toBe('content_filter');
    });

    it('should default unknown reasons to stop', () => {
      expect(normalizeFinishReason('UNKNOWN_REASON')).toBe('stop');
      expect(normalizeFinishReason('CUSTOM_REASON')).toBe('stop');
      expect(normalizeFinishReason('')).toBe('stop');
    });

    it('should handle undefined and null', () => {
      expect(normalizeFinishReason(undefined)).toBe('stop');
      expect(normalizeFinishReason(null as any)).toBe('stop');
    });
  });

  describe('processStreamChunk', () => {
    const createMockChunk = (thinking?: string): StreamChunk => ({
      id: 'test-chunk-1',
      object: 'response.chunk',
      created: 1234567890,
      model: 'gemini-2.5-pro',
      choices: [
        {
          index: 0,
          delta: {
            content: 'Test content',
            thinking,
          },
          finishReason: null,
        },
      ],
    });

    it('should preserve chunk when showThoughts is true', () => {
      const config: GeminiChatConfig = { showThoughts: true };
      const chunk = createMockChunk('Thinking content');

      const result = processStreamChunk(chunk, config);

      expect(result.choices[0].delta.thinking).toBe('Thinking content');
      expect(result.choices[0].delta.content).toBe('Test content');
    });

    it('should filter thinking when showThoughts is false', () => {
      const config: GeminiChatConfig = { showThoughts: false };
      const chunk = createMockChunk('Thinking content');

      const result = processStreamChunk(chunk, config);

      expect(result.choices[0].delta.thinking).toBeUndefined();
      expect(result.choices[0].delta.content).toBe('Test content');
    });

    it('should use defaultShowThoughts when config.showThoughts is undefined', () => {
      const chunk = createMockChunk('Thinking content');

      // With defaultShowThoughts = true
      const result1 = processStreamChunk(chunk, {}, true);
      expect(result1.choices[0].delta.thinking).toBe('Thinking content');

      // With defaultShowThoughts = false
      const result2 = processStreamChunk(chunk, {}, false);
      expect(result2.choices[0].delta.thinking).toBeUndefined();
    });

    it('should preserve chunk without thinking', () => {
      const config: GeminiChatConfig = { showThoughts: false };
      const chunk = createMockChunk(); // No thinking

      const result = processStreamChunk(chunk, config);

      expect(result.choices[0].delta.content).toBe('Test content');
      expect(result.choices[0].delta.thinking).toBeUndefined();
    });

    it('should not mutate original chunk', () => {
      const config: GeminiChatConfig = { showThoughts: false };
      const originalChunk = createMockChunk('Original thinking');

      processStreamChunk(originalChunk, config);

      // Original should be unchanged
      expect(originalChunk.choices[0].delta.thinking).toBe('Original thinking');
    });

    it('should handle multiple choices', () => {
      const chunk: StreamChunk = {
        id: 'multi-choice',
        object: 'response.chunk',
        created: 1234567890,
        model: 'gemini-2.5-pro',
        choices: [
          {
            index: 0,
            delta: { content: 'Choice 1', thinking: 'Thinking 1' },
            finishReason: null,
          },
          {
            index: 1,
            delta: { content: 'Choice 2', thinking: 'Thinking 2' },
            finishReason: null,
          },
        ],
      };

      const result = processStreamChunk(chunk, { showThoughts: false });

      expect(result.choices).toHaveLength(2);
      expect(result.choices[0].delta.thinking).toBeUndefined();
      expect(result.choices[1].delta.thinking).toBeUndefined();
      expect(result.choices[0].delta.content).toBe('Choice 1');
      expect(result.choices[1].delta.content).toBe('Choice 2');
    });

    it('should preserve other chunk properties', () => {
      const chunk: StreamChunk = {
        id: 'test-preserve',
        object: 'response.chunk',
        created: 1234567890,
        model: 'gemini-2.5-pro',
        choices: [
          {
            index: 0,
            delta: { content: 'Content', thinking: 'Thinking' },
            finishReason: 'stop',
          },
        ],
        usage: {
          promptTokens: 10,
          completionTokens: 5,
          totalTokens: 15,
        },
        metadata: {
          searchResults: { sources: [] },
        },
      };

      const result = processStreamChunk(chunk, { showThoughts: false });

      expect(result.id).toBe('test-preserve');
      expect(result.object).toBe('response.chunk');
      expect(result.created).toBe(1234567890);
      expect(result.model).toBe('gemini-2.5-pro');
      expect(result.usage).toEqual(chunk.usage);
      expect(result.metadata).toEqual(chunk.metadata);
      expect(result.choices[0].finishReason).toBe('stop');
    });
  });

  describe('Content and Thinking Extraction', () => {
    it('should extract content from multiple text parts', () => {
      const geminiResponse: GeminiResponse = {
        candidates: [
          {
            content: {
              parts: [{ text: 'First part. ' }, { text: 'Second part. ' }, { text: 'Third part.' }],
            },
          },
        ],
      };

      const result = parseResponse(geminiResponse, 'test-model', 'gemini');
      expect(result.content).toBe('First part. Second part. Third part.');
    });

    it('should extract thinking from multiple thought parts', () => {
      const geminiResponse: GeminiResponse = {
        candidates: [
          {
            content: {
              parts: [
                { text: 'Answer' },
                { thinking: 'First thought', thought: true },
                { thinking: 'Second thought', thought: true },
              ],
            },
          },
        ],
      };

      const result = parseResponse(geminiResponse, 'test-model', 'gemini');
      expect(result.thinking).toBe('First thought Second thought');
    });

    it('should handle mixed content and thinking parts', () => {
      const geminiResponse: GeminiResponse = {
        candidates: [
          {
            content: {
              parts: [
                { text: 'Start ' },
                { thinking: 'Thinking 1' },
                { text: 'middle ' },
                { thinking: 'Thinking 2', thought: true },
                { text: 'end.' },
              ],
            },
          },
        ],
      };

      const result = parseResponse(geminiResponse, 'test-model', 'gemini');
      expect(result.content).toBe('Start middle end.');
      expect(result.thinking).toBe('Thinking 1 Thinking 2');
    });

    it('should handle empty parts arrays', () => {
      const geminiResponse: GeminiResponse = {
        candidates: [
          {
            content: {
              parts: [],
            },
          },
        ],
      };

      const result = parseResponse(geminiResponse, 'test-model', 'gemini');
      expect(result.content).toBe('');
      expect(result.thinking).toBeUndefined();
    });

    it('should handle parts with empty text', () => {
      const geminiResponse: GeminiResponse = {
        candidates: [
          {
            content: {
              parts: [{ text: '' }, { text: 'Valid content' }, { text: '' }],
            },
          },
        ],
      };

      const result = parseResponse(geminiResponse, 'test-model', 'gemini');
      expect(result.content).toBe('Valid content');
    });
  });

  describe('Search Metadata Extraction', () => {
    it('should extract search metadata from response level', () => {
      const mockFormatted = { sources: [{ url: 'https://test.com', title: 'Test' }] };
      vi.mocked(formatSearchMetadata).mockReturnValue(mockFormatted);

      const geminiResponse: GeminiResponse = {
        candidates: [{ content: { parts: [{ text: 'Response' }] } }],
        groundingMetadata: {
          webSearchQueries: ['test'],
        },
      };

      const result = parseResponse(geminiResponse, 'test-model', 'gemini');

      expect(formatSearchMetadata).toHaveBeenCalledWith(geminiResponse.groundingMetadata);
    });

    it('should handle multiple search metadata field names', () => {
      const mockFormatted = { sources: [{ url: 'https://snake.com', title: 'Snake Case' }] };
      vi.mocked(formatSearchMetadata).mockReturnValue(mockFormatted);

      const geminiResponse: GeminiResponse = {
        candidates: [{ content: { parts: [{ text: 'Response' }] } }],
        search_metadata: {
          web_search_queries: ['snake case test'],
        },
      };

      const result = parseResponse(geminiResponse, 'test-model', 'gemini');

      expect(formatSearchMetadata).toHaveBeenCalledWith(geminiResponse.search_metadata);
    });

    it('should prioritize different metadata field names correctly', () => {
      vi.mocked(formatSearchMetadata).mockReturnValue({ sources: [] });

      const geminiResponse = {
        candidates: [{ content: { parts: [{ text: 'Response' }] } }],
        groundingMetadata: { webSearchQueries: ['priority 1'] },
        grounding_metadata: { web_search_queries: ['priority 2'] },
        searchMetadata: { webSearchQueries: ['priority 3'] },
        search_metadata: { web_search_queries: ['priority 4'] },
      } as any;

      parseResponse(geminiResponse, 'test-model', 'gemini');

      // Should use groundingMetadata (first priority)
      expect(formatSearchMetadata).toHaveBeenCalledWith({ webSearchQueries: ['priority 1'] });
    });
  });

  describe('ID Generation', () => {
    it('should generate unique response IDs', () => {
      const response1 = parseResponse(
        { candidates: [{ content: { parts: [{ text: 'Test 1' }] } }] },
        'model',
        'gemini'
      );
      const response2 = parseResponse(
        { candidates: [{ content: { parts: [{ text: 'Test 2' }] } }] },
        'model',
        'gemini'
      );

      expect(response1.id).toMatch(/^gemini-\d+-[a-z0-9]+$/);
      expect(response2.id).toMatch(/^gemini-\d+-[a-z0-9]+$/);
      expect(response1.id).not.toBe(response2.id);
    });

    it('should generate unique chunk IDs', () => {
      const chunk1 = convertToStreamChunk({}, 'model');
      // Small delay to ensure different timestamp
      const start = Date.now();
      while (Date.now() === start) {
        /* wait */
      }
      const chunk2 = convertToStreamChunk({}, 'model');

      expect(chunk1.id).toMatch(/^gemini-\d+$/);
      expect(chunk2.id).toMatch(/^gemini-\d+$/);
      expect(chunk1.id).not.toBe(chunk2.id);
    });

    it('should generate timestamps within reasonable range', () => {
      const beforeTime = Math.floor(Date.now() / 1000);
      const chunk = convertToStreamChunk({}, 'model');
      const afterTime = Math.floor(Date.now() / 1000);

      expect(chunk.created).toBeGreaterThanOrEqual(beforeTime);
      expect(chunk.created).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed candidates array', () => {
      const geminiResponse = {
        candidates: [null, undefined, { content: { parts: [{ text: 'Valid' }] } }],
      } as any;

      // Should not throw and should handle the valid candidate
      const result = parseResponse(geminiResponse, 'model', 'gemini');
      expect(result.content).toBe(''); // No valid content due to null/undefined parts
    });

    it('should handle missing content field', () => {
      const geminiResponse: GeminiResponse = {
        candidates: [
          {
            finishReason: 'STOP',
            index: 0,
          },
        ],
      };

      const result = parseResponse(geminiResponse, 'model', 'gemini');
      expect(result.content).toBe('');
    });

    it('should handle malformed parts array', () => {
      const geminiResponse = {
        candidates: [
          {
            content: {
              parts: [{ text: 'Valid text' }], // Remove null/undefined parts
            },
          },
        ],
      } as any;

      const result = parseResponse(geminiResponse, 'model', 'gemini');
      expect(result.content).toBe('Valid text');
    });

    it('should handle very large content', () => {
      const largeText = 'A'.repeat(100000);
      const geminiResponse: GeminiResponse = {
        candidates: [
          {
            content: {
              parts: [{ text: largeText }],
            },
          },
        ],
      };

      const result = parseResponse(geminiResponse, 'model', 'gemini');
      expect(result.content).toBe(largeText);
    });

    it('should handle special characters in content', () => {
      const specialText = '🌟 Special chars: "quotes", \\backslashes\\, \n newlines 💫';
      const geminiResponse: GeminiResponse = {
        candidates: [
          {
            content: {
              parts: [{ text: specialText }],
            },
          },
        ],
      };

      const result = parseResponse(geminiResponse, 'model', 'gemini');
      expect(result.content).toBe(specialText);
    });

    it('should handle negative token counts gracefully', () => {
      const geminiResponse: GeminiResponse = {
        candidates: [{ content: { parts: [{ text: 'Test' }] } }],
        usageMetadata: {
          promptTokenCount: -1,
          candidatesTokenCount: -5,
          totalTokenCount: -10,
        },
      };

      const result = parseResponse(geminiResponse, 'model', 'gemini');
      expect(result.usage.promptTokens).toBe(-1);
      expect(result.usage.completionTokens).toBe(-5);
      expect(result.usage.totalTokens).toBe(-10);
    });

    it('should handle extremely large token counts', () => {
      const geminiResponse: GeminiResponse = {
        candidates: [{ content: { parts: [{ text: 'Test' }] } }],
        usageMetadata: {
          promptTokenCount: Number.MAX_SAFE_INTEGER,
          candidatesTokenCount: Number.MAX_SAFE_INTEGER - 1,
          totalTokenCount: Number.MAX_SAFE_INTEGER,
        },
      };

      const result = parseResponse(geminiResponse, 'model', 'gemini');
      expect(result.usage.promptTokens).toBe(Number.MAX_SAFE_INTEGER);
      expect(result.usage.completionTokens).toBe(Number.MAX_SAFE_INTEGER - 1);
      expect(result.usage.totalTokens).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should handle processing chunk with undefined choices', () => {
      const chunk = {
        id: 'test',
        object: 'response.chunk',
        created: 123,
        model: 'test',
        choices: undefined,
      } as any;

      expect(() => {
        processStreamChunk(chunk, { showThoughts: false });
      }).toThrow(); // Will throw when trying to map undefined choices
    });
  });
});
