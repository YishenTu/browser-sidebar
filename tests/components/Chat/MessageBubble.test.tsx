import { render, screen, waitFor, act } from '@tests/utils/test-utils';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { MessageBubble } from '@/sidebar/components/MessageBubble';
import { ChatMessage, MessageRole, MessageStatus } from '@/store/chat';

// Mock utilities
vi.mock('@/utils/cn', () => ({
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(' '),
}));

describe('MessageBubble', () => {
  const mockUser = userEvent.setup();

  // Helper function to create test messages
  const createMessage = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
    id: 'test-message-1',
    role: 'user' as MessageRole,
    content: 'Test message content',
    timestamp: new Date('2023-12-01T10:00:00Z'),
    status: 'sent' as MessageStatus,
    ...overrides,
  });

  describe('User Messages', () => {
    test('renders user message with correct content', () => {
      const message = createMessage({
        role: 'user',
        content: 'Hello, this is a user message',
      });

      render(<MessageBubble message={message} />);

      expect(screen.getByText('Hello, this is a user message')).toBeInTheDocument();
    });

    test('renders user message with right alignment styling', () => {
      const message = createMessage({ role: 'user' });

      render(<MessageBubble message={message} />);

      const messageContainer = screen.getByTestId('message-bubble');
      expect(messageContainer).toHaveClass('justify-end');
    });

    test('applies user-specific styling classes', () => {
      const message = createMessage({ role: 'user' });

      render(<MessageBubble message={message} />);

      const messageBubble = screen.getByTestId('message-content');
      expect(messageBubble).toHaveClass('bg-blue-500', 'text-white');
    });
  });

  describe('AI Messages', () => {
    test('renders AI message with correct content', () => {
      const message = createMessage({
        role: 'assistant',
        content: 'Hello, this is an AI response',
      });

      render(<MessageBubble message={message} />);

      expect(screen.getByText('Hello, this is an AI response')).toBeInTheDocument();
    });

    test('renders AI message with left alignment styling', () => {
      const message = createMessage({ role: 'assistant' });

      render(<MessageBubble message={message} />);

      const messageContainer = screen.getByTestId('message-bubble');
      expect(messageContainer).toHaveClass('justify-start');
    });

    test('applies AI-specific styling classes', () => {
      const message = createMessage({ role: 'assistant' });

      render(<MessageBubble message={message} />);

      const messageBubble = screen.getByTestId('message-content');
      expect(messageBubble).toHaveClass('bg-gray-100', 'text-gray-900');
    });
  });

  describe('System Messages', () => {
    test('renders system message with correct content', () => {
      const message = createMessage({
        role: 'system',
        content: 'System notification message',
      });

      render(<MessageBubble message={message} />);

      expect(screen.getByText('System notification message')).toBeInTheDocument();
    });

    test('renders system message with center alignment styling', () => {
      const message = createMessage({ role: 'system' });

      render(<MessageBubble message={message} />);

      const messageContainer = screen.getByTestId('message-bubble');
      expect(messageContainer).toHaveClass('justify-center');
    });

    test('applies system-specific styling classes', () => {
      const message = createMessage({ role: 'system' });

      render(<MessageBubble message={message} />);

      const messageBubble = screen.getByTestId('message-content');
      expect(messageBubble).toHaveClass('bg-yellow-100', 'text-yellow-800');
    });
  });

  describe('Timestamps', () => {
    test('displays timestamp in readable format', () => {
      const message = createMessage({
        timestamp: new Date('2023-12-01T10:30:00Z'),
      });

      render(<MessageBubble message={message} />);

      const timestamp = screen.getByTestId('message-timestamp');
      expect(timestamp).toBeInTheDocument();
      // Use a more flexible test that works across timezones
      expect(timestamp.textContent).toMatch(/\d{1,2}:\d{2}\s?(AM|PM)/);
    });

    test('shows full date for older messages', () => {
      const message = createMessage({
        timestamp: new Date('2023-11-15T14:22:00Z'),
      });

      render(<MessageBubble message={message} showFullDate />);

      const timestamp = screen.getByTestId('message-timestamp');
      // Use a more flexible test for date formatting
      expect(timestamp.textContent).toMatch(/Nov 15.*\d{1,2}:\d{2}\s?(AM|PM)/);
    });

    test('hides timestamp when showTimestamp is false', () => {
      const message = createMessage();

      render(<MessageBubble message={message} showTimestamp={false} />);

      expect(screen.queryByTestId('message-timestamp')).not.toBeInTheDocument();
    });
  });

  describe('Message Status', () => {
    test('shows sending status for user messages', () => {
      const message = createMessage({
        role: 'user',
        status: 'sending',
      });

      render(<MessageBubble message={message} />);

      expect(screen.getByTestId('message-status')).toBeInTheDocument();
      expect(screen.getByTestId('message-status')).toHaveTextContent('Sending...');
    });

    test('shows streaming status for AI messages', () => {
      const message = createMessage({
        role: 'assistant',
        status: 'streaming',
      });

      render(<MessageBubble message={message} />);

      expect(screen.getByTestId('message-status')).toBeInTheDocument();
      expect(screen.getByLabelText('AI is typing')).toBeInTheDocument();
    });

    test('shows error status with retry option', () => {
      const onRetry = vi.fn();
      const message = createMessage({
        status: 'error',
        error: 'Failed to send message',
      });

      render(<MessageBubble message={message} onRetry={onRetry} />);

      expect(screen.getByText('Failed to send message')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    test('calls onRetry when retry button is clicked', async () => {
      const onRetry = vi.fn();
      const message = createMessage({
        status: 'error',
        error: 'Network error',
      });

      render(<MessageBubble message={message} onRetry={onRetry} />);

      const retryButton = screen.getByText('Retry');
      await mockUser.click(retryButton);

      expect(onRetry).toHaveBeenCalledWith(message.id);
    });
  });

  describe('Accessibility', () => {
    test('has proper ARIA label for message role', () => {
      const userMessage = createMessage({ role: 'user' });
      const aiMessage = createMessage({ role: 'assistant' });

      const { rerender } = render(<MessageBubble message={userMessage} />);
      expect(screen.getByLabelText('User message')).toBeInTheDocument();

      rerender(<MessageBubble message={aiMessage} />);
      expect(screen.getByLabelText('Assistant message')).toBeInTheDocument();
    });

    test('includes timestamp in accessible format', () => {
      const message = createMessage({
        timestamp: new Date('2023-12-01T10:30:00Z'),
      });

      render(<MessageBubble message={message} />);

      const timestamp = screen.getByTestId('message-timestamp');
      expect(timestamp).toHaveAttribute('dateTime', '2023-12-01T10:30:00.000Z');
    });

    test('retry button is keyboard accessible', async () => {
      const onRetry = vi.fn();
      const message = createMessage({
        status: 'error',
        error: 'Test error',
      });

      render(<MessageBubble message={message} onRetry={onRetry} />);

      const retryButton = screen.getByText('Retry');
      retryButton.focus();
      await mockUser.keyboard('{Enter}');

      expect(onRetry).toHaveBeenCalledWith(message.id);
    });
  });

  describe('Content Handling', () => {
    test('handles long content with proper text wrapping', () => {
      const longContent =
        'This is a very long message that should wrap properly when displayed in the message bubble component and not cause any overflow issues.';
      const message = createMessage({ content: longContent });

      render(<MessageBubble message={message} />);

      const messageContent = screen.getByTestId('message-content');
      expect(messageContent).toHaveClass('break-words');
    });

    test('handles empty content gracefully', () => {
      const message = createMessage({ content: '' });

      render(<MessageBubble message={message} />);

      const messageContent = screen.getByTestId('message-content');
      expect(messageContent).toBeInTheDocument();
    });

    test('preserves whitespace in content', () => {
      const message = createMessage({
        content: 'Line 1\n\nLine 2 with  extra  spaces',
      });

      render(<MessageBubble message={message} />);

      const messageContent = screen.getByTestId('message-content');
      expect(messageContent).toHaveClass('whitespace-pre-wrap');
    });
  });

  describe('Hover Effects', () => {
    test('shows timestamp on hover when not always visible', () => {
      const message = createMessage();

      render(<MessageBubble message={message} showTimestamp={false} />);

      // Initially timestamp should not be visible
      expect(screen.queryByTestId('message-timestamp')).not.toBeInTheDocument();

      // On hover, timestamp should appear (we'll test this with CSS classes)
      const messageContainer = screen.getByTestId('message-bubble');
      expect(messageContainer).toHaveClass('group');

      // Check that hover timestamp exists
      expect(screen.getByTestId('message-timestamp-hover')).toBeInTheDocument();
    });
  });

  describe('Copy Functionality', () => {
    beforeEach(() => {
      // Mock clipboard API
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: vi.fn().mockResolvedValue(undefined),
        },
        writable: true,
        configurable: true,
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    test('shows copy button on hover', () => {
      const message = createMessage();

      render(<MessageBubble message={message} />);

      const copyButton = screen.getByTestId('copy-button');
      expect(copyButton).toBeInTheDocument();
      expect(copyButton).toHaveAttribute('aria-label', 'Copy message');
    });

    test('copies message content when copy button is clicked', async () => {
      const message = createMessage({
        content: 'This is the content to copy',
      });

      render(<MessageBubble message={message} />);

      const copyButton = screen.getByTestId('copy-button');
      await mockUser.click(copyButton);

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('This is the content to copy');
    });

    test('shows copy success feedback', async () => {
      const message = createMessage();

      render(<MessageBubble message={message} />);

      const copyButton = screen.getByTestId('copy-button');
      await mockUser.click(copyButton);

      expect(screen.getByText('Copied!')).toBeInTheDocument();
    });

    test('copy feedback disappears after timeout', async () => {
      vi.useFakeTimers();
      const message = createMessage();

      render(<MessageBubble message={message} />);

      const copyButton = screen.getByTestId('copy-button');
      await mockUser.click(copyButton);

      expect(screen.getByText('Copied!')).toBeInTheDocument();

      // Fast-forward time using act to properly handle state updates
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(screen.queryByText('Copied!')).not.toBeInTheDocument();
      });

      vi.useRealTimers();
    });

    test('handles copy failure gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: vi.fn().mockRejectedValue(new Error('Copy failed')),
        },
        writable: true,
        configurable: true,
      });

      const message = createMessage();

      render(<MessageBubble message={message} />);

      const copyButton = screen.getByTestId('copy-button');
      await act(async () => {
        await mockUser.click(copyButton);
      });

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to copy message:', expect.any(Error));
      });
      expect(screen.queryByText('Copied!')).not.toBeInTheDocument();

      consoleSpy.mockRestore();
    });

    test('copy button is keyboard accessible', async () => {
      const message = createMessage({
        content: 'Keyboard accessible content',
      });

      render(<MessageBubble message={message} />);

      const copyButton = screen.getByTestId('copy-button');
      copyButton.focus();

      await act(async () => {
        await mockUser.keyboard('{Enter}');
      });

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Keyboard accessible content');
      });
    });
  });

  describe('Avatar/Icon Support', () => {
    test('shows user avatar for user messages', () => {
      const message = createMessage({ role: 'user' });

      render(<MessageBubble message={message} />);

      const avatar = screen.getByTestId('message-avatar');
      expect(avatar).toBeInTheDocument();
      expect(avatar).toHaveAttribute('aria-label', 'User avatar');
    });

    test('shows AI avatar for assistant messages', () => {
      const message = createMessage({ role: 'assistant' });

      render(<MessageBubble message={message} />);

      const avatar = screen.getByTestId('message-avatar');
      expect(avatar).toBeInTheDocument();
      expect(avatar).toHaveAttribute('aria-label', 'Assistant avatar');
    });

    test('shows system icon for system messages', () => {
      const message = createMessage({ role: 'system' });

      render(<MessageBubble message={message} />);

      const avatar = screen.getByTestId('message-avatar');
      expect(avatar).toBeInTheDocument();
      expect(avatar).toHaveAttribute('aria-label', 'System message');
    });
  });

  describe('Custom Props', () => {
    test('accepts custom className', () => {
      const message = createMessage();

      render(<MessageBubble message={message} className="custom-class" />);

      const messageContainer = screen.getByTestId('message-bubble');
      expect(messageContainer).toHaveClass('custom-class');
    });

    test('forwards additional props to container', () => {
      const message = createMessage();

      render(<MessageBubble message={message} data-testid="custom-test-id" />);

      expect(screen.getByTestId('custom-test-id')).toBeInTheDocument();
    });
  });
});
