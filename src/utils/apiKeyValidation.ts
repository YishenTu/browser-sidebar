/**
 * @file API Key Validation Utilities
 * 
 * Comprehensive API key validation utilities providing format validation,
 * provider detection, live testing, batch processing, and security analysis
 * for multiple AI providers (OpenAI, Anthropic, Google, Custom).
 * 
 * Features:
 * - Format validation with provider-specific rules
 * - Live API testing with caching and rate limiting
 * - Batch processing for multiple keys
 * - Security analysis (entropy, exposed keys, recommendations)
 * - Key sanitization and normalization
 * - Custom validation rule creation
 * - Performance optimization with caching
 */

import type {
  APIProvider,
  APIKeyType,
  ValidationResult,
  ProviderValidationRule
} from '../types/apiKeys';

import {
  DEFAULT_KEY_TYPE_DETECTION,
  validateKeyFormat as baseValidateKeyFormat,
  detectProvider,
  maskAPIKey
} from '../types/apiKeys';

// =============================================================================
// Types and Interfaces
// =============================================================================

/**
 * Comprehensive validation result with additional metadata
 */
export interface ExtendedValidationResult extends ValidationResult {
  /** Format validation details */
  formatValidation: ValidationResult;
  /** Live API validation result */
  liveValidation?: LiveValidationResult;
  /** Security analysis warnings */
  securityWarnings: string[];
  /** Performance metadata */
  performance?: {
    formatValidationTime: number;
    liveValidationTime?: number;
    totalTime: number;
  };
  /** Security recommendations */
  recommendations?: string[];
  /** Whether result was served from cache */
  fromCache?: boolean;
}

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
 * Batch validation input
 */
export interface BatchValidationInput {
  /** API key to validate */
  key: string;
  /** Expected provider */
  provider: APIProvider;
  /** Optional key identifier for results */
  id?: string;
}

/**
 * Batch validation options
 */
export interface BatchValidationOptions {
  /** Maximum number of keys to process in parallel */
  concurrency?: number;
  /** Size of processing batches */
  batchSize?: number;
  /** Whether to include live API validation */
  includeLiveValidation?: boolean;
  /** Timeout for individual validations */
  timeout?: number;
  /** Whether to stop on first error */
  failFast?: boolean;
}

/**
 * Validation options for comprehensive validation
 */
export interface ValidationOptions {
  /** Whether to test against live API */
  testLive?: boolean;
  /** API call timeout in milliseconds */
  timeout?: number;
  /** Whether to check for known exposed keys */
  checkForExposedKeys?: boolean;
  /** Whether to analyze key entropy */
  checkEntropy?: boolean;
  /** Whether to provide security recommendations */
  provideRecommendations?: boolean;
  /** Whether to enable result caching */
  enableCache?: boolean;
  /** Whether to enforce rate limiting */
  enableRateLimit?: boolean;
}

/**
 * Live validation options
 */
export interface LiveValidationOptions {
  /** API call timeout in milliseconds */
  timeout?: number;
  /** Whether to enable result caching */
  enableCache?: boolean;
  /** Custom API endpoint override */
  customEndpoint?: string;
  /** Additional headers for API request */
  customHeaders?: Record<string, string>;
}

/**
 * Key information extracted from analysis
 */
export interface KeyInfo {
  /** Detected provider */
  provider: APIProvider;
  /** Key type/tier */
  keyType: APIKeyType;
  /** Key prefix */
  prefix: string;
  /** Masked version for display */
  maskedKey: string;
  /** Estimated tier based on format */
  estimatedTier: APIKeyType;
  /** Whether key has built-in checksum */
  hasChecksum: boolean;
  /** Estimated entropy level */
  entropy: number;
  /** Entropy classification */
  entropyLevel: 'low' | 'medium' | 'high';
  /** Key length */
  length: number;
  /** Character set analysis */
  characterSet: {
    hasLowercase: boolean;
    hasUppercase: boolean;
    hasNumbers: boolean;
    hasSpecialChars: boolean;
  };
}

