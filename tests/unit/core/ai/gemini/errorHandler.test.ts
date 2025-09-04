/**
 * @file Gemini Error Handler Unit Tests
 *
 * Comprehensive unit tests for Gemini error handling functionality,
 * including error response handling, error formatting, error type determination,
 * and error wrapper functions.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  handleErrorResponse,
  formatError,
  isProviderError,
  withErrorHandling,
  withErrorHandlingGenerator,
} from '@/core/ai/gemini/errorHandler';
import type { ProviderError, ErrorType } from '@/types/providers';
import { GEMINI_API_CONFIG } from '@/core/ai/gemini/types';

// Mock Response object for testing
class MockResponse implements Partial<Response> {
  status: number;
  statusText: string;
  headers: Map<string, string>;
  private jsonData: any;

  constructor(status: number, statusText: string, jsonData?: any) {
    this.status = status;
    this.statusText = statusText;
    this.jsonData = jsonData;
    this.headers = new Map();
  }

  async json() {
    if (this.jsonData === 'INVALID_JSON') {
      throw new Error('Invalid JSON');
    }
    return this.jsonData || {};
  }

  // Add headers property getter
  get headers() {
    return {
      get: (name: string) => this._headers.get(name.toLowerCase()),
    } as any;
  }

  set headers(headers: any) {
    this._headers = headers;
  }

  private _headers = new Map<string, string>();

  setHeader(name: string, value: string) {
    this._headers.set(name.toLowerCase(), value);
  }
}

describe('Gemini Error Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleErrorResponse', () => {
    it('should handle 400 Bad Request with details', async () => {
      const mockResponse = new MockResponse(400, 'Bad Request', {
        error: {
          message: 'Invalid request format',
          code: 'INVALID_ARGUMENT',
          details: [
            { reason: 'FIELD_REQUIRED', message: 'Missing required field: contents' },
            { reason: 'INVALID_FORMAT', message: 'Invalid JSON format' },
          ],
        },
      });

      await expect(handleErrorResponse(mockResponse as Response)).rejects.toThrow(
        'Invalid request: FIELD_REQUIRED, INVALID_FORMAT'
      );
    });

    it('should handle 400 Bad Request without details', async () => {
      const mockResponse = new MockResponse(400, 'Bad Request', {
        error: {
          message: 'Bad request without details',
        },
      });

      await expect(handleErrorResponse(mockResponse as Response)).rejects.toThrow(
        'Bad request: Bad request without details'
      );
    });

    it('should handle 401 Unauthorized', async () => {
      const mockResponse = new MockResponse(401, 'Unauthorized', {
        error: {
          message: 'Invalid API key',
          code: 'UNAUTHENTICATED',
        },
      });

      await expect(handleErrorResponse(mockResponse as Response)).rejects.toThrow(
        'Authentication failed. Please check your Google API key is valid and has Gemini API enabled.'
      );
    });

    it('should handle 403 Forbidden', async () => {
      const mockResponse = new MockResponse(403, 'Forbidden', {
        error: {
          message: 'API key access denied',
          code: 'PERMISSION_DENIED',
        },
      });

      await expect(handleErrorResponse(mockResponse as Response)).rejects.toThrow(
        'Access denied. Make sure your Google API key has access to Gemini API. You may need to enable it at console.cloud.google.com'
      );
    });

    it('should handle 404 Not Found', async () => {
      const mockResponse = new MockResponse(404, 'Not Found', {
        error: {
          message: 'Model not found',
        },
      });

      await expect(handleErrorResponse(mockResponse as Response)).rejects.toThrow(
        'Model not found. The selected Gemini model may not be available in your region or with your API key.'
      );
    });

    it('should handle 429 Rate Limit with retry-after header', async () => {
      const mockResponse = new MockResponse(429, 'Too Many Requests', {
        error: {
          message: 'Rate limit exceeded',
          code: 'RESOURCE_EXHAUSTED',
          retry_after: 120,
        },
      });
      mockResponse.setHeader('retry-after', '120');

      await expect(handleErrorResponse(mockResponse as Response)).rejects.toThrow(
        'Rate limit exceeded. Please retry after 120 seconds.'
      );
    });

    it('should handle 429 Rate Limit without retry-after', async () => {
      const mockResponse = new MockResponse(429, 'Too Many Requests', {
        error: {
          message: 'Rate limit exceeded',
        },
      });

      await expect(handleErrorResponse(mockResponse as Response)).rejects.toThrow(
        'Rate limit exceeded. Please wait before making more requests.'
      );
    });

    it('should handle 500 Internal Server Error', async () => {
      const mockResponse = new MockResponse(500, 'Internal Server Error', {
        error: {
          message: 'Internal server error',
        },
      });

      await expect(handleErrorResponse(mockResponse as Response)).rejects.toThrow(
        'Gemini API server error. Please try again later.'
      );
    });

    it('should handle 503 Service Unavailable', async () => {
      const mockResponse = new MockResponse(503, 'Service Unavailable', {
        error: {
          message: 'Service temporarily unavailable',
        },
      });

      await expect(handleErrorResponse(mockResponse as Response)).rejects.toThrow(
        'Gemini API service unavailable. Please try again later.'
      );
    });

    it('should handle unknown status codes', async () => {
      const mockResponse = new MockResponse(418, "I'm a teapot", {
        error: {
          message: 'Unknown error',
        },
      });

      await expect(handleErrorResponse(mockResponse as Response)).rejects.toThrow('Unknown error');
    });

    it('should handle response with invalid JSON', async () => {
      const mockResponse = new MockResponse(500, 'Internal Server Error', 'INVALID_JSON');

      await expect(handleErrorResponse(mockResponse as Response)).rejects.toThrow(
        'Gemini API server error. Please try again later.'
      );
    });

    it('should handle response with no error field', async () => {
      const mockResponse = new MockResponse(400, 'Bad Request', {
        message: 'Direct message field',
      });

      await expect(handleErrorResponse(mockResponse as Response)).rejects.toThrow(
        'Bad request: Direct message field'
      );
    });

    it('should create proper error object with provider error properties', async () => {
      const mockResponse = new MockResponse(429, 'Too Many Requests', {
        error: {
          message: 'Rate limited',
          retry_after: 60,
        },
      });
      mockResponse.setHeader('retry-after', '60');

      try {
        await handleErrorResponse(mockResponse as Response);
      } catch (error) {
        expect(error).toHaveProperty('type', 'rate_limit');
        expect(error).toHaveProperty('code', 'GEMINI_RATE_LIMIT');
        expect(error).toHaveProperty('provider', 'gemini');
        expect(error).toHaveProperty('retryAfter', 60);
        expect(error).toHaveProperty('details');
        expect((error as any).details.statusCode).toBe(429);
      }
    });

    it('should prioritize response header retry-after over error body', async () => {
      const mockResponse = new MockResponse(429, 'Too Many Requests', {
        error: {
          retry_after: 30, // Body says 30
        },
      });
      mockResponse.setHeader('retry-after', '120'); // Header says 120

      try {
        await handleErrorResponse(mockResponse as Response);
      } catch (error) {
        expect((error as any).retryAfter).toBe(120); // Should use header value
      }
    });
  });

  describe('formatError', () => {
    it('should format basic error', () => {
      const error = new Error('Basic error message');

      const formatted = formatError(error);

      expect(formatted).toEqual({
        type: 'unknown',
        message: 'Basic error message',
        code: 'GEMINI_ERROR',
        provider: 'gemini',
        details: {
          timestamp: expect.any(Date),
        },
      });
    });

    it('should format authentication error', () => {
      const error = {
        status: 401,
        message: 'API key invalid',
        code: 'UNAUTHENTICATED',
      };

      const formatted = formatError(error);

      expect(formatted).toEqual({
        type: 'authentication',
        message: 'API key invalid',
        code: 'GEMINI_AUTH_ERROR',
        provider: 'gemini',
        details: {
          timestamp: expect.any(Date),
          statusCode: 401,
        },
      });
    });

    it('should format rate limit error with retry after', () => {
      const error = {
        status: 429,
        error: {
          message: 'Rate limited',
          retry_after: 90,
        },
      };

      const formatted = formatError(error);

      expect(formatted).toEqual({
        type: 'rate_limit',
        message: 'Rate limited',
        code: 'GEMINI_RATE_LIMIT',
        provider: 'gemini',
        retryAfter: 90,
        details: {
          timestamp: expect.any(Date),
          statusCode: 429,
        },
      });
    });

    it('should format validation error', () => {
      const error = {
        status: 400,
        message: 'Invalid input',
        field: 'contents',
        value: null,
      };

      const formatted = formatError(error);

      expect(formatted).toEqual({
        type: 'validation',
        message: 'Invalid input',
        code: 'GEMINI_VALIDATION_ERROR',
        provider: 'gemini',
        details: {
          timestamp: expect.any(Date),
          statusCode: 400,
          field: 'contents',
        },
      });
    });

    it('should format network error', () => {
      const error = {
        name: 'AbortError',
        message: 'Request aborted',
      };

      const formatted = formatError(error);

      expect(formatted).toEqual({
        type: 'network',
        message: 'Request aborted',
        code: 'GEMINI_NETWORK_ERROR',
        provider: 'gemini',
        details: {
          timestamp: expect.any(Date),
        },
      });
    });

    it('should handle error with nested error object', () => {
      const error = {
        error: {
          message: 'Nested error message',
          code: 'NESTED_ERROR',
        },
      };

      const formatted = formatError(error);

      expect(formatted.message).toBe('Nested error message');
      expect(formatted.details.originalCode).toBe('NESTED_ERROR');
    });

    it('should use default retry after for rate limit without specific value', () => {
      const error = {
        status: 429,
        message: 'Rate limited without retry after',
      };

      const formatted = formatError(error);

      expect(formatted.retryAfter).toBe(GEMINI_API_CONFIG.DEFAULT_RETRY_AFTER);
    });

    it('should handle error with additional details', () => {
      const error = {
        message: 'Error with details',
        details: {
          customField: 'custom value',
          anotherField: 123,
        },
      };

      const formatted = formatError(error);

      expect(formatted.details).toEqual({
        timestamp: expect.any(Date),
        customField: 'custom value',
        anotherField: 123,
      });
    });

    it('should determine error type by message content', () => {
      const testCases = [
        { message: 'Network error occurred', expectedType: 'network' },
        { message: 'Authentication failed', expectedType: 'authentication' },
        { message: 'Rate limit exceeded', expectedType: 'rate_limit' },
        { message: 'Invalid request format', expectedType: 'validation' },
        { message: 'Unknown problem', expectedType: 'unknown' },
      ];

      testCases.forEach(({ message, expectedType }) => {
        const error = { message };
        const formatted = formatError(error);
        expect(formatted.type).toBe(expectedType);
      });
    });

    it('should handle null and undefined errors', () => {
      const nullFormatted = formatError(null);
      expect(nullFormatted.type).toBe('unknown');
      expect(nullFormatted.message).toBe('An unexpected error occurred');

      const undefinedFormatted = formatError(undefined);
      expect(undefinedFormatted.type).toBe('unknown');
      expect(undefinedFormatted.message).toBe('An unexpected error occurred');
    });
  });

  describe('isProviderError', () => {
    it('should return true for valid provider error', () => {
      const providerError: ProviderError = {
        type: 'authentication',
        message: 'Auth failed',
        code: 'GEMINI_AUTH_ERROR',
        provider: 'gemini',
        details: {},
      };

      expect(isProviderError(providerError)).toBe(true);
    });

    it('should return false for regular Error', () => {
      const regularError = new Error('Regular error');
      expect(isProviderError(regularError)).toBe(false);
    });

    it('should return false for non-gemini provider error', () => {
      const openaiError = {
        type: 'authentication',
        message: 'Auth failed',
        code: 'OPENAI_AUTH_ERROR',
        provider: 'openai',
        details: {},
      };

      expect(isProviderError(openaiError)).toBe(false);
    });

    it('should return false for null/undefined', () => {
      expect(isProviderError(null)).toBe(false);
      expect(isProviderError(undefined)).toBe(false);
    });

    it('should return false for objects missing required fields', () => {
      expect(isProviderError({})).toBe(false);
      expect(isProviderError({ type: 'error' })).toBe(false);
      expect(isProviderError({ provider: 'gemini' })).toBe(false);
    });

    it('should return false for primitive values', () => {
      expect(isProviderError('string')).toBe(false);
      expect(isProviderError(123)).toBe(false);
      expect(isProviderError(true)).toBe(false);
    });
  });

  describe('withErrorHandling', () => {
    it('should execute operation successfully', async () => {
      const mockOperation = vi.fn().mockResolvedValue('success result');

      const result = await withErrorHandling(mockOperation);

      expect(result).toBe('success result');
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should re-throw AbortError as-is', async () => {
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      const mockOperation = vi.fn().mockRejectedValue(abortError);

      await expect(withErrorHandling(mockOperation)).rejects.toBe(abortError);
    });

    it('should re-throw existing provider error', async () => {
      const providerError: ProviderError = {
        type: 'authentication',
        message: 'Already formatted',
        code: 'GEMINI_AUTH_ERROR',
        provider: 'gemini',
        details: {},
      };
      const mockOperation = vi.fn().mockRejectedValue(providerError);

      await expect(withErrorHandling(mockOperation)).rejects.toBe(providerError);
    });

    it('should format and throw non-provider errors', async () => {
      const regularError = new Error('Regular error');
      const mockOperation = vi.fn().mockRejectedValue(regularError);

      await expect(withErrorHandling(mockOperation)).rejects.toMatchObject({
        type: 'unknown',
        message: 'Regular error',
        code: 'GEMINI_ERROR',
        provider: 'gemini',
      });
    });

    it('should handle operation throwing non-Error objects', async () => {
      const mockOperation = vi.fn().mockRejectedValue('string error');

      await expect(withErrorHandling(mockOperation)).rejects.toMatchObject({
        type: 'unknown',
        message: 'An unexpected error occurred',
        code: 'GEMINI_ERROR',
        provider: 'gemini',
      });
    });

    it('should handle async operation that throws synchronously', async () => {
      const mockOperation = vi.fn().mockImplementation(() => {
        throw new Error('Sync error');
      });

      await expect(withErrorHandling(mockOperation)).rejects.toMatchObject({
        message: 'Sync error',
        type: 'unknown',
      });
    });
  });

  describe('withErrorHandlingGenerator', () => {
    it('should yield all values from successful generator', async () => {
      const mockGenerator = async function* () {
        yield 'value1';
        yield 'value2';
        yield 'value3';
      };

      const results = [];
      for await (const value of withErrorHandlingGenerator(mockGenerator)) {
        results.push(value);
      }

      expect(results).toEqual(['value1', 'value2', 'value3']);
    });

    it('should re-throw AbortError from generator', async () => {
      const abortError = new Error('Generator aborted');
      abortError.name = 'AbortError';

      const mockGenerator = async function* () {
        yield 'value1';
        throw abortError;
      };

      const generator = withErrorHandlingGenerator(mockGenerator);
      await expect(generator.next()).resolves.toEqual({ value: 'value1', done: false });
      await expect(generator.next()).rejects.toBe(abortError);
    });

    it('should re-throw existing provider error from generator', async () => {
      const providerError: ProviderError = {
        type: 'rate_limit',
        message: 'Rate limited',
        code: 'GEMINI_RATE_LIMIT',
        provider: 'gemini',
        details: {},
      };

      const mockGenerator = async function* () {
        yield 'value1';
        throw providerError;
      };

      const generator = withErrorHandlingGenerator(mockGenerator);
      await expect(generator.next()).resolves.toEqual({ value: 'value1', done: false });
      await expect(generator.next()).rejects.toBe(providerError);
    });

    it('should format and throw regular errors from generator', async () => {
      const regularError = new Error('Generator error');

      const mockGenerator = async function* () {
        yield 'value1';
        throw regularError;
      };

      const generator = withErrorHandlingGenerator(mockGenerator);
      await expect(generator.next()).resolves.toEqual({ value: 'value1', done: false });
      await expect(generator.next()).rejects.toMatchObject({
        type: 'unknown',
        message: 'Generator error',
        code: 'GEMINI_ERROR',
        provider: 'gemini',
      });
    });

    it('should handle generator that throws immediately', async () => {
      // eslint-disable-next-line require-yield
      const mockGenerator = async function* (): AsyncGenerator<never> {
        throw new Error('Immediate error');
      };

      const generator = withErrorHandlingGenerator(mockGenerator);
      await expect(generator.next()).rejects.toMatchObject({
        message: 'Immediate error',
        type: 'unknown',
      });
    });

    it('should handle empty generator', async () => {
      // eslint-disable-next-line require-yield
      const mockGenerator = async function* () {
        // Intentionally empty generator for test coverage; no yields expected
      };

      const results = [];
      for await (const value of withErrorHandlingGenerator(mockGenerator)) {
        results.push(value);
      }

      expect(results).toEqual([]);
    });

    it('should handle generator with mixed yield and error', async () => {
      let shouldError = false;

      const mockGenerator = async function* () {
        yield 'first';
        yield 'second';
        if (shouldError) {
          throw new Error('Conditional error');
        }
        yield 'third';
      };

      // First run without error
      const results1 = [];
      for await (const value of withErrorHandlingGenerator(mockGenerator)) {
        results1.push(value);
      }
      expect(results1).toEqual(['first', 'second', 'third']);

      // Second run with error
      shouldError = true;
      const results2 = [];
      try {
        for await (const value of withErrorHandlingGenerator(mockGenerator)) {
          results2.push(value);
        }
      } catch (error) {
        expect(results2).toEqual(['first', 'second']);
        expect((error as any).message).toBe('Conditional error');
      }
    });
  });

  describe('Error Type Determination', () => {
    it('should determine error type by HTTP status codes', () => {
      const testCases = [
        { status: 401, expectedType: 'authentication' },
        { status: 403, expectedType: 'authentication' },
        { status: 429, expectedType: 'rate_limit' },
        { status: 400, expectedType: 'validation' },
        { status: 500, expectedType: 'unknown' },
      ];

      testCases.forEach(({ status, expectedType }) => {
        const formatted = formatError({ status });
        expect(formatted.type).toBe(expectedType);
      });
    });

    it('should determine error type by error codes', () => {
      const testCases = [
        { code: 'UNAUTHENTICATED', expectedType: 'authentication' },
        { code: 'PERMISSION_DENIED', expectedType: 'authentication' },
        { code: 'RESOURCE_EXHAUSTED', expectedType: 'rate_limit' },
        { code: 'INVALID_ARGUMENT', expectedType: 'validation' },
        { code: 'UNKNOWN_CODE', expectedType: 'unknown' },
      ];

      testCases.forEach(({ code, expectedType }) => {
        const formatted = formatError({ code });
        expect(formatted.type).toBe(expectedType);
      });
    });

    it('should prioritize status over message for type determination', () => {
      const error = {
        status: 401,
        message: 'This looks like a network error but status says auth',
      };

      const formatted = formatError(error);
      expect(formatted.type).toBe('authentication');
    });

    it('should fall back to message content for type determination', () => {
      const error = {
        message: 'fetch failed due to network issues',
      };

      const formatted = formatError(error);
      expect(formatted.type).toBe('network');
    });
  });

  describe('Edge Cases and Complex Scenarios', () => {
    it('should handle circular reference in error details', () => {
      const error: any = {
        message: 'Circular error',
        details: {},
      };
      error.details.self = error;

      // Should not throw even with circular references
      const formatted = formatError(error);
      expect(formatted.message).toBe('Circular error');
      expect(formatted.details.self).toBeDefined();
    });

    it('should handle very large error objects', () => {
      const largeString = 'x'.repeat(100000);
      const error = {
        message: largeString,
        details: {
          largeField: largeString,
        },
      };

      const formatted = formatError(error);
      expect(formatted.message).toBe(largeString);
      expect(formatted.details.largeField).toBe(largeString);
    });

    it('should handle error with special characters', () => {
      const error = {
        message: '🚨 Error with unicode 世界 and "quotes" & symbols',
        details: {
          specialField: 'Value with \n newlines \t tabs',
        },
      };

      const formatted = formatError(error);
      expect(formatted.message).toBe('🚨 Error with unicode 世界 and "quotes" & symbols');
      expect(formatted.details.specialField).toBe('Value with \n newlines \t tabs');
    });

    it('should handle concurrent error handling', async () => {
      const errors = [
        () => Promise.reject(new Error('Error 1')),
        () => Promise.reject(new Error('Error 2')),
        () => Promise.reject(new Error('Error 3')),
      ];

      const promises = errors.map(error => withErrorHandling(error).catch(e => e.message));

      const results = await Promise.all(promises);
      expect(results).toEqual(['Error 1', 'Error 2', 'Error 3']);
    });

    it('should maintain error prototype chain', async () => {
      const customError = new TypeError('Type error');
      const mockOperation = vi.fn().mockRejectedValue(customError);

      try {
        await withErrorHandling(mockOperation);
      } catch (error) {
        // Should still be an Error instance
        expect(error).toBeInstanceOf(Error);
        expect((error as any).type).toBe('unknown');
      }
    });

    it('should handle retry-after header parsing edge cases', async () => {
      const mockResponse = new MockResponse(429, 'Too Many Requests');
      mockResponse.setHeader('retry-after', 'invalid-number');

      await expect(handleErrorResponse(mockResponse as Response)).rejects.toThrow(
        'Rate limit exceeded. Please wait before making more requests.'
      );
    });

    it('should handle missing status text', async () => {
      const mockResponse = new MockResponse(500, '', {
        error: { message: 'Server error' },
      });

      await expect(handleErrorResponse(mockResponse as Response)).rejects.toThrow(
        'Gemini API server error. Please try again later.'
      );
    });
  });
});
