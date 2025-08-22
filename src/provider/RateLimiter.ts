/**
 * @file Rate Limiter
 * 
 * Provider-agnostic rate limiter implementing token bucket algorithm with
 * exponential backoff and sliding window rate limiting. Prevents API rate
 * limit violations by enforcing configurable limits per provider.
 * 
 * Features:
 * - Token bucket algorithm for smooth rate limiting
 * - Separate tracking for requests and tokens
 * - Exponential backoff with jitter on rate limit hits
 * - Sliding window for time-based limit resets
 * - Thread-safe concurrent request handling
 * - Provider-specific configuration (OpenAI, Gemini, OpenRouter)
 * - Comprehensive statistics and debugging
 * 
 * Algorithm Details:
 * - Uses dual token buckets (requests + tokens) for fine-grained control
 * - Implements exponential backoff: delay = baseDelay * 2^attempts + jitter
 * - Sliding window removes old requests/tokens outside time window
 * - Concurrent access protected by atomic operations where possible
 */

import type { ProviderType } from '../types/providers';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Rate limit configuration for a provider
 */
export interface RateLimitConfig {
  /** Maximum requests per minute */
  requestsPerMinute: number;
  /** Maximum tokens per minute */
  tokensPerMinute: number;
  /** Burst capacity (max concurrent requests allowed) */
  burstSize: number;
  /** Request refill rate (requests per second) */
  refillRate: number;
  /** Token refill rate (tokens per second) */
  tokensRefillRate: number;
}

/**
 * Result of a rate limit check
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Time in milliseconds to wait before retrying (0 if allowed) */
  retryAfter: number;
  /** Number of requests remaining in current window */
  remainingRequests: number;
  /** Number of tokens remaining in current window */
  remainingTokens: number;
  /** Reason for denial (if denied) */
  reason?: string;
  /** Current backoff level */
  backoffLevel?: number;
}

/**
 * Backoff strategy configuration
 */
export interface BackoffStrategy {
  /** Base delay in milliseconds */
  baseDelay: number;
  /** Maximum delay in milliseconds */
  maxDelay: number;
  /** Multiplier for exponential backoff */
  multiplier: number;
  /** Maximum jitter percentage (0-1) */
  maxJitter: number;
}

/**
 * Provider statistics
 */
export interface ProviderStats {
  /** Current requests in time window */
  requestsInWindow: number;
  /** Current tokens in time window */
  tokensInWindow: number;
  /** Last request timestamp */
  lastRequestTime: number;
  /** Current backoff level */
  backoffLevel: number;
  /** Window start time */
  windowStartTime: number;
  /** Total requests made */
  totalRequests: number;
  /** Total tokens consumed */
  totalTokens: number;
  /** Number of rate limit hits */
  rateLimitHits: number;
}

/**
 * Request record for sliding window
 */
interface RequestRecord {
  timestamp: number;
  tokens: number;
}

/**
 * Provider state for rate limiting
 */
interface ProviderState {
  config: RateLimitConfig;
  requestBucket: number; // Available request tokens
  tokenBucket: number; // Available token capacity
  lastRefillTime: number;
  backoffLevel: number;
  lastRequestTime: number;
  requestHistory: RequestRecord[];
  totalRequests: number;
  totalTokens: number;
  rateLimitHits: number;
  consecutiveHits: number;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Sliding window size in milliseconds (1 minute)
 */
const SLIDING_WINDOW_SIZE = 60000;

/**
 * Minimum time delta for refill operations (prevents micro-refills)
 */
const MIN_REFILL_DELTA = 1;

// ============================================================================
// Default Configurations
// ============================================================================

/**
 * Default rate limit configurations per provider
 */
const DEFAULT_PROVIDER_CONFIGS: Record<ProviderType, RateLimitConfig> = {
  openai: {
    requestsPerMinute: 3500,
    tokensPerMinute: 90000,
    burstSize: 10,
    refillRate: 58.33, // 3500/60
    tokensRefillRate: 1500, // 90000/60
  },
  gemini: {
    requestsPerMinute: 1000,
    tokensPerMinute: 50000,
    burstSize: 5,
    refillRate: 16.67, // 1000/60
    tokensRefillRate: 833.33, // 50000/60
  },
  openrouter: {
    requestsPerMinute: 2000,
    tokensPerMinute: 60000,
    burstSize: 8,
    refillRate: 33.33, // 2000/60
    tokensRefillRate: 1000, // 60000/60
  },
};

/**
 * Default backoff strategy
 */
const DEFAULT_BACKOFF_STRATEGY: BackoffStrategy = {
  baseDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  multiplier: 2.0,
  maxJitter: 0.1, // 10% jitter
};

// ============================================================================
// Rate Limiter Implementation
// ============================================================================

/**
 * Rate limiter with token bucket algorithm and exponential backoff
 */
export class RateLimiter {
  private providerStates: Map<ProviderType, ProviderState> = new Map();
  private backoffStrategy: BackoffStrategy;
  private readonly windowSize = SLIDING_WINDOW_SIZE;