/**
 * Custom validation rule configuration
 */
export interface CustomValidationConfig {
  /** Regular expression pattern for validation */
  pattern: RegExp;
  /** Minimum key length */
  minLength: number;
  /** Maximum key length */
  maxLength: number;
  /** Required prefix */
  requiredPrefix?: string;
  /** Human-readable description */
  description: string;
  /** Custom validation function */
  customValidator?: (key: string) => { isValid: boolean; errors: string[] };
}

// =============================================================================
// Constants and Configuration
// =============================================================================

/** API endpoints for live validation */
const LIVE_VALIDATION_ENDPOINTS = {
  openai: 'https://api.openai.com/v1/models',
  anthropic: 'https://api.anthropic.com/v1/ping', // Hypothetical ping endpoint
  google: 'https://generativelanguage.googleapis.com/v1beta/models',
  custom: null
} as const;

/** Rate limiting configuration */
const RATE_LIMIT_CONFIG = {
  maxRequestsPerMinute: 30,
  maxRequestsPerHour: 100,
  windowMs: 60 * 1000 // 1 minute
} as const;

/** Cache configuration */
const CACHE_CONFIG = {
  formatValidationTTL: 5 * 60 * 1000, // 5 minutes
  liveValidationTTL: 15 * 60 * 1000,  // 15 minutes
  maxCacheSize: 1000
} as const;

/** Default validation timeouts */
const DEFAULT_TIMEOUTS = {
  liveValidation: 10000, // 10 seconds
  batchValidation: 30000 // 30 seconds
} as const;

/** Known weak or exposed key patterns */
const WEAK_KEY_PATTERNS = [
  /^sk-0+$/,
  /^sk-1+$/,
  /^sk-test/i,
  /^sk-demo/i,
  /^sk-example/i,
  /^sk-1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKL$/
] as const;

// =============================================================================
// State Management
// =============================================================================

/** In-memory caches */
const caches = {
  formatValidation: new Map<string, { result: ValidationResult; timestamp: number }>(),
  liveValidation: new Map<string, { result: LiveValidationResult; timestamp: number }>(),
  keyInfo: new Map<string, { info: KeyInfo; timestamp: number }>()
};

/** Rate limiting tracker */
const rateLimiter = {
  requests: new Map<string, number[]>(),
  
  isRateLimited(key: string): boolean {
    const now = Date.now();
    const requests = this.requests.get(key) || [];
    
    // Remove expired entries
    const validRequests = requests.filter(time => now - time < RATE_LIMIT_CONFIG.windowMs);
    this.requests.set(key, validRequests);
    
    return validRequests.length >= RATE_LIMIT_CONFIG.maxRequestsPerMinute;
  },
  
  recordRequest(key: string): void {
    const requests = this.requests.get(key) || [];
    requests.push(Date.now());
    this.requests.set(key, requests);
  }
};

// =============================================================================
// Core Validation Functions
// =============================================================================

/**
 * Comprehensive API key validation with all features
 */
