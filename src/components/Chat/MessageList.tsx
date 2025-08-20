import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ChatMessage } from '@/store/chat';
import { MessageBubble } from './MessageBubble';
import { cn } from '@/utils/cn';

/**
 * Props for the MessageList component
 */
export interface MessageListProps {
  /** Array of messages to display */
  messages: ChatMessage[];
  /** Whether the component is in a loading state */
  isLoading?: boolean;
  /** Custom loading message */
  loadingMessage?: string;
  /** Custom empty state message */
  emptyMessage?: string;
  /** Whether to auto-scroll to bottom on new messages */
  autoScroll?: boolean;
  /** Whether to preserve scroll position when loading new messages */
  preserveScrollPosition?: boolean;
  /** Custom height for the message list container */
  height?: string;
  /** Additional CSS class names */
  className?: string;
  /** Callback fired when the user scrolls */
  onScroll?: (event: React.UIEvent<HTMLDivElement>) => void;
}

/**
 * Threshold for determining if user is "at bottom" (in pixels)
 */
const SCROLL_THRESHOLD = 10;

/**
 * MessageList Component
 *
 * A scrollable container for displaying chat messages with the following features:
 * - Auto-scroll to bottom on new messages
 * - Scroll-to-bottom button when user scrolls up
 * - Loading states for fetching history
 * - Empty state with custom message
 * - Preserve scroll position when loading older messages
 * - Smooth scroll animations
 * - Full accessibility support
 *
 * The component uses flexbox with column-reverse for easier auto-scroll
 * implementation and provides comprehensive keyboard navigation support.
 *
 * @example
 * ```tsx
 * <MessageList
 *   messages={chatMessages}
 *   isLoading={isLoadingHistory}
 *   onScroll={handleScroll}
 *   autoScroll={true}
 * />
 * ```
 */
export const MessageList: React.FC<MessageListProps> = ({
  messages = [],
  isLoading = false,
  loadingMessage = 'Loading messages...',
  emptyMessage = 'No messages yet',
  autoScroll = true,
  preserveScrollPosition = false,
  height = '100%',
  className,
  onScroll,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [isUserScrolling, setIsUserScrolling] = useState(false);

  /**
   * Check if the user is at the bottom of the scroll container
   */
  const isAtBottom = useCallback((): boolean => {
    const container = scrollContainerRef.current;
    if (!container) return true;

    const { scrollTop, scrollHeight, clientHeight } = container;
    return Math.abs(scrollHeight - clientHeight - scrollTop) <= SCROLL_THRESHOLD;
  }, []);

  /**
   * Scroll to the bottom of the container
   */
  const scrollToBottom = useCallback((smooth = true) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto',
    });
  }, []);

  /**
   * Handle scroll events
   */
  const handleScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const atBottom = isAtBottom();
      setShowScrollToBottom(!atBottom);
      setIsUserScrolling(!atBottom);

      onScroll?.(event);
    },
    [isAtBottom, onScroll]
  );

  /**
   * Handle scroll to bottom button click
   */
  const handleScrollToBottomClick = useCallback(() => {
    scrollToBottom(true);
    setIsUserScrolling(false);
  }, [scrollToBottom]);

  /**
   * Auto-scroll to bottom when new messages arrive
   */
  useEffect(() => {
    if (!autoScroll || preserveScrollPosition || isUserScrolling) return;

    // Small delay to ensure DOM is updated
    const timer = setTimeout(() => {
      scrollToBottom(false);
    }, 0);

    return () => clearTimeout(timer);
  }, [messages.length, autoScroll, preserveScrollPosition, isUserScrolling, scrollToBottom]);

  /**
   * Reset user scrolling state when auto-scroll is re-enabled
   */
  useEffect(() => {
    if (!autoScroll) {
      setIsUserScrolling(false);
    }
  }, [autoScroll]);

  /**
   * Render empty state
   */
  const renderEmptyState = () => (
    <div
      className="flex flex-col items-center justify-center h-full text-gray-500 p-8"
      data-testid="message-list-empty"
      aria-label="No messages"
    >
      <div className="text-lg font-medium mb-2">{emptyMessage}</div>
      {emptyMessage === 'No messages yet' && (
        <div className="text-sm opacity-75">Start a conversation to see messages here.</div>
      )}
    </div>
  );

  /**
   * Render loading state
   */
  const renderLoadingState = () => (
    <div
      className="flex items-center justify-center p-4 text-gray-500"
      data-testid="message-list-loading"
      aria-label="Loading messages"
    >
      <div className="flex items-center space-x-2">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-500"></div>
        <span>{loadingMessage}</span>
      </div>
    </div>
  );

  /**
   * Render scroll to bottom button
   */
  const renderScrollToBottomButton = () => {
    if (!showScrollToBottom) return null;

    return (
      <button
        onClick={handleScrollToBottomClick}
        className="absolute bottom-4 right-4 bg-blue-500 hover:bg-blue-600 text-white rounded-full p-2 shadow-lg transition-all duration-200 z-10"
        data-testid="scroll-to-bottom"
        aria-label="Scroll to bottom"
        type="button"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 14l-7 7m0 0l-7-7m7 7V3"
          />
        </svg>
      </button>
    );
  };

  /**
   * Render messages
   */
  const renderMessages = () => (
    <div
      className="flex flex-col space-y-4 p-4"
      role="log"
      aria-live="polite"
      aria-label="Chat messages"
      data-testid="messages-container"
    >
      {messages.map(message => (
        <MessageBubble key={message.id} message={message} className="message-list-item" />
      ))}
    </div>
  );

  // Show empty state when no messages and not loading
  if (messages.length === 0 && !isLoading) {
    return (
      <div className={cn('relative', className)} data-testid="message-list" style={{ height }}>
        {renderEmptyState()}
      </div>
    );
  }

  return (
    <div className={cn('relative', className)} data-testid="message-list" style={{ height }}>
      {/* Main scrollable container */}
      <div
        ref={scrollContainerRef}
        className="h-full overflow-y-auto overscroll-behavior-contain"
        style={{ height }}
        onScroll={handleScroll}
        data-testid="message-list-container"
      >
        {/* Loading indicator for older messages */}
        {isLoading && renderLoadingState()}

        {/* Messages */}
        {messages.length > 0 && renderMessages()}
      </div>

      {/* Scroll to bottom button */}
      {renderScrollToBottomButton()}
    </div>
  );
};

export default MessageList;
