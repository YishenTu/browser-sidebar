/**
 * @file Utils Module Exports
 *
 * Utility functions for DOM manipulation, text processing, and tab management.
 */

// DOM utilities
export { isVisible, normalizeUrls, cleanHtml } from './domUtils';

// Text utilities
export { clampText } from './textUtils';
export type { ClampResult } from './textUtils';

// Tab utilities
export { getCurrentTabId, getCurrentTabIdSafe, exampleUsage } from './tabUtils';
