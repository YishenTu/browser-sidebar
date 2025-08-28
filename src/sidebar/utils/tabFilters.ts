/**
 * @file Tab Filtering Utilities
 *
 * Pure utility functions for filtering available tabs in multi-tab extraction.
 * Provides functions for checking duplicates, restrictions, and availability
 * based on the current state of loaded tabs and browser restrictions.
 *
 * Usage example in useMultiTabExtraction hook:
 * 
 * ```typescript
 * import { getAvailableTabs, canLoadTab, isRestrictedUrl } from '@/utils/tabFilters';
 * 
 * // Replace manual filtering logic:
 * // const available = allTabs.filter(tab => {
 * //   if (currentTabId && tab.id === currentTabId) return false;
 * //   if (loadedTabs[tab.id]) return false;
 * //   return true;
 * // });
 * 
 * // With utility function:
 * const available = getAvailableTabs(allTabs, currentTabId, loadedTabs);
 * ```
 */

import type { TabInfo, TabContent } from '@/types/tabs';
import { isRestrictedUrl as isRestrictedUrlShared } from '../../shared/utils/restrictedUrls';

// ============================================================================
// Constants
// ============================================================================

// Use centralized restricted URL checking to prevent drift
// The local constants are removed in favor of the shared utility

// ============================================================================
// Core Filter Functions
// ============================================================================

/**
 * Check if a URL is restricted from content extraction
 * 
 * Uses the centralized restricted URL utility to ensure consistency
 * between backend and frontend filtering logic.
 *
 * @param url - The tab URL to check
 * @returns True if the URL is restricted
 */
export function isRestrictedUrl(url: string): boolean {
  return isRestrictedUrlShared(url);
}

/**
 * Check if a tab can be loaded for extraction
 *
 * Validates that a tab is not already loaded, is not the current tab,
 * and is not restricted from extraction.
 *
 * @param tabInfo - The tab to check
 * @param currentTabId - ID of the current tab (to avoid duplicates)
 * @param loadedTabs - Record of already loaded tabs
 * @returns True if the tab can be loaded
 */
export function canLoadTab(
  tabInfo: TabInfo,
  currentTabId: number | null,
  loadedTabs: Record<number, TabContent>
): boolean {
  // Check if tab ID is valid
  if (!tabInfo.id || typeof tabInfo.id !== 'number') {
    return false;
  }

  // Check if it's the current tab (already auto-loaded)
  if (currentTabId !== null && tabInfo.id === currentTabId) {
    return false;
  }

  // Check if tab is already loaded
  if (loadedTabs[tabInfo.id]) {
    return false;
  }

  // Check if URL is restricted
  if (isRestrictedUrl(tabInfo.url)) {
    return false;
  }

  // Check if tab has essential properties
  if (!tabInfo.title && !tabInfo.url) {
    return false;
  }

  // Tab can be loaded
  return true;
}

/**
 * Get available tabs for extraction
 *
 * Filters a list of tabs to return only those that are available
 * for content extraction, excluding duplicates, current tab, and
 * restricted URLs.
 *
 * @param allTabs - Array of all tabs from the browser
 * @param currentTabId - ID of the current tab
 * @param loadedTabs - Record of already loaded tabs
 * @returns Array of tabs available for extraction
 */
export function getAvailableTabs(
  allTabs: TabInfo[],
  currentTabId: number | null,
  loadedTabs: Record<number, TabContent>
): TabInfo[] {
  if (!Array.isArray(allTabs)) {
    return [];
  }

  return allTabs.filter(tab => canLoadTab(tab, currentTabId, loadedTabs));
}

// ============================================================================
// Additional Utility Functions
// ============================================================================

/**
 * Check if a tab is currently being extracted
 *
 * @param tabId - The tab ID to check
 * @param loadingTabIds - Array of tab IDs currently being processed
 * @returns True if the tab is currently being extracted
 */
export function isTabLoading(tabId: number, loadingTabIds: number[]): boolean {
  return loadingTabIds.includes(tabId);
}

/**
 * Get tabs by extraction status
 *
 * Filters loaded tabs by their extraction status.
 *
 * @param loadedTabs - Record of loaded tabs
 * @param status - The extraction status to filter by
 * @returns Array of tabs with the specified status
 */
