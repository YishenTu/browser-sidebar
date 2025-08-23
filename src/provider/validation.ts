/**
 * @file API Key Validation Service
 *
 * Service for validating AI provider API keys with live testing capabilities.
 * Supports OpenAI and Gemini providers with comprehensive validation
 * through live API testing and error handling.
 *
 * Features:
 * - Live API validation with minimal test calls
 * - Comprehensive error handling and network timeout support
 * - Caching for performance
 * - Batch validation with concurrency control
 * - Clear validation results with detailed error messages
 */

import type { ProviderType } from '../types/providers';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Live validation result from API testing
 */
export interface LiveValidationResult {
  /** Whether the key is valid according to the API */
  isValid: boolean;
  /** API response time in milliseconds */
  responseTime: number;
  /** Error message if validation failed */
  error?: string;
  /** API endpoint used for testing */
  endpoint: string;
  /** HTTP status code from API response */
  statusCode?: number;
  /** Additional metadata from API response */
  metadata?: Record<string, unknown>;
}

/**
 * Validation result with comprehensive information
 */
export interface ValidationResult {
  /** Whether the API key is valid */
  isValid: boolean;
  /** Provider type */
  provider: ProviderType;
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings: string[];
  /** Live API validation result */
  liveValidation?: LiveValidationResult;
  /** Performance metrics */
  performance?: {
    totalTime: number;
    liveValidationTime?: number;
  };
  /** Whether result was served from cache */
  fromCache?: boolean;
}

/**
 * Validation options
 */
export interface ValidationOptions {
  /** Skip live API validation */
  skipLiveValidation?: boolean;
  /** API call timeout in milliseconds */
  timeout?: number;
  /** Enable result caching */
  enableCache?: boolean;
}

/**
 * Batch validation input
 */
export interface BatchValidationInput {
  /** API key to validate */
  key: string;
  /** Provider type */
  provider: ProviderType;
  /** Optional identifier */
  id?: string;
}

/**
 * Batch validation options
 */
export interface BatchValidationOptions {
  /** Maximum concurrent validations */
  concurrency?: number;
  /** Skip live validation for all keys */
  skipLiveValidation?: boolean;
  /** Timeout for individual validations */
  timeout?: number;
}

/**
 * Service configuration
 */
export interface ValidationServiceConfig {
  /** Default timeout for API calls */
  timeout?: number;
  /** Enable caching */
  enableCache?: boolean;
  /** Cache TTL in milliseconds */
  cacheTTL?: number;
  /** Maximum cache size */
  maxCacheSize?: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Default configuration */
const DEFAULT_CONFIG: Required<ValidationServiceConfig> = {
  timeout: 10000, // 10 seconds
  enableCache: true,
  cacheTTL: 5 * 60 * 1000, // 5 minutes
  maxCacheSize: 1000,
};

/** API endpoints for live validation */
const VALIDATION_ENDPOINTS = {
  openai: 'https://api.openai.com/v1/models',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/models',
} as const;


// ============================================================================
// Cache Implementation
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class ValidationCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private maxSize: number;
  private ttl: number;

  constructor(maxSize: number, ttl: number) {
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.data;
  }

  set(key: string, data: T): void {
    // Clean expired entries and enforce size limit
    this.cleanup();

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  private cleanup(): void {
    const now = Date.now();

    // Remove expired entries
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key);
      }
    }

    // Enforce size limit (simple FIFO)
    if (this.cache.size >= this.maxSize) {
      const entries = Array.from(this.cache.entries());
      const toDelete = Math.ceil(this.maxSize * 0.2); // Delete 20% oldest

      for (let i = 0; i < toDelete && i < entries.length; i++) {
        this.cache.delete(entries[i]![0]);
      }
    }
  }
}

// ============================================================================
// API Key Validation Service
// ============================================================================

/**
 * API Key Validation Service for AI providers
 */
export class APIKeyValidationService {
  private config: Required<ValidationServiceConfig>;
  private cache: ValidationCache<ValidationResult>;

  constructor(config: ValidationServiceConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cache = new ValidationCache(this.config.maxCacheSize, this.config.cacheTTL);
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Validate a single API key
   */
  async validateAPIKey(
    key: string,
    provider: ProviderType,
    options: ValidationOptions = {}
  ): Promise<ValidationResult> {
    const startTime = performance.now();

    try {
      // Input validation
      const inputValidation = this.validateInput(key, provider);
      if (!inputValidation.isValid) {
        return {
          ...inputValidation,
          performance: {
            totalTime: performance.now() - startTime,
          },
        };
      }

      // Check cache
      const cacheKey = this.getCacheKey(key, provider);
      if (this.config.enableCache && options.enableCache !== false) {
        const cached = this.cache.get(cacheKey);
        if (cached) {
          return {
            ...cached,
            fromCache: true,
            performance: {
              totalTime: performance.now() - startTime,
            },
          };
        }
      }

      // Initialize base validation result
      const baseValidation: ValidationResult = {
        isValid: true,
        provider,
        errors: [],
        warnings: [],
      };

      // Live validation (if not skipped)
      let liveValidation: LiveValidationResult | undefined;
      if (!options.skipLiveValidation) {
        const liveStartTime = performance.now();
        try {
          liveValidation = await this.validateKeyLive(key, provider, options);

          if (!liveValidation.isValid) {
            baseValidation.isValid = false;
            baseValidation.errors.push(`Live validation failed: ${liveValidation.error}`);
          }
        } catch (error) {
          // Handle provider creation failures
          baseValidation.isValid = false;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          if (errorMessage.includes('Failed to create provider')) {
            baseValidation.errors.push(errorMessage);
          } else {
            baseValidation.errors.push(`Live validation failed: ${errorMessage}`);
          }
        }

        baseValidation.performance = {
          totalTime: performance.now() - startTime,
          liveValidationTime: performance.now() - liveStartTime,
        };
      } else {
        baseValidation.warnings.push('Live validation was skipped');
        baseValidation.performance = {
          totalTime: performance.now() - startTime,
        };
      }

      const result: ValidationResult = {
        ...baseValidation,
        liveValidation,
      };

      // Cache result
      this.cache.set(cacheKey, result);
      return result;
    } catch (error) {
      return {
        isValid: false,
        provider,
        errors: [`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings: [],
        performance: {
          totalTime: performance.now() - startTime,
        },
      };
    }
  }

  /**
   * Validate multiple API keys
   */
  async validateAPIKeys(
    keys: BatchValidationInput[],
    options: BatchValidationOptions = {}
  ): Promise<ValidationResult[]> {
    const { concurrency = 5 } = options;

    const validationPromises = keys.map(({ key, provider }) =>
      this.validateAPIKey(key, provider, {
        skipLiveValidation: options.skipLiveValidation,
        timeout: options.timeout,
      }).catch(error => ({
        isValid: false,
        provider,
        errors: [
          `Batch validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ],
        warnings: [],
      }))
    );

