/**
 * @file Message Processing Service
 *
 * Pure functions for message format conversion and processing
 */

import type { ProviderChatMessage } from '@/types/providers';

/**
 * Base message interface that can work with different message structures
 */
export interface BaseMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string | { text?: string; [key: string]: unknown };
  timestamp: Date | number;
}

/**
 * Helper function to convert chat messages to provider message format
 *
 * @param currentMessages - All current messages in the chat
 * @param assistantMessage - The assistant message being created
 * @param userMessage - Optional user message for first message case
 * @returns Array of provider-formatted messages
 */
export function convertToProviderMessages(
  currentMessages: BaseMessage[],
  assistantMessage: BaseMessage,
  userMessage?: BaseMessage
): ProviderChatMessage[] {
  let messages: ProviderChatMessage[];

  const getContent = (msg: BaseMessage): string => {
    return typeof msg.content === 'string' ? msg.content : msg.content.text || '';
  };

  const getTimestamp = (msg: BaseMessage): Date => {
    return typeof msg.timestamp === 'number' ? new Date(msg.timestamp) : msg.timestamp;
  };

  if (userMessage && currentMessages.filter(m => m.role === 'user' && getContent(m)).length === 1) {
    // First message case - use the userMessage directly
    messages = [
      {
        id: userMessage.id,
        role: userMessage.role as 'user',
        content: getContent(userMessage),
        timestamp: getTimestamp(userMessage),
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
        const content = getContent(msg);
        if (!content || content.trim() === '') {
          return false;
        }
        return true;
      })
      .map(msg => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        content: getContent(msg),
        timestamp: getTimestamp(msg),
      }));
  }

  return messages;
}
