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
      formattedMessages.push({
        role: msg.role,
        content: msg.content,
      });
    }
  }

  // Handle model ID and web search suffix
  // Strip any existing suffix for config lookup
  const baseModelId = config.model.split(':')[0] || config.model;
  // Optionally add :online suffix for OpenRouter models to enable web search
  // Set enableWebSearch to true to add the suffix
  const enableWebSearch = false; // Toggle this to enable/disable web search
  const modelId = enableWebSearch ? `${baseModelId}:online` : baseModelId;

  // Build base request
  const request: OpenRouterRequestOptions = {
    model: modelId,
    messages: formattedMessages,
    stream: true,
  };

  // Add reasoning configuration based on model
  // Use the base model id for lookup (exclude any suffix)
  const modelConfig = getModelById(baseModelId);

  // Check if model config specifies reasoning support
  if (modelConfig && (modelConfig.reasoningEffort || modelConfig.reasoningMaxTokens)) {
    // Build reasoning configuration according to model's configuration
    type ReasoningPayload = {
      effort?: 'low' | 'medium' | 'high';
      max_tokens?: number;
      exclude?: boolean;
    };
    const reasoning: ReasoningPayload = {};

    if (modelConfig.reasoningMaxTokens !== undefined) {
      // Model uses max_tokens for reasoning (e.g., Anthropic models)
      reasoning.max_tokens = config.reasoning?.maxTokens ?? modelConfig.reasoningMaxTokens;
    } else if (modelConfig.reasoningEffort !== undefined) {
      // Model uses effort-based reasoning (e.g., OpenAI, DeepSeek models)
      const rawEffort = config.reasoning?.effort ?? modelConfig.reasoningEffort;
      const mappedEffort: 'low' | 'medium' | 'high' | undefined =
        rawEffort === 'minimal' ? 'low' : rawEffort;
      reasoning.effort = mappedEffort;
    }

    // Add exclude flag if specified
    if (config.reasoning?.exclude) {
      reasoning.exclude = true;
    }

    // Add reasoning configuration if we have any settings
    if (Object.keys(reasoning).length > 0) {
      request.reasoning = reasoning;
    }
  }

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
