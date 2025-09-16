/**
 * OpenRouter Stream Processor
 */

import type { StreamChunk, SearchResult } from '@/types/providers';
import type { OpenRouterStreamChunk } from './types';
import type { ChatCompletionChunk } from 'openai/resources/chat/completions';

// Shared helper types for reasoning and citations
type ReasoningDetail = {
  type?: string;
  text?: string;
  summary?: string;
  data?: string;
  id?: string;
  format?: string;
  index?: number;
  signature?: string | null;
};

type UrlCitationAnnotation = {
  type?: string;
  url?: string;
  title?: string;
  snippet?: string;
  domain?: string;
  url_citation?: { url?: string; title?: string; content?: string; domain?: string };
};

/**
 * Convert OpenAI SDK chunk to our StreamChunk format
 */
export function processStreamChunk(chunk: ChatCompletionChunk): StreamChunk | null {
  // Map OpenAI SDK chunk to our format
  const streamChunk: StreamChunk = {
    id: chunk.id,
    object: chunk.object,
    created: chunk.created,
    model: chunk.model,
    choices: [],
    usage: chunk.usage
      ? {
          promptTokens: chunk.usage.prompt_tokens ?? 0,
          completionTokens: chunk.usage.completion_tokens ?? 0,
          totalTokens: chunk.usage.total_tokens ?? 0,
        }
      : undefined,
  };

  // Process choices
  for (const choice of chunk.choices) {
    // Handle both message and delta structures
    type DeltaData = {
      role?: 'user' | 'assistant' | 'system';
      content?: string;
      reasoning?: string;
      reasoning_details?: ReasoningDetail[];
    };
    const maybeMessage = (choice as unknown as { message?: DeltaData }).message;
    const data: DeltaData = maybeMessage ?? (choice.delta as unknown as DeltaData);

    // Normalize reasoning across providers
    const deltaWithReasoning = data as {
      reasoning?: string;
      reasoning_details?: Array<{
        type: 'reasoning.text' | 'reasoning.summary' | 'reasoning.encrypted';
        text?: string;
        summary?: string;
        data?: string;
        id?: string;
        format?: string;
        index?: number;
        signature?: string | null;
      }>;
    } & typeof data;

    let thinking: string | undefined;

    // First check for simple reasoning field (used by some models)
    if (typeof deltaWithReasoning?.reasoning === 'string' && deltaWithReasoning.reasoning) {
      thinking = deltaWithReasoning.reasoning;
    }
    // Then check for reasoning_details array (OpenAI/Anthropic format)
    else if (
      Array.isArray(deltaWithReasoning?.reasoning_details) &&
      deltaWithReasoning.reasoning_details.length > 0
    ) {
      // Process reasoning_details according to the documented format
      const parts: string[] = [];
      for (const detail of deltaWithReasoning.reasoning_details) {
        switch (detail.type) {
          case 'reasoning.text':
            if (detail.text) parts.push(detail.text);
            break;
          case 'reasoning.summary':
            if (detail.summary) parts.push(detail.summary);
            break;
          case 'reasoning.encrypted':
            // Skip encrypted reasoning or show placeholder
            if (detail.data && detail.data !== '[REDACTED]') {
              parts.push('[Reasoning content]');
            }
            break;
          default:
            // Handle any other type that might have text or summary
            if ('text' in detail && detail.text) {
              parts.push(detail.text as string);
            } else if ('summary' in detail && detail.summary) {
              parts.push(detail.summary as string);
            }
        }
      }
      if (parts.length > 0) {
        thinking = parts.join('\n');
      }
    }

    const processedChoice = {
      index: choice.index,
      delta: {
        role: choice.delta?.role as 'user' | 'assistant' | 'system' | undefined,
        content: choice.delta?.content ?? undefined,
        thinking,
      },
      finishReason:
        (choice.finish_reason as 'stop' | 'length' | 'content_filter' | 'tool_calls' | null) ??
        null,
    };

    streamChunk.choices.push(processedChoice);
  }

  // Extract web search results from annotations if present
  const deltaWithAnnotations = chunk.choices[0]?.delta as
    | ({ annotations?: UrlCitationAnnotation[] } & (typeof chunk.choices)[0]['delta'])
    | undefined;
  if (deltaWithAnnotations?.annotations && Array.isArray(deltaWithAnnotations.annotations)) {
    const searchResults: SearchResult[] = [];

    for (const annotation of deltaWithAnnotations.annotations) {
      // Handle both flattened and nested URL citation shapes
      if (annotation && annotation.type === 'url_citation') {
        const nested = annotation.url_citation;
        const url = nested?.url || annotation.url;
        if (typeof url === 'string') {
          const title = nested?.title || annotation.title || 'Untitled';
          const snippet = nested?.content || annotation.snippet;
          const domain = nested?.domain || annotation.domain || new URL(url).hostname;
          searchResults.push({ title, url, snippet, domain });
        }
      }
    }

    if (searchResults.length > 0) {
      streamChunk.metadata = {
        searchResults: { sources: searchResults },
      };
    }
  }

  return streamChunk;
}

