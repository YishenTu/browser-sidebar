/**
 * @file Geometry Utilities
 *
 * Pure functions for geometric calculations including position constraints,
 * resize calculations, and cursor mappings
 */

// ============================================================================
// Types
// ============================================================================

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Bounds {
  minX?: number;
  maxX?: number;
  minY?: number;
  maxY?: number;
}

export interface SizeBounds {
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
}

export type ResizeHandle = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

export interface ResizeCalculation {
  size: Size;
  deltaPosition: Position;
}

// ============================================================================
// Position Functions
// ============================================================================

/**
 * Constrain a position to specified bounds
 *
 * @param pos - The position to constrain
 * @param bounds - The boundary constraints
 * @returns The constrained position
 */
export function constrainPosition(pos: Position, bounds?: Bounds): Position {
  if (!bounds) return pos;

  return {
    x: Math.max(bounds.minX ?? -Infinity, Math.min(bounds.maxX ?? Infinity, pos.x)),
    y: Math.max(bounds.minY ?? -Infinity, Math.min(bounds.maxY ?? Infinity, pos.y)),
  };
}

// ============================================================================
// Size Functions
// ============================================================================

/**
 * Constrain a size to min/max bounds
 *
 * @param size - The size to constrain
 * @param minSize - Minimum size constraints
 * @param maxSize - Maximum size constraints
 * @returns The constrained size
 */
export function constrainSize(
  size: Size,
  minSize: Size = { width: 0, height: 0 },
  maxSize: Size = { width: Infinity, height: Infinity }
): Size {
  return {
    width: Math.max(minSize.width, Math.min(maxSize.width, size.width)),
    height: Math.max(minSize.height, Math.min(maxSize.height, size.height)),
  };
}

// ============================================================================
// Resize Functions
// ============================================================================

/**
 * Calculate new size and position delta based on mouse position and resize handle
 *
 * @param startSize - The initial size before resize
 * @param startMousePos - The initial mouse position
 * @param currentMousePos - The current mouse position
 * @param handle - The resize handle being used
 * @param sizeBounds - Size constraints
 * @returns The new size and position delta
 */
export function calculateNewSizeAndPosition(
  startSize: Size,
  startMousePos: Position,
  currentMousePos: Position,
  handle: ResizeHandle,
  sizeBounds: SizeBounds
): ResizeCalculation {
  const deltaX = currentMousePos.x - startMousePos.x;
  const deltaY = currentMousePos.y - startMousePos.y;
  let newWidth = startSize.width;
  let newHeight = startSize.height;
  let positionDeltaX = 0;
  let positionDeltaY = 0;

  // Handle horizontal resizing
  if (handle.includes('e')) {
    // Resizing from right edge - width changes, position stays fixed
    newWidth = Math.max(
      sizeBounds.minWidth,
      Math.min(sizeBounds.maxWidth, startSize.width + deltaX)
    );
  } else if (handle.includes('w')) {
    // Resizing from left edge - width changes inversely, position must move
    const proposedWidth = startSize.width - deltaX;
    newWidth = Math.max(sizeBounds.minWidth, Math.min(sizeBounds.maxWidth, proposedWidth));

    // Position should move by how much we actually resized
    const actualSizeChange = startSize.width - newWidth;
    positionDeltaX = actualSizeChange;
  }

  // Handle vertical resizing
  if (handle.includes('s')) {
    // Resizing from bottom edge - height changes, position stays fixed
    newHeight = Math.max(
      sizeBounds.minHeight,
      Math.min(sizeBounds.maxHeight, startSize.height + deltaY)
    );
  } else if (handle.includes('n')) {
    // Resizing from top edge - height changes inversely, position must move
    const proposedHeight = startSize.height - deltaY;
    newHeight = Math.max(sizeBounds.minHeight, Math.min(sizeBounds.maxHeight, proposedHeight));

    // Position should move by how much we actually resized
    const actualSizeChange = startSize.height - newHeight;
    positionDeltaY = actualSizeChange;
  }

  return {
    size: { width: newWidth, height: newHeight },
    deltaPosition: { x: positionDeltaX, y: positionDeltaY },
  };
}

/**
 * Get appropriate cursor style for resize handle
 *
 * @param handle - The resize handle
 * @returns The CSS cursor value
 */
export function getCursorForHandle(handle: ResizeHandle): string {
  switch (handle) {
    case 'n':
    case 's':
      return 'ns-resize';
    case 'e':
    case 'w':
      return 'ew-resize';
    case 'ne':
    case 'sw':
      return 'nesw-resize';
    case 'nw':
    case 'se':
      return 'nwse-resize';
    default:
      return 'default';
  }
}
