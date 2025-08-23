/**
 * @file SSE Stream Parser
 *
 * Server-Sent Events (SSE) stream parser for AI provider responses.
 * Supports OpenAI, Gemini, and OpenRouter/Claude streaming formats.
 *
 * Features:
 * - Parses SSE format data (lines starting with "data: ")
 * - Handles multi-line messages and partial chunks
 * - Detects and parses JSON payloads
 * - Handles special completion signals ([DONE], complete: true, etc.)
 * - Buffers partial data between chunks
 * - Detects and handles errors in the stream
 * - Supports different provider formats with automatic detection
 */

import type {
  StreamChunk,
  ProviderError,
  ProviderType,
  FinishReason,
  Usage,
} from '../types/providers';

/**
 * SSE Stream Parser class
 *
 * Stateful parser that can handle chunked data streams and partial messages.
 * Maintains an internal buffer for incomplete data across multiple parse calls.
 */
export class StreamParser {
  private buffer: string = '';
  private static readonly MAX_BUFFER_SIZE = 1024 * 1024; // 1MB buffer limit

  /**
   * Parse SSE data and return parsed chunks
   *
   * @param data - Raw SSE data string
   * @returns Array of parsed StreamChunk objects
   * @throws ProviderError for stream errors
   */
  parse(data: string): StreamChunk[] {
    if (!data || typeof data !== 'string') {
      return [];
    }

    // Add new data to buffer
    this.buffer += data;

    // Protect against buffer overflow
    if (this.buffer.length > StreamParser.MAX_BUFFER_SIZE) {
      this.buffer = this.buffer.slice(-StreamParser.MAX_BUFFER_SIZE / 2);
    }

    const chunks: StreamChunk[] = [];

    // Split into lines and process
    const lines = this.buffer.split(/\r?\n/);

    // Keep the last line in buffer if it doesn't end with newline
    this.buffer = data.endsWith('\n') || data.endsWith('\r\n') ? '' : lines.pop() || '';

    let currentMessage = '';

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Handle data lines
      if (trimmedLine.startsWith('data: ')) {
        const messageData = trimmedLine.slice(6); // Remove 'data: ' prefix

        // If we have buffered incomplete data, combine it
        if (currentMessage) {
          currentMessage += messageData;
        } else {
          currentMessage = messageData;
        }

        // Try to parse the message
        try {
          const chunk = this.parseMessage(currentMessage);
          if (chunk) {
            chunks.push(chunk);
          }
          currentMessage = ''; // Clear after successful parse
        } catch (error) {
          if (
            error instanceof Error &&
            ('type' in error ||
              error.message.includes('Rate limit') ||
              error.message.includes('Network') ||
              error.message.includes('API key'))
          ) {
            throw error; // Re-throw ProviderError
          }

          // Check if this is clearly malformed JSON (not just incomplete)
          try {
            JSON.parse(currentMessage);
            // If JSON.parse succeeds but parseMessage failed, it's not a stream format
            // Skip this message and reset
            currentMessage = '';
          } catch {
            // If JSON.parse fails, it might be incomplete - check if it looks like it could be valid
            if (currentMessage.includes('}') || currentMessage.includes(']')) {
              // Has closing brackets but still invalid - likely malformed, reset
              currentMessage = '';
            }
            // Otherwise keep building the message (might be incomplete)
          }
        }
      } else if (!trimmedLine || trimmedLine.startsWith(':')) {
        // Empty lines or comments - if we have a complete message, finalize it
        if (currentMessage) {
          try {
            const chunk = this.parseMessage(currentMessage);
            if (chunk) {
              chunks.push(chunk);
            }
            currentMessage = '';
          } catch (error) {
            if (
              error instanceof Error &&
              ('type' in error ||
                error.message.includes('Rate limit') ||
                error.message.includes('Network') ||
                error.message.includes('API key'))
            ) {
              throw error; // Re-throw ProviderError
            }
            // Not valid JSON, might be incomplete - keep building
          }
        }
      }
      // Ignore other SSE fields (event:, id:, retry:)
    }

