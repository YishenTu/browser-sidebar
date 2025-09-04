/**
 * @file TabManager Service - Browser Tab Management and Content Extraction
 *
 * Provides centralized management for browser tabs and content extraction operations.
 * Uses singleton pattern and integrates with TabContentCache for efficient content
 * caching and retrieval.
 */

import type { TabInfo } from '../../types/tabs';
import type { ExtractedContent, ExtractionOptions } from '../../types/extraction';
import { ExtractionMode } from '../../types/extraction';
import type { ExtractTabPayload } from '../../types/messages';
// import { createTabInfoFromChromeTab } from '../../types/tabs';
import { TabContentCache } from './cache/TabContentCache';
import { createMessage } from '../../types/messages';
import { isRestrictedUrl } from '../../shared/utils/restrictedUrls';
import { ExtractionQueue } from './queue/ExtractionQueue';
import {
  queryTabs as platformQueryTabs,
  getTab as platformGetTab,
  sendMessageToTab,
} from '@platform/chrome/tabs';
import { getManifest } from '@platform/chrome/runtime';
import {
  insertCSS as scriptingInsertCSS,
  executeScript as scriptingExecuteScript,
} from '@platform/chrome/scripting';

/**
 * TabManager - Centralized service for browser tab management and content extraction
 *
 * Singleton class that provides tab querying, content extraction, and cache management.
 * Handles communication with content scripts and manages extraction state across tabs.
 *
 * @example
 * ```ts
 * const tabManager = TabManager.getInstance();
 * const tabs = await tabManager.getAllTabs();
 * const content = await tabManager.extractTabContent(123);
 * ```
 */
export class TabManager {
  private static instance: TabManager | null = null;
  private readonly cache: TabContentCache;
  private readonly extractionQueue: ExtractionQueue;