export async function validateAPIKey(
  key: string,
  provider: APIProvider,
  options: ValidationOptions = {}
): Promise<ExtendedValidationResult> {
  const startTime = performance.now();
  
  // Input validation
  if (!key || typeof key !== 'string') {
    return createFailureResult('Invalid key input', startTime);
  }
  
  if (!isValidProvider(provider)) {
    return createFailureResult('Invalid provider', startTime);
  }

  // Rate limiting check
  if (options.enableRateLimit) {
    const rateLimitKey = `${provider}:${hashKey(key)}`;
    if (rateLimiter.isRateLimited(rateLimitKey)) {
      return createFailureResult('Rate limit exceeded', startTime);
    }
    rateLimiter.recordRequest(rateLimitKey);
  }

  try {
    // Sanitize key first
    const sanitizedKey = sanitizeAPIKey(key);
    if (!sanitizedKey) {
      return createFailureResult('Key is empty after sanitization', startTime);
    }

    // Format validation
    const formatValidationStart = performance.now();
    const formatValidation = validateKeyFormat(sanitizedKey, provider);
    const formatValidationTime = performance.now() - formatValidationStart;

    // Initialize result
    const result: ExtendedValidationResult = {
      isValid: formatValidation.isValid,
      errors: [...formatValidation.errors],
      warnings: [...formatValidation.warnings],
      provider: formatValidation.provider,
      keyType: formatValidation.keyType,
      estimatedTier: formatValidation.estimatedTier,
      formatValidation,
      securityWarnings: [],
      performance: {
        formatValidationTime,
        totalTime: 0 // Will be set at the end
      }
    };

    // Security analysis
    if (options.checkEntropy) {
      const entropyWarnings = analyzeKeyEntropy(sanitizedKey);
      result.securityWarnings.push(...entropyWarnings);
    }

    if (options.checkForExposedKeys) {
      const exposedWarnings = checkForExposedKeys(sanitizedKey);
      result.securityWarnings.push(...exposedWarnings);
    }

    // Live validation
    if (options.testLive && formatValidation.isValid) {
      const liveValidationStart = performance.now();
      result.liveValidation = await validateKeyLive(sanitizedKey, provider, {
        timeout: options.timeout,
        enableCache: options.enableCache
      });
      result.performance!.liveValidationTime = performance.now() - liveValidationStart;
      
      // Update overall validity based on live test
      if (!result.liveValidation.isValid) {
        result.isValid = false;
        result.errors.push(`Live validation failed: ${result.liveValidation.error || 'Unknown error'}`);
      }
    }

    // Security recommendations
    if (options.provideRecommendations) {
      result.recommendations = generateSecurityRecommendations(sanitizedKey, provider, result);
    }

    // Finalize timing
    result.performance!.totalTime = performance.now() - startTime;

    return result;

  } catch (error) {
    return createFailureResult(
      `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      startTime
    );
  }
}

/**
 * Enhanced format validation with caching
 */
export function validateKeyFormat(key: string, provider: APIProvider): ValidationResult {
  // Check cache first
  const cacheKey = `${provider}:${key}`;
  const cached = caches.formatValidation.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_CONFIG.formatValidationTTL) {
    return { ...cached.result, fromCache: true };
  }

  // Perform validation
  const result = baseValidateKeyFormat(key, provider);
  
  // Cache result (don't include fromCache in cached result)
  caches.formatValidation.set(cacheKey, {
    result: { ...result },
    timestamp: Date.now()
  });

  // Clean cache if it gets too large
  if (caches.formatValidation.size > CACHE_CONFIG.maxCacheSize) {
    cleanCache(caches.formatValidation, CACHE_CONFIG.maxCacheSize * 0.8);
  }

  // Don't set fromCache on first call
  return result;
}

/**
 * Live API key validation
 */
export async function validateKeyLive(
  key: string,
  provider: APIProvider,
  options: LiveValidationOptions = {}
): Promise<LiveValidationResult> {
  const timeout = options.timeout || DEFAULT_TIMEOUTS.liveValidation;
  const endpoint = options.customEndpoint || LIVE_VALIDATION_ENDPOINTS[provider];
  
  if (!endpoint) {
    return {
      isValid: false,
      responseTime: 0,
      error: `Live validation not supported for provider: ${provider}`,
      endpoint: 'none'
    };
  }

  // Check cache
  if (options.enableCache) {
    const cacheKey = `live:${provider}:${hashKey(key)}`;
    const cached = caches.liveValidation.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_CONFIG.liveValidationTTL) {
      return { ...cached.result, fromCache: true };
    }
  }

  const startTime = performance.now();
  
  try {
    const headers = createAPIHeaders(key, provider, options.customHeaders);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(endpoint, {
      method: 'GET',
      headers,
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const responseTime = performance.now() - startTime;

    const result: LiveValidationResult = {
      isValid: response.ok,
      responseTime,
      endpoint,
      statusCode: response.status,
      error: response.ok ? undefined : `${response.status} ${response.statusText}`,
      metadata: {
        contentType: response.headers.get('content-type'),
        server: response.headers.get('server')
      }
    };

    // Cache successful results
    if (options.enableCache && response.ok) {
      const cacheKey = `live:${provider}:${hashKey(key)}`;
      caches.liveValidation.set(cacheKey, {
        result: { ...result },
        timestamp: Date.now()
      });
    }

    return result;

  } catch (error) {
    const responseTime = performance.now() - startTime;
    
    let errorMessage = 'Unknown error';
    if (error instanceof Error) {
      if (error.name === 'AbortError' || error.message.includes('aborted')) {
        errorMessage = 'Request timeout';
      } else {
        errorMessage = error.message;
      }
    }

    return {
      isValid: false,
      responseTime,
      error: errorMessage,
      endpoint
    };
  }
}

/**
 * Batch validation of multiple API keys
 */
export async function batchValidateKeys(
  keys: BatchValidationInput[],
  options: BatchValidationOptions = {}
): Promise<ExtendedValidationResult[]> {
  const {
    concurrency = 5,
    batchSize = 10,
    includeLiveValidation = false,
    timeout = DEFAULT_TIMEOUTS.batchValidation,
    failFast = false
  } = options;

  const results: ExtendedValidationResult[] = [];
  const batches = chunkArray(keys, batchSize);

  for (const batch of batches) {
    const batchPromises = batch.map(async (input) => {
      try {
        const validationOptions: ValidationOptions = {
          testLive: includeLiveValidation,
          timeout,
          enableCache: true,
          enableRateLimit: true
        };

        return await validateAPIKey(input.key, input.provider, validationOptions);
      } catch (error) {
        return createFailureResult(
          `Batch validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          0
        );
      }
    });

    // Process batch with concurrency limit
    const batchResults = await limitConcurrency(batchPromises, concurrency);
    
    results.push(...batchResults);

    // Fail fast if requested and we have failures
    if (failFast && batchResults.some(r => !r.isValid)) {
      break;
    }

    // Small delay between batches to prevent overwhelming APIs
    if (batches.indexOf(batch) < batches.length - 1) {
      await sleep(100);
    }
  }

  return results;
}

