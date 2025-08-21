import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { render, userEvent } from '@tests/utils/test-utils';
import { IconButton } from '@/sidebar/components/ui/IconButton';

// Mock icons for testing
const MockIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className }) => (
  <svg
    width={size}
    height={size}
    className={className}
    data-testid="mock-icon"
    role="img"
    aria-label="mock icon"
  >
    <circle cx={size / 2} cy={size / 2} r={size / 4} fill="currentColor" />
  </svg>
);

const CloseIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className }) => (
  <svg
    width={size}
    height={size}
    className={className}
    data-testid="close-icon"
    role="img"
    aria-label="close icon"
  >
    <path d="M6 6l6 6M6 12l6-6" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const SendIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className }) => (
  <svg
    width={size}
    height={size}
    className={className}
    data-testid="send-icon"
    role="img"
    aria-label="send icon"
  >
    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" fill="currentColor" />
  </svg>
);

describe('IconButton', () => {
  describe('Basic Rendering', () => {
    it('renders icon button with icon', () => {
      render(<IconButton icon={<MockIcon />} aria-label="test button" />);

      const button = screen.getByRole('button', { name: 'test button' });
      const icon = screen.getByTestId('mock-icon');

      expect(button).toBeInTheDocument();
      expect(icon).toBeInTheDocument();
      expect(button).toContainElement(icon);
    });

    it('renders with children as icon when no icon prop provided', () => {
      render(
        <IconButton aria-label="test button">
          <MockIcon />
        </IconButton>
      );

      const button = screen.getByRole('button', { name: 'test button' });
      const icon = screen.getByTestId('mock-icon');

      expect(button).toBeInTheDocument();
      expect(icon).toBeInTheDocument();
      expect(button).toContainElement(icon);
    });

    it('prioritizes icon prop over children', () => {
      render(
        <IconButton icon={<CloseIcon />} aria-label="test button">
          <MockIcon />
        </IconButton>
      );

      const button = screen.getByRole('button', { name: 'test button' });
      const closeIcon = screen.getByTestId('close-icon');
      const mockIcon = screen.queryByTestId('mock-icon');

      expect(button).toContainElement(closeIcon);
      expect(mockIcon).not.toBeInTheDocument();
    });
  });

  describe('Click Handling', () => {
    it('calls onClick handler when clicked', async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();

      render(<IconButton icon={<MockIcon />} onClick={handleClick} aria-label="test button" />);

      const button = screen.getByRole('button', { name: 'test button' });
      await user.click(button);

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('does not call onClick when disabled', async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();

      render(
        <IconButton icon={<MockIcon />} onClick={handleClick} disabled aria-label="test button" />
      );

      const button = screen.getByRole('button', { name: 'test button' });
      await user.click(button);

      expect(handleClick).not.toHaveBeenCalled();
    });

    it('does not call onClick when loading', async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();

      render(
        <IconButton icon={<MockIcon />} onClick={handleClick} loading aria-label="test button" />
      );

      const button = screen.getByRole('button', { name: 'test button' });
      await user.click(button);

      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('Tooltip', () => {
    it('shows tooltip on hover when tooltip prop provided', async () => {
      const user = userEvent.setup();

      render(<IconButton icon={<MockIcon />} tooltip="Close dialog" aria-label="test button" />);

      const button = screen.getByRole('button', { name: 'test button' });
      await user.hover(button);

      await waitFor(() => {
        expect(screen.getByText('Close dialog')).toBeInTheDocument();
      });
    });

    it('shows tooltip with custom delay', async () => {
      const user = userEvent.setup();

      render(
        <IconButton
          icon={<MockIcon />}
          tooltip="Close dialog"
          tooltipDelay={100}
          aria-label="test button"
        />
      );

      const button = screen.getByRole('button', { name: 'test button' });
      await user.hover(button);

      // Should not show immediately
      expect(screen.queryByText('Close dialog')).not.toBeInTheDocument();

      // Should show after delay
      await waitFor(
        () => {
          expect(screen.getByText('Close dialog')).toBeInTheDocument();
        },
        { timeout: 200 }
      );
    });

    it('hides tooltip on mouse leave', async () => {
      const user = userEvent.setup();

      render(<IconButton icon={<MockIcon />} tooltip="Close dialog" aria-label="test button" />);

      const button = screen.getByRole('button', { name: 'test button' });
      await user.hover(button);

      await waitFor(() => {
        expect(screen.getByText('Close dialog')).toBeInTheDocument();
      });

      await user.unhover(button);

      await waitFor(() => {
        expect(screen.queryByText('Close dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('Sizes', () => {
    it.each([
      ['sm', 'small'],
      ['md', 'medium'],
      ['lg', 'large'],
    ])('renders %s size correctly', (size, _expectedLabel) => {
      render(
        <IconButton
          icon={<MockIcon />}
          size={size as 'sm' | 'md' | 'lg'}
          aria-label="test button"
        />
      );

      const button = screen.getByRole('button', { name: 'test button' });
      expect(button).toHaveClass(`icon-button--${size}`);
    });

    it('defaults to md size when no size provided', () => {
      render(<IconButton icon={<MockIcon />} aria-label="test button" />);

      const button = screen.getByRole('button', { name: 'test button' });
      expect(button).toHaveClass('icon-button--md');
    });
  });

  describe('Variants', () => {
    it.each([['primary'], ['secondary'], ['ghost']])('renders %s variant correctly', variant => {
      render(
        <IconButton
          icon={<MockIcon />}
          variant={variant as 'primary' | 'secondary' | 'ghost'}
          aria-label="test button"
        />
      );

      const button = screen.getByRole('button', { name: 'test button' });
      expect(button).toHaveClass(`icon-button--${variant}`);
    });

    it('defaults to secondary variant when no variant provided', () => {
      render(<IconButton icon={<MockIcon />} aria-label="test button" />);

      const button = screen.getByRole('button', { name: 'test button' });
      expect(button).toHaveClass('icon-button--secondary');
    });
  });

  describe('Shape', () => {
    it('renders circular shape by default', () => {
      render(<IconButton icon={<MockIcon />} aria-label="test button" />);

      const button = screen.getByRole('button', { name: 'test button' });
      expect(button).toHaveClass('icon-button--circular');
    });

    it('renders square shape when specified', () => {
      render(<IconButton icon={<MockIcon />} shape="square" aria-label="test button" />);

      const button = screen.getByRole('button', { name: 'test button' });
      expect(button).toHaveClass('icon-button--square');
    });
  });

  describe('States', () => {
    it('applies disabled styles when disabled', () => {
      render(<IconButton icon={<MockIcon />} disabled aria-label="test button" />);

      const button = screen.getByRole('button', { name: 'test button' });
      expect(button).toBeDisabled();
      expect(button).toHaveClass('icon-button--disabled');
    });

    it('shows loading spinner when loading', () => {
      render(<IconButton icon={<MockIcon />} loading aria-label="test button" />);

      const button = screen.getByRole('button', { name: 'test button' });
      const spinner = screen.getByTestId('icon-button-spinner');
      const icon = screen.queryByTestId('mock-icon');

      expect(button).toHaveClass('icon-button--loading');
      expect(spinner).toBeInTheDocument();
      expect(icon).not.toBeInTheDocument();
    });

    it('is disabled when loading', () => {
      render(<IconButton icon={<MockIcon />} loading aria-label="test button" />);

      const button = screen.getByRole('button', { name: 'test button' });
      expect(button).toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA label', () => {
      render(<IconButton icon={<MockIcon />} aria-label="Close dialog" />);

      const button = screen.getByRole('button', { name: 'Close dialog' });
      expect(button).toHaveAttribute('aria-label', 'Close dialog');
    });

    it('supports keyboard navigation', async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();

      render(<IconButton icon={<MockIcon />} onClick={handleClick} aria-label="test button" />);

      const button = screen.getByRole('button', { name: 'test button' });

      // Focus the button
      await user.tab();
      expect(button).toHaveFocus();

      // Press Enter
      await user.keyboard('{Enter}');
      expect(handleClick).toHaveBeenCalledTimes(1);

      // Press Space
      await user.keyboard(' ');
      expect(handleClick).toHaveBeenCalledTimes(2);
    });

    it('supports aria-describedby for additional context', () => {
      render(
        <div>
          <IconButton icon={<MockIcon />} aria-label="Delete" aria-describedby="delete-help" />
          <div id="delete-help">This action cannot be undone</div>
        </div>
      );

      const button = screen.getByRole('button', { name: 'Delete' });
      expect(button).toHaveAttribute('aria-describedby', 'delete-help');
    });

    it('has correct role and button semantics', () => {
      render(<IconButton icon={<MockIcon />} aria-label="test button" />);

      const button = screen.getByRole('button', { name: 'test button' });
      expect(button).toHaveAttribute('type', 'button');
    });
  });

  describe('Custom Styling', () => {
    it('accepts custom className', () => {
      render(<IconButton icon={<MockIcon />} className="custom-class" aria-label="test button" />);

      const button = screen.getByRole('button', { name: 'test button' });
      expect(button).toHaveClass('custom-class');
      expect(button).toHaveClass('icon-button'); // Base class should still be there
    });

    it('accepts custom style object', () => {
      render(
        <IconButton
          icon={<MockIcon />}
          style={{ border: '2px solid red' }}
          aria-label="test button"
        />
      );

      const button = screen.getByRole('button', { name: 'test button' });
      expect(button).toHaveStyle({ border: '2px solid red' });
    });
  });

  describe('Forward Ref', () => {
    it('forwards ref to button element', () => {
      const ref = React.createRef<HTMLButtonElement>();

      render(<IconButton ref={ref} icon={<MockIcon />} aria-label="test button" />);

      expect(ref.current).toBeInstanceOf(HTMLButtonElement);
      expect(ref.current).toBe(screen.getByRole('button', { name: 'test button' }));
    });
  });

  describe('Integration Examples', () => {
    it('works as close button', async () => {
      const handleClose = vi.fn();
      const user = userEvent.setup();

      render(
        <IconButton
          icon={<CloseIcon />}
          onClick={handleClose}
          variant="ghost"
          size="sm"
          tooltip="Close"
          aria-label="Close dialog"
        />
      );

      const button = screen.getByRole('button', { name: 'Close dialog' });
      expect(button).toHaveClass('icon-button--ghost', 'icon-button--sm');

      await user.click(button);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('works as send button with loading state', () => {
      render(
        <IconButton
          icon={<SendIcon />}
          variant="primary"
          size="md"
          loading={true}
          tooltip="Send message"
          aria-label="Send message"
        />
      );

      const button = screen.getByRole('button', { name: 'Send message' });
      expect(button).toHaveClass('icon-button--primary', 'icon-button--md', 'icon-button--loading');
      expect(button).toBeDisabled();
      expect(screen.getByTestId('icon-button-spinner')).toBeInTheDocument();
      expect(screen.queryByTestId('send-icon')).not.toBeInTheDocument();
    });
  });
});
