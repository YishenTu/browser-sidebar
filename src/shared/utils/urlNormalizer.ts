/**
 * @file URL Normalization Utility
 *
 * Normalizes URLs for consistent session key generation.
 * Ensures that the same logical page generates the same session key.
 */

/**
 * Normalize a URL for session key generation
 *
 * @param url - The URL to normalize
 * @returns Normalized URL string
 *
 * @example
 * normalizeUrl('https://example.com/page/') // 'https://example.com/page'
 * normalizeUrl('https://example.com/page#section') // 'https://example.com/page'
 * normalizeUrl('https://example.com/page?id=123') // 'https://example.com/page?id=123'
 */
export function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);

    // Remove trailing slash from pathname
    let normalized = urlObj.origin + urlObj.pathname.replace(/\/$/, '');

    // Include search params (different params = different session)
    if (urlObj.search) {
      normalized += urlObj.search;
    }

    // Exclude hash by default (same page, different anchor = same session)
    // This can be made configurable later if needed

    return normalized;
  } catch {
    // Return as-is if parsing fails (e.g., for special browser pages)
    return url;
  }
}

/**
 * Create a session key from tab ID and URL
 *
 * @param tabId - The tab ID
 * @param url - The tab URL
 * @returns Session key string
 *
 * @example
 * createSessionKey(123, 'https://example.com/page') // 'tab_123:https://example.com/page'
 */
export function createSessionKey(tabId: number, url: string): string {
  const normalizedUrl = normalizeUrl(url);
  return `tab_${tabId}:${normalizedUrl}`;
}

/**
 * Parse a session key to extract tab ID and URL
 *
 * @param sessionKey - The session key to parse
 * @returns Object with tabId and url, or null if invalid
 *
 * @example
 * parseSessionKey('tab_123:https://example.com') // { tabId: 123, url: 'https://example.com' }
 */
export function parseSessionKey(sessionKey: string): { tabId: number; url: string } | null {
  const match = sessionKey.match(/^tab_(\d+):(.+)$/);
  if (!match || !match[1] || !match[2]) {
    return null;
  }

  const tabId = parseInt(match[1], 10);
  const url = match[2];

  if (isNaN(tabId)) {
    return null;
  }

  return { tabId, url };
}
