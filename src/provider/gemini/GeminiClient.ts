/**
 * @file Gemini Client Implementation
 *
 * Google Gemini AI provider client implementation extending BaseProvider.
 * Handles initialization, authentication, configuration validation, and
 * prepares for chat generation with thinking modes.
 *
 * Supports:
 * - API key authentication
 * - Temperature parameter (0.0-2.0)
 * - Thinking modes ('off', 'dynamic')
 * - Thought visibility control
 * - Safety settings
 * - Stop sequences
 * - Multimodal capabilities (vision models)
 */

import { BaseProvider } from '../BaseProvider';
import type {
  ProviderConfig,
  GeminiConfig,
  ProviderValidationResult,
  ProviderChatMessage,
  ProviderResponse,
  StreamChunk,
  ModelConfig,
  ProviderError,
  ErrorType,
} from '../../types/providers';

/**
 * Google Gemini API configuration constants
 */
const GEMINI_API_CONFIG = {
  BASE_URL: 'https://generativelanguage.googleapis.com',
  VERSION: 'v1beta',
  DEFAULT_RETRY_AFTER: 60, // seconds
  TOKEN_ESTIMATION_RATIO: 3.5, // average characters per token
} as const;


import { getGeminiModels, getGeminiModel } from './models';

/**
 * Google Gemini AI provider client
 */
export class GeminiClient extends BaseProvider {
  private apiKey: string | null = null;
  private baseUrl: string = GEMINI_API_CONFIG.BASE_URL;

  constructor() {
    super('gemini', 'Google Gemini', {
      streaming: true,
      temperature: true,
      reasoning: false, // Gemini doesn't have reasoning_effort like OpenAI
      thinking: true, // Gemini supports thinking mode
      multimodal: true, // Gemini supports vision
      functionCalling: true, // Gemini supports function calling
      maxContextLength: 2000000, // Max context length across all Gemini models
      supportedModels: getGeminiModels().map(model => model.id),
    });
  }

  // ============================================================================
  // Configuration and Initialization
  // ============================================================================

  /**
   * Initialize the Gemini client with configuration
   */
  async initialize(config: ProviderConfig): Promise<void> {
    // Validate provider type
    if (config.type !== 'gemini') {
      throw new Error('Invalid provider type for Gemini client');
    }

    // Validate and store configuration
    this.setConfig(config);

    // Extract API key and setup internal client
    const geminiConfig = config.config as GeminiConfig;
    this.apiKey = geminiConfig.apiKey;
    
    // Set base URL if custom endpoint provided (for testing)
    if (geminiConfig.endpoint) {
      this.baseUrl = geminiConfig.endpoint;
    }
  }

