/**
 * Dropdown Position Calculator for Shadow DOM
 *
 * This utility calculates dropdown positioning within Shadow DOM contexts,
 * handling scroll positions, caret positioning, and boundary constraints
 * to prevent dropdowns from overflowing outside their containers.
 *
 * @example
 * ```typescript
 * // For a mention dropdown at caret position in a textarea
 * const textArea = document.querySelector('textarea');
 * const position = calculateCaretDropdownPosition(textArea, {
 *   width: 200,
 *   height: 150,
 *   padding: 8
 * });
 *
 * const dropdown = document.querySelector('.mention-dropdown');
 * applyDropdownPosition(dropdown, position);
 *
 * // With position tracking for scroll/resize
 * const cleanup = createPositionTracker(textArea, dropdown, {
 *   width: 200,
 *   height: 150
 * });
 *
 * // Clean up when component unmounts
 * cleanup();
 * ```
 */

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

/**
 * Gets the caret position within a textarea or input element
 */
export function getCaretPosition(element: HTMLTextAreaElement | HTMLInputElement): CaretPosition {
  // For textarea/input elements, we need to calculate caret position
  const style = window.getComputedStyle(element);

  // Create a temporary div to measure text
  const div = document.createElement('div');
  const containerRoot = element.getRootNode() as Document | ShadowRoot;
  const container = containerRoot === document ? document.body : (containerRoot as ShadowRoot).host;

  // Copy styles to temporary div
  div.style.cssText = `
    position: absolute;
    visibility: hidden;
    white-space: pre-wrap;
    word-wrap: break-word;
    font-family: ${style.fontFamily};
    font-size: ${style.fontSize};
    font-weight: ${style.fontWeight};
    line-height: ${style.lineHeight};
    letter-spacing: ${style.letterSpacing};
    text-transform: ${style.textTransform};
    border: ${style.border};
    padding: ${style.padding};
    box-sizing: ${style.boxSizing};
    width: ${element.offsetWidth}px;
    height: auto;
    overflow: hidden;
    top: 0;
    left: -9999px;
  `;

  (container as Element).appendChild(div);

  const textBeforeCaret = element.value.substring(0, element.selectionStart || 0);
  div.textContent = textBeforeCaret;

  // Add a span to measure the exact caret position
  const caretSpan = document.createElement('span');
  caretSpan.textContent = '|';
  div.appendChild(caretSpan);

  const spanRect = caretSpan.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();

  // Calculate line height
  const lineHeight = getDynamicLineHeight(element);

  // Calculate relative position
  const x = spanRect.left - elementRect.left;
  const y = spanRect.top - elementRect.top;

  // Clean up
  (container as Element).removeChild(div);

  return {
    x: Math.max(0, x),
    y: Math.max(0, y),
    lineHeight,
  };
}

/**
 * Dynamically calculates line height from element's computed styles
 */
export function getDynamicLineHeight(element: HTMLElement): number {
  const style = window.getComputedStyle(element);
  const lineHeight = style.lineHeight;

  if (lineHeight === 'normal') {
    // Calculate normal line height based on font size
    const fontSize = parseFloat(style.fontSize);
    return fontSize * 1.2; // Default line height multiplier
  }

  if (lineHeight.endsWith('px')) {
    return parseFloat(lineHeight);
  }

  if (lineHeight.endsWith('em') || lineHeight.endsWith('rem')) {
    const fontSize = parseFloat(style.fontSize);
    const multiplier = parseFloat(lineHeight);
    return fontSize * multiplier;
  }

  // For unitless values, multiply by font size
  const fontSize = parseFloat(style.fontSize);
  const multiplier = parseFloat(lineHeight) || 1.2;
  return fontSize * multiplier;
}

/**
 * Gets the scroll position of the container and all scrollable ancestors
 */
function getContainerScrollInfo(element: HTMLElement): {
  scrollX: number;
  scrollY: number;
  container: HTMLElement;
} {
  let scrollX = 0;
  let scrollY = 0;
  let current = element.parentElement;
  let container = element;

  // Walk up the DOM tree to find scrollable containers
  while (current) {
    const style = window.getComputedStyle(current);
    const hasScrollableX = style.overflowX === 'scroll' || style.overflowX === 'auto';
    const hasScrollableY = style.overflowY === 'scroll' || style.overflowY === 'auto';

    if (hasScrollableX) {
      scrollX += current.scrollLeft;
    }

    if (hasScrollableY) {
      scrollY += current.scrollTop;
      container = current; // Update container to the scrollable element
    }

    // Stop at Shadow DOM boundary
    const root = current.getRootNode();
    if (root !== document && (root as ShadowRoot).host) {
      current = (root as ShadowRoot).host as HTMLElement;
    } else {
      current = current.parentElement;
    }
  }

  return { scrollX, scrollY, container };
}

