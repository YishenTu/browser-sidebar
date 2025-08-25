/**
 * @file OpenAI Provider Implementation
 *
 * OpenAI provider using Response API with reasoning_effort support.
 * Implements streaming responses, error handling, and request cancellation.
 *
 * Features:
 * - OpenAI Responses API integration
 * - Reasoning effort parameter (low/medium/high)
 * - Streaming with token buffering
 * - Request cancellation with AbortController
 * - Comprehensive error handling
 * - Model management and token estimation
 */

import { BaseProvider } from '../BaseProvider';
import { OpenAIClient } from './OpenAIClient';
import {
  getModelsByProvider,
  getModelById,
  supportsReasoning,
  modelExists,
  type ModelConfig,
} from '../../config/models';
import type {
  ProviderConfig,
  ProviderChatMessage,
  ProviderResponse,
  StreamChunk,
  ProviderValidationResult,
  ProviderError,
  OpenAIConfig,
  ErrorType,
  Usage,
} from '../../types/providers';

/**
 * OpenAI Provider implementing Response API
 */
export class OpenAIProvider extends BaseProvider {
  private openaiClient: OpenAIClient;

  constructor() {
    const openaiModels = getModelsByProvider('openai');
    super('openai', 'OpenAI', {
      streaming: true,
      temperature: false,
      reasoning: true,
      thinking: false,
      multimodal: true,
      functionCalling: false,
      maxContextLength: 400000,
      supportedModels: openaiModels.map(m => m.id),
    });

    this.openaiClient = new OpenAIClient();
  }

  /**
   * Initialize the provider with configuration
   */
  async initialize(config: ProviderConfig): Promise<void> {
    const openaiConfig = config.config as OpenAIConfig;

    // Validate configuration first using our own validation
    const validation = this.validateConfig(openaiConfig);
    if (!validation.isValid) {
      throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
    }

    // Extend config with custom options for Response API
    const extendedConfig = {
      ...openaiConfig,
      customOptions: {
        timeout: 120000, // 2 minutes for Response API
        maxRetries: 3,
        ...(openaiConfig as any).customOptions,
      },
    };

    await this.openaiClient.initialize(extendedConfig);
    this.setConfig(config);
  }

