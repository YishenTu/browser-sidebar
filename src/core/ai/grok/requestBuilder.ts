/**
 * @file Grok Request Builder
 *
 * Handles construction of Grok Response API requests
 */

import type { ProviderChatMessage, GrokConfig } from '../../../types/providers';
import type { GrokRequest, GrokChatConfig } from './types';

/**
 * Build complete Grok Response API request
 */
export function buildRequest(
  messages: ProviderChatMessage[],
  grokConfig: GrokConfig,
  chatConfig?: GrokChatConfig
): GrokRequest {
  // Build request parameters for Response API
  const request: GrokRequest = {
    model: grokConfig.model,
    // Always enable web search
    tools: [{ type: 'web_search' }],
    // Always store for conversation continuity
    store: true,
  };

  // Handle conversation context
  // Only use previous_response_id when we have it (consecutive Grok calls)
  // Otherwise, send full history for context preservation
  if (chatConfig?.previousResponseId) {
    // We have a previous response ID from the last Grok call
    // This means we're continuing a Grok conversation
    request.previous_response_id = chatConfig.previousResponseId;

    // Only include the LAST user message (the new input)
    const userMessages = messages.filter(m => m.role === 'user');
    const lastUserMessage = userMessages[userMessages.length - 1];

    if (lastUserMessage) {
      request.input = [
        {
          role: 'user',
          content: lastUserMessage.content,
        },
      ];
    }
  } else {
    // No previous response ID, send full conversation history
    const conversationInputs = buildConversationInputs(messages, chatConfig?.systemPrompt);
    if (conversationInputs.length > 0) {
      request.input = conversationInputs;
    }
  }

  // Add streaming flag if needed
  if (chatConfig?.stream) {
    request.stream = true;
  }

  return request;
}

/**
 * Build conversation inputs from messages
 * xAI Response API accepts system messages in the input array
 */
function buildConversationInputs(
  messages: ProviderChatMessage[],
  systemPromptOverride?: string
): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  const result: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

  // Add system prompt first if provided
  if (systemPromptOverride) {
    result.push({
      role: 'system',
      content: systemPromptOverride,
    });
  } else {
    // Otherwise include system messages from the message history
    const systemMessages = messages.filter(m => m.role === 'system');
    for (const msg of systemMessages) {
      result.push({
        role: 'system',
        content: msg.content,
      });
    }
  }

  // Add all non-system messages in order
  const conversationMessages = messages.filter(m => m.role !== 'system');
  for (const msg of conversationMessages) {
    result.push({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    });
  }

  return result;
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
 * Build Grok Response API URL
 */
export function buildApiUrl(): string {
  return 'https://api.x.ai/v1/responses';
}
