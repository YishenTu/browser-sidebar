/**
 * @file Chrome Tabs Platform Wrapper
 *
 * Provides strongly typed wrapper functions around chrome.tabs APIs with
 * error handling, edge case management, and async/await patterns.
 *
 * This wrapper standardizes tab operations across the extension and provides
 * consistent error handling and type safety.
 */

import type { TabInfo } from '../../types/tabs';
import type { Message, TypedMessage } from '../../types/messages';
import { createTabInfoFromChromeTab } from '../../types/tabs';
import { isRestrictedUrl } from '../../shared/utils/restrictedUrls';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Options for tab query operations
 */
export interface TabQueryOptions {
  /** Only active tabs */
  active?: boolean;
  /** Only pinned tabs */
  pinned?: boolean;
  /** Only audible tabs */
  audible?: boolean;
  /** Only muted tabs */
  muted?: boolean;
  /** Highlighted tabs */
  highlighted?: boolean;
  /** Currently loading tabs */
  status?: 'loading' | 'complete';
  /** Specific URL pattern matching */
  url?: string | string[];
  /** Specific window ID */
  windowId?: number;
  /** Window type filter */
  windowType?: 'normal' | 'popup' | 'panel';
  /** Current window only */
  currentWindow?: boolean;
}

/**
 * Options for sending messages to tabs
 */
export interface SendMessageOptions {
  /** Timeout in milliseconds (default: 5000) */
  timeout?: number;
  /** Whether to handle chrome.runtime.lastError automatically */
  handleRuntimeError?: boolean;
  /** Frame ID for specific frame targeting */
  frameId?: number;
}

/**
 * Result of a tab message send operation
 */
export interface TabMessageResult<T = unknown> {
  /** Whether the message was sent successfully */
  success: boolean;
  /** Response data if successful */
  response?: T;
  /** Error message if failed */
  error?: string;
  /** Error code if available */
  errorCode?: string;
}

/**
 * Tab operation result for bulk operations
 */
export interface TabOperationResult<T = unknown> {
  /** Tab ID that was operated on */
  tabId: number;
  /** Whether the operation was successful */
  success: boolean;
  /** Result data if successful */
  data?: T;
  /** Error message if failed */
  error?: string;
}

// ============================================================================
// Core Tab Query Functions
// ============================================================================

/**
 * Get the currently active tab ID
 *
 * Returns the ID of the currently active tab in the current window.
 * Handles edge cases where no active tab is found.
 *
 * @returns Promise resolving to active tab ID or null if none found
 */
export async function getActiveTabId(): Promise<number | null> {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tabs.length === 0) {
      return null;
    }

    const activeTab = tabs[0];
    return activeTab?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Get information about a specific tab
 *
 * Retrieves tab information by ID and converts it to standardized TabInfo format.
 * Filters out restricted URLs and handles invalid tab IDs.
 *
 * @param tabId - ID of the tab to retrieve
 * @returns Promise resolving to TabInfo or null if not found/accessible
 */
export async function getTab(tabId: number): Promise<TabInfo | null> {
  try {
    const chromeTab = await chrome.tabs.get(tabId);

    if (!chromeTab || !chromeTab.url) {
      return null;
    }

    // Filter out restricted URLs
    if (isRestrictedUrl(chromeTab.url)) {
      return null;
    }

    return createTabInfoFromChromeTab(chromeTab);
  } catch (error) {
    // Tab not found or access denied
    return null;
  }
}

/**
 * Query multiple tabs based on criteria
 *
 * Queries tabs using the provided options and converts them to TabInfo format.
 * Automatically filters out restricted URLs and invalid tabs.
 *
 * @param options - Query options for filtering tabs
 * @returns Promise resolving to array of accessible TabInfo objects
 */
