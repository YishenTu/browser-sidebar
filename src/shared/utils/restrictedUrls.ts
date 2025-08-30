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
 * Configuration for restricted URL handling
 */
export interface RestrictedUrlConfig {
  /** Whether to allow file:// URLs (requires file access permission) */
  allowFileUrls?: boolean;
  /** Additional custom restricted patterns */
  customPatterns?: string[];
}

/**
 * Creates a custom restricted URL checker with specific configuration
 *
 * @param config - Configuration options
 * @returns Custom checker function
 *
 * @example
 * ```typescript
 * const checker = createRestrictedUrlChecker({
 *   allowFileUrls: true,
 *   customPatterns: ['internal://']
 * });
 *
 * checker('file:///doc.pdf') // false (allowed)
 * checker('internal://settings') // true (custom pattern)
 * ```
 */
export function createRestrictedUrlChecker(config: RestrictedUrlConfig): (url: string) => boolean {
  return (url: string): boolean => {
    if (!url || typeof url !== 'string') {
      return true;
    }

    const lowerUrl = url.toLowerCase();

    // Check if file URLs are allowed
    if (config.allowFileUrls && lowerUrl.startsWith('file://')) {
      return false;
    }

    // Check custom patterns first
    if (config.customPatterns) {
      for (const pattern of config.customPatterns) {
        if (lowerUrl.startsWith(pattern.toLowerCase())) {
          return true;
        }
      }
    }

    // Use standard check
    return isRestrictedUrl(url);
  };
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

/**
 * Gets a user-friendly reason why a URL is restricted
 *
 * @param url - The restricted URL
 * @returns Human-readable reason or null if not restricted
 */
export function getRestrictionReason(url: string): string | null {
  if (!url) {
    return 'Invalid or missing URL';
  }

  const lowerUrl = url.toLowerCase();

  if (lowerUrl.startsWith('chrome://') || lowerUrl.startsWith('edge://')) {
    return 'Browser internal pages cannot be accessed';
  }

  if (lowerUrl.startsWith('chrome-extension://') || lowerUrl.startsWith('extension://')) {
    return 'Extension pages cannot be accessed';
  }

  if (lowerUrl.startsWith('file://')) {
    return 'Local files require special permissions';
  }

  if (lowerUrl.startsWith('data:') || lowerUrl.startsWith('blob:')) {
    return 'Data URLs cannot be accessed';
  }

  if (lowerUrl.startsWith('javascript:')) {
    return 'JavaScript URLs are not supported';
  }

  try {
    const urlObj = new URL(url);
    for (const domain of RESTRICTED_DOMAINS) {
      if (urlObj.hostname.includes(domain)) {
        return 'Browser store pages cannot be accessed';
      }
    }
  } catch {
    return 'Invalid URL format';
  }

  if (isRestrictedUrl(url)) {
    return 'This URL type is restricted';
  }

  return null;
}

/**
 * Filters an array of URLs to only include valid, non-restricted URLs
 *
 * @param urls - Array of URLs to filter
 * @returns Array of valid URLs
 */
export function filterValidUrls(urls: (string | null | undefined)[]): string[] {
  return urls.filter(isValidTabUrl);
}
