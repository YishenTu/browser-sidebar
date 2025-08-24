/**
 * @file ResizeHandles Layout Component
 *
 * Resize handle indicators for all edges and corners
 */

import React from 'react';

export interface ResizeHandlesProps {
  /** Mouse down handler for resize */
  onMouseDown: (
    e: React.MouseEvent,
    dir: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
  ) => void;
}

/**
 * ResizeHandles component
 * Pure presentation for N/E/S/W/diagonal resize handles
 */
export const ResizeHandles: React.FC<ResizeHandlesProps> = ({ onMouseDown }) => {
  return (
    <>
      {/* West (left) - keep existing test id for compatibility */}
      <div
        className="ai-sidebar-resize-handle ai-sidebar-resize-handle--w"
        onMouseDown={e => onMouseDown(e, 'w')}
        data-testid="resize-handle"
        style={{ cursor: 'ew-resize' }}
        aria-label="Resize left"
      />
      {/* East (right) */}
      <div
        className="ai-sidebar-resize-handle ai-sidebar-resize-handle--e"
        onMouseDown={e => onMouseDown(e, 'e')}
        aria-label="Resize right"
        style={{ cursor: 'ew-resize' }}
      />
      {/* North (top) */}
      <div
        className="ai-sidebar-resize-handle ai-sidebar-resize-handle--n"
        onMouseDown={e => onMouseDown(e, 'n')}
        aria-label="Resize top"
        style={{ cursor: 'ns-resize' }}
      />
      {/* South (bottom) */}
      <div
        className="ai-sidebar-resize-handle ai-sidebar-resize-handle--s"
        onMouseDown={e => onMouseDown(e, 's')}
        aria-label="Resize bottom"
        style={{ cursor: 'ns-resize' }}
      />
      {/* Corners for diagonal resize */}
      <div
        className="ai-sidebar-resize-handle ai-sidebar-resize-handle--nw"
        onMouseDown={e => onMouseDown(e, 'nw')}
        aria-label="Resize top-left"
        style={{ cursor: 'nwse-resize' }}
      />
      <div
        className="ai-sidebar-resize-handle ai-sidebar-resize-handle--ne"
        onMouseDown={e => onMouseDown(e, 'ne')}
        aria-label="Resize top-right"
        style={{ cursor: 'nesw-resize' }}
      />
      <div
        className="ai-sidebar-resize-handle ai-sidebar-resize-handle--sw"
        onMouseDown={e => onMouseDown(e, 'sw')}
        aria-label="Resize bottom-left"
        style={{ cursor: 'nesw-resize' }}
      />
      <div
        className="ai-sidebar-resize-handle ai-sidebar-resize-handle--se"
        onMouseDown={e => onMouseDown(e, 'se')}
        aria-label="Resize bottom-right"
        style={{ cursor: 'nwse-resize' }}
      />
    </>
  );
};
