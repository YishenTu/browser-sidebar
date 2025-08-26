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
