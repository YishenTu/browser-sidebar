/**
 * @file React Hook for Content Extraction
 *
 * Custom hook that provides content extraction functionality for the sidebar,
 * integrating with the content script to extract and process page content.
 */

import { useState, useCallback, useEffect } from 'react';
import type { ExtractedContent, ExtractionOptions, ExtractionMode } from '@/types/extraction';
import { scoreContentQuality, type ContentQuality } from '@tabext/contentQuality';
import { loadExtractor } from '@tabext/extractorLoader';

/**
 * Extended extraction options with mode
 */
export interface ExtractContentOptions extends ExtractionOptions {
  /** Extraction mode to use */
  mode?: ExtractionMode;
}

/**
 * Content extraction hook return type
 */
export interface UseContentExtractionReturn {
  /** Extracted content or null if not available */
  content: ExtractedContent | null;
  /** Loading state during extraction */
  loading: boolean;
  /** Error state if extraction fails */
  error: Error | null;
  /** Content quality assessment or null if no content */
  qualityAssessment: ContentQuality | null;
  /** Function to manually trigger content extraction */
  extractContent: (options?: ExtractContentOptions) => Promise<void>;
  /** Alias to extractContent for clarity */
  reextract: (options?: ExtractContentOptions) => Promise<void>;
}

/**
 * Default extraction options
 */
const DEFAULT_OPTIONS: ExtractContentOptions = {
  includeLinks: false, // Disable links in extracted content
  timeout: 2000,
  maxLength: 200000, // Use maxLength per the type definition
  mode: 'smart' as ExtractionMode, // Default to smart mode as per refactor
};

/**
 * Hook for extracting content from the current webpage
 *
 * This hook provides an interface for triggering content extraction
 * and managing the associated state (loading, errors, content).
 *
 * @param auto - Whether to automatically extract content on mount (default: false for better test compatibility)
 * @returns Hook interface with content, loading state, error state, and extraction functions
 */
export function useContentExtraction(auto: boolean = false): UseContentExtractionReturn {
  // State management
  const [content, setContent] = useState<ExtractedContent | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [qualityAssessment, setQualityAssessment] = useState<ContentQuality | null>(null);

  /**
   * Core extraction function that directly calls the content extractor
   * For MVP, we use direct calls instead of message passing for simplicity and speed
   */
  const run = useCallback(async (options?: ExtractContentOptions): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      // Dynamically import the content extractor to keep idle bundle light
      // Using loadExtractor for better test mocking support
      const { extractContent } = await loadExtractor();

      // Merge provided options with defaults
      const mergedOptions = {
        ...DEFAULT_OPTIONS,
        ...options,
      };

      // Extract content from the current tab with specified mode
      const { mode, ...extractionOptions } = mergedOptions;
      const extractedContent = await extractContent(extractionOptions, mode);

      // Update state with extracted content
      setContent(extractedContent);

      // Calculate and set quality assessment
      const quality = scoreContentQuality(extractedContent);
      setQualityAssessment(quality);

      // Clear any previous errors
      setError(null);
    } catch (err) {
      console.error('Content extraction failed:', err);
      setError(err instanceof Error ? err : new Error('Content extraction failed'));
      setContent(null);
      setQualityAssessment(null);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Public extraction function that prevents concurrent extractions
   */
  const extractContent = useCallback(
    async (options?: ExtractContentOptions): Promise<void> => {
      // Prevent concurrent extractions
      if (loading) {
        console.warn('Extraction already in progress');
        return;
      }

      await run(options);
    },
    [loading, run]
  );

  /**
   * Reextract function (alias for extractContent)
   * Clears existing content before extracting
   */
  const reextract = useCallback(
    async (options?: ExtractContentOptions): Promise<void> => {
      // Clear existing content
      setContent(null);
      setQualityAssessment(null);
      setError(null);

      // Extract new content
      await extractContent(options);
    },
    [extractContent]
  );

  // Auto-extract on mount if requested
  useEffect(() => {
    if (auto) {
      void run();
    }
  }, [auto, run]);

  return {
    content,
    loading,
    error,
    qualityAssessment,
    extractContent,
    reextract,
  };
}
