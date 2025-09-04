/**
 * Transport Policy Module
 *
 * Determines routing policies for HTTP requests, specifically whether
 * requests should be routed through a CORS proxy or sent directly.
 *
 * This module provides a flexible policy system that can be extended
 * for various routing strategies while maintaining a clean API.
 */

/**
 * Configuration for transport policies
 */
export interface PolicyConfig {
  /** Domains that require CORS proxy routing */
  proxyAllowlist: string[];
  /** Optional denylist for domains that should never be proxied */
  proxyDenylist?: string[];
  /** Whether to enable pattern matching (future enhancement) */
  enablePatternMatching?: boolean;
}

/**
 * Default policy configuration
 */
const DEFAULT_CONFIG: PolicyConfig = {
  proxyAllowlist: ['api.moonshot.cn'],
  proxyDenylist: [],
  enablePatternMatching: false,
};

/**
 * Global policy configuration instance
 */
let policyConfig: PolicyConfig = {
  proxyAllowlist: [...DEFAULT_CONFIG.proxyAllowlist],
  proxyDenylist: [...(DEFAULT_CONFIG.proxyDenylist || [])],
  enablePatternMatching: DEFAULT_CONFIG.enablePatternMatching,
};

/**
 * Extracts the hostname from a URL string
 *
 * @param url - The URL to parse
 * @returns The hostname, or null if the URL is invalid
 */
function extractHostname(url: string): string | null {
  try {
    const urlObject = new URL(url);
    return urlObject.hostname;
  } catch (error) {
    // Invalid URL provided to policy check
    return null;
  }
}

/**
 * Normalizes a hostname by removing 'www.' prefix if present
 *
 * @param hostname - The hostname to normalize
 * @returns The normalized hostname
 */
function normalizeHostname(hostname: string): string {
  return hostname.startsWith('www.') ? hostname.slice(4) : hostname;
}

/**
 * Checks if a hostname is in the proxy allowlist
 *
 * @param hostname - The hostname to check
 * @returns True if the hostname should be proxied
 */
function isInAllowlist(hostname: string): boolean {
  const normalizedHostname = normalizeHostname(hostname);

  return policyConfig.proxyAllowlist.some(allowedDomain => {
    const normalizedAllowed = normalizeHostname(allowedDomain);

    // Exact match
    if (normalizedHostname === normalizedAllowed) {
      return true;
    }

    // Subdomain match (e.g., 'api.example.com' matches 'example.com')
    if (normalizedHostname.endsWith(`.${normalizedAllowed}`)) {
      return true;
    }

    return false;
  });
}

/**
 * Checks if a hostname is in the proxy denylist
 *
 * @param hostname - The hostname to check
 * @returns True if the hostname should never be proxied
 */
function isInDenylist(hostname: string): boolean {
  if (!policyConfig.proxyDenylist || policyConfig.proxyDenylist.length === 0) {
    return false;
  }

  const normalizedHostname = normalizeHostname(hostname);

  return policyConfig.proxyDenylist.some(deniedDomain => {
    const normalizedDenied = normalizeHostname(deniedDomain);

    // Exact match
    if (normalizedHostname === normalizedDenied) {
      return true;
    }

    // Subdomain match
    if (normalizedHostname.endsWith(`.${normalizedDenied}`)) {
      return true;
    }

    return false;
  });
}

/**
 * Determines whether a URL should be routed through a CORS proxy
 *
 * This is the main policy function that decides routing strategy based on:
 * 1. URL validity
 * 2. Denylist check (takes precedence)
 * 3. Allowlist check
 *
 * @param url - The URL to evaluate
 * @returns True if the URL should be proxied, false for direct requests
 */
export function shouldProxy(url: string): boolean {
  const hostname = extractHostname(url);

  // Invalid URLs should not be proxied
  if (!hostname) {
    return false;
  }

  // Denylist takes precedence - never proxy denied domains
  if (isInDenylist(hostname)) {
    return false;
  }

  // Check allowlist for proxy requirement
  return isInAllowlist(hostname);
}

