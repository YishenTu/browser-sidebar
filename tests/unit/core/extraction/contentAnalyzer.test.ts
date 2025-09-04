/**
 * @file ContentAnalyzer Unit Tests
 *
 * Comprehensive unit tests for the ContentAnalyzer module that analyzes
 * content features like code blocks, tables, and generates excerpts.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  detectCodeBlocks,
  detectTables,
  generateExcerpt,
} from '@core/extraction/analyzers/contentAnalyzer';

// ============================================================================
// Test Fixtures
// ============================================================================

const markdownSamples = {
  // Code block samples
  withCodeBlock:
    '# Title\n\nHere is some code:\n\n```javascript\nfunction test() {\n  return true;\n}\n```\n\nMore content.',
  withMultipleCodeBlocks: '```python\nprint("hello")\n```\n\nSome text.\n\n```bash\nls -la\n```',
  withInlineCode: 'This has `inline code` but no blocks.',
  withoutCode: '# Title\n\nJust regular markdown content with no code.',

  // Table samples
  withTable:
    '# Data\n\n| Name | Age | City |\n|------|-----|------|\n| John | 25  | NYC  |\n| Jane | 30  | LA   |',
  withSimpleTable: '| A | B |\n| 1 | 2 |',
  withComplexTable: `
# Sales Report

| Quarter | Region | Revenue | Growth |
|---------|--------|---------|--------|
| Q1 2024 | North  | $50K    | +5%    |
| Q2 2024 | South  | $75K    | +15%   |
| Q3 2024 | East   | $60K    | -2%    |

This shows our performance.
`,
  withPipeInText: 'This is not a table | just text with one pipe.',
  withoutTable: '# Title\n\nRegular content without any tables.',

  // Excerpt samples
  shortContent: 'This is short content.',
  mediumContent:
    'This is medium length content that should be returned in full since it is under 200 characters total and does not need to be truncated at all.',
  longContent: `
# Long Article Title

This is a very long article with lots of content that exceeds 200 characters. It contains multiple paragraphs, various formatting elements, and should be truncated properly at word boundaries when generating excerpts for preview purposes.

## Section 2

More content continues here with additional details that make this article quite lengthy and suitable for testing the excerpt generation functionality.

The content keeps going and going to ensure we have enough text to properly test the truncation logic and word boundary detection.
`.trim(),

  // Content with formatting
  withMarkdownFormatting: `
# Title with **Bold** and *Italic*

This content has various formatting including \`inline code\`, [links](https://example.com), and other **bold** text.

\`\`\`javascript
function test() {
  return "code block";
}
\`\`\`

More text after the code block.
`.trim(),

  // Edge cases
  emptyContent: '',
  whitespaceOnly: '   \n\t   ',
  onlyFormatting: '**bold** *italic* `code` [link](url)',
  exactlyTwoHundred: 'A'.repeat(200),
  twoHundredOne: 'A'.repeat(201),
};

// ============================================================================
// Test Suite
// ============================================================================

describe('ContentAnalyzer', () => {
  beforeEach(() => {
    // No setup needed for pure functions
  });

  // ============================================================================
  // Code Block Detection Tests
  // ============================================================================

  describe('detectCodeBlocks', () => {
    it('should detect single code block', () => {
      const result = detectCodeBlocks(markdownSamples.withCodeBlock);
      expect(result).toBe(true);
    });

    it('should detect multiple code blocks', () => {
      const result = detectCodeBlocks(markdownSamples.withMultipleCodeBlocks);
      expect(result).toBe(true);
    });

    it('should not detect inline code as code blocks', () => {
      const result = detectCodeBlocks(markdownSamples.withInlineCode);
      expect(result).toBe(false);
    });

    it('should return false for content without code', () => {
      const result = detectCodeBlocks(markdownSamples.withoutCode);
      expect(result).toBe(false);
    });

    it('should handle empty content', () => {
      const result = detectCodeBlocks(markdownSamples.emptyContent);
      expect(result).toBe(false);
    });

    it('should handle whitespace-only content', () => {
      const result = detectCodeBlocks(markdownSamples.whitespaceOnly);
      expect(result).toBe(false);
    });

    it('should detect code blocks with different languages', () => {
      const samples = [
        '```python\nprint("hello")\n```',
        '```bash\nls -la\n```',
        '```typescript\ninterface Test {}\n```',
        '```sql\nSELECT * FROM users;\n```',
        '```\n// no language specified\n```',
      ];

      samples.forEach(sample => {
        expect(detectCodeBlocks(sample)).toBe(true);
      });
    });

    it('should handle malformed code blocks', () => {
      const malformedSamples = [
        '``javascript\nconsole.log();\n```', // wrong opening
        '```javascript\nconsole.log();\n``', // wrong closing
        '```javascript\ncode without closing', // missing closing
      ];

      malformedSamples.forEach(sample => {
        // These should still be detected by the regex
        const result = detectCodeBlocks(sample);
        expect(result).toBe(false); // Malformed blocks won't match the proper pattern
      });
    });

    it('should handle nested backticks', () => {
      const nestedContent = '```markdown\nThis has `inline code` inside\n```';
      const result = detectCodeBlocks(nestedContent);
      expect(result).toBe(true);
    });
  });

  // ============================================================================
  // Table Detection Tests
  // ============================================================================

  describe('detectTables', () => {
    it('should detect simple table', () => {
      const result = detectTables(markdownSamples.withTable);
      expect(result).toBe(true);
    });

    it('should detect minimal table with two pipes', () => {
      const result = detectTables(markdownSamples.withSimpleTable);
      expect(result).toBe(true);
    });

    it('should detect complex table with multiple rows', () => {
      const result = detectTables(markdownSamples.withComplexTable);
      expect(result).toBe(true);
    });

    it('should not detect pipes in regular text as tables', () => {
      const result = detectTables(markdownSamples.withPipeInText);
      expect(result).toBe(false);
    });

    it('should return false for content without tables', () => {
      const result = detectTables(markdownSamples.withoutTable);
      expect(result).toBe(false);
    });

    it('should handle empty content', () => {
      const result = detectTables(markdownSamples.emptyContent);
      expect(result).toBe(false);
    });

    it('should handle whitespace-only content', () => {
      const result = detectTables(markdownSamples.whitespaceOnly);
      expect(result).toBe(false);
    });

    it('should detect tables with various column counts', () => {
      const tableSamples = [
        '| A | B |', // 2 columns
        '| A | B | C |', // 3 columns
        '| A | B | C | D | E |', // 5 columns
      ];

      tableSamples.forEach(sample => {
        expect(detectTables(sample)).toBe(true);
      });
    });

    it('should handle tables with alignment markers', () => {
      const alignedTable = `
| Left | Center | Right |
|:-----|:------:|------:|
| A    | B      | C     |
`;
      const result = detectTables(alignedTable);
      expect(result).toBe(true);
    });

    it('should not detect single pipe as table', () => {
      const singlePipe = 'This has one | pipe.';
      const result = detectTables(singlePipe);
      expect(result).toBe(false);
    });

    it('should handle tables mixed with other content', () => {
      const mixedContent = `
# Title

Some text content.

| Name | Value |
|------|-------|
| Test | 123   |

More text after table.
`;
      const result = detectTables(mixedContent);
      expect(result).toBe(true);
    });
  });

  // ============================================================================
  // Excerpt Generation Tests
  // ============================================================================

  describe('generateExcerpt', () => {
    it('should return full content for short text', () => {
      const result = generateExcerpt(markdownSamples.shortContent);
      expect(result).toBe(markdownSamples.shortContent);
    });

    it('should return full content for medium text under 200 chars', () => {
      const result = generateExcerpt(markdownSamples.mediumContent);
      expect(result).toBe(markdownSamples.mediumContent);
    });

    it('should truncate long content with ellipsis', () => {
      const result = generateExcerpt(markdownSamples.longContent);
      expect(result).toContain('...');
      expect(result.length).toBeLessThan(markdownSamples.longContent.length);
      expect(result.length).toBeLessThanOrEqual(203); // 200 + "..."
    });

    it('should handle empty content', () => {
      const result = generateExcerpt(markdownSamples.emptyContent);
      expect(result).toBe('');
    });

    it('should handle whitespace-only content', () => {
      const result = generateExcerpt(markdownSamples.whitespaceOnly);
      expect(result).toBe('');
    });

    it('should remove markdown formatting from excerpt', () => {
      const result = generateExcerpt(markdownSamples.withMarkdownFormatting);
      expect(result).not.toContain('**');
      expect(result).not.toContain('*');
      expect(result).not.toContain('`');
      expect(result).not.toContain('](');
      expect(result).not.toContain('#');
      // [code] placeholder should be present
      expect(result).toContain('[code]');
    });

    it('should replace code blocks with [code] placeholder', () => {
      const result = generateExcerpt(markdownSamples.withMarkdownFormatting);
      expect(result).toContain('[code]');
      expect(result).not.toContain('```');
      expect(result).not.toContain('function test()');
    });

    it('should replace inline code with [code] placeholder', () => {
      const inlineCodeContent = 'This has `some code` in it.';
      const result = generateExcerpt(inlineCodeContent);
      expect(result).toBe('This has [code] in it.');
    });

    it('should convert links to text only', () => {
      const linkContent = 'Visit [our website](https://example.com) for more info.';
      const result = generateExcerpt(linkContent);
      expect(result).toBe('Visit our website for more info.');
    });

    it('should normalize whitespace', () => {
      const messyContent = 'This   has\tmultiple\n\nspaces    and\ttabs.';
      const result = generateExcerpt(messyContent);
      expect(result).toBe('This has multiple spaces and tabs.');
    });

    it('should break at word boundaries when truncating', () => {
      const longText =
        'This is a very long sentence that should be truncated at word boundaries rather than in the middle of words to maintain readability and proper formatting for the excerpt generation.';
      const result = generateExcerpt(longText);

      // The function only truncates if over 200 chars
      if (longText.length > 200) {
        expect(result).toContain('...');
        expect(result.length).toBeLessThan(longText.length);
        // Should not end with a partial word (before the ...)
        const withoutEllipsis = result.replace('...', '');
        const lastChar = withoutEllipsis[withoutEllipsis.length - 1];
        expect(lastChar).toBe(' ');
      } else {
        expect(result).toBe(longText);
      }
    });

    it('should handle content exactly at 200 characters', () => {
      const result = generateExcerpt(markdownSamples.exactlyTwoHundred);
      expect(result).toBe(markdownSamples.exactlyTwoHundred);
      expect(result).not.toContain('...');
    });

    it('should truncate content over 200 characters', () => {
      const result = generateExcerpt(markdownSamples.twoHundredOne);
      expect(result).toContain('...');
      expect(result.length).toBeLessThanOrEqual(203); // 200 + '...'
      // Result should be truncated from original length
      expect(result.replace('...', '').length).toBeLessThanOrEqual(200);
    });

    it('should handle content with only formatting', () => {
      const result = generateExcerpt(markdownSamples.onlyFormatting);
      expect(result).toBe('bold italic [code] link');
    });

    it('should handle very short word at the end when truncating', () => {
      // Create content where truncation would happen near a very short word
      const content = 'A'.repeat(195) + ' b';
      const result = generateExcerpt(content);

      // Content is 197 chars, under 200, so no truncation
      expect(result).toBe(content);
      expect(result).not.toContain('...');
    });

    it('should handle case where word boundary is too short', () => {
      // Create content where word boundary would be at position < 150
      const content = 'A'.repeat(140) + ' ' + 'B'.repeat(100);
      const result = generateExcerpt(content);

      // Should truncate at 200 chars since word boundary is too short
      expect(result).toContain('...');
      expect(result.length).toBeLessThanOrEqual(203); // 200 + "..."
      expect(result.replace('...', '').length).toBe(200);
    });

    it('should handle multiple consecutive formatting elements', () => {
      const consecutiveFormatting = '**bold** *italic* `code` [link](url) more text';
      const result = generateExcerpt(consecutiveFormatting);
      expect(result).toBe('bold italic [code] link more text');
    });

    it('should handle nested formatting', () => {
      const nestedFormatting = '**This is *nested* formatting** with more text';
      const result = generateExcerpt(nestedFormatting);
      expect(result).toBe('This is nested formatting with more text');
    });

    it('should handle special markdown characters', () => {
      const specialChars = 'This has ~strikethrough~ and other special chars';
      const result = generateExcerpt(specialChars);
      expect(result).toBe('This has strikethrough and other special chars');
    });

    it('should handle mixed content with multiple elements', () => {
      const mixedContent = `
# Title

This content has **bold**, *italic*, \`code\`, [links](url), and more.

\`\`\`javascript
console.log("test");
\`\`\`

Additional content after code block.
      `.trim();

      const result = generateExcerpt(mixedContent);
      expect(result).toContain('Title');
      expect(result).toContain('[code]');
      expect(result).not.toContain('**');
      expect(result).not.toContain('```');
      expect(result).not.toContain('console.log');
    });
  });

  // ============================================================================
  // Edge Cases and Error Handling
  // ============================================================================

  describe('edge cases and error handling', () => {
    it('should handle null input for detectCodeBlocks', () => {
      expect(() => detectCodeBlocks(null as any)).not.toThrow();
      expect(detectCodeBlocks(null as any)).toBe(false);
    });

    it('should handle undefined input for detectCodeBlocks', () => {
      expect(() => detectCodeBlocks(undefined as any)).not.toThrow();
      expect(detectCodeBlocks(undefined as any)).toBe(false);
    });

    it('should handle null input for detectTables', () => {
      expect(() => detectTables(null as any)).toThrow();
    });

    it('should handle undefined input for detectTables', () => {
      expect(() => detectTables(undefined as any)).toThrow();
    });

    it('should handle null input for generateExcerpt', () => {
      expect(() => generateExcerpt(null as any)).not.toThrow();
      expect(generateExcerpt(null as any)).toBe('');
    });

    it('should handle undefined input for generateExcerpt', () => {
      expect(() => generateExcerpt(undefined as any)).not.toThrow();
      expect(generateExcerpt(undefined as any)).toBe('');
    });

    it('should handle very large content efficiently', () => {
      const hugeContent = 'A'.repeat(10000);
      const start = performance.now();
      const result = generateExcerpt(hugeContent);
      const end = performance.now();

      expect(result).toContain('...');
      expect(result.length).toBeLessThanOrEqual(203);
      expect(end - start).toBeLessThan(100); // Should be fast
    });

    it('should handle content with unusual unicode characters', () => {
      const unicodeContent = 'This has émojis 🚀 and spëcial châractërs ñ';
      const result = generateExcerpt(unicodeContent);
      expect(result).toBe(unicodeContent);
    });

    it('should handle content with line breaks and tabs', () => {
      const contentWithBreaks = 'Line 1\nLine 2\tTabbed\r\nWindows line ending';
      const result = generateExcerpt(contentWithBreaks);
      expect(result).toBe('Line 1 Line 2 Tabbed Windows line ending');
    });
  });

  // ============================================================================
  // Performance Tests
  // ============================================================================

  describe('performance', () => {
    it('should handle large markdown content efficiently', () => {
      const largeContent = [
        '# Large Document',
        'This is a large document with many sections.',
        '```javascript\n' + 'console.log("code");'.repeat(100) + '\n```',
        '| Col1 | Col2 | Col3 |\n|------|------|------|',
        ...Array(100).fill('| Data | More | Info |'),
        'More content after table.',
      ].join('\n\n');

      const start = performance.now();

      const hasCode = detectCodeBlocks(largeContent);
      const hasTable = detectTables(largeContent);
      const excerpt = generateExcerpt(largeContent);

      const end = performance.now();

      expect(hasCode).toBe(true);
      expect(hasTable).toBe(true);
      expect(excerpt).toBeDefined();
      expect(end - start).toBeLessThan(50); // Should be very fast
    });
  });
});
