/**
 * @file Unit Tests for DOM Utilities
 *
 * Comprehensive unit tests for DOM manipulation and metadata extraction utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { isVisible, getPageMetadata, clampText } from '@/tabext/domUtils';
import type { PageMetadata, ClampResult } from '@/tabext/domUtils';

// Mock window.getComputedStyle for testing
const mockGetComputedStyle = vi.fn();

beforeEach(() => {
  // Reset mocks before each test
  vi.clearAllMocks();

  // Mock window.getComputedStyle
  Object.defineProperty(window, 'getComputedStyle', {
    value: mockGetComputedStyle,
    writable: true,
  });

  // Mock window dimensions
  Object.defineProperty(window, 'innerWidth', {
    value: 1024,
    writable: true,
  });

  Object.defineProperty(window, 'innerHeight', {
    value: 768,
    writable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('isVisible', () => {
  describe('null/undefined elements', () => {
    it('should return false for null element', () => {
      expect(isVisible(null)).toBe(false);
    });

    it('should return false for undefined element', () => {
      expect(isVisible(undefined)).toBe(false);
    });
  });

  describe('display style tests', () => {
    it('should return false for display:none elements', () => {
      const element = document.createElement('div');

      mockGetComputedStyle.mockReturnValue({
        display: 'none',
        visibility: 'visible',
        opacity: '1',
        position: 'static',
      });

      element.getBoundingClientRect = vi.fn().mockReturnValue({
        width: 100,
        height: 50,
        top: 0,
        left: 0,
        right: 100,
        bottom: 50,
      });

      expect(isVisible(element)).toBe(false);
    });

    it('should return false for visibility:hidden elements', () => {
      const element = document.createElement('div');

      mockGetComputedStyle.mockReturnValue({
        display: 'block',
        visibility: 'hidden',
        opacity: '1',
        position: 'static',
      });

      element.getBoundingClientRect = vi.fn().mockReturnValue({
        width: 100,
        height: 50,
        top: 0,
        left: 0,
        right: 100,
        bottom: 50,
      });

      expect(isVisible(element)).toBe(false);
    });

    it('should return false for opacity:0 elements', () => {
      const element = document.createElement('div');

      mockGetComputedStyle.mockReturnValue({
        display: 'block',
        visibility: 'visible',
        opacity: '0',
        position: 'static',
      });

      element.getBoundingClientRect = vi.fn().mockReturnValue({
        width: 100,
        height: 50,
        top: 0,
        left: 0,
        right: 100,
        bottom: 50,
      });

      expect(isVisible(element)).toBe(false);
    });
  });

  describe('aria-hidden tests', () => {
    it('should return false for aria-hidden="true" elements', () => {
      const element = document.createElement('div');
      element.setAttribute('aria-hidden', 'true');

      mockGetComputedStyle.mockReturnValue({
        display: 'block',
        visibility: 'visible',
        opacity: '1',
        position: 'static',
      });

      element.getBoundingClientRect = vi.fn().mockReturnValue({
        width: 100,
        height: 50,
        top: 0,
        left: 0,
        right: 100,
        bottom: 50,
      });

      expect(isVisible(element)).toBe(false);
    });

    it('should return true for aria-hidden="false" elements', () => {
      const element = document.createElement('div');
      element.setAttribute('aria-hidden', 'false');

      mockGetComputedStyle.mockReturnValue({
        display: 'block',
        visibility: 'visible',
        opacity: '1',
        position: 'static',
      });

      element.getBoundingClientRect = vi.fn().mockReturnValue({
        width: 100,
        height: 50,
        top: 0,
        left: 0,
        right: 100,
        bottom: 50,
      });

      expect(isVisible(element)).toBe(true);
    });
  });

  describe('offscreen positioning tests', () => {
    it('should return false for zero-dimension elements', () => {
      const element = document.createElement('div');

      mockGetComputedStyle.mockReturnValue({
        display: 'block',
        visibility: 'visible',
        opacity: '1',
        position: 'static',
      });

      element.getBoundingClientRect = vi.fn().mockReturnValue({
        width: 0,
        height: 0,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      });

      expect(isVisible(element)).toBe(false);
    });

    it('should return false for elements positioned far left of viewport', () => {
      const element = document.createElement('div');

      mockGetComputedStyle.mockReturnValue({
        display: 'block',
        visibility: 'visible',
        opacity: '1',
        position: 'static',
      });

      element.getBoundingClientRect = vi.fn().mockReturnValue({
        width: 100,
        height: 50,
        top: 100,
        left: -200,
        right: -100,
        bottom: 150,
      });

      expect(isVisible(element)).toBe(false);
    });

    it('should return false for elements positioned far right of viewport', () => {
      const element = document.createElement('div');

      mockGetComputedStyle.mockReturnValue({
        display: 'block',
        visibility: 'visible',
        opacity: '1',
        position: 'static',
      });

      element.getBoundingClientRect = vi.fn().mockReturnValue({
        width: 100,
        height: 50,
        top: 100,
        left: 1200,
        right: 1300,
        bottom: 150,
      });

      expect(isVisible(element)).toBe(false);
    });

    it('should return false for elements positioned far above viewport', () => {
      const element = document.createElement('div');

      mockGetComputedStyle.mockReturnValue({
        display: 'block',
        visibility: 'visible',
        opacity: '1',
        position: 'static',
      });

      element.getBoundingClientRect = vi.fn().mockReturnValue({
        width: 100,
        height: 50,
        top: -200,
        left: 100,
        right: 200,
        bottom: -150,
      });

      expect(isVisible(element)).toBe(false);
    });

    it('should return false for elements positioned far below viewport', () => {
      const element = document.createElement('div');

      mockGetComputedStyle.mockReturnValue({
        display: 'block',
        visibility: 'visible',
        opacity: '1',
        position: 'static',
      });

      element.getBoundingClientRect = vi.fn().mockReturnValue({
        width: 100,
        height: 50,
        top: 1000,
        left: 100,
        right: 200,
        bottom: 1050,
      });

      expect(isVisible(element)).toBe(false);
    });

    it('should return true for position:fixed offscreen elements', () => {
      const element = document.createElement('div');

      mockGetComputedStyle.mockReturnValue({
        display: 'block',
        visibility: 'visible',
        opacity: '1',
        position: 'fixed',
      });

      element.getBoundingClientRect = vi.fn().mockReturnValue({
        width: 100,
        height: 50,
        top: -200,
        left: -200,
        right: -100,
        bottom: -150,
      });

      expect(isVisible(element)).toBe(true);
    });

    it('should return true for partially visible elements within tolerance', () => {
      const element = document.createElement('div');

      mockGetComputedStyle.mockReturnValue({
        display: 'block',
        visibility: 'visible',
        opacity: '1',
        position: 'static',
      });

      // Element slightly offscreen but within tolerance
      element.getBoundingClientRect = vi.fn().mockReturnValue({
        width: 100,
        height: 50,
        top: 100,
        left: -5, // Within 10px tolerance
        right: 95,
        bottom: 150,
      });

      expect(isVisible(element)).toBe(true);
    });
  });

  describe('visible elements', () => {
    it('should return true for fully visible elements', () => {
      const element = document.createElement('div');

      mockGetComputedStyle.mockReturnValue({
        display: 'block',
        visibility: 'visible',
        opacity: '1',
        position: 'static',
      });

      element.getBoundingClientRect = vi.fn().mockReturnValue({
        width: 200,
        height: 100,
        top: 100,
        left: 100,
        right: 300,
        bottom: 200,
      });

      expect(isVisible(element)).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should return true when getComputedStyle throws an error', () => {
      const element = document.createElement('div');

      mockGetComputedStyle.mockImplementation(() => {
        throw new Error('getComputedStyle failed');
      });

      expect(isVisible(element)).toBe(true);
    });

    it('should return true when getBoundingClientRect throws an error', () => {
      const element = document.createElement('div');

      mockGetComputedStyle.mockReturnValue({
        display: 'block',
        visibility: 'visible',
        opacity: '1',
        position: 'static',
      });

      element.getBoundingClientRect = vi.fn().mockImplementation(() => {
        throw new Error('getBoundingClientRect failed');
      });

      expect(isVisible(element)).toBe(true);
    });
  });

  describe('performance benchmarks', () => {
    it('should complete visibility check in reasonable time', () => {
      const element = document.createElement('div');

      mockGetComputedStyle.mockReturnValue({
        display: 'block',
        visibility: 'visible',
        opacity: '1',
        position: 'static',
      });

      element.getBoundingClientRect = vi.fn().mockReturnValue({
        width: 100,
        height: 50,
        top: 0,
        left: 0,
        right: 100,
        bottom: 50,
      });

      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        isVisible(element);
      }
      const end = performance.now();

      // Should complete 1000 checks in under 50ms
      expect(end - start).toBeLessThan(50);
    });
  });
});

describe('getPageMetadata', () => {
  describe('null/undefined document', () => {
    it('should return default metadata for null document', () => {
      const result = getPageMetadata(null);
      expect(result).toEqual({ title: 'Unknown Page' });
    });

    it('should return default metadata for undefined document', () => {
      const result = getPageMetadata(undefined);
      expect(result).toEqual({ title: 'Unknown Page' });
    });
  });

  describe('complete metadata extraction', () => {
    it('should extract all metadata when available', () => {
      const { window } = new JSDOM(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Document Title</title>
            <meta property="og:title" content="OpenGraph Title" />
            <meta name="author" content="John Doe" />
            <meta property="article:published_time" content="2023-12-01T10:00:00Z" />
            <meta name="description" content="Page description" />
          </head>
        </html>
      `);

      const result = getPageMetadata(window.document);

      expect(result).toEqual({
        title: 'OpenGraph Title', // og:title takes priority
        author: 'John Doe',
        publishedDate: '2023-12-01T10:00:00Z',
        description: 'Page description',
      });
    });
  });

  describe('title priority selection', () => {
    it('should prioritize og:title over document.title', () => {
      const { window } = new JSDOM(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Document Title</title>
            <meta property="og:title" content="OpenGraph Title" />
          </head>
        </html>
      `);

      const result = getPageMetadata(window.document);
      expect(result.title).toBe('OpenGraph Title');
    });

    it('should use twitter:title when og:title is not available', () => {
      const { window } = new JSDOM(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Document Title</title>
            <meta name="twitter:title" content="Twitter Title" />
          </head>
        </html>
      `);

      const result = getPageMetadata(window.document);
      expect(result.title).toBe('Twitter Title');
    });

    it('should fall back to document.title when meta titles are not available', () => {
      const { window } = new JSDOM(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Document Title</title>
          </head>
        </html>
      `);

      const result = getPageMetadata(window.document);
      expect(result.title).toBe('Document Title');
    });

    it('should use "Untitled Page" when no title is available', () => {
      const { window } = new JSDOM(`
        <!DOCTYPE html>
        <html>
          <head></head>
        </html>
      `);

      const result = getPageMetadata(window.document);
      expect(result.title).toBe('Untitled Page');
    });

    it('should prefer og:title even when twitter:title is also present', () => {
      const { window } = new JSDOM(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Document Title</title>
            <meta property="og:title" content="OpenGraph Title" />
            <meta name="twitter:title" content="Twitter Title" />
          </head>
        </html>
      `);

      const result = getPageMetadata(window.document);
      expect(result.title).toBe('OpenGraph Title');
    });
  });

  describe('author extraction', () => {
    it('should extract author from name="author"', () => {
      const { window } = new JSDOM(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Test</title>
            <meta name="author" content="Jane Smith" />
          </head>
        </html>
      `);

      const result = getPageMetadata(window.document);
      expect(result.author).toBe('Jane Smith');
    });

    it('should extract author from article:author property', () => {
      const { window } = new JSDOM(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Test</title>
            <meta property="article:author" content="Article Author" />
          </head>
        </html>
      `);

      const result = getPageMetadata(window.document);
      expect(result.author).toBe('Article Author');
    });

    it('should extract author from name="creator"', () => {
      const { window } = new JSDOM(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Test</title>
            <meta name="creator" content="Content Creator" />
          </head>
        </html>
      `);

      const result = getPageMetadata(window.document);
      expect(result.author).toBe('Content Creator');
    });
  });

  describe('date extraction', () => {
    it('should extract date from article:published_time', () => {
      const { window } = new JSDOM(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Test</title>
            <meta property="article:published_time" content="2023-12-01T15:30:00Z" />
          </head>
        </html>
      `);

      const result = getPageMetadata(window.document);
      expect(result.publishedDate).toBe('2023-12-01T15:30:00Z');
    });

    it('should extract date from time element datetime attribute', () => {
      const { window } = new JSDOM(`
        <!DOCTYPE html>
        <html>
          <head><title>Test</title></head>
          <body>
            <time datetime="2023-11-15T09:00:00Z">Yesterday</time>
          </body>
        </html>
      `);

      const result = getPageMetadata(window.document);
      expect(result.publishedDate).toBe('2023-11-15T09:00:00Z');
    });

    it('should prioritize meta tags over time elements', () => {
      const { window } = new JSDOM(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Test</title>
            <meta name="datePublished" content="2023-12-01T10:00:00Z" />
          </head>
          <body>
            <time datetime="2023-11-15T09:00:00Z">Different Date</time>
          </body>
        </html>
      `);

      const result = getPageMetadata(window.document);
      expect(result.publishedDate).toBe('2023-12-01T10:00:00Z');
    });
  });

  describe('missing metadata handling', () => {
    it('should not include author when not available', () => {
      const { window } = new JSDOM(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Test Title</title>
          </head>
        </html>
      `);

      const result = getPageMetadata(window.document);
      expect(result).toEqual({ title: 'Test Title' });
      expect(result.author).toBeUndefined();
    });

    it('should handle empty meta content gracefully', () => {
      const { window } = new JSDOM(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Test</title>
            <meta name="author" content="" />
            <meta name="description" content="   " />
          </head>
        </html>
      `);

      const result = getPageMetadata(window.document);
      expect(result.author).toBeUndefined();
      expect(result.description).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('should return fallback metadata when extraction fails', () => {
      // Create a mock document that throws errors
      const mockDocument = {
        title: 'Fallback Title',
        querySelector: vi.fn().mockImplementation(() => {
          throw new Error('querySelector failed');
        }),
        querySelectorAll: vi.fn().mockImplementation(() => {
          throw new Error('querySelectorAll failed');
        }),
      } as unknown as Document;

      const result = getPageMetadata(mockDocument);
      expect(result).toEqual({ title: 'Fallback Title' });
    });
  });

  describe('performance benchmarks', () => {
    it('should extract metadata in reasonable time', () => {
      const { window } = new JSDOM(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Performance Test</title>
            <meta property="og:title" content="OG Title" />
            <meta name="author" content="Test Author" />
            <meta name="description" content="Test Description" />
          </head>
        </html>
      `);

      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        getPageMetadata(window.document);
      }
      const end = performance.now();

      // Should complete 100 extractions in under 20ms
      expect(end - start).toBeLessThan(20);
    });
  });
});

describe('clampText', () => {
  describe('null/undefined text handling', () => {
    it('should handle null text', () => {
      const result = clampText(null, 100);
      expect(result).toEqual({
        text: '',
        isTruncated: false,
      });
    });

    it('should handle undefined text', () => {
      const result = clampText(undefined, 100);
      expect(result).toEqual({
        text: '',
        isTruncated: false,
      });
    });

    it('should handle empty string', () => {
      const result = clampText('', 100);
      expect(result).toEqual({
        text: '',
        isTruncated: false,
      });
    });
  });

  describe('maxChars validation', () => {
    it('should throw error for negative maxChars', () => {
      expect(() => clampText('test', -1)).toThrow('maxChars must be non-negative');
    });

    it('should handle zero maxChars', () => {
      const result = clampText('hello world', 0);
      expect(result).toEqual({
        text: '',
        isTruncated: true,
      });
    });

    it('should handle zero maxChars with empty text', () => {
      const result = clampText('', 0);
      expect(result).toEqual({
        text: '',
        isTruncated: false,
      });
    });
  });

  describe('text shorter than limit', () => {
    it('should return original text when under limit', () => {
      const text = 'Short text';
      const result = clampText(text, 100);

      expect(result).toEqual({
        text: 'Short text',
        isTruncated: false,
      });
    });

    it('should return original text when exactly at limit', () => {
      const text = 'Exact';
      const result = clampText(text, 5);

      expect(result).toEqual({
        text: 'Exact',
        isTruncated: false,
      });
    });
  });

  describe('text longer than limit', () => {
    it('should truncate text when over limit', () => {
      const text = 'This is a very long text that should be truncated';
      const result = clampText(text, 20);

      expect(result).toEqual({
        text: 'This is a very long ',
        isTruncated: true,
      });
    });

    it('should truncate to single character when maxChars is 1', () => {
      const text = 'Hello';
      const result = clampText(text, 1);

      expect(result).toEqual({
        text: 'H',
        isTruncated: true,
      });
    });
  });

  describe('isTruncated flag accuracy', () => {
    it('should set isTruncated to false when no truncation occurs', () => {
      const result = clampText('short', 10);
      expect(result.isTruncated).toBe(false);
    });

    it('should set isTruncated to true when truncation occurs', () => {
      const result = clampText('this is longer than limit', 10);
      expect(result.isTruncated).toBe(true);
    });

    it('should set isTruncated correctly for edge cases', () => {
      // Empty text with zero limit
      expect(clampText('', 0).isTruncated).toBe(false);

      // Non-empty text with zero limit
      expect(clampText('a', 0).isTruncated).toBe(true);

      // Text exactly at limit
      expect(clampText('exact', 5).isTruncated).toBe(false);
    });
  });

  describe('unicode and special characters', () => {
    it('should handle unicode characters correctly', () => {
      // Note: JavaScript substring treats each Unicode code unit separately
      // Emoji characters may be composed of multiple UTF-16 code units
      const text = '😀😃😄😁😆';
      const result = clampText(text, 3);

      // The function works at the JavaScript string level (UTF-16 code units)
      // so we expect the first 3 UTF-16 code units, not 3 emoji
      expect(result.text.length).toBe(3);
      expect(result.isTruncated).toBe(true);
    });

    it('should handle newlines and special whitespace', () => {
      const text = 'Line 1\nLine 2\tTabbed';
      const result = clampText(text, 10);

      expect(result).toEqual({
        text: 'Line 1\nLin',
        isTruncated: true,
      });
    });

    it('should handle mixed unicode and ASCII', () => {
      const text = 'Hello 世界 World';
      const result = clampText(text, 8);

      // Should truncate to 8 characters: "Hello 世界"
      expect(result).toEqual({
        text: 'Hello 世界',
        isTruncated: true,
      });
    });
  });

  describe('performance benchmarks', () => {
    it('should clamp large text efficiently', () => {
      // Create a large text string
      const largeText = 'A'.repeat(10000);

      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        clampText(largeText, 100);
      }
      const end = performance.now();

      // Should complete 1000 clamps in under 10ms
      expect(end - start).toBeLessThan(10);
    });

    it('should handle multiple clamp operations efficiently', () => {
      const texts = [
        'Short text',
        'Medium length text that needs some consideration',
        'Very long text that definitely needs to be truncated because it exceeds reasonable limits',
        '',
        'A'.repeat(1000),
      ];

      const start = performance.now();
      for (let i = 0; i < 200; i++) {
        texts.forEach(text => clampText(text, 50));
      }
      const end = performance.now();

      // Should complete 1000 operations (200 * 5) in under 20ms
      expect(end - start).toBeLessThan(20);
    });
  });
});
