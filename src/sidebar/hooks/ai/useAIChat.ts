/**
 * @file Simplified AI Chat Hook
 *
 * Main orchestrator hook that combines provider management, message handling,
 * and settings synchronization for AI chat functionality.
 */

import { useEffect, useMemo } from 'react';
import { useSettingsStore } from '@store/settings';
import { useChatStore } from '@store/chat';
import { useProviderManager } from './useProviderManager';
import { useMessageHandler } from './useMessageHandler';
import { useMultiTabExtraction } from '../useMultiTabExtraction';
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

  const chatStore = useChatStore();
  const settings = useSettingsStore(state => state.settings);

  // Initialize multi-tab extraction hook
  const multiTabExtraction = useMultiTabExtraction();

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
        chatStore.setError('Failed to initialize AI providers');
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
    chatStore,
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

  // Sync multi-tab extraction state with chat store
  useEffect(() => {
    if (!enabled) return;

    const { currentTabContent, currentTabId, loadedTabs, hasAutoLoaded } = multiTabExtraction;

    // Update chat store with current tab information only if changed
    // The Zustand hook returns a snapshot of state/actions; to access
    // the store API use the hook function itself.
    const storeState = useChatStore.getState();

    if (currentTabId !== null && storeState.currentTabId !== currentTabId) {
      chatStore.setCurrentTabId(currentTabId);
    }

    // Update has auto-loaded state only if changed
    if (storeState.hasAutoLoaded !== hasAutoLoaded) {
      chatStore.setHasAutoLoaded(hasAutoLoaded);
    }

    // Only update loaded tabs if there's an actual change
    // Since loadedTabs already comes from the store via useMultiTabExtraction,
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
      chatStore.setLoadedTabs(updatedTabs);
    }
  }, [
    enabled,
    multiTabExtraction.currentTabContent,
    multiTabExtraction.currentTabId,
    multiTabExtraction.loadedTabs,
    multiTabExtraction.hasAutoLoaded,
    chatStore,
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
      multiTabExtraction,
    }),
    [sendMessage, cancelMessage, switchProvider, isStreaming, getStats, multiTabExtraction]
  );
}

export default useAIChat;
