/**
 * @file OpenAI Request Builder Tests
 *
 * Tests for construction of OpenAI API requests for the Responses API.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildRequest,
  buildRequestOptions,
  convertMessagesToInput,
} from '@core/ai/openai/requestBuilder';
import type { ProviderChatMessage, OpenAIConfig } from '@/types/providers';
import type { OpenAIChatConfig } from '@core/ai/openai/types';

// Helper to create test messages with required fields
let messageCounter = 0;

beforeEach(() => {
  messageCounter = 0;
});

const msg = (
  role: 'user' | 'assistant' | 'system',
  content: string,
  metadata?: ProviderChatMessage['metadata']
): ProviderChatMessage => ({
  id: `msg-${++messageCounter}`,
  timestamp: new Date(1700000000000 + messageCounter),
  role,
  content,
  ...(metadata ? { metadata } : {}),
});

describe('buildRequest', () => {
  const baseConfig: OpenAIConfig = {
    provider: 'openai',
    model: 'gpt-4o',
    apiKey: 'test-api-key',
  };

  describe('basic request structure', () => {
    it('should build request with model', () => {
      const messages: ProviderChatMessage[] = [msg('user', 'Hello')];

      const request = buildRequest(messages, baseConfig);

      expect(request.model).toBe('gpt-4o');
    });

    it('should always include web_search tool', () => {
      const messages: ProviderChatMessage[] = [msg('user', 'Hello')];

      const request = buildRequest(messages, baseConfig);

      expect(request.tools).toContainEqual({ type: 'web_search' });
    });

    it('should always enable store for conversation continuity', () => {
      const messages: ProviderChatMessage[] = [msg('user', 'Hello')];

      const request = buildRequest(messages, baseConfig);

      expect(request.store).toBe(true);
    });
  });

  describe('system prompt handling', () => {
    it('should use chatConfig systemPrompt as instructions', () => {
      const messages: ProviderChatMessage[] = [msg('user', 'Hello')];

      const chatConfig: OpenAIChatConfig = {
        systemPrompt: 'You are a helpful assistant.',
      };

      const request = buildRequest(messages, baseConfig, chatConfig);

      expect(request.instructions).toBe('You are a helpful assistant.');
    });

    it('should extract system messages as instructions', () => {
      const messages: ProviderChatMessage[] = [msg('system', 'Be concise.'), msg('user', 'Hello')];

      const request = buildRequest(messages, baseConfig);

      expect(request.instructions).toBe('Be concise.');
    });

    it('should concatenate multiple system messages', () => {
      const messages: ProviderChatMessage[] = [
        msg('system', 'Be concise.'),
        msg('system', 'Be helpful.'),
        msg('user', 'Hello'),
      ];

      const request = buildRequest(messages, baseConfig);

      expect(request.instructions).toBe('Be concise.\nBe helpful.');
    });

    it('should prefer chatConfig systemPrompt over system messages', () => {
      const messages: ProviderChatMessage[] = [msg('system', 'From message'), msg('user', 'Hello')];

      const chatConfig: OpenAIChatConfig = {
        systemPrompt: 'From config',
      };

      const request = buildRequest(messages, baseConfig, chatConfig);

      expect(request.instructions).toBe('From config');
    });
  });

  describe('previous_response_id handling', () => {
    it('should include previous_response_id when provided', () => {
      const messages: ProviderChatMessage[] = [
        msg('user', 'First message'),
        msg('assistant', 'Response'),
        msg('user', 'Follow up'),
      ];

      const chatConfig: OpenAIChatConfig = {
        previousResponseId: 'resp-12345',
      };

      const request = buildRequest(messages, baseConfig, chatConfig);

      expect(request.previous_response_id).toBe('resp-12345');
    });

    it('should only send last user message when using previous_response_id', () => {
      const messages: ProviderChatMessage[] = [
        msg('user', 'First message'),
        msg('assistant', 'Response'),
        msg('user', 'Follow up question'),
      ];

      const chatConfig: OpenAIChatConfig = {
        previousResponseId: 'resp-12345',
      };

      const request = buildRequest(messages, baseConfig, chatConfig);

      expect(request.input).toHaveLength(1);
      expect(request.input?.[0]?.role).toBe('user');
    });

    it('should send full history without previous_response_id', () => {
      const messages: ProviderChatMessage[] = [
        msg('user', 'First'),
        msg('assistant', 'Response'),
        msg('user', 'Second'),
      ];

      const request = buildRequest(messages, baseConfig);

      expect(request.input?.length).toBeGreaterThan(1);
    });
  });

  describe('streaming', () => {
    it('should include stream flag when configured', () => {
      const messages: ProviderChatMessage[] = [msg('user', 'Hello')];

      const chatConfig: OpenAIChatConfig = {
        stream: true,
      };

      const request = buildRequest(messages, baseConfig, chatConfig);

      expect(request.stream).toBe(true);
    });

    it('should not include stream flag when not configured', () => {
      const messages: ProviderChatMessage[] = [msg('user', 'Hello')];

      const request = buildRequest(messages, baseConfig);

      expect(request.stream).toBeUndefined();
    });
  });

  describe('reasoning params', () => {
    it('should include reasoning from chatConfig', () => {
      const messages: ProviderChatMessage[] = [msg('user', 'Hello')];

      const chatConfig: OpenAIChatConfig = {
        reasoningEffort: 'medium',
      };

      const request = buildRequest(messages, baseConfig, chatConfig);

      expect(request.reasoning).toEqual({
        effort: 'medium',
        summary: 'auto',
      });
    });

    it('should include reasoning from openaiConfig', () => {
      const messages: ProviderChatMessage[] = [msg('user', 'Hello')];

      const config: OpenAIConfig = {
        ...baseConfig,
        reasoningEffort: 'high',
      };

      const request = buildRequest(messages, config);

      expect(request.reasoning?.effort).toBe('high');
    });

    it('should prefer chatConfig reasoning over openaiConfig', () => {
      const messages: ProviderChatMessage[] = [msg('user', 'Hello')];

      const config: OpenAIConfig = {
        ...baseConfig,
        reasoningEffort: 'low',
      };

      const chatConfig: OpenAIChatConfig = {
        reasoningEffort: 'high',
      };

      const request = buildRequest(messages, config, chatConfig);

      expect(request.reasoning?.effort).toBe('high');
    });
  });

  describe('message conversion', () => {
    it('should convert user messages to input format', () => {
      const messages: ProviderChatMessage[] = [msg('user', 'Hello world')];

      const request = buildRequest(messages, baseConfig);

      expect(request.input?.[0]?.role).toBe('user');
      expect(request.input?.[0]?.content[0]).toEqual({
        type: 'input_text',
        text: 'Hello world',
      });
    });

    it('should convert assistant messages to output format', () => {
      const messages: ProviderChatMessage[] = [msg('user', 'Hello'), msg('assistant', 'Hi there!')];

      const request = buildRequest(messages, baseConfig);

      const assistantMsg = request.input?.find(m => m.role === 'assistant');
      expect(assistantMsg?.content[0]).toEqual({
        type: 'output_text',
        text: 'Hi there!',
      });
    });

    it('should filter out system messages from input', () => {
      const messages: ProviderChatMessage[] = [
        msg('system', 'System prompt'),
        msg('user', 'Hello'),
      ];

      const request = buildRequest(messages, baseConfig);

      const hasSystem = request.input?.some(m => (m.role as string) === 'system');
      expect(hasSystem).toBeFalsy();
    });

    it('should handle messages with sections metadata', () => {
      const messages: ProviderChatMessage[] = [
        msg('user', '', {
          sections: {
            systemInstruction: 'Instruction',
            tabContent: 'Page content',
            userQuery: 'Question?',
          },
        }),
      ];

      const request = buildRequest(messages, baseConfig);

      const content = request.input?.[0]?.content;
      expect(content).toHaveLength(3);
    });

    it('should parse image fileId from tabContent', () => {
      const messages: ProviderChatMessage[] = [
        msg('user', '', {
          sections: {
            tabContent:
              'Before </metadata>\n  <content type="image"><fileId>file-123</fileId></content> After',
          },
        }),
      ];

      const request = buildRequest(messages, baseConfig);

      const content = request.input?.[0]?.content;
      const imagePart = Array.isArray(content)
        ? content.find((c: { type: string }) => c.type === 'input_image')
        : undefined;
      expect(imagePart).toBeDefined();
      expect((imagePart as { file_id: string }).file_id).toBe('file-123');
    });

    it('should handle image attachments with fileId', () => {
      const messages: ProviderChatMessage[] = [
        msg('user', 'Describe this', {
          attachments: [
            {
              type: 'image',
              fileId: 'file-abc',
              mimeType: 'image/jpeg',
              detail: 'high',
            },
          ],
        }),
      ];

      const request = buildRequest(messages, baseConfig);

      const content = request.input?.[0]?.content;
      const imagePart = Array.isArray(content)
        ? content.find((c: { type: string }) => c.type === 'input_image')
        : undefined;
      expect(imagePart).toBeDefined();
      expect((imagePart as { file_id: string; detail: string }).file_id).toBe('file-abc');
      expect((imagePart as { file_id: string; detail: string }).detail).toBe('high');
    });

    it('should skip placeholder content with attachments', () => {
      const messages: ProviderChatMessage[] = [
        msg('user', '[Image]', {
          attachments: [
            {
              type: 'image',
              fileId: 'file-abc',
              mimeType: 'image/jpeg',
            },
          ],
        }),
      ];

      const request = buildRequest(messages, baseConfig);

      const content = request.input?.[0]?.content;
      const textPart = Array.isArray(content)
        ? content.find((c: { type: string }) => c.type === 'input_text')
        : undefined;
      expect(textPart).toBeUndefined();
    });
  });
});

describe('buildRequestOptions', () => {
  it('should build valid request options', () => {
    const options = buildRequestOptions('test-key', { test: 'data' });

    expect(options.method).toBe('POST');
    expect(options.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-key',
    });
    expect(options.body).toBe('{"test":"data"}');
  });

  it('should include abort signal when provided', () => {
    const controller = new AbortController();
    const options = buildRequestOptions('test-key', {}, controller.signal);

    expect(options.signal).toBe(controller.signal);
  });

  it('should throw error for missing API key', () => {
    expect(() => buildRequestOptions('', {})).toThrow('OpenAI API key is not configured');
  });
});

describe('convertMessagesToInput', () => {
  it('should convert messages to formatted string', () => {
    const messages: ProviderChatMessage[] = [
      msg('system', 'System prompt'),
      msg('user', 'Hello'),
      msg('assistant', 'Hi!'),
    ];

    const result = convertMessagesToInput(messages);

    expect(result).toContain('System: System prompt');
    expect(result).toContain('User: Hello');
    expect(result).toContain('Assistant: Hi!');
  });

  it('should put system messages first', () => {
    const messages: ProviderChatMessage[] = [msg('user', 'Hello'), msg('system', 'System prompt')];

    const result = convertMessagesToInput(messages);
    const lines = result.split('\n');

    expect(lines[0]).toContain('System:');
    expect(lines[1]).toContain('User:');
  });
});
