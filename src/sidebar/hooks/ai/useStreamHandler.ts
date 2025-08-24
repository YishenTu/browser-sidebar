/**
 * @file Stream Handler Hook
 *
 * Manages streaming responses from AI providers.
 */

import { useRef, useCallback } from 'react';
import { useChatStore } from '@store/chat';
import type { AIProvider } from '../../../types/providers';
import type { ChatMessage } from '@store/chat';
import type { UseStreamHandlerReturn } from './types';

export function useStreamHandler(): UseStreamHandlerReturn {
  const chatStore = useChatStore();
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Handle streaming response from provider
   */
  const handleStreamingResponse = useCallback(
    async (
      provider: AIProvider,
      assistantMessage: ChatMessage,
      userMessage?: ChatMessage
    ): Promise<void> => {
      if (!provider.streamChat) {
        throw new Error('Provider does not support streaming');
      }

      try {
        // Set active message for streaming
        chatStore.setActiveMessage(assistantMessage.id);

        // Get current messages from store
        const currentMessages = useChatStore.getState().messages;

        // Build messages array for the provider
        let messages;

        if (
          userMessage &&
          currentMessages.filter(m => m.role === 'user' && m.content).length === 1
        ) {
          // First message case - use the userMessage directly
          messages = [
            {
              id: userMessage.id,
              role: userMessage.role,
              content: userMessage.content,
              timestamp:
                userMessage.timestamp instanceof Date
                  ? userMessage.timestamp
                  : new Date(userMessage.timestamp),
            },
          ];
        } else {
          // Get messages from store for follow-up messages
          messages = currentMessages
            .filter(msg => {
              // Exclude the empty assistant message we just created
              if (msg.id === assistantMessage.id) {
                return false;
              }
              // Include all non-empty messages
              if (!msg.content || msg.content.trim() === '') {
                return false;
              }
              return true;
            })
            .map(msg => ({
              id: msg.id,
              role: msg.role,
              content: msg.content,
              timestamp: new Date(msg.timestamp),
            }));
        }

        // Ensure we have at least one message
        if (messages.length === 0) {
          throw new Error('No valid messages to send to AI provider');
        }

        // Create abort controller for this stream
        abortControllerRef.current = new AbortController();

        // Start streaming
        const stream = provider.streamChat(messages, {
          signal: abortControllerRef.current.signal,
        });

        let lastSuccessfulContent = '';
        let streamInterrupted = false;

        try {
          for await (const chunk of stream) {
            // Check if cancelled
            if (abortControllerRef.current?.signal.aborted) {
              streamInterrupted = true;
              break;
            }

            // Extract text content from streaming chunk
            const piece = (chunk as any)?.choices?.[0]?.delta?.content || '';

            if (piece) {
              // Append the chunk
              chatStore.appendToMessage(assistantMessage.id, piece);
              lastSuccessfulContent += piece;

              // Table content detected - no special handling needed
            }
          }
        } catch (streamError) {
          // Streaming was interrupted
          streamInterrupted = true;
          // Stream error handled silently

          // Append recovery message if we got partial content
          if (lastSuccessfulContent && lastSuccessfulContent.length > 0) {
            chatStore.appendToMessage(
              assistantMessage.id,
              '\n\n[Stream interrupted. Message may be incomplete.]'
            );
          }
        }

        // Mark streaming complete or partial
        if (streamInterrupted && lastSuccessfulContent.length > 0) {
          chatStore.updateMessage(assistantMessage.id, {
            status: 'received',
            metadata: { partial: true, interrupted: true },
          });
        } else if (!streamInterrupted) {
          chatStore.updateMessage(assistantMessage.id, {
            status: 'received',
          });
        } else {
          throw new Error('Stream interrupted before receiving any content');
        }
      } catch (error) {
        // Handle streaming error
        let errorMessage = 'An unexpected error occurred';

        if (error instanceof Error) {
          errorMessage = error.message;
        }

        // Try to get more specific error from provider
        const providerError = provider.formatError?.(error as Error);
        if (providerError) {
          errorMessage = providerError.message;
        }

        // Check if this is a recoverable network error
        const isNetworkError =
          errorMessage.toLowerCase().includes('network') ||
          errorMessage.toLowerCase().includes('timeout') ||
          errorMessage.toLowerCase().includes('connection');

        if (isNetworkError) {
          errorMessage += ' (You can try sending the message again)';
        }

        chatStore.updateMessage(assistantMessage.id, {
          status: 'error',
          error: errorMessage,
        });
        throw error;
      } finally {
        // Only clear active message if the store is still available
        try {
          chatStore.clearActiveMessage();
        } catch (cleanupError) {
          // Ignore errors during cleanup (component may be unmounted)
          console.debug('Failed to clear active message in finally block:', cleanupError);
        }
        abortControllerRef.current = null;
      }
    },
    [chatStore]
  );

  /**
   * Cancel streaming
   */
  const cancelStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    // Only clear active message if the store is still available
    try {
      chatStore.clearActiveMessage();
    } catch (error) {
      // Ignore errors during cleanup (component may be unmounted)
      console.debug('Failed to clear active message during cleanup:', error);
    }
  }, [chatStore]);

  /**
   * Check if currently streaming
   */
  const isStreaming = chatStore.activeMessageId !== null;

  return {
    handleStreamingResponse,
    cancelStreaming,
    isStreaming,
  };
}
