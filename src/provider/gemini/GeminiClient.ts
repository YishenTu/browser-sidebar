/**
 * @file Gemini Client Implementation
 *
 * Google Gemini AI provider client implementation extending BaseProvider.
 * Handles initialization, authentication, configuration validation, and
 * prepares for chat generation with thinking budgets.
 *
 * Supports:
 * - API key authentication
 * - Thinking budgets ('0'=off, '-1'=dynamic)
 * - Thought visibility control
 * - Safety settings
 * - Stop sequences
 * - Multimodal capabilities (vision models)
 */

import { BaseProvider } from '../BaseProvider';
import { getModelsByProvider, getModelById, modelExists } from '../../config/models';
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
} as const;

/**
 * Google Gemini AI provider client
 */
export class GeminiClient extends BaseProvider {
  private apiKey: string | null = null;
  private baseUrl: string = GEMINI_API_CONFIG.BASE_URL;

  constructor() {
    const geminiModels = getModelsByProvider('gemini');
    super('gemini', 'Google Gemini', {
      streaming: true,
      temperature: false,
      reasoning: false, // Gemini doesn't have reasoning_effort like OpenAI
      thinking: true, // Gemini supports thinking budget
      multimodal: true, // Gemini supports vision
      functionCalling: false,
      maxContextLength: 1048576, // Max context length for Gemini 2.5 Flash Lite
      supportedModels: geminiModels.map(model => model.id),
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
  validateConfig(config: Record<string, unknown>): ProviderValidationResult {
    const errors: string[] = [];

    // Check if config exists
    if (!config || typeof config !== 'object') {
      return {
        isValid: false,
        errors: ['Invalid configuration object'],
      };
    }

    // API Key validation
    if (
      !config['apiKey'] ||
      typeof config['apiKey'] !== 'string' ||
      config['apiKey'].trim() === ''
    ) {
      errors.push('Invalid API key');
    }

    // Model validation
    if (!config['model'] || typeof config['model'] !== 'string' || config['model'].trim() === '') {
      errors.push('Invalid model');
    } else if (!modelExists(config['model'])) {
      errors.push(`Unknown model: ${config['model']}`);
    }

    // Thinking budget validation (optional, defaults to '0')
    if (config['thinkingBudget'] !== undefined) {
      if (
        typeof config['thinkingBudget'] !== 'string' ||
        !['0', '-1'].includes(config['thinkingBudget'])
      ) {
        errors.push('Invalid thinking budget');
      }
    }

    // Show thoughts validation (optional, defaults to false)
    if (config['showThoughts'] !== undefined) {
      if (typeof config['showThoughts'] !== 'boolean') {
        errors.push('Invalid show thoughts setting');
      }
    }

    // Log if legacy parameters are provided (but don't fail)
    if (
      config['temperature'] !== undefined ||
      config['topP'] !== undefined ||
      config['topK'] !== undefined ||
      config['maxTokens'] !== undefined
    ) {
      // Legacy parameters ignored - silently handled
      // temperature, topP, topK, maxTokens are no longer used
    }

    // Safety settings validation (optional)
    if (config['safetySettings'] !== undefined) {
      if (!Array.isArray(config['safetySettings'])) {
        errors.push('Invalid safety settings format');
      }
    }

    // Stop sequences validation (optional)
    if (config['stopSequences'] !== undefined) {
      if (!Array.isArray(config['stopSequences'])) {
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
   */
  async chat(
    messages: ProviderChatMessage[],
    _config?: Record<string, unknown>
  ): Promise<ProviderResponse> {
    this.ensureConfigured();
    this.validateMessages(messages);

    throw new Error('Chat method not yet implemented');
  }

  /**
   * Stream chat messages
   */
  async *streamChat(
    messages: ProviderChatMessage[],
    _config?: Record<string, unknown>
  ): AsyncIterable<StreamChunk> {
    this.ensureConfigured();
    this.validateMessages(messages);

    throw new Error('Stream chat method not yet implemented');

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
    return getModelsByProvider('gemini');
  }

  /**
   * Get specific model by ID
   */
  getModel(id: string): ModelConfig | undefined {
    return getModelById(id);
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Format error into provider error structure
   */
  formatError(error: unknown): ProviderError {
    let errorType: ErrorType = 'unknown';
    let message = 'An unexpected error occurred';
    let code = 'GEMINI_ERROR';
    let retryAfter: number | undefined;
    let details: Record<string, unknown> = {
      timestamp: new Date(),
    };

    // Handle different error structures
    if (error && typeof error === 'object') {
      const err = error as Record<string, unknown>;

      // Extract message
      if (typeof err['message'] === 'string') {
        message = err['message'];
      } else if (err['error'] && typeof err['error'] === 'object') {
        const errorObj = err['error'] as Record<string, unknown>;
        if (typeof errorObj['message'] === 'string') {
          message = errorObj['message'];
        }
      }

      // Determine error type based on status or code
      if (err['status'] === 401 || err['code'] === 'UNAUTHENTICATED') {
        errorType = 'authentication';
        code = 'GEMINI_AUTH_ERROR';
      } else if (err['status'] === 429 || err['code'] === 'RESOURCE_EXHAUSTED') {
        errorType = 'rate_limit';
        code = 'GEMINI_RATE_LIMIT';
        retryAfter = GEMINI_API_CONFIG.DEFAULT_RETRY_AFTER;
      } else if (err['status'] === 400 || err['code'] === 'INVALID_ARGUMENT') {
        errorType = 'validation';
        code = 'GEMINI_VALIDATION_ERROR';
      } else if (
        typeof err['message'] === 'string' &&
        err['message'].toLowerCase().includes('network')
      ) {
        errorType = 'network';
        code = 'GEMINI_NETWORK_ERROR';
      }

      // Add status code to details if available
      if (typeof err['status'] === 'number') {
        details['statusCode'] = err['status'];
      }

      // Add additional error details
      if (err['details'] && typeof err['details'] === 'object') {
        details = { ...details, ...err['details'] };
      }

      // Add error-specific details
      if (err['field']) {
        details['field'] = err['field'];
      }
      if (err['value']) {
        details['value'] = err['value'];
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
