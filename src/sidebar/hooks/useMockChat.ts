/**
 * @file Mock Chat Hook
 *
 * React hook that integrates mock chat functionality with the chat store
 * for demo purposes. Provides streaming responses to user messages.
 */

import { useCallback, useRef } from 'react';
import { useChatStore } from '@store/chat';
import { generateMockResponse, simulateStreaming } from '@utils/mockChat';
import type { StreamingOptions, MockResponseType } from '@utils/mockChat';

/**
 * Hook options
 */
interface UseMockChatOptions {
  /** Enable/disable mock responses */
  enabled?: boolean;
  /** Response type to generate */
  responseType?: MockResponseType;
  /** Streaming speed */
  streamingSpeed?: StreamingOptions['speed'];
  /** Delay before response starts */
  thinkingDelay?: number;
}

/**
 * Custom hook for mock chat functionality
 */
export function useMockChat(options: UseMockChatOptions = {}) {
  const {
    enabled = true,
    responseType = 'text',
    streamingSpeed = 'normal',
    thinkingDelay = 1000,
  } = options;

  const { addMessage, updateMessage, setLoading } = useChatStore();
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamingMessageIdRef = useRef<string | null>(null);

  /**
   * Generate a mock response for a user message
   */
  const generateResponse = useCallback(
    async (userMessage: string) => {
      if (!enabled) return;

      // Cancel any ongoing streaming
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller
      abortControllerRef.current = new AbortController();

      // Set loading state
      setLoading(true);

      // Generate mock response
      const mockResponse = generateMockResponse(responseType, userMessage);

      // Create assistant message with placeholder
      const assistantMessage = addMessage({
        role: 'assistant',
        content: '',
        status: 'sending',
      });

      streamingMessageIdRef.current = assistantMessage.id;

      // Stream the response
      await simulateStreaming(mockResponse.content, {
        speed: streamingSpeed,
        thinkingDelay,
        onChunk: (chunk, metadata) => {
          // Check if streaming was cancelled
          if (abortControllerRef.current?.signal.aborted) {
            return;
          }

          // Update message with accumulated content
          if (streamingMessageIdRef.current) {
            const currentMessage = useChatStore
              .getState()
              .messages.find(m => m.id === streamingMessageIdRef.current);

            if (currentMessage) {
              updateMessage(streamingMessageIdRef.current, {
                content: currentMessage.content + chunk,
                status: metadata.isComplete ? 'sent' : 'sending',
              });
            }
          }
        },
        onComplete: () => {
          // Mark as complete
          if (streamingMessageIdRef.current) {
            updateMessage(streamingMessageIdRef.current, {
              status: 'sent',
            });
          }
          setLoading(false);
          streamingMessageIdRef.current = null;
        },
        onError: error => {
          // Handle streaming error
          if (streamingMessageIdRef.current) {
            updateMessage(streamingMessageIdRef.current, {
              status: 'error',
              error: error.message,
            });
          }
          setLoading(false);
          streamingMessageIdRef.current = null;
        },
      });
    },
    [enabled, responseType, streamingSpeed, thinkingDelay, addMessage, updateMessage, setLoading]
  );

  /**
   * Cancel ongoing streaming
   */
  const cancelStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (streamingMessageIdRef.current) {
      updateMessage(streamingMessageIdRef.current, {
        status: 'sent',
      });
      streamingMessageIdRef.current = null;
    }

    setLoading(false);
  }, [updateMessage, setLoading]);

  /**
   * Check if currently streaming
   */
  const isStreaming = useCallback(() => {
    return streamingMessageIdRef.current !== null;
  }, []);

  return {
    generateResponse,
    cancelStreaming,
    isStreaming,
  };
}

export default useMockChat;
