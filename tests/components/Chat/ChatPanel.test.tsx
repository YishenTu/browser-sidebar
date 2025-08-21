/**
 * @file ChatPanel Component Tests
 *
 * Comprehensive test suite for the ChatPanel component following TDD principles.
 * Tests layout structure, responsive behavior, and component integration.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { ChatPanel } from '@/sidebar/ChatPanel';
import { useChatStore } from '@/store/chat';
import { useSettingsStore } from '@/store/settings';
import type { ChatMessage } from '@/store/chat';

// Mock the stores
vi.mock('@/store/chat');
vi.mock('@/store/settings');

const mockUseChatStore = useChatStore as unknown as vi.Mock;
const mockUseSettingsStore = useSettingsStore as unknown as vi.Mock;

// Mock message data
const mockMessages: ChatMessage[] = [
  {
    id: 'msg-1',
    role: 'user',
    content: 'Hello, how are you?',
    timestamp: new Date('2024-01-15T10:00:00Z'),
    status: 'sent',
  },
  {
    id: 'msg-2',
    role: 'assistant',
    content: 'Hello! I am doing well, thank you for asking. How can I help you today?',
    timestamp: new Date('2024-01-15T10:00:30Z'),
    status: 'received',
  },
  {
    id: 'msg-3',
    role: 'user',
    content: 'Can you explain React hooks?',
    timestamp: new Date('2024-01-15T10:01:00Z'),
    status: 'sent',
  },
];

// Default store mocks
const createMockChatStore = (overrides?: Partial<ReturnType<typeof useChatStore>>) => ({
  messages: [],
  isLoading: false,
  error: null,
  activeMessageId: null,
  conversationId: null,
  addMessage: vi.fn(),
  updateMessage: vi.fn(),
  appendToMessage: vi.fn(),
  deleteMessage: vi.fn(),
  clearConversation: vi.fn(),
  startNewConversation: vi.fn(),
  setLoading: vi.fn(),
  setError: vi.fn(),
  clearError: vi.fn(),
  setActiveMessage: vi.fn(),
  clearActiveMessage: vi.fn(),
  getUserMessages: vi.fn(() => []),
  getAssistantMessages: vi.fn(() => []),
  getLastMessage: vi.fn(() => undefined),
  getMessageById: vi.fn(() => undefined),
  hasMessages: vi.fn(() => false),
  getMessageCount: vi.fn(() => 0),
  ...overrides,
});

const createMockSettingsStore = (overrides?: Partial<ReturnType<typeof useSettingsStore>>) => ({
  settings: {
    version: 1,
    theme: 'auto' as const,
    ui: {
      fontSize: 'medium' as const,
      compactMode: false,
      showTimestamps: true,
      showAvatars: true,
      animationsEnabled: true,
    },
    ai: {
      defaultProvider: null,
      temperature: 0.7,
      maxTokens: 2048,
      streamResponse: true,
    },
    privacy: {
      saveConversations: true,
      shareAnalytics: false,
      clearOnClose: false,
    },
    apiKeys: {
      openai: null,
      anthropic: null,
      google: null,
    },
  },
  isLoading: false,
  error: null,
  loadSettings: vi.fn(),
  updateTheme: vi.fn(),
  updateUIPreferences: vi.fn(),
  updateAISettings: vi.fn(),
  updatePrivacySettings: vi.fn(),
  updateAPIKeyReferences: vi.fn(),
  resetToDefaults: vi.fn(),
  setError: vi.fn(),
  ...overrides,
});

describe('ChatPanel Component', () => {
  // Setup default mocks before each test
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseChatStore.mockReturnValue(createMockChatStore());
    mockUseSettingsStore.mockReturnValue(createMockSettingsStore());
  });

  describe('Layout Structure', () => {
    it('should render main container with correct test-id', () => {
      render(<ChatPanel />);

      expect(screen.getByTestId('chat-panel')).toBeInTheDocument();
      expect(screen.getByTestId('chat-panel')).toHaveClass('chat-panel');
    });

    it('should render header section with title', () => {
      render(<ChatPanel />);

      const header = screen.getByTestId('chat-panel-header');
      expect(header).toBeInTheDocument();
      expect(header).toHaveClass('chat-panel__header');

      // Check for title
      expect(screen.getByText('Chat')).toBeInTheDocument();
      expect(screen.getByText('Chat')).toHaveClass('chat-panel__title');
    });

    it('should render body section with MessageList', () => {
      render(<ChatPanel />);

      const body = screen.getByTestId('chat-panel-body');
      expect(body).toBeInTheDocument();
      expect(body).toHaveClass('chat-panel__body');

      // MessageList should be rendered
      expect(screen.getByTestId('message-list')).toBeInTheDocument();
    });

    it('should render footer section with ChatInput', () => {
      render(<ChatPanel />);

      const footer = screen.getByTestId('chat-panel-footer');
      expect(footer).toBeInTheDocument();
      expect(footer).toHaveClass('chat-panel__footer');

      // ChatInput should be rendered (check for textarea)
      const textArea = screen.getByRole('textbox');
      expect(textArea).toBeInTheDocument();
      expect(textArea).toHaveAttribute('placeholder', 'Type your message here...');
    });

    it('should have proper header controls section', () => {
      render(<ChatPanel />);

      const controls = screen.getByTestId('chat-panel-controls');
      expect(controls).toBeInTheDocument();
      expect(controls).toHaveClass('chat-panel__controls');
    });

    it('should render clear conversation button in controls', () => {
      mockUseChatStore.mockReturnValue(
        createMockChatStore({
          messages: mockMessages,
          hasMessages: vi.fn(() => true),
        })
      );

      render(<ChatPanel />);

      const clearButton = screen.getByLabelText('Clear conversation');
      expect(clearButton).toBeInTheDocument();
      expect(clearButton).not.toBeDisabled();
    });

    it('should disable clear button when no messages', () => {
      render(<ChatPanel />);

      const clearButton = screen.getByLabelText('Clear conversation');
      expect(clearButton).toBeDisabled();
    });
  });

  describe('Component Integration', () => {
    it('should pass messages to MessageList', () => {
      mockUseChatStore.mockReturnValue(
        createMockChatStore({
          messages: mockMessages,
        })
      );

      render(<ChatPanel />);

      // Check that messages are displayed (MessageBubble content)
      expect(screen.getByText('Hello, how are you?')).toBeInTheDocument();
      expect(
        screen.getByText('Hello! I am doing well, thank you for asking. How can I help you today?')
      ).toBeInTheDocument();
      expect(screen.getByText('Can you explain React hooks?')).toBeInTheDocument();
    });

    it('should pass loading state to MessageList', () => {
      mockUseChatStore.mockReturnValue(
        createMockChatStore({
          isLoading: true,
        })
      );

      render(<ChatPanel />);

      expect(screen.getByTestId('message-list-loading')).toBeInTheDocument();
      expect(screen.getByText('Loading messages...')).toBeInTheDocument();
    });

    it('should handle ChatInput onSend', async () => {
      const mockAddMessage = vi.fn();
      mockUseChatStore.mockReturnValue(
        createMockChatStore({
          addMessage: mockAddMessage,
        })
      );

      const user = userEvent.setup();
      render(<ChatPanel />);

      const textArea = screen.getByRole('textbox');
      const sendButton = screen.getByLabelText('Send');

      await user.type(textArea, 'Test message');
      await user.click(sendButton);

      expect(mockAddMessage).toHaveBeenCalledWith({
        role: 'user',
        content: 'Test message',
      });
    });

    it('should handle ChatInput onClear', async () => {
      const user = userEvent.setup();
      render(<ChatPanel />);

      const textArea = screen.getByRole('textbox');
      const clearButton = screen.getByLabelText('Clear');

      await user.type(textArea, 'Some text to clear');
      expect(textArea).toHaveValue('Some text to clear');

      await user.click(clearButton);
      expect(textArea).toHaveValue('');
    });
  });

  describe('Error Handling', () => {
    it('should display error message when chat store has error', () => {
      mockUseChatStore.mockReturnValue(
        createMockChatStore({
          error: 'Failed to send message',
        })
      );

      render(<ChatPanel />);

      const errorMessage = screen.getByTestId('chat-panel-error');
      expect(errorMessage).toBeInTheDocument();
      expect(errorMessage).toHaveTextContent('Failed to send message');
      expect(errorMessage).toHaveClass('chat-panel__error');
    });

    it('should show dismiss button for errors', async () => {
      const mockClearError = vi.fn();
      mockUseChatStore.mockReturnValue(
        createMockChatStore({
          error: 'Failed to send message',
          clearError: mockClearError,
        })
      );

      const user = userEvent.setup();
      render(<ChatPanel />);

      const dismissButton = screen.getByLabelText('Dismiss error');
      expect(dismissButton).toBeInTheDocument();

      await user.click(dismissButton);
      expect(mockClearError).toHaveBeenCalled();
    });

    it('should not display error section when no error', () => {
      render(<ChatPanel />);

      expect(screen.queryByTestId('chat-panel-error')).not.toBeInTheDocument();
    });
  });

  describe('Actions and Interactions', () => {
    it('should handle clear conversation action', async () => {
      const mockClearConversation = vi.fn();
      mockUseChatStore.mockReturnValue(
        createMockChatStore({
          messages: mockMessages,
          hasMessages: vi.fn(() => true),
          clearConversation: mockClearConversation,
        })
      );

      const user = userEvent.setup();
      render(<ChatPanel />);

      const clearButton = screen.getByLabelText('Clear conversation');
      await user.click(clearButton);

      expect(mockClearConversation).toHaveBeenCalled();
    });

    it('should show confirmation dialog for clear conversation', async () => {
      // Mock window.confirm
      const mockConfirm = vi.spyOn(window, 'confirm').mockReturnValue(true);

      const mockClearConversation = vi.fn();
      mockUseChatStore.mockReturnValue(
        createMockChatStore({
          messages: mockMessages,
          hasMessages: vi.fn(() => true),
          clearConversation: mockClearConversation,
        })
      );

      const user = userEvent.setup();
      render(<ChatPanel />);

      const clearButton = screen.getByLabelText('Clear conversation');
      await user.click(clearButton);

      expect(mockConfirm).toHaveBeenCalledWith(
        'Are you sure you want to clear this conversation? This action cannot be undone.'
      );
      expect(mockClearConversation).toHaveBeenCalled();

      mockConfirm.mockRestore();
    });

    it('should not clear conversation if user cancels confirmation', async () => {
      // Mock window.confirm to return false
      const mockConfirm = vi.spyOn(window, 'confirm').mockReturnValue(false);

      const mockClearConversation = vi.fn();
      mockUseChatStore.mockReturnValue(
        createMockChatStore({
          messages: mockMessages,
          hasMessages: vi.fn(() => true),
          clearConversation: mockClearConversation,
        })
      );

      const user = userEvent.setup();
      render(<ChatPanel />);

      const clearButton = screen.getByLabelText('Clear conversation');
      await user.click(clearButton);

      expect(mockConfirm).toHaveBeenCalled();
      expect(mockClearConversation).not.toHaveBeenCalled();

      mockConfirm.mockRestore();
    });
  });

  describe('Responsive Behavior', () => {
    it('should apply responsive classes', () => {
      render(<ChatPanel />);

      const panel = screen.getByTestId('chat-panel');
      expect(panel).toHaveClass('chat-panel');

      // Check for responsive layout classes
      const body = screen.getByTestId('chat-panel-body');
      expect(body).toHaveClass('chat-panel__body');
    });

    it('should handle different screen sizes via CSS', () => {
      render(<ChatPanel />);

      const panel = screen.getByTestId('chat-panel');

      // Verify that the component renders with base classes
      // CSS media queries will handle the responsive behavior
      expect(panel).toHaveClass('chat-panel');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<ChatPanel />);

      const main = screen.getByRole('main');
      expect(main).toBeInTheDocument();
      expect(main).toHaveAttribute('aria-label', 'Chat conversation');

      const clearButton = screen.getByLabelText('Clear conversation');
      expect(clearButton).toBeInTheDocument();
    });

    it('should support keyboard navigation', () => {
      render(<ChatPanel />);

      const textArea = screen.getByRole('textbox');
      const clearConvButton = screen.getByLabelText('Clear conversation');

      expect(textArea).toHaveAttribute('tabindex', '0');
      expect(clearConvButton).not.toHaveAttribute('tabindex', '-1');
    });

    it('should have proper heading hierarchy', () => {
      render(<ChatPanel />);

      const title = screen.getByText('Chat');
      // Title should be in header but not necessarily an h1 since this is a component
      expect(title).toBeInTheDocument();
      expect(title).toHaveClass('chat-panel__title');
    });
  });

  describe('Props and Customization', () => {
    it('should accept className prop', () => {
      render(<ChatPanel className="custom-chat-panel" />);

      const panel = screen.getByTestId('chat-panel');
      expect(panel).toHaveClass('chat-panel');
      expect(panel).toHaveClass('custom-chat-panel');
    });

    it('should accept title prop', () => {
      render(<ChatPanel title="Custom Title" />);

      expect(screen.getByText('Custom Title')).toBeInTheDocument();
    });

    it('should use default title when no title prop provided', () => {
      render(<ChatPanel />);

      expect(screen.getByText('Chat')).toBeInTheDocument();
    });

    it('should support custom empty message', () => {
      render(<ChatPanel emptyMessage="Start chatting to see messages" />);

      expect(screen.getByText('Start chatting to see messages')).toBeInTheDocument();
    });

    it('should pass through MessageList props', () => {
      render(<ChatPanel autoScroll={false} height="400px" />);

      const messageList = screen.getByTestId('message-list');
      expect(messageList).toBeInTheDocument();
      // Props are passed through to MessageList
    });
  });

  describe('Loading States', () => {
    it('should show loading indicator when chat is loading', () => {
      mockUseChatStore.mockReturnValue(
        createMockChatStore({
          isLoading: true,
        })
      );

      render(<ChatPanel />);

      expect(screen.getByTestId('message-list-loading')).toBeInTheDocument();
    });

    it('should disable input when loading', () => {
      mockUseChatStore.mockReturnValue(
        createMockChatStore({
          isLoading: true,
        })
      );

      render(<ChatPanel />);

      const textArea = screen.getByRole('textbox');
      expect(textArea).toBeDisabled();
    });

    it('should disable clear button when loading', () => {
      mockUseChatStore.mockReturnValue(
        createMockChatStore({
          isLoading: true,
          messages: mockMessages,
          hasMessages: vi.fn(() => true),
        })
      );

      render(<ChatPanel />);

      const clearButton = screen.getByLabelText('Clear conversation');
      expect(clearButton).toBeDisabled();
    });
  });

  describe('Empty State', () => {
    it('should show empty message when no messages', () => {
      render(<ChatPanel />);

      expect(screen.getByText('No messages yet')).toBeInTheDocument();
    });

    it('should show custom empty message', () => {
      render(<ChatPanel emptyMessage="Welcome! Start a conversation." />);

      expect(screen.getByText('Welcome! Start a conversation.')).toBeInTheDocument();
    });
  });

  describe('Message Count Display', () => {
    it('should show message count when messages exist', () => {
      mockUseChatStore.mockReturnValue(
        createMockChatStore({
          messages: mockMessages,
          getMessageCount: vi.fn(() => 3),
        })
      );

      render(<ChatPanel showMessageCount />);

      expect(screen.getByText('3 messages')).toBeInTheDocument();
    });

    it('should not show message count by default', () => {
      mockUseChatStore.mockReturnValue(
        createMockChatStore({
          messages: mockMessages,
          getMessageCount: vi.fn(() => 3),
        })
      );

      render(<ChatPanel />);

      expect(screen.queryByText('3 messages')).not.toBeInTheDocument();
    });

    it('should handle singular message count', () => {
      mockUseChatStore.mockReturnValue(
        createMockChatStore({
          messages: [mockMessages[0]],
          getMessageCount: vi.fn(() => 1),
        })
      );

      render(<ChatPanel showMessageCount />);

      expect(screen.getByText('1 message')).toBeInTheDocument();
    });
  });
});
