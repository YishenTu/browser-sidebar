/**
 * OpenRouter Request Builder
 */

import type { ProviderChatMessage, OpenRouterConfig } from '@/types/providers';
import type { OpenRouterRequestOptions } from './types';
import { getModelById } from '@/config/models';

interface BuildRequestOptions {
  messages: ProviderChatMessage[];
  config: OpenRouterConfig;
  signal?: AbortSignal;
  systemPrompt?: string;
}

/**
 * Build OpenRouter chat completion request
 */
export function buildRequest({
  messages,
  config,
  systemPrompt,
}: BuildRequestOptions): OpenRouterRequestOptions {
  // Convert messages to OpenAI format
  const formattedMessages: OpenRouterRequestOptions['messages'] = [];

  // Add system prompt if provided
  if (systemPrompt) {
    formattedMessages.push({
      role: 'system',
      content: systemPrompt,
    });
  }

  // Convert provider messages to OpenRouter format
  for (const msg of messages) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      // Check if the message has sections metadata (from formatTabContent)
      const sections = msg.metadata?.['sections'] as
        | {
            systemInstruction?: string;
            tabContent?: string;
            userQuery?: string;
          }
        | undefined;

      if (sections && msg.role === 'user') {
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
          role: msg.role,
          content: parts.length > 0 ? parts : msg.content,
        });
      } else {
        // Regular message without sections
        formattedMessages.push({
          role: msg.role,
          content: msg.content,
        });
      }
    }
  }

  // Handle model ID and optional web search suffix
  const WEB_SEARCH_SUFFIX = ':online';
  const hasWebSearchSuffix = config.model.endsWith(WEB_SEARCH_SUFFIX);
  const baseModelId = hasWebSearchSuffix
    ? config.model.slice(0, -WEB_SEARCH_SUFFIX.length)
    : config.model;
  // Optionally add :online suffix for OpenRouter models to enable web search
  // Set enableWebSearch to true to add the suffix
  const enableWebSearch = false; // Toggle this to enable/disable web search
  const modelId = enableWebSearch
    ? hasWebSearchSuffix
      ? config.model
      : `${config.model}${WEB_SEARCH_SUFFIX}`
    : baseModelId;

  // Evaluate reasoning configuration before building the request so logging shows it before content arrays
  const modelConfig = getModelById(baseModelId);
  type ReasoningPayload = {
    effort?: 'low' | 'medium' | 'high';
    max_tokens?: number;
    exclude?: boolean;
  };
  let reasoningPayload: ReasoningPayload | undefined;

  if (modelConfig && (modelConfig.reasoningEffort || modelConfig.reasoningMaxTokens)) {
    const reasoningCandidate: ReasoningPayload = {};

    if (modelConfig.reasoningMaxTokens !== undefined) {
      // Model uses max_tokens for reasoning (e.g., Anthropic models)
      reasoningCandidate.max_tokens = config.reasoning?.maxTokens ?? modelConfig.reasoningMaxTokens;
    } else if (modelConfig.reasoningEffort !== undefined) {
      // Model uses effort-based reasoning (e.g., OpenAI, DeepSeek models)
      const rawEffort = config.reasoning?.effort ?? modelConfig.reasoningEffort;
      const mappedEffort: 'low' | 'medium' | 'high' | undefined =
        rawEffort === 'minimal' ? 'low' : rawEffort;
      reasoningCandidate.effort = mappedEffort;
    }

    if (config.reasoning?.exclude) {
      reasoningCandidate.exclude = true;
    }

    if (Object.keys(reasoningCandidate).length > 0) {
      reasoningPayload = reasoningCandidate;
    }
  }

  // Build base request ensuring stream/reasoning fields appear before the verbose content payload
  const request: OpenRouterRequestOptions = reasoningPayload
    ? {
        model: modelId,
        stream: true,
        reasoning: reasoningPayload,
        messages: formattedMessages,
      }
    : {
        model: modelId,
        stream: true,
        messages: formattedMessages,
      };

  // Add cache_control for models that support it
  // Only cache large content blocks (>2000 chars) to maximize efficiency
  if (modelConfig && supportsCaching(baseModelId)) {
    const shouldCache = (text: string) => text.length > 2000;

    for (let i = 0; i < request.messages.length; i++) {
      const msg = request.messages[i];
      if (!msg) continue;

      if (typeof msg.content === 'string' && shouldCache(msg.content)) {
        // Convert string content to multipart format with cache_control
        const text = msg.content;
        msg.content = [
          {
            type: 'text',
            text: text,
            cache_control: { type: 'ephemeral' },
          },
        ];
      } else if (Array.isArray(msg.content)) {
        // For existing multipart content, add cache_control to large text parts
        for (const part of msg.content) {
          if (part.type === 'text' && part.text && shouldCache(part.text) && !part.cache_control) {
            part.cache_control = { type: 'ephemeral' };
          }
        }
      }
    }
  }

  return request;
}

/**
 * Check if a model supports reasoning
 */
export function supportsReasoning(modelId: string): boolean {
  // Strip any suffix before lookup
  const baseId = modelId.split(':')[0] || modelId;
  const modelConfig = getModelById(baseId);
  return !!(modelConfig && (modelConfig.reasoningEffort || modelConfig.reasoningMaxTokens));
}

/**
 * Check if a model supports caching
 */
export function supportsCaching(modelId: string): boolean {
  // Strip any suffix before checking
  const baseId = modelId.split(':')[0] || modelId;
  // For now, cache support is still based on provider prefixes
  // This could be moved to ModelConfig in the future if needed
  return baseId.startsWith('anthropic/') || baseId.startsWith('google/');
}
