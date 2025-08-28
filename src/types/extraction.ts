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
export type ExtractionMethod = 'defuddle' | 'selection';

/**
 * Extraction mode for content capture
 */
export enum ExtractionMode {
  DEFUDDLE = 'defuddle', // Defuddle extraction (default)
  SELECTION = 'selection', // Selection-only extraction
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

  /** Plain text version of the content */
  textContent: string;

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

  /** Content metadata and statistics */
  metadata?: {
    /** Whether the content contains code blocks */
    hasCodeBlocks: boolean;
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
export function isExtractedContent(obj: any): obj is ExtractedContent {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.title === 'string' &&
    typeof obj.url === 'string' &&
    typeof obj.domain === 'string' &&
    typeof obj.content === 'string' &&
    typeof obj.textContent === 'string' &&
    (obj.excerpt === undefined || typeof obj.excerpt === 'string') &&
    (obj.author === undefined || typeof obj.author === 'string') &&
    (obj.publishedDate === undefined || typeof obj.publishedDate === 'string') &&
    typeof obj.extractedAt === 'number' &&
    ['defuddle', 'selection'].includes(obj.extractionMethod) &&
    (obj.metadata === undefined ||
      (typeof obj.metadata === 'object' &&
        typeof obj.metadata.hasCodeBlocks === 'boolean' &&
        typeof obj.metadata.hasTables === 'boolean'))
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
    (o['maxLength'] === undefined || (typeof o['maxLength'] === 'number' && o['maxLength'] > 0)) &&
    (o['maxOutputChars'] === undefined ||
      (typeof o['maxOutputChars'] === 'number' && o['maxOutputChars'] > 0))
  );
}

/**
 * Validates and normalizes extraction options with defaults
 */
export function validateExtractionOptions(
  options: ExtractionOptions = {}
): Required<Pick<ExtractionOptions, 'includeLinks' | 'maxLength' | 'timeout'>> {
  // Handle backward compatibility
  const maxLength =
    options.maxLength ?? options.maxOutputChars ?? DEFAULT_EXTRACTION_OPTIONS.maxLength;

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
