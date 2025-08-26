/**
 * @file Unit tests for Fallback Content Extractor
 *
 * Tests the heuristic content extractor including element selection strategies,
 * scoring algorithm, visibility checking, content cleaning, and budget enforcement.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import {
  extractFallbackHTMLFrom,
  type FallbackResult,
} from '../../../src/tabext/extractors/fallback';
import { isVisible } from '../../../src/tabext/domUtils';

// Mock the isVisible function from domUtils
vi.mock('../../../src/tabext/domUtils', () => ({
  isVisible: vi.fn(),
}));

describe('extractFallbackHTMLFrom', () => {
  let dom: JSDOM;
  let document: Document;

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    // Default isVisible to return true unless specified otherwise
    vi.mocked(isVisible).mockReturnValue(true);
  });

  /**
   * Helper to create a JSDOM document with given HTML
   */
  function createDocument(html: string): Document {
    dom = new JSDOM(html);
    return dom.window.document;
  }

  describe('Strategy 1: Main Element Selection', () => {
    it('should prioritize main element when visible', () => {
      document = createDocument(`
        <!DOCTYPE html>
        <html>
          <body>
            <main>
              <h1>Main Content Title</h1>
              <p>This is the main content paragraph.</p>
            </main>
            <div>
              <p>Other content outside main.</p>
            </div>
          </body>
        </html>
      `);

      const result = extractFallbackHTMLFrom(document);

      expect(result.method).toBe('main');
      expect(result.content).toContain('Main Content Title');
      expect(result.content).toContain('main content paragraph');
      expect(result.isTruncated).toBe(false);
    });

    it('should skip main element when not visible', () => {
      document = createDocument(`
        <!DOCTYPE html>
        <html>
          <body>
            <main style="display: none">
              <h1>Hidden Main</h1>
            </main>
            <article>
              <h1>Article Title</h1>
              <p>Article content that is visible.</p>
            </article>
          </body>
        </html>
      `);

      // Main is not visible, article is visible
      vi.mocked(isVisible).mockImplementation(element => {
        const el = element as HTMLElement;
        return !el.tagName || el.tagName.toLowerCase() !== 'main';
      });

      const result = extractFallbackHTMLFrom(document);

      expect(result.method).toBe('article');
      expect(result.content).toContain('Article Title');
      expect(result.content).not.toContain('Hidden Main');
    });
  });

  describe('Strategy 2: Article Element Selection', () => {
    it('should select longest visible article element', () => {
      document = createDocument(`
        <!DOCTYPE html>
        <html>
          <body>
            <article>
              <h1>Short Article</h1>
              <p>Brief content.</p>
            </article>
            <article>
              <h1>Long Article</h1>
              <p>This is a much longer article with more content.</p>
              <p>It has multiple paragraphs and more text overall.</p>
              <p>Therefore it should be selected as the best article.</p>
            </article>
          </body>
        </html>
      `);

      const result = extractFallbackHTMLFrom(document);

      expect(result.method).toBe('article');
      expect(result.content).toContain('Long Article');
      expect(result.content).toContain('multiple paragraphs');
    });

    it('should skip hidden article elements', () => {
      document = createDocument(`
        <!DOCTYPE html>
        <html>
          <body>
            <article aria-hidden="true">
              <h1>Hidden Article</h1>
              <p>This should not be extracted.</p>
            </article>
            <article>
              <h1>Visible Article</h1>
              <p>This should be extracted.</p>
            </article>
          </body>
        </html>
      `);

      // Mock visibility check
      vi.mocked(isVisible).mockImplementation(element => {
        const el = element as HTMLElement;
        return el.getAttribute('aria-hidden') !== 'true';
      });

      const result = extractFallbackHTMLFrom(document);

      expect(result.method).toBe('article');
      expect(result.content).toContain('Visible Article');
      expect(result.content).not.toContain('Hidden Article');
    });
  });

  describe('Strategy 3: Scored Element Selection', () => {
    it('should use scoring algorithm when main and article strategies fail', () => {
      document = createDocument(`
        <!DOCTYPE html>
        <html>
          <body>
            <div>
              <h1>High Score Content</h1>
              <h2>Section 1</h2>
              <p>Paragraph 1 with content.</p>
              <h2>Section 2</h2>
              <p>Paragraph 2 with content.</p>
              <h3>Subsection</h3>
              <p>More detailed content here.</p>
            </div>
            <div>
              <p>Low score content with just one paragraph.</p>
            </div>
          </body>
        </html>
      `);

      const result = extractFallbackHTMLFrom(document);

      expect(result.method).toBe('scored');
      expect(result.content).toContain('High Score Content');
      expect(result.content).toContain('Section 1');
      expect(result.content).toContain('Section 2');
    });

    it('should calculate content scores correctly', () => {
      document = createDocument(`
        <!DOCTYPE html>
        <html>
          <body>
            <div id="low-score">
              <p>Just one paragraph.</p>
            </div>
            <div id="high-score">
              <h1>Title</h1>
              <h2>Subtitle 1</h2>
              <h2>Subtitle 2</h2>
              <h3>Sub-subtitle 1</h3>
              <h3>Sub-subtitle 2</h3>
              <p>Paragraph 1</p>
              <p>Paragraph 2</p>
              <p>Paragraph 3</p>
              <p>This div should have higher score due to multiple headings and paragraphs.</p>
            </div>
          </body>
        </html>
      `);

      const result = extractFallbackHTMLFrom(document);

      // Should select the high-score div
      expect(result.method).toBe('scored');
      expect(result.content).toContain('Title');
      expect(result.content).toContain('Subtitle 1');
      expect(result.content).toContain('Paragraph 3');
    });
  });

  describe('Content Cleaning', () => {
    it('should remove script and style elements', () => {
      document = createDocument(`
        <!DOCTYPE html>
        <html>
          <body>
            <main>
              <h1>Clean Title</h1>
              <script>alert('This should be removed');</script>
              <p>Clean content paragraph.</p>
              <style>body { color: red; }</style>
              <p>More clean content.</p>
            </main>
          </body>
        </html>
      `);

      const result = extractFallbackHTMLFrom(document);

      expect(result.content).toContain('Clean Title');
      expect(result.content).toContain('Clean content paragraph');
      expect(result.content).not.toContain('alert(');
      expect(result.content).not.toContain('color: red');
    });

    it('should remove hidden elements by attributes', () => {
      document = createDocument(`
        <!DOCTYPE html>
        <html>
          <body>
            <main>
              <h1>Visible Title</h1>
              <div hidden>Hidden by attribute</div>
              <p>Visible paragraph.</p>
              <div aria-hidden="true">Hidden by aria</div>
              <p>Another visible paragraph.</p>
              <div style="display: none">Hidden by style</div>
            </main>
          </body>
        </html>
      `);

      const result = extractFallbackHTMLFrom(document);

      expect(result.content).toContain('Visible Title');
      expect(result.content).toContain('Visible paragraph');
      expect(result.content).toContain('Another visible paragraph');
      expect(result.content).not.toContain('Hidden by attribute');
      expect(result.content).not.toContain('Hidden by aria');
      expect(result.content).not.toContain('Hidden by style');
    });
  });

  describe('Budget Enforcement', () => {
    it('should enforce character budget', () => {
      const longContent = 'This is a test paragraph. '.repeat(100);
      document = createDocument(`
        <!DOCTYPE html>
        <html>
          <body>
            <main>
              <h1>Title</h1>
              <p>${longContent}</p>
            </main>
          </body>
        </html>
      `);

      const result = extractFallbackHTMLFrom(document, 100); // 100 char budget

      expect(result.isTruncated).toBe(true);
      expect(result.content.length).toBeLessThanOrEqual(200); // Some overhead for HTML tags
      expect(result.textContent.length).toBeLessThanOrEqual(103); // 100 + "..."
    });

    it('should not truncate content within budget', () => {
      document = createDocument(`
        <!DOCTYPE html>
        <html>
          <body>
            <main>
              <h1>Short Title</h1>
              <p>Short content.</p>
            </main>
          </body>
        </html>
      `);

      const result = extractFallbackHTMLFrom(document, 10000); // Large budget

      expect(result.isTruncated).toBe(false);
      expect(result.content).toContain('Short Title');
      expect(result.content).toContain('Short content');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty document', () => {
      document = createDocument(`
        <!DOCTYPE html>
        <html>
          <head><title>Empty Page</title></head>
          <body></body>
        </html>
      `);

      const result = extractFallbackHTMLFrom(document);

      expect(result.content).toBe('Empty Page');
      expect(result.textContent).toBe('Empty Page');
      expect(result.method).toBe('scored');
    });

    it('should handle document with only hidden content', () => {
      document = createDocument(`
        <!DOCTYPE html>
        <html>
          <head><title>All Hidden</title></head>
          <body>
            <div style="display: none">Hidden content</div>
            <div aria-hidden="true">More hidden content</div>
          </body>
        </html>
      `);

      // Mock all elements as not visible
      vi.mocked(isVisible).mockReturnValue(false);

      const result = extractFallbackHTMLFrom(document);

      expect(result.content).toBe('All Hidden');
      expect(result.textContent).toBe('All Hidden');
      expect(result.method).toBe('scored');
    });

    it('should handle extraction errors gracefully', () => {
      document = createDocument(`
        <!DOCTYPE html>
        <html>
          <head><title>Error Test</title></head>
          <body>
            <main>Content</main>
          </body>
        </html>
      `);

      // Mock isVisible to throw an error
      vi.mocked(isVisible).mockImplementation(() => {
        throw new Error('Visibility check failed');
      });

      const result = extractFallbackHTMLFrom(document);

      // Should fall back to title
      expect(result.content).toBe('Error Test');
      expect(result.method).toBe('scored');
    });
  });

  describe('Real-world HTML Fixtures', () => {
    it('should extract news article content', () => {
      document = createDocument(`
        <!DOCTYPE html>
        <html>
          <body>
            <header>Navigation</header>
            <main>
              <article>
                <h1>Breaking News: Major Discovery</h1>
                <div class="byline">By John Doe | January 15, 2024</div>
                <div class="article-content">
                  <p class="lead">Scientists have made a groundbreaking discovery.</p>
                  <p>The discovery was made at a research facility...</p>
                  <h2>Background</h2>
                  <p>Previous research had suggested...</p>
                  <h2>Implications</h2>
                  <p>This finding could revolutionize...</p>
                </div>
              </article>
            </main>
            <footer>Copyright 2024</footer>
          </body>
        </html>
      `);

      const result = extractFallbackHTMLFrom(document);

      expect(result.method).toBe('main');
      expect(result.content).toContain('Breaking News');
      expect(result.content).toContain('groundbreaking discovery');
      expect(result.content).toContain('Background');
      expect(result.content).not.toContain('Navigation');
      expect(result.content).not.toContain('Copyright 2024');
    });

    it('should extract blog post content', () => {
      document = createDocument(`
        <!DOCTYPE html>
        <html>
          <body>
            <div class="container">
              <article class="blog-post">
                <header>
                  <h1>How to Build Better Software</h1>
                  <time>March 10, 2024</time>
                </header>
                <div class="post-content">
                  <p>In this post, we'll explore best practices...</p>
                  <h2>1. Planning</h2>
                  <p>Good software starts with good planning...</p>
                  <pre><code>const example = "code";</code></pre>
                  <h2>2. Implementation</h2>
                  <p>When implementing, consider...</p>
                </div>
              </article>
              <aside>Related posts...</aside>
            </div>
          </body>
        </html>
      `);

      const result = extractFallbackHTMLFrom(document);

      expect(result.method).toBe('article');
      expect(result.content).toContain('How to Build Better Software');
      expect(result.content).toContain('Planning');
      expect(result.content).toContain('const example');
      expect(result.content).not.toContain('Related posts');
    });
  });

  describe('Performance', () => {
    it('should complete extraction within reasonable time', () => {
      const largeContent = Array.from(
        { length: 100 },
        (_, i) => `<div><h2>Section ${i}</h2><p>Content for section ${i}</p></div>`
      ).join('');

      document = createDocument(`
        <!DOCTYPE html>
        <html>
          <body>
            <main>${largeContent}</main>
          </body>
        </html>
      `);

      const startTime = performance.now();
      const result = extractFallbackHTMLFrom(document);
      const elapsed = performance.now() - startTime;

      expect(result.method).toBe('main');
      expect(elapsed).toBeLessThan(500); // Should complete within 500ms
    });
  });
});
