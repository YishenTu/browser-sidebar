/**
 * @file TabContentCache Tests
 *
 * Comprehensive test suite for the TabContentCache class, including
 * TTL expiration, Chrome storage API integration, and error handling.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TabContentCache } from '../../../../src/extension/background/cache/TabContentCache';
import type { ExtractedContent } from '../../../../src/types/extraction';

// Mock storage data for tests
const mockStorage = new Map<string, any>();

describe('TabContentCache', () => {
  let cache: TabContentCache;
  let mockContent: ExtractedContent;

  beforeEach(() => {
    // Clear mock storage
    mockStorage.clear();
    vi.clearAllMocks();

    // Setup chrome.storage.session mock implementations
    vi.mocked(chrome.storage.session.get).mockImplementation((keys?: string | string[] | null) => {
      if (!keys) {
        // Return all items
        const result: Record<string, any> = {};
        mockStorage.forEach((value, key) => {
          result[key] = value;
        });
        return Promise.resolve(result);
      }

      if (typeof keys === 'string') {
        const value = mockStorage.get(keys);
        return Promise.resolve(value ? { [keys]: value } : {});
      }

      if (Array.isArray(keys)) {
        const result: Record<string, any> = {};
        keys.forEach((key) => {
          const value = mockStorage.get(key);
          if (value !== undefined) {
            result[key] = value;
          }
        });
        return Promise.resolve(result);
      }

      return Promise.resolve({});
    });

    vi.mocked(chrome.storage.session.set).mockImplementation((items: Record<string, any>) => {
      Object.entries(items).forEach(([key, value]) => {
        mockStorage.set(key, value);
      });
      return Promise.resolve();
    });

    vi.mocked(chrome.storage.session.remove).mockImplementation((keys: string | string[]) => {
      const keyArray = Array.isArray(keys) ? keys : [keys];
      keyArray.forEach((key) => mockStorage.delete(key));
      return Promise.resolve();
    });

    // Create cache with 1000ms TTL for faster testing
    cache = new TabContentCache(1000);

    // Mock extracted content
    mockContent = {
      title: 'Test Page',
      url: 'https://example.com/test',
      domain: 'example.com',
      content: '# Test Content\n\nThis is a test page.',
      textContent: 'Test Content\n\nThis is a test page.',
      extractedAt: Date.now(),
      extractionMethod: 'defuddle',
      metadata: {
        hasCodeBlocks: false,
        hasTables: false,
      },
    };
  });

  describe('Constructor', () => {
    it('should create cache with default TTL', () => {
      const defaultCache = new TabContentCache();
      expect(defaultCache).toBeInstanceOf(TabContentCache);
    });

    it('should create cache with custom TTL', () => {
      const customCache = new TabContentCache(2000);
      expect(customCache).toBeInstanceOf(TabContentCache);
    });
  });

  describe('set method', () => {
    it('should store content with timestamp', async () => {
      await cache.set(123, mockContent);

      expect(chrome.storage.session.set).toHaveBeenCalledWith({
        'tab_content_123': {
          content: mockContent,
          timestamp: expect.any(Number),
        },
      });
    });

    it('should handle storage errors gracefully', async () => {
      vi.mocked(chrome.storage.session.set).mockRejectedValueOnce(new Error('Storage error'));

      await expect(cache.set(123, mockContent)).rejects.toThrow('Storage error');
    });
  });

  describe('get method', () => {
    it('should retrieve stored content', async () => {
      await cache.set(123, mockContent);
      const retrieved = await cache.get(123);

      expect(retrieved).toEqual(mockContent);
      expect(chrome.storage.session.get).toHaveBeenCalledWith('tab_content_123');
    });

    it('should return null for non-existent content', async () => {
      const retrieved = await cache.get(999);
      expect(retrieved).toBeNull();
    });

    it('should return null and auto-clean expired content', async () => {
      // Store content
      await cache.set(123, mockContent);

      // Mock expired timestamp
      const expiredEntry = {
        content: mockContent,
        timestamp: Date.now() - 2000, // 2 seconds ago (expired)
      };
      mockStorage.set('tab_content_123', expiredEntry);

      const retrieved = await cache.get(123);
      expect(retrieved).toBeNull();
      expect(chrome.storage.session.remove).toHaveBeenCalledWith('tab_content_123');
    });

    it('should handle storage errors gracefully', async () => {
      vi.mocked(chrome.storage.session.get).mockRejectedValueOnce(new Error('Storage error'));

      const retrieved = await cache.get(123);
      expect(retrieved).toBeNull();
    });
  });

  describe('clear method', () => {
    it('should clear specific tab content', async () => {
      await cache.set(123, mockContent);
      await cache.clear(123);

      expect(chrome.storage.session.remove).toHaveBeenCalledWith('tab_content_123');
    });

    it('should clear all tab content when no tabId provided', async () => {
      await cache.set(123, mockContent);
      await cache.set(456, mockContent);

      mockStorage.set('tab_content_123', { content: mockContent, timestamp: Date.now() });
      mockStorage.set('tab_content_456', { content: mockContent, timestamp: Date.now() });
      mockStorage.set('other_key', 'other_value');

      await cache.clear();

      expect(chrome.storage.session.remove).toHaveBeenCalledWith([
        'tab_content_123',
        'tab_content_456',
      ]);
    });

    it('should handle no matching keys when clearing all', async () => {
      mockStorage.set('other_key', 'other_value');

      await cache.clear();

      expect(chrome.storage.session.remove).not.toHaveBeenCalled();
    });

    it('should handle storage errors gracefully', async () => {
      vi.mocked(chrome.storage.session.remove).mockRejectedValueOnce(new Error('Storage error'));

      await expect(cache.clear(123)).rejects.toThrow('Storage error');
    });
  });

  describe('isExpired method', () => {
    it('should return false for recent timestamps', () => {
      const recentTimestamp = Date.now() - 500; // 500ms ago
      expect(cache.isExpired(recentTimestamp)).toBe(false);
    });

    it('should return true for old timestamps', () => {
      const oldTimestamp = Date.now() - 2000; // 2 seconds ago
      expect(cache.isExpired(oldTimestamp)).toBe(true);
    });

    it('should handle edge case of exact TTL', () => {
      const exactTimestamp = Date.now() - 1000; // Exactly 1 second ago
      expect(cache.isExpired(exactTimestamp)).toBe(false);
    });
  });

  describe('cleanupExpired method', () => {
    it('should remove expired entries', async () => {
      // Add mix of expired and valid entries
      const now = Date.now();
      mockStorage.set('tab_content_123', {
        content: mockContent,
        timestamp: now - 2000, // Expired
      });
      mockStorage.set('tab_content_456', {
        content: mockContent,
        timestamp: now - 500, // Valid
      });
      mockStorage.set('other_key', 'other_value'); // Non-cache entry

      await cache.cleanupExpired();

      expect(chrome.storage.session.remove).toHaveBeenCalledWith(['tab_content_123']);
    });

    it('should handle no expired entries', async () => {
      const now = Date.now();
      mockStorage.set('tab_content_123', {
        content: mockContent,
        timestamp: now - 500, // Valid
      });

      await cache.cleanupExpired();

      expect(chrome.storage.session.remove).not.toHaveBeenCalled();
    });

    it('should handle storage errors gracefully', async () => {
      vi.mocked(chrome.storage.session.get).mockRejectedValueOnce(new Error('Storage error'));

      // Should not throw
      await cache.cleanupExpired();
    });
  });

  describe('getStats method', () => {
    it('should return correct statistics', async () => {
      const now = Date.now();
      mockStorage.set('tab_content_123', {
        content: mockContent,
        timestamp: now - 2000, // Expired
      });
      mockStorage.set('tab_content_456', {
        content: mockContent,
        timestamp: now - 500, // Valid
      });
      mockStorage.set('other_key', 'other_value'); // Non-cache entry

      const stats = await cache.getStats();

      expect(stats).toEqual({
        totalEntries: 2,
        expiredEntries: 1,
        validEntries: 1,
      });
    });

    it('should return zero stats for empty cache', async () => {
      const stats = await cache.getStats();

      expect(stats).toEqual({
        totalEntries: 0,
        expiredEntries: 0,
        validEntries: 0,
      });
    });

    it('should handle storage errors gracefully', async () => {
      vi.mocked(chrome.storage.session.get).mockRejectedValueOnce(new Error('Storage error'));

      const stats = await cache.getStats();

      expect(stats).toEqual({
        totalEntries: 0,
        expiredEntries: 0,
        validEntries: 0,
      });
    });
  });

  describe('Integration tests', () => {
    it('should handle complete workflow', async () => {
      // Store content
      await cache.set(123, mockContent);

      // Retrieve content
      const retrieved = await cache.get(123);
      expect(retrieved).toEqual(mockContent);

      // Check stats
      const stats = await cache.getStats();
      expect(stats.totalEntries).toBe(1);
      expect(stats.validEntries).toBe(1);

      // Clear content
      await cache.clear(123);

      // Verify cleared
      const afterClear = await cache.get(123);
      expect(afterClear).toBeNull();
    });

    it('should handle multiple tabs', async () => {
      const content1 = { ...mockContent, title: 'Page 1' };
      const content2 = { ...mockContent, title: 'Page 2' };

      await cache.set(123, content1);
      await cache.set(456, content2);

      const retrieved1 = await cache.get(123);
      const retrieved2 = await cache.get(456);

      expect(retrieved1?.title).toBe('Page 1');
      expect(retrieved2?.title).toBe('Page 2');

      const stats = await cache.getStats();
      expect(stats.totalEntries).toBe(2);
    });
  });
});