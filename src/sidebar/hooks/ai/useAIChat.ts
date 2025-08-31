/**
 * @file Simplified AI Chat Hook
 *
 * Main orchestrator hook that combines provider management, message handling,
 * and settings synchronization for AI chat functionality.
 */

import { useEffect, useMemo } from 'react';
import { useSettingsStore } from '@store/settings';
import { useTabStore, useUIStore } from '@store/chat';
import { useProviderManager } from './useProviderManager';
import { useMessageHandler } from './useMessageHandler';
import { useTabExtraction } from '../useTabExtraction';
import type { UseAIChatOptions, UseAIChatReturn } from './types';
import type { TabContent } from '../../../types/tabs';

/**
 * Custom hook for AI chat functionality with real providers
 *
 * This is a simplified orchestrator that delegates specific responsibilities
 * to specialized hooks for better maintainability and testing.
 */
export function useAIChat(options: UseAIChatOptions = {}): UseAIChatReturn {
  const { enabled = true, autoInitialize = false } = options;

  const tabStore = useTabStore();
  const uiStore = useUIStore();
  const settings = useSettingsStore(state => state.settings);

  // Initialize tab extraction hook
  const tabExtraction = useTabExtraction();

  // Initialize provider manager
  const providerManager = useProviderManager(enabled);
  const { getActiveProvider, switchProvider, initializeProviders, getStats } = providerManager;

  // Initialize message handler with provider manager dependency
  const messageHandler = useMessageHandler({
    getActiveProvider,
    enabled,
  });
  const { sendMessage, cancelMessage, isStreaming } = messageHandler;

  // Auto-initialize providers from settings
  useEffect(() => {
    if (!enabled || !autoInitialize) return;

    const initialize = async () => {
      try {
        await initializeProviders();
      } catch (_error) {
        uiStore.setError('Failed to initialize AI providers');
      }
    };

    initialize();
  }, [
    enabled,
    autoInitialize,
    settings?.apiKeys?.openai,
    settings?.apiKeys?.google,
    settings?.selectedModel,
    initializeProviders,
    tabStore,
  ]);

  // Sync providers with settings changes
  useEffect(() => {
    if (!enabled) return;

    const syncProviders = async () => {
      try {
        // Re-initialize providers when settings change
        await initializeProviders();
      } catch (_error) {
        // Ignore initialization errors - provider will handle retry
      }
    };

    // Apply immediately to ensure model switches reflect in the next request
    syncProviders();
  }, [
    enabled,
    settings.ai?.defaultProvider,
    settings.apiKeys?.openai,
    settings.apiKeys?.google,
    settings.selectedModel,
    initializeProviders,
  ]);

  // Sync tab extraction state with chat store
  useEffect(() => {
    if (!enabled) return;

    const { currentTabContent, currentTabId, loadedTabs, hasAutoLoaded } = tabExtraction;

    // Update chat store with current tab information only if changed
    // The Zustand hook returns a snapshot of state/actions; to access
    // the store API use the hook function itself.
    const tabStoreState = useTabStore.getState();

    if (currentTabId !== null && tabStoreState.getCurrentTabId() !== currentTabId) {
      tabStore.setCurrentTabId(currentTabId);
    }

    // Update has auto-loaded state only if changed
    if (tabStoreState.getHasAutoLoaded() !== hasAutoLoaded) {
      tabStore.setHasAutoLoaded(hasAutoLoaded);
    }

    // Only update loaded tabs if there's an actual change
    // Since loadedTabs already comes from the store via useTabExtraction,
    // we don't need to set it back unless we're adding the current tab
    if (currentTabContent && currentTabId !== null && !loadedTabs[currentTabId]) {
      // Create TabContent structure for current tab
      const currentTabAsTabContent: TabContent = {
        tabInfo: {
          id: currentTabId,
          title: currentTabContent.title || 'Current Tab',
          url: currentTabContent.url || '',
          domain: currentTabContent.url ? new URL(currentTabContent.url).hostname : '',
          windowId: 0, // Default window ID
          active: true,
          index: 0, // Default index
          pinned: false, // Default pinned state
          lastAccessed: Date.now(),
        },
        extractedContent: currentTabContent,
        extractionStatus: 'completed' as const,
        isStale: false,
      };

      // Only update if current tab is not already in loaded tabs
      const updatedTabs: Record<number, TabContent> = {
        ...loadedTabs,
        [currentTabId]: currentTabAsTabContent,
      };
      tabStore.setLoadedTabs(updatedTabs);
    }
  }, [
    enabled,
    tabExtraction.currentTabContent,
    tabExtraction.currentTabId,
    tabExtraction.loadedTabs,
    tabExtraction.hasAutoLoaded,
    tabStore,
  ]);

  // Cleanup on unmount only (empty dependency array)
  useEffect(() => {
    return () => {
      // Cancel any ongoing operations
      // Using a ref to avoid dependency issues
      cancelMessage();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty array - only run on mount/unmount

  // Memoize return object to prevent unnecessary re-renders
  return useMemo(
    () => ({
      sendMessage,
      cancelMessage,
      switchProvider,
      isStreaming,
      getStats,
      // Multi-tab extraction functionality
      tabExtraction,
    }),
    [sendMessage, cancelMessage, switchProvider, isStreaming, getStats, tabExtraction]
  );
}

export default useAIChat;