    return this.limitConcurrency(validationPromises, concurrency);
  }

  /**
   * Clear validation cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size(),
      maxSize: this.config.maxCacheSize,
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Validate input parameters
   */
  private validateInput(key: string, provider: ProviderType): ValidationResult {
    const errors: string[] = [];

    if (key === null || key === undefined) {
      errors.push('API key must be a string');
    } else if (typeof key !== 'string') {
      errors.push('API key must be a string');
    } else if (key.trim() === '') {
      errors.push('API key cannot be empty');
    }

    if (!this.isValidProvider(provider)) {
      errors.push(`Unsupported provider type: ${provider}`);
    }

    return {
      isValid: errors.length === 0,
      provider,
      errors,
      warnings: [],
    };
  }


  /**
   * Validate API key with live API call
   */
  private async validateKeyLive(
    key: string,
    provider: ProviderType,
    options: ValidationOptions = {}
  ): Promise<LiveValidationResult> {
    const timeout = options.timeout || this.config.timeout;
    const startTime = performance.now();
    let endpoint: string = '';

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      let response: Response;

      // Use different validation methods for different providers
      if (provider === 'openai') {
        // For OpenAI, make a minimal chat completion request
        endpoint = 'https://api.openai.com/v1/chat/completions';
        response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo', // Using stable model for API key validation only
            messages: [{ role: 'user', content: 'Hi' }],
            max_tokens: 1,
            temperature: 0,
          }),
          signal: controller.signal,
        });
      } else if (provider === 'gemini') {
        // For Gemini, list models endpoint works fine
        endpoint = `${VALIDATION_ENDPOINTS[provider]}?key=${key}`;
        response = await fetch(endpoint, {
          method: 'GET',
          signal: controller.signal,
        });
      } else {
        throw new Error(`Unsupported provider: ${provider}`);
      }

      clearTimeout(timeoutId);
      const responseTime = performance.now() - startTime;

      // Handle response
      if (response.ok) {
        // Additional validation for malformed JSON
        try {
          await response.clone().json();
        } catch (jsonError) {
          return {
            isValid: false,
            responseTime,
            endpoint,
            statusCode: response.status,
            error: 'Invalid JSON response',
          };
        }

        return {
          isValid: true,
          responseTime,
          endpoint,
          statusCode: response.status,
          metadata: {
            contentType: response.headers.get('content-type'),
          },
        };
      } else {
        let errorMessage = `${response.status} ${response.statusText}`;

        try {
          const errorData = await response.json();
          if (errorData.error?.message) {
            errorMessage = errorData.error.message;
          } else if (errorData.error) {
            errorMessage = String(errorData.error);
          }
        } catch {
          // Use status text if JSON parsing fails
        }

        return {
          isValid: false,
          responseTime,
          endpoint,
          statusCode: response.status,
          error: errorMessage,
        };
      }
    } catch (error) {
      const responseTime = performance.now() - startTime;

      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = 'Request timeout';
        } else if (error.message.includes('aborted')) {
          errorMessage = 'Request timeout';
        } else {
          errorMessage = error.message;
        }
      }

      return {
        isValid: false,
        responseTime,
        endpoint: endpoint || VALIDATION_ENDPOINTS[provider as keyof typeof VALIDATION_ENDPOINTS] || '',
        error: errorMessage,
      };
    }
  }



  /**
   * Get cache key for a validation request
   */
  private getCacheKey(key: string, provider: ProviderType): string {
    // Use hash of key for privacy
    return `${provider}:${this.hashString(key)}`;
  }

  /**
   * Simple string hash function
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Check if provider type is valid
   */
  private isValidProvider(provider: string): provider is ProviderType {
    return ['openai', 'gemini'].includes(provider);
  }


  /**
   * Limit concurrency of promises
   */
  private async limitConcurrency<T>(promises: Promise<T>[], limit: number): Promise<T[]> {
    const results: T[] = new Array(promises.length);
    const executing = new Set<Promise<unknown>>();

    for (let i = 0; i < promises.length; i++) {
      const promise = promises[i]!;
      const wrappedPromise = promise.then(result => {
        results[i] = result;
        executing.delete(wrappedPromise);
        return result;
      });

      executing.add(wrappedPromise);

      if (executing.size >= limit) {
        await Promise.race(executing);
      }
    }

    await Promise.all(executing);
    return results;
  }
}
