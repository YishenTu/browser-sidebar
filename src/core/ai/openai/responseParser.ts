/**
 * @file OpenAI Response Parser
 *
 * Handles parsing and normalization of OpenAI API responses,
 * including content extraction, reasoning processing, and usage metadata.
 */

import type {
  ProviderResponse,
  Usage,
  FinishReason,
  StreamChunk,
  ProviderChatMessage,
  SearchResult,
} from '../../../types/providers';
import type {
  OpenAIResponse,
  OpenAIOutput,
  OpenAIUsage,
  OpenAIStreamEvent,
  OpenAIMessageContent,
  SearchMetadata,
  OpenAIAnnotation,
} from './types';

/**
 * Parse OpenAI Responses API response into provider format
 */
export function parseResponse(
  response: OpenAIResponse,
  model: string,
  messages?: ProviderChatMessage[]
): ProviderResponse {
  // Extract content and search metadata
  const { content, searchMetadata: initialSearchMetadata } = extractContentAndMetadata(response);
  let searchMetadata = initialSearchMetadata;

  // If a web search was performed but no metadata, create fallback
  if (!searchMetadata && response.output) {
    const outputs = response.output || response.outputs || [];
    const hasWebSearch =
      Array.isArray(outputs) &&
      outputs.some((o: unknown) => (o as OpenAIOutput)?.type === 'web_search_call');

    if (hasWebSearch && messages) {
      // Use dynamic import to avoid circular dependency
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { createFallbackSearchMetadata } = require('./searchMetadata');
      searchMetadata = createFallbackSearchMetadata(undefined, messages);
    }
  }

  // Extract thinking/reasoning summary
  const thinking = extractReasoningSummary(response);

  // Convert usage metadata
  const usage = convertUsage(response.usage);

  // Normalize finish reason
  const finishReason = normalizeFinishReason(response.finish_reason || response.status);

  const id = response.id || response.response_id || `resp-${Date.now()}`;

  const providerResponse: ProviderResponse = {
    id,
    content,
    model,
    usage,
    finishReason,
    metadata: {
      provider: 'openai',
      timestamp: new Date(),
      model,
      requestId: id,
      responseId: response.id || response.response_id,
    },
  };

  // Add thinking if present
  if (thinking) {
    providerResponse.thinking = thinking;
  }

  // Add search metadata if present
  if (searchMetadata) {
    const searchResults: SearchResult[] = searchMetadata.sources.map(source => ({
      title: source.title,
      url: source.url,
      snippet: source.snippet,
      domain: new URL(source.url).hostname,
    }));

    providerResponse.metadata = {
      ...providerResponse.metadata,
      searchResults,
    };
  }

  return providerResponse;
}

/**
 * Extract content and search metadata from response
 */
export function extractContentAndMetadata(response: OpenAIResponse): {
  content: string;
  searchMetadata?: SearchMetadata | null;
} {
  let content = '';
  let searchMetadata: SearchMetadata | null = null;

  // For Responses API, output is an array of items
  const outputs = response.output || response.outputs || [];
  if (Array.isArray(outputs)) {
    const messageItem = outputs.find((o: OpenAIOutput) => o?.type === 'message');
    if (messageItem && Array.isArray(messageItem.content)) {
      const textParts = messageItem.content
        .map((c: OpenAIMessageContent) => (c?.type === 'output_text' ? c?.text : ''))
        .filter(Boolean);
      if (textParts.length) {
        content = textParts.join('');
      }

      // Extract citations from message annotations
      for (const contentItem of messageItem.content) {
        if (
          contentItem.type === 'output_text' &&
          contentItem.annotations &&
          contentItem.annotations.length > 0
        ) {
          const sources = contentItem.annotations
            .filter(a => a.type === 'url_citation')
            .map(a => ({
              url: a.url,
              title: a.title || 'Untitled',
            }));

          if (sources.length > 0) {
            searchMetadata = { sources };
          }
        }
      }
    }

    // Check for web search in outputs but don't create incomplete fallback
    // The caller should handle creating proper fallback with access to messages
    const webSearchItem = outputs.find((o: OpenAIOutput) => o?.type === 'web_search_call');
    if (webSearchItem && !searchMetadata) {
      // Mark that a search was performed but don't create incomplete metadata
      // Let the calling code handle fallback creation with access to user messages
      searchMetadata = null;
    }
  }

  if (!content) {
    // Fallback to SDK convenience field if structured parse failed
    content = response.output_text ?? response.content?.[0]?.text ?? '';
  }

  return { content, searchMetadata };
}

/**
 * Extract reasoning summary from response
 */
