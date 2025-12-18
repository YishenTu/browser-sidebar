/**
 * @file openrouter/requestBuilder.test.ts
 * Tests for OpenRouter request builder
 *
 * Focus:
 * - Reasoning payload mapping and cache_control insertion
 * - Web search suffix handling
 * - Message formatting with sections
 * - System prompt handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildRequest,
  supportsReasoning,
  supportsCaching,
} from '@core/ai/openrouter/requestBuilder';
import type { ProviderChatMessage, OpenRouterConfig, ProviderChatRole } from '@/types/providers';
import * as models from '@/config/models';

// Mock the models config
vi.mock('@/config/models', () => ({
  getModelById: vi.fn(),
}));

// Helper to create properly typed messages
let messageCounter = 0;

const msg = (role: ProviderChatRole, content: string): ProviderChatMessage => ({
  id: `msg-${++messageCounter}`,
  role,
  content,
  timestamp: new Date(1700000000000 + messageCounter),
});

describe('OpenRouter requestBuilder', () => {
  beforeEach(() => {
    messageCounter = 0;
    vi.clearAllMocks();
    // Default: no model config (no reasoning support)
    vi.mocked(models.getModelById).mockReturnValue(undefined);
  });

  // ---------------------------------------------------------------------------
  // Basic Request Building
  // ---------------------------------------------------------------------------
  describe('buildRequest', () => {
    it('builds basic request with model and stream enabled', () => {
      const messages: ProviderChatMessage[] = [msg('user', 'Hello')];
      const config: OpenRouterConfig = {
        apiKey: 'test-key',
        model: 'openai/gpt-4',
      };

      const result = buildRequest({ messages, config });

      expect(result.model).toBe('openai/gpt-4');
      expect(result.stream).toBe(true);
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]).toEqual({ role: 'user', content: 'Hello' });
    });

    it('adds system prompt when provided', () => {
      const messages: ProviderChatMessage[] = [msg('user', 'Hi')];
      const config: OpenRouterConfig = {
        apiKey: 'test-key',
        model: 'openai/gpt-4',
      };

      const result = buildRequest({
        messages,
        config,
        systemPrompt: 'You are a helpful assistant.',
      });

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0]).toEqual({
        role: 'system',
        content: 'You are a helpful assistant.',
      });
      expect(result.messages[1]).toEqual({ role: 'user', content: 'Hi' });
    });

    it('handles user and assistant messages', () => {
      const messages: ProviderChatMessage[] = [
        msg('user', 'What is 2+2?'),
        msg('assistant', '2+2 equals 4.'),
        msg('user', 'Thanks!'),
      ];
      const config: OpenRouterConfig = {
        apiKey: 'test-key',
        model: 'openai/gpt-4',
      };

      const result = buildRequest({ messages, config });

      expect(result.messages).toHaveLength(3);
      expect(result.messages.map(m => m.role)).toEqual(['user', 'assistant', 'user']);
    });

    it('skips system messages from input (only uses systemPrompt param)', () => {
      const messages: ProviderChatMessage[] = [
        msg('system', 'Ignored system message'),
        msg('user', 'Hello'),
      ];
      const config: OpenRouterConfig = {
        apiKey: 'test-key',
        model: 'openai/gpt-4',
      };

      const result = buildRequest({ messages, config });

      // System messages from input are not included
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.role).toBe('user');
    });
  });

  // ---------------------------------------------------------------------------
  // Sections Metadata Handling
  // ---------------------------------------------------------------------------
  describe('sections metadata', () => {
    it('creates multi-part content from sections for user messages', () => {
      const messages: ProviderChatMessage[] = [
        {
          ...msg('user', 'fallback content'),
          metadata: {
            sections: {
              systemInstruction: 'Act as an expert.',
              tabContent: 'Page content here...',
              userQuery: 'What does this page say?',
            },
          },
        },
      ];
      const config: OpenRouterConfig = {
        apiKey: 'test-key',
        model: 'openai/gpt-4',
      };

      const result = buildRequest({ messages, config });

      expect(result.messages).toHaveLength(1);
      const resultMsg = result.messages[0];
      expect(resultMsg?.role).toBe('user');
      expect(Array.isArray(resultMsg?.content)).toBe(true);
      const parts = resultMsg?.content as Array<{ type: string; text: string }>;
      expect(parts).toHaveLength(3);
      expect(parts[0]).toEqual({ type: 'text', text: 'Act as an expert.' });
      expect(parts[1]).toEqual({ type: 'text', text: 'Page content here...' });
      expect(parts[2]).toEqual({ type: 'text', text: 'What does this page say?' });
    });

    it('excludes empty tabContent from sections', () => {
      const messages: ProviderChatMessage[] = [
        {
          ...msg('user', 'fallback'),
          metadata: {
            sections: {
              systemInstruction: 'Instructions',
              tabContent: '', // Empty
              userQuery: 'Question',
            },
          },
        },
      ];
      const config: OpenRouterConfig = {
        apiKey: 'test-key',
        model: 'openai/gpt-4',
      };

      const result = buildRequest({ messages, config });

      const parts = result.messages[0]?.content as Array<{ type: string; text: string }>;
      expect(parts).toHaveLength(2);
      expect(parts.map(p => p.text)).toEqual(['Instructions', 'Question']);
    });

    it('uses fallback content when sections produce empty parts', () => {
      const messages: ProviderChatMessage[] = [
        {
          ...msg('user', 'fallback content used'),
          metadata: {
            sections: {}, // Empty sections
          },
        },
      ];
      const config: OpenRouterConfig = {
        apiKey: 'test-key',
        model: 'openai/gpt-4',
      };

      const result = buildRequest({ messages, config });

      expect(result.messages[0]?.content).toBe('fallback content used');
    });

    it('does not apply sections to assistant messages', () => {
      const messages: ProviderChatMessage[] = [
        {
          ...msg('assistant', 'Regular response'),
          metadata: {
            sections: {
              systemInstruction: 'Should be ignored',
              userQuery: 'Also ignored',
            },
          },
        },
      ];
      const config: OpenRouterConfig = {
        apiKey: 'test-key',
        model: 'openai/gpt-4',
      };

      const result = buildRequest({ messages, config });

      expect(result.messages[0]?.content).toBe('Regular response');
    });
  });

  // ---------------------------------------------------------------------------
  // Web Search Suffix
  // ---------------------------------------------------------------------------
  describe('web search suffix', () => {
    it('strips :online suffix when enableWebSearch is false', () => {
      const messages: ProviderChatMessage[] = [msg('user', 'Search')];
      const config: OpenRouterConfig = {
        apiKey: 'test-key',
        model: 'openai/gpt-4:online',
      };

      const result = buildRequest({ messages, config });

      // The implementation has enableWebSearch = false, so suffix is stripped
      expect(result.model).toBe('openai/gpt-4');
    });

    it('keeps model without suffix unchanged', () => {
      const messages: ProviderChatMessage[] = [msg('user', 'Hello')];
      const config: OpenRouterConfig = {
        apiKey: 'test-key',
        model: 'anthropic/claude-3',
      };

      const result = buildRequest({ messages, config });

      expect(result.model).toBe('anthropic/claude-3');
    });
  });

  // ---------------------------------------------------------------------------
  // Reasoning Configuration
  // ---------------------------------------------------------------------------
  describe('reasoning configuration', () => {
    it('includes effort-based reasoning when model supports it', () => {
      vi.mocked(models.getModelById).mockReturnValue({
        id: 'openai/o1',
        name: 'OpenAI o1',
        provider: 'openrouter',
        reasoningEffort: 'medium',
      });

      const messages: ProviderChatMessage[] = [msg('user', 'Think carefully')];
      const config: OpenRouterConfig = {
        apiKey: 'test-key',
        model: 'openai/o1',
      };

      const result = buildRequest({ messages, config });

      expect(result.reasoning).toBeDefined();
      expect(result.reasoning?.effort).toBe('medium');
    });

    it('maps minimal effort to low', () => {
      vi.mocked(models.getModelById).mockReturnValue({
        id: 'openai/o1-mini',
        name: 'OpenAI o1-mini',
        provider: 'openrouter',
        reasoningEffort: 'minimal',
      });

      const messages: ProviderChatMessage[] = [msg('user', 'Quick question')];
      const config: OpenRouterConfig = {
        apiKey: 'test-key',
        model: 'openai/o1-mini',
      };

      const result = buildRequest({ messages, config });

      expect(result.reasoning?.effort).toBe('low');
    });

    it('includes max_tokens reasoning for Anthropic models', () => {
      vi.mocked(models.getModelById).mockReturnValue({
        id: 'anthropic/claude-3.5-sonnet',
        name: 'Claude 3.5 Sonnet',
        provider: 'openrouter',
        reasoningMaxTokens: 8000,
      });

      const messages: ProviderChatMessage[] = [msg('user', 'Analyze this')];
      const config: OpenRouterConfig = {
        apiKey: 'test-key',
        model: 'anthropic/claude-3.5-sonnet',
      };

      const result = buildRequest({ messages, config });

      expect(result.reasoning).toBeDefined();
      expect(result.reasoning?.max_tokens).toBe(8000);
    });

    it('uses config override for reasoning effort', () => {
      vi.mocked(models.getModelById).mockReturnValue({
        id: 'openai/o1',
        name: 'OpenAI o1',
        provider: 'openrouter',
        reasoningEffort: 'medium',
      });

      const messages: ProviderChatMessage[] = [msg('user', 'Think hard')];
      const config: OpenRouterConfig = {
        apiKey: 'test-key',
        model: 'openai/o1',
        reasoning: { effort: 'high' },
      };

      const result = buildRequest({ messages, config });

      expect(result.reasoning?.effort).toBe('high');
    });

    it('includes exclude flag when config specifies it', () => {
      vi.mocked(models.getModelById).mockReturnValue({
        id: 'openai/o1',
        name: 'OpenAI o1',
        provider: 'openrouter',
        reasoningEffort: 'medium',
      });

      const messages: ProviderChatMessage[] = [msg('user', 'No reasoning')];
      const config: OpenRouterConfig = {
        apiKey: 'test-key',
        model: 'openai/o1',
        reasoning: { exclude: true },
      };

      const result = buildRequest({ messages, config });

      expect(result.reasoning?.exclude).toBe(true);
    });

    it('omits reasoning when model does not support it', () => {
      vi.mocked(models.getModelById).mockReturnValue({
        id: 'openai/gpt-4',
        name: 'GPT-4',
        provider: 'openrouter',
        // No reasoningEffort or reasoningMaxTokens
      });

      const messages: ProviderChatMessage[] = [msg('user', 'Hello')];
      const config: OpenRouterConfig = {
        apiKey: 'test-key',
        model: 'openai/gpt-4',
      };

      const result = buildRequest({ messages, config });

      expect(result.reasoning).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Cache Control
  // ---------------------------------------------------------------------------
  describe('cache control', () => {
    it('adds cache_control to large string content for Anthropic models', () => {
      vi.mocked(models.getModelById).mockReturnValue({
        id: 'anthropic/claude-3',
        name: 'Claude 3',
        provider: 'openrouter',
      });

      const largeContent = 'a'.repeat(2500); // > 2000 chars
      const messages: ProviderChatMessage[] = [msg('user', largeContent)];
      const config: OpenRouterConfig = {
        apiKey: 'test-key',
        model: 'anthropic/claude-3',
      };

      const result = buildRequest({ messages, config });

      const msgContent = result.messages[0]?.content;
      expect(Array.isArray(msgContent)).toBe(true);
      const parts = msgContent as Array<{
        type: string;
        text: string;
        cache_control?: { type: string };
      }>;
      expect(parts[0]?.cache_control).toEqual({ type: 'ephemeral' });
    });

    it('does not add cache_control to small content', () => {
      vi.mocked(models.getModelById).mockReturnValue({
        id: 'anthropic/claude-3',
        name: 'Claude 3',
        provider: 'openrouter',
      });

      const smallContent = 'short message';
      const messages: ProviderChatMessage[] = [msg('user', smallContent)];
      const config: OpenRouterConfig = {
        apiKey: 'test-key',
        model: 'anthropic/claude-3',
      };

      const result = buildRequest({ messages, config });

      expect(result.messages[0]?.content).toBe('short message');
    });

    it('adds cache_control to large parts in array content', () => {
      vi.mocked(models.getModelById).mockReturnValue({
        id: 'google/gemini-pro',
        name: 'Gemini Pro',
        provider: 'openrouter',
      });

      const largeText = 'b'.repeat(2500);
      const messages: ProviderChatMessage[] = [
        {
          ...msg('user', 'fallback'),
          metadata: {
            sections: {
              systemInstruction: 'short',
              tabContent: largeText,
              userQuery: 'question',
            },
          },
        },
      ];
      const config: OpenRouterConfig = {
        apiKey: 'test-key',
        model: 'google/gemini-pro',
      };

      const result = buildRequest({ messages, config });

      const parts = result.messages[0]?.content as Array<{
        type: string;
        text: string;
        cache_control?: { type: string };
      }>;
      expect(parts).toHaveLength(3);
      // Only the large part should have cache_control
      expect(parts[0]?.cache_control).toBeUndefined(); // short
      expect(parts[1]?.cache_control).toEqual({ type: 'ephemeral' }); // largeText
      expect(parts[2]?.cache_control).toBeUndefined(); // question
    });

    it('does not add cache_control for non-Anthropic/Google models', () => {
      vi.mocked(models.getModelById).mockReturnValue({
        id: 'openai/gpt-4',
        name: 'GPT-4',
        provider: 'openrouter',
      });

      const largeContent = 'c'.repeat(2500);
      const messages: ProviderChatMessage[] = [msg('user', largeContent)];
      const config: OpenRouterConfig = {
        apiKey: 'test-key',
        model: 'openai/gpt-4',
      };

      const result = buildRequest({ messages, config });

      // Content should remain as string (no cache_control transformation)
      expect(result.messages[0]?.content).toBe(largeContent);
    });
  });

  // ---------------------------------------------------------------------------
  // supportsReasoning
  // ---------------------------------------------------------------------------
  describe('supportsReasoning', () => {
    it('returns true when model has reasoningEffort', () => {
      vi.mocked(models.getModelById).mockReturnValue({
        id: 'openai/o1',
        name: 'o1',
        provider: 'openrouter',
        reasoningEffort: 'high',
      });

      expect(supportsReasoning('openai/o1')).toBe(true);
    });

    it('returns true when model has reasoningMaxTokens', () => {
      vi.mocked(models.getModelById).mockReturnValue({
        id: 'anthropic/claude',
        name: 'Claude',
        provider: 'openrouter',
        reasoningMaxTokens: 4000,
      });

      expect(supportsReasoning('anthropic/claude')).toBe(true);
    });

    it('returns false when model has no reasoning config', () => {
      vi.mocked(models.getModelById).mockReturnValue({
        id: 'openai/gpt-4',
        name: 'GPT-4',
        provider: 'openrouter',
      });

      expect(supportsReasoning('openai/gpt-4')).toBe(false);
    });

    it('returns false when model is not found', () => {
      vi.mocked(models.getModelById).mockReturnValue(undefined);

      expect(supportsReasoning('unknown/model')).toBe(false);
    });

    it('strips suffix before lookup', () => {
      vi.mocked(models.getModelById).mockReturnValue({
        id: 'openai/o1',
        name: 'o1',
        provider: 'openrouter',
        reasoningEffort: 'medium',
      });

      expect(supportsReasoning('openai/o1:online')).toBe(true);
      expect(models.getModelById).toHaveBeenCalledWith('openai/o1');
    });
  });

  // ---------------------------------------------------------------------------
  // supportsCaching
  // ---------------------------------------------------------------------------
  describe('supportsCaching', () => {
    it('returns true for Anthropic models', () => {
      expect(supportsCaching('anthropic/claude-3-opus')).toBe(true);
      expect(supportsCaching('anthropic/claude-3.5-sonnet')).toBe(true);
    });

    it('returns true for Google models', () => {
      expect(supportsCaching('google/gemini-pro')).toBe(true);
      expect(supportsCaching('google/gemini-1.5-pro')).toBe(true);
    });

    it('returns false for OpenAI models', () => {
      expect(supportsCaching('openai/gpt-4')).toBe(false);
      expect(supportsCaching('openai/o1')).toBe(false);
    });

    it('returns false for other providers', () => {
      expect(supportsCaching('meta/llama-3')).toBe(false);
      expect(supportsCaching('mistral/mistral-large')).toBe(false);
    });

    it('strips suffix before checking', () => {
      expect(supportsCaching('anthropic/claude-3:online')).toBe(true);
      expect(supportsCaching('openai/gpt-4:online')).toBe(false);
    });
  });
});
