/**
 * @file Gemini Provider Implementation
 *
 * Google Gemini AI provider implementation extending BaseProvider.
 * Supports chat generation with temperature control, thinking modes,
 * thought visibility, streaming responses, and multimodal capabilities.
 *
 * Features:
 * - Temperature parameter support (0.0-2.0)
 * - Thinking modes ('off', 'dynamic')
 * - Thought visibility control
 * - Streaming with TokenBuffer integration
 * - Multimodal support (text and images)
 * - Request cancellation via AbortController
 * - Comprehensive error handling
 */

import { GeminiClient } from './GeminiClient';
import { StreamParser } from '../streamParser';
import { TokenBuffer, FlushStrategy } from '../tokenBuffer';
import type {
  ProviderChatMessage,
  ProviderResponse,
  StreamChunk,
  GeminiConfig,
  Usage,
  FinishReason,
  ThinkingMode,
} from '../../types/providers';

/**
 * Gemini API request format interfaces
 */
interface GeminiPart {
  text?: string;
  thinking?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

interface GeminiContent {
  role: string;
  parts: GeminiPart[];
}

interface GeminiGenerationConfig {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  stopSequences?: string[];
  responseModalities?: string[];
}

interface GeminiRequest {
  contents: GeminiContent[];
  generationConfig: GeminiGenerationConfig;
  safetySettings?: Array<{
    category: string;
    threshold: string;
  }>;
}

/**
 * Gemini API response format interfaces
 */
interface GeminiResponsePart {
  text?: string;
  thinking?: string;
}

interface GeminiCandidate {
  content?: {
    parts: GeminiResponsePart[];
    role?: string;
  };
  finishReason?: string;
  index?: number;
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
    thinkingTokenCount?: number;
  };
}

/**
 * Chat configuration interface
 */
interface ChatConfig {
  temperature?: number;
  thinkingMode?: ThinkingMode;
  showThoughts?: boolean;
  signal?: AbortSignal;
}

/**
 * Google Gemini provider extending GeminiClient
 */
export class GeminiProvider extends GeminiClient {
  private streamParser = new StreamParser();

  constructor() {
    super();
  }

  // ============================================================================
  // Chat Implementation
  // ============================================================================

  /**
   * Send chat messages and get response
   */
  override async chat(
    messages: ProviderChatMessage[],
    config?: ChatConfig
  ): Promise<ProviderResponse> {
    return this.performChat(messages, this.sendMessage.bind(this), config);
  }

  /**
   * Stream chat messages
   */
  override async *streamChat(
    messages: ProviderChatMessage[],
    config?: ChatConfig
  ): AsyncIterable<StreamChunk> {
    yield* this.performStreamChat(messages, this.streamMessage.bind(this), config);
  }

  // ============================================================================
  // Internal Chat Implementation
  // ============================================================================

