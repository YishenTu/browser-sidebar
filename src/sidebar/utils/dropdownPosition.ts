/**
 * Dropdown Position Calculator for Shadow DOM
 *
 * This utility provides DOM-specific wrappers around core position calculation
 * functions, handling Shadow DOM contexts, scroll positions, and caret positioning.
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

import {
  calculateDropdownPosition as calculateDropdownPositionCore,
  getDynamicLineHeight as getDynamicLineHeightCore,
  getShadowDomBounds as getShadowDomBoundsCore,
  type DropdownPosition,
  type DropdownDimensions,
  type CaretPosition,
  type ElementBounds,
} from '@core/utils/positionCalculation';

export type {
  DropdownPosition,
  DropdownDimensions,
  CaretPosition,
} from '@core/utils/positionCalculation';

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

  // Calculate line height using core function
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
  return getDynamicLineHeightCore({
    lineHeight: style.lineHeight,
    fontSize: style.fontSize,
  });
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
function getShadowDomBounds(element: HTMLElement): ElementBounds {
  const root = element.getRootNode();

  if (root === document) {
    // Not in Shadow DOM, use viewport
    return getShadowDomBoundsCore(null, {
      width: window.innerWidth,
      height: window.innerHeight,
    });
  }

  const shadowRoot = root as ShadowRoot;

  // Find the actual container element within the shadow DOM
  const container = shadowRoot.querySelector('#ai-browser-sidebar-root') as HTMLElement;

  if (container) {
    const rect = container.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    };
  }

  // Fallback to host element bounds
  const host = shadowRoot.host as HTMLElement;
  const hostRect = host.getBoundingClientRect();
  return {
    left: hostRect.left,
    top: hostRect.top,
    right: hostRect.right,
    bottom: hostRect.bottom,
    width: hostRect.width,
    height: hostRect.height,
  };
}

/**
 * Convert DOMRect to ElementBounds
 */
function rectToBounds(rect: DOMRect): ElementBounds {
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
}

/**
 * Calculates optimal dropdown position relative to a target element or caret position
 */
export function calculateDropdownPosition(
  targetElement: HTMLElement,
  dimensions: DropdownDimensions,
  caretPos?: CaretPosition
): DropdownPosition {
  // Get element bounds
  const elementRect = targetElement.getBoundingClientRect();
  const targetBounds = rectToBounds(elementRect);

  // Get scroll information
  const scrollInfo = getContainerScrollInfo(targetElement);

  // Get Shadow DOM container bounds
  const containerBounds = getShadowDomBounds(targetElement);

  return calculateDropdownPositionCore(
    targetBounds,
    dimensions,
    containerBounds,
    scrollInfo,
    caretPos
  );
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
