/**
 * @file Tests for Content Quality Scoring
 *
 * Tests the content quality assessment functionality to ensure proper scoring
 * and signal detection for extracted web page content.
 */

import { describe, it, expect } from 'vitest';
import {
  scoreContentQuality,
  getQualityDescription,
  getQualityBadgeVariant,
} from './contentQuality';
import type { ExtractedContent } from '../types/extraction';

describe('Content Quality Scoring', () => {
  describe('scoreContentQuality', () => {
    it('should score high quality content correctly', () => {
      const content: ExtractedContent = {
        title: 'Advanced JavaScript Concepts',
        url: 'https://example.com/article',
        domain: 'example.com',
        content: `# Advanced JavaScript Concepts

This article covers advanced JavaScript concepts including closures, prototypes, and async programming.

## Closures
A closure is a function that has access to variables in its outer scope.

\`\`\`javascript
function outer() {
  const x = 10;
  return function inner() {
    return x;
  };
}
\`\`\`

## Data Tables
| Feature | Support |
| --- | --- |
| Closures | Yes |
| Prototypes | Yes |

This comprehensive guide will help you master these concepts.`,
        textContent:
          'Advanced JavaScript Concepts This article covers advanced JavaScript concepts...',
        excerpt:
          'This article covers advanced JavaScript concepts including closures, prototypes, and async programming.',
        author: 'John Developer',
        publishedDate: '2024-01-01',
        extractedAt: Date.now(),
        extractionMethod: 'readability',
        metadata: {
          wordCount: 150,
          hasCodeBlocks: true,
          hasTables: true,
          truncated: false,
        },
      };

      const result = scoreContentQuality(content);

      expect(result.score).toBeGreaterThan(80); // High quality content
      expect(result.qualityLevel).toBe('high');
      expect(result.signals.hasTitle).toBe(true);
      expect(result.signals.hasSufficientWordCount).toBe(true);
      expect(result.signals.hasStructure).toBe(true);
      expect(result.signals.hasCode).toBe(true);
      expect(result.signals.hasTables).toBe(true);
      expect(result.signals.hasAuthor).toBe(true);
      expect(result.signals.hasExcerpt).toBe(true);
    });

    it('should score medium quality content correctly', () => {
      const content: ExtractedContent = {
        title: 'Basic Tutorial',
        url: 'https://example.com/basic',
        domain: 'example.com',
        content: `Basic Tutorial

This is a simple tutorial. It has minimal structure.

Some content here but not very comprehensive.`,
        textContent: 'Basic Tutorial This is a simple tutorial...',
        excerpt: 'This is a simple tutorial.',
        extractedAt: Date.now(),
        extractionMethod: 'readability',
        metadata: {
          wordCount: 80, // Below 100 words
          hasCodeBlocks: false,
          hasTables: false,
          truncated: false,
        },
      };

      const result = scoreContentQuality(content);

      expect(result.score).toBeGreaterThan(40);
      expect(result.score).toBeLessThan(70);
      expect(result.qualityLevel).toBe('medium');
      expect(result.signals.hasTitle).toBe(true);
      expect(result.signals.hasSufficientWordCount).toBe(false); // <100 words
      expect(result.signals.hasStructure).toBe(false); // No heading, minimal structure
      expect(result.signals.hasCode).toBe(false);
      expect(result.signals.hasTables).toBe(false);
      expect(result.signals.hasAuthor).toBe(false);
    });

    it('should score low quality content correctly', () => {
      const content: ExtractedContent = {
        title: 'Untitled',
        url: 'https://example.com',
        domain: 'example.com',
        content: 'Short content without structure.',
        textContent: 'Short content without structure.',
        extractedAt: Date.now(),
        extractionMethod: 'fallback',
        metadata: {
          wordCount: 10, // Very low word count
          hasCodeBlocks: false,
          hasTables: false,
          truncated: false,
        },
      };

      const result = scoreContentQuality(content);

      expect(result.score).toBeLessThan(40);
      expect(result.qualityLevel).toBe('low');
      expect(result.signals.hasTitle).toBe(false); // "Untitled" doesn't count
      expect(result.signals.hasSufficientWordCount).toBe(false);
      expect(result.signals.hasStructure).toBe(false);
      expect(result.signals.hasCode).toBe(false);
      expect(result.signals.hasTables).toBe(false);
    });

    it('should handle backwards compatibility with deprecated fields', () => {
      const content: ExtractedContent = {
        title: 'Legacy Content',
        url: 'https://example.com/legacy',
        domain: 'example.com',
        content: '', // Empty content to test fallback to markdown field
        textContent: 'Legacy Content Content using old field structure.',
        extractedAt: Date.now(),
        extractionMethod: 'readability',
        // Using deprecated fields instead of metadata
        markdown:
          '# Legacy Content\n\nContent using old field structure.\n\nAnother paragraph with sufficient length to meet the criteria.\n\nAnd a third paragraph to ensure multiple paragraphs are detected.',
        wordCount: 120,
        hasCode: false,
        hasTables: false,
        isTruncated: false,
      };

      const result = scoreContentQuality(content);

      expect(result.score).toBeGreaterThan(40);
      expect(result.signals.hasTitle).toBe(true);
      expect(result.signals.hasSufficientWordCount).toBe(true);
      expect(result.signals.hasStructure).toBe(true); // Uses content field, not deprecated markdown
    });

    it('should detect code blocks correctly', () => {
      const content: ExtractedContent = {
        title: 'Code Example',
        url: 'https://example.com/code',
        domain: 'example.com',
        content: `# Code Example

Here's some JavaScript:

\`\`\`javascript
function hello() {
  console.log('Hello!');
}
\`\`\`

End of example.`,
        textContent: "Code Example Here's some JavaScript...",
        extractedAt: Date.now(),
        extractionMethod: 'readability',
        metadata: {
          wordCount: 50,
          hasCodeBlocks: true,
          hasTables: false,
          truncated: false,
        },
      };

      const result = scoreContentQuality(content);

      expect(result.signals.hasCode).toBe(true);
      // Score breakdown: Title (20) + WordCount (15) + Structure (0) + Code (15) = 50
      expect(result.score).toBeGreaterThanOrEqual(50); // Code blocks add 15 points
    });

    it('should detect tables correctly', () => {
      const content: ExtractedContent = {
        title: 'Data Table',
        url: 'https://example.com/table',
        domain: 'example.com',
        content: `# Data Overview

| Name | Value | Status |
|------|-------|--------|
| A    | 100   | Active |
| B    | 200   | Inactive |

End of table.`,
        textContent: 'Data Overview Name Value Status...',
        extractedAt: Date.now(),
        extractionMethod: 'readability',
        metadata: {
          wordCount: 80,
          hasCodeBlocks: false,
          hasTables: true,
          truncated: false,
        },
      };

      const result = scoreContentQuality(content);

      expect(result.signals.hasTables).toBe(true);
      expect(result.score).toBeGreaterThan(40); // Tables add 10 points
    });

    it('should ensure score is within 0-100 bounds', () => {
      // Test minimal content
      const minimalContent: ExtractedContent = {
        title: '',
        url: 'https://example.com',
        domain: 'example.com',
        content: '',
        textContent: '',
        extractedAt: Date.now(),
        extractionMethod: 'failed',
        metadata: {
          wordCount: 0,
          hasCodeBlocks: false,
          hasTables: false,
          truncated: false,
        },
      };

      const minResult = scoreContentQuality(minimalContent);
      expect(minResult.score).toBeGreaterThanOrEqual(0);
      expect(minResult.score).toBeLessThanOrEqual(100);

      // Test maximum theoretical content (should not exceed 100)
      const maximalContent: ExtractedContent = {
        title: 'Comprehensive Technical Guide',
        url: 'https://example.com/comprehensive',
        domain: 'example.com',
        content: `# Comprehensive Technical Guide

## Introduction
This comprehensive guide covers all aspects of the topic.

## Code Examples
\`\`\`javascript
function example() { return true; }
\`\`\`

## Data Analysis
| Metric | Value | Trend |
|--------|-------|-------|
| Users  | 1000  | Up    |

## Conclusion
Detailed analysis with proper structure and comprehensive coverage.`,
        textContent: 'Comprehensive Technical Guide Introduction This comprehensive guide...',
        excerpt: 'This comprehensive guide covers all aspects of the topic with detailed analysis.',
        author: 'Expert Author',
        publishedDate: '2024-01-01',
        extractedAt: Date.now(),
        extractionMethod: 'readability',
        metadata: {
          wordCount: 200,
          hasCodeBlocks: true,
          hasTables: true,
          truncated: false,
        },
      };

      const maxResult = scoreContentQuality(maximalContent);
      expect(maxResult.score).toBeLessThanOrEqual(100);
      expect(maxResult.qualityLevel).toBe('high');
    });
  });

  describe('getQualityDescription', () => {
    it('should return correct descriptions for quality levels', () => {
      expect(getQualityDescription('high')).toBe('High Quality');
      expect(getQualityDescription('medium')).toBe('Medium Quality');
      expect(getQualityDescription('low')).toBe('Low Quality');
    });
  });

  describe('getQualityBadgeVariant', () => {
    it('should return correct badge variants for quality levels', () => {
      expect(getQualityBadgeVariant('high')).toBe('success');
      expect(getQualityBadgeVariant('medium')).toBe('warning');
      expect(getQualityBadgeVariant('low')).toBe('error');
    });
  });
});
