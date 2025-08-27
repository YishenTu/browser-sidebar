/**
 * @file Request Queue Tests
 * 
 * Comprehensive test suite for the RequestQueue implementation following TDD methodology.
 * Tests cover queueing, priority handling, cancellation, rate limiter integration,
 * and various edge cases to ensure robust queue management.
 * 
 * Test Categories:
 * - Basic queue operations (enqueue, dequeue, size)
 * - Priority queue functionality (high, medium, low priorities)
 * - Request cancellation and cleanup
 * - Rate limiter integration and timing
 * - Timeout handling and error scenarios
 * - Queue overflow and capacity management
 * - Concurrent operations and thread safety
 * - Request deduplication scenarios
 * - Performance and memory efficiency
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import { RequestQueue, type QueuedRequest, type RequestPriority, type QueueOptions } from '../../src/provider/RequestQueue';
import { RateLimiter, type RateLimitResult } from '../../src/provider/RateLimiter';
import type { ProviderType } from '../../src/types/providers';

// ============================================================================
// Mock Setup
// ============================================================================

vi.mock('../../src/provider/RateLimiter');

const MockedRateLimiter = vi.mocked(RateLimiter);

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Create a mock rate limiter with configurable behavior
 */
function createMockRateLimiter(allowed: boolean = true, retryAfter: number = 0): RateLimiter {
  const mockLimiter = new MockedRateLimiter();
  const mockResult: RateLimitResult = {
    allowed,
    retryAfter,
    remainingRequests: allowed ? 10 : 0,
    remainingTokens: allowed ? 1000 : 0,
    reason: allowed ? undefined : 'Rate limit exceeded',
    backoffLevel: allowed ? undefined : 1,
  };
  
  (mockLimiter.checkLimit as MockedFunction<any>).mockResolvedValue(mockResult);
  return mockLimiter;
}

/**
 * Create a test request function that can be controlled
 */
function createTestRequest(
  id: string, 
  delay: number = 0, 
  shouldReject: boolean = false
): () => Promise<string> {
  return async () => {
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    if (shouldReject) {
      throw new Error(`Request ${id} failed`);
    }
    return `Response for ${id}`;
  };
}

