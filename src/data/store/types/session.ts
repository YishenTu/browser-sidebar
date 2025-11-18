/**
 * @file Session Type Definitions
 *
 * Type definitions for session management and tab state
 */

import type { ProviderType } from '../../../types/providers';
import { TabContent } from '../../../types/tabs';
import { ChatMessage } from './message';

/**
 * Session data structure for each tab+URL combination
 */
export interface SessionData {
  // Core message state
  messages: ChatMessage[];
  conversationId: string;
  lastResponseId: string | null;
  lastResponseProvider: ProviderType | null;

  // Session-specific UI state
  isLoading: boolean;
  error: string | null;
  activeMessageId: string | null;

  // Tab state
  loadedTabs: Record<number, TabContent>;
  tabSelectionOrder: number[];
  currentTabId: number | null;
  hasAutoLoaded: boolean;

  // Metadata
  tabId: number;
  url: string;
  createdAt: number;
  lastAccessedAt: number;
}

/**
 * Session management configuration
 */
export interface SessionConfig {
  /** Maximum number of sessions to keep in memory */
  maxSessions?: number;
  /** Session timeout in milliseconds */
  sessionTimeout?: number;
  /** Whether to persist sessions to storage */
  persistSessions?: boolean;
}
