/**
 * @file grok/requestBuilder.test.ts
 * Tests for Grok Request Builder
 *
 * Focus:
 * - `previous_response_id` branch correctness + system prompt override
 * - Web search tool inclusion
 * - Store flag for conversation continuity
 * - Full message history vs last user message modes
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { buildRequest, buildHeaders, buildApiUrl } from '@core/ai/grok/requestBuilder';
import type { ProviderChatMessage, GrokConfig, ProviderChatRole } from '@/types/providers';

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

describe('Grok requestBuilder', () => {
  const defaultConfig: GrokConfig = {
    apiKey: 'test-api-key',
    model: 'grok-beta',
  };

  // ---------------------------------------------------------------------------
  // buildRequest - Basic Request Structure
  // ---------------------------------------------------------------------------
  describe('buildRequest - basic structure', () => {
    it('includes model from config', () => {
      const messages: ProviderChatMessage[] = [msg('user', 'Hello')];
      const config: GrokConfig = { apiKey: 'key', model: 'grok-2' };

      const result = buildRequest(messages, config);

      expect(result.model).toBe('grok-2');
    });

    it('always includes web_search tool', () => {
      const messages: ProviderChatMessage[] = [msg('user', 'Hello')];

      const result = buildRequest(messages, defaultConfig);

      expect(result.tools).toEqual([{ type: 'web_search' }]);
    });

    it('always sets store to true for conversation continuity', () => {
      const messages: ProviderChatMessage[] = [msg('user', 'Hello')];

      const result = buildRequest(messages, defaultConfig);

      expect(result.store).toBe(true);
    });

    it('includes stream flag when chatConfig specifies it', () => {
      const messages: ProviderChatMessage[] = [msg('user', 'Hello')];

      const result = buildRequest(messages, defaultConfig, { stream: true });

      expect(result.stream).toBe(true);
    });

    it('omits stream flag when not specified', () => {
      const messages: ProviderChatMessage[] = [msg('user', 'Hello')];

      const result = buildRequest(messages, defaultConfig);

      expect(result.stream).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // buildRequest - Continuation Mode (with previousResponseId)
  // ---------------------------------------------------------------------------
  describe('buildRequest - continuation mode', () => {
    it('includes previous_response_id when provided', () => {
      const messages: ProviderChatMessage[] = [
        msg('user', 'First question'),
        msg('assistant', 'First answer'),
        msg('user', 'Follow up'),
      ];

      const result = buildRequest(messages, defaultConfig, {
        previousResponseId: 'resp_abc123',
      });

      expect(result.previous_response_id).toBe('resp_abc123');
    });

    it('sends only the last user message in continuation mode', () => {
      const messages: ProviderChatMessage[] = [
        msg('user', 'First question'),
        msg('assistant', 'First answer'),
        msg('user', 'Second question'),
        msg('assistant', 'Second answer'),
        msg('user', 'Latest question'),
      ];

      const result = buildRequest(messages, defaultConfig, {
        previousResponseId: 'resp_xyz789',
      });

      expect(result.input).toHaveLength(1);
      expect(result.input?.[0]).toEqual({
        role: 'user',
        content: 'Latest question',
      });
    });

    it('handles continuation with no user messages gracefully', () => {
      const messages: ProviderChatMessage[] = [msg('assistant', 'Previous response')];

      const result = buildRequest(messages, defaultConfig, {
        previousResponseId: 'resp_123',
      });

      expect(result.previous_response_id).toBe('resp_123');
      expect(result.input).toBeUndefined();
    });

    it('ignores system messages in continuation mode', () => {
      const messages: ProviderChatMessage[] = [
        msg('system', 'System prompt'),
        msg('user', 'Question'),
      ];

      const result = buildRequest(messages, defaultConfig, {
        previousResponseId: 'resp_456',
      });

      expect(result.input).toHaveLength(1);
      expect(result.input?.[0]?.role).toBe('user');
    });
  });

  // ---------------------------------------------------------------------------
  // buildRequest - Fresh Conversation Mode (without previousResponseId)
  // ---------------------------------------------------------------------------
  describe('buildRequest - fresh conversation mode', () => {
    it('omits previous_response_id when not provided', () => {
      const messages: ProviderChatMessage[] = [msg('user', 'Hello')];

      const result = buildRequest(messages, defaultConfig);

      expect(result.previous_response_id).toBeUndefined();
    });

    it('sends full conversation history without previousResponseId', () => {
      const messages: ProviderChatMessage[] = [
        msg('user', 'First question'),
        msg('assistant', 'First answer'),
        msg('user', 'Second question'),
      ];

      const result = buildRequest(messages, defaultConfig);

      expect(result.input).toHaveLength(3);
      expect(result.input).toEqual([
        { role: 'user', content: 'First question' },
        { role: 'assistant', content: 'First answer' },
        { role: 'user', content: 'Second question' },
      ]);
    });

    it('includes system messages from history when no systemPrompt override', () => {
      const messages: ProviderChatMessage[] = [msg('system', 'Be helpful'), msg('user', 'Hello')];

      const result = buildRequest(messages, defaultConfig);

      expect(result.input).toHaveLength(2);
      expect(result.input?.[0]).toEqual({ role: 'system', content: 'Be helpful' });
      expect(result.input?.[1]).toEqual({ role: 'user', content: 'Hello' });
    });

    it('replaces history system messages with systemPrompt override', () => {
      const messages: ProviderChatMessage[] = [
        msg('system', 'History system message'),
        msg('user', 'Hello'),
      ];

      const result = buildRequest(messages, defaultConfig, {
        systemPrompt: 'Override system prompt',
      });

      expect(result.input).toHaveLength(2);
      expect(result.input?.[0]).toEqual({ role: 'system', content: 'Override system prompt' });
      expect(result.input?.[1]).toEqual({ role: 'user', content: 'Hello' });
    });

    it('adds systemPrompt override even when no system in history', () => {
      const messages: ProviderChatMessage[] = [msg('user', 'Hello'), msg('assistant', 'Hi')];

      const result = buildRequest(messages, defaultConfig, {
        systemPrompt: 'Custom system prompt',
      });

      expect(result.input).toHaveLength(3);
      expect(result.input?.[0]).toEqual({ role: 'system', content: 'Custom system prompt' });
      expect(result.input?.[1]).toEqual({ role: 'user', content: 'Hello' });
      expect(result.input?.[2]).toEqual({ role: 'assistant', content: 'Hi' });
    });

    it('handles multiple system messages in history', () => {
      const messages: ProviderChatMessage[] = [
        msg('system', 'First system'),
        msg('system', 'Second system'),
        msg('user', 'Hello'),
      ];

      const result = buildRequest(messages, defaultConfig);

      expect(result.input).toHaveLength(3);
      expect(result.input?.[0]).toEqual({ role: 'system', content: 'First system' });
      expect(result.input?.[1]).toEqual({ role: 'system', content: 'Second system' });
      expect(result.input?.[2]).toEqual({ role: 'user', content: 'Hello' });
    });

    it('handles empty messages array', () => {
      const messages: ProviderChatMessage[] = [];

      const result = buildRequest(messages, defaultConfig);

      expect(result.input).toBeUndefined();
    });

    it('handles only system prompt with empty messages', () => {
      const messages: ProviderChatMessage[] = [];

      const result = buildRequest(messages, defaultConfig, {
        systemPrompt: 'Just system',
      });

      expect(result.input).toHaveLength(1);
      expect(result.input?.[0]).toEqual({ role: 'system', content: 'Just system' });
    });
  });

  // ---------------------------------------------------------------------------
  // buildRequest - Message Ordering
  // ---------------------------------------------------------------------------
  describe('buildRequest - message ordering', () => {
    it('places system messages before non-system messages', () => {
      const messages: ProviderChatMessage[] = [
        msg('user', 'User 1'),
        msg('system', 'System at end'),
        msg('assistant', 'Assistant 1'),
      ];

      const result = buildRequest(messages, defaultConfig);

      // System messages should come first, then conversation in order
      expect(result.input?.[0]?.role).toBe('system');
      expect(result.input?.[1]?.role).toBe('user');
      expect(result.input?.[2]?.role).toBe('assistant');
    });

    it('preserves order of non-system messages', () => {
      const messages: ProviderChatMessage[] = [
        msg('user', 'Q1'),
        msg('assistant', 'A1'),
        msg('user', 'Q2'),
        msg('assistant', 'A2'),
      ];

      const result = buildRequest(messages, defaultConfig);

      expect(result.input?.map(m => m.content)).toEqual(['Q1', 'A1', 'Q2', 'A2']);
    });
  });

  // ---------------------------------------------------------------------------
  // buildHeaders
  // ---------------------------------------------------------------------------
  describe('buildHeaders', () => {
    it('returns correct headers with Bearer token', () => {
      const headers = buildHeaders('my-api-key');

      expect(headers).toEqual({
        'Content-Type': 'application/json',
        Authorization: 'Bearer my-api-key',
      });
    });

    it('handles empty API key', () => {
      const headers = buildHeaders('');

      expect(headers).toEqual({
        'Content-Type': 'application/json',
        Authorization: 'Bearer ',
      });
    });

    it('handles API key with special characters', () => {
      const headers = buildHeaders('key-with-special_chars.123');

      expect(headers['Authorization']).toBe('Bearer key-with-special_chars.123');
    });
  });

  // ---------------------------------------------------------------------------
  // buildApiUrl
  // ---------------------------------------------------------------------------
  describe('buildApiUrl', () => {
    it('returns the correct Grok Response API URL', () => {
      const url = buildApiUrl();

      expect(url).toBe('https://api.x.ai/v1/responses');
    });
  });

  // ---------------------------------------------------------------------------
  // Edge Cases
  // ---------------------------------------------------------------------------
  describe('edge cases', () => {
    it('handles very long conversation in fresh mode', () => {
      const messages: ProviderChatMessage[] = [];
      for (let i = 0; i < 100; i++) {
        messages.push(msg('user', `Question ${i}`));
        messages.push(msg('assistant', `Answer ${i}`));
      }

      const result = buildRequest(messages, defaultConfig);

      expect(result.input).toHaveLength(200);
    });

    it('handles very long conversation in continuation mode', () => {
      const messages: ProviderChatMessage[] = [];
      for (let i = 0; i < 100; i++) {
        messages.push(msg('user', `Question ${i}`));
        messages.push(msg('assistant', `Answer ${i}`));
      }
      messages.push(msg('user', 'Final question'));

      const result = buildRequest(messages, defaultConfig, {
        previousResponseId: 'resp_long',
      });

      // Only the last user message
      expect(result.input).toHaveLength(1);
      expect(result.input?.[0]?.content).toBe('Final question');
    });

    it('combines all chatConfig options', () => {
      const messages: ProviderChatMessage[] = [msg('user', 'Question')];

      const result = buildRequest(messages, defaultConfig, {
        previousResponseId: 'resp_combo',
        systemPrompt: 'System override',
        stream: true,
      });

      expect(result.previous_response_id).toBe('resp_combo');
      expect(result.stream).toBe(true);
      // System prompt is ignored in continuation mode
      expect(result.input).toHaveLength(1);
      expect(result.input?.[0]?.role).toBe('user');
    });
  });
});
