/**
 * @file Cache Implementation
 *
 * High-performance caching system with TTL expiration, size limits, and
 * multiple eviction strategies. Supports both in-memory and Chrome storage backends.
 */

import type {
  CacheEntry,
  CacheStorage,
  CacheMetadata,
  StorageArea,
} from '../types/storage';
import { getCurrentVersion, createCacheEntry, isCacheExpired } from '../types/storage';
import * as chromeStorage from './chromeStorage';

// =============================================================================
// Configuration Types
// =============================================================================

export type CacheStrategy = 'LRU' | 'LFU' | 'FIFO';
export type StorageBackend = 'memory' | 'chrome';

export interface CacheConfig {
  /** Maximum cache size in bytes */
  maxSize?: number;
  /** Maximum number of cache items */
  maxItems?: number;
  /** Default TTL for cache entries in milliseconds */
  defaultTTL?: number;
  /** Cache eviction strategy */
  strategy?: CacheStrategy;
  /** Storage backend to use */
  storage?: StorageBackend;
  /** Chrome storage area (only for chrome backend) */
  storageArea?: StorageArea;
  /** Automatically persist to storage on each set operation */
  persistOnSet?: boolean;
  /** Cleanup interval in milliseconds */
  cleanupInterval?: number;
}

export interface CacheSetOptions {
  /** Time-to-live in milliseconds */
  ttl?: number;
  /** Tags for categorization and bulk invalidation */
  tags?: string[];
}

export interface CacheStatistics {
  /** Current number of items in cache */
  itemCount: number;
  /** Current cache size in bytes */
  currentSize: number;
  /** Maximum cache size in bytes */
  maxSize: number;
  /** Maximum number of items */
  maxItems: number;
  /** Number of cache hits */
  hits: number;
  /** Number of cache misses */
  misses: number;
  /** Cache hit rate (0-1) */
  hitRate: number;
  /** Cache miss rate (0-1) */
  missRate: number;
  /** Number of evictions */
  evictions: number;
  /** Number of expired entries cleaned up */
  cleanups: number;
}

// =============================================================================
// Event System
// =============================================================================

type CacheEventType = 'set' | 'get' | 'delete' | 'evict' | 'expire' | 'clear';
type CacheEventListener = (key: string, value?: any) => void;

class EventEmitter {
  private listeners: Map<CacheEventType, Set<CacheEventListener>> = new Map();

  on(event: CacheEventType, listener: CacheEventListener): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  off(event: CacheEventType, listener: CacheEventListener): void {
    this.listeners.get(event)?.delete(listener);
  }

  emit(event: CacheEventType, key: string, value?: any): void {
    this.listeners.get(event)?.forEach(listener => listener(key, value));
  }
}

// =============================================================================
// Cache Entry Management
// =============================================================================

/**
 * Internal cache entry with additional metadata for eviction algorithms
 */
interface InternalCacheEntry {
  /** Cache key */
  key: string;
  /** Cached value */
  value: any;
  /** Cache metadata */
  metadata: CacheMetadata;
  /** Storage schema version */
  storageVersion: number;
  /** Position in eviction order (for FIFO/LRU) */
  order: number;
  /** Access frequency (for LFU) */
  frequency: number;
}

/**
 * Calculate approximate size of a value in bytes
 */
function calculateSize(value: unknown): number {
  try {
    return new Blob([JSON.stringify(value)]).size;
  } catch {
    // Fallback calculation for non-serializable values
    return 0;
  }
}

/**
 * Check if a value can be safely serialized
 */
