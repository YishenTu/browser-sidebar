/**
 * @file Sidebar Constants
 *
 * Centralized constants for sidebar sizing and positioning
 */

import {
  getInitialY as getInitialYCore,
  getSidebarHeight as getSidebarHeightCore,
  getInitialX as getInitialXCore,
  getMaxHeight as getMaxHeightCore,
} from '@core/utils/layoutCalculations';

// Width constraints
export const MIN_WIDTH = 400;
export const MAX_WIDTH = 600;
export const DEFAULT_WIDTH = 400;

// Height constraints
export const MIN_HEIGHT = 500;
export const MAX_HEIGHT = typeof window !== 'undefined' ? getMaxHeightCore(window) : 1000;
export const SIDEBAR_HEIGHT_RATIO = 0.85;

// Positioning
export const RIGHT_PADDING = 30; // Default space from the right edge

// Calculate initial Y position (vertically centered)
export const getInitialY = () => {
  if (typeof window === 'undefined') return 0;
  return getInitialYCore(window, SIDEBAR_HEIGHT_RATIO);
};

// Calculate sidebar height
export const getSidebarHeight = () => {
  if (typeof window === 'undefined') return MIN_HEIGHT;
  return getSidebarHeightCore(window, SIDEBAR_HEIGHT_RATIO, MIN_HEIGHT, true);
};

// Calculate initial X position (right-aligned with padding)
export const getInitialX = () => {
  if (typeof window === 'undefined') return 0;
  return getInitialXCore(window, DEFAULT_WIDTH, RIGHT_PADDING);
};
