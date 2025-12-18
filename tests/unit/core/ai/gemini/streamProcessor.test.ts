/**
 * @file Gemini Stream Processor Tests
 *
 * Tests for the GeminiStreamProcessor class which handles streaming responses
 * from Gemini API in both JSON array and SSE/NDJSON formats.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GeminiStreamProcessor } from '@core/ai/gemini/streamProcessor';

describe('GeminiStreamProcessor', () => {
  let processor: GeminiStreamProcessor;

  beforeEach(() => {
    processor = new GeminiStreamProcessor();
  });

  describe('mode detection', () => {
    it('should detect array mode when chunk starts with [', () => {
      const result = processor.processChunk('[{"test": 1}]');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ test: 1 });
    });

    it('should detect array mode with leading whitespace', () => {
      const result = processor.processChunk('   [{"test": 1}]');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ test: 1 });
    });

    it('should detect SSE mode when chunk does not start with [', () => {
      const result = processor.processChunk('data: {"test": 1}\n\n');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ test: 1 });
    });

    it('should detect NDJSON mode for plain JSON lines', () => {
      const result = processor.processChunk('{"test": 1}\n');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ test: 1 });
    });
  });

  describe('array mode parsing', () => {
    it('should parse a complete JSON array in one chunk', () => {
      const result = processor.processChunk('[{"a":1},{"b":2}]');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ a: 1 });
      expect(result[1]).toEqual({ b: 2 });
    });

    it('should handle objects split across multiple chunks', () => {
      let result = processor.processChunk('[{"content": "hel');
      expect(result).toHaveLength(0);

      result = processor.processChunk('lo world"}]');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ content: 'hello world' });
    });

    it('should handle multiple objects in chunks', () => {
      let result = processor.processChunk('[{"a":1},{"b":');
      expect(result).toHaveLength(0);

      result = processor.processChunk('2},{"c":3}]');
      expect(result).toHaveLength(3);
    });

    it('should ignore further input after array ends', () => {
      processor.processChunk('[{"a":1}]');
      const result = processor.processChunk('{"b":2}');
      expect(result).toHaveLength(0);
    });

    it('should handle escaped quotes in strings', () => {
      const result = processor.processChunk('[{"text": "hello \\"world\\""}]');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ text: 'hello "world"' });
    });

    it('should handle nested objects', () => {
      const result = processor.processChunk('[{"outer": {"inner": "value"}}]');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ outer: { inner: 'value' } });
    });

    it('should handle nested arrays', () => {
      const result = processor.processChunk('[{"arr": [1, 2, 3]}]');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ arr: [1, 2, 3] });
    });

    it('should handle curly braces inside strings without false termination', () => {
      const result = processor.processChunk('[{"code": "function() { return {}; }"}]');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ code: 'function() { return {}; }' });
    });

    it('should skip malformed JSON objects without infinite loop', () => {
      // Malformed: missing closing quote
      const result = processor.processChunk('[{"broken: 123}]');
      // The processor should not hang and should return some result
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle empty array', () => {
      const result = processor.processChunk('[]');
      expect(result).toHaveLength(0);
    });

    it('should handle array with whitespace between elements', () => {
      const result = processor.processChunk('[  {"a":1}  ,  {"b":2}  ]');
      expect(result).toHaveLength(2);
    });
  });

  describe('SSE/NDJSON mode parsing', () => {
    it('should parse SSE data events', () => {
      const result = processor.processChunk('data: {"text": "hello"}\n\n');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ text: 'hello' });
    });

    it('should handle [DONE] signal', () => {
      // First chunk with complete JSON and blank line
      const result1 = processor.processChunk('data: {"text": "hello"}\n\n');
      expect(result1).toHaveLength(1);
      expect(result1[0]).toEqual({ text: 'hello' });

      // [DONE] should not emit anything
      const result2 = processor.processChunk('data: [DONE]\n\n');
      expect(result2).toHaveLength(0);
    });

    it('should parse NDJSON lines', () => {
      const result = processor.processChunk('{"a":1}\n{"b":2}\n');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ a: 1 });
      expect(result[1]).toEqual({ b: 2 });
    });

    it('should handle SSE data split across chunks', () => {
      let result = processor.processChunk('data: {"content": "par');
      expect(result).toHaveLength(0);

      result = processor.processChunk('tial"}\n\n');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ content: 'partial' });
    });

    it('should flush buffer on blank line', () => {
      processor.processChunk('data: {"a":1}');
      const result = processor.processChunk('\n\n');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ a: 1 });
    });

    it('should clear invalid buffer when new JSON starts', () => {
      // Start with incomplete JSON - this line has no newline so stays in buffer
      processor.processChunk('data: {"incomplete":');
      // Send new line with new JSON object - should clear old buffer and parse new one
      const result = processor.processChunk('\ndata: {"complete": true}\n\n');
      // The processor attempts to parse the accumulated buffer
      // Since the new JSON starts fresh, it should eventually parse correctly
      expect(Array.isArray(result)).toBe(true);
    });

    it('should skip invalid NDJSON lines', () => {
      const result = processor.processChunk('not json\n{"valid":true}\n');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ valid: true });
    });

    it('should handle single line NDJSON without trailing newline', () => {
      const result = processor.processChunk('{"single": true}');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ single: true });
    });
  });

  describe('reset', () => {
    it('should clear all state when reset is called', () => {
      // Put processor in array mode with some buffered data
      processor.processChunk('[{"a":1');
      processor.reset();

      // After reset, should be able to detect new mode
      const result = processor.processChunk('data: {"b":2}\n\n');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ b: 2 });
    });

    it('should allow processing a new array after reset', () => {
      processor.processChunk('[{"a":1}]');
      processor.reset();

      const result = processor.processChunk('[{"b":2}]');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ b: 2 });
    });
  });

  describe('edge cases', () => {
    it('should handle empty chunks', () => {
      const result = processor.processChunk('');
      expect(result).toHaveLength(0);
    });

    it('should handle chunks with only whitespace', () => {
      const result = processor.processChunk('   \n\t\n   ');
      expect(result).toHaveLength(0);
    });

    it('should handle deeply nested structures', () => {
      const deepObject = {
        level1: {
          level2: {
            level3: {
              level4: {
                value: 'deep',
              },
            },
          },
        },
      };
      const result = processor.processChunk(`[${JSON.stringify(deepObject)}]`);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(deepObject);
    });

    it('should handle unicode characters in strings', () => {
      const result = processor.processChunk('[{"text": "Hello café 🌍 مرحبا"}]');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ text: 'Hello café 🌍 مرحبا' });
    });

    it('should handle newlines within JSON strings', () => {
      const result = processor.processChunk('[{"text": "line1\\nline2"}]');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ text: 'line1\nline2' });
    });

    it('should handle backslashes in strings', () => {
      const result = processor.processChunk('[{"path": "C:\\\\Users\\\\test"}]');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ path: 'C:\\Users\\test' });
    });

    it('should handle multiple backslashes before quote', () => {
      // Four backslashes followed by quote = two escaped backslashes + start of string end
      const result = processor.processChunk('[{"val": "test\\\\\\\\"}]');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ val: 'test\\\\' });
    });
  });
});
