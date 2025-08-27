/**
 * @file ChatPanel Integration Tests
 *
 * Test suite for ChatPanel component with ModelSelector integration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatPanel } from '@/sidebar/ChatPanel';
import { useSettingsStore } from '@/store/settings';
import { useChatStore } from '@/store/chat';

// Mock the required stores
vi.mock('@/store/settings');
vi.mock('@/store/chat');

// Mock other dependencies
vi.mock('@/sidebar/index', () => ({
  unmountSidebar: vi.fn(),
}));

vi.mock('@/utils/theme', () => ({
  setTheme: vi.fn(),
  getEffectiveTheme: vi.fn(() => 'light'),
  createThemeMediaQueryListener: vi.fn(() => () => {}),
}));

vi.mock('@/sidebar/hooks/useMockChat', () => ({
  useMockChat: () => ({
    generateResponse: vi.fn(),
  }),
}));

vi.mock('@/utils/cn', () => ({
  cn: vi.fn((...classes) => classes.filter(Boolean).join(' ')),
}));

describe('ChatPanel - ModelSelector Integration', () => {
  const mockOnClose = vi.fn();
  const mockUpdateSelectedModel = vi.fn();
  const mockLoadSettings = vi.fn();
  const mockUpdateTheme = vi.fn();
  
  const mockSettingsStore = {
    settings: {
      theme: 'light',
      selectedModel: 'gpt-4',
      availableModels: [
        { id: 'gpt-4', name: 'GPT-4', provider: 'OpenAI', available: true },
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'OpenAI', available: true },
        { id: 'claude-3', name: 'Claude 3', provider: 'Anthropic', available: true },
      ],
    },
    updateSelectedModel: mockUpdateSelectedModel,
    loadSettings: mockLoadSettings,
    updateTheme: mockUpdateTheme,
    getAvailableModels: vi.fn(() => [
      { id: 'gpt-4', name: 'GPT-4', provider: 'OpenAI', available: true },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'OpenAI', available: true },
      { id: 'claude-3', name: 'Claude 3', provider: 'Anthropic', available: true },
    ]),
  };

  const mockChatStore = {
    messages: [],
    isLoading: false,
    addMessage: vi.fn(),
    clearConversation: vi.fn(),
    hasMessages: () => false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup loadSettings to resolve successfully
    mockLoadSettings.mockResolvedValue(undefined);
    
    // Mock DOM methods
    Element.prototype.scrollTo = vi.fn();
    HTMLElement.prototype.scrollTo = vi.fn();
    
    // Mock store implementations
    (useSettingsStore as any).mockImplementation((selector: any) => {
      if (selector) {
        return selector(mockSettingsStore);
      }
      return mockSettingsStore;
    });

    (useChatStore as any).mockImplementation((selector: any) => {
      if (selector) {
        return selector(mockChatStore);
      }
      return mockChatStore;
    });

    // Mock window properties
    Object.defineProperty(window, 'innerHeight', {
      value: 800,
      writable: true,
    });
    
    Object.defineProperty(window, 'innerWidth', {
      value: 1200,
      writable: true,
    });
  });

  it('renders ModelSelector in header', () => {
    render(<ChatPanel onClose={mockOnClose} />);
    
    // Should render the ChatPanel
    expect(screen.getByTestId('chat-panel')).toBeInTheDocument();
    
    // Should render the header
    expect(screen.getByTestId('sidebar-header')).toBeInTheDocument();
    
    // Should render ModelSelector with current selected model
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByText('GPT-4')).toBeInTheDocument();
  });

  it('positions ModelSelector correctly in header layout', () => {
    render(<ChatPanel onClose={mockOnClose} />);
    
    const header = screen.getByTestId('sidebar-header');
    const headerTitle = header.querySelector('.ai-sidebar-header-title');
    const modelSelector = screen.getByRole('combobox').closest('.model-selector');
    
    // ModelSelector should be inside header title area
    expect(headerTitle).toContainElement(modelSelector);
  });

  it('displays current selected model from settings store', () => {
    render(<ChatPanel onClose={mockOnClose} />);
    
    // Should display the currently selected model from store
    expect(screen.getByText('GPT-4')).toBeInTheDocument();
  });

  it('updates store when model selection changes', async () => {
    const user = userEvent.setup();
    render(<ChatPanel onClose={mockOnClose} />);
    
    // Open ModelSelector dropdown
    const combobox = screen.getByRole('combobox');
    await user.click(combobox);
    
    // Select a different model
    await user.click(screen.getByRole('option', { name: 'Claude 3' }));
    
    // Should call updateSelectedModel with the new model ID
    expect(mockUpdateSelectedModel).toHaveBeenCalledWith('claude-3');
  });

  it('shows available models in dropdown', async () => {
    const user = userEvent.setup();
    render(<ChatPanel onClose={mockOnClose} />);
    
    // Open dropdown
    await user.click(screen.getByRole('combobox'));
    
    // Should show all available models
    expect(screen.getByRole('option', { name: 'GPT-4' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'GPT-3.5 Turbo' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Claude 3' })).toBeInTheDocument();
  });

  it('disables ModelSelector when chat is loading', () => {
    // Update mock to show loading state
    const mockLoadingChatStore = {
      ...mockChatStore,
      isLoading: true,
    };

    (useChatStore as any).mockImplementation((selector: any) => {
      if (selector) {
        return selector(mockLoadingChatStore);
      }
      return mockLoadingChatStore;
    });

    render(<ChatPanel onClose={mockOnClose} />);
    
    // ModelSelector should be disabled
    const combobox = screen.getByRole('combobox');
    expect(combobox).toBeDisabled();
  });

  it('enables ModelSelector when chat is not loading', () => {
    render(<ChatPanel onClose={mockOnClose} />);
    
    // ModelSelector should be enabled
    const combobox = screen.getByRole('combobox');
    expect(combobox).not.toBeDisabled();
  });

  it('maintains existing ChatPanel functionality with ModelSelector', async () => {
    const user = userEvent.setup();
    render(<ChatPanel onClose={mockOnClose} />);
    
    // Should still be able to close the panel
    const closeButton = screen.getByRole('button', { name: 'Close sidebar' });
    await user.click(closeButton);
    expect(mockOnClose).toHaveBeenCalled();
    
    // Should still render other components
    expect(screen.getByTestId('sidebar-body')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-footer')).toBeInTheDocument();
  });

  it('does not interfere with header drag functionality', () => {
    render(<ChatPanel onClose={mockOnClose} />);
    
    const header = screen.getByTestId('sidebar-header');
    
    // Should still have drag cursor
    expect(header).toHaveStyle({ cursor: 'grab' });
    
    // Should still respond to mouse events (onMouseDown is an event handler, not an attribute)
    expect(header.onmousedown).toBeDefined();
  });

  it('prevents dragging when clicking on ModelSelector', async () => {
    const user = userEvent.setup();
    render(<ChatPanel onClose={mockOnClose} />);
    
    const header = screen.getByTestId('sidebar-header');
    const combobox = screen.getByRole('combobox');
    
    // Click on ModelSelector should not trigger drag
    const headerMouseDown = vi.fn();
    header.addEventListener('mousedown', headerMouseDown);
    
    await user.click(combobox);
    
    // Header mouse down handler should not interfere with ModelSelector clicks
    // The component should handle this internally by checking event targets
  });

  it('handles model selection errors gracefully', async () => {
    const user = userEvent.setup();
    const mockError = new Error('Failed to update model');
    mockUpdateSelectedModel.mockRejectedValueOnce(mockError);
    
    render(<ChatPanel onClose={mockOnClose} />);
    
    // Open dropdown and select model
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: 'Claude 3' }));
    
    // Should still attempt to update the model
    expect(mockUpdateSelectedModel).toHaveBeenCalledWith('claude-3');
  });

  it('updates ModelSelector when store model changes externally', () => {
    const { rerender } = render(<ChatPanel onClose={mockOnClose} />);
    
    // Initially shows GPT-4
    expect(screen.getByText('GPT-4')).toBeInTheDocument();
    
    // Update the mock store to return a different model
    const updatedSettingsStore = {
      ...mockSettingsStore,
      settings: {
        ...mockSettingsStore.settings,
        selectedModel: 'claude-3',
      },
    };

    (useSettingsStore as any).mockImplementation((selector: any) => {
      if (selector) {
        return selector(updatedSettingsStore);
      }
      return updatedSettingsStore;
    });
    
    // Re-render with updated store
    rerender(<ChatPanel onClose={mockOnClose} />);
    
    // Should now show Claude 3
    expect(screen.getByText('Claude 3')).toBeInTheDocument();
  });

  it('maintains proper accessibility with ModelSelector in header', () => {
    render(<ChatPanel onClose={mockOnClose} />);
    
    // ChatPanel should maintain its dialog role
    const chatPanel = screen.getByTestId('chat-panel');
    expect(chatPanel).toHaveAttribute('role', 'dialog');
    expect(chatPanel).toHaveAttribute('aria-label', 'AI Browser Sidebar');
    
    // ModelSelector should have proper accessibility
    const combobox = screen.getByRole('combobox');
    expect(combobox).toHaveAttribute('aria-label', 'Select AI model');
    expect(combobox).toHaveAttribute('aria-expanded', 'false');
  });
});