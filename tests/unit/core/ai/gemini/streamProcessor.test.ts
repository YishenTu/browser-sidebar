/**
 * @file Gemini Stream Processor Unit Tests
 *
 * Comprehensive unit tests for the Gemini stream processor,
 * covering JSON array parsing, SSE/NDJSON processing, state management,
 * and various streaming scenarios.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GeminiStreamProcessor } from '@/core/ai/gemini/streamProcessor';

describe('GeminiStreamProcessor', () => {
  let processor: GeminiStreamProcessor;

  beforeEach(() => {
    processor = new GeminiStreamProcessor();
  });

  describe('Constructor and Reset', () => {
    it('should initialize with clean state', () => {
      expect(processor['state'].buffer).toBe('');
      expect(processor['state'].inString).toBe(false);
      expect(processor['state'].depth).toBe(0);
      expect(processor['state'].arrayStarted).toBe(false);
      expect(processor['state'].arrayEnded).toBe(false);
      expect(processor['state'].sseBuffer).toBe('');
      expect(processor['state'].mode).toBe('unknown');
    });

    it('should reset state to initial values', () => {
      // Set some state
      processor['state'].buffer = 'some data';
      processor['state'].inString = true;
      processor['state'].depth = 5;
      processor['state'].arrayStarted = true;
      processor['state'].arrayEnded = true;
      processor['state'].sseBuffer = 'partial';
      processor['state'].mode = 'sse';

      // Reset
      processor.reset();

      // Verify reset
      expect(processor['state'].buffer).toBe('');
      expect(processor['state'].inString).toBe(false);
      expect(processor['state'].depth).toBe(0);
      expect(processor['state'].arrayStarted).toBe(false);
      expect(processor['state'].arrayEnded).toBe(false);
      expect(processor['state'].sseBuffer).toBe('');
      expect(processor['state'].mode).toBe('unknown');
    });
  });

  describe('JSON Array Format Processing', () => {
    it('should detect and process JSON array format', () => {
      const chunk = '[{"candidates": [{"content": {"parts": [{"text": "Hello"}]}}]}]';

      const results = processor.processChunk(chunk);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        candidates: [
          {
            content: {
              parts: [{ text: 'Hello' }],
            },
          },
        ],
      });
      // After processing complete array, arrayStarted should be false and arrayEnded should be true
      expect(processor['state'].arrayStarted).toBe(false);
      expect(processor['state'].arrayEnded).toBe(true);
    });

    it('should handle array with multiple objects', () => {
      const chunk = '[{"text": "first"}, {"text": "second"}, {"text": "third"}]';

      const results = processor.processChunk(chunk);

      expect(results).toHaveLength(3);
      expect(results[0]).toEqual({ text: 'first' });
      expect(results[1]).toEqual({ text: 'second' });
      expect(results[2]).toEqual({ text: 'third' });
    });

    it('should handle incomplete JSON objects across chunks', () => {
      // First chunk: start of array and partial object
      const chunk1 = '[{"candidates": [{"content":';
      const results1 = processor.processChunk(chunk1);
      expect(results1).toHaveLength(0);

      // Second chunk: complete the object
      const chunk2 = ' {"parts": [{"text": "Complete"}]}}]}]';
      const results2 = processor.processChunk(chunk2);
      expect(results2).toHaveLength(1);
      expect(results2[0].candidates[0].content.parts[0].text).toBe('Complete');
    });

    it('should handle comma-separated objects', () => {
      const chunk = '[{"id": 1}, {"id": 2}, {"id": 3}]';

      const results = processor.processChunk(chunk);

      expect(results).toHaveLength(3);
      expect(results.map(r => (r as any).id)).toEqual([1, 2, 3]);
    });

    it('should handle nested objects in array', () => {
      const chunk = '[{"outer": {"inner": {"deep": "value"}}}]';

      const results = processor.processChunk(chunk);

      expect(results).toHaveLength(1);
      expect((results[0] as any).outer.inner.deep).toBe('value');
    });

    it('should handle empty array', () => {
      const chunk = '[]';

      const results = processor.processChunk(chunk);

      expect(results).toHaveLength(0);
    });

    it('should handle array with whitespace', () => {
      const chunk = '  [  {"text": "spaced"}  ]  ';

      const results = processor.processChunk(chunk);

      expect(results).toHaveLength(1);
      expect((results[0] as any).text).toBe('spaced');
    });

    it('should ignore malformed JSON objects', () => {
      const chunk = '[{"valid": true}, {invalid json}, {"also": "valid"}]';

      const results = processor.processChunk(chunk);

      expect(results).toHaveLength(2);
      expect((results[0] as any).valid).toBe(true);
      expect((results[1] as any).also).toBe('valid');
    });

    it('should handle strings with special characters in array', () => {
      const chunk = '[{"text": "Hello \\"world\\" with \\n newlines and \\t tabs"}]';

      const results = processor.processChunk(chunk);

      expect(results).toHaveLength(1);
      expect((results[0] as any).text).toBe('Hello "world" with \n newlines and \t tabs');
    });

    it('should handle objects with array values', () => {
      const chunk = '[{"items": [1, 2, 3], "nested": {"array": ["a", "b"]}}]';

      const results = processor.processChunk(chunk);

      expect(results).toHaveLength(1);
      expect((results[0] as any).items).toEqual([1, 2, 3]);
      expect((results[0] as any).nested.array).toEqual(['a', 'b']);
    });
  });

  describe('SSE/NDJSON Format Processing', () => {
    it('should process SSE format data', () => {
      const chunk = 'data: {"text": "Hello"}\n\ndata: {"text": "World"}\n\n';

      const results = processor.processChunk(chunk);

      expect(results).toHaveLength(2);
      expect((results[0] as any).text).toBe('Hello');
      expect((results[1] as any).text).toBe('World');
    });

    it('should process NDJSON format data', () => {
      const chunk = '{"line": 1}\n{"line": 2}\n{"line": 3}\n';

      const results = processor.processChunk(chunk);

      expect(results).toHaveLength(3);
      expect((results[0] as any).line).toBe(1);
      expect((results[1] as any).line).toBe(2);
      expect((results[2] as any).line).toBe(3);
    });

    it('should ignore SSE [DONE] marker', () => {
      const chunk = 'data: {"text": "Hello"}\n\ndata: [DONE]\n\n';

      const results = processor.processChunk(chunk);

      expect(results).toHaveLength(1);
      expect((results[0] as any).text).toBe('Hello');
    });

    it('should handle incomplete lines across chunks', () => {
      // First chunk: partial line
      const chunk1 = 'data: {"partial":';
      const results1 = processor.processChunk(chunk1);
      expect(results1).toHaveLength(0);

      // Second chunk: complete the line
      const chunk2 = ' "complete"}\n\n';
      const results2 = processor.processChunk(chunk2);
      expect(results2).toHaveLength(1);
      expect((results2[0] as any).partial).toBe('complete');
    });

    it('should handle mixed SSE and NDJSON', () => {
      const chunk = 'data: {"sse": true}\n\n{"ndjson": true}\n';

      const results = processor.processChunk(chunk);

      expect(results).toHaveLength(2);
      expect((results[0] as any).sse).toBe(true);
      expect((results[1] as any).ndjson).toBe(true);
    });

    it('should skip empty lines', () => {
      const chunk = '\n\n{"valid": true}\n\n\n{"also": "valid"}\n\n\n';

      const results = processor.processChunk(chunk);

      expect(results).toHaveLength(2);
      expect((results[0] as any).valid).toBe(true);
      expect((results[1] as any).also).toBe('valid');
    });

    it('should handle malformed SSE data', () => {
      const chunk = 'data: {"valid": true}\n\ndata: invalid json\n\ndata: {"also": "valid"}\n\n';

      const results = processor.processChunk(chunk);

      expect(results).toHaveLength(2);
      expect((results[0] as any).valid).toBe(true);
      expect((results[1] as any).also).toBe('valid');
    });

    it('should handle malformed NDJSON data', () => {
      const chunk = '{"valid": true}\ninvalid json line\n{"also": "valid"}\n';

      const results = processor.processChunk(chunk);

      expect(results).toHaveLength(2);
      expect((results[0] as any).valid).toBe(true);
      expect((results[1] as any).also).toBe('valid');
    });
  });

  describe('Object End Detection', () => {
    it('should find object end correctly for simple object', () => {
      processor['state'].buffer = '{"text": "hello"}';

      const endIndex = processor['findObjectEnd']();

      expect(endIndex).toBe(16); // Position of closing brace
    });

    it('should find object end correctly for nested objects', () => {
      processor['state'].buffer = '{"outer": {"inner": "value"}}';

      const endIndex = processor['findObjectEnd']();

      expect(endIndex).toBe(28); // Position of final closing brace
    });

    it('should handle strings with braces', () => {
      processor['state'].buffer = '{"text": "has {braces} inside"}';

      const endIndex = processor['findObjectEnd']();

      expect(endIndex).toBe(30); // Should not be confused by braces in strings
    });

    it('should handle escaped quotes in strings', () => {
      processor['state'].buffer = '{"text": "has \\"escaped\\" quotes"}';

      const endIndex = processor['findObjectEnd']();

      expect(endIndex).toBe(33);
    });

    it('should handle escaped backslashes', () => {
      processor['state'].buffer = '{"text": "has \\\\ backslashes"}';

      const endIndex = processor['findObjectEnd']();

      expect(endIndex).toBe(29);
    });

    it('should return -1 for incomplete object', () => {
      processor['state'].buffer = '{"incomplete": "object"';

      const endIndex = processor['findObjectEnd']();

      expect(endIndex).toBe(-1);
    });

    it('should handle deeply nested objects', () => {
      processor['state'].buffer = '{"a": {"b": {"c": {"d": "deep"}}}}';

      const endIndex = processor['findObjectEnd']();

      expect(endIndex).toBe(33);
    });

    it('should handle empty object', () => {
      processor['state'].buffer = '{}';

      const endIndex = processor['findObjectEnd']();

      expect(endIndex).toBe(1);
    });
  });

  describe('State Management', () => {
    it('should maintain buffer across chunks', () => {
      // Process incomplete chunk
      const chunk1 = '[{"partial":';
      processor.processChunk(chunk1);
      expect(processor['state'].buffer).toContain('{"partial":');

      // Complete with second chunk
      const chunk2 = ' "complete"}]';
      const results = processor.processChunk(chunk2);
      expect(results).toHaveLength(1);
      expect((results[0] as any).partial).toBe('complete');
      expect(processor['state'].buffer).toBe('');
    });

    it('should handle format switch detection', () => {
      // Start with SSE format
      const chunk1 = 'data: {"format": "sse"}\n\n';
      const results1 = processor.processChunk(chunk1);
      expect(results1).toHaveLength(1);
      expect(processor['state'].arrayStarted).toBe(false);

      // Cannot switch to array format once SSE started
      const chunk2 = '[{"format": "array"}]';
      const results2 = processor.processChunk(chunk2);
      // This would be processed as NDJSON/SSE, not as array
      expect(results2).toHaveLength(1);
    });

    it('should maintain array state across chunks', () => {
      const chunk1 = '[{"id": 1},';
      processor.processChunk(chunk1);
      expect(processor['state'].arrayStarted).toBe(true);

      const chunk2 = ' {"id": 2}]';
      const results = processor.processChunk(chunk2);
      expect(results).toHaveLength(2);
    });

    it('should handle buffer cleanup after array end', () => {
      const chunk = '[{"data": "test"}]';
      processor.processChunk(chunk);
      expect(processor['state'].buffer).toBe('');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty chunks', () => {
      const results = processor.processChunk('');
      expect(results).toHaveLength(0);
    });

    it('should handle whitespace-only chunks', () => {
      const results = processor.processChunk('   \n\n\t  ');
      expect(results).toHaveLength(0);
    });

    it('should handle chunks with only separators', () => {
      processor['state'].arrayStarted = true;
      const results = processor.processChunk(',,,,');
      expect(results).toHaveLength(0);
    });

    it('should handle unexpected characters in array format', () => {
      processor['state'].arrayStarted = true;
      processor['state'].buffer = 'unexpected content {';

      const results = processor.processChunk('not json}');

      // Should skip unexpected characters and try to parse objects
      expect(results).toHaveLength(0);
    });

    it('should handle very large JSON objects', () => {
      const largeData = 'x'.repeat(10000);
      const chunk = `[{"large": "${largeData}"}]`;

      const results = processor.processChunk(chunk);

      expect(results).toHaveLength(1);
      expect((results[0] as any).large).toBe(largeData);
    });

    it('should handle Unicode characters', () => {
      const chunk = '[{"unicode": "🌟 Hello 世界 🚀"}]';

      const results = processor.processChunk(chunk);

      expect(results).toHaveLength(1);
      expect((results[0] as any).unicode).toBe('🌟 Hello 世界 🚀');
    });

    it('should handle null values and missing properties', () => {
      const chunk = '[{"null": null, "defined": "value"}]';

      const results = processor.processChunk(chunk);

      expect(results).toHaveLength(1);
      expect((results[0] as any).null).toBeNull();
      expect((results[0] as any).defined).toBe('value');
      expect((results[0] as any).undef).toBeUndefined(); // Property doesn't exist
    });

    it('should handle boolean and numeric values', () => {
      const chunk = '[{"bool": true, "num": 42.5, "zero": 0, "negative": -123}]';

      const results = processor.processChunk(chunk);

      expect(results).toHaveLength(1);
      expect((results[0] as any).bool).toBe(true);
      expect((results[0] as any).num).toBe(42.5);
      expect((results[0] as any).zero).toBe(0);
      expect((results[0] as any).negative).toBe(-123);
    });

    it('should handle arrays with mixed types', () => {
      const chunk = '[{"mixed": [1, "string", true, null, {"nested": "object"}]}]';

      const results = processor.processChunk(chunk);

      expect(results).toHaveLength(1);
      expect((results[0] as any).mixed).toEqual([1, 'string', true, null, { nested: 'object' }]);
    });
  });

  describe('Performance and Memory', () => {
    it('should handle many small chunks efficiently', () => {
      const chunks = Array(100)
        .fill(0)
        .map((_, i) => `{"chunk": ${i}}\n`);
      let totalResults = 0;

      chunks.forEach(chunk => {
        const results = processor.processChunk(chunk);
        totalResults += results.length;
      });

      expect(totalResults).toBe(100);
    });

    it('should clean buffer after processing complete objects', () => {
      processor.processChunk('[{"test": "data"}]');
      expect(processor['state'].buffer).toBe('');
    });

    it('should handle streaming with frequent small updates', () => {
      const data = '{"streaming": "data with many words"}';
      const chunks = data.split('').map(char => `data: ${char}`);

      let results: unknown[] = [];
      chunks.forEach(chunk => {
        results = results.concat(processor.processChunk(chunk + '\n\n'));
      });

      // Should eventually form complete objects
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Complex Streaming Scenarios', () => {
    it('should handle interleaved array and non-array data', () => {
      // Start with array format
      const chunk1 = '[{"start": true}';
      const results1 = processor.processChunk(chunk1);
      expect(processor['state'].arrayStarted).toBe(true);

      // Continue array
      const chunk2 = ', {"middle": true}]';
      const results2 = processor.processChunk(chunk2);
      expect(results1.concat(results2)).toHaveLength(2);
    });

    it('should handle multiple complete arrays', () => {
      const chunk1 = '[{"first": "array"}]';
      const results1 = processor.processChunk(chunk1);

      // After first array is complete, buffer should be clean
      expect(processor['state'].buffer).toBe('');

      // Should not process more content after array end
      const chunk2 = '[{"second": "array"}]';
      const results2 = processor.processChunk(chunk2);

      expect(results1).toHaveLength(1);
      expect(results2).toHaveLength(0); // Array already ended
    });

    it('should handle real-world Gemini streaming response', () => {
      const realWorldChunk = `[
        {
          "candidates": [
            {
              "content": {
                "parts": [
                  {
                    "text": "I can help you with that. "
                  }
                ],
                "role": "model"
              },
              "finishReason": "STOP",
              "index": 0
            }
          ],
          "usageMetadata": {
            "promptTokenCount": 10,
            "candidatesTokenCount": 8,
            "totalTokenCount": 18
          }
        }
      ]`;

      const results = processor.processChunk(realWorldChunk);

      expect(results).toHaveLength(1);
      const response = results[0] as any;
      expect(response.candidates).toHaveLength(1);
      expect(response.candidates[0].content.parts[0].text).toBe('I can help you with that. ');
      expect(response.usageMetadata.totalTokenCount).toBe(18);
    });

    it('should handle Gemini thinking response format', () => {
      const thinkingChunk = `[
        {
          "candidates": [
            {
              "content": {
                "parts": [
                  {
                    "text": "Let me think about this problem..."
                  },
                  {
                    "thinking": "I need to consider multiple approaches here.",
                    "thought": true
                  }
                ],
                "role": "model"
              }
            }
          ]
        }
      ]`;

      const results = processor.processChunk(thinkingChunk);

      expect(results).toHaveLength(1);
      const response = results[0] as any;
      expect(response.candidates[0].content.parts).toHaveLength(2);
      expect(response.candidates[0].content.parts[1].thinking).toBe(
        'I need to consider multiple approaches here.'
      );
      expect(response.candidates[0].content.parts[1].thought).toBe(true);
    });

    it('should handle search metadata in streaming response', () => {
      const searchChunk = `[
        {
          "candidates": [
            {
              "content": {
                "parts": [{"text": "Based on my search..."}],
                "role": "model"
              },
              "groundingMetadata": {
                "webSearchQueries": ["test query"],
                "groundingChunks": [
                  {"web": {"uri": "https://example.com", "title": "Example"}}
                ]
              }
            }
          ]
        }
      ]`;

      const results = processor.processChunk(searchChunk);

      expect(results).toHaveLength(1);
      const response = results[0] as any;
      expect(response.candidates[0].groundingMetadata.webSearchQueries).toEqual(['test query']);
      expect(response.candidates[0].groundingMetadata.groundingChunks[0].web.uri).toBe(
        'https://example.com'
      );
    });
  });

  describe('Reset and State Recovery', () => {
    it('should allow reuse after reset', () => {
      // Process some data
      processor.processChunk('[{"first": "session"}]');
      // After processing complete array
      expect(processor['state'].arrayStarted).toBe(false);
      expect(processor['state'].arrayEnded).toBe(true);

      // Reset
      processor.reset();

      // Should be able to process new format
      const results = processor.processChunk('data: {"second": "session"}\n\n');
      expect(results).toHaveLength(1);
      expect((results[0] as any).second).toBe('session');
      expect(processor['state'].arrayStarted).toBe(false);
    });

    it('should clean up partially processed data on reset', () => {
      // Start processing incomplete data
      processor.processChunk('[{"incomplete":');
      expect(processor['state'].buffer).toContain('incomplete');

      // Reset should clear everything
      processor.reset();
      expect(processor['state'].buffer).toBe('');
      expect(processor['state'].arrayStarted).toBe(false);
    });
  });
});
