/**
 * @file Favicon Utilities
 *
 * Utilities for fetching and caching tab favicons with Google service fallback.
 * Provides robust favicon handling with memory caching and error recovery.
 */

export interface FaviconOptions {
  /** Size of the favicon (Google service supports 16, 32, 64, 128) */
  size?: 16 | 32 | 64 | 128;
  /** Timeout for favicon fetch in milliseconds */
  timeout?: number;
  /** Whether to use Google favicon service as primary */
  useGoogleService?: boolean;
}

export interface FaviconResult {
  /** The favicon URL to use */
  url: string;
  /** Whether this is a fallback URL */
  isFallback: boolean;
  /** The source of the favicon */
  source: 'tab' | 'google' | 'generic';
}

// In-memory cache for favicon URLs
const faviconCache = new Map<
  string,
  {
    result: FaviconResult;
    timestamp: number;
    expires: number;
  }
>();

// Cache TTL (Time To Live) in milliseconds - 30 minutes
const CACHE_TTL = 30 * 60 * 1000;

// Generic fallback icon (document icon)
const GENERIC_FAVICON_DATA_URL =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE0IDJIMTIuNUw2IDhWMjBBMiAyIDAgMCAwIDggMjJIMTZBMiAyIDAgMCAwIDE4IDIwVjRBMiAyIDAgMCAwIDE2IDJIMTRBMTI1NCIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+CjxwYXRoIGQ9Im0xNCA4LTYgMCAyIDJoNFYxMiIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+Cjwvc3ZnPgo=';

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    // Fallback for invalid URLs
    const match = url.match(/^https?:\/\/([^/]+)/);
    return match?.[1] ?? url;
  }
}

/**
 * Generate Google favicon service URL
 */