export async function queryTabs(options: TabQueryOptions = {}): Promise<TabInfo[]> {
  try {
    // Convert our options to chrome.tabs.QueryInfo format
    const queryInfo: chrome.tabs.QueryInfo = {
      active: options.active,
      pinned: options.pinned,
      audible: options.audible,
      muted: options.muted,
      highlighted: options.highlighted,
      status: options.status,
      url: options.url,
      windowId: options.windowId,
      windowType: options.windowType,
      currentWindow: options.currentWindow,
    };

    const chromeTabs = await chrome.tabs.query(queryInfo);

    // Filter out restricted URLs and convert to TabInfo
    const accessibleTabs = chromeTabs
      .filter(tab => tab.url && !isRestrictedUrl(tab.url))
      .map(tab => createTabInfoFromChromeTab(tab));

    return accessibleTabs;
  } catch {
    return [];
  }
}

/**
 * Get all accessible tabs from all windows
 *
 * Convenience function to get all tabs that the extension can access.
 * Filters out restricted URLs automatically.
 *
 * @returns Promise resolving to array of all accessible tabs
 */
export async function getAllTabs(): Promise<TabInfo[]> {
  return queryTabs({});
}

/**
 * Get multiple tabs by their IDs
 *
 * Retrieves multiple tabs by ID and filters out inaccessible ones.
 * More efficient than multiple individual getTab calls.
 *
 * @param tabIds - Array of tab IDs to retrieve
 * @returns Promise resolving to array of TabInfo objects (excludes not found tabs)
 */
export async function getTabs(tabIds: number[]): Promise<TabInfo[]> {
  const results = await Promise.allSettled(tabIds.map(tabId => getTab(tabId)));

  return results
    .filter(
      (result): result is PromiseFulfilledResult<TabInfo> =>
        result.status === 'fulfilled' && result.value !== null
    )
    .map(result => result.value);
}

// ============================================================================
// Message Passing Functions
// ============================================================================

/**
 * Send a message to a specific tab with enhanced error handling
 *
 * Sends a typed message to a tab's content script with timeout support
 * and comprehensive error handling including runtime errors.
 *
 * @param tabId - ID of the target tab
 * @param message - Typed message to send
 * @param options - Send options including timeout and error handling
 * @returns Promise resolving to TabMessageResult with response or error
 */
export async function sendMessageToTab<TPayload = unknown, TResponse = unknown>(
  tabId: number,
  message: Message<TPayload> | TypedMessage,
  options: SendMessageOptions = {}
): Promise<TabMessageResult<TResponse>> {
  const { timeout = 5000, handleRuntimeError = true, frameId } = options;

  return new Promise(resolve => {
    // Set up timeout
    const timeoutId = setTimeout(() => {
      resolve({
        success: false,
        error: `Message timeout after ${timeout}ms`,
        errorCode: 'TIMEOUT',
      });
    }, timeout);

    try {
      // Prepare options for chrome.tabs.sendMessage
      const sendOptions = frameId !== undefined ? { frameId } : undefined;

      const handleResponse = (response: unknown) => {
        clearTimeout(timeoutId);

        // Handle Chrome runtime errors
        if (handleRuntimeError && chrome.runtime.lastError) {
          resolve({
            success: false,
            error: chrome.runtime.lastError.message || 'Unknown runtime error',
            errorCode: 'RUNTIME_ERROR',
          });
          return;
        }

        // Handle no response (connection closed/unavailable)
        if (response === undefined) {
          resolve({
            success: false,
            error: 'No response received - content script may not be available',
            errorCode: 'NO_RESPONSE',
          });
          return;
        }

        // Success
        resolve({
          success: true,
          response: response as TResponse,
        });
      };

      if (sendOptions) {
        chrome.tabs.sendMessage(tabId, message, sendOptions, handleResponse);
      } else {
        chrome.tabs.sendMessage(tabId, message, handleResponse);
      }
    } catch (error) {
      clearTimeout(timeoutId);
      resolve({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorCode: 'SEND_ERROR',
      });
    }
  });
}

/**
 * Send messages to multiple tabs concurrently
 *
 * Sends the same message to multiple tabs and returns results for each.
 * Handles failures gracefully and continues with remaining tabs.
 *
 * @param tabIds - Array of tab IDs to send message to
 * @param message - Message to send to all tabs
 * @param options - Send options for all messages
 * @returns Promise resolving to array of operation results per tab
 */
