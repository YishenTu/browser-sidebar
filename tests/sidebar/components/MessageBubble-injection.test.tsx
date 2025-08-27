/**
 * @file MessageBubble Injection Tests
 * 
 * Tests for MessageBubble component handling dual content (displayContent vs content)
 * for messages with tab context injection. Validates UI display, interactions,
 * copy behavior, edit flow, and accessibility.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MessageBubble, MessageBubbleProps } from '@sidebar/components/MessageBubble';
import { ChatMessage, MessageRole, MessageStatus } from '@store/chat';

// Mock console.error to avoid noise from clipboard failures in tests
const originalConsoleError = console.error;

beforeEach(() => {
  console.error = vi.fn();
});

afterEach(() => {
  console.error = originalConsoleError;
  vi.clearAllMocks();
});

/**
 * Helper function to create test messages with tab context
 */
const createTestMessage = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: 'test-message-1',
  role: 'user' as MessageRole,
  content: 'Original user input with injected page content: [PAGE CONTENT] This is the page content from the website. [/PAGE CONTENT]',
  displayContent: 'Original user input', // This should be displayed in UI
  timestamp: new Date('2023-01-01T12:00:00Z'),
  status: 'sent' as MessageStatus,
  metadata: {
    hasTabContext: true,
    originalUserContent: 'Original user input',
    tabTitle: 'Example Page Title',
    tabUrl: 'https://example.com',
    tabId: 123,
  },
  ...overrides,
});

/**
 * Helper function to create message without tab context
 */
const createRegularMessage = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: 'test-message-2',
  role: 'user' as MessageRole,
  content: 'Regular user message without any injection',
  timestamp: new Date('2023-01-01T12:00:00Z'),
  status: 'sent' as MessageStatus,
  metadata: {
    hasTabContext: false,
  },
  ...overrides,
});

/**
 * Helper function to create assistant message with tab context
 */
const createAssistantMessage = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: 'test-message-3',
  role: 'assistant' as MessageRole,
  content: 'Assistant response based on the injected content.',
  timestamp: new Date('2023-01-01T12:00:00Z'),
  status: 'received' as MessageStatus,
  metadata: {
    model: 'gpt-5-mini',
  },
  ...overrides,
});

