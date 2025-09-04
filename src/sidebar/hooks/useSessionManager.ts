/**
 * @file Session Manager Hook
 *
 * Manages chat session lifecycle based on tab ID and URL.
 * Handles session switching, tab close events, and session initialization.
 */

import { useEffect, useRef } from 'react';
import { useSessionStore } from '@/data/store/chat';
import { createMessage } from '@/types/messages';
import type {
  GetTabInfoMessage,
  TabClosedMessage,
  GetTabInfoPayload,
  Message,
} from '@/types/messages';
import { addMessageListener, sendMessage } from '@platform/chrome/runtime';

/**
 * Session information
 */
export interface SessionInfo {
  tabId: number;
  url: string;
}

/**
 * Hook to manage chat sessions based on tab+URL combinations
 *
 * Features:
 * - Automatically switches to appropriate session on mount
 * - Listens for tab close events to clean up sessions
 * - Returns current session information
 *
 * @returns Object with current session info
 *
 * @example
 * ```tsx
 * const { currentSession } = useSessionManager();
 *
 * if (currentSession) {
 *   // Active session: Tab ${currentSession.tabId} at ${currentSession.url}
 * }
 * ```
 */
export function useSessionManager() {
  const { switchSession, clearTabSessions } = useSessionStore();
  const currentSessionRef = useRef<SessionInfo | null>(null);

  // Get current tab info on mount and switch to appropriate session
  useEffect(() => {
    async function initSession() {
      try {
        const message = createMessage({
          type: 'GET_TAB_INFO',
          source: 'sidebar',
          target: 'background',
        }) as GetTabInfoMessage;

        const result = await sendMessage<GetTabInfoMessage, Message<GetTabInfoPayload>>(message);
        const response = result.success ? result.data : null;

        if (response?.payload?.tabId && response?.payload?.url) {
          const { tabId, url } = response.payload;
          currentSessionRef.current = { tabId, url };

          // Switch to the appropriate session for this tab+URL
          switchSession(tabId, url);
        }
      } catch (error) {
        console.error('Failed to initialize session:', error);
        // Continue without session - app can still function
      }
    }

    initSession();
  }, [switchSession]);

  // Listen for tab removal events to clean up sessions
  useEffect(() => {
    const remove = addMessageListener(message => {
      const msg = message as TabClosedMessage | { type?: string; payload?: { tabId?: number } };
      if (
        (msg as TabClosedMessage)?.type === 'TAB_CLOSED' &&
        (msg as TabClosedMessage).payload?.tabId
      ) {
        // Clear all sessions for the closed tab
        clearTabSessions((msg as TabClosedMessage).payload!.tabId);

        // If the closed tab was our current session, clear the ref
        if (currentSessionRef.current?.tabId === (msg as TabClosedMessage).payload!.tabId) {
          currentSessionRef.current = null;
        }
      }
    });

    // Cleanup listener on unmount
    return () => remove();
  }, [clearTabSessions]);

  return {
    currentSession: currentSessionRef.current,
  };
}

/**
 * Hook to check if content editing should be disabled for the current session
 *
 * @returns Whether content editing should be disabled (true if session has messages)
 *
 * @example
 * ```tsx
 * const isEditDisabled = useSessionEditRestriction();
 *
 * <Button disabled={isEditDisabled}>
 *   Edit Content
 * </Button>
 * ```
 */
export function useSessionEditRestriction(): boolean {
  const { getSessionMessageCount } = useSessionStore();
  const { currentSession } = useSessionManager();

  if (!currentSession) {
    return false; // Allow editing if no session
  }

  const messageCount = getSessionMessageCount(currentSession.tabId, currentSession.url);
  return messageCount > 0; // Disable editing if session has messages
}
