/**
 * @file Request Queue Implementation
 *
 * A comprehensive request queue system that manages API requests with priority handling,
 * rate limiting integration, cancellation support, and configurable processing options.
 *
 * Features:
 * - Priority-based request ordering (high, medium, low)
 * - Rate limiter integration with automatic retry
 * - Request cancellation and timeout handling
 * - Concurrent request limiting
 * - Request deduplication (optional)
 * - Queue overflow protection
 * - Comprehensive statistics and monitoring
 * - Pause/resume functionality
 * - Memory-efficient processing
 *
 * Architecture:
 * - Uses priority queue data structure for efficient ordering
 * - Integrates with RateLimiter for provider-specific limits
 * - Supports concurrent processing with configurable limits
 * - Provides detailed statistics and monitoring
 * - Thread-safe operations with proper cleanup
 */

import type { ProviderType } from '../types/providers';
import { RateLimiter, type RateLimitResult } from './RateLimiter';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Request priority levels
 */
export type RequestPriority = 'high' | 'medium' | 'low';

/**
 * Request function type
 */
export type RequestFunction<T = any> = () => Promise<T>;

/**
 * Queued request metadata
 */
export interface QueuedRequest<T = any> {
  /** Unique request identifier */
  id: string;
  /** Request function to execute */
  request: RequestFunction<T>;
  /** Provider type for rate limiting */
  provider: ProviderType;
  /** Token count for rate limiting */
  tokens: number;
  /** Request priority level */
  priority: RequestPriority;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Additional metadata */
  metadata?: Record<string, any>;
  /** Request creation timestamp */
  createdAt: number;
  /** Promise resolver */
  resolve: (value: T) => void;
  /** Promise rejector */
  reject: (error: Error) => void;
  /** Timeout handle */
  timeoutHandle?: NodeJS.Timeout;
  /** Whether request is currently processing */
  processing?: boolean;
  /** Number of retry attempts */
  retryCount?: number;
}

/**
 * Queue configuration options
 */
export interface QueueOptions {
  /** Maximum queue size (default: 1000) */
  maxSize?: number;
  /** Request timeout in milliseconds (default: 30000) */
  requestTimeout?: number;
  /** Maximum concurrent requests (default: 5) */
  maxConcurrentRequests?: number;
  /** Enable request deduplication (default: false) */
  enableDeduplication?: boolean;
  /** Queue processing interval in milliseconds (default: 100) */
  processingInterval?: number;
  /** Maximum retry attempts for rate limited requests (default: 3) */
  maxRetries?: number;
}

/**
 * Queue statistics
 */
export interface QueueStats {
  /** Total requests ever queued */
  totalQueued: number;
  /** Current queue size */
  currentSize: number;
  /** Requests by priority */
  byPriority: Record<RequestPriority, number>;
  /** Requests by provider */
  byProvider: Record<ProviderType, number>;
  /** Currently processing requests */
  processing: number;
  /** Completed requests */
  completed: number;
  /** Failed requests */
  failed: number;
  /** Cancelled requests */
  cancelled: number;
  /** Average wait time in milliseconds */
  averageWaitTime: number;
  /** Queue creation time */
  createdAt: Date;
  /** Last processing time */
  lastProcessedAt?: Date;
}

/**
 * Request enqueue options
 */
export interface EnqueueOptions {
  /** Provider type for rate limiting */
  provider: ProviderType;
  /** Token count for rate limiting */
  tokens: number;
  /** Request priority level */
  priority: RequestPriority;
  /** Custom timeout for this request */
  timeout?: number;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

// ============================================================================
// Priority Queue Implementation
// ============================================================================

/**
 * Priority queue node
 */
interface PriorityQueueNode<T> {
  item: T;
  priority: number;
  insertOrder: number;
}

/**
 * Simple priority queue implementation with FIFO within priority levels
 */
class PriorityQueue<T> {
  private items: PriorityQueueNode<T>[] = [];
  private insertCounter = 0;

  /**
   * Get priority number (higher number = higher priority)
   */
  private getPriorityNumber(priority: RequestPriority): number {
    switch (priority) {
      case 'high':
        return 3;
      case 'medium':
        return 2;
      case 'low':
        return 1;
      default:
        return 2; // Default to medium
    }
  }