  constructor(backoffStrategy: BackoffStrategy = DEFAULT_BACKOFF_STRATEGY) {
    this.backoffStrategy = { ...backoffStrategy }; // Defensive copy
    this.initializeProviders();
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Check if a request with given token usage is allowed
   * @param provider The provider type
   * @param tokens Number of tokens the request will consume
   * @returns Rate limit result
   */
  async checkLimit(provider: ProviderType, tokens: number): Promise<RateLimitResult> {
    this.validateInputs(provider, tokens);
    
    const state = this.getProviderState(provider);
    const now = Date.now();
    
    // Update token buckets based on time elapsed
    this.refillBuckets(state, now);
    
    // Clean old records from sliding window
    this.cleanOldRecords(state, now);
    
    // Check if request would exceed limits
    const limitCheck = this.checkLimits(state, tokens);
    
    if (limitCheck.allowed) {
      // Consume tokens and record request
      this.consumeTokens(state, tokens, now);
      // Reset backoff completely on successful request
      state.backoffLevel = 0;
      state.consecutiveHits = 0;
    } else {
      // Increment rate limit hits and backoff level
      state.rateLimitHits++;
      state.consecutiveHits++;
      // Backoff level increases with each consecutive hit
      const newBackoffLevel = Math.min(
        state.consecutiveHits - 1, // First hit = level 0, second = level 1, etc.
        Math.floor(Math.log2(this.backoffStrategy.maxDelay / this.backoffStrategy.baseDelay))
      );
      state.backoffLevel = newBackoffLevel;
      
      // Update the result with the current backoff level
      limitCheck.backoffLevel = newBackoffLevel;
    }
    
    state.lastRequestTime = now;
    
    return limitCheck;
  }

  /**
   * Configure rate limits for a specific provider
   * @param provider The provider type
   * @param config The rate limit configuration
   */
  configureProvider(provider: ProviderType, config: RateLimitConfig): void {
    this.validateConfig(config);
    
    const state = this.getProviderState(provider);
    state.config = { ...config };
    
    // Reset buckets to new capacity
    state.requestBucket = config.burstSize;
    state.tokenBucket = config.tokensPerMinute;
    state.lastRefillTime = Date.now();
  }

  /**
   * Get current rate limit configuration for a provider
   * @param provider The provider type
   * @returns The current rate limit configuration
   */
  getProviderLimits(provider: ProviderType): RateLimitConfig {
    const state = this.getProviderState(provider);
    return { ...state.config };
  }

  /**
   * Get current statistics for a provider
   * @param provider The provider type
   * @returns Provider statistics
   */
  getProviderStats(provider: ProviderType): ProviderStats {
    const state = this.getProviderState(provider);
    const now = Date.now();
    
    // Clean old records for accurate current window stats
    this.cleanOldRecords(state, now);
    
    const requestsInWindow = state.requestHistory.length;
    const tokensInWindow = state.requestHistory.reduce((sum, record) => sum + record.tokens, 0);
    const windowStartTime = requestsInWindow > 0 
      ? Math.min(...state.requestHistory.map(r => r.timestamp))
      : now;
    
    return {
      requestsInWindow,
      tokensInWindow,
      lastRequestTime: state.lastRequestTime,
      backoffLevel: state.backoffLevel,
      windowStartTime,
      totalRequests: state.totalRequests,
      totalTokens: state.totalTokens,
      rateLimitHits: state.rateLimitHits,
    };
  }

  /**
   * Reset rate limits for a specific provider
   * @param provider The provider type
   */
  resetProvider(provider: ProviderType): void {
    const state = this.getProviderState(provider);
    const now = Date.now();
    
    state.requestBucket = state.config.burstSize;
    state.tokenBucket = state.config.tokensPerMinute;
    state.lastRefillTime = now;
    state.backoffLevel = 0;
    state.consecutiveHits = 0;
    state.requestHistory = [];
  }

  /**
   * Reset rate limits for all providers
   */
  resetAll(): void {
    for (const provider of this.providerStates.keys()) {
      this.resetProvider(provider);
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Initialize provider states with default configurations
   */
  private initializeProviders(): void {
    for (const [provider, config] of Object.entries(DEFAULT_PROVIDER_CONFIGS)) {
      const now = Date.now();
      
      this.providerStates.set(provider as ProviderType, {
        config: { ...config },
        requestBucket: config.burstSize,
        tokenBucket: config.tokensPerMinute,
        lastRefillTime: now,
        backoffLevel: 0,
        lastRequestTime: 0,
        requestHistory: [],
        totalRequests: 0,
        totalTokens: 0,
        rateLimitHits: 0,
        consecutiveHits: 0,
      });
    }
  }

  /**
   * Get provider state, throwing error if not found
   * @param provider The provider type
   * @returns Provider state
   */
  private getProviderState(provider: ProviderType): ProviderState {
    const state = this.providerStates.get(provider);
    if (!state) {
      throw new Error(`Unknown provider: ${provider}`);
    }
    return state;
  }

  /**
   * Validate input parameters
   * @param provider The provider type
   * @param tokens Token count
   */
  private validateInputs(provider: ProviderType, tokens: number): void {
    if (!provider || typeof provider !== 'string') {
      throw new Error(`Invalid provider type: expected string, got ${typeof provider}`);
    }
    
    const validProviders = ['openai', 'gemini', 'openrouter'] as const;
    if (!validProviders.includes(provider as any)) {
      throw new Error(`Unknown provider: ${provider}. Valid providers: ${validProviders.join(', ')}`);
    }
    
    if (typeof tokens !== 'number' || tokens < 0 || !isFinite(tokens)) {
      throw new Error(`Invalid token count: must be non-negative finite number, got ${tokens} (${typeof tokens})`);
    }
  }

  /**
   * Validate rate limit configuration
   * @param config The configuration to validate
   */
  private validateConfig(config: RateLimitConfig): void {
    const requiredFields = [
      'requestsPerMinute', 
      'tokensPerMinute', 
      'burstSize', 
      'refillRate', 
      'tokensRefillRate'
    ];
    
    for (const field of requiredFields) {
      const value = config[field as keyof RateLimitConfig];
      if (typeof value !== 'number' || value <= 0 || !isFinite(value)) {
        throw new Error(`Invalid rate limit configuration: ${field} must be a positive number`);
      }
    }
    
    if (config.burstSize > config.requestsPerMinute) {
      throw new Error('Invalid rate limit configuration: burst size cannot exceed requests per minute');
    }
  }

  /**
   * Refill token buckets based on elapsed time
   * @param state Provider state
   * @param now Current timestamp
   */
  private refillBuckets(state: ProviderState, now: number): void {
    const timeDelta = now - state.lastRefillTime;
    
    // Handle case where time goes backwards (system clock issues)
    if (timeDelta < 0) {
      state.lastRefillTime = now;
      return;
    }
    
    // Only refill if sufficient time has passed
    if (timeDelta <= MIN_REFILL_DELTA) {
      return;
    }
    
    const secondsElapsed = timeDelta / 1000;
    
    // Refill request tokens
    const requestTokensToAdd = secondsElapsed * state.config.refillRate;
    state.requestBucket = Math.min(
      state.config.burstSize,
      state.requestBucket + requestTokensToAdd
    );
    
    // Refill token capacity
    const tokenCapacityToAdd = secondsElapsed * state.config.tokensRefillRate;
    state.tokenBucket = Math.min(
      state.config.tokensPerMinute,
      state.tokenBucket + tokenCapacityToAdd
    );
    
    state.lastRefillTime = now;
  }

  /**
   * Clean old records outside the sliding window
   * @param state Provider state
   * @param now Current timestamp
   */
  private cleanOldRecords(state: ProviderState, now: number): void {
    const cutoffTime = now - this.windowSize;
    
    // Find first record within window (binary search would be more efficient for large arrays)
    let firstValidIndex = 0;
    const history = state.requestHistory;
    
    while (firstValidIndex < history.length) {
      const record = history[firstValidIndex];
      if (!record || record.timestamp >= cutoffTime) {
        break;
      }
      firstValidIndex++;
    }
    
    // Remove old records if any found
    if (firstValidIndex > 0) {
      state.requestHistory.splice(0, firstValidIndex);
    }
  }

  /**
   * Check if request would exceed rate limits
   * @param state Provider state
   * @param tokens Tokens required
   * @returns Rate limit check result
   */
  private checkLimits(state: ProviderState, tokens: number): RateLimitResult {
    const { config } = state;
    
    // Calculate current usage in sliding window
    const requestsInWindow = state.requestHistory.length;
    const tokensInWindow = state.requestHistory.reduce((sum, record) => sum + record.tokens, 0);
    
    // Check request bucket (burst capacity)
    if (state.requestBucket < 1) {
      const retryAfter = this.calculateBackoff(state);
      return {
        allowed: false,
        retryAfter,
        remainingRequests: 0,
        remainingTokens: Math.max(0, state.tokenBucket - tokens),
        reason: 'Request rate limit exceeded (burst capacity)',
        backoffLevel: state.backoffLevel,
      };
    }
    
    // Check token bucket capacity
    if (state.tokenBucket < tokens) {
      const retryAfter = this.calculateBackoff(state);
      return {
        allowed: false,
        retryAfter,
        remainingRequests: Math.max(0, Math.floor(state.requestBucket) - 1),
        remainingTokens: Math.max(0, state.tokenBucket),
        reason: 'token rate limit exceeded',
        backoffLevel: state.backoffLevel,
      };
    }
    
    // Check sliding window limits
    if (requestsInWindow >= config.requestsPerMinute) {
      const retryAfter = this.calculateBackoff(state);
      return {
        allowed: false,
        retryAfter,
        remainingRequests: 0,
        remainingTokens: Math.max(0, state.tokenBucket - tokens),
        reason: 'Request rate limit exceeded (per minute)',
        backoffLevel: state.backoffLevel,
      };
    }
    
    if (tokensInWindow + tokens > config.tokensPerMinute) {
      const retryAfter = this.calculateBackoff(state);
      return {
        allowed: false,
        retryAfter,
        remainingRequests: Math.max(0, Math.floor(state.requestBucket) - 1),
        remainingTokens: Math.max(0, config.tokensPerMinute - tokensInWindow),
        reason: 'token rate limit exceeded (per minute)',
        backoffLevel: state.backoffLevel,
      };
    }
    
    // Request is allowed
    return {
      allowed: true,
      retryAfter: 0,
      remainingRequests: Math.max(0, Math.floor(state.requestBucket) - 1),
      remainingTokens: Math.max(0, state.tokenBucket - tokens),
    };
  }

  /**
   * Consume tokens and record the request
   * @param state Provider state
   * @param tokens Tokens to consume
   * @param now Current timestamp
   */
  private consumeTokens(state: ProviderState, tokens: number, now: number): void {
    // Consume from buckets
    state.requestBucket = Math.max(0, state.requestBucket - 1);
    state.tokenBucket = Math.max(0, state.tokenBucket - tokens);
    
    // Record in sliding window
    state.requestHistory.push({
      timestamp: now,
      tokens,
    });
    
    // Update totals
    state.totalRequests++;
    state.totalTokens += tokens;
  }

  /**
   * Calculate exponential backoff delay with jitter
   * @param state Provider state
   * @returns Delay in milliseconds
   */
  private calculateBackoff(state: ProviderState): number {
    const { baseDelay, maxDelay, multiplier, maxJitter } = this.backoffStrategy;
    
    // Exponential backoff: delay = baseDelay * multiplier^level
    const exponentialDelay = baseDelay * Math.pow(multiplier, state.backoffLevel);
    
    // Cap at maximum delay
    const cappedDelay = Math.min(exponentialDelay, maxDelay);
    
    // Add jitter to avoid thundering herd
    const jitterAmount = cappedDelay * maxJitter * Math.random();
    const finalDelay = cappedDelay + jitterAmount;
    
    return Math.round(finalDelay);
  }
}