/**
 * @file ChatPanel Component
 *
 * Main chat panel component that assembles all chat components into a complete,
 * cohesive chat interface. Provides header, body, and footer sections with
 * proper layout and responsive behavior.
 */

import React, { useCallback } from 'react';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { useChatStore } from '@/store/chat';
import { IconButton } from '@/components/ui/IconButton';
import { cn } from '@/utils/cn';

export interface ChatPanelProps {
  /** Custom CSS class name */
  className?: string;
  /** Panel title */
  title?: string;
  /** Custom empty state message */
  emptyMessage?: string;
  /** Whether to show message count */
  showMessageCount?: boolean;
  /** Whether to auto-scroll messages to bottom */
  autoScroll?: boolean;
  /** Custom height for message list */
  height?: string;
}

// Icon components
const ClearIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 6h18" />
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
  </svg>
);

const DismissIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

/**
 * ChatPanel Component
 *
 * A complete chat interface that integrates MessageList, ChatInput, and other
 * chat components into a cohesive panel with header, body, and footer sections.
 *
 * Features:
 * - Header with title and controls (clear conversation button)
 * - Body with MessageList component for displaying messages
 * - Footer with ChatInput component for sending messages
 * - Error display and handling
 * - Responsive layout and behavior
 * - Integration with chat and settings stores
 * - Accessibility support
 *
 * Layout Structure:
 * ```
 * ┌─────────────────────────────────────┐
 * │ Header (title, controls)            │
 * ├─────────────────────────────────────┤
 * │                                     │
 * │ Body (MessageList)                  │
 * │                                     │
 * ├─────────────────────────────────────┤
 * │ Footer (ChatInput)                  │
 * └─────────────────────────────────────┘
 * ```
 *
 * @example
 * ```tsx
 * <ChatPanel 
 *   title="Chat Assistant"
 *   emptyMessage="Start a conversation"
 *   showMessageCount={true}
 * />
 * ```
 */
export const ChatPanel: React.FC<ChatPanelProps> = ({
  className,
  title = 'Chat',
  emptyMessage = 'No messages yet',
  showMessageCount = false,
  autoScroll = true,
  height = '100%',
}) => {
  // Get chat store state and actions
  const {
    messages,
    isLoading,
    error,
    addMessage,
    clearConversation,
    clearError,
    hasMessages,
    getMessageCount,
  } = useChatStore();

  /**
   * Handle sending a new message
   */
  const handleSendMessage = useCallback((content: string) => {
    addMessage({
      role: 'user',
      content,
    });
  }, [addMessage]);

  /**
   * Handle clearing the conversation with confirmation
   */
  const handleClearConversation = useCallback(() => {
    const hasMsg = hasMessages();
    if (!hasMsg) return;

    const confirmed = window.confirm(
      'Are you sure you want to clear this conversation? This action cannot be undone.'
    );

    if (confirmed) {
      clearConversation();
    }
  }, [hasMessages, clearConversation]);

  /**
   * Handle dismissing error messages
   */
  const handleDismissError = useCallback(() => {
    clearError();
  }, [clearError]);

  // Calculate message count for display
  const messageCount = getMessageCount();
  const messageCountText = messageCount === 1 ? '1 message' : `${messageCount} messages`;

  return (
    <main
      className={cn('chat-panel', className)}
      data-testid="chat-panel"
      aria-label="Chat conversation"
    >
      {/* Header Section */}
      <header
        className="chat-panel__header"
        data-testid="chat-panel-header"
      >
        <div className="chat-panel__header-content">
          <h2 className="chat-panel__title">{title}</h2>
          
          {showMessageCount && messageCount > 0 && (
            <span className="chat-panel__message-count">
              {messageCountText}
            </span>
          )}
        </div>
        
        <div
          className="chat-panel__controls"
          data-testid="chat-panel-controls"
        >
          <IconButton
            icon={<ClearIcon />}
            size="sm"
            variant="ghost"
            onClick={handleClearConversation}
            disabled={!hasMessages() || isLoading}
            tooltip="Clear conversation"
            aria-label="Clear conversation"
          />
        </div>
      </header>

      {/* Error Display */}
      {error && (
        <div
          className="chat-panel__error"
          data-testid="chat-panel-error"
          role="alert"
          aria-live="polite"
        >
          <span className="chat-panel__error-message">{error}</span>
          <IconButton
            icon={<DismissIcon />}
            size="sm"
            variant="ghost"
            onClick={handleDismissError}
            tooltip="Dismiss error"
            aria-label="Dismiss error"
            className="chat-panel__error-dismiss"
          />
        </div>
      )}

      {/* Body Section */}
      <div
        className="chat-panel__body"
        data-testid="chat-panel-body"
      >
        <MessageList
          messages={messages}
          isLoading={isLoading}
          emptyMessage={emptyMessage}
          autoScroll={autoScroll}
          height={height}
        />
      </div>

      {/* Footer Section */}
      <footer
        className="chat-panel__footer"
        data-testid="chat-panel-footer"
      >
        <ChatInput
          onSend={handleSendMessage}
          loading={isLoading}
          placeholder="Type your message here..."
          aria-label="Chat message input"
        />
      </footer>
    </main>
  );
};

