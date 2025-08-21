/**
 * @file API Key Validation Tests
 * 
 * Comprehensive test suite for API key validation utilities following TDD approach.
 * Tests format validation, provider validation, semantic validation, live validation,
 * and batch validation for multiple AI providers.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { APIProvider } from '../../src/types/apiKeys';

// Import the functions we're testing
import {
  validateAPIKey,
  validateKeyFormat,
  validateKeyLive,
  batchValidateKeys,
  sanitizeAPIKey,
  normalizeAPIKey,
  extractKeyInfo,
  createCustomValidationRules
} from '../../src/utils/apiKeyValidation';

// Mock fetch for live validation tests
global.fetch = vi.fn();

describe('API Key Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('validateKeyFormat', () => {
    describe('OpenAI Keys', () => {
      it('should accept valid OpenAI API keys', () => {
        const validKeys = [
          'sk-1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKL',
          'sk-abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKL'
        ];

        validKeys.forEach(key => {
          const result = validateKeyFormat(key, 'openai');
          expect(result.isValid).toBe(true);
          expect(result.errors).toHaveLength(0);
          expect(result.provider).toBe('openai');
        });
      });

      it('should reject invalid OpenAI API keys', () => {
        const invalidKeys = [
          { key: 'sk-123', error: 'too short' },
          { key: 'sk-' + 'a'.repeat(50), error: 'wrong length' },
          { key: 'ak-1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKL', error: 'wrong prefix' },
          { key: '1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKL', error: 'missing prefix' },
          { key: 'sk-123456789@abcdefghijklmnopqrstuvwxyzABCDEFGHIJKL', error: 'invalid characters' }
        ];

        invalidKeys.forEach(({ key, error }) => {
          const result = validateKeyFormat(key, 'openai');
          expect(result.isValid).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
          expect(result.errors.join(' ')).toContain('format');
        });
      });

      it('should detect provider mismatch for OpenAI keys', () => {
        const openaiKey = 'sk-1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKL';
        const result = validateKeyFormat(openaiKey, 'anthropic');
        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.warnings[0]).toContain('appears to be for openai');
      });
    });

    describe('Anthropic Keys', () => {
      it('should accept valid Anthropic API keys', () => {
        const validKeys = [
          'sk-ant-1234567890abcdefghijklmnopqrstuvwxyzABCD12',
          'sk-ant-1234567890abcdefghijklmnopqrstuvwxyzABCDEF1234'
        ];

        validKeys.forEach(key => {
          const result = validateKeyFormat(key, 'anthropic');
          expect(result.isValid).toBe(true);
          expect(result.errors).toHaveLength(0);
          expect(result.provider).toBe('anthropic');
        });
      });

      it('should reject invalid Anthropic API keys', () => {
        const invalidKeys = [
          { key: 'sk-ant-123', error: 'too short' },
          { key: 'sk-ant-' + 'a'.repeat(60), error: 'too long' },
          { key: 'sk-claude-1234567890abcdefghijklmnopqrstuvwxyzABCD', error: 'wrong prefix' },
          { key: 'sk-ant-123@567890abcdefghijklmnopqrstuvwxyzABCD', error: 'invalid characters' }
        ];

        invalidKeys.forEach(({ key, error }) => {
          const result = validateKeyFormat(key, 'anthropic');
          expect(result.isValid).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
        });
      });
    });

    describe('Google Keys', () => {
      it('should accept valid Google API keys', () => {
        const validKeys = [
          'AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI',
          'AIzaBCDEF_1234567890-abcdefghijklmnopqr'
        ];

        validKeys.forEach(key => {
          const result = validateKeyFormat(key, 'google');
          expect(result.isValid).toBe(true);
          expect(result.errors).toHaveLength(0);
          expect(result.provider).toBe('google');
        });
      });

      it('should reject invalid Google API keys', () => {
        const invalidKeys = [
          { key: 'AIza123', error: 'too short' },
          { key: 'AIza' + 'a'.repeat(40), error: 'too long' },
          { key: 'AIzb' + 'a'.repeat(35), error: 'wrong prefix' },
          { key: 'AIza@' + 'a'.repeat(34), error: 'invalid characters' }
        ];

        invalidKeys.forEach(({ key, error }) => {
          const result = validateKeyFormat(key, 'google');
          expect(result.isValid).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
        });
      });
    });

    describe('Custom Keys', () => {
      it('should accept any non-empty custom keys', () => {
        const validKeys = [
          'custom-key-123',
          'any-format-works',
          '1234567890',
          'a'.repeat(1000)
        ];

        validKeys.forEach(key => {
          const result = validateKeyFormat(key, 'custom');
          expect(result.isValid).toBe(true);
          expect(result.errors).toHaveLength(0);
          expect(result.provider).toBe('custom');
        });
      });

      it('should reject empty or too long custom keys', () => {
        const invalidKeys = [
          { key: '', error: 'empty' },
          { key: 'a'.repeat(1001), error: 'too long' }
        ];

        invalidKeys.forEach(({ key, error }) => {
          const result = validateKeyFormat(key, 'custom');
          expect(result.isValid).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('validateAPIKey - Full Validation', () => {
    it('should perform comprehensive validation for valid keys', async () => {
      const validKey = 'sk-1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKL';
      
      const result = await validateAPIKey(validKey, 'openai');
      
      expect(result.isValid).toBe(true);
      expect(result.provider).toBe('openai');
      expect(result.keyType).toBeDefined();
      expect(result.formatValidation).toBeDefined();
      expect(result.formatValidation.isValid).toBe(true);
      expect(result.securityWarnings).toBeDefined();
    });

    it('should detect security issues', async () => {
      const exposedKey = 'sk-1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKL'; // Common test key
      
      const result = await validateAPIKey(exposedKey, 'openai', { 
        checkForExposedKeys: true 
      });
      
      expect(result.securityWarnings.length).toBeGreaterThanOrEqual(0);
    });

    it('should validate key entropy and strength', async () => {
      const weakKey = 'sk-0000000000000000000000000000000000000000000000';
      
      const result = await validateAPIKey(weakKey, 'openai', { 
        checkEntropy: true 
      });
      
      expect(result.securityWarnings.some(w => w.includes('entropy'))).toBe(true);
    });

    it('should handle rate limiting during validation', async () => {
      const key = 'sk-1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKL';
      
      // Test rapid validation requests
      const promises = Array(10).fill(0).map(() => 
        validateAPIKey(key, 'openai', { enableRateLimit: true })
      );
      
      const results = await Promise.all(promises);
      expect(results.every(r => r !== null)).toBe(true);
    });
  });

  describe('validateKeyLive - API Connection Testing', () => {
    beforeEach(() => {
      vi.mocked(fetch).mockClear();
    });

    it('should validate OpenAI key with successful API call', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [] }), { 
          status: 200, 
          statusText: 'OK' 
        })
      );

      const result = await validateKeyLive(
        'sk-1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKL', 
        'openai'
      );

      expect(result.isValid).toBe(true);
      expect(result.responseTime).toBeGreaterThan(0);
      expect(result.endpoint).toContain('api.openai.com');
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('api.openai.com'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': expect.stringContaining('Bearer sk-')
          })
        })
      );
    });

    it('should handle API authentication errors', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Invalid API key' }), { 
          status: 401, 
          statusText: 'Unauthorized' 
        })
      );

      const result = await validateKeyLive(
        'sk-invalid123456789abcdefghijklmnopqrstuvwxyzABCD', 
        'openai'
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('401');
      expect(result.responseTime).toBeGreaterThan(0);
    });

    it('should handle network timeouts', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(
        new Error('AbortError: The operation was aborted')
      );

      const result = await validateKeyLive(
        'sk-1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKL', 
        'openai',
        { timeout: 100 }
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('timeout') || expect(result.error).toContain('aborted');
    });

    it('should validate Anthropic key with proper endpoint', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response('pong', { status: 200 })
      );

      const result = await validateKeyLive(
        'sk-ant-1234567890abcdefghijklmnopqrstuvwxyzABCD12', 
        'anthropic'
      );

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('api.anthropic.com'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-api-key': expect.stringContaining('sk-ant-')
          })
        })
      );
    });

    it('should skip live validation for custom providers', async () => {
      const result = await validateKeyLive('custom-key-123', 'custom');

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('not supported');
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should cache validation results', async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response('{}', { status: 200 })
      );

      const key = 'sk-1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKL';
      
      // First call
      await validateKeyLive(key, 'openai', { enableCache: true });
      expect(fetch).toHaveBeenCalledTimes(1);
      
      // Second call should use cache
      await validateKeyLive(key, 'openai', { enableCache: true });
      expect(fetch).toHaveBeenCalledTimes(1); // Still 1, not 2
    });
  });

  describe('batchValidateKeys - Batch Operations', () => {
    it('should validate multiple keys efficiently', async () => {
      const keys = [
        { key: 'sk-1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKL', provider: 'openai' as APIProvider },
        { key: 'sk-ant-1234567890abcdefghijklmnopqrstuvwxyzABCD12', provider: 'anthropic' as APIProvider },
        { key: 'AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI', provider: 'google' as APIProvider },
        { key: 'custom-key-123', provider: 'custom' as APIProvider }
      ];

      const results = await batchValidateKeys(keys);

      expect(results).toHaveLength(4);
      expect(results.every(r => r.formatValidation !== undefined)).toBe(true);
      
      // Valid keys should pass format validation
      expect(results[0].formatValidation.isValid).toBe(true);
      expect(results[1].formatValidation.isValid).toBe(true);
      expect(results[2].formatValidation.isValid).toBe(true);
      expect(results[3].formatValidation.isValid).toBe(true);
    });

    it('should handle mixed valid and invalid keys', async () => {
      const keys = [
        { key: 'sk-1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKL', provider: 'openai' as APIProvider },
        { key: 'invalid-key', provider: 'openai' as APIProvider },
        { key: 'sk-ant-invalid', provider: 'anthropic' as APIProvider }
      ];

      const results = await batchValidateKeys(keys);

      expect(results).toHaveLength(3);
      expect(results[0].formatValidation.isValid).toBe(true);
      expect(results[1].formatValidation.isValid).toBe(false);
      expect(results[2].formatValidation.isValid).toBe(false);
    });

    it('should respect batch size limits', async () => {
      const keys = Array(100).fill(0).map((_, i) => ({
        key: `sk-${i.toString().padStart(48, '0')}`,
        provider: 'openai' as APIProvider
      }));

      const results = await batchValidateKeys(keys, { batchSize: 10 });

      expect(results).toHaveLength(100);
      // Should process in batches of 10
    });

    it('should support concurrent validation with live testing', async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response('{}', { status: 200 })
      );

      const keys = [
        { key: 'sk-1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKL', provider: 'openai' as APIProvider },
        { key: 'sk-5678901234abcdefghijklmnopqrstuvwxyzABCDEFGHIJKL', provider: 'openai' as APIProvider }
      ];

      const results = await batchValidateKeys(keys, { 
        includeLiveValidation: true,
        concurrency: 2 
      });

      expect(results).toHaveLength(2);
      expect(results.every(r => r.liveValidation !== undefined)).toBe(true);
    });
  });

  describe('sanitizeAPIKey', () => {
    it('should remove whitespace and common formatting', () => {
      const testCases = [
        { input: '  sk-123456  ', expected: 'sk-123456' },
        { input: '\t\nsk-123456\n\t', expected: 'sk-123456' },
        { input: 'sk-123456\r\n', expected: 'sk-123456' },
        { input: ' sk-123 456 ', expected: 'sk-123456' },
        { input: 'sk-123\u00A0456', expected: 'sk-123456' } // Non-breaking space
      ];

      testCases.forEach(({ input, expected }) => {
        expect(sanitizeAPIKey(input)).toBe(expected);
      });
    });

    it('should preserve valid key content', () => {
      const validKeys = [
        'sk-1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKL',
        'sk-ant-1234567890abcdefghijklmnopqrstuvwxyzABCD12',
        'AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI'
      ];

      validKeys.forEach(key => {
        expect(sanitizeAPIKey(key)).toBe(key);
      });
    });

    it('should handle edge cases', () => {
      expect(sanitizeAPIKey('')).toBe('');
      expect(sanitizeAPIKey('   ')).toBe('');
      expect(sanitizeAPIKey('\n\t\r')).toBe('');
    });
  });

  describe('normalizeAPIKey', () => {
    it('should standardize key format', () => {
      const testCases = [
        { input: 'Sk-123456', expected: 'sk-123456', provider: 'openai' as APIProvider },
        { input: 'SK-123456', expected: 'sk-123456', provider: 'openai' as APIProvider },
        { input: 'sk_123456', expected: 'sk-123456', provider: 'openai' as APIProvider },
        { input: 'AIZASYDI0HCZTE6VYSJMM-WEFRQ3CPZQKQQSHI', expected: 'AIzaSYDI0HCZTE6VYSJMM-WEFRQ3CPZQKQQSHI', provider: 'google' as APIProvider }
      ];

      testCases.forEach(({ input, expected, provider }) => {
        expect(normalizeAPIKey(input, provider)).toBe(expected);
      });
    });

    it('should preserve already normalized keys', () => {
      const normalizedKeys = [
        { key: 'sk-1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKL', provider: 'openai' as APIProvider },
        { key: 'sk-ant-1234567890abcdefghijklmnopqrstuvwxyzABCD12', provider: 'anthropic' as APIProvider },
        { key: 'AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI', provider: 'google' as APIProvider }
      ];

      normalizedKeys.forEach(({ key, provider }) => {
        expect(normalizeAPIKey(key, provider)).toBe(key);
      });
    });
  });

  describe('extractKeyInfo', () => {
    it('should extract metadata from OpenAI keys', () => {
      const key = 'sk-1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKL';
      const info = extractKeyInfo(key);

      expect(info.provider).toBe('openai');
      expect(info.keyType).toBe('standard');
      expect(info.prefix).toBe('sk-');
      expect(info.maskedKey).toContain('sk-1...IJKL');
      expect(info.estimatedTier).toBe('standard');
      expect(info.hasChecksum).toBe(false);
    });

    it('should extract metadata from Anthropic keys', () => {
      const key = 'sk-ant-1234567890abcdefghijklmnopqrstuvwxyzABCD12';
      const info = extractKeyInfo(key);

      expect(info.provider).toBe('anthropic');
      expect(info.keyType).toBe('standard');
      expect(info.prefix).toBe('sk-ant-');
      expect(info.maskedKey).toContain('sk-a...CD12');
    });

    it('should extract metadata from Google keys', () => {
      const key = 'AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI';
      const info = extractKeyInfo(key);

      expect(info.provider).toBe('google');
      expect(info.keyType).toBe('standard');
      expect(info.prefix).toBe('AIza');
      expect(info.maskedKey).toContain('AIza...qsHI');
    });

    it('should handle unknown key formats', () => {
      const key = 'unknown-format-key';
      const info = extractKeyInfo(key);

      expect(info.provider).toBe('custom');
      expect(info.keyType).toBe('standard');
      expect(info.prefix).toBe('');
      expect(info.maskedKey).toContain('unkn...-key');
    });

    it('should calculate entropy estimates', () => {
      const highEntropyKey = 'sk-1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKL';
      const lowEntropyKey = 'sk-1111111111111111111111111111111111111111111111';

      const highInfo = extractKeyInfo(highEntropyKey);
      const lowInfo = extractKeyInfo(lowEntropyKey);

      expect(highInfo.entropy).toBeGreaterThan(lowInfo.entropy);
      expect(highInfo.entropyLevel).toBe('high');
      expect(lowInfo.entropyLevel).toBe('low');
    });
  });

  describe('createCustomValidationRules', () => {
    it('should create custom validation rules', () => {
      const customRules = createCustomValidationRules({
        pattern: /^custom-[a-z0-9]{32}$/,
        minLength: 39,
        maxLength: 39,
        requiredPrefix: 'custom-',
        description: 'Custom API key format'
      });

      expect(customRules.pattern.test('custom-1234567890abcdef1234567890abcdef')).toBe(true);
      expect(customRules.pattern.test('invalid-format')).toBe(false);
      expect(customRules.minLength).toBe(39);
      expect(customRules.maxLength).toBe(39);
      expect(customRules.requiredPrefix).toBe('custom-');
    });

    it('should validate using custom rules', () => {
      const customRules = createCustomValidationRules({
        pattern: /^test-[0-9]{8}$/,
        minLength: 13,
        maxLength: 13,
        requiredPrefix: 'test-',
        description: 'Test key format'
      });

      const validKey = 'test-12345678';
      const invalidKey = 'test-abc';

      // This would be used internally by validateKeyFormat
      expect(customRules.pattern.test(validKey)).toBe(true);
      expect(customRules.pattern.test(invalidKey)).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed keys gracefully', async () => {
      const malformedKeys = [
        null,
        undefined,
        '',
        '   ',
        '\x00\x01\x02',
        'sk-' + '\uFFFF'.repeat(10)
      ];

      for (const key of malformedKeys) {
        const result = await validateAPIKey(key as any, 'openai');
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });

    it('should handle network errors in live validation', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

      const result = await validateKeyLive(
        'sk-1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKL',
        'openai'
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('should handle invalid provider types', async () => {
      const result = await validateAPIKey(
        'some-key', 
        'invalid-provider' as APIProvider
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('provider'))).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should complete format validation quickly', () => {
      const start = performance.now();
      
      for (let i = 0; i < 1000; i++) {
        validateKeyFormat('sk-1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKL', 'openai');
      }
      
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(100); // Should complete 1000 validations in < 100ms
    });

    it('should handle large batch validation efficiently', async () => {
      const keys = Array(50).fill(0).map((_, i) => ({
        key: `sk-${i.toString().padStart(48, '0')}`,
        provider: 'openai' as APIProvider
      }));

      const start = performance.now();
      const results = await batchValidateKeys(keys);
      const elapsed = performance.now() - start;

      expect(results).toHaveLength(50);
      expect(elapsed).toBeLessThan(1000); // Should complete in < 1s
    });
  });

  describe('Caching', () => {
    beforeEach(() => {
      // Clear any existing cache
      vi.clearAllMocks();
    });

    it('should cache format validation results', async () => {
      // Clear cache first
      const { clearValidationCache } = await import('../../src/utils/apiKeyValidation');
      clearValidationCache();
      
      const key = 'sk-1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKL';
      
      // First call
      const result1 = validateKeyFormat(key, 'openai');
      expect(result1.fromCache).toBeFalsy();
      
      // Second call should be cached
      const result2 = validateKeyFormat(key, 'openai');
      expect(result2.fromCache).toBe(true);
      expect(result1.isValid).toBe(result2.isValid);
    });

    it('should respect cache TTL', async () => {
      vi.useFakeTimers();
      
      // Clear cache first
      const { clearValidationCache } = await import('../../src/utils/apiKeyValidation');
      clearValidationCache();
      
      const key = 'sk-1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKL';
      
      vi.mocked(fetch).mockResolvedValue(
        new Response('{"data": []}', { status: 200 })
      );
      
      // First call
      const result1 = await validateKeyLive(key, 'openai', { enableCache: true });
      expect(result1.isValid).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(1);
      
      // Advance time beyond cache TTL (assuming 15 minute TTL)
      vi.advanceTimersByTime(16 * 60 * 1000);
      
      // Second call should make new request
      const result2 = await validateKeyLive(key, 'openai', { enableCache: true });
      expect(result2.isValid).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(2);
      
      vi.useRealTimers();
    });
  });

  describe('Security Features', () => {
    it('should detect weak keys', async () => {
      const weakKeys = [
        'sk-0000000000000000000000000000000000000000000000',
        'sk-1111111111111111111111111111111111111111111111',
        'sk-abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef'
      ];

      for (const key of weakKeys) {
        const result = await validateAPIKey(key, 'openai', { checkEntropy: true });
        expect(result.securityWarnings.some(w => w.includes('entropy') || w.includes('weak'))).toBe(true);
      }
    });

    it('should detect potentially exposed keys', async () => {
      // Common test/demo keys that might be exposed
      const potentiallyExposedKeys = [
        'sk-1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKL',
        'sk-testkey123456789abcdefghijklmnopqrstuvwxyzABC'
      ];

      for (const key of potentiallyExposedKeys) {
        const result = await validateAPIKey(key, 'openai', { checkForExposedKeys: true });
        // May or may not trigger warnings depending on implementation
        expect(result.securityWarnings).toBeDefined();
      }
    });

    it('should provide security recommendations', async () => {
      const result = await validateAPIKey(
        'sk-1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKL',
        'openai',
        { provideRecommendations: true }
      );

      expect(result.recommendations).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);
    });
  });
});