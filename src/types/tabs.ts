/**
 * @file Tab Type Definitions
 *
 * Type definitions for tab-related data structures in the browser extension.
 * Includes interfaces for tab information, content management, and multi-tab
 * extraction state handling with serializable types for Chrome storage.
 */

import { ExtractedContent } from './extraction';

// ============================================================================
// Core Tab Types
// ============================================================================

/**
 * Tab information interface extending subset of chrome.tabs.Tab
 *
 * Contains essential tab metadata needed for multi-tab content extraction
 * and management. Uses serializable types compatible with Chrome storage.
 */
export interface TabInfo {
  /** Unique tab identifier */
  id: number;

  /** Tab title from document.title */
  title: string;

  /** Full URL of the tab */
  url: string;

  /** Domain name extracted from URL */
  domain: string;

  /** Window ID containing this tab */
  windowId: number;

  /** Tab favicon URL if available */
  favIconUrl?: string;

  /** Whether the tab is currently active */
  active: boolean;

  /** Tab index within the window */
  index: number;

  /** Whether the tab is pinned */
  pinned: boolean;

  /** Tab loading status */
  status?: 'loading' | 'complete';

  /** Unix timestamp of last access/update */
  lastAccessed: number;

  /** Whether the tab is audible (playing audio) */
  audible?: boolean;

  /** Whether the tab is muted */
  mutedInfo?: {
    muted: boolean;
    reason?: 'user' | 'capture' | 'extension';
  };
}

/**
 * Tab content including extracted content and metadata
 *
 * Combines tab information with extracted content data for comprehensive
 * tab content management and multi-tab aggregation.
 */
export interface TabContent {
  /** Tab information */
  tabInfo: TabInfo;

  /** Extracted content from the tab */
  extractedContent: ExtractedContent;

  /** Content extraction status */
  extractionStatus: 'pending' | 'extracting' | 'completed' | 'failed' | 'cached';

  /** Error message if extraction failed */
  extractionError?: string;

  /** Whether content has been modified since extraction */
  isStale?: boolean;

  /** Cache expiration timestamp */
  cacheExpiresAt?: number;

  /** Additional metadata */
  metadata?: {
    /** Content selection markers if applicable */
    selectionMarkers?: Array<{
      startOffset: number;
      endOffset: number;
      text: string;
    }>;

    /** Whether tab content is dynamically updated */
    isDynamic?: boolean;

    /** Last content hash for change detection */
    contentHash?: string;

    /** Performance metrics */
    extractionTime?: number;
  };
}

/**
 * Multi-tab extraction state management interface
 *
 * Manages state for multiple tabs during content extraction operations.
 * Uses serializable Record types instead of Map for Chrome storage compatibility.
 */
export interface MultiTabExtractionState {
  /** Map of tab ID to TabContent (serializable Record) */
  tabs: Record<number, TabContent>;

  /** Currently active tab ID */
  activeTabId?: number;

  /** List of selected tab IDs for extraction */
  selectedTabIds: number[];

  /** Overall extraction status */
  status: 'idle' | 'extracting' | 'completed' | 'failed';

  /** Total number of tabs to process */
  totalTabs: number;

  /** Number of completed extractions */
  completedTabs: number;

  /** Number of failed extractions */
  failedTabs: number;

  /** Extraction start timestamp */
  startedAt?: number;

  /** Extraction completion timestamp */
  completedAt?: number;

  /** Global extraction options */
  options?: {
    /** Whether to include cached content */
    includeCached?: boolean;

    /** Maximum concurrent extractions */
    maxConcurrent?: number;

    /** Timeout for individual tab extractions */
    tabTimeout?: number;

    /** Whether to extract from background tabs */
    includeBackground?: boolean;
  };

  /** Aggregated content summary */
  summary?: {
    /** Total content length across all tabs */
    totalContentLength: number;

    /** Unique domains represented */
    uniqueDomains: string[];

    /** Combined content preview */
    combinedPreview?: string;
  };
}

// ============================================================================
// Utility Types and Enums
// ============================================================================

/**
 * Tab selection criteria for filtering
 */
