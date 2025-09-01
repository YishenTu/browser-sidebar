/**
 * @file Message Handler Hook
 *
 * Handles sending messages and managing responses from AI providers.
 */

import { useCallback } from 'react';
import { useMessageStore, useUIStore, useTabStore } from '@store/chat';
import { useSettingsStore } from '@store/settings';
import { getModelById } from '@/config/models';
import { formatTabContent } from '../../utils/contentFormatter';
import type { AIProvider } from '../../../types/providers';
import type { SendMessageOptions, UseMessageHandlerReturn } from './types';
import type { TabContent } from '../../../types/tabs';
import { useStreamHandler } from './useStreamHandler';

interface MessageHandlerDeps {
  getActiveProvider: () => AIProvider | null;
  enabled?: boolean;
}

export function useMessageHandler({
  getActiveProvider,
  enabled = true,
}: MessageHandlerDeps): UseMessageHandlerReturn {
  const messageStore = useMessageStore();
  const uiStore = useUIStore();
  const settingsStore = useSettingsStore();
  const { handleStreamingResponse, cancelStreaming } = useStreamHandler();

  /**
   * Send a message to the active AI provider
   */
  const sendMessage = useCallback(
    async (content: string, options: SendMessageOptions = {}): Promise<void> => {
      if (!enabled) return;

      // Validate input
      const trimmedContent = content.trim();
      if (!trimmedContent) {
        return; // Don't send empty messages
      }

      const { skipUserMessage = false, displayContent, metadata } = options;

      try {
        // Clear any previous errors
        uiStore.clearError();
        settingsStore.clearError();

        // Set loading state
        uiStore.setLoading(true);

        // Get active provider
        const provider = getActiveProvider();
        if (!provider) {
          throw new Error('No active AI provider configured. Please add an API key in settings.');
        }

        // Prepare message content with tab context if available
        let finalContent = trimmedContent;
        const finalDisplayContent = displayContent || trimmedContent;
        let hasTabContext = false;
        let formatResult: ReturnType<typeof formatTabContent> | undefined;

        // Check if we have loaded tabs to include
        const loadedTabs = useTabStore.getState().getLoadedTabs();
        const loadedTabIds = Object.keys(loadedTabs).map(id => parseInt(id, 10));

        if (loadedTabIds.length > 0) {
          // We have loaded tabs, format the content with tab structure
          // Get all loaded tabs
          const allLoadedTabs = loadedTabIds
            .map(tabId => loadedTabs[tabId])
            .filter((tab): tab is TabContent => Boolean(tab));

          // Format the tab content with the new cleaner structure
          formatResult = formatTabContent(trimmedContent, allLoadedTabs);

          // Use formatted content for AI but keep original for display
          finalContent = formatResult.formatted;
          hasTabContext = true;
        }

        // Add user message to chat store (unless we're regenerating)
        let userMessage;
        if (!skipUserMessage) {
          userMessage = messageStore.addMessage({
            role: 'user',
            content: finalContent,
            displayContent: finalDisplayContent,
            status: 'sending',
            metadata: {
              ...metadata,
              hasTabContext,
              originalUserContent: hasTabContext ? trimmedContent : undefined,
            },
          });
        } else {
          // For regeneration, get the last user message
          const lastUserMessage = messageStore.getUserMessages().slice(-1)[0];
          if (!lastUserMessage) {
            throw new Error('No user message found for regeneration');
          }
          userMessage = lastUserMessage;

          // Update the user message with new content if tab context changed
          if (hasTabContext && userMessage.content !== finalContent) {
            messageStore.updateMessage(userMessage.id, {
              content: finalContent,
              metadata: {
                ...userMessage.metadata,
                hasTabContext,
                originalUserContent: trimmedContent,
              },
            });
          }
        }

        try {
          // Always use streaming
          if (typeof provider.streamChat !== 'function') {
            throw new Error('Provider does not support streaming');
          }

          // Get the selected model from settings
          const selectedModel = settingsStore.settings.selectedModel;
          const modelInfo = getModelById(selectedModel);

          // Create assistant message for streaming with model metadata
          const assistantMessage = messageStore.addMessage({
            role: 'assistant',
            content: '',
            status: 'streaming',
            metadata: {
              model: modelInfo?.name || 'AI Assistant',
            },
          });

          await handleStreamingResponse(provider, assistantMessage, userMessage);

          // Mark user message as sent on success
          messageStore.updateMessage(userMessage.id, {
            status: 'sent',
          });
        } catch (error) {
          // Handle provider errors
          const providerError = provider.formatError?.(error as Error);
          const errorMessage = providerError ? providerError.message : (error as Error).message;
          uiStore.setError(errorMessage);

          // Mark user message as error
          messageStore.updateMessage(userMessage.id, {
            status: 'error',
            error: errorMessage,
          });

          throw error;
        }
      } catch (error) {
        // Handle general errors
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        uiStore.setError(errorMessage);
        throw error;
      } finally {
        // Clear loading state
        uiStore.setLoading(false);
      }
    },
    [enabled, messageStore, settingsStore, getActiveProvider, handleStreamingResponse]
  );

  /**
   * Cancel the current message/streaming operation
   */
  const cancelMessage = useCallback(() => {
    cancelStreaming();
    uiStore.setLoading(false);
  }, [cancelStreaming, messageStore]);

  return {
    sendMessage,
    cancelMessage,
    isStreaming: () => useUIStore.getState().getActiveMessageId() !== null,
  };
}
