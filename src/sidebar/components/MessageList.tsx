import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { VariableSizeList as List } from 'react-window';
import type { ChatMessage } from '@store/chat';
import { MessageBubble } from './MessageBubble';

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
  /** Custom height for the message list container */
  height?: string;
  /** Additional CSS class names */
  className?: string;
  /** Callback fired when the user scrolls */
  onScroll?: (event: React.UIEvent<HTMLDivElement>) => void;
  /** Threshold for enabling virtualization (default: 100) */
  virtualizationThreshold?: number;
  /** Callback for editing a message */
  onEditMessage?: (message: ChatMessage) => void;
  /** Callback for regenerating an assistant message */
  onRegenerateMessage?: (message: ChatMessage) => void;
}

/**
 * Props for virtualized list item renderer
 */
interface VirtualListItemProps {
  index: number;
  style: React.CSSProperties;
  data: {
    messages: ChatMessage[];
    onEditMessage?: (message: ChatMessage) => void;
    onRegenerateMessage?: (message: ChatMessage) => void;
  };
}

/**
 * Default threshold for enabling virtualization
 */
const DEFAULT_VIRTUALIZATION_THRESHOLD = 100;

/**
 * Default item height for virtualized list (will be dynamically calculated)
 */
const DEFAULT_ITEM_HEIGHT = 80;

/**
 * Buffer for virtualized list (number of items to render outside viewport)
 */
const OVERSCAN_COUNT = 5;

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
/**
 * VirtualListItem Component - Renders individual message items in virtualized list
 */
const VirtualListItem: React.FC<VirtualListItemProps> = ({ index, style, data }) => {
  const { messages, onEditMessage, onRegenerateMessage } = data;
  const message = messages[index];

  if (!message) return null;

  return (
    <div style={style} className="virtual-list-item">
      <div className="virtual-list-item-content">
        <MessageBubble
          message={message}
          className="message-list-item"
          onEdit={onEditMessage}
          onRegenerate={onRegenerateMessage}
        />
      </div>
    </div>
  );
};

export const MessageList: React.FC<MessageListProps> = ({
  messages = [],
  isLoading = false,
  // loadingMessage = 'Loading messages...', // Not used after removing loading indicator
  emptyMessage = 'No messages yet',
  height = '100%',
  className,
  onScroll,
  virtualizationThreshold = DEFAULT_VIRTUALIZATION_THRESHOLD,
  onEditMessage,
  onRegenerateMessage,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const virtualListRef = useRef<List>(null);
  const itemHeights = useRef<number[]>([]);
  const [isVirtualized, setIsVirtualized] = useState(false);

  /**
   * Determine if virtualization should be used based on message count
   */
  const shouldUseVirtualization = useMemo(() => {
    return messages.length >= virtualizationThreshold;
  }, [messages.length, virtualizationThreshold]);

  /**
   * Update virtualization state when threshold is crossed
   */
  useEffect(() => {
    setIsVirtualized(shouldUseVirtualization);
  }, [shouldUseVirtualization]);

  /**
   * Calculate item height for virtualized list
   */
  const getItemHeight = useCallback((index: number): number => {
    // Use cached height if available, otherwise use default
    return itemHeights.current[index] || DEFAULT_ITEM_HEIGHT;
  }, []);

  // Item height setter - kept for future use when implementing dynamic measurement
  // const setItemHeight = useCallback((index: number, height: number) => {
  //   if (itemHeights.current[index] !== height) {
  //     itemHeights.current[index] = height;
  //     // Reset cache when heights change
  //     if (virtualListRef.current) {
  //       virtualListRef.current.resetAfterIndex(index);
  //     }
  //   }
  // }, []);

  /**
   * Handle scroll events
   */
  const handleScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      // Call external handler
      onScroll?.(event);
    },
    [onScroll]
  );

  /**
   * Handle wheel events to prevent scroll propagation at boundaries
   */
  const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    const container = event.currentTarget;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const isAtTop = scrollTop === 0;
    const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 1;

    // Prevent scrolling parent when at boundaries
    if ((isAtTop && event.deltaY < 0) || (isAtBottom && event.deltaY > 0)) {
      event.preventDefault();
    }
  }, []);

  /**
   * Create data object for virtualized list
   */
  const virtualListData = useMemo(
    () => ({
      messages,
      onEditMessage,
      onRegenerateMessage,
    }),
    [messages, onEditMessage, onRegenerateMessage]
  );

  /**
   * Render empty state
   */
  const renderEmptyState = () => (
    <div className="message-list-empty" data-testid="message-list-empty" aria-label="No messages">
      <div className="message-list-empty-title">{emptyMessage}</div>
      {emptyMessage === 'No messages yet' && (
        <div className="message-list-empty-subtitle">
          Start a conversation to see messages here.
        </div>
      )}
    </div>
  );

  /**
   * Memoized message rendering for performance optimization (non-virtualized)
   */
  const memoizedMessages = useMemo(() => {
    if (isVirtualized) return [];

    return messages.map(message => (
      <div key={message.id}>
        <MessageBubble
          message={message}
          className="message-list-item"
          onEdit={onEditMessage}
          onRegenerate={onRegenerateMessage}
        />
      </div>
    ));
  }, [messages, isVirtualized, onEditMessage, onRegenerateMessage]);

  /**
   * Render non-virtualized messages
   */
  const renderMessages = useCallback(
    () => (
      <div
        className="messages-container"
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
        data-testid="messages-container"
      >
        {memoizedMessages}
      </div>
    ),
    [memoizedMessages]
  );

  /**
   * Render virtualized message list
   */
  const renderVirtualizedMessages = useCallback(() => {
    if (!isVirtualized || messages.length === 0) return null;

    const listHeight =
      typeof height === 'string' && height.endsWith('%')
        ? 400 // Use fixed height for percentage strings in tests
        : parseInt(height) || 400;

    return (
      <List
        ref={virtualListRef}
        height={listHeight}
        width="100%"
        itemCount={messages.length}
        itemSize={getItemHeight}
        itemData={virtualListData}
        overscanCount={OVERSCAN_COUNT}
        className="virtualized-message-list"
        data-testid="virtualized-list"
      >
        {VirtualListItem}
      </List>
    );
  }, [isVirtualized, messages.length, height, getItemHeight, virtualListData]);

  // Always render with scroll container, even for empty state
  const isEmpty = messages.length === 0 && !isLoading;

  return (
    <div
      className={`message-list${className ? ` ${className}` : ''}`}
      data-testid="message-list"
      style={{ height }}
    >
      {/* Virtualized message list */}
      {isVirtualized ? (
        <div className="message-list-virtualized-container" onWheel={handleWheel}>
          {/* Virtualized messages */}
          {renderVirtualizedMessages()}
        </div>
      ) : (
        /* Non-virtualized scrollable container */
        <div
          ref={scrollContainerRef}
          className="message-list-scroll-container"
          onScroll={handleScroll}
          onWheel={handleWheel}
          data-testid="message-list-container"
        >
          {/* Empty state */}
          {isEmpty && renderEmptyState()}

          {/* Messages */}
          {messages.length > 0 && renderMessages()}
        </div>
      )}
    </div>
  );
};

export default MessageList;

// Export types for external use
export type { VirtualListItemProps };