  /**
   * Add item to queue
   */
  enqueue(item: T, priority: RequestPriority): void {
    const priorityNumber = this.getPriorityNumber(priority);
    this.items.push({
      item,
      priority: priorityNumber,
      insertOrder: this.insertCounter++,
    });

    // Sort by priority (desc) then by insert order (asc) for FIFO within priority
    this.items.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority; // Higher priority first
      }
      return a.insertOrder - b.insertOrder; // FIFO within same priority
    });
  }

  /**
   * Remove and return highest priority item
   */
  dequeue(): T | undefined {
    const node = this.items.shift();
    return node?.item;
  }

  /**
   * Get queue size
   */
  get size(): number {
    return this.items.length;
  }

  /**
   * Check if queue is empty
   */
  get isEmpty(): boolean {
    return this.items.length === 0;
  }

  /**
   * Remove specific item from queue
   */
  remove(predicate: (item: T) => boolean): T | null {
    const index = this.items.findIndex(node => predicate(node.item));
    if (index >= 0) {
      const [removed] = this.items.splice(index, 1);
      if (!removed) return null;
      return removed.item;
    }
    return null;
  }

  /**
   * Remove all items matching predicate
   */
  removeAll(predicate: (item: T) => boolean): T[] {
    const removed: T[] = [];
    this.items = this.items.filter(node => {
      if (predicate(node.item)) {
        removed.push(node.item);
        return false;
      }
      return true;
    });
    return removed;
  }

  /**
   * Get all items without removing them
   */
  getAll(): T[] {
    return this.items.map(node => node.item);
  }

  /**
   * Clear all items
   */
  clear(): T[] {
    const items = this.getAll();
    this.items = [];
    this.insertCounter = 0;
    return items;
  }
}

// ============================================================================
// Request Queue Implementation
// ============================================================================

/**
 * Request queue with priority handling, rate limiting, and cancellation
 */
export class RequestQueue {
  private rateLimiter: RateLimiter;
  private options: Required<QueueOptions>;
  private queue = new PriorityQueue<QueuedRequest>();
  private processing = new Map<string, QueuedRequest>();
  private processingTimer?: NodeJS.Timeout;
  private requestIdCounter = 0;
  private stats: QueueStats;
  private destroyed = false;
  private paused = false;
  private deduplicationMap = new Map<string, QueuedRequest[]>();
  private promiseToIdMap = new WeakMap<Promise<any>, string>();