  /**
   * Validate Gemini-specific configuration
   */
  validateConfig(config: any): ProviderValidationResult {
    const errors: string[] = [];

    // Check if config exists
    if (!config || typeof config !== 'object') {
      return {
        isValid: false,
        errors: ['Invalid configuration object'],
      };
    }

    // API Key validation
    if (!config.apiKey || typeof config.apiKey !== 'string' || config.apiKey.trim() === '') {
      errors.push('Invalid API key');
    }

    // Temperature validation (0.0 to 2.0)
    if (
      config.temperature !== undefined &&
      (typeof config.temperature !== 'number' ||
        isNaN(config.temperature) ||
        config.temperature < 0.0 ||
        config.temperature > 2.0)
    ) {
      errors.push('Invalid temperature');
    }

    // Thinking mode validation (optional, defaults to 'off')
    if (config.thinkingMode !== undefined) {
      if (
        typeof config.thinkingMode !== 'string' ||
        !['off', 'dynamic'].includes(config.thinkingMode)
      ) {
        errors.push('Invalid thinking mode');
      }
    }

    // Show thoughts validation (optional, defaults to false)
    if (config.showThoughts !== undefined) {
      if (typeof config.showThoughts !== 'boolean') {
        errors.push('Invalid show thoughts setting');
      }
    }

    // Model validation
    if (!config.model || typeof config.model !== 'string' || config.model.trim() === '') {
      errors.push('Invalid model');
    }

    // Max tokens validation (optional)
    if (config.maxTokens !== undefined) {
      if (typeof config.maxTokens !== 'number' || config.maxTokens <= 0) {
        errors.push('Invalid max tokens');
      }
    }

    // Top P validation (optional, 0 < topP <= 1)
    if (config.topP !== undefined) {
      if (
        typeof config.topP !== 'number' ||
        isNaN(config.topP) ||
        config.topP <= 0 ||
        config.topP > 1
      ) {
        errors.push('Invalid top P');
      }
    }

    // Top K validation (optional, > 0)
    if (config.topK !== undefined) {
      if (typeof config.topK !== 'number' || config.topK <= 0) {
        errors.push('Invalid top K');
      }
    }

    // Safety settings validation (optional)
    if (config.safetySettings !== undefined) {
      if (!Array.isArray(config.safetySettings)) {
        errors.push('Invalid safety settings format');
      }
    }

    // Stop sequences validation (optional)
    if (config.stopSequences !== undefined) {
      if (!Array.isArray(config.stopSequences)) {
        errors.push('Invalid stop sequences format');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Test connection to Gemini API
   */
  async testConnection(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    try {
      // Track the request for rate limiting
      this.trackRequest();

      const url = this.buildApiUrl('/models');
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-goog-api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
      });

      return response.ok;
    } catch (error) {
      return false;
    }
  }

  // ============================================================================
  // Chat Methods (Placeholder Implementation)
  // ============================================================================

  /**
   * Send chat messages and get response
   * TODO: Full implementation in Task 4.2.2b
   */
  async chat(messages: ProviderChatMessage[], _config?: any): Promise<ProviderResponse> {
    this.ensureConfigured();
    this.validateMessages(messages);
    
    // Placeholder - will be implemented in Task 4.2.2b
    throw new Error('Chat method not yet implemented - will be completed in Task 4.2.2b');
  }

  /**
   * Stream chat messages
   * TODO: Full implementation in Task 4.2.2b
   */
  async *streamChat(messages: ProviderChatMessage[], _config?: any): AsyncIterable<StreamChunk> {
    this.ensureConfigured();
    this.validateMessages(messages);
    
    // Placeholder - will be implemented in Task 4.2.2b
    throw new Error('Stream chat method not yet implemented - will be completed in Task 4.2.2b');
    
    // Unreachable yield to satisfy generator function requirement
    yield {} as StreamChunk;
  }

  // ============================================================================
  // Model Management
  // ============================================================================

  /**
   * Get available Gemini models
   */
  getModels(): ModelConfig[] {
    return getGeminiModels();
  }

  /**
   * Get specific model by ID
   */
  getModel(id: string): ModelConfig | undefined {
    return getGeminiModel(id);
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Estimate token count for text
   * Uses approximate calculation based on Gemini tokenization
   */
  estimateTokens(text: string): number {
    if (!text || text.length === 0) {
      return 0;
    }

    // Use configuration constant for token estimation ratio
    return Math.ceil(text.length / GEMINI_API_CONFIG.TOKEN_ESTIMATION_RATIO);
  }

  /**
   * Format error into provider error structure
   */
  formatError(error: any): ProviderError {
    let errorType: ErrorType = 'unknown';
    let message = 'An unexpected error occurred';
    let code = 'GEMINI_ERROR';
    let retryAfter: number | undefined;
    let details: any = {
      timestamp: new Date(),
    };

    // Handle different error structures
    if (error) {
      // Extract message
      if (error.message) {
        message = error.message;
      } else if (error.error?.message) {
        message = error.error.message;
      }

      // Determine error type based on status or code
      if (error.status === 401 || error.code === 'UNAUTHENTICATED') {
        errorType = 'authentication';
        code = 'GEMINI_AUTH_ERROR';
      } else if (error.status === 429 || error.code === 'RESOURCE_EXHAUSTED') {
        errorType = 'rate_limit';
        code = 'GEMINI_RATE_LIMIT';
        retryAfter = GEMINI_API_CONFIG.DEFAULT_RETRY_AFTER;
      } else if (error.status === 400 || error.code === 'INVALID_ARGUMENT') {
        errorType = 'validation';
        code = 'GEMINI_VALIDATION_ERROR';
      } else if (error.message && error.message.toLowerCase().includes('network')) {
        errorType = 'network';
        code = 'GEMINI_NETWORK_ERROR';
      }

      // Add status code to details if available
      if (error.status) {
        details.statusCode = error.status;
      }

      // Add additional error details
      if (error.details) {
        details = { ...details, ...error.details };
      }

      // Add error-specific details
      if (error.field) {
        details.field = error.field;
      }
      if (error.value) {
        details.value = error.value;
      }
    }

    const providerError: ProviderError = {
      type: errorType,
      message,
      code,
      provider: this.type,
      details,
    };

    if (retryAfter !== undefined) {
      providerError.retryAfter = retryAfter;
    }

    return providerError;
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Build API URL for Gemini endpoints
   */
  private buildApiUrl(endpoint: string): string {
    return `${this.baseUrl}/${GEMINI_API_CONFIG.VERSION}${endpoint}`;
  }

}