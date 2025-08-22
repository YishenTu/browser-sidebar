/**
 * @file Unified ChatPanel Component
 *
 * Unified component that merges Sidebar.tsx and the existing ChatPanel.tsx functionality.
 * Provides a complete chat interface with overlay positioning, resize/drag capabilities,
 * and Shadow DOM isolation.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { unmountSidebar } from './index';
import { useSettingsStore } from '@store/settings';
import { setTheme } from '@utils/theme';
import { ThemeProvider } from '@contexts/ThemeContext';
import { MessageList } from '@components/MessageList';
import { ChatInput } from '@components/ChatInput';
import { ModelSelector } from '@components/ModelSelector';
import { useChatStore } from '@store/chat';
import { useAIChat } from '@hooks/useAIChat';

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
  const selectedModel = useSettingsStore(state => state.settings.selectedModel);
  const updateSelectedModel = useSettingsStore(state => state.updateSelectedModel);
  const getProviderTypeForModel = useSettingsStore(state => state.getProviderTypeForModel);
  const loadSettings = useSettingsStore(state => state.loadSettings);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Apply theme when it changes
  useEffect(() => {
    setTheme(theme);
  }, [theme]);

  // Chat store and AI chat integration
  const { messages, isLoading, clearConversation, hasMessages } = useChatStore();
  const { sendMessage, switchProvider, cancelMessage } = useAIChat({
    enabled: true,
    autoInitialize: true, // Auto-initialize providers from settings
  });

  // API key state for temporary settings
  const [showSettings, setShowSettings] = useState(false);
  const [apiKeys, setApiKeys] = useState({ openai: '', google: '' });
  const updateAPIKeyReferences = useSettingsStore(state => state.updateAPIKeyReferences);
  const resetToDefaults = useSettingsStore(state => state.resetToDefaults);

  // Handle sending messages
  const handleSendMessage = useCallback(
    async (content: string) => {
      await sendMessage(content, {
        streaming: true,
        priority: 'high',
      });
    },
    [sendMessage]
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
            <ModelSelector
              className="model-selector--header"
              value={selectedModel}
              onChange={async modelId => {
                try {
                  // Update the selected model in settings (this also updates the provider)
                  await updateSelectedModel(modelId);

                  // Switch to the corresponding provider in the AI chat system
                  const providerType = getProviderTypeForModel(modelId);
                  if (providerType) {
                    await switchProvider(providerType);
                  }
                } catch (err) {
                  // Gracefully ignore here; store already set error
                  console.warn('Failed to switch model/provider:', err);
                }
              }}
              disabled={isLoading}
              aria-label="Select AI model"
            />
            <h2></h2>
          </div>
          <div className="ai-sidebar-header-actions">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="ai-sidebar-settings"
              aria-label="Settings"
              title="API Settings"
              style={{
                marginRight: '8px',
                background: 'none',
                border: 'none',
                color: 'inherit',
                cursor: 'pointer',
                padding: '4px',
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
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v6M12 17v6M4.22 4.22l4.24 4.24M15.54 15.54l4.24 4.24M1 12h6M17 12h6M4.22 19.78l4.24-4.24M15.54 8.46l4.24-4.24" />
              </svg>
            </button>
            {hasMessages() && (
              <button
                onClick={handleClearConversation}
                className="ai-sidebar-clear"
                aria-label="New session"
                title="Start new session"
                style={{
                  marginRight: '8px',
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
          {showSettings ? (
            <div
              className="ai-sidebar-settings-panel"
              style={{
                padding: '20px',
                overflowY: 'auto',
                height: 'calc(100% - 60px - 70px)',
              }}
            >
              <h3 style={{ marginBottom: '20px', fontSize: '16px', fontWeight: 'bold' }}>
                API Settings
              </h3>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
                  OpenAI API Key (for GPT-5 Nano)
                </label>
                <input
                  type="password"
                  placeholder="sk-..."
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '14px',
                  }}
                  onChange={e => setApiKeys(prev => ({ ...prev, openai: e.target.value }))}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
                  Google API Key (for Gemini 2.5 Flash Lite)
                </label>
                <input
                  type="password"
                  placeholder="AIza..."
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '14px',
                  }}
                  onChange={e => setApiKeys(prev => ({ ...prev, google: e.target.value }))}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={async () => {
                    try {
                      await updateAPIKeyReferences({ ...apiKeys, openrouter: null });
                      alert('API keys saved! Select a model from the dropdown to start chatting.');
                      setShowSettings(false);
                    } catch (error) {
                      alert('Failed to save API keys: ' + error);
                    }
                  }}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                >
                  Save API Keys
                </button>

                <button
                  onClick={async () => {
                    try {
                      await resetToDefaults();
                      alert('Settings reset! Please re-enter your API keys.');
                      window.location.reload();
                    } catch (error) {
                      alert('Failed to reset settings: ' + error);
                    }
                  }}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#f44336',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                >
                  Reset Settings
                </button>
              </div>

              <div style={{ marginTop: '20px', fontSize: '12px', color: '#666' }}>
                <p>
                  • Get OpenAI API key from:{' '}
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    style={{ color: '#0066cc' }}
                    rel="noreferrer"
                  >
                    platform.openai.com
                  </a>
                </p>
                <p>
                  • Get Google API key from:{' '}
                  <a
                    href="https://makersuite.google.com/app/apikey"
                    target="_blank"
                    style={{ color: '#0066cc' }}
                    rel="noreferrer"
                  >
                    makersuite.google.com
                  </a>
                </p>
              </div>
            </div>
          ) : (
            <div className="ai-sidebar-body" data-testid="sidebar-body">
              <MessageList
                messages={messages}
                isLoading={isLoading}
                emptyMessage=""
                autoScroll={true}
                height="100%"
              />
            </div>
          )}

          <div className="ai-sidebar-footer" data-testid="sidebar-footer">
            <ChatInput
              onSend={handleSendMessage}
              onCancel={cancelMessage}
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
