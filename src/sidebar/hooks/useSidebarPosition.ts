/**
 * @file Sidebar positioning hook
 * Custom React hook for managing sidebar position, size, and window constraints
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useDragPosition } from '@hooks/useDragPosition';
import { useResize } from '@hooks/useResize';
import {
  MIN_WIDTH,
  MAX_WIDTH,
  DEFAULT_WIDTH,
  MIN_HEIGHT,
  MAX_HEIGHT,
  getInitialY,
  getSidebarHeight,
  getInitialX,
} from '@sidebar/constants';

export interface UseSidebarPositionReturn {
  position: { x: number; y: number };
  size: { width: number; height: number };
  isDragging: boolean;
  width: number;
  height: number;
  sidebarHeight: number;
  handleHeaderMouseDown: (e: React.MouseEvent) => void;
  handleResizeMouseDown: (
    e: React.MouseEvent,
    dir: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
  ) => void;
}

/**
 * Custom hook for managing sidebar positioning and resizing
 */
export function useSidebarPosition(): UseSidebarPositionReturn {
  // First, create state for size to use in drag bounds
  const [currentSize, setCurrentSize] = useState({
    width: DEFAULT_WIDTH,
    height: getSidebarHeight(),
  });

  // Use drag hook for header dragging with DYNAMIC bounds based on current size
  const {
    position,
    isDragging,
    onMouseDown: handleDragMouseDown,
    setPosition,
  } = useDragPosition({
    initialPosition: { x: getInitialX(), y: getInitialY() },
    bounds: {
      minX: 0,
      maxX: window.innerWidth - currentSize.width,
      minY: 0,
      maxY: window.innerHeight - currentSize.height,
    },
  });

  // Track the starting position AND size for resize operations
  const resizeStartPositionRef = useRef(position);
  const resizeStartSizeRef = useRef(currentSize);

  // Use resize hook for edge/corner resizing
  const {
    size,
    onMouseDown: createResizeHandler,
    setSize,
  } = useResize({
    initialSize: { width: DEFAULT_WIDTH, height: getSidebarHeight() },
    minSize: { width: MIN_WIDTH, height: MIN_HEIGHT },
    maxSize: { width: MAX_WIDTH, height: MAX_HEIGHT },
    onResizeStart: () => {
      // Save the starting position AND size when resize begins
      resizeStartPositionRef.current = { ...position };
      resizeStartSizeRef.current = { ...size };
    },
    onResize: (newSize, _handle, deltaPosition) => {
      // Update current size for drag bounds
      setCurrentSize(newSize);

      // When resizing from left or top edges, update position to keep opposite edge fixed
      if (deltaPosition) {
        const newPosition = {
          x: resizeStartPositionRef.current.x + deltaPosition.x,
          y: resizeStartPositionRef.current.y + deltaPosition.y,
        };

        // IMPORTANT: Bypass drag bounds during resize by setting position directly
        // The drag bounds are meant for dragging, not resizing
        setPosition(newPosition);
      }
    },
  });

  // Sync size state
  useEffect(() => {
    setCurrentSize(size);
  }, [size]);

  // For compatibility with existing code
  const width = size.width;
  const height = size.height;
  const sidebarHeight = height;

  // Update bounds when window resizes
  useEffect(() => {
    const handleWindowResize = () => {
      // Update position bounds
      setPosition({
        x: Math.min(position.x, window.innerWidth - size.width),
        y: Math.min(position.y, window.innerHeight - size.height),
      });

      // Update size if needed
      setSize({
        width: Math.min(size.width, window.innerWidth),
        height: Math.min(size.height, window.innerHeight * 0.85),
      });
    };

    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [position, size, setPosition, setSize]);

  // Handle header mouse down for dragging
  const handleHeaderMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only start dragging if not clicking on close button, clear button, or ModelSelector
      const target = e.target as HTMLElement;
      if (
        target.classList.contains('ai-sidebar-close') ||
        target.closest('.ai-sidebar-clear') ||
        target.closest('.model-selector') ||
        target.closest('button')
      ) {
        return;
      }

      handleDragMouseDown(e);
    },
    [handleDragMouseDown]
  );

  // Generic resize mouse down handler for any edge/corner
  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent, dir: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw') => {
      if (isDragging) return;
      const handler = createResizeHandler(dir);
      handler(e);
    },
    [isDragging, createResizeHandler]
  );

  return {
    position,
    size,
    isDragging,
    width,
    height,
    sidebarHeight,
    handleHeaderMouseDown,
    handleResizeMouseDown,
  };
}
