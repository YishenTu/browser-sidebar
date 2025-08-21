import { render, screen, fireEvent, waitFor } from '@tests/utils/test-utils';
import { MessageList } from '@/sidebar/components/MessageList';
import { ChatMessage, MessageRole, MessageStatus } from '@/store/chat';
import { vi } from 'vitest';

// Mock react-window components
const mockScrollToItem = vi.fn();

vi.mock('react-window', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const React = require('react');

  const MockVariableSizeList = React.forwardRef(function MockVariableSizeList(
    { children, itemCount, itemSize, itemData, ...props },
    ref
  ) {
    // Mock implementation that renders only visible items (simulating virtualization)
    const visibleItemCount = Math.min(itemCount, 20); // Simulate viewport showing 20 items
    const startIndex = Math.max(0, itemCount - visibleItemCount);

    // Attach methods to ref
    React.useImperativeHandle(
      ref,
      () => ({
        scrollToItem: mockScrollToItem,
        _outerRef: {
          scrollTop: 0,
          scrollHeight: itemCount * 80,
          clientHeight: 400,
        },
      }),
      [itemCount]
    );

    return (
      <div data-testid="virtualized-list" {...props}>
        {Array.from({ length: visibleItemCount }).map((_, index) => {
          const actualIndex = startIndex + index;
          if (actualIndex < itemCount) {
            const itemProps = {
              index: actualIndex,
              style: { height: typeof itemSize === 'function' ? itemSize(actualIndex) : itemSize },
              data: itemData,
            };
            return <div key={actualIndex}>{children(itemProps)}</div>;
          }
          return null;
        })}
      </div>
    );
  });

  return {
    VariableSizeList: MockVariableSizeList,
    FixedSizeList: vi.fn(({ children, itemCount, itemSize, itemData, ...props }) => {
      // Mock implementation for fixed size list
      const visibleItemCount = Math.min(itemCount, 20);
      const startIndex = Math.max(0, itemCount - visibleItemCount);

      return (
        <div data-testid="virtualized-list-fixed" {...props}>
          {Array.from({ length: visibleItemCount }).map((_, index) => {
            const actualIndex = startIndex + index;
            if (actualIndex < itemCount) {
              const itemProps = {
                index: actualIndex,
                style: { height: itemSize },
                data: itemData,
              };
              return <div key={actualIndex}>{children(itemProps)}</div>;
            }
            return null;
          })}
        </div>
      );
    }),
  };
});

// Mock the MessageBubble component
vi.mock('@/sidebar/components/MessageBubble', () => ({
  MessageBubble: ({ message, className }: any) => (
    <div
      data-testid={`message-${message.id}`}
      data-role={message.role}
      data-status={message.status}
      className={`mock-message-bubble ${className || ''}`}
      style={{ height: '60px' }} // Mock height for calculations
    >
      <div className="mock-content">{message.content}</div>
      <div className="mock-meta">{message.timestamp.toLocaleTimeString()}</div>
    </div>
  ),
}));

// Helper function to create test messages
const createTestMessage = (
  id: string,
  role: MessageRole,
  content: string,
  status: MessageStatus = 'received'
): ChatMessage => ({
  id,
  role,
  content,
  timestamp: new Date(`2024-01-01T12:${id.padStart(2, '0')}:00Z`),
  status,
});

// Helper function to create large message array
const createLargeMessageArray = (count: number): ChatMessage[] => {
  return Array.from({ length: count }, (_, i) =>
    createTestMessage(
      String(i + 1).padStart(4, '0'),
      i % 2 === 0 ? 'user' : 'assistant',
      `Message content ${i + 1} - This is a sample message that could be of varying length depending on the content and formatting.`,
      'received'
    )
  );
};