/**
 * Adds a domain to the proxy allowlist
 *
 * @param domain - The domain to add (e.g., 'api.example.com')
 * @returns True if the domain was added, false if it already exists
 */
export function addToAllowlist(domain: string): boolean {
  const normalizedDomain = normalizeHostname(domain);

  if (!policyConfig.proxyAllowlist.includes(normalizedDomain)) {
    policyConfig.proxyAllowlist.push(normalizedDomain);
    return true;
  }

  return false;
}

/**
 * Removes a domain from the proxy allowlist
 *
 * @param domain - The domain to remove
 * @returns True if the domain was removed, false if it wasn't found
 */
export function removeFromAllowlist(domain: string): boolean {
  const normalizedDomain = normalizeHostname(domain);
  const index = policyConfig.proxyAllowlist.indexOf(normalizedDomain);

  if (index !== -1) {
    policyConfig.proxyAllowlist.splice(index, 1);
    return true;
  }

  return false;
}

/**
 * Adds a domain to the proxy denylist
 *
 * @param domain - The domain to add to denylist
 * @returns True if the domain was added, false if it already exists
 */
export function addToDenylist(domain: string): boolean {
  if (!policyConfig.proxyDenylist) {
    policyConfig.proxyDenylist = [];
  }

  const normalizedDomain = normalizeHostname(domain);

  if (!policyConfig.proxyDenylist.includes(normalizedDomain)) {
    policyConfig.proxyDenylist.push(normalizedDomain);
    return true;
  }

  return false;
}

/**
 * Removes a domain from the proxy denylist
 *
 * @param domain - The domain to remove from denylist
 * @returns True if the domain was removed, false if it wasn't found
 */
export function removeFromDenylist(domain: string): boolean {
  if (!policyConfig.proxyDenylist) {
    return false;
  }

  const normalizedDomain = normalizeHostname(domain);
  const index = policyConfig.proxyDenylist.indexOf(normalizedDomain);

  if (index !== -1) {
    policyConfig.proxyDenylist.splice(index, 1);
    return true;
  }

  return false;
}

/**
 * Gets the current allowlist domains
 *
 * @returns A copy of the current allowlist
 */
export function getAllowlist(): string[] {
  return [...policyConfig.proxyAllowlist];
}

/**
 * Gets the current denylist domains
 *
 * @returns A copy of the current denylist
 */
export function getDenylist(): string[] {
  return policyConfig.proxyDenylist ? [...policyConfig.proxyDenylist] : [];
}

/**
 * Updates the entire policy configuration
 *
 * @param config - New policy configuration
 */
export function updatePolicyConfig(config: Partial<PolicyConfig>): void {
  policyConfig = {
    ...policyConfig,
    ...config,
  };
}

/**
 * Gets the current policy configuration
 *
 * @returns A copy of the current configuration
 */
export function getPolicyConfig(): PolicyConfig {
  return {
    ...policyConfig,
    proxyAllowlist: [...policyConfig.proxyAllowlist],
    proxyDenylist: policyConfig.proxyDenylist ? [...policyConfig.proxyDenylist] : [],
  };
}

/**
 * Resets the policy configuration to defaults
 */
export function resetPolicyConfig(): void {
  policyConfig = {
    proxyAllowlist: [...DEFAULT_CONFIG.proxyAllowlist],
    proxyDenylist: [...(DEFAULT_CONFIG.proxyDenylist || [])],
    enablePatternMatching: DEFAULT_CONFIG.enablePatternMatching,
  };
}

/**
 * Validates a domain string format
 *
 * @param domain - The domain to validate
 * @returns True if the domain format is valid
 */
export function isValidDomain(domain: string): boolean {
  // Basic domain validation - checks for valid hostname format
  const domainRegex =
    /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  // Check if it's an IPv4 address (should not be considered a valid domain)
  const ipv4Regex = /^\d+\.\d+\.\d+\.\d+$/;
  if (ipv4Regex.test(domain)) {
    return false;
  }

  return domainRegex.test(domain) && domain.length <= 253;
}
