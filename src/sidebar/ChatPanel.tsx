/**
 * @file Unified ChatPanel Component
 *
 * Unified component that merges Sidebar.tsx and the existing ChatPanel.tsx functionality.
 * Provides a complete chat interface with overlay positioning, resize/drag capabilities,
 * and Shadow DOM isolation.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { unmountSidebar } from './index';
import { useSettingsStore } from '@/store/settings';
import { setTheme } from '@/utils/theme';
import { ThemeProvider } from '@sidebar/contexts/ThemeContext';
import { MessageList } from '@/sidebar/components/MessageList';
import { ChatInput } from '@/sidebar/components/ChatInput';
import { useChatStore } from '@/store/chat';
import { useMockChat } from '@/sidebar/hooks/useMockChat';
// import { ModelSelector } from '@components/ModelSelector'; // Commented out - using simple select instead

// Constants for sizing and positioning
const MIN_WIDTH = 300;
const MAX_WIDTH = 800;
const DEFAULT_WIDTH = 400;
const MIN_HEIGHT = 200;
const MAX_HEIGHT = typeof window !== 'undefined' ? Math.round(window.innerHeight) : 1000;
const SIDEBAR_HEIGHT_RATIO = 0.85;
const RIGHT_PADDING = 30; // default space from the right edge

export interface ChatPanelProps {
  /** Custom CSS class name */
  className?: string;
  /** Callback when sidebar is closed */
  onClose: () => void;
}

/**
 * Unified ChatPanel Component
 *
 * A complete chat interface that combines overlay positioning, resize/drag functionality,
 * and chat components into a single unified component. Features:
 *
 * - Fixed overlay positioning with high z-index
 * - Resizable width (300-800px) with left edge drag handle
 * - Draggable positioning by header
 * - 85% viewport height, vertically centered
 * - Shadow DOM isolation
 * - Theme support
 * - Keyboard accessibility (Escape to close)
 * - Chat functionality with message history and AI responses
 *
 * @example
 * ```tsx
 * <ChatPanel onClose={() => unmountSidebar()} />
 * ```
 */
