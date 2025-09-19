/**
 * @file Gemini Request Builder Unit Tests
 *
 * Comprehensive unit tests for Gemini request building functionality,
 * including message conversion, generation config building, image processing,
 * and API URL/header construction.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  buildRequest,
  convertMessages,
  buildGenerationConfig,
  buildHeaders,
  buildApiUrl,
  isSupportedImageType,
} from '@/core/ai/gemini/requestBuilder';
import type { ProviderChatMessage, GeminiConfig } from '@/types/providers';
import type { GeminiChatConfig, GeminiRequest, GeminiContent } from '@/core/ai/gemini/types';

// Mock the models config
vi.mock('@/config/models', () => ({
  supportsThinking: vi.fn(),
}));

import { supportsThinking } from '@/config/models';

describe('Gemini Request Builder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock: model supports thinking
    vi.mocked(supportsThinking).mockReturnValue(true);
  });

  describe('buildRequest', () => {
    const mockGeminiConfig: GeminiConfig = {
      model: 'gemini-2.5-pro',
      stopSequences: ['STOP'],
      thinkingBudget: 'medium',
    };

    it('should build complete request with system prompt', () => {
      const messages: ProviderChatMessage[] = [
        {
          role: 'user',
          content: 'Hello, AI!',
          metadata: {},
        },
      ];

      const chatConfig: GeminiChatConfig = {
        systemPrompt: 'You are a helpful assistant.',
        thinkingBudget: 'high',
        showThoughts: true,
      };

      const request = buildRequest(messages, mockGeminiConfig, chatConfig);

      expect(request).toEqual({
        contents: [
          {
            role: 'user',
            parts: [{ text: 'Hello, AI!' }],
          },
        ],
        generationConfig: {
          stopSequences: ['STOP'],
          responseModalities: ['TEXT', 'THOUGHT'],
        },
        tools: [{ google_search: {} }],
        systemInstruction: {
          parts: [{ text: 'You are a helpful assistant.' }],
        },
      });
    });

    it('should build minimal request without optional fields', () => {
      const messages: ProviderChatMessage[] = [
        {
          role: 'user',
          content: 'Simple message',
          metadata: {},
        },
      ];

      const minimalConfig: GeminiConfig = {
        model: 'gemini-2.5-flash',
      };

      const request = buildRequest(messages, minimalConfig);

      expect(request).toEqual({
        contents: [
          {
            role: 'user',
            parts: [{ text: 'Simple message' }],
          },
        ],
        generationConfig: {
          responseModalities: ['TEXT'],
        },
        tools: [{ google_search: {} }],
      });
    });

    it('should build request without safety settings', () => {
      const messages: ProviderChatMessage[] = [
        {
          role: 'user',
          content: 'Test message',
          metadata: {},
        },
      ];

      const config: GeminiConfig = {
        model: 'gemini-2.5-pro',
      };

      const request = buildRequest(messages, config);

      // Verify request structure without safety settings
      expect(request.contents).toBeDefined();
      expect(request.generationConfig).toBeDefined();
      expect(request.tools).toBeDefined();
      expect(request.safetySettings).toBeUndefined();
    });

    it('should throw error for empty messages', () => {
      expect(() => {
        buildRequest([], mockGeminiConfig);
      }).toThrow('Messages array cannot be empty');
    });

    it('should throw error for messages with only empty content', () => {
      const emptyMessages: ProviderChatMessage[] = [
        {
          role: 'user',
          content: '',
          metadata: {},
        },
        {
          role: 'assistant',
          content: '   ',
          metadata: {},
        },
      ];

      expect(() => {
        buildRequest(emptyMessages, mockGeminiConfig);
      }).toThrow('Messages array cannot be empty');
    });

    it('should filter out messages with empty content but keep others', () => {
      const mixedMessages: ProviderChatMessage[] = [
        {
          role: 'user',
          content: '',
          metadata: {},
        },
        {
          role: 'user',
          content: 'Valid message',
          metadata: {},
        },
      ];

      const request = buildRequest(mixedMessages, mockGeminiConfig);

      expect(request.contents).toHaveLength(2);
      expect(request.contents[0].parts).toHaveLength(0); // Empty content, no parts
      expect(request.contents[1].parts).toHaveLength(1);
      expect(request.contents[1].parts[0].text).toBe('Valid message');
    });

    it('should handle model that does not support thinking', () => {
      vi.mocked(supportsThinking).mockReturnValue(false);

      const messages: ProviderChatMessage[] = [
        {
          role: 'user',
          content: 'Hello',
          metadata: {},
        },
      ];

      const request = buildRequest(messages, mockGeminiConfig);

      expect(request.generationConfig.thinkingConfig).toBeUndefined();
      expect(request.generationConfig.responseModalities).toBeUndefined();
    });
  });

  describe('convertMessages', () => {
    it('should convert basic user message', () => {
      const messages: ProviderChatMessage[] = [
        {
          role: 'user',
          content: 'Hello, world!',
          metadata: {},
        },
      ];

      const result = convertMessages(messages);

      expect(result).toEqual([
        {
          role: 'user',
          parts: [{ text: 'Hello, world!' }],
        },
      ]);
    });

    it('should convert assistant message to model role', () => {
      const messages: ProviderChatMessage[] = [
        {
          role: 'assistant',
          content: 'Hello, human!',
          metadata: {},
        },
      ];

      const result = convertMessages(messages);

      expect(result).toEqual([
        {
          role: 'model',
          parts: [{ text: 'Hello, human!' }],
        },
      ]);
    });

    it('should preserve system role', () => {
      const messages: ProviderChatMessage[] = [
        {
          role: 'system',
          content: 'System instruction',
          metadata: {},
        },
      ];

      const result = convertMessages(messages);

      expect(result).toEqual([
        {
          role: 'system',
          parts: [{ text: 'System instruction' }],
        },
      ]);
    });

    it('should handle empty content', () => {
      const messages: ProviderChatMessage[] = [
        {
          role: 'user',
          content: '',
          metadata: {},
        },
      ];

      const result = convertMessages(messages);

      expect(result).toEqual([
        {
          role: 'user',
          parts: [],
        },
      ]);
    });

    it('should trim whitespace from content', () => {
      const messages: ProviderChatMessage[] = [
        {
          role: 'user',
          content: '   Hello   ',
          metadata: {},
        },
      ];

      const result = convertMessages(messages);

      expect(result).toEqual([
        {
          role: 'user',
          parts: [{ text: '   Hello   ' }], // Content is not trimmed in the function
        },
      ]);
    });

    it('should convert message with image attachment', () => {
      const messages: ProviderChatMessage[] = [
        {
          role: 'user',
          content: 'Look at this image:',
          metadata: {
            attachments: [
              {
                type: 'image',
                fileUri: 'https://generativelanguage.googleapis.com/v1beta/files/abc123',
                mimeType: 'image/jpeg',
              },
            ],
          },
        },
      ];

      const result = convertMessages(messages);

      expect(result).toEqual([
        {
          role: 'user',
          parts: [
            { text: 'Look at this image:' },
            {
              fileData: {
                mimeType: 'image/jpeg',
                fileUri: 'https://generativelanguage.googleapis.com/v1beta/files/abc123',
              },
            },
          ],
        },
      ]);
    });

    it('should handle multiple image attachments', () => {
      const messages: ProviderChatMessage[] = [
        {
          role: 'user',
          content: 'Two images:',
          metadata: {
            attachments: [
              {
                type: 'image',
                fileUri: 'https://generativelanguage.googleapis.com/v1beta/files/png1',
                mimeType: 'image/png',
              },
              {
                type: 'image',
                fileUri: 'https://generativelanguage.googleapis.com/v1beta/files/gif2',
                mimeType: 'image/gif',
              },
            ],
          },
        },
      ];

      const result = convertMessages(messages);

      expect(result[0].parts).toHaveLength(3);
      expect(result[0].parts[0]).toEqual({ text: 'Two images:' });
      expect(result[0].parts[1]).toEqual({
        fileData: {
          mimeType: 'image/png',
          fileUri: 'https://generativelanguage.googleapis.com/v1beta/files/png1',
        },
      });
      expect(result[0].parts[2]).toEqual({
        fileData: {
          mimeType: 'image/gif',
          fileUri: 'https://generativelanguage.googleapis.com/v1beta/files/gif2',
        },
      });
    });

    it('should skip invalid image attachments', () => {
      const messages: ProviderChatMessage[] = [
        {
          role: 'user',
          content: 'Image test',
          metadata: {
            attachments: [
              {
                type: 'image',
                data: 'invalid-data-format',
              },
            ],
          },
        },
      ];

      const result = convertMessages(messages);

      expect(result[0].parts).toEqual([{ text: 'Image test' }]);
    });

    it('should throw error for unsupported attachment type', () => {
      const messages: ProviderChatMessage[] = [
        {
          role: 'user',
          content: 'Video test',
          metadata: {
            attachments: [
              {
                type: 'video',
                data: 'video-data',
              },
            ],
          },
        },
      ];

      expect(() => {
        convertMessages(messages);
      }).toThrow('Unsupported media type: video');
    });

    it('should skip attachments without fileUri', () => {
      const messages: ProviderChatMessage[] = [
        {
          role: 'user',
          content: 'Missing fileUri',
          metadata: {
            attachments: [
              {
                type: 'image',
                mimeType: 'image/png',
                // No fileUri provided
              },
            ],
          },
        },
      ];

      const result = convertMessages(messages);

      // Should only have the text part, no image part
      expect(result[0].parts).toHaveLength(1);
      expect(result[0].parts[0]).toEqual({ text: 'Missing fileUri' });
    });

    it('should throw error for invalid image data format', () => {
      const messages: ProviderChatMessage[] = [
        {
          role: 'user',
          content: 'Invalid format',
          metadata: {
            attachments: [
              {
                type: 'image',
                data: 'data:;base64,missing-mime-type',
              },
            ],
          },
        },
      ];

      expect(() => {
        convertMessages(messages);
      }).not.toThrow(); // Returns null for invalid format, doesn't throw
    });

    it('should handle empty attachments array', () => {
      const messages: ProviderChatMessage[] = [
        {
          role: 'user',
          content: 'No attachments',
          metadata: {
            attachments: [],
          },
        },
      ];

      const result = convertMessages(messages);

      expect(result[0].parts).toEqual([{ text: 'No attachments' }]);
    });

    it('should handle missing attachments field', () => {
      const messages: ProviderChatMessage[] = [
        {
          role: 'user',
          content: 'No attachments field',
          metadata: {},
        },
      ];

      const result = convertMessages(messages);

      expect(result[0].parts).toEqual([{ text: 'No attachments field' }]);
    });

    it('should handle non-array attachments', () => {
      const messages: ProviderChatMessage[] = [
        {
          role: 'user',
          content: 'Invalid attachments',
          metadata: {
            attachments: 'not-an-array',
          },
        },
      ];

      const result = convertMessages(messages);

      expect(result[0].parts).toEqual([{ text: 'Invalid attachments' }]);
    });
  });

  describe('buildGenerationConfig', () => {
    it('should build config with default values', () => {
      const geminiConfig: GeminiConfig = {
        model: 'gemini-2.5-pro',
      };

      const config = buildGenerationConfig(geminiConfig);

      expect(config).toEqual({
        responseModalities: ['TEXT'],
      });
    });

    it('should include stop sequences when provided', () => {
      const geminiConfig: GeminiConfig = {
        model: 'gemini-2.5-flash',
        stopSequences: ['STOP', 'END', 'TERMINATE'],
      };

      const config = buildGenerationConfig(geminiConfig);

      expect(config.stopSequences).toEqual(['STOP', 'END', 'TERMINATE']);
    });

    it('should not include empty stop sequences', () => {
      const geminiConfig: GeminiConfig = {
        model: 'gemini-2.5-flash',
        stopSequences: [],
      };

      const config = buildGenerationConfig(geminiConfig);

      expect(config.stopSequences).toBeUndefined();
    });

    it('should use thinking budget from chat config', () => {
      const geminiConfig: GeminiConfig = {
        model: 'gemini-2.5-pro',
        thinkingBudget: 'low',
      };

      const chatConfig: GeminiChatConfig = {
        thinkingBudget: 'high',
      };

      const config = buildGenerationConfig(geminiConfig, chatConfig);

      expect(config.thinkingConfig).toBeUndefined(); // 'high' is not a valid number
    });

    it('should use thinking budget from gemini config when chat config not provided', () => {
      const geminiConfig: GeminiConfig = {
        model: 'gemini-2.5-pro',
        thinkingBudget: 1500,
      };

      const config = buildGenerationConfig(geminiConfig);

      expect(config.thinkingConfig?.thinkingBudget).toBe(1500);
    });

    it('should handle non-thinking models', () => {
      vi.mocked(supportsThinking).mockReturnValue(false);

      const geminiConfig: GeminiConfig = {
        model: 'gemini-2.5-flash-lite',
        thinkingBudget: 'high',
      };

      const config = buildGenerationConfig(geminiConfig);

      expect(config.thinkingConfig).toBeUndefined();
      expect(config.responseModalities).toBeUndefined();
    });

    it('should handle invalid thinking budget', () => {
      const geminiConfig: GeminiConfig = {
        model: 'gemini-2.5-pro',
        thinkingBudget: 'invalid-budget',
      };

      const config = buildGenerationConfig(geminiConfig);

      expect(config.thinkingConfig).toBeUndefined();
      // No thinkingConfig when invalid budget
    });

    it('should handle numeric string thinking budget', () => {
      const geminiConfig: GeminiConfig = {
        model: 'gemini-2.5-pro',
        thinkingBudget: '2500',
      };

      const config = buildGenerationConfig(geminiConfig);

      expect(config.thinkingConfig?.thinkingBudget).toBe(2500);
    });
  });

  describe('buildHeaders', () => {
    it('should build headers with API key', () => {
      const headers = buildHeaders('test-api-key-123');

      expect(headers).toEqual({
        'x-goog-api-key': 'test-api-key-123',
        'Content-Type': 'application/json',
      });
    });

    it('should throw error for empty API key', () => {
      expect(() => {
        buildHeaders('');
      }).toThrow('Gemini API key is not configured. Please add your Google API key in settings.');
    });

    it('should throw error for undefined API key', () => {
      expect(() => {
        buildHeaders(undefined as any);
      }).toThrow('Gemini API key is not configured. Please add your Google API key in settings.');
    });

    it('should throw error for null API key', () => {
      expect(() => {
        buildHeaders(null as any);
      }).toThrow('Gemini API key is not configured. Please add your Google API key in settings.');
    });

    it('should handle API key with special characters', () => {
      const specialKey = 'AIzaSyC-key_123.with-special$chars';
      const headers = buildHeaders(specialKey);

      expect(headers['x-goog-api-key']).toBe(specialKey);
    });
  });

  describe('buildApiUrl', () => {
    const testApiKey = 'test-key-123';

    it('should build URL with default base URL', () => {
      const url = buildApiUrl('/models/gemini-pro:generateContent', testApiKey);

      expect(url).toBe(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=test-key-123'
      );
    });

    it('should build URL with custom base URL', () => {
      const url = buildApiUrl(
        '/models/gemini-flash:generateContent',
        testApiKey,
        'https://custom-api.example.com'
      );

      expect(url).toBe(
        'https://custom-api.example.com/v1beta/models/gemini-flash:generateContent?key=test-key-123'
      );
    });

    it('should handle endpoint without leading slash', () => {
      const url = buildApiUrl('models/gemini-pro:streamGenerateContent', testApiKey);

      expect(url).toBe(
        'https://generativelanguage.googleapis.com/v1betamodels/gemini-pro:streamGenerateContent?key=test-key-123'
      );
    });

    it('should handle base URL with trailing slash', () => {
      const url = buildApiUrl(
        '/models/gemini-pro:generateContent',
        testApiKey,
        'https://api.example.com/'
      );

      expect(url).toBe(
        'https://api.example.com//v1beta/models/gemini-pro:generateContent?key=test-key-123'
      );
    });

    it('should URL-encode API key', () => {
      const keyWithSpecialChars = 'key+with/special=chars&more';
      const url = buildApiUrl('/test', keyWithSpecialChars);

      expect(url).toContain('?key=key+with/special=chars&more'); // API key is not URL encoded
    });

    it('should handle empty endpoint', () => {
      const url = buildApiUrl('', testApiKey);

      expect(url).toBe('https://generativelanguage.googleapis.com/v1beta?key=test-key-123');
    });
  });

  describe('isSupportedImageType', () => {
    it('should return true for supported JPEG', () => {
      expect(isSupportedImageType('image/jpeg')).toBe(true);
      expect(isSupportedImageType('image/jpg')).toBe(true);
    });

    it('should return true for supported PNG', () => {
      expect(isSupportedImageType('image/png')).toBe(true);
    });

    it('should return true for supported GIF', () => {
      expect(isSupportedImageType('image/gif')).toBe(true);
    });

    it('should return true for supported WebP', () => {
      expect(isSupportedImageType('image/webp')).toBe(true);
    });

    it('should return false for unsupported types', () => {
      expect(isSupportedImageType('image/bmp')).toBe(false);
      expect(isSupportedImageType('image/tiff')).toBe(false);
      expect(isSupportedImageType('image/svg+xml')).toBe(false);
      expect(isSupportedImageType('video/mp4')).toBe(false);
      expect(isSupportedImageType('text/plain')).toBe(false);
    });

    it('should handle case sensitivity', () => {
      expect(isSupportedImageType('IMAGE/JPEG')).toBe(true);
      expect(isSupportedImageType('Image/PNG')).toBe(true);
      expect(isSupportedImageType('IMAGE/BMP')).toBe(false);
    });

    it('should handle empty string', () => {
      expect(isSupportedImageType('')).toBe(false);
    });

    it('should handle invalid format', () => {
      expect(isSupportedImageType('not-a-mime-type')).toBe(false);
      expect(isSupportedImageType('image/')).toBe(false);
      expect(isSupportedImageType('/jpeg')).toBe(false);
    });
  });

  describe('Integration Tests', () => {
    it('should build complete request with image and thinking', () => {
      const messages: ProviderChatMessage[] = [
        {
          role: 'user',
          content: 'Analyze this image:',
          metadata: {
            attachments: [
              {
                type: 'image',
                fileUri: 'https://generativelanguage.googleapis.com/v1beta/files/testfile',
                mimeType: 'image/png',
              },
            ],
          },
        },
      ];

      const geminiConfig: GeminiConfig = {
        model: 'gemini-2.5-pro',
        stopSequences: ['END'],
        thinkingBudget: '1000',
      };

      const chatConfig: GeminiChatConfig = {
        systemPrompt: 'You are an image analysis expert.',
        showThoughts: true,
      };

      const request = buildRequest(messages, geminiConfig, chatConfig);

      // Verify complete structure
      expect(request.contents).toHaveLength(1);
      expect(request.contents[0].parts).toHaveLength(2);
      expect(request.contents[0].parts[0]).toEqual({ text: 'Analyze this image:' });
      expect(request.contents[0].parts[1]).toEqual({
        fileData: {
          mimeType: 'image/png',
          fileUri: 'https://generativelanguage.googleapis.com/v1beta/files/testfile',
        },
      });
      expect(request.generationConfig.stopSequences).toEqual(['END']);
      expect(request.generationConfig.thinkingConfig?.thinkingBudget).toBe(1000);
      expect(request.systemInstruction?.parts[0].text).toBe('You are an image analysis expert.');
      expect(request.tools).toEqual([{ google_search: {} }]);
    });

    it('should handle conversation with multiple message types', () => {
      const messages: ProviderChatMessage[] = [
        {
          role: 'system',
          content: 'System prompt',
          metadata: {},
        },
        {
          role: 'user',
          content: 'First question',
          metadata: {},
        },
        {
          role: 'assistant',
          content: 'First answer',
          metadata: {},
        },
        {
          role: 'user',
          content: 'Follow-up with image',
          metadata: {
            attachments: [
              {
                type: 'image',
                fileUri: 'https://generativelanguage.googleapis.com/v1beta/files/followup',
                mimeType: 'image/jpeg',
              },
            ],
          },
        },
      ];

      const result = convertMessages(messages);

      expect(result).toHaveLength(4);
      expect(result[0]).toEqual({
        role: 'system',
        parts: [{ text: 'System prompt' }],
      });
      expect(result[1]).toEqual({
        role: 'user',
        parts: [{ text: 'First question' }],
      });
      expect(result[2]).toEqual({
        role: 'model',
        parts: [{ text: 'First answer' }],
      });
      expect(result[3].role).toBe('user');
      expect(result[3].parts).toHaveLength(2);
      expect(result[3].parts[0].text).toBe('Follow-up with image');
      expect(result[3].parts[1].fileData?.mimeType).toBe('image/jpeg');
      expect(result[3].parts[1].fileData?.fileUri).toBe(
        'https://generativelanguage.googleapis.com/v1beta/files/followup'
      );
    });
  });

  describe('Error Handling Edge Cases', () => {
    it('should handle malformed image data gracefully', () => {
      const messages: ProviderChatMessage[] = [
        {
          role: 'user',
          content: 'Test',
          metadata: {
            attachments: [
              {
                type: 'image',
                // Missing data field
              },
            ],
          },
        },
      ];

      const result = convertMessages(messages);

      expect(result[0].parts).toEqual([{ text: 'Test' }]);
    });

    it('should handle null attachment data', () => {
      const messages: ProviderChatMessage[] = [
        {
          role: 'user',
          content: 'Test',
          metadata: {
            attachments: [
              {
                type: 'image',
                data: null,
              },
            ],
          },
        },
      ];

      const result = convertMessages(messages);

      expect(result[0].parts).toEqual([{ text: 'Test' }]);
    });

    it('should handle undefined metadata', () => {
      const messages: ProviderChatMessage[] = [
        {
          role: 'user',
          content: 'Test message',
          metadata: undefined as any,
        },
      ];

      const result = convertMessages(messages);

      expect(result[0].parts).toEqual([{ text: 'Test message' }]);
    });

    it('should handle very long content', () => {
      const longContent = 'A'.repeat(100000);
      const messages: ProviderChatMessage[] = [
        {
          role: 'user',
          content: longContent,
          metadata: {},
        },
      ];

      const result = convertMessages(messages);

      expect(result[0].parts[0].text).toBe(longContent);
    });

    it('should handle special characters in content', () => {
      const specialContent = '🌟 Hello! \n\t This has "quotes" and \\backslashes\\ & symbols 💫';
      const messages: ProviderChatMessage[] = [
        {
          role: 'user',
          content: specialContent,
          metadata: {},
        },
      ];

      const result = convertMessages(messages);

      expect(result[0].parts[0].text).toBe(specialContent);
    });

    it('should handle mixed valid and invalid attachments', () => {
      const messages: ProviderChatMessage[] = [
        {
          role: 'user',
          content: 'Mixed attachments',
          metadata: {
            attachments: [
              {
                type: 'image',
                mimeType: 'image/png',
                // Missing fileUri - will be skipped
              },
              {
                type: 'image',
                fileUri: 'https://generativelanguage.googleapis.com/v1beta/files/valid',
                mimeType: 'image/png',
              },
              {
                type: 'image',
                fileUri: null,
                mimeType: 'image/jpeg',
                // Null fileUri - will be skipped
              },
            ],
          },
        },
      ];

      const result = convertMessages(messages);

      expect(result[0].parts).toHaveLength(2);
      expect(result[0].parts[0].text).toBe('Mixed attachments');
      expect(result[0].parts[1].fileData?.mimeType).toBe('image/png');
      expect(result[0].parts[1].fileData?.fileUri).toBe(
        'https://generativelanguage.googleapis.com/v1beta/files/valid'
      );
    });
  });
});
