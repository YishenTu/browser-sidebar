/**
 * @file DOM Utilities
 *
 * Safe DOM manipulation and metadata extraction utilities for tab content extraction.
 * All functions are designed to be non-mutating and handle edge cases gracefully.
 */

// =============================================================================
// Types and Interfaces
// =============================================================================

/**
 * Page metadata extracted from document
 */
export interface PageMetadata {
  /** Page title (required) */
  title: string;
  /** Author name (optional) */
  author?: string;
  /** Published date (optional) */
  publishedDate?: string;
  /** Page description (optional) */
  description?: string;
}

/**
 * Text clamping result
 */
export interface ClampResult {
  /** Clamped text content */
  text: string;
  /** Whether the text was truncated */
  isTruncated: boolean;
}

// =============================================================================
// Visibility Detection
// =============================================================================

/**
 * Checks if an element is visible to users
 *
 * @param element - DOM element to check
 * @returns true if element is visible, false otherwise
 */
export function isVisible(element: Element | null | undefined): boolean {
  // Handle null/undefined elements
  if (!element) {
    return false;
  }

  try {
    // Get computed styles - this can throw in some edge cases
    const style = window.getComputedStyle(element);

    // Check for display: none
    if (style.display === 'none') {
      return false;
    }

    // Check for visibility: hidden
    if (style.visibility === 'hidden') {
      return false;
    }

    // Check for aria-hidden="true"
    if (element.getAttribute('aria-hidden') === 'true') {
      return false;
    }

    // Check for opacity: 0 (effectively invisible)
    if (parseFloat(style.opacity) === 0) {
      return false;
    }

    // Check for offscreen positioning (unless position: fixed)
    if (style.position !== 'fixed') {
      const rect = element.getBoundingClientRect();

      // Element is completely offscreen
      if (rect.width === 0 && rect.height === 0) {
        return false;
      }

      // Element is positioned far off viewport (common hiding technique)
      const viewport = {
        width: window.innerWidth || document.documentElement.clientWidth,
        height: window.innerHeight || document.documentElement.clientHeight,
      };

      // Allow some tolerance for partially visible elements
      const tolerance = 10;
      if (
        rect.right < -tolerance ||
        rect.bottom < -tolerance ||
        rect.left > viewport.width + tolerance ||
        rect.top > viewport.height + tolerance
      ) {
        return false;
      }
    }

    return true;
  } catch (error) {
    // If we can't determine visibility (e.g., in detached nodes), assume visible
    // This is a conservative approach that avoids missing content
    return true;
  }
}

// =============================================================================
// Metadata Extraction
// =============================================================================

/**
 * Extracts page metadata without modifying the DOM
 *
 * @param document - Document to extract metadata from
 * @returns Page metadata object
 */
export function getPageMetadata(document: Document | null | undefined): PageMetadata {
  if (!document) {
    return { title: 'Unknown Page' };
  }

  try {
    // Extract title with fallback priority
    const title = getMetaTitle(document) || getDocumentTitle(document) || 'Untitled Page';

    // Extract author
    const author = getMetaAuthor(document);

    // Extract published date
    const publishedDate = getPublishedDate(document);

    // Extract description
    const description = getMetaDescription(document);

    return {
      title,
      ...(author && { author }),
      ...(publishedDate && { publishedDate }),
      ...(description && { description }),
    };
  } catch (error) {
    // Fallback to minimal metadata on any error
    return {
      title: document.title || 'Unknown Page',
    };
  }
}

/**
 * Gets title from meta tags with priority order
 */
function getMetaTitle(document: Document): string | null {
  // Try Open Graph title first
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) {
    const content = ogTitle.getAttribute('content');
    if (content?.trim()) {
      return content.trim();
    }
  }

  // Try Twitter title
  const twitterTitle = document.querySelector('meta[name="twitter:title"]');
  if (twitterTitle) {
    const content = twitterTitle.getAttribute('content');
    if (content?.trim()) {
      return content.trim();
    }
  }

  return null;
}

/**
 * Gets document title safely
 */
function getDocumentTitle(document: Document): string | null {
  return document.title?.trim() || null;
}

/**
 * Gets author from meta tags
 */
function getMetaAuthor(document: Document): string | null {
  // Try various author meta tags
  const authorSelectors = [
    'meta[name="author"]',
    'meta[name="article:author"]',
    'meta[property="article:author"]',
    'meta[name="creator"]',
  ];

  for (const selector of authorSelectors) {
    const meta = document.querySelector(selector);
    if (meta) {
      const content = meta.getAttribute('content');
      if (content?.trim()) {
        return content.trim();
      }
    }
  }

  return null;
}