export interface TabSelectionCriteria {
  /** Include only tabs from specific domains */
  domains?: string[];

  /** Exclude tabs from specific domains */
  excludeDomains?: string[];

  /** Include only active tabs */
  activeOnly?: boolean;

  /** Include only audible tabs */
  audibleOnly?: boolean;

  /** Include pinned tabs */
  includePinned?: boolean;

  /** Maximum number of tabs to select */
  maxTabs?: number;

  /** URL pattern matching */
  urlPatterns?: string[];
}

/**
 * Tab grouping options for organization
 */
export interface TabGrouping {
  /** Group by domain */
  byDomain?: boolean;

  /** Group by window */
  byWindow?: boolean;

  /** Custom grouping function result */
  customGroups?: Record<string, number[]>;
}

// ============================================================================
// Type Guards and Validation
// ============================================================================

/**
 * Type guard to check if an object is a valid TabInfo
 *
 * @param obj - Object to validate
 * @returns True if the object is a valid TabInfo
 */
export function isTabInfo(obj: unknown): obj is TabInfo {
  if (!obj || typeof obj !== 'object') {
    return false;
  }

  const tab = obj as Record<string, unknown>;

  return (
    typeof tab['id'] === 'number' &&
    typeof tab['title'] === 'string' &&
    typeof tab['url'] === 'string' &&
    typeof tab['domain'] === 'string' &&
    typeof tab['windowId'] === 'number' &&
    typeof tab['active'] === 'boolean' &&
    typeof tab['index'] === 'number' &&
    typeof tab['pinned'] === 'boolean' &&
    typeof tab['lastAccessed'] === 'number' &&
    (tab['favIconUrl'] === undefined || typeof tab['favIconUrl'] === 'string') &&
    (tab['status'] === undefined || ['loading', 'complete'].includes(tab['status'] as string)) &&
    (tab['audible'] === undefined || typeof tab['audible'] === 'boolean')
  );
}

/**
 * Type guard to check if an object is a valid TabContent
 *
 * @param obj - Object to validate
 * @returns True if the object is a valid TabContent
 */
export function isTabContent(obj: unknown): obj is TabContent {
  if (!obj || typeof obj !== 'object') {
    return false;
  }

  const content = obj as Record<string, unknown>;

  return (
    isTabInfo(content['tabInfo']) &&
    typeof content['extractedContent'] === 'object' &&
    content['extractedContent'] !== null &&
    ['pending', 'extracting', 'completed', 'failed', 'cached'].includes(
      content['extractionStatus'] as string
    ) &&
    (content['extractionError'] === undefined || typeof content['extractionError'] === 'string') &&
    (content['isStale'] === undefined || typeof content['isStale'] === 'boolean') &&
    (content['cacheExpiresAt'] === undefined || typeof content['cacheExpiresAt'] === 'number')
  );
}

/**
 * Type guard to check if an object is a valid MultiTabExtractionState
 *
 * @param obj - Object to validate
 * @returns True if the object is a valid MultiTabExtractionState
 */
