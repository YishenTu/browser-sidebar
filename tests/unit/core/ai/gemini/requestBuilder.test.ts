/**
 * @file Gemini Request Builder Tests
 *
 * Tests for construction of Gemini API requests including message conversion,
 * generation config, and multimodal content processing.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildRequest,
  buildGenerationConfig,
  buildApiUrl,
  buildHeaders,
  convertMessages,
  isSupportedImageType,
} from '@core/ai/gemini/requestBuilder';
import type { ProviderChatMessage, GeminiConfig } from '@/types/providers';
import type { GeminiChatConfig } from '@core/ai/gemini/types';

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

// Mock the supportsThinking function
vi.mock('@/config/models', () => ({
  supportsThinking: vi.fn((model: string) => {
    return model.includes('2.5') || model.includes('3');
  }),
}));

describe('buildRequest', () => {
  const baseConfig: GeminiConfig = {
    provider: 'gemini',
    model: 'gemini-2.0-flash-exp',
    apiKey: 'test-api-key',
  };

  it('should build a valid request with messages', () => {
    const messages: ProviderChatMessage[] = [msg('user', 'Hello, how are you?')];

    const request = buildRequest(messages, baseConfig);

    expect(request.contents).toBeDefined();
    expect(request.contents).toHaveLength(1);
    expect(request.contents?.[0]?.role).toBe('user');
  });

  it('should throw error for empty messages', () => {
    const messages: ProviderChatMessage[] = [];

    expect(() => buildRequest(messages, baseConfig)).toThrow('Messages array cannot be empty');
  });

  it('should throw error for messages with only empty content', () => {
    const messages: ProviderChatMessage[] = [msg('user', '   ')];

    expect(() => buildRequest(messages, baseConfig)).toThrow('Messages array cannot be empty');
  });

  it('should include system instruction when provided', () => {
    const messages: ProviderChatMessage[] = [msg('user', 'Test message')];

    const chatConfig: GeminiChatConfig = {
      systemPrompt: 'You are a helpful assistant.',
    };

    const request = buildRequest(messages, baseConfig, chatConfig);

    expect(request.systemInstruction).toBeDefined();
    expect(request.systemInstruction?.parts?.[0]?.text).toBe('You are a helpful assistant.');
  });

  it('should always include Google Search tool', () => {
    const messages: ProviderChatMessage[] = [msg('user', 'Test')];

    const request = buildRequest(messages, baseConfig);

    expect(request.tools).toBeDefined();
    expect(request.tools?.some(t => 'google_search' in t)).toBe(true);
  });

  it('should include URL context tool when configured', () => {
    const messages: ProviderChatMessage[] = [msg('user', 'Test')];

    const chatConfig: GeminiChatConfig = {
      useUrlContext: true,
    };

    const request = buildRequest(messages, baseConfig, chatConfig);

    expect(request.tools?.some(t => 'url_context' in t)).toBe(true);
  });
});

describe('buildGenerationConfig', () => {
  describe('thinkingLevel (Gemini 3)', () => {
    it('should set thinkingLevel from chatConfig', () => {
      const config: GeminiConfig = {
        provider: 'gemini',
        model: 'gemini-3-flash',
        apiKey: 'test',
      };

      const chatConfig: GeminiChatConfig = {
        thinkingLevel: 'medium',
      };

      const result = buildGenerationConfig(config, chatConfig);
      expect(result.thinkingLevel).toBe('medium');
    });

    it('should set thinkingLevel from geminiConfig', () => {
      const config: GeminiConfig = {
        provider: 'gemini',
        model: 'gemini-3-flash',
        apiKey: 'test',
        thinkingLevel: 'high',
      };

      const result = buildGenerationConfig(config);
      expect(result.thinkingLevel).toBe('high');
    });

    it('should prefer chatConfig thinkingLevel over geminiConfig', () => {
      const config: GeminiConfig = {
        provider: 'gemini',
        model: 'gemini-3-flash',
        apiKey: 'test',
        thinkingLevel: 'low',
      };

      const chatConfig: GeminiChatConfig = {
        thinkingLevel: 'high',
      };

      const result = buildGenerationConfig(config, chatConfig);
      expect(result.thinkingLevel).toBe('high');
    });

    it('should support minimal thinking level', () => {
      const config: GeminiConfig = {
        provider: 'gemini',
        model: 'gemini-3-flash',
        apiKey: 'test',
        thinkingLevel: 'minimal',
      };

      const result = buildGenerationConfig(config);
      expect(result.thinkingLevel).toBe('minimal');
    });
  });

  describe('thinkingConfig (Gemini 2.5)', () => {
    it('should set thinkingConfig with budget for supported models', () => {
      const config: GeminiConfig = {
        provider: 'gemini',
        model: 'gemini-2.5-pro',
        apiKey: 'test',
        thinkingBudget: 1024,
      };

      const result = buildGenerationConfig(config);

      expect(result.thinkingConfig).toBeDefined();
      expect(result.thinkingConfig?.thinkingBudget).toBe(1024);
      expect(result.thinkingConfig?.includeThoughts).toBe(true);
    });

    it('should normalize budget 0 to -1 for gemini-2.5-pro', () => {
      const config: GeminiConfig = {
        provider: 'gemini',
        model: 'gemini-2.5-pro',
        apiKey: 'test',
        thinkingBudget: 0,
      };

      const result = buildGenerationConfig(config);
      expect(result.thinkingConfig?.thinkingBudget).toBe(-1);
    });

    it('should allow budget 0 for non-pro models', () => {
      const config: GeminiConfig = {
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        apiKey: 'test',
        thinkingBudget: 0,
      };

      const result = buildGenerationConfig(config);
      expect(result.thinkingConfig?.thinkingBudget).toBe(0);
      expect(result.thinkingConfig?.includeThoughts).toBe(false);
    });

    it('should parse string thinkingBudget', () => {
      const config: GeminiConfig = {
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        apiKey: 'test',
        thinkingBudget: '512' as unknown as number,
      };

      const result = buildGenerationConfig(config);
      expect(result.thinkingConfig?.thinkingBudget).toBe(512);
    });

    it('should ignore empty string thinkingBudget', () => {
      const config: GeminiConfig = {
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        apiKey: 'test',
        thinkingBudget: '' as unknown as number,
      };

      const result = buildGenerationConfig(config);
      expect(result.thinkingConfig).toBeUndefined();
    });

    it('should prefer thinkingLevel over thinkingBudget', () => {
      const config: GeminiConfig = {
        provider: 'gemini',
        model: 'gemini-2.5-pro',
        apiKey: 'test',
        thinkingLevel: 'high',
        thinkingBudget: 1024,
      };

      const result = buildGenerationConfig(config);
      expect(result.thinkingLevel).toBe('high');
      expect(result.thinkingConfig).toBeUndefined();
    });
  });

  it('should include stop sequences when provided', () => {
    const config: GeminiConfig = {
      provider: 'gemini',
      model: 'gemini-2.0-flash',
      apiKey: 'test',
      stopSequences: ['END', 'STOP'],
    };

    const result = buildGenerationConfig(config);
    expect(result.stopSequences).toEqual(['END', 'STOP']);
  });

  it('should not include empty stop sequences', () => {
    const config: GeminiConfig = {
      provider: 'gemini',
      model: 'gemini-2.0-flash',
      apiKey: 'test',
      stopSequences: [],
    };

    const result = buildGenerationConfig(config);
    expect(result.stopSequences).toBeUndefined();
  });
});

describe('buildApiUrl', () => {
  const apiKey = 'test-api-key';

  it('should build URL with default base', () => {
    const url = buildApiUrl('/models/gemini-pro:generateContent', apiKey);

    expect(url).toContain('generativelanguage.googleapis.com');
    expect(url).toContain('/v1beta/models/gemini-pro:generateContent');
    expect(url).toContain('key=test-api-key');
  });

  it('should append alt=sse for stream endpoints', () => {
    const url = buildApiUrl('/models/gemini-pro:streamGenerateContent', apiKey);

    expect(url).toContain('alt=sse');
  });

  it('should not append alt=sse for non-stream endpoints', () => {
    const url = buildApiUrl('/models/gemini-pro:generateContent', apiKey);

    expect(url).not.toContain('alt=sse');
  });

  it('should handle custom base URL', () => {
    const url = buildApiUrl('/models/gemini-pro:generateContent', apiKey, 'https://custom.api.com');

    expect(url).toContain('custom.api.com');
  });

  it('should normalize trailing slashes in base URL', () => {
    const url = buildApiUrl('/models/gemini-pro:generateContent', apiKey, 'https://api.com///');

    expect(url).not.toContain('////');
    expect(url).toContain('/v1beta/models');
  });

  it('should handle endpoint without leading slash', () => {
    const url = buildApiUrl('models/gemini-pro:generateContent', apiKey);

    expect(url).toContain('/v1beta/models/gemini-pro');
  });

  it('should handle empty endpoint', () => {
    const url = buildApiUrl('', apiKey);

    expect(url).toContain('/v1beta?');
  });
});

describe('buildHeaders', () => {
  it('should include API key header', () => {
    const headers = buildHeaders('test-api-key');

    expect(headers['x-goog-api-key']).toBe('test-api-key');
  });

  it('should include Content-Type header', () => {
    const headers = buildHeaders('test-api-key');

    expect(headers['Content-Type']).toBe('application/json');
  });

  it('should throw error for missing API key', () => {
    expect(() => buildHeaders('')).toThrow('Gemini API key is not configured');
  });
});

describe('convertMessages', () => {
  it('should convert user messages', () => {
    const messages: ProviderChatMessage[] = [msg('user', 'Hello!')];

    const result = convertMessages(messages);

    expect(result).toHaveLength(1);
    expect(result?.[0]?.role).toBe('user');
    expect(result?.[0]?.parts?.[0]).toEqual({ text: 'Hello!' });
  });

  it('should convert assistant to model role', () => {
    const messages: ProviderChatMessage[] = [msg('assistant', 'Hi there!')];

    const result = convertMessages(messages);

    expect(result?.[0]?.role).toBe('model');
  });

  it('should handle messages with sections metadata', () => {
    const messages: ProviderChatMessage[] = [
      msg('user', '', {
        sections: {
          systemInstruction: 'Be helpful',
          tabContent: 'Page content here',
          userQuery: 'What is this?',
        },
      }),
    ];

    const result = convertMessages(messages);

    expect(result?.[0]?.parts).toHaveLength(3);
    expect(result?.[0]?.parts?.[0]).toEqual({ text: 'Be helpful' });
    expect(result?.[0]?.parts?.[1]).toEqual({ text: 'Page content here' });
    expect(result?.[0]?.parts?.[2]).toEqual({ text: 'What is this?' });
  });

  it('should include thought signatures for assistant messages', () => {
    const messages: ProviderChatMessage[] = [
      msg('assistant', 'Response', {
        thoughtSignatures: ['sig1', 'sig2'],
      }),
    ];

    const result = convertMessages(messages);

    expect(result?.[0]?.parts).toContainEqual({ thoughtSignature: 'sig1' });
    expect(result?.[0]?.parts).toContainEqual({ thoughtSignature: 'sig2' });
  });

  it('should handle image attachments with fileUri', () => {
    const messages: ProviderChatMessage[] = [
      msg('user', 'Describe this image', {
        attachments: [
          {
            type: 'image',
            fileUri: 'https://storage.googleapis.com/file.jpg',
            mimeType: 'image/jpeg',
          },
        ],
      }),
    ];

    const result = convertMessages(messages);

    const imagePart = result?.[0]?.parts?.find(p => 'fileData' in p);
    expect(imagePart).toBeDefined();
    expect((imagePart as { fileData: { fileUri: string } })?.fileData?.fileUri).toBe(
      'https://storage.googleapis.com/file.jpg'
    );
  });

  it('should skip unsupported attachment types', () => {
    const messages: ProviderChatMessage[] = [
      msg('user', 'Test', {
        attachments: [
          {
            type: 'audio',
            data: 'base64data',
          },
        ],
      }),
    ];

    expect(() => convertMessages(messages)).toThrow('Unsupported media type');
  });

  it('should parse image references in tabContent', () => {
    const messages: ProviderChatMessage[] = [
      msg('user', '', {
        sections: {
          tabContent:
            'Before <content type="image"><fileUri>https://example.com/img.jpg</fileUri><mimeType>image/jpeg</mimeType></content> After',
        },
      }),
    ];

    const result = convertMessages(messages);
    const parts = result?.[0]?.parts;

    // Should have text before, image, and text after
    const imagePartIndex = parts?.findIndex(p => 'fileData' in p) ?? -1;
    expect(imagePartIndex).toBeGreaterThan(-1);
  });

  it('should skip image attachments with unsupported mime type', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const messages: ProviderChatMessage[] = [
      msg('user', 'Test', {
        attachments: [
          {
            type: 'image',
            fileUri: 'https://example.com/file.bmp',
            mimeType: 'image/bmp', // Not supported
          },
        ],
      }),
    ];

    try {
      const result = convertMessages(messages);
      const imagePart = result?.[0]?.parts?.find(p => 'fileData' in p);
      expect(imagePart).toBeUndefined();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unsupported or missing image type: image/bmp')
      );
    } finally {
      warnSpy.mockRestore();
    }
  });
});

describe('isSupportedImageType', () => {
  it('should return true for supported types', () => {
    expect(isSupportedImageType('image/jpeg')).toBe(true);
    expect(isSupportedImageType('image/png')).toBe(true);
    expect(isSupportedImageType('image/gif')).toBe(true);
    expect(isSupportedImageType('image/webp')).toBe(true);
  });

  it('should be case-insensitive', () => {
    expect(isSupportedImageType('IMAGE/JPEG')).toBe(true);
    expect(isSupportedImageType('Image/Png')).toBe(true);
  });

  it('should return false for unsupported types', () => {
    expect(isSupportedImageType('image/bmp')).toBe(false);
    expect(isSupportedImageType('image/tiff')).toBe(false);
    expect(isSupportedImageType('application/pdf')).toBe(false);
  });
});
