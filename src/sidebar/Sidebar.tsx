import React, { useState, useEffect, useCallback } from 'react';
import { unmountSidebar } from './index';

const MIN_WIDTH = 300;
const MAX_WIDTH = 800;
const DEFAULT_WIDTH = 400;
const SIDEBAR_HEIGHT_RATIO = 0.85;

export const Sidebar: React.FC = () => {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarHeight = window.innerHeight * SIDEBAR_HEIGHT_RATIO;
  const initialY = window.innerHeight * ((1 - SIDEBAR_HEIGHT_RATIO) / 2);
  const [position, setPosition] = useState({
    x: window.innerWidth - DEFAULT_WIDTH,
    y: initialY,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Handle resize and drag
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing) {
        const newWidth = window.innerWidth - e.clientX;
        setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, newWidth)));
        setPosition(prev => ({ ...prev, x: e.clientX }));
      }
      if (isDragging) {
        setPosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y,
        });
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      setIsDragging(false);
    };

    if (isResizing || isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
    };
  }, [isResizing, isDragging, dragOffset]);

  // Component is mounted/unmounted directly, no need for toggle events

  const handleClose = useCallback(() => {
    unmountSidebar();
    chrome.runtime.sendMessage({ type: 'sidebar-closed' });
  }, []);

  const handleHeaderMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only start dragging if not clicking on close button
      if ((e.target as HTMLElement).classList.contains('ai-sidebar-close')) return;

      setIsDragging(true);
      setDragOffset({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    },
    [position]
  );

  const handleResizeMouseDown = useCallback(() => {
    setIsResizing(true);
  }, []);

  return (
    <div
      className="ai-sidebar-overlay"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${width}px`,
        height: `${sidebarHeight}px`,
      }}
    >
      {/* Resize handle */}
      <div className="ai-sidebar-resize-handle" onMouseDown={handleResizeMouseDown} />

      <div className="ai-sidebar-container">
        <div
          className="ai-sidebar-header"
          onMouseDown={handleHeaderMouseDown}
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        >
          <h2>AI Browser Sidebar</h2>
          <button onClick={handleClose} className="ai-sidebar-close">
            ×
          </button>
        </div>

        <div className="ai-sidebar-content">
          <p>Chat with any webpage using AI</p>
          <div className="ai-sidebar-info">
            <small>Drag header to move • Drag left edge to resize</small>
          </div>

          {/* This is where we'll add the chat interface components */}
        </div>
      </div>
    </div>
  );
};