// =============================================================================
// Key Processing Utilities
// =============================================================================

/**
 * Sanitize API key by removing whitespace and formatting
 */
export function sanitizeAPIKey(key: string): string {
  if (typeof key !== 'string') {
    return '';
  }

  return key
    .replace(/\s+/g, '') // Remove all whitespace including non-breaking spaces
    .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, '') // Unicode whitespace
    .trim();
}

/**
 * Normalize API key format for consistency
 */
export function normalizeAPIKey(key: string, provider: APIProvider): string {
  const sanitized = sanitizeAPIKey(key);
  
  switch (provider) {
    case 'openai': {
      // Convert underscores to hyphens, ensure lowercase prefix
      let normalized = sanitized.replace(/_/g, '-');
      if (normalized.toUpperCase().startsWith('SK-') || normalized.toUpperCase().startsWith('SK_')) {
        const separatorIndex = Math.max(normalized.indexOf('-'), normalized.indexOf('_'));
        if (separatorIndex > 0) {
          return 'sk-' + normalized.slice(separatorIndex + 1);
        } else {
          return 'sk-' + normalized.slice(2);
        }
      }
      return normalized;
    }
      
    case 'anthropic':
      // Ensure lowercase prefix
      if (sanitized.toUpperCase().startsWith('SK-ANT')) {
        return 'sk-ant-' + sanitized.slice(sanitized.indexOf('ant-') + 4);
      }
      return sanitized;
      
    case 'google':
      // Google keys have specific case requirements
      if (sanitized.toLowerCase().startsWith('aiza')) {
        return 'AIza' + sanitized.slice(4);
      }
      return sanitized;
      
    case 'custom':
      // No normalization for custom keys
      return sanitized;
      
    default:
      return sanitized;
  }
}

