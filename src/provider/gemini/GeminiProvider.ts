/**
 * @file Gemini Provider Implementation
 *
 * Google Gemini AI provider implementation extending BaseProvider.
 * Supports chat generation with thinking budgets, thought visibility,
 * streaming responses, and multimodal capabilities.
 *
 * Features:
 * - Thinking budgets ('0'=off, '-1'=dynamic)
 * - Thought visibility control
 * - Streaming responses
 * - Multimodal support (text and images)
 * - Request cancellation via AbortController
 * - Comprehensive error handling
 */

import { GeminiClient } from './GeminiClient';
import { GeminiStreamProcessor } from './streamProcessor';
import { buildRequest, buildHeaders, buildApiUrl } from './requestBuilder';
import { convertToStreamChunk, processStreamChunk } from './responseParser';
import { handleErrorResponse, withErrorHandlingGenerator } from './errorHandler';
import type {
  ProviderChatMessage,
  StreamChunk,
  GeminiConfig,
  FinishReason,
} from '../../types/providers';
import type { GeminiChatConfig } from './types';

/**
 * Google Gemini provider extending GeminiClient
 */
export class GeminiProvider extends GeminiClient {
  constructor() {
    super();
  }

  // ============================================================================
  // Chat Implementation
  // ============================================================================

  /**
   * Stream chat messages
   */
  override async *streamChat(
    messages: ProviderChatMessage[],
    config?: GeminiChatConfig
  ): AsyncIterable<StreamChunk> {
    yield* this.performStreamChat(
      messages,
      this.streamMessage.bind(this),
      config as Record<string, unknown>
    );
  }

  // ============================================================================
  // Internal Chat Implementation
  // ============================================================================

  /**
   * Stream chat messages from Gemini API
   */
  private async *streamMessage(
    messages: ProviderChatMessage[],
    config?: GeminiChatConfig
  ): AsyncIterable<StreamChunk> {
    this.ensureConfigured();

    const geminiConfig = this.getConfig()?.config as GeminiConfig;
    const request = buildRequest(messages, geminiConfig, config);
    const url = buildApiUrl(
      `/models/${geminiConfig.model}:streamGenerateContent`,
      geminiConfig.apiKey,
      geminiConfig.endpoint
    );

    // Request logging removed for production

    let lastFinishReason: FinishReason = null;

    yield* withErrorHandlingGenerator(async function* () {
      const response = await fetch(url, {
        method: 'POST',
        headers: buildHeaders(geminiConfig.apiKey),
        body: JSON.stringify(request),
        signal: config?.signal,
      });

      if (!response.ok) {
        await handleErrorResponse(response);
      }

      if (!response.body) {
        throw new Error('No response body for streaming');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const processor = new GeminiStreamProcessor();

      try {
        while (true) {
          // Check for abort signal before each read
          if (config?.signal?.aborted) {
            throw new Error('Request aborted');
          }

          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          const chunk = decoder.decode(value, { stream: true });

          // Process chunk to extract complete JSON objects
          const objects = processor.processChunk(chunk);

          // Yield each complete object as it arrives
          for (const item of objects) {
            const streamChunk = convertToStreamChunk(item, geminiConfig.model);
            const processedChunk = processStreamChunk(
              streamChunk,
              config,
              geminiConfig.showThoughts
            );

            if (processedChunk.choices[0]?.finishReason) {
              lastFinishReason = processedChunk.choices[0].finishReason;
            }

            const hasContent = processedChunk.choices[0]?.delta?.content;
            const hasThinking = processedChunk.choices[0]?.delta?.thinking;
            const isCompletion = processedChunk.choices[0]?.finishReason;
            const hasMetadata = processedChunk.metadata?.['searchResults'];

            // Yield if we have content, thinking, completion, or metadata
            if (hasContent || hasThinking || isCompletion || hasMetadata) {
              yield processedChunk;
            }
          }
        }

        // Yield final completion chunk if needed
        if (lastFinishReason) {
          yield {
            id: `gemini-complete-${Date.now()}`,
            object: 'response.chunk',
            created: Math.floor(Date.now() / 1000),
            model: geminiConfig.model,
            choices: [
              {
                index: 0,
                delta: {},
                finishReason: lastFinishReason,
              },
            ],
          };
        }
      } finally {
        reader.releaseLock();
      }
    });
  }
}
