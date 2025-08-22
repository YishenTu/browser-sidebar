/**
 * @file Token Buffer Tests
 *
 * Comprehensive test suite for streaming token buffering functionality.
 * Tests intelligent token grouping, flush strategies, and UI optimization.
 *
 * Tests following TDD methodology:
 * 1. Test basic token buffering
 * 2. Test flush strategies (time-based, size-based, word boundaries)
 * 3. Test special token handling (thinking tokens, metadata)
 * 4. Test buffer overflow protection
 * 5. Test performance and statistics
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TokenBuffer, FlushStrategy, FlushReason, BufferStats } from '@provider/tokenBuffer';
import type { StreamChunk, Delta } from '@types/providers';

// Mock performance.now for consistent timing tests
const mockPerformanceNow = vi.fn();
vi.stubGlobal('performance', { now: mockPerformanceNow });

describe('TokenBuffer', () => {
  let tokenBuffer: TokenBuffer;
  let flushCallback: vi.MockedFunction<(content: string, metadata: any) => void>;

  beforeEach(() => {
    mockPerformanceNow.mockReturnValue(0);
    flushCallback = vi.fn();
    tokenBuffer = new TokenBuffer({
      strategy: FlushStrategy.SIZE_BASED,
      maxTokens: 5,
      flushIntervalMs: 100,
      onFlush: flushCallback,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Buffering', () => {
    it('should buffer tokens without flushing until threshold', () => {
      tokenBuffer.addToken('Hello');
      tokenBuffer.addToken(' ');
      tokenBuffer.addToken('world');

      expect(flushCallback).not.toHaveBeenCalled();
      expect(tokenBuffer.getBufferSize()).toBe(3);
    });

    it('should flush when size threshold is reached', () => {
      tokenBuffer.addToken('Token');
      tokenBuffer.addToken('1');
      tokenBuffer.addToken('Token');
      tokenBuffer.addToken('2');
      tokenBuffer.addToken('Token');

      expect(flushCallback).toHaveBeenCalledWith('Token1Token2Token', {
        reason: FlushReason.SIZE_THRESHOLD,
        tokenCount: 5,
        flushTime: expect.any(Number),
      });
      expect(tokenBuffer.getBufferSize()).toBe(0);
    });

    it('should maintain correct token order', () => {
      tokenBuffer.addToken('First');
      tokenBuffer.addToken(' ');
      tokenBuffer.addToken('Second');
      tokenBuffer.addToken(' ');
      tokenBuffer.addToken('Third');

      expect(flushCallback).toHaveBeenCalledWith('First Second Third', expect.any(Object));
    });

    it('should handle empty tokens gracefully', () => {
      tokenBuffer.addToken('');
      tokenBuffer.addToken('Valid');
      tokenBuffer.addToken(null as any);
      tokenBuffer.addToken(undefined as any);
      tokenBuffer.addToken('Token');

      expect(tokenBuffer.getBufferSize()).toBe(2);
    });

    it('should handle Unicode characters correctly', () => {
      tokenBuffer.addToken('🚀');
      tokenBuffer.addToken('Hello');
      tokenBuffer.addToken('世界');
      tokenBuffer.addToken('مرحبا');
      tokenBuffer.addToken('🌍');

      expect(flushCallback).toHaveBeenCalledWith('🚀Hello世界مرحبا🌍', expect.any(Object));
    });
  });

  describe('Time-Based Flushing', () => {
    beforeEach(() => {
      tokenBuffer = new TokenBuffer({
        strategy: FlushStrategy.TIME_BASED,
        flushIntervalMs: 100,
        onFlush: flushCallback,
      });
    });

    it('should flush after time interval', async () => {
      tokenBuffer.addToken('Hello');
      expect(flushCallback).not.toHaveBeenCalled();

      // Advance time by 100ms
      mockPerformanceNow.mockReturnValue(100);

      // Trigger flush check (would normally be done by interval)
      tokenBuffer.checkTimeFlush();

      expect(flushCallback).toHaveBeenCalledWith('Hello', {
        reason: FlushReason.TIME_INTERVAL,
        tokenCount: 1,
        flushTime: 100,
      });
    });

    it('should not flush before time interval', () => {
      tokenBuffer.addToken('Hello');

      // Advance time by 50ms (less than 100ms interval)
      mockPerformanceNow.mockReturnValue(50);
      tokenBuffer.checkTimeFlush();

      expect(flushCallback).not.toHaveBeenCalled();
    });

    it('should handle multiple time-based flushes', () => {
      // First batch
      tokenBuffer.addToken('First');
      mockPerformanceNow.mockReturnValue(100);
      tokenBuffer.checkTimeFlush();

      expect(flushCallback).toHaveBeenCalledWith('First', expect.any(Object));

      // Second batch
      flushCallback.mockClear();
      tokenBuffer.addToken('Second');
      mockPerformanceNow.mockReturnValue(200);
      tokenBuffer.checkTimeFlush();

      expect(flushCallback).toHaveBeenCalledWith('Second', expect.any(Object));
    });
  });

  describe('Word Boundary Detection', () => {
    beforeEach(() => {
      tokenBuffer = new TokenBuffer({
        strategy: FlushStrategy.WORD_BOUNDARY,
        maxTokens: 10, // Higher threshold to test boundary logic
        onFlush: flushCallback,
      });
    });

    it('should flush at word boundaries', () => {
      tokenBuffer.addToken('Hello');
      tokenBuffer.addToken(' ');
      expect(flushCallback).not.toHaveBeenCalled(); // Don't flush yet

      tokenBuffer.addToken('world');
      tokenBuffer.addToken(' ');

      expect(flushCallback).toHaveBeenCalledWith('Hello world ', {
        reason: FlushReason.WORD_BOUNDARY,
        tokenCount: 4,
        flushTime: expect.any(Number),
      });
    });

    it('should detect various word boundary patterns', () => {
      tokenBuffer.addToken('Word1');
      tokenBuffer.addToken(',');

      expect(flushCallback).toHaveBeenCalledWith('Word1,', expect.any(Object));

      flushCallback.mockClear();
      tokenBuffer.addToken('Word2');
      tokenBuffer.addToken('.');

      expect(flushCallback).toHaveBeenCalledWith('Word2.', expect.any(Object));
    });

    it('should handle punctuation-based boundaries', () => {
      tokenBuffer.addToken('Hello');
      tokenBuffer.addToken('!');

      expect(flushCallback).toHaveBeenCalledWith('Hello!', {
        reason: FlushReason.PUNCTUATION_BOUNDARY,
        tokenCount: 2,
        flushTime: expect.any(Number),
      });
    });

    it('should not flush mid-word', () => {
      tokenBuffer.addToken('Hel');
      tokenBuffer.addToken('lo');
      tokenBuffer.addToken('Wor');
      tokenBuffer.addToken('ld');

      expect(flushCallback).not.toHaveBeenCalled();
      expect(tokenBuffer.getBufferSize()).toBe(4);
    });

    it('should handle sentence boundaries', () => {
      tokenBuffer.addToken('Hello');
      tokenBuffer.addToken(' ');
      tokenBuffer.addToken('world');
      tokenBuffer.addToken('.');

      expect(flushCallback).toHaveBeenCalledWith('Hello world.', {
        reason: FlushReason.SENTENCE_BOUNDARY,
        tokenCount: 4,
        flushTime: expect.any(Number),
      });
    });
  });

  describe('Hybrid Strategy', () => {
    beforeEach(() => {
      tokenBuffer = new TokenBuffer({
        strategy: FlushStrategy.HYBRID,
        maxTokens: 10,
        flushIntervalMs: 100,
        onFlush: flushCallback,
      });
    });

    it('should flush on word boundary before size limit', () => {
      tokenBuffer.addToken('Hello');
      tokenBuffer.addToken(' ');
      tokenBuffer.addToken('world');
      tokenBuffer.addToken(' ');

      expect(flushCallback).toHaveBeenCalledWith('Hello world ', {
        reason: FlushReason.WORD_BOUNDARY,
        tokenCount: 4,
        flushTime: expect.any(Number),
      });
    });

    it('should flush on size limit if no word boundary found', () => {
      // Add tokens without word boundaries
      for (let i = 0; i < 10; i++) {
        tokenBuffer.addToken(`t${i}`);
      }

      expect(flushCallback).toHaveBeenCalledWith('t0t1t2t3t4t5t6t7t8t9', {
        reason: FlushReason.SIZE_THRESHOLD,
        tokenCount: 10,
        flushTime: expect.any(Number),
      });
    });

    it('should flush on time interval if no other condition met', () => {
      tokenBuffer.addToken('Hello');

      mockPerformanceNow.mockReturnValue(100);
      tokenBuffer.checkTimeFlush();

      expect(flushCallback).toHaveBeenCalledWith('Hello', {
        reason: FlushReason.TIME_INTERVAL,
        tokenCount: 1,
        flushTime: 100,
      });
    });
  });

  describe('Special Token Handling', () => {
    it('should handle thinking tokens separately', () => {
      const chunk: StreamChunk = {
        id: 'test',
        object: 'chat.completion.chunk',
        created: 123,
        model: 'test',
        choices: [
          {
            index: 0,
            delta: {
              content: 'Hello',
              thinking: 'I should say hello',
            },
            finishReason: null,
          },
        ],
      };

      tokenBuffer.addStreamChunk(chunk);

      expect(tokenBuffer.getThinkingContent()).toBe('I should say hello');
      expect(tokenBuffer.getBufferSize()).toBe(1); // Only content tokens counted
    });

    it('should handle metadata tokens', () => {
      const chunk: StreamChunk = {
        id: 'test',
        object: 'chat.completion.chunk',
        created: 123,
        model: 'test',
        choices: [
          {
            index: 0,
            delta: { content: 'Hello' },
            finishReason: null,
          },
        ],
        usage: {
          promptTokens: 10,
          completionTokens: 5,
          totalTokens: 15,
          thinkingTokens: 3,
        },
      };

      tokenBuffer.addStreamChunk(chunk);

      const metadata = tokenBuffer.getMetadata();
      expect(metadata.usage).toEqual({
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
        thinkingTokens: 3,
      });
    });

    it('should handle mixed content and thinking tokens', () => {
      const chunk1: StreamChunk = {
        id: 'test1',
        object: 'chat.completion.chunk',
        created: 123,
        model: 'test',
        choices: [
          {
            index: 0,
            delta: {
              content: 'Hello',
              thinking: 'Think 1',
            },
            finishReason: null,
          },
        ],
      };

      const chunk2: StreamChunk = {
        id: 'test2',
        object: 'chat.completion.chunk',
        created: 124,
        model: 'test',
        choices: [
          {
            index: 0,
            delta: {
              content: ' world',
              thinking: ' Think 2',
            },
            finishReason: null,
          },
        ],
      };

      tokenBuffer.addStreamChunk(chunk1);
      tokenBuffer.addStreamChunk(chunk2);

      expect(tokenBuffer.getThinkingContent()).toBe('Think 1 Think 2');
      expect(tokenBuffer.getBufferSize()).toBe(2);
    });
  });

  describe('Force Flush', () => {
    it('should force flush all buffered content', () => {
      tokenBuffer.addToken('Incomplete');
      tokenBuffer.addToken(' ');
      tokenBuffer.addToken('sentence');

      expect(flushCallback).not.toHaveBeenCalled();

      tokenBuffer.forceFlush();

      expect(flushCallback).toHaveBeenCalledWith('Incomplete sentence', {
        reason: FlushReason.FORCE_FLUSH,
        tokenCount: 3,
        flushTime: expect.any(Number),
      });
      expect(tokenBuffer.getBufferSize()).toBe(0);
    });

    it('should include thinking content in force flush', () => {
      tokenBuffer.addToken('Hello');
      const chunk: StreamChunk = {
        id: 'test',
        object: 'chat.completion.chunk',
        created: 123,
        model: 'test',
        choices: [
          {
            index: 0,
            delta: { thinking: 'Final thoughts' },
            finishReason: null,
          },
        ],
      };
      tokenBuffer.addStreamChunk(chunk);

      tokenBuffer.forceFlush();

      expect(flushCallback).toHaveBeenCalledWith(
        'Hello',
        expect.objectContaining({
          reason: FlushReason.FORCE_FLUSH,
          thinking: 'Final thoughts',
        })
      );
    });

    it('should handle empty buffer on force flush', () => {
      tokenBuffer.forceFlush();

      expect(flushCallback).not.toHaveBeenCalled();
    });

    it('should trigger completion flush', () => {
      tokenBuffer.addToken('Complete');
      tokenBuffer.flushOnCompletion();

      expect(flushCallback).toHaveBeenCalledWith('Complete', {
        reason: FlushReason.STREAM_COMPLETE,
        tokenCount: 1,
        flushTime: expect.any(Number),
      });
    });
  });

  describe('Buffer Overflow Protection', () => {
    beforeEach(() => {
      tokenBuffer = new TokenBuffer({
        strategy: FlushStrategy.SIZE_BASED,
        maxTokens: 5,
        maxBufferSize: 50, // Small limit for testing
        onFlush: flushCallback,
      });
    });

    it('should protect against buffer overflow by flushing early', () => {
      // Add tokens that exceed buffer size limit
      const longToken = 'x'.repeat(60); // Exceeds maxBufferSize
      tokenBuffer.addToken(longToken);

      // Should flush immediately due to overflow protection
      expect(flushCallback).toHaveBeenCalledWith(longToken, {
        reason: FlushReason.BUFFER_OVERFLOW,
        tokenCount: 1,
        flushTime: expect.any(Number),
      });
    });

    it('should handle gradual buffer growth', () => {
      // Add tokens that gradually approach limit
      tokenBuffer.addToken('12345'); // 5 chars
      tokenBuffer.addToken('67890'); // 10 total
      tokenBuffer.addToken('ABCDE'); // 15 total
      tokenBuffer.addToken('FGHIJ'); // 20 total

      expect(flushCallback).not.toHaveBeenCalled();

      // This should trigger overflow protection
      tokenBuffer.addToken('KLMNOPQRSTUVWXYZ'); // Would exceed 50 char limit

      expect(flushCallback).toHaveBeenCalled();
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should track buffer statistics', () => {
      tokenBuffer.addToken('Hello');
      tokenBuffer.addToken(' ');
      tokenBuffer.addToken('world');
      tokenBuffer.addToken('!');
      tokenBuffer.addToken('More');

      const stats: BufferStats = tokenBuffer.getStats();

      expect(stats).toMatchObject({
        totalTokensProcessed: 5,
        totalFlushes: 1,
        currentBufferSize: 0,
        averageFlushSize: 5,
        flushReasons: expect.objectContaining({
          [FlushReason.SIZE_THRESHOLD]: 1,
        }),
      });
    });

    it('should track different flush reasons', () => {
      // Size-based flush
      for (let i = 0; i < 5; i++) {
        tokenBuffer.addToken(`token${i}`);
      }

      // Force flush
      tokenBuffer.addToken('extra');
      tokenBuffer.forceFlush();

      const stats = tokenBuffer.getStats();
      expect(stats.flushReasons[FlushReason.SIZE_THRESHOLD]).toBe(1);
      expect(stats.flushReasons[FlushReason.FORCE_FLUSH]).toBe(1);
      expect(stats.totalFlushes).toBe(2);
    });

    it('should calculate average flush size correctly', () => {
      // First flush: 5 tokens
      for (let i = 0; i < 5; i++) {
        tokenBuffer.addToken('a');
      }

      // Second flush: 3 tokens
      tokenBuffer.addToken('b');
      tokenBuffer.addToken('c');
      tokenBuffer.addToken('d');
      tokenBuffer.forceFlush();

      const stats = tokenBuffer.getStats();
      expect(stats.averageFlushSize).toBe(4); // (5 + 3) / 2
    });

    it('should track thinking token statistics', () => {
      const chunk: StreamChunk = {
        id: 'test',
        object: 'chat.completion.chunk',
        created: 123,
        model: 'test',
        choices: [
          {
            index: 0,
            delta: {
              content: 'Hello',
              thinking: 'Thinking...',
            },
            finishReason: null,
          },
        ],
      };

      for (let i = 0; i < 5; i++) {
        tokenBuffer.addStreamChunk(chunk);
      }

      const stats = tokenBuffer.getStats();
      expect(stats.thinkingTokensProcessed).toBe(5);
    });

    it('should provide real-time buffer metrics', () => {
      tokenBuffer.addToken('Test');
      tokenBuffer.addToken('Buffer');

      expect(tokenBuffer.getBufferSize()).toBe(2);
      expect(tokenBuffer.getCurrentBufferLength()).toBe('TestBuffer'.length);
      expect(tokenBuffer.isEmpty()).toBe(false);

      tokenBuffer.forceFlush();

      expect(tokenBuffer.getBufferSize()).toBe(0);
      expect(tokenBuffer.getCurrentBufferLength()).toBe(0);
      expect(tokenBuffer.isEmpty()).toBe(true);
    });
  });

  describe('Configuration and Customization', () => {
    it('should support different flush strategies', () => {
      const configs = [
        { strategy: FlushStrategy.SIZE_BASED, maxTokens: 3 },
        { strategy: FlushStrategy.TIME_BASED, flushIntervalMs: 50 },
        { strategy: FlushStrategy.WORD_BOUNDARY, maxTokens: 10 },
        { strategy: FlushStrategy.HYBRID, maxTokens: 5, flushIntervalMs: 100 },
      ];

      configs.forEach(config => {
        const buffer = new TokenBuffer({ ...config, onFlush: vi.fn() });
        expect(buffer.getStrategy()).toBe(config.strategy);
      });
    });

    it('should validate configuration parameters', () => {
      expect(
        () =>
          new TokenBuffer({
            strategy: FlushStrategy.SIZE_BASED,
            maxTokens: -1,
            onFlush: flushCallback,
          })
      ).toThrow('maxTokens must be positive');

      expect(
        () =>
          new TokenBuffer({
            strategy: FlushStrategy.TIME_BASED,
            flushIntervalMs: -1,
            onFlush: flushCallback,
          })
      ).toThrow('flushIntervalMs must be positive');
    });

    it('should support custom flush strategies via callbacks', () => {
      const customFlushCallback = vi.fn((buffer: string) => buffer.length > 10);

      tokenBuffer = new TokenBuffer({
        strategy: FlushStrategy.CUSTOM,
        customShouldFlush: customFlushCallback,
        onFlush: flushCallback,
      });

      tokenBuffer.addToken('Short');
      expect(flushCallback).not.toHaveBeenCalled();

      tokenBuffer.addToken('This is a longer string');
      expect(flushCallback).toHaveBeenCalled();
    });
  });

  describe('Integration with StreamChunk', () => {
    it('should process StreamChunk objects correctly', () => {
      const chunk: StreamChunk = {
        id: 'test',
        object: 'chat.completion.chunk',
        created: 123,
        model: 'test-model',
        choices: [
          {
            index: 0,
            delta: {
              content: 'Hello world',
            },
            finishReason: null,
          },
        ],
        usage: {
          promptTokens: 5,
          completionTokens: 2,
          totalTokens: 7,
        },
      };

      tokenBuffer.addStreamChunk(chunk);

      expect(tokenBuffer.getBufferSize()).toBe(1);
      expect(tokenBuffer.getMetadata().model).toBe('test-model');
      expect(tokenBuffer.getMetadata().usage?.completionTokens).toBe(2);
    });

    it('should handle multiple choices in StreamChunk', () => {
      const chunk: StreamChunk = {
        id: 'test',
        object: 'chat.completion.chunk',
        created: 123,
        model: 'test',
        choices: [
          {
            index: 0,
            delta: { content: 'Choice 1' },
            finishReason: null,
          },
          {
            index: 1,
            delta: { content: 'Choice 2' },
            finishReason: null,
          },
        ],
      };

      tokenBuffer.addStreamChunk(chunk);

      // Should only process first choice by default
      expect(tokenBuffer.getBufferSize()).toBe(1);
    });

    it('should handle StreamChunk with finish reason', () => {
      const chunk: StreamChunk = {
        id: 'test',
        object: 'chat.completion.chunk',
        created: 123,
        model: 'test',
        choices: [
          {
            index: 0,
            delta: { content: 'Final token' },
            finishReason: 'stop',
          },
        ],
      };

      tokenBuffer.addStreamChunk(chunk);

      // Should trigger completion flush
      expect(flushCallback).toHaveBeenCalledWith(
        'Final token',
        expect.objectContaining({
          reason: FlushReason.STREAM_COMPLETE,
          tokenCount: 1,
          flushTime: expect.any(Number),
          finishReason: 'stop',
        })
      );
    });
  });

  describe('Performance', () => {
    it('should handle large numbers of tokens efficiently', () => {
      const startTime = performance.now();

      // Add 10000 tokens
      for (let i = 0; i < 10000; i++) {
        tokenBuffer.addToken(`token${i}`);
      }

      const endTime = performance.now();

      // Should complete in reasonable time
      expect(endTime - startTime).toBeLessThan(100);
      expect(tokenBuffer.getStats().totalTokensProcessed).toBe(10000);
    });

    it('should maintain constant memory usage with frequent flushes', () => {
      // Configure for frequent flushing
      tokenBuffer = new TokenBuffer({
        strategy: FlushStrategy.SIZE_BASED,
        maxTokens: 10,
        onFlush: flushCallback,
      });

      // Add many tokens with frequent flushes
      for (let i = 0; i < 1000; i++) {
        tokenBuffer.addToken(`token${i % 10}`);
      }

      // Buffer should remain small due to frequent flushes
      expect(tokenBuffer.getBufferSize()).toBeLessThan(10);
      expect(tokenBuffer.getCurrentBufferLength()).toBeLessThan(100);
    });

    it('should handle rapid token additions without blocking', () => {
      const tokens: string[] = [];
      for (let i = 0; i < 1000; i++) {
        tokens.push(`rapid${i}`);
      }

      const startTime = performance.now();

      tokens.forEach(token => tokenBuffer.addToken(token));

      const endTime = performance.now();

      // Should process all tokens quickly
      expect(endTime - startTime).toBeLessThan(50);
      expect(tokenBuffer.getStats().totalTokensProcessed).toBe(1000);
    });
  });
});
