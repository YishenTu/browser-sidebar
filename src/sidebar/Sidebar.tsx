import React, { useState, useEffect, useCallback } from 'react';
import { unmountSidebar } from './index';
import { useSettingsStore } from '@/store/settings';
import { setTheme } from '@/utils/theme';

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

  // Subscribe to theme changes
  const theme = useSettingsStore(state => state.settings.theme);

  // Apply theme when it changes
  useEffect(() => {
    setTheme(theme);
  }, [theme]);

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

  // Handle Escape key to close sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleClose]);

  // Auto-focus sidebar when opened for accessibility
  useEffect(() => {
    const sidebar = document.querySelector('.ai-sidebar-overlay') as HTMLElement;
    if (sidebar) {
      sidebar.setAttribute('tabindex', '-1');
      sidebar.focus();
    }
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
      role="dialog"
      aria-label="AI Browser Sidebar"
      aria-modal="false"
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
          <button
            onClick={handleClose}
            className="ai-sidebar-close"
            aria-label="Close sidebar"
            title="Close (Esc)"
          >
            ×
          </button>
        </div>

        <div className="ai-sidebar-content">
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Chat with any webpage using AI
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                Drag header to move • Drag left edge to resize
              </p>
            </div>

            {/* Demo chat interface preview */}
            <div className="space-y-3">
              <div className="chat-message user animate-slide-up">
                <p className="text-sm">Hello! Can you help me understand this webpage?</p>
              </div>

              <div className="chat-message ai animate-slide-up" style={{ animationDelay: '0.2s' }}>
                <p className="text-sm">
                  I&apos;d be happy to help you understand the content on this webpage. What
                  specific aspect would you like me to explain?
                </p>
              </div>
            </div>

            {/* Chat input area */}
            <div className="mt-6 space-y-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Ask about this webpage..."
                  className="chat-input"
                  disabled
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <div className="w-2 h-2 bg-primary-500 rounded-full animate-pulse-soft"></div>
                </div>
              </div>

              <div className="flex gap-2">
                <button className="chat-button flex-1" disabled>
                  Send
                </button>
                <button className="chat-button secondary" disabled>
                  Clear
                </button>
              </div>
            </div>

            {/* Status indicator */}
            <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-warning-500 rounded-full"></div>
                <span className="text-xs text-amber-700 dark:text-amber-300">
                  Stage 2: Chat interface coming soon
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