  constructor(rateLimiter: RateLimiter, options: QueueOptions = {}) {
    if (!rateLimiter) {
      throw new Error('Rate limiter is required');
    }

    this.rateLimiter = rateLimiter;
    this.options = this.validateAndSetDefaults(options);

    this.stats = {
      totalQueued: 0,
      currentSize: 0,
      byPriority: { high: 0, medium: 0, low: 0 },
      byProvider: { openai: 0, gemini: 0, openrouter: 0 },
      processing: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      averageWaitTime: 0,
      createdAt: new Date(),
    };

    // Start processing loop
    this.startProcessing();
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Enqueue a request for processing
   */
  enqueue<T>(request: RequestFunction<T>, options: EnqueueOptions): Promise<T> {
    if (this.destroyed) {
      throw new Error('Queue has been destroyed');
    }

    this.validateEnqueueOptions(options);

    if (this.queue.size >= this.options.maxSize) {
      throw new Error('Queue is full');
    }

    const requestId = this.generateRequestId();

    const promise = new Promise<T>((resolve, reject) => {
      const queuedRequest = this.createQueuedRequest(requestId, request, options, resolve, reject);

      // Handle deduplication if enabled
      if (this.options.enableDeduplication) {
        const dedupKey = this.createDeduplicationKey(options);
        const existingRequests = this.deduplicationMap.get(dedupKey);

        if (existingRequests && existingRequests.length > 0) {
          // Add to existing deduplication group
          existingRequests.push(queuedRequest);
          this.deduplicationMap.set(dedupKey, existingRequests);
          return;
        } else {
          // First request with this key
          this.deduplicationMap.set(dedupKey, [queuedRequest]);
        }
      }

      // Add to queue
      this.queue.enqueue(queuedRequest, options.priority);
      this.updateStats('enqueue', options);
    });

    // Track promise for cancellation
    this.promiseToIdMap.set(promise, requestId);

    return promise;
  }

  /**
   * Cancel a specific request
   */
  cancel(requestId: string | Promise<any>): boolean {
    if (this.destroyed) {
      return false;
    }

    const id = typeof requestId === 'string' ? requestId : this.findRequestIdByPromise(requestId);
    if (!id) {
      return false;
    }

    // Try to remove from queue first
    const removedRequest = this.queue.remove(req => req.id === id);

    if (removedRequest) {
      // Reject the request promise
      removedRequest.reject(new Error('Request cancelled'));
      this.cancelQueuedRequest(id, 'Request cancelled');
      return true;
    }

    // Check if currently processing (cannot cancel)
    if (this.processing.has(id)) {
      return false;
    }

    return false;
  }

  /**
   * Cancel multiple requests
   */
  cancelMultiple(requestIds: (string | Promise<any>)[]): (string | Promise<any>)[] {
    const cancelled: (string | Promise<any>)[] = [];

    for (const id of requestIds) {
      if (this.cancel(id)) {
        cancelled.push(id);
      }
    }

    return cancelled;
  }

  /**
   * Cancel all queued requests
   */
  cancelAll(): number {
    if (this.destroyed) {
      return 0;
    }

    const allRequests = this.queue.clear();
    let cancelledCount = 0;

    for (const request of allRequests) {
      this.cancelQueuedRequest(request.id, 'Request cancelled');
      request.reject(new Error('Request cancelled'));
      cancelledCount++;
    }

    this.updateStatsAfterCancel(cancelledCount);
    return cancelledCount;
  }

  /**
   * Clear all requests (alias for cancelAll)
   */
  clear(): number {
    return this.cancelAll();
  }

  /**
   * Pause queue processing
   */
  pause(): void {
    this.paused = true;
  }

  /**
   * Resume queue processing
   */
  resume(): void {
    this.paused = false;
  }

  /**
   * Get current queue statistics
   */
  getStats(): QueueStats {
    const currentStats = { ...this.stats };
    currentStats.currentSize = this.queue.size;
    currentStats.processing = this.processing.size;

    // Update priority and provider counts
    currentStats.byPriority = { high: 0, medium: 0, low: 0 };
    currentStats.byProvider = { openai: 0, gemini: 0, openrouter: 0 };

    for (const request of this.queue.getAll()) {
      currentStats.byPriority[request.priority]++;
      currentStats.byProvider[request.provider]++;
    }

    return currentStats;
  }

  /**
   * Get queue size
   */
  get size(): number {
    return this.queue.size;
  }

  /**
   * Check if queue is empty
   */
  get isEmpty(): boolean {
    return this.queue.isEmpty;
  }

  /**
   * Check if queue is paused
   */
  get isPaused(): boolean {
    return this.paused;
  }

  /**
   * Destroy the queue and cleanup resources
   */
  destroy(): void {
    if (this.destroyed) {
      return; // Already destroyed
    }

    // Cancel all queued requests
    this.cancelAll();

    // Cancel all processing requests
    for (const id of this.processing.keys()) {
      this.cancelRequest(id, 'Queue destroyed');
    }

    // Set destroyed flag
    this.destroyed = true;

    // Clear processing timer
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
      this.processingTimer = undefined;
    }

    // Clear all maps
    this.processing.clear();
    this.deduplicationMap.clear();
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Validate and set default options
   */
  private validateAndSetDefaults(options: QueueOptions): Required<QueueOptions> {
    const defaults: Required<QueueOptions> = {
      maxSize: 1000,
      requestTimeout: 30000,
      maxConcurrentRequests: 5,
      enableDeduplication: false,
      processingInterval: 100,
      maxRetries: 3,
    };

    const result = { ...defaults, ...options };

    // Validate options
    if (result.maxSize <= 0) {
      throw new Error('Invalid queue options: maxSize must be positive');
    }
    if (result.requestTimeout <= 0) {
      throw new Error('Invalid queue options: requestTimeout must be positive');
    }
    if (result.maxConcurrentRequests <= 0) {
      throw new Error('Invalid queue options: maxConcurrentRequests must be positive');
    }
    if (result.processingInterval <= 0) {
      throw new Error('Invalid queue options: processingInterval must be positive');
    }
    if (result.maxRetries < 0) {
      throw new Error('Invalid queue options: maxRetries must be non-negative');
    }

    return result;
  }

  /**
   * Validate enqueue options
   */
  private validateEnqueueOptions(options: EnqueueOptions): void {
    const validProviders: ProviderType[] = ['openai', 'gemini', 'openrouter'];
    if (!validProviders.includes(options.provider)) {
      throw new Error('Invalid provider');
    }

    if (typeof options.tokens !== 'number' || options.tokens < 0) {
      throw new Error('Invalid tokens: must be non-negative number');
    }

    const validPriorities: RequestPriority[] = ['high', 'medium', 'low'];
    if (!validPriorities.includes(options.priority)) {
      throw new Error('Invalid priority');
    }

    if (
      options.timeout !== undefined &&
      (typeof options.timeout !== 'number' || options.timeout <= 0)
    ) {
      throw new Error('Invalid timeout: must be positive number');
    }
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${++this.requestIdCounter}`;
  }

  /**
   * Create a queued request object
   */
  private createQueuedRequest<T>(
    id: string,
    request: RequestFunction<T>,
    options: EnqueueOptions,
    resolve: (value: T) => void,
    reject: (error: Error) => void
  ): QueuedRequest<T> {
    const timeout = options.timeout ?? this.options.requestTimeout;
    const createdAt = Date.now();

    return {
      id,
      request,
      provider: options.provider,
      tokens: options.tokens,
      priority: options.priority,
      timeout,
      metadata: options.metadata,
      createdAt,
      resolve,
      reject,
      retryCount: 0,
    };
  }

  /**
   * Create deduplication key for request
   */
  private createDeduplicationKey(options: EnqueueOptions): string {
    const keyData = {
      provider: options.provider,
      tokens: options.tokens,
      priority: options.priority,
      metadata: options.metadata,
    };

    return JSON.stringify(keyData);
  }

  /**
   * Start the processing loop
   */
  private startProcessing(): void {
    if (this.processingTimer) {
      return;
    }

    this.processingTimer = setInterval(() => {
      if (!this.destroyed && !this.paused) {
        this.processQueue();
      }
    }, this.options.processingInterval);
  }

  /**
   * Process queued requests
   */
  private async processQueue(): Promise<void> {
    if (this.destroyed || this.paused) {
      return;
    }

    // Check if we can process more requests
    if (this.processing.size >= this.options.maxConcurrentRequests) {
      return;
    }

    // Get next request from queue
    const request = this.queue.dequeue();
    if (!request) {
      return;
    }

    // Start processing the request
    this.processRequest(request);
  }

  /**
   * Process a single request
   */
  private async processRequest<T>(request: QueuedRequest<T>): Promise<void> {
    if (this.destroyed) {
      this.cancelRequest(request.id, 'Queue destroyed');
      return;
    }

    // Mark as processing
    request.processing = true;
    this.processing.set(request.id, request);

    try {
      // Set up timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        request.timeoutHandle = setTimeout(() => {
          reject(new Error('Request timeout'));
        }, request.timeout);
      });

      // Check rate limits
      await this.checkRateLimit(request);

      // Execute the request
      const resultPromise = request.request();
      const result = await Promise.race([resultPromise, timeoutPromise]);

      // Clear timeout
      if (request.timeoutHandle) {
        clearTimeout(request.timeoutHandle);
        request.timeoutHandle = undefined;
      }

      // Handle success
      this.handleRequestSuccess(request, result);
    } catch (error) {
      // Handle failure
      this.handleRequestFailure(request, error as Error);
    } finally {
      // Clean up
      this.processing.delete(request.id);
      request.processing = false;
      this.stats.lastProcessedAt = new Date();
    }
  }

  /**
   * Check rate limits for request
   */
  private async checkRateLimit(request: QueuedRequest): Promise<void> {
    let retryCount = 0;

    while (retryCount <= this.options.maxRetries) {
      try {
        const rateLimitResult: RateLimitResult = await this.rateLimiter.checkLimit(
          request.provider,
          request.tokens
        );

        if (rateLimitResult.allowed) {
          return; // Rate limit check passed
        }

        // Rate limited - wait and retry
        if (retryCount >= this.options.maxRetries) {
          throw new Error(`Rate limit exceeded after ${this.options.maxRetries} retries`);
        }

        await this.sleep(rateLimitResult.retryAfter);
        retryCount++;
      } catch (error) {
        if (retryCount >= this.options.maxRetries) {
          throw error;
        }

        // Exponential backoff on error
        const backoffDelay = Math.min(1000 * Math.pow(2, retryCount), 30000);
        await this.sleep(backoffDelay);
        retryCount++;
      }
    }
  }

  /**
   * Handle successful request completion
   */
  private handleRequestSuccess<T>(request: QueuedRequest<T>, result: T): void {
    const waitTime = Date.now() - request.createdAt;
    this.updateAverageWaitTime(waitTime);

    // Handle deduplication
    if (this.options.enableDeduplication) {
      const dedupKey = this.createDeduplicationKey({
        provider: request.provider,
        tokens: request.tokens,
        priority: request.priority,
        metadata: request.metadata,
      });

      const duplicates = this.deduplicationMap.get(dedupKey);
      if (duplicates) {
        // Resolve all duplicate requests
        for (const duplicate of duplicates) {
          duplicate.resolve(result);
        }
        this.deduplicationMap.delete(dedupKey);
        this.stats.completed += duplicates.length;
        return;
      }
    }

    // Single request completion
    request.resolve(result);
    this.stats.completed++;
  }

  /**
   * Handle failed request
   */
  private handleRequestFailure(request: QueuedRequest, error: Error): void {
    // Handle deduplication
    if (this.options.enableDeduplication) {
      const dedupKey = this.createDeduplicationKey({
        provider: request.provider,
        tokens: request.tokens,
        priority: request.priority,
        metadata: request.metadata,
      });

      const duplicates = this.deduplicationMap.get(dedupKey);
      if (duplicates) {
        // Reject all duplicate requests
        for (const duplicate of duplicates) {
          duplicate.reject(error);
        }
        this.deduplicationMap.delete(dedupKey);
        this.stats.failed += duplicates.length;
        return;
      }
    }

    // Single request failure
    request.reject(error);
    this.stats.failed++;
  }

  /**
   * Cancel a queued request (not yet processing)
   */
  private cancelQueuedRequest(_requestId: string, _reason: string): void {
    // Find the request in the queue (it should have been removed already)
    // This is mainly for cleanup and stats
    this.stats.cancelled++;
  }

  /**
   * Cancel a processing request
   */
  private cancelRequest(requestId: string, reason: string): void {
    const request = this.processing.get(requestId);
    if (!request) {
      return; // Request not found
    }

    // Clear timeout if set
    if (request.timeoutHandle) {
      clearTimeout(request.timeoutHandle);
      request.timeoutHandle = undefined;
    }

    // Reject the request
    request.reject(new Error(reason));

    // Handle deduplication cleanup
    if (this.options.enableDeduplication) {
      const dedupKey = this.createDeduplicationKey({
        provider: request.provider,
        tokens: request.tokens,
        priority: request.priority,
        metadata: request.metadata,
      });

      this.deduplicationMap.delete(dedupKey);
    }
  }

  /**
   * Update statistics after enqueue
   */
  private updateStats(operation: 'enqueue', options: EnqueueOptions): void {
    if (operation === 'enqueue') {
      this.stats.totalQueued++;
      this.stats.byPriority[options.priority]++;
      this.stats.byProvider[options.provider]++;
    }
  }

  /**
   * Update statistics after cancellation
   */
  private updateStatsAfterCancel(count: number): void {
    this.stats.cancelled += count;
    // Reset current counts as they'll be recalculated in getStats()
    this.stats.byPriority = { high: 0, medium: 0, low: 0 };
    this.stats.byProvider = { openai: 0, gemini: 0, openrouter: 0 };
  }

  /**
   * Update average wait time
   */
  private updateAverageWaitTime(waitTime: number): void {
    const totalCompleted = this.stats.completed + 1;
    this.stats.averageWaitTime =
      (this.stats.averageWaitTime * this.stats.completed + waitTime) / totalCompleted;
  }

  /**
   * Find request ID by promise (for cancellation)
   */
  private findRequestIdByPromise(promise: Promise<any>): string | undefined {
    return this.promiseToIdMap.get(promise);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