/**
 * Extract metadata and information from API key
 */
export function extractKeyInfo(key: string): KeyInfo {
  const sanitized = sanitizeAPIKey(key);
  const cacheKey = `info:${sanitized}`;
  
  // Check cache
  const cached = caches.keyInfo.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_CONFIG.formatValidationTTL) {
    return cached.info;
  }

  const provider = detectProvider(sanitized) || 'custom';
  const keyType = DEFAULT_KEY_TYPE_DETECTION[provider](sanitized);
  const maskedKey = maskAPIKey(sanitized);
  
  // Analyze character set
  const characterSet = {
    hasLowercase: /[a-z]/.test(sanitized),
    hasUppercase: /[A-Z]/.test(sanitized),
    hasNumbers: /[0-9]/.test(sanitized),
    hasSpecialChars: /[^a-zA-Z0-9]/.test(sanitized)
  };

  // Calculate entropy
  const entropy = calculateEntropy(sanitized);
  const entropyLevel: 'low' | 'medium' | 'high' = 
    entropy < 3 ? 'low' : entropy < 4 ? 'medium' : 'high';

  // Extract prefix
  let prefix = '';
  if (provider === 'openai') prefix = 'sk-';
  else if (provider === 'anthropic') prefix = 'sk-ant-';
  else if (provider === 'google') prefix = 'AIza';

  const info: KeyInfo = {
    provider,
    keyType,
    prefix,
    maskedKey,
    estimatedTier: keyType,
    hasChecksum: false, // Most providers don't use checksums in keys
    entropy,
    entropyLevel,
    length: sanitized.length,
    characterSet
  };

  // Cache result
  caches.keyInfo.set(cacheKey, {
    info,
    timestamp: Date.now()
  });

  return info;
}

/**
 * Create custom validation rules
 */
export function createCustomValidationRules(config: CustomValidationConfig): ProviderValidationRule {
  return {
    pattern: config.pattern,
    minLength: config.minLength,
    maxLength: config.maxLength,
    requiredPrefix: config.requiredPrefix,
    description: config.description
  };
}

// =============================================================================
// Security Analysis Functions
// =============================================================================

/**
 * Analyze key entropy and detect weak keys
 */
function analyzeKeyEntropy(key: string): string[] {
  const warnings: string[] = [];
  const entropy = calculateEntropy(key);
  
  if (entropy < 3) {
    warnings.push('Key has low entropy and may be weak or predictable');
  }
  
  // Check for repeating patterns
  if (/(.{3,})\1{2,}/.test(key)) {
    warnings.push('Key contains repeating patterns which reduces security');
  }
  
  // Check for sequential patterns
  if (/(?:abc|123|xyz|789){3,}/i.test(key)) {
    warnings.push('Key contains sequential patterns which reduces security');
  }

  return warnings;
}

/**
 * Check for known exposed or weak keys
 */
function checkForExposedKeys(key: string): string[] {
  const warnings: string[] = [];
  
  for (const pattern of WEAK_KEY_PATTERNS) {
    if (pattern.test(key)) {
      warnings.push('Key matches a known weak or test key pattern');
      break;
    }
  }
  
  // Check for common test values
  const testPatterns = ['test', 'demo', 'example', 'sample'];
  for (const pattern of testPatterns) {
    if (key.toLowerCase().includes(pattern)) {
      warnings.push(`Key contains "${pattern}" which suggests it may be a test key`);
    }
  }

  return warnings;
}

/**
 * Generate security recommendations
 */
