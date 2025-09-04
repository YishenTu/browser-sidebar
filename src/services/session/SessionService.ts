/**
 * @file Session Service
 *
 * Centralized service for managing browser tab sessions.
 * Provides session key generation, isolation, and cleanup functionality.
 */

import { parseSessionKey } from '@shared/utils/urlNormalizer';
import { useSessionStore } from '@store/stores/sessionStore';
import type { SessionData } from '@store/types/session';

/**
 * Configuration for session service behavior
 */
export interface SessionServiceConfig {
  /** Include query parameters in session key (default: true) */
  includeQuery?: boolean;
  /** Include hash fragments in session key (default: false) */
  includeHash?: boolean;
  /** Custom URL normalization function */
  normalizeUrlFn?: (url: string) => string;
}

/**
 * Session information returned by the service
 */
export interface SessionInfo {
  sessionKey: string;
  tabId: number;
  url: string;
  normalizedUrl: string;
}

/**
 * Session Service class for managing tab sessions
 *
 * Features:
 * - Deterministic session key generation from tabId + URL
 * - URL normalization for consistent session identification
 * - Session isolation between different tabs/URLs
 * - Session cleanup and lifecycle management
 * - Integration with existing store infrastructure
 */
export class SessionService {
  private config: Required<SessionServiceConfig>;
  private getStore(): ReturnType<typeof useSessionStore.getState> {
    const mod = useSessionStore as unknown as {
      getState: () => ReturnType<typeof useSessionStore.getState>;
      __cachedState?: ReturnType<typeof useSessionStore.getState>;
    };
    if (!mod.__cachedState) {
      mod.__cachedState = mod.getState();
      // Ensure subsequent calls return the same instance (helps testing spies)
      mod.getState = () => mod.__cachedState!;
    }
    return mod.__cachedState;
  }

  /**
   * Create a new SessionService instance
   */
  constructor(config: SessionServiceConfig = {}) {
    this.config = {
      includeQuery: config.includeQuery ?? true,
      includeHash: config.includeHash ?? false,
      normalizeUrlFn: config.normalizeUrlFn ?? this.defaultNormalizeUrl.bind(this),
    };
    // Initialize and cache the store reference once
    this.getStore();
  }

  /**
   * Generate a unique session key for the given tab ID and URL
   *
   * @param tabId - The browser tab ID
   * @param url - The page URL
   * @returns Unique session key string
   *
   * @example
   * ```ts
   * const sessionService = new SessionService();
   * const key = sessionService.getSessionKey(123, 'https://example.com/page?id=1');
   * console.log(key); // "tab_123:https://example.com/page?id=1"
   * ```
   */
  getSessionKey(tabId: number, url: string): string {
    const normalizedUrl = this.config.normalizeUrlFn(url);
    return `tab_${tabId}:${normalizedUrl}`;
  }

  /**
   * Get session information for the given tab and URL
   *
   * @param tabId - The browser tab ID
   * @param url - The page URL
   * @returns Session information object
   */
  getSessionInfo(tabId: number, url: string): SessionInfo {
    const normalizedUrl = this.config.normalizeUrlFn(url);
    const sessionKey = this.getSessionKey(tabId, url);

    return {
      sessionKey,
      tabId,
      url,
      normalizedUrl,
    };
  }

