/**
 * @file Content Extractor Orchestrator (Simplified)
 *
 * Main extraction orchestrator that coordinates the content extraction pipeline
 * with timeout enforcement. Supports three extraction methods that users can
 * manually select: Readability (default), Raw HTML, and Defuddle.
 * Each extraction method handles its own processing internally.
 */

import type { ExtractedContent, ExtractionOptions } from '../../types/extraction';
import { validateExtractionOptions, ExtractionMode } from '../../types/extraction';

// Debug flag - disable in production
const DEBUG = false;

// =============================================================================
// Dynamic Import Caching
// =============================================================================

// Cache for dynamically imported modules to avoid reloading
let defuddleExtractorModule: typeof import('./extractors/defuddle') | null = null;
let readabilityExtractorModule: typeof import('./extractors/readability') | null = null;
let rawExtractorModule: typeof import('./extractors/raw') | null = null;

/**
 * Loads the Defuddle extractor with caching and error handling
 */
async function getDefuddleExtractor() {
  if (!defuddleExtractorModule) {
    try {
      defuddleExtractorModule = await import('./extractors/defuddle');
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Loading error for defuddle extractor: ${error.message}`);
      }
      throw new Error(`Unknown error loading defuddle extractor: ${error}`);
    }
  }
  return defuddleExtractorModule;
}

/**
 * Loads the Readability extractor with caching and error handling
 */
async function getReadabilityExtractor() {
  if (!readabilityExtractorModule) {
    try {
      readabilityExtractorModule = await import('./extractors/readability');
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Loading error for readability extractor: ${error.message}`);
      }
      throw new Error(`Unknown error loading readability extractor: ${error}`);
    }
  }
  return readabilityExtractorModule;
}

/**
 * Loads the Raw extractor with caching and error handling
 */
async function getRawExtractor() {
  if (!rawExtractorModule) {
    try {
      rawExtractorModule = await import('./extractors/raw');
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Loading error for raw extractor: ${error.message}`);
      }
      throw new Error(`Unknown error loading raw extractor: ${error}`);
    }
  }
  return rawExtractorModule;
}

// =============================================================================
// Default Mode Toggle (runtime)
// =============================================================================

// Module-level default extraction mode. Users can manually select between
// three methods: Readability (default), Raw HTML, or Defuddle.
let defaultExtractionMode: ExtractionMode = ExtractionMode.READABILITY;

export function setDefaultExtractionMode(mode: ExtractionMode): void {
  defaultExtractionMode = mode;
}

export function getDefaultExtractionMode(): ExtractionMode {
  return defaultExtractionMode;
}

// =============================================================================
// Main Extraction Function
// =============================================================================

/**
 * Extracts content from the current page using the selected method
 *
 * Three extraction methods available:
 * 1. Readability - Clean, reader-friendly extraction (default)
 * 2. Raw HTML - Preserves HTML structure with configurable stripping
 * 3. Defuddle - Alternative extraction using the Defuddle library
 *
 * @param opts - Extraction configuration options
 * @param mode - Extraction mode to use
 * @returns Promise resolving to structured content data
 */
export async function extractContent(
  opts?: ExtractionOptions,
  mode?: ExtractionMode
): Promise<ExtractedContent> {
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

    // Resolve effective mode: honor explicit request, otherwise use module default
    const effectiveMode = mode ?? getDefaultExtractionMode();

    const extractionPromise = performExtraction(includeLinks, maxLength, timeout, effectiveMode);
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

    // Re-throw the error - let the caller handle it
    throw error;
  }
}

// =============================================================================
// Core Extraction Logic (Simplified)
// =============================================================================

/**
 * Performs the actual extraction without timeout handling
 * Each extraction method handles its own processing internally
 */
async function performExtraction(
  includeLinks: boolean,
  _maxLength: number, // Kept for API compatibility but not used
  timeoutMs: number,
  mode: ExtractionMode = ExtractionMode.READABILITY
): Promise<ExtractedContent> {
  let result: ExtractedContent | null = null;

  // Execute the selected extraction method
  // Each method handles its own processing internally
  switch (mode) {
    case ExtractionMode.READABILITY:
      try {
        const readabilityExtractor = await getReadabilityExtractor();
        result = await readabilityExtractor.extractWithReadability({
          includeLinks,
          debug: DEBUG,
        });
      } catch (error) {
        if (DEBUG) {
          console.error('[READABILITY] Extraction failed:', error);
        }
        throw error;
      }
      break;

    case ExtractionMode.RAW:
      try {
        const rawExtractor = await getRawExtractor();
        // Raw extractor uses its own default settings
        result = await rawExtractor.extractWithRaw();
      } catch (error) {
        if (DEBUG) {
          console.error('[RAW] Extraction failed:', error);
        }
        throw error;
      }
      break;

    case ExtractionMode.DEFUDDLE:
      try {
        const defuddleExtractor = await getDefuddleExtractor();
        // Pass the full HTML snapshot for Defuddle to process
        const originalHtmlSnapshot = document.documentElement?.outerHTML || '';
        result = await defuddleExtractor.extractWithDefuddle(originalHtmlSnapshot);
      } catch (error) {
        if (DEBUG) {
          console.error('[DEFUDDLE] Extraction failed:', error);
        }
        throw error;
      }
      break;

    case ExtractionMode.SELECTION: {
      // Special case: extract only selected text
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
        const range = selection.getRangeAt(0);
        const container = document.createElement('div');
        container.appendChild(range.cloneContents());

        result = {
          title: document.title || 'Selection',
          url: window.location.href,
          domain: window.location.hostname,
          content: selection.toString(),
          textContent: selection.toString(),
          excerpt: selection.toString().substring(0, 200),
          extractedAt: Date.now(),
          extractionMethod: 'selection',
          metadata: {
            hasTables: false,
            truncated: false,
            timeoutMs,
          },
        };
      } else {
        throw new Error('No text selected');
      }
      break;
    }

    default:
      throw new Error(`Unknown extraction mode: ${mode}`);
  }

  if (!result) {
    throw new Error('Extraction failed - no content returned');
  }

  // No text clamping - return full content

  return result;
}
