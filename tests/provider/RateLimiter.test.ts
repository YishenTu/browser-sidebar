/**
 * @file Rate Limiter Tests
 * 
 * Comprehensive test suite for the RateLimiter class following TDD methodology.
 * Tests rate limiting enforcement, token bucket algorithm, backoff strategies,
 * reset functionality, and concurrent request handling.
 * 
 * Test Structure:
 * 1. Rate limiting enforcement per provider
 * 2. Token bucket algorithm implementation
 * 3. Exponential backoff with jitter
 * 4. Reset functionality based on time windows
 * 5. Concurrent requests handling (thread safety)
 * 6. Edge cases and error scenarios
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RateLimiter, RateLimitConfig, RateLimitResult, BackoffStrategy } from '../../src/provider/RateLimiter';
import type { ProviderType } from '../../src/types/providers';

// ============================================================================
// Test Fixtures and Mocks
// ============================================================================

/**
 * Mock rate limit configurations for different providers
 */
const mockConfigurations = {
  openai: {
    requestsPerMinute: 3500,
    tokensPerMinute: 90000,
    burstSize: 10, // Allow burst requests up to this limit
    refillRate: 58.33, // requests per second (3500/60)
    tokensRefillRate: 1500, // tokens per second (90000/60)
  },
  gemini: {
    requestsPerMinute: 1000,
    tokensPerMinute: 50000,
    burstSize: 5,
    refillRate: 16.67, // requests per second (1000/60)
    tokensRefillRate: 833.33, // tokens per second (50000/60)
  },
  openrouter: {
    requestsPerMinute: 2000,
    tokensPerMinute: 60000,
    burstSize: 8,
    refillRate: 33.33, // requests per second (2000/60)
    tokensRefillRate: 1000, // tokens per second (60000/60)
  },
} as const;

/**
 * Mock current time for deterministic tests
 */
let mockTime = 1000000; // Start at 1 million ms
const originalDateNow = Date.now;

function mockDateNow() {
  return mockTime;
}

function advanceTime(ms: number) {
  mockTime += ms;
}

function resetTime() {
  mockTime = 1000000;
}

