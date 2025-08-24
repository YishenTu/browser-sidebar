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
import type { UseAIChatOptions, UseAIChatReturn } from './types';

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
      } catch (error) {
        console.error('Failed to initialize providers:', error);
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
      } catch (error) {
        console.warn('Failed to sync providers with settings:', error);
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

  // Cleanup on unmount only (empty dependency array)
  useEffect(() => {
    return () => {
      // Cancel any ongoing operations
      // Using a ref to avoid dependency issues
      cancelStreaming();
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
    }),
    [sendMessage, cancelMessage, switchProvider, isStreaming, getStats]
  );
}

export default useAIChat;
