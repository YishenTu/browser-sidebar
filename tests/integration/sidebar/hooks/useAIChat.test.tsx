/**
 * @file Integration Tests for useAIChat Hook
 *
 * Tests the useAIChat hook behavior in both legacy and refactored modes.
 * Verifies proper service integration, provider switching, and error handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAIChat } from '@hooks/ai/useAIChat';
import { ChatService } from '@/services/chat/ChatService';
import { EngineManagerService } from '@/services/engine/EngineManagerService';
import type { AIProvider, ProviderType, ProviderChatMessage } from '@/types/providers';
import type { StreamChunk } from '@/types/providers';

// New architecture: always service-based; no feature flag

// Mock the stores
const mockUseSettingsStore = vi.hoisted(() => {
  const store = {
    settings: {
      apiKeys: {
        openai: 'test-openai-key',
        google: 'test-gemini-key',
      },
      selectedModel: 'gpt-5-nano',
      ai: {
        defaultProvider: 'openai' as ProviderType,
      },
    },
  };
  return {
    useSettingsStore: vi.fn(() => store),
    clearError: vi.fn(),
  };
});

const mockUseTabStore = vi.hoisted(() => {
  const store = {
    getCurrentTabId: vi.fn(() => 1),
    getHasAutoLoaded: vi.fn(() => false),
    getLoadedTabs: vi.fn(() => ({})),
    setCurrentTabId: vi.fn(),
    setHasAutoLoaded: vi.fn(),
    setLoadedTabs: vi.fn(),
  };
  const useTabStore = vi.fn(() => store);
  useTabStore.getState = vi.fn(() => store);
  return {
    useTabStore,
  };
});

const mockUseUIStore = vi.hoisted(() => {
  const store = {
    setError: vi.fn(),
    clearError: vi.fn(),
    setLoading: vi.fn(),
    clearActiveMessage: vi.fn(),
    setActiveMessage: vi.fn(),
    clearConversation: vi.fn(),
  };
  const useUIStore = vi.fn(() => store);
  useUIStore.getState = vi.fn(() => store);
  return {
    useUIStore,
  };
});

const mockResponseIdManager = vi.hoisted(() => ({
  setActiveProvider: vi.fn(),
  getResponseId: vi.fn(() => null),
  storeResponseId: vi.fn(),
  clearResponseId: vi.fn(),
  supportsProvider: vi.fn(() => true),
}));

const mockUseMessageStore = vi.hoisted(() => {
  const store = {
    addMessage: vi.fn(msg => ({ ...msg, id: 'msg-' + Date.now() })),
    updateMessage: vi.fn(),
    appendToMessage: vi.fn(),
    getMessageById: vi.fn(() => ({ id: 'test', content: '', metadata: {} })),
    getMessages: vi.fn(() => []),
    getUserMessages: vi.fn(() => []),
  };
  const useMessageStore = vi.fn(() => store);
  useMessageStore.getState = vi.fn(() => store);
  return {
    useMessageStore,
  };
});

vi.mock('@store/settings', () => mockUseSettingsStore);
vi.mock('@store/chat', () => ({
  ...mockUseTabStore,
  ...mockUseUIStore,
  ...mockUseMessageStore,
}));

vi.mock('@core/services/responseIdManager', () => ({
  responseIdManager: mockResponseIdManager,
}));

// Mock the legacy hooks
const mockUseProviderManager = vi.hoisted(() => ({
  initializeProviders: vi.fn(),
  switchProvider: vi.fn(),
  getStats: vi.fn(() => ({
    activeProvider: 'openai',
    registeredProviders: ['openai', 'gemini'],
  })),
  getActiveProvider: vi.fn(),
}));

const mockUseMessageHandler = vi.hoisted(() => ({
  sendMessage: vi.fn(),
  cancelMessage: vi.fn(),
  isStreaming: vi.fn(() => false),
}));

const mockUseTabExtraction = vi.hoisted(() => ({
  currentTabContent: null,
  currentTabId: 1,
  loadedTabs: {},
  hasAutoLoaded: false,
  extractCurrentTab: vi.fn(),
  extractTabById: vi.fn(),
  removeLoadedTab: vi.fn(),
  clearAllTabs: vi.fn(),
  refreshAvailableTabs: vi.fn(),
  availableTabs: [],
  loading: false,
  loadingTabIds: [],
  error: null,
}));

vi.mock('@hooks/ai/useProviderManager', () => ({
  useProviderManager: vi.fn(() => mockUseProviderManager),
}));

vi.mock('@hooks/ai/useMessageHandler', () => ({
  useMessageHandler: vi.fn(() => mockUseMessageHandler),
}));

vi.mock('@hooks/useTabExtraction', () => ({
  useTabExtraction: vi.fn(() => mockUseTabExtraction),
}));

// Mock system prompt
vi.mock('@config/systemPrompt', () => ({
  getSystemPrompt: vi.fn(() => 'Test system prompt'),
}));

// Mock models
vi.mock('@config/models', () => ({
  getModelById: vi.fn(() => ({ name: 'GPT-5 Nano' })),
}));

// Mock content formatter
vi.mock('@sidebar/utils/contentFormatter', () => ({
  formatTabContent: vi.fn(content => ({ formatted: content })),
}));

// Mock the services
vi.mock('@/services/chat/ChatService', () => ({
  ChatService: vi.fn(),
}));

vi.mock('@/services/engine/EngineManagerService', () => ({
  EngineManagerService: {
    getInstance: vi.fn(),
    resetInstance: vi.fn(),
  },
}));

// Create mock services
const createMockChatService = () => ({
  stream: vi.fn(),
  cancel: vi.fn(),
  isStreaming: vi.fn(() => false),
  setProvider: vi.fn(),
  getProvider: vi.fn(),
});

const createMockEngineManagerService = () => ({
  initializeFromSettings: vi.fn(),
  getActive: vi.fn(),
  switch: vi.fn(),
  getStats: vi.fn(() => ({
    activeProvider: 'openai',
    registeredProviders: ['openai', 'gemini'],
  })),
});

const createMockProvider = (): AIProvider => ({
  id: 'test-provider',
  type: 'openai',
  name: 'Test Provider',
  config: { apiKey: 'test-key' },
  isConfigured: true,
  streamChat: vi.fn(),
  formatError: vi.fn(error => ({ message: error.message })),
});

describe('useAIChat Integration Tests', () => {
  let mockChatService: ReturnType<typeof createMockChatService>;
  let mockEngineManagerService: ReturnType<typeof createMockEngineManagerService>;
  let mockProvider: AIProvider;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset store mocks
    const settingsStore = {
      settings: {
        apiKeys: {
          openai: 'test-openai-key',
          google: 'test-gemini-key',
        },
        selectedModel: 'gpt-5-nano',
        ai: {
          defaultProvider: 'openai' as ProviderType,
        },
      },
      clearError: vi.fn(),
    };

    const tabStore = {
      getCurrentTabId: vi.fn(() => 1),
      getHasAutoLoaded: vi.fn(() => false),
      getLoadedTabs: vi.fn(() => ({})),
      setCurrentTabId: vi.fn(),
      setHasAutoLoaded: vi.fn(),
      setLoadedTabs: vi.fn(),
    };

    const uiStore = {
      setError: vi.fn(),
      clearError: vi.fn(),
      setLoading: vi.fn(),
      clearActiveMessage: vi.fn(),
      setActiveMessage: vi.fn(),
      clearConversation: vi.fn(),
    };

    const messageStore = {
      addMessage: vi.fn(msg => ({ ...msg, id: 'msg-' + Date.now() })),
      updateMessage: vi.fn(),
      appendToMessage: vi.fn(),
      getMessageById: vi.fn(() => ({ id: 'test', content: '', metadata: {} })),
      getMessages: vi.fn(() => []),
      getUserMessages: vi.fn(() => []),
    };

    mockUseSettingsStore.useSettingsStore.mockReturnValue(settingsStore);
    mockUseTabStore.useTabStore.mockReturnValue(tabStore);
    mockUseTabStore.useTabStore.getState.mockReturnValue(tabStore);
    mockUseUIStore.useUIStore.mockReturnValue(uiStore);
    mockUseUIStore.useUIStore.getState.mockReturnValue(uiStore);
    mockUseMessageStore.useMessageStore.mockReturnValue(messageStore);
    mockUseMessageStore.useMessageStore.getState.mockReturnValue(messageStore);

    mockResponseIdManager.setActiveProvider.mockClear();
    mockResponseIdManager.getResponseId.mockClear();
    mockResponseIdManager.getResponseId.mockReturnValue(null);
    mockResponseIdManager.storeResponseId.mockClear();
    mockResponseIdManager.clearResponseId.mockClear();
    mockResponseIdManager.supportsProvider.mockClear();
    mockResponseIdManager.supportsProvider.mockReturnValue(true);

    // Create fresh mock instances
    mockChatService = createMockChatService();
    mockEngineManagerService = createMockEngineManagerService();
    mockProvider = createMockProvider();

    // Setup default provider behavior
    mockEngineManagerService.getActive.mockReturnValue(mockProvider);
    mockProvider.streamChat = vi.fn().mockImplementation(async function* () {
      yield {
        choices: [{ delta: { content: 'Hello' } }],
        metadata: {},
      } as StreamChunk;
      yield {
        choices: [{ delta: { content: ' World' } }],
        metadata: {},
      } as StreamChunk;
    });

    // Setup async iterator for chat service - make sure isStreaming returns true during streaming
    mockChatService.stream.mockImplementation(async function* () {
      // Set streaming state to true during iteration
      mockChatService.isStreaming.mockReturnValue(true);

      yield {
        choices: [{ delta: { content: 'Hello' } }],
        metadata: {},
      } as StreamChunk;
      yield {
        choices: [{ delta: { content: ' World' } }],
        metadata: {},
      } as StreamChunk;

      // Set streaming state back to false after iteration
      mockChatService.isStreaming.mockReturnValue(false);
    });

    // Mock service constructors
    const MockedChatService = vi.mocked(ChatService);
    const MockedEngineManagerService = vi.mocked(EngineManagerService);

    MockedChatService.mockImplementation(() => mockChatService as any);
    MockedEngineManagerService.getInstance.mockReturnValue(mockEngineManagerService as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Legacy mode removed — service-based only

  describe('Service Mode', () => {
    it('should use service-based implementations', () => {
      const { result } = renderHook(() => useAIChat({ enabled: true }));

      // Should not be the same as legacy hooks
      expect(result.current.sendMessage).not.toBe(mockUseMessageHandler.sendMessage);
      expect(result.current.cancelMessage).not.toBe(mockUseMessageHandler.cancelMessage);
      expect(result.current.switchProvider).not.toBe(mockUseProviderManager.switchProvider);
      expect(result.current.isStreaming).not.toBe(mockUseMessageHandler.isStreaming);
      expect(result.current.getStats).not.toBe(mockUseProviderManager.getStats);
    });

    it('should initialize services on mount', () => {
      renderHook(() => useAIChat({ enabled: true }));

      expect(EngineManagerService.getInstance).toHaveBeenCalledWith({
        autoInitialize: false,
        enableStats: true,
      });
      expect(ChatService).toHaveBeenCalledTimes(1);
    });

    it('should initialize providers using service', async () => {
      renderHook(() => useAIChat({ enabled: true, autoInitialize: true }));

      // Wait for initialization effect
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(mockEngineManagerService.initializeFromSettings).toHaveBeenCalled();
    });

    it('should handle provider switching through service', async () => {
      const { result } = renderHook(() => useAIChat({ enabled: true }));

      await act(async () => {
        await result.current.switchProvider('gemini');
      });

      expect(mockEngineManagerService.switch).toHaveBeenCalledWith('gemini');
      expect(mockChatService.setProvider).toHaveBeenCalled();
    });

    it('should stream messages through chat service', async () => {
      const { result } = renderHook(() => useAIChat({ enabled: true }));

      // Mock message store to return a user message
      const mockUserMessage = {
        id: 'user-msg',
        role: 'user',
        content: 'test message',
        timestamp: Date.now(),
      };

      // Update the message store mock to return proper messages
      const messageStore = {
        ...mockUseMessageStore.useMessageStore(),
        addMessage: vi.fn(() => mockUserMessage),
        getUserMessages: vi.fn(() => [mockUserMessage]),
        getMessages: vi.fn(() => [mockUserMessage]),
      };

      mockUseMessageStore.useMessageStore.mockReturnValue(messageStore);
      mockUseMessageStore.useMessageStore.getState.mockReturnValue(messageStore);

      // Setup successful streaming
      mockChatService.stream.mockImplementation(async function* () {
        mockChatService.isStreaming.mockReturnValue(true);
        yield {
          choices: [{ delta: { content: 'Hello' } }],
          metadata: {},
        } as StreamChunk;
        mockChatService.isStreaming.mockReturnValue(false);
      });

      await act(async () => {
        await result.current.sendMessage('test message');
      });

      expect(mockChatService.stream).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining('test message'),
          }),
        ]),
        expect.objectContaining({
          systemPrompt: 'Test system prompt',
        })
      );
    });

    it('should handle streaming with thinking content', async () => {
      const { result } = renderHook(() => useAIChat({ enabled: true }));

      const mockUserMessage = {
        id: 'user-msg',
        role: 'user',
        content: 'test',
        timestamp: Date.now(),
      };

      // Update message store to ensure proper message flow
      const messageStore = {
        ...mockUseMessageStore.useMessageStore(),
        addMessage: vi.fn(() => mockUserMessage),
        getUserMessages: vi.fn(() => [mockUserMessage]),
        getMessages: vi.fn(() => [mockUserMessage]),
        updateMessage: vi.fn(),
        appendToMessage: vi.fn(),
        getMessageById: vi.fn(() => ({ id: 'assistant-msg', content: '', metadata: {} })),
      };

      mockUseMessageStore.useMessageStore.mockReturnValue(messageStore);
      mockUseMessageStore.useMessageStore.getState.mockReturnValue(messageStore);

      // Setup stream with thinking content
      mockChatService.stream.mockImplementation(async function* () {
        mockChatService.isStreaming.mockReturnValue(true);
        yield {
          choices: [{ delta: { thinking: 'Let me think...' } }],
          metadata: {},
        } as StreamChunk;
        yield {
          choices: [{ delta: { content: 'Hello' } }],
          metadata: {},
        } as StreamChunk;
        mockChatService.isStreaming.mockReturnValue(false);
      });

      await act(async () => {
        await result.current.sendMessage('test');
      });

      // Verify that streaming was called (integration working)
      expect(mockChatService.stream).toHaveBeenCalled();
    });

    it('should handle stream cancellation', async () => {
      const { result } = renderHook(() => useAIChat({ enabled: true }));

      act(() => {
        result.current.cancelMessage();
      });

      expect(mockChatService.cancel).toHaveBeenCalled();
      expect(mockUseUIStore.useUIStore().setLoading).toHaveBeenCalledWith(false);
    });

    it('should handle streaming errors', async () => {
      const { result } = renderHook(() => useAIChat({ enabled: true }));

      const mockUserMessage = {
        id: 'user-msg',
        role: 'user',
        content: 'test message',
        timestamp: Date.now(),
      };

      // Update message store to ensure proper message flow
      const messageStore = {
        ...mockUseMessageStore.useMessageStore(),
        addMessage: vi.fn(() => mockUserMessage),
        getUserMessages: vi.fn(() => [mockUserMessage]),
        getMessages: vi.fn(() => [mockUserMessage]),
        updateMessage: vi.fn(),
        getMessageById: vi.fn(() => ({ id: 'assistant-msg', content: '', metadata: {} })),
      };

      mockUseMessageStore.useMessageStore.mockReturnValue(messageStore);
      mockUseMessageStore.useMessageStore.getState.mockReturnValue(messageStore);

      // Setup streaming error
      const error = new Error('Streaming failed');
      mockChatService.stream.mockImplementation(async function* () {
        mockChatService.isStreaming.mockReturnValue(true);
        // yield once to satisfy require-yield, then throw
        yield undefined as any;
        throw error;
      });

      await act(async () => {
        try {
          await result.current.sendMessage('test message');
        } catch (e) {
          // Expected error
        }
      });

      // Verify integration working by checking if stream was called
      expect(mockChatService.stream).toHaveBeenCalled();
    });

    it('should get stats from provider manager service', () => {
      const { result } = renderHook(() => useAIChat({ enabled: true }));

      const stats = result.current.getStats();

      expect(mockEngineManagerService.getStats).toHaveBeenCalled();
      expect(stats).toEqual({
        activeProvider: 'openai',
        registeredProviders: ['openai', 'gemini'],
      });
    });

    it('should track streaming state correctly', () => {
      mockChatService.isStreaming.mockReturnValue(true);

      const { result } = renderHook(() => useAIChat({ enabled: true }));

      expect(result.current.isStreaming()).toBe(true);
    });

    it('should handle empty message gracefully', async () => {
      const { result } = renderHook(() => useAIChat({ enabled: true }));

      await act(async () => {
        await result.current.sendMessage('   '); // Empty trimmed content
      });

      // Should not call stream service for empty messages
      expect(mockChatService.stream).not.toHaveBeenCalled();
    });

    it('should handle missing provider error', async () => {
      mockEngineManagerService.getActive.mockReturnValue(null);

      const { result } = renderHook(() => useAIChat({ enabled: true }));

      await act(async () => {
        try {
          await result.current.sendMessage('test message');
        } catch (e) {
          // Expected error
        }
      });

      expect(mockUseUIStore.useUIStore().setError).toHaveBeenCalledWith(
        'No active AI provider configured. Please add an API key in settings.'
      );
    });
  });

  describe('Common Functionality', () => {
    it('should provide tab extraction functionality', () => {
      const { result } = renderHook(() => useAIChat({ enabled: true }));
      expect(result.current.tabExtraction).toBe(mockUseTabExtraction);
    });

    it('should handle disabled state', () => {
      const { result } = renderHook(() => useAIChat({ enabled: false }));

      expect(result.current.sendMessage).toBeDefined();
      expect(result.current.cancelMessage).toBeDefined();
      expect(result.current.switchProvider).toBeDefined();
      expect(result.current.isStreaming).toBeDefined();
      expect(result.current.getStats).toBeDefined();
      expect(result.current.tabExtraction).toBeDefined();
    });

    it('should handle auto-initialization when enabled', async () => {
      renderHook(() => useAIChat({ enabled: true, autoInitialize: true }));

      // Wait for initialization
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      expect(mockEngineManagerService.initializeFromSettings).toHaveBeenCalled();
    });
  });
});
