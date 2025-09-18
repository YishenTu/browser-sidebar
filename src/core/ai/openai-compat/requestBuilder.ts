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
    // Check if the message has sections metadata (from formatTabContent)
    const sections = message.metadata?.['sections'] as
      | {
          systemInstruction?: string;
          tabContent?: string;
          userQuery?: string;
        }
      | undefined;

    if (sections && message.role === 'user') {
      // If we have sections, create multi-part content
      const parts: Array<{ type: 'text'; text: string }> = [];

      if (sections.systemInstruction !== undefined) {
        parts.push({ type: 'text', text: sections.systemInstruction });
      }
      // Only include tabContent if it's not empty
      if (sections.tabContent !== undefined && sections.tabContent !== '') {
        parts.push({ type: 'text', text: sections.tabContent });
      }
      if (sections.userQuery !== undefined) {
        parts.push({ type: 'text', text: sections.userQuery });
      }

      formattedMessages.push({
        role: message.role as 'user' | 'assistant' | 'system',
        content: parts.length > 0 ? parts : message.content,
      });
    } else {
      // Regular message without sections
      formattedMessages.push({
        role: message.role as 'user' | 'assistant' | 'system',
        content: message.content,
      });
    }
  }

  return {
    model: config.model,
    messages: formattedMessages,
    // No temperature/top_p/max_tokens defaults for now.
    // The caller or provider-specific defaults may supply these later.
  } as ChatCompletionCreateParams;
}
