/**
 * @file openai-compat/requestBuilder.test.ts
 * Tests for OpenAI-Compatible request builder
 *
 * Focus:
 * - Sections mapping + system prompt injection + stream default
 * - Message conversion to OpenAI format
 * - Multi-part content assembly
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { buildRequest } from '@core/ai/openai-compat/requestBuilder';
import type {
  ProviderChatMessage,
  OpenAICompatibleConfig,
  ProviderChatRole,
} from '@/types/providers';

// Helper to create properly typed messages
let messageCounter = 0;

beforeEach(() => {
  messageCounter = 0;
});

const msg = (role: ProviderChatRole, content: string): ProviderChatMessage => ({
  id: `msg-${++messageCounter}`,
  role,
  content,
  timestamp: new Date(1700000000000 + messageCounter),
});

describe('OpenAI-Compat requestBuilder', () => {
  // ---------------------------------------------------------------------------
  // Basic Request Building
  // ---------------------------------------------------------------------------
  describe('buildRequest', () => {
    it('builds basic request with model and stream enabled', () => {
      const messages: ProviderChatMessage[] = [msg('user', 'Hello')];
      const config: OpenAICompatibleConfig = {
        apiKey: 'test-key',
        model: 'local-llama',
        baseURL: 'http://localhost:8080',
      };

      const result = buildRequest({ messages, config });

      expect(result.model).toBe('local-llama');
      expect(result['stream']).toBe(true);
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]).toEqual({ role: 'user', content: 'Hello' });
    });

    it('always sets stream to true', () => {
      const messages: ProviderChatMessage[] = [msg('user', 'Test')];
      const config: OpenAICompatibleConfig = {
        apiKey: 'key',
        model: 'model',
        baseURL: 'http://localhost',
      };

      const result = buildRequest({ messages, config });

      expect(result['stream']).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // System Prompt
  // ---------------------------------------------------------------------------
  describe('system prompt', () => {
    it('adds system prompt at the beginning when provided', () => {
      const messages: ProviderChatMessage[] = [msg('user', 'Hi')];
      const config: OpenAICompatibleConfig = {
        apiKey: 'test-key',
        model: 'llama-2',
        baseURL: 'http://localhost:8080',
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

    it('places messages after system prompt in order', () => {
      const messages: ProviderChatMessage[] = [
        msg('user', 'Question 1'),
        msg('assistant', 'Answer 1'),
        msg('user', 'Question 2'),
      ];
      const config: OpenAICompatibleConfig = {
        apiKey: 'key',
        model: 'model',
        baseURL: 'http://localhost',
      };

      const result = buildRequest({
        messages,
        config,
        systemPrompt: 'System instructions',
      });

      expect(result.messages).toHaveLength(4);
      expect(result.messages[0]?.role).toBe('system');
      expect(result.messages[1]?.role).toBe('user');
      expect(result.messages[2]?.role).toBe('assistant');
      expect(result.messages[3]?.role).toBe('user');
    });

    it('handles request without system prompt', () => {
      const messages: ProviderChatMessage[] = [msg('user', 'Hello')];
      const config: OpenAICompatibleConfig = {
        apiKey: 'key',
        model: 'model',
        baseURL: 'http://localhost',
      };

      const result = buildRequest({ messages, config });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.role).toBe('user');
    });
  });

  // ---------------------------------------------------------------------------
  // Message Role Handling
  // ---------------------------------------------------------------------------
  describe('message roles', () => {
    it('includes user messages', () => {
      const messages: ProviderChatMessage[] = [msg('user', 'User message')];
      const config: OpenAICompatibleConfig = {
        apiKey: 'key',
        model: 'model',
        baseURL: 'http://localhost',
      };

      const result = buildRequest({ messages, config });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]).toEqual({ role: 'user', content: 'User message' });
    });

    it('includes assistant messages', () => {
      const messages: ProviderChatMessage[] = [msg('assistant', 'Assistant response')];
      const config: OpenAICompatibleConfig = {
        apiKey: 'key',
        model: 'model',
        baseURL: 'http://localhost',
      };

      const result = buildRequest({ messages, config });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]).toEqual({ role: 'assistant', content: 'Assistant response' });
    });

    it('includes system messages from input', () => {
      const messages: ProviderChatMessage[] = [
        msg('system', 'System from input'),
        msg('user', 'Hello'),
      ];
      const config: OpenAICompatibleConfig = {
        apiKey: 'key',
        model: 'model',
        baseURL: 'http://localhost',
      };

      const result = buildRequest({ messages, config });

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0]).toEqual({ role: 'system', content: 'System from input' });
      expect(result.messages[1]).toEqual({ role: 'user', content: 'Hello' });
    });

    it('preserves message order', () => {
      const messages: ProviderChatMessage[] = [
        msg('user', 'First'),
        msg('assistant', 'Second'),
        msg('user', 'Third'),
        msg('assistant', 'Fourth'),
      ];
      const config: OpenAICompatibleConfig = {
        apiKey: 'key',
        model: 'model',
        baseURL: 'http://localhost',
      };

      const result = buildRequest({ messages, config });

      expect(result.messages.map(m => m.content)).toEqual(['First', 'Second', 'Third', 'Fourth']);
    });
  });

  // ---------------------------------------------------------------------------
  // Sections Metadata
  // ---------------------------------------------------------------------------
  describe('sections metadata', () => {
    it('creates multi-part content from sections for user messages', () => {
      const messages: ProviderChatMessage[] = [
        {
          ...msg('user', 'fallback content'),
          metadata: {
            sections: {
              systemInstruction: 'Instructions here',
              tabContent: 'Page content here',
              userQuery: 'User question',
            },
          },
        },
      ];
      const config: OpenAICompatibleConfig = {
        apiKey: 'key',
        model: 'model',
        baseURL: 'http://localhost',
      };

      const result = buildRequest({ messages, config });

      expect(result.messages).toHaveLength(1);
      const resultMsg = result.messages[0];
      expect(Array.isArray(resultMsg?.content)).toBe(true);
      const parts = resultMsg?.content as Array<{ type: string; text: string }>;
      expect(parts).toHaveLength(3);
      expect(parts[0]).toEqual({ type: 'text', text: 'Instructions here' });
      expect(parts[1]).toEqual({ type: 'text', text: 'Page content here' });
      expect(parts[2]).toEqual({ type: 'text', text: 'User question' });
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
      const config: OpenAICompatibleConfig = {
        apiKey: 'key',
        model: 'model',
        baseURL: 'http://localhost',
      };

      const result = buildRequest({ messages, config });

      const parts = result.messages[0]?.content as Array<{ type: string; text: string }>;
      expect(parts).toHaveLength(2);
      expect(parts.map(p => p.text)).toEqual(['Instructions', 'Question']);
    });

    it('uses fallback content when sections produce empty parts', () => {
      const messages: ProviderChatMessage[] = [
        {
          ...msg('user', 'this should be used'),
          metadata: {
            sections: {}, // Empty sections object
          },
        },
      ];
      const config: OpenAICompatibleConfig = {
        apiKey: 'key',
        model: 'model',
        baseURL: 'http://localhost',
      };

      const result = buildRequest({ messages, config });

      expect(result.messages[0]?.content).toBe('this should be used');
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
      const config: OpenAICompatibleConfig = {
        apiKey: 'key',
        model: 'model',
        baseURL: 'http://localhost',
      };

      const result = buildRequest({ messages, config });

      expect(result.messages[0]?.content).toBe('Regular response');
    });

    it('does not apply sections to system messages', () => {
      const messages: ProviderChatMessage[] = [
        {
          ...msg('system', 'System content'),
          metadata: {
            sections: {
              systemInstruction: 'Ignored',
              tabContent: 'Ignored',
            },
          },
        },
      ];
      const config: OpenAICompatibleConfig = {
        apiKey: 'key',
        model: 'model',
        baseURL: 'http://localhost',
      };

      const result = buildRequest({ messages, config });

      expect(result.messages[0]?.content).toBe('System content');
    });

    it('handles partial sections (only systemInstruction)', () => {
      const messages: ProviderChatMessage[] = [
        {
          ...msg('user', 'fallback'),
          metadata: {
            sections: {
              systemInstruction: 'Only instructions',
            },
          },
        },
      ];
      const config: OpenAICompatibleConfig = {
        apiKey: 'key',
        model: 'model',
        baseURL: 'http://localhost',
      };

      const result = buildRequest({ messages, config });

      const parts = result.messages[0]?.content as Array<{ type: string; text: string }>;
      expect(parts).toHaveLength(1);
      expect(parts[0]).toEqual({ type: 'text', text: 'Only instructions' });
    });

    it('handles partial sections (only userQuery)', () => {
      const messages: ProviderChatMessage[] = [
        {
          ...msg('user', 'fallback'),
          metadata: {
            sections: {
              userQuery: 'Just the query',
            },
          },
        },
      ];
      const config: OpenAICompatibleConfig = {
        apiKey: 'key',
        model: 'model',
        baseURL: 'http://localhost',
      };

      const result = buildRequest({ messages, config });

      const parts = result.messages[0]?.content as Array<{ type: string; text: string }>;
      expect(parts).toHaveLength(1);
      expect(parts[0]).toEqual({ type: 'text', text: 'Just the query' });
    });
  });

  // ---------------------------------------------------------------------------
  // Mixed Conversations
  // ---------------------------------------------------------------------------
  describe('mixed conversations', () => {
    it('handles conversation with system prompt and sections', () => {
      const messages: ProviderChatMessage[] = [
        {
          ...msg('user', 'fallback'),
          metadata: {
            sections: {
              systemInstruction: 'Context',
              tabContent: 'Page data',
              userQuery: 'Question 1',
            },
          },
        },
        msg('assistant', 'Answer 1'),
        msg('user', 'Follow up question'),
      ];
      const config: OpenAICompatibleConfig = {
        apiKey: 'key',
        model: 'model',
        baseURL: 'http://localhost',
      };

      const result = buildRequest({
        messages,
        config,
        systemPrompt: 'Global system prompt',
      });

      expect(result.messages).toHaveLength(4);
      // System prompt first
      expect(result.messages[0]).toEqual({
        role: 'system',
        content: 'Global system prompt',
      });
      // First user message with sections
      expect(Array.isArray(result.messages[1]?.content)).toBe(true);
      // Assistant response
      expect(result.messages[2]).toEqual({ role: 'assistant', content: 'Answer 1' });
      // Second user message without sections
      expect(result.messages[3]).toEqual({ role: 'user', content: 'Follow up question' });
    });

    it('handles empty messages array', () => {
      const messages: ProviderChatMessage[] = [];
      const config: OpenAICompatibleConfig = {
        apiKey: 'key',
        model: 'model',
        baseURL: 'http://localhost',
      };

      const result = buildRequest({ messages, config });

      expect(result.messages).toHaveLength(0);
    });

    it('handles empty messages with system prompt', () => {
      const messages: ProviderChatMessage[] = [];
      const config: OpenAICompatibleConfig = {
        apiKey: 'key',
        model: 'model',
        baseURL: 'http://localhost',
      };

      const result = buildRequest({
        messages,
        config,
        systemPrompt: 'System only',
      });

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]).toEqual({ role: 'system', content: 'System only' });
    });
  });
});
