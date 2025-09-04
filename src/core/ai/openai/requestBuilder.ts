/**
 * @file OpenAI Request Builder
 *
 * Handles construction of OpenAI API requests for the Responses API,
 * including message conversion and parameter configuration.
 */

import type { ProviderChatMessage, OpenAIConfig } from '../../../types/providers';
import type { OpenAIResponseRequest, OpenAIChatConfig } from './types';

/**
 * Build complete OpenAI Responses API request
 */
export function buildRequest(
  messages: ProviderChatMessage[],
  openaiConfig: OpenAIConfig,
  chatConfig?: OpenAIChatConfig
): OpenAIResponseRequest {
  // Extract system prompt for instructions field
  const systemMessages = messages.filter(m => m.role === 'system');
  const systemPrompt =
    chatConfig?.systemPrompt ||
    (systemMessages.length > 0 ? systemMessages.map(m => m.content).join('\n') : undefined);

  // Build request parameters for Response API
  const request: OpenAIResponseRequest = {
    model: openaiConfig.model,
    // Always enable web search
    tools: [{ type: 'web_search' }],
    // Always store for conversation continuity
    store: true,
  };

  // Add instructions if available
  if (systemPrompt) {
    request.instructions = systemPrompt;
  }

  // Handle conversation context
  // Only use previous_response_id when we have it (consecutive OpenAI calls)
  // Otherwise, send full history for context preservation
  if (chatConfig?.previousResponseId) {
    // We have a previous response ID from the last OpenAI call
    // This means we're continuing an OpenAI conversation
    request.previous_response_id = chatConfig.previousResponseId;
    // Only include the LAST user message (the new input)
    // The Response API maintains previous context server-side
    const userMessages = messages.filter(m => m.role === 'user');
    const lastUserMessage = userMessages[userMessages.length - 1];
    if (lastUserMessage) {
      request.input = [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: lastUserMessage.content,
            },
          ],
        },
      ];
    }
  } else {
    // No previous response ID - either:
    // 1. First message in conversation
    // 2. Switched from another provider
    // 3. Switched back to OpenAI after using another provider
    // In all cases, send full conversation history

    const hasAssistantMessages = messages.some(m => m.role === 'assistant');

    if (hasAssistantMessages) {
      // Mid-conversation with prior assistant turns (likely from a different provider)
      // The Responses API requires assistant turns to be provided as output_text,
      // while user turns remain input_text.
      request.input = messages.map(m => {
        const role = m.role as 'user' | 'assistant';
        const isAssistant = role === 'assistant';
        return {
          role,
          content: [
            {
              type: isAssistant ? 'output_text' : 'input_text',
              text: m.content,
            },
          ],
        };
      });
    } else {
      // First message in conversation - only include the user message
      const firstUserMessage = messages.find(m => m.role === 'user');
      if (firstUserMessage) {
        request.input = [
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: firstUserMessage.content,
              },
            ],
          },
        ];
      }
    }
  }

  // Add streaming flag if needed
  if (chatConfig?.stream) {
    request.stream = true;
  }

  // Add reasoning params for models that support it
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
export function buildRequestOptions(
  apiKey: string,
  body: unknown,
  signal?: AbortSignal
): RequestInit {
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
