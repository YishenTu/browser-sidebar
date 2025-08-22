/**
 * @file Token Buffer
 *
 * Intelligent token buffering system for streaming AI responses.
 * Reduces UI updates by grouping tokens into meaningful chunks.
 *
 * Features:
 * - Multiple flush strategies (size, time, word boundaries, hybrid)
 * - Special token handling (thinking tokens, metadata)
 * - Buffer overflow protection
 * - Performance optimizations for smooth UI experience
 * - Comprehensive statistics and monitoring
 * - Integration with StreamChunk format
 */

import type { StreamChunk, Usage, FinishReason } from '../types/providers';

/**
 * Available flush strategies for token buffering
 */
export enum FlushStrategy {
  SIZE_BASED = 'size_based', // Flush when token count reaches threshold
  TIME_BASED = 'time_based', // Flush after time interval
  WORD_BOUNDARY = 'word_boundary', // Flush at word/sentence boundaries
  PUNCTUATION_BOUNDARY = 'punctuation_boundary', // Flush at punctuation marks
  HYBRID = 'hybrid', // Combination of multiple strategies
  CUSTOM = 'custom', // Custom flush logic via callback
}

/**
 * Reasons why a flush occurred
 */
export enum FlushReason {
  SIZE_THRESHOLD = 'size_threshold',
  TIME_INTERVAL = 'time_interval',
  WORD_BOUNDARY = 'word_boundary',
  PUNCTUATION_BOUNDARY = 'punctuation_boundary',
  SENTENCE_BOUNDARY = 'sentence_boundary',
  FORCE_FLUSH = 'force_flush',
  STREAM_COMPLETE = 'stream_complete',
  BUFFER_OVERFLOW = 'buffer_overflow',
}

/**
 * Buffer statistics for monitoring and optimization
 */
export interface BufferStats {
  totalTokensProcessed: number;
  thinkingTokensProcessed: number;
  totalFlushes: number;
  currentBufferSize: number;
  averageFlushSize: number;
  flushReasons: Record<FlushReason, number>;
  uptime: number;
}

/**
 * Configuration options for TokenBuffer
 */
export interface TokenBufferConfig {
  strategy: FlushStrategy;
  maxTokens?: number; // Max tokens before flush (size-based)
  flushIntervalMs?: number; // Time interval for flushing (time-based)
  maxBufferSize?: number; // Max buffer size in characters (overflow protection)
  onFlush: (content: string, metadata: FlushMetadata) => void;
  customShouldFlush?: (buffer: string) => boolean; // Custom flush logic
}

/**
 * Metadata provided with each flush
 */
export interface FlushMetadata {
  reason: FlushReason;
  tokenCount: number;
  flushTime: number;
  thinking?: string;
  usage?: Usage;
  model?: string;
  finishReason?: FinishReason;
  [key: string]: any;
}

/**
 * Internal token representation
 */
interface BufferedToken {
  content: string;
  timestamp: number;
  thinking?: string;
  metadata?: any;
}

/**
 * TokenBuffer class for intelligent token buffering and flushing
 */
export class TokenBuffer {
  private buffer: BufferedToken[] = [];
  private thinkingBuffer: string = '';
  private config: Required<TokenBufferConfig>;
  private stats: BufferStats;
  private lastFlushTime: number = 0;
  private startTime: number;
  private metadata: any = {};

  // Word boundary patterns
  private static readonly WORD_BOUNDARIES = /[\s\-_]/;
  private static readonly PUNCTUATION_BOUNDARIES = /[,.;:]/;
  private static readonly EXCLAMATION_QUESTION = /[!?]/;
  private static readonly SENTENCE_BOUNDARIES = /[.!?]\s+/;

  // Default configuration values
  private static readonly DEFAULT_CONFIG = {
    maxTokens: 50,
    flushIntervalMs: 200,
    maxBufferSize: 10000,
    customShouldFlush: () => false,
  };

  constructor(config: TokenBufferConfig) {
    this.validateConfig(config);

    this.config = {
      ...TokenBuffer.DEFAULT_CONFIG,
      ...config,
    } as Required<TokenBufferConfig>;

    this.startTime = performance.now();
    this.lastFlushTime = this.startTime;

    this.stats = {
      totalTokensProcessed: 0,
      thinkingTokensProcessed: 0,
      totalFlushes: 0,
      currentBufferSize: 0,
      averageFlushSize: 0,
      flushReasons: Object.values(FlushReason).reduce(
        (acc, reason) => {
          acc[reason] = 0;
          return acc;
        },
        {} as Record<FlushReason, number>
      ),
      uptime: 0,
    };
  }

