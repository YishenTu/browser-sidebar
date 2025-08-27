/**
 * @file API Key Validation Service Tests
 *
 * Comprehensive test suite for the API Key Validation Service following TDD methodology.
 * Tests validation for OpenAI and Gemini providers with mock API calls.
 *
 * Test Coverage:
 * - Format validation for all providers
 * - Live API validation with mocked calls
 * - Error handling and network failures
 * - Clear validation results and error messages
 * - Provider-specific validation logic
 * - Rate limiting and caching behavior
 */

import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import {
  APIKeyValidationService,
  type ValidationResult,
  type LiveValidationResult,
} from '../../src/provider/validation';
import { ProviderFactory } from '../../src/provider/ProviderFactory';
import type { ProviderType, OpenAIConfig, GeminiConfig } from '../../src/types/providers';

// ============================================================================
// Mock Setup
// ============================================================================

// Mock fetch for API calls
const mockFetch = vi.fn() as MockedFunction<typeof fetch>;
global.fetch = mockFetch;

// Mock ProviderFactory
vi.mock('../../src/provider/ProviderFactory');
const MockedProviderFactory = vi.mocked(ProviderFactory);

// Mock provider instances
const mockOpenAIProvider = {
  type: 'openai' as const,
  testConnection: vi.fn(),
};

const mockGeminiProvider = {
  type: 'gemini' as const,
  testConnection: vi.fn(),
};

// OpenRouter removed (not in scope)

// ============================================================================
// Test Data
// ============================================================================

const VALID_OPENAI_KEY = 'sk-1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKL';
const VALID_GEMINI_KEY = 'AIzaSyDaGmWKa4JsXZ-HjGw1p2q3r4s5t6u7v8w9x0y1z2';

const INVALID_OPENAI_KEY = 'invalid-openai-key';
const INVALID_GEMINI_KEY = 'invalid-gemini-key';

const MOCK_OPENAI_CONFIG: OpenAIConfig = {
  apiKey: VALID_OPENAI_KEY,
  temperature: 0.7,
  reasoningEffort: 'medium',
  model: 'gpt-5-nano',
  maxTokens: 4096,
  topP: 1.0,
  frequencyPenalty: 0.0,
  presencePenalty: 0.0,
};

const MOCK_GEMINI_CONFIG: GeminiConfig = {
  apiKey: VALID_GEMINI_KEY,
  temperature: 0.7,
  thinkingMode: 'dynamic',
  showThoughts: true,
  model: 'gemini-2.0-flash-thinking-exp',
  maxTokens: 8192,
  topP: 0.95,
  topK: 40,
};

// OpenRouter config removed

// ============================================================================
// Test Suite
// ============================================================================

