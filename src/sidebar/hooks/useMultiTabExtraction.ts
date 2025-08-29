/**
 * @file React Hook for Multi-Tab Content Extraction
 *
 * Custom hook that provides multi-tab content extraction functionality for the sidebar,
 * integrating with the background script to extract and manage content from multiple browser tabs.
 * Auto-loads current tab ONCE on mount and provides manual tab extraction via @ mentions.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { TabContent, TabInfo } from '@/types/tabs';
import type { ExtractedContent } from '@/types/extraction';
import { ExtractionMode } from '@/types/extraction';
import type {
  GetAllTabsResponsePayload,
  ExtractTabContentResponsePayload,
  ExtractTabPayload,
} from '@/types/messages';
import { createMessage } from '@/types/messages';
import { useChatStore } from '@/data/store/chat';

/**
 * Multi-tab extraction hook return interface
 */
export interface UseMultiTabExtractionReturn {
  // State
  /** Currently loaded tab content (auto-loaded from current tab) */
  currentTabContent: ExtractedContent | null;
  /** Current tab ID for duplicate prevention */
  currentTabId: number | null;
  /** Map of loaded tabs by ID - using Record for serialization compatibility */
  loadedTabs: Record<number, TabContent>;
  /** Available tabs that can be loaded via @ mentions */
  availableTabs: TabInfo[];
  /** Whether the current tab has been auto-loaded */
  hasAutoLoaded: boolean;

  // Actions
  /** Extract current tab content - called ONCE on mount */
  extractCurrentTab: (options?: { mode?: ExtractionMode }) => Promise<void>;
  /** Extract content from specific tab by ID - called via @ mentions */
  extractTabById: (tabId: number, options?: { mode?: ExtractionMode }) => Promise<void>;
  /** Remove a loaded tab from the collection */
  removeLoadedTab: (tabId: number) => void;
  /** Clear all loaded tabs */
  clearAllTabs: () => void;
  /** Refresh the list of available tabs */
  refreshAvailableTabs: () => Promise<void>;

  // Status
  /** Global loading state */
  loading: boolean;
  /** Array of tab IDs currently being extracted */
  loadingTabIds: number[];
  /** Current error state */
  error: Error | null;
}

/**
 * Hook for managing multi-tab content extraction
 *
 * This hook provides functionality for:
 * - Auto-loading current tab content ONCE on mount
 * - Manually extracting content from additional tabs via @ mentions
 * - Managing the collection of loaded tab content
 * - Preventing duplicate tab loading
 * - Tracking extraction status and errors
 *
 * @returns Hook interface with state and actions for multi-tab extraction
 */