  /**
   * Add a single token to the buffer
   */
  addToken(token: string, thinking?: string, metadata?: any): void {
    if (!token || typeof token !== 'string' || token.length === 0) {
      return; // Skip empty or invalid tokens
    }

    const bufferedToken: BufferedToken = {
      content: token,
      timestamp: performance.now(),
      thinking,
      metadata,
    };

    this.buffer.push(bufferedToken);
    this.stats.totalTokensProcessed++;

    if (thinking) {
      this.thinkingBuffer += thinking;
      this.stats.thinkingTokensProcessed++;
    }

    // Check for buffer overflow first
    if (this.shouldFlushForOverflow()) {
      this.flush(FlushReason.BUFFER_OVERFLOW);
      return;
    }

    // Check flush conditions based on strategy
    const flushReason = this.shouldFlush();
    if (flushReason) {
      this.flush(flushReason);
    }
  }

  /**
   * Add a StreamChunk to the buffer
   */
  addStreamChunk(chunk: StreamChunk): void {
    const choice = chunk.choices[0]; // Use first choice by default
    if (!choice?.delta) {
      return;
    }

    const { content, thinking } = choice.delta;

    // Update metadata
    if (chunk.model) this.metadata.model = chunk.model;
    if (chunk.usage) this.metadata.usage = chunk.usage;

    // Add content token if present
    if (content) {
      this.addToken(content, thinking, {
        chunkId: chunk.id,
        timestamp: chunk.created,
        choice: choice.index,
      });
    } else if (thinking) {
      // Handle thinking-only tokens
      this.thinkingBuffer += thinking;
      this.stats.thinkingTokensProcessed++;
    }

    // Handle completion
    if (choice.finishReason) {
      this.flushOnCompletion(choice.finishReason);
    }
  }

  /**
   * Force flush all buffered content
   */
  forceFlush(): void {
    if (this.buffer.length === 0) {
      return;
    }
    this.flush(FlushReason.FORCE_FLUSH);
  }

  /**
   * Flush on stream completion
   */
  flushOnCompletion(finishReason?: FinishReason): void {
    if (this.buffer.length === 0) {
      return;
    }
    this.flush(FlushReason.STREAM_COMPLETE, finishReason);
  }

  /**
   * Check if time-based flush should occur (for external timer)
   */
  checkTimeFlush(): void {
    if (
      this.config.strategy === FlushStrategy.TIME_BASED ||
      this.config.strategy === FlushStrategy.HYBRID
    ) {
      const now = performance.now();
      if (now - this.lastFlushTime >= this.config.flushIntervalMs && this.buffer.length > 0) {
        this.flush(FlushReason.TIME_INTERVAL);
      }
    }
  }

  /**
   * Get current buffer size (number of tokens)
   */
  getBufferSize(): number {
    return this.buffer.length;
  }

  /**
   * Get current buffer length (total characters)
   */
  getCurrentBufferLength(): number {
    return this.buffer.reduce((total, token) => total + token.content.length, 0);
  }

  /**
   * Check if buffer is empty
   */
  isEmpty(): boolean {
    return this.buffer.length === 0;
  }

  /**
   * Get current thinking content
   */
  getThinkingContent(): string {
    return this.thinkingBuffer;
  }

  /**
   * Get accumulated metadata
   */
  getMetadata(): any {
    return { ...this.metadata };
  }

  /**
   * Get buffer strategy
   */
  getStrategy(): FlushStrategy {
    return this.config.strategy;
  }

  /**
   * Get comprehensive statistics
   */
  getStats(): BufferStats {
    return {
      ...this.stats,
      currentBufferSize: this.buffer.length,
      uptime: performance.now() - this.startTime,
    };
  }

  /**
   * Validate configuration parameters
   */
  private validateConfig(config: TokenBufferConfig): void {
    if (config.maxTokens !== undefined && config.maxTokens <= 0) {
      throw new Error('maxTokens must be positive');
    }

    if (config.flushIntervalMs !== undefined && config.flushIntervalMs <= 0) {
      throw new Error('flushIntervalMs must be positive');
    }

    if (config.maxBufferSize !== undefined && config.maxBufferSize <= 0) {
      throw new Error('maxBufferSize must be positive');
    }

    if (typeof config.onFlush !== 'function') {
      throw new Error('onFlush must be a function');
    }
  }

  /**
   * Determine if buffer should flush based on strategy
   */
  private shouldFlush(): FlushReason | null {
    switch (this.config.strategy) {
      case FlushStrategy.SIZE_BASED:
        return this.buffer.length >= this.config.maxTokens ? FlushReason.SIZE_THRESHOLD : null;

      case FlushStrategy.TIME_BASED: {
        const now = performance.now();
        return now - this.lastFlushTime >= this.config.flushIntervalMs
          ? FlushReason.TIME_INTERVAL
          : null;
      }

      case FlushStrategy.WORD_BOUNDARY:
        return this.shouldFlushAtWordBoundary();

      case FlushStrategy.PUNCTUATION_BOUNDARY:
        return this.shouldFlushAtPunctuationBoundary();

      case FlushStrategy.HYBRID:
        return this.shouldFlushHybrid();

      case FlushStrategy.CUSTOM: {
        const content = this.getBufferContent();
        return this.config.customShouldFlush(content) ? FlushReason.FORCE_FLUSH : null;
      }

      default:
        return null;
    }
  }

