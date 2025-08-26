/**
 * @file Content Extractor Orchestrator
 *
 * Main extraction orchestrator that coordinates the content extraction pipeline
 * with timeout enforcement and fallback logic. Tries Readability first, then
 * falls back to heuristic extraction if needed.
 */

import type { ExtractedContent, ExtractionOptions } from '../types/extraction';
import { validateExtractionOptions } from '../types/extraction';
import { getPageMetadata, clampText } from './domUtils';
import { htmlToMarkdown } from './markdown/markdownConverter';

// Debug flag - disable in production
const DEBUG = typeof process !== 'undefined' && process.env?.['NODE_ENV'] !== 'production';

// =============================================================================
// Error Classification
// =============================================================================

/**
 * Classifies error types for better error handling and logging
 */
function classifyError(error: unknown): {
  type: 'timeout' | 'network' | 'dom' | 'memory' | 'parsing' | 'unknown';
  message: string;
} {
  if (!(error instanceof Error)) {
    return { type: 'unknown', message: String(error) };
  }

  const message = error.message.toLowerCase();

  if (message.includes('timeout')) {
    return { type: 'timeout', message: error.message };
  }

  if (message.includes('network') || message.includes('fetch') || message.includes('loading')) {
    return { type: 'network', message: error.message };
  }

  if (message.includes('dom') || message.includes('document') || message.includes('element')) {
    return { type: 'dom', message: error.message };
  }

  if (message.includes('memory') || message.includes('heap')) {
    return { type: 'memory', message: error.message };
  }

  if (message.includes('parsing') || message.includes('parse') || message.includes('syntax')) {
    return { type: 'parsing', message: error.message };
  }

  return { type: 'unknown', message: error.message };
}

// =============================================================================
// Dynamic Import Caching
// =============================================================================

// Cache for dynamically imported modules to avoid reloading
let readabilityExtractorModule: typeof import('./extractors/readability') | null = null;
let fallbackExtractorModule: typeof import('./extractors/fallback') | null = null;

/**
 * Loads the readability extractor with caching and error handling
 */
async function getReadabilityExtractor() {
  if (!readabilityExtractorModule) {
    try {
      readabilityExtractorModule = await import('./extractors/readability');
    } catch (error) {
      // Re-throw with more specific error information
      if (error instanceof Error) {
        if (error.message.includes('network') || error.message.includes('fetch')) {
          throw new Error(`Network error loading readability extractor: ${error.message}`);
        } else if (error.message.includes('timeout')) {
          throw new Error(`Timeout loading readability extractor: ${error.message}`);
        } else {
          throw new Error(`Loading error for readability extractor: ${error.message}`);
        }
      }
      throw new Error(`Unknown error loading readability extractor: ${error}`);
    }
  }
  return readabilityExtractorModule;
}

/**
 * Loads the fallback extractor with caching and error handling
 */
async function getFallbackExtractor() {
  if (!fallbackExtractorModule) {
    try {
      fallbackExtractorModule = await import('./extractors/fallback');
    } catch (error) {
      // Re-throw with more specific error information
      if (error instanceof Error) {
        if (error.message.includes('network') || error.message.includes('fetch')) {
          throw new Error(`Network error loading fallback extractor: ${error.message}`);
        } else if (error.message.includes('timeout')) {
          throw new Error(`Timeout loading fallback extractor: ${error.message}`);
        } else {
          throw new Error(`Loading error for fallback extractor: ${error.message}`);
        }
      }
      throw new Error(`Unknown error loading fallback extractor: ${error}`);
    }
  }
  return fallbackExtractorModule;
}

// =============================================================================
// Main Extraction Function
// =============================================================================

/**
 * Extracts content from the current page using a tiered approach
 *
 * Extraction Pipeline:
 * 1. Try Readability.js for article-like content
 * 2. Fall back to heuristic extraction if Readability fails
 * 3. Convert HTML content to Markdown
 * 4. Apply character limits and detect content features
 *
 * @param opts - Extraction configuration options
 * @returns Promise resolving to structured content data
 */
