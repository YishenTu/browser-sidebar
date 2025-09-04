/**
 * @file Metadata Extractor
 *
 * Extracts page metadata including title, author, published date, and description.
 */

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
