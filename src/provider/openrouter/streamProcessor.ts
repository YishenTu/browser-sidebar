/**
 * OpenRouter Stream Processor
 */

import type { StreamChunk, SearchResult } from '@/types/providers';
import type { OpenRouterStreamChunk } from './types';
import type { ChatCompletionChunk } from 'openai/resources/chat/completions';

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
    // Normalize reasoning across providers
    const deltaWithReasoning = choice.delta as {
      reasoning?: string;
      reasoning_details?: Array<
        | { type: 'reasoning.text'; text?: string }
        | { type: 'reasoning.summary'; summary?: string }
        | { type: string; [k: string]: unknown }
      >;
    } & typeof choice.delta;

    let thinking: string | undefined;
    if (typeof deltaWithReasoning?.reasoning === 'string') {
      thinking = deltaWithReasoning.reasoning;
    } else if (Array.isArray(deltaWithReasoning?.reasoning_details)) {
      // Concatenate any text/summary details for a simple thinking view
      const parts: string[] = [];
      for (const d of deltaWithReasoning.reasoning_details) {
        if ('text' in d && typeof (d as any).text === 'string') parts.push((d as any).text);
        if ('summary' in d && typeof (d as any).summary === 'string')
          parts.push((d as any).summary);
      }
      if (parts.length) thinking = parts.join('\n');
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
  const deltaWithAnnotations = chunk.choices[0]?.delta as {
    annotations?: any[];
  } & (typeof chunk.choices)[0]['delta'];
  if (deltaWithAnnotations?.annotations && Array.isArray(deltaWithAnnotations.annotations)) {
    const searchResults: SearchResult[] = [];

    for (const annotation of deltaWithAnnotations.annotations) {
      // Handle both flattened and nested URL citation shapes
      if (annotation?.type === 'url_citation') {
        const nested = annotation?.url_citation;
        const url = nested?.url || annotation?.url;
        if (typeof url === 'string') {
          const title = nested?.title || annotation?.title || 'Untitled';
          const snippet = nested?.content || annotation?.snippet;
          const domain = nested?.domain || annotation?.domain || new URL(url).hostname;
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

  // Extract cache discount from usage if present
  if (chunk.usage) {
    const usageWithCache = chunk.usage as {
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    } & typeof chunk.usage;
    if (usageWithCache.cache_creation_input_tokens || usageWithCache.cache_read_input_tokens) {
      const cacheTokens =
        (usageWithCache.cache_creation_input_tokens || 0) +
        (usageWithCache.cache_read_input_tokens || 0);
      if (cacheTokens > 0) {
        streamChunk.metadata = {
          ...streamChunk.metadata,
          cacheDiscount: cacheTokens,
        };
      }
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

  // Remove "data: " prefix
  if (line.startsWith('data: ')) {
    line = line.slice(6);
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
      const d: any = choice.delta || {};
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
    if (chunk.choices[0]?.delta.annotations) {
      const searchResults: SearchResult[] = [];

      for (const annotation of chunk.choices[0].delta.annotations as any[]) {
        if (annotation?.type === 'url_citation') {
          const nested = annotation?.url_citation;
          const url = nested?.url || annotation?.url;
          if (typeof url === 'string') {
            const title = nested?.title || annotation?.title || 'Untitled';
            const snippet = nested?.content || annotation?.snippet;
            const domain = nested?.domain || annotation?.domain || new URL(url).hostname;
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
