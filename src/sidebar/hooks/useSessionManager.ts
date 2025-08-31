/**
 * @file Session Manager Hook
 *
 * Manages chat session lifecycle based on tab ID and URL.
 * Handles session switching, tab close events, and session initialization.
 */

import { useEffect, useRef } from 'react';
import { useSessionStore } from '@/data/store/chat';
import { createMessage } from '@/types/messages';

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
 *   console.log(`Active session: Tab ${currentSession.tabId} at ${currentSession.url}`);
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
        });

        const response = await chrome.runtime.sendMessage(message);

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
    const handleMessage = (message: any) => {
      if (message.type === 'TAB_CLOSED' && message.payload?.tabId) {
        // Clear all sessions for the closed tab
        clearTabSessions(message.payload.tabId);

        // If the closed tab was our current session, clear the ref
        if (currentSessionRef.current?.tabId === message.payload.tabId) {
          currentSessionRef.current = null;
        }
      }
    };

    // Add listener for tab close events from background script
    chrome.runtime.onMessage.addListener(handleMessage);

    // Cleanup listener on unmount
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
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
