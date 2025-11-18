/**
 * @file Grok Stream Processor
 *
 * Handles processing of Grok Response API streaming responses
 */

import type { StreamChunk, FinishReason, SearchResult } from '../../../types/providers';
import type {
  GrokStreamEvent,
  GrokResponseOutput,
  GrokOutputContent,
  GrokAnnotation,
} from './types';

/**
 * Grok stream processor for handling Response API streaming responses
 */
export class GrokStreamProcessor {
  private buffer: string = '';
  private lastSeenContent: string = '';
  private model: string;
  private searchSources: SearchResult[] = [];

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
    this.captureSearchMetadata(event);

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
    this.searchSources = [];
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
    const immediateDelta = this.extractImmediateDelta(event);
    if (immediateDelta) {
      this.lastSeenContent += immediateDelta;
      return immediateDelta;
    }

    const snapshotText = this.extractSnapshotText(event);
    if (snapshotText) {
      return this.extractNewPortion(snapshotText);
    }

    return undefined;
  }

  private extractImmediateDelta(event: GrokStreamEvent): string | undefined {
    if (!event.delta) return undefined;

    if (typeof event.delta === 'string') {
      return event.delta;
    }

    if (typeof event.delta.output_text === 'string') {
      return event.delta.output_text;
    }

    const fromContent = this.extractTextFromContentParts(event.delta.content);
    return fromContent || undefined;
  }

  private extractSnapshotText(event: GrokStreamEvent): string | undefined {
    if (typeof event.output_text === 'string' && event.output_text.length > 0) {
      return event.output_text;
    }

    if (typeof event.text === 'string' && event.text.length > 0) {
      return event.text;
    }

    const outputFromEvent = this.extractTextFromOutput(event.output);
    if (outputFromEvent) {
      return outputFromEvent;
    }

    const outputFromResponse = this.extractTextFromOutput(event.response?.output);
    if (outputFromResponse) {
      return outputFromResponse;
    }

    return undefined;
  }

  private extractTextFromOutput(output?: GrokResponseOutput[] | null): string | undefined {
    if (!output?.length) {
      return undefined;
    }

    const textParts = output
      .map(entry => this.extractTextFromContentParts(entry.content))
      .filter((part): part is string => Boolean(part));

    if (!textParts.length) {
      return undefined;
    }

    return textParts.join('');
  }

  private extractTextFromContentParts(content?: GrokOutputContent[] | null): string | undefined {
    if (!content?.length) {
      return undefined;
    }

    const joined = content
      .map(part => part?.text)
      .filter((text): text is string => typeof text === 'string' && text.length > 0)
      .join('');

    return joined.length > 0 ? joined : undefined;
  }

  private extractNewPortion(snapshot: string): string | undefined {
    if (!snapshot) {
      return undefined;
    }

    if (!this.lastSeenContent) {
      this.lastSeenContent = snapshot;
      return snapshot;
    }

    const maxPrefix = Math.min(this.lastSeenContent.length, snapshot.length);
    let prefixLength = 0;
    while (
      prefixLength < maxPrefix &&
      this.lastSeenContent.charCodeAt(prefixLength) === snapshot.charCodeAt(prefixLength)
    ) {
      prefixLength++;
    }

    const delta = snapshot.substring(prefixLength);
    this.lastSeenContent = snapshot;
    return delta.length > 0 ? delta : undefined;
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
    this.attachMetadata(chunk, responseId);

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
    this.attachMetadata(chunk, responseId);

    return chunk;
  }

  /**
   * Capture citation annotations and build search metadata
   */
  private captureSearchMetadata(event: GrokStreamEvent): void {
    const annotations: GrokAnnotation[] = [];
    if (event.annotation) {
      annotations.push(event.annotation);
    }
    if (Array.isArray(event.annotations)) {
      annotations.push(...event.annotations);
    }
    if (event.output) {
      for (const output of event.output) {
        if (output?.annotations && Array.isArray(output.annotations)) {
          annotations.push(...output.annotations);
        }
      }
    }
    if (event.response?.output) {
      for (const output of event.response.output) {
        if (output?.annotations && Array.isArray(output.annotations)) {
          annotations.push(...output.annotations);
        }
      }
    }

    for (const annotation of annotations) {
      this.ingestAnnotation(annotation);
    }
  }

  private ingestAnnotation(annotation: GrokAnnotation | null | undefined): void {
    if (!annotation) return;
    const type = annotation.type?.toLowerCase();
    if (type !== 'url_citation') {
      return;
    }

    const url = this.extractAnnotationUrl(annotation);
    if (!url) return;

    if (this.searchSources.some(source => source.url === url)) {
      return;
    }

    const title = this.deriveAnnotationTitle(annotation, url);
    const snippet = this.extractAnnotationSnippet(annotation);

    const source: SearchResult = {
      title,
      url,
    };
    if (snippet) {
      source.snippet = snippet;
    }

    this.searchSources.push(source);
  }

  private extractAnnotationUrl(annotation: GrokAnnotation): string | null {
    if (annotation.url && typeof annotation.url === 'string') {
      return annotation.url.trim();
    }
    const nestedUrl = annotation.url_citation?.url;
    if (nestedUrl && typeof nestedUrl === 'string') {
      return nestedUrl.trim();
    }
    return null;
  }

  private extractAnnotationSnippet(annotation: GrokAnnotation): string | undefined {
    const snippet = annotation.content || annotation.url_citation?.content;
    if (snippet && typeof snippet === 'string' && snippet.trim().length > 0) {
      return snippet.trim();
    }
    return undefined;
  }

  private deriveAnnotationTitle(annotation: GrokAnnotation, url: string): string {
    const candidates = [
      annotation.title,
      annotation.url_citation?.title,
      annotation.domain,
      annotation.url_citation?.domain,
    ];

    for (const candidate of candidates) {
      if (candidate && typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }

    return this.deriveHostnameFromUrl(url);
  }

  private deriveHostnameFromUrl(url: string): string {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.replace(/^www\./i, '').trim();
      return hostname.length > 0 ? hostname : url;
    } catch {
      return url;
    }
  }

  /**
   * Attach response metadata (response ID + search sources) to chunk
   */
  private attachMetadata(chunk: StreamChunk, responseId?: string | null): void {
    const metadata: Record<string, unknown> = {};
    if (responseId) {
      metadata['responseId'] = responseId;
    }
    if (this.searchSources.length > 0) {
      metadata['searchResults'] = {
        sources: this.searchSources.map(source => ({
          ...source,
        })),
      };
    }

    if (Object.keys(metadata).length > 0) {
      chunk.metadata = {
        ...(chunk.metadata || {}),
        ...metadata,
      };
    }
  }
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