export function isMultiTabExtractionState(obj: unknown): obj is MultiTabExtractionState {
  if (!obj || typeof obj !== 'object') {
    return false;
  }

  const state = obj as Record<string, unknown>;

  return (
    typeof state['tabs'] === 'object' &&
    state['tabs'] !== null &&
    Array.isArray(state['selectedTabIds']) &&
    ['idle', 'extracting', 'completed', 'failed'].includes(state['status'] as string) &&
    typeof state['totalTabs'] === 'number' &&
    typeof state['completedTabs'] === 'number' &&
    typeof state['failedTabs'] === 'number' &&
    (state['activeTabId'] === undefined || typeof state['activeTabId'] === 'number') &&
    (state['startedAt'] === undefined || typeof state['startedAt'] === 'number') &&
    (state['completedAt'] === undefined || typeof state['completedAt'] === 'number')
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create TabInfo from chrome.tabs.Tab
 *
 * @param chromeTab - Chrome tab object
 * @returns TabInfo interface
 */
export function createTabInfoFromChromeTab(chromeTab: chrome.tabs.Tab): TabInfo {
  // Extract domain from URL
  let domain = '';
  try {
    if (chromeTab.url) {
      const url = new URL(chromeTab.url);
      domain = url.hostname;
    }
  } catch (error) {
    // Handle invalid URLs
    domain = chromeTab.url?.split('/')[2] || '';
  }

  // Handle status type conversion
  const status: 'loading' | 'complete' | undefined =
    chromeTab.status === 'loading'
      ? 'loading'
      : chromeTab.status === 'complete'
        ? 'complete'
        : undefined;

  // Handle mutedInfo reason type conversion
  const mutedReason = chromeTab.mutedInfo?.reason;
  const typedReason: 'user' | 'capture' | 'extension' | undefined =
    mutedReason === 'user'
      ? 'user'
      : mutedReason === 'capture'
        ? 'capture'
        : mutedReason === 'extension'
          ? 'extension'
          : undefined;

  return {
    id: chromeTab.id!,
    title: chromeTab.title || '',
    url: chromeTab.url || '',
    domain,
    windowId: chromeTab.windowId,
    favIconUrl: chromeTab.favIconUrl,
    active: chromeTab.active || false,
    index: chromeTab.index,
    pinned: chromeTab.pinned || false,
    status,
    // Use Chrome's lastAccessed if available (Chrome 121+), fallback to current time
    lastAccessed: (chromeTab as any).lastAccessed ?? Date.now(),
    audible: chromeTab.audible,
    mutedInfo: chromeTab.mutedInfo
      ? {
          muted: chromeTab.mutedInfo.muted,
          reason: typedReason,
        }
      : undefined,
  };
}

/**
 * Filter tabs based on selection criteria
 *
 * @param tabs - Array of TabInfo objects
 * @param criteria - Selection criteria
 * @returns Filtered array of TabInfo
 */
export function filterTabs(tabs: TabInfo[], criteria: TabSelectionCriteria): TabInfo[] {
  let filtered = [...tabs];

  if (criteria.domains) {
    filtered = filtered.filter(tab => criteria.domains!.includes(tab.domain));
  }

  if (criteria.excludeDomains) {
    filtered = filtered.filter(tab => !criteria.excludeDomains!.includes(tab.domain));
  }

  if (criteria.activeOnly) {
    filtered = filtered.filter(tab => tab.active);
  }

  if (criteria.audibleOnly) {
    filtered = filtered.filter(tab => tab.audible === true);
  }

  if (criteria.includePinned === false) {
    filtered = filtered.filter(tab => !tab.pinned);
  }

  if (criteria.urlPatterns) {
    filtered = filtered.filter(tab =>
      criteria.urlPatterns!.some(pattern => {
        try {
          const regex = new RegExp(pattern);
          return regex.test(tab.url);
        } catch {
          return tab.url.includes(pattern);
        }
      })
    );
  }

  if (criteria.maxTabs && filtered.length > criteria.maxTabs) {
    // Sort by lastAccessed desc and take the most recent
    filtered = filtered.sort((a, b) => b.lastAccessed - a.lastAccessed).slice(0, criteria.maxTabs);
  }

  return filtered;
}

/**
 * Create an empty MultiTabExtractionState
 *
 * @returns Initial multi-tab extraction state
 */
export function createEmptyMultiTabState(): MultiTabExtractionState {
  return {
    tabs: {},
    selectedTabIds: [],
    status: 'idle',
    totalTabs: 0,
    completedTabs: 0,
    failedTabs: 0,
  };
}

/**
 * Serialize MultiTabExtractionState for storage
 *
 * @param state - State to serialize
 * @returns Serialized state object
 */
export function serializeMultiTabState(state: MultiTabExtractionState): Record<string, unknown> {
  return {
    ...state,
    // Ensure tabs Record is properly serialized
    tabs: { ...state.tabs },
  };
}

/**
 * Deserialize MultiTabExtractionState from storage
 *
 * @param data - Serialized state data
 * @returns MultiTabExtractionState or null if invalid
 */
export function deserializeMultiTabState(data: unknown): MultiTabExtractionState | null {
  if (!isMultiTabExtractionState(data)) {
    return null;
  }

  return data;
}
