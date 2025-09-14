/**
 * @file Message Handler Hook
 *
 * Handles sending messages and managing responses from AI providers.
 * Supports both legacy hook-based streaming and new ChatService-based streaming
 * controlled by the refactorMode feature flag.
 */

import { useCallback, useRef, useEffect, useMemo } from 'react';
import {
  useMessageStore,
  useUIStore,
  useTabStore,
  type MessageState,
  type UIState,
} from '@store/chat';
import { useSettingsStore } from '@store/settings';
import { getModelById } from '@/config/models';
import { getSystemPrompt } from '@/config/systemPrompt';
import { formatTabContent } from '../../../services/chat/contentFormatter';
import { ChatService } from '../../../services/chat/ChatService';
import type { AIProvider, ProviderChatMessage, StreamChunk } from '../../../types/providers';
import type { SendMessageOptions, UseMessageHandlerReturn } from './types';
import type { TabContent } from '../../../types/tabs';
import type { ChatMessage } from '@store/chat';

interface MessageHandlerDeps {
  getActiveProvider: () => AIProvider | null;
  enabled?: boolean;
}

/**
 * Helper function to convert chat messages to provider message format
 */
function convertToProviderMessages(
  currentMessages: ChatMessage[],
  assistantMessage: ChatMessage,
  userMessage?: ChatMessage
): ProviderChatMessage[] {
  let messages: ProviderChatMessage[];

  if (userMessage && currentMessages.filter(m => m.role === 'user' && m.content).length === 1) {
    // First message case - use the userMessage directly
    messages = [
      {
        id: userMessage.id,
        role: userMessage.role as 'user',
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
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        timestamp: new Date(msg.timestamp),
      }));
  }

  return messages;
}

/**
 * Enhanced streaming handler using ChatService
 */
function createChatServiceStreamHandler(
  messageStore: MessageState,
  uiStore: UIState,
  chatServiceRef: React.MutableRefObject<ChatService | null>
) {
  return async (
    provider: AIProvider,
    assistantMessage: ChatMessage,
    userMessage?: ChatMessage
  ): Promise<void> => {
    if (!chatServiceRef.current) {
      throw new Error('Chat service not initialized');
    }

    // Set the provider on the chat service
    chatServiceRef.current.setProvider(provider);

    try {
      // Set active message for streaming
      uiStore.setActiveMessage(assistantMessage.id);

      // Get current messages from store
      const currentMessages = useMessageStore.getState().getMessages();

      // Build messages array for the provider
      const messages = convertToProviderMessages(currentMessages, assistantMessage, userMessage);

      // Ensure we have at least one message
      if (messages.length === 0) {
        throw new Error('No valid messages to send to AI provider');
      }

      // Get last response ID for conversation continuity (OpenAI Response API)
      const previousResponseId = uiStore.getLastResponseId();

      // Check if we have tab content loaded
      const loadedTabs = useTabStore.getState().getLoadedTabs();
      const hasTabContent = Object.keys(loadedTabs).length > 0;

      // Get the system prompt with provider type and tab content status
      const systemPrompt = getSystemPrompt(provider.type, hasTabContent);

      // Start streaming using ChatService
      const stream = chatServiceRef.current.stream(messages, {
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
          if (!chatServiceRef.current?.isStreaming()) {
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
    }
  };
}

export function useMessageHandler({
  getActiveProvider,
  enabled = true,
}: MessageHandlerDeps): UseMessageHandlerReturn {
  const messageStore = useMessageStore();
  const uiStore = useUIStore();
  const settingsStore = useSettingsStore();

  // ChatService for refactor mode
  const chatServiceRef = useRef<ChatService | null>(null);

  // Initialize ChatService for refactor mode
  useEffect(() => {
    if (enabled && !chatServiceRef.current) {
      chatServiceRef.current = new ChatService();
    }
  }, [enabled]);

  // Enhanced streaming handler using ChatService
  const handleStreamingResponse = useMemo(
    () => createChatServiceStreamHandler(messageStore, uiStore, chatServiceRef),
    [messageStore, uiStore, chatServiceRef]
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

        // Check if this is the first message in the conversation
        const existingMessages = messageStore.getMessages();
        const userMessages = existingMessages.filter(m => m.role === 'user');

        // For editing (skipUserMessage=true), check if we're editing the first user message
        // For new messages, check if there are no user messages yet
        const isFirstMessage = skipUserMessage
          ? userMessages.length === 1 // Editing scenario: exactly one user message means we're editing the first
          : userMessages.length === 0; // New message scenario: no user messages yet

        // Check if we have loaded tabs to include
        const loadedTabs = useTabStore.getState().getLoadedTabs();
        const loadedTabIds = Object.keys(loadedTabs).map(id => parseInt(id, 10));

        // Always format the first message (with or without tabs)
        if (isFirstMessage) {
          // Get all loaded tabs (may be empty array)
          const allLoadedTabs = loadedTabIds
            .map(tabId => loadedTabs[tabId])
            .filter((tab): tab is TabContent => Boolean(tab));

          // Format the content - will add system instruction even if no tabs
          formatResult = formatTabContent(trimmedContent, allLoadedTabs);

          // Use formatted content for AI but keep original for display
          finalContent = formatResult.formatted;
          hasTabContext = allLoadedTabs.length > 0;
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
          // For editing/regeneration, get the last user message
          const lastUserMessage = messageStore.getUserMessages().slice(-1)[0];
          if (!lastUserMessage) {
            throw new Error('No user message found for regeneration');
          }
          userMessage = lastUserMessage;

          // Update the user message with new content
          // This is important for both:
          // 1. Tab context injection when editing first message
          // 2. Regular edits to update the content
          messageStore.updateMessage(userMessage.id, {
            content: finalContent,
            displayContent: finalDisplayContent,
            metadata: {
              ...userMessage.metadata,
              ...metadata,
              hasTabContext,
              originalUserContent: hasTabContext ? trimmedContent : undefined,
            },
          });
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
    [enabled, messageStore, uiStore, settingsStore, getActiveProvider, handleStreamingResponse]
  );

  /**
   * Cancel the current message/streaming operation
   */
  const cancelMessage = useCallback(() => {
    // Use ChatService cancellation
    if (chatServiceRef.current) {
      chatServiceRef.current.cancel();
    }
    uiStore.setLoading(false);
  }, [uiStore]);

  /**
   * Check if currently streaming
   */
  const isStreaming = useCallback(() => {
    return chatServiceRef.current?.isStreaming() ?? false;
  }, []);

  return {
    sendMessage,
    cancelMessage,
    isStreaming,
  };
}
