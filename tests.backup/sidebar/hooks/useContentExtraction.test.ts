/**
 * @file Tests for useContentExtraction Hook
 *
 * Tests the content extraction hook functionality including manual extraction,
 * auto-extraction, error handling, and loading states.
 *
 * Updated to properly mock the extractor loader and align with actual implementation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useContentExtraction } from '../../../src/sidebar/hooks/useContentExtraction';
import type { ExtractedContent } from '../../../src/types/extraction';

// Create mock function for extractContent
const mockExtractContent = vi.fn();

// Mock the extractorLoader module
vi.mock('@tabext/extractorLoader', () => ({
  loadExtractor: vi.fn(() =>
    Promise.resolve({
      extractContent: mockExtractContent,
    })
  ),
}));

// Mock content extraction data
const mockExtractedContent: ExtractedContent = {
  title: 'Test Page',
  url: 'https://example.com',
  domain: 'example.com',
  markdown: '# Test Page\n\nThis is test content.',
  excerpt: 'This is test content...',
  wordCount: 42,
  extractionMethod: 'readability',
  hasCode: false,
  hasTables: false,
  isTruncated: false,
  extractionTime: 250,
};


describe('useContentExtraction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExtractContent.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial State', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useContentExtraction());

      expect(result.current).toBeTruthy();
      expect(result.current.content).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(typeof result.current.extractContent).toBe('function');
      expect(typeof result.current.reextract).toBe('function');
    });
  });

  describe('Manual Extraction', () => {
    it('should extract content successfully with default options', async () => {
      // Mock successful extraction
      mockExtractContent.mockResolvedValue(mockExtractedContent);

      const { result } = renderHook(() => useContentExtraction());

      await act(async () => {
        await result.current.extractContent();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.content).toEqual(mockExtractedContent);
      expect(result.current.error).toBeNull();

      // Should be called with merged defaults
      expect(mockExtractContent).toHaveBeenCalledWith({
        includeLinks: false,
        timeout: 2000,
        maxLength: 200000, // Using maxLength per the type definition
      }, "defuddle");
    });

    it('should handle extraction errors', async () => {
      // Mock extraction error
      const errorMessage = 'Content extraction failed';
      mockExtractContent.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useContentExtraction());

      await act(async () => {
        await result.current.extractContent();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.content).toBeNull();
      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toContain(errorMessage);
    });

    it('should handle timeout errors', async () => {
      // Mock timeout error
      const timeoutError = new Error('Extraction timeout (2000ms)');
      mockExtractContent.mockRejectedValue(timeoutError);

      const { result } = renderHook(() => useContentExtraction());

      await act(async () => {
        await result.current.extractContent();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.content).toBeNull();
      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toContain('timeout');
    });

    it('should handle extraction with custom options', async () => {
      mockExtractContent.mockResolvedValue(mockExtractedContent);

      const { result } = renderHook(() => useContentExtraction());

      await act(async () => {
        await result.current.extractContent({
          includeLinks: false,
          timeout: 5000,
          maxLength: 100000, // Using maxLength
        });
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should merge custom options with defaults
      expect(mockExtractContent).toHaveBeenCalledWith({
        includeLinks: false,
        timeout: 5000,
        maxLength: 100000,
      }, "defuddle");
      expect(result.current.content).toEqual(mockExtractedContent);
    });
  });

  describe('Auto-extraction', () => {
    it('should auto-extract content on mount when auto=true', async () => {
      // Mock successful extraction
      mockExtractContent.mockResolvedValue(mockExtractedContent);

      const { result } = renderHook(() => useContentExtraction(true));

      // Wait for the extraction to complete
      await waitFor(
        () => {
          expect(result.current).toBeTruthy();
          expect(result.current.content).not.toBeNull();
        },
        { timeout: 3000 }
      );

      expect(result.current.content).toEqual(mockExtractedContent);
      expect(result.current.error).toBeNull();
      expect(mockExtractContent).toHaveBeenCalledTimes(1);
    });

    it('should not auto-extract when auto=false', async () => {
      const { result } = renderHook(() => useContentExtraction(false));

      // Wait a bit to ensure no extraction is triggered
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(result.current).toBeTruthy();
      expect(result.current.content).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(mockExtractContent).not.toHaveBeenCalled();
    });

    it('should not auto-extract by default', async () => {
      const { result } = renderHook(() => useContentExtraction());

      // Wait a bit to ensure no extraction is triggered
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(result.current).toBeTruthy();
      expect(result.current.content).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(mockExtractContent).not.toHaveBeenCalled();
    });
  });

  describe('Reextraction', () => {
    it('should clear previous content before reextracting', async () => {
      // First extraction
      mockExtractContent.mockResolvedValue(mockExtractedContent);

      const { result } = renderHook(() => useContentExtraction());

      await act(async () => {
        await result.current.extractContent();
      });

      await waitFor(() => {
        expect(result.current).toBeTruthy();
        expect(result.current.content).toEqual(mockExtractedContent);
      });

      // Clear mocks for reextraction
      vi.clearAllMocks();

      // Mock different content for reextraction
      const newContent = { ...mockExtractedContent, title: 'Updated Page' };
      mockExtractContent.mockResolvedValue(newContent);

      // Reextract
      await act(async () => {
        await result.current.reextract();
      });

      await waitFor(() => {
        expect(result.current).toBeTruthy();
        expect(result.current.content).toEqual(newContent);
      });

      expect(result.current.error).toBeNull();
      expect(mockExtractContent).toHaveBeenCalledTimes(1);
    });

    it('should clear error state when reextracting after error', async () => {
      // First extraction with error
      mockExtractContent.mockRejectedValue(new Error('Initial error'));

      const { result } = renderHook(() => useContentExtraction());

      await act(async () => {
        await result.current.extractContent();
      });

      await waitFor(() => {
        expect(result.current.error).toBeInstanceOf(Error);
      });

      // Clear mocks for successful reextraction
      vi.clearAllMocks();
      mockExtractContent.mockResolvedValue(mockExtractedContent);

      // Reextract successfully
      await act(async () => {
        await result.current.reextract();
      });

      await waitFor(() => {
        expect(result.current.content).toEqual(mockExtractedContent);
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('Loading States', () => {
    it('should set loading state during extraction', async () => {
      // Create a promise we can control
      let resolveExtraction: (value: ExtractedContent) => void;
      const extractionPromise = new Promise<ExtractedContent>(resolve => {
        resolveExtraction = resolve;
      });
      mockExtractContent.mockReturnValue(extractionPromise);

      const { result } = renderHook(() => useContentExtraction());

      // Start extraction (don't await it)
      act(() => {
        result.current.extractContent();
      });

      // Check loading state is true immediately
      expect(result.current.loading).toBe(true);
      expect(result.current.content).toBeNull();

      // Resolve the extraction
      await act(async () => {
        resolveExtraction!(mockExtractedContent);
        await extractionPromise;
      });

      // After extraction completes, should not be loading and should have content
      await waitFor(() => {
        expect(result.current).toBeTruthy();
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.content).toEqual(mockExtractedContent);
      expect(result.current.error).toBeNull();
    });

    it('should handle concurrent extraction requests', async () => {
      // First extraction that takes time
      let resolveFirst: (value: ExtractedContent) => void;
      const firstPromise = new Promise<ExtractedContent>(resolve => {
        resolveFirst = resolve;
      });
      mockExtractContent.mockReturnValueOnce(firstPromise);

      const { result } = renderHook(() => useContentExtraction());

      // Start first extraction
      act(() => {
        result.current.extractContent();
      });

      expect(result.current.loading).toBe(true);

      // Try to start second extraction while first is in progress
      // Should be ignored since loading is true
      act(() => {
        result.current.extractContent();
      });

      // Complete first extraction
      await act(async () => {
        resolveFirst!(mockExtractedContent);
        await firstPromise;
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.content).toEqual(mockExtractedContent);
      // Should only have called extractContent once
      expect(mockExtractContent).toHaveBeenCalledTimes(1);
    });
  });


  describe('Option Merging', () => {
    it('should merge partial options with defaults', async () => {
      mockExtractContent.mockResolvedValue(mockExtractedContent);

      const { result } = renderHook(() => useContentExtraction());

      // Pass only one option
      await act(async () => {
        await result.current.extractContent({
          timeout: 3000,
        });
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should merge with other defaults
      expect(mockExtractContent).toHaveBeenCalledWith({
        includeLinks: false,
        timeout: 3000, // Custom
        maxLength: 200000, // Default
      }, "defuddle");
    });

    it('should use all defaults when no options provided', async () => {
      mockExtractContent.mockResolvedValue(mockExtractedContent);

      const { result } = renderHook(() => useContentExtraction());

      await act(async () => {
        await result.current.extractContent();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should use all defaults
      expect(mockExtractContent).toHaveBeenCalledWith({
        includeLinks: false,
        timeout: 2000,
        maxLength: 200000,
      }, "defuddle");
    });
  });
});