/**
 * Gets the boundaries of the Shadow DOM container
 */
function getShadowDomBounds(element: HTMLElement): DOMRect {
  const root = element.getRootNode();

  if (root === document) {
    // Not in Shadow DOM, use viewport
    return new DOMRect(0, 0, window.innerWidth, window.innerHeight);
  }

  const shadowRoot = root as ShadowRoot;
  const host = shadowRoot.host as HTMLElement;

  // Find the actual container element within the shadow DOM
  const container = shadowRoot.querySelector('#ai-browser-sidebar-root') as HTMLElement;

  if (container) {
    return container.getBoundingClientRect();
  }

  // Fallback to host element bounds
  return host.getBoundingClientRect();
}

/**
 * Calculates optimal dropdown position relative to a target element or caret position
 */
export function calculateDropdownPosition(
  targetElement: HTMLElement,
  dimensions: DropdownDimensions,
  caretPos?: CaretPosition
): DropdownPosition {
  const { width, height, padding = 8 } = dimensions;

  // Get element bounds
  const elementRect = targetElement.getBoundingClientRect();

  // Get scroll information
  const scrollInfo = getContainerScrollInfo(targetElement);

  // Get Shadow DOM container bounds
  const containerBounds = getShadowDomBounds(targetElement);

  // Use caret position if provided, otherwise use element position
  let targetX: number;
  let targetY: number;
  let targetHeight: number;

  if (caretPos) {
    targetX = elementRect.left + caretPos.x;
    targetY = elementRect.top + caretPos.y;
    targetHeight = caretPos.lineHeight;
  } else {
    targetX = elementRect.left;
    targetY = elementRect.bottom;
    targetHeight = elementRect.height;
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
 */
export function calculateCaretDropdownPosition(
  textElement: HTMLTextAreaElement | HTMLInputElement,
  dimensions: DropdownDimensions
): DropdownPosition {
  const caretPos = getCaretPosition(textElement);
  return calculateDropdownPosition(textElement, dimensions, caretPos);
}

/**
 * Applies position styles to a dropdown element
 */
export function applyDropdownPosition(
  dropdownElement: HTMLElement,
  position: DropdownPosition
): void {
  dropdownElement.style.position = 'fixed';
  dropdownElement.style.left = `${position.x}px`;
  dropdownElement.style.top = `${position.y}px`;
  dropdownElement.style.zIndex = '1000';

  // Ensure the dropdown doesn't exceed boundaries
  dropdownElement.style.maxWidth = `${position.maxX - position.x}px`;
  dropdownElement.style.maxHeight = `${position.maxY - position.y}px`;
}

/**
 * Utility function to update dropdown position on scroll or resize
 */
export function createPositionTracker(
  targetElement: HTMLElement,
  dropdownElement: HTMLElement,
  dimensions: DropdownDimensions,
  caretPos?: CaretPosition
): () => void {
  const updatePosition = () => {
    const position = calculateDropdownPosition(targetElement, dimensions, caretPos);
    applyDropdownPosition(dropdownElement, position);
  };

  // Initial positioning
  updatePosition();

  // Get the scroll container
  const scrollInfo = getContainerScrollInfo(targetElement);
  const container = scrollInfo.container;

  // Add event listeners
  container.addEventListener('scroll', updatePosition, { passive: true });
  window.addEventListener('resize', updatePosition, { passive: true });

  // Return cleanup function
  return () => {
    container.removeEventListener('scroll', updatePosition);
    window.removeEventListener('resize', updatePosition);
  };
}

/**
 * Hook-like utility for managing dropdown position with automatic updates
 */
export function useDropdownPosition(
  targetElement: HTMLElement | null,
  dropdownElement: HTMLElement | null,
  dimensions: DropdownDimensions,
  caretPos?: CaretPosition
): DropdownPosition | null {
  if (!targetElement || !dropdownElement) {
    return null;
  }

  const position = calculateDropdownPosition(targetElement, dimensions, caretPos);
  applyDropdownPosition(dropdownElement, position);

  return position;
}
