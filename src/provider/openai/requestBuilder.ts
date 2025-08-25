/**
 * @file OpenAI Request Builder
 *
 * Handles construction of OpenAI API requests for the Responses API,
 * including message conversion and parameter configuration.
 */

import type { ProviderChatMessage, OpenAIConfig } from '../../types/providers';
import type { OpenAIResponseRequest, OpenAIChatConfig } from './types';

/**
 * Build complete OpenAI Responses API request
 */
export function buildRequest(
  messages: ProviderChatMessage[],
  openaiConfig: OpenAIConfig,
  chatConfig?: OpenAIChatConfig
): OpenAIResponseRequest {
  // Convert messages to Responses API input format
  const input = convertMessagesToInput(messages);

  // Build request parameters - minimal set only
  const request: OpenAIResponseRequest = {
    model: openaiConfig.model,
    input,
    // Always enable web search
    tools: [{ type: 'web_search_preview' }],
  };

  // Add streaming flag if needed
  if (chatConfig?.stream) {
    request.stream = true;
  }

  // Add reasoning params for models that support it with web search
  // According to OpenAI docs, newer models (GPT-5 family) support both
  const reasoningEffort = chatConfig?.reasoningEffort ?? openaiConfig.reasoningEffort;
  if (reasoningEffort) {
    request.reasoning = {
      effort: reasoningEffort,
      summary: 'auto',
    };
  }

  return request;
}

/**
 * Convert provider messages to OpenAI Responses API input format
 */
export function convertMessagesToInput(messages: ProviderChatMessage[]): string {
  // For Responses API, we need to maintain conversation order
  // Only extract system messages to put first, then keep conversation order
  const systemMessages = messages.filter(m => m.role === 'system');
  const conversationMessages = messages.filter(m => m.role !== 'system');

  // Combine: system messages first (if any), then conversation in original order
  const orderedMessages = [...systemMessages, ...conversationMessages];

  return orderedMessages
    .map(m => {
      const role = m.role.charAt(0).toUpperCase() + m.role.slice(1);
      return `${role}: ${m.content}`;
    })
    .join('\n');
}

/**
 * Build request options for fetch
 */
export function buildRequestOptions(apiKey: string, body: any, signal?: AbortSignal): RequestInit {
  if (!apiKey) {
    throw new Error('OpenAI API key is not configured. Please add your API key in settings.');
  }

  return {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  };
}
