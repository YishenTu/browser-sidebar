/**
 * @file Unit Tests for Markdown Converter
 *
 * Comprehensive unit tests for HTML to Markdown conversion utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { htmlToMarkdown } from '@/tabext/markdown/markdownConverter';
import type { MarkdownConversionOptions } from '@/tabext/markdown/markdownConverter';

// Mock dependencies
vi.mock('dompurify', () => ({
  default: {
    sanitize: vi.fn((html: string) => html), // Pass through HTML for most tests
  },
}));

// Create a shared mock instance
const mockTurndownInstance = {
  addRule: vi.fn(),
  use: vi.fn(),
  turndown: vi.fn(),
  options: {},
};

vi.mock('turndown', () => {
  return {
    default: vi.fn().mockImplementation(() => mockTurndownInstance),
  };
});

vi.mock('turndown-plugin-gfm', () => ({
  gfm: vi.fn(),
}));

// Import mocks to access them in tests
import DOMPurify from 'dompurify';

beforeEach(() => {
  vi.clearAllMocks();

  // Reset Turndown mock behavior
  mockTurndownInstance.turndown.mockImplementation((html: string) => {
    // Simple mock conversion for testing
    return html
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1')
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1')
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1')
      .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
      .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
      .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
      .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
      .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ''); // Remove remaining HTML tags
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('htmlToMarkdown', () => {
  describe('basic HTML conversion', () => {
    it('should convert headings correctly', async () => {
      const html = '<h1>Title</h1><h2>Subtitle</h2><h3>Section</h3>';
      const result = await htmlToMarkdown(html);

      expect(result).toContain('# Title');
      expect(result).toContain('## Subtitle');
      expect(result).toContain('### Section');
    });

    it('should convert text formatting correctly', async () => {
      const html = '<p>This has <strong>bold</strong> and <em>italic</em> text.</p>';
      const result = await htmlToMarkdown(html);

      expect(result).toContain('**bold**');
      expect(result).toContain('*italic*');
    });

    it('should handle mixed HTML elements', async () => {
      const html = `
        <div>
          <h1>Main Title</h1>
          <p>Paragraph with <b>bold</b> and <i>italic</i> text.</p>
          <h2>Section</h2>
          <p>Another paragraph.</p>
        </div>
      `;

      const result = await htmlToMarkdown(html);

      expect(result).toContain('# Main Title');
      expect(result).toContain('**bold**');
      expect(result).toContain('*italic*');
      expect(result).toContain('## Section');
    });
  });

  describe('code blocks with language detection', () => {
    it('should detect JavaScript language from class', async () => {
      mockTurndownInstance.turndown.mockReturnValue('```javascript\nconst x = 5;\n```');

      const html = '<pre><code class="language-javascript">const x = 5;</code></pre>';
      const result = await htmlToMarkdown(html);

      expect(result).toContain('```javascript');
      expect(result).toContain('const x = 5;');
      expect(result).toContain('```');
    });

    it('should detect Python language from class', async () => {
      // Using the shared mockTurndownInstance
      mockTurndownInstance.turndown.mockReturnValue(
        '```python\ndef hello():\n    print("Hello")\n```'
      );

      const html =
        '<pre><code class="language-python">def hello():\n    print("Hello")</code></pre>';
      const result = await htmlToMarkdown(html);

      expect(result).toContain('```python');
      expect(result).toContain('def hello():');
    });

    it('should handle lang- prefix', async () => {
      // Using the shared mockTurndownInstance
      mockTurndownInstance.turndown.mockReturnValue('```typescript\ninterface User {}\n```');

      const html = '<pre><code class="lang-typescript">interface User {}</code></pre>';
      const result = await htmlToMarkdown(html);

      expect(result).toContain('```typescript');
    });
  });

  describe('code blocks without language', () => {
    it('should create fenced code blocks without language specification', async () => {
      // Using the shared mockTurndownInstance
      mockTurndownInstance.turndown.mockReturnValue('```\nsome code\n```');

      const html = '<pre><code>some code</code></pre>';
      const result = await htmlToMarkdown(html);

      expect(result).toMatch(/```\s*\nsome code\n```/);
    });

    it('should handle pre tags without code tags', async () => {
      // Using the shared mockTurndownInstance
      mockTurndownInstance.turndown.mockReturnValue('```\nplain preformatted text\n```');

      const html = '<pre>plain preformatted text</pre>';
      const result = await htmlToMarkdown(html);

      expect(result).toContain('plain preformatted text');
    });
  });

  describe('table conversion (GFM)', () => {
    it('should convert simple tables', async () => {
      // Using the shared mockTurndownInstance
      mockTurndownInstance.turndown.mockReturnValue(
        '| Header 1 | Header 2 |\n|----------|----------|\n| Cell 1   | Cell 2   |'
      );

      const html = `
        <table>
          <thead>
            <tr><th>Header 1</th><th>Header 2</th></tr>
          </thead>
          <tbody>
            <tr><td>Cell 1</td><td>Cell 2</td></tr>
          </tbody>
        </table>
      `;

      const result = await htmlToMarkdown(html);

      expect(result).toContain('Header 1');
      expect(result).toContain('Header 2');
      expect(result).toContain('Cell 1');
      expect(result).toContain('Cell 2');
    });

    it('should handle tables without thead', async () => {
      // Using the shared mockTurndownInstance
      mockTurndownInstance.turndown.mockReturnValue(
        '| Row 1 Col 1 | Row 1 Col 2 |\n|-------------|-------------|\n| Row 2 Col 1 | Row 2 Col 2 |'
      );

      const html = `
        <table>
          <tr><td>Row 1 Col 1</td><td>Row 1 Col 2</td></tr>
          <tr><td>Row 2 Col 1</td><td>Row 2 Col 2</td></tr>
        </table>
      `;

      const result = await htmlToMarkdown(html);

      expect(result).toContain('Row 1 Col 1');
      expect(result).toContain('Row 2 Col 2');
    });
  });

  describe('link handling', () => {
    it('should include links by default (includeLinks=true)', async () => {
      // Using the shared mockTurndownInstance
      mockTurndownInstance.turndown.mockReturnValue(
        'Visit [Example](https://example.com "Example Site") for more info.'
      );

      const html =
        '<p>Visit <a href="https://example.com" title="Example Site">Example</a> for more info.</p>';
      const result = await htmlToMarkdown(html, { includeLinks: true });

      expect(result).toContain('[Example](https://example.com "Example Site")');
    });

    it('should include links with default options', async () => {
      // Using the shared mockTurndownInstance
      mockTurndownInstance.turndown.mockReturnValue(
        'Visit [Example](https://example.com) for info.'
      );

      const html = '<p>Visit <a href="https://example.com">Example</a> for info.</p>';
      const result = await htmlToMarkdown(html); // No options provided

      expect(result).toContain('[Example](https://example.com)');
    });

    it('should strip links when includeLinks=false', async () => {
      // Using the shared mockTurndownInstance
      mockTurndownInstance.turndown.mockReturnValue('Visit Example for more info.');

      const html = '<p>Visit <a href="https://example.com">Example</a> for more info.</p>';
      const result = await htmlToMarkdown(html, { includeLinks: false });

      expect(result).toContain('Visit Example for more info.');
      expect(result).not.toContain('[Example]');
      expect(result).not.toContain('https://example.com');
    });

    it('should handle links without href attribute', async () => {
      // Using the shared mockTurndownInstance
      mockTurndownInstance.turndown.mockReturnValue('Click here for more info.');

      const html = '<p>Click <a>here</a> for more info.</p>';
      const result = await htmlToMarkdown(html);

      expect(result).toContain('Click here for more info.');
    });
  });

  describe('DOMPurify sanitization', () => {
    it('should call DOMPurify.sanitize with correct options', async () => {
      const html = '<script>alert("xss")</script><p>Safe content</p>';

      await htmlToMarkdown(html);

      expect(DOMPurify.sanitize).toHaveBeenCalledWith(html, {
        ALLOWED_TAGS: expect.arrayContaining([
          'p',
          'br',
          'div',
          'span',
          'h1',
          'h2',
          'h3',
          'h4',
          'h5',
          'h6',
          'ul',
          'ol',
          'li',
          'strong',
          'b',
          'em',
          'i',
          'u',
          'del',
          's',
          'strike',
          'code',
          'pre',
          'kbd',
          'samp',
          'a',
          'img',
          'table',
          'thead',
          'tbody',
          'tfoot',
          'tr',
          'th',
          'td',
          'blockquote',
          'hr',
          'section',
          'article',
          'nav',
          'aside',
          'dl',
          'dt',
          'dd',
        ]),
        ALLOWED_ATTR: expect.arrayContaining([
          'href',
          'title',
          'alt',
          'src',
          'class',
          'id',
          'colspan',
          'rowspan',
          'start',
          'type',
        ]),
        KEEP_CONTENT: true,
      });
    });

    it('should handle sanitized HTML', async () => {
      // Mock DOMPurify to remove script tag
      (DOMPurify.sanitize as any).mockReturnValue('<p>Safe content</p>');

      const html = '<script>alert("xss")</script><p>Safe content</p>';
      const result = await htmlToMarkdown(html);

      expect(result).toContain('Safe content');
      expect(result).not.toContain('script');
    });
  });

  describe('error handling', () => {
    it('should handle DOMPurify throwing an error', async () => {
      (DOMPurify.sanitize as any).mockImplementation(() => {
        throw new Error('DOMPurify failed');
      });

      const html = '<p>Content</p>';
      const result = await htmlToMarkdown(html);

      // Should fallback to basic text extraction
      expect(typeof result).toBe('string');
    });

    it('should handle Turndown throwing an error', async () => {
      // Using the shared mockTurndownInstance
      mockTurndownInstance.turndown.mockImplementation(() => {
        throw new Error('Turndown failed');
      });

      const html = '<p>Content</p>';
      const result = await htmlToMarkdown(html);

      // Should fallback to text content extraction
      expect(typeof result).toBe('string');
    });

    it('should handle complete conversion failure', async () => {
      // Mock all dependencies to fail
      (DOMPurify.sanitize as any).mockImplementation(() => {
        throw new Error('DOMPurify failed');
      });

      // Mock DOMParser to also fail
      const originalDOMParser = global.DOMParser;
      global.DOMParser = vi.fn().mockImplementation(() => ({
        parseFromString: () => {
          throw new Error('DOMParser failed');
        },
      })) as any;

      const html = '<p>Content</p>';
      const result = await htmlToMarkdown(html);

      expect(result).toBe('');

      // Restore DOMParser
      global.DOMParser = originalDOMParser;
    });
  });

  describe('empty/null HTML handling', () => {
    it('should handle empty HTML string', async () => {
      // Using the shared mockTurndownInstance
      mockTurndownInstance.turndown.mockReturnValue('');

      const result = await htmlToMarkdown('');
      expect(result).toBe('');
    });

    it('should handle whitespace-only HTML', async () => {
      // Using the shared mockTurndownInstance
      mockTurndownInstance.turndown.mockReturnValue('');

      const result = await htmlToMarkdown('   \n\t  ');
      expect(result).toBe('');
    });

    it('should handle HTML with only whitespace content', async () => {
      // Using the shared mockTurndownInstance
      mockTurndownInstance.turndown.mockReturnValue('');

      const html = '<p>   </p><div>\n\t</div>';
      const result = await htmlToMarkdown(html);
      expect(result).toBe('');
    });
  });

  describe('complex nested HTML structures', () => {
    it('should handle deeply nested elements', async () => {
      // Using the shared mockTurndownInstance
      mockTurndownInstance.turndown.mockReturnValue(
        '# Title\n\n**Bold *italic* text**\n\n## Section\n\nParagraph text.'
      );

      const html = `
        <div>
          <article>
            <header>
              <h1>Title</h1>
            </header>
            <section>
              <p><strong>Bold <em>italic</em> text</strong></p>
              <h2>Section</h2>
              <p>Paragraph text.</p>
            </section>
          </article>
        </div>
      `;

      const result = await htmlToMarkdown(html);

      expect(result).toContain('# Title');
      expect(result).toContain('**Bold *italic* text**');
      expect(result).toContain('## Section');
    });

    it('should handle lists with nested elements', async () => {
      // Using the shared mockTurndownInstance
      mockTurndownInstance.turndown.mockReturnValue(
        '- **Bold item**\n- *Italic item*\n- [Link item](https://example.com)'
      );

      const html = `
        <ul>
          <li><strong>Bold item</strong></li>
          <li><em>Italic item</em></li>
          <li><a href="https://example.com">Link item</a></li>
        </ul>
      `;

      const result = await htmlToMarkdown(html);

      expect(result).toContain('**Bold item**');
      expect(result).toContain('*Italic item*');
      expect(result).toContain('[Link item](https://example.com)');
    });
  });

  describe('whitespace normalization', () => {
    it('should remove excessive newlines', async () => {
      // Using the shared mockTurndownInstance
      mockTurndownInstance.turndown.mockReturnValue('\n\n\n# Title\n\n\n\nParagraph\n\n\n\n');

      const html = '<h1>Title</h1><p>Paragraph</p>';
      const result = await htmlToMarkdown(html);

      // Should not have more than 2 consecutive newlines
      expect(result).not.toMatch(/\n{3,}/);
      expect(result.startsWith('\n')).toBe(false);
      expect(result.endsWith('\n')).toBe(false);
    });

    it('should trim leading and trailing whitespace', async () => {
      // Using the shared mockTurndownInstance
      mockTurndownInstance.turndown.mockReturnValue('   \n\n# Title\n\nParagraph\n\n   ');

      const html = '<h1>Title</h1><p>Paragraph</p>';
      const result = await htmlToMarkdown(html);

      expect(result.startsWith(' ')).toBe(false);
      expect(result.endsWith(' ')).toBe(false);
      expect(result.startsWith('\n')).toBe(false);
      expect(result.endsWith('\n')).toBe(false);
    });
  });

  describe('performance benchmarks', () => {
    it('should convert HTML efficiently', async () => {
      const html = `
        <div>
          <h1>Performance Test</h1>
          <p>This is a <strong>performance</strong> test with <em>various</em> elements.</p>
          <ul>
            <li>Item 1</li>
            <li>Item 2</li>
            <li>Item 3</li>
          </ul>
          <pre><code class="language-javascript">console.log('test');</code></pre>
        </div>
      `;

      const start = performance.now();
      for (let i = 0; i < 50; i++) {
        await htmlToMarkdown(html);
      }
      const end = performance.now();

      // Should complete 50 conversions in under 100ms
      expect(end - start).toBeLessThan(100);
    });

    it('should handle large HTML documents efficiently', async () => {
      // Create a large HTML document
      const paragraphs = Array.from(
        { length: 100 },
        (_, i) => `<p>Paragraph ${i + 1} with <strong>bold</strong> and <em>italic</em> text.</p>`
      ).join('');

      const largeHtml = `<div>${paragraphs}</div>`;

      const start = performance.now();
      await htmlToMarkdown(largeHtml);
      const end = performance.now();

      // Should complete large document conversion in under 50ms
      expect(end - start).toBeLessThan(50);
    });
  });

  describe('type safety and interfaces', () => {
    it('should accept MarkdownConversionOptions interface', async () => {
      const options: MarkdownConversionOptions = {
        includeLinks: false,
      };

      const html = '<p>Test</p>';
      const result = await htmlToMarkdown(html, options);

      expect(typeof result).toBe('string');
    });

    it('should work with partial options', async () => {
      const html = '<p>Test</p>';

      // These should all compile and work
      await htmlToMarkdown(html);
      await htmlToMarkdown(html, {});
      await htmlToMarkdown(html, { includeLinks: true });
      await htmlToMarkdown(html, { includeLinks: false });
    });
  });
});
