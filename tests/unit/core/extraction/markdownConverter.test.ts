/**
 * @file Markdown Converter Tests
 *
 * Tests for HTML to Markdown conversion functionality.
 */

import { describe, it, expect } from 'vitest';
import { htmlToMarkdown } from '@core/extraction/markdownConverter';

describe('htmlToMarkdown', () => {
  describe('basic HTML conversion', () => {
    it('should convert simple paragraph', async () => {
      const html = '<p>Hello, world!</p>';
      const result = await htmlToMarkdown(html);

      expect(result).toBe('Hello, world!');
    });

    it('should convert multiple paragraphs', async () => {
      const html = '<p>First paragraph</p><p>Second paragraph</p>';
      const result = await htmlToMarkdown(html);

      expect(result).toContain('First paragraph');
      expect(result).toContain('Second paragraph');
    });

    it('should convert headings', async () => {
      const html = '<h1>Title</h1><h2>Subtitle</h2><h3>Section</h3>';
      const result = await htmlToMarkdown(html);

      expect(result).toContain('# Title');
      expect(result).toContain('## Subtitle');
      expect(result).toContain('### Section');
    });

    it('should convert bold and italic', async () => {
      const html = '<p><strong>Bold</strong> and <em>italic</em></p>';
      const result = await htmlToMarkdown(html);

      expect(result).toContain('**Bold**');
      expect(result).toContain('*italic*');
    });

    it('should convert lists', async () => {
      const html = '<ul><li>Item 1</li><li>Item 2</li></ul>';
      const result = await htmlToMarkdown(html);

      // Turndown may add extra spaces after the dash
      expect(result).toMatch(/-\s+Item 1/);
      expect(result).toMatch(/-\s+Item 2/);
    });

    it('should convert ordered lists', async () => {
      const html = '<ol><li>First</li><li>Second</li></ol>';
      const result = await htmlToMarkdown(html);

      expect(result).toContain('1.');
      expect(result).toContain('First');
    });

    it('should convert blockquotes', async () => {
      const html = '<blockquote>A quote</blockquote>';
      const result = await htmlToMarkdown(html);

      expect(result).toContain('> A quote');
    });
  });

  describe('code fence language extraction', () => {
    it('should extract language from class language-*', async () => {
      const html = '<pre><code class="language-javascript">const x = 1;</code></pre>';
      const result = await htmlToMarkdown(html);

      expect(result).toContain('```javascript');
      expect(result).toContain('const x = 1;');
      expect(result).toContain('```');
    });

    it('should extract language from class lang-*', async () => {
      const html = '<pre><code class="lang-python">print("hello")</code></pre>';
      const result = await htmlToMarkdown(html);

      expect(result).toContain('```python');
      expect(result).toContain('print("hello")');
    });

    it('should handle code block without language class', async () => {
      const html = '<pre><code>some code</code></pre>';
      const result = await htmlToMarkdown(html);

      expect(result).toContain('```');
      expect(result).toContain('some code');
    });

    it('should handle pre without code element', async () => {
      const html = '<pre>preformatted text</pre>';
      const result = await htmlToMarkdown(html);

      expect(result).toContain('```');
      expect(result).toContain('preformatted text');
    });
  });

  describe('link handling', () => {
    it('should include links by default', async () => {
      const html = '<a href="https://example.com">Link text</a>';
      const result = await htmlToMarkdown(html);

      expect(result).toContain('[Link text](https://example.com)');
    });

    it('should include link with title', async () => {
      const html = '<a href="https://example.com" title="Example">Link</a>';
      const result = await htmlToMarkdown(html);

      expect(result).toContain('https://example.com');
      expect(result).toContain('Link');
    });

    it('should strip links when includeLinks is false', async () => {
      const html = '<a href="https://example.com">Link text</a>';
      const result = await htmlToMarkdown(html, { includeLinks: false });

      expect(result).toBe('Link text');
      expect(result).not.toContain('https://example.com');
      expect(result).not.toContain('[');
      expect(result).not.toContain(']');
    });

    it('should preserve images inside links when includeLinks is false', async () => {
      const html = '<a href="https://example.com"><img src="image.jpg" alt="Image"></a>';
      const result = await htmlToMarkdown(html, { includeLinks: false });

      expect(result).toContain('![Image](image.jpg)');
    });
  });

  describe('image handling', () => {
    it('should convert images', async () => {
      const html = '<img src="https://example.com/image.jpg" alt="An image">';
      const result = await htmlToMarkdown(html);

      expect(result).toContain('![An image](https://example.com/image.jpg)');
    });

    it('should handle images without alt text', async () => {
      const html = '<img src="https://example.com/image.jpg">';
      const result = await htmlToMarkdown(html);

      expect(result).toContain('image.jpg');
    });
  });

  describe('table conversion', () => {
    it('should convert simple tables', async () => {
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
      expect(result).toContain('|');
    });
  });

  describe('footnote handling', () => {
    it('should preserve footnote reference content', async () => {
      // DOMPurify sanitizes sup elements, so we test the text is preserved
      const html = '<p>Text<sup><a href="#fn1">1</a></sup></p>';
      const result = await htmlToMarkdown(html);

      expect(result).toContain('Text');
      // The footnote marker is preserved as link text
      expect(result).toContain('1');
    });

    it('should preserve footnote content', async () => {
      // DOMPurify allows ol/li, content is preserved
      const html = '<ol class="footnotes"><li id="fn1">Footnote content</li></ol>';
      const result = await htmlToMarkdown(html);

      expect(result).toContain('Footnote content');
    });
  });

  describe('embed handling', () => {
    // Note: DOMPurify strips iframe elements by default for security.
    // The embed handling rules are defined but won't trigger after sanitization.
    // These tests verify the fallback behavior.

    it('should return empty for YouTube embeds (stripped by sanitizer)', async () => {
      const html = '<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>';
      const result = await htmlToMarkdown(html);

      // iframe is stripped by DOMPurify for security
      expect(result).toBe('');
    });

    it('should return empty for Twitter/X embeds (stripped by sanitizer)', async () => {
      const html = '<iframe src="https://twitter.com/user/status/123456789"></iframe>';
      const result = await htmlToMarkdown(html);

      // iframe is stripped by DOMPurify for security
      expect(result).toBe('');
    });

    it('should return empty for generic embeds (stripped by sanitizer)', async () => {
      const html = '<iframe src="https://example.com/embed"></iframe>';
      const result = await htmlToMarkdown(html);

      // iframe is stripped by DOMPurify for security
      expect(result).toBe('');
    });
  });

  describe('sanitization', () => {
    it('should remove script tags', async () => {
      const html = '<p>Text</p><script>alert("xss")</script>';
      const result = await htmlToMarkdown(html);

      expect(result).toBe('Text');
      expect(result).not.toContain('script');
      expect(result).not.toContain('alert');
    });

    it('should remove style tags', async () => {
      const html = '<p>Text</p><style>.x{color:red}</style>';
      const result = await htmlToMarkdown(html);

      expect(result).toBe('Text');
      expect(result).not.toContain('style');
      expect(result).not.toContain('color');
    });

    it('should remove button tags but preserve text content', async () => {
      const html = '<p>Text</p><button>Click me</button>';
      const result = await htmlToMarkdown(html);

      // DOMPurify strips button tags but KEEP_CONTENT preserves inner text
      expect(result).toContain('Text');
      expect(result).not.toContain('<button>');
    });
  });

  describe('whitespace normalization', () => {
    it('should collapse multiple newlines', async () => {
      const html = '<p>First</p>\n\n\n\n<p>Second</p>';
      const result = await htmlToMarkdown(html);

      // Should not have more than 2 consecutive newlines
      expect(result).not.toMatch(/\n{3,}/);
    });

    it('should remove leading newlines', async () => {
      const html = '\n\n<p>Text</p>';
      const result = await htmlToMarkdown(html);

      expect(result).not.toMatch(/^\n/);
    });

    it('should remove trailing newlines', async () => {
      const html = '<p>Text</p>\n\n';
      const result = await htmlToMarkdown(html);

      expect(result).not.toMatch(/\n$/);
    });
  });

  describe('exception fallback path', () => {
    it('should return empty string for empty input', async () => {
      const result = await htmlToMarkdown('');

      expect(result).toBe('');
    });

    it('should handle plain text without HTML', async () => {
      const result = await htmlToMarkdown('Just some text');

      expect(result).toBe('Just some text');
    });
  });
});
