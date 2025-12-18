/**
 * @file Content Analyzer Tests
 *
 * Tests for content analysis utilities including code/table detection and excerpt generation.
 */

import { describe, it, expect } from 'vitest';
import {
  detectCodeBlocks,
  detectTables,
  generateExcerpt,
} from '@core/extraction/analyzers/contentAnalyzer';

describe('detectCodeBlocks', () => {
  describe('code block detection', () => {
    it('should detect triple backtick code blocks', () => {
      const markdown = 'Some text\n```javascript\nconst x = 1;\n```\nMore text';

      expect(detectCodeBlocks(markdown)).toBe(true);
    });

    it('should detect code blocks without language specifier', () => {
      const markdown = 'Text\n```\ncode here\n```';

      expect(detectCodeBlocks(markdown)).toBe(true);
    });

    it('should detect multi-line code blocks', () => {
      const markdown = '```\nline1\nline2\nline3\n```';

      expect(detectCodeBlocks(markdown)).toBe(true);
    });

    it('should return false when no code blocks present', () => {
      const markdown = 'Just regular text\nWith multiple lines\nBut no code';

      expect(detectCodeBlocks(markdown)).toBe(false);
    });

    it('should return false for inline backticks', () => {
      const markdown = 'Use `inline code` in text';

      expect(detectCodeBlocks(markdown)).toBe(false);
    });

    it('should handle empty string', () => {
      expect(detectCodeBlocks('')).toBe(false);
    });

    it('should detect nested content inside code blocks', () => {
      const markdown = '```\nsome nested ``` content\n```';

      expect(detectCodeBlocks(markdown)).toBe(true);
    });
  });
});

describe('detectTables', () => {
  describe('table detection', () => {
    it('should detect markdown tables', () => {
      const markdown = '| Header 1 | Header 2 |\n|----------|----------|\n| Cell 1   | Cell 2   |';

      expect(detectTables(markdown)).toBe(true);
    });

    it('should detect table with leading/trailing pipes', () => {
      const markdown = '| Col1 | Col2 | Col3 |';

      expect(detectTables(markdown)).toBe(true);
    });

    it('should require at least 2 pipes for table detection', () => {
      const markdown = '| Just one pipe is not a table';

      expect(detectTables(markdown)).toBe(false);
    });

    it('should return false when no tables present', () => {
      const markdown = 'Regular text\nWithout any tables\nJust paragraphs';

      expect(detectTables(markdown)).toBe(false);
    });

    it('should handle empty string', () => {
      expect(detectTables('')).toBe(false);
    });

    it('should detect tables anywhere in content', () => {
      const markdown = 'Intro text\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\nConclusion';

      expect(detectTables(markdown)).toBe(true);
    });

    it('should detect simple two-column table', () => {
      const markdown = '|Name|Value|';

      expect(detectTables(markdown)).toBe(true);
    });
  });
});

describe('generateExcerpt', () => {
  describe('basic excerpt generation', () => {
    it('should return short text unchanged', () => {
      const markdown = 'This is a short text.';

      expect(generateExcerpt(markdown)).toBe('This is a short text.');
    });

    it('should truncate long text to approximately 200 characters', () => {
      const longText = 'A'.repeat(300);
      const result = generateExcerpt(longText);

      expect(result.length).toBeLessThanOrEqual(203); // 200 + '...'
      expect(result).toMatch(/\.\.\.$/);
    });

    it('should break at word boundaries', () => {
      const text = 'word '.repeat(50); // Creates text > 200 chars
      const result = generateExcerpt(text);

      // Should end with '...' after a complete word
      expect(result).toMatch(/word\.\.\.$/);
    });

    it('should handle empty input', () => {
      expect(generateExcerpt('')).toBe('');
    });
  });

  describe('markdown syntax removal', () => {
    it('should replace code blocks with [code]', () => {
      const markdown = 'Text before\n```\ncode content\n```\nText after';
      const result = generateExcerpt(markdown);

      expect(result).toContain('[code]');
      expect(result).not.toContain('```');
      expect(result).not.toContain('code content');
    });

    it('should replace inline code with [code]', () => {
      const markdown = 'Use `someFunction()` for that';
      const result = generateExcerpt(markdown);

      expect(result).toContain('[code]');
      expect(result).not.toContain('`');
      expect(result).not.toContain('someFunction');
    });

    it('should convert links to plain text', () => {
      const markdown = 'Check [this link](https://example.com) for more';
      const result = generateExcerpt(markdown);

      expect(result).toContain('this link');
      expect(result).not.toContain('https://');
      expect(result).not.toContain('[');
      expect(result).not.toContain(']');
      expect(result).not.toContain('(');
    });

    it('should remove formatting characters', () => {
      const markdown = '# Title\n**Bold** and *italic* and ~~strikethrough~~';
      const result = generateExcerpt(markdown);

      expect(result).not.toContain('#');
      expect(result).not.toContain('*');
      expect(result).not.toContain('~');
    });
  });

  describe('whitespace normalization', () => {
    it('should normalize multiple spaces to single space', () => {
      const markdown = 'Text    with   multiple    spaces';
      const result = generateExcerpt(markdown);

      expect(result).not.toMatch(/ {2}/);
      expect(result).toContain('Text with multiple spaces');
    });

    it('should collapse multiple blank lines', () => {
      const markdown = 'Para 1\n\n\n\nPara 2';
      const result = generateExcerpt(markdown);

      expect(result).not.toMatch(/\n\n\n/);
    });

    it('should normalize different line ending styles', () => {
      const markdown = 'Line1\r\nLine2\rLine3\nLine4';
      const result = generateExcerpt(markdown);

      expect(result).not.toContain('\r');
    });

    it('should trim leading and trailing whitespace', () => {
      const markdown = '   Trimmed text   ';
      const result = generateExcerpt(markdown);

      expect(result).toBe('Trimmed text');
    });

    it('should normalize tabs to spaces', () => {
      const markdown = 'Text\twith\ttabs';
      const result = generateExcerpt(markdown);

      expect(result).not.toContain('\t');
    });
  });

  describe('truncation behavior', () => {
    it('should not add ellipsis to text exactly 200 chars', () => {
      const text = 'X'.repeat(200);
      const result = generateExcerpt(text);

      expect(result).toBe(text);
      expect(result).not.toMatch(/\.\.\.$/);
    });

    it('should add ellipsis to text over 200 chars', () => {
      const text = 'X'.repeat(201);
      const result = generateExcerpt(text);

      expect(result).toMatch(/\.\.\.$/);
    });

    it('should not break at word boundary if too short', () => {
      // Create text where breaking at word boundary would leave < 150 chars
      const text = 'A'.repeat(140) + ' ' + 'B'.repeat(100);
      const result = generateExcerpt(text);

      // Should truncate at 200 + '...' instead of breaking at space
      expect(result.length).toBe(203);
    });
  });
});
