/**
 * Sidebar Utilities
 *
 * Collection of utility functions for the sidebar components
 */

export {
  calculateDropdownPosition,
  calculateCaretDropdownPosition,
  getCaretPosition,
  getDynamicLineHeight,
  applyDropdownPosition,
  createPositionTracker,
  useDropdownPosition,
  type DropdownPosition,
  type DropdownDimensions,
  type CaretPosition,
} from './dropdownPosition';

export { formatTabContent, type TabFormatResult, type FormatOptions } from './contentFormatter';

export {
  isRestrictedUrl,
  canLoadTab,
  getAvailableTabs,
  isTabLoading,
  getTabsByStatus,
  getFailedTabs,
  getSuccessfulTabs,
  allTabsFinished,
  getExtractionStats,
  isValidTabId,
  isValidTabInfo,
} from './tabFilters';

export {
  getFaviconUrl,
  getFaviconUrlSync,
  clearFaviconCache,
  getFaviconCacheStats,
  preloadFavicon,
  useFavicon,
  type FaviconOptions,
  type FaviconResult,
} from './favicon';
