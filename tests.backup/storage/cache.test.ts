/**
 * @file Cache Implementation Tests
 *
 * Comprehensive test suite for cache implementation following TDD approach.
 * Tests cover TTL expiration, size limits, cache invalidation, LRU eviction,
 * and performance optimization.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type {
  CacheEntry,
  CacheStorage,
  CacheMetadata,
} from '@types/storage';

// Import the cache functions we'll implement
import {
  Cache,
  createCache,
  CacheConfig,
  CacheStrategy,
  CacheStatistics,
} from '@/storage/cache';

describe('Cache Implementation', () => {
  let mockNow: number;
  let cache: Cache;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNow = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(mockNow);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Cache Creation', () => {
    it('should create cache with default configuration', () => {
      const cache = createCache();

      expect(cache).toBeDefined();
      expect(cache.getStatistics().maxSize).toBe(50 * 1024 * 1024); // 50MB default
      expect(cache.getStatistics().maxItems).toBe(1000); // Default max items
    });

    it('should create cache with custom configuration', () => {
      const config: CacheConfig = {
        maxSize: 10 * 1024 * 1024, // 10MB
        maxItems: 500,
        defaultTTL: 30 * 60 * 1000, // 30 minutes
        strategy: 'LRU',
        storage: 'memory',
        cleanupInterval: 5 * 60 * 1000, // 5 minutes
      };

      const cache = createCache(config);
      const stats = cache.getStatistics();

      expect(stats.maxSize).toBe(10 * 1024 * 1024);
      expect(stats.maxItems).toBe(500);
    });

    it('should create cache with Chrome storage backend', () => {
      const config: CacheConfig = {
        storage: 'chrome',
        storageArea: 'local',
      };

      const cache = createCache(config);
      expect(cache).toBeDefined();
    });

    it('should validate configuration parameters', () => {
      expect(() => createCache({ maxSize: -1 })).toThrow('maxSize must be positive');
      expect(() => createCache({ maxItems: 0 })).toThrow('maxItems must be positive');
      expect(() => createCache({ defaultTTL: -1 })).toThrow('defaultTTL must be positive');
      expect(() => createCache({ cleanupInterval: 0 })).toThrow('cleanupInterval must be positive');
    });
  });

  describe('Basic Cache Operations', () => {
    beforeEach(() => {
      cache = createCache({
        maxSize: 1024 * 1024, // 1MB
        maxItems: 100,
        defaultTTL: 60 * 1000, // 1 minute
        strategy: 'LRU',
      });
    });

    describe('set', () => {
      it('should store a value with default TTL', async () => {
        const key = 'test-key';
        const value = { data: 'test-value' };

        await cache.set(key, value);

        const result = await cache.get(key);
        expect(result).toEqual(value);
      });

      it('should store a value with custom TTL', async () => {
        const key = 'test-key';
        const value = { data: 'test-value' };
        const customTTL = 30 * 1000; // 30 seconds

        await cache.set(key, value, { ttl: customTTL });

        const entry = await cache.getEntry(key);
        expect(entry).toBeDefined();
        expect(entry!.metadata.expiresAt).toBe(mockNow + customTTL);
      });

      it('should store a value with tags', async () => {
        const key = 'test-key';
        const value = { data: 'test-value' };
        const tags = ['user:123', 'category:test'];

        await cache.set(key, value, { tags });

        const entry = await cache.getEntry(key);
        expect(entry!.metadata.tags).toEqual(tags);
      });

      it('should update existing entry', async () => {
        const key = 'test-key';
        const oldValue = { data: 'old-value' };
        const newValue = { data: 'new-value' };

        await cache.set(key, oldValue);
        await cache.set(key, newValue);

        const result = await cache.get(key);
        expect(result).toEqual(newValue);
      });

      it('should calculate entry size correctly', async () => {
        const key = 'test-key';
        const value = { data: 'a'.repeat(1000) }; // Roughly 1KB

        await cache.set(key, value);

        const stats = cache.getStatistics();
        expect(stats.currentSize).toBeGreaterThan(1000);
        expect(stats.itemCount).toBe(1);
      });
    });

    describe('get', () => {
      it('should retrieve an existing value', async () => {
        const key = 'test-key';
        const value = { data: 'test-value' };

        await cache.set(key, value);
        const result = await cache.get(key);

        expect(result).toEqual(value);
      });

      it('should return null for non-existent key', async () => {
        const result = await cache.get('non-existent');
        expect(result).toBeNull();
      });

      it('should update access count and last accessed time', async () => {
        const key = 'test-key';
        const value = { data: 'test-value' };

        await cache.set(key, value);
        
        // Advance time and access again
        const newTime = mockNow + 5000;
        vi.mocked(Date.now).mockReturnValue(newTime);
        
        await cache.get(key);

        const entry = await cache.getEntry(key);
        expect(entry!.metadata.accessCount).toBe(1);
        expect(entry!.metadata.lastAccessed).toBe(newTime);
      });

      it('should return null for expired entries', async () => {
        const key = 'test-key';
        const value = { data: 'test-value' };
        const shortTTL = 1000; // 1 second

        await cache.set(key, value, { ttl: shortTTL });

        // Advance time past expiration
        vi.mocked(Date.now).mockReturnValue(mockNow + shortTTL + 1);

        const result = await cache.get(key);
        expect(result).toBeNull();
      });
    });

    describe('has', () => {
      it('should return true for existing key', async () => {
        const key = 'test-key';
        const value = { data: 'test-value' };

        await cache.set(key, value);
        const exists = await cache.has(key);

        expect(exists).toBe(true);
      });

      it('should return false for non-existent key', async () => {
        const exists = await cache.has('non-existent');
        expect(exists).toBe(false);
      });

      it('should return false for expired entries', async () => {
        const key = 'test-key';
        const value = { data: 'test-value' };
        const shortTTL = 1000; // 1 second

        await cache.set(key, value, { ttl: shortTTL });

        // Advance time past expiration
        vi.mocked(Date.now).mockReturnValue(mockNow + shortTTL + 1);

        const exists = await cache.has(key);
        expect(exists).toBe(false);
      });
    });

    describe('delete', () => {
      it('should remove an existing entry', async () => {
        const key = 'test-key';
        const value = { data: 'test-value' };

        await cache.set(key, value);
        const deleted = await cache.delete(key);

        expect(deleted).toBe(true);
        expect(await cache.has(key)).toBe(false);
      });

      it('should return false when deleting non-existent key', async () => {
        const deleted = await cache.delete('non-existent');
        expect(deleted).toBe(false);
      });

      it('should update cache statistics after deletion', async () => {
        const key = 'test-key';
        const value = { data: 'test-value' };

        await cache.set(key, value);
        const statsBefore = cache.getStatistics();
        
        await cache.delete(key);
        const statsAfter = cache.getStatistics();

        expect(statsAfter.itemCount).toBe(statsBefore.itemCount - 1);
        expect(statsAfter.currentSize).toBeLessThan(statsBefore.currentSize);
      });
    });

    describe('clear', () => {
      it('should remove all entries', async () => {
        await cache.set('key1', 'value1');
        await cache.set('key2', 'value2');
        await cache.set('key3', 'value3');

        await cache.clear();

        expect(await cache.has('key1')).toBe(false);
        expect(await cache.has('key2')).toBe(false);
        expect(await cache.has('key3')).toBe(false);
        expect(cache.getStatistics().itemCount).toBe(0);
        expect(cache.getStatistics().currentSize).toBe(0);
      });
    });
  });

  describe('TTL (Time-To-Live) Management', () => {
    beforeEach(() => {
      cache = createCache({
        defaultTTL: 60 * 1000, // 1 minute
        strategy: 'LRU',
      });
    });

    it('should automatically expire entries after TTL', async () => {
      const key = 'test-key';
      const value = { data: 'test-value' };
      const ttl = 5000; // 5 seconds

      await cache.set(key, value, { ttl });

      // Entry should exist before expiration
      expect(await cache.has(key)).toBe(true);

      // Advance time past expiration
      vi.mocked(Date.now).mockReturnValue(mockNow + ttl + 1);

      // Entry should be expired
      expect(await cache.has(key)).toBe(false);
      expect(await cache.get(key)).toBeNull();
    });

    it('should handle different TTL values for different entries', async () => {
      await cache.set('short', 'value1', { ttl: 1000 }); // 1 second
      await cache.set('medium', 'value2', { ttl: 5000 }); // 5 seconds
      await cache.set('long', 'value3', { ttl: 10000 }); // 10 seconds

      // Advance time to 2 seconds
      vi.mocked(Date.now).mockReturnValue(mockNow + 2000);

      expect(await cache.has('short')).toBe(false);
      expect(await cache.has('medium')).toBe(true);
      expect(await cache.has('long')).toBe(true);

      // Advance time to 6 seconds
      vi.mocked(Date.now).mockReturnValue(mockNow + 6000);

      expect(await cache.has('short')).toBe(false);
      expect(await cache.has('medium')).toBe(false);
      expect(await cache.has('long')).toBe(true);
    });

    it('should allow updating TTL of existing entries', async () => {
      const key = 'test-key';
      const value = { data: 'test-value' };

      await cache.set(key, value, { ttl: 1000 }); // 1 second
      await cache.updateTTL(key, 10000); // Extend to 10 seconds

      // Advance time to 2 seconds (past original TTL)
      vi.mocked(Date.now).mockReturnValue(mockNow + 2000);

      expect(await cache.has(key)).toBe(true); // Should still exist
    });

    it('should return false when updating TTL of non-existent entry', async () => {
      const updated = await cache.updateTTL('non-existent', 5000);
      expect(updated).toBe(false);
    });
  });

  describe('Size Limits and Eviction', () => {
    beforeEach(() => {
      cache = createCache({
        maxSize: 2048, // 2KB
        maxItems: 3,
        strategy: 'LRU',
        defaultTTL: 60 * 1000,
      });
    });

    it('should enforce item count limit with LRU eviction', async () => {
      // Fill cache to capacity
      await cache.set('key1', 'a'.repeat(500)); // ~500 bytes
      await cache.set('key2', 'b'.repeat(500)); // ~500 bytes
      await cache.set('key3', 'c'.repeat(500)); // ~500 bytes

      expect(cache.getStatistics().itemCount).toBe(3);

      // Add one more item, should evict least recently used (key1)
      await cache.set('key4', 'd'.repeat(500));

      expect(cache.getStatistics().itemCount).toBe(3);
      expect(await cache.has('key1')).toBe(false); // Evicted
      expect(await cache.has('key2')).toBe(true);
      expect(await cache.has('key3')).toBe(true);
      expect(await cache.has('key4')).toBe(true);
    });

    it('should enforce size limit with LRU eviction', async () => {
      // Fill cache close to size limit
      await cache.set('key1', 'a'.repeat(800)); // ~800 bytes
      await cache.set('key2', 'b'.repeat(800)); // ~800 bytes

      const statsBefore = cache.getStatistics();
      expect(statsBefore.currentSize).toBeLessThan(2048);
      expect(statsBefore.itemCount).toBe(2);

      // Add item that would exceed size limit
      await cache.set('key3', 'c'.repeat(800)); // Should evict key1

      expect(await cache.has('key1')).toBe(false); // Evicted
      expect(await cache.has('key2')).toBe(true);
      expect(await cache.has('key3')).toBe(true);
      expect(cache.getStatistics().currentSize).toBeLessThan(2048);
    });

    it('should update LRU order on access', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3');

      // Access key1 to make it most recently used
      await cache.get('key1');

      // Add new item, should evict key2 (least recently used)
      await cache.set('key4', 'value4');

      expect(await cache.has('key1')).toBe(true); // Should remain
      expect(await cache.has('key2')).toBe(false); // Should be evicted
      expect(await cache.has('key3')).toBe(true);
      expect(await cache.has('key4')).toBe(true);
    });

    it('should handle large items that exceed cache capacity', async () => {
      const largeValue = 'x'.repeat(3000); // 3KB > 2KB limit

      await cache.set('large-item', largeValue);

      // Large item should not be stored
      expect(await cache.has('large-item')).toBe(false);
      expect(cache.getStatistics().itemCount).toBe(0);
    });
  });

  describe('Cache Invalidation', () => {
    beforeEach(() => {
      cache = createCache({
        maxSize: 1024 * 1024,
        maxItems: 100,
        strategy: 'LRU',
      });
    });

    it('should invalidate entries by tag', async () => {
      await cache.set('user:123:profile', 'profile-data', { tags: ['user:123'] });
      await cache.set('user:123:settings', 'settings-data', { tags: ['user:123'] });
      await cache.set('user:456:profile', 'other-profile', { tags: ['user:456'] });

      const invalidated = await cache.invalidateByTag('user:123');

      expect(invalidated).toBe(2);
      expect(await cache.has('user:123:profile')).toBe(false);
      expect(await cache.has('user:123:settings')).toBe(false);
      expect(await cache.has('user:456:profile')).toBe(true);
    });

    it('should invalidate entries by key pattern', async () => {
      await cache.set('api:users:123', 'user-data');
      await cache.set('api:users:456', 'user-data');
      await cache.set('api:posts:789', 'post-data');

      const invalidated = await cache.invalidateByPattern(/^api:users:/);

      expect(invalidated).toBe(2);
      expect(await cache.has('api:users:123')).toBe(false);
      expect(await cache.has('api:users:456')).toBe(false);
      expect(await cache.has('api:posts:789')).toBe(true);
    });

    it('should invalidate all expired entries', async () => {
      await cache.set('key1', 'value1', { ttl: 1000 });
      await cache.set('key2', 'value2', { ttl: 5000 });
      await cache.set('key3', 'value3', { ttl: 10000 });

      // Advance time to expire first two entries
      vi.mocked(Date.now).mockReturnValue(mockNow + 6000);

      const invalidated = await cache.invalidateExpired();

      expect(invalidated).toBe(2);
      expect(await cache.has('key1')).toBe(false);
      expect(await cache.has('key2')).toBe(false);
      expect(await cache.has('key3')).toBe(true);
    });
  });

  describe('Cache Strategies', () => {
    it('should support LFU (Least Frequently Used) strategy', async () => {
      const cache = createCache({
        maxItems: 3,
        strategy: 'LFU',
      });

      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3');

      // Access key2 multiple times to increase frequency
      await cache.get('key2');
      await cache.get('key2');
      await cache.get('key2');

      // Access key3 once
      await cache.get('key3');

      // key1 has 0 accesses, should be evicted when adding key4
      await cache.set('key4', 'value4');

      expect(await cache.has('key1')).toBe(false); // Least frequently used
      expect(await cache.has('key2')).toBe(true);
      expect(await cache.has('key3')).toBe(true);
      expect(await cache.has('key4')).toBe(true);
    });

    it('should support FIFO (First In, First Out) strategy', async () => {
      const cache = createCache({
        maxItems: 3,
        strategy: 'FIFO',
      });

      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3');

      // Access entries (shouldn't affect FIFO order)
      await cache.get('key1');
      await cache.get('key2');

      // Add new item, should evict first inserted (key1)
      await cache.set('key4', 'value4');

      expect(await cache.has('key1')).toBe(false); // First in, first out
      expect(await cache.has('key2')).toBe(true);
      expect(await cache.has('key3')).toBe(true);
      expect(await cache.has('key4')).toBe(true);
    });
  });

  describe('Cache Statistics', () => {
    beforeEach(() => {
      cache = createCache({
        maxSize: 1024 * 1024,
        maxItems: 100,
        strategy: 'LRU',
      });
    });

    it('should track hit and miss rates', async () => {
      await cache.set('key1', 'value1');

      // Hit
      await cache.get('key1');
      // Miss
      await cache.get('key2');
      // Hit
      await cache.get('key1');

      const stats = cache.getStatistics();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(2 / 3);
      expect(stats.missRate).toBe(1 / 3);
    });

    it('should track eviction counts', async () => {
      const cache = createCache({
        maxItems: 2,
        strategy: 'LRU',
      });

      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3'); // Should evict key1

      const stats = cache.getStatistics();
      expect(stats.evictions).toBe(1);
    });

    it('should track size and item count', async () => {
      await cache.set('key1', 'a'.repeat(500));
      await cache.set('key2', 'b'.repeat(300));

      const stats = cache.getStatistics();
      expect(stats.itemCount).toBe(2);
      expect(stats.currentSize).toBeGreaterThan(800);
    });

    it('should reset statistics', async () => {
      await cache.set('key1', 'value1');
      await cache.get('key1');
      await cache.get('key2'); // miss

      cache.resetStatistics();

      const stats = cache.getStatistics();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.evictions).toBe(0);
      // Size and count should remain
      expect(stats.itemCount).toBe(1);
      expect(stats.currentSize).toBeGreaterThan(0);
    });
  });

  describe('Chrome Storage Integration', () => {
    it('should persist cache to Chrome storage', async () => {
      const cache = createCache({
        storage: 'chrome',
        storageArea: 'local',
        persistOnSet: true,
      });

      await cache.set('key1', 'value1');

      // Verify Chrome storage was called
      expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    it('should load cache from Chrome storage on initialization', async () => {
      const existingData = {
        'cache:entries': {
          'key1': {
            key: 'key1',
            value: 'value1',
            metadata: {
              createdAt: mockNow,
              expiresAt: mockNow + 60000,
              accessCount: 0,
              lastAccessed: mockNow,
              size: 100,
            },
            storageVersion: 1,
          },
        },
      };

      vi.mocked(chrome.storage.local.get).mockResolvedValue(existingData);

      const cache = createCache({
        storage: 'chrome',
        storageArea: 'local',
      });

      await cache.load();

      expect(await cache.has('key1')).toBe(true);
      expect(await cache.get('key1')).toBe('value1');
    });

    it('should handle Chrome storage errors gracefully', async () => {
      const cache = createCache({
        storage: 'chrome',
        storageArea: 'local',
      });

      vi.mocked(chrome.storage.local.set).mockRejectedValue(new Error('Storage quota exceeded'));

      // Should not throw, but might log error
      await expect(cache.set('key1', 'value1')).resolves.not.toThrow();
    });
  });

  describe('Performance and Memory Management', () => {
    it('should handle large number of cache operations efficiently', async () => {
      const cache = createCache({
        maxItems: 1000,
        strategy: 'LRU',
      });

      const start = performance.now();

      // Perform many operations
      for (let i = 0; i < 500; i++) {
        await cache.set(`key${i}`, `value${i}`);
      }

      for (let i = 0; i < 250; i++) {
        await cache.get(`key${i}`);
      }

      const end = performance.now();
      const duration = end - start;

      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(1000); // 1 second
    });

    it('should clean up expired entries automatically', async () => {
      const cache = createCache({
        cleanupInterval: 100, // 100ms cleanup interval
        strategy: 'LRU',
      });

      await cache.set('key1', 'value1', { ttl: 50 }); // 50ms TTL
      await cache.set('key2', 'value2', { ttl: 200 }); // 200ms TTL

      // Wait for cleanup to run
      await new Promise(resolve => setTimeout(resolve, 150));

      // Advance time to trigger expiration check
      vi.mocked(Date.now).mockReturnValue(mockNow + 150);

      expect(await cache.has('key1')).toBe(false); // Should be cleaned up
      expect(await cache.has('key2')).toBe(true); // Should still exist
    });

    it('should prevent memory leaks by limiting cache size', async () => {
      const cache = createCache({
        maxSize: 1024, // 1KB limit
        strategy: 'LRU',
      });

      // Try to add more data than the limit
      for (let i = 0; i < 100; i++) {
        await cache.set(`key${i}`, 'x'.repeat(100)); // 100 bytes each
      }

      const stats = cache.getStatistics();
      expect(stats.currentSize).toBeLessThanOrEqual(1024);
      expect(stats.evictions).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle serialization errors gracefully', async () => {
      const cache = createCache();
      
      // Create an object that can't be serialized
      const circularObj: any = {};
      circularObj.self = circularObj;

      await expect(cache.set('circular', circularObj)).resolves.not.toThrow();
      
      // Should return null for unstorable values
      expect(await cache.get('circular')).toBeNull();
    });

    it('should handle invalid TTL values', async () => {
      const cache = createCache();

      await expect(cache.set('key', 'value', { ttl: -1 })).rejects.toThrow('TTL must be positive');
      await expect(cache.updateTTL('key', 0)).rejects.toThrow('TTL must be positive');
    });

    it('should handle empty or invalid keys', async () => {
      const cache = createCache();

      await expect(cache.set('', 'value')).rejects.toThrow('Key cannot be empty');
      await expect(cache.get('')).rejects.toThrow('Key cannot be empty');
      await expect(cache.delete('')).rejects.toThrow('Key cannot be empty');
    });
  });

  describe('Cache Events', () => {
    it('should emit events for cache operations', async () => {
      const cache = createCache();
      const events: string[] = [];

      cache.on('set', (key) => events.push(`set:${key}`));
      cache.on('get', (key) => events.push(`get:${key}`));
      cache.on('delete', (key) => events.push(`delete:${key}`));
      cache.on('evict', (key) => events.push(`evict:${key}`));

      await cache.set('key1', 'value1');
      await cache.get('key1');
      await cache.delete('key1');

      expect(events).toEqual(['set:key1', 'get:key1', 'delete:key1']);
    });

    it('should allow removing event listeners', async () => {
      const cache = createCache();
      const events: string[] = [];
      const listener = (key: string) => events.push(`set:${key}`);

      cache.on('set', listener);
      await cache.set('key1', 'value1');

      cache.off('set', listener);
      await cache.set('key2', 'value2');

      expect(events).toEqual(['set:key1']);
    });
  });
});