function isSerializable(value: unknown): boolean {
  try {
    JSON.stringify(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate cache key
 */
function validateKey(key: string): void {
  if (!key || key.trim() === '') {
    throw new Error('Key cannot be empty');
  }
}

/**
 * Validate TTL value
 */
function validateTTL(ttl: number): void {
  if (ttl <= 0) {
    throw new Error('TTL must be positive');
  }
}

// =============================================================================
// Main Cache Implementation
// =============================================================================

export class Cache extends EventEmitter {
  private entries: Map<string, InternalCacheEntry> = new Map();
  private config: Required<CacheConfig>;
  private statistics: CacheStatistics;
  private nextOrder: number = 0;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config: CacheConfig = {}) {
    super();

    // Validate configuration
    if (config.maxSize !== undefined && config.maxSize <= 0) {
      throw new Error('maxSize must be positive');
    }
    if (config.maxItems !== undefined && config.maxItems <= 0) {
      throw new Error('maxItems must be positive');
    }
    if (config.defaultTTL !== undefined && config.defaultTTL <= 0) {
      throw new Error('defaultTTL must be positive');
    }
    if (config.cleanupInterval !== undefined && config.cleanupInterval <= 0) {
      throw new Error('cleanupInterval must be positive');
    }

    // Set default configuration
    this.config = {
      maxSize: config.maxSize ?? 50 * 1024 * 1024, // 50MB
      maxItems: config.maxItems ?? 1000,
      defaultTTL: config.defaultTTL ?? 60 * 60 * 1000, // 1 hour
      strategy: config.strategy ?? 'LRU',
      storage: config.storage ?? 'memory',
      storageArea: config.storageArea ?? 'local',
      persistOnSet: config.persistOnSet ?? false,
      cleanupInterval: config.cleanupInterval ?? 5 * 60 * 1000, // 5 minutes
    };

    // Initialize statistics
    this.statistics = {
      itemCount: 0,
      currentSize: 0,
      maxSize: this.config.maxSize,
      maxItems: this.config.maxItems,
      hits: 0,
      misses: 0,
      hitRate: 0,
      missRate: 0,
      evictions: 0,
      cleanups: 0,
    };

    // Start cleanup timer
    this.startCleanupTimer();
  }

  /**
   * Set a value in the cache
   */
  async set(key: string, value: any, options: CacheSetOptions = {}): Promise<void> {
    validateKey(key);

    const ttl = options.ttl ?? this.config.defaultTTL;
    validateTTL(ttl);

    // Check if value can be serialized
    if (!isSerializable(value)) {
      return; // Cannot store non-serializable values
    }

    // Calculate size of the new entry
    const size = calculateSize(value);

    // Check if single item exceeds cache capacity
    if (size > this.config.maxSize) {
      return; // Cannot store item larger than cache capacity
    }

    // Remove existing entry if present
    const existingEntry = this.entries.get(key);
    if (existingEntry) {
      this.statistics.currentSize -= existingEntry.metadata.size;
      this.statistics.itemCount--;
    }

    // Create new entry
    const now = Date.now();
    const entry: InternalCacheEntry = {
      key,
      value,
      metadata: {
        createdAt: now,
        expiresAt: now + ttl,
        accessCount: 0,
        lastAccessed: now,
        tags: options.tags,
        size,
      },
      storageVersion: getCurrentVersion(),
      order: this.nextOrder++,
      frequency: 0,
    };

    // Ensure cache capacity before adding
    await this.ensureCapacity(size);

    // Add entry
    this.entries.set(key, entry);
    this.statistics.currentSize += size;
    this.statistics.itemCount++;

    // Persist to Chrome storage if configured
    if (this.config.storage === 'chrome' && this.config.persistOnSet) {
      await this.persistToStorage();
    }

    this.emit('set', key, value);
  }

  /**
   * Get a value from the cache
   */
  async get<T = any>(key: string): Promise<T | null> {
    validateKey(key);

    const entry = this.entries.get(key);
    if (!entry) {
      this.statistics.misses++;
      this.updateHitRates();
      this.emit('get', key);
      return null;
    }

    // Check if entry has expired
    if (isCacheExpired(entry)) {
      this.entries.delete(key);
      this.statistics.currentSize -= entry.metadata.size;
      this.statistics.itemCount--;
      this.statistics.misses++;
      this.updateHitRates();
      this.emit('expire', key);
      this.emit('get', key);
      return null;
    }

    // Update access metadata
    const now = Date.now();
    entry.metadata.lastAccessed = now;
    entry.metadata.accessCount++;
    entry.frequency++;

    // Update order for LRU
    if (this.config.strategy === 'LRU') {
      entry.order = this.nextOrder++;
    }

    this.statistics.hits++;
    this.updateHitRates();
    this.emit('get', key, entry.value);

    return entry.value as T;
  }

  /**
   * Check if a key exists in the cache
   */
  async has(key: string): Promise<boolean> {
    validateKey(key);

    const entry = this.entries.get(key);
    if (!entry) {
      return false;
    }

    // Check if entry has expired
    if (isCacheExpired(entry)) {
      this.entries.delete(key);
      this.statistics.currentSize -= entry.metadata.size;
      this.statistics.itemCount--;
      this.emit('expire', key);
      return false;
    }

    return true;
  }

  /**
   * Delete a value from the cache
   */
  async delete(key: string): Promise<boolean> {
    validateKey(key);

    const entry = this.entries.get(key);
    if (!entry) {
      return false;
    }

    this.entries.delete(key);
    this.statistics.currentSize -= entry.metadata.size;
    this.statistics.itemCount--;

    this.emit('delete', key);
    return true;
  }

  /**
   * Clear all entries from the cache
   */
  async clear(): Promise<void> {
    this.entries.clear();
    this.statistics.currentSize = 0;
    this.statistics.itemCount = 0;

    this.emit('clear', '');
  }

  /**
   * Get cache entry with metadata
   */
  async getEntry(key: string): Promise<CacheEntry | null> {
    validateKey(key);

    const entry = this.entries.get(key);
    if (!entry) {
      return null;
    }

    // Check if entry has expired
    if (isCacheExpired(entry)) {
      this.entries.delete(key);
      this.statistics.currentSize -= entry.metadata.size;
      this.statistics.itemCount--;
      this.emit('expire', key);
      return null;
    }

    // Return copy without internal metadata
    return {
      key: entry.key,
      value: entry.value,
      metadata: { ...entry.metadata },
      storageVersion: entry.storageVersion,
    };
  }

  /**
   * Update TTL of an existing entry
   */
  async updateTTL(key: string, ttl: number): Promise<boolean> {
    validateKey(key);
    validateTTL(ttl);

    const entry = this.entries.get(key);
    if (!entry) {
      return false;
    }

    entry.metadata.expiresAt = Date.now() + ttl;
    return true;
  }

  /**
   * Invalidate entries by tag
   */
  async invalidateByTag(tag: string): Promise<number> {
    let count = 0;
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.entries) {
      if (entry.metadata.tags?.includes(tag)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      const deleted = await this.delete(key);
      if (deleted) count++;
    }

    return count;
  }

  /**
   * Invalidate entries by key pattern
   */
  async invalidateByPattern(pattern: RegExp): Promise<number> {
    let count = 0;
    const keysToDelete: string[] = [];

    for (const key of this.entries.keys()) {
      if (pattern.test(key)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      const deleted = await this.delete(key);
      if (deleted) count++;
    }

    return count;
  }

  /**
   * Remove all expired entries
   */
  async invalidateExpired(): Promise<number> {
    let count = 0;
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.entries) {
      if (isCacheExpired(entry)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      const entry = this.entries.get(key);
      if (entry) {
        this.entries.delete(key);
        this.statistics.currentSize -= entry.metadata.size;
        this.statistics.itemCount--;
        this.emit('expire', key);
        count++;
      }
    }

    this.statistics.cleanups += count;
    return count;
  }

  /**
   * Get cache statistics
   */
  getStatistics(): CacheStatistics {
    return { ...this.statistics };
  }

  /**
   * Reset cache statistics (but keep entries)
   */
  resetStatistics(): void {
    this.statistics.hits = 0;
    this.statistics.misses = 0;
    this.statistics.hitRate = 0;
    this.statistics.missRate = 0;
    this.statistics.evictions = 0;
    this.statistics.cleanups = 0;
  }

  /**
   * Load cache from Chrome storage
   */
  async load(): Promise<void> {
    if (this.config.storage !== 'chrome') {
      return;
    }

    try {
      const data = await chromeStorage.get<Record<string, CacheEntry>>('cache:entries', this.config.storageArea);
      if (data) {
        for (const [key, entry] of Object.entries(data)) {
          // Skip expired entries
          if (!isCacheExpired(entry)) {
            const internalEntry: InternalCacheEntry = {
              ...entry,
              order: this.nextOrder++,
              frequency: entry.metadata.accessCount,
            };
            this.entries.set(key, internalEntry);
            this.statistics.currentSize += entry.metadata.size;
            this.statistics.itemCount++;
          }
        }
      }
    } catch (error) {
      // Silently handle storage errors
      console.warn('Failed to load cache from Chrome storage:', error);
    }
  }

  /**
   * Persist cache to Chrome storage
   */
  async persistToStorage(): Promise<void> {
    if (this.config.storage !== 'chrome') {
      return;
    }

    try {
      const data: Record<string, CacheEntry> = {};
      for (const [key, entry] of this.entries) {
        // Only persist non-expired entries
        if (!isCacheExpired(entry)) {
          data[key] = {
            key: entry.key,
            value: entry.value,
            metadata: entry.metadata,
            storageVersion: entry.storageVersion,
          };
        }
      }

      await chromeStorage.set('cache:entries', data, this.config.storageArea);
    } catch (error) {
      // Silently handle storage errors
      console.warn('Failed to persist cache to Chrome storage:', error);
    }
  }

  /**
   * Destroy the cache and clean up resources
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.entries.clear();
  }

  // =============================================================================
  // Private Methods
  // =============================================================================

  /**
   * Ensure cache has capacity for new entry
   */
  private async ensureCapacity(newEntrySize: number): Promise<void> {
    // Check item count limit
    while (this.statistics.itemCount >= this.config.maxItems) {
      await this.evictOne();
    }

    // Check size limit
    while (this.statistics.currentSize + newEntrySize > this.config.maxSize) {
      await this.evictOne();
    }
  }

  /**
   * Evict one entry based on the configured strategy
   */
  private async evictOne(): Promise<void> {
    if (this.entries.size === 0) {
      return;
    }

    let keyToEvict: string;

    switch (this.config.strategy) {
      case 'LRU':
        keyToEvict = this.findLRUKey();
        break;
      case 'LFU':
        keyToEvict = this.findLFUKey();
        break;
      case 'FIFO':
        keyToEvict = this.findFIFOKey();
        break;
      default:
        keyToEvict = this.entries.keys().next().value;
    }

    const entry = this.entries.get(keyToEvict);
    if (entry) {
      this.entries.delete(keyToEvict);
      this.statistics.currentSize -= entry.metadata.size;
      this.statistics.itemCount--;
      this.statistics.evictions++;
      this.emit('evict', keyToEvict);
    }
  }

  /**
   * Find least recently used key
   */
  private findLRUKey(): string {
    let lruKey = '';
    let oldestOrder = Infinity;

    for (const [key, entry] of this.entries) {
      if (entry.order < oldestOrder) {
        oldestOrder = entry.order;
        lruKey = key;
      }
    }

    return lruKey;
  }

  /**
   * Find least frequently used key
   */
  private findLFUKey(): string {
    let lfuKey = '';
    let lowestFrequency = Infinity;
    let oldestTime = Infinity;

    for (const [key, entry] of this.entries) {
      if (entry.frequency < lowestFrequency || 
          (entry.frequency === lowestFrequency && entry.metadata.lastAccessed < oldestTime)) {
        lowestFrequency = entry.frequency;
        oldestTime = entry.metadata.lastAccessed;
        lfuKey = key;
      }
    }

    return lfuKey;
  }

  /**
   * Find first in, first out key
   */
  private findFIFOKey(): string {
    let fifoKey = '';
    let oldestOrder = Infinity;

    for (const [key, entry] of this.entries) {
      if (entry.order < oldestOrder) {
        oldestOrder = entry.order;
        fifoKey = key;
      }
    }

    return fifoKey;
  }

  /**
   * Update hit and miss rates
   */
  private updateHitRates(): void {
    const total = this.statistics.hits + this.statistics.misses;
    if (total > 0) {
      this.statistics.hitRate = this.statistics.hits / total;
      this.statistics.missRate = this.statistics.misses / total;
    }
  }

  /**
   * Start automatic cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(async () => {
      await this.invalidateExpired();
    }, this.config.cleanupInterval);
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new cache instance with the given configuration
 */
export function createCache(config: CacheConfig = {}): Cache {
  return new Cache(config);
}

// =============================================================================
// Default Export
// =============================================================================

export default {
  createCache,
  Cache,
};