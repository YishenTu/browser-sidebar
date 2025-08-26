/**
 * @file Content Extractor Loader
 *
 * Provides a thin wrapper for loading the content extractor module.
 * This indirection allows proper mocking in tests while maintaining
 * dynamic imports in production for optimal bundle splitting.
 */

import type { ExtractedContent, ExtractionOptions } from '@/types/extraction';

/**
 * Dynamically loads the content extractor module
 * @returns Promise resolving to the content extractor module
 */
export const loadExtractor = async () => {
  return import('@tabext/contentExtractor');
};

/**
 * Type for the loaded extractor module
 */
export interface ExtractorModule {
  extractContent: (options?: ExtractionOptions) => Promise<ExtractedContent>;
}
