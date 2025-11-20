/**
 * @file useAIChat Integration Tests
 *
 * Tests for the useAIChat hook focusing on error handling and edge cases.
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAIChat } from '@/sidebar/hooks/ai/useAIChat';
import { useUIStore, useMessageStore, useSessionStore } from '@/data/store/chat';
import { useSettingsStore } from '@/data/store/settings';
import { ChatService } from '@/services/chat/ChatService';
import { EngineManagerService } from '@/services/engine/EngineManagerService';

// Mock dependencies
vi.mock('@/services/chat/ChatService');
vi.mock('@/services/engine/EngineManagerService');
vi.mock('@/config/models', () => ({
  getModelById: vi.fn().mockReturnValue({ name: 'Test Model' }),
  DEFAULT_MODELS: [],
  DEFAULT_MODEL_ID: 'gpt-4',
}));
vi.mock('@/config/systemPrompt', () => ({
  getSystemPrompt: vi.fn().mockReturnValue('System Prompt'),
}));

vi.mock('@/sidebar/hooks/useTabExtraction', () => ({
  useTabExtraction: vi.fn().mockReturnValue({
    currentTabContent: null,
    currentTabId: 1,
    loadedTabs: {},
    hasAutoLoaded: false,
  }),
}));

vi.mock('@/core/services/responseIdManager', () => ({
  responseIdManager: {
    setActiveProvider: vi.fn(),
    getResponseId: vi.fn(),
    storeResponseId: vi.fn(),
    supportsProvider: vi.fn().mockReturnValue(true),
    clearResponseId: vi.fn(),
  },
}));

// Mock provider
const mockProvider = {
  type: 'openai',
  name: 'Mock Provider',
  streamChat: vi.fn(),
  formatError: vi.fn(err => ({ message: err.message })),
};

describe('useAIChat Integration', () => {
  let mockChatService: any;
  let mockEngineManager: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset stores
    useUIStore.setState({ loading: false, error: null, activeMessageId: null });
    useSettingsStore.setState({
      settings: {
        selectedModel: 'gpt-4',
        apiKeys: { openai: 'test-key' },
        availableModels: [{ id: 'gpt-4', available: true, providerId: 'openai' }],
      } as any,
    });

    // Initialize Session Store with an active session
    useSessionStore.setState({ sessions: {}, activeSessionKey: null });
    useSessionStore.getState().switchSession(1, 'https://example.com');

    // Setup mocks
    mockChatService = {
      setProvider: vi.fn(),
      getProvider: vi.fn().mockReturnValue(mockProvider),
      stream: vi.fn(),
      cancel: vi.fn(),
      isStreaming: vi.fn().mockReturnValue(false),
    };
    (ChatService as any).mockImplementation(() => mockChatService);

    mockEngineManager = {
      initializeFromSettings: vi.fn(),
      getActive: vi.fn().mockReturnValue(mockProvider),
      getStats: vi.fn().mockReturnValue({ activeProvider: mockProvider, registeredProviders: [] }),
      switch: vi.fn(),
    };
    (EngineManagerService as any).getInstance = vi.fn().mockReturnValue(mockEngineManager);
  });

  it('should handle immediate stream error gracefully', async () => {
    const { result } = renderHook(() => useAIChat({ enabled: true }));

    // Setup immediate error
    const error = new Error('Network Error');
    mockChatService.stream.mockImplementation(async function* () {
      // yield once to satisfy require-yield rule
      yield undefined as never;
      throw error;
    });

    await act(async () => {
      try {
        await result.current.sendMessage('Hello');
      } catch (e) {
        // Expected to throw
      }
    });

    // UI should not be loading
    expect(useUIStore.getState().loading).toBe(false);

    // User message should be in error state
    const messages = useMessageStore.getState().getMessages();
    const userMsg = messages.find(m => m.role === 'user');
    expect(userMsg?.status).toBe('error');

    // Assistant message should be removed
    const assistantMsg = messages.find(m => m.role === 'assistant');
    expect(assistantMsg).toBeUndefined();
  });

  it('should handle stream interruption with partial content', async () => {
    const { result } = renderHook(() => useAIChat({ enabled: true }));

    // Setup isStreaming to be true during stream
    mockChatService.isStreaming.mockReturnValue(true);

    // Setup partial content then error
    mockChatService.stream.mockImplementation(async function* () {
      yield { choices: [{ delta: { content: 'Hello' } }] };
      yield { choices: [{ delta: { content: ' World' } }] };
      throw new Error('Stream broken');
    });

    await act(async () => {
      try {
        await result.current.sendMessage('Hello');
      } catch (e) {
        // Expected
      }
    });

    expect(useUIStore.getState().loading).toBe(false);

    const messages = useMessageStore.getState().getMessages();
    const assistantMsg = messages.find(m => m.role === 'assistant');

    // Should persist partial message
    expect(assistantMsg).toBeDefined();
    expect(assistantMsg?.content).toContain('Hello World');
    expect(assistantMsg?.content).toContain('[Interrupted]');
    expect(assistantMsg?.status).toBe('received');
    expect(assistantMsg?.metadata?.partial).toBe(true);
  });

  it('should block provider switching when a conversation is active', async () => {
    // Seed a conversation
    useMessageStore.getState().addMessage({
      role: 'user',
      content: 'Hello',
      status: 'sent',
      timestamp: new Date(),
    });

    const { result } = renderHook(() => useAIChat({ enabled: true }));

    await expect(result.current.switchProvider('gemini')).rejects.toThrow(
      'Cannot switch provider during an active conversation'
    );

    expect(mockEngineManager.switch).not.toHaveBeenCalled();
    expect(useUIStore.getState().getError()).toContain('Cannot switch provider');
  });
});
