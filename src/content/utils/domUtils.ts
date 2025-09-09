/**
 * @file DOM Utilities
 *
 * Safe DOM manipulation utilities for tab content extraction.
 * All functions are designed to be non-mutating and handle edge cases gracefully.
 */

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
export function normalizeUrls(
  html: string,
  baseUrl: string,
  preserveLinks: boolean = false
): string {
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
            const normalized = value
              .split(',')
              .map(src => {
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
              })
              .join(', ');

            element.setAttribute(attr, normalized);
          } else {
            // Skip data URLs, hashes, and javascript:
            if (
              value.startsWith('data:') ||
              value.startsWith('#') ||
              value.startsWith('javascript:') ||
              value.startsWith('mailto:') ||
              value.startsWith('tel:')
            ) {
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
          // Ignore URL normalization errors - keep original value
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
    doc
      .querySelectorAll('link[rel="stylesheet"], link[as="style"], style')
      .forEach(el => el.remove());

    // Step 2: Remove hidden elements (before removing styles if we need visibility info)
    if (!preserveStyles) {
      // Remove elements with inline display:none or visibility:hidden
      doc
        .querySelectorAll(
          '[style*="display: none"], [style*="display:none"], [style*="visibility: hidden"], [style*="visibility:hidden"]'
        )
        .forEach(el => el.remove());

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
      if (!el.textContent?.trim() && !el.querySelector('img, video, iframe, audio, svg')) {
        el.remove();
      }
    });

    // Step 5: Remove common noise elements
    const noiseSelectors = [
      'nav',
      'header',
      'footer',
      '[role="navigation"]',
      '[role="banner"]',
      '[role="contentinfo"]',
      '.sidebar',
      '.menu',
      '.advertisement',
      '.ads',
      '.cookie-banner',
      '#cookie-consent',
      '.popup',
      '.modal',
      '.overlay',
    ];

    doc.querySelectorAll(noiseSelectors.join(', ')).forEach(el => el.remove());

    return doc.body.innerHTML;
  } catch (error) {
    return html; // Return original HTML if cleaning fails
  }
}

// =============================================================================
// Post-Strip (Defuddle-only structural tag removal)
// =============================================================================

/**
 * Removes structural HTML containers while preserving inner content.
 * Intended for use AFTER Defuddle extraction and initial cleaning.
 *
 * - Unwraps: span, div, section, article
 * - Flattens tables by unwrapping table/thead/tbody/tfoot/tr/th/td/colgroup/col
 *   and adding lightweight spacing/newlines to keep cell text readable.
 * - Skips elements inside code/pre to avoid mangling code blocks.
 */
export function postStripHtmlElements(html: string): string {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const isInside = (el: Element, selector: string) => {
      let node: Element | null = el;
      while (node && node !== doc.body) {
        if (node.matches(selector)) return true;
        node = node.parentElement;
      }
      return false;
    };

    const unwrap = (el: Element) => {
      const parent = el.parentNode;
      if (!parent) return;
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
      parent.removeChild(el);
    };

    // Unwrap lightweight containers first (skip code/pre)
    const containerTags = ['span', 'div', 'section', 'article'];
    for (const tag of containerTags) {
      doc.querySelectorAll(tag).forEach(el => {
        try {
          if (isInside(el, 'pre, code')) return;
          unwrap(el);
        } catch {
          /* ignore */
        }
      });
    }

    // Table flattening: handle cells first, then rows, then table wrappers
    const addSpaceBefore = (el: Element, text: string) => {
      try {
        const prev = el.previousSibling;
        if (!(prev && prev.nodeType === Node.TEXT_NODE && /\s$/.test(prev.textContent || ''))) {
          el.parentNode?.insertBefore(doc.createTextNode(text), el);
        }
      } catch {
        /* ignore */
      }
    };

    const addNewlineAfter = (el: Element) => {
      try {
        const next = el.nextSibling;
        if (!(next && next.nodeType === Node.TEXT_NODE && /^\n/.test(next.textContent || ''))) {
          el.parentNode?.insertBefore(doc.createTextNode('\n'), next || null);
        }
      } catch {
        /* ignore */
      }
    };

    // Cells: add space separators, then unwrap
    doc.querySelectorAll('td, th').forEach(cell => {
      try {
        if (isInside(cell, 'pre, code')) return;
        addSpaceBefore(cell, ' ');
        unwrap(cell);
      } catch {
        /* ignore */
      }
    });

    // Rows: add newline after the row, then unwrap
    doc.querySelectorAll('tr').forEach(row => {
      try {
        if (isInside(row, 'pre, code')) return;
        addNewlineAfter(row);
        unwrap(row);
      } catch {
        /* ignore */
      }
    });

    // Table wrappers: unwrap entirely
    doc.querySelectorAll('table, thead, tbody, tfoot, colgroup, col').forEach(wrapper => {
      try {
        if (isInside(wrapper, 'pre, code')) return;
        unwrap(wrapper);
      } catch {
        /* ignore */
      }
    });

    // Normalize whitespace a bit after unwrapping
    let result = doc.body.innerHTML;
    result = result.replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
    return result;
  } catch {
    return html; // On any failure, return original
  }
}