  // Restricted URL patterns moved to shared utility for consistency

  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    this.cache = new TabContentCache();
    this.extractionQueue = new ExtractionQueue(3); // Limit to 3 concurrent extractions
  }

  /**
   * Get the singleton TabManager instance
   *
   * @returns The TabManager instance
   */
  public static getInstance(): TabManager {
    if (!TabManager.instance) {
      TabManager.instance = new TabManager();
    }
    return TabManager.instance;
  }

  /**
   * Query all accessible browser tabs
   *
   * Retrieves all tabs from the browser, filters out restricted URLs,
   * and converts them to the standardized TabInfo format.
   *
   * @returns Promise resolving to array of accessible tabs
   */
  public async getAllTabs(): Promise<TabInfo[]> {
    try {
      return await platformQueryTabs({});
    } catch (error) {
      throw new Error(
        `Failed to query browser tabs: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Extract content from a specific tab
   *
   * Attempts to extract content from the specified tab. First checks the cache
   * for recent content, then sends an extraction message to the tab's content
   * script if needed.
   *
   * @param tabId - ID of the tab to extract content from
   * @param options - Optional extraction configuration
   * @returns Promise resolving to extracted content or null if failed
   */
  public async extractTabContent(
    tabId: number,
    options?: ExtractionOptions,
    mode?: ExtractionMode
  ): Promise<ExtractedContent | null> {
    try {
      // Check if force refresh is requested
      const forceRefresh =
        (options as ExtractionOptions & { forceRefresh?: boolean })?.forceRefresh === true;

      // First, check if we have cached content
      // BUT: Skip cache if requesting a different mode or force refresh
      const cachedContent = await this.cache.get(tabId);
      if (cachedContent && !forceRefresh) {
        // Check for mode mismatch:
        // If mode is specified and different from cached, re-extract
        const requestedMode = mode || 'defuddle'; // Default to defuddle if not specified
        if (cachedContent.extractionMethod !== requestedMode) {
          // Clear the cache for this tab to force re-extraction
          await this.cache.clear(tabId);
        } else {
          return cachedContent;
        }
      } else if (forceRefresh && cachedContent) {
        await this.cache.clear(tabId);
      }

      // Verify the tab exists and is accessible
      const tab = await this.getTab(tabId);
      if (!tab) {
        return null;
      }

      // Only treat as restricted if we have a concrete URL that matches restricted patterns.
      // Some tabs may temporarily report an empty/undefined URL; in that case attempt extraction
      // and rely on messaging errors to determine accessibility.
      if (tab.url && this.isRestrictedUrl(tab.url)) {
        return null;
      }

      // Ensure content script is available in the tab before extraction
      const contentScriptReady = await this.ensureContentScript(tabId);
      if (!contentScriptReady) {
        throw new Error(
          `Failed to extract content from tab ${tabId}: tab may be closed, restricted, or content script unavailable`
        );
      }

      // Queue the extraction to limit concurrent operations
      const extractedContent = await this.extractionQueue.enqueue(async () => {
        // Send extraction message to the content script
        const extractionPayload: ExtractTabPayload = {
          tabId,
          options: options
            ? {
                maxLength: options.maxLength,
                timeout: options.timeout,
                includeImages: false, // Not supported in current extraction options
              }
            : undefined,
          mode,
        };

        const message = createMessage({
          type: 'EXTRACT_TAB_CONTENT',
          payload: extractionPayload,
          source: 'background',
          target: 'content',
        });

        // Send message to the specific tab with timeout enforcement
        const timeoutMs = options?.timeout || 5000; // Default 5 seconds

        const result = await sendMessageToTab(tabId, message, {
          timeout: timeoutMs,
        });
        const response = result.success ? result.response : null;

        // Parse typed response with payload structure
        if (!response) {
          const msg = `Extraction timed out after ${timeoutMs}ms`;
          // Propagate a timeout error so higher layers can surface precise messaging
          throw new Error(msg);
        }

        interface MessageResponse {
          type: string;
          payload?: {
            content?: ExtractedContent;
          };
        }

        const messageResponse = response as MessageResponse;
        if (messageResponse.type === 'CONTENT_EXTRACTED' && messageResponse.payload?.content) {
          const content = messageResponse.payload.content;

          // Cache the successful extraction
          await this.cache.set(tabId, content);

          return content;
        } else if (messageResponse.type === 'ERROR') {
          return null;
        } else {
          return null;
        }
      });

      return extractedContent;
    } catch (error) {
      // Handle specific error cases

      return null;
    }
  }

  /**
   * Check if a URL is restricted and cannot be accessed by content scripts
   * Uses centralized restricted URL utility for consistency
   *
   * @param url - URL to check
   * @returns True if the URL is restricted
   */
  public isRestrictedUrl(url: string): boolean {
    return isRestrictedUrl(url);
  }

  /**
   * Get information about a specific tab
   *
   * @param tabId - ID of the tab to retrieve
   * @returns Promise resolving to TabInfo or null if not found
   */
  public async getTab(tabId: number): Promise<TabInfo | null> {
    try {
      const info = await platformGetTab(tabId);
      if (!info) return null;
      return info;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get the TabContentCache instance for direct access
   *
   * @returns The TabContentCache instance
   */
  public getTabContentCache(): TabContentCache {
    return this.cache;
  }

  /**
   * Clear cached content for a specific tab or all tabs
   *
   * @param tabId - Optional tab ID to clear. If not provided, clears all cached content
   */
  public async clearCache(tabId?: number): Promise<void> {
    await this.cache.clear(tabId);
  }

  /**
   * Get cache statistics
   *
   * @returns Promise resolving to cache statistics
   */
  public async getCacheStats(): Promise<{
    totalEntries: number;
    expiredEntries: number;
    validEntries: number;
  }> {
    return this.cache.getStats();
  }

  /**
   * Clean up expired cache entries
   *
   * Removes all expired entries from the cache to free up storage space.
   * This method can be called periodically for maintenance.
   */
  public async cleanupExpiredCache(): Promise<void> {
    try {
      await this.cache.cleanupExpired();
    } catch (error) {
      // Failed to cleanup expired cache
    }
  }

  /**
   * Check if a tab has cached content
   *
   * @param tabId - ID of the tab to check
   * @returns Promise resolving to true if cached content exists and is valid
   */
  public async hasCachedContent(tabId: number): Promise<boolean> {
    try {
      const content = await this.cache.get(tabId);
      return content !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get multiple tabs by their IDs
   *
   * @param tabIds - Array of tab IDs to retrieve
   * @returns Promise resolving to array of TabInfo objects (excludes not found tabs)
   */
  public async getTabs(tabIds: number[]): Promise<TabInfo[]> {
    const results = await Promise.allSettled(tabIds.map(tabId => this.getTab(tabId)));

    return results
      .filter(
        (result): result is PromiseFulfilledResult<TabInfo> =>
          result.status === 'fulfilled' && result.value !== null
      )
      .map(result => result.value);
  }

  /**
   * Check if content script is available in the specified tab
   *
   * Sends a ping message to test if the content script is loaded and responsive.
   *
   * @param tabId - ID of the tab to check
   * @returns Promise resolving to true if content script is available
   */
  public async isContentScriptAvailable(tabId: number): Promise<boolean> {
    try {
      const pingMessage = createMessage({
        type: 'PING',
        source: 'background',
        target: 'content',
      });

      const result = await sendMessageToTab(tabId, pingMessage, {
        timeout: 2000,
      });
      const response = result.success ? result.response : null;
      return !!(response && (response as { type?: string }).type === 'PONG');
    } catch (error) {
      return false;
    }
  }

  /**
   * Ensure content script is injected in the specified tab
   *
   * Checks if content script is available and injects it if not.
   * This handles tabs that were opened before the extension was installed/reloaded.
   *
   * @param tabId - ID of the tab to ensure content script
   * @returns Promise resolving to true if content script is available after injection
   */
  private async ensureContentScript(tabId: number): Promise<boolean> {
    try {
      // First check if content script is already available
      const isAvailable = await this.isContentScriptAvailable(tabId);
      if (isAvailable) {
        return true;
      }

      // Get tab info to verify it's accessible
      const tab = await platformGetTab(tabId);
      if (!tab || !tab.url) {
        return false;
      }

      // Check if URL is restricted
      if (this.isRestrictedUrl(tab.url)) {
        return false;
      }

      // Get the content script files from manifest
      const manifest = getManifest();
      const contentScriptFiles = manifest.content_scripts?.[0]?.js || [];
      const contentScriptCss = manifest.content_scripts?.[0]?.css || [];

      if (contentScriptFiles.length === 0) {
        return false;
      }

      // Inject CSS first if available
      if (contentScriptCss.length > 0) {
        try {
          await scriptingInsertCSS({ target: { tabId }, files: contentScriptCss });
        } catch {
          // Continue even if CSS injection fails
        }
      }

      // Inject the content script using wrapper
      await scriptingExecuteScript({ target: { tabId }, files: contentScriptFiles });

      // Give the script a moment to initialize
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify injection was successful
      const nowAvailable = await this.isContentScriptAvailable(tabId);

      return nowAvailable;
    } catch (error) {
      return false;
    }
  }
}

/**
 * Default TabManager instance for convenience
 * Use TabManager.getInstance() for explicit singleton access
 */
export const defaultTabManager = TabManager.getInstance();
