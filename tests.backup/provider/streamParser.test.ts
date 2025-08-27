/**
 * @file SSE Stream Parser Tests
 *
 * Comprehensive test suite for Server-Sent Events (SSE) stream parsing functionality.
 * Tests parsing of OpenAI, Gemini, and OpenRouter/Claude streaming formats.
 *
 * Tests following TDD methodology:
 * 1. Test SSE parsing for complete messages
 * 2. Test chunk handling and buffering
 * 3. Test error detection and handling
 * 4. Test different provider formats
 * 5. Test edge cases and malformed data
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StreamParser } from '@provider/streamParser';
import type { StreamChunk, ProviderError } from '@types/providers';

describe('StreamParser', () => {
  let parser: StreamParser;

  beforeEach(() => {
    parser = new StreamParser();
  });

  describe('Basic SSE Parsing', () => {
    it('should parse a complete SSE message', () => {
      const sseData =
        'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-3.5-turbo","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}\n\n';

      const chunks = parser.parse(sseData);

      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toMatchObject({
        id: 'chatcmpl-123',
        object: 'chat.completion.chunk',
        created: 1677652288,
        model: 'gpt-3.5-turbo',
        choices: [
          {
            index: 0,
            delta: { content: 'Hello' },
            finishReason: null,
          },
        ],
      });
    });

    it('should parse multiple SSE messages in one chunk', () => {
      const sseData = `data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-3.5-turbo","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652289,"model":"gpt-3.5-turbo","choices":[{"index":0,"delta":{"content":" World"},"finish_reason":null}]}

`;

      const chunks = parser.parse(sseData);

      expect(chunks).toHaveLength(2);
      expect(chunks[0].choices[0].delta.content).toBe('Hello');
      expect(chunks[1].choices[0].delta.content).toBe(' World');
    });

    it('should handle empty data lines gracefully', () => {
      const sseData = `data: {"id":"test","object":"chunk","created":123,"model":"test","choices":[{"index":0,"delta":{"content":"test"},"finish_reason":null}]}

data: 

data: {"id":"test2","object":"chunk","created":124,"model":"test","choices":[{"index":0,"delta":{"content":"more"},"finish_reason":null}]}

`;

      const chunks = parser.parse(sseData);

      expect(chunks).toHaveLength(2);
      expect(chunks[0].choices[0].delta.content).toBe('test');
      expect(chunks[1].choices[0].delta.content).toBe('more');
    });

    it('should ignore comments and invalid lines', () => {
      const sseData = `: This is a comment
data: {"id":"test","object":"chunk","created":123,"model":"test","choices":[{"index":0,"delta":{"content":"valid"},"finish_reason":null}]}

: Another comment
event: ping
data: invalid line without proper SSE format

`;

      const chunks = parser.parse(sseData);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].choices[0].delta.content).toBe('valid');
    });
  });

  describe('Chunked Data Handling', () => {
    it('should buffer incomplete JSON across multiple chunks', () => {
      const chunk1 =
        'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"mo';
      const chunk2 =
        'del":"gpt-3.5-turbo","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}\n\n';

      const result1 = parser.parse(chunk1);
      expect(result1).toHaveLength(0);

      const result2 = parser.parse(chunk2);
      expect(result2).toHaveLength(1);
      expect(result2[0].choices[0].delta.content).toBe('Hello');
    });

    it('should handle partial SSE lines across chunks', () => {
      const chunk1 = 'data: {"id":"test",';
      const chunk2 =
        '"object":"chunk","created":123,"model":"test","choices":[{"index":0,"delta":{"content":"split"},"finish_reason":null}]}\n\n';

      const result1 = parser.parse(chunk1);
      expect(result1).toHaveLength(0);

      const result2 = parser.parse(chunk2);
      expect(result2).toHaveLength(1);
      expect(result2[0].choices[0].delta.content).toBe('split');
    });

    it('should handle multiple partial messages', () => {
      const chunk1 = `data: {"id":"1","object":"chunk","created":123,"model":"test","choices":[{"index":0,"delta":{"content":"first"},"finish_reason":null}]}

data: {"id":"2","object":"chunk","created":124,"model":"test","ch`;

      const chunk2 = `oices":[{"index":0,"delta":{"content":"second"},"finish_reason":null}]}

data: {"id":"3","object":"chunk","created":125,"model":"test","choices":[{"index":0,"delta":{"content":"third"},"finish_reason":null}]}

`;

      const result1 = parser.parse(chunk1);
      expect(result1).toHaveLength(1);
      expect(result1[0].choices[0].delta.content).toBe('first');

      const result2 = parser.parse(chunk2);
      expect(result2).toHaveLength(2);
      expect(result2[0].choices[0].delta.content).toBe('second');
      expect(result2[1].choices[0].delta.content).toBe('third');
    });

    it('should maintain buffer state correctly across multiple parse calls', () => {
      // Test complex buffering scenario
      const chunk1 = 'data: {"id":"1","object"';
      const chunk2 = ':"chunk","created":123,"model":"test"';
      const chunk3 =
        ',"choices":[{"index":0,"delta":{"content":"buffered"},"finish_reason":null}]}\n\n';

      expect(parser.parse(chunk1)).toHaveLength(0);
      expect(parser.parse(chunk2)).toHaveLength(0);

      const result = parser.parse(chunk3);
      expect(result).toHaveLength(1);
      expect(result[0].choices[0].delta.content).toBe('buffered');
    });
  });

  describe('Provider-Specific Formats', () => {
    describe('OpenAI Format', () => {
      it('should parse OpenAI streaming format with thinking tokens', () => {
        const sseData =
          'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"o1-preview","choices":[{"index":0,"delta":{"content":"Hello","thinking":"Let me think..."},"finish_reason":null}],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15,"thinking_tokens":3}}\n\n';

        const chunks = parser.parse(sseData);

        expect(chunks).toHaveLength(1);
        expect(chunks[0].choices[0].delta.thinking).toBe('Let me think...');
        expect(chunks[0].usage?.thinkingTokens).toBe(3);
      });

      it('should handle OpenAI [DONE] signal', () => {
        const sseData = 'data: [DONE]\n\n';

        const chunks = parser.parse(sseData);

        expect(chunks).toHaveLength(1);
        expect(chunks[0]).toMatchObject({
          id: 'done',
          object: 'chat.completion.chunk',
          created: expect.any(Number),
          model: 'unknown',
          choices: [
            {
              index: 0,
              delta: {},
              finishReason: 'stop',
            },
          ],
        });
      });

      it('should handle OpenAI finish_reason variations', () => {
        const sseData =
          'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1677652288,"model":"gpt-3.5-turbo","choices":[{"index":0,"delta":{},"finish_reason":"length"}]}\n\n';

        const chunks = parser.parse(sseData);

        expect(chunks[0].choices[0].finishReason).toBe('length');
      });
    });

    describe('Gemini Format', () => {
      it('should parse Gemini streaming format with thinking mode', () => {
        const sseData =
          'data: {"candidates":[{"content":{"parts":[{"text":"Hello from Gemini"}],"role":"model"},"finishReason":"STOP","index":0,"safetyRatings":[{"category":"HARM_CATEGORY_SEXUALLY_EXPLICIT","probability":"NEGLIGIBLE"}]}],"usageMetadata":{"promptTokenCount":5,"candidatesTokenCount":3,"totalTokenCount":8}}\n\n';

        const chunks = parser.parse(sseData);

        expect(chunks).toHaveLength(1);
        expect(chunks[0]).toMatchObject({
          id: expect.any(String),
          object: 'chat.completion.chunk',
          created: expect.any(Number),
          model: 'gemini',
          choices: [
            {
              index: 0,
              delta: { content: 'Hello from Gemini' },
              finishReason: 'stop',
            },
          ],
        });
      });

      it('should handle Gemini thinking mode data', () => {
        const sseData =
          'data: {"candidates":[{"content":{"parts":[{"text":"Response","thinking":"Gemini thoughts here"}],"role":"model"},"finishReason":null,"index":0}]}\n\n';

        const chunks = parser.parse(sseData);

        expect(chunks[0].choices[0].delta.thinking).toBe('Gemini thoughts here');
      });
    });

    describe('OpenRouter/Claude Format', () => {
      it('should parse Claude streaming format with thinking tokens', () => {
        const sseData =
          'data: {"id":"msg_123","type":"content_block_delta","index":0,"delta":{"type":"text","text":"Hello from Claude","thinking":"Claude reasoning..."},"usage":{"input_tokens":10,"output_tokens":5,"thinking_tokens":15}}\n\n';

        const chunks = parser.parse(sseData);

        expect(chunks).toHaveLength(1);
        expect(chunks[0].choices[0].delta.thinking).toBe('Claude reasoning...');
        expect(chunks[0].usage?.thinkingTokens).toBe(15);
      });

      it('should handle OpenRouter completion signal', () => {
        const sseData = 'data: {"type":"message_stop","complete":true}\n\n';

        const chunks = parser.parse(sseData);

        expect(chunks[0].choices[0].finishReason).toBe('stop');
      });
    });
  });

  describe('Error Handling', () => {
    it('should detect and parse error objects in stream', () => {
      const sseData =
        'data: {"error":{"message":"Rate limit exceeded","type":"rate_limit_error","code":"rate_limit"}}\n\n';

      expect(() => parser.parse(sseData)).toThrow();

      try {
        parser.parse(sseData);
      } catch (error) {
        expect(error).toMatchObject({
          type: 'rate_limit',
          message: 'Rate limit exceeded',
          code: 'rate_limit',
        });
      }
    });

    it('should handle malformed JSON gracefully', () => {
      const sseData = 'data: {"id":"test","invalid":json}\n\n';

      const chunks = parser.parse(sseData);

      expect(chunks).toHaveLength(0);
    });

    it('should handle network errors in stream', () => {
      const sseData =
        'data: {"error":{"message":"Network timeout","type":"network_error","code":"timeout"}}\n\n';

      expect(() => parser.parse(sseData)).toThrow();
    });

    it('should handle authentication errors', () => {
      const sseData =
        'data: {"error":{"message":"Invalid API key","type":"invalid_request_error","code":"invalid_api_key"}}\n\n';

      expect(() => parser.parse(sseData)).toThrow();
    });

    it('should continue parsing after malformed chunks', () => {
      const sseData = `data: {"malformed":json}

data: {"id":"valid","object":"chunk","created":123,"model":"test","choices":[{"index":0,"delta":{"content":"good"},"finish_reason":null}]}

`;

      const chunks = parser.parse(sseData);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].choices[0].delta.content).toBe('good');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty input', () => {
      const chunks = parser.parse('');
      expect(chunks).toHaveLength(0);
    });

    it('should handle whitespace-only input', () => {
      const chunks = parser.parse('   \n\n  \t  ');
      expect(chunks).toHaveLength(0);
    });

    it('should handle very large JSON objects', () => {
      const largeContent = 'x'.repeat(10000);
      const sseData = `data: {"id":"large","object":"chunk","created":123,"model":"test","choices":[{"index":0,"delta":{"content":"${largeContent}"},"finish_reason":null}]}

`;

      const chunks = parser.parse(sseData);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].choices[0].delta.content).toBe(largeContent);
    });

    it('should handle unicode characters correctly', () => {
      const unicodeContent = '🚀 Hello 世界 مرحبا';
      const sseData = `data: {"id":"unicode","object":"chunk","created":123,"model":"test","choices":[{"index":0,"delta":{"content":"${unicodeContent}"},"finish_reason":null}]}

`;

      const chunks = parser.parse(sseData);

      expect(chunks[0].choices[0].delta.content).toBe(unicodeContent);
    });

    it('should handle mixed line endings', () => {
      const sseData =
        'data: {"id":"test","object":"chunk","created":123,"model":"test","choices":[{"index":0,"delta":{"content":"mixed"},"finish_reason":null}]}\r\n\r\n';

      const chunks = parser.parse(sseData);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].choices[0].delta.content).toBe('mixed');
    });

    it('should handle extremely long lines', () => {
      const longJson = `{"id":"long","object":"chunk","created":123,"model":"test","choices":[{"index":0,"delta":{"content":"${'a'.repeat(50000)}"},"finish_reason":null}]}`;
      const sseData = `data: ${longJson}\n\n`;

      const chunks = parser.parse(sseData);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].choices[0].delta.content).toHaveLength(50000);
    });
  });

  describe('Buffer Management', () => {
    it('should clear buffer after successful parse', () => {
      const chunk1 = 'data: {"incomplete"';
      const chunk2 =
        ': true}\n\ndata: {"id":"new","object":"chunk","created":123,"model":"test","choices":[{"index":0,"delta":{"content":"fresh"},"finish_reason":null}]}\n\n';

      parser.parse(chunk1);
      const result = parser.parse(chunk2);

      // Should parse the new complete message
      expect(result).toHaveLength(1);
      expect(result[0].choices[0].delta.content).toBe('fresh');
    });

    it('should handle buffer overflow protection', () => {
      // Test with extremely large buffer to ensure memory protection
      const largeChunk = 'data: {"huge": "' + 'x'.repeat(1000000);

      // Should not crash or consume excessive memory
      expect(() => parser.parse(largeChunk)).not.toThrow();
    });

    it('should reset buffer on parse errors', () => {
      const badChunk = 'data: {"malformed"';
      const goodChunk =
        'data: {"id":"good","object":"chunk","created":123,"model":"test","choices":[{"index":0,"delta":{"content":"clean"},"finish_reason":null}]}\n\n';

      parser.parse(badChunk);
      parser.reset(); // Manual reset
      const result = parser.parse(goodChunk);

      expect(result).toHaveLength(1);
      expect(result[0].choices[0].delta.content).toBe('clean');
    });
  });

  describe('Parser State Management', () => {
    it('should provide reset functionality', () => {
      parser.parse('data: {"incomplete"');
      parser.reset();

      const result = parser.parse(
        'data: {"id":"fresh","object":"chunk","created":123,"model":"test","choices":[{"index":0,"delta":{"content":"reset"},"finish_reason":null}]}\n\n'
      );

      expect(result).toHaveLength(1);
      expect(result[0].choices[0].delta.content).toBe('reset');
    });

    it('should provide buffer status information', () => {
      expect(parser.hasBufferedData()).toBe(false);

      parser.parse('data: {"incomplete"');
      expect(parser.hasBufferedData()).toBe(true);

      parser.parse(': true}\n\n');
      expect(parser.hasBufferedData()).toBe(false);
    });

    it('should provide buffer size information', () => {
      expect(parser.getBufferSize()).toBe(0);

      const partialData = 'data: {"incomplete"';
      parser.parse(partialData);
      expect(parser.getBufferSize()).toBe(partialData.length);

      parser.reset();
      expect(parser.getBufferSize()).toBe(0);
    });
  });

  describe('Performance', () => {
    it('should parse large streams efficiently', () => {
      const startTime = performance.now();

      // Generate 1000 SSE messages
      let sseData = '';
      for (let i = 0; i < 1000; i++) {
        sseData += `data: {"id":"msg-${i}","object":"chunk","created":${Date.now()},"model":"test","choices":[{"index":0,"delta":{"content":"message ${i}"},"finish_reason":null}]}\n\n`;
      }

      const chunks = parser.parse(sseData);
      const endTime = performance.now();

      expect(chunks).toHaveLength(1000);
      expect(endTime - startTime).toBeLessThan(100); // Should parse in < 100ms
    });

    it('should handle memory efficiently with repeated use', () => {
      // Test memory doesn't grow with repeated parsing
      for (let i = 0; i < 100; i++) {
        const sseData = `data: {"id":"test-${i}","object":"chunk","created":123,"model":"test","choices":[{"index":0,"delta":{"content":"test"},"finish_reason":null}]}\n\n`;
        parser.parse(sseData);
      }

      // Should still function correctly after many operations
      const result = parser.parse(
        'data: {"id":"final","object":"chunk","created":123,"model":"test","choices":[{"index":0,"delta":{"content":"final"},"finish_reason":null}]}\n\n'
      );
      expect(result[0].choices[0].delta.content).toBe('final');
    });
  });
});
