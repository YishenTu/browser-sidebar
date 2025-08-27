/**
 * @file Content Extractor Orchestrator
 *
 * Main extraction orchestrator that coordinates the content extraction pipeline
 * with timeout enforcement and fallback logic. Tries Readability first, then
 * falls back to heuristic extraction if needed.
 */

import type { ExtractedContent, ExtractionOptions } from '../types/extraction';
import { validateExtractionOptions, ExtractionMode } from '../types/extraction';
import { getPageMetadata, clampText, normalizeUrls, cleanHtml } from './domUtils';
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
let fallbackExtractorModule: typeof import('./extractors/fallback') | null = null;
let comprehensiveExtractorModule: typeof import('./extractors/comprehensive') | null = null;
let defuddleExtractorModule: typeof import('./extractors/defuddle') | null = null;
let contentQualityModule: typeof import('./contentQuality') | null = null;


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

/**
 * Loads the comprehensive extractor with caching and error handling
 */
async function getComprehensiveExtractor() {
  if (!comprehensiveExtractorModule) {
    try {
      comprehensiveExtractorModule = await import('./extractors/comprehensive');
    } catch (error) {
      // Re-throw with more specific error information
      if (error instanceof Error) {
        if (error.message.includes('network') || error.message.includes('fetch')) {
          throw new Error(`Network error loading comprehensive extractor: ${error.message}`);
        } else if (error.message.includes('timeout')) {
          throw new Error(`Timeout loading comprehensive extractor: ${error.message}`);
        } else {
          throw new Error(`Loading error for comprehensive extractor: ${error.message}`);
        }
      }
      throw new Error(`Unknown error loading comprehensive extractor: ${error}`);
    }
  }
  return comprehensiveExtractorModule;
}

/**
 * Loads the Defuddle extractor with caching and error handling
 */
async function getDefuddleExtractor() {
  if (!defuddleExtractorModule) {
    try {
      defuddleExtractorModule = await import('./extractors/defuddle');
    } catch (error) {
      // Re-throw with more specific error information
      if (error instanceof Error) {
        throw new Error(`Loading error for defuddle extractor: ${error.message}`);
      }
      throw new Error(`Unknown error loading defuddle extractor: ${error}`);
    }
  }
  return defuddleExtractorModule;
}

/**
 * Loads the content quality module with caching and error handling
 */
