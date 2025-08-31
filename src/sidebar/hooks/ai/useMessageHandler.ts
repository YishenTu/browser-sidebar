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
import { getSystemPrompt } from '@/config/systemPrompt';
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
   * Handle non-streaming response from provider
   */
  const handleNonStreamingResponse = useCallback(
    async (provider: AIProvider): Promise<void> => {
      // Create messages array for provider (only non-empty messages)
      const messages = messageStore
        .getMessages()
        .filter(msg => msg.content.trim() !== '')
        .map(msg => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.timestamp),
        }));

      // Get last response ID for conversation continuity (OpenAI Response API)
      const previousResponseId = uiStore.getLastResponseId();

      // Get the system prompt
      const systemPrompt = getSystemPrompt();

      // Get response from provider with response ID if available
      const response = await provider.chat(messages, {
        previousResponseId: previousResponseId || undefined,
        systemPrompt,
      });

      // Store new response ID if present (for OpenAI Response API)
      if (response.metadata?.['responseId']) {
        uiStore.setLastResponseId(response.metadata['responseId'] as string);
      }

      // Get model info for metadata
      const selectedModel = settingsStore.settings.selectedModel;
      const modelInfo = getModelById(selectedModel);

      // Add assistant message to store with model metadata
      messageStore.addMessage({
        role: 'assistant',
        content: response.content,
        status: 'received',
        metadata: {
          model: modelInfo?.name || 'AI Assistant',
          thinking: response.thinking, // Store thinking separately for UI to render
          ...(response.metadata &&
          'searchResults' in response.metadata &&
          response.metadata['searchResults']
            ? {
                searchResults: response.metadata['searchResults'],
              }
            : {}),
        },
      });
    },
    [messageStore, settingsStore]
  );

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

      const { streaming = true, skipUserMessage = false, displayContent, metadata } = options;

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
          if (streaming && typeof provider.streamChat === 'function') {
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
          } else {
            // Non-streaming response
            await handleNonStreamingResponse(provider);
          }

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
    [
      enabled,
      messageStore,
      settingsStore,
      getActiveProvider,
      handleStreamingResponse,
      handleNonStreamingResponse,
    ]
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
