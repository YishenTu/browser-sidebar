/**
 * @file OpenAI Stream Processor
 *
 * Handles processing of OpenAI streaming responses,
 * including delta extraction and cumulative content tracking.
 */

import type { StreamChunk } from '../../../types/providers';
import type { OpenAIStreamEvent, SearchMetadata } from './types';
import {
  extractSearchMetadataFromEvent,
  extractReasoningSummary,
  convertUsage,
  normalizeFinishReason,
} from './responseParser';

/**
 * OpenAI stream processor for handling streaming responses
 */
export class OpenAIStreamProcessor {
  private lastSeenContent: string = '';
  private emittedReasoning: boolean = false;
  private searchMetadata: SearchMetadata | null = null;
  private model: string;
  private showThinking: boolean;

  constructor(model: string, showThinking: boolean = false) {
    this.model = model;
    this.showThinking = showThinking;
  }

  /**
   * Process a streaming event and return a StreamChunk if applicable
   */
  processEvent(event: OpenAIStreamEvent): StreamChunk | null {
    // Handle web search events
    if (this.isWebSearchEvent(event)) {
      const metadata = extractSearchMetadataFromEvent(event);
      if (metadata) {
        this.searchMetadata = metadata;
      }
      return null; // Don't yield chunk for search events
    }

    // Handle reasoning summary delta events - stream in real-time
    if (
      event.type === 'response.reasoning_summary_text.delta' &&
      event.delta &&
      this.showThinking
    ) {
      this.emittedReasoning = true;
      const deltaStr = typeof event.delta === 'string' ? event.delta : String(event.delta);
      // For delta events, do not include event metadata/usage per contract tests
      return this.createThinkingChunk(deltaStr);
    }

    // Handle reasoning summary completion
    if (this.isReasoningCompletionEvent(event)) {
      // Just continue, no need to emit again since we streamed deltas
      return null;
    }

    // Extract the actual delta content for message text
    const deltaContent = this.extractDeltaContent(event);

    // Check for standalone reasoning events (in case API sends them separately)
    if (!this.emittedReasoning && this.isStandaloneReasoningEvent(event)) {
      const summary = extractReasoningSummary(event);
      if (summary && summary.trim().length > 0 && this.showThinking) {
        this.emittedReasoning = true;
        return this.createThinkingChunk(summary, event);
      }
    }

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
   * Reset processor state for new stream
   */
  reset(): void {
    this.lastSeenContent = '';
    this.emittedReasoning = false;
    this.searchMetadata = null;
  }

  /**
   * Get accumulated search metadata
   */
  getSearchMetadata(): SearchMetadata | null {
    return this.searchMetadata;
  }

  /**
   * Set search metadata
   */
  setSearchMetadata(metadata: SearchMetadata | null): void {
    this.searchMetadata = metadata;
  }

  /**
   * Check if event is a web search event
   */
  private isWebSearchEvent(event: OpenAIStreamEvent): boolean {
    return (
      event.type === 'response.web_search_call.completed' ||
      (event.type === 'response.output_item.done' &&
        (event.item?.type === 'web_search_call' || event.item?.type === 'message'))
    );
  }

  /**
   * Check if event is a reasoning completion event
   */
  private isReasoningCompletionEvent(event: OpenAIStreamEvent): boolean {
    return (
      event.type === 'response.reasoning_summary_text.done' ||
      event.type === 'response.reasoning_summary_part.done'
    );
  }

  /**
   * Check if event is a standalone reasoning event
   */
  private isStandaloneReasoningEvent(event: OpenAIStreamEvent): boolean {
    return event.type === 'reasoning' || event.item_type === 'reasoning';
  }

  /**
   * Check if event is a completion event
   */
  private isCompletionEvent(event: OpenAIStreamEvent): boolean {
    return (
      event.type === 'response.completed' ||
      event.finish_reason !== undefined ||
      event.status === 'completed'
    );
  }

  /**
   * Extract delta content from event
   */
  private extractDeltaContent(event: OpenAIStreamEvent): string | undefined {
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

    return undefined;
  }

  /**
   * Create a thinking chunk
   */
  private createThinkingChunk(thinking: string, event?: OpenAIStreamEvent): StreamChunk {
    const thinkingStr = typeof thinking === 'string' ? thinking : undefined;
    return {
      id: event?.id || event?.response_id || `resp-chunk-${Date.now()}-thinking`,
      object: 'response.chunk',
      created: event?.created || Math.floor(Date.now() / 1000),
      model: event?.model || this.model,
      choices: [
        {
          index: 0,
          delta: { thinking: thinkingStr },
          finishReason: null,
        },
      ],
      usage: event?.usage ? convertUsage(event.usage) : undefined,
    };
  }

  /**
   * Create a content chunk
   */
  private createContentChunk(content: string, event: OpenAIStreamEvent): StreamChunk {
    const finishReason = normalizeFinishReason(event.finish_reason || event.status || null);

    const chunk: StreamChunk = {
      id: event.id || event.response_id || `resp-chunk-${Date.now()}`,
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

    // Include metadata
    const metadata: Record<string, unknown> = {};
    if (this.searchMetadata) {
      metadata['searchResults'] = this.searchMetadata;
    }
    // Include response ID if available
    const responseId = event.id || event.response_id;
    if (responseId) {
      metadata['responseId'] = responseId;
    }
    if (Object.keys(metadata).length > 0) {
      chunk.metadata = metadata;
    }

    return chunk;
  }

  /**
   * Create a completion chunk
   */
  private createCompletionChunk(event: OpenAIStreamEvent): StreamChunk {
    const finishReason = normalizeFinishReason(event.finish_reason || event.status || null);

    const chunk: StreamChunk = {
      id: event.id || event.response_id || `resp-chunk-${Date.now()}`,
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

    // Include metadata in final chunk
    const metadata: Record<string, unknown> = {};
    if (this.searchMetadata) {
      metadata['searchResults'] = this.searchMetadata;
    }
    // Include response ID if available
    const responseId = event.id || event.response_id;
    if (responseId) {
      metadata['responseId'] = responseId;
    }
    if (Object.keys(metadata).length > 0) {
      chunk.metadata = metadata;
    }

    return chunk;
  }
}
