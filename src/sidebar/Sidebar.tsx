import React, { useState, useEffect, useCallback } from 'react';
import { unmountSidebar } from './index';
import { useSettingsStore } from '@/store/settings';
import { setTheme } from '@/utils/theme';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { MessageList } from '@/sidebar/components/MessageList';
import { ChatInput } from '@/sidebar/components/ChatInput';
import { useChatStore } from '@/store/chat';
import { useMockChat } from '@/sidebar/hooks/useMockChat';

const MIN_WIDTH = 300;
const MAX_WIDTH = 800;
const DEFAULT_WIDTH = 400;
const SIDEBAR_HEIGHT_RATIO = 0.85;
const RIGHT_PADDING = 30; // default space from the right edge

export const Sidebar: React.FC = () => {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarHeight = window.innerHeight * SIDEBAR_HEIGHT_RATIO;
  const initialY = window.innerHeight * ((1 - SIDEBAR_HEIGHT_RATIO) / 2);
  const [position, setPosition] = useState({
    x: window.innerWidth - DEFAULT_WIDTH - RIGHT_PADDING,
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

  // Chat store and mock chat
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
          <div className="ai-sidebar-header-title">
            <h2>AI Assistant</h2>
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
          <div className="ai-sidebar-body">
            <MessageList
              messages={messages}
              isLoading={isLoading}
              emptyMessage="Start a conversation about this webpage"
              autoScroll={true}
              height="100%"
            />
          </div>

          <div className="ai-sidebar-footer">
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