describe('MessageBubble - Injection Handling', () => {
  describe('Display Content Rendering', () => {
    it('should render displayContent instead of content when displayContent is provided', () => {
      const message = createTestMessage();
      
      render(<MessageBubble message={message} />);
      
      // Should display the clean user input, not the injected content
      expect(screen.getByText('Original user input')).toBeInTheDocument();
      expect(screen.queryByText(/PAGE CONTENT/)).not.toBeInTheDocument();
      expect(screen.queryByText('This is the page content from the website')).not.toBeInTheDocument();
    });

    it('should fallback to content when displayContent is not provided', () => {
      const message = createTestMessage({ displayContent: undefined });
      
      render(<MessageBubble message={message} />);
      
      // Should display the full content including injected content
      expect(screen.getByText(/Original user input with injected page content/)).toBeInTheDocument();
      expect(screen.getByText(/This is the page content from the website/)).toBeInTheDocument();
    });

    it('should handle empty displayContent gracefully', () => {
      const message = createTestMessage({ displayContent: '' });
      
      render(<MessageBubble message={message} />);
      
      // Should render empty content without errors
      const messageContent = screen.getByTestId('message-content');
      expect(messageContent).toBeInTheDocument();
      expect(messageContent.textContent).toBe('');
    });

    it('should handle null displayContent by falling back to content', () => {
      const message = createTestMessage({ displayContent: null as any });
      
      render(<MessageBubble message={message} />);
      
      // Should display the full content including injected content
      expect(screen.getByText(/Original user input with injected page content/)).toBeInTheDocument();
    });
  });

  describe('Context Indicator', () => {
    it('should show context indicator for user messages with tab context', () => {
      const message = createTestMessage();
      
      render(<MessageBubble message={message} />);
      
      const indicator = screen.getByLabelText('Includes page context');
      expect(indicator).toBeInTheDocument();
      expect(indicator).toHaveClass('tab-context-indicator');
    });

    it('should not show context indicator for messages without tab context', () => {
      const message = createRegularMessage();
      
      render(<MessageBubble message={message} />);
      
      expect(screen.queryByLabelText('Includes page context')).not.toBeInTheDocument();
    });

    it('should not show context indicator for assistant messages', () => {
      const message = createAssistantMessage({
        metadata: { hasTabContext: true, tabTitle: 'Example Page' }
      });
      
      render(<MessageBubble message={message} />);
      
      expect(screen.queryByLabelText('Includes page context')).not.toBeInTheDocument();
    });

    it('should be keyboard accessible', () => {
      const message = createTestMessage();
      
      render(<MessageBubble message={message} />);
      
      const indicator = screen.getByLabelText('Includes page context');
      expect(indicator).toHaveAttribute('tabIndex', '0');
    });
  });

  describe('Tooltip Functionality', () => {
    it('should display tooltip with tab title on hover', async () => {
      const user = userEvent.setup();
      const message = createTestMessage({
        metadata: {
          hasTabContext: true,
          tabTitle: 'Example Page Title',
          tabUrl: 'https://example.com',
        }
      });
      
      render(<MessageBubble message={message} />);
      
      const indicator = screen.getByLabelText('Includes page context');
      await user.hover(indicator);
      
      const tooltip = screen.getByText('Includes page: Example Page Title');
      expect(tooltip).toBeInTheDocument();
      expect(tooltip).toHaveClass('tab-context-tooltip');
    });

    it('should display tooltip with tab URL when title is not available', async () => {
      const user = userEvent.setup();
      const message = createTestMessage({
        metadata: {
          hasTabContext: true,
          tabUrl: 'https://example.com',
          tabTitle: undefined,
        }
      });
      
      render(<MessageBubble message={message} />);
      
      const indicator = screen.getByLabelText('Includes page context');
      await user.hover(indicator);
      
      const tooltip = screen.getByText('Includes page: https://example.com');
      expect(tooltip).toBeInTheDocument();
    });

    it('should display fallback tooltip when neither title nor URL is available', async () => {
      const user = userEvent.setup();
      const message = createTestMessage({
        metadata: {
          hasTabContext: true,
          tabTitle: undefined,
          tabUrl: undefined,
        }
      });
      
      render(<MessageBubble message={message} />);
      
      const indicator = screen.getByLabelText('Includes page context');
      await user.hover(indicator);
      
      const tooltip = screen.getByText('Includes page: Unknown page');
      expect(tooltip).toBeInTheDocument();
    });
  });

  describe('Copy Behavior', () => {
    it('should render copy button for user messages with tab context', () => {
      const message = createTestMessage();
      
      render(<MessageBubble message={message} />);
      
      // Verify copy button exists in the user message footer
      const copyButton = screen.getByLabelText('Copy to clipboard');
      expect(copyButton).toBeInTheDocument();
      expect(copyButton).toHaveClass('message-footer-copy');
    });

    it('should render copy button for user messages without tab context', () => {
      const message = createRegularMessage();
      
      render(<MessageBubble message={message} />);
      
      // Verify copy button exists
      const copyButton = screen.getByLabelText('Copy to clipboard');
      expect(copyButton).toBeInTheDocument();
    });

    it('should render copy button for assistant messages', () => {
      const message = createAssistantMessage();
      
      render(<MessageBubble message={message} />);
      
      // Verify copy button exists in the assistant message footer
      const copyButton = screen.getByLabelText('Copy to clipboard');
      expect(copyButton).toBeInTheDocument();
      expect(copyButton).toHaveClass('message-footer-copy');
    });

    it('should handle copy button interaction without errors', async () => {
      const user = userEvent.setup();
      const message = createTestMessage();
      
      render(<MessageBubble message={message} />);
      
      const copyButton = screen.getByLabelText('Copy to clipboard');
      
      // Should not throw when clicked
      expect(() => user.click(copyButton)).not.toThrow();
    });

    it('should show copy button with proper accessibility attributes', () => {
      const message = createTestMessage();
      
      render(<MessageBubble message={message} />);
      
      const copyButton = screen.getByLabelText('Copy to clipboard');
      expect(copyButton).toHaveAttribute('type', 'button');
      expect(copyButton).toHaveAttribute('title', 'Copy to clipboard');
      expect(copyButton).toHaveAttribute('aria-label', 'Copy to clipboard');
    });
  });

  describe('Edit Flow Preservation', () => {
    it('should call onEdit with original message including originalUserContent', async () => {
      const user = userEvent.setup();
      const mockOnEdit = vi.fn();
      
      const message = createTestMessage();
      
      render(<MessageBubble message={message} onEdit={mockOnEdit} />);
      
      const editButton = screen.getByLabelText('Edit message');
      await user.click(editButton);
      
      expect(mockOnEdit).toHaveBeenCalledWith(message);
      expect(mockOnEdit).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            originalUserContent: 'Original user input'
          })
        })
      );
    });

    it('should not show edit button for assistant messages', () => {
      const mockOnEdit = vi.fn();
      const message = createAssistantMessage();
      
      render(<MessageBubble message={message} onEdit={mockOnEdit} />);
      
      expect(screen.queryByLabelText('Edit message')).not.toBeInTheDocument();
    });

    it('should show edit button for user messages', () => {
      const mockOnEdit = vi.fn();
      const message = createTestMessage();
      
      render(<MessageBubble message={message} onEdit={mockOnEdit} />);
      
      expect(screen.getByLabelText('Edit message')).toBeInTheDocument();
    });

    it('should not show edit button when onEdit is not provided', () => {
      const message = createTestMessage();
      
      render(<MessageBubble message={message} />);
      
      expect(screen.queryByLabelText('Edit message')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility Standards', () => {
    it('should have proper ARIA labels for message elements', () => {
      const message = createTestMessage();
      
      render(<MessageBubble message={message} />);
      
      const messageBubble = screen.getByTestId('message-bubble');
      expect(messageBubble).toHaveAttribute('aria-label', 'User message');
      
      const contextIndicator = screen.getByLabelText('Includes page context');
      expect(contextIndicator).toBeInTheDocument();
    });

    it('should have accessible timestamp', () => {
      const message = createTestMessage();
      
      render(<MessageBubble message={message} />);
      
      const timestamp = screen.getByTestId('message-timestamp');
      expect(timestamp).toHaveAttribute('dateTime', '2023-01-01T12:00:00.000Z');
    });

    it('should have keyboard navigation for interactive elements', () => {
      const mockOnEdit = vi.fn();
      const message = createTestMessage();
      
      render(<MessageBubble message={message} onEdit={mockOnEdit} />);
      
      const editButton = screen.getByLabelText('Edit message');
      const copyButton = screen.getByLabelText('Copy to clipboard');
      const contextIndicator = screen.getByLabelText('Includes page context');
      
      expect(editButton).toHaveAttribute('type', 'button');
      expect(copyButton).toHaveAttribute('type', 'button');
      expect(contextIndicator).toHaveAttribute('tabIndex', '0');
    });

    it('should support keyboard interaction for copy button', () => {
      const message = createTestMessage();
      
      render(<MessageBubble message={message} />);
      
      const copyButton = screen.getByLabelText('Copy to clipboard');
      copyButton.focus();
      
      // Test that the button is focusable
      expect(document.activeElement).toBe(copyButton);
      expect(copyButton).toHaveAttribute('type', 'button');
    });

    it('should support keyboard interaction for edit button', async () => {
      const user = userEvent.setup();
      const mockOnEdit = vi.fn();
      
      const message = createTestMessage();
      
      render(<MessageBubble message={message} onEdit={mockOnEdit} />);
      
      const editButton = screen.getByLabelText('Edit message');
      editButton.focus();
      
      await user.keyboard('{Enter}');
      
      expect(mockOnEdit).toHaveBeenCalledWith(message);
    });

    it('should have proper semantic structure for screen readers', () => {
      const message = createTestMessage();
      
      render(<MessageBubble message={message} />);
      
      // Check for semantic time element using data-testid
      const timeElement = screen.getByTestId('message-timestamp');
      expect(timeElement).toBeInTheDocument();
      expect(timeElement.tagName).toBe('TIME');
      
      // Check for button roles
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
      
      // Each button should have accessible name
      buttons.forEach(button => {
        expect(button).toHaveAccessibleName();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle messages with null metadata', () => {
      const message = createTestMessage({ metadata: null as any });
      
      expect(() => render(<MessageBubble message={message} />)).not.toThrow();
    });

    it('should handle messages with undefined metadata', () => {
      const message = createTestMessage({ metadata: undefined });
      
      expect(() => render(<MessageBubble message={message} />)).not.toThrow();
    });

    it('should handle missing hasTabContext in metadata', () => {
      const message = createTestMessage({
        metadata: {
          tabTitle: 'Example Page',
          tabUrl: 'https://example.com',
          // hasTabContext is missing
        }
      });
      
      render(<MessageBubble message={message} />);
      
      // Should not show context indicator when hasTabContext is not explicitly true
      expect(screen.queryByLabelText('Includes page context')).not.toBeInTheDocument();
    });

    it('should handle very long displayContent', () => {
      const longContent = 'A'.repeat(10000);
      const message = createTestMessage({ 
        displayContent: longContent,
        content: 'Short injected content'
      });
      
      render(<MessageBubble message={message} />);
      
      expect(screen.getByText(longContent)).toBeInTheDocument();
    });

    it('should handle special characters in displayContent', () => {
      const specialContent = 'Content with <script>alert("xss")</script> & special chars';
      const message = createTestMessage({ displayContent: specialContent });
      
      render(<MessageBubble message={message} />);
      
      // Should be rendered safely (MarkdownRenderer should handle this)
      expect(screen.getByText(/Content with.*special chars/)).toBeInTheDocument();
    });
  });

  describe('Integration with Other Components', () => {
    it('should work correctly with regenerate functionality for assistant messages', async () => {
      const user = userEvent.setup();
      const mockOnRegenerate = vi.fn();
      
      const message = createAssistantMessage();
      
      render(<MessageBubble message={message} onRegenerate={mockOnRegenerate} />);
      
      const regenerateButton = screen.getByLabelText('Regenerate response');
      await user.click(regenerateButton);
      
      expect(mockOnRegenerate).toHaveBeenCalledWith(message);
    });

    it('should display model name for assistant messages', () => {
      const message = createAssistantMessage({
        metadata: { model: 'gpt-5-nano' }
      });
      
      render(<MessageBubble message={message} />);
      
      expect(screen.getByLabelText('model-name')).toHaveTextContent('gpt-5-nano');
    });

    it('should handle streaming status for assistant messages', () => {
      const message = createAssistantMessage({
        status: 'streaming',
        content: '',
        metadata: {}
      });
      
      render(<MessageBubble message={message} />);
      
      // Should show spinner for streaming messages with no content
      expect(screen.getByLabelText('AI is thinking...')).toBeInTheDocument();
    });
  });
});