/**
 * @file React Hook for Tab Content Extraction
 *
 * Custom hook that provides tab content extraction functionality for the sidebar,
 * integrating with the background script to extract and manage content from multiple browser tabs.
 * Auto-loads current tab ONCE on mount and provides manual tab extraction via @ mentions.
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { TabContent, TabInfo } from '@/types/tabs';
import type { ExtractedContent } from '@/types/extraction';
import { ExtractionMode } from '@/types/extraction';
import type { GetAllTabsResponsePayload, GetAllTabsMessage, Message } from '@/types/messages';
import { createMessage } from '@/types/messages';
import { useSessionStore, useTabStore, useUIStore } from '@/data/store/chat';
import {
  createExtractionService,
  type ServiceExtractionOptions,
  ExtractionError,
} from '@/services/extraction/ExtractionService';
import { sendMessage } from '@platform/chrome/runtime';

/**
 * Tab extraction hook return interface
 */
export interface UseTabExtractionReturn {
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
 * Hook for managing tab content extraction
 *
 * This hook provides functionality for:
 * - Auto-loading current tab content ONCE on mount
 * - Manually extracting content from additional tabs via @ mentions
 * - Managing the collection of loaded tab content
 * - Preventing duplicate tab loading
 * - Tracking extraction status and errors
 *
 * @returns Hook interface with state and actions for tab extraction
 */
export function useTabExtraction(): UseTabExtractionReturn {
  // Zustand store integration for session persistence
  const sessionStore = useSessionStore();
  const tabStore = useTabStore();

  // Create extraction service instance for refactored mode
  const extractionService = useMemo(() => createExtractionService('sidebar'), []);

  const loadedTabs = tabStore.getLoadedTabs();
  const currentTabId = tabStore.getCurrentTabId();
  const hasAutoLoaded = tabStore.getHasAutoLoaded();
  const addLoadedTab = tabStore.addLoadedTab;
  const removeLoadedTab = tabStore.removeLoadedTab;
  const setCurrentTabId = tabStore.setCurrentTabId;
  const setHasAutoLoaded = tabStore.setHasAutoLoaded;
  const getHasAutoLoaded = tabStore.getHasAutoLoaded;
  const getCurrentTabContent = tabStore.getCurrentTabContent;
  const activeSessionKey = sessionStore.activeSessionKey;

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
   * Refresh available tabs from background script
   */
  const refreshAvailableTabs = useCallback(async (): Promise<void> => {
    try {
      const message = createMessage({
        type: 'GET_ALL_TABS',
        source: 'sidebar',
        target: 'background',
      }) as GetAllTabsMessage;

      const result = await sendMessage<GetAllTabsMessage, Message<GetAllTabsResponsePayload>>(
        message
      );
      const response = result.success ? result.data : null;

      if (response?.payload?.tabs) {
        const allTabs = response.payload.tabs;

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
        // New architecture: use ExtractionService
        const serviceOptions: ServiceExtractionOptions = {
          mode: options?.mode || ExtractionMode.DEFUDDLE,
          forceRefresh: true, // Force fresh extraction on mount
          maxRetries: 2,
          timeout: 5000,
        };

        const tabContent = await extractionService.extractCurrentTab(serviceOptions);

        // Update store with extracted content
        setCurrentTabId(tabContent.tabInfo.id);
        addLoadedTab(tabContent.tabInfo.id, tabContent);
        setHasAutoLoaded(true);
        setError(null);
      } catch (err) {
        let errorMessage: string;
        if (err instanceof ExtractionError) {
          errorMessage = `${err.message} (${err.type})`;
        } else {
          errorMessage = err instanceof Error ? err.message : 'Current tab extraction failed';
        }
        setError(new Error(errorMessage));
        // Reset auto-load attempt on error so it can be retried
        autoLoadAttempted.current = false;
      } finally {
        setLoading(false);
      }
    },
    [getHasAutoLoaded, setCurrentTabId, addLoadedTab, setHasAutoLoaded, extractionService]
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

        // Use ExtractionService (new architecture)
        const serviceOptions: ServiceExtractionOptions = {
          mode: options?.mode,
          forceRefresh: true, // Always force refresh for manual extractions
          maxRetries: 2,
          timeout: 5000,
        };

        const result = await extractionService.extractTabs([tabId], serviceOptions);
        const extractionResult = result.results[0];

        if (!extractionResult) {
          throw new Error(`No extraction result for tab ${tabId}`);
        }

        if (extractionResult.success && extractionResult.content) {
          // Update store with extracted content
          addLoadedTab(tabId, extractionResult.content);
          // Remove from available tabs since it's now loaded
          setAvailableTabs(prev => prev.filter(tab => tab.id !== tabId));
        } else {
          throw new Error(extractionResult.error || `Failed to extract tab ${tabId}`);
        }
      } catch (err) {
        // Update tab content with error state
        let errorMessage: string;
        if (err instanceof ExtractionError) {
          errorMessage = `${err.message} (${err.type})`;
        } else {
          errorMessage = err instanceof Error ? err.message : 'Tab extraction failed';
        }

        const tabInfoForError = existing?.tabInfo || availableTabs.find(tab => tab.id === tabId);

        if (tabInfoForError) {
          const failedTabContent: TabContent = {
            tabInfo: tabInfoForError,
            extractedContent: { title: '', url: '', content: '', metadata: {} } as ExtractedContent,
            extractionStatus: 'failed',
            extractionError: errorMessage,
            isStale: false,
          };

          // Update in store
          addLoadedTab(tabId, failedTabContent);
        }

        setError(new Error(errorMessage));
      } finally {
        // Remove from loading tabs
        setLoadingTabIds(prev => prev.filter(id => id !== tabId));
      }
    },
    [loadedTabs, currentTabId, loadingTabIds, availableTabs, addLoadedTab, extractionService]
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
    // Use Zustand store's clearConversation which resets tab state
    const { clearConversation } = useUIStore.getState();
    clearConversation();

    setError(null);
    setLoadingTabIds([]);

    // Reset auto-load attempt
    autoLoadAttempted.current = false;

    // Refresh available tabs
    refreshAvailableTabs();
  }, [refreshAvailableTabs]);

  // Reset autoLoadAttempted when hasAutoLoaded is false (new or cleared session)
  useEffect(() => {
    if (!hasAutoLoaded) {
      autoLoadAttempted.current = false;
    }
  }, [activeSessionKey, hasAutoLoaded]);

  // Auto-extract current tab when session is ready and hasn't been loaded yet
  useEffect(() => {
    if (activeSessionKey && !hasAutoLoaded && !autoLoadAttempted.current) {
      // Delay to preserve text selection on page
      requestAnimationFrame(() => {
        setTimeout(() => {
          extractCurrentTab();
        }, 20);
      });
    }
  }, [activeSessionKey, hasAutoLoaded, extractCurrentTab]);

  // Memoize loaded tabs keys to avoid unnecessary refreshes
  const loadedTabsCount = useMemo(() => Object.keys(loadedTabs).length, [loadedTabs]);

  // Refresh available tabs when loaded tabs change (debounced to avoid rapid updates)
  useEffect(() => {
    // Add a small delay to batch multiple tab changes
    const timeoutId = setTimeout(() => {
      refreshAvailableTabs();
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [currentTabId, loadedTabsCount, refreshAvailableTabs]); // Use memoized count

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