export default ChatPanel;

// CSS Styles
const chatPanelStyles = `
.chat-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 100vh;
  background: white;
  border-radius: 0.5rem;
  overflow: hidden;
}

.chat-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
  flex-shrink: 0;
}

.chat-panel__header-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.chat-panel__title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.chat-panel__message-count {
  font-size: 0.875rem;
  color: #6b7280;
  background: #e5e7eb;
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
}

.chat-panel__controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.chat-panel__error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: #fef2f2;
  border-bottom: 1px solid #fecaca;
  color: #dc2626;
  font-size: 0.875rem;
  flex-shrink: 0;
}

.chat-panel__error-message {
  flex: 1;
  margin-right: 0.5rem;
}

.chat-panel__error-dismiss {
  flex-shrink: 0;
}

.chat-panel__body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.chat-panel__footer {
  padding: 1rem;
  border-top: 1px solid #e5e7eb;
  background: #f9fafb;
  flex-shrink: 0;
}

/* Dark mode support */
.dark .chat-panel {
  background: #1f2937;
}

.dark .chat-panel__header {
  background: #111827;
  border-bottom-color: #374151;
}

.dark .chat-panel__title {
  color: #f9fafb;
}

.dark .chat-panel__message-count {
  color: #9ca3af;
  background: #374151;
}

.dark .chat-panel__error {
  background: #fee2e2;
  border-bottom-color: #fca5a5;
  color: #dc2626;
}

.dark .chat-panel__footer {
  background: #111827;
  border-top-color: #374151;
}

/* Responsive design */
@media (max-width: 640px) {
  .chat-panel__header {
    padding: 0.75rem;
  }
  
  .chat-panel__title {
    font-size: 1rem;
  }
  
  .chat-panel__message-count {
    font-size: 0.75rem;
    padding: 0.125rem 0.375rem;
  }
  
  .chat-panel__footer {
    padding: 0.75rem;
  }
  
  .chat-panel__error {
    padding: 0.5rem 0.75rem;
    font-size: 0.75rem;
  }
}

/* Focus management for accessibility */
.chat-panel:focus-within .chat-panel__header {
  border-bottom-color: #3b82f6;
}

.chat-panel:focus-within .chat-panel__footer {
  border-top-color: #3b82f6;
}

/* Animation support */
.chat-panel__error {
  animation: slideDown 0.2s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .chat-panel__header {
    border-bottom-width: 2px;
  }
  
  .chat-panel__footer {
    border-top-width: 2px;
  }
  
  .chat-panel__error {
    border-bottom-width: 2px;
  }
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .chat-panel__error {
    animation: none;
  }
}
`;

// Inject styles when component is first imported
if (typeof document !== 'undefined') {
  const styleId = 'chat-panel-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = chatPanelStyles;
    document.head.appendChild(style);
  }
}