/**
 * Process SSE line (fallback for non-SDK streaming)
 */
export function processSSELine(line: string): StreamChunk | null {
  // Skip empty lines and comments
  if (!line || line.startsWith(':')) {
    return null;
  }

  // Remove "data:" prefix while tolerating extra whitespace
  if (line.startsWith('data:')) {
    line = line.slice(5);
    // Trim only leading whitespace after the prefix so we keep
    // intentional trailing whitespace that would invalidate JSON.
    line = line.replace(/^\s+/, '');
  }

  // Skip lines that don't contain any payload after trimming the prefix
  if (!line || line.trim().length === 0) {
    return null;
  }

  // Check for [DONE] marker
  if (line === '[DONE]') {
    return null;
  }

  try {
    const chunk = JSON.parse(line) as OpenRouterStreamChunk;

    // Convert to our StreamChunk format
    const streamChunk: StreamChunk = {
      id: chunk.id,
      object: chunk.object,
      created: chunk.created,
      model: chunk.model,
      choices: [],
      usage: chunk.usage
        ? {
            promptTokens: chunk.usage.prompt_tokens ?? 0,
            completionTokens: chunk.usage.completion_tokens ?? 0,
            totalTokens: chunk.usage.total_tokens ?? 0,
          }
        : undefined,
      metadata: chunk.metadata,
    };

    // Process choices
    for (const choice of chunk.choices) {
      // Normalize reasoning fields
      type SSEDelta = {
        role?: 'user' | 'assistant' | 'system';
        content?: string;
        reasoning?: string;
        reasoning_details?: Array<{ text?: string; summary?: string }>;
        annotations?: Array<{
          type?: string;
          url?: string;
          title?: string;
          snippet?: string;
          domain?: string;
          url_citation?: { url?: string; title?: string; content?: string; domain?: string };
        }>;
      };
      const d = (choice.delta || {}) as SSEDelta;
      let thinking: string | undefined = d.reasoning;
      if (!thinking && Array.isArray(d.reasoning_details)) {
        const parts: string[] = [];
        for (const rd of d.reasoning_details) {
          if (rd?.text) parts.push(rd.text);
          if (rd?.summary) parts.push(rd.summary);
        }
        if (parts.length) thinking = parts.join('\n');
      }

      streamChunk.choices.push({
        index: choice.index,
        delta: {
          role: (d.role as 'user' | 'assistant' | 'system' | undefined) || undefined,
          content: d.content,
          thinking,
        },
        finishReason:
          (choice.finish_reason as 'stop' | 'length' | 'content_filter' | 'tool_calls' | null) ??
          null,
      });
    }

    // Extract web search results if present
    if ((chunk.choices[0]?.delta as { annotations?: unknown })?.annotations) {
      const searchResults: SearchResult[] = [];

      const annotations = (chunk.choices[0]?.delta as { annotations?: UrlCitationAnnotation[] })
        .annotations;
      for (const annotation of annotations || []) {
        if (annotation && annotation.type === 'url_citation') {
          const nested = annotation.url_citation;
          const url = nested?.url || annotation.url;
          if (typeof url === 'string') {
            const title = nested?.title || annotation.title || 'Untitled';
            const snippet = nested?.content || annotation.snippet;
            const domain = nested?.domain || annotation.domain || new URL(url).hostname;
            searchResults.push({ title, url, snippet, domain });
          }
        }
      }

      if (searchResults.length > 0) {
        streamChunk.metadata = {
          ...streamChunk.metadata,
          searchResults: { sources: searchResults },
        };
      }
    }

    return streamChunk;
  } catch (error) {
    console.error('Failed to parse SSE line:', error);
    return null;
  }
}
