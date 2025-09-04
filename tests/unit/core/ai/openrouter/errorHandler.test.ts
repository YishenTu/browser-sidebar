/**
 * @file OpenRouter Error Handler Unit Tests
 *
 * Comprehensive unit tests for the OpenRouter error handler,
 * covering error mapping, HTTP response handling, OpenRouter API errors,
 * retry delay calculation, and edge cases.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mapErrorToProviderError, getRetryDelay } from '@/core/ai/openrouter/errorHandler';
import type { ProviderError } from '@/types/providers';
import type { OpenRouterError } from '@/core/ai/openrouter/types';

// Mock Date for consistent timestamp testing
const mockDate = new Date('2024-01-01T00:00:00.000Z');

describe('OpenRouter Error Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('mapErrorToProviderError', () => {
    describe('Network Errors', () => {
      it('should handle fetch TypeError as network error', () => {
        const fetchError = new TypeError('fetch: network error occurred');
        const result = mapErrorToProviderError(fetchError);

        expect(result).toEqual({
          type: 'network',
          message: 'Network error: Unable to connect to OpenRouter',
          code: 'NETWORK_ERROR',
          provider: 'openrouter',
          details: {
            timestamp: mockDate,
          },
        });
      });

      it('should handle AbortError as network error', () => {
        const abortError = new Error('Request cancelled');
        abortError.name = 'AbortError';

        const result = mapErrorToProviderError(abortError);

        expect(result).toEqual({
          type: 'network',
          message: 'Request was cancelled',
          code: 'REQUEST_CANCELLED',
          provider: 'openrouter',
          details: {
            timestamp: mockDate,
          },
        });
      });

      it('should handle non-fetch TypeError as unknown error', () => {
        const typeError = new TypeError('Some other type error');
        const result = mapErrorToProviderError(typeError);

        expect(result).toEqual({
          type: 'unknown',
          message: 'Some other type error',
          code: 'UNKNOWN_ERROR',
          provider: 'openrouter',
          details: {
            timestamp: mockDate,
            originalError: 'Some other type error',
          },
        });
      });
    });

    describe('HTTP Response Errors', () => {
      const createMockResponse = (status: number, headers: Record<string, string> = {}) => {
        const mockHeaders = new Map(Object.entries(headers));
        const mockResponse = {
          status,
          headers: {
            get: (key: string) => mockHeaders.get(key) || null,
          },
        };
        // Make it instance of Response for type checking
        Object.setPrototypeOf(mockResponse, Response.prototype);
        return mockResponse as Response;
      };

      it('should handle 401 Unauthorized', () => {
        const response = createMockResponse(401);
        const result = mapErrorToProviderError(response);

        expect(result).toEqual({
          type: 'authentication',
          message: 'Invalid or missing API key',
          code: 'AUTH_ERROR',
          provider: 'openrouter',
          details: {
            statusCode: 401,
            timestamp: mockDate,
          },
        });
      });

      it('should handle 403 Forbidden', () => {
        const response = createMockResponse(403);
        const result = mapErrorToProviderError(response);

        expect(result).toEqual({
          type: 'authentication',
          message: 'Invalid or missing API key',
          code: 'AUTH_ERROR',
          provider: 'openrouter',
          details: {
            statusCode: 403,
            timestamp: mockDate,
          },
        });
      });

      it('should handle 402 Payment Required', () => {
        const response = createMockResponse(402);
        const result = mapErrorToProviderError(response);

        expect(result).toEqual({
          type: 'rate_limit',
          message: 'Insufficient credits or quota exceeded',
          code: 'QUOTA_EXCEEDED',
          provider: 'openrouter',
          details: {
            statusCode: 402,
            timestamp: mockDate,
          },
        });
      });

      it('should handle 404 Not Found', () => {
        const response = createMockResponse(404);
        const result = mapErrorToProviderError(response);

        expect(result).toEqual({
          type: 'validation',
          message: 'Model not found or invalid endpoint',
          code: 'NOT_FOUND',
          provider: 'openrouter',
          details: {
            statusCode: 404,
            timestamp: mockDate,
          },
        });
      });

      it('should handle 429 Rate Limit with retry-after header', () => {
        const response = createMockResponse(429, { 'Retry-After': '60' });
        const result = mapErrorToProviderError(response);

        expect(result).toEqual({
          type: 'rate_limit',
          message: 'Rate limit exceeded',
          code: 'RATE_LIMIT',
          provider: 'openrouter',
          retryAfter: 60,
          details: {
            statusCode: 429,
            timestamp: mockDate,
          },
        });
      });

      it('should handle 429 Rate Limit without retry-after header', () => {
        const response = createMockResponse(429);
        const result = mapErrorToProviderError(response);

        expect(result).toEqual({
          type: 'rate_limit',
          message: 'Rate limit exceeded',
          code: 'RATE_LIMIT',
          provider: 'openrouter',
          details: {
            statusCode: 429,
            timestamp: mockDate,
          },
        });
        expect(result.retryAfter).toBeUndefined();
      });

      it('should handle 500 Internal Server Error', () => {
        const response = createMockResponse(500);
        const result = mapErrorToProviderError(response);

        expect(result).toEqual({
          type: 'network',
          message: 'OpenRouter service error',
          code: 'SERVICE_ERROR',
          provider: 'openrouter',
          details: {
            statusCode: 500,
            timestamp: mockDate,
          },
        });
      });

      it('should handle 502 Bad Gateway', () => {
        const response = createMockResponse(502);
        const result = mapErrorToProviderError(response);

        expect(result).toEqual({
          type: 'network',
          message: 'OpenRouter service error',
          code: 'SERVICE_ERROR',
          provider: 'openrouter',
          details: {
            statusCode: 502,
            timestamp: mockDate,
          },
        });
      });

      it('should handle 503 Service Unavailable', () => {
        const response = createMockResponse(503);
        const result = mapErrorToProviderError(response);

        expect(result).toEqual({
          type: 'network',
          message: 'OpenRouter service error',
          code: 'SERVICE_ERROR',
          provider: 'openrouter',
          details: {
            statusCode: 503,
            timestamp: mockDate,
          },
        });
      });

      it('should handle 504 Gateway Timeout', () => {
        const response = createMockResponse(504);
        const result = mapErrorToProviderError(response);

        expect(result).toEqual({
          type: 'network',
          message: 'OpenRouter service error',
          code: 'SERVICE_ERROR',
          provider: 'openrouter',
          details: {
            statusCode: 504,
            timestamp: mockDate,
          },
        });
      });

      it('should handle unknown HTTP status codes', () => {
        const response = createMockResponse(418); // I'm a teapot
        const result = mapErrorToProviderError(response);

        expect(result).toEqual({
          type: 'unknown',
          message: 'HTTP error 418',
          code: 'HTTP_418',
          provider: 'openrouter',
          details: {
            statusCode: 418,
            timestamp: mockDate,
          },
        });
      });

      it('should handle invalid retry-after header', () => {
        const response = createMockResponse(429, { 'Retry-After': 'invalid' });
        const result = mapErrorToProviderError(response);

        // parseInt('invalid', 10) returns NaN
        expect(result.retryAfter).toBeNaN();
      });
    });

    describe('OpenRouter API Errors', () => {
      it('should handle invalid_request_error', () => {
        const openRouterError: OpenRouterError = {
          error: {
            message: 'Invalid request format',
            type: 'invalid_request_error',
            code: 'invalid_request',
          },
        };

        const result = mapErrorToProviderError(openRouterError);

        expect(result).toEqual({
          type: 'validation',
          message: 'Invalid request format',
          code: 'INVALID_REQUEST',
          provider: 'openrouter',
          details: {
            timestamp: mockDate,
            originalType: 'invalid_request_error',
            originalCode: 'invalid_request',
          },
        });
      });

      it('should handle authentication_error', () => {
        const openRouterError: OpenRouterError = {
          error: {
            message: 'Invalid API key provided',
            type: 'authentication_error',
            code: 'invalid_api_key',
          },
        };

        const result = mapErrorToProviderError(openRouterError);

        expect(result).toEqual({
          type: 'authentication',
          message: 'Invalid API key provided',
          code: 'AUTH_ERROR',
          provider: 'openrouter',
          details: {
            timestamp: mockDate,
            originalType: 'authentication_error',
            originalCode: 'invalid_api_key',
          },
        });
      });

      it('should handle rate_limit_error', () => {
        const openRouterError: OpenRouterError = {
          error: {
            message: 'Rate limit exceeded',
            type: 'rate_limit_error',
            code: 'rate_limit',
          },
        };

        const result = mapErrorToProviderError(openRouterError);

        expect(result).toEqual({
          type: 'rate_limit',
          message: 'Rate limit exceeded',
          code: 'RATE_LIMIT',
          provider: 'openrouter',
          details: {
            timestamp: mockDate,
            originalType: 'rate_limit_error',
            originalCode: 'rate_limit',
          },
        });
      });

      it('should handle api_error', () => {
        const openRouterError: OpenRouterError = {
          error: {
            message: 'Internal API error',
            type: 'api_error',
            code: 'internal_error',
          },
        };

        const result = mapErrorToProviderError(openRouterError);

        expect(result).toEqual({
          type: 'network',
          message: 'Internal API error',
          code: 'API_ERROR',
          provider: 'openrouter',
          details: {
            timestamp: mockDate,
            originalType: 'api_error',
            originalCode: 'internal_error',
          },
        });
      });

      it('should handle unknown OpenRouter error type', () => {
        const openRouterError: OpenRouterError = {
          error: {
            message: 'Unknown error occurred',
            type: 'unknown_error_type',
            code: 'unknown_code',
          },
        };

        const result = mapErrorToProviderError(openRouterError);

        expect(result).toEqual({
          type: 'unknown',
          message: 'Unknown error occurred',
          code: 'unknown_code',
          provider: 'openrouter',
          details: {
            timestamp: mockDate,
            originalType: 'unknown_error_type',
            originalCode: 'unknown_code',
          },
        });
      });

      it('should handle OpenRouter error without code', () => {
        const openRouterError: OpenRouterError = {
          error: {
            message: 'Error without code',
            type: 'some_error_type',
          },
        };

        const result = mapErrorToProviderError(openRouterError);

        expect(result.code).toBe('UNKNOWN_ERROR');
        expect(result.details.originalCode).toBeUndefined();
      });

      it('should handle numeric error code', () => {
        const openRouterError: OpenRouterError = {
          error: {
            message: 'Numeric error code',
            type: 'unknown_type',
            code: 123,
          },
        };

        const result = mapErrorToProviderError(openRouterError);

        expect(result.code).toBe('123');
        expect(result.details.originalCode).toBe(123);
      });
    });

    describe('Generic Error Handling', () => {
      it('should handle generic Error instances', () => {
        const genericError = new Error('Something went wrong');
        const result = mapErrorToProviderError(genericError);

        expect(result).toEqual({
          type: 'unknown',
          message: 'Something went wrong',
          code: 'UNKNOWN_ERROR',
          provider: 'openrouter',
          details: {
            timestamp: mockDate,
            originalError: 'Something went wrong',
          },
        });
      });

      it('should handle non-Error objects', () => {
        const weirdError = { message: 'Weird error', code: 'WEIRD' };
        const result = mapErrorToProviderError(weirdError);

        expect(result).toEqual({
          type: 'unknown',
          message: 'An unknown error occurred',
          code: 'UNKNOWN_ERROR',
          provider: 'openrouter',
          details: {
            timestamp: mockDate,
            originalError: '[object Object]', // String() conversion of object
          },
        });
      });

      it('should handle null/undefined errors', () => {
        const result1 = mapErrorToProviderError(null);
        const result2 = mapErrorToProviderError(undefined);

        expect(result1).toEqual({
          type: 'unknown',
          message: 'An unknown error occurred',
          code: 'UNKNOWN_ERROR',
          provider: 'openrouter',
          details: {
            timestamp: mockDate,
            originalError: 'null',
          },
        });

        expect(result2).toEqual({
          type: 'unknown',
          message: 'An unknown error occurred',
          code: 'UNKNOWN_ERROR',
          provider: 'openrouter',
          details: {
            timestamp: mockDate,
            originalError: 'undefined',
          },
        });
      });

      it('should handle primitive errors', () => {
        const result1 = mapErrorToProviderError('string error');
        const result2 = mapErrorToProviderError(42);
        const result3 = mapErrorToProviderError(true);

        expect(result1.details.originalError).toBe('string error');
        expect(result2.details.originalError).toBe('42');
        expect(result3.details.originalError).toBe('true');
      });
    });

    describe('Error Type Detection', () => {
      it('should correctly detect OpenRouter errors', () => {
        const validOpenRouterError: OpenRouterError = {
          error: {
            message: 'Valid OpenRouter error',
            type: 'api_error',
          },
        };

        const invalidError1 = { error: 'not an object' };
        const invalidError2 = { error: {} }; // missing message
        const invalidError3 = { notError: { message: 'wrong key' } };

        const result1 = mapErrorToProviderError(validOpenRouterError);
        const result2 = mapErrorToProviderError(invalidError1);
        const result3 = mapErrorToProviderError(invalidError2);
        const result4 = mapErrorToProviderError(invalidError3);

        expect(result1.code).toBe('API_ERROR');
        expect(result2.code).toBe('UNKNOWN_ERROR');
        expect(result3.code).toBe('UNKNOWN_ERROR');
        expect(result4.code).toBe('UNKNOWN_ERROR');
      });

      it('should handle malformed OpenRouter error structure', () => {
        const malformedError = {
          error: {
            message: null, // message should be string
            type: 'api_error',
          },
        };

        // This should still be detected as OpenRouter error due to structure
        const result = mapErrorToProviderError(malformedError as any);
        expect(result.code).toBe('API_ERROR');
        expect(result.message).toBeNull();
      });
    });

    describe('Edge Cases', () => {
      it('should handle circular reference in error objects', () => {
        const circularError: any = { message: 'Circular error' };
        circularError.self = circularError;

        const result = mapErrorToProviderError(circularError);

        expect(result.type).toBe('unknown');
        expect(result.code).toBe('UNKNOWN_ERROR');
        expect(typeof result.details.originalError).toBe('string');
      });

      it('should handle errors with toJSON method', () => {
        const customError = {
          message: 'Custom error',
          toJSON: () => ({ custom: 'json representation' }),
        };

        const result = mapErrorToProviderError(customError);

        // JSON.stringify calls toString() on objects without toJSON, so we get [object Object]
        expect(result.details.originalError).toBe('[object Object]');
      });
    });
  });

  describe('getRetryDelay', () => {
    const createProviderError = (
      type: ProviderError['type'],
      retryAfter?: number
    ): ProviderError => ({
      type,
      message: 'Test error',
      code: 'TEST_ERROR',
      provider: 'openrouter',
      retryAfter,
      details: { timestamp: mockDate },
    });

    it('should return retryAfter value in milliseconds when provided', () => {
      const error = createProviderError('rate_limit', 30);
      const delay = getRetryDelay(error);

      expect(delay).toBe(30000); // 30 seconds in milliseconds
    });

    it('should return default delay for rate_limit errors', () => {
      const error = createProviderError('rate_limit');
      const delay = getRetryDelay(error);

      expect(delay).toBe(60000); // 1 minute
    });

    it('should return default delay for network errors', () => {
      const error = createProviderError('network');
      const delay = getRetryDelay(error);

      expect(delay).toBe(5000); // 5 seconds
    });

    it('should return null for authentication errors', () => {
      const error = createProviderError('authentication');
      const delay = getRetryDelay(error);

      expect(delay).toBeNull();
    });

    it('should return null for validation errors', () => {
      const error = createProviderError('validation');
      const delay = getRetryDelay(error);

      expect(delay).toBeNull();
    });

    it('should return null for unknown errors', () => {
      const error = createProviderError('unknown');
      const delay = getRetryDelay(error);

      expect(delay).toBeNull();
    });

    it('should prefer retryAfter over default delays', () => {
      const error = createProviderError('rate_limit', 5);
      const delay = getRetryDelay(error);

      expect(delay).toBe(5000); // retryAfter (5s) instead of default (60s)
    });

    it('should handle zero retryAfter', () => {
      const error = createProviderError('rate_limit', 0);
      const delay = getRetryDelay(error);

      // Since 0 is falsy, it falls back to default rate_limit delay
      expect(delay).toBe(60000);
    });

    it('should handle negative retryAfter', () => {
      const error = createProviderError('network', -10);
      const delay = getRetryDelay(error);

      expect(delay).toBe(-10000); // Preserves negative value
    });

    it('should handle fractional retryAfter', () => {
      const error = createProviderError('rate_limit', 1.5);
      const delay = getRetryDelay(error);

      expect(delay).toBe(1500); // 1.5 seconds
    });
  });

  describe('Error Message Consistency', () => {
    it('should provide consistent error messages for similar error types', () => {
      const errors = [
        mapErrorToProviderError(new TypeError('fetch failed')),
        mapErrorToProviderError(new TypeError('Failed to fetch')),
        mapErrorToProviderError(new TypeError('Network request failed')),
      ];

      errors.forEach((error, index) => {
        if (error.message === 'Network error: Unable to connect to OpenRouter') {
          expect(error.code).toBe('NETWORK_ERROR');
        } else {
          // Some TypeError messages don't contain 'fetch', so they're treated as generic errors
          expect(error.code).toBe('UNKNOWN_ERROR');
        }
      });
    });

    it('should maintain provider consistency across all error types', () => {
      const errors = [
        mapErrorToProviderError(new Error('test')),
        mapErrorToProviderError(new Response(null, { status: 500 })),
        mapErrorToProviderError({ error: { message: 'test', type: 'api_error' } }),
      ];

      errors.forEach(error => {
        expect(error.provider).toBe('openrouter');
      });
    });

    it('should include timestamp in all error details', () => {
      const errors = [
        mapErrorToProviderError(new Error('test')),
        mapErrorToProviderError(new Response(null, { status: 404 })),
        mapErrorToProviderError({ error: { message: 'test', type: 'api_error' } }),
      ];

      errors.forEach(error => {
        expect(error.details.timestamp).toEqual(mockDate);
      });
    });
  });
});
