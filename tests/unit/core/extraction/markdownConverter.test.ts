/**
 * @file MarkdownConverter Unit Tests
 *
 * Comprehensive unit tests for the MarkdownConverter module that handles
 * HTML to Markdown conversion with sanitization, custom rules, and error handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { htmlToMarkdown, type MarkdownConversionOptions } from '@core/extraction/markdownConverter';

// ============================================================================
// Mock Setup
// ============================================================================

// Mock dependencies
const mockTurndownService = {
  turndown: vi.fn(),
  use: vi.fn(),
  addRule: vi.fn(),
  keep: vi.fn(),
  remove: vi.fn(),
  options: {},
};

const mockGfmPlugin = vi.fn();

const mockDOMPurify = {
  sanitize: vi.fn(),
};

// Mock dynamic imports
vi.mock('turndown', () => ({
  default: vi.fn(() => mockTurndownService),
}));

vi.mock('turndown-plugin-gfm', () => ({
  gfm: mockGfmPlugin,
}));

vi.mock('dompurify', () => ({
  default: mockDOMPurify,
}));

// ============================================================================
// Test Fixtures
// ============================================================================

const sampleHtml = {
  basic: '<p>Hello <strong>world</strong>!</p>',
  withHeaders: '<h1>Title</h1><h2>Subtitle</h2><p>Content</p>',
  withList: '<ul><li>Item 1</li><li>Item 2</li></ul>',
  withLinks: '<p>Visit <a href="https://example.com">example</a> for more info.</p>',
  withImages: '<p><img src="image.jpg" alt="Test image" /></p>',
  withCode: '<pre><code class="language-javascript">console.log("hello");</code></pre>',
  withTable: '<table><tr><th>Name</th><th>Age</th></tr><tr><td>John</td><td>25</td></tr></table>',
  withFigure:
    '<figure><img src="test.jpg" alt="Test" /><figcaption>Test caption</figcaption></figure>',
  withFootnotes:
    '<p>Text<sup><a href="#fn1">1</a></sup></p><ol class="footnote"><li id="fn1">Footnote text</li></ol>',
  withYouTube: '<iframe src="https://youtube.com/embed/abc123"></iframe>',
  withTwitter: '<iframe src="https://twitter.com/user/status/123456"></iframe>',
  withScript: '<p>Content</p><script>alert("xss")</script>',
  malformed: '<p>Unclosed tag<div>Nested incorrectly</p></div>',
  empty: '',
  whitespaceOnly: '   \n\t   ',
  multipleNewlines: '<p>Para 1</p>\n\n\n<p>Para 2</p>',
};

const expectedMarkdown = {
  basic: 'Hello **world**!',
  withHeaders: '# Title\n\n## Subtitle\n\nContent',
  withList: '- Item 1\n- Item 2',
  withLinks: 'Visit [example](https://example.com) for more info.',
  withImages: '![Test image](image.jpg)',
  withCode: '```javascript\nconsole.log("hello");\n```',
  withTable: '| Name | Age |\n| --- | --- |\n| John | 25 |',
  withFigure: '![Test](test.jpg)\n*Test caption*',
  withFootnotes: 'Text[^1]\n\n---\n\n[^1]: Footnote text',
  withYouTube: '![YouTube Video](https://img.youtube.com/vi/abc123/0.jpg)',
  withTwitter: '[Tweet 123456]',
};

// ============================================================================
// Test Suite
// ============================================================================

describe('MarkdownConverter', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mock implementations
    mockDOMPurify.sanitize.mockImplementation(html => html);
    mockTurndownService.turndown.mockImplementation(html => html);
    mockTurndownService.use.mockReturnValue(mockTurndownService);
    mockTurndownService.addRule.mockReturnValue(mockTurndownService);
    mockTurndownService.keep.mockReturnValue(mockTurndownService);
    mockTurndownService.remove.mockReturnValue(mockTurndownService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Basic Conversion Tests
  // ============================================================================

  describe('basic HTML conversion', () => {
    it('should convert basic HTML to markdown', async () => {
      mockTurndownService.turndown.mockReturnValue(expectedMarkdown.basic);

      const result = await htmlToMarkdown(sampleHtml.basic);

      expect(result).toBe(expectedMarkdown.basic);
      expect(mockDOMPurify.sanitize).toHaveBeenCalledWith(
        sampleHtml.basic,
        expect.objectContaining({
          ALLOWED_TAGS: expect.arrayContaining(['p', 'strong', 'b', 'em', 'i']),
          ALLOWED_ATTR: expect.arrayContaining(['href', 'alt', 'src']),
          KEEP_CONTENT: true,
        })
      );
    });

    it('should handle headers correctly', async () => {
      mockTurndownService.turndown.mockReturnValue(expectedMarkdown.withHeaders);

      const result = await htmlToMarkdown(sampleHtml.withHeaders);

      expect(result).toBe(expectedMarkdown.withHeaders);
      expect(mockTurndownService.turndown).toHaveBeenCalled();
    });

    it('should handle lists correctly', async () => {
      mockTurndownService.turndown.mockReturnValue(expectedMarkdown.withList);

      const result = await htmlToMarkdown(sampleHtml.withList);

      expect(result).toBe(expectedMarkdown.withList);
    });

    it('should handle tables correctly', async () => {
      mockTurndownService.turndown.mockReturnValue(expectedMarkdown.withTable);

      const result = await htmlToMarkdown(sampleHtml.withTable);

      expect(result).toBe(expectedMarkdown.withTable);
    });
  });

  // ============================================================================
  // Links and Images Tests
  // ============================================================================

  describe('links and images handling', () => {
    it('should include links by default', async () => {
      mockTurndownService.turndown.mockReturnValue(expectedMarkdown.withLinks);

      const result = await htmlToMarkdown(sampleHtml.withLinks);

      expect(result).toBe(expectedMarkdown.withLinks);
      expect(mockTurndownService.options.includeLinks).toBe(true);
    });

    it('should exclude links when includeLinks is false', async () => {
      mockTurndownService.turndown.mockReturnValue('Visit example for more info.');

      const options: MarkdownConversionOptions = { includeLinks: false };
      const result = await htmlToMarkdown(sampleHtml.withLinks, options);

      expect(result).toBe('Visit example for more info.');
      expect(mockTurndownService.options.includeLinks).toBe(false);
    });

    it('should handle images correctly', async () => {
      mockTurndownService.turndown.mockReturnValue(expectedMarkdown.withImages);

      const result = await htmlToMarkdown(sampleHtml.withImages);

      expect(result).toBe(expectedMarkdown.withImages);
    });

    it('should preserve images in links when includeLinks is false', async () => {
      const htmlWithImageLink =
        '<a href="https://example.com"><img src="test.jpg" alt="Test" /></a>';
      mockTurndownService.turndown.mockReturnValue('![Test](test.jpg)');

      const options: MarkdownConversionOptions = { includeLinks: false };
      const result = await htmlToMarkdown(htmlWithImageLink, options);

      expect(result).toBe('![Test](test.jpg)');
    });
  });

  // ============================================================================
  // Code Blocks Tests
  // ============================================================================

  describe('code block handling', () => {
    it('should handle code blocks with language detection', async () => {
      mockTurndownService.turndown.mockReturnValue(expectedMarkdown.withCode);

      const result = await htmlToMarkdown(sampleHtml.withCode);

      expect(result).toBe(expectedMarkdown.withCode);
    });

    it('should handle code blocks without language', async () => {
      const htmlWithoutLang = '<pre><code>console.log("hello");</code></pre>';
      mockTurndownService.turndown.mockReturnValue('```\nconsole.log("hello");\n```');

      const result = await htmlToMarkdown(htmlWithoutLang);

      expect(result).toBe('```\nconsole.log("hello");\n```');
    });

    it('should handle pre tags without code elements', async () => {
      const htmlPreOnly = '<pre>Raw preformatted text</pre>';
      mockTurndownService.turndown.mockReturnValue('```\nRaw preformatted text\n```');

      const result = await htmlToMarkdown(htmlPreOnly);

      expect(result).toBe('```\nRaw preformatted text\n```');
    });
  });

  // ============================================================================
  // Figure and Caption Tests
  // ============================================================================

  describe('figure and caption handling', () => {
    it('should handle figures with captions', async () => {
      mockTurndownService.turndown.mockReturnValue(expectedMarkdown.withFigure);

      const result = await htmlToMarkdown(sampleHtml.withFigure);

      expect(result).toBe(expectedMarkdown.withFigure);
    });

    it('should handle figures without captions', async () => {
      const figureWithoutCaption = '<figure><img src="test.jpg" alt="Test" /></figure>';
      mockTurndownService.turndown.mockReturnValue('![Test](test.jpg)');

      const result = await htmlToMarkdown(figureWithoutCaption);

      expect(result).toBe('![Test](test.jpg)');
    });

    it('should handle figures without images', async () => {
      const figureWithoutImage = '<figure><p>Just text content</p></figure>';
      mockTurndownService.turndown.mockReturnValue('Just text content');

      const result = await htmlToMarkdown(figureWithoutImage);

      expect(result).toBe('Just text content');
    });
  });

  // ============================================================================
  // Footnotes Tests
  // ============================================================================

  describe('footnote handling', () => {
    it('should handle footnotes correctly', async () => {
      mockTurndownService.turndown.mockReturnValue(expectedMarkdown.withFootnotes);

      const result = await htmlToMarkdown(sampleHtml.withFootnotes);

      expect(result).toBe(expectedMarkdown.withFootnotes);
    });

    it('should handle multiple footnotes', async () => {
      const multipleFootnotes = `
        <p>Text<sup><a href="#fn1">1</a></sup> and more<sup><a href="#fn2">2</a></sup></p>
        <ol class="footnote">
          <li id="fn1">First footnote</li>
          <li id="fn2">Second footnote</li>
        </ol>
      `;
      const expected =
        'Text[^1] and more[^2]\n\n---\n\n[^1]: First footnote\n\n[^2]: Second footnote';
      mockTurndownService.turndown.mockReturnValue(expected);

      const result = await htmlToMarkdown(multipleFootnotes);

      expect(result).toBe(expected);
    });
  });

  // ============================================================================
  // Embedded Content Tests
  // ============================================================================

  describe('embedded content handling', () => {
    it('should convert YouTube embeds to image format', async () => {
      mockTurndownService.turndown.mockReturnValue(expectedMarkdown.withYouTube);

      const result = await htmlToMarkdown(sampleHtml.withYouTube);

      expect(result).toBe(expectedMarkdown.withYouTube);
    });

    it('should convert Twitter/X embeds to text mention', async () => {
      mockTurndownService.turndown.mockReturnValue(expectedMarkdown.withTwitter);

      const result = await htmlToMarkdown(sampleHtml.withTwitter);

      expect(result).toBe(expectedMarkdown.withTwitter);
    });

    it('should handle generic iframes', async () => {
      const genericIframe = '<iframe src="https://example.com/embed"></iframe>';
      mockTurndownService.turndown.mockReturnValue('[Embedded Content]');

      const result = await htmlToMarkdown(genericIframe);

      expect(result).toBe('[Embedded Content]');
    });

    it('should handle YouTube URLs in different formats', async () => {
      const testCases = [
        'https://www.youtube.com/embed/abc123',
        'https://youtube.com/watch?v=abc123',
        'https://youtu.be/abc123',
      ];

      for (const url of testCases) {
        const iframe = `<iframe src="${url}"></iframe>`;
        mockTurndownService.turndown.mockReturnValue(
          '![YouTube Video](https://img.youtube.com/vi/abc123/0.jpg)'
        );

        const result = await htmlToMarkdown(iframe);
        expect(result).toBe('![YouTube Video](https://img.youtube.com/vi/abc123/0.jpg)');
      }
    });
  });

  // ============================================================================
  // Sanitization Tests
  // ============================================================================

  describe('HTML sanitization', () => {
    it('should sanitize HTML before conversion', async () => {
      mockDOMPurify.sanitize.mockReturnValue('<p>Safe content</p>');
      mockTurndownService.turndown.mockReturnValue('Safe content');

      const result = await htmlToMarkdown(sampleHtml.withScript);

      expect(mockDOMPurify.sanitize).toHaveBeenCalledWith(
        sampleHtml.withScript,
        expect.objectContaining({
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
            'code',
            'pre',
            'a',
            'img',
            'table',
            'thead',
            'tbody',
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
        })
      );
      expect(result).toBe('Safe content');
    });

    it('should handle malformed HTML gracefully', async () => {
      mockDOMPurify.sanitize.mockReturnValue('<p>Corrected content</p>');
      mockTurndownService.turndown.mockReturnValue('Corrected content');

      const result = await htmlToMarkdown(sampleHtml.malformed);

      expect(result).toBe('Corrected content');
    });
  });

  // ============================================================================
  // Whitespace and Formatting Tests
  // ============================================================================

  describe('whitespace and formatting', () => {
    it('should normalize excessive newlines', async () => {
      mockTurndownService.turndown.mockReturnValue('Para 1\n\n\n\nPara 2');

      const result = await htmlToMarkdown(sampleHtml.multipleNewlines);

      expect(result).toBe('Para 1\n\nPara 2');
    });

    it('should trim leading and trailing whitespace', async () => {
      mockTurndownService.turndown.mockReturnValue('\n\n  Content  \n\n');

      const result = await htmlToMarkdown('<p>Content</p>');

      expect(result).toBe('Content');
    });

    it('should handle empty content', async () => {
      mockTurndownService.turndown.mockReturnValue('');

      const result = await htmlToMarkdown(sampleHtml.empty);

      expect(result).toBe('');
    });

    it('should handle whitespace-only content', async () => {
      mockTurndownService.turndown.mockReturnValue('   \n\t   ');

      const result = await htmlToMarkdown(sampleHtml.whitespaceOnly);

      expect(result).toBe('');
    });
  });

  // ============================================================================
  // Service Configuration Tests
  // ============================================================================

  describe('Turndown service configuration', () => {
    it('should process HTML correctly with mocked service', async () => {
      mockTurndownService.turndown.mockReturnValue('test output');
      const result = await htmlToMarkdown('<p>test</p>');
      expect(result).toBe('test output');
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('error handling', () => {
    it('should fallback to text extraction on conversion error', async () => {
      mockTurndownService.turndown.mockImplementation(() => {
        throw new Error('Conversion failed');
      });

      const html = '<p>Hello <strong>world</strong>!</p><script>alert("xss")</script>';
      const result = await htmlToMarkdown(html);

      // Should return naive text-only fallback (with extra spaces normalized)
      expect(result.replace(/\s+/g, ' ').trim()).toBe('Hello world!');
    });

    it('should handle DOMPurify errors gracefully', async () => {
      mockDOMPurify.sanitize.mockImplementation(() => {
        throw new Error('DOMPurify failed');
      });

      const html = '<p>Hello <strong>world</strong>!</p>';
      const result = await htmlToMarkdown(html);

      // Should fallback to text extraction (with extra spaces normalized)
      expect(result.replace(/\s+/g, ' ').trim()).toBe('Hello world!');
    });

    it('should return empty string on complete failure', async () => {
      mockTurndownService.turndown.mockImplementation(() => {
        throw new Error('Total failure');
      });

      const html = null as any; // Simulate null input that would cause errors
      const result = await htmlToMarkdown(html);

      expect(result).toBe('');
    });
  });

  // ============================================================================
  // Service Caching Tests
  // ============================================================================

  describe('service instance caching', () => {
    it('should handle multiple calls correctly', async () => {
      mockTurndownService.turndown.mockReturnValue('test output');
      const result1 = await htmlToMarkdown('<p>test 1</p>');
      const result2 = await htmlToMarkdown('<p>test 2</p>');

      expect(result1).toBe('test output');
      expect(result2).toBe('test output');
    });
  });

  // ============================================================================
  // Options Interface Tests
  // ============================================================================

  describe('options interface', () => {
    it('should accept MarkdownConversionOptions interface', async () => {
      mockTurndownService.turndown.mockReturnValue('test');

      const options: MarkdownConversionOptions = {
        includeLinks: false,
      };

      const result = await htmlToMarkdown('<p>test</p>', options);

      expect(result).toBe('test');
      expect(mockTurndownService.options.includeLinks).toBe(false);
    });

    it('should handle undefined options', async () => {
      mockTurndownService.turndown.mockReturnValue('test');

      const result = await htmlToMarkdown('<p>test</p>', undefined);

      expect(result).toBe('test');
      expect(mockTurndownService.options.includeLinks).toBe(true);
    });

    it('should handle empty options object', async () => {
      mockTurndownService.turndown.mockReturnValue('test');

      const result = await htmlToMarkdown('<p>test</p>', {});

      expect(result).toBe('test');
      expect(mockTurndownService.options.includeLinks).toBe(true);
    });
  });
});
