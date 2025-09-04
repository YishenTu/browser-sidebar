/**
 * @file Utils Module Exports
 *
 * Utility functions for DOM manipulation, text processing, and tab management.
 */

// DOM utilities
export { isVisible, normalizeUrls, cleanHtml } from './domUtils';

// Text utilities (moved to core)
export { clampText } from '@core/extraction/text';
export type { ClampResult } from '@core/extraction/text';

// Tab utilities
export { getCurrentTabId, getCurrentTabIdSafe } from './tabUtils';
