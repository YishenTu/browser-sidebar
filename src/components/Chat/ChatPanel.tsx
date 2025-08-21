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
import { useMockChat } from '@/hooks/useMockChat';
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

  // Use mock chat for demo purposes
  const { generateResponse } = useMockChat({
    enabled: true,
    responseType: 'text',
    streamingSpeed: 'normal',
    thinkingDelay: 800,
  });

  /**
   * Handle sending a new message
   */
  const handleSendMessage = useCallback(
    async (content: string) => {
      // Add user message
      addMessage({
        role: 'user',
        content,
      });

      // Generate mock response
      await generateResponse(content);
    },
    [addMessage, generateResponse]
  );

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
      <header className="chat-panel__header" data-testid="chat-panel-header">
        <div className="chat-panel__header-content">
          <h2 className="chat-panel__title">{title}</h2>

          {showMessageCount && messageCount > 0 && (
            <span className="chat-panel__message-count">{messageCountText}</span>
          )}
        </div>

        <div className="chat-panel__controls" data-testid="chat-panel-controls">
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
      <div className="chat-panel__body" data-testid="chat-panel-body">
        <MessageList
          messages={messages}
          isLoading={isLoading}
          emptyMessage={emptyMessage}
          autoScroll={autoScroll}
          height={height}
        />
      </div>

      {/* Footer Section */}
      <footer className="chat-panel__footer" data-testid="chat-panel-footer">
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
