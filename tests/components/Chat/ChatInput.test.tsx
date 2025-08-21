import { render, screen, userEvent } from '@tests/utils/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatInput } from '@/sidebar/components/ChatInput';

describe('ChatInput Component', () => {
  const mockOnSend = vi.fn();
  const mockOnClear = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders chat input with textarea and send button', () => {
      render(<ChatInput onSend={mockOnSend} />);

      const textarea = screen.getByRole('textbox');
      const sendButton = screen.getByRole('button', { name: /send/i });

      expect(textarea).toBeInTheDocument();
      expect(sendButton).toBeInTheDocument();
    });

    it('renders with placeholder text', () => {
      const placeholder = 'Type your message here...';
      render(<ChatInput onSend={mockOnSend} placeholder={placeholder} />);

      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('placeholder', placeholder);
    });

    it('renders with initial value', () => {
      const initialValue = 'Hello, world!';
      render(<ChatInput onSend={mockOnSend} value={initialValue} />);

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.value).toBe(initialValue);
    });

    it('renders essential action buttons only', () => {
      render(<ChatInput onSend={mockOnSend} onClear={mockOnClear} />);

      const sendButton = screen.getByRole('button', { name: /send/i });
      const clearButton = screen.getByRole('button', { name: /clear/i });

      expect(sendButton).toBeInTheDocument();
      expect(clearButton).toBeInTheDocument();

      // Utility buttons should not be present
      expect(screen.queryByRole('button', { name: /attach/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /voice/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /settings/i })).not.toBeInTheDocument();
    });
  });

  describe('Message Submission', () => {
    it('calls onSend when send button is clicked with message', async () => {
      const user = userEvent.setup();
      const message = 'Test message';

      render(<ChatInput onSend={mockOnSend} />);

      const textarea = screen.getByRole('textbox');
      const sendButton = screen.getByRole('button', { name: /send/i });

      await user.type(textarea, message);
      await user.click(sendButton);

      expect(mockOnSend).toHaveBeenCalledTimes(1);
      expect(mockOnSend).toHaveBeenCalledWith(message);
    });

    it('does not call onSend with empty message', async () => {
      const user = userEvent.setup();

      render(<ChatInput onSend={mockOnSend} />);

      const sendButton = screen.getByRole('button', { name: /send/i });
      await user.click(sendButton);

      expect(mockOnSend).not.toHaveBeenCalled();
    });

    it('does not call onSend with whitespace-only message', async () => {
      const user = userEvent.setup();

      render(<ChatInput onSend={mockOnSend} />);

      const textarea = screen.getByRole('textbox');
      const sendButton = screen.getByRole('button', { name: /send/i });

      await user.type(textarea, '   ');
      await user.click(sendButton);

      expect(mockOnSend).not.toHaveBeenCalled();
    });

    it('trims message before sending', async () => {
      const user = userEvent.setup();
      const message = '  Test message  ';
      const trimmedMessage = 'Test message';

      render(<ChatInput onSend={mockOnSend} />);

      const textarea = screen.getByRole('textbox');
      const sendButton = screen.getByRole('button', { name: /send/i });

      await user.type(textarea, message);
      await user.click(sendButton);

      expect(mockOnSend).toHaveBeenCalledWith(trimmedMessage);
    });

    it('clears input after successful send when clearOnSend is true', async () => {
      const user = userEvent.setup();
      const message = 'Test message';

      render(<ChatInput onSend={mockOnSend} clearOnSend />);

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      const sendButton = screen.getByRole('button', { name: /send/i });

      await user.type(textarea, message);
      await user.click(sendButton);

      expect(textarea.value).toBe('');
    });

    it('does not clear input after send when clearOnSend is false', async () => {
      const user = userEvent.setup();
      const message = 'Test message';

      render(<ChatInput onSend={mockOnSend} clearOnSend={false} />);

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      const sendButton = screen.getByRole('button', { name: /send/i });

      await user.type(textarea, message);
      await user.click(sendButton);

      expect(textarea.value).toBe(message);
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('sends message on Enter key press', async () => {
      const user = userEvent.setup();
      const message = 'Test message';

      render(<ChatInput onSend={mockOnSend} />);

      const textarea = screen.getByRole('textbox');

      await user.type(textarea, message);
      await user.keyboard('{Enter}');

      expect(mockOnSend).toHaveBeenCalledWith(message);
    });

    it('does not send on Enter with empty message', async () => {
      const user = userEvent.setup();

      render(<ChatInput onSend={mockOnSend} />);

      const textarea = screen.getByRole('textbox');

      await user.click(textarea);
      await user.keyboard('{Enter}');

      expect(mockOnSend).not.toHaveBeenCalled();
    });

    it('creates new line on Shift+Enter', async () => {
      const user = userEvent.setup();

      render(<ChatInput onSend={mockOnSend} />);

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

      await user.type(textarea, 'Line 1');
      await user.keyboard('{Shift>}{Enter}{/Shift}');
      await user.type(textarea, 'Line 2');

      expect(textarea.value).toBe('Line 1\nLine 2');
      expect(mockOnSend).not.toHaveBeenCalled();
    });

    it('creates new line on Ctrl+Enter', async () => {
      const user = userEvent.setup();

      render(<ChatInput onSend={mockOnSend} />);

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

      // Type initial text
      await user.type(textarea, 'Line 1');

      // Use more explicit Ctrl+Enter syntax
      await user.keyboard('{Control>}{Enter}{/Control}');

      // Add second line of text
      await user.type(textarea, 'Line 2');

      // The textarea should contain both lines with newline
      expect(textarea.value).toBe('Line 1\nLine 2');
      expect(mockOnSend).not.toHaveBeenCalled();
    });

    it('prevents default Enter behavior when sending', async () => {
      const user = userEvent.setup();
      const message = 'Test message';

      render(<ChatInput onSend={mockOnSend} />);

      const textarea = screen.getByRole('textbox');

      await user.type(textarea, message);
      await user.keyboard('{Enter}');

      // Message should be sent and not create a new line
      expect(mockOnSend).toHaveBeenCalledWith(message);
      expect((textarea as HTMLTextAreaElement).value).not.toContain('\n');
    });
  });

  describe('Loading State', () => {
    it('disables send button when loading', () => {
      render(<ChatInput onSend={mockOnSend} loading />);

      const sendButton = screen.getByRole('button', { name: /send/i });
      expect(sendButton).toBeDisabled();
    });

    it('disables textarea when loading', () => {
      render(<ChatInput onSend={mockOnSend} loading />);

      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeDisabled();
    });

    it('shows loading state on send button when loading', () => {
      render(<ChatInput onSend={mockOnSend} loading />);

      const sendButton = screen.getByRole('button', { name: /send/i });
      expect(sendButton).toHaveClass('loading');
    });

    it('prevents keyboard shortcuts when loading', async () => {
      const user = userEvent.setup();

      render(<ChatInput onSend={mockOnSend} loading value="Test message" />);

      const textarea = screen.getByRole('textbox');
      await user.click(textarea);
      await user.keyboard('{Enter}');

      expect(mockOnSend).not.toHaveBeenCalled();
    });

    it('prevents send button click when loading', async () => {
      const user = userEvent.setup();

      render(<ChatInput onSend={mockOnSend} loading value="Test message" />);

      const sendButton = screen.getByRole('button', { name: /send/i });
      await user.click(sendButton);

      expect(mockOnSend).not.toHaveBeenCalled();
    });
  });

  describe('Character Counter', () => {
    it('shows character count', () => {
      render(<ChatInput onSend={mockOnSend} showCounter />);

      const counter = screen.getByText('0');
      expect(counter).toBeInTheDocument();
    });

    it('updates character count as user types', async () => {
      const user = userEvent.setup();
      const message = 'Hello';

      render(<ChatInput onSend={mockOnSend} showCounter />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, message);

      const counter = screen.getByText('5');
      expect(counter).toBeInTheDocument();
    });

    it('shows character limit when provided', () => {
      const maxLength = 100;
      render(<ChatInput onSend={mockOnSend} showCounter maxLength={maxLength} />);

      const counter = screen.getByText('0/100');
      expect(counter).toBeInTheDocument();
    });

    it('shows warning when approaching character limit', async () => {
      const user = userEvent.setup();
      const maxLength = 10;
      const message = '12345678'; // 8 chars, 80% of limit

      render(<ChatInput onSend={mockOnSend} showCounter maxLength={maxLength} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, message);

      const counter = screen.getByText('8/10');
      expect(counter).toHaveClass('warning'); // Assuming warning class for 80%+ usage
    });

    it('shows error when at character limit', async () => {
      const user = userEvent.setup();
      const maxLength = 5;
      const message = '12345'; // Exactly at limit

      render(<ChatInput onSend={mockOnSend} showCounter maxLength={maxLength} />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, message);

      const counter = screen.getByText('5/5');
      expect(counter).toHaveClass('error'); // Assuming error class for 100% usage
    });
  });

  describe('Clear Functionality', () => {
    it('calls onClear when clear button is clicked', async () => {
      const user = userEvent.setup();

      render(<ChatInput onSend={mockOnSend} onClear={mockOnClear} />);

      const textarea = screen.getByRole('textbox');
      const clearButton = screen.getByRole('button', { name: /clear/i });

      // Add some content so clear button is enabled
      await user.type(textarea, 'Test content');

      await user.click(clearButton);

      expect(mockOnClear).toHaveBeenCalledTimes(1);
    });

    it('clears textarea when clear button is clicked and no onClear provided', async () => {
      const user = userEvent.setup();
      const message = 'Test message';

      render(<ChatInput onSend={mockOnSend} />);

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      const clearButton = screen.getByRole('button', { name: /clear/i });

      await user.type(textarea, message);
      expect(textarea.value).toBe(message);

      await user.click(clearButton);
      expect(textarea.value).toBe('');
    });

    it('disables clear button when input is empty', () => {
      render(<ChatInput onSend={mockOnSend} />);

      const clearButton = screen.getByRole('button', { name: /clear/i });
      expect(clearButton).toBeDisabled();
    });

    it('enables clear button when input has content', async () => {
      const user = userEvent.setup();

      render(<ChatInput onSend={mockOnSend} />);

      const textarea = screen.getByRole('textbox');
      const clearButton = screen.getByRole('button', { name: /clear/i });

      expect(clearButton).toBeDisabled();

      await user.type(textarea, 'Test');
      expect(clearButton).not.toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(<ChatInput onSend={mockOnSend} />);

      const textarea = screen.getByRole('textbox');
      const sendButton = screen.getByRole('button', { name: /send/i });

      expect(textarea).toHaveAccessibleName();
      expect(sendButton).toHaveAccessibleName();
    });

    it('has proper keyboard navigation', async () => {
      const user = userEvent.setup();

      render(<ChatInput onSend={mockOnSend} onClear={mockOnClear} />);

      const textarea = screen.getByRole('textbox');
      const sendButton = screen.getByRole('button', { name: /send/i });

      // Textarea should already have focus due to auto-focus
      expect(textarea).toHaveFocus();

      // Add some content to enable clear button
      await user.type(textarea, 'Test content');

      const clearButton = screen.getByRole('button', { name: /clear/i });

      // Tab to next element should move to the clear button (now enabled)
      await user.tab();
      expect(clearButton).toHaveFocus();

      // Tab to next element should move to the send button
      await user.tab();
      expect(sendButton).toHaveFocus();
    });

    it('supports aria-label for textarea', () => {
      const ariaLabel = 'Chat message input';
      render(<ChatInput onSend={mockOnSend} ariaLabel={ariaLabel} />);

      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAccessibleName(ariaLabel);
    });

    it('indicates loading state to screen readers', () => {
      render(<ChatInput onSend={mockOnSend} loading />);

      const sendButton = screen.getByRole('button', { name: /send/i });
      expect(sendButton).toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('Edge Cases', () => {
    it('handles rapid key presses without breaking', async () => {
      const user = userEvent.setup();

      render(<ChatInput onSend={mockOnSend} />);

      const textarea = screen.getByRole('textbox');

      // Rapid typing
      await user.type(textarea, 'abc');
      await user.keyboard('{Enter}');
      await user.type(textarea, 'def');

      // Should handle gracefully without errors
      expect(mockOnSend).toHaveBeenCalledWith('abc');
    });

    it('handles paste events correctly', async () => {
      const user = userEvent.setup();
      const pasteText = 'Pasted content\nwith\nmultiple\nlines';

      render(<ChatInput onSend={mockOnSend} />);

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

      await user.click(textarea);
      await user.paste(pasteText);

      expect(textarea.value).toBe(pasteText);
    });

    it('handles controlled value changes', () => {
      const { rerender } = render(<ChatInput onSend={mockOnSend} value="Initial" />);

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.value).toBe('Initial');

      rerender(<ChatInput onSend={mockOnSend} value="Updated" />);
      expect(textarea.value).toBe('Updated');
    });

    it('prevents double submission', async () => {
      const user = userEvent.setup();
      const message = 'Test message';

      render(<ChatInput onSend={mockOnSend} />);

      const textarea = screen.getByRole('textbox');
      const sendButton = screen.getByRole('button', { name: /send/i });

      await user.type(textarea, message);

      // Rapid clicks should only send once
      await user.click(sendButton);
      await user.click(sendButton);

      expect(mockOnSend).toHaveBeenCalledTimes(1);
    });
  });

  describe('Custom Props', () => {
    it('forwards custom props to textarea', () => {
      render(
        <ChatInput onSend={mockOnSend} data-testid="custom-textarea" minRows={3} maxRows={8} />
      );

      const textarea = screen.getByTestId('custom-textarea');
      expect(textarea).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const customClass = 'custom-chat-input';
      render(<ChatInput onSend={mockOnSend} className={customClass} />);

      // Should find an element with the custom class
      const container = document.querySelector(`.${customClass}`);
      expect(container).toBeInTheDocument();
    });

    it('handles custom button labels', () => {
      render(<ChatInput onSend={mockOnSend} sendButtonLabel="Submit" clearButtonLabel="Reset" />);

      const sendButton = screen.getByRole('button', { name: /submit/i });
      const clearButton = screen.getByRole('button', { name: /reset/i });

      expect(sendButton).toBeInTheDocument();
      expect(clearButton).toBeInTheDocument();
    });
  });
});
