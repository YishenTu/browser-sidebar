import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractContent } from './contentExtractor';

// Mock the extractors
vi.mock('./extractors/readability', () => ({
  extractWithReadability: vi.fn(),
}));

vi.mock('./extractors/fallback', () => ({
  extractFallbackHTML: vi.fn(),
}));

// Mock the markdown converter
vi.mock('./markdown/markdownConverter', () => ({
  htmlToMarkdown: vi.fn(),
}));

// Mock domUtils
vi.mock('./domUtils', () => ({
  getPageMetadata: vi.fn(),
  clampText: vi.fn(),
}));

// Mock performance API
let mockTime = 100;
Object.defineProperty(global, 'performance', {
  value: { now: vi.fn(() => mockTime++) },
  writable: true,
});

// Mock DOM globals
Object.defineProperty(global, 'window', {
  value: {
    location: {
      href: 'https://example.com/test',
      hostname: 'example.com',
    },
  },
  writable: true,
});

Object.defineProperty(global, 'document', {
  value: {
    body: {
      textContent: 'Fallback content',
    },
  },
  writable: true,
});

describe('extractContent', () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup default mock returns
    const { getPageMetadata, clampText } = await import('./domUtils');
    const { htmlToMarkdown } = await import('./markdown/markdownConverter');

    vi.mocked(getPageMetadata).mockReturnValue({
      title: 'Test Page',
      publishedDate: '2024-01-01',
    });

    vi.mocked(clampText).mockReturnValue({
      text: 'Test markdown content',
      isTruncated: false,
    });

    vi.mocked(htmlToMarkdown).mockResolvedValue('Test markdown content');
  });

  it('should extract content using Readability when available', async () => {
    // Mock successful Readability extraction
    const { extractWithReadability } = await import('./extractors/readability');
    vi.mocked(extractWithReadability).mockResolvedValue({
      content: '<p>Article content</p>',
      title: 'Article Title',
      byline: null,
      textContent: 'Article content',
      length: 15,
      excerpt: 'Article content',
      siteName: null,
    });

    const result = await extractContent();

    expect(result).toMatchObject({
      title: 'Test Page',
      url: 'https://example.com/test',
      domain: 'example.com',
      markdown: 'Test markdown content',
      extractionMethod: 'readability',
      hasCode: false,
      hasTables: false,
      isTruncated: false,
    });

    expect(extractWithReadability).toHaveBeenCalled();
    expect(result.extractionTime).toBeGreaterThan(0);
  });

  it('should fall back to heuristic extraction when Readability fails', async () => {
    // Mock Readability failure
    const { extractWithReadability } = await import('./extractors/readability');
    const { extractFallbackHTML } = await import('./extractors/fallback');

    vi.mocked(extractWithReadability).mockResolvedValue(null);
    vi.mocked(extractFallbackHTML).mockReturnValue({
      content: '<div>Fallback content</div>',
      textContent: 'Fallback content',
      method: 'scored',
      isTruncated: false,
    });

    const result = await extractContent();

    expect(result.extractionMethod).toBe('fallback');
    expect(extractWithReadability).toHaveBeenCalled();
    expect(extractFallbackHTML).toHaveBeenCalled();
  });

  it('should detect code blocks in markdown', async () => {
    const { extractWithReadability } = await import('./extractors/readability');
    const { htmlToMarkdown } = await import('./markdown/markdownConverter');

    vi.mocked(extractWithReadability).mockResolvedValue({
      content: '<p>Some content</p>',
      title: 'Test',
      byline: null,
      textContent: 'Some content',
      length: 12,
      excerpt: 'Some content',
      siteName: null,
    });

    vi.mocked(htmlToMarkdown).mockResolvedValue(
      'Some content with\n```javascript\ncode\n```\nblocks'
    );

    const result = await extractContent();

    expect(result.hasCode).toBe(true);
  });

  it('should detect tables in markdown', async () => {
    const { extractWithReadability } = await import('./extractors/readability');
    const { htmlToMarkdown } = await import('./markdown/markdownConverter');

    vi.mocked(extractWithReadability).mockResolvedValue({
      content: '<p>Some content</p>',
      title: 'Test',
      byline: null,
      textContent: 'Some content',
      length: 12,
      excerpt: 'Some content',
      siteName: null,
    });

    vi.mocked(htmlToMarkdown).mockResolvedValue(
      '| Header 1 | Header 2 |\n|----------|----------|\n| Cell 1   | Cell 2   |'
    );

    const result = await extractContent();

    expect(result.hasTables).toBe(true);
  });

  it('should respect timeout option', async () => {
    const { extractWithReadability } = await import('./extractors/readability');

    // Mock a slow extraction
    vi.mocked(extractWithReadability).mockImplementation(
      () =>
        new Promise(resolve =>
          setTimeout(
            () =>
              resolve({
                content: 'content',
                title: 'Test',
                byline: null,
                textContent: 'content',
                length: 7,
                excerpt: 'content',
                siteName: null,
              }),
            100
          )
        )
    );

    const result = await extractContent({ timeout: 50 });

    // Should return 'failed' status due to timeout
    expect(result.extractionMethod).toBe('failed');
    expect(result.content).toBeTruthy(); // Should have some fallback content
    expect(result.textContent).toBeTruthy(); // Should have text content
  });

  it('should pass includeLinks option to markdown converter', async () => {
    const { extractWithReadability } = await import('./extractors/readability');
    const { htmlToMarkdown } = await import('./markdown/markdownConverter');

    vi.mocked(extractWithReadability).mockResolvedValue({
      content: '<p>Content with <a href="http://example.com">link</a></p>',
      title: 'Test',
      byline: null,
      textContent: 'Content with link',
      length: 17,
      excerpt: 'Content with link',
      siteName: null,
    });

    await extractContent({ includeLinks: false });

    expect(htmlToMarkdown).toHaveBeenCalledWith(
      '<p>Content with <a href="http://example.com">link</a></p>',
      { includeLinks: false }
    );
  });

  it('should handle extraction errors gracefully', async () => {
    const { extractWithReadability } = await import('./extractors/readability');
    const { extractFallbackHTML } = await import('./extractors/fallback');

    // Mock both extractors failing
    vi.mocked(extractWithReadability).mockRejectedValue(new Error('Readability failed'));
    vi.mocked(extractFallbackHTML).mockImplementation(() => {
      throw new Error('Fallback failed');
    });

    const result = await extractContent();

    // Should return fallback content with minimal data
    expect(result).toMatchObject({
      title: 'Test Page',
      url: 'https://example.com/test',
      domain: 'example.com',
      extractionMethod: 'fallback',
      hasCode: false,
      hasTables: false,
    });
  });

  it('should count words correctly', async () => {
    const { extractWithReadability } = await import('./extractors/readability');
    const { htmlToMarkdown } = await import('./markdown/markdownConverter');
    const { clampText } = await import('./domUtils');

    vi.mocked(extractWithReadability).mockResolvedValue({
      content: '<p>Test content</p>',
      title: 'Test',
      byline: null,
      textContent: 'Test content',
      length: 12,
      excerpt: 'Test content',
      siteName: null,
    });

    vi.mocked(htmlToMarkdown).mockResolvedValue(
      'This is a test with **bold** text and [link](http://example.com).'
    );
    vi.mocked(clampText).mockReturnValue({
      text: 'This is a test with **bold** text and [link](http://example.com).',
      isTruncated: false,
    });

    const result = await extractContent();

    // Should count: "This", "is", "a", "test", "with", "bold", "text", "and", "link" = 9 words
    // (after cleaning markdown syntax)
    expect(result.wordCount).toBe(9);
  });

  it('should use DOM-derived textContent and respect timeoutMs in fallback', async () => {
    const { extractWithReadability } = await import('./extractors/readability');
    const { extractFallbackHTML } = await import('./extractors/fallback');

    // Mock Readability returning null (not an article)
    vi.mocked(extractWithReadability).mockResolvedValue(null);

    // Mock fallback with distinct HTML and text content
    vi.mocked(extractFallbackHTML).mockReturnValue({
      content:
        '<div class="content"><h1>Title</h1><p>This is <strong>bold</strong> text.</p></div>',
      textContent: 'Title This is bold text.', // Plain text without HTML tags
      method: 'main',
      isTruncated: false,
    });

    const customTimeout = 3000;
    const result = await extractContent({ timeout: customTimeout });

    // Should use fallback method
    expect(result.extractionMethod).toBe('fallback');

    // textContent should be the DOM-derived text, not markdown-stripped
    expect(result.textContent).toContain('Title This is bold text.');
    expect(result.textContent).not.toContain('<div>');
    expect(result.textContent).not.toContain('<strong>');

    // Metadata should include the actual timeout used
    expect(result.metadata?.timeoutMs).toBe(customTimeout);
  });

  it('should use Readability textContent when available', async () => {
    const { extractWithReadability } = await import('./extractors/readability');

    // Mock Readability with distinct HTML and text content
    vi.mocked(extractWithReadability).mockResolvedValue({
      content:
        '<article><h1>Article Title</h1><p>This has <em>emphasis</em> and <a href="#">links</a>.</p></article>',
      title: 'Article Title',
      byline: 'John Doe',
      textContent: 'Article Title\nThis has emphasis and links.', // Readability's plain text
      length: 43,
      excerpt: 'This has emphasis and links.',
      siteName: null,
    });

    const result = await extractContent();

    // Should use readability method
    expect(result.extractionMethod).toBe('readability');

    // textContent should be from Readability, not markdown-stripped
    expect(result.textContent).toBe('Article Title\nThis has emphasis and links.');
    expect(result.textContent).not.toContain('<');
    expect(result.textContent).not.toContain('>');

    // Author should be from Readability byline
    expect(result.author).toBe('John Doe');
  });

  it('should generate excerpt correctly', async () => {
    const { extractWithReadability } = await import('./extractors/readability');
    const { htmlToMarkdown } = await import('./markdown/markdownConverter');
    const { clampText } = await import('./domUtils');

    const longContent =
      'This is a very long piece of content that should be truncated to create an excerpt. '.repeat(
        10
      );

    vi.mocked(extractWithReadability).mockResolvedValue({
      content: '<p>Long content</p>',
      title: 'Test',
      byline: null,
      textContent: 'Long content',
      length: 12,
      excerpt: 'Long content',
      siteName: null,
    });

    vi.mocked(htmlToMarkdown).mockResolvedValue(longContent);
    vi.mocked(clampText).mockReturnValue({
      text: longContent,
      isTruncated: false,
    });

    const result = await extractContent();

    expect(result.excerpt!.length).toBeLessThanOrEqual(203); // 200 chars + "..."
    expect(result.excerpt).toMatch(/\.\.\.$/); // Should end with "..."
  });
});
