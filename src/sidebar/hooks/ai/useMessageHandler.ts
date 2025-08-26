/**
 * @file Message Handler Hook
 *
 * Handles sending messages and managing responses from AI providers.
 */

import { useCallback } from 'react';
import { useChatStore } from '@store/chat';
import { useSettingsStore } from '@store/settings';
import { getModelById } from '@/config/models';
import type { AIProvider } from '../../../types/providers';
import type { SendMessageOptions, UseMessageHandlerReturn } from './types';
import { useStreamHandler } from './useStreamHandler';

interface MessageHandlerDeps {
  getActiveProvider: () => AIProvider | null;
  enabled?: boolean;
}

export function useMessageHandler({
  getActiveProvider,
  enabled = true,
}: MessageHandlerDeps): UseMessageHandlerReturn {
  const chatStore = useChatStore();
  const settingsStore = useSettingsStore();
  const { handleStreamingResponse, cancelStreaming, isStreaming } = useStreamHandler();

  /**
   * Handle non-streaming response from provider
   */
  const handleNonStreamingResponse = useCallback(
    async (provider: AIProvider): Promise<void> => {
      // Create messages array for provider (only non-empty messages)
      const messages = chatStore.messages
        .filter(msg => msg.content.trim() !== '')
        .map(msg => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.timestamp),
        }));

      // Get last response ID for conversation continuity (OpenAI Response API)
      const previousResponseId = chatStore.getLastResponseId();

      // Get response from provider with response ID if available
      const response = await provider.chat(messages, {
        previousResponseId: previousResponseId || undefined,
      });

      // Store new response ID if present (for OpenAI Response API)
      if (response.metadata?.['responseId']) {
        chatStore.setLastResponseId(response.metadata['responseId'] as string);
      }

      // Get the selected model from settings
      const selectedModel = settingsStore.settings.selectedModel;
      const modelInfo = getModelById(selectedModel);

      // Add assistant message to store with model metadata
      chatStore.addMessage({
        role: 'assistant',
        content: response.content,
        status: 'received',
        metadata: {
          model: modelInfo?.name || 'AI Assistant',
          thinking: response.thinking, // Store thinking separately for UI to render
          ...(response.metadata?.['searchResults'] && {
            searchResults: response.metadata['searchResults'],
          }),
        },
      });
    },
    [chatStore, settingsStore]
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

      const { streaming = true, skipUserMessage = false } = options;

      try {
        // Clear any previous errors
        chatStore.clearError();
        settingsStore.clearError();

        // Set loading state
        chatStore.setLoading(true);

        // Get active provider
        const provider = getActiveProvider();
        if (!provider) {
          throw new Error('No active AI provider configured. Please add an API key in settings.');
        }

        // Add user message to chat store (unless we're regenerating)
        let userMessage;
        if (!skipUserMessage) {
          userMessage = chatStore.addMessage({
            role: 'user',
            content: trimmedContent,
            status: 'sending',
          });
        } else {
          // For regeneration, get the last user message
          const lastUserMessage = chatStore.getUserMessages().slice(-1)[0];
          if (!lastUserMessage) {
            throw new Error('No user message found for regeneration');
          }
          userMessage = lastUserMessage;
        }

        try {
          if (streaming && typeof provider.streamChat === 'function') {
            // Get the selected model from settings
            const selectedModel = settingsStore.settings.selectedModel;
            const modelInfo = getModelById(selectedModel);

            // Create assistant message for streaming with model metadata
            const assistantMessage = chatStore.addMessage({
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
          chatStore.updateMessage(userMessage.id, {
            status: 'sent',
          });
        } catch (error) {
          // Handle provider errors
          const providerError = provider.formatError?.(error as Error);
          const errorMessage = providerError ? providerError.message : (error as Error).message;
          chatStore.setError(errorMessage);

          // Mark user message as error
          chatStore.updateMessage(userMessage.id, {
            status: 'error',
            error: errorMessage,
          });

          throw error;
        }
      } catch (error) {
        // Handle general errors
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        chatStore.setError(errorMessage);
        throw error;
      } finally {
        // Clear loading state
        chatStore.setLoading(false);
      }
    },
    [
      enabled,
      chatStore,
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
    chatStore.setLoading(false);
  }, [cancelStreaming, chatStore]);

  return {
    sendMessage,
    cancelMessage,
    isStreaming: () => isStreaming,
  };
}
