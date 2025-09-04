/**
 * @file TabContentCache - Chrome Session Storage Cache for Tab Content
 *
 * Provides TTL-based caching for extracted tab content using Chrome's
 * storage.session API (Manifest V3 compatible). Automatically handles
 * expiration and cleanup of cached content.
 */

import type { ExtractedContent } from '../../../types/extraction';
import {
  get as storageGet,
  set as storageSet,
  remove as storageRemove,
  getAll as storageGetAll,
} from '@platform/chrome/storage';

/**
 * Storage entry structure for cached content
 */
interface CacheEntry {
  /** The extracted content data */
  content: ExtractedContent;
  /** Unix timestamp when the content was cached */
  timestamp: number;
}

/**
 * TabContentCache - Session-based cache for tab content extraction results
 *
 * Uses Chrome's storage.session API to cache ExtractedContent with TTL-based
 * expiration. Content is automatically cleaned up when expired or when the
 * browser session ends.
 *
 * @example
 * ```ts
 * const cache = new TabContentCache();
 * await cache.set(123, extractedContent);
 * const content = await cache.get(123); // null if expired
 * ```
 */
export class TabContentCache {
  private static readonly KEY_PREFIX = 'tab_content_';
  private static readonly DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

  private readonly ttlMs: number;

  /**
   * Create a new TabContentCache instance
   *
   * @param ttlMs - Time-to-live in milliseconds (default: 5 minutes)
   */
  constructor(ttlMs: number = TabContentCache.DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs;
  }

  /**
   * Get cached content for a specific tab
   *
   * @param tabId - The tab ID to retrieve content for
   * @returns The cached content or null if not found/expired
   */
  async get(tabId: number): Promise<ExtractedContent | null> {
    try {
      const key = this.getStorageKey(tabId);
      const entry = (await storageGet<CacheEntry>(key, 'session')) || undefined;

      if (!entry) {
        return null;
      }

      // Check if content is expired
      if (this.isExpired(entry.timestamp)) {
        // Auto-clean expired entry
        await this.clear(tabId);
        return null;
      }

      return entry.content;
    } catch (error) {
      return null;
    }
  }

  /**
   * Store content for a specific tab with current timestamp
   *
   * @param tabId - The tab ID to store content for
   * @param content - The extracted content to cache
   */
  async set(tabId: number, content: ExtractedContent): Promise<void> {
    const key = this.getStorageKey(tabId);
    const entry: CacheEntry = {
      content,
      timestamp: Date.now(),
    };

    await storageSet(key, entry, 'session');
  }

  /**
   * Clear cached content for a specific tab or all tabs
   *
   * @param tabId - Optional tab ID to clear. If not provided, clears all cached content
   */
  async clear(tabId?: number): Promise<void> {
    if (tabId !== undefined) {
      // Clear specific tab
      const key = this.getStorageKey(tabId);
      await storageRemove(key, 'session');
    } else {
      // Clear all tab content
      const allItems = await storageGetAll<Record<string, unknown>>('session');
      const keysToRemove = Object.keys(allItems).filter(key =>
        key.startsWith(TabContentCache.KEY_PREFIX)
      );

      if (keysToRemove.length > 0) {
        for (const k of keysToRemove) {
          await storageRemove(k, 'session');
        }
      }
    }
  }

  /**
   * Check if a timestamp is expired based on the configured TTL
   *
   * @param timestamp - Unix timestamp to check
   * @returns True if the timestamp is older than the TTL
   */
  isExpired(timestamp: number): boolean {
    const now = Date.now();
    return now - timestamp > this.ttlMs;
  }

  /**
   * Get the storage key for a given tab ID
   *
   * @param tabId - The tab ID
   * @returns The storage key string
   */
  private getStorageKey(tabId: number): string {
    return `${TabContentCache.KEY_PREFIX}${tabId}`;
  }

  /**
   * Clean up all expired entries from storage
   *
   * This method can be called periodically to remove expired entries
   * and free up storage space.
   */
  async cleanupExpired(): Promise<void> {
    try {
      const allItems = await storageGetAll<Record<string, unknown>>('session');
      const keysToRemove: string[] = [];

      for (const [key, value] of Object.entries(allItems)) {
        if (key.startsWith(TabContentCache.KEY_PREFIX)) {
          const entry = value as CacheEntry;
          if (entry && this.isExpired(entry.timestamp)) {
            keysToRemove.push(key);
          }
        }
      }

      for (const k of keysToRemove) await storageRemove(k, 'session');
    } catch (error) {
      // Ignore errors when clearing expired entries
    }
  }

  /**
   * Get cache statistics
   *
   * @returns Object containing cache statistics
   */
  async getStats(): Promise<{
    totalEntries: number;
    expiredEntries: number;
    validEntries: number;
  }> {
    try {
      const allItems = await storageGetAll<Record<string, CacheEntry>>('session');
      let totalEntries = 0;
      let expiredEntries = 0;

      for (const [key, value] of Object.entries(allItems)) {
        if (key.startsWith(TabContentCache.KEY_PREFIX)) {
          totalEntries++;
          const entry = value as CacheEntry;
          if (entry && this.isExpired(entry.timestamp)) {
            expiredEntries++;
          }
        }
      }

      return {
        totalEntries,
        expiredEntries,
        validEntries: totalEntries - expiredEntries,
      };
    } catch (error) {
      return { totalEntries: 0, expiredEntries: 0, validEntries: 0 };
    }
  }
}

/**
 * Default cache instance with 5-minute TTL
 */
export const defaultTabContentCache = new TabContentCache();