function generateSecurityRecommendations(
  key: string,
  provider: APIProvider,
  validation: ExtendedValidationResult
): string[] {
  const recommendations: string[] = [];

  // General recommendations
  recommendations.push('Store API keys securely using encryption');
  recommendations.push('Use environment variables or secure vaults for production');
  recommendations.push('Regularly rotate API keys');
  recommendations.push('Monitor API key usage for unusual activity');

  // Provider-specific recommendations
  switch (provider) {
    case 'openai':
      recommendations.push('Consider using OpenAI organization-level keys for team access');
      recommendations.push('Set usage limits in your OpenAI dashboard');
      break;
    case 'anthropic':
      recommendations.push('Monitor token usage to avoid unexpected charges');
      break;
    case 'google':
      recommendations.push('Restrict API key usage by IP address when possible');
      break;
  }

  // Security-based recommendations
  if (validation.securityWarnings.length > 0) {
    recommendations.push('Generate a new API key to address security concerns');
  }

  return recommendations;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Calculate Shannon entropy of a string
 */
function calculateEntropy(str: string): number {
  const frequencies = new Map<string, number>();
  
  for (const char of str) {
    frequencies.set(char, (frequencies.get(char) || 0) + 1);
  }
  
  let entropy = 0;
  const length = str.length;
  
  for (const freq of frequencies.values()) {
    const probability = freq / length;
    entropy -= probability * Math.log2(probability);
  }
  
  return entropy;
}

/**
 * Create API headers for different providers
 */
function createAPIHeaders(
  key: string,
  provider: APIProvider,
  customHeaders: Record<string, string> = {}
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'API-Key-Validator/1.0',
    ...customHeaders
  };

  switch (provider) {
    case 'openai':
      headers['Authorization'] = `Bearer ${key}`;
      break;
    case 'anthropic':
      headers['x-api-key'] = key;
      headers['anthropic-version'] = '2023-06-01';
      break;
    case 'google':
      headers['Authorization'] = `Bearer ${key}`;
      break;
  }

  return headers;
}

/**
 * Create a failure result
 */
function createFailureResult(error: string, startTime: number): ExtendedValidationResult {
  return {
    isValid: false,
    errors: [error],
    warnings: [],
    formatValidation: {
      isValid: false,
      errors: [error],
      warnings: []
    },
    securityWarnings: [],
    performance: {
      formatValidationTime: 0,
      totalTime: performance.now() - startTime
    }
  };
}

/**
 * Check if provider is valid
 */
function isValidProvider(provider: string): provider is APIProvider {
  return ['openai', 'anthropic', 'google', 'custom'].includes(provider);
}

/**
 * Create a simple hash of a key for caching
 */
function hashKey(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

/**
 * Split array into chunks
 */
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Limit concurrency of promises
 */
async function limitConcurrency<T>(promises: Promise<T>[], limit: number): Promise<T[]> {
  const results: T[] = new Array(promises.length);
  const executing = new Set<Promise<any>>();

  for (let i = 0; i < promises.length; i++) {
    const promise = promises[i].then((result) => {
      results[i] = result;
      executing.delete(wrappedPromise);
      return result;
    });

    const wrappedPromise = promise;
    executing.add(wrappedPromise);

    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
  return results;
}

/**
 * Sleep for a specified number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Clean cache by removing oldest entries
 */
function cleanCache<T>(cache: Map<string, T>, targetSize: number): void {
  const entries = Array.from(cache.entries());
  const toDelete = entries.length - targetSize;
  
  if (toDelete > 0) {
    // Remove oldest entries (simple FIFO, could be improved with LRU)
    for (let i = 0; i < toDelete; i++) {
      cache.delete(entries[i][0]);
    }
  }
}

// =============================================================================
// Cache Management
// =============================================================================

/**
 * Clear all validation caches
 */
export function clearValidationCache(): void {
  caches.formatValidation.clear();
  caches.liveValidation.clear();
  caches.keyInfo.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    formatValidation: {
      size: caches.formatValidation.size,
      maxSize: CACHE_CONFIG.maxCacheSize
    },
    liveValidation: {
      size: caches.liveValidation.size,
      maxSize: CACHE_CONFIG.maxCacheSize
    },
    keyInfo: {
      size: caches.keyInfo.size,
      maxSize: CACHE_CONFIG.maxCacheSize
    }
  };
}