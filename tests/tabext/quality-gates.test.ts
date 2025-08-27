import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scoreContentQuality } from '@tabext/contentQuality';
import type { ExtractedContent } from '@/types/extraction';

describe('Quality Gates', () => {
  // Helper to create test content
  function createTestContent(overrides: Partial<ExtractedContent> = {}): ExtractedContent {
    return {
      title: 'Test Article',
      url: 'https://example.com/article',
      domain: 'example.com',
      content: '<p>Test content</p>',
      textContent: 'Test content',
      extractedAt: Date.now(),
      extractionMethod: 'defuddle',
      metadata: {
        wordCount: 100,
        hasCodeBlocks: false,
        hasTables: false,
        truncated: false,
      },
      ...overrides,
    } as ExtractedContent;
  }

  describe('scoreContentQuality', () => {
    it('should score high-quality defuddle content higher than basic content', () => {
      // High-quality defuddle content with good structure
      const defuddleContent = createTestContent({
        content: `
          <article>
            <h1>Main Title</h1>
            <h2>Section 1</h2>
            <p>Content with multiple paragraphs...</p>
            <h2>Section 2</h2>
            <p>More content here...</p>
            <h3>Subsection</h3>
            <p>Even more content...</p>
          </article>
        `,
        textContent: 'Main Title Section 1 Content with multiple paragraphs... Section 2 More content here... Subsection Even more content...',
        extractionMethod: 'defuddle',
        metadata: {
          wordCount: 300,
          hasCodeBlocks: false,
          hasTables: false,
          truncated: false,
        },
      });

      // Basic readability content
      const readabilityContent = createTestContent({
        content: '<p>Simple content without much structure</p>',
        textContent: 'Simple content without much structure',
        extractionMethod: 'readability',
        metadata: {
          wordCount: 50,
          hasCodeBlocks: false,
          hasTables: false,
          truncated: false,
        },
      });

      const defuddleScore = scoreContentQuality(defuddleContent);
      const readabilityScore = scoreContentQuality(readabilityContent);

      expect(defuddleScore.score).toBeGreaterThan(readabilityScore.score);
      expect(defuddleScore.confidence).toBeGreaterThan(readabilityScore.confidence);
    });

    it('should prefer defuddle for well-structured articles', () => {
      // Defuddle with good article structure
      const defuddleArticle = createTestContent({
        content: `
          <article>
            <h1>Article Title</h1>
            <h2>Introduction</h2>
            <p>${'Long paragraph content. '.repeat(20)}</p>
            <h2>Main Section</h2>
            <p>${'Another paragraph. '.repeat(20)}</p>
            <h2>Conclusion</h2>
            <p>${'Final thoughts. '.repeat(10)}</p>
          </article>
        `,
        textContent: 'Article Title Introduction ' + 'Long paragraph content. '.repeat(20) + 
                      'Main Section ' + 'Another paragraph. '.repeat(20) + 
                      'Conclusion ' + 'Final thoughts. '.repeat(10),
        extractionMethod: 'defuddle',
        metadata: {
          wordCount: 500,
          hasCodeBlocks: false,
          hasTables: false,
          truncated: false,
        },
      });

      // Readability with similar content but less structure
      const readabilityArticle = createTestContent({
        content: `<div>${'Long paragraph content. '.repeat(50)}</div>`,
        textContent: 'Long paragraph content. '.repeat(50),
        extractionMethod: 'readability',
        metadata: {
          wordCount: 500,
          hasCodeBlocks: false,
          hasTables: false,
          truncated: false,
        },
      });

      const defuddleScore = scoreContentQuality(defuddleArticle);
      const readabilityScore = scoreContentQuality(readabilityArticle);

      // Defuddle should win due to better structure despite same word count
      expect(defuddleScore.score).toBeGreaterThan(readabilityScore.score);
      expect(defuddleScore.metrics.headingCount).toBeGreaterThan(0);
      expect(readabilityScore.metrics.headingCount).toBe(0);
    });

    it('should prefer readability when defuddle returns minimal content', () => {
      // Defuddle with minimal content
      const defuddleMinimal = createTestContent({
        content: '<p>Short</p>',
        textContent: 'Short',
        extractionMethod: 'defuddle',
        metadata: {
          wordCount: 1,
          hasCodeBlocks: false,
          hasTables: false,
          truncated: false,
        },
      });

      // Readability with substantial content
      const readabilitySubstantial = createTestContent({
        content: `<article><h1>Title</h1><p>${'Good content here. '.repeat(30)}</p></article>`,
        textContent: 'Title ' + 'Good content here. '.repeat(30),
        extractionMethod: 'readability',
        metadata: {
          wordCount: 200,
          hasCodeBlocks: false,
          hasTables: false,
          truncated: false,
        },
      });

      const defuddleScore = scoreContentQuality(defuddleMinimal);
      const readabilityScore = scoreContentQuality(readabilitySubstantial);

      // Readability should win due to more substantial content
      expect(readabilityScore.score).toBeGreaterThan(defuddleScore.score);
    });

    it('should handle code blocks and tables in scoring', () => {
      const technicalContent = createTestContent({
        content: `
          <article>
            <h1>Technical Guide</h1>
            <pre><code>function example() { return true; }</code></pre>
            <table><tr><th>Header</th></tr><tr><td>Data</td></tr></table>
            <p>Explanation text</p>
          </article>
        `,
        textContent: 'Technical Guide function example() { return true; } Header Data Explanation text',
        metadata: {
          wordCount: 150,
          hasCodeBlocks: true,
          hasTables: true,
          truncated: false,
        },
      });

      const score = scoreContentQuality(technicalContent);

      // Should recognize technical content
      expect(score.metrics.hasCode).toBe(true);
      expect(score.metrics.hasTables).toBe(true);
      expect(score.confidence).toBeGreaterThan(0.5); // Technical content should have decent confidence
    });
  });

  describe('Quality Gate Decision Making', () => {
    it('should choose defuddle over readability for high-quality articles', async () => {
      // Mock both extractors
      vi.mock('@tabext/extractors/defuddle', () => ({
        extractWithDefuddle: vi.fn().mockResolvedValue({
          title: 'High Quality Article',
          content: '<article><h1>Title</h1><h2>Section</h2><p>Rich content...</p></article>',
          textContent: 'Title Section Rich content...',
          extractionMethod: 'defuddle',
          metadata: { wordCount: 200, hasCodeBlocks: false, hasTables: false },
        }),
      }));

      vi.mock('@tabext/extractors/readability', () => ({
        extractWithReadability: vi.fn().mockResolvedValue({
          title: 'Article',
          content: '<p>Basic content...</p>',
          textContent: 'Basic content...',
          extractionMethod: 'readability',
          metadata: { wordCount: 150, hasCodeBlocks: false, hasTables: false },
        }),
      }));

      // In actual implementation, the contentExtractor would:
      // 1. Try both defuddle and readability
      // 2. Score both results
      // 3. Choose the better one

      // This is a conceptual test showing the expected behavior
      const defuddleScore = scoreContentQuality({
        title: 'High Quality Article',
        content: '<article><h1>Title</h1><h2>Section</h2><p>Rich content...</p></article>',
        textContent: 'Title Section Rich content...',
        url: 'https://example.com',
        domain: 'example.com',
        extractedAt: Date.now(),
        extractionMethod: 'defuddle',
        metadata: { wordCount: 200, hasCodeBlocks: false, hasTables: false },
      } as ExtractedContent);

      const readabilityScore = scoreContentQuality({
        title: 'Article',
        content: '<p>Basic content...</p>',
        textContent: 'Basic content...',
        url: 'https://example.com',
        domain: 'example.com',
        extractedAt: Date.now(),
        extractionMethod: 'readability',
        metadata: { wordCount: 150, hasCodeBlocks: false, hasTables: false },
      } as ExtractedContent);

      // Assert that defuddle would be chosen
      expect(defuddleScore.score).toBeGreaterThan(readabilityScore.score);
    });
  });
});