export async function sendMessageToTabs<TPayload = unknown, TResponse = unknown>(
  tabIds: number[],
  message: Message<TPayload> | TypedMessage,
  options: SendMessageOptions = {}
): Promise<TabOperationResult<TResponse>[]> {
  const results = await Promise.allSettled(
    tabIds.map(async tabId => {
      const result = await sendMessageToTab<TPayload, TResponse>(tabId, message, options);
      return {
        tabId,
        success: result.success,
        data: result.response,
        error: result.error,
      } as TabOperationResult<TResponse>;
    })
  );

  // Convert all results (both fulfilled and rejected) to TabOperationResult format
  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        tabId: tabIds[index],
        success: false,
        error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
      } as TabOperationResult<TResponse>;
    }
  });
}

/**
 * Broadcast a message to all accessible tabs
 *
 * Sends a message to all tabs that the extension can access.
 * Automatically queries accessible tabs and sends messages concurrently.
 *
 * @param message - Message to broadcast
 * @param options - Send options for all messages
 * @param tabQuery - Optional tab query to filter target tabs
 * @returns Promise resolving to array of operation results per tab
 */
export async function broadcastMessage<TPayload = unknown, TResponse = unknown>(
  message: Message<TPayload> | TypedMessage,
  options: SendMessageOptions = {},
  tabQuery: TabQueryOptions = {}
): Promise<TabOperationResult<TResponse>[]> {
  const tabs = await queryTabs(tabQuery);
  const tabIds = tabs.map(tab => tab.id);

  return sendMessageToTabs<TPayload, TResponse>(tabIds, message, options);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a tab exists and is accessible
 *
 * Verifies that a tab with the given ID exists and can be accessed
 * by the extension (not restricted URL).
 *
 * @param tabId - ID of the tab to check
 * @returns Promise resolving to true if tab exists and is accessible
 */
export async function isTabAccessible(tabId: number): Promise<boolean> {
  try {
    const tab = await getTab(tabId);
    return tab !== null;
  } catch (error) {
    return false;
  }
}

/**
 * Wait for a tab to be ready (status: 'complete')
 *
 * Polls a tab's status until it's complete or timeout is reached.
 * Useful for waiting for tabs to finish loading before operations.
 *
 * @param tabId - ID of the tab to wait for
 * @param timeout - Maximum wait time in milliseconds (default: 10000)
 * @param pollInterval - Polling interval in milliseconds (default: 500)
 * @returns Promise resolving to true if tab becomes ready, false on timeout
 */
export async function waitForTabReady(
  tabId: number,
  timeout: number = 10000,
  pollInterval: number = 500
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const chromeTab = await chrome.tabs.get(tabId);
      if (chromeTab && chromeTab.status === 'complete') {
        return true;
      }
    } catch (error) {
      // Tab not found or error - return false
      return false;
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  return false;
}

/**
 * Get tabs grouped by window
 *
 * Retrieves all accessible tabs and groups them by window ID.
 * Useful for operations that need to handle tabs per window.
 *
 * @returns Promise resolving to Record mapping window ID to TabInfo arrays
 */
export async function getTabsByWindow(): Promise<Record<number, TabInfo[]>> {
  const allTabs = await getAllTabs();
  const tabsByWindow: Record<number, TabInfo[]> = {};

  for (const tab of allTabs) {
    const windowId = tab.windowId;
    if (!tabsByWindow[windowId]) {
      tabsByWindow[windowId] = [];
    }
    tabsByWindow[windowId]!.push(tab);
  }

  return tabsByWindow;
}

/**
 * Get tabs grouped by domain
 *
 * Retrieves all accessible tabs and groups them by domain.
 * Useful for domain-specific operations or analysis.
 *
 * @returns Promise resolving to Record mapping domain to TabInfo arrays
 */
export async function getTabsByDomain(): Promise<Record<string, TabInfo[]>> {
  const allTabs = await getAllTabs();
  const tabsByDomain: Record<string, TabInfo[]> = {};

  for (const tab of allTabs) {
    const domain = tab.domain;
    if (!tabsByDomain[domain]) {
      tabsByDomain[domain] = [];
    }
    tabsByDomain[domain]!.push(tab);
  }

  return tabsByDomain;
}

/**
 * Find tabs by URL pattern
 *
 * Searches for tabs matching a URL pattern using regex or string matching.
 *
 * @param pattern - URL pattern to match (string or RegExp)
 * @param exact - Whether to use exact string matching (default: false, uses regex)
 * @returns Promise resolving to array of matching tabs
 */
export async function findTabsByUrl(
  pattern: string | RegExp,
  exact: boolean = false
): Promise<TabInfo[]> {
  const allTabs = await getAllTabs();

  if (exact && typeof pattern === 'string') {
    return allTabs.filter(tab => tab.url === pattern);
  }

  const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern, 'i');
  return allTabs.filter(tab => regex.test(tab.url));
}

