/**
 * @file Stream Handler Hook
 *
 * Manages streaming responses from AI providers.
 */

import { useRef, useCallback } from 'react';
import { useMessageStore, useUIStore } from '@store/chat';
import { getSystemPrompt } from '@/config/systemPrompt';
import type { AIProvider, StreamChunk } from '../../../types/providers';
import type { ChatMessage } from '@store/chat';
import type { UseStreamHandlerReturn } from './types';

export function useStreamHandler(): UseStreamHandlerReturn {
  const messageStore = useMessageStore();
  const uiStore = useUIStore();
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
        uiStore.setActiveMessage(assistantMessage.id);

        // Get current messages from store
        const currentMessages = useMessageStore.getState().getMessages();

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

        // Get last response ID for conversation continuity (OpenAI Response API)
        const previousResponseId = uiStore.getLastResponseId();

        // Get the system prompt with provider type
        const systemPrompt = getSystemPrompt(provider.type);

        // Start streaming with response ID if available
        const stream = provider.streamChat(messages, {
          signal: abortControllerRef.current.signal,
          previousResponseId: previousResponseId || undefined,
          systemPrompt,
        });

        let lastSuccessfulContent = '';
        let thinkingContent = '';
        let isThinkingPhase = true; // Track if we're still in thinking phase
        let streamInterrupted = false;
        let searchMetadata: unknown = null; // Store search metadata from stream
        let responseId: string | null = null; // Store response ID from stream

        let lastStreamError: unknown = null;
        try {
          for await (const chunk of stream) {
            // Check if cancelled
            if (abortControllerRef.current?.signal.aborted) {
              streamInterrupted = true;
              break;
            }

            // Extract thinking and content from streaming chunk
            const thinking = (chunk as StreamChunk)?.choices?.[0]?.delta?.thinking || '';
            const content = (chunk as StreamChunk)?.choices?.[0]?.delta?.content || '';

            // Check for search metadata in the chunk (it comes from the StreamChunk type now)
            // Gemini sends this in the last chunk with the complete response
            if (chunk.metadata?.['searchResults']) {
              searchMetadata = chunk.metadata['searchResults'];
            }

            // Check for response ID in the chunk (OpenAI Response API)
            // Only use the responseId from metadata, NOT the chunk.id which is locally generated
            if (chunk.metadata?.['responseId']) {
              responseId = chunk.metadata?.['responseId'] as string;
            }

            // Handle thinking content - append deltas for real-time streaming
            if (thinking) {
              thinkingContent += thinking;
              // Get current message to preserve its metadata
              const currentMsg = messageStore.getMessageById(assistantMessage.id);
              // Update metadata with accumulated thinking, preserving existing metadata
              messageStore.updateMessage(assistantMessage.id, {
                metadata: {
                  ...(currentMsg?.metadata || {}),
                  thinking: thinkingContent,
                  thinkingStreaming: true,
                },
              });
            }

            // Handle regular content
            if (content) {
              // Mark end of thinking phase when content starts
              if (isThinkingPhase && thinkingContent) {
                isThinkingPhase = false;
                // Get current message to preserve its metadata
                const currentMsg = messageStore.getMessageById(assistantMessage.id);
                // Mark thinking as complete, preserving existing metadata
                messageStore.updateMessage(assistantMessage.id, {
                  metadata: {
                    ...(currentMsg?.metadata || {}),
                    thinking: thinkingContent,
                    thinkingStreaming: false,
                  },
                });
              }
              // Append the content chunk
              messageStore.appendToMessage(assistantMessage.id, content);
              lastSuccessfulContent += content;

              // Update search metadata if we have it
              if (searchMetadata) {
                const currentMsg = messageStore.getMessageById(assistantMessage.id);
                messageStore.updateMessage(assistantMessage.id, {
                  metadata: {
                    ...(currentMsg?.metadata || {}),
                    searchResults: searchMetadata,
                  },
                });
              }
            }
          }
        } catch (streamError) {
          // Streaming was interrupted
          streamInterrupted = true;
          lastStreamError = streamError;
          // Stream error handled silently

          // Append recovery message if we got partial content
          if (lastSuccessfulContent && lastSuccessfulContent.length > 0) {
            messageStore.appendToMessage(
              assistantMessage.id,
              '\n\n[Stream interrupted. Message may be incomplete.]'
            );
          }
        }

        // Get current message to preserve its metadata
        const finalMsg = messageStore.getMessageById(assistantMessage.id);
        // Mark streaming complete or partial
        if (streamInterrupted && lastSuccessfulContent.length > 0) {
          messageStore.updateMessage(assistantMessage.id, {
            status: 'received',
            metadata: {
              ...(finalMsg?.metadata || {}),
              partial: true,
              interrupted: true,
              thinking: thinkingContent || undefined,
              thinkingStreaming: false,
              ...(searchMetadata ? { searchResults: searchMetadata } : {}),
            },
          });
        } else if (!streamInterrupted) {
          messageStore.updateMessage(assistantMessage.id, {
            status: 'received',
            metadata: {
              ...(finalMsg?.metadata || {}),
              thinking: thinkingContent || undefined,
              thinkingStreaming: false,
              ...(searchMetadata ? { searchResults: searchMetadata } : {}),
            },
          });
          // Store response ID if we got one (OpenAI Response API)
          if (responseId) {
            uiStore.setLastResponseId(responseId);
          }
        } else {
          // Surface the underlying error if available; otherwise emit generic message
          if (lastStreamError instanceof Error) {
            throw lastStreamError;
          }
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

        messageStore.updateMessage(assistantMessage.id, {
          status: 'error',
          error: errorMessage,
        });
        throw error;
      } finally {
        // Only clear active message if the store is still available
        try {
          uiStore.clearActiveMessage();
        } catch (cleanupError) {
          // Ignore errors during cleanup (component may be unmounted)
          // Failed to clear active message in finally block - non-critical
        }
        abortControllerRef.current = null;
      }
    },
    [messageStore, uiStore]
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
      uiStore.clearActiveMessage();
    } catch (error) {
      // Ignore errors during cleanup (component may be unmounted)
      // Failed to clear active message during cleanup - non-critical
    }
  }, [uiStore]);

  /**
   * Check if currently streaming
   */
  const isStreaming = uiStore.getActiveMessageId() !== null;

  return {
    handleStreamingResponse,
    cancelStreaming,
    isStreaming,
  };
}