  /**
   * Check if should flush for buffer overflow protection
   */
  private shouldFlushForOverflow(): boolean {
    const totalSize = this.getCurrentBufferLength();
    return totalSize >= this.config.maxBufferSize;
  }

  /**
   * Check if should flush at word boundary
   */
  private shouldFlushAtWordBoundary(): FlushReason | null {
    if (this.buffer.length < 2) return null; // Need at least 2 tokens to consider boundaries

    const lastToken = this.buffer[this.buffer.length - 1];
    if (!lastToken) return null;

    const bufferContent = this.getBufferContent();

    // Check for sentence boundary (period/exclamation/question followed by space)
    if (TokenBuffer.SENTENCE_BOUNDARIES.test(bufferContent)) {
      return FlushReason.SENTENCE_BOUNDARY;
    }

    // Check for sentence-ending punctuation without space (at end of stream)
    if (lastToken.content === '.' && this.buffer.length >= 3) {
      return FlushReason.SENTENCE_BOUNDARY;
    }

    // Check for exclamation/question marks at end
    if (TokenBuffer.EXCLAMATION_QUESTION.test(lastToken.content)) {
      return FlushReason.PUNCTUATION_BOUNDARY;
    }

    // Check for other punctuation
    if (TokenBuffer.PUNCTUATION_BOUNDARIES.test(lastToken.content)) {
      return FlushReason.PUNCTUATION_BOUNDARY;
    }

    // Check for word boundary (space after word) - requires meaningful content before
    if (TokenBuffer.WORD_BOUNDARIES.test(lastToken.content)) {
      // Only flush on space if we have a complete word/phrase
      const contentBeforeSpace = bufferContent.slice(0, -1).trim();
      if (contentBeforeSpace.length > 0 && this.buffer.length >= 4) {
        return FlushReason.WORD_BOUNDARY;
      }
    }

    // Don't flush if we haven't hit size limit
    if (this.buffer.length < this.config.maxTokens) {
      return null;
    }

    // Hit size limit without word boundary
    return FlushReason.SIZE_THRESHOLD;
  }

  /**
   * Check if should flush at punctuation boundary
   */
  private shouldFlushAtPunctuationBoundary(): FlushReason | null {
    if (this.buffer.length === 0) return null;

    const lastToken = this.buffer[this.buffer.length - 1];
    if (!lastToken) return null;

    const bufferContent = this.getBufferContent();

    if (TokenBuffer.SENTENCE_BOUNDARIES.test(bufferContent)) {
      return FlushReason.SENTENCE_BOUNDARY;
    }

    if (TokenBuffer.PUNCTUATION_BOUNDARIES.test(lastToken.content)) {
      return FlushReason.PUNCTUATION_BOUNDARY;
    }

    if (TokenBuffer.EXCLAMATION_QUESTION.test(lastToken.content)) {
      return FlushReason.PUNCTUATION_BOUNDARY;
    }

    return null;
  }

  /**
   * Hybrid flush strategy combining multiple approaches
   */
  private shouldFlushHybrid(): FlushReason | null {
    // Check word boundaries first (most natural)
    const wordBoundaryReason = this.shouldFlushAtWordBoundary();
    if (wordBoundaryReason && wordBoundaryReason !== FlushReason.SIZE_THRESHOLD) {
      return wordBoundaryReason;
    }

    // Check size threshold
    if (this.buffer.length >= this.config.maxTokens) {
      return FlushReason.SIZE_THRESHOLD;
    }

    // Check time interval
    const now = performance.now();
    if (now - this.lastFlushTime >= this.config.flushIntervalMs && this.buffer.length > 0) {
      return FlushReason.TIME_INTERVAL;
    }

    return null;
  }

  /**
   * Perform the actual flush operation
   */
  private flush(reason: FlushReason, finishReason?: FinishReason): void {
    if (this.buffer.length === 0) {
      return;
    }

    const content = this.getBufferContent();
    const thinking = this.thinkingBuffer;
    const tokenCount = this.buffer.length;
    const flushTime = performance.now();

    const metadata: FlushMetadata = {
      reason,
      tokenCount,
      flushTime,
      ...(thinking && { thinking }),
      ...this.metadata,
      ...(finishReason && { finishReason }),
    };

    // Call flush callback
    this.config.onFlush(content, metadata);

    // Update statistics
    this.updateFlushStats(reason, tokenCount);

    // Clear buffers
    this.buffer = [];
    this.thinkingBuffer = '';
    this.lastFlushTime = flushTime;
  }

  /**
   * Get concatenated buffer content
   */
  private getBufferContent(): string {
    return this.buffer.map(token => token.content).join('');
  }

  /**
   * Update flush statistics
   */
  private updateFlushStats(reason: FlushReason, tokenCount: number): void {
    this.stats.totalFlushes++;
    this.stats.flushReasons[reason]++;

    // Update average flush size
    const totalTokensFlushed =
      this.stats.averageFlushSize * (this.stats.totalFlushes - 1) + tokenCount;
    this.stats.averageFlushSize = totalTokensFlushed / this.stats.totalFlushes;
  }
}