/**
 * Check if any content script is responsive across tabs
 *
 * Sends ping messages to multiple tabs to test content script availability.
 * Useful for debugging or health checks.
 *
 * @param tabIds - Array of tab IDs to check (if empty, checks all accessible tabs)
 * @param timeout - Timeout per ping in milliseconds (default: 2000)
 * @returns Promise resolving to Record mapping tab ID to responsive status
 */
export async function checkContentScriptHealth(
  tabIds: number[] = [],
  timeout: number = 2000
): Promise<Record<number, boolean>> {
  // If no specific tabs provided, check all accessible tabs
  const targetTabIds = tabIds.length > 0 ? tabIds : (await getAllTabs()).map(tab => tab.id);

  const results: Record<number, boolean> = {};

  // Create a simple ping message (this would need to be imported from messages)
  const pingMessage = {
    id: `ping_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    type: 'PING' as const,
    timestamp: Date.now(),
    source: 'background' as const,
    target: 'content' as const,
  };

  const pingResults = await Promise.allSettled(
    targetTabIds.map(async tabId => {
      const result = await sendMessageToTab(tabId, pingMessage, { timeout });
      return {
        tabId,
        responsive: result.success && (result.response as { type?: string })?.type === 'PONG',
      };
    })
  );

  // Process results
  pingResults.forEach((result, index) => {
    const tabId = targetTabIds[index];
    if (tabId !== undefined) {
      if (result.status === 'fulfilled') {
        results[tabId] = result.value.responsive;
      } else {
        results[tabId] = false;
      }
    }
  });

  return results;
}

// ============================================================================
// Event Listener Helpers
// ============================================================================

export type TabRemovedListener = (tabId: number, removeInfo: chrome.tabs.TabRemoveInfo) => void;
export type TabUpdatedListener = (
  tabId: number,
  changeInfo: chrome.tabs.TabChangeInfo,
  tab: chrome.tabs.Tab
) => void;

/** Add a typed onRemoved listener; returns cleanup */
export function addTabRemovedListener(listener: TabRemovedListener): () => void {
  chrome.tabs.onRemoved.addListener(listener);
  return () => chrome.tabs.onRemoved.removeListener(listener);
}

/** Add a typed onUpdated listener; returns cleanup */
export function addTabUpdatedListener(listener: TabUpdatedListener): () => void {
  chrome.tabs.onUpdated.addListener(listener);
  return () => chrome.tabs.onUpdated.removeListener(listener);
}

// ============================================================================
// Default Exports
// ============================================================================

/**
 * Default export object containing all tab wrapper functions
 *
 * Provides a convenient way to import all functions as a single object:
 * import tabsWrapper from './tabs';
 * const activeTabId = await tabsWrapper.getActiveTabId();
 */
export default {
  // Query functions
  getActiveTabId,
  getTab,
  queryTabs,
  getAllTabs,
  getTabs,

  // Message functions
  sendMessageToTab,
  sendMessageToTabs,
  broadcastMessage,

  // Utility functions
  isTabAccessible,
  waitForTabReady,
  getTabsByWindow,
  getTabsByDomain,
  findTabsByUrl,
  checkContentScriptHealth,
  addTabRemovedListener,
  addTabUpdatedListener,
};