// ============================================================================
// Main Test Suite
// ============================================================================

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    // Reset time and mock Date.now
    resetTime();
    vi.spyOn(Date, 'now').mockImplementation(mockDateNow);
    
    // Create fresh rate limiter instance
    rateLimiter = new RateLimiter();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Construction and Configuration Tests
  // ============================================================================

  describe('Construction and Configuration', () => {
    it('should create a rate limiter with default configurations', () => {
      expect(rateLimiter).toBeInstanceOf(RateLimiter);
      expect(rateLimiter.getProviderLimits('openai')).toBeDefined();
      expect(rateLimiter.getProviderLimits('gemini')).toBeDefined();
      expect(rateLimiter.getProviderLimits('openrouter')).toBeDefined();
    });

    it('should allow custom configuration for providers', () => {
      const customConfig: RateLimitConfig = {
        requestsPerMinute: 5000,
        tokensPerMinute: 100000,
        burstSize: 15,
        refillRate: 83.33,
        tokensRefillRate: 1666.67,
      };

      rateLimiter.configureProvider('openai', customConfig);
      
      const limits = rateLimiter.getProviderLimits('openai');
      expect(limits.requestsPerMinute).toBe(5000);
      expect(limits.tokensPerMinute).toBe(100000);
      expect(limits.burstSize).toBe(15);
    });

    it('should throw error for invalid provider configuration', () => {
      const invalidConfig = {
        requestsPerMinute: -100, // Invalid negative value
        tokensPerMinute: 50000,
        burstSize: 5,
        refillRate: 16.67,
        tokensRefillRate: 833.33,
      } as RateLimitConfig;

      expect(() => {
        rateLimiter.configureProvider('openai', invalidConfig);
      }).toThrow('Invalid rate limit configuration');
    });
  });

  // ============================================================================
  // Rate Limiting Enforcement Tests
  // ============================================================================

  describe('Rate Limiting Enforcement', () => {
    it('should allow requests within rate limits', async () => {
      const result = await rateLimiter.checkLimit('openai', 100); // 100 tokens
      
      expect(result.allowed).toBe(true);
      expect(result.retryAfter).toBe(0);
      expect(result.remainingRequests).toBe(mockConfigurations.openai.burstSize - 1);
      expect(result.remainingTokens).toBeLessThanOrEqual(mockConfigurations.openai.tokensPerMinute);
    });

    it('should deny requests that exceed request rate limits', async () => {
      // Exhaust the burst capacity
      for (let i = 0; i < mockConfigurations.openai.burstSize; i++) {
        await rateLimiter.checkLimit('openai', 100);
      }

      // Next request should be denied
      const result = await rateLimiter.checkLimit('openai', 100);
      
      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeGreaterThan(0);
      expect(result.remainingRequests).toBe(0);
    });

    it('should deny requests that exceed token rate limits', async () => {
      // Try to use more tokens than available
      const excessiveTokens = mockConfigurations.openai.tokensPerMinute + 1000;
      const result = await rateLimiter.checkLimit('openai', excessiveTokens);
      
      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeGreaterThan(0);
      expect(result.reason).toContain('token');
    });

    it('should enforce different limits per provider', async () => {
      // OpenAI has higher limits than Gemini
      const tokenAmount = 2000;
      
      // Should work for OpenAI (higher token limit)
      const openaiResult = await rateLimiter.checkLimit('openai', tokenAmount);
      expect(openaiResult.allowed).toBe(true);
      
      // Test same amount with Gemini (after some requests)
      for (let i = 0; i < mockConfigurations.gemini.burstSize; i++) {
        await rateLimiter.checkLimit('gemini', 100);
      }
      
      const geminiResult = await rateLimiter.checkLimit('gemini', tokenAmount);
      // Should have fewer remaining requests due to lower limits
      expect(geminiResult.remainingRequests).toBeLessThan(openaiResult.remainingRequests);
    });
  });

  // ============================================================================
  // Token Bucket Algorithm Tests
  // ============================================================================

  describe('Token Bucket Algorithm', () => {
    it('should implement token bucket for requests', async () => {
      // Fill bucket to capacity
      const burstSize = mockConfigurations.openai.burstSize;
      
      // Use up all burst tokens
      for (let i = 0; i < burstSize; i++) {
        const result = await rateLimiter.checkLimit('openai', 100);
        expect(result.allowed).toBe(true);
      }
      
      // Next request should be denied (bucket empty)
      const deniedResult = await rateLimiter.checkLimit('openai', 100);
      expect(deniedResult.allowed).toBe(false);
    });

    it('should refill request tokens over time', async () => {
      const burstSize = mockConfigurations.openai.burstSize;
      const refillRate = mockConfigurations.openai.refillRate;
      
      // Exhaust burst capacity
      for (let i = 0; i < burstSize; i++) {
        await rateLimiter.checkLimit('openai', 100);
      }
      
      // Should be denied immediately
      let result = await rateLimiter.checkLimit('openai', 100);
      expect(result.allowed).toBe(false);
      
      // Advance time by enough to refill 1 token
      advanceTime(1000 / refillRate); // Time for 1 token refill
      
      // Should now be allowed
      result = await rateLimiter.checkLimit('openai', 100);
      expect(result.allowed).toBe(true);
    });

    it('should implement token bucket for token usage', async () => {
      const maxTokens = mockConfigurations.openai.tokensPerMinute;
      const tokensRefillRate = mockConfigurations.openai.tokensRefillRate;
      
      // Use most available tokens
      const largeTokenRequest = Math.floor(maxTokens * 0.9);
      let result = await rateLimiter.checkLimit('openai', largeTokenRequest);
      expect(result.allowed).toBe(true);
      
      // Try to use remaining tokens + more
      const excessTokenRequest = Math.floor(maxTokens * 0.2);
      result = await rateLimiter.checkLimit('openai', excessTokenRequest);
      expect(result.allowed).toBe(false);
      
      // Advance time to refill some tokens
      advanceTime(5000); // 5 seconds
      
      // Should now have some tokens available
      result = await rateLimiter.checkLimit('openai', 1000);
      expect(result.allowed).toBe(true);
    });

    it('should not exceed maximum bucket capacity', async () => {
      const burstSize = mockConfigurations.openai.burstSize;
      const refillRate = mockConfigurations.openai.refillRate;
      
      // Advance time significantly (more than needed to fill bucket)
      advanceTime(60000); // 1 minute
      
      // Should only have burst size capacity, not unlimited
      for (let i = 0; i < burstSize; i++) {
        const result = await rateLimiter.checkLimit('openai', 100);
        expect(result.allowed).toBe(true);
      }
      
      // Next request should still be denied (bucket capped at burst size)
      const result = await rateLimiter.checkLimit('openai', 100);
      expect(result.allowed).toBe(false);
    });
  });

  // ============================================================================
  // Backoff Strategy Tests
  // ============================================================================

  describe('Exponential Backoff with Jitter', () => {
    it('should calculate exponential backoff delay', async () => {
      // Exhaust rate limit
      for (let i = 0; i < mockConfigurations.openai.burstSize; i++) {
        await rateLimiter.checkLimit('openai', 100);
      }
      
      // First rate limit hit
      const result1 = await rateLimiter.checkLimit('openai', 100);
      expect(result1.allowed).toBe(false);
      const baseDelay = result1.retryAfter;
      expect(baseDelay).toBeGreaterThan(0);
      
      // Simulate immediate retry (should increase backoff level, though jitter may affect final delay)
      const result2 = await rateLimiter.checkLimit('openai', 100);
      expect(result2.allowed).toBe(false);
      // First hit should be backoff level 0, second should be level 1
      expect(result2.backoffLevel).toBe(1);
      expect(result1.backoffLevel).toBe(0);
      // Due to jitter, we just check that delay is reasonable
      expect(result2.retryAfter).toBeGreaterThan(500); // Should be around 1000ms base * 2^1 ± jitter
    });

    it('should include jitter in backoff calculation', async () => {
      const backoffDelays: number[] = [];
      
      // Trigger multiple rate limit hits
      for (let i = 0; i < mockConfigurations.openai.burstSize + 5; i++) {
        const result = await rateLimiter.checkLimit('openai', 100);
        if (!result.allowed) {
          backoffDelays.push(result.retryAfter);
        }
      }
      
      // Should have some variation due to jitter (not all identical)
      expect(backoffDelays.length).toBeGreaterThan(1);
      const uniqueDelays = new Set(backoffDelays);
      expect(uniqueDelays.size).toBeGreaterThan(1); // Some variation expected
    });

    it('should reset backoff after successful request', async () => {
      // Trigger rate limit
      for (let i = 0; i < mockConfigurations.openai.burstSize + 1; i++) {
        await rateLimiter.checkLimit('openai', 100);
      }
      
      // Wait for refill
      advanceTime(5000);
      
      // Make successful request (should reset backoff)
      const successResult = await rateLimiter.checkLimit('openai', 100);
      expect(successResult.allowed).toBe(true);
      
      // Trigger rate limit again - backoff should be reset to base level
      for (let i = 0; i < mockConfigurations.openai.burstSize; i++) {
        await rateLimiter.checkLimit('openai', 100);
      }
      
      const limitResult = await rateLimiter.checkLimit('openai', 100);
      expect(limitResult.allowed).toBe(false);
      // Backoff should be at base level, not escalated
      expect(limitResult.retryAfter).toBeLessThan(2000); // Reasonable base delay
    });

    it('should cap maximum backoff delay', async () => {
      // Trigger many consecutive rate limit hits
      for (let i = 0; i < 20; i++) {
        await rateLimiter.checkLimit('openai', 100);
      }
      
      const result = await rateLimiter.checkLimit('openai', 100);
      expect(result.allowed).toBe(false);
      // Should not exceed maximum backoff (e.g., 30 seconds)
      expect(result.retryAfter).toBeLessThan(30000);
    });
  });

  // ============================================================================
  // Reset Functionality Tests
  // ============================================================================

  describe('Reset Functionality', () => {
    it('should reset provider limits', async () => {
      // Exhaust limits
      for (let i = 0; i < mockConfigurations.openai.burstSize; i++) {
        await rateLimiter.checkLimit('openai', 5000);
      }
      
      // Should be rate limited
      const limitedResult = await rateLimiter.checkLimit('openai', 100);
      expect(limitedResult.allowed).toBe(false);
      
      // Reset limits
      rateLimiter.resetProvider('openai');
      
      // Should be allowed again
      const resetResult = await rateLimiter.checkLimit('openai', 100);
      expect(resetResult.allowed).toBe(true);
    });

    it('should reset all providers', async () => {
      // Exhaust limits for multiple providers
      for (const provider of ['openai', 'gemini'] as ProviderType[]) {
        const config = mockConfigurations[provider];
        for (let i = 0; i < config.burstSize; i++) {
          await rateLimiter.checkLimit(provider, 1000);
        }
      }
      
      // Both should be limited
      expect((await rateLimiter.checkLimit('openai', 100)).allowed).toBe(false);
      expect((await rateLimiter.checkLimit('gemini', 100)).allowed).toBe(false);
      
      // Reset all
      rateLimiter.resetAll();
      
      // Both should be allowed
      expect((await rateLimiter.checkLimit('openai', 100)).allowed).toBe(true);
      expect((await rateLimiter.checkLimit('gemini', 100)).allowed).toBe(true);
    });

    it('should handle automatic reset based on time windows', async () => {
      // This tests the sliding window behavior
      const burstSize = mockConfigurations.openai.burstSize;
      
      // Exhaust burst capacity quickly (without time gaps to avoid refill)
      for (let i = 0; i < burstSize; i++) {
        await rateLimiter.checkLimit('openai', 100);
        // No time advance - exhaust burst quickly
      }
      
      // Should be limited now (burst exhausted)
      expect((await rateLimiter.checkLimit('openai', 100)).allowed).toBe(false);
      
      // Advance time past window (60 seconds)
      advanceTime(60000);
      
      // Old requests should be outside window, allowing new requests
      const result = await rateLimiter.checkLimit('openai', 100);
      expect(result.allowed).toBe(true);
    });
  });

  // ============================================================================
  // Concurrent Requests Handling Tests
  // ============================================================================

  describe('Concurrent Requests Handling', () => {
    it('should handle concurrent requests safely', async () => {
      const concurrentRequests = 20;
      const promises: Promise<RateLimitResult>[] = [];
      
      // Launch concurrent requests
      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(rateLimiter.checkLimit('openai', 1000));
      }
      
      const results = await Promise.all(promises);
      
      // Count allowed vs denied
      const allowedCount = results.filter(r => r.allowed).length;
      const deniedCount = results.filter(r => !r.allowed).length;
      
      // Should respect burst capacity
      expect(allowedCount).toBeLessThanOrEqual(mockConfigurations.openai.burstSize);
      expect(deniedCount).toBe(concurrentRequests - allowedCount);
      
      // No race condition artifacts (negative values, etc.)
      results.forEach(result => {
        expect(result.remainingRequests).toBeGreaterThanOrEqual(0);
        expect(result.remainingTokens).toBeGreaterThanOrEqual(0);
      });
    });

    it('should maintain consistency under concurrent access', async () => {
      const iterations = 10;
      const concurrentRequests = 5;
      
      for (let i = 0; i < iterations; i++) {
        const promises = Array(concurrentRequests).fill(0).map(() => 
          rateLimiter.checkLimit('openai', 500)
        );
        
        const results = await Promise.all(promises);
        
        // Verify state consistency
        const stats = rateLimiter.getProviderStats('openai');
        expect(stats.requestsInWindow).toBeGreaterThanOrEqual(0);
        expect(stats.tokensInWindow).toBeGreaterThanOrEqual(0);
        
        // Reset for next iteration
        rateLimiter.resetProvider('openai');
      }
    });

    it('should handle rapid sequential requests correctly', async () => {
      const rapidRequests = 100;
      const results: RateLimitResult[] = [];
      
      // Make requests as fast as possible (without time advancement for first batch)
      for (let i = 0; i < rapidRequests; i++) {
        const result = await rateLimiter.checkLimit('openai', 100);
        results.push(result);
        
        // Only advance time after burst capacity is likely exhausted
        if (i >= mockConfigurations.openai.burstSize) {
          advanceTime(1);
        }
      }
      
      // Should have proper allowed/denied pattern
      const allowedResults = results.filter(r => r.allowed);
      const deniedResults = results.filter(r => !r.allowed);
      
      // First 10 should be allowed (burst), then some may be allowed due to refill
      expect(allowedResults.length).toBeGreaterThanOrEqual(mockConfigurations.openai.burstSize);
      expect(allowedResults.length).toBeLessThan(rapidRequests); // Not all should be allowed
      expect(deniedResults.length).toBeGreaterThan(0);
      
      // Denied requests should have meaningful retry times
      deniedResults.forEach(result => {
        expect(result.retryAfter).toBeGreaterThan(0);
        expect(result.reason).toBeTruthy();
      });
    });
  });

  // ============================================================================
  // Edge Cases and Error Scenarios
  // ============================================================================

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle zero token requests', async () => {
      const result = await rateLimiter.checkLimit('openai', 0);
      
      expect(result.allowed).toBe(true);
      expect(result.remainingRequests).toBe(mockConfigurations.openai.burstSize - 1);
      // Token count should remain unchanged
    });

    it('should handle very large token requests', async () => {
      const hugeTokenRequest = 1000000; // 1 million tokens
      const result = await rateLimiter.checkLimit('openai', hugeTokenRequest);
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('token');
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should handle invalid provider types gracefully', async () => {
      expect(async () => {
        await rateLimiter.checkLimit('invalid-provider' as ProviderType, 100);
      }).rejects.toThrow('Unknown provider');
    });

    it('should handle negative token values', async () => {
      expect(async () => {
        await rateLimiter.checkLimit('openai', -100);
      }).rejects.toThrow('Invalid token count');
    });

    it('should handle time going backwards (system clock issues)', async () => {
      // Make initial request
      await rateLimiter.checkLimit('openai', 100);
      
      // Simulate time going backwards
      advanceTime(-5000);
      
      // Should still function correctly (not crash or corrupt state)
      const result = await rateLimiter.checkLimit('openai', 100);
      expect(result).toHaveProperty('allowed');
      expect(result).toHaveProperty('retryAfter');
      expect(result).toHaveProperty('remainingRequests');
    });

    it('should provide detailed statistics', async () => {
      // Make some requests
      await rateLimiter.checkLimit('openai', 1000);
      await rateLimiter.checkLimit('openai', 2000);
      
      const stats = rateLimiter.getProviderStats('openai');
      
      expect(stats).toHaveProperty('requestsInWindow');
      expect(stats).toHaveProperty('tokensInWindow');
      expect(stats).toHaveProperty('lastRequestTime');
      expect(stats).toHaveProperty('backoffLevel');
      expect(stats).toHaveProperty('windowStartTime');
      
      expect(stats.requestsInWindow).toBe(2);
      expect(stats.tokensInWindow).toBe(3000);
    });
  });

  // ============================================================================
  // Performance Tests
  // ============================================================================

  describe('Performance', () => {
    it('should handle check limit operations efficiently', async () => {
      const iterations = 1000;
      const startTime = Date.now();
      
      for (let i = 0; i < iterations; i++) {
        await rateLimiter.checkLimit('openai', 100);
        if (i % 100 === 0) {
          rateLimiter.resetProvider('openai'); // Prevent constant rate limiting
        }
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time (< 100ms for 1000 operations)
      expect(duration).toBeLessThan(100);
    });

    it('should maintain performance under concurrent load', async () => {
      const concurrentBatches = 10;
      const batchSize = 50;
      
      const startTime = Date.now();
      
      const promises = Array(concurrentBatches).fill(0).map(async () => {
        const batchPromises = Array(batchSize).fill(0).map(() => 
          rateLimiter.checkLimit('openai', 100)
        );
        return Promise.all(batchPromises);
      });
      
      await Promise.all(promises);
      
      const duration = Date.now() - startTime;
      
      // Should handle concurrent load efficiently
      expect(duration).toBeLessThan(200); // 200ms for 500 concurrent operations
    });
  });

  // ============================================================================
  // Integration with Provider Types
  // ============================================================================

  describe('Integration with Provider Types', () => {
    it('should work with all supported provider types', async () => {
      const providers: ProviderType[] = ['openai', 'gemini', 'openrouter'];
      
      for (const provider of providers) {
        const result = await rateLimiter.checkLimit(provider, 1000);
        expect(result.allowed).toBe(true);
        expect(result.remainingRequests).toBeGreaterThan(0);
        expect(result.remainingTokens).toBeGreaterThan(0);
        
        // Each provider should have different limits
        const limits = rateLimiter.getProviderLimits(provider);
        expect(limits.requestsPerMinute).toBeGreaterThan(0);
        expect(limits.tokensPerMinute).toBeGreaterThan(0);
      }
    });
  });
});