/**
 * @file useDragPosition Hook
 *
 * Custom React hook for handling draggable element positioning.
 * Provides drag functionality with offset tracking and boundary constraints.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { constrainPosition as constrainPositionCore } from '@core/utils/geometry';
import type { Position, Bounds } from '@core/utils/geometry';

export type { Position } from '@core/utils/geometry';

export interface DragState {
  isDragging: boolean;
  startPosition: Position;
  currentPosition: Position;
  offset: Position;
}

export interface UseDragPositionOptions {
  /** Initial position */
  initialPosition?: Position;
  /** Whether dragging is enabled */
  enabled?: boolean;
  /** Boundary constraints */
  bounds?: Bounds;
  /** Callback when drag starts */
  onDragStart?: (position: Position) => void;
  /** Callback during drag */
  onDrag?: (position: Position) => void;
  /** Callback when drag ends */
  onDragEnd?: (position: Position) => void;
}

export interface UseDragPositionReturn {
  /** Current position */
  position: Position;
  /** Whether currently dragging */
  isDragging: boolean;
  /** Handler for mousedown on drag handle */
  onMouseDown: (e: React.MouseEvent) => void;
  /** Programmatically set position */
  setPosition: (position: Position) => void;
}

/**
 * Hook for handling draggable element positioning
 */
export function useDragPosition(options: UseDragPositionOptions = {}): UseDragPositionReturn {
  const {
    initialPosition = { x: 0, y: 0 },
    enabled = true,
    bounds,
    onDragStart,
    onDrag,
    onDragEnd,
  } = options;

  const [position, setPosition] = useState<Position>(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const dragState = useRef<DragState>({
    isDragging: false,
    startPosition: initialPosition,
    currentPosition: initialPosition,
    offset: { x: 0, y: 0 },
  });

  // Constrain position to bounds
  const constrainPosition = useCallback(
    (pos: Position): Position => {
      return constrainPositionCore(pos, bounds);
    },
    [bounds]
  );

  // Handle mouse move during drag
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragState.current.isDragging) return;

      const newPosition = constrainPosition({
        x: e.clientX - dragState.current.offset.x,
        y: e.clientY - dragState.current.offset.y,
      });

      dragState.current.currentPosition = newPosition;
      setPosition(newPosition);
      onDrag?.(newPosition);
    },
    [constrainPosition, onDrag]
  );

  // Handle mouse up to end drag
  const handleMouseUp = useCallback(() => {
    if (!dragState.current.isDragging) return;

    dragState.current.isDragging = false;
    setIsDragging(false);

    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    onDragEnd?.(dragState.current.currentPosition);
  }, [onDragEnd]);

  // Handle mouse down to start drag
  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!enabled) return;

      e.preventDefault();
      e.stopPropagation();

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const parentRect = (e.currentTarget as HTMLElement).parentElement?.getBoundingClientRect();

      // Calculate offset from mouse position to element position
      const offset = {
        x: e.clientX - (parentRect?.left ?? rect.left),
        y: e.clientY - (parentRect?.top ?? rect.top),
      };

      dragState.current = {
        isDragging: true,
        startPosition: position,
        currentPosition: position,
        offset,
      };

      setIsDragging(true);
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';

      onDragStart?.(position);
    },
    [enabled, position, onDragStart]
  );

  // Set up and clean up event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
    return undefined;
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, []);

  return {
    position,
    isDragging,
    onMouseDown,
    setPosition: (newPosition: Position) => setPosition(constrainPosition(newPosition)),
  };
}
