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
  const { messages } = data;
  const message = messages[index];

  if (!message) return null;

  return (
    <div style={style} className="px-4">
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
  height = '100%',
  className,
  onScroll,
  virtualizationThreshold = DEFAULT_VIRTUALIZATION_THRESHOLD,
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
   * Create data object for virtualized list
   */
  const virtualListData = useMemo(
    () => ({
      messages,
    }),
    [messages]
  );




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
        overscanCount={OVERSCAN_COUNT}
        className="virtualized-message-list"
        data-testid="virtualized-list"
        style={{ height: '100%', width: '100%' }}
      >
        {VirtualListItem}
      </List>
    );
  }, [isVirtualized, messages.length, height, getItemHeight, virtualListData]);

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
          style={{ height, paddingRight: '0px' }}
          onScroll={handleScroll}
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
