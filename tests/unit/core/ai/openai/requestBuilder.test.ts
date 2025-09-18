import { describe, it, expect } from 'vitest';
import { buildRequest } from '@/core/ai/openai/requestBuilder';
import type { OpenAIConfig } from '@/types/providers';

describe('OpenAI requestBuilder', () => {
  const baseConfig: OpenAIConfig = {
    apiKey: 'sk-test',
    model: 'gpt-5-nano',
    reasoningEffort: 'low',
  };

  it('uses output_text for assistant turns when sending full history', () => {
    const messages = [
      {
        id: 'u1',
        role: 'user' as const,
        content: 'hi',
        timestamp: new Date(),
      },
      {
        id: 'a1',
        role: 'assistant' as const,
        content: 'Hello! How can I help you today?',
        timestamp: new Date(),
      },
      {
        id: 'u2',
        role: 'user' as const,
        content: 'hello world',
        timestamp: new Date(),
      },
    ];

    const req = buildRequest(messages, baseConfig, { stream: true });

    expect(req.model).toBe(baseConfig.model);
    expect(req.stream).toBe(true);
    expect(req.store).toBe(true);
    expect(req.tools).toEqual([{ type: 'web_search' }]);
    expect(req.previous_response_id).toBeUndefined();
    expect(req.input).toBeTruthy();
    // Validate role and content types mapping
    const roles = req.input!.map(i => i.role);
    expect(roles).toEqual(['user', 'assistant', 'user']);
    const contentTypes = req.input!.map(i =>
      Array.isArray(i.content) ? (i.content[0] as any).type : ''
    );
    expect(contentTypes).toEqual(['input_text', 'output_text', 'input_text']);
  });

  it('only sends last user message when previousResponseId is set', () => {
    const messages = [
      {
        id: 'u1',
        role: 'user' as const,
        content: 'hi',
        timestamp: new Date(),
      },
      {
        id: 'a1',
        role: 'assistant' as const,
        content: 'Hello!',
        timestamp: new Date(),
      },
      {
        id: 'u2',
        role: 'user' as const,
        content: 'hello world',
        timestamp: new Date(),
      },
    ];

    const req = buildRequest(messages, baseConfig, {
      stream: true,
      previousResponseId: 'resp_123',
    });

    expect(req.previous_response_id).toBe('resp_123');
    expect(req.input).toHaveLength(1);
    expect(req.input?.[0].role).toBe('user');
    const firstContent = req.input?.[0].content as any[];
    expect(firstContent[0].type).toBe('input_text');
    expect(firstContent[0].text).toBe('hello world');
  });

  it('includes image attachments as input_image_file content when present', () => {
    const messages = [
      {
        id: 'u1',
        role: 'user' as const,
        content: 'Please review this screenshot',
        timestamp: new Date(),
        metadata: {
          attachments: [
            {
              type: 'image',
              fileId: 'file-abc123',
              mimeType: 'image/png',
              detail: 'high',
            },
          ],
        },
      },
      {
        id: 'a1',
        role: 'assistant' as const,
        content: 'Looks good to me!',
        timestamp: new Date(),
      },
    ];

    const req = buildRequest(messages, baseConfig);

    expect(req.input).toBeTruthy();
    const firstInput = req.input?.[0];
    expect(firstInput?.role).toBe('user');
    const parts = firstInput?.content as Array<Record<string, unknown>>;
    expect(parts).toHaveLength(2);
    expect(parts[0]).toMatchObject({ type: 'input_text', text: 'Please review this screenshot' });
    expect(parts[1]).toMatchObject({ type: 'input_image', file_id: 'file-abc123', detail: 'high' });
  });

  it('omits placeholder text when only image attachments are present', () => {
    const messages = [
      {
        id: 'u1',
        role: 'user' as const,
        content: '[Image]',
        timestamp: new Date(),
        metadata: {
          attachments: [
            {
              type: 'image',
              fileId: 'file-only-image',
              mimeType: 'image/jpeg',
            },
          ],
        },
      },
    ];

    const req = buildRequest(messages, baseConfig);

    expect(req.input).toHaveLength(1);
    const parts = req.input?.[0].content as Array<Record<string, unknown>>;
    expect(parts).toHaveLength(1);
    expect(parts[0]).toMatchObject({
      type: 'input_image',
      file_id: 'file-only-image',
      detail: 'auto',
    });
  });

  it('retains attachments when continuing a conversation with previousResponseId', () => {
    const messages = [
      {
        id: 'u1',
        role: 'user' as const,
        content: 'Earlier chat',
        timestamp: new Date(),
      },
      {
        id: 'a1',
        role: 'assistant' as const,
        content: 'Previous response',
        timestamp: new Date(),
      },
      {
        id: 'u2',
        role: 'user' as const,
        content: '[Image]',
        timestamp: new Date(),
        metadata: {
          attachments: [
            {
              type: 'image',
              fileId: 'file-followup',
              mimeType: 'image/png',
            },
          ],
        },
      },
    ];

    const req = buildRequest(messages, baseConfig, {
      previousResponseId: 'resp_continue',
    });

    expect(req.previous_response_id).toBe('resp_continue');
    expect(req.input).toHaveLength(1);
    const parts = req.input?.[0].content as Array<Record<string, unknown>>;
    expect(parts).toHaveLength(1);
    expect(parts[0]).toMatchObject({
      type: 'input_image',
      file_id: 'file-followup',
      detail: 'auto',
    });
  });
});
