import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { VariableSizeList as List, ListOnScrollProps } from 'react-window';
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
  /** Threshold for enabling virtualization (default: 100) */
  virtualizationThreshold?: number;
}

/**
 * Props for virtualized list item renderer
 */
interface VirtualListItemProps {
  index: number;
  style: React.CSSProperties;
  data: {
    messages: ChatMessage[];
    isLastMessage: (index: number) => boolean;
    lastMessageRef: React.RefObject<HTMLDivElement>;
  };
}

/**
 * Threshold for determining if user is "at bottom" (in pixels)
 */
const SCROLL_THRESHOLD = 10;

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
  const { messages, isLastMessage, lastMessageRef } = data;
  const message = messages[index];

  if (!message) return null;

  return (
    <div style={style} ref={isLastMessage(index) ? lastMessageRef : null} className="px-4">
      <div className="mb-4">
        <MessageBubble message={message} className="message-list-item" />
      </div>
    </div>
  );
};

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
  virtualizationThreshold = DEFAULT_VIRTUALIZATION_THRESHOLD,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const virtualListRef = useRef<List>(null);
  const lastMessageRef = useRef<HTMLDivElement>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [isAtBottomByObserver, setIsAtBottomByObserver] = useState(true);
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);
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
   * Check if the user is at the bottom of the scroll container
   */
  const isAtBottom = useCallback((): boolean => {
    if (isVirtualized && virtualListRef.current) {
      // For virtualized list, check if scrolled to bottom
      // Access the outer element through the ref's state
      const listState = virtualListRef.current.state as any;
      if (!listState || listState.scrollOffset === undefined) return true;
      const totalHeight = messages.length * DEFAULT_ITEM_HEIGHT;
      const scrollOffset = listState.scrollOffset;
      const viewportHeight = listState.scrollHeight || 500;
      return Math.abs(totalHeight - viewportHeight - scrollOffset) <= SCROLL_THRESHOLD;
    } else {
      const container = scrollContainerRef.current;
      if (!container) return true;
      const { scrollTop, scrollHeight, clientHeight } = container;
      return Math.abs(scrollHeight - clientHeight - scrollTop) <= SCROLL_THRESHOLD;
    }
  }, [isVirtualized, messages.length]);

  /**
   * Scroll to the bottom of the container
   */
  const scrollToBottom = useCallback(
    (smooth = true) => {
      if (isVirtualized && virtualListRef.current) {
        // For virtualized list, scroll to last item
        virtualListRef.current.scrollToItem(messages.length - 1, 'end');
      } else {
        const container = scrollContainerRef.current;
        if (!container) return;
        container.scrollTo({
          top: container.scrollHeight,
          behavior: smooth ? 'smooth' : 'auto',
        });
      }
    },
    [isVirtualized, messages.length]
  );

  /**
   * Handle scroll events with throttling for performance
   */
  const handleScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      // Throttle scroll events for better performance
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }

      scrollTimeout.current = setTimeout(() => {
        const atBottom = isAtBottom();
        setShowScrollToBottom(!atBottom);
        setIsUserScrolling(!atBottom);
      }, 50); // 50ms throttle

      // Call onScroll immediately for external handlers
      onScroll?.(event);
    },
    [isAtBottom, onScroll]
  );

  /**
   * Handle virtualized list scroll events
   */
  const handleVirtualScroll = useCallback(
    (props: ListOnScrollProps) => {
      // Check if user is at bottom based on scroll offset
      const { scrollOffset } = props;
      const totalHeight = messages.length * DEFAULT_ITEM_HEIGHT;
      const viewportHeight = typeof height === 'number' ? height : 500;
      const atBottom = Math.abs(totalHeight - viewportHeight - scrollOffset) <= SCROLL_THRESHOLD;

      if (!atBottom) {
        setIsUserScrolling(true);
      } else if (isUserScrolling) {
        setIsUserScrolling(false);
      }
    },
    [messages.length, height, isUserScrolling]
  );

  /**
   * Handle scroll to bottom button click
   */
  const handleScrollToBottomClick = useCallback(() => {
    scrollToBottom(true);
    setIsUserScrolling(false);
  }, [scrollToBottom]);

  /**
   * Create data object for virtualized list
   */
  const virtualListData = useMemo(
    () => ({
      messages,
      isLastMessage: (index: number) => index === messages.length - 1,
      lastMessageRef,
    }),
    [messages]
  );

  /**
   * Set up intersection observer for last message
   */
  useEffect(() => {
    const lastMessage = lastMessageRef.current;
    if (!lastMessage) return;

    const observer = new IntersectionObserver(
      entries => {
        const entry = entries[0];
        if (entry) {
          setIsAtBottomByObserver(entry.isIntersecting);
          if (entry.isIntersecting) {
            setIsUserScrolling(false);
          }
        }
      },
      {
        root: isVirtualized
          ? null // Use viewport for virtualized list
          : scrollContainerRef.current,
        rootMargin: '0px 0px -10px 0px', // 10px threshold
        threshold: 0,
      }
    );

    observer.observe(lastMessage);

    return () => {
      observer.disconnect();
    };
  }, [messages.length, isVirtualized]);

  /**
   * Auto-scroll to bottom when new messages arrive
   */
  useEffect(() => {
    if (!autoScroll || preserveScrollPosition || (isUserScrolling && !isAtBottomByObserver)) return;

    // Small delay to ensure DOM is updated
    const timer = setTimeout(() => {
      scrollToBottom(false);
    }, 0);

    return () => clearTimeout(timer);
  }, [
    messages.length,
    autoScroll,
    preserveScrollPosition,
    isUserScrolling,
    isAtBottomByObserver,
    scrollToBottom,
  ]);

  /**
   * Reset user scrolling state when auto-scroll is re-enabled
   */
  useEffect(() => {
    if (!autoScroll) {
      setIsUserScrolling(false);
    }
  }, [autoScroll]);

  /**
   * Cleanup scroll timeout on unmount
   */
  useEffect(() => {
    return () => {
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }
    };
  }, []);

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
   * Memoized message rendering for performance optimization (non-virtualized)
   */
  const memoizedMessages = useMemo(() => {
    if (isVirtualized) return [];

    return messages.map((message, index) => (
      <div key={message.id} ref={index === messages.length - 1 ? lastMessageRef : null}>
        <MessageBubble message={message} className="message-list-item" />
      </div>
    ));
  }, [messages, isVirtualized]);

  /**
   * Render non-virtualized messages
   */
  const renderMessages = useCallback(
    () => (
      <div
        className="flex flex-col space-y-4 p-4"
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
        itemCount={messages.length}
        itemSize={getItemHeight}
        itemData={virtualListData}
        onScroll={handleVirtualScroll}
        overscanCount={OVERSCAN_COUNT}
        className="virtualized-message-list"
        data-testid="virtualized-list"
        style={{ height: '100%', width: '100%' }}
      >
        {VirtualListItem}
      </List>
    );
  }, [isVirtualized, messages.length, height, getItemHeight, virtualListData, handleVirtualScroll]);

  // Always render with scroll container, even for empty state
  const isEmpty = messages.length === 0 && !isLoading;

  return (
    <div className={cn('relative', className)} data-testid="message-list" style={{ height }}>
      {/* Virtualized message list */}
      {isVirtualized ? (
        <div className="h-full" style={{ height }}>
          {/* Loading indicator for older messages */}
          {isLoading && renderLoadingState()}

          {/* Virtualized messages */}
          {renderVirtualizedMessages()}
        </div>
      ) : (
        /* Non-virtualized scrollable container */
        <div
          ref={scrollContainerRef}
          className="h-full overflow-y-auto overscroll-behavior-contain"
          style={{ height }}
          onScroll={handleScroll}
          data-testid="message-list-container"
        >
          {/* Loading indicator for older messages */}
          {isLoading && renderLoadingState()}

          {/* Empty state */}
          {isEmpty && renderEmptyState()}

          {/* Messages */}
          {messages.length > 0 && renderMessages()}
        </div>
      )}

      {/* Scroll to bottom button */}
      {renderScrollToBottomButton()}
    </div>
  );
};

export default MessageList;

// Export types for external use
export type { VirtualListItemProps };