export function extractReasoningSummary(payload: unknown): string | undefined {
  const data = payload as {
    type?: string;
    summary?: unknown[];
    output?: unknown[];
    outputs?: unknown[];
    response?: { output?: unknown[] };
    reasoning?: { summary?: unknown[] };
  };

  try {
    // Direct reasoning event (streaming format from Response API)
    if (data?.type === 'reasoning' && data?.summary) {
      if (Array.isArray(data.summary)) {
        const parts = data.summary
          .map((s: { type?: string; text?: string; content?: string }) => {
            // Handle { type: 'summary_text', text: '...' } format
            if (s?.type === 'summary_text' && s?.text) {
              return s.text;
            }
            // Handle plain text
            return s?.text || s?.content || '';
          })
          .filter(Boolean);
        if (parts.length) {
          return parts.join('\n');
        }
      }
    }

    // Prefer explicit reasoning output item
    const outputs = data?.output || data?.outputs || data?.response?.output;
    if (Array.isArray(outputs)) {
      const reasoningItem = outputs.find(
        (o: { type?: string; item_type?: string }) => (o?.type || o?.item_type) === 'reasoning'
      );
      if (reasoningItem) {
        const summaryArr =
          (reasoningItem as { summary?: unknown[]; data?: { summary?: unknown[] } }).summary ||
          (reasoningItem as { summary?: unknown[]; data?: { summary?: unknown[] } })?.data?.summary;
        if (Array.isArray(summaryArr)) {
          const parts = summaryArr
            .map((s: { type?: string; text?: string; content?: string }) => {
              // Handle { type: 'summary_text', text: '...' } format
              if (s?.type === 'summary_text' && s?.text) {
                return s.text;
              }
              return s?.text || s?.content || '';
            })
            .filter(Boolean);
          if (parts.length) {
            return parts.join('\n');
          }
        }
      }
    }

    // Some SDKs may surface reasoning directly under payload.reasoning
    const directSummary = data?.reasoning?.summary;
    if (Array.isArray(directSummary)) {
      const parts = directSummary.map((s: { text?: string }) => s?.text || '').filter(Boolean);
      if (parts.length) return parts.join('\n');
    }

    // Some events may carry a single summary text field
    const summaryText =
      (payload as { summary?: Array<{ text?: string }>; summary_text?: string })?.summary?.[0]
        ?.text ||
      (payload as { summary?: Array<{ text?: string }>; summary_text?: string })?.summary_text;
    if (summaryText && typeof summaryText === 'string') {
      return summaryText;
    }
  } catch {
    // Defensive: ignore parsing errors
  }
  return undefined;
}

/**
 * Convert OpenAI usage to provider format
 */
export function convertUsage(usage?: OpenAIUsage): Usage {
  if (!usage) {
    return {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };
  }

  // Map both Chat Completions and Responses usage shapes
  return {
    promptTokens: usage.prompt_tokens ?? usage.input_tokens ?? 0,
    completionTokens: usage.completion_tokens ?? usage.output_tokens ?? 0,
    totalTokens:
      usage.total_tokens ??
      (usage.input_tokens && usage.output_tokens ? usage.input_tokens + usage.output_tokens : 0),
    thinkingTokens: usage.reasoning_tokens || usage.thinking_tokens,
  };
}

/**
 * Normalize finish reason across different response formats
 */
export function normalizeFinishReason(reason?: string | null): FinishReason {
  if (!reason) return 'stop';

  const normalized = String(reason).toLowerCase();
  if (normalized.includes('stop') || normalized === 'completed') return 'stop';
  if (normalized.includes('length')) return 'length';
  if (normalized.includes('filter')) return 'content_filter';
  if (normalized.includes('tool')) return 'tool_calls';

  return 'stop';
}

/**
 * Convert OpenAI stream event to StreamChunk
 */
export function convertToStreamChunk(
  event: OpenAIStreamEvent,
  model: string,
  showThinking: boolean = false
): StreamChunk | null {
  const chunk: StreamChunk = {
    id: event.id || event.response_id || `resp-chunk-${Date.now()}`,
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
  };

  // Handle reasoning summary delta events
  if (event.type === 'response.reasoning_summary_text.delta' && event.delta && showThinking) {
    if (chunk.choices[0]) {
      chunk.choices[0].delta.thinking = typeof event.delta === 'string' ? event.delta : undefined;
    }
    return chunk;
  }

  // Handle output text delta events
  if (event.type === 'response.output_text.delta' && event.delta) {
    if (chunk.choices[0]) {
      chunk.choices[0].delta.content = typeof event.delta === 'string' ? event.delta : undefined;
    }
    return chunk;
  }

  // Handle completion events
  if (event.type === 'response.completed' || event.finish_reason || event.status === 'completed') {
    if (chunk.choices[0]) {
      chunk.choices[0].finishReason = normalizeFinishReason(event.finish_reason || event.status);
    }
    if (event.usage) {
      chunk.usage = convertUsage(event.usage);
    }
    return chunk;
  }

  return null;
}

/**
 * Extract search metadata from streaming event
 */
export function extractSearchMetadataFromEvent(event: OpenAIStreamEvent): SearchMetadata | null {
  // Handle web search call completion
  if (event.type === 'response.output_item.done' && event.item?.type === 'web_search_call') {
    const action = event.item.action;
    if (action?.query) {
      return {
        sources: [
          {
            title: `Web search: "${action.query}"`,
            url: 'https://www.google.com/search?q=' + encodeURIComponent(action.query),
          },
        ],
      };
    }
    // Don't return incomplete metadata - let the caller handle fallback with access to messages
    return null;
  }

  // Handle final message output with annotations
  if (event.type === 'response.output_item.done' && event.item?.type === 'message') {
    const content = event.item.content;
    if (content && Array.isArray(content)) {
      for (const contentItem of content) {
        if (
          contentItem.type === 'output_text' &&
          contentItem.annotations &&
          contentItem.annotations.length > 0
        ) {
          const sources = contentItem.annotations
            .filter((a: OpenAIAnnotation) => a.type === 'url_citation')
            .map((a: OpenAIAnnotation) => ({
              url: a.url,
              title: a.title || 'Untitled',
            }));

          if (sources.length > 0) {
            return { sources };
          }
        }
      }
    }
  }

  return null;
}
