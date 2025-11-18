/**
 * @file UI Store
 *
 * Manages UI state including loading, errors, and active states
 */

import { create } from 'zustand';
import { useSessionStore } from './sessionStore';
import { generateConversationId } from '../utils/chatHelpers';

export interface UIState {
  // Actions for state management
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  setActiveMessage: (messageId: string | null) => void;
  clearActiveMessage: () => void;

  // Conversation management
  clearConversation: () => void;
  startNewConversation: (conversationId?: string) => void;

  // Getters for UI state
  isLoading: () => boolean;
  getError: () => string | null;
  getActiveMessageId: () => string | null;
  getConversationId: () => string | null;
}

export const useUIStore = create<UIState>(() => ({
  setLoading: (loading: boolean) => {
    const sessionStore = useSessionStore.getState();
    sessionStore.updateActiveSession({ isLoading: loading });
  },

  setError: (error: string | null) => {
    const sessionStore = useSessionStore.getState();
    sessionStore.updateActiveSession({ error });
  },

  clearError: () => {
    const sessionStore = useSessionStore.getState();
    sessionStore.updateActiveSession({ error: null });
  },

  setActiveMessage: (messageId: string | null) => {
    const sessionStore = useSessionStore.getState();
    sessionStore.updateActiveSession({ activeMessageId: messageId });
  },

  clearActiveMessage: () => {
    const sessionStore = useSessionStore.getState();
    sessionStore.updateActiveSession({ activeMessageId: null });
  },

  clearConversation: () => {
    useSessionStore.getState().clearCurrentSession();
  },

  startNewConversation: (conversationId?: string) => {
    const sessionStore = useSessionStore.getState();
    const session = sessionStore.getActiveSession();

    if (session) {
      sessionStore.clearCurrentSession();
      sessionStore.updateActiveSession({
        conversationId: conversationId || generateConversationId(),
      });
    }
  },

  // Getters
  isLoading: () => {
    const session = useSessionStore.getState().getActiveSession();
    return session ? session.isLoading : false;
  },

  getError: () => {
    const session = useSessionStore.getState().getActiveSession();
    return session ? session.error : null;
  },

  getActiveMessageId: () => {
    const session = useSessionStore.getState().getActiveSession();
    return session ? session.activeMessageId : null;
  },

  getConversationId: () => {
    const session = useSessionStore.getState().getActiveSession();
    return session ? session.conversationId : null;
  },
}));
