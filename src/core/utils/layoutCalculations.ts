/**
 * @file Layout Calculations
 *
 * Pure functions for calculating layout positions and sizes
 */

// ============================================================================
// Types
// ============================================================================

export interface ViewportDimensions {
  innerWidth: number;
  innerHeight: number;
}

export interface LayoutConfig {
  minWidth: number;
  maxWidth: number;
  defaultWidth: number;
  minHeight: number;
  maxHeight?: number;
  heightRatio: number;
  rightPadding: number;
}

// ============================================================================
// Layout Calculation Functions
// ============================================================================

/**
 * Calculate initial Y position (vertically centered)
 *
 * @param viewport - Viewport dimensions
 * @param heightRatio - Ratio of viewport height to use for sidebar
 * @returns Initial Y position
 */
export function getInitialY(viewport: ViewportDimensions, heightRatio: number): number {
  return Math.round(viewport.innerHeight * ((1 - heightRatio) / 2));
}

/**
 * Calculate sidebar height based on viewport
 *
 * @param viewport - Viewport dimensions
 * @param heightRatio - Ratio of viewport height to use for sidebar
 * @param minHeight - Minimum height constraint (used when clamp is enabled)
 * @param clampToMin - Whether to clamp to the minimum height (default: false)
 * @returns Calculated sidebar height
 */
export function getSidebarHeight(
  viewport: ViewportDimensions,
  heightRatio: number,
  minHeight: number,
  clampToMin: boolean = false
): number {
  const calculatedHeight = Math.round(viewport.innerHeight * heightRatio);
  return clampToMin ? Math.max(minHeight, calculatedHeight) : calculatedHeight;
}

/**
 * Calculate initial X position (right-aligned with padding)
 *
 * @param viewport - Viewport dimensions
 * @param defaultWidth - Default sidebar width
 * @param rightPadding - Padding from right edge
 * @returns Initial X position
 */
export function getInitialX(
  viewport: ViewportDimensions,
  defaultWidth: number,
  rightPadding: number
): number {
  return viewport.innerWidth - defaultWidth - rightPadding;
}

/**
 * Calculate maximum height based on viewport
 *
 * @param viewport - Viewport dimensions
 * @returns Maximum height
 */
export function getMaxHeight(viewport: ViewportDimensions): number {
  return Math.round(viewport.innerHeight);
}

/**
 * Calculate complete initial layout
 *
 * @param viewport - Viewport dimensions
 * @param config - Layout configuration
 * @returns Complete layout with position and size
 */
export function calculateInitialLayout(
  viewport: ViewportDimensions,
  config: LayoutConfig
): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  return {
    x: getInitialX(viewport, config.defaultWidth, config.rightPadding),
    y: getInitialY(viewport, config.heightRatio),
    width: config.defaultWidth,
    height: getSidebarHeight(viewport, config.heightRatio, config.minHeight),
  };
}
