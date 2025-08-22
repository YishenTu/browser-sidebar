import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatPanel from '@sidebar/ChatPanel';
import { useSettingsStore } from '@store/settings';
import { useChatStore } from '@store/chat';
import { useAIChat } from '@hooks/useAIChat';

// Mock the AI Chat hook
vi.mock('@hooks/useAIChat');

// Mock Chrome runtime API
global.chrome = {
  runtime: {
    sendMessage: vi.fn(),
  },
} as any;

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

describe('ChatPanel Provider Mapping', () => {
  const mockSwitchProvider = vi.fn();
  const mockSendMessage = vi.fn();
  const mockCancel = vi.fn();
  const mockClearConversation = vi.fn();
  const mockInitialize = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset stores to default state
    useSettingsStore.setState({
      settings: {
        ...useSettingsStore.getState().settings,
        selectedModel: 'gpt-5-nano',
        ai: {
          ...useSettingsStore.getState().settings.ai,
          defaultProvider: 'openai',
        },
      },
      isLoading: false,
      error: null,
    });

    useChatStore.setState({
      messages: [],
      activeMessageId: null,
      isLoading: false,
    });

    // Mock useAIChat hook
    (useAIChat as any).mockReturnValue({
      initialize: mockInitialize,
      sendMessage: mockSendMessage,
      cancel: mockCancel,
      clearConversation: mockClearConversation,
      switchProvider: mockSwitchProvider,
      isReady: true,
      activeProvider: 'openai',
    });
  });

  it('should map GPT-5 Nano to OpenAI provider', async () => {
    const user = userEvent.setup();
    render(<ChatPanel />);

    // Open and switch to Gemini first to ensure a change occurs
    const modelSelector = screen.getByRole('combobox', { name: /select ai model/i });
    await user.click(modelSelector);
    const geminiOption = screen.getByRole('option', { name: /Gemini 2.5 Flash Lite/i });
    await user.click(geminiOption);
    await waitFor(() => {
      expect(mockSwitchProvider).toHaveBeenCalledWith('gemini');
    });

    // Now switch back to GPT-5 Nano
    await user.click(screen.getByRole('combobox', { name: /select ai model/i }));
    const gptOption = screen.getByRole('option', { name: /GPT-5 Nano/i });
    await user.click(gptOption);

    // Wait for provider switch to OpenAI
    await waitFor(() => {
      expect(mockSwitchProvider).toHaveBeenCalledWith('openai');
    });

    // Verify settings were updated
    const state = useSettingsStore.getState();
    expect(state.settings.selectedModel).toBe('gpt-5-nano');
    expect(state.settings.ai.defaultProvider).toBe('openai');
  });

  it('should map Gemini 2.5 Flash Lite to Google provider', async () => {
    const user = userEvent.setup();
    render(<ChatPanel />);

    // Open model selector dropdown
    const modelSelector = screen.getByRole('combobox', { name: /select ai model/i });
    await user.click(modelSelector);

    // Select Gemini 2.5 Flash Lite
    const geminiOption = screen.getByRole('option', { name: /Gemini 2.5 Flash Lite/i });
    await user.click(geminiOption);

    // Wait for provider switch
    await waitFor(() => {
      expect(mockSwitchProvider).toHaveBeenCalledWith('gemini');
    });

    // Verify settings were updated
    const state = useSettingsStore.getState();
    expect(state.settings.selectedModel).toBe('gemini-2.5-flash-lite');
    expect(state.settings.ai.defaultProvider).toBe('gemini');
  });

  it('should display correct model name for current selection', () => {
    // Set initial state to Gemini
    useSettingsStore.setState({
      settings: {
        ...useSettingsStore.getState().settings,
        selectedModel: 'gemini-2.5-flash-lite',
      },
    });

    render(<ChatPanel />);

    // Check that the correct model name is displayed
    const modelSelector = screen.getByRole('combobox', { name: /select ai model/i });
    expect(modelSelector).toHaveTextContent('Gemini 2.5 Flash Lite');
  });

  it('should handle provider switch errors gracefully', async () => {
    const user = userEvent.setup();
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Make switchProvider reject
    mockSwitchProvider.mockRejectedValue(new Error('Provider switch failed'));

    render(<ChatPanel />);

    // Open model selector dropdown
    const modelSelector = screen.getByRole('combobox', { name: /select ai model/i });
    await user.click(modelSelector);

    // Select Gemini
    const geminiOption = screen.getByRole('option', { name: /Gemini 2.5 Flash Lite/i });
    await user.click(geminiOption);

    // Wait for the error to be logged
    await waitFor(() => {
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to switch model/provider:',
        expect.any(Error)
      );
    });

    consoleWarnSpy.mockRestore();
  });

  it('should disable model selector when loading', () => {
    // Set chat loading state (ChatPanel disables based on chat loading)
    useChatStore.setState({
      isLoading: true,
    });

    render(<ChatPanel />);

    const modelSelector = screen.getByRole('combobox', { name: /select ai model/i });
    expect(modelSelector).toBeDisabled();
  });

  it('should persist model selection across component remounts', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<ChatPanel />);

    // Select Gemini model
    const modelSelector = screen.getByRole('combobox', { name: /select ai model/i });
    await user.click(modelSelector);
    const geminiOption = screen.getByRole('option', { name: /Gemini 2.5 Flash Lite/i });
    await user.click(geminiOption);

    // Wait for state update
    await waitFor(() => {
      expect(useSettingsStore.getState().settings.selectedModel).toBe('gemini-2.5-flash-lite');
    });

    // Unmount and remount
    unmount();
    render(<ChatPanel />);

    // Check that the selection persisted
    const newModelSelector = screen.getByRole('combobox', { name: /select ai model/i });
    expect(newModelSelector).toHaveTextContent('Gemini 2.5 Flash Lite');
  });

  // Note: ChatPanel does not auto-switch providers on external store changes.
  // Provider switching is validated via user selection tests above.

  it('should only show two supported models in dropdown', async () => {
    const user = userEvent.setup();
    render(<ChatPanel />);

    // Open model selector dropdown
    const modelSelector = screen.getByRole('combobox', { name: /select ai model/i });
    await user.click(modelSelector);

    // Check that exactly two models are shown
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(2);

    // Verify the specific models
    expect(screen.getByRole('option', { name: /GPT-5 Nano.*OpenAI/i })).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: /Gemini 2.5 Flash Lite.*Google/i })
    ).toBeInTheDocument();

    // Verify legacy models are not shown
    expect(screen.queryByRole('option', { name: /GPT-4/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Claude/i })).not.toBeInTheDocument();
  });
});
