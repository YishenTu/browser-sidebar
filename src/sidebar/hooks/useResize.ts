/**
 * @file useResize Hook
 *
 * Custom React hook for handling resizable element functionality.
 * Supports resizing from edges and corners with constraint validation.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  calculateNewSizeAndPosition as calculateNewSizeAndPositionCore,
  getCursorForHandle,
  constrainSize as constrainSizeCore,
} from '@core/utils/geometry';
import type { Size, ResizeHandle } from '@core/utils/geometry';

export type { Size, ResizeHandle } from '@core/utils/geometry';

export interface ResizeState {
  isResizing: boolean;
  startSize: Size;
  startPosition: { x: number; y: number };
  handle: ResizeHandle | null;
}

export interface UseResizeOptions {
  /** Initial size */
  initialSize?: Size;
  /** Minimum size constraints */
  minSize?: Size;
  /** Maximum size constraints */
  maxSize?: Size;
  /** Whether resizing is enabled */
  enabled?: boolean;
  /** Callback when resize starts */
  onResizeStart?: (size: Size, handle: ResizeHandle) => void;
  /** Callback during resize */
  onResize?: (size: Size, handle: ResizeHandle, deltaPosition?: { x: number; y: number }) => void;
  /** Callback when resize ends */
  onResizeEnd?: (size: Size, handle: ResizeHandle) => void;
}

export interface UseResizeReturn {
  /** Current size */
  size: Size;
  /** Whether currently resizing */
  isResizing: boolean;
  /** Create handler for specific resize handle */
  onMouseDown: (handle: ResizeHandle) => (e: React.MouseEvent) => void;
  /** Programmatically set size */
  setSize: (size: Size) => void;
}

/**
 * Hook for handling resizable element functionality
 */
export function useResize(options: UseResizeOptions = {}): UseResizeReturn {
  const {
    initialSize = { width: 300, height: 400 },
    minSize = { width: 200, height: 200 },
    maxSize = { width: 800, height: 800 },
    enabled = true,
    onResizeStart,
    onResize,
    onResizeEnd,
  } = options;

  const [size, setSize] = useState<Size>(initialSize);
  const [isResizing, setIsResizing] = useState(false);
  const resizeState = useRef<ResizeState>({
    isResizing: false,
    startSize: initialSize,
    startPosition: { x: 0, y: 0 },
    handle: null,
  });

  // Constrain size to min/max bounds
  const constrainSize = useCallback(
    (newSize: Size): Size => {
      return constrainSizeCore(newSize, minSize, maxSize);
    },
    [minSize, maxSize]
  );

  // Calculate new size and position delta based on mouse position and handle
  const calculateNewSizeAndPosition = useCallback(
    (e: MouseEvent): { size: Size; deltaPosition: { x: number; y: number } } => {
      const state = resizeState.current;
      if (!state.handle) return { size: state.startSize, deltaPosition: { x: 0, y: 0 } };

      return calculateNewSizeAndPositionCore(
        state.startSize,
        state.startPosition,
        { x: e.clientX, y: e.clientY },
        state.handle,
        {
          minWidth: minSize.width,
          maxWidth: maxSize.width,
          minHeight: minSize.height,
          maxHeight: maxSize.height,
        }
      );
    },
    [minSize, maxSize]
  );

  // Handle mouse move during resize
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!resizeState.current.isResizing || !resizeState.current.handle) return;

      const { size: newSize, deltaPosition } = calculateNewSizeAndPosition(e);
      // Don't apply constrainSize here - it's already handled in calculateNewSizeAndPosition

      setSize(newSize);
      onResize?.(newSize, resizeState.current.handle, deltaPosition);
    },
    [calculateNewSizeAndPosition, onResize]
  );

  // Handle mouse up to end resize
  const handleMouseUp = useCallback(() => {
    if (!resizeState.current.isResizing || !resizeState.current.handle) return;

    const handle = resizeState.current.handle;

    // Reset resize state
    resizeState.current.isResizing = false;
    resizeState.current.handle = null;
    resizeState.current.startPosition = { x: 0, y: 0 };

    setIsResizing(false);

    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    onResizeEnd?.(size, handle);
  }, [size, onResizeEnd]);

  // Create mouse down handler for specific resize handle
  const onMouseDown = useCallback(
    (handle: ResizeHandle) => {
      return (e: React.MouseEvent) => {
        if (!enabled) return;

        // Prevent starting a new resize if one is already in progress
        if (resizeState.current.isResizing) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        e.preventDefault();
        e.stopPropagation();

        resizeState.current = {
          isResizing: true,
          startSize: { ...size }, // Make a copy to ensure it doesn't change
          startPosition: { x: e.clientX, y: e.clientY },
          handle,
        };

        setIsResizing(true);
        document.body.style.cursor = getCursorForHandle(handle);
        document.body.style.userSelect = 'none';

        onResizeStart?.(size, handle);
      };
    },
    [enabled, size, onResizeStart]
  );

  // Set up and clean up event listeners
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
    return undefined;
  }, [isResizing, handleMouseMove, handleMouseUp]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, []);

  return {
    size,
    isResizing,
    onMouseDown,
    setSize: (newSize: Size) => setSize(constrainSize(newSize)),
  };
}
