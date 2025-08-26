/**
 * @file React Hook for Content Extraction
 *
 * Custom hook that provides content extraction functionality for the sidebar,
 * integrating with the content script to extract and process page content.
 */

import { useState, useCallback, useEffect } from 'react';
import type { ExtractedContent, ExtractionOptions } from '@/types/extraction';

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
  /** Function to manually trigger content extraction */
  extractContent: () => Promise<void>;
  /** Alias to extractContent for clarity */
  reextract: (options?: ExtractionOptions) => Promise<void>;
}

/**
 * Custom hook for extracting content from the current tab
 *
 * Provides content extraction functionality by communicating with the content
 * script to extract and process web page content using various extraction methods.
 *
 * @param auto - Whether to automatically extract content on mount (default: true)
 * @returns Hook interface with content, loading state, error state, and extraction functions
 */
export function useContentExtraction(auto: boolean = true): UseContentExtractionReturn {
  // State management
  const [content, setContent] = useState<ExtractedContent | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Core extraction function that directly calls the content extractor
   * For MVP, we use direct calls instead of message passing for simplicity and speed
   */
  const run = useCallback(async (options?: ExtractionOptions): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      // Dynamically import the content extractor to keep initial bundle light
      const { extractContent } = await import('@tabext/contentExtractor');

      // Extract content directly (we're in the same context as content script)
      const result = await extractContent(options);

      // Update state with the extracted content
      setContent(result);

      // Content extraction successful
    } catch (err) {
      // Handle extraction errors gracefully
      const errorMessage = err instanceof Error ? err.message : String(err);
      const error = new Error(errorMessage);
      setError(error);
      // Content extraction failed - error already captured in state
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Public extraction function
   */
  const extractContent = useCallback(async (): Promise<void> => {
    await run();
  }, [run]);

  /**
   * Reextraction function with optional new options
   */
  const reextract = useCallback(
    async (options?: ExtractionOptions): Promise<void> => {
      await run(options);
    },
    [run]
  );

  // Auto-extraction on mount
  useEffect(() => {
    if (auto) {
      void run();
    }
  }, [auto, run]);

  return {
    content,
    loading,
    error,
    extractContent,
    reextract,
  };
}
