/**
 * @file Tab Utilities for Content Scripts
 *
 * Utilities for content scripts to interact with tab-related functionality,
 * particularly requesting the current tab ID from the background script.
 */

import { getMessageBus } from '@/extension/messaging';
import type { GetTabIdPayload } from '@/types/messages';

/**
 * Gets the current tab ID from the background script
 *
 * Content scripts cannot access chrome.tabs API directly, so they must
 * request the tab ID from the background script which has access to
 * the sender information.
 *
 * @returns Promise that resolves to the tab ID or rejects on error
 * @throws {Error} If tab ID cannot be retrieved
 */
export async function getCurrentTabId(): Promise<number> {
  try {
    const messageBus = getMessageBus('content');
    const response = await messageBus.sendWithRetry<void, GetTabIdPayload>('GET_TAB_ID');

    if (!response.success) {
      throw new Error(`Failed to get tab ID: ${response.error.message}`);
    }

    if (!response.data?.tabId) {
      throw new Error('Tab ID not found in response');
    }

    return response.data.tabId;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to get current tab ID: ${message}`);
  }
}

/**
 * Gets the current tab ID with a simpler API that returns null on failure
 *
 * @returns Promise that resolves to the tab ID or null if unavailable
 */
export async function getCurrentTabIdSafe(): Promise<number | null> {
  try {
    return await getCurrentTabId();
  } catch {
    return null;
  }
}

/**
 * Example usage function showing how to use the tab ID utilities
 *
 * @returns Promise that resolves when the example completes
 */
export async function exampleUsage(): Promise<void> {
  try {
    await getCurrentTabId();

    // Use the tab ID for whatever functionality needs it
    // For example, you might use it to:
    // - Store tab-specific data in chrome.storage
    // - Send tab-targeted messages
    // - Track tab-specific state
  } catch (error) {
    // Fallback to safe method
  }
}