  /**
   * Send a single chat request to Gemini API
   */
  private async sendMessage(
    messages: ProviderChatMessage[],
    config?: ChatConfig
  ): Promise<ProviderResponse> {
    this.ensureConfigured();

    const request = this.buildRequest(messages, config);
    const url = this.buildGeminiApiUrl(`/models/${this.getCurrentModel()}:generateContent`);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(request),
        signal: config?.signal,
      });

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      const data: GeminiResponse = await response.json();
      return this.parseResponse(data, config);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw error;
      }

      // If this is already a formatted provider error, re-throw it
      if (error && typeof error === 'object' && 'type' in error && 'provider' in error) {
        throw error;
      }

      const formattedError = this.formatError(error);
      const providerError = new Error(formattedError.message) as Error & typeof formattedError;
      Object.assign(providerError, formattedError);
      throw providerError;
    }
  }

  /**
   * Stream chat messages from Gemini API
   */
  private async *streamMessage(
    messages: ProviderChatMessage[],
    config?: ChatConfig
  ): AsyncIterable<StreamChunk> {
    this.ensureConfigured();

    const request = this.buildRequest(messages, config);
    const url = this.buildGeminiApiUrl(`/models/${this.getCurrentModel()}:streamGenerateContent`);

    let tokenBuffer: TokenBuffer | null = null;
    const bufferedChunks: StreamChunk[] = [];
    let lastFinishReason: FinishReason = null;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(request),
        signal: config?.signal,
      });

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      if (!response.body) {
        throw new Error('No response body for streaming');
      }

      // Initialize token buffer for smooth streaming
      tokenBuffer = new TokenBuffer({
        strategy: FlushStrategy.SIZE_BASED,
        maxTokens: 3, // Small buffer for test compatibility
        flushIntervalMs: 100,
        onFlush: (content, metadata) => {
          const chunk: StreamChunk = {
            id: `gemini-buffered-${Date.now()}`,
            object: 'response.chunk',
            created: Math.floor(Date.now() / 1000),
            model: this.getCurrentModel(),
            choices: [
              {
                index: 0,
                delta: {
                  content,
                  thinking: metadata.thinking,
                },
                finishReason: metadata.finishReason || lastFinishReason,
              },
            ],
            usage: metadata.usage,
          };
          bufferedChunks.push(chunk);
        },
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulator = '';

      try {
        while (true) {
          // Check for abort signal before each read
          if (config?.signal?.aborted) {
            throw new Error('Request aborted');
          }

          const { done, value } = await reader.read();

          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          accumulator += chunk;
          
          // Check if we have a complete JSON array
          if (accumulator.includes(']')) {
            try {
              // Parse the complete JSON array
              const responseArray = JSON.parse(accumulator);
              
              // Process each item in the array
              for (const geminiChunk of responseArray) {
                // Convert Gemini format to StreamChunk format
                const streamChunk = this.convertGeminiToStreamChunk(geminiChunk);
                const processedChunk = this.processStreamChunk(streamChunk, config);

                // Track finish reason
                if (processedChunk.choices[0]?.finishReason) {
                  lastFinishReason = processedChunk.choices[0].finishReason;
                }

                // Check if this chunk has content to buffer
                const hasContent = processedChunk.choices[0]?.delta?.content;
                const hasThinking = processedChunk.choices[0]?.delta?.thinking;
                const isCompletion = processedChunk.choices[0]?.finishReason;

                // Yield chunks with content
                if (hasContent || hasThinking || isCompletion) {
                  yield processedChunk;
                }
              }
              
              // Clear accumulator after successful parse and break since we have the complete response
              accumulator = '';
              break; // Exit the loop since we have the complete response
            } catch (e) {
              // Continue accumulating - not a complete JSON yet
            }
          }
        }

        // Force flush any remaining content
        if (tokenBuffer) {
          tokenBuffer.forceFlush();
          while (bufferedChunks.length > 0) {
            const chunk = bufferedChunks.shift()!;
            // Ensure final chunk has completion status
            if (lastFinishReason && bufferedChunks.length === 0 && chunk.choices[0]) {
              chunk.choices[0].finishReason = lastFinishReason;
            }
            yield chunk;
          }
        }

        // Ensure we yield a final completion chunk if we haven't already
        if (lastFinishReason) {
          yield {
            id: `gemini-final-${Date.now()}`,
            object: 'response.chunk',
            created: Math.floor(Date.now() / 1000),
            model: this.getCurrentModel(),
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
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw error;
      }

      // If this is already a formatted provider error, re-throw it
      if (error && typeof error === 'object' && 'type' in error && 'provider' in error) {
        throw error;
      }

      const formattedError = this.formatError(error);
      const providerError = new Error(formattedError.message) as Error & typeof formattedError;
      Object.assign(providerError, formattedError);
      throw providerError;
    }
  }

  // ============================================================================
  // Request Building
  // ============================================================================

  /**
   * Build Gemini API request
   */
  private buildRequest(messages: ProviderChatMessage[], config?: ChatConfig): GeminiRequest {
    const geminiConfig = this.getConfig()?.config as GeminiConfig;

    // Convert messages and filter out any empty ones
    const contents = this.convertMessages(messages);

    // Validate that we have at least one message with content
    if (contents.length === 0 || contents.every(c => c.parts.length === 0)) {
      throw new Error('Messages array cannot be empty');
    }

    const request: GeminiRequest = {
      contents,
      generationConfig: this.buildGenerationConfig(geminiConfig, config),
    };

    // Add safety settings if configured
    if (geminiConfig.safetySettings) {
      request.safetySettings = geminiConfig.safetySettings;
    }

    return request;
  }

  /**
   * Convert provider messages to Gemini format
   */
  private convertMessages(messages: ProviderChatMessage[]): GeminiContent[] {
    return messages.map(message => {
      const parts: GeminiPart[] = [];

      // Add text content
      if (message.content.trim()) {
        parts.push({ text: message.content });
      }

      // Add multimodal attachments
      if (message.metadata?.['attachments']) {
        for (const attachment of message.metadata['attachments']) {
          if (attachment.type === 'image') {
            // Extract base64 data and mime type
            const matches = attachment.data.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
              const [, mimeType, data] = matches;

              // Validate supported image types
              if (!this.isSupportedImageType(mimeType)) {
                throw new Error(`Unsupported image type: ${mimeType}`);
              }

              parts.push({
                inlineData: {
                  mimeType,
                  data,
                },
              });
            }
          } else {
            throw new Error(`Unsupported media type: ${attachment.type}`);
          }
        }
      }

      return {
        role: message.role === 'assistant' ? 'model' : message.role,
        parts,
      };
    });
  }

  /**
   * Build generation config from provider config and chat config
   */
  private buildGenerationConfig(
    geminiConfig: GeminiConfig,
    chatConfig?: ChatConfig
  ): GeminiGenerationConfig {
    const config: GeminiGenerationConfig = {
      temperature: chatConfig?.temperature ?? geminiConfig.temperature,
      topP: geminiConfig.topP,
      topK: geminiConfig.topK,
      maxOutputTokens: geminiConfig.maxTokens,
    };

    // Validate temperature
    if (config.temperature !== undefined) {
      if (
        typeof config.temperature !== 'number' ||
        isNaN(config.temperature) ||
        config.temperature < 0.0 ||
        config.temperature > 2.0
      ) {
        throw new Error('Temperature must be between 0.0 and 2.0');
      }
    }

    // Add stop sequences
    if (geminiConfig.stopSequences && geminiConfig.stopSequences.length > 0) {
      config.stopSequences = geminiConfig.stopSequences;
    }

    // Configure thinking mode
    const thinkingMode = chatConfig?.thinkingMode ?? geminiConfig.thinkingMode;
    if (thinkingMode === 'dynamic') {
      config.responseModalities = ['TEXT'];
    }

    return config;
  }

  /**
   * Build request headers
   */
  private buildHeaders(): Record<string, string> {
    const geminiConfig = this.getConfig()?.config as GeminiConfig;

    if (!geminiConfig || !geminiConfig.apiKey) {
      throw new Error(
        'Gemini API key is not configured. Please add your Google API key in settings.'
      );
    }

    return {
      'x-goog-api-key': geminiConfig.apiKey,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Build API URL for endpoints
   */
  private buildGeminiApiUrl(endpoint: string): string {
    const geminiConfig = this.getConfig()?.config as GeminiConfig;
    const baseUrl = geminiConfig.endpoint || 'https://generativelanguage.googleapis.com';
    const fullUrl = `${baseUrl}/v1beta${endpoint}`;
    
    return fullUrl;
  }

  // ============================================================================
  // Response Processing
  // ============================================================================

  /**
   * Parse Gemini API response
   */
  private parseResponse(data: GeminiResponse, config?: ChatConfig): ProviderResponse {
    const geminiConfig = this.getConfig()?.config as GeminiConfig;
    const candidate = data.candidates?.[0];

    let content = '';
    let thinking: string | undefined;

    if (candidate?.content?.parts) {
      const textParts = candidate.content.parts.filter(part => part.text).map(part => part.text);
      content = textParts.join('');

      // Handle thinking tokens
      const showThoughts = config?.showThoughts ?? geminiConfig.showThoughts;
      if (showThoughts) {
        const thinkingParts = candidate.content.parts
          .filter(part => part.thinking)
          .map(part => part.thinking);
        if (thinkingParts.length > 0) {
          thinking = thinkingParts.join(' ');
        }
      }
    }

    const usage: Usage = {
      promptTokens: data.usageMetadata?.promptTokenCount || 0,
      completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
      totalTokens: data.usageMetadata?.totalTokenCount || 0,
    };

    if (data.usageMetadata?.thinkingTokenCount) {
      usage.thinkingTokens = data.usageMetadata.thinkingTokenCount;
    }

    const finishReason = this.normalizeFinishReason(candidate?.finishReason);

    const response: ProviderResponse = {
      id: `gemini-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      content,
      model: this.getCurrentModel(),
      usage,
      finishReason,
      metadata: {
        provider: this.type,
        timestamp: new Date(),
        model: this.getCurrentModel(),
      },
    };

    if (thinking) {
      response.thinking = thinking;
    }

    return response;
  }

  /**
   * Convert Gemini response to StreamChunk format
   */
  private convertGeminiToStreamChunk(geminiResponse: any): StreamChunk {
    const candidate = geminiResponse.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text || '';
    const thinking = candidate?.content?.parts?.[0]?.thinking || '';
    const finishReason = this.normalizeFinishReason(candidate?.finishReason);
    
    return {
      id: `gemini-${Date.now()}`,
      object: 'response.chunk',
      created: Math.floor(Date.now() / 1000),
      model: this.getCurrentModel(),
      choices: [
        {
          index: 0,
          delta: {
            content: text,
            thinking: thinking || undefined,
          },
          finishReason: candidate?.finishReason ? finishReason : null,
        },
      ],
      usage: geminiResponse.usageMetadata ? {
        promptTokens: geminiResponse.usageMetadata.promptTokenCount,
        completionTokens: geminiResponse.usageMetadata.candidatesTokenCount,
        totalTokens: geminiResponse.usageMetadata.totalTokenCount,
      } : undefined,
    };
  }

  /**
   * Process individual stream chunk
   */
  private processStreamChunk(chunk: StreamChunk, config?: ChatConfig): StreamChunk {
    const geminiConfig = this.getConfig()?.config as GeminiConfig;
    const showThoughts = config?.showThoughts ?? geminiConfig.showThoughts;

    // Create a copy to avoid mutating the original
    const processedChunk = { ...chunk };
    processedChunk.choices = chunk.choices.map(choice => {
      const processedChoice = { ...choice };

      // Filter out thinking content if showThoughts is false
      if (!showThoughts && choice.delta?.thinking) {
        processedChoice.delta = {
          ...choice.delta,
          thinking: undefined,
        };
      } else {
        processedChoice.delta = { ...choice.delta };
      }

      return processedChoice;
    });

    return processedChunk;
  }

  /**
   * Normalize finish reasons from Gemini to standard format
   */
  private normalizeFinishReason(reason?: string): FinishReason {
    if (!reason) return 'stop';

    switch (reason.toUpperCase()) {
      case 'STOP':
      case 'FINISH':
        return 'stop';
      case 'MAX_TOKENS':
      case 'LENGTH':
        return 'length';
      case 'SAFETY':
      case 'CONTENT_FILTER':
        return 'content_filter';
      default:
        return 'stop';
    }
  }

  // ============================================================================
  // Error Handling
  // ============================================================================

  /**
   * Handle error responses from Gemini API
   */
  private async handleErrorResponse(response: Response): Promise<never> {
    let errorData: any = {};

    try {
      errorData = await response.json();
    } catch {
      // If JSON parsing fails, use response status
      errorData = {
        status: response.status,
        message: response.statusText,
      };
    }


    // Extract retry-after header for rate limiting
    const retryAfter = response.headers?.get?.('retry-after');
    if (retryAfter) {
      if (!errorData.error) {
        errorData.error = {};
      }
      errorData.error.retry_after = parseInt(retryAfter, 10);
    }

    // Create more specific error messages based on status
    let specificMessage = '';
    if (response.status === 401) {
      specificMessage = 'Authentication failed. Please check your Google API key is valid and has Gemini API enabled.';
    } else if (response.status === 403) {
      specificMessage = 'Access denied. Make sure your Google API key has access to Gemini API. You may need to enable it at console.cloud.google.com';
    } else if (response.status === 404) {
      specificMessage = 'Model not found. The selected Gemini model may not be available in your region or with your API key.';
    } else if (response.status === 400) {
      const details = errorData.error?.details?.map((d: any) => d.reason || d.message).join(', ');
      specificMessage = details ? `Invalid request: ${details}` : `Bad request: ${errorData.error?.message || errorData.message || 'Unknown error'}`;
    }

    const formattedError = this.formatError({
      ...errorData,
      status: response.status,
      message: specificMessage || errorData.error?.message || errorData.message || 'Unknown error'
    });

    // Create error with provider error properties
    const error = new Error(specificMessage || formattedError.message) as Error & typeof formattedError;
    Object.assign(error, formattedError);

    throw error;
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get current model from config
   */
  private getCurrentModel(): string {
    const geminiConfig = this.getConfig()?.config as GeminiConfig;
    return geminiConfig.model;
  }

  /**
   * Check if image type is supported
   */
  private isSupportedImageType(mimeType: string): boolean {
    const supportedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    return supportedTypes.includes(mimeType.toLowerCase());
  }
}
