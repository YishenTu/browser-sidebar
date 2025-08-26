import { describe, it, expect, vi } from 'vitest';
import { htmlToMarkdown } from './markdownConverter';

// Mock DOMPurify for testing
vi.mock('dompurify', () => ({
  default: {
    sanitize: vi.fn((html: string) => html), // Return the input HTML as-is for tests
  },
}));

describe('htmlToMarkdown', () => {
  it('should convert basic HTML to Markdown', async () => {
    const html =
      '<h1>Title</h1><p>This is a paragraph with <strong>bold</strong> and <em>italic</em> text.</p>';
    const result = await htmlToMarkdown(html);

    expect(result).toContain('# Title');
    expect(result).toContain('**bold**');
    expect(result).toContain('*italic*');
  });

  it('should handle code blocks with language detection', async () => {
    const html = '<pre><code class="language-javascript">const x = 5;</code></pre>';
    const result = await htmlToMarkdown(html);

    expect(result).toContain('```javascript');
    expect(result).toContain('const x = 5;');
    expect(result).toContain('```');
  });

  it('should handle code blocks without language', async () => {
    const html = '<pre><code>const x = 5;</code></pre>';
    const result = await htmlToMarkdown(html);

    expect(result).toContain('```\nconst x = 5;\n```');
  });

  it('should include links by default', async () => {
    const html =
      '<p>Visit <a href="https://example.com" title="Example">Example</a> for more info.</p>';
    const result = await htmlToMarkdown(html);

    expect(result).toContain('[Example](https://example.com "Example")');
  });

  it('should strip links when includeLinks is false', async () => {
    const html = '<p>Visit <a href="https://example.com">Example</a> for more info.</p>';
    const result = await htmlToMarkdown(html, { includeLinks: false });

    expect(result).toContain('Visit Example for more info.');
    expect(result).not.toContain('[Example]');
    expect(result).not.toContain('https://example.com');
  });

  it('should handle lists correctly', async () => {
    const html = '<ul><li>Item 1</li><li>Item 2</li></ul>';
    const result = await htmlToMarkdown(html);

    expect(result).toContain('Item 1');
    expect(result).toContain('Item 2');
    expect(result).toContain('-');
  });

  it('should handle tables', async () => {
    const html =
      '<table><thead><tr><th>Header 1</th><th>Header 2</th></tr></thead><tbody><tr><td>Cell 1</td><td>Cell 2</td></tr></tbody></table>';
    const result = await htmlToMarkdown(html);

    expect(result).toContain('Header 1');
    expect(result).toContain('Header 2');
    expect(result).toContain('Cell 1');
    expect(result).toContain('Cell 2');
  });

  it('should handle empty or invalid HTML gracefully', async () => {
    const emptyResult = await htmlToMarkdown('');
    expect(emptyResult).toBe('');

    const invalidResult = await htmlToMarkdown('<invalid>content</invalid>');
    expect(typeof invalidResult).toBe('string');
  });

  it('should clean up excessive whitespace', async () => {
    const html = '<p>Paragraph 1</p>\n\n\n\n<p>Paragraph 2</p>';
    const result = await htmlToMarkdown(html);

    // Should not have more than 2 consecutive newlines
    expect(result).not.toMatch(/\n{3,}/);
  });
});
