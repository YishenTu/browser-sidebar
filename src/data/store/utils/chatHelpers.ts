/**
 * @file Chat Store Helper Utilities
 *
 * Utility functions for chat store operations
 */

import { normalizeUrl } from '../../../shared/utils/urlNormalizer';
import { MessageRole, MessageStatus } from '../types/message';
import { SessionData } from '../types/session';

/**
 * Generate a unique message ID
 */
export function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate a unique conversation ID
 */
export function generateConversationId(): string {
  return `conv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Determine default status based on message role
 */
export function getDefaultStatus(role: MessageRole): MessageStatus {
  switch (role) {
    case 'user':
      return 'sent';
    case 'assistant':
      return 'received';
    case 'system':
      return 'received';
    default:
      return 'received';
  }
}

/**
 * Helper to create a normalized session key
 */
export function createSessionKey(tabId: number, url: string): string {
  const normalizedUrl = normalizeUrl(url);
  return `tab_${tabId}:${normalizedUrl}`;
}

/**
 * Create a new session with default values
 */
export function createNewSession(tabId: number, url: string): SessionData {
  return {
    messages: [],
    conversationId: generateConversationId(),
    lastResponseId: null,
    isLoading: false,
    error: null,
    activeMessageId: null,
    loadedTabs: {},
    tabSelectionOrder: [],
    currentTabId: null,
    hasAutoLoaded: false,
    tabId,
    url: normalizeUrl(url),
    createdAt: Date.now(),
    lastAccessedAt: Date.now(),
  };
}

/**
 * Update session's last accessed time
 */
export function updateSessionAccess(session: SessionData): SessionData {
  return {
    ...session,
    lastAccessedAt: Date.now(),
  };
}
