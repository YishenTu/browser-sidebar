/**
 * Request builder for OpenAI-Compatible providers
 *
 * Converts provider messages to OpenAI Chat Completions format
 */

import type { ProviderChatMessage, OpenAICompatibleConfig } from '@/types/providers';
import type { ChatCompletionCreateParams } from 'openai/resources/chat/completions';

interface BuildRequestOptions {
  messages: ProviderChatMessage[];
  config: OpenAICompatibleConfig;
  systemPrompt?: string;
}

/**
 * Build OpenAI-compatible chat completion request
 */
export function buildRequest(options: BuildRequestOptions): ChatCompletionCreateParams {
  const { messages, config, systemPrompt } = options;

  // Convert messages to OpenAI format
  const formattedMessages: ChatCompletionCreateParams['messages'] = [];

  // Add system prompt if provided
  if (systemPrompt) {
    formattedMessages.push({
      role: 'system',
      content: systemPrompt,
    });
  }

  // Add conversation messages
  for (const message of messages) {
    // Skip messages with thinking content for now (not all providers support it)
    formattedMessages.push({
      role: message.role as 'user' | 'assistant' | 'system',
      content: message.content,
    });
  }

  return {
    model: config.model,
    messages: formattedMessages,
    // No temperature/top_p/max_tokens defaults for now.
    // The caller or provider-specific defaults may supply these later.
  } as ChatCompletionCreateParams;
}