async function getContentQualityModule() {
  if (!contentQualityModule) {
    try {
      contentQualityModule = await import('./contentQuality');
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Loading error for content quality module: ${error.message}`);
      }
      throw new Error(`Unknown error loading content quality module: ${error}`);
    }
  }
  return contentQualityModule;
}

// =============================================================================
// Main Extraction Function
// =============================================================================

/**
 * Extracts content from the current page using a tiered approach
 *
 * Extraction Pipeline:
 * 1. Try extraction based on mode (Comprehensive by default)
 * 2. Fall back to heuristic extraction if primary fails
 * 3. Convert HTML content to Markdown
 * 4. Apply character limits and detect content features
 *
 * @param opts - Extraction configuration options
 * @param mode - Extraction mode (COMPREHENSIVE, ARTICLE, or MINIMAL)
 * @returns Promise resolving to structured content data
 */
export async function extractContent(
  opts?: ExtractionOptions,
  mode: ExtractionMode = ExtractionMode.COMPREHENSIVE
): Promise<ExtractedContent> {
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
    const extractionPromise = performExtraction(includeLinks, maxLength, timeout, mode);
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
 * Captures user-selected text if available
 */
function captureSelection(): { html: string; text: string } | null {
  try {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return null;
    }
    
    const range = selection.getRangeAt(0);
    const container = document.createElement('div');
    container.appendChild(range.cloneContents());
    
    const html = container.innerHTML;
    const text = selection.toString();
    
    if (!text.trim()) {
      return null;
    }
    
    return { html, text };
  } catch (error) {
    console.warn('Failed to capture selection:', error);
    return null;
  }
}

/**
 * Performs the actual extraction without timeout handling
 */
async function performExtraction(
  includeLinks: boolean,
  maxLength: number,
  timeoutMs: number,
  mode: ExtractionMode = ExtractionMode.COMPREHENSIVE
): Promise<Omit<ExtractedContent, 'extractionTime'>> {
  const stepStartTime = performance.now();
  let htmlContent = '';
  let textContent = '';
  let author: string | undefined;
  let extractionMethod: 'fallback' | 'comprehensive' | 'defuddle' | 'selection' = 'comprehensive';
  let metadata: ReturnType<typeof getPageMetadata>;
  
  // Check for user selection first
  const selection = captureSelection();
  const hasSelection = selection !== null;

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

  // Step 0: If we have a selection, prioritize it
  if (hasSelection && selection) {
    // For selection mode or minimal mode with selection, only use the selected content
    if (mode === ExtractionMode.SELECTION || mode === ExtractionMode.MINIMAL) {
      htmlContent = selection.html;
      textContent = selection.text;
      extractionMethod = mode === ExtractionMode.SELECTION ? 'selection' : 'fallback'; // Use appropriate method
      if (DEBUG) console.log('Using user selection only');
    } else {
      // For other modes, we'll extract full content but mark the selection
      // This will be enhanced after full extraction
      if (DEBUG) console.log('Selection captured, will enhance extraction');
    }
  }

  // Step 1: Try extraction based on mode (skip if we already have selection-only content)
  if (!htmlContent && mode === ExtractionMode.COMPREHENSIVE) {
    try {
      const comprehensiveExtractor = await getComprehensiveExtractor();
      const comprehensiveResult = comprehensiveExtractor.extractComprehensive(document, maxLength);
      
      if (comprehensiveResult && comprehensiveResult.content && comprehensiveResult.content.trim()) {
        htmlContent = comprehensiveResult.content;
        textContent = comprehensiveResult.textContent || '';
        extractionMethod = 'comprehensive';
        
        const comprehensiveTime = performance.now() - stepStartTime;
        void comprehensiveTime; // Reference to avoid unused warning
        if (DEBUG) console.log('Comprehensive extraction succeeded', comprehensiveResult.structure);
      } else {
        if (DEBUG) console.log('Comprehensive extraction returned empty content');
      }
    } catch (error) {
      console.warn('Comprehensive extraction failed:', error);
      // Don't fall back - comprehensive should always work
    }
  } 
  // Article mode: Use Defuddle for article extraction
  else if (mode === ExtractionMode.ARTICLE || mode === ExtractionMode.SMART) {
    try {
      // Use Defuddle for article extraction
      const defuddleExtractor = await getDefuddleExtractor();
      const defuddleResult = await defuddleExtractor.extractWithDefuddle();
      
      // Use the defuddle result
      if (defuddleResult.content && defuddleResult.content.trim()) {
        htmlContent = defuddleResult.content;
        textContent = defuddleResult.textContent || '';
        author = defuddleResult.author || undefined;
        extractionMethod = 'defuddle';
        
        if (DEBUG) console.log('Defuddle extraction succeeded');
      } else {
        if (DEBUG) console.log('Defuddle failed or returned empty content');
      }
      
    } catch (error) {
      console.warn('Defuddle extraction failed:', error);
    }
  } // Close the else-if for Article/Smart mode

  // Step 2: Fall back to heuristic extraction if primary method failed
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

  // Step 2.5: Clean and normalize URLs in HTML content
  if (htmlContent && htmlContent.trim()) {
    try {
      // First clean the HTML following Obsidian's proven order
      htmlContent = cleanHtml(htmlContent, false);
      
      // Then normalize URLs - preserve links only if includeLinks is true
      // This ensures images are always normalized but links are only normalized when needed
      htmlContent = normalizeUrls(htmlContent, window.location.href, includeLinks);
      
      if (DEBUG) console.log('HTML cleaning and URL normalization completed');
    } catch (error) {
      console.warn('HTML cleaning/normalization failed, using original content:', error);
    }
  }

  // Step 2.6: If we have a selection and full content, add selection marker
  let selectionMarkdown = '';
  if (hasSelection && selection && htmlContent && mode !== ExtractionMode.MINIMAL && mode !== ExtractionMode.SELECTION) {
    try {
      // Convert selection to markdown
      const cleanedSelection = cleanHtml(selection.html, false);
      const normalizedSelection = normalizeUrls(cleanedSelection, window.location.href, includeLinks);
      selectionMarkdown = await htmlToMarkdown(normalizedSelection, { includeLinks });
      
      if (DEBUG) console.log('Selection enhanced in full extraction');
    } catch (error) {
      console.warn('Failed to process selection:', error);
    }
  }

  // Step 3: Convert HTML to Markdown with graceful degradation
  let markdown = '';
  if (htmlContent && htmlContent.trim()) {
    try {
      markdown = await htmlToMarkdown(htmlContent, { includeLinks });
      
      // If we have a selection, prepend it with a marker
      if (selectionMarkdown) {
        markdown = `## Selected Content\n\n${selectionMarkdown}\n\n---\n\n## Full Page Content\n\n${markdown}`;
      }
      
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