export const ChatPanel: React.FC<ChatPanelProps> = ({ className, onClose }) => {
  // Positioning and sizing state
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [height, setHeight] = useState(Math.round(window.innerHeight * SIDEBAR_HEIGHT_RATIO));
  const [isResizing, setIsResizing] = useState(false);
  const resizeDirRef = useRef<null | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const initialRectRef = useRef<{ x: number; y: number; width: number; height: number } | null>(
    null
  );
  const sidebarHeight = height;
  const initialY = Math.round(window.innerHeight * ((1 - SIDEBAR_HEIGHT_RATIO) / 2));
  const [position, setPosition] = useState({
    x: window.innerWidth - DEFAULT_WIDTH - RIGHT_PADDING,
    y: initialY,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Settings store integration
  const theme = useSettingsStore(state => state.settings.theme);

  // Apply theme when it changes
  useEffect(() => {
    setTheme(theme);
  }, [theme]);

  // Chat store and mock chat integration
  const { messages, isLoading, addMessage, clearConversation, hasMessages } = useChatStore();
  const { generateResponse } = useMockChat({
    enabled: true,
    responseType: 'text',
    streamingSpeed: 'normal',
    thinkingDelay: 800,
  });

  // Handle sending messages
  const handleSendMessage = useCallback(
    async (content: string) => {
      addMessage({
        role: 'user',
        content,
      });
      await generateResponse(content);
    },
    [addMessage, generateResponse]
  );

  // Handle clear conversation
  const handleClearConversation = useCallback(() => {
    if (hasMessages() && window.confirm('Clear conversation? This cannot be undone.')) {
      clearConversation();
    }
  }, [hasMessages, clearConversation]);

  // Handle resize and drag mouse events
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing) {
        const dir = resizeDirRef.current;
        const start = startRef.current;
        const initial = initialRectRef.current;
        if (!dir || !start || !initial) return;

        const initialRight = initial.x + initial.width;
        const initialBottom = initial.y + initial.height;

        let nextX = initial.x;
        let nextY = initial.y;
        let nextW = initial.width;
        let nextH = initial.height;

        // Horizontal edges (absolute mouse coordinates relative to opposite edge)
        if (dir.includes('w')) {
          const rawW = initialRight - e.clientX;
          const clampedW = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, rawW));
          nextW = clampedW;
          nextX = initialRight - clampedW;
        }
        if (dir.includes('e')) {
          const rawW = e.clientX - initial.x;
          const clampedW = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, rawW));
          nextW = clampedW;
          nextX = initial.x;
        }

        // Vertical edges
        if (dir.includes('n')) {
          const rawH = initialBottom - e.clientY;
          const clampedH = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, rawH));
          nextH = clampedH;
          nextY = initialBottom - clampedH;
        }
        if (dir.includes('s')) {
          const rawH = e.clientY - initial.y;
          const clampedH = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, rawH));
          nextH = clampedH;
          nextY = initial.y;
        }

        setPosition({ x: nextX, y: nextY });
        setWidth(nextW);
        setHeight(nextH);
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
      resizeDirRef.current = null;
      startRef.current = null;
      initialRectRef.current = null;
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

  // Handle close functionality
  const handleClose = useCallback(() => {
    unmountSidebar();
    chrome.runtime.sendMessage({ type: 'sidebar-closed' });
    onClose();
  }, [onClose]);

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

      setIsDragging(true);
      setDragOffset({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    },
    [position]
  );

  // Generic resize mouse down handler for any edge/corner
  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent, dir: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw') => {
      if (isDragging) return;
      resizeDirRef.current = dir;
      startRef.current = { x: e.clientX, y: e.clientY };
      initialRectRef.current = { x: position.x, y: position.y, width, height };
      setIsResizing(true);
      e.preventDefault();
      e.stopPropagation();
    },
    [height, width, position, isDragging]
  );

  return (
    <div
      className={`ai-sidebar-overlay ${className || ''}`}
      role="dialog"
      aria-label="AI Browser Sidebar"
      aria-modal="false"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${width}px`,
        height: `${sidebarHeight}px`,
      }}
      data-testid="chat-panel"
    >
      <div className="ai-sidebar-container" data-testid="sidebar-container">
        <div
          className="ai-sidebar-header"
          onMouseDown={handleHeaderMouseDown}
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
          data-testid="sidebar-header"
        >
          <div className="ai-sidebar-header-title">
            {/* Simple model selector - static for now to avoid infinite loops */}
            <select 
              className="model-selector--header"
              style={{
                padding: '4px 8px',
                borderRadius: '4px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                fontSize: '12px',
                cursor: 'pointer',
                outline: 'none'
              }}
              disabled={isLoading}
              defaultValue="gpt-4"
              onChange={(e) => {
                // console.log('Model selected:', e.target.value);
                // For now, just log - don't update store to avoid loops
                // eslint-disable-next-line no-console
                console.log('Model selected:', e.target.value);
              }}
            >
              <option value="gpt-4">GPT-4</option>
              <option value="gpt-3.5-turbo">GPT-3.5</option>
              <option value="claude-3">Claude 3</option>
              <option value="claude-2">Claude 2</option>
              <option value="gemini-pro">Gemini Pro</option>
              <option value="llama-2">Llama 2</option>
            </select>
            <h2></h2>
          </div>
          <div className="ai-sidebar-header-actions">
            {hasMessages() && (
              <button
                onClick={handleClearConversation}
                className="ai-sidebar-clear"
                aria-label="New session"
                title="Start new session"
                style={{
                  marginRight: '8px'
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 5v14" />
                  <path d="M5 12h14" />
                </svg>
              </button>
            )}
            <button
              onClick={handleClose}
              className="ai-sidebar-close"
              aria-label="Close sidebar"
              title="Close (Esc)"
            >
              ×
            </button>
          </div>
        </div>

        <ThemeProvider>
          <div className="ai-sidebar-body" data-testid="sidebar-body">
            <MessageList
              messages={messages}
              isLoading={isLoading}
              emptyMessage=""
              autoScroll={true}
              height="100%"
            />
          </div>

          <div className="ai-sidebar-footer" data-testid="sidebar-footer">
            <ChatInput
              onSend={handleSendMessage}
              loading={isLoading}
              placeholder="Ask about this webpage..."
            />
          </div>
        </ThemeProvider>
      </div>

      {/* Resize handles placed AFTER the container so they are not covered */}
      {/* West (left) - keep existing test id for compatibility */}
      <div
        className="ai-sidebar-resize-handle ai-sidebar-resize-handle--w"
        onMouseDown={e => handleResizeMouseDown(e, 'w')}
        data-testid="resize-handle"
        style={{ cursor: 'ew-resize' }}
        aria-label="Resize left"
      />
      {/* East (right) */}
      <div
        className="ai-sidebar-resize-handle ai-sidebar-resize-handle--e"
        onMouseDown={e => handleResizeMouseDown(e, 'e')}
        aria-label="Resize right"
      />
      {/* North (top) */}
      <div
        className="ai-sidebar-resize-handle ai-sidebar-resize-handle--n"
        onMouseDown={e => handleResizeMouseDown(e, 'n')}
        aria-label="Resize top"
      />
      {/* South (bottom) */}
      <div
        className="ai-sidebar-resize-handle ai-sidebar-resize-handle--s"
        onMouseDown={e => handleResizeMouseDown(e, 's')}
        aria-label="Resize bottom"
      />
      {/* Corners for diagonal resize */}
      <div
        className="ai-sidebar-resize-handle ai-sidebar-resize-handle--nw"
        onMouseDown={e => handleResizeMouseDown(e, 'nw')}
        aria-label="Resize top-left"
        style={{ cursor: 'nwse-resize' }}
      />
      <div
        className="ai-sidebar-resize-handle ai-sidebar-resize-handle--ne"
        onMouseDown={e => handleResizeMouseDown(e, 'ne')}
        aria-label="Resize top-right"
        style={{ cursor: 'nesw-resize' }}
      />
      <div
        className="ai-sidebar-resize-handle ai-sidebar-resize-handle--sw"
        onMouseDown={e => handleResizeMouseDown(e, 'sw')}
        aria-label="Resize bottom-left"
        style={{ cursor: 'nesw-resize' }}
      />
      <div
        className="ai-sidebar-resize-handle ai-sidebar-resize-handle--se"
        onMouseDown={e => handleResizeMouseDown(e, 'se')}
        aria-label="Resize bottom-right"
        style={{ cursor: 'nwse-resize' }}
      />
    </div>
  );
};

export default ChatPanel;
