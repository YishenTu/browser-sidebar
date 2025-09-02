/**
 * OpenAI-Compatible API Client
 *
 * Lightweight wrapper around OpenAI SDK configured for custom endpoints
 */

import OpenAI from 'openai';
import type { OpenAICompatibleConfig } from '@/types/providers';
import { createProxiedOpenAIClient, testProxiedConnection } from './ProxiedOpenAIClient';

export class OpenAICompatClient {
  private client: OpenAI;
  private config: OpenAICompatibleConfig;

  constructor(config: OpenAICompatibleConfig) {
    this.config = config;

    // Use proxied client for CORS-restricted endpoints (like Kimi)
    this.client = createProxiedOpenAIClient(config);
  }

  /**
   * Get the underlying OpenAI client instance
   */
  getClient(): OpenAI {
    return this.client;
  }

  /**
   * Test connection to the endpoint
   */
  async testConnection(): Promise<boolean> {
    // Use proxied test for CORS-restricted endpoints
    return testProxiedConnection(this.config);
  }

  /**
   * Get configuration
   */
  getConfig(): OpenAICompatibleConfig {
    return this.config;
  }
}
