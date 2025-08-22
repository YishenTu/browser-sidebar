/**
 * @file OpenAI Client Setup
 *
 * OpenAI client configuration and initialization for the browser extension.
 * Provides secure API key management, configuration validation, and connection testing.
 * 
 * Features:
 * - Secure API key initialization and validation
 * - Custom configuration support (base URL, headers, timeout, retries)
 * - Connection testing with model listing
 * - Authentication handling
 * - Response API readiness
 * 
 * Supports BYOK (Bring Your Own Key) model for privacy-focused usage.
 */

import OpenAI from 'openai';
import type { OpenAIConfig, ProviderValidationResult } from '../../types/providers';

/**
 * Custom configuration options for OpenAI client
 */
export interface OpenAIClientOptions {
  baseURL?: string;
  timeout?: number;
  maxRetries?: number;
  headers?: Record<string, string>;
}

/**
 * Extended OpenAI configuration with client options
 */
export interface ExtendedOpenAIConfig extends OpenAIConfig {
  customOptions?: OpenAIClientOptions;
}

/**
 * OpenAI Client for browser extension
 * 
 * Handles OpenAI SDK initialization, configuration management, and connection testing.
 * Designed for privacy-focused BYOK (Bring Your Own Key) usage.
 */
export class OpenAIClient {
  private openaiInstance: OpenAI | null = null;
  private currentConfig: ExtendedOpenAIConfig | null = null;

  /**
   * Create a new OpenAI client instance
   * Does not initialize the OpenAI SDK until initialize() is called
   */
  constructor() {
    // Intentionally empty - initialization happens in initialize()
  }

  /**
   * Check if the client is initialized
   */
  public isInitialized(): boolean {
    return this.openaiInstance !== null;
  }

  /**
   * Get the OpenAI SDK instance
   * Returns null if not initialized
   */
  public getOpenAIInstance(): OpenAI | null {
    return this.openaiInstance;
  }

  /**
   * Initialize the OpenAI client with configuration
   * 
   * @param config - OpenAI configuration including API key and optional custom options
   * @throws Error if configuration is invalid or initialization fails
   */
  public async initialize(config: ExtendedOpenAIConfig): Promise<void> {
    // Validate configuration first
    const validation = this.validateConfiguration(config);
    if (!validation.isValid) {
      throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
    }

    // Validate API key format
    if (!config.apiKey || typeof config.apiKey !== 'string') {
      throw new Error('OpenAI API key is required and cannot be empty');
    }

    if (!config.apiKey.startsWith('sk-')) {
      throw new Error('OpenAI API key must start with "sk-"');
    }

    try {
      // Create OpenAI client configuration
      const clientConfig: ConstructorParameters<typeof OpenAI>[0] = {
        apiKey: config.apiKey,
        baseURL: config.customOptions?.baseURL || 'https://api.openai.com/v1',
        timeout: config.customOptions?.timeout || 60000, // 60 seconds
        maxRetries: config.customOptions?.maxRetries || 3,
        defaultHeaders: config.customOptions?.headers || {},
      };

      // Initialize OpenAI SDK
      this.openaiInstance = new OpenAI(clientConfig);

      // Store configuration (deep copy to prevent external modifications)
      this.currentConfig = JSON.parse(JSON.stringify(config));

    } catch (error) {
      // Clean up on failure
      this.openaiInstance = null;
      this.currentConfig = null;
      throw error;
    }
  }

  /**
   * Validate OpenAI configuration
   * 
   * @param config - Configuration to validate
   * @returns Validation result with errors if any
   */
  public validateConfiguration(config: ExtendedOpenAIConfig): ProviderValidationResult {
    const errors: string[] = [];

    // Validate API key - check type first before checking content
    if (typeof config.apiKey !== 'string') {
      if (config.apiKey === null || config.apiKey === undefined) {
        errors.push('API key is required and cannot be empty');
      } else {
        errors.push('API key must be a string');
      }
    } else if (config.apiKey === '') {
      errors.push('API key is required and cannot be empty');
    } else if (!config.apiKey.startsWith('sk-')) {
      errors.push('API key must start with "sk-"');
    }

    // Validate custom options if provided
    if (config.customOptions) {
      const customOptions = config.customOptions;

      // Validate base URL
      if (customOptions.baseURL !== undefined) {
        if (typeof customOptions.baseURL !== 'string') {
          errors.push('Custom baseURL must be a string');
        } else {
          try {
            new URL(customOptions.baseURL);
          } catch {
            errors.push('Custom baseURL must be a valid URL');
          }
        }
      }

      // Validate timeout
      if (customOptions.timeout !== undefined) {
        if (typeof customOptions.timeout !== 'number' || customOptions.timeout <= 0) {
          errors.push('Timeout must be a positive number');
        }
      }

      // Validate max retries
      if (customOptions.maxRetries !== undefined) {
        if (typeof customOptions.maxRetries !== 'number' || customOptions.maxRetries < 0) {
          errors.push('Max retries must be a non-negative number');
        }
      }

      // Validate headers
      if (customOptions.headers !== undefined) {
        if (typeof customOptions.headers !== 'object' || customOptions.headers === null || Array.isArray(customOptions.headers)) {
          errors.push('Headers must be an object');
        } else {
          // Check for disallowed headers
          if ('Authorization' in customOptions.headers) {
            errors.push('Cannot override Authorization header in custom headers');
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Test connection to OpenAI API
   * 
   * @returns Promise that resolves to true if connection is successful
   * @throws Error if client is not initialized
   */
  public async testConnection(): Promise<boolean> {
    if (!this.isInitialized()) {
      throw new Error('OpenAI client is not initialized');
    }

    try {
      // Test connection by listing models
      await this.openaiInstance!.models.list();
      return true;
    } catch (error) {
      // Connection failed - could be invalid API key, network error, etc.
      return false;
    }
  }

  /**
   * Get current configuration
   * 
   * @returns Current configuration or null if not initialized
   */
  public getConfiguration(): ExtendedOpenAIConfig | null {
    if (!this.currentConfig) {
      return null;
    }

    // Return deep copy to prevent external modifications
    return JSON.parse(JSON.stringify(this.currentConfig));
  }

  /**
   * Reset the client to uninitialized state
   * Clears the OpenAI instance and configuration
   */
  public reset(): void {
    this.openaiInstance = null;
    this.currentConfig = null;
  }
}