describe('APIKeyValidationService', () => {
  let validationService: APIKeyValidationService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset fetch mock
    mockFetch.mockReset();

    // Setup ProviderFactory mocks
    MockedProviderFactory.prototype.createOpenAIProvider = vi.fn();
    MockedProviderFactory.prototype.createGeminiProvider = vi.fn();
    // OpenRouter provider creation removed

    validationService = new APIKeyValidationService();
  });

  // ============================================================================
  // Constructor and Initialization Tests
  // ============================================================================

  describe('Constructor', () => {
    it('should create instance with default configuration', () => {
      expect(validationService).toBeInstanceOf(APIKeyValidationService);
    });

    it('should initialize with custom timeout', () => {
      const customService = new APIKeyValidationService({ timeout: 5000 });
      expect(customService).toBeInstanceOf(APIKeyValidationService);
    });

    it('should initialize with cache disabled', () => {
      const customService = new APIKeyValidationService({ enableCache: false });
      expect(customService).toBeInstanceOf(APIKeyValidationService);
    });
  });

  // ============================================================================
  // OpenAI Validation Tests
  // ============================================================================

  describe('OpenAI Validation', () => {
    beforeEach(() => {
      MockedProviderFactory.prototype.createOpenAIProvider.mockResolvedValue(mockOpenAIProvider);
    });

    it('should validate valid OpenAI API key successfully', async () => {
      // Mock successful API response
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [{ id: 'gpt-5-nano' }] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      );
      mockOpenAIProvider.testConnection.mockResolvedValue(true);

      const result = await validationService.validateAPIKey(VALID_OPENAI_KEY, 'openai');

      expect(result.isValid).toBe(true);
      expect(result.provider).toBe('openai');
      expect(result.errors).toHaveLength(0);
      expect(result.liveValidation?.isValid).toBe(true);
      expect(result.liveValidation?.responseTime).toBeGreaterThan(0);
    });

    it('should reject invalid OpenAI API key format', async () => {
      const result = await validationService.validateAPIKey(INVALID_OPENAI_KEY, 'openai');

      expect(result.isValid).toBe(false);
      expect(result.provider).toBe('openai');
      expect(result.errors).toContain('Invalid OpenAI API key format');
      expect(result.liveValidation).toBeUndefined();
    });

    it('should handle OpenAI API authentication error', async () => {
      // Mock authentication error
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              message: 'Invalid API key',
              type: 'invalid_request_error',
              code: 'invalid_api_key',
            },
          }),
          { status: 401, headers: { 'content-type': 'application/json' } }
        )
      );
      mockOpenAIProvider.testConnection.mockResolvedValue(false);

      const result = await validationService.validateAPIKey(VALID_OPENAI_KEY, 'openai');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Live validation failed: Invalid API key');
      expect(result.liveValidation?.isValid).toBe(false);
      expect(result.liveValidation?.statusCode).toBe(401);
    });

    it('should handle OpenAI API rate limit error', async () => {
      // Mock rate limit error
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              message: 'Rate limit exceeded',
              type: 'rate_limit_error',
            },
          }),
          {
            status: 429,
            headers: {
              'content-type': 'application/json',
              'retry-after': '60',
            },
          }
        )
      );

      const result = await validationService.validateAPIKey(VALID_OPENAI_KEY, 'openai');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Live validation failed: Rate limit exceeded');
      expect(result.liveValidation?.statusCode).toBe(429);
    });

    it('should handle OpenAI API network error', async () => {
      // Mock network error
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await validationService.validateAPIKey(VALID_OPENAI_KEY, 'openai');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Live validation failed: Network error');
      expect(result.liveValidation?.isValid).toBe(false);
    });

    it('should handle OpenAI API timeout', async () => {
      // Mock timeout
      mockFetch.mockImplementationOnce(
        () =>
          new Promise((_, reject) => setTimeout(() => reject(new Error('Request timeout')), 100))
      );

      const result = await validationService.validateAPIKey(VALID_OPENAI_KEY, 'openai', {
        timeout: 50,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Live validation failed: Request timeout');
    });
  });

  // ============================================================================
  // Gemini Validation Tests
  // ============================================================================

  describe('Gemini Validation', () => {
    beforeEach(() => {
      MockedProviderFactory.prototype.createGeminiProvider.mockResolvedValue(mockGeminiProvider);
    });

    it('should validate valid Gemini API key successfully', async () => {
      // Mock successful API response
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ models: [{ name: 'models/gemini-2.0-flash-thinking-exp' }] }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      );
      mockGeminiProvider.testConnection.mockResolvedValue(true);

      const result = await validationService.validateAPIKey(VALID_GEMINI_KEY, 'gemini');

      expect(result.isValid).toBe(true);
      expect(result.provider).toBe('gemini');
      expect(result.errors).toHaveLength(0);
      expect(result.liveValidation?.isValid).toBe(true);
    });

    it('should reject invalid Gemini API key format', async () => {
      const result = await validationService.validateAPIKey(INVALID_GEMINI_KEY, 'gemini');

      expect(result.isValid).toBe(false);
      expect(result.provider).toBe('gemini');
      expect(result.errors).toContain('Invalid Gemini API key format');
    });

    it('should handle Gemini API authentication error', async () => {
      // Mock authentication error
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              message: 'API key not valid',
              status: 'UNAUTHENTICATED',
            },
          }),
          { status: 403, headers: { 'content-type': 'application/json' } }
        )
      );
      mockGeminiProvider.testConnection.mockResolvedValue(false);

      const result = await validationService.validateAPIKey(VALID_GEMINI_KEY, 'gemini');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Live validation failed: API key not valid');
      expect(result.liveValidation?.statusCode).toBe(403);
    });

    it('should handle Gemini API quota exceeded error', async () => {
      // Mock quota exceeded error
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              message: 'Quota exceeded',
              status: 'RESOURCE_EXHAUSTED',
            },
          }),
          { status: 429, headers: { 'content-type': 'application/json' } }
        )
      );

      const result = await validationService.validateAPIKey(VALID_GEMINI_KEY, 'gemini');

      expect(result.isValid).toBe(false);
      expect(result.liveValidation?.statusCode).toBe(429);
    });
  });

  // OpenRouter validation tests removed

  // ============================================================================
  // Validation Options Tests
  // ============================================================================

  describe('Validation Options', () => {
    it('should skip live validation when disabled', async () => {
      const result = await validationService.validateAPIKey(VALID_OPENAI_KEY, 'openai', {
        skipLiveValidation: true,
      });

      expect(result.liveValidation).toBeUndefined();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should use custom timeout for validation', async () => {
      const shortTimeout = 50;

      // Mock a slow response that will timeout
      mockFetch.mockImplementationOnce(
        () =>
          new Promise((resolve, reject) => {
            setTimeout(() => {
              // Simulate AbortError
              const error = new Error('Request timeout');
              error.name = 'AbortError';
              reject(error);
            }, 100);
          })
      );

      const result = await validationService.validateAPIKey(VALID_OPENAI_KEY, 'openai', {
        timeout: shortTimeout,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Live validation failed: Request timeout');
    });

    it('should return cached results when cache is enabled', async () => {
      // First call
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [{ id: 'gpt-5-nano' }] }), { status: 200 })
      );

      await validationService.validateAPIKey(VALID_OPENAI_KEY, 'openai');

      // Second call should use cache
      const result = await validationService.validateAPIKey(VALID_OPENAI_KEY, 'openai');

      expect(result.fromCache).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1); // Only called once
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('Error Handling', () => {
    it('should handle empty API key', async () => {
      const result = await validationService.validateAPIKey('', 'openai');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('API key cannot be empty');
    });

    it('should handle null API key', async () => {
      const result = await validationService.validateAPIKey(null as any, 'openai');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('API key must be a string');
    });

    it('should handle invalid provider type', async () => {
      const result = await validationService.validateAPIKey(
        VALID_OPENAI_KEY,
        'invalid-provider' as any
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Unsupported provider type: invalid-provider');
    });

    it('should handle provider creation failure', async () => {
      // Mock provider factory to throw error during creation
      MockedProviderFactory.prototype.createOpenAIProvider.mockRejectedValue(
        new Error('Failed to create provider')
      );

      // Also mock fetch to fail to simulate complete validation failure
      mockFetch.mockRejectedValueOnce(new Error('Network unavailable'));

      const result = await validationService.validateAPIKey(VALID_OPENAI_KEY, 'openai');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Live validation failed: Network unavailable');
    });

    it('should handle malformed JSON response', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response('invalid json', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      );

      const result = await validationService.validateAPIKey(VALID_OPENAI_KEY, 'openai');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Live validation failed: Invalid JSON response');
    });
  });

  // ============================================================================
  // Batch Validation Tests
  // ============================================================================

  describe('Batch Validation', () => {
    it('should validate multiple keys successfully', async () => {
      const keys = [
        { key: VALID_OPENAI_KEY, provider: 'openai' as ProviderType },
        { key: VALID_GEMINI_KEY, provider: 'gemini' as ProviderType },
      ];

      // Mock successful responses for both
      mockFetch
        .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ models: [] }), { status: 200 }));

      const results = await validationService.validateAPIKeys(keys);

      expect(results).toHaveLength(2);
      expect(results[0]?.isValid).toBe(true);
      expect(results[0]?.provider).toBe('openai');
      expect(results[1]?.isValid).toBe(true);
      expect(results[1]?.provider).toBe('gemini');
    });

    it('should handle mixed validation results', async () => {
      const keys = [
        { key: VALID_OPENAI_KEY, provider: 'openai' as ProviderType },
        { key: INVALID_GEMINI_KEY, provider: 'gemini' as ProviderType },
      ];

      // Mock successful response for first, none needed for second (format invalid)
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }));

      const results = await validationService.validateAPIKeys(keys);

      expect(results).toHaveLength(2);
      expect(results[0]?.isValid).toBe(true);
      expect(results[1]?.isValid).toBe(false);
      expect(results[1]?.errors).toContain('Invalid Gemini API key format');
    });

    it('should respect concurrency limits', async () => {
      const keys = Array(10)
        .fill(null)
        .map((_, i) => ({
          key: `${VALID_OPENAI_KEY}-${i}`,
          provider: 'openai' as ProviderType,
        }));

      let concurrentCalls = 0;
      let maxConcurrentCalls = 0;

      mockFetch.mockImplementation(() => {
        concurrentCalls++;
        maxConcurrentCalls = Math.max(maxConcurrentCalls, concurrentCalls);

        return new Promise(resolve => {
          setTimeout(() => {
            concurrentCalls--;
            resolve(new Response(JSON.stringify({ data: [] }), { status: 200 }));
          }, 10);
        });
      });

      await validationService.validateAPIKeys(keys, { concurrency: 3 });

      expect(maxConcurrentCalls).toBeLessThanOrEqual(3);
    });
  });

  // ============================================================================
  // Performance Tests
  // ============================================================================

  describe('Performance', () => {
    it('should complete validation within reasonable time', async () => {
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }));

      const startTime = performance.now();
      await validationService.validateAPIKey(VALID_OPENAI_KEY, 'openai');
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should include performance metrics in result', async () => {
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }));

      const result = await validationService.validateAPIKey(VALID_OPENAI_KEY, 'openai');

      expect(result.performance).toBeDefined();
      expect(result.performance?.totalTime).toBeGreaterThan(0);
      expect(result.performance?.liveValidationTime).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Cache Management Tests
  // ============================================================================

  describe('Cache Management', () => {
    it('should clear cache when requested', async () => {
      // First validation
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }));
      await validationService.validateAPIKey(VALID_OPENAI_KEY, 'openai');

      // Clear cache
      validationService.clearCache();

      // Second validation should not use cache
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }));
      const result = await validationService.validateAPIKey(VALID_OPENAI_KEY, 'openai');

      expect(result.fromCache).toBeFalsy();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should provide cache statistics', () => {
      const stats = validationService.getCacheStats();

      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('maxSize');
      expect(typeof stats.size).toBe('number');
      expect(typeof stats.maxSize).toBe('number');
    });
  });
});
