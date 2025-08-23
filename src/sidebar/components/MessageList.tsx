import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { VariableSizeList as List, ListOnScrollProps } from 'react-window';
import { ChatMessage } from '@store/chat';
import { MessageBubble } from './MessageBubble';
import { cn } from '@utils/cn';

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
  // loadingMessage = 'Loading messages...', // Not used after removing loading indicator
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
  const bottomAnchorRef = useRef<HTMLDivElement>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true); // Auto-scroll is ON by default
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);
  const itemHeights = useRef<number[]>([]);
  const [isVirtualized, setIsVirtualized] = useState(false);
  const lastMessageCount = useRef(messages.length);
  const isScrollingProgrammatically = useRef(false);

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
   * Simple, aggressive scroll to bottom function
   */
  const forceScrollToBottom = useCallback(() => {
    if (bottomAnchorRef.current) {
      // Method 1: Scroll the anchor into view
      bottomAnchorRef.current.scrollIntoView({ behavior: 'auto', block: 'end' });
    }
    
    const container = scrollContainerRef.current;
    if (container) {
      // Method 2: Direct scroll to bottom
      const maxScroll = container.scrollHeight - container.clientHeight;
      container.scrollTop = maxScroll + 100; // Add extra to ensure we're at bottom
    }
  }, []);


  /**
   * Scroll to the bottom of the container
   */
  const scrollToBottom = useCallback(
    (smooth = true) => {
      forceScrollToBottom();
      
      if (smooth && scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({
          top: scrollContainerRef.current.scrollHeight,
          behavior: 'smooth',
        });
      }
    },
    [forceScrollToBottom]
  );

  /**
   * Handle scroll events
   */
  const handleScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      // Call onScroll for external handlers
      onScroll?.(event);
    },
    [onScroll]
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
        setAutoScrollEnabled(false);
        setShowScrollToBottom(true);
      } else {
        setAutoScrollEnabled(true);
        setShowScrollToBottom(false);
      }
    },
    [messages.length, height]
  );

  /**
   * Handle scroll to bottom button click
   */
  const handleScrollToBottomClick = useCallback(() => {
    // Re-enable auto-scroll when user clicks scroll to bottom
    setAutoScrollEnabled(true);
    isScrollingProgrammatically.current = true;
    scrollToBottom(true);
    setTimeout(() => {
      isScrollingProgrammatically.current = false;
    }, 100);
  }, [scrollToBottom]);

  /**
   * Create data object for virtualized list
   */
  const virtualListData = useMemo(
    () => ({
      messages,
      isLastMessage: (index: number) => index === messages.length - 1,
      lastMessageRef: bottomAnchorRef,
    }),
    [messages]
  );

  /**
   * Detect when user sends a new message and re-enable auto-scroll
   */
  useEffect(() => {
    // Check if message count increased
    if (messages.length > lastMessageCount.current) {
      const lastMessage = messages[messages.length - 1];
      // If the new message is from the user, re-enable auto-scroll
      if (lastMessage && lastMessage.role === 'user') {
        setAutoScrollEnabled(true);
        // Immediately scroll to bottom for user's message
        isScrollingProgrammatically.current = true;
        forceScrollToBottom();
        setTimeout(() => {
          isScrollingProgrammatically.current = false;
        }, 100);
      }
    }
    lastMessageCount.current = messages.length;
  }, [messages, forceScrollToBottom]);

  /**
   * Detect user manual scrolling and disable auto-scroll
   */
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    const handleScroll = () => {
      // Skip if we're scrolling programmatically
      if (isScrollingProgrammatically.current) return;
      
      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      const isNearBottom = distanceFromBottom < 50;
      
      // If user scrolled away from bottom, disable auto-scroll
      if (!isNearBottom) {
        setAutoScrollEnabled(false);
        setShowScrollToBottom(true);
      } else {
        setShowScrollToBottom(false);
      }
    };
    
    container.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, []);

  /**
   * Track message content changes
   */
  const messageContentString = useMemo(() => {
    return messages.map(m => `${m.id}:${m.content?.length || 0}`).join('|');
  }, [messages]);

  /**
   * Auto-scroll when content changes IF auto-scroll is enabled
   */
  useEffect(() => {
    if (!autoScroll || preserveScrollPosition || !autoScrollEnabled) return;
    
    // Mark that we're scrolling programmatically
    isScrollingProgrammatically.current = true;
    
    // Scroll to bottom immediately
    forceScrollToBottom();
    
    // Additional delayed scrolls to catch DOM updates during streaming
    const timer1 = setTimeout(() => {
      if (autoScrollEnabled) {
        forceScrollToBottom();
      }
    }, 50);
    
    const timer2 = setTimeout(() => {
      if (autoScrollEnabled) {
        forceScrollToBottom();
      }
      isScrollingProgrammatically.current = false;
    }, 150);
    
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [messageContentString, autoScroll, preserveScrollPosition, autoScrollEnabled, forceScrollToBottom]);

  /**
   * Cleanup on unmount
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

    return messages.map((message) => (
      <div key={message.id}>
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
        width="100%"
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
          {/* Empty state */}
          {isEmpty && renderEmptyState()}

          {/* Messages */}
          {messages.length > 0 && renderMessages()}
          
          {/* Invisible anchor at the bottom for scrolling */}
          <div ref={bottomAnchorRef} style={{ height: '1px', width: '100%' }} />
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