/**
 * Gets published date from various sources
 */
function getPublishedDate(document: Document): string | null {
  // Try meta tags first
  const dateSelectors = [
    'meta[property="article:published_time"]',
    'meta[name="article:published_time"]',
    'meta[name="datePublished"]',
    'meta[name="date"]',
    'meta[name="published"]',
  ];

  for (const selector of dateSelectors) {
    const meta = document.querySelector(selector);
    if (meta) {
      const content = meta.getAttribute('content');
      if (content?.trim()) {
        return content.trim();
      }
    }
  }

  // Try time elements with datetime attribute
  const timeElements = document.querySelectorAll('time[datetime]');
  for (let i = 0; i < timeElements.length; i++) {
    const timeEl = timeElements[i];
    if (timeEl) {
      const datetime = timeEl.getAttribute('datetime');
      if (datetime?.trim()) {
        return datetime.trim();
      }
    }
  }

  return null;
}

/**
 * Gets description from meta tags
 */
function getMetaDescription(document: Document): string | null {
  // Try various description meta tags
  const descriptionSelectors = [
    'meta[name="description"]',
    'meta[property="og:description"]',
    'meta[name="twitter:description"]',
  ];

  for (const selector of descriptionSelectors) {
    const meta = document.querySelector(selector);
    if (meta) {
      const content = meta.getAttribute('content');
      if (content?.trim()) {
        return content.trim();
      }
    }
  }

  return null;
}

// =============================================================================
// URL Normalization
// =============================================================================

/**
 * Normalizes URLs in HTML content to absolute URLs for offline viewing
 * Focuses on images and media, not text links
 * 
 * @param html - HTML content to process
 * @param baseUrl - Base URL for resolving relative URLs
 * @param preserveLinks - Whether to normalize link hrefs (default: false)
 * @returns HTML with normalized URLs
 */
