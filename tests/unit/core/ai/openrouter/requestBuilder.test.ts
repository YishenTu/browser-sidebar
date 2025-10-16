/**
 * @file OpenRouter Request Builder Unit Tests
 *
 * Comprehensive unit tests for the OpenRouter request builder,
 * covering request building logic, model configuration handling,
 * reasoning configuration, caching logic, and edge cases.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  buildRequest,
  supportsReasoning,
  supportsCaching,
} from '@/core/ai/openrouter/requestBuilder';
import type { ProviderChatMessage, OpenRouterConfig } from '@/types/providers';
import type { OpenRouterRequestOptions } from '@/core/ai/openrouter/types';

// Mock dependencies
vi.mock('@/config/models', () => ({
  getModelById: vi.fn(),
}));

import { getModelById } from '@/config/models';

describe('OpenRouter Request Builder', () => {
  const mockGetModelById = vi.mocked(getModelById);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('buildRequest', () => {
    const basicMessages: ProviderChatMessage[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
      { role: 'user', content: 'How are you?' },
    ];

    const basicConfig: OpenRouterConfig = {
      apiKey: 'test-key',
      model: 'anthropic/claude-3-5-sonnet-20241022',
    };

    it('should build basic request without system prompt', () => {
      mockGetModelById.mockReturnValue(null);

      const result = buildRequest({
        messages: basicMessages,
        config: basicConfig,
      });

      expect(result).toEqual({
        model: 'anthropic/claude-3-5-sonnet-20241022',
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
          { role: 'user', content: 'How are you?' },
        ],
        stream: true,
      });
    });

    it('should build request with system prompt', () => {
      mockGetModelById.mockReturnValue(null);

      const result = buildRequest({
        messages: basicMessages,
        config: basicConfig,
        systemPrompt: 'You are a helpful assistant.',
      });

      expect(result).toEqual({
        model: 'anthropic/claude-3-5-sonnet-20241022',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
          { role: 'user', content: 'How are you?' },
        ],
        stream: true,
      });
    });

    it('should filter out non-standard message roles', () => {
      mockGetModelById.mockReturnValue(null);

      const messagesWithSystem: ProviderChatMessage[] = [
        { role: 'user', content: 'Hello' },
        { role: 'system', content: 'This should be filtered' } as ProviderChatMessage,
        { role: 'assistant', content: 'Hi!' },
        { role: 'tool', content: 'Tool message' } as ProviderChatMessage,
      ];

      const result = buildRequest({
        messages: messagesWithSystem,
        config: basicConfig,
      });

      expect(result.messages).toEqual([
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi!' },
      ]);
    });

    it('should handle model with suffix correctly', () => {
      mockGetModelById.mockReturnValue(null);

      const configWithSuffix: OpenRouterConfig = {
        ...basicConfig,
        model: 'anthropic/claude-3-5-sonnet-20241022:beta',
      };

      const result = buildRequest({
        messages: basicMessages,
        config: configWithSuffix,
      });

      // The implementation keeps non-:online suffixes since enableWebSearch is false
      expect(result.model).toBe('anthropic/claude-3-5-sonnet-20241022:beta');
    });

    it('should not add web search suffix when enableWebSearch is false', () => {
      mockGetModelById.mockReturnValue(null);

      const result = buildRequest({
        messages: basicMessages,
        config: basicConfig,
      });

      expect(result.model).toBe('anthropic/claude-3-5-sonnet-20241022');
      expect(result.model).not.toContain(':online');
    });

    describe('Reasoning Configuration', () => {
      it('should add reasoning with effort for OpenAI/DeepSeek models', () => {
        mockGetModelById.mockReturnValue({
          id: 'openai/gpt-4o',
          name: 'GPT-4o',
          provider: 'openrouter',
          reasoningEffort: 'medium',
        });

        const config: OpenRouterConfig = {
          ...basicConfig,
          model: 'openai/gpt-4o',
          reasoning: { effort: 'high' },
        };

        const result = buildRequest({
          messages: basicMessages,
          config,
        });

        expect(result.reasoning).toEqual({ effort: 'high' });
      });

      it('should use default reasoning effort from model config', () => {
        mockGetModelById.mockReturnValue({
          id: 'openai/gpt-4o',
          name: 'GPT-4o',
          provider: 'openrouter',
          reasoningEffort: 'medium',
        });

        const config: OpenRouterConfig = {
          ...basicConfig,
          model: 'openai/gpt-4o',
        };

        const result = buildRequest({
          messages: basicMessages,
          config,
        });

        expect(result.reasoning).toEqual({ effort: 'medium' });
      });

      it('should add reasoning with max_tokens for Anthropic models', () => {
        mockGetModelById.mockReturnValue({
          id: 'anthropic/claude-3-5-sonnet-20241022',
          name: 'Claude 3.5 Sonnet',
          provider: 'openrouter',
          reasoningMaxTokens: 8192,
        });

        const config: OpenRouterConfig = {
          ...basicConfig,
          reasoning: { maxTokens: 4096 },
        };

        const result = buildRequest({
          messages: basicMessages,
          config,
        });

        expect(result.reasoning).toEqual({ max_tokens: 4096 });
      });

      it('should use default reasoning max_tokens from model config', () => {
        mockGetModelById.mockReturnValue({
          id: 'anthropic/claude-3-5-sonnet-20241022',
          name: 'Claude 3.5 Sonnet',
          provider: 'openrouter',
          reasoningMaxTokens: 8192,
        });

        const result = buildRequest({
          messages: basicMessages,
          config: basicConfig,
        });

        expect(result.reasoning).toEqual({ max_tokens: 8192 });
      });

      it('should add exclude flag when specified', () => {
        mockGetModelById.mockReturnValue({
          id: 'openai/gpt-4o',
          name: 'GPT-4o',
          provider: 'openrouter',
          reasoningEffort: 'medium',
        });

        const config: OpenRouterConfig = {
          ...basicConfig,
          model: 'openai/gpt-4o',
          reasoning: { effort: 'low', exclude: true },
        };

        const result = buildRequest({
          messages: basicMessages,
          config,
        });

        expect(result.reasoning).toEqual({ effort: 'low', exclude: true });
      });

      it('should not add reasoning for models without reasoning support', () => {
        mockGetModelById.mockReturnValue({
          id: 'meta-llama/llama-3.2-3b-instruct',
          name: 'Llama 3.2 3B',
          provider: 'openrouter',
        });

        const result = buildRequest({
          messages: basicMessages,
          config: {
            ...basicConfig,
            model: 'meta-llama/llama-3.2-3b-instruct',
          },
        });

        expect(result.reasoning).toBeUndefined();
      });

      it('should handle model lookup with suffix', () => {
        mockGetModelById.mockReturnValue({
          id: 'openai/gpt-4o',
          name: 'GPT-4o',
          provider: 'openrouter',
          reasoningEffort: 'medium',
        });

        const result = buildRequest({
          messages: basicMessages,
          config: {
            ...basicConfig,
            model: 'openai/gpt-4o:beta',
          },
        });

        // Model lookup strips :online suffix only, so :beta is preserved in the model ID
        expect(mockGetModelById).toHaveBeenCalledWith('openai/gpt-4o:beta');
        expect(result.reasoning).toEqual({ effort: 'medium' });
      });
    });

    describe('Caching Configuration', () => {
      it('should add cache_control for large content in Anthropic models', () => {
        mockGetModelById.mockReturnValue({
          id: 'anthropic/claude-3-5-sonnet-20241022',
          name: 'Claude 3.5 Sonnet',
          provider: 'openrouter',
        });

        const largeContent = 'x'.repeat(2500); // > 2000 chars
        const messagesWithLargeContent: ProviderChatMessage[] = [
          { role: 'user', content: largeContent },
        ];

        const result = buildRequest({
          messages: messagesWithLargeContent,
          config: basicConfig,
        });

        expect(result.messages[0].content).toEqual([
          {
            type: 'text',
            text: largeContent,
            cache_control: { type: 'ephemeral' },
          },
        ]);
      });

      it('should add cache_control for large content in Google models', () => {
        mockGetModelById.mockReturnValue({
          id: 'google/gemini-pro',
          name: 'Gemini Pro',
          provider: 'openrouter',
        });

        const largeContent = 'y'.repeat(3000);
        const messagesWithLargeContent: ProviderChatMessage[] = [
          { role: 'user', content: largeContent },
        ];

        const result = buildRequest({
          messages: messagesWithLargeContent,
          config: {
            ...basicConfig,
            model: 'google/gemini-pro',
          },
        });

        expect(result.messages[0].content).toEqual([
          {
            type: 'text',
            text: largeContent,
            cache_control: { type: 'ephemeral' },
          },
        ]);
      });

      it('should not add cache_control for small content', () => {
        mockGetModelById.mockReturnValue({
          id: 'anthropic/claude-3-5-sonnet-20241022',
          name: 'Claude 3.5 Sonnet',
          provider: 'openrouter',
        });

        const smallContent = 'x'.repeat(100); // < 2000 chars
        const messagesWithSmallContent: ProviderChatMessage[] = [
          { role: 'user', content: smallContent },
        ];

        const result = buildRequest({
          messages: messagesWithSmallContent,
          config: basicConfig,
        });

        expect(result.messages[0].content).toBe(smallContent);
      });

      it('should not add cache_control for non-caching models', () => {
        mockGetModelById.mockReturnValue({
          id: 'openai/gpt-4o',
          name: 'GPT-4o',
          provider: 'openrouter',
        });

        const largeContent = 'x'.repeat(2500);
        const messagesWithLargeContent: ProviderChatMessage[] = [
          { role: 'user', content: largeContent },
        ];

        const result = buildRequest({
          messages: messagesWithLargeContent,
          config: {
            ...basicConfig,
            model: 'openai/gpt-4o',
          },
        });

        expect(result.messages[0].content).toBe(largeContent);
      });

      it('should handle multipart content with cache_control', () => {
        mockGetModelById.mockReturnValue({
          id: 'anthropic/claude-3-5-sonnet-20241022',
          name: 'Claude 3.5 Sonnet',
          provider: 'openrouter',
        });

        const largeText = 'z'.repeat(2500);
        const multipartContent = [
          { type: 'text' as const, text: 'Small text' },
          { type: 'text' as const, text: largeText },
        ];

        const messagesWithMultipart = [{ role: 'user' as const, content: multipartContent as any }];

        const result = buildRequest({
          messages: messagesWithMultipart,
          config: basicConfig,
        });

        expect(result.messages[0].content).toEqual([
          { type: 'text', text: 'Small text' },
          {
            type: 'text',
            text: largeText,
            cache_control: { type: 'ephemeral' },
          },
        ]);
      });

      it('should not add cache_control to parts that already have it', () => {
        mockGetModelById.mockReturnValue({
          id: 'anthropic/claude-3-5-sonnet-20241022',
          name: 'Claude 3.5 Sonnet',
          provider: 'openrouter',
        });

        const largeText = 'w'.repeat(2500);
        const multipartContent = [
          {
            type: 'text' as const,
            text: largeText,
            cache_control: { type: 'ephemeral' },
          },
        ];

        const messagesWithMultipart = [{ role: 'user' as const, content: multipartContent as any }];

        const result = buildRequest({
          messages: messagesWithMultipart,
          config: basicConfig,
        });

        // Should not duplicate cache_control
        expect(result.messages[0].content).toEqual([
          {
            type: 'text',
            text: largeText,
            cache_control: { type: 'ephemeral' },
          },
        ]);
      });
    });

    describe('Edge Cases', () => {
      it('should handle empty messages array', () => {
        mockGetModelById.mockReturnValue(null);

        const result = buildRequest({
          messages: [],
          config: basicConfig,
        });

        expect(result.messages).toEqual([]);
      });

      it('should handle empty system prompt', () => {
        mockGetModelById.mockReturnValue(null);

        const result = buildRequest({
          messages: basicMessages,
          config: basicConfig,
          systemPrompt: '',
        });

        // Empty system prompt should not be added
        expect(result.messages[0]).not.toEqual({ role: 'system', content: '' });
        expect(result.messages[0]).toEqual({ role: 'user', content: 'Hello' });
      });

      it('should handle whitespace-only system prompt', () => {
        mockGetModelById.mockReturnValue(null);

        const result = buildRequest({
          messages: basicMessages,
          config: basicConfig,
          systemPrompt: '   ',
        });

        // Whitespace-only system prompt should be added as is
        expect(result.messages[0]).toEqual({ role: 'system', content: '   ' });
      });

      it('should handle model without base ID', () => {
        mockGetModelById.mockReturnValue(null);

        const result = buildRequest({
          messages: basicMessages,
          config: {
            ...basicConfig,
            model: '',
          },
        });

        expect(result.model).toBe('');
        expect(mockGetModelById).toHaveBeenCalledWith('');
      });

      it('should handle complex model suffix parsing', () => {
        mockGetModelById.mockReturnValue(null);

        const result = buildRequest({
          messages: basicMessages,
          config: {
            ...basicConfig,
            model: 'provider/model:suffix1:suffix2',
          },
        });

        // The implementation keeps non-:online suffixes
        expect(result.model).toBe('provider/model:suffix1:suffix2');
        expect(mockGetModelById).toHaveBeenCalledWith('provider/model:suffix1:suffix2');
      });

      it('should handle AbortSignal parameter (not used in current implementation)', () => {
        mockGetModelById.mockReturnValue(null);
        const abortController = new AbortController();

        const result = buildRequest({
          messages: basicMessages,
          config: basicConfig,
          signal: abortController.signal,
        });

        expect(result).toBeDefined();
        expect(result.model).toBe('anthropic/claude-3-5-sonnet-20241022');
      });
    });
  });

  describe('supportsReasoning', () => {
    beforeEach(() => {
      mockGetModelById.mockClear();
    });

    it('should return true for models with reasoningEffort', () => {
      mockGetModelById.mockReturnValue({
        id: 'openai/gpt-4o',
        name: 'GPT-4o',
        provider: 'openrouter',
        reasoningEffort: 'medium',
      });

      expect(supportsReasoning('openai/gpt-4o')).toBe(true);
    });

    it('should return true for models with reasoningMaxTokens', () => {
      mockGetModelById.mockReturnValue({
        id: 'anthropic/claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
        provider: 'openrouter',
        reasoningMaxTokens: 8192,
      });

      expect(supportsReasoning('anthropic/claude-3-5-sonnet-20241022')).toBe(true);
    });

    it('should return false for models without reasoning support', () => {
      mockGetModelById.mockReturnValue({
        id: 'meta-llama/llama-3.2-3b-instruct',
        name: 'Llama 3.2 3B',
        provider: 'openrouter',
      });

      expect(supportsReasoning('meta-llama/llama-3.2-3b-instruct')).toBe(false);
    });

    it('should return false when model config is not found', () => {
      mockGetModelById.mockReturnValue(null);

      expect(supportsReasoning('unknown/model')).toBe(false);
    });

    it('should strip model suffix before lookup', () => {
      mockGetModelById.mockReturnValue({
        id: 'openai/gpt-4o',
        name: 'GPT-4o',
        provider: 'openrouter',
        reasoningEffort: 'medium',
      });

      expect(supportsReasoning('openai/gpt-4o:beta')).toBe(true);
      expect(mockGetModelById).toHaveBeenCalledWith('openai/gpt-4o');
    });

    it('should handle empty model ID', () => {
      mockGetModelById.mockReturnValue(null);

      expect(supportsReasoning('')).toBe(false);
      expect(mockGetModelById).toHaveBeenCalledWith('');
    });

    it('should handle model ID with only suffix', () => {
      mockGetModelById.mockReturnValue(null);

      expect(supportsReasoning(':suffix')).toBe(false);
      // split(':')[0] on ':suffix' returns ':suffix' since there's nothing before the first ':'
      expect(mockGetModelById).toHaveBeenCalledWith(':suffix');
    });
  });

  describe('supportsCaching', () => {
    it('should return true for Anthropic models', () => {
      expect(supportsCaching('anthropic/claude-3-5-sonnet-20241022')).toBe(true);
      expect(supportsCaching('anthropic/claude-3-haiku-20240307')).toBe(true);
    });

    it('should return true for Google models', () => {
      expect(supportsCaching('google/gemini-pro')).toBe(true);
      expect(supportsCaching('google/gemini-1.5-flash')).toBe(true);
    });

    it('should return false for OpenAI models', () => {
      expect(supportsCaching('openai/gpt-4o')).toBe(false);
      expect(supportsCaching('openai/gpt-3.5-turbo')).toBe(false);
    });

    it('should return false for other providers', () => {
      expect(supportsCaching('meta-llama/llama-3.2-3b-instruct')).toBe(false);
      expect(supportsCaching('microsoft/phi-3-mini')).toBe(false);
    });

    it('should strip model suffix before checking', () => {
      expect(supportsCaching('anthropic/claude-3-5-sonnet-20241022:beta')).toBe(true);
      expect(supportsCaching('google/gemini-pro:latest')).toBe(true);
      expect(supportsCaching('openai/gpt-4o:preview')).toBe(false);
    });

    it('should handle empty model ID', () => {
      expect(supportsCaching('')).toBe(false);
    });

    it('should handle model ID with only suffix', () => {
      expect(supportsCaching(':suffix')).toBe(false);
    });

    it('should handle model ID without provider prefix', () => {
      expect(supportsCaching('gpt-4o')).toBe(false);
      expect(supportsCaching('claude-3-5-sonnet')).toBe(false);
    });
  });
});
