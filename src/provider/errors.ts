/**
 * @file Provider Error Taxonomy
 *
 * Comprehensive error classification and recovery strategies for AI providers.
 * Implements exponential backoff with jitter and user-facing error guidance.
 */

import type { ProviderError, ProviderType } from '../types/providers';

/**
 * Error types with recovery strategies
 */
export enum ErrorType {
  // Authentication errors (401, 403)
  AUTHENTICATION = 'authentication',

  // Rate limiting errors (429)
  RATE_LIMIT = 'rate_limit',

  // Network errors (connection, timeout)
  NETWORK = 'network',

  // Server errors (500, 502, 503)
  SERVER = 'server',

  // Validation errors (400, 422)
  VALIDATION = 'validation',

  // Context size errors
  CONTEXT_EXCEEDED = 'context_exceeded',

  // Cancellation (user-initiated)
  CANCELLED = 'cancelled',

  // Unknown errors
  UNKNOWN = 'unknown',
}

/**
 * Error recovery strategies
 */
export interface RecoveryStrategy {
  shouldRetry: boolean;
  retryAfter?: number; // milliseconds
  maxRetries: number;
  backoffMultiplier: number;
  jitterRange: [number, number]; // [min, max] percentage
  userGuidance: string;
}

/**
 * Error recovery strategies by type
 */
export const ERROR_RECOVERY_STRATEGIES: Record<ErrorType, RecoveryStrategy> = {
  [ErrorType.AUTHENTICATION]: {
    shouldRetry: false,
    maxRetries: 0,
    backoffMultiplier: 0,
    jitterRange: [0, 0],
    userGuidance:
      "Please check your API key in settings. Make sure it's valid and has the necessary permissions.",
  },

  [ErrorType.RATE_LIMIT]: {
    shouldRetry: true,
    retryAfter: 60000, // 1 minute default
    maxRetries: 3,
    backoffMultiplier: 2,
    jitterRange: [0.8, 1.2],
    userGuidance:
      'Rate limit reached. The request will retry automatically. Consider upgrading your API plan for higher limits.',
  },

  [ErrorType.NETWORK]: {
    shouldRetry: true,
    retryAfter: 1000, // 1 second initial
    maxRetries: 5,
    backoffMultiplier: 1.5,
    jitterRange: [0.5, 1.5],
    userGuidance:
      'Network connection issue. Please check your internet connection. The request will retry automatically.',
  },

  [ErrorType.SERVER]: {
    shouldRetry: true,
    retryAfter: 2000, // 2 seconds initial
    maxRetries: 3,
    backoffMultiplier: 2,
    jitterRange: [0.7, 1.3],
    userGuidance:
      'The AI service is temporarily unavailable. The request will retry automatically.',
  },

  [ErrorType.VALIDATION]: {
    shouldRetry: false,
    maxRetries: 0,
    backoffMultiplier: 0,
    jitterRange: [0, 0],
    userGuidance: 'Invalid request parameters. Please check your input and try again.',
  },

  [ErrorType.CONTEXT_EXCEEDED]: {
    shouldRetry: false,
    maxRetries: 0,
    backoffMultiplier: 0,
    jitterRange: [0, 0],
    userGuidance: 'Message too long. Please shorten your input or start a new conversation.',
  },

  [ErrorType.CANCELLED]: {
    shouldRetry: false,
    maxRetries: 0,
    backoffMultiplier: 0,
    jitterRange: [0, 0],
    userGuidance: 'Request cancelled.',
  },

  [ErrorType.UNKNOWN]: {
    shouldRetry: true,
    retryAfter: 3000,
    maxRetries: 2,
    backoffMultiplier: 2,
    jitterRange: [0.5, 1.5],
    userGuidance: 'An unexpected error occurred. The request will retry automatically.',
  },
};

/**
 * Error classifier
 */
export class ErrorClassifier {
  /**
   * Classify error based on status code and error object
   */
  static classify(error: unknown, provider?: ProviderType): ErrorType {
    // Handle cancellation
    if ((error as any).name === 'AbortError' || (error as any).code === 'CANCELLED') {
      return ErrorType.CANCELLED;
    }

    // Handle network errors
    if (
      (error as any).code === 'ECONNREFUSED' ||
      (error as any).code === 'ETIMEDOUT' ||
      (error as any).code === 'ENOTFOUND' ||
      (error as any).message?.includes('network') ||
      (error as any).message?.includes('fetch')
    ) {
      return ErrorType.NETWORK;
    }

    // Handle HTTP status codes
    const status =
      (error as any).status || (error as any).statusCode || (error as any).response?.status;
    if (status) {
      if (status === 401 || status === 403) {
        return ErrorType.AUTHENTICATION;
      }
      if (status === 429) {
        return ErrorType.RATE_LIMIT;
      }
      if (status === 400 || status === 422) {
        return ErrorType.VALIDATION;
      }
      if (status >= 500 && status < 600) {
        return ErrorType.SERVER;
      }
    }

    // Provider-specific error codes
    if (provider === 'openai') {
      if ((error as any).code === 'invalid_api_key') {
        return ErrorType.AUTHENTICATION;
      }
      if ((error as any).code === 'rate_limit_exceeded') {
        return ErrorType.RATE_LIMIT;
      }
      if ((error as any).code === 'context_length_exceeded') {
        return ErrorType.CONTEXT_EXCEEDED;
      }
    }

    if (provider === 'gemini') {
      if ((error as any).code === 'UNAUTHENTICATED') {
        return ErrorType.AUTHENTICATION;
      }
      if ((error as any).code === 'RESOURCE_EXHAUSTED') {
        return ErrorType.RATE_LIMIT;
      }
      if (
        (error as any).code === 'INVALID_ARGUMENT' &&
        (error as any).message?.includes('context')
      ) {
        return ErrorType.CONTEXT_EXCEEDED;
      }
    }

    return ErrorType.UNKNOWN;
  }

