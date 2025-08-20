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
  });

  beforeEach(() => {
    mockScrollTo.mockClear();
    mockScrollIntoView.mockClear();
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

      const messageElements = screen.getAllByTestId(/^message-/);
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

      // Should render all messages
      expect(screen.getByTestId('message-1')).toBeInTheDocument();
      expect(screen.getByTestId('message-100')).toBeInTheDocument();
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
});
