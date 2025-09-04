/**
 * Centralized utility for checking restricted URLs
 * Used by both backend (TabManager) and frontend (tab filters) to ensure consistency
 */

/**
 * List of restricted URL patterns that should not be processed
 */
const RESTRICTED_PATTERNS = [
  // Browser internal pages
  'chrome://',
  'chrome-extension://',
  'edge://',
  'extension://',
  'about:',
  'chrome-devtools://',
  'devtools://',

  // File system (optional based on permissions)
  'file://',

  // Data URLs and blobs
  'data:',
  'blob:',

  // Browser-specific internal pages
  'vivaldi://',
  'opera://',
  'brave://',

  // WebView and app protocols
  'view-source:',
  'javascript:',
] as const;

/**
 * Additional restricted domains that may use https:// but are still restricted
 */
const RESTRICTED_DOMAINS = [
  'chrome.google.com/webstore',
  'microsoftedge.microsoft.com/addons',
  'addons.mozilla.org',
] as const;

/**
 * Checks if a URL is restricted and should not be processed
 *
 * @param url - The URL to check
 * @returns True if the URL is restricted, false otherwise
 *
 * @example
 * ```typescript
 * isRestrictedUrl('chrome://settings') // true
 * isRestrictedUrl('https://example.com') // false
 * isRestrictedUrl('file:///Users/doc.pdf') // true
 * isRestrictedUrl('https://chrome.google.com/webstore/detail/...') // true
 * ```
 */
export function isRestrictedUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') {
    return true; // Treat invalid URLs as restricted
  }

  // Check restricted patterns (protocols)
  const lowerUrl = url.toLowerCase();
  for (const pattern of RESTRICTED_PATTERNS) {
    if (lowerUrl.startsWith(pattern)) {
      return true;
    }
  }

  // Check restricted domains
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    const pathname = urlObj.pathname.toLowerCase();

    for (const domain of RESTRICTED_DOMAINS) {
      if (hostname.includes(domain) || `${hostname}${pathname}`.includes(domain)) {
        return true;
      }
    }
  } catch {
    // If URL parsing fails, consider it restricted
    return true;
  }

  return false;
}

/**
 * Type guard to check if a URL is valid and not restricted
 *
 * @param url - URL to check
 * @returns True if URL is valid and not restricted
 */
export function isValidTabUrl(url: unknown): url is string {
  return typeof url === 'string' && url.length > 0 && !isRestrictedUrl(url);
}