  /**
   * Get recovery strategy for error
   */
  static getRecoveryStrategy(errorType: ErrorType): RecoveryStrategy {
    return ERROR_RECOVERY_STRATEGIES[errorType];
  }

  /**
   * Calculate retry delay with exponential backoff and jitter
   */
  static calculateRetryDelay(
    attempt: number,
    strategy: RecoveryStrategy,
    baseDelay?: number
  ): number {
    if (!strategy.shouldRetry || attempt >= strategy.maxRetries) {
      return -1; // No retry
    }

    const base = baseDelay || strategy.retryAfter || 1000;
    const exponentialDelay = base * Math.pow(strategy.backoffMultiplier, attempt);

    // Apply jitter
    const [minJitter, maxJitter] = strategy.jitterRange;
    const jitter = minJitter + Math.random() * (maxJitter - minJitter);

    return Math.floor(exponentialDelay * jitter);
  }

  /**
   * Extract retry-after header value
   */
  static extractRetryAfter(headers: Headers | Record<string, string>): number | undefined {
    const retryAfter =
      headers instanceof Headers ? headers.get('retry-after') : headers['retry-after'];

    if (!retryAfter) return undefined;

    // Parse as seconds or HTTP date
    const seconds = parseInt(retryAfter, 10);
    if (!isNaN(seconds)) {
      return seconds * 1000; // Convert to milliseconds
    }

    // Try parsing as date
    const retryDate = new Date(retryAfter);
    if (!isNaN(retryDate.getTime())) {
      return Math.max(0, retryDate.getTime() - Date.now());
    }

    return undefined;
  }

  /**
   * Format error for user display
   */
  static formatUserError(error: ProviderError, errorType: ErrorType): string {
    const strategy = this.getRecoveryStrategy(errorType);
    let message = strategy.userGuidance;

    // Add specific error details if available
    if (error.message && errorType === ErrorType.VALIDATION) {
      message += ` Details: ${error.message}`;
    }

    // Add retry information
    if (strategy.shouldRetry && error.retryAfter) {
      const seconds = Math.ceil(error.retryAfter / 1000);
      message += ` Retrying in ${seconds} seconds...`;
    }

    return message;
  }
}

/**
 * Retry manager for handling retries with backoff
 */
export class RetryManager {
  private retryAttempts = new Map<string, number>();
  private retryTimers = new Map<string, NodeJS.Timeout>();

  /**
   * Execute with retry logic
   */
  async executeWithRetry<T>(
    key: string,
    fn: () => Promise<T>,
    provider?: ProviderType,
    onRetry?: (attempt: number, delay: number) => void
  ): Promise<T> {
    const attempt = this.retryAttempts.get(key) || 0;

    try {
      const result = await fn();
      this.retryAttempts.delete(key);
      return result;
    } catch (error) {
      const errorType = ErrorClassifier.classify(error, provider);
      const strategy = ErrorClassifier.getRecoveryStrategy(errorType);

      if (!strategy.shouldRetry || attempt >= strategy.maxRetries) {
        this.retryAttempts.delete(key);
        throw error;
      }

      const delay = ErrorClassifier.calculateRetryDelay(attempt, strategy);
      if (delay < 0) {
        this.retryAttempts.delete(key);
        throw error;
      }

      this.retryAttempts.set(key, attempt + 1);

      if (onRetry) {
        onRetry(attempt + 1, delay);
      }

      return new Promise((resolve, reject) => {
        const timer = setTimeout(async () => {
          this.retryTimers.delete(key);
          try {
            const result = await this.executeWithRetry(key, fn, provider, onRetry);
            resolve(result);
          } catch (err) {
            reject(err);
          }
        }, delay);

        this.retryTimers.set(key, timer);
      });
    }
  }

  /**
   * Cancel retry for a key
   */
  cancelRetry(key: string): void {
    const timer = this.retryTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.retryTimers.delete(key);
    }
    this.retryAttempts.delete(key);
  }

  /**
   * Clear all retries
   */
  clearAll(): void {
    for (const timer of this.retryTimers.values()) {
      clearTimeout(timer);
    }
    this.retryTimers.clear();
    this.retryAttempts.clear();
  }
}

// Export singleton instance
export const retryManager = new RetryManager();
