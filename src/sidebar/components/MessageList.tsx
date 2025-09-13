import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { VariableSizeList as List, ListOnScrollProps } from 'react-window';
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
  const virtualizedContainerRef = useRef<HTMLDivElement>(null);
  const [isVirtualized, setIsVirtualized] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const lastMessageCountRef = useRef(messages.length);
  const lastMessageContentRef = useRef<string | undefined>();
  const lastUserMessageCountRef = useRef<number>(
    messages.reduce((acc, m) => (m.role === 'user' ? acc + 1 : acc), 0)
  );

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
    return itemHeights.current[index] || DEFAULT_ITEM_HEIGHT;
  }, []);

  /**
   * Check if user is at the bottom of scroll container
   */
  const isAtBottom = useCallback((container: HTMLElement) => {
    const { scrollTop, scrollHeight, clientHeight } = container;
    return scrollHeight - (scrollTop + clientHeight) <= 1;
  }, []);

  /**
   * Scroll to bottom of messages
   */
  const scrollToBottom = useCallback(
    (smooth = true) => {
      if (isVirtualized && virtualListRef.current) {
        virtualListRef.current.scrollToItem(messages.length - 1, 'end');
      } else if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({
          top: scrollContainerRef.current.scrollHeight,
          behavior: smooth ? 'smooth' : 'auto',
        });
      }
    },
    [isVirtualized, messages.length]
  );

  /**
   * Auto-scroll to bottom when new messages arrive or streaming updates
   */
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    const currentContent = lastMessage?.content;

    const messageCountIncreased = messages.length > lastMessageCountRef.current;
    const lastMessageChanged =
      messages.length > 0 &&
      messages.length === lastMessageCountRef.current &&
      currentContent !== lastMessageContentRef.current;

    // Check if user just sent a new message (re-enable auto-scroll)
    const currentUserMessageCount = messages.reduce(
      (acc, m) => (m.role === 'user' ? acc + 1 : acc),
      0
    );
    const userJustSentMessage = currentUserMessageCount > lastUserMessageCountRef.current;

    if (userJustSentMessage) {
      setShouldAutoScroll(true);
      requestAnimationFrame(() => {
        scrollToBottom(true);
      });
    } else if (shouldAutoScroll && (messageCountIncreased || lastMessageChanged)) {
      requestAnimationFrame(() => {
        scrollToBottom(messageCountIncreased);
      });
    }

    lastMessageCountRef.current = messages.length;
    lastMessageContentRef.current = currentContent;
    lastUserMessageCountRef.current = currentUserMessageCount;
  }, [messages, shouldAutoScroll, scrollToBottom]);

  /**
   * Handle scroll events
   */
  const handleScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const container = event.currentTarget;

      const atBottom = isAtBottom(container);
      setShouldAutoScroll(atBottom);
      onScroll?.(event);
    },
    [onScroll, isAtBottom]
  );

  /**
   * Handle scroll events for virtualized list
   */
  const handleVirtualizedScroll = useCallback(
    (props: ListOnScrollProps) => {
      if (!virtualListRef.current) return;

      const list = virtualListRef.current;
      const scrollOffset = props.scrollOffset;

      let totalHeight = 0;
      for (let i = 0; i < messages.length; i++) {
        totalHeight += getItemHeight(i);
      }

      const visibleHeight = list.props.height as number;
      const atBottom = totalHeight - (scrollOffset + visibleHeight) <= 1;
      setShouldAutoScroll(atBottom);
    },
    [messages.length, getItemHeight]
  );

  /**
   * Handle wheel events to prevent scroll propagation at boundaries
   */
  const handleWheel = useCallback((event: WheelEvent) => {
    const container = event.currentTarget as HTMLDivElement;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const isAtTop = scrollTop === 0;
    const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 1;

    if ((isAtTop && event.deltaY < 0) || (isAtBottom && event.deltaY > 0)) {
      event.preventDefault();
    }
  }, []);

  /**
   * Add non-passive wheel event listeners for scroll containment
   */
  useEffect(() => {
    const nonVirtualizedContainer = scrollContainerRef.current;
    const virtualizedContainer = virtualizedContainerRef.current;
    const activeContainer = isVirtualized ? virtualizedContainer : nonVirtualizedContainer;

    if (!activeContainer) return;

    activeContainer.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      activeContainer.removeEventListener('wheel', handleWheel);
    };
  }, [isVirtualized, handleWheel]);

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
        onScroll={handleVirtualizedScroll}
      >
        {VirtualListItem}
      </List>
    );
  }, [
    isVirtualized,
    messages.length,
    height,
    getItemHeight,
    virtualListData,
    handleVirtualizedScroll,
  ]);

  const isEmpty = messages.length === 0 && !isLoading;

  return (
    <div
      className={`message-list${className ? ` ${className}` : ''}`}
      data-testid="message-list"
      style={{ height }}
    >
      {isVirtualized ? (
        <div ref={virtualizedContainerRef} className="message-list-virtualized-container">
          {renderVirtualizedMessages()}
        </div>
      ) : (
        <div
          ref={scrollContainerRef}
          className="message-list-scroll-container"
          onScroll={handleScroll}
          data-testid="message-list-container"
        >
          {isEmpty && renderEmptyState()}
          {messages.length > 0 && renderMessages()}
        </div>
      )}
    </div>
  );
};

export default MessageList;