export function getTabsByStatus(
  loadedTabs: Record<number, TabContent>,
  status: TabContent['extractionStatus']
): TabContent[] {
  return Object.values(loadedTabs).filter(tab => tab.extractionStatus === status);
}

/**
 * Get failed tabs with error messages
 *
 * Returns tabs that failed extraction along with their error messages.
 *
 * @param loadedTabs - Record of loaded tabs
 * @returns Array of failed tabs with error information
 */
export function getFailedTabs(loadedTabs: Record<number, TabContent>): Array<{
  tab: TabContent;
  error: string;
}> {
  return Object.values(loadedTabs)
    .filter(tab => tab.extractionStatus === 'failed')
    .map(tab => ({
      tab,
      error: tab.extractionError || 'Unknown extraction error'
    }));
}

/**
 * Get successfully extracted tabs
 *
 * Returns only tabs that have completed extraction successfully.
 *
 * @param loadedTabs - Record of loaded tabs
 * @returns Array of successfully extracted tabs
 */
export function getSuccessfulTabs(loadedTabs: Record<number, TabContent>): TabContent[] {
  return getTabsByStatus(loadedTabs, 'completed');
}

/**
 * Check if all tabs have finished processing
 *
 * Determines if all loaded tabs have either completed successfully or failed.
 *
 * @param loadedTabs - Record of loaded tabs
 * @returns True if all tabs are in a final state
 */
export function allTabsFinished(loadedTabs: Record<number, TabContent>): boolean {
  const tabs = Object.values(loadedTabs);
  
  if (tabs.length === 0) {
    return true;
  }

  return tabs.every(tab => 
    tab.extractionStatus === 'completed' || 
    tab.extractionStatus === 'failed'
  );
}

/**
 * Get tab extraction statistics
 *
 * Returns summary statistics about the current extraction state.
 *
 * @param loadedTabs - Record of loaded tabs
 * @returns Statistics object with counts and percentages
 */
export function getExtractionStats(loadedTabs: Record<number, TabContent>): {
  total: number;
  completed: number;
  failed: number;
  pending: number;
  extracting: number;
  completionRate: number;
  failureRate: number;
} {
  const tabs = Object.values(loadedTabs);
  const total = tabs.length;
  
  if (total === 0) {
    return {
      total: 0,
      completed: 0,
      failed: 0,
      pending: 0,
      extracting: 0,
      completionRate: 0,
      failureRate: 0,
    };
  }

  const completed = tabs.filter(tab => tab.extractionStatus === 'completed').length;
  const failed = tabs.filter(tab => tab.extractionStatus === 'failed').length;
  const pending = tabs.filter(tab => tab.extractionStatus === 'pending').length;
  const extracting = tabs.filter(tab => tab.extractionStatus === 'extracting').length;

  return {
    total,
    completed,
    failed,
    pending,
    extracting,
    completionRate: Math.round((completed / total) * 100),
    failureRate: Math.round((failed / total) * 100),
  };
}

// ============================================================================
// Type Guards and Validation
// ============================================================================

/**
 * Type guard to check if a value is a valid tab ID
 *
 * @param value - Value to check
 * @returns True if the value is a valid tab ID
 */
export function isValidTabId(value: unknown): value is number {
  return typeof value === 'number' && value > 0 && Number.isInteger(value);
}

/**
 * Validate tab info object
 *
 * Checks if a tab info object has all required properties for extraction.
 *
 * @param tabInfo - Tab info to validate
 * @returns True if the tab info is valid
 */
export function isValidTabInfo(tabInfo: unknown): tabInfo is TabInfo {
  if (!tabInfo || typeof tabInfo !== 'object') {
    return false;
  }

  const tab = tabInfo as Partial<TabInfo>;

  return (
    isValidTabId(tab.id) &&
    typeof tab.title === 'string' &&
    typeof tab.url === 'string' &&
    typeof tab.domain === 'string' &&
    typeof tab.windowId === 'number' &&
    typeof tab.active === 'boolean' &&
    typeof tab.index === 'number' &&
    typeof tab.pinned === 'boolean' &&
    typeof tab.lastAccessed === 'number'
  );
}