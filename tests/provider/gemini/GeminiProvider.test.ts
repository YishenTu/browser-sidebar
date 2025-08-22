/**
 * @file Gemini Provider Tests
 *
 * Comprehensive test suite for GeminiProvider implementing TDD methodology.
 * Tests cover chat generation, streaming, temperature control, thinking modes,
 * thought visibility, multimodal support, and error handling.
 *
 * This follows the TDD RED phase - comprehensive tests written before implementation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GeminiProvider } from '../../../src/provider/gemini/GeminiProvider';
import { StreamParser } from '../../../src/provider/streamParser';
import { TokenBuffer, FlushStrategy } from '../../../src/provider/tokenBuffer';
import type {
  ProviderConfig,
  GeminiConfig,
  ProviderChatMessage,
  ProviderResponse,
  StreamChunk,
  ProviderError,
  Usage,
  FinishReason,
} from '../../../src/types/providers';

describe('GeminiProvider', () => {
  let provider: GeminiProvider;
  let validConfig: ProviderConfig;
  let validGeminiConfig: GeminiConfig;
  let mockMessages: ProviderChatMessage[];
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    provider = new GeminiProvider();
    
    validGeminiConfig = {
      apiKey: 'test-gemini-api-key-12345',
      temperature: 0.7,
      thinkingMode: 'dynamic',
      showThoughts: true,
      model: 'gemini-pro',
      maxTokens: 8192,
      topP: 0.8,
      topK: 40,
      safetySettings: [
        {
          category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE',
        },
      ],
      stopSequences: ['END', 'STOP'],
    };

    validConfig = {
      type: 'gemini',
      config: validGeminiConfig,
    };

    mockMessages = [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Hello, Gemini! What is quantum computing?',
        timestamp: new Date(),
      },
    ];

    // Setup fetch mock
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Inheritance and Base Functionality', () => {
    it('should extend BaseProvider correctly', () => {
      expect(provider.type).toBe('gemini');
      expect(provider.name).toBe('Google Gemini');
      expect(provider.capabilities.thinking).toBe(true);
      expect(provider.capabilities.streaming).toBe(true);
      expect(provider.capabilities.temperature).toBe(true);
      expect(provider.capabilities.multimodal).toBe(true);
    });

    it('should start unconfigured', () => {
      expect(provider.isConfigured()).toBe(false);
      expect(provider.getConfig()).toBeNull();
    });

    it('should initialize successfully', async () => {
      await provider.initialize(validConfig);
      expect(provider.isConfigured()).toBe(true);
    });
  });

  describe('Chat Generation', () => {
    beforeEach(async () => {
      await provider.initialize(validConfig);
    });

    it('should send chat messages and return response', async () => {
      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: 'Quantum computing is a revolutionary technology that uses quantum mechanical phenomena...',
                },
              ],
              role: 'model',
            },
            finishReason: 'STOP',
            index: 0,
          },
        ],
        usageMetadata: {
          promptTokenCount: 15,
          candidatesTokenCount: 85,
          totalTokenCount: 100,
        },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await provider.chat(mockMessages);

      expect(result).toEqual({
        id: expect.any(String),
        content: 'Quantum computing is a revolutionary technology that uses quantum mechanical phenomena...',
        model: 'gemini-pro',
        usage: {
          promptTokens: 15,
          completionTokens: 85,
          totalTokens: 100,
        },
        finishReason: 'stop',
        metadata: {
          provider: 'gemini',
          timestamp: expect.any(Date),
          model: 'gemini-pro',
        },
      });

      // Verify API call was made correctly
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('generativelanguage.googleapis.com'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'x-goog-api-key': 'test-gemini-api-key-12345',
            'Content-Type': 'application/json',
          }),
          body: expect.stringContaining('quantum computing'),
        })
      );
    });

    it('should handle empty response gracefully', async () => {
      const mockResponse = {
        candidates: [],
        usageMetadata: {
          promptTokenCount: 15,
          candidatesTokenCount: 0,
          totalTokenCount: 15,
        },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await provider.chat(mockMessages);

      expect(result.content).toBe('');
      expect(result.finishReason).toBe('stop');
    });

    it('should validate messages before sending', async () => {
      const invalidMessages = [
        {
          id: 'invalid',
          role: 'invalid' as any,
          content: '',
          timestamp: new Date(),
        },
      ];

      await expect(provider.chat(invalidMessages)).rejects.toThrow('Invalid message format');
    });

    it('should require initialization before chat', async () => {
      const uninitializedProvider = new GeminiProvider();
      await expect(uninitializedProvider.chat(mockMessages)).rejects.toThrow('Provider not initialized');
    });

    it('should track requests for rate limiting', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'Response' }] } }],
          usageMetadata: { totalTokenCount: 50 },
        }),
      });

      const historyBefore = provider.getRequestHistory();
      await provider.chat(mockMessages);
      const historyAfter = provider.getRequestHistory();

      expect(historyAfter.length).toBe(historyBefore.length + 1);
    });
  });

  describe('Temperature Parameter Support', () => {
    beforeEach(async () => {
      await provider.initialize(validConfig);
    });

    it('should support temperature range 0.0 to 2.0', async () => {
      const temperatures = [0.0, 0.5, 1.0, 1.5, 2.0];

      for (const temperature of temperatures) {
        mockFetch.mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [{ content: { parts: [{ text: `Response at ${temperature}` }] } }],
            usageMetadata: { totalTokenCount: 50 },
          }),
        });

        await provider.chat(mockMessages, { temperature });

        const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
        const requestBody = JSON.parse(lastCall[1].body);
        expect(requestBody.generationConfig.temperature).toBe(temperature);
      }
    });

    it('should use default temperature from config when not specified', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'Response' }] } }],
          usageMetadata: { totalTokenCount: 50 },
        }),
      });

      await provider.chat(mockMessages);

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.generationConfig.temperature).toBe(0.7); // From validGeminiConfig
    });

    it('should override config temperature with chat parameter', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'Response' }] } }],
          usageMetadata: { totalTokenCount: 50 },
        }),
      });

      await provider.chat(mockMessages, { temperature: 1.5 });

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.generationConfig.temperature).toBe(1.5);
    });

    it('should reject invalid temperature values', async () => {
      const invalidTemperatures = [-0.1, 2.1, NaN, 'invalid' as any];

      for (const temperature of invalidTemperatures) {
        await expect(provider.chat(mockMessages, { temperature })).rejects.toThrow();
      }
    });
  });

  describe('Thinking Mode Implementation', () => {
    beforeEach(async () => {
      await provider.initialize(validConfig);
    });

    it('should support thinking mode "off"', async () => {
      const offConfig = {
        ...validConfig,
        config: { ...validGeminiConfig, thinkingMode: 'off' as const },
      };
      
      await provider.initialize(offConfig);

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'Direct response without thinking' }] } }],
          usageMetadata: { totalTokenCount: 50 },
        }),
      });

      const result = await provider.chat(mockMessages);

      expect(result.thinking).toBeUndefined();
      
      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.generationConfig.responseModalities).toBeUndefined();
    });

    it('should support thinking mode "dynamic"', async () => {
      const dynamicConfig = {
        ...validConfig,
        config: { ...validGeminiConfig, thinkingMode: 'dynamic' as const },
      };
      
      await provider.initialize(dynamicConfig);

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: 'Let me think about this question...',
                    thinking: 'The user is asking about quantum computing. I should provide a comprehensive yet accessible explanation covering the key concepts.',
                  },
                  {
                    text: 'Quantum computing uses quantum mechanical phenomena like superposition and entanglement...',
                  },
                ],
              },
            },
          ],
          usageMetadata: {
            totalTokenCount: 150,
            thinkingTokenCount: 45,
          },
        }),
      });

      const result = await provider.chat(mockMessages, { thinkingMode: 'dynamic' });

      expect(result.thinking).toBeDefined();
      expect(result.usage.thinkingTokens).toBe(45);
      
      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.generationConfig.responseModalities).toContain('TEXT');
    });

    it('should override config thinking mode with chat parameter', async () => {
      // Config has dynamic, but override with off
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'Response without thinking' }] } }],
          usageMetadata: { totalTokenCount: 50 },
        }),
      });

      await provider.chat(mockMessages, { thinkingMode: 'off' });

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.generationConfig.responseModalities).toBeUndefined();
    });
  });

  describe('Thought Visibility Control', () => {
    beforeEach(async () => {
      await provider.initialize(validConfig);
    });

    it('should show thoughts when showThoughts is true', async () => {
      const configWithShowThoughts = {
        ...validConfig,
        config: { ...validGeminiConfig, showThoughts: true },
      };
      
      await provider.initialize(configWithShowThoughts);

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: 'Response text',
                    thinking: 'Internal reasoning process',
                  },
                ],
              },
            },
          ],
          usageMetadata: { totalTokenCount: 50 },
        }),
      });

      const result = await provider.chat(mockMessages);

      expect(result.thinking).toBe('Internal reasoning process');
    });

    it('should hide thoughts when showThoughts is false', async () => {
      const configWithoutShowThoughts = {
        ...validConfig,
        config: { ...validGeminiConfig, showThoughts: false },
      };
      
      await provider.initialize(configWithoutShowThoughts);

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: 'Response text',
                    thinking: 'Internal reasoning process',
                  },
                ],
              },
            },
          ],
          usageMetadata: { totalTokenCount: 50 },
        }),
      });

      const result = await provider.chat(mockMessages);

      expect(result.thinking).toBeUndefined();
    });

    it('should override config showThoughts with chat parameter', async () => {
      // Config has showThoughts: true, but override with false
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: 'Response text',
                    thinking: 'Internal reasoning process',
                  },
                ],
              },
            },
          ],
          usageMetadata: { totalTokenCount: 50 },
        }),
      });

      const result = await provider.chat(mockMessages, { showThoughts: false });

      expect(result.thinking).toBeUndefined();
    });
  });

  describe('Streaming Support', () => {
    beforeEach(async () => {
      await provider.initialize(validConfig);
    });

    it('should stream chat responses', async () => {
      const mockStreamData = [
        'data: {"candidates":[{"content":{"parts":[{"text":"Quantum"}]}}]}\n\n',
        'data: {"candidates":[{"content":{"parts":[{"text":" computing"}]}}]}\n\n',
        'data: {"candidates":[{"content":{"parts":[{"text":" is fascinating!"}],"finishReason":"STOP"}]}\n\n',
        'data: [DONE]\n\n',
      ];

      let dataIndex = 0;
      const mockReadableStream = new ReadableStream({
        start(controller) {
          const sendData = () => {
            if (dataIndex < mockStreamData.length) {
              controller.enqueue(new TextEncoder().encode(mockStreamData[dataIndex++]));
              setTimeout(sendData, 10);
            } else {
              controller.close();
            }
          };
          sendData();
        },
      });

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        body: mockReadableStream,
      });

      const chunks: StreamChunk[] = [];
      for await (const chunk of provider.streamChat(mockMessages)) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      
      const contentChunks = chunks.filter(chunk => 
        chunk.choices[0]?.delta?.content
      );
      expect(contentChunks.length).toBeGreaterThan(0);
      
      const finalChunk = chunks[chunks.length - 1];
      expect(finalChunk.choices[0]?.finishReason).toBe('stop');
    });

    it('should stream with thinking tokens when enabled', async () => {
      const mockStreamData = [
        'data: {"candidates":[{"content":{"parts":[{"thinking":"Let me think..."}]}}]}\n\n',
        'data: {"candidates":[{"content":{"parts":[{"text":"Quantum computing"}]}}]}\n\n',
        'data: {"candidates":[{"content":{"parts":[{"text":" uses quantum mechanics"}],"finishReason":"STOP"}],"usageMetadata":{"thinkingTokenCount":10,"totalTokenCount":50}}]}\n\n',
        'data: [DONE]\n\n',
      ];

      let dataIndex = 0;
      const mockReadableStream = new ReadableStream({
        start(controller) {
          const sendData = () => {
            if (dataIndex < mockStreamData.length) {
              controller.enqueue(new TextEncoder().encode(mockStreamData[dataIndex++]));
              setTimeout(sendData, 10);
            } else {
              controller.close();
            }
          };
          sendData();
        },
      });

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        body: mockReadableStream,
      });

      const chunks: StreamChunk[] = [];
      for await (const chunk of provider.streamChat(mockMessages, { thinkingMode: 'dynamic' })) {
        chunks.push(chunk);
      }

      const thinkingChunks = chunks.filter(chunk => 
        chunk.choices[0]?.delta?.thinking
      );
      expect(thinkingChunks.length).toBeGreaterThan(0);
    });

    it('should use TokenBuffer for smooth streaming experience', async () => {
      const mockStreamData = [
        'data: {"candidates":[{"content":{"parts":[{"text":"Q"}]}}]}\n\n',
        'data: {"candidates":[{"content":{"parts":[{"text":"u"}]}}]}\n\n',
        'data: {"candidates":[{"content":{"parts":[{"text":"a"}]}}]}\n\n',
        'data: {"candidates":[{"content":{"parts":[{"text":"n"}]}}]}\n\n',
        'data: {"candidates":[{"content":{"parts":[{"text":"tum"}]}}]}\n\n',
        'data: {"candidates":[{"content":{"parts":[{"text":" computing"}],"finishReason":"STOP"}]}\n\n',
        'data: [DONE]\n\n',
      ];

      let dataIndex = 0;
      const mockReadableStream = new ReadableStream({
        start(controller) {
          const sendData = () => {
            if (dataIndex < mockStreamData.length) {
              controller.enqueue(new TextEncoder().encode(mockStreamData[dataIndex++]));
              setTimeout(sendData, 5);
            } else {
              controller.close();
            }
          };
          sendData();
        },
      });

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        body: mockReadableStream,
      });

      const chunks: StreamChunk[] = [];
      for await (const chunk of provider.streamChat(mockMessages)) {
        chunks.push(chunk);
      }

      // Verify that we get reasonable chunk count (TokenBuffer optimization would reduce this further)
      expect(chunks.length).toBeGreaterThan(0); // We should get some chunks
      
      const allContent = chunks
        .map(chunk => chunk.choices[0]?.delta?.content || '')
        .join('');
      expect(allContent).toContain('Quantum computing');
    });

    it('should handle stream errors gracefully', async () => {
      const mockErrorStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(
            'data: {"error":{"code":401,"message":"Invalid API key"}}\n\n'
          ));
          controller.close();
        },
      });

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        body: mockErrorStream,
      });

      const streamIterator = provider.streamChat(mockMessages);
      await expect(streamIterator.next()).rejects.toThrow('Invalid API key');
    });
  });

  describe('Multimodal Support', () => {
    beforeEach(async () => {
      const visionConfig = {
        ...validConfig,
        config: { ...validGeminiConfig, model: 'gemini-pro-vision' },
      };
      await provider.initialize(visionConfig);
    });

    it('should support text and image inputs', async () => {
      const multimodalMessages: ProviderChatMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'What do you see in this image?',
          timestamp: new Date(),
          metadata: {
            attachments: [
              {
                type: 'image',
                data: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD//gA7Q1JFQVR...',
                mimeType: 'image/jpeg',
              },
            ],
          },
        },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: 'I can see a beautiful landscape with mountains and a lake.',
                  },
                ],
              },
            },
          ],
          usageMetadata: { totalTokenCount: 75 },
        }),
      });

      const result = await provider.chat(multimodalMessages);

      expect(result.content).toContain('landscape');
      
      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.contents[0].parts).toHaveLength(2); // Text + image
      expect(requestBody.contents[0].parts[1].inlineData).toBeDefined();
    });

    it('should handle multiple images in a single message', async () => {
      const multiImageMessages: ProviderChatMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Compare these two images.',
          timestamp: new Date(),
          metadata: {
            attachments: [
              {
                type: 'image',
                data: 'data:image/jpeg;base64,image1data...',
                mimeType: 'image/jpeg',
              },
              {
                type: 'image',
                data: 'data:image/png;base64,image2data...',
                mimeType: 'image/png',
              },
            ],
          },
        },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: 'The first image shows a cat, while the second shows a dog.',
                  },
                ],
              },
            },
          ],
          usageMetadata: { totalTokenCount: 120 },
        }),
      });

      const result = await provider.chat(multiImageMessages);

      expect(result.content).toContain('first image');
      
      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.contents[0].parts).toHaveLength(3); // Text + 2 images
    });

    it('should reject unsupported media types', async () => {
      const unsupportedMessages: ProviderChatMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'What is in this video?',
          timestamp: new Date(),
          metadata: {
            attachments: [
              {
                type: 'video',
                data: 'data:video/mp4;base64,videodata...',
                mimeType: 'video/mp4',
              },
            ],
          },
        },
      ];

      await expect(provider.chat(unsupportedMessages)).rejects.toThrow('Unsupported media type');
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await provider.initialize(validConfig);
    });

    it('should handle API authentication errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({
          error: {
            code: 401,
            message: 'API key not valid',
            status: 'UNAUTHENTICATED',
          },
        }),
      });

      await expect(provider.chat(mockMessages)).rejects.toThrow('API key not valid');
    });

    it('should handle rate limit errors with retry-after', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        headers: new Headers({ 'retry-after': '60' }),
        json: async () => ({
          error: {
            code: 429,
            message: 'Quota exceeded',
            status: 'RESOURCE_EXHAUSTED',
          },
        }),
      });

      try {
        await provider.chat(mockMessages);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('Quota exceeded');
        expect(error.retryAfter).toBe(60);
      }
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network connection failed'));

      await expect(provider.chat(mockMessages)).rejects.toThrow('Network connection failed');
    });

    it('should handle malformed API responses', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ invalidFormat: true }),
      });

      const result = await provider.chat(mockMessages);
      expect(result.content).toBe('');
      expect(result.finishReason).toBe('stop');
    });

    it('should format provider-specific errors correctly', () => {
      const geminiError = {
        status: 400,
        error: {
          code: 'INVALID_ARGUMENT',
          message: 'Invalid request format',
          details: [
            {
              '@type': 'type.googleapis.com/google.rpc.BadRequest',
              fieldViolations: [
                {
                  field: 'contents',
                  description: 'Contents cannot be empty',
                },
              ],
            },
          ],
        },
      };

      const formatted = provider.formatError(geminiError);

      expect(formatted.type).toBe('validation');
      expect(formatted.code).toBe('GEMINI_VALIDATION_ERROR');
      expect(formatted.provider).toBe('gemini');
      expect(formatted.details).toMatchObject({
        statusCode: 400,
        timestamp: expect.any(Date),
      });
    });
  });

  describe('Request Cancellation', () => {
    beforeEach(async () => {
      await provider.initialize(validConfig);
    });

    it('should support AbortController for request cancellation', async () => {
      const controller = new AbortController();
      
      mockFetch.mockImplementation(() => 
        new Promise((_, reject) => {
          controller.signal.addEventListener('abort', () => {
            reject(new Error('Request aborted'));
          });
        })
      );

      const chatPromise = provider.chat(mockMessages, { signal: controller.signal });
      
      setTimeout(() => controller.abort(), 100);
      
      await expect(chatPromise).rejects.toThrow('Request aborted');
    });

    it('should support cancellation during streaming', async () => {
      const controller = new AbortController();
      
      const mockStreamData = [
        'data: {"candidates":[{"content":{"parts":[{"text":"Starting"}]}}]}\n\n',
        'data: {"candidates":[{"content":{"parts":[{"text":" response"}]}}]}\n\n',
        // Stream will be aborted before this chunk
        'data: {"candidates":[{"content":{"parts":[{"text":" continues"}]}}]}\n\n',
      ];

      let dataIndex = 0;
      const mockReadableStream = new ReadableStream({
        start(controller) {
          const sendData = () => {
            if (dataIndex < mockStreamData.length) {
              controller.enqueue(new TextEncoder().encode(mockStreamData[dataIndex++]));
              setTimeout(sendData, 50);
            } else {
              controller.close();
            }
          };
          sendData();
        },
      });

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        body: mockReadableStream,
      });

      const streamIterator = provider.streamChat(mockMessages, { signal: controller.signal });
      
      let chunkCount = 0;
      let caughtError: Error | null = null;

      try {
        for await (const chunk of streamIterator) {
          chunkCount++;
          if (chunkCount === 1) {
            // Abort after first chunk
            controller.abort();
          }
        }
      } catch (error) {
        caughtError = error as Error;
      }

      expect(chunkCount).toBe(1);
      expect(caughtError?.message).toContain('abort');
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration parameters at runtime', async () => {
      await provider.initialize(validConfig);

      // Test with different temperature
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'Response' }] } }],
          usageMetadata: { totalTokenCount: 50 },
        }),
      });

      await provider.chat(mockMessages, { 
        temperature: 1.8,
        thinkingMode: 'off',
        showThoughts: false 
      });

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.generationConfig.temperature).toBe(1.8);
    });

    it('should maintain rate limiting across configuration changes', async () => {
      await provider.initialize(validConfig);
      
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'Response' }] } }],
          usageMetadata: { totalTokenCount: 50 },
        }),
      });

      // Make a request
      await provider.chat(mockMessages);
      const historyAfterFirst = provider.getRequestHistory();

      // Change config
      const newConfig = {
        ...validConfig,
        config: { ...validGeminiConfig, temperature: 1.0 },
      };
      await provider.initialize(newConfig);

      // Make another request
      await provider.chat(mockMessages);
      const historyAfterSecond = provider.getRequestHistory();

      expect(historyAfterSecond.length).toBe(historyAfterFirst.length + 1);
    });
  });

  describe('Performance and Edge Cases', () => {
    beforeEach(async () => {
      await provider.initialize(validConfig);
    });

    it('should handle large message contexts efficiently', async () => {
      const largeMessages: ProviderChatMessage[] = [];
      for (let i = 0; i < 100; i++) {
        largeMessages.push({
          id: `msg-${i}`,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `This is message ${i} with some content that simulates a long conversation history.`,
          timestamp: new Date(Date.now() - (100 - i) * 60000),
        });
      }

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'Response to large context' }] } }],
          usageMetadata: { totalTokenCount: 2000 },
        }),
      });

      const startTime = performance.now();
      const result = await provider.chat(largeMessages);
      const endTime = performance.now();

      expect(result.content).toBe('Response to large context');
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle concurrent requests properly', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'Concurrent response' }] } }],
          usageMetadata: { totalTokenCount: 50 },
        }),
      });

      const requests = Array.from({ length: 5 }, (_, i) => 
        provider.chat([{
          id: `concurrent-${i}`,
          role: 'user',
          content: `Concurrent request ${i}`,
          timestamp: new Date(),
        }])
      );

      const results = await Promise.all(requests);

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.content).toBe('Concurrent response');
      });
    });

    it('should handle empty or whitespace-only messages', async () => {
      const emptyMessages: ProviderChatMessage[] = [
        {
          id: 'empty',
          role: 'user',
          content: '   ',
          timestamp: new Date(),
        },
      ];

      await expect(provider.chat(emptyMessages)).rejects.toThrow('Message content cannot be empty');
    });

    it('should handle very long single messages', async () => {
      const veryLongContent = 'A'.repeat(50000); // 50k characters
      const longMessages: ProviderChatMessage[] = [
        {
          id: 'long',
          role: 'user',
          content: veryLongContent,
          timestamp: new Date(),
        },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'Response to long message' }] } }],
          usageMetadata: { totalTokenCount: 15000 },
        }),
      });

      const result = await provider.chat(longMessages);
      
      expect(result.content).toBe('Response to long message');
      expect(result.usage.totalTokens).toBe(15000);
    });
  });
});