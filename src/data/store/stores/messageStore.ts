/**
 * @file Message Store
 *
 * Manages chat messages within the active session
 */

import { create } from 'zustand';
import { responseIdManager } from '@core/services/responseIdManager';
import { ChatMessage, CreateMessageOptions, UpdateMessageOptions } from '../types/message';
import { generateMessageId, getDefaultStatus } from '../utils/chatHelpers';
import { useSessionStore } from './sessionStore';

export interface MessageState {
  // Actions for message management
  addMessage: (options: CreateMessageOptions) => ChatMessage;
  updateMessage: (id: string, updates: UpdateMessageOptions) => void;
  appendToMessage: (id: string, content: string) => void;
  deleteMessage: (id: string) => void;
  editMessage: (id: string) => ChatMessage | undefined;
  getPreviousUserMessage: (assistantMessageId: string) => ChatMessage | undefined;
  removeMessageAndAfter: (id: string) => void;

  // Selectors for accessing data
  getMessages: () => ChatMessage[];
  getUserMessages: () => ChatMessage[];
  getAssistantMessages: () => ChatMessage[];
  getLastMessage: () => ChatMessage | undefined;
  getMessageById: (id: string) => ChatMessage | undefined;
  hasMessages: () => boolean;
  getMessageCount: () => number;
}

export const useMessageStore = create<MessageState>(() => ({
  addMessage: (options: CreateMessageOptions) => {
    const newMessage: ChatMessage = {
      id: options.id || generateMessageId(),
      role: options.role,
      content: options.content,
      displayContent: options.displayContent,
      timestamp: options.timestamp || new Date(),
      status: options.status || getDefaultStatus(options.role),
      error: options.error,
      metadata: options.metadata,
    };

    const sessionStore = useSessionStore.getState();
    const session = sessionStore.getActiveSession();

    if (session) {
      sessionStore.updateActiveSession({
        messages: [...session.messages, newMessage],
      });
    }

    return newMessage;
  },

  updateMessage: (id: string, updates: UpdateMessageOptions) => {
    const sessionStore = useSessionStore.getState();
    const session = sessionStore.getActiveSession();

    if (session) {
      const updatedMessages = session.messages.map(message =>
        message.id === id
          ? {
              ...message,
              ...updates,
              timestamp: message.timestamp,
              id: message.id,
              metadata: updates.metadata
                ? { ...message.metadata, ...updates.metadata }
                : message.metadata,
            }
          : message
      );

      sessionStore.updateActiveSession({ messages: updatedMessages });
    }
  },

  appendToMessage: (id: string, content: string) => {
    const sessionStore = useSessionStore.getState();
    const session = sessionStore.getActiveSession();

    if (session) {
      const updatedMessages = session.messages.map(message =>
        message.id === id ? { ...message, content: message.content + content } : message
      );

      sessionStore.updateActiveSession({ messages: updatedMessages });
    }
  },

  deleteMessage: (id: string) => {
    const sessionStore = useSessionStore.getState();
    const session = sessionStore.getActiveSession();

    if (session) {
      const updatedMessages = session.messages.filter(message => message.id !== id);
      sessionStore.updateActiveSession({ messages: updatedMessages });
    }
  },

  editMessage: (id: string) => {
    const sessionStore = useSessionStore.getState();
    const session = sessionStore.getActiveSession();

    if (!session) return undefined;

    const messageIndex = session.messages.findIndex(msg => msg.id === id);
    if (messageIndex === -1) return undefined;

    const messageToEdit = session.messages[messageIndex];
    const updatedMessages = session.messages.slice(0, messageIndex + 1);

    sessionStore.updateActiveSession({
      messages: updatedMessages,
    });

    responseIdManager.clearResponseId();

    return messageToEdit;
  },

  getPreviousUserMessage: (assistantMessageId: string) => {
    const session = useSessionStore.getState().getActiveSession();
    if (!session) return undefined;

    const assistantIndex = session.messages.findIndex(msg => msg.id === assistantMessageId);
    if (assistantIndex === -1) return undefined;

    for (let i = assistantIndex - 1; i >= 0; i--) {
      if (session.messages[i]?.role === 'user') {
        return session.messages[i];
      }
    }

    return undefined;
  },

  removeMessageAndAfter: (id: string) => {
    const sessionStore = useSessionStore.getState();
    const session = sessionStore.getActiveSession();

    if (!session) return;

    const messageIndex = session.messages.findIndex(msg => msg.id === id);
    if (messageIndex === -1) return;

    const updatedMessages = session.messages.slice(0, messageIndex);
    sessionStore.updateActiveSession({
      messages: updatedMessages,
    });
    responseIdManager.clearResponseId();
  },

  // Selectors
  getMessages: () => {
    const session = useSessionStore.getState().getActiveSession();
    return session ? session.messages : [];
  },

  getUserMessages: () => {
    const session = useSessionStore.getState().getActiveSession();
    return session ? session.messages.filter(msg => msg.role === 'user') : [];
  },

  getAssistantMessages: () => {
    const session = useSessionStore.getState().getActiveSession();
    return session ? session.messages.filter(msg => msg.role === 'assistant') : [];
  },

  getLastMessage: () => {
    const session = useSessionStore.getState().getActiveSession();
    if (!session || session.messages.length === 0) return undefined;
    return session.messages[session.messages.length - 1];
  },

  getMessageById: (id: string) => {
    const session = useSessionStore.getState().getActiveSession();
    return session ? session.messages.find(msg => msg.id === id) : undefined;
  },

  hasMessages: () => {
    const session = useSessionStore.getState().getActiveSession();
    return session ? session.messages.length > 0 : false;
  },

  getMessageCount: () => {
    const session = useSessionStore.getState().getActiveSession();
    return session ? session.messages.length : 0;
  },
}));
