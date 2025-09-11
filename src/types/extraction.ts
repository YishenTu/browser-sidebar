/**
 * @file Tab Content Extraction Type Definitions
 *
 * Type definitions for the content extraction system that captures and
 * processes web page content for AI analysis. Includes interfaces for
 * extracted content and extraction configuration options.
 */

// ============================================================================
// Core Types
// ============================================================================

/**
 * Method used to extract content from a web page
 */
export type ExtractionMethod = 'defuddle' | 'selection' | 'raw' | 'readability';

/**
 * Extraction mode for content capture
 */
export enum ExtractionMode {
  DEFUDDLE = 'defuddle', // Defuddle extraction
  SELECTION = 'selection', // Selection-only extraction
  RAW = 'raw', // Raw mode extraction (preserves tables)
  READABILITY = 'readability', // Mozilla Readability extraction (default)
}

// ============================================================================
// Extraction Interfaces
// ============================================================================

/**
 * Structured content extracted from a web page
 *
 * This interface represents the complete extraction result after processing
 * web page content through various extraction methods like Readability.js
 * or fallback techniques.
 */
export interface ExtractedContent {
  /** Page title extracted from document title or meta tags */
  title: string;

  /** Full URL of the extracted page */
  url: string;

  /** Domain name of the source website */
  domain: string;

  /** Main content converted to markdown format */
  content: string;

  /** Main content in markdown format (alias for compatibility) */
  markdown?: string;

  /** Plain text version of the content */
  textContent: string;

  /** Word count of the extracted content */
  wordCount?: number;

  /** Brief excerpt or summary of the content (first ~200 chars) */
  excerpt?: string;

  /** Article author if available */
  author?: string;

  /** Publication date if available from meta tags or content */
  publishedDate?: string;

  /** Unix timestamp of when extraction was performed */
  extractedAt: number;

  /** Method used to extract the content */
  extractionMethod: ExtractionMethod;

  /** Whether content was truncated due to size limits */
  isTruncated?: boolean;

  /** Content metadata and statistics */
  metadata?: {
    /** Whether the content contains data tables */
    hasTables: boolean;
    /** Whether content was truncated due to size limits */
    truncated?: boolean;
    /** Effective timeout used in milliseconds */
    timeoutMs?: number;
    /** Schema.org JSON-LD data (internal use) */
    schemaOrgData?: unknown;
    /** Meta tags extracted from the page (internal use) */
    metaTags?: Array<Record<string, string>>;
  };
}

/**
 * Configuration options for content extraction
 *
 * These options control how content is extracted from web pages,
 * including performance limits and content filtering preferences.
 */
export interface ExtractionOptions {
  /** Whether to include links in the extracted content (default: true) */
  includeLinks?: boolean;

  /** Maximum number of characters in the output (default: 200000) */
  maxLength?: number;

  /** Maximum time to wait for extraction before timing out (default: 2000ms) */
  timeout?: number;
}

// ============================================================================
// Default Values
// ============================================================================

/**
 * Default extraction options
 */
export const DEFAULT_EXTRACTION_OPTIONS = {
  includeLinks: false, // Default to removing links from content
  maxLength: 200000,
  timeout: 2000,
};

// ============================================================================
// Type Guards and Validation
// ============================================================================

/**
 * Type guard to check if an object is a valid ExtractedContent
 */
export function isExtractedContent(obj: unknown): obj is ExtractedContent {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const content = obj as Record<string, unknown>;
  const metadata = content['metadata'] as Record<string, unknown> | undefined;

  return (
    typeof content['title'] === 'string' &&
    typeof content['url'] === 'string' &&
    typeof content['domain'] === 'string' &&
    typeof content['content'] === 'string' &&
    (content['markdown'] === undefined || typeof content['markdown'] === 'string') &&
    typeof content['textContent'] === 'string' &&
    (content['wordCount'] === undefined || typeof content['wordCount'] === 'number') &&
    (content['isTruncated'] === undefined || typeof content['isTruncated'] === 'boolean') &&
    (content['excerpt'] === undefined || typeof content['excerpt'] === 'string') &&
    (content['author'] === undefined || typeof content['author'] === 'string') &&
    (content['publishedDate'] === undefined || typeof content['publishedDate'] === 'string') &&
    typeof content['extractedAt'] === 'number' &&
    ['defuddle', 'selection', 'raw', 'readability'].includes(
      content['extractionMethod'] as string
    ) &&
    (metadata === undefined ||
      (typeof metadata === 'object' &&
        metadata !== null &&
        typeof metadata['hasTables'] === 'boolean'))
  );
}

/**
 * Type guard to check if an object is valid ExtractionOptions
 */
export function isExtractionOptions(obj: unknown): obj is ExtractionOptions {
  const o = obj as Record<string, unknown>;
  return (
    typeof obj === 'object' &&
    obj !== null &&
    (o['timeout'] === undefined || (typeof o['timeout'] === 'number' && o['timeout'] > 0)) &&
    (o['includeLinks'] === undefined || typeof o['includeLinks'] === 'boolean') &&
    (o['maxLength'] === undefined || (typeof o['maxLength'] === 'number' && o['maxLength'] > 0))
  );
}

/**
 * Validates and normalizes extraction options with defaults
 */
export function validateExtractionOptions(
  options: ExtractionOptions = {}
): Required<Pick<ExtractionOptions, 'includeLinks' | 'maxLength' | 'timeout'>> {
  const maxLength = options.maxLength ?? DEFAULT_EXTRACTION_OPTIONS.maxLength;

  const normalized = {
    includeLinks: options.includeLinks ?? DEFAULT_EXTRACTION_OPTIONS.includeLinks,
    maxLength,
    timeout: options.timeout ?? DEFAULT_EXTRACTION_OPTIONS.timeout,
  };

  // Validate ranges
  if (normalized.timeout <= 0) {
    normalized.timeout = DEFAULT_EXTRACTION_OPTIONS.timeout;
  }

  if (normalized.maxLength <= 0) {
    normalized.maxLength = DEFAULT_EXTRACTION_OPTIONS.maxLength;
  }

  return normalized;
}