export function useMultiTabExtraction(): UseMultiTabExtractionReturn {
  // Zustand store integration for session persistence
  const {
    loadedTabs,
    currentTabId,
    hasAutoLoaded,
    addLoadedTab,
    removeLoadedTab,
    setCurrentTabId,
    setHasAutoLoaded,
    getHasAutoLoaded,
    getCurrentTabContent,
  } = useChatStore();

  // Current tab content derived from store (return ExtractedContent | null as per interface)
  const currentTab = getCurrentTabContent();
  const currentTabContent: ExtractedContent | null = currentTab
    ? currentTab.extractedContent
    : null;

  // Local state for UI control
  const [availableTabs, setAvailableTabs] = useState<TabInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingTabIds, setLoadingTabIds] = useState<number[]>([]);
  const [error, setError] = useState<Error | null>(null);

  // Prevent multiple auto-loads with ref
  const autoLoadAttempted = useRef<boolean>(false);

  /**
   * Get current tab ID from background script
   */
  const getCurrentTabId = useCallback(async (): Promise<number | null> => {
    try {
      const message = createMessage({
        type: 'GET_TAB_ID',
        source: 'sidebar',
        target: 'background',
      });

      const response = await chrome.runtime.sendMessage(message);

      if (response?.payload?.tabId) {
        return response.payload.tabId;
      }

      return null;
    } catch (err) {
      return null;
    }
  }, []);

  /**
   * Refresh available tabs from background script
   */
  const refreshAvailableTabs = useCallback(async (): Promise<void> => {
    try {
      const message = createMessage({
        type: 'GET_ALL_TABS',
        source: 'sidebar',
        target: 'background',
      });

      const response = await chrome.runtime.sendMessage(message);

      if (response?.payload?.tabs) {
        const allTabs = (response.payload as GetAllTabsResponsePayload).tabs;

        // Filter out already loaded tabs and current tab
        const available = allTabs.filter(tab => {
          // Exclude current tab (auto-loaded)
          if (currentTabId && tab.id === currentTabId) {
            return false;
          }

          // Exclude already loaded tabs
          if (loadedTabs[tab.id]) {
            return false;
          }

          return true;
        });

        setAvailableTabs(available);
      } else {
        // No tabs available
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to get available tabs'));
    }
  }, [currentTabId, loadedTabs]);

  /**
   * Extract content from current tab - called once on mount
   */
  const extractCurrentTab = useCallback(
    async (options?: { mode?: ExtractionMode }): Promise<void> => {
      const currentHasAutoLoaded = getHasAutoLoaded();
      if (currentHasAutoLoaded || autoLoadAttempted.current) {
        return; // Prevent multiple auto-loads
      }

      autoLoadAttempted.current = true;
      setLoading(true);
      setError(null);

      try {
        // Get current tab ID
        const tabId = await getCurrentTabId();

        if (!tabId) {
          throw new Error('Unable to determine current tab ID');
        }

        setCurrentTabId(tabId);

        // Extract content from current tab - always use default mode for auto-load
        const message = createMessage({
          type: 'EXTRACT_TAB_CONTENT',
          payload: {
            tabId,
            mode: options?.mode || ExtractionMode.DEFUDDLE, // Always use defuddle for auto-load
            options: { forceRefresh: true }, // Force fresh extraction on mount
          } as ExtractTabPayload,
          source: 'sidebar',
          target: 'background',
        });

        const response = await chrome.runtime.sendMessage(message);

        if (response?.payload?.content) {
          const { content } = response.payload as ExtractTabContentResponsePayload;

          // Create TabContent and add to store instead of local state
          const tabContent: TabContent = {
            tabInfo: {
              id: tabId,
              title: content.title || 'Current Tab',
              url: content.url || '',
              domain: content.domain || new URL(content.url || 'https://example.com').hostname,
              favIconUrl: '', // ExtractedContent doesn't have favIconUrl
              windowId: 0, // Required field - using default
              active: tabId === currentTabId, // Check if this is the active tab
              index: 0, // Required field - using default
              pinned: false, // Required field - using default
              lastAccessed: content.extractedAt || Date.now(),
            },
            extractedContent: content,
            extractionStatus: 'completed',
            isStale: false,
          };

          addLoadedTab(tabId, tabContent);
          setHasAutoLoaded(true);

          // Clear any previous errors
          setError(null);
        } else {
          throw new Error('No content received from current tab');
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Current tab extraction failed'));
        // Reset auto-load attempt on error so it can be retried
        autoLoadAttempted.current = false;
      } finally {
        setLoading(false);
      }
    },
    [getHasAutoLoaded, getCurrentTabId, setCurrentTabId, addLoadedTab, setHasAutoLoaded]
  );

  /**
   * Extract content from specific tab by ID - called via @ mentions
   */
  const extractTabById = useCallback(
    async (tabId: number, options?: { mode?: ExtractionMode }): Promise<void> => {
      // Extract tab by ID with optional mode
      // Allow re-extraction with different mode (e.g., raw mode)
      const isReextractWithMode = options?.mode !== undefined;

      // For re-extraction with mode, just extract without checks
      if (isReextractWithMode) {
        // Continue to extraction
      } else if (currentTabId && tabId === currentTabId) {
        // Prevent loading current tab unless re-extracting
        return;
      }

      // Check if already extracting this tab
      if (loadingTabIds.includes(tabId)) {
        return;
      }

      // Determine tabInfo
      const existing = loadedTabs[tabId];

      // Skip if already completed UNLESS it's a re-extraction with mode
      if (existing && existing.extractionStatus === 'completed' && !isReextractWithMode) {
        return;
      }

      // Resolve TabInfo (from existing entry, availableTabs, or for re-extraction)
      const tabInfo: TabInfo | undefined =
        existing?.tabInfo || availableTabs.find(tab => tab.id === tabId); // Use existing tab info if available (for re-extraction or retry) // Otherwise find in available tabs

      if (!tabInfo) {
        throw new Error(`Tab ${tabId} not found in available tabs or loaded tabs`);
      }

      // Add to loading set and clear global error
      setLoadingTabIds(prev => [...prev, tabId]);
      setError(null);

      try {
        // Update or create initial tab content with loading state
        const initialTabContent: TabContent = {
          tabInfo,
          extractedContent: { title: '', url: '', content: '', metadata: {} } as ExtractedContent,
          extractionStatus: 'extracting',
          isStale: false,
        };

        addLoadedTab(tabId, initialTabContent);

        // Extract content - always go through background for raw mode
        // The sidebar doesn't have direct access to chrome.tabs API

        // Normal extraction through background
        const message = createMessage({
          type: 'EXTRACT_TAB_CONTENT',
          payload: {
            tabId,
            mode: options?.mode,
            options: { forceRefresh: true }, // Always force refresh for manual extractions
          } as ExtractTabPayload,
          source: 'sidebar',
          target: 'background',
        });

        const response = await chrome.runtime.sendMessage(message);

        // Check if we got an error response
        if (response?.type === 'ERROR') {
          throw new Error(response.payload?.message || 'Failed to extract content');
        }

        // Handle success path
        if (response?.payload?.content) {
          const { content } = response.payload as ExtractTabContentResponsePayload;

          // Update tab content with extracted content
          const completedTabContent: TabContent = {
            tabInfo,
            extractedContent: content,
            extractionStatus: 'completed',
            isStale: false,
          };

          // Update in store
          addLoadedTab(tabId, completedTabContent);

          // Remove from available tabs since it's now loaded (noop on retry)
          setAvailableTabs(prev => prev.filter(tab => tab.id !== tabId));
        } else {
          // Improve error surface: if background returned an ERROR message, show its message
          const maybeErrorType = (response && (response as any).type) || '';
          const maybeErrorMessage =
            (response && (response as any).payload && (response as any).payload.message) || '';
          const msg =
            maybeErrorType === 'ERROR' && maybeErrorMessage
              ? maybeErrorMessage
              : `No content received from tab ${tabId}`;
          throw new Error(msg);
        }
      } catch (err) {
        // Update tab content with error state
        const errorMessage = err instanceof Error ? err.message : 'Tab extraction failed';
        const tabInfo = availableTabs.find(tab => tab.id === tabId);

        if (tabInfo) {
          const failedTabContent: TabContent = {
            tabInfo,
            extractedContent: { title: '', url: '', content: '', metadata: {} } as ExtractedContent,
            extractionStatus: 'failed',
            extractionError: errorMessage,
            isStale: false,
          };

          // Update in store
          addLoadedTab(tabId, failedTabContent);
        }

        setError(err instanceof Error ? err : new Error(`Tab ${tabId} extraction failed`));
      } finally {
        // Remove from loading tabs
        setLoadingTabIds(prev => prev.filter(id => id !== tabId));
      }
    },
    [loadedTabs, currentTabId, loadingTabIds, availableTabs, addLoadedTab]
  );

  /**
   * Remove a loaded tab from the collection
   */
  const handleRemoveLoadedTab = useCallback(
    (tabId: number): void => {
      removeLoadedTab(tabId);

      // Add tab back to available tabs if it still exists
      refreshAvailableTabs();
    },
    [removeLoadedTab, refreshAvailableTabs]
  );

  /**
   * Clear all loaded tabs
   */
  const clearAllTabs = useCallback((): void => {
    // Use Zustand store's clearConversation which resets multi-tab state
    const { clearConversation } = useChatStore.getState();
    clearConversation();

    setError(null);
    setLoadingTabIds([]);

    // Reset auto-load attempt
    autoLoadAttempted.current = false;

    // Refresh available tabs
    refreshAvailableTabs();
  }, [refreshAvailableTabs]);

  // Auto-extract current tab on mount
  useEffect(() => {
    const currentHasAutoLoaded = getHasAutoLoaded();
    if (!currentHasAutoLoaded && !autoLoadAttempted.current) {
      extractCurrentTab();
    }
  }, []); // Empty deps array - only run on mount

  // Refresh available tabs when loaded tabs change
  useEffect(() => {
    refreshAvailableTabs();
  }, [currentTabId, Object.keys(loadedTabs).length, refreshAvailableTabs]); // Only depend on keys length, not full object

  return {
    // State
    currentTabContent,
    currentTabId,
    loadedTabs,
    availableTabs,
    hasAutoLoaded,

    // Actions
    extractCurrentTab,
    extractTabById,
    removeLoadedTab: handleRemoveLoadedTab,
    clearAllTabs,
    refreshAvailableTabs,

    // Status
    loading,
    loadingTabIds,
    error,
  };
}
