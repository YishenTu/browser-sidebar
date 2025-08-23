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

        // Add reasoning effort for supported models (Responses API schema)
        if (currentConfig.reasoningEffort && supportsReasoning(currentConfig.model)) {
          requestParams.reasoning = { effort: currentConfig.reasoningEffort };
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

        // Add reasoning effort for supported models
        if (currentConfig.reasoningEffort && supportsReasoning(currentConfig.model)) {
          requestParams.reasoning = { effort: currentConfig.reasoningEffort };
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

          for await (const event of asyncIterable as any) {
            try {
              // Log the raw event structure for debugging
              if (event && (event.output_text || event.delta)) {
                console.log('[OpenAI Stream] Raw event:', {
                  hasOutputText: event.output_text !== undefined,
                  outputTextLength: event.output_text?.length,
                  hasDelta: event.delta !== undefined,
                  deltaType: typeof event.delta,
                  preview: event.output_text
                    ? event.output_text.substring(0, 100)
                    : event.delta?.substring?.(0, 100),
                });
              }

              // Extract the actual delta content
              let deltaContent: string | undefined;

              // Check if this event contains cumulative content (Responses API pattern)
              if (event.output_text !== undefined && typeof event.output_text === 'string') {
                const currentFullText = event.output_text;

                // Extract only the new portion
                if (currentFullText.length > lastSeenContent.length) {
                  deltaContent = currentFullText.substring(lastSeenContent.length);
                  lastSeenContent = currentFullText;
                  console.log(
                    `[OpenAI Stream] Extracted delta: ${deltaContent.length} new chars from cumulative`
                  );
                }
              }
              // Otherwise check for incremental delta
              else if (event.delta) {
                if (typeof event.delta === 'object' && event.delta.output_text !== undefined) {
                  deltaContent = event.delta.output_text;
                } else if (typeof event.delta === 'string') {
                  deltaContent = event.delta;
                }
              }

              // Create and yield the chunk if we have content
              if (deltaContent) {
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
              else if (event.finish_reason || event.status === 'completed') {
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
    // Try Responses API fields first
    const content = response.output_text ?? response.content?.[0]?.text ?? '';
    const finishReason = this.normalizeFinishReason(
      response.finish_reason || response.status || null
    );
    const usage = this.convertUsage(response.usage);
    const model = response.model;
    const id = response.id || response.response_id || `resp-${Date.now()}`;

    return {
      id,
      content,
      model,
      usage,
      finishReason,
      metadata: {
        provider: this.type,
        timestamp: new Date(),
        model,
        requestId: id,
      },
    };
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
   * @internal Used by streaming implementation
   * @param event - The streaming event from OpenAI API
   * @param lastCumulativeLength - Length of content already received (for cumulative APIs)
   */
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
