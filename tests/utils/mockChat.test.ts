/**
 * @file Mock Chat Test Suite
 *
 * Comprehensive tests for the mock chat system that provides realistic
 * AI responses and streaming simulation for testing the chat UI components.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// ChatMessage type is available through generateMockResponse return type
import {
  generateMockResponse,
  generateMockConversation,
  simulateStreaming,
  generateMockError,
  createMockMessage,
} from '@/utils/mockChat';

// Mock timers for testing streaming
vi.useFakeTimers();

describe('mockChat utilities', () => {
  beforeEach(() => {
    vi.clearAllTimers();
  });

  afterEach(() => {
    vi.runAllTimers();
  });

  describe('createMockMessage', () => {
    it('should create a basic user message with defaults', () => {
      const message = createMockMessage({
        role: 'user',
        content: 'Hello world',
      });

      expect(message).toMatchObject({
        role: 'user',
        content: 'Hello world',
        status: 'sent',
        timestamp: expect.any(Date),
        id: expect.stringMatching(/^msg_\d+_[a-z0-9]{7}$/),
      });
    });

    it('should create an assistant message with custom options', () => {
      const customTimestamp = new Date('2023-12-01T10:00:00Z');
      const customId = 'custom-message-id';

      const message = createMockMessage({
        role: 'assistant',
        content: 'How can I help you?',
        id: customId,
        timestamp: customTimestamp,
        status: 'streaming',
        metadata: { model: 'gpt-4' },
      });

      expect(message).toMatchObject({
        id: customId,
        role: 'assistant',
        content: 'How can I help you?',
        timestamp: customTimestamp,
        status: 'streaming',
        metadata: { model: 'gpt-4' },
      });
    });

    it('should create a system message with proper defaults', () => {
      const message = createMockMessage({
        role: 'system',
        content: 'System initialized',
      });

      expect(message).toMatchObject({
        role: 'system',
        content: 'System initialized',
        status: 'received',
      });
    });

    it('should handle error messages', () => {
      const message = createMockMessage({
        role: 'assistant',
        content: '',
        status: 'error',
        error: 'Failed to generate response',
      });

      expect(message).toMatchObject({
        role: 'assistant',
        content: '',
        status: 'error',
        error: 'Failed to generate response',
      });
    });
  });

  describe('generateMockResponse', () => {
    it('should generate a text response', () => {
      const response = generateMockResponse('text');
      
      expect(response).toEqual({
        content: expect.any(String),
        type: 'text',
        metadata: expect.objectContaining({
          responseTime: expect.any(Number),
          tokens: expect.any(Number),
        }),
      });

      expect(response.content.length).toBeGreaterThan(10);
      expect(response.metadata.tokens).toBeGreaterThan(0);
      expect(response.metadata.responseTime).toBeGreaterThan(0);
    });

    it('should generate a code response with proper structure', () => {
      const response = generateMockResponse('code');
      
      expect(response.content).toContain('```');
      expect(response.type).toBe('code');
      expect(response.metadata.tokens).toBeGreaterThan(0);
    });

    it('should generate a list response', () => {
      const response = generateMockResponse('list');
      
      expect(response.content).toMatch(/^\d+\./m); // Should contain numbered items
      expect(response.type).toBe('list');
    });

    it('should generate a table response with markdown table syntax', () => {
      const response = generateMockResponse('table');
      
      expect(response.content).toContain('|');
      expect(response.content).toContain('---');
      expect(response.type).toBe('table');
    });

    it('should generate a long response with significant content', () => {
      const response = generateMockResponse('long');
      
      expect(response.content.length).toBeGreaterThan(500);
      expect(response.type).toBe('long');
    });

    it('should accept custom prompt and incorporate it', () => {
      const customPrompt = 'Tell me about React hooks';
      const response = generateMockResponse('text', customPrompt);
      
      expect(response.content.toLowerCase()).toContain('react');
      expect(response.metadata.prompt).toBe(customPrompt);
    });

    it('should generate responses with varying lengths', () => {
      const responses = Array.from({ length: 10 }, () => generateMockResponse('text'));
      const lengths = responses.map(r => r.content.length);
      
      // Should have some variation in response lengths
      const uniqueLengths = new Set(lengths);
      expect(uniqueLengths.size).toBeGreaterThan(1);
    });
  });

  describe('generateMockError', () => {
    it('should generate a network error', () => {
      const error = generateMockError('network');
      
      expect(error).toMatchObject({
        message: expect.any(String),
        code: 'NETWORK_ERROR',
        type: 'network',
        recoverable: true,
      });
      
      // Message should be one of the expected network error messages
      const expectedMessages = [
        'Network connection failed. Please check your internet connection.',
        'Unable to reach the AI service. The network may be temporarily unavailable.',
        'Network timeout. Please try again later.',
      ];
      expect(expectedMessages).toContain(error.message);
    });

    it('should generate an API error', () => {
      const error = generateMockError('api');
      
      expect(error).toMatchObject({
        message: expect.any(String),
        code: expect.stringMatching(/^(API_ERROR|RATE_LIMIT|UNAUTHORIZED)$/),
        type: 'api',
        recoverable: expect.any(Boolean),
      });
    });

    it('should generate a parsing error', () => {
      const error = generateMockError('parsing');
      
      expect(error).toMatchObject({
        message: expect.any(String),
        code: 'PARSING_ERROR',
        type: 'parsing',
        recoverable: false,
      });
      
      // Message should be one of the expected parsing error messages
      const expectedMessages = [
        'Failed to parse the AI response. The format was unexpected.',
        'Parse error: Invalid response format received from the AI service.',
        'Error parsing the AI response. Please try again.',
      ];
      expect(expectedMessages).toContain(error.message);
    });

    it('should generate a timeout error', () => {
      const error = generateMockError('timeout');
      
      expect(error).toMatchObject({
        message: expect.any(String),
        code: 'TIMEOUT_ERROR',
        type: 'timeout',
        recoverable: true,
      });
      
      // Message should be one of the expected timeout error messages
      const expectedMessages = [
        'Request timeout. The AI is taking too long to respond.',
        'Response timeout. Please try with a shorter message.',
        'The request took too long to complete.',
      ];
      expect(expectedMessages).toContain(error.message);
    });

    it('should generate a generic error by default', () => {
      const error = generateMockError();
      
      expect(error).toMatchObject({
        message: expect.any(String),
        code: expect.any(String),
        type: 'generic',
        recoverable: expect.any(Boolean),
      });
    });
  });

  describe('generateMockConversation', () => {
    it('should generate a greeting conversation', () => {
      const conversation = generateMockConversation('greeting');
      
      expect(conversation.length).toBeGreaterThan(1);
      expect(conversation[0].role).toBe('user');
      expect(conversation[0].content.toLowerCase()).toMatch(/(hello|hi|hey)/);
      expect(conversation[1].role).toBe('assistant');
    });

    it('should generate a coding conversation', () => {
      const conversation = generateMockConversation('coding');
      
      expect(conversation.length).toBeGreaterThan(1);
      expect(conversation.some(msg => 
        msg.content.toLowerCase().includes('code') || 
        msg.content.includes('```')
      )).toBe(true);
    });

    it('should generate a help conversation', () => {
      const conversation = generateMockConversation('help');
      
      expect(conversation.length).toBeGreaterThan(1);
      expect(conversation[0].content.toLowerCase()).toMatch(/(help|how|what)/);
    });

    it('should generate an error conversation', () => {
      const conversation = generateMockConversation('error');
      
      expect(conversation.length).toBeGreaterThan(1);
      expect(conversation.some(msg => msg.status === 'error')).toBe(true);
    });

    it('should generate a long conversation', () => {
      const conversation = generateMockConversation('long');
      
      expect(conversation.length).toBeGreaterThanOrEqual(6);
      expect(conversation.filter(msg => msg.role === 'user').length).toBeGreaterThanOrEqual(3);
      expect(conversation.filter(msg => msg.role === 'assistant').length).toBeGreaterThanOrEqual(3);
    });

    it('should create conversation with proper message flow', () => {
      const conversation = generateMockConversation('greeting');
      
      // Check that messages have increasing timestamps
      for (let i = 1; i < conversation.length; i++) {
        expect(conversation[i].timestamp.getTime()).toBeGreaterThanOrEqual(
          conversation[i - 1].timestamp.getTime()
        );
      }
      
      // Check that messages have unique IDs
      const ids = conversation.map(msg => msg.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('should handle custom message count', () => {
      const conversation = generateMockConversation('greeting', { messageCount: 6 });
      
      expect(conversation.length).toBe(6);
    });
  });

  describe('simulateStreaming', () => {
    it('should simulate streaming with default options', async () => {
      const onChunk = vi.fn();
      const onComplete = vi.fn();
      const onError = vi.fn();

      const promise = simulateStreaming('Hello world', {
        onChunk,
        onComplete,
        onError,
      });

      // Fast forward time to complete streaming
      await vi.advanceTimersByTimeAsync(5000);
      await promise;

      expect(onChunk).toHaveBeenCalled();
      expect(onComplete).toHaveBeenCalledWith('Hello world');
      expect(onError).not.toHaveBeenCalled();
      
      // Check that chunks were called with progressive content
      const calls = onChunk.mock.calls;
      expect(calls.length).toBeGreaterThan(1);
      
      // Each call should have more content than the previous
      for (let i = 1; i < calls.length; i++) {
        expect(calls[i][0].length).toBeGreaterThanOrEqual(calls[i - 1][0].length);
      }
    });

    it('should respect custom streaming speed', async () => {
      const onChunk = vi.fn();
      const onComplete = vi.fn();

      const promise = simulateStreaming('Test', {
        onChunk,
        onComplete,
        speed: 'fast',
      });

      await vi.advanceTimersByTimeAsync(1000);
      await promise;

      expect(onComplete).toHaveBeenCalled();
    });

    it('should simulate slow streaming', async () => {
      const onChunk = vi.fn();
      
      const promise = simulateStreaming('Slow test', {
        onChunk,
        speed: 'slow',
      });

      // Should not complete quickly
      await vi.advanceTimersByTimeAsync(1000);
      expect(onChunk).toHaveBeenCalled();
      
      // Complete the streaming
      await vi.advanceTimersByTimeAsync(10000);
      await promise;
    });

    it('should handle streaming errors', async () => {
      const onChunk = vi.fn();
      const onError = vi.fn();
      const onComplete = vi.fn();

      const promise = simulateStreaming('Error test', {
        onChunk,
        onError,
        onComplete,
        shouldError: true,
      });

      await vi.advanceTimersByTimeAsync(5000);
      await promise;

      expect(onError).toHaveBeenCalled();
      expect(onComplete).not.toHaveBeenCalled();
    });

    it('should include thinking delay', async () => {
      const onChunk = vi.fn();

      const promise = simulateStreaming('Test with delay', {
        onChunk,
        thinkingDelay: 1000,
      });

      // Should not start streaming immediately
      await vi.advanceTimersByTimeAsync(500);
      expect(onChunk).not.toHaveBeenCalled();

      // Should start after thinking delay
      await vi.advanceTimersByTimeAsync(1000);
      expect(onChunk).toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(5000);
      await promise;
    });

    it('should handle chunking correctly', async () => {
      const onChunk = vi.fn();
      const text = 'This is a test message for chunking';

      const promise = simulateStreaming(text, {
        onChunk,
        chunkSize: 5,
      });

      await vi.advanceTimersByTimeAsync(10000);
      await promise;

      const calls = onChunk.mock.calls;
      expect(calls.length).toBeGreaterThan(1);
      
      // Should have progressive chunks
      expect(calls[0][0]).toBe('This');
      expect(calls[1][0]).toBe('This is a');
    });

    it('should provide streaming metadata', async () => {
      const onChunk = vi.fn();

      const promise = simulateStreaming('Test metadata', {
        onChunk,
      });

      await vi.advanceTimersByTimeAsync(5000);
      await promise;

      const lastCall = onChunk.mock.calls[onChunk.mock.calls.length - 1];
      expect(lastCall?.[1]).toMatchObject({
        isComplete: true,
        chunkIndex: expect.any(Number),
        totalChunks: expect.any(Number),
        streamingId: expect.any(String),
      });
    });

    it('should handle empty content gracefully', async () => {
      const onChunk = vi.fn();
      const onComplete = vi.fn();

      const promise = simulateStreaming('', {
        onChunk,
        onComplete,
      });

      await vi.advanceTimersByTimeAsync(1000);
      await promise;

      expect(onComplete).toHaveBeenCalledWith('');
    });

    it('should generate unique streaming IDs', async () => {
      const ids = new Set();
      
      for (let i = 0; i < 5; i++) {
        const onChunk = vi.fn();
        const promise = simulateStreaming('Test', { onChunk });
        
        await vi.advanceTimersByTimeAsync(100);
        
        if (onChunk.mock.calls.length > 0) {
          const metadata = onChunk.mock.calls[0]?.[1];
          if (metadata?.streamingId) {
            ids.add(metadata.streamingId);
          }
        }
        
        await vi.advanceTimersByTimeAsync(5000);
        await promise;
      }
      
      expect(ids.size).toBe(5);
    });
  });

  describe('integration scenarios', () => {
    it('should create a complete mock conversation flow', async () => {
      // Create initial conversation
      const conversation = generateMockConversation('greeting');
      expect(conversation.length).toBeGreaterThan(1);

      // Add a new user message
      const userMessage = createMockMessage({
        role: 'user',
        content: 'Can you help me with JavaScript?',
      });

      // Generate appropriate response
      const response = generateMockResponse('code', userMessage.content);
      const assistantMessage = createMockMessage({
        role: 'assistant',
        content: response.content,
        metadata: response.metadata,
      });

      const fullConversation = [...conversation, userMessage, assistantMessage];
      
      expect(fullConversation.length).toBeGreaterThan(3);
      expect(fullConversation[fullConversation.length - 1].content).toContain('```');
    });

    it('should simulate realistic chat timing', async () => {
      const userMessage = createMockMessage({
        role: 'user',
        content: 'Explain React hooks',
      });

      const response = generateMockResponse('text', userMessage.content);
      
      const chunks: string[] = [];
      const onChunk = (chunk: string) => chunks.push(chunk);

      const promise = simulateStreaming(response.content, {
        onChunk,
        thinkingDelay: 500,
        speed: 'normal',
      });

      // Should have thinking delay
      await vi.advanceTimersByTimeAsync(250);
      expect(chunks.length).toBe(0);

      // Should start streaming
      await vi.advanceTimersByTimeAsync(500);
      expect(chunks.length).toBeGreaterThan(0);

      // Complete streaming
      await vi.advanceTimersByTimeAsync(10000);
      await promise;

      expect(chunks[chunks.length - 1]).toBe(response.content);
    });

    it('should handle error recovery scenarios', () => {
      const error = generateMockError('network');
      expect(error.recoverable).toBe(true);

      const errorMessage = createMockMessage({
        role: 'assistant',
        content: '',
        status: 'error',
        error: error.message,
      });

      expect(errorMessage.status).toBe('error');
      expect(errorMessage.error).toBe(error.message);
    });
  });
});