/**
 * Wait for a specified amount of time
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// Request Queue Tests
// ============================================================================

describe('RequestQueue', () => {
  let queue: RequestQueue;
  let mockRateLimiter: RateLimiter;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimiter = createMockRateLimiter(true, 0);
    queue = new RequestQueue(mockRateLimiter);
  });

  afterEach(() => {
    queue.destroy();
    vi.clearAllTimers();
  });

  // ============================================================================
  // Constructor and Basic Operations
  // ============================================================================

  describe('Constructor and Basic Operations', () => {
    it('should create queue with default options', () => {
      const testQueue = new RequestQueue(mockRateLimiter);
      
      expect(testQueue.size).toBe(0);
      expect(testQueue.isEmpty).toBe(true);
      expect(testQueue.isPaused).toBe(false);
      
      testQueue.destroy();
    });

    it('should create queue with custom options', () => {
      const options: QueueOptions = {
        maxSize: 50,
        requestTimeout: 5000,
        maxConcurrentRequests: 2,
        enableDeduplication: true,
        processingInterval: 500,
      };
      
      const testQueue = new RequestQueue(mockRateLimiter, options);
      
      expect(testQueue.size).toBe(0);
      expect(testQueue.isEmpty).toBe(true);
      
      testQueue.destroy();
    });

    it('should validate constructor parameters', () => {
      // @ts-expect-error - Testing invalid parameter
      expect(() => new RequestQueue(null)).toThrow('Rate limiter is required');
      
      const invalidOptions: QueueOptions = {
        maxSize: -1,
        requestTimeout: 0,
        maxConcurrentRequests: 0,
      };
      
      expect(() => new RequestQueue(mockRateLimiter, invalidOptions))
        .toThrow('Invalid queue options');
    });
  });

  // ============================================================================
  // Basic Queue Operations
  // ============================================================================

  describe('Basic Queue Operations', () => {
    it('should enqueue and process a simple request', async () => {
      const request = createTestRequest('test-1');
      
      const promise = queue.enqueue(request, {
        provider: 'openai',
        tokens: 100,
        priority: 'medium',
        metadata: { requestId: 'test-1' },
      });

      expect(queue.size).toBe(1);
      expect(queue.isEmpty).toBe(false);

      const result = await promise;
      expect(result).toBe('Response for test-1');
      expect(queue.size).toBe(0);
      expect(queue.isEmpty).toBe(true);
    });

    it('should handle multiple requests sequentially', async () => {
      const request1 = createTestRequest('test-1', 10);
      const request2 = createTestRequest('test-2', 10);
      const request3 = createTestRequest('test-3', 10);

      const promise1 = queue.enqueue(request1, {
        provider: 'openai',
        tokens: 100,
        priority: 'medium',
      });

      const promise2 = queue.enqueue(request2, {
        provider: 'openai',
        tokens: 150,
        priority: 'medium',
      });

      const promise3 = queue.enqueue(request3, {
        provider: 'openai',
        tokens: 200,
        priority: 'medium',
      });

      expect(queue.size).toBe(3);

      const [result1, result2, result3] = await Promise.all([promise1, promise2, promise3]);

      expect(result1).toBe('Response for test-1');
      expect(result2).toBe('Response for test-2');
      expect(result3).toBe('Response for test-3');
      expect(queue.size).toBe(0);
    });

    it('should return queue statistics', () => {
      const request1 = createTestRequest('test-1');
      const request2 = createTestRequest('test-2');
      
      queue.enqueue(request1, { provider: 'openai', tokens: 100, priority: 'high' });
      queue.enqueue(request2, { provider: 'gemini', tokens: 150, priority: 'low' });

      const stats = queue.getStats();

      expect(stats.totalQueued).toBe(2);
      expect(stats.currentSize).toBe(2);
      expect(stats.byPriority.high).toBe(1);
      expect(stats.byPriority.medium).toBe(0);
      expect(stats.byPriority.low).toBe(1);
      expect(stats.byProvider.openai).toBe(1);
      expect(stats.byProvider.gemini).toBe(1);
      expect(stats.processing).toBe(0);
      expect(stats.completed).toBe(0);
      expect(stats.failed).toBe(0);
      expect(stats.cancelled).toBe(0);
    });
  });

  // ============================================================================
  // Priority Queue Functionality
  // ============================================================================

  describe('Priority Queue Functionality', () => {
    it('should process high priority requests first', async () => {
      const processOrder: string[] = [];
      
      const lowRequest = async () => {
        processOrder.push('low');
        return 'low-response';
      };
      
      const highRequest = async () => {
        processOrder.push('high');
        return 'high-response';
      };
      
      const mediumRequest = async () => {
        processOrder.push('medium');
        return 'medium-response';
      };

      // Enqueue in mixed order
      const lowPromise = queue.enqueue(lowRequest, {
        provider: 'openai',
        tokens: 100,
        priority: 'low',
      });

      const highPromise = queue.enqueue(highRequest, {
        provider: 'openai',
        tokens: 100,
        priority: 'high',
      });

      const mediumPromise = queue.enqueue(mediumRequest, {
        provider: 'openai',
        tokens: 100,
        priority: 'medium',
      });

      await Promise.all([lowPromise, highPromise, mediumPromise]);

      // Should process in priority order: high, medium, low
      expect(processOrder).toEqual(['high', 'medium', 'low']);
    });

    it('should handle FIFO within same priority level', async () => {
      const processOrder: string[] = [];
      
      const createOrderedRequest = (id: string) => async () => {
        processOrder.push(id);
        return `response-${id}`;
      };

      // Enqueue multiple requests with same priority
      const promise1 = queue.enqueue(createOrderedRequest('1'), {
        provider: 'openai',
        tokens: 100,
        priority: 'medium',
      });

      const promise2 = queue.enqueue(createOrderedRequest('2'), {
        provider: 'openai',
        tokens: 100,
        priority: 'medium',
      });

      const promise3 = queue.enqueue(createOrderedRequest('3'), {
        provider: 'openai',
        tokens: 100,
        priority: 'medium',
      });

      await Promise.all([promise1, promise2, promise3]);

      // Should process in FIFO order within same priority
      expect(processOrder).toEqual(['1', '2', '3']);
    });

    it('should handle mixed priorities correctly', async () => {
      const processOrder: string[] = [];
      
      const createOrderedRequest = (id: string) => async () => {
        processOrder.push(id);
        await sleep(10); // Small delay to ensure ordering
        return `response-${id}`;
      };

      // Complex priority scenario
      const promises = [
        queue.enqueue(createOrderedRequest('low-1'), { provider: 'openai', tokens: 100, priority: 'low' }),
        queue.enqueue(createOrderedRequest('high-1'), { provider: 'openai', tokens: 100, priority: 'high' }),
        queue.enqueue(createOrderedRequest('medium-1'), { provider: 'openai', tokens: 100, priority: 'medium' }),
        queue.enqueue(createOrderedRequest('low-2'), { provider: 'openai', tokens: 100, priority: 'low' }),
        queue.enqueue(createOrderedRequest('high-2'), { provider: 'openai', tokens: 100, priority: 'high' }),
        queue.enqueue(createOrderedRequest('medium-2'), { provider: 'openai', tokens: 100, priority: 'medium' }),
      ];

      await Promise.all(promises);

      // Should process high first, then medium, then low, with FIFO within each
      expect(processOrder).toEqual(['high-1', 'high-2', 'medium-1', 'medium-2', 'low-1', 'low-2']);
    });
  });

  // ============================================================================
  // Request Cancellation
  // ============================================================================

  describe('Request Cancellation', () => {
    it('should cancel a queued request', async () => {
      const request = createTestRequest('test-1', 1000); // Long delay
      
      const promise = queue.enqueue(request, {
        provider: 'openai',
        tokens: 100,
        priority: 'medium',
        metadata: { requestId: 'test-1' },
      });

      expect(queue.size).toBe(1);

      const cancelled = queue.cancel(promise);
      expect(cancelled).toBe(true);
      expect(queue.size).toBe(0);

      // Request should be rejected with cancellation error
      await expect(promise).rejects.toThrow('Request cancelled');
    });

    it('should handle cancellation of non-existent request', () => {
      const cancelled = queue.cancel('non-existent-id');
      expect(cancelled).toBe(false);
    });

    it('should cancel multiple requests', async () => {
      const request1 = createTestRequest('test-1', 1000);
      const request2 = createTestRequest('test-2', 1000);
      const request3 = createTestRequest('test-3', 1000);

      const promise1 = queue.enqueue(request1, { provider: 'openai', tokens: 100, priority: 'medium' });
      const promise2 = queue.enqueue(request2, { provider: 'openai', tokens: 100, priority: 'medium' });
      const promise3 = queue.enqueue(request3, { provider: 'openai', tokens: 100, priority: 'medium' });

      expect(queue.size).toBe(3);

      const cancelledIds = queue.cancelMultiple([promise1, promise3, 'non-existent']);
      expect(cancelledIds).toEqual([promise1, promise3]);
      expect(queue.size).toBe(1);

      // Cancelled requests should be rejected
      await expect(promise1).rejects.toThrow('Request cancelled');
      await expect(promise3).rejects.toThrow('Request cancelled');

      // Non-cancelled request should still complete
      const result2 = await promise2;
      expect(result2).toBe('Response for test-2');
    });

    it('should cancel all requests', async () => {
      const request1 = createTestRequest('test-1', 1000);
      const request2 = createTestRequest('test-2', 1000);
      const request3 = createTestRequest('test-3', 1000);

      const promise1 = queue.enqueue(request1, { provider: 'openai', tokens: 100, priority: 'high' });
      const promise2 = queue.enqueue(request2, { provider: 'openai', tokens: 100, priority: 'medium' });
      const promise3 = queue.enqueue(request3, { provider: 'openai', tokens: 100, priority: 'low' });

      expect(queue.size).toBe(3);

      const cancelledCount = queue.cancelAll();
      expect(cancelledCount).toBe(3);
      expect(queue.size).toBe(0);

      // All requests should be rejected
      await expect(promise1).rejects.toThrow('Request cancelled');
      await expect(promise2).rejects.toThrow('Request cancelled');
      await expect(promise3).rejects.toThrow('Request cancelled');
    });

    it('should not cancel already processing requests', async () => {
      // Create a rate limiter that always allows requests
      mockRateLimiter = createMockRateLimiter(true, 0);
      queue = new RequestQueue(mockRateLimiter, { maxConcurrentRequests: 1 });

      let requestStarted = false;
      let requestFinished = false;
      
      const slowRequest = async () => {
        requestStarted = true;
        await sleep(200);
        requestFinished = true;
        return 'slow-response';
      };

      const promise = queue.enqueue(slowRequest, {
        provider: 'openai',
        tokens: 100,
        priority: 'medium',
      });

      // Wait for request to start processing
      await sleep(150);
      expect(requestStarted).toBe(true);
      expect(requestFinished).toBe(false);

      // Try to cancel - should fail because request is processing
      const cancelled = queue.cancel(promise);
      expect(cancelled).toBe(false);

      // Request should complete normally
      const result = await promise;
      expect(result).toBe('slow-response');
      expect(requestFinished).toBe(true);
    });
  });

  // ============================================================================
  // Rate Limiter Integration
  // ============================================================================

  describe('Rate Limiter Integration', () => {
    it('should queue requests when rate limited', async () => {
      // Create rate limiter that denies first request but allows second
      const rateLimitedResult: RateLimitResult = {
        allowed: false,
        retryAfter: 100,
        remainingRequests: 0,
        remainingTokens: 0,
        reason: 'Rate limit exceeded',
      };

      const allowedResult: RateLimitResult = {
        allowed: true,
        retryAfter: 0,
        remainingRequests: 10,
        remainingTokens: 1000,
      };

      (mockRateLimiter.checkLimit as MockedFunction<any>)
        .mockResolvedValueOnce(rateLimitedResult)
        .mockResolvedValueOnce(allowedResult);

      const request = createTestRequest('test-1');
      
      const start = Date.now();
      const result = await queue.enqueue(request, {
        provider: 'openai',
        tokens: 100,
        priority: 'medium',
      });

      const elapsed = Date.now() - start;
      
      expect(result).toBe('Response for test-1');
      expect(elapsed).toBeGreaterThanOrEqual(100); // Should wait for retryAfter
      expect(mockRateLimiter.checkLimit).toHaveBeenCalledTimes(2);
    });

    it('should check rate limits with correct parameters', async () => {
      const request = createTestRequest('test-1');
      
      await queue.enqueue(request, {
        provider: 'gemini',
        tokens: 250,
        priority: 'high',
        metadata: { model: 'gemini-pro' },
      });

      expect(mockRateLimiter.checkLimit).toHaveBeenCalledWith('gemini', 250);
    });

    it('should handle different providers separately', async () => {
      const openaiRequest = createTestRequest('openai-1');
      const geminiRequest = createTestRequest('gemini-1');
      
      const promise1 = queue.enqueue(openaiRequest, {
        provider: 'openai',
        tokens: 100,
        priority: 'medium',
      });

      const promise2 = queue.enqueue(geminiRequest, {
        provider: 'gemini',
        tokens: 200,
        priority: 'medium',
      });

      await Promise.all([promise1, promise2]);

      expect(mockRateLimiter.checkLimit).toHaveBeenCalledWith('openai', 100);
      expect(mockRateLimiter.checkLimit).toHaveBeenCalledWith('gemini', 200);
    });

    it('should retry rate limited requests with exponential backoff', async () => {
      const retryDelays = [100, 200, 400];
      let attemptCount = 0;

      // Mock rate limiter to fail first 3 times, then succeed
      (mockRateLimiter.checkLimit as MockedFunction<any>).mockImplementation(async () => {
        attemptCount++;
        if (attemptCount <= 3) {
          return {
            allowed: false,
            retryAfter: retryDelays[attemptCount - 1],
            remainingRequests: 0,
            remainingTokens: 0,
            reason: 'Rate limit exceeded',
            backoffLevel: attemptCount - 1,
          };
        }
        return {
          allowed: true,
          retryAfter: 0,
          remainingRequests: 10,
          remainingTokens: 1000,
        };
      });

      const request = createTestRequest('test-1');
      const start = Date.now();
      
      const result = await queue.enqueue(request, {
        provider: 'openai',
        tokens: 100,
        priority: 'medium',
      });

      const elapsed = Date.now() - start;
      
      expect(result).toBe('Response for test-1');
      expect(attemptCount).toBe(4);
      expect(elapsed).toBeGreaterThanOrEqual(700); // Sum of retry delays
    });
  });

  // ============================================================================
  // Timeout Handling
  // ============================================================================

  describe('Timeout Handling', () => {
    it('should timeout requests that exceed timeout limit', async () => {
      const queue = new RequestQueue(mockRateLimiter, { requestTimeout: 100 });
      
      const slowRequest = createTestRequest('slow-request', 200);
      
      const promise = queue.enqueue(slowRequest, {
        provider: 'openai',
        tokens: 100,
        priority: 'medium',
      });

      await expect(promise).rejects.toThrow('Request timeout');
      
      const stats = queue.getStats();
      expect(stats.failed).toBe(1);
      expect(stats.completed).toBe(0);
      
      queue.destroy();
    });

    it('should not timeout requests that complete within limit', async () => {
      const queue = new RequestQueue(mockRateLimiter, { requestTimeout: 200 });
      
      const fastRequest = createTestRequest('fast-request', 50);
      
      const result = await queue.enqueue(fastRequest, {
        provider: 'openai',
        tokens: 100,
        priority: 'medium',
      });

      expect(result).toBe('Response for fast-request');
      
      const stats = queue.getStats();
      expect(stats.failed).toBe(0);
      expect(stats.completed).toBe(1);
      
      queue.destroy();
    });

    it('should handle custom timeout per request', async () => {
      const slowRequest = createTestRequest('slow-request', 150);
      
      const promise = queue.enqueue(slowRequest, {
        provider: 'openai',
        tokens: 100,
        priority: 'medium',
        timeout: 100, // Custom shorter timeout
      });

      await expect(promise).rejects.toThrow('Request timeout');
    });
  });

  // ============================================================================
  // Queue Overflow and Capacity
  // ============================================================================

  describe('Queue Overflow and Capacity', () => {
    it('should reject requests when queue is full', async () => {
      const smallQueue = new RequestQueue(mockRateLimiter, { maxSize: 2 });
      
      // Pause the queue to prevent processing
      smallQueue.pause();
      
      // Create long-running requests to fill the queue
      const request1 = createTestRequest('test-1', 100);
      const request2 = createTestRequest('test-2', 100);
      const request3 = createTestRequest('test-3', 100);

      // Fill the queue
      const promise1 = smallQueue.enqueue(request1, { provider: 'openai', tokens: 100, priority: 'medium' });
      const promise2 = smallQueue.enqueue(request2, { provider: 'openai', tokens: 100, priority: 'medium' });

      expect(smallQueue.size).toBe(2);

      // Third request should be rejected
      expect(() => 
        smallQueue.enqueue(request3, { provider: 'openai', tokens: 100, priority: 'medium' })
      ).toThrow('Queue is full');

      expect(smallQueue.size).toBe(2);
      
      smallQueue.destroy();
    });

    it('should accept requests after queue has space again', async () => {
      const smallQueue = new RequestQueue(mockRateLimiter, { maxSize: 1 });
      
      const fastRequest = createTestRequest('fast', 10);
      const slowRequest = createTestRequest('slow', 1000);

      // Fill queue with fast request
      await smallQueue.enqueue(fastRequest, { provider: 'openai', tokens: 100, priority: 'medium' });
      expect(smallQueue.size).toBe(0);

      // Now queue should accept new request
      const promise = smallQueue.enqueue(slowRequest, { provider: 'openai', tokens: 100, priority: 'medium' });
      expect(smallQueue.size).toBe(1);

      smallQueue.destroy();
    });
  });

  // ============================================================================
  // Concurrent Operations
  // ============================================================================

  describe('Concurrent Operations', () => {
    it('should handle concurrent requests with maxConcurrentRequests limit', async () => {
      const concurrentQueue = new RequestQueue(mockRateLimiter, { 
        maxConcurrentRequests: 2,
        processingInterval: 10,
      });
      
      let activeRequests = 0;
      let maxConcurrent = 0;
      
      const createTrackingRequest = (id: string) => async () => {
        activeRequests++;
        maxConcurrent = Math.max(maxConcurrent, activeRequests);
        await sleep(100);
        activeRequests--;
        return `Response for ${id}`;
      };

      // Enqueue 5 requests
      const promises = Array.from({ length: 5 }, (_, i) => 
        concurrentQueue.enqueue(createTrackingRequest(`request-${i + 1}`), {
          provider: 'openai',
          tokens: 100,
          priority: 'medium',
        })
      );

      await Promise.all(promises);

      // Should never exceed maxConcurrentRequests
      expect(maxConcurrent).toBeLessThanOrEqual(2);
      expect(activeRequests).toBe(0);
      
      concurrentQueue.destroy();
    });

    it('should process queued requests as concurrent slots become available', async () => {
      const concurrentQueue = new RequestQueue(mockRateLimiter, { 
        maxConcurrentRequests: 2,
      });
      
      const processOrder: string[] = [];
      
      const createOrderedRequest = (id: string, delay: number = 100) => async () => {
        processOrder.push(`start-${id}`);
        await sleep(delay);
        processOrder.push(`end-${id}`);
        return `Response for ${id}`;
      };

      // Enqueue 4 requests
      const promises = [
        concurrentQueue.enqueue(createOrderedRequest('1'), { provider: 'openai', tokens: 100, priority: 'medium' }),
        concurrentQueue.enqueue(createOrderedRequest('2'), { provider: 'openai', tokens: 100, priority: 'medium' }),
        concurrentQueue.enqueue(createOrderedRequest('3'), { provider: 'openai', tokens: 100, priority: 'medium' }),
        concurrentQueue.enqueue(createOrderedRequest('4'), { provider: 'openai', tokens: 100, priority: 'medium' }),
      ];

      await Promise.all(promises);

      // First 2 should start immediately, next 2 should wait
      expect(processOrder.slice(0, 2)).toEqual(['start-1', 'start-2']);
      expect(processOrder).toContain('start-3');
      expect(processOrder).toContain('start-4');
      
      concurrentQueue.destroy();
    });
  });

  // ============================================================================
  // Request Deduplication
  // ============================================================================

  describe('Request Deduplication', () => {
    it('should deduplicate identical requests when enabled', async () => {
      const dedupeQueue = new RequestQueue(mockRateLimiter, { 
        enableDeduplication: true 
      });
      
      const request = createTestRequest('identical', 10);
      
      const requestOptions = {
        provider: 'openai' as ProviderType,
        tokens: 100,
        priority: 'medium' as RequestPriority,
        metadata: { key: 'value' },
      };

      // Enqueue same request multiple times
      const promise1 = dedupeQueue.enqueue(request, requestOptions);
      const promise2 = dedupeQueue.enqueue(request, requestOptions);
      const promise3 = dedupeQueue.enqueue(request, requestOptions);

      // Should only process one request
      expect(dedupeQueue.size).toBe(1);

      const [result1, result2, result3] = await Promise.all([promise1, promise2, promise3]);

      // All should return same result
      expect(result1).toBe('Response for identical');
      expect(result2).toBe('Response for identical');
      expect(result3).toBe('Response for identical');
      
      dedupeQueue.destroy();
    });

    it('should not deduplicate when disabled', async () => {
      const noDedupe = new RequestQueue(mockRateLimiter, { 
        enableDeduplication: false 
      });
      
      const request = createTestRequest('identical', 10);
      
      const requestOptions = {
        provider: 'openai' as ProviderType,
        tokens: 100,
        priority: 'medium' as RequestPriority,
        metadata: { key: 'value' },
      };

      // Enqueue same request multiple times
      noDedupe.enqueue(request, requestOptions);
      noDedupe.enqueue(request, requestOptions);
      noDedupe.enqueue(request, requestOptions);

      // Should process all requests
      expect(noDedupe.size).toBe(3);
      
      noDedupe.destroy();
    });

    it('should distinguish requests with different parameters', async () => {
      const dedupeQueue = new RequestQueue(mockRateLimiter, { 
        enableDeduplication: true 
      });
      
      const request = createTestRequest('same-function', 10);
      
      // Different providers
      const promise1 = dedupeQueue.enqueue(request, {
        provider: 'openai',
        tokens: 100,
        priority: 'medium',
      });

      const promise2 = dedupeQueue.enqueue(request, {
        provider: 'gemini',
        tokens: 100,
        priority: 'medium',
      });

      // Should treat as different requests
      expect(dedupeQueue.size).toBe(2);
      
      dedupeQueue.destroy();
    });
  });

  // ============================================================================
  // Queue Control Operations
  // ============================================================================

  describe('Queue Control Operations', () => {
    it('should pause and resume queue processing', async () => {
      const request1 = createTestRequest('test-1', 50);
      const request2 = createTestRequest('test-2', 50);
      
      // Enqueue requests
      const promise1 = queue.enqueue(request1, { provider: 'openai', tokens: 100, priority: 'medium' });
      const promise2 = queue.enqueue(request2, { provider: 'openai', tokens: 100, priority: 'medium' });

      // Pause the queue immediately
      queue.pause();
      expect(queue.isPaused).toBe(true);

      // Wait a bit - requests shouldn't complete while paused
      await sleep(100);
      expect(queue.size).toBe(2); // Both should still be in queue

      // Resume processing
      queue.resume();
      expect(queue.isPaused).toBe(false);

      // Requests should now complete
      const [result1, result2] = await Promise.all([promise1, promise2]);
      expect(result1).toBe('Response for test-1');
      expect(result2).toBe('Response for test-2');
    });

    it('should clear all queued requests', async () => {
      const request1 = createTestRequest('test-1', 1000);
      const request2 = createTestRequest('test-2', 1000);
      const request3 = createTestRequest('test-3', 1000);

      const promise1 = queue.enqueue(request1, { provider: 'openai', tokens: 100, priority: 'high' });
      const promise2 = queue.enqueue(request2, { provider: 'openai', tokens: 100, priority: 'medium' });
      const promise3 = queue.enqueue(request3, { provider: 'openai', tokens: 100, priority: 'low' });

      expect(queue.size).toBe(3);

      const clearedCount = queue.clear();
      expect(clearedCount).toBe(3);
      expect(queue.size).toBe(0);

      // All promises should be rejected
      await expect(promise1).rejects.toThrow('Request cancelled');
      await expect(promise2).rejects.toThrow('Request cancelled');
      await expect(promise3).rejects.toThrow('Request cancelled');
    });

    it('should properly destroy queue and cleanup resources', () => {
      const request = createTestRequest('test-1', 1000);
      
      // Pause the queue so request stays queued
      queue.pause();
      queue.enqueue(request, { provider: 'openai', tokens: 100, priority: 'medium' });

      expect(queue.size).toBe(1);

      queue.destroy();

      // After destruction, queue should be empty and not accept new requests
      expect(queue.size).toBe(0);
      expect(() => queue.enqueue(request, { provider: 'openai', tokens: 100, priority: 'medium' }))
        .toThrow('Queue has been destroyed');
    });
  });

  // ============================================================================
  // Error Handling
  // ============================================================================

  describe('Error Handling', () => {
    it('should handle request function errors gracefully', async () => {
      const failingRequest = createTestRequest('failing', 10, true);
      
      const promise = queue.enqueue(failingRequest, {
        provider: 'openai',
        tokens: 100,
        priority: 'medium',
      });

      await expect(promise).rejects.toThrow('Request failing failed');
      
      const stats = queue.getStats();
      expect(stats.failed).toBe(1);
      expect(stats.completed).toBe(0);
    });

    it('should handle rate limiter errors', async () => {
      (mockRateLimiter.checkLimit as MockedFunction<any>)
        .mockRejectedValue(new Error('Rate limiter error'));

      const request = createTestRequest('test-1');
      
      const promise = queue.enqueue(request, {
        provider: 'openai',
        tokens: 100,
        priority: 'medium',
      });

      await expect(promise).rejects.toThrow('Rate limiter error');
    }, 10000); // 10 second timeout

    it('should continue processing other requests after one fails', async () => {
      const successfulRequest = createTestRequest('success', 10);
      const failingRequest = createTestRequest('fail', 10, true);
      const anotherSuccessfulRequest = createTestRequest('success2', 10);

      const promise1 = queue.enqueue(successfulRequest, { provider: 'openai', tokens: 100, priority: 'medium' });
      const promise2 = queue.enqueue(failingRequest, { provider: 'openai', tokens: 100, priority: 'medium' });
      const promise3 = queue.enqueue(anotherSuccessfulRequest, { provider: 'openai', tokens: 100, priority: 'medium' });

      const result1 = await promise1;
      await expect(promise2).rejects.toThrow('Request fail failed');
      const result3 = await promise3;

      expect(result1).toBe('Response for success');
      expect(result3).toBe('Response for success2');
      
      const stats = queue.getStats();
      expect(stats.completed).toBe(2);
      expect(stats.failed).toBe(1);
    });

    it('should validate request parameters', async () => {
      const request = createTestRequest('test');

      // Invalid provider
      expect(() => 
        queue.enqueue(request, {
          // @ts-expect-error - Testing invalid provider
          provider: 'invalid-provider',
          tokens: 100,
          priority: 'medium',
        })
      ).toThrow('Invalid provider');

      // Invalid tokens
      expect(() =>
        queue.enqueue(request, {
          provider: 'openai',
          tokens: -1,
          priority: 'medium',
        })
      ).toThrow('Invalid tokens');

      // Invalid priority
      expect(() =>
        queue.enqueue(request, {
          provider: 'openai',
          tokens: 100,
          // @ts-expect-error - Testing invalid priority
          priority: 'invalid-priority',
        })
      ).toThrow('Invalid priority');
    });
  });

  // ============================================================================
  // Performance and Memory Tests
  // ============================================================================

  describe('Performance and Memory', () => {
    it('should handle large numbers of requests efficiently', async () => {
      const largeQueue = new RequestQueue(mockRateLimiter, { 
        maxSize: 1000,
        maxConcurrentRequests: 10,
        processingInterval: 10, // Faster processing
      });

      const requestCount = 50; // Reduced count for faster test
      const requests = Array.from({ length: requestCount }, (_, i) => 
        largeQueue.enqueue(
          createTestRequest(`request-${i}`, 1), // Very fast requests
          { provider: 'openai', tokens: 10, priority: 'medium' }
        )
      );

      const startTime = Date.now();
      const results = await Promise.all(requests);
      const endTime = Date.now();

      expect(results).toHaveLength(requestCount);
      expect(endTime - startTime).toBeLessThan(3000); // Reduced timeout
      
      const stats = largeQueue.getStats();
      expect(stats.completed).toBe(requestCount);
      expect(stats.failed).toBe(0);
      
      largeQueue.destroy();
    }, 10000); // 10 second timeout

    it('should not leak memory when processing many requests', async () => {
      const memQueue = new RequestQueue(mockRateLimiter, { 
        maxSize: 50, 
        processingInterval: 10 
      });

      // Process requests in batches to check memory cleanup
      for (let batch = 0; batch < 3; batch++) { // Reduced batches
        const batchRequests = Array.from({ length: 5 }, (_, i) => 
          memQueue.enqueue(
            createTestRequest(`batch-${batch}-request-${i}`, 1),
            { provider: 'openai', tokens: 10, priority: 'medium' }
          )
        );

        await Promise.all(batchRequests);
        
        // Queue should be empty after each batch
        expect(memQueue.size).toBe(0);
      }

      const stats = memQueue.getStats();
      expect(stats.completed).toBe(15); // 3 * 5
      
      memQueue.destroy();
    }, 10000); // 10 second timeout
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle zero-token requests', async () => {
      const request = createTestRequest('zero-tokens');
      
      const result = await queue.enqueue(request, {
        provider: 'openai',
        tokens: 0,
        priority: 'medium',
      });

      expect(result).toBe('Response for zero-tokens');
      expect(mockRateLimiter.checkLimit).toHaveBeenCalledWith('openai', 0);
    });

    it('should handle requests with large token counts', async () => {
      const request = createTestRequest('large-tokens');
      
      const result = await queue.enqueue(request, {
        provider: 'openai',
        tokens: 100000,
        priority: 'high',
      });

      expect(result).toBe('Response for large-tokens');
      expect(mockRateLimiter.checkLimit).toHaveBeenCalledWith('openai', 100000);
    });

    it('should handle empty metadata gracefully', async () => {
      const request = createTestRequest('no-metadata');
      
      const result = await queue.enqueue(request, {
        provider: 'openai',
        tokens: 100,
        priority: 'medium',
        // No metadata provided
      });

      expect(result).toBe('Response for no-metadata');
    });

    it('should handle rapid enqueue/dequeue operations', async () => {
      const rapidQueue = new RequestQueue(mockRateLimiter, { processingInterval: 1 });
      
      const requests: Promise<string>[] = [];
      
      // Rapidly enqueue and cancel some requests
      for (let i = 0; i < 10; i++) {
        const req = rapidQueue.enqueue(
          createTestRequest(`rapid-${i}`, 10),
          { provider: 'openai', tokens: 50, priority: 'medium' }
        );
        requests.push(req);
        
        // Cancel every other request
        if (i % 2 === 0) {
          setTimeout(() => rapidQueue.cancel(req), 1);
        }
      }

      // Wait for all operations to complete
      const results = await Promise.allSettled(requests);
      
      const fulfilled = results.filter(r => r.status === 'fulfilled');
      const rejected = results.filter(r => r.status === 'rejected');
      
      expect(fulfilled.length + rejected.length).toBe(10);
      expect(rejected.length).toBeGreaterThan(0); // Some should be cancelled
      
      rapidQueue.destroy();
    });
  });
});