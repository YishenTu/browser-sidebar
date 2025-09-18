/**
 * @file Message editing service
 * Handles logic for editing and managing chat messages
 */

import type { ChatMessage } from '@store/chat';

export interface EditingState {
  id: string;
  content: string;
}

/**
 * Determine what content to show when editing a message
 */
export function getEditableContent(message: ChatMessage): string {
  if (message.role !== 'user') {
    return '';
  }

  // For slash commands, always use the displayContent (which shows the slash command)
  if (message.metadata?.['usedSlashCommand'] && message.displayContent) {
    return message.displayContent;
  }

  // For messages with tab context, use the original user input
  if (message.metadata?.originalUserContent) {
    return message.metadata.originalUserContent as string;
  }

  // Default to displayContent or content
  return message.displayContent || message.content;
}

/**
 * Prepare message metadata for editing
 */
export function prepareEditMetadata(
  messages: ChatMessage[],
  editingMessage: EditingState
): {
  isFirstMessage: boolean;
  metadata: Record<string, unknown>;
} {
  const originalMessage = messages.find(msg => msg.id === editingMessage.id);
  if (!originalMessage) {
    return { isFirstMessage: false, metadata: {} };
  }

  // Preserve the original metadata structure
  const metadata = originalMessage.metadata || {};

  // Check if this is the first user message in the conversation
  const userMessages = messages.filter(m => m.role === 'user');
  const isFirstMessage = userMessages.length > 0 && userMessages[0]?.id === editingMessage.id;

  return { isFirstMessage, metadata };
}

/**
 * Build message metadata for sending
 */
export function buildMessageMetadata(
  wasEditing: boolean,
  editedMessageMetadata: Record<string, unknown>,
  metadata?: {
    expandedPrompt?: string;
    attachments?: Array<{ type: string; data?: string; fileUri?: string; mimeType?: string }>;
    modelOverride?: string;
  }
): Record<string, unknown> {
  if (wasEditing) {
    return editedMessageMetadata;
  }

  return {
    ...metadata,
    // Store that a slash command was used if expanded prompt exists
    usedSlashCommand: !!metadata?.expandedPrompt,
    // Include attachments if provided
    ...(metadata?.attachments ? { attachments: metadata.attachments } : {}),
    // Pass model override if provided (from slash commands)
    ...(metadata?.modelOverride ? { modelOverride: metadata.modelOverride } : {}),
  };
}

/**
 * Determine message content and display content
 */
export function prepareMessageContent(
  userInput: string,
  metadata?: { expandedPrompt?: string }
): {
  messageContent: string;
  displayContent: string;
} {
  // Use expanded prompt if available (from slash commands), otherwise use user input
  const messageContent = metadata?.expandedPrompt || userInput;
  const displayContent = userInput; // Always show original input in UI

  return { messageContent, displayContent };
}
