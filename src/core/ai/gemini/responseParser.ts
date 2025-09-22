/**
 * @file Gemini Response Parser
 *
 * Handles parsing and normalization of Gemini API responses,
 * including content extraction, thinking processing, and usage metadata.
 */

import type {
  ProviderResponse,
  Usage,
  FinishReason,
  StreamChunk,
  ProviderType,
  SearchResult,
} from '../../../types/providers';
import type { GeminiResponse, GeminiCandidate } from './types';
import { FINISH_REASON_MAP } from './types';
import { formatSearchMetadata } from './searchMetadata';

/**
 * Parse Gemini API response into provider response format
 */
export function parseResponse(
  data: GeminiResponse,
  model: string,
  providerType: ProviderType,
  _config?: GeminiChatConfig
): ProviderResponse {
  const candidate = data.candidates?.[0];

  // Extract content and thinking from response
  const { content, thinking } = extractContentAndThinking(candidate);

  // Build usage metadata
  const usage = buildUsageMetadata(data);

  // Normalize finish reason
  const finishReason = normalizeFinishReason(candidate?.finishReason);

  // Build base response
  const response: ProviderResponse = {
    id: generateResponseId(),
    content,
    model,
    usage,
    finishReason,
    metadata: {
      provider: providerType,
      timestamp: new Date(),
      model,
    },
  };

  // Add thinking if present
  if (thinking) {
    response.thinking = thinking;
  }

  // Add search metadata if present
  const searchMetadata = extractSearchMetadata(data);
  if (searchMetadata) {
    const formattedMetadata = searchMetadata as ReturnType<typeof formatSearchMetadata>;
    const searchResults: SearchResult[] =
      formattedMetadata?.sources?.map(source => ({
        title: source.title,
        url: source.url,
        snippet: undefined,
        domain: new URL(source.url).hostname,
      })) || [];

    if (searchResults.length > 0) {
      response.metadata = {
        ...response.metadata,
        searchResults,
      };
    }
  }

  return response;
}

/**
 * Convert Gemini streaming response to StreamChunk format
 */
export function convertToStreamChunk(geminiResponse: unknown, model: string): StreamChunk {
  const response = geminiResponse as {
    candidates?: Array<unknown>;
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
      totalTokenCount?: number;
    };
  };
  const candidate = response.candidates?.[0];
  const candidateTyped = candidate as GeminiCandidate | undefined;

  // Extract content and thinking
  const { content, thinking } = extractContentAndThinking(candidateTyped);

  // Normalize finish reason
  const finishReason = normalizeFinishReason(candidateTyped?.finishReason);

  const chunk: StreamChunk = {
    id: generateChunkId(),
    object: 'response.chunk',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        delta: {
          content: content || undefined,
          thinking: thinking || undefined,
        },
        finishReason: candidateTyped?.finishReason ? finishReason : null,
      },
    ],
  };

  // Add usage metadata if present
  if (response.usageMetadata) {
    chunk.usage = {
      promptTokens: response.usageMetadata.promptTokenCount || 0,
      completionTokens: response.usageMetadata.candidatesTokenCount || 0,
      totalTokens: response.usageMetadata.totalTokenCount || 0,
    };
  }

  // Add search metadata if present
  const searchMetadata = extractStreamingSearchMetadata(geminiResponse);
  if (searchMetadata) {
    chunk.metadata = {
      searchResults: searchMetadata,
    };
  }

  return chunk;
}

/**
 * Extract content and thinking from candidate
 */
function extractContentAndThinking(candidate?: GeminiCandidate): {
  content: string;
  thinking?: string;
} {
  let content = '';
  let thinking: string | undefined;

  if (candidate?.content?.parts) {
    const regularTextParts: string[] = [];
    const thoughtParts: string[] = [];

    for (const part of candidate.content.parts) {
      if (part.thought) {
        // This is a thought summary part
        if (part.text) {
          thoughtParts.push(part.text);
        }
      } else if (part.text) {
        // Regular content part
        regularTextParts.push(part.text);
      }
      // Also handle legacy thinking field if present
      if (part.thinking) {
        thoughtParts.push(part.thinking);
      }
    }

    content = regularTextParts.join('');

    // Capture thinking tokens if they exist
    if (thoughtParts.length > 0) {
      thinking = thoughtParts.join(' ');
    }
  }

  return { content, thinking };
}

/**
 * Build usage metadata from response
 */
function buildUsageMetadata(data: GeminiResponse): Usage {
  const usage: Usage = {
    promptTokens: data.usageMetadata?.promptTokenCount || 0,
    completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
    totalTokens: data.usageMetadata?.totalTokenCount || 0,
  };

  if (data.usageMetadata?.thinkingTokenCount) {
    usage.thinkingTokens = data.usageMetadata.thinkingTokenCount;
  }

  return usage;
}

/**
 * Extract search metadata from response (handles multiple field names)
 */
function extractSearchMetadata(data: GeminiResponse): unknown {
  const groundingData =
    (data as { groundingMetadata?: unknown }).groundingMetadata ||
    (data as { grounding_metadata?: unknown }).grounding_metadata ||
    (data as { searchMetadata?: unknown }).searchMetadata ||
    (data as { search_metadata?: unknown }).search_metadata;

  if (groundingData) {
    return formatSearchMetadata(groundingData);
  }

  return undefined;
}

/**
 * Extract search metadata from streaming response
 */
function extractStreamingSearchMetadata(geminiResponse: unknown): unknown {
  const response = geminiResponse as {
    candidates?: Array<{ groundingMetadata?: unknown }>;
    groundingMetadata?: unknown;
    grounding_metadata?: unknown;
    searchMetadata?: unknown;
    search_metadata?: unknown;
  };
  const groundingData =
    response.candidates?.[0]?.groundingMetadata ||
    response.groundingMetadata ||
    response.grounding_metadata ||
    response.searchMetadata ||
    response.search_metadata;

  if (groundingData && Object.keys(groundingData).length > 0) {
    return formatSearchMetadata(groundingData);
  }

  return undefined;
}

/**
 * Normalize finish reasons from Gemini to standard format
 */
export function normalizeFinishReason(reason?: string): FinishReason {
  if (!reason) return 'stop';

  const upperReason = reason.toUpperCase();
  return FINISH_REASON_MAP[upperReason] || 'stop';
}

/**
 * Generate unique response ID
 */
function generateResponseId(): string {
  return `gemini-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Generate unique chunk ID
 */
function generateChunkId(): string {
  return `gemini-${Date.now()}`;
}

/**
 * Process stream chunk with configuration
 */
export function processStreamChunk(chunk: StreamChunk): StreamChunk {
  // Shallow clone to prevent downstream mutation
  const processedChunk: StreamChunk = { ...chunk };
  processedChunk.choices = chunk.choices.map(choice => ({
    ...choice,
    delta: { ...choice.delta },
  }));
  return processedChunk;
}
