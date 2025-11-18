/**
 * @file Grok Stream Processor
 *
 * Handles processing of Grok streaming responses
 */

import type { StreamChunk, FinishReason } from '../../../types/providers';
import type { GrokStreamEvent } from './types';

/**
 * Grok stream processor for handling streaming responses
 */
export class GrokStreamProcessor {
  private buffer: string = '';

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
   * Reset processor state
   */
  reset(): void {
    this.buffer = '';
  }
}

/**
 * Convert Grok stream event to StreamChunk
 */
export function convertToStreamChunk(event: GrokStreamEvent, model: string): StreamChunk {
  const choice = event.choices?.[0];
  const delta = choice?.delta || {};
  const finishReason = normalizeFinishReason(choice?.finish_reason);

  return {
    id: event.id || `grok-${Date.now()}`,
    object: event.object || 'chat.completion.chunk',
    created: event.created || Math.floor(Date.now() / 1000),
    model: event.model || model,
    choices: [
      {
        index: choice?.index || 0,
        delta: {
          role: delta.role as 'user' | 'assistant' | 'system' | undefined,
          content: delta.content,
        },
        finishReason,
      },
    ],
    usage: event.usage
      ? {
          promptTokens: event.usage.prompt_tokens || 0,
          completionTokens: event.usage.completion_tokens || 0,
          totalTokens: event.usage.total_tokens || 0,
        }
      : undefined,
  };
}

/**
 * Normalize finish reason
 */
function normalizeFinishReason(reason: string | null | undefined): FinishReason {
  if (!reason) return null;

  switch (reason) {
    case 'stop':
      return 'stop';
    case 'length':
      return 'length';
    case 'content_filter':
      return 'content_filter';
    default:
      return null;
  }
}
