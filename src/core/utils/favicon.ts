/**
 * @file Favicon Utilities
 *
 * Pure URL manipulation and favicon resolution logic
 */

export interface FaviconResult {
  url: string;
  isFallback: boolean;
  source: 'tab' | 'google' | 'generic';
}

// Generic fallback icon (document icon)
const GENERIC_FAVICON_DATA_URL =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE0IDJIMTIuNUw2IDhWMjBBMiAyIDAgMCAwIDggMjJIMTZBMiAyIDAgMCAwIDE4IDIwVjRBMiAyIDAgMCAwIDE2IDJIMTRBMTI1NCIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+CjxwYXRoIGQ9Im0xNCA4LTYgMCAyIDJoNFYxMiIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+Cjwvc3ZnPgo=';

export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    const match = url.match(/^https?:\/\/([^/]+)/);
    return match?.[1] ?? url;
  }
}

export function getGoogleFaviconUrl(domain: string, size: number = 16): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`;
}

/**
 * Complete favicon resolution strategy
 * Order: tab.favIconUrl -> Google S2 -> generic.
 */
export function getDomSafeFaviconUrlSync(
  tabUrl: string,
  tabFavIconUrl?: string,
  size: 16 | 32 | 64 | 128 = 16
): FaviconResult {
  const domain = extractDomain(tabUrl);

  if (tabFavIconUrl) {
    return { url: tabFavIconUrl, isFallback: false, source: 'tab' };
  }

  if (domain) {
    return { url: getGoogleFaviconUrl(domain, size), isFallback: false, source: 'google' };
  }

  return { url: GENERIC_FAVICON_DATA_URL, isFallback: true, source: 'generic' };
}
