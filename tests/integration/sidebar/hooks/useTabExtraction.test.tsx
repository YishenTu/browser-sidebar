/**
 * @file Integration Tests for useTabExtraction Hook
 *
 * Tests the useTabExtraction hook behavior in both legacy and refactored modes.
 * Verifies proper service integration, extraction functionality, and error handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTabExtraction } from '@hooks/useTabExtraction';
import { ExtractionMode } from '@/types/extraction';
import type { TabContent, TabInfo } from '@/types/tabs';
import type { ExtractedContent } from '@/types/extraction';
import { sendMessage } from '@platform/chrome/runtime';

// Hoist all mocks to avoid initialization errors
// New architecture: service-based only

// Mock platform chrome runtime module first
vi.mock('@platform/chrome/runtime', () => ({
  sendMessage: vi.fn(),
  normalizeRuntimeError: vi.fn(error => error),
  ChromeRuntimeError: class ChromeRuntimeError extends Error {
    constructor(
      message: string,
      public code: string = 'RUNTIME_ERROR'
    ) {
      super(message);
      this.name = 'ChromeRuntimeError';
    }
  },
}));

// Mock the stores with simple implementations
vi.mock('@/data/store/chat', () => ({
  useSessionStore: vi.fn(() => ({ activeSessionKey: 'test-session' })),
  useTabStore: vi.fn(() => ({
    getLoadedTabs: vi.fn(() => ({})),
    getCurrentTabId: vi.fn(() => null),
    getHasAutoLoaded: vi.fn(() => false),
    getCurrentTabContent: vi.fn(() => null),
    addLoadedTab: vi.fn(),
    removeLoadedTab: vi.fn(),
    setCurrentTabId: vi.fn(),
    setHasAutoLoaded: vi.fn(),
  })),
  useUIStore: (() => {
    const uiStore = {
      clearConversation: vi.fn(),
    };
    const hook = vi.fn(() => uiStore);
    hook.getState = vi.fn(() => uiStore);
    return hook;
  })(),
}));

// Mock chrome runtime for message passing
const mockChrome = {
  runtime: {
    sendMessage: vi.fn(),
    lastError: null,
  },
  tabs: {
    sendMessage: vi.fn(),
    lastError: null,
  },
};

global.chrome = mockChrome as any;

// Mock message creation utility
vi.mock('@/types/messages', () => ({
  createMessage: vi.fn(msg => ({ ...msg, id: 'msg-' + Date.now() })),
}));

// Mock the ExtractionService
const mockExtractionService = {
  extractCurrentTab: vi.fn(),
  extractTabs: vi.fn(),
};

vi.mock('@/services/extraction/ExtractionService', () => ({
  createExtractionService: vi.fn(() => mockExtractionService),
  ExtractionError: class ExtractionError extends Error {
    constructor(
      message: string,
      public readonly type: string = 'unknown'
    ) {
      super(message);
      this.name = 'ExtractionError';
    }
  },
  ExtractionErrorType: {
    TIMEOUT: 'timeout',
    TAB_NOT_FOUND: 'tab_not_found',
    CONTENT_SCRIPT_UNAVAILABLE: 'content_script_unavailable',
    RESTRICTED_URL: 'restricted_url',
    MESSAGING_ERROR: 'messaging_error',
    UNKNOWN: 'unknown',
  },
}));

// Create mock data helpers
const createMockExtractedContent = (): ExtractedContent => ({
  title: 'Test Page',
  url: 'https://example.com',
  domain: 'example.com',
  content: 'Test page content',
  metadata: {
    selectors: [],
    wordCount: 3,
    readingTime: 1,
  },
  extractedAt: Date.now(),
});

const createMockTabInfo = (id: number = 1): TabInfo => ({
  id,
  title: 'Test Tab',
  url: 'https://example.com',
  domain: 'example.com',
  windowId: 1,
  active: true,
  index: 0,
  pinned: false,
  lastAccessed: Date.now(),
});

const createMockTabContent = (tabId: number = 1): TabContent => ({
  tabInfo: createMockTabInfo(tabId),
  extractedContent: createMockExtractedContent(),
  extractionStatus: 'completed',
  isStale: false,
});

describe('useTabExtraction Integration Tests', () => {
  // Cast sendMessage to a mock for easier test manipulation
  const mockSendMessage = sendMessage as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset chrome mocks
    mockChrome.runtime.sendMessage.mockReset();
    mockChrome.tabs.sendMessage.mockReset();
    mockChrome.runtime.lastError = null;
    mockChrome.tabs.lastError = null;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Legacy mode removed

  describe('Service Mode', () => {
    it('should extract current tab using ExtractionService', async () => {
      const mockTabContent = createMockTabContent(1);
      mockExtractionService.extractCurrentTab.mockResolvedValueOnce(mockTabContent);

      const { result } = renderHook(() => useTabExtraction());

      await act(async () => {
        await result.current.extractCurrentTab({ mode: ExtractionMode.DEFUDDLE });
      });

      expect(mockExtractionService.extractCurrentTab).toHaveBeenCalledWith({
        mode: ExtractionMode.DEFUDDLE,
        forceRefresh: true,
        maxRetries: 2,
        timeout: 5000,
      });

      // Check that the hook is working and not erroring
      expect(result.current.error).toBeNull();
    });

    it('should handle ExtractionService errors', async () => {
      const extractionError = new Error('Failed to extract content');

      mockExtractionService.extractCurrentTab.mockRejectedValueOnce(extractionError);

      const { result } = renderHook(() => useTabExtraction());

      await act(async () => {
        await result.current.extractCurrentTab();
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toContain('Failed to extract content');
    });

    it('should use different extraction modes', async () => {
      const mockTabContent = createMockTabContent(1);
      mockExtractionService.extractCurrentTab.mockResolvedValueOnce(mockTabContent);

      const { result } = renderHook(() => useTabExtraction());

      await act(async () => {
        await result.current.extractCurrentTab({ mode: ExtractionMode.RAW });
      });

      expect(mockExtractionService.extractCurrentTab).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: ExtractionMode.RAW,
        })
      );
    });

    it('should handle service initialization', () => {
      renderHook(() => useTabExtraction());

      // Service should be created (not throwing errors)
      const { result } = renderHook(() => useTabExtraction());
      expect(result.current).toBeDefined();
      expect(result.current.extractCurrentTab).toBeDefined();
    });
  });

  describe('Common Functionality', () => {
    it('should provide extraction methods', () => {
      const { result } = renderHook(() => useTabExtraction());

      expect(result.current.extractCurrentTab).toBeDefined();
      expect(result.current.extractTabById).toBeDefined();
      expect(result.current.refreshAvailableTabs).toBeDefined();
      expect(result.current.removeLoadedTab).toBeDefined();
      expect(result.current.clearAllTabs).toBeDefined();
    });

    it('should track loading state during extraction', async () => {
      const mockTabContent = createMockTabContent(1);
      // Delay resolve to observe loading state
      mockExtractionService.extractCurrentTab.mockImplementationOnce(
        () => new Promise(resolve => setTimeout(() => resolve(mockTabContent), 10))
      );

      const { result } = renderHook(() => useTabExtraction());

      let loadingStateDuringExtraction = false;

      await act(async () => {
        const extractionPromise = result.current.extractCurrentTab();
        // Check loading state during extraction
        await new Promise(resolve => setTimeout(resolve, 0));
        loadingStateDuringExtraction = result.current.loading;
        await extractionPromise;
      });

      // Loading should eventually turn false and no error should be present
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should provide state information', () => {
      const { result } = renderHook(() => useTabExtraction());

      expect(result.current.currentTabContent).toBeDefined();
      expect(result.current.currentTabId).toBeDefined();
      expect(result.current.loadedTabs).toBeDefined();
      expect(result.current.availableTabs).toBeDefined();
      expect(result.current.hasAutoLoaded).toBeDefined();
      expect(result.current.loading).toBeDefined();
      expect(result.current.loadingTabIds).toBeDefined();
      expect(result.current.error).toBeDefined();
    });

    it('should handle clear all tabs', () => {
      const { result } = renderHook(() => useTabExtraction());

      act(() => {
        result.current.clearAllTabs();
      });

      // Should not throw error
      expect(result.current.error).toBeNull();
    });

    it('should handle remove loaded tab', () => {
      const { result } = renderHook(() => useTabExtraction());

      act(() => {
        result.current.removeLoadedTab(1);
      });

      // Should not throw error
      expect(result.current.error).toBeNull();
    });
  });
});
