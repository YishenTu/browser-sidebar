/**
 * OpenRouter Request Builder
 */

import type { ProviderChatMessage, OpenRouterConfig } from '@/types/providers';
import type { OpenRouterRequestOptions, OpenRouterTextPart } from './types';
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
      formattedMessages.push({
        role: msg.role,
        content: msg.content,
      });
    }
  }

  // Model slug for this request. Enable Web Search by default via `:online`.
  // Do NOT mutate the stored model id; only alter the request-time slug.
  // If the caller already included `:online`, respect it.
  const baseModelId = config.model;
  const modelId = baseModelId.includes(':online') ? baseModelId : `${baseModelId}:online`;

  // Build base request
  const request: OpenRouterRequestOptions = {
    model: modelId,
    messages: formattedMessages,
    stream: true,
  };

  // Add reasoning configuration based on model
  // Use the base model id for lookup (exclude transient suffix like :online)
  const modelConfig = getModelById(baseModelId);

  if (modelId.startsWith('anthropic/')) {
    // Anthropic models use max_tokens for reasoning
    const defaultMaxTokens = modelConfig?.reasoningMaxTokens ?? 8000;
    request.reasoning = {
      max_tokens: config.reasoning?.maxTokens ?? defaultMaxTokens,
    };
  } else if (modelId.startsWith('openai/') || modelId.startsWith('deepseek/')) {
    // OpenAI and DeepSeek models use effort-based reasoning
    const defaultEffort = modelConfig?.reasoningEffort ?? 'medium';
    const effort = config.reasoning?.effort ?? defaultEffort;
    // Map "minimal" to "low" for OpenAI compatibility
    const mappedEffort = effort === 'minimal' ? 'low' : effort;
    request.reasoning = {
      effort: mappedEffort as 'low' | 'medium' | 'high',
      ...(config.reasoning?.exclude ? { exclude: true } : {}),
    };
  }

  // Add cache_control on message text parts for large bodies (Anthropic/Gemini via OpenRouter)
  if (modelId.startsWith('anthropic/') || modelId.startsWith('google/')) {
    const shouldCache = (text: string) => text.length > 2000;

    // System prompt
    if (typeof request.messages[0]?.content === 'string' && request.messages[0].role === 'system') {
      const text = request.messages[0].content as string;
      if (shouldCache(text)) {
        const part: OpenRouterTextPart = {
          type: 'text',
          text,
          cache_control: { type: 'ephemeral' },
        };
        request.messages[0].content = [part];
      }
    }

    // User messages
    for (let i = 0; i < request.messages.length; i++) {
      const msg = request.messages[i];
      if (msg && msg.role === 'user' && typeof msg.content === 'string') {
        const text = msg.content as string;
        if (shouldCache(text)) {
          const part: OpenRouterTextPart = {
            type: 'text',
            text,
            cache_control: { type: 'ephemeral' },
          };
          const message = request.messages[i];
          if (message) {
            message.content = [part];
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
  return (
    modelId.startsWith('anthropic/') ||
    modelId.startsWith('openai/') ||
    modelId.startsWith('deepseek/')
  );
}

/**
 * Check if a model supports caching
 */
export function supportsCaching(modelId: string): boolean {
  return modelId.startsWith('anthropic/') || modelId.startsWith('google/');
}
