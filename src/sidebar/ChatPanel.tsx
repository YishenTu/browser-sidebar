/**
 * @file Unified ChatPanel Component
 *
 * Unified component that merges Sidebar.tsx and the existing ChatPanel.tsx functionality.
 * Provides a complete chat interface with overlay positioning, resize/drag capabilities,
 * and Shadow DOM isolation.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { unmountSidebar } from './index';
import { useSettingsStore } from '@/store/settings';
import { setTheme } from '@/utils/theme';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { MessageList } from '@/sidebar/components/MessageList';
import { ChatInput } from '@/sidebar/components/ChatInput';
import { useChatStore } from '@/store/chat';
import { useMockChat } from '@/sidebar/hooks/useMockChat';

// Constants for sizing and positioning
const MIN_WIDTH = 300;
const MAX_WIDTH = 800;
const DEFAULT_WIDTH = 400;
const SIDEBAR_HEIGHT_RATIO = 0.85;

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
export const ChatPanel: React.FC<ChatPanelProps> = ({
  className,
  onClose
}) => {
  // Positioning and sizing state
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarHeight = Math.round(window.innerHeight * SIDEBAR_HEIGHT_RATIO);
  const initialY = Math.round(window.innerHeight * ((1 - SIDEBAR_HEIGHT_RATIO) / 2));
  const [position, setPosition] = useState({
    x: window.innerWidth - DEFAULT_WIDTH,
    y: initialY,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Theme integration
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
        const newWidth = window.innerWidth - e.clientX;
        const constrainedWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, newWidth));
        setWidth(constrainedWidth);
        setPosition(prev => ({ ...prev, x: window.innerWidth - constrainedWidth }));
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
      // Only start dragging if not clicking on close button or clear button
      const target = e.target as HTMLElement;
      if (target.classList.contains('ai-sidebar-close') || 
          target.closest('.ai-sidebar-clear') ||
          target.closest('button')) {
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

  // Handle resize mouse down
  const handleResizeMouseDown = useCallback(() => {
    // Only start resize if not already dragging
    if (!isDragging) {
      setIsResizing(true);
    }
  }, [isDragging]);

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
      {/* Resize handle */}
      <div 
        className="ai-sidebar-resize-handle" 
        onMouseDown={handleResizeMouseDown}
        data-testid="resize-handle"
        style={{ cursor: 'ew-resize' }}
      />

      <div className="ai-sidebar-container" data-testid="sidebar-container">
        <div
          className="ai-sidebar-header"
          onMouseDown={handleHeaderMouseDown}
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
          data-testid="sidebar-header"
        >
          <div className="ai-sidebar-header-title">
            <h2></h2>
          </div>
          <div className="ai-sidebar-header-actions">
            {hasMessages() && (
              <button
                onClick={handleClearConversation}
                className="ai-sidebar-clear"
                aria-label="Clear conversation"
                title="Clear conversation"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M3 6h18" />
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
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
    </div>
  );
};

export default ChatPanel;