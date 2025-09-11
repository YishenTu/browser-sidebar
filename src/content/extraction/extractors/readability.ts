/**
 * @file Mozilla Readability Extractor
 *
 * Content extraction using Mozilla's Readability library for clean,
 * reader-friendly content extraction from web pages.
 */

import { Readability } from '@mozilla/readability';
import type { ExtractedContent } from '@/types/extraction';
import { getPageMetadata } from '../analyzers/metadataExtractor';
import { detectTables, generateExcerpt } from '@core/extraction/analyzers/contentAnalyzer';
import { htmlToMarkdown } from '@core/extraction/markdownConverter';

/**
 * Configuration options for Readability extraction
 */
export interface ReadabilityOptions {
  /** Whether to include links in the output (default: false) */
  includeLinks?: boolean;
  /** Debug mode for additional logging */
  debug?: boolean;
}

/**
 * Extract content using Mozilla Readability
 *
 * This extractor uses Mozilla's Readability library to parse and extract
 * the main content from web pages in a clean, readable format.
 *
 * @param options - Extraction configuration options
 * @returns Promise resolving to extracted content data
 */
export async function extractWithReadability(
  options: ReadabilityOptions = {}
): Promise<ExtractedContent> {
  const { includeLinks = false, debug = false } = options;

  try {
    // Clone the document to avoid modifying the original DOM
    const documentClone = document.cloneNode(true) as Document;

    // Create a Readability instance with the cloned document
    const reader = new Readability(documentClone, {
      debug: debug,
      // Readability options
      charThreshold: 500, // Minimum characters for article detection
      classesToPreserve: ['code', 'pre', 'blockquote'], // Keep code blocks
      keepClasses: false, // Remove most classes for cleaner output
      // Use default serializer which returns innerHTML as string
    });

    // Parse the document
    const article = reader.parse();

    if (!article) {
      // Readability couldn't extract content
      throw new Error('Readability failed to extract article content');
    }

    // Get metadata from the original document
    const metadata = getPageMetadata(document);

    // Convert HTML content to markdown
    const markdown = await htmlToMarkdown(article.content, {
      includeLinks,
    });

    // Detect tables in the content
    const hasTables = detectTables(article.content);

    // No clamping - return full content
    const fullMarkdown = markdown;

    // Extract text content - if Readability doesn't provide it, extract from HTML
    let fullText = article.textContent || '';
    if (!fullText && article.content) {
      // Create a temporary element to extract text from HTML
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = article.content;
      fullText = tempDiv.textContent || tempDiv.innerText || '';
    }

    // Generate excerpt if not provided
    const excerpt = article.excerpt || generateExcerpt(fullText);

    return {
      title: article.title || metadata.title || document.title || 'Untitled',
      url: document.location.href,
      domain: document.location.hostname,
      content: fullMarkdown,
      textContent: fullText,
      excerpt: excerpt,
      extractedAt: Date.now(),
      extractionMethod: 'readability',
      metadata: {
        hasTables,
        truncated: false,
        timeoutMs: 0,
      },
    };
  } catch (error) {
    // Log error if in debug mode
    if (options.debug) {
      console.error('[Readability Extractor] Extraction failed:', error);
    }

    // Return partial content with error indication
    throw new Error(
      `Readability extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Fallback extraction when Readability fails
 *
 * Provides basic content extraction as a fallback when Readability
 * cannot parse the page content.
 */
export async function fallbackExtraction(): Promise<Partial<ExtractedContent>> {
  // Try to get basic content from common content selectors
  const contentSelectors = [
    'main',
    'article',
    '[role="main"]',
    '#content',
    '.content',
    '.post',
    '.entry-content',
    '.article-content',
    '.page-content',
    'body',
  ];

  let contentElement: Element | null = null;
  for (const selector of contentSelectors) {
    contentElement = document.querySelector(selector);
    if (
      contentElement &&
      contentElement.textContent &&
      contentElement.textContent.trim().length > 100
    ) {
      break;
    }
  }

  if (!contentElement) {
    contentElement = document.body;
  }

  const htmlContent = contentElement.innerHTML || '';
  const textContent = contentElement.textContent || '';

  // Get page metadata
  const metadata = getPageMetadata(document);

  // Convert to markdown
  const markdown = await htmlToMarkdown(htmlContent, {
    includeLinks: false,
  });

  return {
    title: metadata.title || document.title || 'Untitled',
    url: document.location.href,
    domain: document.location.hostname,
    content: markdown,
    markdown: markdown,
    textContent: textContent,
    wordCount: textContent.split(/\s+/).filter(Boolean).length,
    excerpt: generateExcerpt(textContent),
    author: undefined,
    publishedDate: metadata.publishedDate,
    extractedAt: Date.now(),
    extractionMethod: 'readability', // Still mark as readability with fallback
    metadata: {
      hasTables: detectTables(htmlContent),
      truncated: false,
    },
  };
}
