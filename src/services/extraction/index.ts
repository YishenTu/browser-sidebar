/**
 * @file Extraction Service Module
 *
 * Main export module for content extraction services.
 * Provides a high-level API for extracting content from browser tabs
 * with retry logic, error handling, and proper TypeScript types.
 */

export {
  ExtractionService,
  ExtractionError,
  ExtractionErrorType,
  createExtractionService,
  defaultExtractionService,
  extractCurrentTab,
  extractTabs,
} from './ExtractionService';

export type {
  ServiceExtractionOptions,
  ExtractionResult,
  BatchExtractionResult,
} from './ExtractionService';