export async function extractContent(opts?: ExtractionOptions): Promise<ExtractedContent> {
  const startTime = performance.now();
  let timeoutId: NodeJS.Timeout | null = null;

  try {
    // Check document readiness first
    if (typeof document === 'undefined') {
      throw new Error('Document is not available - extraction cannot proceed');
    }

    if (document.readyState === 'loading' && DEBUG) {
      console.warn('Document is still loading, extraction may be incomplete');
    }

    // Validate and normalize options with defaults
    const options = validateExtractionOptions(opts);
    const { timeout, includeLinks, maxLength } = options;

    // Create timeout promise with proper cleanup
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Extraction timeout after ${timeout}ms`));
      }, timeout);
    });

    // Run extraction with timeout
    const extractionPromise = performExtraction(includeLinks, maxLength, timeout);
    const result = await Promise.race([extractionPromise, timeoutPromise]);

    // Clear timeout if extraction completed successfully
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    // Calculate final extraction time and reference to avoid unused warning
    const extractionTime = performance.now() - startTime;
    if (DEBUG) {
      console.log(`Content extraction completed successfully in ${extractionTime.toFixed(2)}ms`);
    }

    return {
      ...result,
      extractionTime,
    };
  } catch (error) {
    // Clean up timeout if still pending
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Calculate elapsed time for error logging
    const elapsed = performance.now() - startTime;

    // Classify and handle specific error types
    const errorInfo = classifyError(error);

    switch (errorInfo.type) {
      case 'timeout':
        console.error(
          `Content extraction timed out after ${elapsed.toFixed(2)}ms:`,
          errorInfo.message
        );
        break;
      case 'network':
        console.error(
          `Network error during extraction after ${elapsed.toFixed(2)}ms:`,
          errorInfo.message
        );
        break;
      case 'dom':
        console.error(
          `DOM access error during extraction after ${elapsed.toFixed(2)}ms:`,
          errorInfo.message
        );
        break;
      case 'memory':
        console.error(
          `Memory error during extraction after ${elapsed.toFixed(2)}ms:`,
          errorInfo.message
        );
        break;
      case 'parsing':
        console.error(
          `Parsing error during extraction after ${elapsed.toFixed(2)}ms:`,
          errorInfo.message
        );
        break;
      default:
        console.error(
          `Content extraction failed after ${elapsed.toFixed(2)}ms:`,
          errorInfo.message
        );
    }

    // Always return valid fallback content
    const timeoutUsed = opts?.timeout ?? 2000;
    return createFallbackContent(
      elapsed,
      opts?.maxLength || opts?.maxOutputChars || 200000,
      timeoutUsed
    );
  }
}

// =============================================================================
// Core Extraction Logic
// =============================================================================

/**
 * Performs the actual extraction without timeout handling
 */
async function performExtraction(
  includeLinks: boolean,
  maxLength: number,
  timeoutMs: number
): Promise<Omit<ExtractedContent, 'extractionTime'>> {
  const stepStartTime = performance.now();
  let htmlContent = '';
  let textContent = '';
  let author: string | undefined;
  let extractionMethod: 'readability' | 'fallback' = 'fallback';
  let metadata: ReturnType<typeof getPageMetadata>;

  // Early metadata extraction with error handling
  try {
    metadata = getPageMetadata(document);
  } catch (error) {
    console.warn('Failed to extract page metadata, using defaults:', error);
    metadata = {
      title: document.title || 'Untitled',
      publishedDate: undefined,
    };
  }

  // Step 1: Try Readability first with comprehensive error handling
  try {
    const readabilityExtractor = await getReadabilityExtractor();
    const readabilityResult = await readabilityExtractor.extractWithReadability();

    if (readabilityResult && readabilityResult.content && readabilityResult.content.trim()) {
      htmlContent = readabilityResult.content;
      textContent = readabilityResult.textContent || '';
      author = readabilityResult.byline || undefined;
      extractionMethod = 'readability';

      const readabilityTime = performance.now() - stepStartTime;
      void readabilityTime; // Reference to avoid unused warning
      if (DEBUG) console.log('Readability extraction succeeded');
    } else {
      if (DEBUG)
        console.log('Readability extraction returned empty content, falling back to heuristic');
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('network') || error.message.includes('loading')) {
        console.warn(
          'Network error during Readability import, falling back to heuristic:',
          error.message
        );
      } else if (error.message.includes('memory')) {
        console.warn(
          'Memory error during Readability extraction, falling back to heuristic:',
          error.message
        );
      } else if (error.message.includes('DOM')) {
        console.warn(
          'DOM access error during Readability extraction, falling back to heuristic:',
          error.message
        );
      } else {
        console.warn('Readability extraction failed, falling back to heuristic:', error.message);
      }
    } else {
      console.warn(
        'Unknown error during Readability extraction, falling back to heuristic:',
        error
      );
    }
  }

  // Step 2: Fall back to heuristic extraction if Readability failed
  if (!htmlContent || !htmlContent.trim()) {
    try {
      const fallbackExtractor = await getFallbackExtractor();
      const fallbackResult = fallbackExtractor.extractFallbackHTML(maxLength);

      if (fallbackResult && fallbackResult.content && fallbackResult.content.trim()) {
        htmlContent = fallbackResult.content;
        textContent = fallbackResult.textContent || '';
        extractionMethod = 'fallback';
        if (DEBUG) console.log('Heuristic extraction succeeded');
      } else {
        console.warn('Heuristic extraction returned empty content');
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('network') || error.message.includes('loading')) {
          console.error('Network error during heuristic extractor import:', error.message);
        } else if (error.message.includes('DOM')) {
          console.error('DOM access error during heuristic extraction:', error.message);
        } else if (error.message.includes('memory')) {
          console.error('Memory error during heuristic extraction:', error.message);
        } else {
          console.error('Heuristic extraction failed:', error.message);
        }
      } else {
        console.error('Unknown error during heuristic extraction:', error);
      }
    }
  }

  // Step 3: Convert HTML to Markdown with graceful degradation
  let markdown = '';
  if (htmlContent && htmlContent.trim()) {
    try {
      markdown = await htmlToMarkdown(htmlContent, { includeLinks });
      if (DEBUG) console.log('HTML to Markdown conversion succeeded');
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('parsing')) {
          console.warn('Markdown parsing error, falling back to text extraction:', error.message);
        } else {
          console.warn(
            'HTML to Markdown conversion failed, falling back to text extraction:',
            error.message
          );
        }
      } else {
        console.warn(
          'Unknown error during HTML to Markdown conversion, falling back to text extraction:',
          error
        );
      }

      // Graceful fallback to basic text extraction
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');
        markdown = doc.body?.textContent || doc.body?.innerText || '';
        if (markdown.trim()) {
          console.log('Text extraction fallback succeeded');
        }
      } catch (parseError) {
        console.error('Even text extraction fallback failed:', parseError);
        markdown = '';
      }
    }
  }

  // Step 4: Final fallback if no content extracted
  if (!markdown || !markdown.trim()) {
    console.warn('All extraction methods failed, using basic document text');
    try {
      markdown = document.body?.textContent || document.body?.innerText || 'No content available';
      textContent = markdown; // Use the same content for text
    } catch (domError) {
      console.error('Failed to access document.body for final fallback:', domError);
      markdown = 'Content extraction failed - unable to access page content';
      textContent = markdown;
    }
  }

  // Ensure textContent is set if not already
  if (!textContent) {
    textContent = markdown
      .replace(/[#*_`[\]()]/g, '')
      .replace(/\n+/g, ' ')
      .trim();
  }

  // Step 5: Analyze content features on original markdown (before clamping) with error handling
  let hasCode = false;
  let hasTables = false;

  try {
    hasCode = detectCodeBlocks(markdown);
    hasTables = detectTables(markdown);
  } catch (error) {
    console.warn('Feature detection failed, defaulting to false:', error);
  }

  // Step 6: Apply character limits with error handling
  let clampedMarkdown = markdown;
  let isTruncated = false;

  try {
    const clampResult = clampText(markdown, maxLength);
    clampedMarkdown = clampResult.text;
    isTruncated = clampResult.isTruncated;
  } catch (error) {
    console.warn('Text clamping failed, using original content:', error);
    // If clamping fails, manually truncate as a last resort
    if (markdown.length > maxLength) {
      clampedMarkdown = markdown.substring(0, maxLength) + '...';
      isTruncated = true;
    }
  }

  // Step 7: Calculate features on final content with error handling
  let wordCount = 0;
  let excerpt = '';

  try {
    wordCount = countWords(clampedMarkdown);
  } catch (error) {
    console.warn('Word count calculation failed:', error);
    // Simple fallback word count
    wordCount = clampedMarkdown.split(/\s+/).filter(word => word.length > 0).length;
  }

  try {
    excerpt = generateExcerpt(clampedMarkdown);
  } catch (error) {
    console.warn('Excerpt generation failed:', error);
    // Simple fallback excerpt
    const cleanText = clampedMarkdown.replace(/[#*_`]/g, '').trim();
    excerpt = cleanText.length > 200 ? cleanText.substring(0, 197) + '...' : cleanText;
  }

  // Step 8: Build final result with safe property access (using new schema)
  const finalResult = {
    title: metadata?.title || document.title || 'Untitled',
    url: (() => {
      try {
        return window.location.href;
      } catch {
        return 'about:blank';
      }
    })(),
    domain: (() => {
      try {
        return window.location.hostname || 'unknown';
      } catch {
        return 'unknown';
      }
    })(),
    content: clampedMarkdown, // Main content in markdown format
    textContent:
      textContent.length > maxLength
        ? textContent.substring(0, maxLength - 3) + '...'
        : textContent, // Plain text version (also clamped)
    excerpt,
    author: author || metadata?.author, // Prefer Readability byline, then page metadata
    publishedDate: metadata?.publishedDate,
    extractedAt: Date.now(),
    extractionMethod,
    metadata: {
      wordCount,
      hasCodeBlocks: hasCode,
      hasTables,
      truncated: isTruncated,
      timeoutMs,
    },
    // Backward compatibility fields (deprecated)
    markdown: clampedMarkdown,
    wordCount,
    hasCode,
    hasTables,
    isTruncated,
  };

  const totalTime = performance.now() - stepStartTime;
  if (DEBUG) {
    console.log(`Content processing completed in ${totalTime.toFixed(2)}ms`);
  } else {
    void totalTime; // Reference to avoid unused warning in production
  }

  return finalResult;
}

// =============================================================================
// Content Analysis Utilities
// =============================================================================

/**
 * Detects code blocks in markdown content (triple backticks)
 */
function detectCodeBlocks(markdown: string): boolean {
  return /```[\s\S]*?```/.test(markdown);
}

/**
 * Detects tables in markdown content (pipe separators)
 */
function detectTables(markdown: string): boolean {
  // Look for lines with pipe separators that suggest table structure
  const lines = markdown.split('\n');
  return lines.some(line => {
    const pipes = (line.match(/\|/g) || []).length;
    return pipes >= 2; // At least 2 pipes suggest a table row
  });
}

/**
 * Counts words in text content
 */
function countWords(text: string): number {
  if (!text || !text.trim()) {
    return 0;
  }

  // Remove markdown syntax and count words
  const cleanText = text
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/`[^`]+`/g, '') // Remove inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Convert links to text
    .replace(/[#*_~`]/g, '') // Remove markdown formatting
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();

  if (!cleanText) {
    return 0;
  }

  return cleanText.split(/\s+/).length;
}

