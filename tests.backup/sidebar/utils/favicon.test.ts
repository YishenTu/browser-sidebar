/**
 * @file Tests for Favicon Utilities
 * Tests favicon URL generation, caching, and fallback behavior.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getFaviconUrl,
  getFaviconUrlSync,
  clearFaviconCache,
  getFaviconCacheStats,
  preloadFavicon,
  type FaviconOptions,
  type FaviconResult,
} from '@/sidebar/utils/favicon';

// Mock fetch globally
global.fetch = vi.fn();

describe('Favicon Utilities', () => {
  beforeEach(() => {
    clearFaviconCache();
    vi.clearAllMocks();
  });

  describe('getFaviconUrlSync', () => {
    it('should return Google favicon service URL by default', () => {
      const result = getFaviconUrlSync('https://example.com/page');
      
      expect(result).toEqual({
        url: 'https://www.google.com/s2/favicons?domain=example.com&sz=16',
        isFallback: false,
        source: 'google',
      });
    });

    it('should use tab favicon when useGoogleService is false', () => {
      const tabFavIconUrl = 'https://example.com/favicon.ico';
      const result = getFaviconUrlSync(
        'https://example.com/page',
        tabFavIconUrl,
        { useGoogleService: false }
      );
      
      expect(result).toEqual({
        url: tabFavIconUrl,
        isFallback: false,
        source: 'tab',
      });
    });

    it('should use generic fallback when no tab favicon and useGoogleService is false', () => {
      const result = getFaviconUrlSync(
        'https://example.com/page',
        undefined,
        { useGoogleService: false }
      );
      
      expect(result.source).toBe('generic');
      expect(result.isFallback).toBe(true);
      expect(result.url.startsWith('data:image/svg+xml')).toBe(true);
    });

    it('should handle different favicon sizes', () => {
      const result32 = getFaviconUrlSync('https://example.com/page', undefined, { size: 32 });
      const result64 = getFaviconUrlSync('https://example.com/page', undefined, { size: 64 });
      
      expect(result32.url).toContain('&sz=32');
      expect(result64.url).toContain('&sz=64');
    });

    it('should return cached result', () => {
      // First call
      const result1 = getFaviconUrlSync('https://example.com/page');
      
      // Second call should return same result (from cache conceptually, but sync version doesn't actually cache)
      const result2 = getFaviconUrlSync('https://example.com/page');
      
      expect(result1).toEqual(result2);
    });

    it('should extract domain correctly from complex URLs', () => {
      const urls = [
        'https://subdomain.example.com/path/to/page?query=1#hash',
        'http://example.com:8080/page',
        'https://example.com/page/',
      ];

      urls.forEach((url) => {
        const result = getFaviconUrlSync(url);
        expect(result.url).toContain('domain=');
        expect(result.source).toBe('google');
      });
    });

    it('should handle invalid URLs gracefully', () => {
      const result = getFaviconUrlSync('not-a-url');
      
      expect(result.source).toBe('google');
      expect(result.url).toContain('domain=');
    });
  });

  describe('getFaviconUrl', () => {
    it('should return Google service URL when accessible', async () => {
      // Mock successful fetch
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        type: 'basic',
      });

      const result = await getFaviconUrl('https://example.com/page');
      
      expect(result).toEqual({
        url: 'https://www.google.com/s2/favicons?domain=example.com&sz=16',
        isFallback: false,
        source: 'google',
      });
    });

    it('should fallback to tab favicon when Google service fails', async () => {
      const tabFavIconUrl = 'https://example.com/favicon.ico';
      
      // Mock failed Google service but successful tab favicon
      (global.fetch as any)
        .mockResolvedValueOnce({ ok: false }) // Google service fails
        .mockResolvedValueOnce({ ok: true }); // Tab favicon succeeds

      const result = await getFaviconUrl('https://example.com/page', tabFavIconUrl);
      
      expect(result).toEqual({
        url: tabFavIconUrl,
        isFallback: true,
        source: 'tab',
      });
    });

    it('should fallback to generic icon when all sources fail', async () => {
      // Mock all fetches failing
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      const result = await getFaviconUrl('https://example.com/page', 'https://example.com/favicon.ico');
      
      expect(result.source).toBe('generic');
      expect(result.isFallback).toBe(true);
      expect(result.url.startsWith('data:image/svg+xml')).toBe(true);
    });

    it('should handle network errors and use fallback', async () => {
      // Mock fetch failing (simulates timeout or network error)
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      const result = await getFaviconUrl('https://example.com/page', undefined, { timeout: 100 });
      
      // Should use generic fallback on network error
      expect(result.source).toBe('generic');
      expect(result.isFallback).toBe(true);
    });

    it('should use tab favicon first when useGoogleService is false', async () => {
      const tabFavIconUrl = 'https://example.com/favicon.ico';
      
      // Mock successful tab favicon fetch
      (global.fetch as any).mockResolvedValueOnce({ ok: true });

      const result = await getFaviconUrl(
        'https://example.com/page', 
        tabFavIconUrl,
        { useGoogleService: false }
      );
      
      expect(result).toEqual({
        url: tabFavIconUrl,
        isFallback: false,
        source: 'tab',
      });

      // Should not have called Google service
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cache Management', () => {
    it('should clear cache successfully', () => {
      // Get a result to populate cache
      getFaviconUrlSync('https://example.com/page');
      
      clearFaviconCache();
      
      const stats = getFaviconCacheStats();
      expect(stats.size).toBe(0);
      expect(stats.entries).toHaveLength(0);
    });

    it('should provide cache statistics', async () => {
      // Mock successful fetch
      (global.fetch as any).mockResolvedValue({ ok: true });

      await getFaviconUrl('https://example1.com/page');
      await getFaviconUrl('https://example2.com/page');
      
      const stats = getFaviconCacheStats();
      expect(stats.size).toBe(2);
      expect(stats.entries).toHaveLength(2);
      
      stats.entries.forEach(entry => {
        expect(entry).toHaveProperty('key');
        expect(entry).toHaveProperty('timestamp');
        expect(entry).toHaveProperty('expires');
        expect(entry).toHaveProperty('source');
      });
    });
  });

  describe('preloadFavicon', () => {
    it('should preload favicon without returning result', async () => {
      // Mock successful fetch
      (global.fetch as any).mockResolvedValue({ ok: true });

      await preloadFavicon('https://example.com/page');
      
      // Should have made a fetch call
      expect(fetch).toHaveBeenCalledTimes(1);
      
      // Should have cached the result
      const stats = getFaviconCacheStats();
      expect(stats.size).toBe(1);
    });
  });

  describe('Domain Extraction', () => {
    it('should extract domains correctly', () => {
      const testCases = [
        { url: 'https://www.google.com/search', expectedDomain: 'www.google.com' },
        { url: 'http://example.com:8080/path', expectedDomain: 'example.com' },
        { url: 'https://subdomain.example.co.uk/page?q=1', expectedDomain: 'subdomain.example.co.uk' },
        { url: 'ftp://files.example.com/file.txt', expectedDomain: 'files.example.com' },
      ];

      testCases.forEach(({ url, expectedDomain }) => {
        const result = getFaviconUrlSync(url);
        expect(result.url).toContain(`domain=${encodeURIComponent(expectedDomain)}`);
      });
    });

    it('should handle malformed URLs', () => {
      const malformedUrls = [
        'not-a-url',
        'http://',
        'https:///',
        'example.com',
      ];

      malformedUrls.forEach((url) => {
        // Should not throw
        expect(() => getFaviconUrlSync(url)).not.toThrow();
        
        const result = getFaviconUrlSync(url);
        expect(result.url).toContain('domain=');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle fetch errors gracefully', async () => {
      // Mock fetch throwing an error
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      const result = await getFaviconUrl('https://example.com/page');
      
      expect(result.source).toBe('generic');
      expect(result.isFallback).toBe(true);
    });

    it('should handle opaque responses from no-cors fetch', async () => {
      // Mock opaque response (successful no-cors)
      (global.fetch as any).mockResolvedValue({
        ok: false,
        type: 'opaque',
      });

      const result = await getFaviconUrl('https://example.com/page');
      
      expect(result.source).toBe('google');
      expect(result.isFallback).toBe(false);
    });
  });
});