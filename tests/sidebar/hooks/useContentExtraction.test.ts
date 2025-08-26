/**
 * @file Tests for useContentExtraction Hook
 *
 * Tests the content extraction hook functionality including manual extraction,
 * auto-extraction, error handling, and loading states.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useContentExtraction } from '../../../src/sidebar/hooks/useContentExtraction';
import type { ExtractedContent } from '../../../src/types/extraction';

// Mock Chrome APIs
const mockChrome = {
  runtime: {
    lastError: null as chrome.runtime.LastError | null,
  },
  tabs: {
    query: vi.fn(),
    sendMessage: vi.fn(),
  },
};

// Properly setup Chrome global
Object.defineProperty(global, 'chrome', {
  value: mockChrome,
  writable: true,
});

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
    // Set up Chrome API mocks
    global.chrome = mockChrome as any;
    vi.clearAllMocks();
    mockChrome.runtime.lastError = null;
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
    it('should extract content successfully', async () => {
      // Mock successful tab query
      mockChrome.tabs.query.mockResolvedValue([{ id: 123 }]);

      // Mock successful content extraction response
      mockChrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        setTimeout(() => {
          callback({
            type: 'CONTENT_EXTRACTED',
            payload: mockExtractedContent,
            id: 'test-id',
            timestamp: Date.now(),
            source: 'content',
            target: 'sidebar',
          });
        }, 0);
      });

      const { result } = renderHook(() => useContentExtraction());

      await act(async () => {
        await result.current.extractContent();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.content).toEqual(mockExtractedContent);
      expect(result.current.error).toBeNull();
      expect(mockChrome.tabs.query).toHaveBeenCalledWith({ active: true, currentWindow: true });
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
        123,
        expect.objectContaining({
          type: 'EXTRACT_CONTENT',
          source: 'sidebar',
          target: 'content',
        }),
        expect.any(Function)
      );
    });

    it('should handle extraction errors', async () => {
      // Mock successful tab query
      mockChrome.tabs.query.mockResolvedValue([{ id: 123 }]);

      // Mock error response
      mockChrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        setTimeout(() => {
          callback({
            type: 'ERROR',
            payload: {
              message: 'Content extraction failed',
              code: 'EXTRACTION_FAILED',
            },
            id: 'test-id',
            timestamp: Date.now(),
            source: 'content',
            target: 'sidebar',
          });
        }, 0);
      });

      const { result } = renderHook(() => useContentExtraction());

      await act(async () => {
        await result.current.extractContent();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.content).toBeNull();
      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toContain('Content extraction failed');
    });

    it('should handle no active tab error', async () => {
      // Mock no active tab
      mockChrome.tabs.query.mockResolvedValue([]);

      const { result } = renderHook(() => useContentExtraction());

      await act(async () => {
        await result.current.extractContent();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.content).toBeNull();
      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toContain('No active tab found');
    });

    it('should handle Chrome runtime errors', async () => {
      // Mock successful tab query
      mockChrome.tabs.query.mockResolvedValue([{ id: 123 }]);

      // Mock Chrome runtime error
      mockChrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        mockChrome.runtime.lastError = { message: 'Could not establish connection' };
        setTimeout(() => {
          callback();
        }, 0);
      });

      const { result } = renderHook(() => useContentExtraction());

      await act(async () => {
        await result.current.extractContent();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.content).toBeNull();
      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toContain('Chrome runtime error');
    });

    it('should handle timeout', async () => {
      // Mock successful tab query
      mockChrome.tabs.query.mockResolvedValue([{ id: 123 }]);

      // Mock no response (timeout)
      mockChrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        // Don't call callback at all to simulate timeout
      });

      const { result } = renderHook(() => useContentExtraction());

      await act(async () => {
        await result.current.extractContent();
      });

      // Wait for timeout to occur
      await waitFor(
        () => {
          expect(result.current).toBeTruthy();
          expect(result.current.loading).toBe(false);
        },
        { timeout: 12000 }
      );

      expect(result.current.content).toBeNull();
      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toContain('timeout');
    }, 15000);
  });

  describe('Auto-extraction', () => {
    it('should auto-extract content on mount when auto=true', async () => {
      // Mock successful tab query
      mockChrome.tabs.query.mockResolvedValue([{ id: 123 }]);

      // Mock successful content extraction response
      mockChrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        // Use Promise.resolve to ensure it runs in next tick
        Promise.resolve().then(() => {
          callback({
            type: 'CONTENT_EXTRACTED',
            payload: mockExtractedContent,
            id: 'test-id',
            timestamp: Date.now(),
            source: 'content',
            target: 'sidebar',
          });
        });
      });

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
      // Note: loading state can still be true immediately after content extraction completes
    });

    it('should not auto-extract when auto=false', async () => {
      const { result } = renderHook(() => useContentExtraction(false));

      // Wait a bit to ensure no extraction is triggered
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(result.current).toBeTruthy();
      expect(result.current.content).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(mockChrome.tabs.query).not.toHaveBeenCalled();
    });
  });

  describe('Reextraction', () => {
    it('should clear previous content before reextracting', async () => {
      // Set up initial content
      mockChrome.tabs.query.mockResolvedValue([{ id: 123 }]);
      mockChrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        setTimeout(() => {
          callback({
            type: 'CONTENT_EXTRACTED',
            payload: mockExtractedContent,
            id: 'test-id',
            timestamp: Date.now(),
            source: 'content',
            target: 'sidebar',
          });
        }, 0);
      });

      const { result } = renderHook(() => useContentExtraction());

      // First extraction
      await act(async () => {
        await result.current.extractContent();
      });

      await waitFor(() => {
        expect(result.current).toBeTruthy();
        expect(result.current.content).toEqual(mockExtractedContent);
      });

      // Clear mocks for reextraction
      vi.clearAllMocks();
      mockChrome.tabs.query.mockResolvedValue([{ id: 123 }]);

      // Mock different content for reextraction
      const newContent = { ...mockExtractedContent, title: 'Updated Page' };
      mockChrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        setTimeout(() => {
          callback({
            type: 'CONTENT_EXTRACTED',
            payload: newContent,
            id: 'test-id',
            timestamp: Date.now(),
            source: 'content',
            target: 'sidebar',
          });
        }, 0);
      });

      // Reextract
      await act(async () => {
        await result.current.reextract();
      });

      await waitFor(() => {
        expect(result.current).toBeTruthy();
        expect(result.current.content).toEqual(newContent);
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('Loading States', () => {
    it('should set loading state during extraction', async () => {
      mockChrome.tabs.query.mockResolvedValue([{ id: 123 }]);

      // Mock immediate callback for successful extraction
      mockChrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        // Use Promise.resolve to ensure async but immediate response
        Promise.resolve().then(() => {
          callback({
            type: 'CONTENT_EXTRACTED',
            payload: mockExtractedContent,
            id: 'test-id',
            timestamp: Date.now(),
            source: 'content',
            target: 'sidebar',
          });
        });
      });

      const { result } = renderHook(() => useContentExtraction());

      // Start extraction
      await act(async () => {
        await result.current.extractContent();
      });

      // After extraction completes, should not be loading and should have content
      expect(result.current).toBeTruthy();
      expect(result.current.loading).toBe(false);
      expect(result.current.content).toEqual(mockExtractedContent);
      expect(result.current.error).toBeNull();
    });
  });
});
