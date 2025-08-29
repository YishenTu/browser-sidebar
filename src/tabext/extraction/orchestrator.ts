/**
 * @file Content Extractor Orchestrator
 *
 * Main extraction orchestrator that coordinates the content extraction pipeline
 * with timeout enforcement and fallback logic. Tries Readability first, then
 * falls back to heuristic extraction if needed.
 */

import type { ExtractedContent, ExtractionOptions, ExtractionMethod } from '../../types/extraction';
import { validateExtractionOptions, ExtractionMode } from '../../types/extraction';
import { normalizeUrls, cleanHtml } from '../utils/domUtils';
import { clampText } from '../utils/textUtils';
import { getPageMetadata } from './analyzers/metadataExtractor';
import { detectTables, generateExcerpt } from './analyzers/contentAnalyzer';
import { htmlToMarkdown } from './converters/markdownConverter';

// Debug flag - disable in production
const DEBUG = false; // Disable debug logging for production

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
let defuddleExtractorModule: typeof import('./extractors/defuddle') | null = null;

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

// Removed unused getContentQualityModule function

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
 * @param mode - Extraction mode (DEFUDDLE or SELECTION)
 * @returns Promise resolving to structured content data
 */
export async function extractContent(
  opts?: ExtractionOptions,
  mode: ExtractionMode = ExtractionMode.DEFUDDLE
): Promise<ExtractedContent> {
  // Extract content called with specified mode
  let timeoutId: NodeJS.Timeout | null = null;

  try {
    // Check document readiness first
    if (typeof document === 'undefined') {
      throw new Error('Document is not available - extraction cannot proceed');
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

    return result;
  } catch (error) {
    // Clean up timeout if still pending
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Classify and handle specific error types
    const errorInfo = classifyError(error);

    // Error type can be used for specific error handling in the future
    void errorInfo.type;

    // Always return valid fallback content
    const timeoutUsed = opts?.timeout ?? 2000;
    return createFallbackContent(opts?.maxLength || 200000, timeoutUsed);
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
  mode: ExtractionMode = ExtractionMode.DEFUDDLE
): Promise<Omit<ExtractedContent, 'extractionTime'>> {
  const stepStartTime = performance.now();
  let htmlContent = '';
  let textContent = '';
  let author: string | undefined;
  let extractionMethod: ExtractionMethod = 'defuddle';
  let metadata: ReturnType<typeof getPageMetadata>;

  // Check for user selection first
  const selection = captureSelection();
  const hasSelection = selection !== null;

  // Early metadata extraction with error handling
  try {
    metadata = getPageMetadata(document);
  } catch (error) {
    metadata = {
      title: document.title || 'Untitled',
      publishedDate: undefined,
    };
  }

  // Step 0: If we have a selection, prioritize it
  if (hasSelection && selection) {
    // For selection mode, only use the selected content
    if (mode === ExtractionMode.SELECTION) {
      htmlContent = selection.html;
      textContent = selection.text;
      extractionMethod = 'selection';
    } else {
      // For defuddle mode, we'll extract full content but mark the selection
      // This will be enhanced after full extraction
    }
  }

  // Step 1: Try RAW mode first if requested (before defuddle)
  if (mode === ExtractionMode.RAW && !htmlContent) {
    // Starting RAW extraction
    try {
      const rawExtractor = await import('./extractors/raw');
      const rawResult = await rawExtractor.extractWithRaw({
        root_hints: ['.company-detail', '.content', 'main'],
        strip_class: false, // Keep classes for code language detection
        keep_id: true,
        inject_pseudo: false,

        // DEBUG TOGGLES - Internal testing phase
        optimize_tokens: true, // Phase 1: Strip & flatten HTML (40-50% token reduction)
        convert_to_markdown: false, // Phase 2: Convert to Markdown (20-30% additional reduction)

        // All stripping toggles default to false (don't strip) for testing
        strip_invisible: false,
        strip_scripts: true,
        strip_styles: true,
        strip_links: true,
        strip_noscript: true,
        strip_iframes: true,
        strip_objects: true,
        strip_embeds: true,
        strip_applets: true,
        strip_svg: true,
        strip_canvas: true,
        strip_event_handlers: true,
        strip_javascript_urls: true,
        strip_unsafe_attrs: true,
        find_main_content: true, // Don't try to find main content, use whole body
      });

      if (rawResult.content && rawResult.content.trim()) {
        // RAW extraction successful
        htmlContent = rawResult.content;
        textContent = rawResult.textContent || '';
        author = rawResult.author;
        extractionMethod = 'raw';
      } else {
        // No content extracted from raw mode
      }
    } catch (error) {
      console.error('[RAW MODE] Extraction failed:', error);
      // Raw extraction failed, fall through to defuddle
    }
  }

  // Step 2: Use Defuddle for all extraction (unless we already have selection-only content)
  if (!htmlContent) {
    try {
      const defuddleExtractor = await getDefuddleExtractor();
      const defuddleResult = await defuddleExtractor.extractWithDefuddle();

      if (defuddleResult.content && defuddleResult.content.trim()) {
        htmlContent = defuddleResult.content;
        textContent = defuddleResult.textContent || '';
        author = defuddleResult.author || undefined;
        extractionMethod = 'defuddle';
      } else {
        // No raw content extracted
      }
    } catch (error) {
      // Defuddle extraction failed, will use fallback
    }
  }

  // Step 3: Clean and normalize URLs in HTML content
  if (htmlContent && htmlContent.trim()) {
    try {
      // First clean the HTML following Obsidian's proven order
      // CRITICAL: For raw mode, preserve classes for code detection
      const preserveClasses = extractionMethod === 'raw';
      htmlContent = cleanHtml(htmlContent, preserveClasses);

      // Then normalize URLs. In RAW mode, also normalize link hrefs to absolute
      // so table and reference links remain valid outside the page context.
      const normalizeLinkHrefs = extractionMethod === 'raw' ? true : includeLinks;
      htmlContent = normalizeUrls(htmlContent, window.location.href, normalizeLinkHrefs);
    } catch (error) {
      // HTML cleaning/normalization failed, using original content
    }
  }

  // Step 2.5: If we have a selection and full content, add selection marker
  let selectionMarkdown = '';
  if (hasSelection && selection && htmlContent && mode !== ExtractionMode.SELECTION) {
    try {
      // Convert selection to markdown
      const cleanedSelection = cleanHtml(selection.html, false);
      const normalizedSelection = normalizeUrls(
        cleanedSelection,
        window.location.href,
        includeLinks
      );
      selectionMarkdown = await htmlToMarkdown(normalizedSelection, { includeLinks });
    } catch (error) {
      // Failed to process selection
    }
  }

  // Step 3: Convert HTML to Markdown with graceful degradation (skip for RAW mode if already converted)
  let markdown = '';
  if (htmlContent && htmlContent.trim()) {
    // For RAW mode with markdown conversion enabled, content is already in markdown format
    if (extractionMethod === 'raw' && htmlContent.startsWith('#')) {
      // Content appears to already be in markdown format from raw extractor
      markdown = htmlContent;

      // If we have a selection with raw mode, still prepend it
      if (selectionMarkdown) {
        markdown = `## Selected Content\n\n${selectionMarkdown}\n\n---\n\n## Full Page Content\n\n${markdown}`;
      }
    } else if (extractionMethod === 'raw') {
      // Raw mode but still in HTML format (fallback or error case)
      markdown = htmlContent; // Use raw HTML directly

      // If we have a selection with raw mode, still prepend it
      if (selectionMarkdown) {
        markdown = `<!-- Selected Content -->\n${selectionMarkdown}\n\n<hr>\n\n<!-- Full Page Content -->\n${markdown}`;
      }
    } else {
      // For other modes, convert to markdown
      try {
        markdown = await htmlToMarkdown(htmlContent, { includeLinks });

        // If we have a selection, prepend it with a marker
        if (selectionMarkdown) {
          markdown = `## Selected Content\n\n${selectionMarkdown}\n\n---\n\n## Full Page Content\n\n${markdown}`;
        }
      } catch (error) {
        // HTML to Markdown conversion failed, falling back to text extraction

        // Graceful fallback to basic text extraction
        try {
          const parser = new DOMParser();
          const doc = parser.parseFromString(htmlContent, 'text/html');
          markdown = doc.body?.textContent || doc.body?.innerText || '';
        } catch (parseError) {
          markdown = '';
        }
      }
    }
  }

  // Step 4: Final fallback if no content extracted
  if (!markdown || !markdown.trim()) {
    try {
      markdown = document.body?.textContent || document.body?.innerText || 'No content available';
      textContent = markdown; // Use the same content for text
    } catch (domError) {
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
  let hasTables = false;

  try {
    hasTables = detectTables(markdown);
  } catch (error) {
    // Feature detection failed, defaulting to false
  }

  // Step 6: Apply character limits with error handling (skip for RAW mode)
  let clampedMarkdown = markdown;
  let isTruncated = false;

  // Skip clamping for RAW mode to preserve full HTML content
  if (extractionMethod !== 'raw') {
    try {
      const clampResult = clampText(markdown, maxLength);
      clampedMarkdown = clampResult.text;
      isTruncated = clampResult.isTruncated;
    } catch (error) {
      // If clamping fails, manually truncate as a last resort
      if (markdown.length > maxLength) {
        clampedMarkdown = markdown.substring(0, maxLength) + '...';
        isTruncated = true;
      }
    }
  }

  // Step 7: Calculate features on final content with error handling
  let excerpt = '';

  try {
    excerpt = generateExcerpt(clampedMarkdown);
  } catch (error) {
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
    content: clampedMarkdown, // Main content (markdown or raw HTML)
    textContent:
      extractionMethod === 'raw'
        ? textContent // Don't clamp raw mode text content
        : textContent.length > maxLength
          ? textContent.substring(0, maxLength - 3) + '...'
          : textContent, // Plain text version (clamped for non-raw modes)
    excerpt,
    author: author || metadata?.author, // Prefer Readability byline, then page metadata
    publishedDate: metadata?.publishedDate,
    extractedAt: Date.now(),
    extractionMethod,
    metadata: {
      hasTables,
      truncated: isTruncated,
      timeoutMs,
    },
  };

  // Returning extracted content

  const totalTime = performance.now() - stepStartTime;
  if (DEBUG) {
    // Log total time in debug mode
    void totalTime;
  } else {
    void totalTime; // Reference to avoid unused warning in production
  }

  return finalResult;
}

// =============================================================================
// Content Analysis Utilities
// =============================================================================

// Content analysis functions are now imported from analyzers/contentAnalyzer.ts

// =============================================================================
// Fallback Content Creation
// =============================================================================

/**
 * Creates minimal fallback content when extraction fails
 */
function createFallbackContent(maxLength: number, timeoutMs: number = 2000): ExtractedContent {
  // Safe metadata extraction
  let metadata: ReturnType<typeof getPageMetadata>;
  try {
    metadata = getPageMetadata(document);
  } catch (error) {
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
    try {
      // Try title as absolute last resort
      fallbackText = document.title || 'Page content unavailable';
    } catch (titleError) {
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
    url = 'about:blank';
    domain = 'unknown';
  }

  // Safe title extraction
  let title: string;
  try {
    title = metadata?.title || document.title || 'Untitled';
  } catch (error) {
    title = 'Untitled';
  }

  // Safe excerpt generation
  let excerpt: string;
  try {
    excerpt = generateExcerpt(clampedText);
  } catch (error) {
    // Simple fallback excerpt
    const cleanText = clampedText.replace(/[#*_`]/g, '').trim();
    excerpt = cleanText.length > 200 ? cleanText.substring(0, 197) + '...' : cleanText;
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
    extractionMethod: 'defuddle' as const, // Default to defuddle even on failure
    metadata: {
      hasTables: false,
      truncated: isTruncated,
      timeoutMs,
    },
  };
}
