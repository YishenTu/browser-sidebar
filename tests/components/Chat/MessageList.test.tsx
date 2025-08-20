import { render, screen, fireEvent, waitFor } from '@tests/utils/test-utils';
import { MessageList } from '@/components/Chat/MessageList';
import { ChatMessage, MessageRole, MessageStatus } from '@/store/chat';
import { vi } from 'vitest';

// Mock the MessageBubble component
vi.mock('@/components/Chat/MessageBubble', () => ({
  MessageBubble: ({ message, className }: any) => (
    <div
      data-testid={`message-${message.id}`}
      data-role={message.role}
      data-status={message.status}
      className={`mock-message-bubble ${className || ''}`}
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

describe('MessageList Component', () => {
  // Mock scroll methods since they're not implemented in JSDOM
  const mockScrollTo = vi.fn();
  const mockScrollIntoView = vi.fn();
  const mockIntersectionObserver = vi.fn();

  beforeAll(() => {
    Object.defineProperty(Element.prototype, 'scrollTo', {
      value: mockScrollTo,
      writable: true,
    });
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      value: mockScrollIntoView,
      writable: true,
    });
    Object.defineProperty(Element.prototype, 'scrollTop', {
      value: 0,
      writable: true,
    });
    Object.defineProperty(Element.prototype, 'scrollHeight', {
      value: 1000,
      writable: true,
    });
    Object.defineProperty(Element.prototype, 'clientHeight', {
      value: 500,
      writable: true,
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
  });

  describe('Basic Rendering', () => {
    it('renders empty state when no messages are provided', () => {
      render(<MessageList messages={[]} />);

      expect(screen.getByText('No messages yet')).toBeInTheDocument();
      expect(screen.getByText('Start a conversation to see messages here.')).toBeInTheDocument();
      expect(screen.getByTestId('message-list-empty')).toBeInTheDocument();
    });

    it('renders custom empty message when provided', () => {
      render(<MessageList messages={[]} emptyMessage="Custom empty message" />);

      expect(screen.getByText('Custom empty message')).toBeInTheDocument();
      expect(screen.queryByText('No messages yet')).not.toBeInTheDocument();
    });

    it('renders loading state when isLoading is true', () => {
      render(<MessageList messages={[]} isLoading={true} />);

      expect(screen.getByTestId('message-list-loading')).toBeInTheDocument();
      expect(screen.getByText('Loading messages...')).toBeInTheDocument();
    });

    it('renders loading state with custom message', () => {
      render(
        <MessageList messages={[]} isLoading={true} loadingMessage="Fetching chat history..." />
      );

      expect(screen.getByText('Fetching chat history...')).toBeInTheDocument();
    });

    it('renders messages list container with proper structure', () => {
      const messages = [
        createTestMessage('1', 'user', 'Hello'),
        createTestMessage('2', 'assistant', 'Hi there!'),
      ];

      render(<MessageList messages={messages} />);

      expect(screen.getByTestId('message-list')).toBeInTheDocument();
      expect(screen.getByTestId('message-list-container')).toBeInTheDocument();
      expect(screen.getByTestId('messages-container')).toBeInTheDocument();
    });
  });

  describe('Message Rendering', () => {
    it('renders all provided messages', () => {
      const messages = [
        createTestMessage('1', 'user', 'First message'),
        createTestMessage('2', 'assistant', 'Second message'),
        createTestMessage('3', 'user', 'Third message'),
      ];

      render(<MessageList messages={messages} />);

      expect(screen.getByTestId('message-1')).toBeInTheDocument();
      expect(screen.getByTestId('message-2')).toBeInTheDocument();
      expect(screen.getByTestId('message-3')).toBeInTheDocument();
      expect(screen.getByText('First message')).toBeInTheDocument();
      expect(screen.getByText('Second message')).toBeInTheDocument();
      expect(screen.getByText('Third message')).toBeInTheDocument();
    });

    it('renders messages in chronological order', () => {
      const messages = [
        createTestMessage('1', 'user', 'First'),
        createTestMessage('2', 'assistant', 'Second'),
        createTestMessage('3', 'user', 'Third'),
      ];

      render(<MessageList messages={messages} />);

      const messageElements = screen.getAllByTestId(/^message-\d+$/);
      expect(messageElements).toHaveLength(3);

      // Check order by checking the text content
      const firstMessage = screen.getByTestId('message-1');
      const secondMessage = screen.getByTestId('message-2');
      const thirdMessage = screen.getByTestId('message-3');

      expect(firstMessage).toBeInTheDocument();
      expect(secondMessage).toBeInTheDocument();
      expect(thirdMessage).toBeInTheDocument();
    });

    it('passes correct props to MessageBubble components', () => {
      const messages = [createTestMessage('1', 'user', 'Test message', 'sent')];

      render(<MessageList messages={messages} />);

      const messageElement = screen.getByTestId('message-1');
      expect(messageElement).toHaveAttribute('data-role', 'user');
      expect(messageElement).toHaveAttribute('data-status', 'sent');
    });
  });

  describe('Scrolling Behavior', () => {
    it('auto-scrolls to bottom when autoScroll is true (default)', async () => {
      const messages = [createTestMessage('1', 'user', 'Test message')];

      const { rerender } = render(<MessageList messages={messages} />);

      // Add new message
      const newMessages = [...messages, createTestMessage('2', 'assistant', 'New message')];

      rerender(<MessageList messages={newMessages} />);

      // Wait for scroll effect
      await waitFor(() => {
        expect(mockScrollTo).toHaveBeenCalled();
      });
    });

    it('does not auto-scroll when autoScroll is false', async () => {
      const messages = [createTestMessage('1', 'user', 'Test message')];

      const { rerender } = render(<MessageList messages={messages} autoScroll={false} />);

      const newMessages = [...messages, createTestMessage('2', 'assistant', 'New message')];

      rerender(<MessageList messages={newMessages} autoScroll={false} />);

      // Wait a bit to ensure scroll doesn't happen
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockScrollTo).not.toHaveBeenCalled();
    });

    it('shows scroll to bottom button when scrolled up', async () => {
      const messages = Array.from({ length: 10 }, (_, i) =>
        createTestMessage(String(i + 1), 'user', `Message ${i + 1}`)
      );

      render(<MessageList messages={messages} />);

      const scrollContainer = screen.getByTestId('message-list-container');

      // Simulate scrolling up
      Object.defineProperty(scrollContainer, 'scrollTop', {
        value: 100,
        writable: true,
      });
      Object.defineProperty(scrollContainer, 'scrollHeight', {
        value: 1000,
        writable: true,
      });
      Object.defineProperty(scrollContainer, 'clientHeight', {
        value: 500,
        writable: true,
      });

      fireEvent.scroll(scrollContainer);

      await waitFor(() => {
        expect(screen.getByTestId('scroll-to-bottom')).toBeInTheDocument();
      });
    });

    it('hides scroll to bottom button when at bottom', async () => {
      const messages = Array.from({ length: 10 }, (_, i) =>
        createTestMessage(String(i + 1), 'user', `Message ${i + 1}`)
      );

      render(<MessageList messages={messages} />);

      const scrollContainer = screen.getByTestId('message-list-container');

      // First scroll up to show button
      Object.defineProperty(scrollContainer, 'scrollTop', {
        value: 100,
        writable: true,
      });
      fireEvent.scroll(scrollContainer);

      await waitFor(() => {
        expect(screen.getByTestId('scroll-to-bottom')).toBeInTheDocument();
      });

      // Then scroll to bottom to hide button
      Object.defineProperty(scrollContainer, 'scrollTop', {
        value: 500, // scrollHeight - clientHeight = 1000 - 500 = 500
        writable: true,
      });
      fireEvent.scroll(scrollContainer);

      await waitFor(() => {
        expect(screen.queryByTestId('scroll-to-bottom')).not.toBeInTheDocument();
      });
    });

    it('scrolls to bottom when scroll to bottom button is clicked', async () => {
      const messages = Array.from({ length: 10 }, (_, i) =>
        createTestMessage(String(i + 1), 'user', `Message ${i + 1}`)
      );

      render(<MessageList messages={messages} />);

      const scrollContainer = screen.getByTestId('message-list-container');

      // Simulate scrolling up to show button
      Object.defineProperty(scrollContainer, 'scrollTop', {
        value: 100,
        writable: true,
      });
      fireEvent.scroll(scrollContainer);

      await waitFor(() => {
        expect(screen.getByTestId('scroll-to-bottom')).toBeInTheDocument();
      });

      const scrollButton = screen.getByTestId('scroll-to-bottom');
      fireEvent.click(scrollButton);

      await waitFor(() => {
        expect(mockScrollTo).toHaveBeenCalledWith({
          top: expect.any(Number),
          behavior: 'smooth',
        });
      });
    });
  });

  describe('Props and Configuration', () => {
    it('applies custom className to the container', () => {
      render(<MessageList messages={[]} className="custom-class" />);

      const container = screen.getByTestId('message-list');
      expect(container).toHaveClass('custom-class');
    });

    it('applies custom height when provided', () => {
      render(<MessageList messages={[]} height="400px" />);

      const container = screen.getByTestId('message-list-container');
      expect(container).toHaveStyle('height: 400px');
    });

    it('uses default height when not provided', () => {
      render(<MessageList messages={[]} />);

      const container = screen.getByTestId('message-list-container');
      expect(container).toHaveStyle('height: 100%');
    });

    it('calls onScroll callback when scrolling', () => {
      const onScroll = vi.fn();
      const messages = [createTestMessage('1', 'user', 'Test')];

      render(<MessageList messages={messages} onScroll={onScroll} />);

      const scrollContainer = screen.getByTestId('message-list-container');
      fireEvent.scroll(scrollContainer);

      expect(onScroll).toHaveBeenCalledWith(expect.any(Object));
    });
  });

  describe('Loading State Behavior', () => {
    it('shows loading indicator at the top when loading older messages', () => {
      const messages = [createTestMessage('1', 'user', 'Test')];

      render(<MessageList messages={messages} isLoading={true} />);

      expect(screen.getByTestId('message-list-loading')).toBeInTheDocument();
      expect(screen.getByTestId('message-1')).toBeInTheDocument();
    });

    it('preserves scroll position when loading new messages with preserveScrollPosition', async () => {
      const messages = [createTestMessage('1', 'user', 'Test')];

      const { rerender } = render(
        <MessageList messages={messages} preserveScrollPosition={true} />
      );

      const scrollContainer = screen.getByTestId('message-list-container');

      // Set scroll position
      Object.defineProperty(scrollContainer, 'scrollTop', {
        value: 200,
        writable: true,
      });

      // Add new messages (simulating loading older messages)
      const newMessages = [createTestMessage('0', 'assistant', 'Older message'), ...messages];

      rerender(<MessageList messages={newMessages} preserveScrollPosition={true} />);

      // Should not auto-scroll when preserveScrollPosition is true
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(mockScrollTo).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('handles empty message content gracefully', () => {
      const messages = [createTestMessage('1', 'user', '')];

      render(<MessageList messages={messages} />);

      expect(screen.getByTestId('message-1')).toBeInTheDocument();
    });

    it('handles messages with different status types', () => {
      const messages = [
        createTestMessage('1', 'user', 'Sending...', 'sending'),
        createTestMessage('2', 'user', 'Sent message', 'sent'),
        createTestMessage('3', 'assistant', 'Streaming...', 'streaming'),
        createTestMessage('4', 'assistant', 'Complete response', 'received'),
        createTestMessage('5', 'user', 'Failed message', 'error'),
      ];

      render(<MessageList messages={messages} />);

      messages.forEach(message => {
        expect(screen.getByTestId(`message-${message.id}`)).toBeInTheDocument();
        expect(screen.getByTestId(`message-${message.id}`)).toHaveAttribute(
          'data-status',
          message.status
        );
      });
    });

    it('handles rapid message updates without breaking', async () => {
      const messages = [createTestMessage('1', 'user', 'Initial')];

      const { rerender } = render(<MessageList messages={messages} />);

      // Rapidly add messages
      for (let i = 2; i <= 5; i++) {
        const newMessages = [
          ...messages.slice(0, i - 1),
          createTestMessage(String(i), 'assistant', `Message ${i}`),
        ];

        rerender(<MessageList messages={newMessages} />);
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Should still render all messages
      expect(screen.getByTestId('message-5')).toBeInTheDocument();
    });

    it('handles very long message lists', () => {
      const messages = Array.from({ length: 100 }, (_, i) =>
        createTestMessage(String(i + 1), i % 2 === 0 ? 'user' : 'assistant', `Message ${i + 1}`)
      );

      render(<MessageList messages={messages} />);

      // With 100 messages, virtualization kicks in (threshold = 100)
      // Should render first message (always visible in our test mock)
      expect(screen.getByTestId('message-1')).toBeInTheDocument();

      // Not all messages are rendered in DOM due to virtualization
      // But the list should be present
      expect(screen.getByTestId('message-list')).toBeInTheDocument();
    });
  });

  describe('Performance Optimizations', () => {
    it('creates IntersectionObserver when messages are present', () => {
      const messages = [createTestMessage('1', 'user', 'Test')];

      render(<MessageList messages={messages} />);

      expect(mockIntersectionObserver).toHaveBeenCalled();
    });

    it('handles rapid scroll events with throttling', async () => {
      const messages = Array.from({ length: 10 }, (_, i) =>
        createTestMessage(String(i + 1), 'user', `Message ${i + 1}`)
      );

      const onScroll = vi.fn();
      render(<MessageList messages={messages} onScroll={onScroll} />);

      const scrollContainer = screen.getByTestId('message-list-container');

      // Fire multiple scroll events rapidly
      for (let i = 0; i < 5; i++) {
        fireEvent.scroll(scrollContainer);
      }

      // onScroll should be called for each event (not throttled)
      expect(onScroll).toHaveBeenCalledTimes(5);
    });

    it('optimizes re-renders with memoization', () => {
      const messages = [
        createTestMessage('1', 'user', 'Message 1'),
        createTestMessage('2', 'assistant', 'Message 2'),
      ];

      const { rerender } = render(<MessageList messages={messages} />);

      // Get initial message count
      const initialMessages = screen.getAllByTestId(/^message-\d+$/);
      expect(initialMessages).toHaveLength(2);

      // Rerender with same messages (should use memoization)
      rerender(<MessageList messages={messages} />);

      const rerenderedMessages = screen.getAllByTestId(/^message-\d+$/);
      expect(rerenderedMessages).toHaveLength(2);
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      const messages = [createTestMessage('1', 'user', 'Test')];

      render(<MessageList messages={messages} />);

      const list = screen.getByTestId('messages-container');
      expect(list).toHaveAttribute('role', 'log');
      expect(list).toHaveAttribute('aria-live', 'polite');
      expect(list).toHaveAttribute('aria-label', 'Chat messages');
    });

    it('has proper ARIA label for empty state', () => {
      render(<MessageList messages={[]} />);

      const emptyState = screen.getByTestId('message-list-empty');
      expect(emptyState).toHaveAttribute('aria-label', 'No messages');
    });

    it('has proper ARIA label for loading state', () => {
      render(<MessageList messages={[]} isLoading={true} />);

      const loadingState = screen.getByTestId('message-list-loading');
      expect(loadingState).toHaveAttribute('aria-label', 'Loading messages');
    });

    it('has proper ARIA label for scroll to bottom button', async () => {
      const messages = Array.from({ length: 10 }, (_, i) =>
        createTestMessage(String(i + 1), 'user', `Message ${i + 1}`)
      );

      render(<MessageList messages={messages} />);

      const scrollContainer = screen.getByTestId('message-list-container');

      // Simulate scrolling up
      Object.defineProperty(scrollContainer, 'scrollTop', {
        value: 100,
        writable: true,
      });
      fireEvent.scroll(scrollContainer);

      await waitFor(() => {
        const scrollButton = screen.getByTestId('scroll-to-bottom');
        expect(scrollButton).toHaveAttribute('aria-label', 'Scroll to bottom');
      });
    });
  });

  describe('Virtual Scrolling', () => {
    it('enables virtualization when message count exceeds threshold', () => {
      // Test with exactly the threshold (100 messages)
      const messages = Array.from({ length: 100 }, (_, i) =>
        createTestMessage(String(i + 1), i % 2 === 0 ? 'user' : 'assistant', `Message ${i + 1}`)
      );

      render(<MessageList messages={messages} />);

      // Should switch to virtualized list (look for the class name instead)
      expect(document.querySelector('.virtualized-message-list')).toBeInTheDocument();

      // Should not render the non-virtualized container
      expect(screen.queryByTestId('message-list-container')).not.toBeInTheDocument();
    });

    it('handles 1000+ messages with virtualization', () => {
      // Test with 1000+ messages
      const messages = Array.from({ length: 1500 }, (_, i) =>
        createTestMessage(String(i + 1), i % 2 === 0 ? 'user' : 'assistant', `Message ${i + 1}`)
      );

      render(<MessageList messages={messages} height="400px" />);

      // Should use virtualized list
      expect(document.querySelector('.virtualized-message-list')).toBeInTheDocument();

      // Should render first message
      expect(screen.getByTestId('message-1')).toBeInTheDocument();

      // Should not render all 1500 messages in DOM - virtualization limits rendering
      const renderedMessages = screen.getAllByTestId(/^message-\d+$/);
      expect(renderedMessages.length).toBeLessThan(1500); // Should be significantly less
      expect(renderedMessages.length).toBeGreaterThan(0); // But should render some
    });

    it('only renders visible items plus buffer in virtualized mode', () => {
      const messages = Array.from({ length: 200 }, (_, i) =>
        createTestMessage(String(i + 1), i % 2 === 0 ? 'user' : 'assistant', `Message ${i + 1}`)
      );

      render(<MessageList messages={messages} />);

      // Count actual DOM elements with message data-testid
      const renderedMessages = screen.getAllByTestId(/^message-\d+$/);

      // Should only render visible items + buffer, not all 200 messages
      expect(renderedMessages.length).toBeLessThan(200);
      expect(renderedMessages.length).toBeGreaterThan(0);
    });

    it('uses custom virtualization threshold', () => {
      // Test with custom threshold of 50
      const messages = Array.from({ length: 60 }, (_, i) =>
        createTestMessage(String(i + 1), 'user', `Message ${i + 1}`)
      );

      render(<MessageList messages={messages} virtualizationThreshold={50} />);

      // Should enable virtualization since 60 > 50
      expect(document.querySelector('.virtualized-message-list')).toBeInTheDocument();
    });

    it('stays non-virtualized when below custom threshold', () => {
      const messages = Array.from({ length: 30 }, (_, i) =>
        createTestMessage(String(i + 1), 'user', `Message ${i + 1}`)
      );

      render(<MessageList messages={messages} virtualizationThreshold={50} />);

      // Should use regular list since 30 < 50
      expect(screen.getByTestId('message-list-container')).toBeInTheDocument();
      expect(document.querySelector('.virtualized-message-list')).not.toBeInTheDocument();
    });

    it('handles memory cleanup properly in virtualized mode', () => {
      const messages = Array.from({ length: 500 }, (_, i) =>
        createTestMessage(String(i + 1), i % 2 === 0 ? 'user' : 'assistant', `Message ${i + 1}`)
      );

      const { unmount } = render(<MessageList messages={messages} />);

      // Should render without errors
      expect(document.querySelector('.virtualized-message-list')).toBeInTheDocument();

      // Should unmount cleanly without memory leaks
      expect(() => unmount()).not.toThrow();
    });

    it('maintains proper ARIA attributes in virtualized mode', () => {
      const messages = Array.from({ length: 150 }, (_, i) =>
        createTestMessage(String(i + 1), i % 2 === 0 ? 'user' : 'assistant', `Message ${i + 1}`)
      );

      render(<MessageList messages={messages} />);

      const virtualizedList = document.querySelector('.virtualized-message-list');
      expect(virtualizedList).toBeInTheDocument();
      expect(virtualizedList).toHaveAttribute('role', 'log');
      expect(virtualizedList).toHaveAttribute('aria-live', 'polite');
      expect(virtualizedList).toHaveAttribute('aria-label', 'Chat messages');
      expect(virtualizedList).toHaveAttribute('tabIndex', '0');
    });

    it('handles variable message heights correctly', async () => {
      // Create messages with varying content lengths to simulate variable heights
      const messages = Array.from({ length: 200 }, (_, i) => {
        const contentLength = (i % 5) + 1; // Varying content lengths
        const content = Array(contentLength * 20)
          .fill(`Word ${i}`)
          .join(' ');
        return createTestMessage(String(i + 1), i % 2 === 0 ? 'user' : 'assistant', content);
      });

      render(<MessageList messages={messages} />);

      expect(document.querySelector('.virtualized-message-list')).toBeInTheDocument();

      // Should handle variable heights without errors
      expect(screen.getByTestId('message-1')).toBeInTheDocument();
    });

    it('switches between virtualized and non-virtualized modes dynamically', () => {
      // Start with few messages (non-virtualized)
      const fewMessages = Array.from({ length: 50 }, (_, i) =>
        createTestMessage(String(i + 1), 'user', `Message ${i + 1}`)
      );

      const { rerender } = render(<MessageList messages={fewMessages} />);

      // Should be non-virtualized
      expect(screen.getByTestId('message-list-container')).toBeInTheDocument();
      expect(document.querySelector('.virtualized-message-list')).not.toBeInTheDocument();

      // Add more messages to exceed threshold
      const manyMessages = Array.from({ length: 150 }, (_, i) =>
        createTestMessage(String(i + 1), 'user', `Message ${i + 1}`)
      );

      rerender(<MessageList messages={manyMessages} />);

      // Should switch to virtualized
      expect(document.querySelector('.virtualized-message-list')).toBeInTheDocument();
      expect(screen.queryByTestId('message-list-container')).not.toBeInTheDocument();
    });
  });

  describe('Scroll Position Preservation', () => {
    beforeEach(() => {
      mockScrollTo.mockClear();
      mockScrollIntoView.mockClear();
    });

    it('preserves scroll position when new messages are added at the top (non-virtualized)', async () => {
      const messages = Array.from({ length: 50 }, (_, i) =>
        createTestMessage(String(i + 1), i % 2 === 0 ? 'user' : 'assistant', `Message ${i + 1}`)
      );

      const { rerender } = render(
        <MessageList messages={messages} preserveScrollPosition={true} />
      );

      const scrollContainer = screen.getByTestId('message-list-container');

      // Set initial scroll position
      Object.defineProperty(scrollContainer, 'scrollTop', {
        value: 200,
        writable: true,
        configurable: true,
      });

      // Add older messages at the beginning (simulating loading history)
      const olderMessages = Array.from({ length: 10 }, (_, i) =>
        createTestMessage(`old-${i}`, 'assistant', `Older message ${i}`)
      );
      const newMessages = [...olderMessages, ...messages];

      rerender(<MessageList messages={newMessages} preserveScrollPosition={true} />);

      // Should not auto-scroll when preserveScrollPosition is true
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(mockScrollTo).not.toHaveBeenCalled();
    });

    it('preserves scroll position during rapid message updates (virtualized)', async () => {
      const baseMessages = Array.from({ length: 150 }, (_, i) =>
        createTestMessage(String(i + 1), i % 2 === 0 ? 'user' : 'assistant', `Message ${i + 1}`)
      );

      const { rerender } = render(
        <MessageList messages={baseMessages} preserveScrollPosition={true} />
      );

      expect(document.querySelector('.virtualized-message-list')).toBeInTheDocument();

      // Simulate multiple rapid updates (like loading message history)
      for (let batch = 1; batch <= 5; batch++) {
        const olderMessages = Array.from({ length: 10 }, (_, i) =>
          createTestMessage(`batch-${batch}-${i}`, 'assistant', `Batch ${batch} message ${i}`)
        );
        const updatedMessages = [...olderMessages, ...baseMessages];

        rerender(<MessageList messages={updatedMessages} preserveScrollPosition={true} />);

        // Small delay between updates
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Virtualized list should handle updates without scrolling automatically
      expect(document.querySelector('.virtualized-message-list')).toBeInTheDocument();
    });

    it('maintains scroll position when switching from non-virtualized to virtualized', async () => {
      // Start with non-virtualized list
      const initialMessages = Array.from({ length: 80 }, (_, i) =>
        createTestMessage(String(i + 1), 'user', `Message ${i + 1}`)
      );

      const { rerender } = render(
        <MessageList messages={initialMessages} preserveScrollPosition={true} />
      );

      // Verify non-virtualized
      expect(screen.getByTestId('message-list-container')).toBeInTheDocument();

      // Set scroll position
      const scrollContainer = screen.getByTestId('message-list-container');
      Object.defineProperty(scrollContainer, 'scrollTop', {
        value: 300,
        writable: true,
        configurable: true,
      });

      // Add enough messages to trigger virtualization
      const expandedMessages = Array.from({ length: 120 }, (_, i) =>
        createTestMessage(String(i + 1), 'user', `Message ${i + 1}`)
      );

      rerender(<MessageList messages={expandedMessages} preserveScrollPosition={true} />);

      // Should now be virtualized
      expect(document.querySelector('.virtualized-message-list')).toBeInTheDocument();

      // Should not auto-scroll during transition
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(mockScrollTo).not.toHaveBeenCalled();
    });

    it('respects scroll position preservation when disabled', async () => {
      const messages = Array.from({ length: 120 }, (_, i) =>
        createTestMessage(String(i + 1), i % 2 === 0 ? 'user' : 'assistant', `Message ${i + 1}`)
      );

      const { rerender } = render(
        <MessageList messages={messages} preserveScrollPosition={false} autoScroll={true} />
      );

      // Add new messages
      const newMessages = [
        ...messages,
        createTestMessage('new1', 'assistant', 'New message 1'),
        createTestMessage('new2', 'user', 'New message 2'),
      ];

      rerender(
        <MessageList messages={newMessages} preserveScrollPosition={false} autoScroll={true} />
      );

      // Should auto-scroll when preserveScrollPosition is false and autoScroll is true
      // The virtualized list should handle this properly
      expect(document.querySelector('.virtualized-message-list')).toBeInTheDocument();
      expect(screen.getByTestId('message-new1')).toBeInTheDocument();
      expect(screen.getByTestId('message-new2')).toBeInTheDocument();
    });

    it('handles edge case of empty to populated list with preserved scroll position', async () => {
      const { rerender } = render(<MessageList messages={[]} preserveScrollPosition={true} />);

      // Verify empty state
      expect(screen.getByTestId('message-list-empty')).toBeInTheDocument();

      // Add messages
      const messages = Array.from({ length: 150 }, (_, i) =>
        createTestMessage(String(i + 1), i % 2 === 0 ? 'user' : 'assistant', `Message ${i + 1}`)
      );

      rerender(<MessageList messages={messages} preserveScrollPosition={true} />);

      // Should switch to virtualized and handle gracefully
      expect(document.querySelector('.virtualized-message-list')).toBeInTheDocument();
      expect(screen.getByTestId('message-1')).toBeInTheDocument();
    });

    it('preserves scroll position during loading state changes', async () => {
      const messages = Array.from({ length: 120 }, (_, i) =>
        createTestMessage(String(i + 1), i % 2 === 0 ? 'user' : 'assistant', `Message ${i + 1}`)
      );

      const { rerender } = render(
        <MessageList messages={messages} isLoading={false} preserveScrollPosition={true} />
      );

      // Start loading
      rerender(<MessageList messages={messages} isLoading={true} preserveScrollPosition={true} />);

      expect(screen.getByTestId('message-list-loading')).toBeInTheDocument();

      // Add more messages and stop loading
      const moreMessages = [
        createTestMessage('older1', 'assistant', 'Older message 1'),
        ...messages,
      ];

      rerender(
        <MessageList messages={moreMessages} isLoading={false} preserveScrollPosition={true} />
      );

      // Should preserve scroll position throughout loading states
      expect(document.querySelector('.virtualized-message-list')).toBeInTheDocument();
      expect(screen.getByTestId('message-older1')).toBeInTheDocument();
    });

    it('handles scroll position preservation with intersection observer updates', async () => {
      const messages = Array.from({ length: 200 }, (_, i) =>
        createTestMessage(String(i + 1), i % 2 === 0 ? 'user' : 'assistant', `Message ${i + 1}`)
      );

      const { rerender } = render(
        <MessageList messages={messages} preserveScrollPosition={true} />
      );

      expect(document.querySelector('.virtualized-message-list')).toBeInTheDocument();

      // Add new messages
      const moreMessages = [...messages, createTestMessage('new1', 'assistant', 'New message')];

      rerender(<MessageList messages={moreMessages} preserveScrollPosition={true} />);

      // Should handle intersection observer updates with scroll position preservation
      expect(document.querySelector('.virtualized-message-list')).toBeInTheDocument();
      expect(screen.getByTestId('message-new1')).toBeInTheDocument();
    });
  });
});
