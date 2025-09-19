/**
 * @file Position Calculation Utilities
 *
 * Pure functions for calculating dropdown positions, caret positions,
 * and handling boundary constraints
 */

// ============================================================================
// Types
// ============================================================================

export interface DropdownPosition {
  /** X coordinate for dropdown left position */
  x: number;
  /** Y coordinate for dropdown top position */
  y: number;
  /** Maximum X coordinate (right boundary) */
  maxX: number;
  /** Maximum Y coordinate (bottom boundary) */
  maxY: number;
  /** Whether dropdown should appear above the target (if no space below) */
  shouldFlipVertical: boolean;
  /** Whether dropdown should appear to the left of target (if no space right) */
  shouldFlipHorizontal: boolean;
}

export interface DropdownDimensions {
  /** Expected dropdown width */
  width: number;
  /** Expected dropdown height */
  height: number;
  /** Minimum spacing from container edges */
  padding?: number;
}

export interface CaretPosition {
  /** X coordinate of caret */
  x: number;
  /** Y coordinate of caret */
  y: number;
  /** Height of the line at caret position */
  lineHeight: number;
}

export interface ElementBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface ScrollInfo {
  scrollX: number;
  scrollY: number;
}

// ============================================================================
// Line Height Calculation
// ============================================================================

/**
 * Dynamically calculates line height from element's computed styles
 *
 * @param computedStyle - The computed styles of an element
 * @returns The calculated line height in pixels
 */
export function getDynamicLineHeight(computedStyle: {
  lineHeight: string;
  fontSize: string;
}): number {
  const { lineHeight, fontSize } = computedStyle;
  const fontSizeValue = parseFloat(fontSize);

  if (lineHeight === 'normal') {
    // Calculate normal line height based on font size
    return fontSizeValue * 1.2; // Default line height multiplier
  }

  if (lineHeight.endsWith('px')) {
    return parseFloat(lineHeight);
  }

  if (lineHeight.endsWith('em') || lineHeight.endsWith('rem')) {
    const multiplier = parseFloat(lineHeight);
    return fontSizeValue * multiplier;
  }

  // For unitless values, multiply by font size
  const multiplier = parseFloat(lineHeight) || 1.2;
  return fontSizeValue * multiplier;
}

// ============================================================================
// Bounds Calculation
// ============================================================================

/**
 * Gets the boundaries of a container, with optional selector for Shadow DOM
 *
 * @param containerBounds - The bounding rectangle of the container
 * @param viewportBounds - The viewport dimensions as fallback
 * @returns The effective bounds to use for positioning
 */
export function getShadowDomBounds(
  containerBounds: ElementBounds | null,
  viewportBounds: { width: number; height: number }
): ElementBounds {
  if (containerBounds) {
    return containerBounds;
  }

  // Fallback to viewport
  return {
    left: 0,
    top: 0,
    right: viewportBounds.width,
    bottom: viewportBounds.height,
    width: viewportBounds.width,
    height: viewportBounds.height,
  };
}

// ============================================================================
// Position Calculation
// ============================================================================

/**
 * Calculates optimal dropdown position relative to a target element or caret position
 *
 * @param targetBounds - The bounds of the target element
 * @param dimensions - The expected dropdown dimensions
 * @param containerBounds - The container boundaries
 * @param scrollInfo - Current scroll position information
 * @param caretPos - Optional caret position for text inputs
 * @returns The calculated dropdown position
 */
export function calculateDropdownPosition(
  targetBounds: ElementBounds,
  dimensions: DropdownDimensions,
  containerBounds: ElementBounds,
  scrollInfo: ScrollInfo = { scrollX: 0, scrollY: 0 },
  caretPos?: CaretPosition
): DropdownPosition {
  const { width, height, padding = 8 } = dimensions;

  // Use caret position if provided, otherwise use element position
  let targetX: number;
  let targetY: number;
  let targetHeight: number;

  if (caretPos) {
    targetX = targetBounds.left + caretPos.x;
    targetY = targetBounds.top + caretPos.y;
    targetHeight = caretPos.lineHeight;
  } else {
    targetX = targetBounds.left;
    targetY = targetBounds.top + targetBounds.height;
    targetHeight = targetBounds.height;
  }

  // Adjust for scroll position
  const adjustedX = targetX - scrollInfo.scrollX;
  const adjustedY = targetY - scrollInfo.scrollY;

  // Calculate default positions (below and to the right)
  let x = adjustedX;
  let y = adjustedY + targetHeight;

  // Check boundaries and determine if flipping is needed
  const rightBoundary = containerBounds.right - padding;
  const bottomBoundary = containerBounds.bottom - padding;
  const leftBoundary = containerBounds.left + padding;
  const topBoundary = containerBounds.top + padding;

  // Check horizontal overflow
  const shouldFlipHorizontal = x + width > rightBoundary && adjustedX - width >= leftBoundary;
  if (shouldFlipHorizontal) {
    x = adjustedX - width;
  }

  // Check vertical overflow
  const shouldFlipVertical = y + height > bottomBoundary && adjustedY - height >= topBoundary;
  if (shouldFlipVertical) {
    y = adjustedY - height;
  }

  // Ensure dropdown stays within bounds
  x = Math.max(leftBoundary, Math.min(x, rightBoundary - width));
  y = Math.max(topBoundary, Math.min(y, bottomBoundary - height));

  return {
    x,
    y,
    maxX: rightBoundary,
    maxY: bottomBoundary,
    shouldFlipVertical,
    shouldFlipHorizontal,
  };
}

/**
 * Calculates dropdown position specifically for text input caret positioning
 *
 * @param targetBounds - The bounds of the text input element
 * @param dimensions - The expected dropdown dimensions
 * @param containerBounds - The container boundaries
 * @param caretPos - The caret position within the text input
 * @param scrollInfo - Current scroll position information
 * @returns The calculated dropdown position
 */
export function calculateCaretDropdownPosition(
  targetBounds: ElementBounds,
  dimensions: DropdownDimensions,
  containerBounds: ElementBounds,
  caretPos: CaretPosition,
  scrollInfo: ScrollInfo = { scrollX: 0, scrollY: 0 }
): DropdownPosition {
  return calculateDropdownPosition(targetBounds, dimensions, containerBounds, scrollInfo, caretPos);
}
