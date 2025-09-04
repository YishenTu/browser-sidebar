/**
 * @file Text Utilities Unit Tests
 *
 * Comprehensive unit tests for the Text utilities module that provides
 * text processing functions including clamping and truncation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { clampText, type ClampResult } from '@core/extraction/text';

// ============================================================================
// Test Fixtures
// ============================================================================

const textSamples = {
  short: 'Hello',
  medium: 'This is a medium length text sample.',
  long: 'This is a very long text sample that contains many words and should be truncated when the maximum character limit is exceeded during the clamping process.',
  empty: '',
  whitespace: '   \n\t   ',
  singleChar: 'A',
  exactLimit: 'A'.repeat(50), // Will be used with maxChars: 50
  overLimit: 'A'.repeat(51), // Will be used with maxChars: 50
  unicode: 'Hello 世界 🌍 émojis and spëcial châractërs',
  withNewlines: 'Line 1\nLine 2\nLine 3',
  withTabs: 'Column 1\tColumn 2\tColumn 3',
  mixedWhitespace: 'Text with\n\tvarious   whitespace\r\ncharacters',
};

// ============================================================================
// Test Suite
// ============================================================================

describe('Text Utilities', () => {
  beforeEach(() => {
    // No setup needed for pure functions
  });

  // ============================================================================
  // ClampText Basic Functionality Tests
  // ============================================================================

  describe('clampText - basic functionality', () => {
    it('should return text unchanged when under limit', () => {
      const result = clampText(textSamples.short, 10);

      expect(result).toEqual<ClampResult>({
        text: textSamples.short,
        isTruncated: false,
      });
    });

    it('should truncate text when over limit', () => {
      const maxChars = 20;
      const result = clampText(textSamples.long, maxChars);

      expect(result).toEqual<ClampResult>({
        text: textSamples.long.substring(0, maxChars),
        isTruncated: true,
      });
      expect(result.text).toHaveLength(maxChars);
    });

    it('should handle text exactly at limit', () => {
      const maxChars = 50;
      const result = clampText(textSamples.exactLimit, maxChars);

      expect(result).toEqual<ClampResult>({
        text: textSamples.exactLimit,
        isTruncated: false,
      });
      expect(result.text).toHaveLength(maxChars);
    });

    it('should handle text one character over limit', () => {
      const maxChars = 50;
      const result = clampText(textSamples.overLimit, maxChars);

      expect(result).toEqual<ClampResult>({
        text: textSamples.overLimit.substring(0, maxChars),
        isTruncated: true,
      });
      expect(result.text).toHaveLength(maxChars);
    });

    it('should handle single character text', () => {
      const result = clampText(textSamples.singleChar, 5);

      expect(result).toEqual<ClampResult>({
        text: textSamples.singleChar,
        isTruncated: false,
      });
    });

    it('should handle medium length text', () => {
      const result = clampText(textSamples.medium, 100);

      expect(result).toEqual<ClampResult>({
        text: textSamples.medium,
        isTruncated: false,
      });
    });
  });

  // ============================================================================
  // ClampText Edge Cases Tests
  // ============================================================================

  describe('clampText - edge cases', () => {
    it('should handle null input', () => {
      const result = clampText(null, 10);

      expect(result).toEqual<ClampResult>({
        text: '',
        isTruncated: false,
      });
    });

    it('should handle undefined input', () => {
      const result = clampText(undefined, 10);

      expect(result).toEqual<ClampResult>({
        text: '',
        isTruncated: false,
      });
    });

    it('should handle empty string input', () => {
      const result = clampText(textSamples.empty, 10);

      expect(result).toEqual<ClampResult>({
        text: '',
        isTruncated: false,
      });
    });

    it('should handle whitespace-only input', () => {
      const result = clampText(textSamples.whitespace, 20);

      expect(result).toEqual<ClampResult>({
        text: textSamples.whitespace,
        isTruncated: false,
      });
    });

    it('should handle zero maxChars', () => {
      const result = clampText(textSamples.short, 0);

      expect(result).toEqual<ClampResult>({
        text: '',
        isTruncated: true,
      });
    });

    it('should handle very large maxChars', () => {
      const maxChars = 1000000;
      const result = clampText(textSamples.long, maxChars);

      expect(result).toEqual<ClampResult>({
        text: textSamples.long,
        isTruncated: false,
      });
    });

    it('should throw error for negative maxChars', () => {
      expect(() => clampText(textSamples.short, -1)).toThrow('maxChars must be non-negative');
      expect(() => clampText(textSamples.short, -10)).toThrow('maxChars must be non-negative');
    });
  });

  // ============================================================================
  // ClampText Unicode and Special Characters Tests
  // ============================================================================

  describe('clampText - unicode and special characters', () => {
    it('should handle unicode characters correctly', () => {
      const maxChars = 10;
      const result = clampText(textSamples.unicode, maxChars);

      expect(result).toEqual<ClampResult>({
        text: textSamples.unicode.substring(0, maxChars),
        isTruncated: true,
      });
      expect(result.text).toHaveLength(maxChars);
    });

    it('should handle emojis correctly', () => {
      const emojiText = '🌍🚀💖';
      const result = clampText(emojiText, 2);

      // Emojis may be counted differently than expected
      expect(result.text.length).toBe(2);
      expect(result.isTruncated).toBe(true);
    });

    it('should handle text with newlines', () => {
      const result = clampText(textSamples.withNewlines, 100);

      expect(result).toEqual<ClampResult>({
        text: textSamples.withNewlines,
        isTruncated: false,
      });
    });

    it('should handle text with tabs', () => {
      const result = clampText(textSamples.withTabs, 100);

      expect(result).toEqual<ClampResult>({
        text: textSamples.withTabs,
        isTruncated: false,
      });
    });

    it('should handle mixed whitespace characters', () => {
      const result = clampText(textSamples.mixedWhitespace, 100);

      expect(result).toEqual<ClampResult>({
        text: textSamples.mixedWhitespace,
        isTruncated: false,
      });
    });

    it('should truncate mixed whitespace correctly', () => {
      const maxChars = 10;
      const result = clampText(textSamples.mixedWhitespace, maxChars);

      expect(result).toEqual<ClampResult>({
        text: textSamples.mixedWhitespace.substring(0, maxChars),
        isTruncated: true,
      });
      expect(result.text).toHaveLength(maxChars);
    });
  });

  // ============================================================================
  // ClampText Boundary Tests
  // ============================================================================

  describe('clampText - boundary conditions', () => {
    it('should handle maxChars of 1', () => {
      const result = clampText(textSamples.medium, 1);

      expect(result).toEqual<ClampResult>({
        text: textSamples.medium.substring(0, 1),
        isTruncated: true,
      });
      expect(result.text).toHaveLength(1);
    });

    it('should handle very long text with small limit', () => {
      const veryLongText = 'A'.repeat(10000);
      const maxChars = 5;
      const result = clampText(veryLongText, maxChars);

      expect(result).toEqual<ClampResult>({
        text: 'AAAAA',
        isTruncated: true,
      });
      expect(result.text).toHaveLength(maxChars);
    });

    it('should handle empty string with zero limit', () => {
      const result = clampText('', 0);

      expect(result).toEqual<ClampResult>({
        text: '',
        isTruncated: false,
      });
    });

    it('should handle non-empty string with zero limit', () => {
      const result = clampText('Hello', 0);

      expect(result).toEqual<ClampResult>({
        text: '',
        isTruncated: true,
      });
    });

    it('should handle string equal to limit length', () => {
      const text = 'Hello';
      const maxChars = text.length;
      const result = clampText(text, maxChars);

      expect(result).toEqual<ClampResult>({
        text,
        isTruncated: false,
      });
    });
  });

  // ============================================================================
  // ClampText Performance Tests
  // ============================================================================

  describe('clampText - performance', () => {
    it('should handle large text efficiently', () => {
      const largeText = 'A'.repeat(100000);
      const start = performance.now();

      const result = clampText(largeText, 1000);

      const end = performance.now();

      expect(result).toEqual<ClampResult>({
        text: 'A'.repeat(1000),
        isTruncated: true,
      });
      expect(end - start).toBeLessThan(50); // Should be very fast
    });

    it('should handle many small operations efficiently', () => {
      const start = performance.now();

      for (let i = 0; i < 1000; i++) {
        clampText(`Text ${i}`, 10);
      }

      const end = performance.now();

      expect(end - start).toBeLessThan(100); // Should handle many operations quickly
    });
  });

  // ============================================================================
  // ClampText Type Safety Tests
  // ============================================================================

  describe('clampText - type safety', () => {
    it('should return correct ClampResult interface', () => {
      const result = clampText('test', 10);

      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('isTruncated');
      expect(typeof result.text).toBe('string');
      expect(typeof result.isTruncated).toBe('boolean');
    });

    it('should maintain ClampResult structure for all inputs', () => {
      const testCases = [
        { input: null, maxChars: 10 },
        { input: undefined, maxChars: 5 },
        { input: '', maxChars: 0 },
        { input: 'test', maxChars: 2 },
        { input: 'longer text', maxChars: 20 },
      ];

      testCases.forEach(({ input, maxChars }) => {
        const result = clampText(input as any, maxChars);

        expect(result).toHaveProperty('text');
        expect(result).toHaveProperty('isTruncated');
        expect(typeof result.text).toBe('string');
        expect(typeof result.isTruncated).toBe('boolean');
      });
    });
  });

  // ============================================================================
  // ClampText Comprehensive Scenarios
  // ============================================================================

  describe('clampText - comprehensive scenarios', () => {
    it('should handle typical markdown content', () => {
      const markdownText = '# Title\n\nThis is **bold** and *italic* text with `code`.';
      const result = clampText(markdownText, 30);

      expect(result.text).toHaveLength(30);
      expect(result.isTruncated).toBe(true);
      expect(result.text).toBe(markdownText.substring(0, 30));
    });

    it('should handle HTML content', () => {
      const htmlText = '<p>This is <strong>HTML</strong> content with <em>tags</em>.</p>';
      const result = clampText(htmlText, 25);

      expect(result.text).toHaveLength(25);
      expect(result.isTruncated).toBe(true);
      expect(result.text).toBe(htmlText.substring(0, 25));
    });

    it('should handle code content', () => {
      const codeText = 'function test() {\n  return "Hello World";\n}';
      const result = clampText(codeText, 20);

      expect(result.text).toHaveLength(20);
      expect(result.isTruncated).toBe(true);
      expect(result.text).toBe(codeText.substring(0, 20));
    });

    it('should handle URL content', () => {
      const urlText =
        'https://www.example.com/very/long/path/to/resource?param1=value1&param2=value2';
      const result = clampText(urlText, 40);

      expect(result).toEqual<ClampResult>({
        text: 'https://www.example.com/very/long/path/t',
        isTruncated: true,
      });
      expect(result.text).toHaveLength(40);
    });

    it('should handle JSON content', () => {
      const jsonText = '{"name": "John", "age": 30, "city": "New York", "active": true}';
      const result = clampText(jsonText, 35);

      expect(result.text).toHaveLength(35);
      expect(result.isTruncated).toBe(true);
      expect(result.text).toBe(jsonText.substring(0, 35));
    });
  });

  // ============================================================================
  // ClampText Error Handling
  // ============================================================================

  describe('clampText - error handling', () => {
    it('should handle floating point maxChars by truncating', () => {
      const result = clampText('Hello World', 5.7);

      expect(result).toEqual<ClampResult>({
        text: 'Hello',
        isTruncated: true,
      });
      expect(result.text).toHaveLength(5);
    });

    it('should handle very large maxChars values', () => {
      const result = clampText('Short text', Number.MAX_SAFE_INTEGER);

      expect(result).toEqual<ClampResult>({
        text: 'Short text',
        isTruncated: false,
      });
    });

    it('should handle NaN maxChars', () => {
      // NaN is treated as 0 in substring, so no error is thrown
      const result = clampText('test', NaN);
      expect(result.text).toBe('');
      expect(result.isTruncated).toBe(true);
    });

    it('should handle Infinity maxChars', () => {
      const result = clampText('Test content', Infinity);

      expect(result).toEqual<ClampResult>({
        text: 'Test content',
        isTruncated: false,
      });
    });

    it('should handle negative Infinity maxChars', () => {
      expect(() => clampText('test', -Infinity)).toThrow('maxChars must be non-negative');
    });
  });

  // ============================================================================
  // ClampText Complex Edge Cases
  // ============================================================================

  describe('clampText - complex edge cases', () => {
    it('should handle string with only control characters', () => {
      const controlText = '\x00\x01\x02\x03\x04';
      const result = clampText(controlText, 3);

      expect(result).toEqual<ClampResult>({
        text: '\x00\x01\x02',
        isTruncated: true,
      });
      expect(result.text).toHaveLength(3);
    });

    it('should handle string with mixed ASCII and non-ASCII', () => {
      const mixedText = 'Hello世界Test';
      const result = clampText(mixedText, 8);

      expect(result).toEqual<ClampResult>({
        text: 'Hello世界T',
        isTruncated: true,
      });
      expect(result.text).toHaveLength(8);
    });

    it('should handle extremely long unicode characters', () => {
      const longUnicode = '👨‍👩‍👧‍👦'.repeat(10); // Family emoji (compound)
      const result = clampText(longUnicode, 5);

      expect(result.isTruncated).toBe(true);
      expect(result.text.length).toBeLessThanOrEqual(5);
    });

    it('should handle surrogate pairs', () => {
      const surrogateText = '𝕳𝖊𝖑𝖑𝖔'; // Mathematical script letters
      const result = clampText(surrogateText, 3);

      // Surrogate pairs might be split, just check length and truncation
      expect(result.text.length).toBeLessThanOrEqual(3);
      expect(result.isTruncated).toBe(true);
    });
  });
});
