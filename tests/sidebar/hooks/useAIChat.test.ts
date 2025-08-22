/**
 * @file useAIChat Hook Tests
 *
 * Comprehensive test suite for the useAIChat hook following TDD methodology.
 * Tests cover message sending, response streaming, error handling, provider
 * switching, rate limiting integration, and cancellation support.
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MockedFunction } from 'vitest';

// Import the hook we'll be testing (will be created)
import { useAIChat } from '../../../src/sidebar/hooks/useAIChat';

// Import dependencies
import { useChatStore } from '../../../src/store/chat';
import { useSettingsStore } from '../../../src/store/settings';
import { ProviderRegistry } from '../../../src/provider/ProviderRegistry';
import { ProviderFactory } from '../../../src/provider/ProviderFactory';
import { RateLimiter } from '../../../src/provider/RateLimiter';
import { RequestQueue } from '../../../src/provider/RequestQueue';

// Mock all dependencies
vi.mock('../../../src/store/chat');
vi.mock('../../../src/store/settings');
vi.mock('../../../src/provider/ProviderRegistry');
vi.mock('../../../src/provider/ProviderFactory');
vi.mock('../../../src/provider/RateLimiter');
vi.mock('../../../src/provider/RequestQueue');

// Mock Chrome runtime API
global.chrome = {
  runtime: {
    sendMessage: vi.fn().mockResolvedValue({}),
  },
} as any;

describe('useAIChat Hook', () => {
  // Mocked instances
  let mockChatStore: any;
  let mockSettingsStore: any;
  let mockRegistry: any;
  let mockFactory: any;
  let mockRateLimiter: any;
  let mockRequestQueue: any;
  let mockProvider: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock chat store
    mockChatStore = {
      addMessage: vi.fn(),
      updateMessage: vi.fn(),
      appendToMessage: vi.fn(),
      setLoading: vi.fn(),
      setError: vi.fn(),
      clearError: vi.fn(),
      setActiveMessage: vi.fn(),
      clearActiveMessage: vi.fn(),
      messages: [],
      isLoading: false,
      error: null,
      activeMessageId: null,
    };
    (useChatStore as MockedFunction<any>).mockReturnValue(mockChatStore);

    // Mock settings store
    mockSettingsStore = {
      settings: {
        selectedModel: 'gpt-5-nano',
        ai: {
          defaultProvider: 'openai',
        },
        apiKeys: {
          openai: 'sk-test-key',
          google: 'ai-test-key',
        },
        availableModels: [
          { id: 'gpt-5-nano', name: 'GPT-5 Nano', provider: 'openai', available: true },
        ],
      },
      updateAISettings: vi.fn(),
      setError: vi.fn(),
      clearError: vi.fn(),
    };
    (useSettingsStore as MockedFunction<any>).mockReturnValue(mockSettingsStore);

    // Mock provider
    mockProvider = {
      type: 'openai',
      name: 'OpenAI',
      streamChat: vi.fn(),
      chat: vi.fn(),
      testConnection: vi.fn().mockResolvedValue(true),
      getModels: vi.fn().mockResolvedValue([]),
      estimateTokens: vi.fn().mockReturnValue(10),
      formatError: vi.fn().mockReturnValue('Formatted error'),
    };

    // Mock provider registry
    mockRegistry = {
      getActiveProvider: vi.fn().mockReturnValue(mockProvider),
      getActiveProviderType: vi.fn().mockReturnValue('openai'),
      setActiveProvider: vi.fn(),
      hasProvider: vi.fn().mockReturnValue(true),
    };
    (ProviderRegistry as MockedFunction<any>).mockImplementation(() => mockRegistry);

    // Mock provider factory
    mockFactory = {
      createProvider: vi.fn().mockResolvedValue(mockProvider),
    };
    (ProviderFactory as MockedFunction<any>).mockImplementation(() => mockFactory);

    // Mock rate limiter
    mockRateLimiter = {
      checkLimit: vi.fn().mockResolvedValue({
        allowed: true,
        retryAfter: 0,
        remainingRequests: 100,
        remainingTokens: 1000,
      }),
    };
    (RateLimiter as MockedFunction<any>).mockImplementation(() => mockRateLimiter);

    // Mock request queue
    mockRequestQueue = {
      enqueue: vi.fn().mockImplementation(async requestFn => {
        // Execute the request immediately in tests
        return await requestFn();
      }),
      cancel: vi.fn(),
      getStats: vi.fn().mockReturnValue({
        totalQueued: 0,
        currentSize: 0,
        processing: 0,
        completed: 0,
        failed: 0,
      }),
    };
    (RequestQueue as MockedFunction<any>).mockImplementation(() => mockRequestQueue);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with proper dependencies', () => {
      const { result } = renderHook(() => useAIChat());

      expect(result.current).toHaveProperty('sendMessage');
      expect(result.current).toHaveProperty('cancelMessage');
      expect(result.current).toHaveProperty('switchProvider');
      expect(result.current).toHaveProperty('isStreaming');
      expect(typeof result.current.sendMessage).toBe('function');
      expect(typeof result.current.cancelMessage).toBe('function');
      expect(typeof result.current.switchProvider).toBe('function');
      expect(typeof result.current.isStreaming).toBe('function');
    });

    it('should initialize provider registry and factory', () => {
      renderHook(() => useAIChat());

      expect(ProviderRegistry).toHaveBeenCalledTimes(1);
      expect(ProviderFactory).toHaveBeenCalledTimes(1);
      expect(RateLimiter).toHaveBeenCalledTimes(1);
      expect(RequestQueue).toHaveBeenCalledTimes(1);
    });
  });

  describe('Message Sending', () => {
    it('should send message to active provider', async () => {
      const mockResponse = { content: 'Test response' };
      mockProvider.chat.mockResolvedValue(mockResponse);
      mockChatStore.addMessage.mockReturnValue({ id: 'msg-1' });

      const { result } = renderHook(() => useAIChat());

      await act(async () => {
        await result.current.sendMessage('Hello');
      });

      // Should add user message
      expect(mockChatStore.addMessage).toHaveBeenCalledWith({
        role: 'user',
        content: 'Hello',
        status: 'sending',
      });

      // Should set loading state
      expect(mockChatStore.setLoading).toHaveBeenCalledWith(true);

      // Should enqueue request
      expect(mockRequestQueue.enqueue).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          provider: 'openai',
          priority: 'high',
          tokens: 10, // from estimateTokens mock
        })
      );
    });

    it('should handle provider estimation errors gracefully', async () => {
      mockProvider.estimateTokens.mockImplementation(() => {
        throw new Error('Token estimation failed');
      });

      const { result } = renderHook(() => useAIChat());

      await act(async () => {
        await result.current.sendMessage('Hello');
      });

      // Should use default token estimate (100)
      expect(mockRequestQueue.enqueue).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          tokens: 100,
        })
      );
    });

    it('should handle missing active provider', async () => {
      mockRegistry.getActiveProvider.mockReturnValue(null);

      const { result } = renderHook(() => useAIChat());

      await act(async () => {
        await result.current.sendMessage('Hello');
      });

      expect(mockChatStore.setError).toHaveBeenCalledWith('No active AI provider configured');
      expect(mockChatStore.setLoading).toHaveBeenCalledWith(false);
    });

    it('should handle empty messages', async () => {
      const { result } = renderHook(() => useAIChat());

      await act(async () => {
        await result.current.sendMessage('');
      });

      expect(mockChatStore.addMessage).not.toHaveBeenCalled();
      expect(mockRequestQueue.enqueue).not.toHaveBeenCalled();
    });

    it('should handle whitespace-only messages', async () => {
      const { result } = renderHook(() => useAIChat());

      await act(async () => {
        await result.current.sendMessage('   \n\t  ');
      });

      expect(mockChatStore.addMessage).not.toHaveBeenCalled();
      expect(mockRequestQueue.enqueue).not.toHaveBeenCalled();
    });
  });

  describe('Response Streaming', () => {
    it('should handle streaming responses', async () => {
      const mockStreamGenerator = async function* () {
        yield { choices: [{ delta: { content: 'Hello' } }] };
        yield { choices: [{ delta: { content: ' world' } }] };
        yield { choices: [{ delta: { content: '!' } }] };
      };

      mockProvider.streamChat.mockReturnValue(mockStreamGenerator());
      mockChatStore.addMessage.mockReturnValue({ id: 'msg-1' });

      const { result } = renderHook(() => useAIChat());

      await act(async () => {
        await result.current.sendMessage('Hello', { streaming: true });
      });

      // Should create assistant message
      expect(mockChatStore.addMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'assistant',
          content: '',
          status: 'streaming',
        })
      );
    });

    it('should append streaming content to message', async () => {
      const mockStreamGenerator = async function* () {
        yield { choices: [{ delta: { content: 'Hello' } }] };
        yield { choices: [{ delta: { content: ' world' } }] };
      };

      mockProvider.streamChat.mockReturnValue(mockStreamGenerator());
      mockChatStore.addMessage.mockReturnValue({ id: 'msg-1' });

      // Request queue is already mocked to execute immediately

      const { result } = renderHook(() => useAIChat());

      await act(async () => {
        await result.current.sendMessage('Hello', { streaming: true });
      });

      // Should append content for each chunk
      expect(mockChatStore.appendToMessage).toHaveBeenCalledWith('msg-1', 'Hello');
      expect(mockChatStore.appendToMessage).toHaveBeenCalledWith('msg-1', ' world');
    });

    it('should handle streaming errors', async () => {
      const mockStreamGenerator = async function* () {
        yield { choices: [{ delta: { content: 'Hello' } }] };
        throw new Error('Streaming error');
      };

      mockProvider.streamChat.mockReturnValue(mockStreamGenerator());
      mockProvider.formatError.mockReturnValue({ message: 'Streaming error' });
      mockChatStore.addMessage
        .mockReturnValueOnce({ id: 'user-msg-1' })
        .mockReturnValueOnce({ id: 'assistant-msg-1' });

      const { result } = renderHook(() => useAIChat());

      await act(async () => {
        await result.current.sendMessage('Hello', { streaming: true });
      });

      expect(mockChatStore.updateMessage).toHaveBeenCalledWith('assistant-msg-1', {
        status: 'error',
        error: 'Streaming error',
      });
    });

    it('should complete streaming successfully', async () => {
      const mockStreamGenerator = async function* () {
        yield { choices: [{ delta: { content: 'Complete response' } }] };
      };

      mockProvider.streamChat.mockReturnValue(mockStreamGenerator());
      mockChatStore.addMessage.mockReturnValue({ id: 'msg-1' });

      // Request queue is already mocked to execute immediately

      const { result } = renderHook(() => useAIChat());

      await act(async () => {
        await result.current.sendMessage('Hello', { streaming: true });
      });

      expect(mockChatStore.updateMessage).toHaveBeenCalledWith('msg-1', {
        status: 'received',
      });
      expect(mockChatStore.clearActiveMessage).toHaveBeenCalled();
      expect(mockChatStore.setLoading).toHaveBeenCalledWith(false);
    });
  });

  describe('Error Handling', () => {
    it('should display provider errors gracefully', async () => {
      const providerError = new Error('API quota exceeded');
      mockProvider.chat.mockRejectedValue(providerError);
      mockProvider.formatError.mockReturnValue({
        message: 'Rate limit exceeded. Please try again later.',
      });

      mockChatStore.addMessage.mockReturnValue({ id: 'msg-1' });

      const { result } = renderHook(() => useAIChat());

      await act(async () => {
        await result.current.sendMessage('Hello');
      });

      expect(mockChatStore.setError).toHaveBeenCalledWith(
        'Rate limit exceeded. Please try again later.'
      );
      expect(mockChatStore.setLoading).toHaveBeenCalledWith(false);
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network request failed');
      mockProvider.chat.mockRejectedValue(networkError);
      mockProvider.formatError.mockReturnValue({
        message: 'Network error. Please check your connection.',
      });

      const { result } = renderHook(() => useAIChat());

      await act(async () => {
        await result.current.sendMessage('Hello');
      });

      expect(mockChatStore.setError).toHaveBeenCalledWith(
        'Network error. Please check your connection.'
      );
    });

    it('should handle authentication errors', async () => {
      const authError = new Error('Invalid API key');
      mockProvider.chat.mockRejectedValue(authError);
      mockProvider.formatError.mockReturnValue({
        message: 'Invalid API key. Please check your settings.',
      });

      const { result } = renderHook(() => useAIChat());

      await act(async () => {
        await result.current.sendMessage('Hello');
      });

      expect(mockChatStore.setError).toHaveBeenCalledWith(
        'Invalid API key. Please check your settings.'
      );
    });

    it('should clear errors on successful send', async () => {
      mockProvider.chat.mockResolvedValue({ content: 'Success' });
      mockChatStore.addMessage.mockReturnValue({ id: 'msg-1' });

      const { result } = renderHook(() => useAIChat());

      await act(async () => {
        await result.current.sendMessage('Hello');
      });

      expect(mockChatStore.clearError).toHaveBeenCalled();
    });
  });

  describe('Provider Switching', () => {
    it('should switch between providers', async () => {
      const { result } = renderHook(() => useAIChat());

      await act(async () => {
        await result.current.switchProvider('gemini');
      });

      expect(mockRegistry.setActiveProvider).toHaveBeenCalledWith('gemini');
      expect(mockSettingsStore.updateAISettings).toHaveBeenCalledWith({
        defaultProvider: 'gemini',
      });
    });

    it('should handle provider switching errors', async () => {
      mockRegistry.setActiveProvider.mockImplementation(() => {
        throw new Error('Provider not found: invalid');
      });

      const { result } = renderHook(() => useAIChat());

      await act(async () => {
        await result.current.switchProvider('invalid' as any);
      });

      expect(mockChatStore.setError).toHaveBeenCalledWith(
        'Failed to switch provider: Provider not found: invalid'
      );
    });

    it('should clear errors on successful provider switch', async () => {
      const { result } = renderHook(() => useAIChat());

      await act(async () => {
        await result.current.switchProvider('gemini');
      });

      expect(mockChatStore.clearError).toHaveBeenCalled();
      expect(mockSettingsStore.clearError).toHaveBeenCalled();
    });

    it('should update active provider in settings', async () => {
      const { result } = renderHook(() => useAIChat());

      await act(async () => {
        await result.current.switchProvider('openrouter');
      });

      expect(mockSettingsStore.updateAISettings).toHaveBeenCalledWith({
        defaultProvider: 'openrouter',
      });
    });
  });

  describe('Rate Limiting Integration', () => {
    it('should check rate limits before sending', async () => {
      mockProvider.chat.mockResolvedValue({ content: 'Response' });
      mockChatStore.addMessage.mockReturnValue({ id: 'msg-1' });

      const { result } = renderHook(() => useAIChat());

      await act(async () => {
        await result.current.sendMessage('Hello');
      });

      expect(mockRequestQueue.enqueue).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          provider: 'openai',
          tokens: 10,
          priority: 'high',
        })
      );
    });

    it('should handle rate limit denials', async () => {
      mockRateLimiter.checkLimit.mockResolvedValue({
        allowed: false,
        retryAfter: 5000,
        remainingRequests: 0,
        remainingTokens: 0,
        reason: 'Request rate limit exceeded',
      });

      const { result } = renderHook(() => useAIChat());

      await act(async () => {
        await result.current.sendMessage('Hello');
      });

      // The request queue should handle the rate limiting and retries
      expect(mockRequestQueue.enqueue).toHaveBeenCalled();
    });

    it('should estimate tokens correctly', async () => {
      mockProvider.estimateTokens.mockReturnValue(25);
      mockProvider.chat.mockResolvedValue({ content: 'Response' });

      const { result } = renderHook(() => useAIChat());

      await act(async () => {
        await result.current.sendMessage('This is a longer message that should use more tokens');
      });

      expect(mockProvider.estimateTokens).toHaveBeenCalledWith(
        'This is a longer message that should use more tokens'
      );
      expect(mockRequestQueue.enqueue).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          tokens: 25,
        })
      );
    });
  });

  describe('Message Cancellation', () => {
    it('should support message cancellation', async () => {
      const { result } = renderHook(() => useAIChat());

      // Start a message to have something to cancel
      act(() => {
        result.current.sendMessage('Hello');
      });

      act(() => {
        result.current.cancelMessage();
      });

      expect(mockRequestQueue.cancel).toHaveBeenCalled();
      expect(mockChatStore.clearActiveMessage).toHaveBeenCalled();
      expect(mockChatStore.setLoading).toHaveBeenCalledWith(false);
    });

    it('should cancel streaming messages', async () => {
      const mockStreamGenerator = async function* () {
        yield {
          id: 's1',
          object: 'response.chunk',
          created: Date.now(),
          model: 'test',
          choices: [{ index: 0, delta: { content: 'Start' }, finishReason: null }],
        } as any;
        // This would continue, but should be cancelled
        yield {
          id: 's2',
          object: 'response.chunk',
          created: Date.now(),
          model: 'test',
          choices: [{ index: 0, delta: { content: 'Never reached' }, finishReason: null }],
        } as any;
      };

      mockProvider.streamChat.mockReturnValue(mockStreamGenerator());
      mockChatStore.addMessage.mockReturnValue({ id: 'msg-1' });

      const { result } = renderHook(() => useAIChat());

      // Start streaming
      act(() => {
        result.current.sendMessage('Hello', { streaming: true });
      });

      // Cancel immediately
      act(() => {
        result.current.cancelMessage();
      });

      expect(mockRequestQueue.cancel).toHaveBeenCalled();
    });

    it('should clear active message on cancellation', () => {
      const { result } = renderHook(() => useAIChat());

      act(() => {
        result.current.cancelMessage();
      });

      expect(mockChatStore.clearActiveMessage).toHaveBeenCalled();
      expect(mockChatStore.setLoading).toHaveBeenCalledWith(false);
    });
  });

  describe('Streaming State', () => {
    it('should track streaming state correctly', () => {
      const { result } = renderHook(() => useAIChat());

      // Initially not streaming
      expect(result.current.isStreaming()).toBe(false);

      // Set active message ID to simulate streaming
      mockChatStore.activeMessageId = 'msg-1';
      expect(result.current.isStreaming()).toBe(true);

      // Clear active message
      mockChatStore.activeMessageId = null;
      expect(result.current.isStreaming()).toBe(false);
    });

    it('should set active message during streaming', async () => {
      const mockStreamGenerator = async function* () {
        yield {
          id: 's1',
          object: 'response.chunk',
          created: Date.now(),
          model: 'test',
          choices: [{ index: 0, delta: { content: 'Streaming...' }, finishReason: null }],
        } as any;
      };

      mockProvider.streamChat.mockReturnValue(mockStreamGenerator());
      mockChatStore.addMessage.mockReturnValue({ id: 'msg-1' });

      const { result } = renderHook(() => useAIChat());

      await act(async () => {
        await result.current.sendMessage('Hello', { streaming: true });
      });

      expect(mockChatStore.setActiveMessage).toHaveBeenCalledWith('msg-1');
    });
  });

  describe('Chat Store Integration', () => {
    it('should update chat store with messages', async () => {
      mockProvider.chat.mockResolvedValue({ content: 'AI Response' });
      mockChatStore.addMessage.mockReturnValue({ id: 'user-msg' });

      const { result } = renderHook(() => useAIChat());

      await act(async () => {
        await result.current.sendMessage('Hello', { streaming: false });
      });

      // Should add user message
      expect(mockChatStore.addMessage).toHaveBeenCalledWith({
        role: 'user',
        content: 'Hello',
        status: 'sending',
      });

      // Should add AI response
      expect(mockChatStore.addMessage).toHaveBeenCalledWith({
        role: 'assistant',
        content: 'AI Response',
        status: 'received',
      });
    });

    it('should handle loading states correctly', async () => {
      mockProvider.chat.mockResolvedValue({ content: 'Response' });

      // Request queue is already mocked to execute immediately

      const { result } = renderHook(() => useAIChat());

      await act(async () => {
        await result.current.sendMessage('Hello');
      });

      expect(mockChatStore.setLoading).toHaveBeenCalledWith(true);
      expect(mockChatStore.setLoading).toHaveBeenCalledWith(false);
    });

    it('should mark user message as sent after successful response', async () => {
      mockProvider.chat.mockResolvedValue({ content: 'Response' });
      mockChatStore.addMessage.mockReturnValue({ id: 'user-msg' });

      const { result } = renderHook(() => useAIChat());

      await act(async () => {
        await result.current.sendMessage('Hello', { streaming: false });
      });

      expect(mockChatStore.updateMessage).toHaveBeenCalledWith('user-msg', {
        status: 'sent',
      });
    });
  });

  describe('Configuration Options', () => {
    it('should accept streaming option', async () => {
      const { result } = renderHook(() => useAIChat());

      await act(async () => {
        await result.current.sendMessage('Hello', { streaming: false });
      });

      expect(mockProvider.chat).toHaveBeenCalled();
      expect(mockProvider.streamChat).not.toHaveBeenCalled();
    });

    it('should accept custom priority', async () => {
      const { result } = renderHook(() => useAIChat());

      await act(async () => {
        await result.current.sendMessage('Hello', { priority: 'medium' });
      });

      expect(mockRequestQueue.enqueue).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          priority: 'medium',
        })
      );
    });

    it('should default to high priority', async () => {
      const { result } = renderHook(() => useAIChat());

      await act(async () => {
        await result.current.sendMessage('Hello');
      });

      expect(mockRequestQueue.enqueue).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          priority: 'high',
        })
      );
    });
  });

  describe('Cleanup and Memory Management', () => {
    it('should cleanup resources on unmount', async () => {
      // Mock a delayed request to simulate ongoing operation
      const delayedPromise = new Promise(resolve =>
        setTimeout(() => resolve({ content: 'Response' }), 100)
      );
      mockRequestQueue.enqueue.mockReturnValue(delayedPromise);

      const { result, unmount } = renderHook(() => useAIChat());

      // Start a request
      act(() => {
        result.current.sendMessage('Hello');
      });

      // Unmount while request might be pending
      unmount();

      // Should attempt to cancel the request
      expect(mockRequestQueue.cancel).toHaveBeenCalled();
    });

    it('should handle component re-renders without issues', () => {
      const { rerender } = renderHook(() => useAIChat());

      expect(() => {
        rerender();
        rerender();
        rerender();
      }).not.toThrow();
    });
  });
});
