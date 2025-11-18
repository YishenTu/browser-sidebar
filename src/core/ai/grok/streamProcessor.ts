/**
 * @file Grok Stream Processor
 *
 * Handles processing of Grok Response API streaming responses
 */

import type { StreamChunk, FinishReason } from '../../../types/providers';
import type { GrokStreamEvent } from './types';

/**
 * Grok stream processor for handling Response API streaming responses
 */
export class GrokStreamProcessor {
  private buffer: string = '';
  private lastSeenContent: string = '';
  private model: string;

  constructor(model: string) {
    this.model = model;
  }

  /**
   * Process a chunk of streaming data
   */
  processChunk(chunk: string): GrokStreamEvent[] {
    this.buffer += chunk;
    const events: GrokStreamEvent[] = [];
    const lines = this.buffer.split('\n');

    // Keep the last incomplete line in the buffer
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') {
        continue;
      }

      if (trimmed.startsWith('data: ')) {
        try {
          const data = trimmed.slice(6);
          const event = JSON.parse(data) as GrokStreamEvent;
          events.push(event);
        } catch (error) {
          // Skip invalid JSON
          continue;
        }
      }
    }

    return events;
  }

  /**
   * Process a streaming event and return a StreamChunk if applicable
   */
  processEvent(event: GrokStreamEvent): StreamChunk | null {
    // Extract the actual delta content for message text
    const deltaContent = this.extractDeltaContent(event);

    // Create and return chunk if we have content
    if (deltaContent) {
      return this.createContentChunk(deltaContent, event);
    }

    // Handle finish events without content
    if (this.isCompletionEvent(event)) {
      return this.createCompletionChunk(event);
    }

    return null;
  }

  /**
   * Reset processor state
   */
  reset(): void {
    this.buffer = '';
    this.lastSeenContent = '';
  }

  /**
   * Check if event is a completion event
   */
  private isCompletionEvent(event: GrokStreamEvent): boolean {
    return (
      event.type === 'response.completed' ||
      event.finish_reason !== undefined ||
      event.status === 'completed'
    );
  }

  /**
   * Extract delta content from event
   */
  private extractDeltaContent(event: GrokStreamEvent): string | undefined {
    // Handle output text delta events (the actual message content)
    if (event.type === 'response.output_text.delta' && event.delta) {
      return typeof event.delta === 'string' ? event.delta : undefined;
    }

    if (event.output_text !== undefined && typeof event.output_text === 'string') {
      const currentFullText = event.output_text;
      // Extract only the new portion
      if (currentFullText.length > this.lastSeenContent.length) {
        const delta = currentFullText.substring(this.lastSeenContent.length);
        this.lastSeenContent = currentFullText;
        return delta;
      }
    }

    if (event.delta && typeof event.delta === 'string') {
      return event.delta;
    }

    // Legacy chat completions format support
    if (event.choices?.[0]?.delta?.content) {
      return event.choices[0].delta.content;
    }

    return undefined;
  }

  /**
   * Create a content chunk
   */
  private createContentChunk(content: string, event: GrokStreamEvent): StreamChunk {
    const finishReason = normalizeFinishReason(event.finish_reason || event.status || null);
    const responseId = event.response?.id || event.response_id || event.id;

    const chunk: StreamChunk = {
      id: responseId || `grok-chunk-${Date.now()}`,
      object: 'response.chunk',
      created: event.created || Math.floor(Date.now() / 1000),
      model: event.model || this.model,
      choices: [
        {
          index: 0,
          delta: { content },
          finishReason: finishReason === 'stop' ? null : finishReason,
        },
      ],
      usage: event.usage ? convertUsage(event.usage) : undefined,
    };

    // Include response ID in metadata
    if (responseId) {
      chunk.metadata = {
        responseId,
      };
    }

    return chunk;
  }

  /**
   * Create a completion chunk
   */
  private createCompletionChunk(event: GrokStreamEvent): StreamChunk {
    const finishReason = normalizeFinishReason(event.finish_reason || event.status || null);
    const responseId = event.response?.id || event.response_id || event.id;

    const chunk: StreamChunk = {
      id: responseId || `grok-chunk-${Date.now()}`,
      object: 'response.chunk',
      created: event.created || Math.floor(Date.now() / 1000),
      model: event.model || this.model,
      choices: [
        {
          index: 0,
          delta: {},
          finishReason,
        },
      ],
      usage: event.usage ? convertUsage(event.usage) : undefined,
    };

    // Include response ID in metadata
    if (responseId) {
      chunk.metadata = {
        responseId,
      };
    }

    return chunk;
  }
}

/**
 * Convert Grok stream event to StreamChunk (legacy function for backward compatibility)
 */
export function convertToStreamChunk(event: GrokStreamEvent, model: string): StreamChunk {
  const processor = new GrokStreamProcessor(model);
  const chunk = processor.processEvent(event);
  return (
    chunk || {
      id: event.id || `grok-${Date.now()}`,
      object: 'response.chunk',
      created: event.created || Math.floor(Date.now() / 1000),
      model: event.model || model,
      choices: [
        {
          index: 0,
          delta: {},
          finishReason: null,
        },
      ],
    }
  );
}

/**
 * Convert usage metadata
 */
function convertUsage(usage: {
  prompt_tokens?: number;
  input_tokens?: number;
  completion_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
}): { promptTokens: number; completionTokens: number; totalTokens: number } {
  return {
    promptTokens: usage.prompt_tokens || usage.input_tokens || 0,
    completionTokens: usage.completion_tokens || usage.output_tokens || 0,
    totalTokens: usage.total_tokens || 0,
  };
}

/**
 * Normalize finish reason
 */
function normalizeFinishReason(reason: string | null | undefined): FinishReason {
  if (!reason) return null;

  switch (reason) {
    case 'stop':
    case 'completed':
      return 'stop';
    case 'length':
      return 'length';
    case 'content_filter':
      return 'content_filter';
    default:
      return null;
  }
}
