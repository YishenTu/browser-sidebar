/**
 * OpenRouter Client - Manages OpenAI SDK instance for OpenRouter
 */

import OpenAI from 'openai';
import type { OpenRouterConfig } from '@/types/providers';

export class OpenRouterClient {
  private client: OpenAI;
  private config: OpenRouterConfig;

  constructor(config: OpenRouterConfig) {
    this.config = config;

    // Get extension ID for referer header
    const extensionId =
      typeof chrome !== 'undefined' && chrome.runtime?.id ? chrome.runtime.id : 'unknown';

    // Initialize OpenAI SDK with OpenRouter base URL
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': config.headers?.referer || `chrome-extension://${extensionId}`,
        'X-Title': config.headers?.title || 'AI Browser Sidebar',
      },
      dangerouslyAllowBrowser: true,
    });
  }

  /**
   * Get the OpenAI client instance
   */
  getClient(): OpenAI {
    return this.client;
  }

  /**
   * Test connection to OpenRouter
   */
  async testConnection(): Promise<boolean> {
    try {
      // Try to fetch models list as a connection test
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
        },
      });

      return response.ok;
    } catch (error) {
      console.error('OpenRouter connection test failed:', error);
      return false;
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: OpenRouterConfig): void {
    this.config = config;

    const extensionId =
      typeof chrome !== 'undefined' && chrome.runtime?.id ? chrome.runtime.id : 'unknown';

    // Reinitialize client with new config
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': config.headers?.referer || `chrome-extension://${extensionId}`,
        'X-Title': config.headers?.title || 'AI Browser Sidebar',
      },
      dangerouslyAllowBrowser: true,
    });
  }
}