function getGoogleFaviconUrl(domain: string, size: number = 16): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`;
}

/**
 * Check if a URL is accessible (for testing favicon availability)
 */
async function isUrlAccessible(url: string, timeout: number = 3000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      mode: 'no-cors', // Avoid CORS issues
    });

    clearTimeout(timeoutId);
    return response.ok || response.type === 'opaque'; // opaque = no-cors success
  } catch {
    return false;
  }
}

/**
 * Get cached favicon result if valid
 */
function getCachedFavicon(cacheKey: string): FaviconResult | null {
  const cached = faviconCache.get(cacheKey);
  if (!cached) {
    return null;
  }

  const now = Date.now();
  if (now > cached.expires) {
    faviconCache.delete(cacheKey);
    return null;
  }

  return cached.result;
}

/**
 * Cache favicon result
 */
function cacheFavicon(cacheKey: string, result: FaviconResult): void {
  const now = Date.now();
  faviconCache.set(cacheKey, {
    result,
    timestamp: now,
    expires: now + CACHE_TTL,
  });
}

/**
 * Get favicon URL for a tab with fallback options
 *
 * Priority order:
 * 1. Tab's existing favIconUrl (if useGoogleService is false)
 * 2. Google favicon service for the domain
 * 3. Tab's existing favIconUrl (as fallback if Google fails)
 * 4. Generic document icon
 *
 * @param tabUrl - The tab's URL
 * @param tabFavIconUrl - The tab's existing favicon URL (optional)
 * @param options - Configuration options
 * @returns Promise resolving to favicon result
 */
export async function getFaviconUrl(
  tabUrl: string,
  tabFavIconUrl?: string,
  options: FaviconOptions = {}
): Promise<FaviconResult> {
  const { size = 16, timeout = 3000, useGoogleService = true } = options;

  // Create cache key based on domain and options
  const domain = extractDomain(tabUrl);
  const cacheKey = `${domain}:${size}:${useGoogleService}`;

  // Check cache first
  const cached = getCachedFavicon(cacheKey);
  if (cached) {
    return cached;
  }

  let result: FaviconResult;

  try {
    // If useGoogleService is false, try tab favicon first
    if (!useGoogleService && tabFavIconUrl) {
      const isAccessible = await isUrlAccessible(tabFavIconUrl, timeout);
      if (isAccessible) {
        result = {
          url: tabFavIconUrl,
          isFallback: false,
          source: 'tab',
        };
        cacheFavicon(cacheKey, result);
        return result;
      }
    }

    // Try Google favicon service
    const googleUrl = getGoogleFaviconUrl(domain, size);
    const isGoogleAccessible = await isUrlAccessible(googleUrl, timeout);

    if (isGoogleAccessible) {
      result = {
        url: googleUrl,
        isFallback: false,
        source: 'google',
      };
      cacheFavicon(cacheKey, result);
      return result;
    }

    // Fallback to tab's favicon if available and Google failed
    if (tabFavIconUrl) {
      const isTabFaviconAccessible = await isUrlAccessible(tabFavIconUrl, timeout);
      if (isTabFaviconAccessible) {
        result = {
          url: tabFavIconUrl,
          isFallback: true,
          source: 'tab',
        };
        cacheFavicon(cacheKey, result);
        return result;
      }
    }

    // Final fallback to generic icon
    result = {
      url: GENERIC_FAVICON_DATA_URL,
      isFallback: true,
      source: 'generic',
    };
  } catch (error) {
    // On any error, use generic fallback
    result = {
      url: GENERIC_FAVICON_DATA_URL,
      isFallback: true,
      source: 'generic',
    };
  }

  // Cache the result
  cacheFavicon(cacheKey, result);
  return result;
}

/**
 * Synchronously get favicon URL with fallback (for immediate use)
 * This uses the cache if available, otherwise returns either the tab favicon or Google service URL
 *
 * @param tabUrl - The tab's URL
 * @param tabFavIconUrl - The tab's existing favicon URL (optional)
 * @param options - Configuration options
 * @returns Favicon result immediately
 */
export function getFaviconUrlSync(
  tabUrl: string,
  tabFavIconUrl?: string,
  options: FaviconOptions = {}
): FaviconResult {
  const { size = 16, useGoogleService = true } = options;

  const domain = extractDomain(tabUrl);
  const cacheKey = `${domain}:${size}:${useGoogleService}`;

  // Check cache first
  const cached = getCachedFavicon(cacheKey);
  if (cached) {
    return cached;
  }

  // Return Google service URL as primary choice
  if (useGoogleService) {
    return {
      url: getGoogleFaviconUrl(domain, size),
      isFallback: false,
      source: 'google',
    };
  }

  // Use tab favicon if available
  if (tabFavIconUrl) {
    return {
      url: tabFavIconUrl,
      isFallback: false,
      source: 'tab',
    };
  }

  // Final fallback
  return {
    url: GENERIC_FAVICON_DATA_URL,
    isFallback: true,
    source: 'generic',
  };
}

/**
 * Clear favicon cache (useful for testing or memory management)
 */
export function clearFaviconCache(): void {
  faviconCache.clear();
}

/**
 * Get cache statistics (useful for debugging)
 */
export function getFaviconCacheStats(): {
  size: number;
  entries: Array<{ key: string; timestamp: number; expires: number; source: string }>;
} {
  const entries: Array<{ key: string; timestamp: number; expires: number; source: string }> = [];

  faviconCache.forEach((value, key) => {
    entries.push({
      key,
      timestamp: value.timestamp,
      expires: value.expires,
      source: value.result.source,
    });
  });

  return {
    size: faviconCache.size,
    entries,
  };
}

/**
 * Preload favicon for a tab (useful for performance)
 * This triggers an async fetch and caches the result
 *
 * @param tabUrl - The tab's URL
 * @param tabFavIconUrl - The tab's existing favicon URL (optional)
 * @param options - Configuration options
 */
export async function preloadFavicon(
  tabUrl: string,
  tabFavIconUrl?: string,
  options: FaviconOptions = {}
): Promise<void> {
  // This will cache the result for future use
  await getFaviconUrl(tabUrl, tabFavIconUrl, options);
}

/**
 * React hook for favicon URL with loading state
 * This is useful for components that need to show loading states
 */
export function useFavicon(
  tabUrl: string,
  tabFavIconUrl?: string,
  options: FaviconOptions = {}
): {
  faviconUrl: string;
  isLoading: boolean;
  isFallback: boolean;
  source: 'tab' | 'google' | 'generic';
} {
  // For now, return sync result
  // In a real React environment, this would use useState/useEffect
  const result = getFaviconUrlSync(tabUrl, tabFavIconUrl, options);

  return {
    faviconUrl: result.url,
    isLoading: false,
    isFallback: result.isFallback,
    source: result.source,
  };
}