  /**
   * Validate OpenAI configuration
   */
  validateConfig(config: any): ProviderValidationResult {
    const errors: string[] = [];

    // Validate API key
    if (!config.apiKey || typeof config.apiKey !== 'string' || config.apiKey.trim() === '') {
      errors.push('Invalid API key');
    } else if (!config.apiKey.startsWith('sk-')) {
      errors.push('API key must start with "sk-"');
    }

    // Validate model
    if (!config.model || typeof config.model !== 'string') {
      errors.push('Invalid model');
    } else if (!modelExists(config.model)) {
      errors.push(`Unknown model: ${config.model}`);
    }

    // Validate reasoning effort (only valid parameter for OpenAI)
    if (config.reasoningEffort !== undefined) {
      if (
        typeof config.reasoningEffort !== 'string' ||
        !['minimal', 'low', 'medium', 'high'].includes(config.reasoningEffort)
      ) {
        errors.push('Invalid reasoning effort');
      }
    }

    // Legacy parameters are ignored silently

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Test connection to OpenAI API
   */
  async testConnection(): Promise<boolean> {
    this.ensureConfigured();
    try {
      return await this.openaiClient.testConnection();
    } catch (error) {
      return false;
    }
  }

  /**
   * Send chat messages using OpenAI Response API
   */
  async chat(messages: ProviderChatMessage[], config?: any): Promise<ProviderResponse> {
    return this.performChat(
      messages,
      async (msgs, cfg) => {
        const openaiInstance = this.openaiClient.getOpenAIInstance();
        if (!openaiInstance) {
          throw new Error('OpenAI client not initialized');
        }

        const currentConfig = this.getConfig()?.config as OpenAIConfig;
        if (!currentConfig) {
          throw new Error('Provider configuration not found');
        }

        // Convert messages to a single input string for Responses API
        const input = this.convertMessagesToResponsesInput(msgs);

        // Build request parameters - minimal set only
        const requestParams: any = {
          model: currentConfig.model,
          input,
        };

        // Add reasoning params for supported models (Responses API schema)
        if (supportsReasoning(currentConfig.model)) {
          // Always request a summary; effort is user-configurable
          requestParams.reasoning = {
            ...(currentConfig.reasoningEffort ? { effort: currentConfig.reasoningEffort } : {}),
            summary: 'auto',
          };
        }

        // Log the ACTUAL API request parameters

        try {
          // Use Responses API with AbortSignal passed via RequestOptions
          const response = await (openaiInstance as any).responses.create(requestParams, {
            signal: cfg?.signal,
          });

          // Log the response model to verify what model actually responded
          return this.convertResponsesToProviderFormat(response);
        } catch (error) {
          // Wrap in Error instance with ProviderError fields for consistency
          const formatted = this.formatError(error);
          const providerError = new Error(formatted.message) as Error & typeof formatted;
          Object.assign(providerError, formatted);
          throw providerError;
        }
      },
      config
    );
  }

  /**
   * Stream chat messages using OpenAI Response API
   */
  async *streamChat(messages: ProviderChatMessage[], config?: any): AsyncIterable<StreamChunk> {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const provider = this;
    yield* this.performStreamChat(
      messages,
      async function* (msgs: ProviderChatMessage[], cfg?: any) {
        const openaiInstance = provider.openaiClient.getOpenAIInstance();
        if (!openaiInstance) {
          throw new Error('OpenAI client not initialized');
        }

        const currentConfig = provider.getConfig()?.config as OpenAIConfig;
        if (!currentConfig) {
          throw new Error('Provider configuration not found');
        }

        // Convert messages to Responses API input
        const input = provider.convertMessagesToResponsesInput(msgs);

        // Build request parameters for streaming - minimal set only
        const requestParams: any = {
          model: currentConfig.model,
          input,
          stream: true,
        };

        // Add reasoning params for supported models
        if (supportsReasoning(currentConfig.model)) {
          requestParams.reasoning = {
            ...(currentConfig.reasoningEffort ? { effort: currentConfig.reasoningEffort } : {}),
            summary: 'auto',
          };
        }

        try {
          let asyncIterable: any;

          // Prefer the official Responses streaming helper when available
          if ((openaiInstance as any)?.responses?.stream) {
            asyncIterable = await (openaiInstance as any).responses.stream(
              { ...requestParams },
              { signal: cfg?.signal }
            );
          } else {
            // Fallback: legacy pattern using create({ stream: true }) that returns an async-iterable
            asyncIterable = await (openaiInstance as any).responses.create(
              { ...requestParams, stream: true },
              { signal: cfg?.signal }
            );
          }

          // Track the last seen cumulative content to extract deltas
          let lastSeenContent = '';
          // Track reasoning summary and whether it's emitted
          let emittedReasoning = false;

          for await (const event of asyncIterable as any) {
            try {
              // Process streaming event based on OpenAI Response API event types

              // Handle reasoning summary delta events - stream in real-time
              if (event.type === 'response.reasoning_summary_text.delta' && event.delta) {
                // Emit thinking delta immediately for real-time streaming
                const thinkingChunk: StreamChunk = {
                  id: `resp-chunk-${Date.now()}-thinking`,
                  object: 'response.chunk',
                  created: Math.floor(Date.now() / 1000),
                  model: provider.getConfig()?.config?.model || 'unknown',
                  choices: [
                    {
                      index: 0,
                      delta: { thinking: event.delta }, // Stream thinking delta
                      finishReason: null,
                    },
                  ],
                };
                emittedReasoning = true;
                yield thinkingChunk;
                continue;
              }

              // Handle reasoning summary completion
              if (
                event.type === 'response.reasoning_summary_text.done' ||
                event.type === 'response.reasoning_summary_part.done'
              ) {
                // Just continue, no need to emit again since we streamed deltas
                continue;
              }

              // Extract the actual delta content for message text
              let deltaContent: string | undefined;

              // Handle output text delta events (the actual message content)
              if (event.type === 'response.output_text.delta' && event.delta) {
                deltaContent = event.delta;
              }
              // Legacy patterns for backward compatibility
              else if (event.output_text !== undefined && typeof event.output_text === 'string') {
                const currentFullText = event.output_text;
                // Extract only the new portion
                if (currentFullText.length > lastSeenContent.length) {
                  deltaContent = currentFullText.substring(lastSeenContent.length);
                  lastSeenContent = currentFullText;
                }
              } else if (event.delta && typeof event.delta === 'string') {
                deltaContent = event.delta;
              }

              // Check for standalone reasoning events (in case API sends them separately)
              if (
                !emittedReasoning &&
                (event.type === 'reasoning' || event.item_type === 'reasoning')
              ) {
                const summary = provider.extractReasoningSummary(event);
                if (summary && summary.trim().length > 0) {
                  const thinkingChunk: StreamChunk = {
                    id: event.id || event.response_id || `resp-chunk-${Date.now()}-thinking`,
                    object: 'response.chunk',
                    created: event.created || Math.floor(Date.now() / 1000),
                    model: event.model || provider.getConfig()?.config?.model || 'unknown',
                    choices: [
                      {
                        index: 0,
                        delta: { thinking: summary },
                        finishReason: null,
                      },
                    ],
                    usage: event.usage ? provider.convertUsage(event.usage) : undefined,
                  };
                  emittedReasoning = true;
                  yield thinkingChunk;
                  continue; // Skip to next event
                }
              }

              // Create and yield the chunk if we have content
              if (deltaContent) {
                // No need to strip reasoning from delta since we handle it separately
                const finishReason = provider.normalizeFinishReason(
                  event.finish_reason || event.status || null
                );

                const streamChunk: StreamChunk = {
                  id: event.id || event.response_id || `resp-chunk-${Date.now()}`,
                  object: 'response.chunk',
                  created: event.created || Math.floor(Date.now() / 1000),
                  model: event.model || provider.getConfig()?.config?.model || 'unknown',
                  choices: [
                    {
                      index: 0,
                      delta: { content: deltaContent },
                      finishReason: finishReason,
                    },
                  ],
                  usage: event.usage ? provider.convertUsage(event.usage) : undefined,
                };

                yield streamChunk;
              }
              // Handle finish events without content
              else if (
                event.type === 'response.completed' ||
                event.finish_reason ||
                event.status === 'completed'
              ) {
                const finishReason = provider.normalizeFinishReason(
                  event.finish_reason || event.status || null
                );

                // Emit final chunk to signal completion
                const streamChunk: StreamChunk = {
                  id: event.id || event.response_id || `resp-chunk-${Date.now()}`,
                  object: 'response.chunk',
                  created: event.created || Math.floor(Date.now() / 1000),
                  model: event.model || provider.getConfig()?.config?.model || 'unknown',
                  choices: [
                    {
                      index: 0,
                      delta: {},
                      finishReason: finishReason,
                    },
                  ],
                  usage: event.usage ? provider.convertUsage(event.usage) : undefined,
                };

                yield streamChunk;
              }
            } catch (parseError) {
              console.warn('Error parsing stream chunk:', parseError);
              continue;
            }
          }
        } catch (error) {
          const formatted = provider.formatError(error);
          const providerError = new Error(formatted.message) as Error & typeof formatted;
          Object.assign(providerError, formatted);
          throw providerError;
        }
      },
      config
    );
  }

  /**
   * Get available OpenAI models
   */
  getModels(): ModelConfig[] {
    return getModelsByProvider('openai');
  }

  /**
   * Get specific model by ID
   */
  getModel(id: string): ModelConfig | undefined {
    return getModelById(id);
  }

  /**
   * Estimate token count for text using rough approximation
   */
  estimateTokens(text: string): number {
    if (!text || text.length === 0) {
      return 0;
    }

    // Rough approximation: ~4 characters per token for English text
    // This is a simplified estimation - real tokenization is more complex
    const roughTokens = Math.ceil(text.length / 4);

    // Account for special characters and punctuation that may increase token count
    const specialCharRegex = /[^\w\s]/g;
    const specialCharCount = (text.match(specialCharRegex) || []).length;

    // Unicode characters typically use more tokens
    // eslint-disable-next-line no-control-regex
    const unicodeRegex = /[^\u0000-\u007F]/g;
    const unicodeCharCount = (text.match(unicodeRegex) || []).length;

    // Adjust estimation
    return Math.max(1, roughTokens + Math.ceil(specialCharCount * 0.5) + unicodeCharCount);
  }

  /**
   * Format error into provider error structure
   */
  formatError(error: any): ProviderError {
    let errorType: ErrorType = 'unknown';
    let message = 'Unknown error occurred';
    let code = 'UNKNOWN_ERROR';
    let retryAfter: number | undefined;

    // Handle OpenAI API errors
    if (error?.error) {
      const apiError = error.error;
      message = apiError.message || message;
      code = apiError.code || code;

      // Determine error type based on OpenAI error structure
      if (apiError.type === 'invalid_request_error' || apiError.code?.includes('api_key')) {
        errorType = 'authentication';
      } else if (apiError.type === 'rate_limit_error' || apiError.code?.includes('rate_limit')) {
        errorType = 'rate_limit';
        // Extract retry-after from headers if available
        if (error.headers?.['retry-after']) {
          retryAfter = parseInt(error.headers['retry-after'], 10);
        }
      } else if (apiError.type?.includes('network') || error.code === 'ECONNREFUSED') {
        errorType = 'network';
      } else if (apiError.type?.includes('validation')) {
        errorType = 'validation';
      }
    } else if (error instanceof Error) {
      message = error.message;

      // Handle common JavaScript/network errors
      if (error.name === 'NetworkError' || error.message.includes('network')) {
        errorType = 'network';
        code = 'NETWORK_ERROR';
      } else if (error.message.includes('abort')) {
        errorType = 'network';
        code = 'REQUEST_ABORTED';
      }
    }

    return this.createError(errorType, message, code, {
      retryAfter,
      details: {
        statusCode: error?.status || error?.statusCode,
        originalError: error,
      },
    });
  }

  /**
   * Convert provider messages to OpenAI API format
   */
  private convertMessagesToResponsesInput(messages: ProviderChatMessage[]): string {
    // Simple role-tagged concatenation for Responses API input
    // System messages first, then others in order
    const ordered = messages.slice().sort((a, b) => {
      const roleOrder: Record<string, number> = { system: 0, user: 1, assistant: 2 };
      return (roleOrder[a.role] ?? 3) - (roleOrder[b.role] ?? 3);
    });
    return ordered
      .map(m => {
        const role = m.role.charAt(0).toUpperCase() + m.role.slice(1);
        return `${role}: ${m.content}`;
      })
      .join('\n');
  }

  /**
   * Convert OpenAI API response to provider format
   */
  private convertResponsesToProviderFormat(response: any): ProviderResponse {
    // Prefer reconstructing content from structured outputs to avoid mixing reasoning summary
    let content = '';
    const outputs = response?.output || response?.outputs || response?.response?.output;
    if (Array.isArray(outputs)) {
      const messageItem = outputs.find((o: any) => (o?.type || o?.item_type) === 'message');
      if (messageItem && Array.isArray(messageItem.content)) {
        const textParts = messageItem.content
          .map((c: any) => (c?.type === 'output_text' ? c?.text : ''))
          .filter(Boolean);
        if (textParts.length) {
          content = textParts.join('');
        }
      }
    }
    if (!content) {
      // Fallback to SDK convenience field if structured parse failed
      content = response.output_text ?? response.content?.[0]?.text ?? '';
    }
    const finishReason = this.normalizeFinishReason(
      response.finish_reason || response.status || null
    );
    const usage = this.convertUsage(response.usage);
    const model = response.model;
    const id = response.id || response.response_id || `resp-${Date.now()}`;
    const thinking = this.extractReasoningSummary(response);

    return {
      id,
      content,
      model,
      usage,
      finishReason,
      thinking,
      metadata: {
        provider: this.type,
        timestamp: new Date(),
        model,
        requestId: id,
      },
    };
  }

  /**
   * Attempt to extract a reasoning summary string from various Responses API shapes
   */
  private extractReasoningSummary(payload: any): string | undefined {
    try {
      // Direct reasoning event (streaming format from Response API)
      if (payload?.type === 'reasoning' && payload?.summary) {
        if (Array.isArray(payload.summary)) {
          const parts = payload.summary
            .map((s: any) => {
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
      const outputs = payload?.output || payload?.outputs || payload?.response?.output;
      if (Array.isArray(outputs)) {
        const reasoningItem = outputs.find((o: any) => (o?.type || o?.item_type) === 'reasoning');
        if (reasoningItem) {
          const summaryArr = reasoningItem.summary || reasoningItem?.data?.summary;
          if (Array.isArray(summaryArr)) {
            const parts = summaryArr
              .map((s: any) => {
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
      const directSummary = payload?.reasoning?.summary;
      if (Array.isArray(directSummary)) {
        const parts = directSummary.map((s: any) => s?.text || '').filter(Boolean);
        if (parts.length) return parts.join('\n');
      }

      // Some events may carry a single summary text field
      const summaryText = payload?.summary?.[0]?.text || payload?.summary_text;
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
  private convertUsage(usage: any): Usage {
    // Map both Chat Completions and Responses usage shapes
    return {
      promptTokens: usage?.prompt_tokens ?? usage?.input_tokens ?? 0,
      completionTokens: usage?.completion_tokens ?? usage?.output_tokens ?? 0,
      totalTokens:
        usage?.total_tokens ??
        (usage?.input_tokens && usage?.output_tokens
          ? usage.input_tokens + usage.output_tokens
          : 0),
      thinkingTokens: usage?.reasoning_tokens || usage?.thinking_tokens,
    };
  }

  /**
   * Normalize finish reason across different response formats
   */
  private normalizeFinishReason(reason: any): any {
    if (!reason) return null;

    const normalized = String(reason).toLowerCase();
    if (normalized.includes('stop')) return 'stop';
    if (normalized.includes('length')) return 'length';
    if (normalized.includes('filter')) return 'content_filter';
    if (normalized.includes('tool')) return 'tool_calls';

    return 'stop';
  }

  /**
   * Convert OpenAI chunk to StreamChunk format
   * @internal Used by streaming implementation - currently unused but preserved for future use
   * @param event - The streaming event from OpenAI API
   * @param lastCumulativeLength - Length of content already received (for cumulative APIs)
   */
  // @ts-expect-error - Method preserved for future streaming implementation
  private convertResponsesEventToStreamChunk(
    event: any,
    lastCumulativeLength: number = 0
  ): StreamChunk | null {
    if (!event) return null;

    // Debug logging for table duplication issue
    if (typeof event === 'object') {
      const hasTable = (text: string) => text && (text.includes('|') || text.includes('---'));
      const eventInfo: any = {};

      if (event.delta?.output_text)
        eventInfo['delta.output_text'] = event.delta.output_text.substring(0, 100);
      if (event.output_text) eventInfo['output_text'] = event.output_text.substring(0, 100);
      if (event.delta && typeof event.delta === 'string')
        eventInfo['delta'] = event.delta.substring(0, 100);
      if (event.text) eventInfo['text'] = event.text.substring(0, 100);

      // Log if any field contains table-like content
      const hasTableContent = Object.values(eventInfo).some((v: any) => hasTable(String(v)));
      if (hasTableContent) {
        console.log('[OpenAI Stream Debug] Table detected in event:', eventInfo);
      }
    }

    // Handle common Responses API streaming shapes
    // Prefer incremental deltas when present to avoid duplicating cumulative text
    let deltaText: string | undefined;

    // 1) Incremental delta in nested object (most precise)
    if (event.delta && typeof event.delta === 'object' && event.delta.output_text !== undefined) {
      deltaText = event.delta.output_text;
    }
    // 2) Incremental delta as string
    else if (event.delta && typeof event.delta === 'string') {
      deltaText = event.delta;
    }
    // 3) Cumulative content in output_text — extract only new portion
    else if (event.output_text !== undefined && typeof event.output_text === 'string') {
      const fullText = event.output_text;
      if (fullText.length > lastCumulativeLength) {
        deltaText = fullText.substring(lastCumulativeLength);
        console.log(
          `[OpenAI Stream] Cumulative mode: extracting chars ${lastCumulativeLength}-${fullText.length}`
        );
      }
    }
    // 4) Legacy format using `text` (may be cumulative)
    else if (event.text !== undefined) {
      const fullText = String(event.text);
      if (fullText.length > lastCumulativeLength) {
        deltaText = fullText.substring(lastCumulativeLength);
      }
    }

    const finishReason = this.normalizeFinishReason(event.finish_reason || event.status || null);

    const model = event.model || this.getConfig()?.config?.model || 'unknown';
    const id = event.id || event.response_id || `resp-chunk-${Date.now()}`;

    const choice = {
      index: 0,
      delta: {
        content: typeof deltaText === 'string' ? deltaText : undefined,
      },
      finishReason: finishReason,
    };

    return {
      id,
      object: 'response.chunk',
      created: event.created || Math.floor(Date.now() / 1000),
      model,
      choices: [choice],
      usage: event.usage ? this.convertUsage(event.usage) : undefined,
    };
  }
}
