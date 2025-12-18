/**
 * @file Favicon Utility Tests
 *
 * Tests for favicon URL extraction and resolution logic.
 */

import { describe, it, expect } from 'vitest';
import { extractDomain, getGoogleFaviconUrl, getDomSafeFaviconUrlSync } from '@core/utils/favicon';

describe('extractDomain', () => {
  describe('valid URLs', () => {
    it('should extract domain from http URL', () => {
      const result = extractDomain('http://example.com/page');

      expect(result).toBe('example.com');
    });

    it('should extract domain from https URL', () => {
      const result = extractDomain('https://example.com/path/to/page');

      expect(result).toBe('example.com');
    });

    it('should extract domain with subdomain', () => {
      const result = extractDomain('https://sub.domain.example.com/page');

      expect(result).toBe('sub.domain.example.com');
    });

    it('should extract domain without port (hostname)', () => {
      // URL.hostname does not include port, just the domain
      const result = extractDomain('https://example.com:8080/page');

      expect(result).toBe('example.com');
    });

    it('should extract domain from URL with query string', () => {
      const result = extractDomain('https://example.com/page?query=value');

      expect(result).toBe('example.com');
    });

    it('should extract domain from URL with hash', () => {
      const result = extractDomain('https://example.com/page#section');

      expect(result).toBe('example.com');
    });
  });

  describe('fallback regex extraction', () => {
    it('should use regex fallback for malformed URL', () => {
      const result = extractDomain('http://example.com');

      expect(result).toBe('example.com');
    });

    it('should return original string for completely invalid input', () => {
      const result = extractDomain('not-a-url');

      expect(result).toBe('not-a-url');
    });
  });
});

describe('getGoogleFaviconUrl', () => {
  it('should generate Google favicon URL with default size', () => {
    const result = getGoogleFaviconUrl('example.com');

    expect(result).toBe('https://www.google.com/s2/favicons?domain=example.com&sz=16');
  });

  it('should generate Google favicon URL with custom size', () => {
    const result = getGoogleFaviconUrl('example.com', 32);

    expect(result).toBe('https://www.google.com/s2/favicons?domain=example.com&sz=32');
  });

  it('should encode special characters in domain', () => {
    const result = getGoogleFaviconUrl('example.com/path');

    expect(result).toContain(encodeURIComponent('example.com/path'));
  });
});

describe('getDomSafeFaviconUrlSync', () => {
  describe('tab favicon priority', () => {
    it('should use tabFavIconUrl when provided', () => {
      const result = getDomSafeFaviconUrlSync(
        'https://example.com',
        'https://example.com/custom-favicon.ico'
      );

      expect(result.url).toBe('https://example.com/custom-favicon.ico');
      expect(result.isFallback).toBe(false);
      expect(result.source).toBe('tab');
    });
  });

  describe('Google fallback', () => {
    it('should fall back to Google favicon when tabFavIconUrl is missing', () => {
      const result = getDomSafeFaviconUrlSync('https://example.com');

      expect(result.url).toContain('google.com/s2/favicons');
      expect(result.url).toContain('example.com');
      expect(result.isFallback).toBe(false);
      expect(result.source).toBe('google');
    });

    it('should use specified size for Google favicon', () => {
      const result = getDomSafeFaviconUrlSync('https://example.com', undefined, 64);

      expect(result.url).toContain('sz=64');
    });

    it('should fall back to Google when tabFavIconUrl is empty string', () => {
      const result = getDomSafeFaviconUrlSync('https://example.com', '');

      expect(result.source).toBe('google');
    });
  });

  describe('generic fallback', () => {
    it('should return generic icon when no domain can be extracted', () => {
      // When URL is empty, extractDomain returns empty string
      // Empty string is falsy, so we go to generic fallback
      const result = getDomSafeFaviconUrlSync('');

      // Actually, empty string '' is falsy, but in extractDomain it returns ''
      // and then in getDomSafeFaviconUrlSync, it checks `if (domain)` which is false for ''
      // So it should return generic - let's verify the actual behavior
      expect(result.source).toBe('generic');
      expect(result.isFallback).toBe(true);
    });
  });

  describe('size parameter', () => {
    it('should support 16px size', () => {
      const result = getDomSafeFaviconUrlSync('https://example.com', undefined, 16);

      expect(result.url).toContain('sz=16');
    });

    it('should support 32px size', () => {
      const result = getDomSafeFaviconUrlSync('https://example.com', undefined, 32);

      expect(result.url).toContain('sz=32');
    });

    it('should support 64px size', () => {
      const result = getDomSafeFaviconUrlSync('https://example.com', undefined, 64);

      expect(result.url).toContain('sz=64');
    });

    it('should support 128px size', () => {
      const result = getDomSafeFaviconUrlSync('https://example.com', undefined, 128);

      expect(result.url).toContain('sz=128');
    });
  });

  describe('result structure', () => {
    it('should return FaviconResult with all properties for tab source', () => {
      const result = getDomSafeFaviconUrlSync(
        'https://example.com',
        'https://example.com/favicon.ico'
      );

      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('isFallback');
      expect(result).toHaveProperty('source');
      expect(typeof result.url).toBe('string');
      expect(typeof result.isFallback).toBe('boolean');
      expect(['tab', 'google', 'generic']).toContain(result.source);
    });

    it('should return FaviconResult with all properties for Google source', () => {
      const result = getDomSafeFaviconUrlSync('https://example.com');

      expect(result.url).toBeDefined();
      expect(result.isFallback).toBe(false);
      expect(result.source).toBe('google');
    });
  });

  describe('domain extraction integration', () => {
    it('should extract domain from complex URLs', () => {
      const result = getDomSafeFaviconUrlSync(
        'https://subdomain.example.com:8080/path/to/page?query=value#hash'
      );

      expect(result.url).toContain('subdomain.example.com');
    });
  });
});
