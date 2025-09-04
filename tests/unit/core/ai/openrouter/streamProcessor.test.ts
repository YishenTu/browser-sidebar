/**
 * @file OpenRouter Stream Processor Unit Tests
 *
 * Comprehensive unit tests for the OpenRouter stream processor,
 * covering OpenAI SDK chunk processing, SSE line processing,
 * reasoning extraction, search result handling, and edge cases.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { processStreamChunk, processSSELine } from '@/core/ai/openrouter/streamProcessor';
import type { StreamChunk, SearchResult } from '@/types/providers';
import type { OpenRouterStreamChunk } from '@/core/ai/openrouter/types';
import type { ChatCompletionChunk } from 'openai/resources/chat/completions';

// Store original URL constructor before mocking
const OriginalURL = URL;

// Mock URL constructor for search result processing
global.URL = class MockURL {
  hostname: string;
  constructor(url: string) {
    try {
      const realUrl = new OriginalURL(url);
      this.hostname = realUrl.hostname;
    } catch {
      this.hostname = 'unknown.com';
    }
  }
} as any;

describe('OpenRouter Stream Processor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('processStreamChunk', () => {
    const createBasicChunk = (
      overrides: Partial<ChatCompletionChunk> = {}
    ): ChatCompletionChunk => ({
      id: 'chatcmpl-123',
      object: 'chat.completion.chunk',
      created: 1677652288,
      model: 'gpt-4o',
      choices: [
        {
          index: 0,
          delta: {
            content: 'Hello, world!',
          },
          finish_reason: null,
        },
      ],
      ...overrides,
    });

    it('should process basic content chunk', () => {
      const chunk = createBasicChunk();
      const result = processStreamChunk(chunk);

      expect(result).toEqual({
        id: 'chatcmpl-123',
        object: 'chat.completion.chunk',
        created: 1677652288,
        model: 'gpt-4o',
        choices: [
          {
            index: 0,
            delta: {
              role: undefined,
              content: 'Hello, world!',
              thinking: undefined,
            },
            finishReason: null,
          },
        ],
        usage: undefined,
      });
    });

    it('should process chunk with role in delta', () => {
      const chunk = createBasicChunk({
        choices: [
          {
            index: 0,
            delta: {
              role: 'assistant',
              content: 'Hello!',
            },
            finish_reason: null,
          },
        ],
      });

      const result = processStreamChunk(chunk);

      expect(result!.choices[0].delta.role).toBe('assistant');
    });

    it('should process chunk with usage information', () => {
      const chunk = createBasicChunk({
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
      });

      const result = processStreamChunk(chunk);

      expect(result!.usage).toEqual({
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
      });
    });

    it('should handle missing usage fields', () => {
      const chunk = createBasicChunk({
        usage: {
          prompt_tokens: undefined,
          completion_tokens: undefined,
          total_tokens: 20,
        },
      });

      const result = processStreamChunk(chunk);

      expect(result!.usage).toEqual({
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 20,
      });
    });

    it('should process finish reason', () => {
      const chunk = createBasicChunk({
        choices: [
          {
            index: 0,
            delta: { content: 'Final message' },
            finish_reason: 'stop',
          },
        ],
      });

      const result = processStreamChunk(chunk);

      expect(result!.choices[0].finishReason).toBe('stop');
    });

    it('should handle multiple choices', () => {
      const chunk = createBasicChunk({
        choices: [
          {
            index: 0,
            delta: { content: 'Choice 1' },
            finish_reason: null,
          },
          {
            index: 1,
            delta: { content: 'Choice 2' },
            finish_reason: 'stop',
          },
        ],
      });

      const result = processStreamChunk(chunk);

      expect(result!.choices).toHaveLength(2);
      expect(result!.choices[0].delta.content).toBe('Choice 1');
      expect(result!.choices[1].delta.content).toBe('Choice 2');
      expect(result!.choices[1].finishReason).toBe('stop');
    });

    describe('Reasoning Processing', () => {
      it('should extract simple reasoning field', () => {
        const chunk = createBasicChunk({
          choices: [
            {
              index: 0,
              delta: {
                reasoning: 'Let me think about this...',
                content: 'Answer',
              } as any,
              finish_reason: null,
            },
          ],
        });

        const result = processStreamChunk(chunk);

        expect(result!.choices[0].delta.thinking).toBe('Let me think about this...');
      });

      it('should process reasoning_details array with text type', () => {
        const chunk = createBasicChunk({
          choices: [
            {
              index: 0,
              delta: {
                reasoning_details: [
                  { type: 'reasoning.text', text: 'First thought' },
                  { type: 'reasoning.text', text: 'Second thought' },
                ],
                content: 'Answer',
              } as any,
              finish_reason: null,
            },
          ],
        });

        const result = processStreamChunk(chunk);

        expect(result!.choices[0].delta.thinking).toBe('First thought\nSecond thought');
      });

      it('should process reasoning_details with summary type', () => {
        const chunk = createBasicChunk({
          choices: [
            {
              index: 0,
              delta: {
                reasoning_details: [{ type: 'reasoning.summary', summary: 'Reasoning summary' }],
                content: 'Answer',
              } as any,
              finish_reason: null,
            },
          ],
        });

        const result = processStreamChunk(chunk);

        expect(result!.choices[0].delta.thinking).toBe('Reasoning summary');
      });

      it('should handle reasoning_details with encrypted type', () => {
        const chunk = createBasicChunk({
          choices: [
            {
              index: 0,
              delta: {
                reasoning_details: [{ type: 'reasoning.encrypted', data: 'encrypted_data' }],
                content: 'Answer',
              } as any,
              finish_reason: null,
            },
          ],
        });

        const result = processStreamChunk(chunk);

        expect(result!.choices[0].delta.thinking).toBe('[Reasoning content]');
      });

      it('should skip redacted encrypted reasoning', () => {
        const chunk = createBasicChunk({
          choices: [
            {
              index: 0,
              delta: {
                reasoning_details: [{ type: 'reasoning.encrypted', data: '[REDACTED]' }],
                content: 'Answer',
              } as any,
              finish_reason: null,
            },
          ],
        });

        const result = processStreamChunk(chunk);

        expect(result!.choices[0].delta.thinking).toBeUndefined();
      });

      it('should handle mixed reasoning_details types', () => {
        const chunk = createBasicChunk({
          choices: [
            {
              index: 0,
              delta: {
                reasoning_details: [
                  { type: 'reasoning.text', text: 'Text part' },
                  { type: 'reasoning.summary', summary: 'Summary part' },
                  { type: 'reasoning.encrypted', data: 'encrypted' },
                ],
                content: 'Answer',
              } as any,
              finish_reason: null,
            },
          ],
        });

        const result = processStreamChunk(chunk);

        expect(result!.choices[0].delta.thinking).toBe(
          'Text part\nSummary part\n[Reasoning content]'
        );
      });

      it('should handle unknown reasoning detail type with fallback', () => {
        const chunk = createBasicChunk({
          choices: [
            {
              index: 0,
              delta: {
                reasoning_details: [
                  { type: 'reasoning.unknown', text: 'Unknown text' },
                  { type: 'reasoning.custom', summary: 'Custom summary' },
                ],
                content: 'Answer',
              } as any,
              finish_reason: null,
            },
          ],
        });

        const result = processStreamChunk(chunk);

        expect(result!.choices[0].delta.thinking).toBe('Unknown text\nCustom summary');
      });

      it('should prefer simple reasoning over reasoning_details', () => {
        const chunk = createBasicChunk({
          choices: [
            {
              index: 0,
              delta: {
                reasoning: 'Simple reasoning',
                reasoning_details: [{ type: 'reasoning.text', text: 'Detailed reasoning' }],
                content: 'Answer',
              } as any,
              finish_reason: null,
            },
          ],
        });

        const result = processStreamChunk(chunk);

        expect(result!.choices[0].delta.thinking).toBe('Simple reasoning');
      });

      it('should handle empty reasoning_details array', () => {
        const chunk = createBasicChunk({
          choices: [
            {
              index: 0,
              delta: {
                reasoning_details: [],
                content: 'Answer',
              } as any,
              finish_reason: null,
            },
          ],
        });

        const result = processStreamChunk(chunk);

        expect(result!.choices[0].delta.thinking).toBeUndefined();
      });
    });

    describe('Web Search Results Processing', () => {
      it('should extract web search results from annotations', () => {
        const chunk = createBasicChunk({
          choices: [
            {
              index: 0,
              delta: {
                content: 'Search results:',
                annotations: [
                  {
                    type: 'url_citation',
                    url_citation: {
                      url: 'https://example.com',
                      title: 'Example Site',
                      content: 'This is an example',
                      domain: 'example.com',
                    },
                  },
                ],
              } as any,
              finish_reason: null,
            },
          ],
        });

        const result = processStreamChunk(chunk);

        expect(result!.metadata).toEqual({
          searchResults: {
            sources: [
              {
                url: 'https://example.com',
                title: 'Example Site',
                snippet: 'This is an example',
                domain: 'example.com',
              },
            ],
          },
        });
      });

      it('should handle flattened url_citation format', () => {
        const chunk = createBasicChunk({
          choices: [
            {
              index: 0,
              delta: {
                content: 'Search results:',
                annotations: [
                  {
                    type: 'url_citation',
                    url: 'https://test.com',
                    title: 'Test Site',
                    snippet: 'Test content',
                    domain: 'test.com',
                  },
                ],
              } as any,
              finish_reason: null,
            },
          ],
        });

        const result = processStreamChunk(chunk);

        expect(result!.metadata).toEqual({
          searchResults: {
            sources: [
              {
                url: 'https://test.com',
                title: 'Test Site',
                snippet: 'Test content',
                domain: 'test.com',
              },
            ],
          },
        });
      });

      it('should generate default title and domain when missing', () => {
        const chunk = createBasicChunk({
          choices: [
            {
              index: 0,
              delta: {
                content: 'Search results:',
                annotations: [
                  {
                    type: 'url_citation',
                    url: 'https://missing-info.com',
                  },
                ],
              } as any,
              finish_reason: null,
            },
          ],
        });

        const result = processStreamChunk(chunk);

        expect(result!.metadata).toEqual({
          searchResults: {
            sources: [
              {
                url: 'https://missing-info.com',
                title: 'Untitled',
                snippet: undefined,
                domain: 'missing-info.com',
              },
            ],
          },
        });
      });

      it('should handle multiple url_citation annotations', () => {
        const chunk = createBasicChunk({
          choices: [
            {
              index: 0,
              delta: {
                content: 'Multiple results:',
                annotations: [
                  {
                    type: 'url_citation',
                    url: 'https://first.com',
                    title: 'First Site',
                  },
                  {
                    type: 'url_citation',
                    url: 'https://second.com',
                    title: 'Second Site',
                  },
                ],
              } as any,
              finish_reason: null,
            },
          ],
        });

        const result = processStreamChunk(chunk);

        expect(result!.metadata!.searchResults!.sources).toHaveLength(2);
        expect(result!.metadata!.searchResults!.sources[0].title).toBe('First Site');
        expect(result!.metadata!.searchResults!.sources[1].title).toBe('Second Site');
      });

      it('should ignore non-url_citation annotations', () => {
        const chunk = createBasicChunk({
          choices: [
            {
              index: 0,
              delta: {
                content: 'Content with other annotations:',
                annotations: [
                  { type: 'other_type', data: 'ignored' },
                  {
                    type: 'url_citation',
                    url: 'https://valid.com',
                    title: 'Valid Site',
                  },
                ],
              } as any,
              finish_reason: null,
            },
          ],
        });

        const result = processStreamChunk(chunk);

        expect(result!.metadata!.searchResults!.sources).toHaveLength(1);
        expect(result!.metadata!.searchResults!.sources[0].title).toBe('Valid Site');
      });

      it('should handle annotations without valid URLs', () => {
        const chunk = createBasicChunk({
          choices: [
            {
              index: 0,
              delta: {
                content: 'Invalid URLs:',
                annotations: [
                  { type: 'url_citation', url: null },
                  { type: 'url_citation', url: undefined },
                  { type: 'url_citation' }, // no url field
                ],
              } as any,
              finish_reason: null,
            },
          ],
        });

        const result = processStreamChunk(chunk);

        expect(result!.metadata).toBeUndefined();
      });
    });

    describe('Edge Cases', () => {
      it('should handle chunk with no choices', () => {
        const chunk = createBasicChunk({ choices: [] });
        const result = processStreamChunk(chunk);

        expect(result!.choices).toEqual([]);
      });

      it('should handle choice with message instead of delta', () => {
        const chunk: ChatCompletionChunk = {
          id: 'chatcmpl-123',
          object: 'chat.completion.chunk',
          created: 1677652288,
          model: 'gpt-4o',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: 'Complete message',
              } as any,
              finish_reason: null,
            },
          ],
        };

        const result = processStreamChunk(chunk);

        // The implementation uses choice.delta?.role which is undefined when only message exists
        expect(result!.choices[0].delta.role).toBeUndefined();
        expect(result!.choices[0].delta.content).toBeUndefined();
        // The reasoning processing works from the message though
      });

      it('should handle null/undefined delta content', () => {
        const chunk = createBasicChunk({
          choices: [
            {
              index: 0,
              delta: { content: null },
              finish_reason: null,
            },
          ],
        });

        const result = processStreamChunk(chunk);

        expect(result!.choices[0].delta.content).toBeUndefined();
      });

      it('should handle undefined finish_reason', () => {
        const chunk = createBasicChunk({
          choices: [
            {
              index: 0,
              delta: { content: 'Test' },
              finish_reason: undefined,
            },
          ],
        });

        const result = processStreamChunk(chunk);

        expect(result!.choices[0].finishReason).toBeNull();
      });
    });
  });

  describe('processSSELine', () => {
    const createBasicSSEChunk = (
      overrides: Partial<OpenRouterStreamChunk> = {}
    ): OpenRouterStreamChunk => ({
      id: 'chatcmpl-456',
      object: 'chat.completion.chunk',
      created: 1677652289,
      model: 'gpt-4o',
      choices: [
        {
          index: 0,
          delta: {
            content: 'SSE content',
          },
          finish_reason: null,
        },
      ],
      ...overrides,
    });

    it('should process valid SSE data line', () => {
      const chunk = createBasicSSEChunk();
      const line = `data: ${JSON.stringify(chunk)}`;

      const result = processSSELine(line);

      expect(result).toEqual({
        id: 'chatcmpl-456',
        object: 'chat.completion.chunk',
        created: 1677652289,
        model: 'gpt-4o',
        choices: [
          {
            index: 0,
            delta: {
              role: undefined,
              content: 'SSE content',
              thinking: undefined,
            },
            finishReason: null,
          },
        ],
        usage: undefined,
        metadata: undefined,
      });
    });

    it('should process line without data prefix', () => {
      const chunk = createBasicSSEChunk();
      const line = JSON.stringify(chunk);

      const result = processSSELine(line);

      expect(result).not.toBeNull();
      expect(result!.id).toBe('chatcmpl-456');
    });

    it('should return null for [DONE] marker', () => {
      const result1 = processSSELine('data: [DONE]');
      const result2 = processSSELine('[DONE]');

      expect(result1).toBeNull();
      expect(result2).toBeNull();
    });

    it('should return null for empty lines', () => {
      expect(processSSELine('')).toBeNull();
      // Note: Whitespace-only lines will cause JSON parse errors, not return null
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(processSSELine('   ')).toBeNull();
      consoleSpy.mockRestore();
    });

    it('should return null for comment lines', () => {
      expect(processSSELine(': this is a comment')).toBeNull();
      expect(processSSELine(': another comment')).toBeNull();
    });

    it('should handle SSE chunk with usage', () => {
      const chunk = createBasicSSEChunk({
        usage: {
          prompt_tokens: 20,
          completion_tokens: 10,
          total_tokens: 30,
        },
      });
      const line = `data: ${JSON.stringify(chunk)}`;

      const result = processSSELine(line);

      expect(result!.usage).toEqual({
        promptTokens: 20,
        completionTokens: 10,
        totalTokens: 30,
      });
    });

    it('should handle SSE chunk with metadata', () => {
      const chunk = createBasicSSEChunk({
        metadata: {
          custom: 'metadata',
          values: [1, 2, 3],
        },
      });
      const line = `data: ${JSON.stringify(chunk)}`;

      const result = processSSELine(line);

      expect(result!.metadata).toEqual({
        custom: 'metadata',
        values: [1, 2, 3],
      });
    });

    describe('SSE Reasoning Processing', () => {
      it('should extract simple reasoning from SSE delta', () => {
        const chunk = createBasicSSEChunk({
          choices: [
            {
              index: 0,
              delta: {
                reasoning: 'SSE reasoning',
                content: 'SSE content',
              },
              finish_reason: null,
            },
          ],
        });
        const line = `data: ${JSON.stringify(chunk)}`;

        const result = processSSELine(line);

        expect(result!.choices[0].delta.thinking).toBe('SSE reasoning');
      });

      it('should process reasoning_details in SSE format', () => {
        const chunk = createBasicSSEChunk({
          choices: [
            {
              index: 0,
              delta: {
                reasoning_details: [{ text: 'First part' }, { summary: 'Summary part' }],
                content: 'SSE content',
              },
              finish_reason: null,
            },
          ],
        });
        const line = `data: ${JSON.stringify(chunk)}`;

        const result = processSSELine(line);

        expect(result!.choices[0].delta.thinking).toBe('First part\nSummary part');
      });

      it('should handle empty reasoning_details in SSE', () => {
        const chunk = createBasicSSEChunk({
          choices: [
            {
              index: 0,
              delta: {
                reasoning_details: [],
                content: 'SSE content',
              },
              finish_reason: null,
            },
          ],
        });
        const line = `data: ${JSON.stringify(chunk)}`;

        const result = processSSELine(line);

        expect(result!.choices[0].delta.thinking).toBeUndefined();
      });
    });

    describe('SSE Search Results Processing', () => {
      it('should extract search results from SSE chunk annotations', () => {
        const chunk = createBasicSSEChunk({
          choices: [
            {
              index: 0,
              delta: {
                content: 'Search results',
                annotations: [
                  {
                    type: 'url_citation',
                    url_citation: {
                      url: 'https://sse-example.com',
                      title: 'SSE Example',
                      content: 'SSE search content',
                      domain: 'sse-example.com',
                    },
                  },
                ],
              },
              finish_reason: null,
            },
          ],
        });
        const line = `data: ${JSON.stringify(chunk)}`;

        const result = processSSELine(line);

        expect(result!.metadata).toEqual({
          searchResults: {
            sources: [
              {
                url: 'https://sse-example.com',
                title: 'SSE Example',
                snippet: 'SSE search content',
                domain: 'sse-example.com',
              },
            ],
          },
        });
      });

      it('should merge search results with existing metadata', () => {
        const chunk = createBasicSSEChunk({
          choices: [
            {
              index: 0,
              delta: {
                content: 'Search results',
                annotations: [
                  {
                    type: 'url_citation',
                    url: 'https://merge-test.com',
                    title: 'Merge Test',
                  },
                ],
              },
              finish_reason: null,
            },
          ],
          metadata: {
            existing: 'metadata',
          },
        });
        const line = `data: ${JSON.stringify(chunk)}`;

        const result = processSSELine(line);

        if (result) {
          expect(result.metadata).toEqual({
            existing: 'metadata',
            searchResults: {
              sources: [
                {
                  url: 'https://merge-test.com',
                  title: 'Merge Test',
                  snippet: undefined,
                  domain: 'merge-test.com',
                },
              ],
            },
          });
        } else {
          throw new Error('Expected result to not be null');
        }
      });
    });

    describe('SSE Edge Cases', () => {
      it('should return null for invalid JSON', () => {
        const line = 'data: invalid json {';
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const result = processSSELine(line);

        expect(result).toBeNull();
        expect(consoleSpy).toHaveBeenCalledWith('Failed to parse SSE line:', expect.any(Error));

        consoleSpy.mockRestore();
      });

      it('should handle SSE chunk with no delta field', () => {
        const chunk = {
          ...createBasicSSEChunk(),
          choices: [
            {
              index: 0,
              delta: {}, // Empty delta
              finish_reason: 'stop',
            },
          ],
        };
        const line = `data: ${JSON.stringify(chunk)}`;

        const result = processSSELine(line);

        expect(result!.choices[0].delta).toEqual({
          role: undefined,
          content: undefined,
          thinking: undefined,
        });
      });

      it('should handle malformed SSE chunk structure', () => {
        const malformedChunk = {
          id: 'test',
          object: 'test',
          created: 123,
          model: 'test',
          choices: [], // Empty choices array
        };
        const line = `data: ${JSON.stringify(malformedChunk)}`;

        const result = processSSELine(line);

        expect(result).toEqual({
          id: 'test',
          object: 'test',
          created: 123,
          model: 'test',
          choices: [],
          usage: undefined,
          metadata: undefined,
        });
      });

      it('should handle SSE line with whitespace', () => {
        const chunk = createBasicSSEChunk();
        const line = `  data: ${JSON.stringify(chunk)}  `;

        // Note: current implementation doesn't trim, so this would be invalid JSON
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const result = processSSELine(line);

        expect(result).toBeNull();
        consoleSpy.mockRestore();
      });

      it('should handle empty data prefix', () => {
        const result = processSSELine('data: ');
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        expect(result).toBeNull();

        consoleSpy.mockRestore();
      });
    });
  });

  describe('Type Safety and Contract Validation', () => {
    it('should maintain StreamChunk interface compatibility', () => {
      const chunk = processStreamChunk({
        id: 'test-id',
        object: 'chat.completion.chunk',
        created: 123456789,
        model: 'test-model',
        choices: [
          {
            index: 0,
            delta: { content: 'test' },
            finish_reason: 'stop',
          },
        ],
      });

      // Validate StreamChunk interface
      expect(chunk).toMatchObject({
        id: expect.any(String),
        object: expect.any(String),
        created: expect.any(Number),
        model: expect.any(String),
        choices: expect.any(Array),
      });

      // Validate choice structure
      expect(chunk!.choices[0]).toMatchObject({
        index: expect.any(Number),
        delta: expect.any(Object),
        finishReason: expect.any(String),
      });

      // Validate delta structure
      expect(chunk!.choices[0].delta).toHaveProperty('content');
      expect(chunk!.choices[0].delta).toHaveProperty('role');
      expect(chunk!.choices[0].delta).toHaveProperty('thinking');
    });

    it('should handle SearchResult interface correctly', () => {
      const chunk = processStreamChunk({
        id: 'test-search',
        object: 'chat.completion.chunk',
        created: 123456789,
        model: 'test-model',
        choices: [
          {
            index: 0,
            delta: {
              content: 'search',
              annotations: [
                {
                  type: 'url_citation',
                  url: 'https://test.com',
                  title: 'Test',
                  snippet: 'Test snippet',
                  domain: 'test.com',
                },
              ],
            } as any,
            finish_reason: null,
          },
        ],
      });

      const searchResult = chunk!.metadata!.searchResults!.sources[0];

      // Validate SearchResult interface
      expect(searchResult).toMatchObject({
        title: expect.any(String),
        url: expect.any(String),
        snippet: expect.any(String),
        domain: expect.any(String),
      });
    });
  });
});