/**
 * Generates a brief excerpt from the content (first ~200 characters)
 */
function generateExcerpt(markdown: string): string {
  if (!markdown) {
    return '';
  }

  // Remove markdown syntax for excerpt
  const cleanText = markdown
    .replace(/```[\s\S]*?```/g, '[code]') // Replace code blocks
    .replace(/`[^`]+`/g, '[code]') // Replace inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Convert links to text
    .replace(/[#*_~]/g, '') // Remove formatting
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();

  // Truncate to approximately 200 characters, breaking at word boundaries
  if (cleanText.length <= 200) {
    return cleanText;
  }

  const truncated = cleanText.substring(0, 200);
  const lastSpaceIndex = truncated.lastIndexOf(' ');

  if (lastSpaceIndex > 150) {
    // Only break at word if it's not too short
    return truncated.substring(0, lastSpaceIndex) + '...';
  }

  return truncated + '...';
}

// =============================================================================
// Fallback Content Creation
// =============================================================================

/**
 * Creates minimal fallback content when extraction fails
 */
function createFallbackContent(
  extractionTime: number,
  maxLength: number,
  timeoutMs: number = 2000
): ExtractedContent {
  if (DEBUG) {
    console.log('Creating fallback content due to extraction failure');
  }

  // Safe metadata extraction
  let metadata: ReturnType<typeof getPageMetadata>;
  try {
    metadata = getPageMetadata(document);
  } catch (error) {
    console.warn('Failed to extract metadata for fallback content:', error);
    metadata = {
      title: 'Untitled',
      publishedDate: undefined,
    };
  }

  // Safe content extraction
  let fallbackText = 'No content available';
  try {
    fallbackText = document.body?.textContent || document.body?.innerText || 'No content available';
    if (!fallbackText.trim()) {
      fallbackText = document.documentElement?.textContent || 'No content available';
    }
  } catch (error) {
    console.warn('Failed to extract body text for fallback content:', error);
    try {
      // Try title as absolute last resort
      fallbackText = document.title || 'Page content unavailable';
    } catch (titleError) {
      console.error('Even document.title access failed:', titleError);
      fallbackText = 'Content extraction completely failed';
    }
  }

  // Safe text clamping
  let clampedText = fallbackText;
  let isTruncated = false;
  try {
    const clampResult = clampText(fallbackText, maxLength);
    clampedText = clampResult.text;
    isTruncated = clampResult.isTruncated;
  } catch (error) {
    console.warn('Text clamping failed in fallback, using manual truncation:', error);
    if (fallbackText.length > maxLength) {
      clampedText = fallbackText.substring(0, maxLength - 3) + '...';
      isTruncated = true;
    }
  }

  // Safe URL extraction
  let url: string;
  let domain: string;
  try {
    url = window.location.href;
    domain = window.location.hostname || 'unknown';
  } catch (error) {
    console.warn('Failed to access location in fallback content:', error);
    url = 'about:blank';
    domain = 'unknown';
  }

  // Safe title extraction
  let title: string;
  try {
    title = metadata?.title || document.title || 'Untitled';
  } catch (error) {
    console.warn('Failed to access title in fallback content:', error);
    title = 'Untitled';
  }

  // Safe excerpt generation
  let excerpt: string;
  try {
    excerpt = generateExcerpt(clampedText);
  } catch (error) {
    console.warn('Excerpt generation failed in fallback:', error);
    // Simple fallback excerpt
    const cleanText = clampedText.replace(/[#*_`]/g, '').trim();
    excerpt = cleanText.length > 200 ? cleanText.substring(0, 197) + '...' : cleanText;
  }

  // Safe word count
  let wordCount: number;
  try {
    wordCount = countWords(clampedText);
  } catch (error) {
    console.warn('Word count failed in fallback:', error);
    // Simple fallback word count
    wordCount = clampedText.split(/\s+/).filter(word => word.length > 0).length;
  }

  return {
    title,
    url,
    domain,
    content: clampedText, // Main content
    textContent: clampedText, // Plain text version (same as content for fallback)
    excerpt,
    author: metadata?.author,
    publishedDate: metadata?.publishedDate,
    extractedAt: Date.now(),
    extractionMethod: 'failed' as const,
    metadata: {
      wordCount,
      hasCodeBlocks: false,
      hasTables: false,
      truncated: isTruncated,
      timeoutMs,
    },
    // Backward compatibility fields (deprecated)
    markdown: clampedText,
    wordCount,
    hasCode: false,
    hasTables: false,
    isTruncated,
    extractionTime,
  };
}
