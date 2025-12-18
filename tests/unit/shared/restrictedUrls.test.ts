/**
 * @file Restricted URLs Tests
 *
 * Tests for checking restricted URLs that should not be processed.
 */

import { describe, it, expect } from 'vitest';
import { isRestrictedUrl, isValidTabUrl } from '@shared/utils/restrictedUrls';

describe('isRestrictedUrl', () => {
  describe('restricted schemes', () => {
    it('should restrict chrome:// URLs', () => {
      expect(isRestrictedUrl('chrome://settings')).toBe(true);
      expect(isRestrictedUrl('chrome://extensions')).toBe(true);
      expect(isRestrictedUrl('chrome://newtab')).toBe(true);
    });

    it('should restrict chrome-extension:// URLs', () => {
      expect(isRestrictedUrl('chrome-extension://abc123/popup.html')).toBe(true);
    });

    it('should restrict edge:// URLs', () => {
      expect(isRestrictedUrl('edge://settings')).toBe(true);
    });

    it('should restrict about: URLs', () => {
      expect(isRestrictedUrl('about:blank')).toBe(true);
      expect(isRestrictedUrl('about:newtab')).toBe(true);
    });

    it('should restrict chrome-devtools:// URLs', () => {
      expect(isRestrictedUrl('chrome-devtools://devtools/bundled/devtools_app.html')).toBe(true);
    });

    it('should restrict devtools:// URLs', () => {
      expect(isRestrictedUrl('devtools://devtools/bundled/inspector.html')).toBe(true);
    });

    it('should restrict file:// URLs', () => {
      expect(isRestrictedUrl('file:///Users/doc.pdf')).toBe(true);
      expect(isRestrictedUrl('file:///C:/Documents/file.txt')).toBe(true);
    });

    it('should restrict data: URLs', () => {
      expect(isRestrictedUrl('data:text/html,<h1>Hello</h1>')).toBe(true);
      expect(isRestrictedUrl('data:image/png;base64,ABC123')).toBe(true);
    });

    it('should restrict blob: URLs', () => {
      expect(isRestrictedUrl('blob:https://example.com/12345')).toBe(true);
    });

    it('should restrict vivaldi:// URLs', () => {
      expect(isRestrictedUrl('vivaldi://settings')).toBe(true);
    });

    it('should restrict opera:// URLs', () => {
      expect(isRestrictedUrl('opera://settings')).toBe(true);
    });

    it('should restrict brave:// URLs', () => {
      expect(isRestrictedUrl('brave://settings')).toBe(true);
    });

    it('should restrict view-source: URLs', () => {
      expect(isRestrictedUrl('view-source:https://example.com')).toBe(true);
    });

    it('should restrict javascript: URLs', () => {
      expect(isRestrictedUrl('javascript:void(0)')).toBe(true);
      expect(isRestrictedUrl('javascript:alert("test")')).toBe(true);
    });
  });

  describe('restricted domains', () => {
    it('should restrict Chrome Web Store', () => {
      expect(isRestrictedUrl('https://chrome.google.com/webstore/detail/extension')).toBe(true);
      expect(isRestrictedUrl('https://chrome.google.com/webstore/category/extensions')).toBe(true);
    });

    it('should restrict Microsoft Edge Add-ons', () => {
      expect(isRestrictedUrl('https://microsoftedge.microsoft.com/addons/detail/extension')).toBe(
        true
      );
    });

    it('should restrict Mozilla Add-ons', () => {
      expect(isRestrictedUrl('https://addons.mozilla.org/en-US/firefox/addon/extension')).toBe(
        true
      );
    });
  });

  describe('non-restricted URLs', () => {
    it('should allow regular https URLs', () => {
      expect(isRestrictedUrl('https://example.com')).toBe(false);
      expect(isRestrictedUrl('https://google.com/search?q=test')).toBe(false);
    });

    it('should allow regular http URLs', () => {
      expect(isRestrictedUrl('http://example.com')).toBe(false);
      expect(isRestrictedUrl('http://localhost:3000')).toBe(false);
    });

    it('should allow URLs with chrome in domain name', () => {
      expect(isRestrictedUrl('https://chrome-something.com')).toBe(false);
      expect(isRestrictedUrl('https://mychrome.example.com')).toBe(false);
    });
  });

  describe('invalid input handling', () => {
    it('should treat null as restricted', () => {
      expect(isRestrictedUrl(null)).toBe(true);
    });

    it('should treat undefined as restricted', () => {
      expect(isRestrictedUrl(undefined)).toBe(true);
    });

    it('should treat empty string as restricted', () => {
      expect(isRestrictedUrl('')).toBe(true);
    });

    it('should treat invalid URL parse as restricted', () => {
      expect(isRestrictedUrl('not-a-valid-url')).toBe(true);
    });

    it('should treat non-string as restricted', () => {
      expect(isRestrictedUrl(123 as unknown as string)).toBe(true);
    });
  });

  describe('case sensitivity', () => {
    it('should be case-insensitive for schemes', () => {
      expect(isRestrictedUrl('CHROME://settings')).toBe(true);
      expect(isRestrictedUrl('Chrome://Settings')).toBe(true);
    });

    it('should be case-insensitive for domains', () => {
      expect(isRestrictedUrl('https://CHROME.GOOGLE.COM/webstore')).toBe(true);
    });
  });
});

describe('isValidTabUrl', () => {
  it('should return true for valid non-restricted URLs', () => {
    expect(isValidTabUrl('https://example.com')).toBe(true);
    expect(isValidTabUrl('https://google.com/search')).toBe(true);
    expect(isValidTabUrl('http://localhost:3000')).toBe(true);
  });

  it('should return false for restricted URLs', () => {
    expect(isValidTabUrl('chrome://settings')).toBe(false);
    expect(isValidTabUrl('about:blank')).toBe(false);
    expect(isValidTabUrl('file:///path/to/file')).toBe(false);
  });

  it('should return false for non-string input', () => {
    expect(isValidTabUrl(null)).toBe(false);
    expect(isValidTabUrl(undefined)).toBe(false);
    expect(isValidTabUrl(123)).toBe(false);
    expect(isValidTabUrl({})).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(isValidTabUrl('')).toBe(false);
  });

  it('should act as type guard for string', () => {
    const url: unknown = 'https://example.com';

    if (isValidTabUrl(url)) {
      // TypeScript should recognize url as string here
      const length: number = url.length;
      expect(length).toBeGreaterThan(0);
    }
  });
});
