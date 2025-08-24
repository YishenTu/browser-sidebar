/**
 * @file Cache Management
 *
 * LRU cache implementation for frequently accessed API keys
 */

import type { EncryptedAPIKey } from '@/types/apiKeys';
import type { ServiceState } from './types';
import { CACHE_CONFIG } from './constants';

/**
 * Get cached key
 */
export function getCachedKey(state: ServiceState, id: string): EncryptedAPIKey | null {
  const entry = state.cache.get(id);
  if (!entry) {
    return null;
  }

  // Check TTL
  if (Date.now() - entry.timestamp > CACHE_CONFIG.TTL_MS) {
    state.cache.delete(id);
    return null;
  }

  entry.accessCount++;
  return entry.key;
}

/**
 * Set cached key
 */
export function setCachedKey(state: ServiceState, id: string, key: EncryptedAPIKey): void {
  // Implement LRU eviction if cache is full
  if (state.cache.size >= CACHE_CONFIG.MAX_SIZE) {
    // Find least recently used entry
    let oldestKey = '';
    let oldestTime = Date.now();

    for (const [cacheId, entry] of state.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = cacheId;
      }
    }

    if (oldestKey) {
      state.cache.delete(oldestKey);
    }
  }

  state.cache.set(id, {
    key,
    timestamp: Date.now(),
    accessCount: 1,
  });
}

/**
 * Invalidate cached key
 */
export function invalidateCachedKey(state: ServiceState, id: string): void {
  state.cache.delete(id);
}

/**
 * Clear all cached API keys
 */
export function clearCache(state: ServiceState): void {
  state.cache.clear();
}

/**
 * Start cache cleanup interval
 */
export function startCacheCleanup(state: ServiceState): void {
  if (state.cacheCleanupInterval) {
    clearInterval(state.cacheCleanupInterval);
  }

  state.cacheCleanupInterval = setInterval(() => {
    const now = Date.now();

    for (const [id, entry] of state.cache.entries()) {
      if (now - entry.timestamp > CACHE_CONFIG.TTL_MS) {
        state.cache.delete(id);
      }
    }

    state.metrics.lastCleanup = now;
  }, CACHE_CONFIG.CLEANUP_INTERVAL_MS);
}

/**
 * Stop cache cleanup interval
 */
export function stopCacheCleanup(state: ServiceState): void {
  if (state.cacheCleanupInterval) {
    clearInterval(state.cacheCleanupInterval);
    state.cacheCleanupInterval = null;
  }
}
