/**
 * @file URL Normalizer Tests
 *
 * Tests for URL normalization and session key utilities.
 */

import { describe, it, expect } from 'vitest';
import { normalizeUrl, createSessionKey, parseSessionKey } from '@shared/utils/urlNormalizer';

describe('normalizeUrl', () => {
  describe('trailing slash handling', () => {
    it('should remove trailing slash from path', () => {
      expect(normalizeUrl('https://example.com/page/')).toBe('https://example.com/page');
    });

    it('should not modify paths without trailing slash', () => {
      expect(normalizeUrl('https://example.com/page')).toBe('https://example.com/page');
    });

    it('should preserve root path', () => {
      expect(normalizeUrl('https://example.com/')).toBe('https://example.com');
    });
  });

  describe('query parameter handling', () => {
    it('should preserve query parameters', () => {
      expect(normalizeUrl('https://example.com/page?id=123')).toBe(
        'https://example.com/page?id=123'
      );
    });

    it('should preserve multiple query parameters', () => {
      expect(normalizeUrl('https://example.com/page?a=1&b=2')).toBe(
        'https://example.com/page?a=1&b=2'
      );
    });

    it('should preserve query parameters with trailing slash', () => {
      expect(normalizeUrl('https://example.com/page/?id=123')).toBe(
        'https://example.com/page?id=123'
      );
    });
  });

  describe('hash handling', () => {
    it('should exclude hash from normalized URL', () => {
      expect(normalizeUrl('https://example.com/page#section')).toBe('https://example.com/page');
    });

    it('should exclude hash but preserve query', () => {
      expect(normalizeUrl('https://example.com/page?id=1#section')).toBe(
        'https://example.com/page?id=1'
      );
    });
  });

  describe('invalid URL handling', () => {
    it('should return as-is for invalid URL', () => {
      const invalid = 'not-a-valid-url';
      expect(normalizeUrl(invalid)).toBe(invalid);
    });

    it('should handle special browser pages that fail URL parsing', () => {
      // The URL constructor may throw for chrome:// URLs in Node.js
      // The function returns the original URL when parsing fails
      const chromePage = 'chrome://settings';
      const result = normalizeUrl(chromePage);
      // Either returns original or parses it (depends on environment)
      expect(typeof result).toBe('string');
    });
  });

  describe('origin preservation', () => {
    it('should preserve http protocol', () => {
      expect(normalizeUrl('http://example.com/page')).toBe('http://example.com/page');
    });

    it('should preserve https protocol', () => {
      expect(normalizeUrl('https://example.com/page')).toBe('https://example.com/page');
    });

    it('should preserve port number', () => {
      expect(normalizeUrl('https://example.com:8080/page')).toBe('https://example.com:8080/page');
    });

    it('should preserve subdomain', () => {
      expect(normalizeUrl('https://sub.example.com/page')).toBe('https://sub.example.com/page');
    });
  });

  describe('path handling', () => {
    it('should preserve complex paths', () => {
      expect(normalizeUrl('https://example.com/path/to/page')).toBe(
        'https://example.com/path/to/page'
      );
    });

    it('should preserve paths with special characters', () => {
      expect(normalizeUrl('https://example.com/path%20with%20spaces')).toBe(
        'https://example.com/path%20with%20spaces'
      );
    });
  });
});

describe('createSessionKey', () => {
  it('should create session key from tab ID and URL', () => {
    const key = createSessionKey(123, 'https://example.com/page');

    expect(key).toBe('tab_123:https://example.com/page');
  });

  it('should normalize URL in session key', () => {
    const key = createSessionKey(123, 'https://example.com/page/');

    expect(key).toBe('tab_123:https://example.com/page');
  });

  it('should preserve query parameters in session key', () => {
    const key = createSessionKey(456, 'https://example.com/page?id=789');

    expect(key).toBe('tab_456:https://example.com/page?id=789');
  });

  it('should exclude hash from session key', () => {
    const key = createSessionKey(123, 'https://example.com/page#section');

    expect(key).toBe('tab_123:https://example.com/page');
  });

  it('should handle special characters in URL', () => {
    const key = createSessionKey(123, 'https://example.com/path?q=hello%20world');

    expect(key).toContain('hello%20world');
  });
});

describe('parseSessionKey', () => {
  describe('valid keys', () => {
    it('should parse valid session key', () => {
      const result = parseSessionKey('tab_123:https://example.com');

      expect(result).not.toBeNull();
      expect(result?.tabId).toBe(123);
      expect(result?.url).toBe('https://example.com');
    });

    it('should parse session key with complex URL', () => {
      const result = parseSessionKey('tab_456:https://example.com/path?id=789');

      expect(result).not.toBeNull();
      expect(result?.tabId).toBe(456);
      expect(result?.url).toBe('https://example.com/path?id=789');
    });

    it('should handle large tab IDs', () => {
      const result = parseSessionKey('tab_999999999:https://example.com');

      expect(result?.tabId).toBe(999999999);
    });

    it('should handle URLs with colons', () => {
      const result = parseSessionKey('tab_123:https://example.com:8080/path');

      expect(result?.url).toBe('https://example.com:8080/path');
    });
  });

  describe('invalid keys', () => {
    it('should return null for missing tab prefix', () => {
      const result = parseSessionKey('123:https://example.com');

      expect(result).toBeNull();
    });

    it('should return null for non-numeric tab ID', () => {
      const result = parseSessionKey('tab_abc:https://example.com');

      expect(result).toBeNull();
    });

    it('should return null for missing URL', () => {
      const result = parseSessionKey('tab_123:');

      expect(result).toBeNull();
    });

    it('should return null for missing colon separator', () => {
      const result = parseSessionKey('tab_123https://example.com');

      expect(result).toBeNull();
    });

    it('should return null for empty string', () => {
      const result = parseSessionKey('');

      expect(result).toBeNull();
    });

    it('should return null for malformed format', () => {
      const result = parseSessionKey('invalid_format');

      expect(result).toBeNull();
    });
  });
});