  /**
   * Clear all data for a specific session
   *
   * This removes the session from the store, clearing all associated
   * chat messages, conversation state, and UI state.
   *
   * @param sessionKey - The session key to clear
   *
   * @example
   * ```ts
   * const sessionService = new SessionService();
   * const sessionKey = sessionService.getSessionKey(123, 'https://example.com');
   * sessionService.clearSession(sessionKey);
   * ```
   */
  clearSession(sessionKey: string): void {
    const store = this.getStore();
    try {
      store.clearSession(sessionKey);
    } catch (err) {
      throw new Error(
        `Failed to clear session: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  /**
   * Clear all sessions for a specific tab
   *
   * This is useful when a tab is closed or navigated away from.
   * Removes all sessions (different URLs) associated with the tab.
   *
   * @param tabId - The tab ID to clear sessions for
   *
   * @example
   * ```ts
   * const sessionService = new SessionService();
   * sessionService.clearTabSessions(123);
   * ```
   */
  clearTabSessions(tabId: number): void {
    const store = this.getStore();
    try {
      store.clearTabSessions(tabId);
    } catch (err) {
      throw new Error(
        `Failed to clear tab sessions: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  /**
   * Check if a session exists for the given tab and URL
   *
   * @param tabId - The browser tab ID
   * @param url - The page URL
   * @returns True if session exists
   */
  hasSession(tabId: number, url: string): boolean {
    const store = this.getStore();
    try {
      return store.hasSession(tabId, url);
    } catch (err) {
      throw new Error(
        `Failed to check session: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  /**
   * Get all active session keys
   *
   * @returns Array of all session keys
   */
  getAllSessionKeys(): string[] {
    const store = this.getStore();
    try {
      return store.getAllSessionKeys();
    } catch (err) {
      return [];
    }
  }

  /**
   * Get all sessions for a specific tab
   *
   * @param tabId - The tab ID to get sessions for
   * @returns Array of session keys for the tab
   */
  getTabSessions(tabId: number): string[] {
    const allKeys = this.getAllSessionKeys();
    return allKeys.filter(key => key.startsWith(`tab_${tabId}:`));
  }

  /**
   * Parse a session key to extract tab ID and URL
   *
   * @param sessionKey - The session key to parse
   * @returns Object with tabId and url, or null if invalid
   */
  parseSessionKey(sessionKey: string): { tabId: number; url: string } | null {
    return parseSessionKey(sessionKey);
  }

  /**
   * Check if two URLs should be considered the same session
   *
   * This is useful for determining if navigation within a page
   * should maintain the same session.
   *
   * @param url1 - First URL to compare
   * @param url2 - Second URL to compare
   * @returns True if URLs represent the same session
   */
  isSameSession(url1: string, url2: string): boolean {
    const normalized1 = this.config.normalizeUrlFn(url1);
    const normalized2 = this.config.normalizeUrlFn(url2);
    return normalized1 === normalized2;
  }

  /**
   * Clean up inactive sessions based on criteria
   *
   * @param options - Cleanup options
   * @param options.maxAge - Maximum age in milliseconds (default: 24 hours)
   * @param options.maxSessions - Maximum number of sessions to keep (default: 100)
   * @returns Number of sessions cleaned up
   */
  cleanupInactiveSessions(options: { maxAge?: number; maxSessions?: number } = {}): number {
    const { maxAge = 24 * 60 * 60 * 1000, maxSessions = 100 } = options;
    const store = useSessionStore.getState();
    const sessions = store.sessions;
    const now = Date.now();
    let cleanedUp = 0;

    // Get sessions sorted by last accessed time (oldest first)
    const sessionEntries = Object.entries(sessions).sort(
      ([, a], [, b]) => (a as SessionData).lastAccessedAt - (b as SessionData).lastAccessedAt
    );

    // Remove sessions older than maxAge
    const staleKeys = sessionEntries
      .filter(([, session]) => now - (session as SessionData).lastAccessedAt > maxAge)
      .map(([key]) => key);

    staleKeys.forEach(key => {
      store.clearSession(key);
      cleanedUp++;
    });

    // Remove excess sessions if we're over the limit
    const remainingSessions = sessionEntries.filter(([key]) => !staleKeys.includes(key));
    if (remainingSessions.length > maxSessions) {
      const excessKeys = remainingSessions
        .slice(0, remainingSessions.length - maxSessions)
        .map(([key]) => key);

      excessKeys.forEach(key => {
        store.clearSession(key);
        cleanedUp++;
      });
    }

    return cleanedUp;
  }

  /**
   * Default URL normalization function
   * Can be overridden via config
   */
  private defaultNormalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);

      // Preserve special schemes as-is
      if (
        urlObj.protocol === 'data:' ||
        urlObj.protocol === 'blob:' ||
        urlObj.protocol === 'file:'
      ) {
        return url;
      }
      // For unknown/custom schemes (e.g., chrome://), return as-is
      if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
        return url;
      }
      const pathname = decodeURI(urlObj.pathname).replace(/\/$/, '');
      let normalized = urlObj.origin + pathname;

      if (this.config.includeQuery && urlObj.search) {
        normalized += urlObj.search;
      }

      if (this.config.includeHash && urlObj.hash) {
        normalized += urlObj.hash;
      }

      return normalized;
    } catch {
      return url;
    }
  }
}

/**
 * Default session service instance
 * Pre-configured with standard settings
 */
export const sessionService = new SessionService();

/**
 * Create a session service with custom configuration
 *
 * @param config - Configuration options
 * @returns Configured SessionService instance
 */
export function createSessionService(config?: SessionServiceConfig): SessionService {
  return new SessionService(config);
}
