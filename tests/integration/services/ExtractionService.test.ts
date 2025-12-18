/**
 * @file Extraction Service Integration Test
 *
 * Integration test for ExtractionService.
 * Tests error types, service creation, and batch result structures.
 *
 * NOTE: Full integration tests with mocked chrome messaging APIs require
 * complex vi.mock setup with path aliases. These tests focus on the
 * deterministic, non-network parts of the service.
 */

import { describe, it, expect } from 'vitest';
import {
  ExtractionService,
  createExtractionService,
  ExtractionError,
  ExtractionErrorType,
} from '@/services/extraction/ExtractionService';

describe('ExtractionService integration', () => {
  describe('service creation', () => {
    it('creates service with correct source', () => {
      const sidebarService = createExtractionService('sidebar');
      const contentService = createExtractionService('content');
      const backgroundService = createExtractionService('background');

      expect(sidebarService).toBeInstanceOf(ExtractionService);
      expect(contentService).toBeInstanceOf(ExtractionService);
      expect(backgroundService).toBeInstanceOf(ExtractionService);
    });

    it('creates service with factory function', () => {
      const service = createExtractionService('sidebar');
      expect(service).toBeDefined();
      expect(typeof service.extractCurrentTab).toBe('function');
      expect(typeof service.extractTabs).toBe('function');
      expect(typeof service.getAllTabs).toBe('function');
    });
  });

  describe('ExtractionError', () => {
    it('creates error with correct properties', () => {
      const error = new ExtractionError('Test error message', ExtractionErrorType.TIMEOUT, 123);

      expect(error.message).toBe('Test error message');
      expect(error.type).toBe(ExtractionErrorType.TIMEOUT);
      expect(error.tabId).toBe(123);
      expect(error.name).toBe('ExtractionError');
    });

    it('defaults to UNKNOWN type when not specified', () => {
      const error = new ExtractionError('Test error');

      expect(error.type).toBe(ExtractionErrorType.UNKNOWN);
      expect(error.tabId).toBeUndefined();
    });

    it('is an instance of Error', () => {
      const error = new ExtractionError('Test');
      expect(error instanceof Error).toBe(true);
    });

    it('has correct error type enum values', () => {
      expect(ExtractionErrorType.TIMEOUT).toBe('timeout');
      expect(ExtractionErrorType.TAB_NOT_FOUND).toBe('tab_not_found');
      expect(ExtractionErrorType.CONTENT_SCRIPT_UNAVAILABLE).toBe('content_script_unavailable');
      expect(ExtractionErrorType.RESTRICTED_URL).toBe('restricted_url');
      expect(ExtractionErrorType.MESSAGING_ERROR).toBe('messaging_error');
      expect(ExtractionErrorType.UNKNOWN).toBe('unknown');
    });

    it('can be thrown and caught', () => {
      const throwError = () => {
        throw new ExtractionError('Test', ExtractionErrorType.TIMEOUT, 42);
      };

      expect(throwError).toThrow(ExtractionError);
      expect(throwError).toThrow('Test');
    });

    it('preserves stack trace', () => {
      const error = new ExtractionError('Test');
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('ExtractionError');
    });
  });

  describe('extractTabs - empty batch handling', () => {
    it('returns empty result for empty tab array', async () => {
      const service = createExtractionService('sidebar');
      const result = await service.extractTabs([]);

      expect(result.totalTabs).toBe(0);
      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(0);
      expect(result.successRate).toBe(0);
      expect(result.results).toEqual([]);
    });

    it('returns correct structure for empty batch', async () => {
      const service = createExtractionService('sidebar');
      const result = await service.extractTabs([]);

      // Verify all expected properties exist
      expect(result).toHaveProperty('totalTabs');
      expect(result).toHaveProperty('successCount');
      expect(result).toHaveProperty('failureCount');
      expect(result).toHaveProperty('successRate');
      expect(result).toHaveProperty('results');

      // Verify types
      expect(typeof result.totalTabs).toBe('number');
      expect(typeof result.successCount).toBe('number');
      expect(typeof result.failureCount).toBe('number');
      expect(typeof result.successRate).toBe('number');
      expect(Array.isArray(result.results)).toBe(true);
    });
  });

  describe('error type classification helpers', () => {
    it('TIMEOUT type indicates timeout errors', () => {
      const error = new ExtractionError('Request timed out', ExtractionErrorType.TIMEOUT);
      expect(error.type).toBe('timeout');
    });

    it('TAB_NOT_FOUND type indicates missing tab', () => {
      const error = new ExtractionError('Tab was closed', ExtractionErrorType.TAB_NOT_FOUND);
      expect(error.type).toBe('tab_not_found');
    });

    it('CONTENT_SCRIPT_UNAVAILABLE type indicates script issue', () => {
      const error = new ExtractionError(
        'Content script not loaded',
        ExtractionErrorType.CONTENT_SCRIPT_UNAVAILABLE
      );
      expect(error.type).toBe('content_script_unavailable');
    });

    it('RESTRICTED_URL type indicates access restriction', () => {
      const error = new ExtractionError(
        'Cannot access chrome:// URLs',
        ExtractionErrorType.RESTRICTED_URL
      );
      expect(error.type).toBe('restricted_url');
    });

    it('MESSAGING_ERROR type indicates runtime communication issue', () => {
      const error = new ExtractionError(
        'Runtime disconnected',
        ExtractionErrorType.MESSAGING_ERROR
      );
      expect(error.type).toBe('messaging_error');
    });

    it('UNKNOWN type is the default fallback', () => {
      const error = new ExtractionError('Something unexpected happened');
      expect(error.type).toBe('unknown');
    });
  });

  describe('service method signatures', () => {
    it('extractCurrentTab returns a Promise', () => {
      const service = createExtractionService('sidebar');
      // Just verify the method returns a promise-like object
      const result = service.extractCurrentTab({ maxRetries: 0, timeout: 1 });
      expect(result).toBeInstanceOf(Promise);
      // Clean up the pending promise
      result.catch(() => {}); // Ignore the error since we're not testing the actual extraction
    });

    it('extractTabs returns a Promise', () => {
      const service = createExtractionService('sidebar');
      const result = service.extractTabs([], { maxRetries: 0 });
      expect(result).toBeInstanceOf(Promise);
    });

    it('getAllTabs returns a Promise', () => {
      const service = createExtractionService('sidebar');
      const result = service.getAllTabs();
      expect(result).toBeInstanceOf(Promise);
      // Clean up the pending promise
      result.catch(() => {});
    });
  });

  describe('batch result calculations', () => {
    // These tests verify the calculation logic using the empty case
    // Full integration tests with mocked messaging would test non-empty cases

    it('calculates 0% success rate for empty batch', async () => {
      const service = createExtractionService('sidebar');
      const result = await service.extractTabs([]);
      expect(result.successRate).toBe(0);
    });

    it('has matching success + failure = total for empty batch', async () => {
      const service = createExtractionService('sidebar');
      const result = await service.extractTabs([]);
      expect(result.successCount + result.failureCount).toBe(result.totalTabs);
    });

    it('results array length matches totalTabs for empty batch', async () => {
      const service = createExtractionService('sidebar');
      const result = await service.extractTabs([]);
      expect(result.results.length).toBe(result.totalTabs);
    });
  });
});