export function normalizeUrls(html: string, baseUrl: string, preserveLinks: boolean = false): string {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const base = new URL(baseUrl);
    
    // Process elements with URLs - exclude href unless preserveLinks is true
    const urlAttributes = preserveLinks 
      ? ['src', 'href', 'srcset', 'data-src', 'data-srcset']
      : ['src', 'srcset', 'data-src', 'data-srcset']; // Skip href for links
    const selector = urlAttributes.map(attr => `[${attr}]`).join(', ');
    
    doc.querySelectorAll(selector).forEach(element => {
      urlAttributes.forEach(attr => {
        const value = element.getAttribute(attr);
        if (!value) return;
        
        try {
          if (attr === 'srcset' || attr === 'data-srcset') {
            // Handle responsive images with srcset
            const normalized = value.split(',').map(src => {
              const parts = src.trim().split(/\s+/);
              const url = parts[0];
              const descriptor = parts.slice(1).join(' ');
              
              // Skip data URLs and hashes
              if (!url || url.startsWith('data:') || url.startsWith('#')) {
                return src;
              }
              
              try {
                const absoluteUrl = new URL(url, base).href;
                return descriptor ? `${absoluteUrl} ${descriptor}` : absoluteUrl;
              } catch {
                return src; // Keep original if URL parsing fails
              }
            }).join(', ');
            
            element.setAttribute(attr, normalized);
          } else {
            // Skip data URLs, hashes, and javascript:
            if (value.startsWith('data:') || 
                value.startsWith('#') || 
                value.startsWith('javascript:') ||
                value.startsWith('mailto:') ||
                value.startsWith('tel:')) {
              return;
            }
            
            // Handle protocol-relative URLs
            let urlToNormalize = value;
            if (value.startsWith('//')) {
              urlToNormalize = base.protocol + value;
            }
            
            // Handle custom protocols that might be HTTP(S) URLs
            // Some extensions use custom protocols like chrome-extension://, moz-extension://
            // We'll try to coerce these conservatively
            const customProtocolMatch = value.match(/^([a-z]+-[a-z]+):\/\//);
            if (customProtocolMatch) {
              // Check if it looks like a web URL (has domain-like structure)
              const afterProtocol = value.substring(customProtocolMatch[0].length);
              if (afterProtocol.match(/^[a-z0-9.-]+\//i)) {
                // Try to replace with https:// for better compatibility
                urlToNormalize = 'https://' + afterProtocol;
              }
            }
            
            try {
              const absoluteUrl = new URL(urlToNormalize, base).href;
              element.setAttribute(attr, absoluteUrl);
            } catch {
              // If URL parsing fails, try to handle special cases
              if (value.startsWith('/')) {
                // Absolute path - use base origin
                element.setAttribute(attr, base.origin + value);
              }
              // Otherwise keep original value
            }
          }
        } catch (error) {
          console.warn(`Failed to normalize URL attribute ${attr}:`, error);
        }
      });
    });
    
    // Also normalize URLs in inline styles (background-image, etc.)
    doc.querySelectorAll('[style]').forEach(element => {
      const style = element.getAttribute('style');
      if (style && style.includes('url(')) {
        const normalizedStyle = style.replace(/url\(['"]?([^'")]+)['"]?\)/g, (match, url) => {
          // Skip data URLs
          if (url.startsWith('data:') || url.startsWith('#')) {
            return match;
          }
          
          try {
            const absoluteUrl = new URL(url, base).href;
            return `url('${absoluteUrl}')`;
          } catch {
            return match; // Keep original if URL parsing fails
          }
        });
        element.setAttribute('style', normalizedStyle);
      }
    });
    
    return doc.body.innerHTML;
  } catch (error) {
    console.error('Failed to normalize URLs:', error);
    return html; // Return original HTML if normalization fails
  }
}

/**
 * Cleans HTML content following Obsidian's proven cleaning order
 * 
 * @param html - HTML content to clean
 * @param preserveStyles - Whether to preserve inline styles (default: false)
 * @returns Cleaned HTML
 */
export function cleanHtml(html: string, preserveStyles: boolean = false): string {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Step 1: Security - Remove all scripts (except JSON-LD) and stylesheets
    doc.querySelectorAll('script:not([type="application/ld+json"])').forEach(el => el.remove());
    doc.querySelectorAll('link[rel="stylesheet"], link[as="style"], style').forEach(el => el.remove());
    
    // Step 2: Remove hidden elements (before removing styles if we need visibility info)
    if (!preserveStyles) {
      // Remove elements with inline display:none or visibility:hidden
      doc.querySelectorAll('[style*="display: none"], [style*="display:none"], [style*="visibility: hidden"], [style*="visibility:hidden"]').forEach(el => el.remove());
      
      // Remove elements with hidden attribute
      doc.querySelectorAll('[hidden]').forEach(el => el.remove());
    }
    
    // Step 3: Cleanliness - Remove all inline styles
    if (!preserveStyles) {
      doc.querySelectorAll('*').forEach(el => {
        el.removeAttribute('style');
        el.removeAttribute('class'); // Also remove classes since CSS is gone
      });
    }
    
    // Step 4: Remove empty decorative elements
    doc.querySelectorAll('p, div, span').forEach(el => {
      if (!el.textContent?.trim() && 
          !el.querySelector('img, video, iframe, audio, svg')) {
        el.remove();
      }
    });
    
    // Step 5: Remove common noise elements
    const noiseSelectors = [
      'nav', 'header', 'footer',
      '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
      '.sidebar', '.menu', '.advertisement', '.ads', '.cookie-banner',
      '#cookie-consent', '.popup', '.modal', '.overlay'
    ];
    
    doc.querySelectorAll(noiseSelectors.join(', ')).forEach(el => el.remove());
    
    return doc.body.innerHTML;
  } catch (error) {
    console.error('Failed to clean HTML:', error);
    return html; // Return original HTML if cleaning fails
  }
}

// =============================================================================
// Text Utilities
// =============================================================================

/**
 * Safely truncates text to maximum character count
 *
 * @param text - Text to truncate (can be null/undefined)
 * @param maxChars - Maximum number of characters
 * @returns Clamp result with text and truncation flag
 */
export function clampText(text: string | null | undefined, maxChars: number): ClampResult {
  // Handle null/undefined/empty text
  if (!text) {
    return {
      text: '',
      isTruncated: false,
    };
  }

  // Validate maxChars parameter
  if (maxChars < 0) {
    throw new Error('maxChars must be non-negative');
  }

  if (maxChars === 0) {
    return {
      text: '',
      isTruncated: text.length > 0,
    };
  }

  // No truncation needed
  if (text.length <= maxChars) {
    return {
      text,
      isTruncated: false,
    };
  }

  // Truncate the text
  return {
    text: text.substring(0, maxChars),
    isTruncated: true,
  };
}
