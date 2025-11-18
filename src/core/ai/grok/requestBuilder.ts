/**
 * @file Grok Request Builder
 *
 * Handles construction of Grok API requests
 */

import type { ProviderChatMessage, GrokConfig } from '../../../types/providers';
import type { GrokRequest, GrokChatConfig } from './types';

/**
 * Build complete Grok API request
 */
export function buildRequest(
  messages: ProviderChatMessage[],
  grokConfig: GrokConfig,
  chatConfig?: GrokChatConfig
): GrokRequest {
  // Extract system messages
  const systemMessages = messages.filter(m => m.role === 'system');
  const conversationMessages = messages.filter(m => m.role !== 'system');

  // Build messages array
  const requestMessages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }> = [];

  // Add system messages first
  if (chatConfig?.systemPrompt) {
    requestMessages.push({
      role: 'system',
      content: chatConfig.systemPrompt,
    });
  } else if (systemMessages.length > 0) {
    for (const msg of systemMessages) {
      requestMessages.push({
        role: 'system',
        content: msg.content,
      });
    }
  }

  // Add conversation messages
  for (const msg of conversationMessages) {
    requestMessages.push({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    });
  }

  // Build request
  const request: GrokRequest = {
    model: grokConfig.model,
    messages: requestMessages,
    // Always enable live web search for better accuracy
    search_parameters: {
      mode: 'on',
      return_citations: true,
    },
  };

  // Add streaming flag if needed
  if (chatConfig?.stream) {
    request.stream = true;
  }

  return request;
}

/**
 * Build request headers for Grok API
 */
export function buildHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
}

/**
 * Build Grok API URL
 */
export function buildApiUrl(): string {
  return 'https://api.x.ai/v1/chat/completions';
}
