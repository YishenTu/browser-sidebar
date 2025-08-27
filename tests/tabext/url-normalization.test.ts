import { describe, it, expect, beforeEach } from 'vitest';
import { normalizeUrls } from '@tabext/domUtils';

describe('URL Normalization', () => {
  const baseUrl = 'https://example.com/path/page.html';

  describe('href attribute normalization', () => {
    it('should normalize relative href when preserveLinks is true', () => {
      const html = '<a href="/about">About</a>';
      const result = normalizeUrls(html, baseUrl, true);
      expect(result).toContain('href="https://example.com/about"');
    });

    it('should NOT normalize href when preserveLinks is false (default)', () => {
      const html = '<a href="/about">About</a>';
      const result = normalizeUrls(html, baseUrl, false);
      expect(result).toContain('href="/about"'); // Should remain unchanged
    });

    it('should handle protocol-relative URLs in href', () => {
      const html = '<a href="//cdn.example.com/page">Link</a>';
      const result = normalizeUrls(html, baseUrl, true);
      expect(result).toContain('href="https://cdn.example.com/page"');
    });

    it('should preserve mailto and tel links', () => {
      const html = '<a href="mailto:test@example.com">Email</a><a href="tel:+1234567890">Call</a>';
      const result = normalizeUrls(html, baseUrl, true);
      expect(result).toContain('href="mailto:test@example.com"');
      expect(result).toContain('href="tel:+1234567890"');
    });
  });

  describe('src attribute normalization', () => {
    it('should always normalize relative src URLs', () => {
      const html = '<img src="/images/photo.jpg" />';
      const result = normalizeUrls(html, baseUrl);
      expect(result).toContain('src="https://example.com/images/photo.jpg"');
    });

    it('should handle protocol-relative src URLs', () => {
      const html = '<img src="//cdn.example.com/image.png" />';
      const result = normalizeUrls(html, baseUrl);
      expect(result).toContain('src="https://cdn.example.com/image.png"');
    });

    it('should preserve data URLs in src', () => {
      const html = '<img src="data:image/png;base64,iVBORw..." />';
      const result = normalizeUrls(html, baseUrl);
      expect(result).toContain('src="data:image/png;base64,iVBORw..."');
    });

    it('should normalize script and iframe src', () => {
      const html = '<script src="/js/app.js"></script><iframe src="/embed"></iframe>';
      const result = normalizeUrls(html, baseUrl);
      expect(result).toContain('src="https://example.com/js/app.js"');
      expect(result).toContain('src="https://example.com/embed"');
    });
  });

  describe('srcset attribute normalization', () => {
    it('should normalize all URLs in srcset', () => {
      const html = '<img srcset="/img1.jpg 1x, /img2.jpg 2x, /img3.jpg 3x" />';
      const result = normalizeUrls(html, baseUrl);
      expect(result).toContain('https://example.com/img1.jpg 1x');
      expect(result).toContain('https://example.com/img2.jpg 2x');
      expect(result).toContain('https://example.com/img3.jpg 3x');
    });

    it('should handle srcset with width descriptors', () => {
      const html = '<img srcset="/small.jpg 400w, /medium.jpg 800w, /large.jpg 1200w" />';
      const result = normalizeUrls(html, baseUrl);
      expect(result).toContain('https://example.com/small.jpg 400w');
      expect(result).toContain('https://example.com/medium.jpg 800w');
      expect(result).toContain('https://example.com/large.jpg 1200w');
    });

    it('should preserve data URLs in srcset', () => {
      const html = '<img srcset="data:image/png;base64,abc 1x, /fallback.jpg 2x" />';
      const result = normalizeUrls(html, baseUrl);
      expect(result).toContain('data:image/png;base64,abc 1x');
      expect(result).toContain('https://example.com/fallback.jpg 2x');
    });
  });

  describe('inline style URL normalization', () => {
    it('should normalize URLs in background-image', () => {
      const html = '<div style="background-image: url(/bg.jpg)"></div>';
      const result = normalizeUrls(html, baseUrl);
      expect(result).toContain("url('https://example.com/bg.jpg')");
    });

    it('should handle URLs with quotes in inline styles', () => {
      const html = '<div style="background-image: url(\'/bg.jpg\')"></div>';
      const result = normalizeUrls(html, baseUrl);
      expect(result).toContain("url('https://example.com/bg.jpg')");
    });

    it('should handle URLs with double quotes in inline styles', () => {
      const html = '<div style="background-image: url(&quot;/bg.jpg&quot;)"></div>';
      const result = normalizeUrls(html, baseUrl);
      expect(result).toContain("url('https://example.com/bg.jpg')");
    });

    it('should preserve data URLs in inline styles', () => {
      const html = '<div style="background-image: url(data:image/png;base64,xyz)"></div>';
      const result = normalizeUrls(html, baseUrl);
      expect(result).toContain('url(data:image/png;base64,xyz)');
    });

    it('should handle multiple URLs in one style attribute', () => {
      const html = '<div style="background: url(/bg1.jpg), url(/bg2.jpg)"></div>';
      const result = normalizeUrls(html, baseUrl);
      expect(result).toContain("url('https://example.com/bg1.jpg')");
      expect(result).toContain("url('https://example.com/bg2.jpg')");
    });
  });

  describe('custom protocol handling', () => {
    it('should attempt to coerce extension protocols to https', () => {
      const html = '<img src="chrome-extension://abcd1234/icon.png" />';
      const result = normalizeUrls(html, baseUrl);
      // Should try to normalize extension URLs conservatively
      expect(result).toMatch(/src="https?:\/\/abcd1234\/icon\.png"/);
    });

    it('should handle moz-extension protocol', () => {
      const html = '<img src="moz-extension://uuid-here/image.png" />';
      const result = normalizeUrls(html, baseUrl);
      expect(result).toMatch(/src="https?:\/\/uuid-here\/image\.png"/);
    });

    it('should preserve javascript: protocol', () => {
      const html = '<a href="javascript:void(0)">Click</a>';
      const result = normalizeUrls(html, baseUrl, true);
      expect(result).toContain('href="javascript:void(0)"');
    });
  });

  describe('edge cases', () => {
    it('should handle empty attributes gracefully', () => {
      const html = '<img src="" /><a href="">Link</a>';
      const result = normalizeUrls(html, baseUrl, true);
      expect(result).toBeDefined();
      expect(result).toContain('<img');
      expect(result).toContain('<a');
    });

    it('should handle malformed URLs gracefully', () => {
      const html = '<img src="not a valid url" />';
      const result = normalizeUrls(html, baseUrl);
      expect(result).toBeDefined();
      // Should keep original if can't parse
      expect(result).toContain('src="not a valid url"');
    });

    it('should preserve hash links', () => {
      const html = '<a href="#section">Section</a>';
      const result = normalizeUrls(html, baseUrl, true);
      expect(result).toContain('href="#section"');
    });

    it('should handle base tag in document', () => {
      const htmlWithBase = '<base href="https://other.com/"><img src="/image.jpg" />';
      const result = normalizeUrls(htmlWithBase, baseUrl);
      // Should still use provided baseUrl, not base tag
      expect(result).toContain('src="https://example.com/image.jpg"');
    });
  });

  describe('data attributes', () => {
    it('should normalize data-src attributes', () => {
      const html = '<img data-src="/lazy.jpg" />';
      const result = normalizeUrls(html, baseUrl);
      expect(result).toContain('data-src="https://example.com/lazy.jpg"');
    });

    it('should normalize data-srcset attributes', () => {
      const html = '<img data-srcset="/img1.jpg 1x, /img2.jpg 2x" />';
      const result = normalizeUrls(html, baseUrl);
      expect(result).toContain('https://example.com/img1.jpg 1x');
      expect(result).toContain('https://example.com/img2.jpg 2x');
    });
  });
});