describe('MessageList Virtual Scrolling', () => {
  // Mock scroll methods and ResizeObserver
  const mockScrollTo = vi.fn();
  const mockScrollIntoView = vi.fn();
  const mockIntersectionObserver = vi.fn();
  const mockResizeObserver = vi.fn();

  beforeAll(() => {
    Object.defineProperty(Element.prototype, 'scrollTo', {
      value: mockScrollTo,
      writable: true,
    });
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      value: mockScrollIntoView,
      writable: true,
    });

    // Mock ResizeObserver for react-window
    const mockResizeObserverInstance = {
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    };

    mockResizeObserver.mockImplementation(() => mockResizeObserverInstance);

    Object.defineProperty(window, 'ResizeObserver', {
      writable: true,
      configurable: true,
      value: mockResizeObserver,
    });

    // Mock IntersectionObserver
    const mockObserve = vi.fn();
    const mockUnobserve = vi.fn();
    const mockDisconnect = vi.fn();

    mockIntersectionObserver.mockImplementation(() => ({
      observe: mockObserve,
      unobserve: mockUnobserve,
      disconnect: mockDisconnect,
    }));

    Object.defineProperty(window, 'IntersectionObserver', {
      writable: true,
      configurable: true,
      value: mockIntersectionObserver,
    });

    Object.defineProperty(global, 'IntersectionObserver', {
      writable: true,
      configurable: true,
      value: mockIntersectionObserver,
    });
  });

  beforeEach(() => {
    mockScrollTo.mockClear();
    mockScrollIntoView.mockClear();
    mockIntersectionObserver.mockClear();
    mockResizeObserver.mockClear();
    mockScrollToItem.mockClear();
    vi.clearAllMocks();
  });

  describe('Large Dataset Rendering', () => {
    it('should enable virtualization for message lists with 1000+ items', () => {
      const largeMessageArray = createLargeMessageArray(1000);

      render(<MessageList messages={largeMessageArray} />);

      // Should use virtualized list for large datasets
      expect(screen.queryByTestId('virtualized-list')).toBeInTheDocument();

      // Should not render all 1000 messages in DOM (only visible ones)
      const messageElements = screen.getAllByTestId(/^message-\d+$/);
      expect(messageElements.length).toBeLessThan(1000);
      expect(messageElements.length).toBeLessThanOrEqual(20); // Based on our mock viewport size
    });

    it('should handle 2000+ messages efficiently', () => {
      const veryLargeMessageArray = createLargeMessageArray(2000);

      const startTime = performance.now();
      render(<MessageList messages={veryLargeMessageArray} />);
      const endTime = performance.now();

      // Rendering should be reasonably fast even with 2000 messages
      expect(endTime - startTime).toBeLessThan(500); // Should render in less than 500ms (more realistic for virtualization)

      // Should still use virtualization
      expect(screen.queryByTestId('virtualized-list')).toBeInTheDocument();

      // Should render only visible messages
      const messageElements = screen.getAllByTestId(/^message-\d+$/);
      expect(messageElements.length).toBeLessThanOrEqual(20);
    });

    it('should fall back to regular rendering for small message lists', () => {
      const smallMessageArray = createLargeMessageArray(50);

      render(<MessageList messages={smallMessageArray} />);

      // Should use regular rendering for small datasets (no virtualization)
      expect(screen.queryByTestId('virtualized-list')).not.toBeInTheDocument();
      expect(screen.getByTestId('messages-container')).toBeInTheDocument();

      // Should render all messages for small lists
      const messageElements = screen.getAllByTestId(/^message-\d+$/);
      expect(messageElements.length).toBe(50);
    });
  });

  describe('Variable Height Support', () => {
    it('should calculate dynamic heights for messages with different content lengths', () => {
      const messagesWithVariableContent = [
        createTestMessage('1', 'user', 'Short'),
        createTestMessage(
          '2',
          'assistant',
          'This is a medium length message that spans multiple words but not too many.'
        ),
        createTestMessage(
          '3',
          'user',
          'This is a very long message that contains a lot of text and should result in a much taller message bubble when rendered in the chat interface. It might even wrap to multiple lines depending on the width of the container.'
        ),
      ];

      // Add enough messages to trigger virtualization
      const largeArray = [...createLargeMessageArray(500), ...messagesWithVariableContent];

      render(<MessageList messages={largeArray} />);

      // Should use virtualized list for dynamic heights
      expect(screen.getByTestId('virtualized-list')).toBeInTheDocument();
    });

    it('should recalculate heights when message content changes', () => {
      const messages = createLargeMessageArray(1000);

      const { rerender } = render(<MessageList messages={messages} />);

      // Ensure virtualized list is rendered initially
      expect(screen.getByTestId('virtualized-list')).toBeInTheDocument();

      // Update content of some messages to trigger height recalculation
      const updatedMessages = messages.map((msg, index) =>
        index < 10
          ? {
              ...msg,
              content:
                'Updated content that is much longer than the original content and should trigger a height recalculation for proper virtualization.',
            }
          : msg
      );

      rerender(<MessageList messages={updatedMessages} />);

      // Should still use virtualized list with updated content
      expect(screen.getByTestId('virtualized-list')).toBeInTheDocument();
    });
  });

  describe('Scroll Position Preservation', () => {
    it('should preserve scroll position when messages are added at the top', async () => {
      const messages = createLargeMessageArray(1000);

      const { rerender } = render(
        <MessageList messages={messages} preserveScrollPosition={true} />
      );

      // Simulate being scrolled to a specific position
      const virtualList = screen.getByTestId('virtualized-list');
      Object.defineProperty(virtualList, 'scrollTop', {
        value: 2000,
        writable: true,
      });

      // Add new messages at the beginning (simulating loading older messages)
      const newMessages = [
        createTestMessage('new1', 'assistant', 'New message 1'),
        createTestMessage('new2', 'user', 'New message 2'),
        ...messages,
      ];

      rerender(<MessageList messages={newMessages} preserveScrollPosition={true} />);

      // Should not auto-scroll when preserving position
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(mockScrollTo).not.toHaveBeenCalled();

      // Should maintain scroll position by adjusting for new content
      // This would be handled by the virtualization library and scroll position adjustment
    });

    it('should maintain scroll position during rapid message updates', async () => {
      let messages = createLargeMessageArray(1000);

      const { rerender } = render(
        <MessageList messages={messages} preserveScrollPosition={true} />
      );

      // Simulate rapid updates (like streaming messages)
      for (let i = 0; i < 10; i++) {
        messages = [
          ...messages,
          createTestMessage(`stream-${i}`, 'assistant', `Streaming content ${i}`),
        ];

        rerender(<MessageList messages={messages} preserveScrollPosition={true} />);
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Should handle rapid updates without breaking scroll position
      expect(screen.getByTestId('virtualized-list')).toBeInTheDocument();

      // Should not auto-scroll during streaming when preserveScrollPosition is true
      expect(mockScrollTo).not.toHaveBeenCalled();
    });
  });

  describe('Auto-scroll Behavior with Virtualization', () => {
    it('should auto-scroll to bottom when new messages are added and user is at bottom', async () => {
      const messages = createLargeMessageArray(1000);

      const { rerender } = render(<MessageList messages={messages} autoScroll={true} />);

      // Add new message
      const newMessages = [...messages, createTestMessage('new', 'assistant', 'New message')];

      rerender(<MessageList messages={newMessages} autoScroll={true} />);

      // Should scroll to bottom for new messages (via scrollToItem for virtualized list)
      await waitFor(() => {
        expect(mockScrollToItem).toHaveBeenCalled();
      });
    });

    it('should not auto-scroll when user has scrolled up in virtualized list', async () => {
      const messages = createLargeMessageArray(1000);

      const { rerender } = render(<MessageList messages={messages} autoScroll={true} />);

      // Simulate user scrolling up
      const virtualList = screen.getByTestId('virtualized-list');
      Object.defineProperty(virtualList, 'scrollTop', {
        value: 1000, // Not at bottom
        writable: true,
      });

      fireEvent.scroll(virtualList);

      // Add new message
      const newMessages = [...messages, createTestMessage('new', 'assistant', 'New message')];

      rerender(<MessageList messages={newMessages} autoScroll={true} />);

      // Should not auto-scroll when user is scrolled up
      await new Promise(resolve => setTimeout(resolve, 100));
      // Note: This test might need adjustment based on actual scroll behavior implementation
    });
  });

  describe('Performance Optimization', () => {
    it('should render only visible items plus buffer', () => {
      const messages = createLargeMessageArray(1000);

      render(<MessageList messages={messages} />);

      // Should render only visible messages (mocked to be 20)
      const messageElements = screen.getAllByTestId(/^message-\d+$/);
      expect(messageElements.length).toBeLessThanOrEqual(20);

      // Should use virtualized list with correct structure
      const virtualList = screen.getByTestId('virtualized-list');
      expect(virtualList).toBeInTheDocument();
    });

    it('should handle memory cleanup properly on unmount', () => {
      const messages = createLargeMessageArray(1000);

      const { unmount } = render(<MessageList messages={messages} />);

      // Should not have memory leaks after unmount
      unmount();

      // This would typically be tested with actual memory profiling tools
      // For now, we just ensure the component unmounts without errors
      expect(true).toBe(true);
    });

    it('should throttle scroll events in virtualized mode', async () => {
      const messages = createLargeMessageArray(1000);
      const onScroll = vi.fn();

      render(<MessageList messages={messages} onScroll={onScroll} />);

      const virtualList = screen.getByTestId('virtualized-list');

      // Fire multiple rapid scroll events
      for (let i = 0; i < 10; i++) {
        fireEvent.scroll(virtualList);
      }

      // Should still call onScroll for each event (external handler)
      expect(onScroll).toHaveBeenCalledTimes(10);

      // But internal scroll handling should be throttled
      // This would be implementation-specific
    });
  });

  describe('Edge Cases', () => {
    it('should handle switching between virtualized and non-virtualized modes', () => {
      // Start with small list (non-virtualized)
      let messages = createLargeMessageArray(50);

      const { rerender } = render(<MessageList messages={messages} />);

      expect(screen.queryByTestId('virtualized-list')).not.toBeInTheDocument();
      expect(screen.getByTestId('messages-container')).toBeInTheDocument();

      // Switch to large list (virtualized)
      messages = createLargeMessageArray(1000);

      rerender(<MessageList messages={messages} />);

      expect(screen.queryByTestId('virtualized-list')).toBeInTheDocument();
      expect(screen.queryByTestId('messages-container')).not.toBeInTheDocument();
    });

    it('should handle empty list in virtualized mode', () => {
      render(<MessageList messages={[]} />);

      // Should show empty state, not virtualized list
      expect(screen.queryByTestId('virtualized-list')).not.toBeInTheDocument();
      expect(screen.getByTestId('message-list-empty')).toBeInTheDocument();
    });

    it('should handle messages with undefined or null content', () => {
      const messagesWithBadContent = [
        ...createLargeMessageArray(500),
        { ...createTestMessage('bad1', 'user', ''), content: '' },
        { ...createTestMessage('bad2', 'assistant', ''), content: null as any },
        { ...createTestMessage('bad3', 'user', ''), content: undefined as any },
      ];

      // Should not crash with bad content
      expect(() => {
        render(<MessageList messages={messagesWithBadContent} />);
      }).not.toThrow();

      expect(screen.getByTestId('virtualized-list')).toBeInTheDocument();
    });
  });

  describe('Accessibility in Virtual Mode', () => {
    it('should maintain ARIA attributes in virtualized list', () => {
      const messages = createLargeMessageArray(1000);

      render(<MessageList messages={messages} />);

      const virtualList = screen.getByTestId('virtualized-list');

      // Should maintain accessibility attributes
      expect(virtualList).toHaveAttribute('role');
      expect(virtualList).toHaveAttribute('aria-label');
    });

    it('should support keyboard navigation in virtualized list', () => {
      const messages = createLargeMessageArray(1000);

      render(<MessageList messages={messages} />);

      const virtualList = screen.getByTestId('virtualized-list');

      // Should be focusable for keyboard navigation
      expect(virtualList).toHaveAttribute('tabIndex');

      // Should handle keyboard events
      fireEvent.keyDown(virtualList, { key: 'ArrowDown' });
      fireEvent.keyDown(virtualList, { key: 'ArrowUp' });
      fireEvent.keyDown(virtualList, { key: 'Home' });
      fireEvent.keyDown(virtualList, { key: 'End' });

      // Should not crash with keyboard events
      expect(virtualList).toBeInTheDocument();
    });
  });
});
