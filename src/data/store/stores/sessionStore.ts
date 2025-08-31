/**
 * @file Session Store
 *
 * Manages browser tab sessions and active session state
 */

import { create } from 'zustand';
import { SessionData } from '../types/session';
import { createSessionKey, createNewSession, updateSessionAccess } from '../utils/chatHelpers';

export interface SessionState {
  // Session management
  sessions: Record<string, SessionData>;
  activeSessionKey: string | null;

  // Actions
  createSessionKey: (tabId: number, url: string) => string;
  getOrCreateSession: (tabId: number, url: string) => SessionData;
  switchSession: (tabId: number, url: string) => SessionData;
  updateActiveSession: (updates: Partial<SessionData>) => void;
  clearSession: (sessionKey: string) => void;
  clearTabSessions: (tabId: number) => void;
  clearCurrentSession: () => void;
  getActiveSession: () => SessionData | null;
  hasSession: (tabId: number, url: string) => boolean;
  getSessionMessageCount: (tabId: number, url: string) => number;
  getAllSessionKeys: () => string[];
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: {},
  activeSessionKey: null,

  createSessionKey: (tabId: number, url: string) => {
    return createSessionKey(tabId, url);
  },

  getOrCreateSession: (tabId: number, url: string) => {
    const sessionKey = createSessionKey(tabId, url);
    const existingSession = get().sessions[sessionKey];

    if (existingSession) {
      const updatedSession = updateSessionAccess(existingSession);
      set(state => ({
        sessions: {
          ...state.sessions,
          [sessionKey]: updatedSession,
        },
      }));
      return updatedSession;
    }

    const newSession = createNewSession(tabId, url);
    set(state => ({
      sessions: {
        ...state.sessions,
        [sessionKey]: newSession,
      },
    }));
    return newSession;
  },

  switchSession: (tabId: number, url: string) => {
    const sessionKey = createSessionKey(tabId, url);
    const session = get().getOrCreateSession(tabId, url);

    set({ activeSessionKey: sessionKey });
    return session;
  },

  updateActiveSession: (updates: Partial<SessionData>) => {
    set(state => {
      if (!state.activeSessionKey) return state;
      const session = state.sessions[state.activeSessionKey];
      if (!session) return state;

      return {
        sessions: {
          ...state.sessions,
          [state.activeSessionKey]: {
            ...session,
            ...updates,
          },
        },
      };
    });
  },

  clearSession: (sessionKey: string) => {
    set(state => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [sessionKey]: removed, ...remainingSessions } = state.sessions;
      return {
        sessions: remainingSessions,
        activeSessionKey: state.activeSessionKey === sessionKey ? null : state.activeSessionKey,
      };
    });
  },

  clearTabSessions: (tabId: number) => {
    set(state => {
      const sessionKeysToRemove = Object.keys(state.sessions).filter(key =>
        key.startsWith(`tab_${tabId}:`)
      );

      const newSessions = { ...state.sessions };
      sessionKeysToRemove.forEach(key => {
        delete newSessions[key];
      });

      const activeCleared =
        state.activeSessionKey && sessionKeysToRemove.includes(state.activeSessionKey);

      return {
        sessions: newSessions,
        activeSessionKey: activeCleared ? null : state.activeSessionKey,
      };
    });
  },

  clearCurrentSession: () => {
    const state = get();
    if (state.activeSessionKey) {
      const session = state.sessions[state.activeSessionKey];
      if (session) {
        const newSession = createNewSession(session.tabId, session.url);
        set(state => ({
          sessions: {
            ...state.sessions,
            [state.activeSessionKey!]: newSession,
          },
        }));
      }
    }
  },

  getActiveSession: () => {
    const state = get();
    return state.activeSessionKey ? state.sessions[state.activeSessionKey] || null : null;
  },

  hasSession: (tabId: number, url: string) => {
    const sessionKey = createSessionKey(tabId, url);
    return sessionKey in get().sessions;
  },

  getSessionMessageCount: (tabId: number, url: string) => {
    const sessionKey = createSessionKey(tabId, url);
    const session = get().sessions[sessionKey];
    return session ? session.messages.length : 0;
  },

  getAllSessionKeys: () => {
    return Object.keys(get().sessions);
  },
}));
