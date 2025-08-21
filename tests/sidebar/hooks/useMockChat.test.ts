/**
 * @file Tests for useMockChat hook
 *
 * Tests the useMockChat hook functionality in its new location within the sidebar module.
 * Tests integration with chat store and streaming functionality.
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useMockChat } from '@/sidebar/hooks/useMockChat';
import { useChatStore } from '@/store/chat';
import * as mockChatUtils from '@/utils/mockChat';

// Mock the chat store
vi.mock('@/store/chat');
const mockUseChatStore = useChatStore as Mock;

// Mock the mockChat utilities
vi.mock('@/utils/mockChat');

describe('useMockChat Hook', () => {
  const mockAddMessage = vi.fn();
  const mockUpdateMessage = vi.fn();
  const mockSetLoading = vi.fn();
  const mockMessages: any[] = [];

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup chat store mock
    mockUseChatStore.mockReturnValue({
      addMessage: mockAddMessage,
      updateMessage: mockUpdateMessage,
      setLoading: mockSetLoading,
      messages: mockMessages,
    });

    // Setup getState mock for direct access
    mockUseChatStore.getState = vi.fn().mockReturnValue({
      messages: mockMessages,
    });

    // Setup mock response generation
    vi.mocked(mockChatUtils.generateMockResponse).mockReturnValue({
      content: 'Mock response content',
      type: 'text',
    });

    // Setup streaming simulation
    vi.mocked(mockChatUtils.simulateStreaming).mockImplementation(async (content, options) => {
      // Simulate immediate streaming completion
      options?.onChunk?.('Mock response content', { isComplete: true });
      options?.onComplete?.();
    });

    // Reset mock message creation
    mockAddMessage.mockReturnValue({
      id: 'test-message-id',
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      status: 'sending',
    });
  });

  describe('Hook Initialization', () => {
    it('should initialize with default options', () => {
      const { result } = renderHook(() => useMockChat());

      expect(result.current).toHaveProperty('generateResponse');
      expect(result.current).toHaveProperty('cancelStreaming');
      expect(result.current).toHaveProperty('isStreaming');
    });

    it('should initialize with custom options', () => {
      const options = {
        enabled: false,
        responseType: 'code' as const,
        streamingSpeed: 'fast' as const,
        thinkingDelay: 500,
      };

      const { result } = renderHook(() => useMockChat(options));

      expect(result.current).toHaveProperty('generateResponse');
      expect(result.current).toHaveProperty('cancelStreaming');
      expect(result.current).toHaveProperty('isStreaming');
    });
  });

  describe('Message Generation', () => {
    it('should generate response when enabled', async () => {
      const { result } = renderHook(() => useMockChat({ enabled: true }));

      await act(async () => {
        await result.current.generateResponse('Hello, how are you?');
      });

      expect(mockSetLoading).toHaveBeenCalledWith(true);
      expect(mockChatUtils.generateMockResponse).toHaveBeenCalledWith(
        'text',
        'Hello, how are you?'
      );
      expect(mockAddMessage).toHaveBeenCalledWith({
        role: 'assistant',
        content: '',
        status: 'sending',
      });
    });

    it('should not generate response when disabled', async () => {
      const { result } = renderHook(() => useMockChat({ enabled: false }));

      await act(async () => {
        await result.current.generateResponse('Hello, how are you?');
      });

      expect(mockChatUtils.generateMockResponse).not.toHaveBeenCalled();
      expect(mockAddMessage).not.toHaveBeenCalled();
    });

    it('should use correct response type', async () => {
      const { result } = renderHook(() => useMockChat({ responseType: 'code' }));

      await act(async () => {
        await result.current.generateResponse('Write some code');
      });

      expect(mockChatUtils.generateMockResponse).toHaveBeenCalledWith('code', 'Write some code');
    });
  });

  describe('Streaming Functionality', () => {
    it('should handle streaming chunks correctly', async () => {
      const { result } = renderHook(() => useMockChat());

      // Mock message in store
      const testMessage = {
        id: 'test-message-id',
        role: 'assistant' as const,
        content: '',
        timestamp: Date.now(),
        status: 'sending' as const,
      };
      mockMessages.push(testMessage);

      // Mock streaming with multiple chunks
      vi.mocked(mockChatUtils.simulateStreaming).mockImplementation(async (content, options) => {
        // Simulate chunk updates
        options?.onChunk?.('Hello', { isComplete: false });
        options?.onChunk?.(' world', { isComplete: false });
        options?.onChunk?.('!', { isComplete: true });
        options?.onComplete?.();
      });

      await act(async () => {
        await result.current.generateResponse('Hello');
      });

      expect(mockUpdateMessage).toHaveBeenCalledTimes(4); // 3 chunks + 1 completion
      expect(mockSetLoading).toHaveBeenCalledWith(false);
    });

    it('should handle streaming completion', async () => {
      const { result } = renderHook(() => useMockChat());

      await act(async () => {
        await result.current.generateResponse('Test message');
      });

      expect(mockUpdateMessage).toHaveBeenCalledWith('test-message-id', {
        status: 'sent',
      });
      expect(mockSetLoading).toHaveBeenCalledWith(false);
    });

    it('should handle streaming errors', async () => {
      const { result } = renderHook(() => useMockChat());

      // Mock streaming error
      vi.mocked(mockChatUtils.simulateStreaming).mockImplementation(async (content, options) => {
        options?.onError?.(new Error('Streaming failed'));
      });

      await act(async () => {
        await result.current.generateResponse('Test message');
      });

      expect(mockUpdateMessage).toHaveBeenCalledWith('test-message-id', {
        status: 'error',
        error: 'Streaming failed',
      });
      expect(mockSetLoading).toHaveBeenCalledWith(false);
    });
  });

  describe('Streaming Control', () => {
    it('should track streaming state correctly', async () => {
      const { result } = renderHook(() => useMockChat());

      expect(result.current.isStreaming()).toBe(false);

      // Start streaming (don't complete immediately)
      vi.mocked(mockChatUtils.simulateStreaming).mockImplementation(async (content, options) => {
        // Don't call onComplete immediately
        options?.onChunk?.('Streaming...', { isComplete: false });
      });

      await act(async () => {
        result.current.generateResponse('Test message');
      });

      // Should be streaming after message starts
      expect(result.current.isStreaming()).toBe(true); // Actually streaming since message was added
    });

    it('should cancel streaming correctly', async () => {
      const { result } = renderHook(() => useMockChat());

      // Start streaming
      await act(async () => {
        result.current.generateResponse('Test message');
      });

      // Cancel streaming
      act(() => {
        result.current.cancelStreaming();
      });

      expect(mockUpdateMessage).toHaveBeenCalledWith('test-message-id', {
        status: 'sent',
      });
      expect(mockSetLoading).toHaveBeenCalledWith(false);
    });

    it('should abort previous streaming when starting new one', async () => {
      const { result } = renderHook(() => useMockChat());

      // Start first streaming
      await act(async () => {
        await result.current.generateResponse('First message');
      });

      // Start second streaming (should abort first)
      await act(async () => {
        await result.current.generateResponse('Second message');
      });

      // Should have set loading twice (once for each message)
      expect(mockSetLoading).toHaveBeenCalledWith(true);
      expect(mockAddMessage).toHaveBeenCalledTimes(2);
    });
  });

  describe('Integration with Chat Store', () => {
    it('should integrate properly with chat store', async () => {
      const { result } = renderHook(() => useMockChat());

      await act(async () => {
        await result.current.generateResponse('Integration test');
      });

      expect(mockUseChatStore).toHaveBeenCalled();
      expect(mockAddMessage).toHaveBeenCalled();
      expect(mockUpdateMessage).toHaveBeenCalled();
      expect(mockSetLoading).toHaveBeenCalled();
    });

    it('should handle store state access correctly', async () => {
      const testMessage = {
        id: 'test-message-id',
        role: 'assistant' as const,
        content: 'Previous content',
        timestamp: Date.now(),
        status: 'sending' as const,
      };
      mockMessages.push(testMessage);

      const { result } = renderHook(() => useMockChat());

      vi.mocked(mockChatUtils.simulateStreaming).mockImplementation(async (content, options) => {
        options?.onChunk?.(' new content', { isComplete: false });
        options?.onComplete?.();
      });

      await act(async () => {
        await result.current.generateResponse('Test message');
      });

      expect(mockUseChatStore.getState).toHaveBeenCalled();
    });
  });

  describe('Custom Configuration', () => {
    it('should respect custom streaming speed', async () => {
      const { result } = renderHook(() => useMockChat({ streamingSpeed: 'fast' }));

      await act(async () => {
        await result.current.generateResponse('Speed test');
      });

      expect(mockChatUtils.simulateStreaming).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          speed: 'fast',
        })
      );
    });

    it('should respect custom thinking delay', async () => {
      const { result } = renderHook(() => useMockChat({ thinkingDelay: 2000 }));

      await act(async () => {
        await result.current.generateResponse('Delay test');
      });

      expect(mockChatUtils.simulateStreaming).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          thinkingDelay: 2000,
        })
      );
    });
  });
});
