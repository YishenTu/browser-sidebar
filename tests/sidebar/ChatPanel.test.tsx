/**
 * @file ChatPanel Component Tests
 *
 * Main test suite for the unified ChatPanel component that merges
 * Sidebar.tsx and the existing ChatPanel.tsx functionality.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { ChatPanel } from '@/sidebar/ChatPanel';
import { unmountSidebar } from '@/sidebar/index';

// Mock the unmountSidebar function
vi.mock('@/sidebar/index', () => ({
  unmountSidebar: vi.fn(),
}));

// Mock chrome runtime
Object.defineProperty(global, 'chrome', {
  value: {
    runtime: {
      sendMessage: vi.fn(),
    },
  },
  writable: true,
});

// Mock window dimensions
Object.defineProperty(window, 'innerWidth', {
  writable: true,
  configurable: true,
  value: 1200,
});

Object.defineProperty(window, 'innerHeight', {
  writable: true,
  configurable: true,
  value: 800,
});

describe('ChatPanel', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset window dimensions
    Object.defineProperty(window, 'innerWidth', { value: 1200 });
    Object.defineProperty(window, 'innerHeight', { value: 800 });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders with required props', () => {
      render(<ChatPanel onClose={mockOnClose} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByLabelText('AI Browser Sidebar')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<ChatPanel onClose={mockOnClose} className="custom-class" />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveClass('custom-class');
    });

    it('renders with default title "AI Assistant"', () => {
      render(<ChatPanel onClose={mockOnClose} />);

      expect(screen.getByText('AI Assistant')).toBeInTheDocument();
    });

    it('renders header with close button', () => {
      render(<ChatPanel onClose={mockOnClose} />);

      const closeButton = screen.getByLabelText('Close sidebar');
      expect(closeButton).toBeInTheDocument();
      expect(closeButton).toHaveTextContent('×');
    });

    it('renders message list container', () => {
      render(<ChatPanel onClose={mockOnClose} />);

      // Check for the message list area
      expect(screen.getByText('Start a conversation about this webpage')).toBeInTheDocument();
    });

    it('renders chat input', () => {
      render(<ChatPanel onClose={mockOnClose} />);

      const input = screen.getByPlaceholderText('Ask about this webpage...');
      expect(input).toBeInTheDocument();
    });
  });

  describe('Overlay Positioning', () => {
    it('renders as fixed positioned overlay', () => {
      render(<ChatPanel onClose={mockOnClose} />);

      const overlay = screen.getByRole('dialog');
      expect(overlay).toHaveClass('ai-sidebar-overlay');

      // Check for fixed positioning styles
      const styles = window.getComputedStyle(overlay);
      expect(overlay).toHaveStyle({ position: 'fixed' });
    });

    it('has high z-index for overlay behavior', () => {
      render(<ChatPanel onClose={mockOnClose} />);

      const overlay = screen.getByRole('dialog');
      // Note: The z-index is applied via CSS class, we check the class exists
      expect(overlay).toHaveClass('ai-sidebar-overlay');
    });

    it('positions correctly with default dimensions', () => {
      render(<ChatPanel onClose={mockOnClose} />);

      const overlay = screen.getByRole('dialog');

      // Default width is 400px, positioned at right edge
      // Default height is 85% of viewport (680px), centered vertically
      expect(overlay).toHaveStyle({
        left: '800px', // 1200 - 400
        top: '60px', // (800 * 0.15) / 2
        width: '400px',
        height: '680px', // 800 * 0.85
      });
    });

    it('calculates correct vertical centering', () => {
      // Test with different window height
      Object.defineProperty(window, 'innerHeight', { value: 1000 });

      render(<ChatPanel onClose={mockOnClose} />);

      const overlay = screen.getByRole('dialog');

      // Height should be 85% = 850px
      // Top should be (1000 * 0.15) / 2 = 75px
      expect(overlay).toHaveStyle({
        height: '850px',
        top: '75px',
      });
    });
  });

  describe('Close Functionality', () => {
    it('calls onClose when close button is clicked', async () => {
      const user = userEvent.setup();
      render(<ChatPanel onClose={mockOnClose} />);

      const closeButton = screen.getByLabelText('Close sidebar');
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('calls unmountSidebar when close button is clicked', async () => {
      const user = userEvent.setup();
      render(<ChatPanel onClose={mockOnClose} />);

      const closeButton = screen.getByLabelText('Close sidebar');
      await user.click(closeButton);

      expect(unmountSidebar).toHaveBeenCalledTimes(1);
    });

    it('sends chrome runtime message on close', async () => {
      const user = userEvent.setup();
      render(<ChatPanel onClose={mockOnClose} />);

      const closeButton = screen.getByLabelText('Close sidebar');
      await user.click(closeButton);

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'sidebar-closed',
      });
    });

    it('closes on Escape key press', async () => {
      render(<ChatPanel onClose={mockOnClose} />);

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(mockOnClose).toHaveBeenCalledTimes(1);
      expect(unmountSidebar).toHaveBeenCalledTimes(1);
    });

    it('ignores other key presses', async () => {
      render(<ChatPanel onClose={mockOnClose} />);

      fireEvent.keyDown(document, { key: 'Enter' });
      fireEvent.keyDown(document, { key: 'Space' });

      expect(mockOnClose).not.toHaveBeenCalled();
      expect(unmountSidebar).not.toHaveBeenCalled();
    });
  });

  describe('Resize Handle', () => {
    it('renders resize handle', () => {
      render(<ChatPanel onClose={mockOnClose} />);

      const resizeHandle = screen.getByTestId('resize-handle');
      expect(resizeHandle).toBeInTheDocument();
      expect(resizeHandle).toHaveClass('ai-sidebar-resize-handle');
    });

    it('has correct cursor style on resize handle', () => {
      render(<ChatPanel onClose={mockOnClose} />);

      const resizeHandle = screen.getByTestId('resize-handle');
      expect(resizeHandle).toHaveStyle({ cursor: 'ew-resize' });
    });
  });

  describe('Header Interactions', () => {
    it('has correct cursor style for draggable header', () => {
      render(<ChatPanel onClose={mockOnClose} />);

      const header = screen.getByTestId('sidebar-header');
      expect(header).toHaveStyle({ cursor: 'grab' });
    });

    it('shows clear conversation button when messages exist', async () => {
      render(<ChatPanel onClose={mockOnClose} />);

      // Send a message to create messages
      const input = screen.getByPlaceholderText('Ask about this webpage...');
      const sendButton = screen.getByLabelText('Send message');

      await userEvent.type(input, 'Test message');
      await userEvent.click(sendButton);

      // Wait for the clear button to appear
      await waitFor(() => {
        const clearButton = screen.getByLabelText('Clear conversation');
        expect(clearButton).toBeInTheDocument();
      });
    });

    it('does not show clear button when no messages', () => {
      render(<ChatPanel onClose={mockOnClose} />);

      const clearButton = screen.queryByLabelText('Clear conversation');
      expect(clearButton).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has correct ARIA attributes', () => {
      render(<ChatPanel onClose={mockOnClose} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-label', 'AI Browser Sidebar');
      expect(dialog).toHaveAttribute('aria-modal', 'false');
    });

    it('sets tabindex for keyboard navigation', () => {
      render(<ChatPanel onClose={mockOnClose} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('tabindex', '-1');
    });

    it('focuses sidebar when mounted', () => {
      render(<ChatPanel onClose={mockOnClose} />);

      const dialog = screen.getByRole('dialog');
      expect(document.activeElement).toBe(dialog);
    });

    it('has proper button labels', () => {
      render(<ChatPanel onClose={mockOnClose} />);

      expect(screen.getByLabelText('Close sidebar')).toBeInTheDocument();
      expect(screen.getByTitle('Close (Esc)')).toBeInTheDocument();
    });
  });

  describe('Chat Integration', () => {
    it('integrates with chat store for messages', async () => {
      render(<ChatPanel onClose={mockOnClose} />);

      const input = screen.getByPlaceholderText('Ask about this webpage...');
      const sendButton = screen.getByLabelText('Send message');

      await userEvent.type(input, 'Hello');
      await userEvent.click(sendButton);

      // Should show the user message
      await waitFor(() => {
        expect(screen.getByText('Hello')).toBeInTheDocument();
      });
    });

    it('shows loading state during message generation', async () => {
      render(<ChatPanel onClose={mockOnClose} />);

      const input = screen.getByPlaceholderText('Ask about this webpage...');
      const sendButton = screen.getByLabelText('Send message');

      await userEvent.type(input, 'Test');
      await userEvent.click(sendButton);

      // Should show typing indicator during loading
      await waitFor(() => {
        expect(screen.getByTestId('typing-indicator')).toBeInTheDocument();
      });
    });
  });

  describe('Theme Integration', () => {
    it('renders ThemeProvider wrapper', () => {
      render(<ChatPanel onClose={mockOnClose} />);

      // The theme provider should wrap the body and footer content
      const body = screen.getByTestId('sidebar-body');
      const footer = screen.getByTestId('sidebar-footer');

      expect(body).toBeInTheDocument();
      expect(footer).toBeInTheDocument();
    });
  });

  describe('Component Structure', () => {
    it('has correct layout structure', () => {
      render(<ChatPanel onClose={mockOnClose} />);

      // Main overlay container
      const overlay = screen.getByRole('dialog');
      expect(overlay).toHaveClass('ai-sidebar-overlay');

      // Resize handle
      expect(screen.getByTestId('resize-handle')).toBeInTheDocument();

      // Main container
      const container = screen.getByTestId('sidebar-container');
      expect(container).toBeInTheDocument();

      // Header
      const header = screen.getByTestId('sidebar-header');
      expect(header).toBeInTheDocument();

      // Body and Footer
      expect(screen.getByTestId('sidebar-body')).toBeInTheDocument();
      expect(screen.getByTestId('sidebar-footer')).toBeInTheDocument();
    });

    it('maintains correct component hierarchy', () => {
      render(<ChatPanel onClose={mockOnClose} />);

      const overlay = screen.getByRole('dialog');
      const container = screen.getByTestId('sidebar-container');

      expect(overlay).toContainElement(container);
    });
  });
});
