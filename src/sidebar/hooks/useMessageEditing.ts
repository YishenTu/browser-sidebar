/**
 * @file Message editing hook
 * Custom React hook for handling message editing state and operations
 */

import { useState, useCallback } from 'react';
import type { ChatMessage } from '@store/chat';
import {
  getEditableContent,
  prepareEditMetadata,
  buildMessageMetadata,
  prepareMessageContent,
  type EditingState,
} from '@core/services/messageEditing';

export interface UseMessageEditingOptions {
  messages: ChatMessage[];
  editMessage: (messageId: string) => void;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  sendMessage: (
    content: string,
    options?: {
      skipUserMessage?: boolean;
      displayContent?: string;
      metadata?: Record<string, unknown>;
    }
  ) => Promise<void>;
}

export interface UseMessageEditingReturn {
  editingMessage: EditingState | null;
  handleEditMessage: (message: ChatMessage) => void;
  handleClearEdit: () => void;
  handleSendEditedMessage: (
    userInput: string,
    metadata?: {
      expandedPrompt?: string;
      modelOverride?: string;
      attachments?: Array<{ type: string; data?: string; fileUri?: string; mimeType?: string }>;
    }
  ) => Promise<boolean>;
}

/**
 * Custom hook for message editing functionality
 */
export function useMessageEditing(options: UseMessageEditingOptions): UseMessageEditingReturn {
  const { messages, editMessage, updateMessage, sendMessage } = options;
  const [editingMessage, setEditingMessage] = useState<EditingState | null>(null);

  const handleEditMessage = useCallback((message: ChatMessage) => {
    if (message.role === 'user') {
      const editContent = getEditableContent(message);
      setEditingMessage({ id: message.id, content: editContent });
    }
  }, []);

  const handleClearEdit = useCallback(() => {
    setEditingMessage(null);
  }, []);

  const handleSendEditedMessage = useCallback(
    async (
      userInput: string,
      metadata?: {
        expandedPrompt?: string;
        modelOverride?: string;
        attachments?: Array<{ type: string; data?: string; fileUri?: string; mimeType?: string }>;
      }
    ): Promise<boolean> => {
      if (!editingMessage) {
        return false;
      }

      const { isFirstMessage, metadata: editedMessageMetadata } = prepareEditMetadata(
        messages,
        editingMessage
      );

      const { messageContent, displayContent } = prepareMessageContent(userInput, metadata);
      const messageMetadata = buildMessageMetadata(true, editedMessageMetadata, metadata);

      // Remove all messages after the edited one
      editMessage(editingMessage.id);

      // For the first message, don't update content here - let the handler deal with it
      if (isFirstMessage) {
        // Update status and displayContent immediately for UI feedback
        updateMessage(editingMessage.id, {
          displayContent: displayContent,
          status: 'sending',
        });
      } else {
        // For non-first messages, update normally
        updateMessage(editingMessage.id, {
          content: messageContent,
          displayContent: displayContent,
          status: 'sending',
          metadata: Object.keys(messageMetadata).length > 0 ? messageMetadata : undefined,
        });
      }

      // Send message without creating a duplicate user message
      // For first message, pass the raw user input so it can be formatted with tabs
      await sendMessage(isFirstMessage ? userInput : messageContent, {
        skipUserMessage: true, // Prevent duplicate user message
        displayContent: displayContent,
        metadata: Object.keys(messageMetadata).length > 0 ? messageMetadata : undefined,
      });

      // Clear edit mode
      setEditingMessage(null);
      return true;
    },
    [editingMessage, messages, editMessage, updateMessage, sendMessage]
  );

  return {
    editingMessage,
    handleEditMessage,
    handleClearEdit,
    handleSendEditedMessage,
  };
}
