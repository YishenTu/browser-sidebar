/**
 * @file Mozilla Readability Adapter for Article Extraction
 *
 * This module provides a wrapper around Mozilla's Readability.js library
 * for extracting article content from web pages. It handles document cloning,
 * memory cleanup, and returns structured article data.
 */

import { Readability } from '@mozilla/readability';

// ============================================================================
// Types
// ============================================================================

/**
 * Result from Mozilla Readability extraction
 *
 * This interface matches the output format from Readability.js with all
 * the essential article metadata and content.
 */
export interface ReadabilityResult {
  /** Article title extracted from the page */
  title: string;

  /** Author byline if available */
  byline: string | null;

  /** Main article content as HTML */
  content: string;

  /** Plain text version of the content */
  textContent: string;

  /** Character length of the text content */
  length: number;

  /** Brief excerpt from the article */
  excerpt: string;

  /** Site name if available */
  siteName: string | null;
}

// ============================================================================
// Readability Extractor
// ============================================================================

/**
 * Extracts article content using Mozilla Readability
 *
 * This function clones the current document and attempts to extract
 * article-like content using Readability.js. It preserves class attributes
 * for code detection and handles memory cleanup properly.
 *
 * @returns ReadabilityResult if successful, null if page is not article-like
 */
export async function extractWithReadability(): Promise<ReadabilityResult | null> {
  let documentClone: Document | null = null;

  try {
    // Clone the document to avoid mutations to the original
    documentClone = document.cloneNode(true) as Document;

    // Create Readability instance with configuration
    // keepClasses: true preserves class attributes for code detection
    const reader = new Readability(documentClone, {
      keepClasses: true,
    });

    // Attempt to parse the document
    const article = reader.parse();

    // Return null if Readability couldn't extract article content
    if (!article) {
      return null;
    }

    // Return structured result
    const result: ReadabilityResult = {
      title: article.title || '',
      byline: article.byline || null,
      content: article.content || '',
      textContent: article.textContent || '',
      length: article.length || 0,
      excerpt: article.excerpt || '',
      siteName: article.siteName || null,
    };

    return result;
  } catch (error) {
    // Log error for debugging but don't throw
    console.warn('Readability extraction failed:', error);
    return null;
  } finally {
    // Clean up memory by removing references to cloned document
    if (documentClone) {
      // Clear references to help garbage collection
      documentClone = null;
    }
  }
}