    // Handle any remaining complete message in current message
    if (currentMessage) {
      try {
        const chunk = this.parseMessage(currentMessage);
        if (chunk) {
          chunks.push(chunk);
        }
        currentMessage = '';
      } catch (error) {
        if (
          error instanceof Error &&
          ('type' in error ||
            error.message.includes('Rate limit') ||
            error.message.includes('Network') ||
            error.message.includes('API key'))
        ) {
          throw error; // Re-throw ProviderError
        }
        // Incomplete JSON, keep in buffer for next chunk
        this.buffer = currentMessage + (this.buffer ? this.buffer : '');
      }
    }

    return chunks;
  }

  /**
   * Parse a single SSE message into a StreamChunk
   */
  private parseMessage(message: string): StreamChunk | null {
    if (!message.trim()) {
      return null;
    }

    // Handle [DONE] signal
    if (message.trim() === '[DONE]') {
      return this.createDoneChunk();
    }

    const parsed = JSON.parse(message);

    // Check for errors first
    if (parsed.error) {
      const providerError = this.createProviderError(parsed.error);
      // Create error object that can be thrown
      const error = new Error(providerError.message) as Error & ProviderError;
      Object.assign(error, providerError);
      throw error;
    }

    // Handle different provider formats
    if (parsed.candidates) {
      return this.parseGeminiFormat(parsed);
    } else if (parsed.type === 'content_block_delta' || parsed.type === 'message_stop') {
      return this.parseClaudeFormat(parsed);
    } else if (
      parsed.choices ||
      parsed.object === 'chat.completion.chunk' ||
      parsed.object === 'response.chunk'
    ) {
      return this.parseOpenAIFormat(parsed);
    }

    // If it has basic structure, try to parse as generic
    if (this.isValidStreamFormat(parsed)) {
      return this.parseGenericFormat(parsed);
    }

    // Not a valid stream chunk, return null
    return null;
  }

  /**
   * Check if a parsed object is a valid streaming format
   */
  private isValidStreamFormat(parsed: any): boolean {
    // Check for valid streaming response indicators
    return !!(
      parsed.choices ||
      parsed.candidates ||
      parsed.type === 'content_block_delta' ||
      parsed.type === 'message_stop' ||
      parsed.object === 'chat.completion.chunk' ||
      parsed.object === 'response.chunk' ||
      parsed.id ||
      parsed.model ||
      parsed.complete !== undefined ||
      parsed.error // Include error objects as valid stream format
    );
  }

  /**
   * Parse OpenAI streaming format
   */
  private parseOpenAIFormat(data: any): StreamChunk {
    const choice = data.choices?.[0] || {};
    const delta = choice.delta || {};

    return {
      id: data.id || 'unknown',
      object: data.object || 'chat.completion.chunk',
      created: data.created || Math.floor(Date.now() / 1000),
      model: data.model || 'unknown',
      choices: [
        {
          index: choice.index || 0,
          delta: {
            role: delta.role,
            content: delta.content,
            thinking: delta.thinking,
          },
          finishReason: this.normalizeFinishReason(choice.finish_reason),
        },
      ],
      usage: data.usage ? this.normalizeUsage(data.usage) : undefined,
    };
  }

  /**
   * Parse Gemini streaming format
   */
  private parseGeminiFormat(data: any): StreamChunk {
    const candidate = data.candidates?.[0] || {};
    const content = candidate.content || {};
    const parts = content.parts || [];
    const textPart = parts.find((p: any) => p.text) || {};
    const thinkingPart = parts.find((p: any) => p.thinking) || {};

    return {
      id: `gemini-${Date.now()}`,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: 'gemini',
      choices: [
        {
          index: candidate.index || 0,
          delta: {
            role: content.role === 'model' ? 'assistant' : content.role,
            content: textPart.text,
            thinking: textPart.thinking || thinkingPart.thinking,
          },
          finishReason: this.normalizeFinishReason(candidate.finishReason),
        },
      ],
      usage: data.usageMetadata
        ? {
            promptTokens: data.usageMetadata.promptTokenCount || 0,
            completionTokens: data.usageMetadata.candidatesTokenCount || 0,
            totalTokens: data.usageMetadata.totalTokenCount || 0,
            thinkingTokens: data.usageMetadata.thinkingTokenCount,
          }
        : undefined,
    };
  }

  /**
   * Parse Claude/OpenRouter streaming format
   */
  private parseClaudeFormat(data: any): StreamChunk {
    if (data.type === 'message_stop' || data.complete) {
      return {
        id: data.id || 'claude-done',
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: 'claude',
        choices: [
          {
            index: 0,
            delta: {},
            finishReason: 'stop' as FinishReason,
          },
        ],
      };
    }

    const delta = data.delta || {};

    return {
      id: data.id || `claude-${Date.now()}`,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: 'claude',
      choices: [
        {
          index: data.index || 0,
          delta: {
            content: delta.text,
            thinking: delta.thinking,
          },
          finishReason: null,
        },
      ],
      usage: data.usage
        ? {
            promptTokens: data.usage.input_tokens || 0,
            completionTokens: data.usage.output_tokens || 0,
            totalTokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0),
            thinkingTokens: data.usage.thinking_tokens,
          }
        : undefined,
    };
  }

  /**
   * Parse generic/unknown format
   */
  private parseGenericFormat(data: any): StreamChunk {
    return {
      id: data.id || `generic-${Date.now()}`,
      object: data.object || 'chat.completion.chunk',
      created: data.created || Math.floor(Date.now() / 1000),
      model: data.model || 'unknown',
      choices: [
        {
          index: 0,
          delta: {
            content: data.content || data.text || '',
            thinking: data.thinking,
          },
          finishReason: null,
        },
      ],
    };
  }

  /**
   * Create a [DONE] chunk
   */
  private createDoneChunk(): StreamChunk {
    return {
      id: 'done',
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: 'unknown',
      choices: [
        {
          index: 0,
          delta: {},
          finishReason: 'stop' as FinishReason,
        },
      ],
    };
  }

  /**
   * Normalize finish reason across providers
   */
  private normalizeFinishReason(reason: any): FinishReason {
    if (!reason) return null;

    const normalized = String(reason).toLowerCase();

    if (normalized.includes('stop') || normalized === 'finish') return 'stop';
    if (normalized.includes('length') || normalized.includes('max')) return 'length';
    if (normalized.includes('filter') || normalized.includes('safety')) return 'content_filter';
    if (normalized.includes('tool')) return 'tool_calls';

    return 'stop';
  }

  /**
   * Normalize usage information across providers
   */
  private normalizeUsage(usage: any): Usage {
    return {
      promptTokens: usage.prompt_tokens || usage.promptTokens || usage.input_tokens || 0,
      completionTokens:
        usage.completion_tokens || usage.completionTokens || usage.output_tokens || 0,
      totalTokens: usage.total_tokens || usage.totalTokens || 0,
      thinkingTokens: usage.thinking_tokens || usage.thinkingTokens,
    };
  }

  /**
   * Create a ProviderError from error data
   */
  private createProviderError(errorData: any): ProviderError {
    let errorType: ProviderError['type'] = 'unknown';

    if (errorData.type?.includes('rate_limit') || errorData.code?.includes('rate_limit')) {
      errorType = 'rate_limit';
    } else if (
      errorData.type?.includes('authentication') ||
      errorData.type?.includes('invalid_request') ||
      errorData.code?.includes('invalid_api_key') ||
      errorData.code?.includes('unauthorized')
    ) {
      errorType = 'authentication';
    } else if (
      errorData.type?.includes('network') ||
      errorData.code?.includes('network') ||
      errorData.code?.includes('timeout')
    ) {
      errorType = 'network';
    } else if (errorData.type?.includes('validation') || errorData.code?.includes('validation')) {
      errorType = 'validation';
    }

    const error: ProviderError = {
      type: errorType,
      message: errorData.message || 'Unknown error',
      code: errorData.code || 'unknown',
      provider: this.detectProvider(errorData),
      details: {
        timestamp: new Date(),
        ...errorData,
      },
    };

    if (errorData.retry_after) {
      error.retryAfter = errorData.retry_after;
    }

    return error;
  }

  /**
   * Detect provider type from error or response data
   */
  private detectProvider(data: any): ProviderType {
    if (data.model?.includes('gpt') || data.model?.includes('openai')) return 'openai';
    if (data.model?.includes('gemini') || data.candidates) return 'gemini';
    return 'openai'; // Default fallback
  }

  /**
   * Reset the parser state and clear buffer
   */
  reset(): void {
    this.buffer = '';
  }

  /**
   * Check if parser has buffered data
   */
  hasBufferedData(): boolean {
    return this.buffer.length > 0;
  }

  /**
   * Get current buffer size
   */
  getBufferSize(): number {
    return this.buffer.length;
  }
}
