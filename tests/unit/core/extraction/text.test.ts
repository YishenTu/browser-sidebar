/**
 * @file Text Extraction Tests
 *
 * Tests for text clamping and processing utilities.
 */

import { describe, it, expect } from 'vitest';
import { clampText, type ClampResult } from '@core/extraction/text';

describe('clampText', () => {
  describe('basic clamping', () => {
    it('should return unchanged text when under limit', () => {
      const result = clampText('Hello', 10);

      expect(result.text).toBe('Hello');
      expect(result.isTruncated).toBe(false);
    });

    it('should truncate text when over limit', () => {
      const result = clampText('Hello, World!', 5);

      expect(result.text).toBe('Hello');
      expect(result.isTruncated).toBe(true);
    });

    it('should return exact text when equal to limit', () => {
      const result = clampText('12345', 5);

      expect(result.text).toBe('12345');
      expect(result.isTruncated).toBe(false);
    });
  });

  describe('null/undefined/empty handling', () => {
    it('should handle null input', () => {
      const result = clampText(null, 10);

      expect(result.text).toBe('');
      expect(result.isTruncated).toBe(false);
    });

    it('should handle undefined input', () => {
      const result = clampText(undefined, 10);

      expect(result.text).toBe('');
      expect(result.isTruncated).toBe(false);
    });

    it('should handle empty string', () => {
      const result = clampText('', 10);

      expect(result.text).toBe('');
      expect(result.isTruncated).toBe(false);
    });
  });

  describe('maxChars parameter validation', () => {
    it('should throw error for negative maxChars', () => {
      expect(() => clampText('test', -1)).toThrow('maxChars must be non-negative');
    });

    it('should handle maxChars of 0', () => {
      const result = clampText('test', 0);

      expect(result.text).toBe('');
      expect(result.isTruncated).toBe(true);
    });

    it('should handle maxChars of 0 with empty string', () => {
      const result = clampText('', 0);

      expect(result.text).toBe('');
      expect(result.isTruncated).toBe(false);
    });

    it('should handle very large maxChars', () => {
      const text = 'Short text';
      const result = clampText(text, Number.MAX_SAFE_INTEGER);

      expect(result.text).toBe(text);
      expect(result.isTruncated).toBe(false);
    });
  });

  describe('unicode handling', () => {
    it('should handle unicode characters', () => {
      const result = clampText('áéíóú', 3);

      expect(result.text).toBe('áéí');
      expect(result.isTruncated).toBe(true);
    });

    it('should handle emoji', () => {
      const text = '😀😁😂🤣';
      const result = clampText(text, 2);

      expect(result.text.length).toBe(2);
      expect(result.isTruncated).toBe(true);
    });

    it('should handle mixed unicode and ASCII', () => {
      const result = clampText('Helloéø', 7);

      expect(result.text).toBe('Helloéø');
      expect(result.isTruncated).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle maxChars of 1', () => {
      const result = clampText('Hello', 1);

      expect(result.text).toBe('H');
      expect(result.isTruncated).toBe(true);
    });

    it('should handle whitespace-only string', () => {
      const result = clampText('   ', 2);

      expect(result.text).toBe('  ');
      expect(result.isTruncated).toBe(true);
    });

    it('should handle newlines in text', () => {
      const text = 'Line1\nLine2\nLine3';
      const result = clampText(text, 6);

      expect(result.text).toBe('Line1\n');
      expect(result.isTruncated).toBe(true);
    });

    it('should handle tabs in text', () => {
      const text = 'Col1\tCol2\tCol3';
      const result = clampText(text, 5);

      expect(result.text).toBe('Col1\t');
      expect(result.isTruncated).toBe(true);
    });
  });

  describe('return type structure', () => {
    it('should return object with text and isTruncated properties', () => {
      const result = clampText('test', 10);

      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('isTruncated');
      expect(typeof result.text).toBe('string');
      expect(typeof result.isTruncated).toBe('boolean');
    });

    it('should satisfy ClampResult interface', () => {
      const result: ClampResult = clampText('test', 10);

      expect(result.text).toBeDefined();
      expect(result.isTruncated).toBeDefined();
    });
  });
});
