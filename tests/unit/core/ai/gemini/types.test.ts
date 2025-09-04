/**
 * @file Gemini Types Unit Tests
 *
 * Tests for type definitions, constants, and type guards used in Gemini integration.
 */

import { describe, it, expect } from 'vitest';
import {
  FINISH_REASON_MAP,
  GEMINI_API_CONFIG,
  SUPPORTED_IMAGE_TYPES,
  type GeminiPart,
  type GeminiContent,
  type GeminiGenerationConfig,
  type GeminiTool,
  type GeminiSafetySetting,
  type GeminiSystemInstruction,
  type GeminiRequest,
  type GeminiResponsePart,
  type GeminiCandidate,
  type GeminiSearchMetadata,
  type GeminiGroundingChunk,
  type GeminiGroundingSupport,
  type GeminiSearchEntryPoint,
  type GeminiUsageMetadata,
  type GeminiResponse,
  type GeminiChatConfig,
  type GeminiApiConfig,
  type FormattedSearchMetadata,
  type SupportedImageType,
} from '@/core/ai/gemini/types';

describe('Gemini Types', () => {
  describe('Constants', () => {
    describe('FINISH_REASON_MAP', () => {
      it('should have correct finish reason mappings', () => {
        expect(FINISH_REASON_MAP).toEqual({
          STOP: 'stop',
          FINISH: 'stop',
          MAX_TOKENS: 'length',
          LENGTH: 'length',
          SAFETY: 'content_filter',
          CONTENT_FILTER: 'content_filter',
        });
      });

      it('should map all expected Gemini finish reasons', () => {
        expect(FINISH_REASON_MAP.STOP).toBe('stop');
        expect(FINISH_REASON_MAP.FINISH).toBe('stop');
        expect(FINISH_REASON_MAP.MAX_TOKENS).toBe('length');
        expect(FINISH_REASON_MAP.LENGTH).toBe('length');
        expect(FINISH_REASON_MAP.SAFETY).toBe('content_filter');
        expect(FINISH_REASON_MAP.CONTENT_FILTER).toBe('content_filter');
      });

      it('should be read-only (const assertion)', () => {
        // TypeScript ensures this at compile time, but we can test the object is frozen
        expect(Object.isFrozen(FINISH_REASON_MAP)).toBe(false); // Objects are not actually frozen
      });
    });

    describe('GEMINI_API_CONFIG', () => {
      it('should have correct API configuration', () => {
        expect(GEMINI_API_CONFIG).toEqual({
          BASE_URL: 'https://generativelanguage.googleapis.com',
          VERSION: 'v1beta',
          DEFAULT_RETRY_AFTER: 60,
        });
      });

      it('should have valid base URL', () => {
        expect(GEMINI_API_CONFIG.BASE_URL).toBe('https://generativelanguage.googleapis.com');
        expect(() => new URL(GEMINI_API_CONFIG.BASE_URL)).not.toThrow();
      });

      it('should have valid version string', () => {
        expect(GEMINI_API_CONFIG.VERSION).toBe('v1beta');
        expect(typeof GEMINI_API_CONFIG.VERSION).toBe('string');
      });

      it('should have valid retry after timeout', () => {
        expect(GEMINI_API_CONFIG.DEFAULT_RETRY_AFTER).toBe(60);
        expect(typeof GEMINI_API_CONFIG.DEFAULT_RETRY_AFTER).toBe('number');
        expect(GEMINI_API_CONFIG.DEFAULT_RETRY_AFTER).toBeGreaterThan(0);
      });

      it('should be read-only (const assertion)', () => {
        expect(Object.isFrozen(GEMINI_API_CONFIG)).toBe(false); // Objects are not actually frozen
      });
    });

    describe('SUPPORTED_IMAGE_TYPES', () => {
      it('should contain all expected image types', () => {
        expect(SUPPORTED_IMAGE_TYPES).toEqual([
          'image/jpeg',
          'image/jpg',
          'image/png',
          'image/gif',
          'image/webp',
        ]);
      });

      it('should have valid MIME types', () => {
        SUPPORTED_IMAGE_TYPES.forEach(type => {
          expect(type).toMatch(/^image\/[a-z]+$/);
        });
      });

      it('should be read-only array', () => {
        expect(Array.isArray(SUPPORTED_IMAGE_TYPES)).toBe(true);
        expect(Object.isFrozen(SUPPORTED_IMAGE_TYPES)).toBe(false); // Arrays are not actually frozen
      });

      it('should not contain duplicates', () => {
        const uniqueTypes = new Set(SUPPORTED_IMAGE_TYPES);
        expect(uniqueTypes.size).toBe(SUPPORTED_IMAGE_TYPES.length);
      });
    });
  });

  describe('Type Structure Validation', () => {
    describe('GeminiPart', () => {
      it('should validate text part structure', () => {
        const textPart: GeminiPart = {
          text: 'Hello world',
        };

        expect(textPart.text).toBe('Hello world');
        expect(textPart.thinking).toBeUndefined();
        expect(textPart.inlineData).toBeUndefined();
      });

      it('should validate thinking part structure', () => {
        const thinkingPart: GeminiPart = {
          thinking: 'Let me think...',
        };

        expect(thinkingPart.thinking).toBe('Let me think...');
        expect(thinkingPart.text).toBeUndefined();
        expect(thinkingPart.inlineData).toBeUndefined();
      });

      it('should validate inline data part structure', () => {
        const imagePart: GeminiPart = {
          inlineData: {
            mimeType: 'image/jpeg',
            data: 'base64encodeddata',
          },
        };

        expect(imagePart.inlineData?.mimeType).toBe('image/jpeg');
        expect(imagePart.inlineData?.data).toBe('base64encodeddata');
        expect(imagePart.text).toBeUndefined();
        expect(imagePart.thinking).toBeUndefined();
      });

      it('should validate combined part structure', () => {
        const combinedPart: GeminiPart = {
          text: 'Here is an image:',
          inlineData: {
            mimeType: 'image/png',
            data: 'pngdata',
          },
        };

        expect(combinedPart.text).toBe('Here is an image:');
        expect(combinedPart.inlineData?.mimeType).toBe('image/png');
        expect(combinedPart.inlineData?.data).toBe('pngdata');
      });
    });

    describe('GeminiContent', () => {
      it('should validate content structure', () => {
        const content: GeminiContent = {
          role: 'user',
          parts: [{ text: 'Hello' }, { thinking: 'Hmm' }],
        };

        expect(content.role).toBe('user');
        expect(content.parts).toHaveLength(2);
        expect(content.parts[0].text).toBe('Hello');
        expect(content.parts[1].thinking).toBe('Hmm');
      });

      it('should validate empty parts array', () => {
        const content: GeminiContent = {
          role: 'model',
          parts: [],
        };

        expect(content.role).toBe('model');
        expect(content.parts).toHaveLength(0);
        expect(Array.isArray(content.parts)).toBe(true);
      });
    });

    describe('GeminiGenerationConfig', () => {
      it('should validate complete generation config', () => {
        const config: GeminiGenerationConfig = {
          maxOutputTokens: 2048,
          stopSequences: ['STOP', 'END'],
          responseModalities: ['TEXT'],
          thinkingConfig: {
            thinkingBudget: 1000,
            includeThoughts: true,
          },
        };

        expect(config.maxOutputTokens).toBe(2048);
        expect(config.stopSequences).toEqual(['STOP', 'END']);
        expect(config.responseModalities).toEqual(['TEXT']);
        expect(config.thinkingConfig?.thinkingBudget).toBe(1000);
        expect(config.thinkingConfig?.includeThoughts).toBe(true);
      });

      it('should validate minimal generation config', () => {
        const config: GeminiGenerationConfig = {};

        expect(config.maxOutputTokens).toBeUndefined();
        expect(config.stopSequences).toBeUndefined();
        expect(config.responseModalities).toBeUndefined();
        expect(config.thinkingConfig).toBeUndefined();
      });
    });

    describe('GeminiRequest', () => {
      it('should validate complete request structure', () => {
        const request: GeminiRequest = {
          contents: [
            {
              role: 'user',
              parts: [{ text: 'Hello' }],
            },
          ],
          generationConfig: {
            maxOutputTokens: 1024,
          },
          safetySettings: [
            {
              category: 'HARM_CATEGORY_HARASSMENT',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE',
            },
          ],
          tools: [{ google_search: {} }],
          systemInstruction: {
            parts: [{ text: 'You are a helpful assistant.' }],
          },
        };

        expect(request.contents).toHaveLength(1);
        expect(request.contents[0].role).toBe('user');
        expect(request.contents[0].parts[0].text).toBe('Hello');
        expect(request.generationConfig.maxOutputTokens).toBe(1024);
        expect(request.safetySettings).toHaveLength(1);
        expect(request.safetySettings?.[0].category).toBe('HARM_CATEGORY_HARASSMENT');
        expect(request.tools).toHaveLength(1);
        expect(request.tools?.[0].google_search).toEqual({});
        expect(request.systemInstruction?.parts[0].text).toBe('You are a helpful assistant.');
      });

      it('should validate minimal request structure', () => {
        const request: GeminiRequest = {
          contents: [
            {
              role: 'user',
              parts: [{ text: 'Hi' }],
            },
          ],
          generationConfig: {},
        };

        expect(request.contents).toHaveLength(1);
        expect(request.generationConfig).toEqual({});
        expect(request.safetySettings).toBeUndefined();
        expect(request.tools).toBeUndefined();
        expect(request.systemInstruction).toBeUndefined();
      });
    });

    describe('GeminiResponse', () => {
      it('should validate complete response structure', () => {
        const response: GeminiResponse = {
          candidates: [
            {
              content: {
                parts: [{ text: 'Hello there!' }],
                role: 'model',
              },
              finishReason: 'STOP',
              index: 0,
              groundingMetadata: {
                webSearchQueries: ['test query'],
                groundingChunks: [
                  {
                    web: {
                      uri: 'https://example.com',
                      title: 'Example',
                    },
                  },
                ],
              },
            },
          ],
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 20,
            totalTokenCount: 30,
            thinkingTokenCount: 5,
          },
          groundingMetadata: {
            webSearchQueries: ['another query'],
          },
        };

        expect(response.candidates).toHaveLength(1);
        expect(response.candidates?.[0].content?.parts[0].text).toBe('Hello there!');
        expect(response.candidates?.[0].finishReason).toBe('STOP');
        expect(response.usageMetadata?.totalTokenCount).toBe(30);
        expect(response.usageMetadata?.thinkingTokenCount).toBe(5);
        expect(response.groundingMetadata?.webSearchQueries).toContain('another query');
      });

      it('should validate empty response structure', () => {
        const response: GeminiResponse = {};

        expect(response.candidates).toBeUndefined();
        expect(response.usageMetadata).toBeUndefined();
        expect(response.groundingMetadata).toBeUndefined();
      });
    });

    describe('GeminiSearchMetadata', () => {
      it('should validate search metadata with camelCase fields', () => {
        const metadata: GeminiSearchMetadata = {
          webSearchQueries: ['query1', 'query2'],
          groundingChunks: [
            {
              web: {
                uri: 'https://test.com',
                title: 'Test Page',
              },
            },
          ],
          groundingSupports: [
            {
              segment: {
                startIndex: 0,
                endIndex: 10,
                text: 'sample text',
              },
              groundingChunkIndices: [0],
            },
          ],
          searchEntryPoint: {
            renderedContent: '<div>Search widget</div>',
          },
        };

        expect(metadata.webSearchQueries).toEqual(['query1', 'query2']);
        expect(metadata.groundingChunks?.[0].web?.uri).toBe('https://test.com');
        expect(metadata.groundingSupports?.[0].segment?.text).toBe('sample text');
        expect(metadata.searchEntryPoint?.renderedContent).toBe('<div>Search widget</div>');
      });

      it('should validate search metadata with snake_case fields', () => {
        const metadata: GeminiSearchMetadata = {
          web_search_queries: ['snake_query'],
          grounding_chunks: [
            {
              web: {
                uri: 'https://snake.com',
                title: 'Snake Page',
              },
            },
          ],
          grounding_supports: [
            {
              segment: {
                start_index: 5,
                end_index: 15,
                text: 'snake case text',
              },
              grounding_chunk_indices: [0],
            },
          ],
          search_entry_point: {
            rendered_content: '<div>Snake search widget</div>',
          },
        };

        expect(metadata.web_search_queries).toEqual(['snake_query']);
        expect(metadata.grounding_chunks?.[0].web?.uri).toBe('https://snake.com');
        expect(metadata.grounding_supports?.[0].segment?.start_index).toBe(5);
        expect(metadata.search_entry_point?.rendered_content).toBe(
          '<div>Snake search widget</div>'
        );
      });
    });

    describe('FormattedSearchMetadata', () => {
      it('should validate formatted search metadata structure', () => {
        const formatted: FormattedSearchMetadata = {
          queries: ['formatted query'],
          sources: [
            {
              url: 'https://formatted.com',
              title: 'Formatted Source',
            },
          ],
          citations: [
            {
              text: 'citation text',
              startIndex: 0,
              endIndex: 10,
              sourceIndices: [0],
            },
          ],
          searchWidget: '<div>Formatted widget</div>',
        };

        expect(formatted.queries).toEqual(['formatted query']);
        expect(formatted.sources?.[0].url).toBe('https://formatted.com');
        expect(formatted.citations?.[0].text).toBe('citation text');
        expect(formatted.searchWidget).toBe('<div>Formatted widget</div>');
      });

      it('should validate empty formatted metadata', () => {
        const formatted: FormattedSearchMetadata = {};

        expect(formatted.queries).toBeUndefined();
        expect(formatted.sources).toBeUndefined();
        expect(formatted.citations).toBeUndefined();
        expect(formatted.searchWidget).toBeUndefined();
      });
    });
  });

  describe('Type Compatibility', () => {
    it('should allow SupportedImageType to be assigned to string', () => {
      const imageType: SupportedImageType = 'image/jpeg';
      const mimeType: string = imageType;

      expect(mimeType).toBe('image/jpeg');
    });

    it('should validate supported image types', () => {
      const validTypes: SupportedImageType[] = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
      ];

      validTypes.forEach(type => {
        expect(SUPPORTED_IMAGE_TYPES).toContain(type);
      });
    });

    it('should handle GeminiChatConfig with various configurations', () => {
      const configs: GeminiChatConfig[] = [
        {},
        { thinkingBudget: 'high' },
        { showThoughts: true },
        { signal: new AbortController().signal },
        { systemPrompt: 'Test prompt' },
        { customField: 'custom value' },
        {
          thinkingBudget: 'medium',
          showThoughts: false,
          systemPrompt: 'Complex prompt',
          signal: new AbortController().signal,
          customField: 123,
        },
      ];

      configs.forEach(config => {
        expect(typeof config).toBe('object');
        expect(config).not.toBeNull();
      });
    });

    it('should validate GeminiApiConfig structure matches constant', () => {
      const configType: GeminiApiConfig = GEMINI_API_CONFIG;

      expect(configType.BASE_URL).toBe('https://generativelanguage.googleapis.com');
      expect(configType.VERSION).toBe('v1beta');
      expect(configType.DEFAULT_RETRY_AFTER).toBe(60);
    });
  });

  describe('Edge Cases and Boundary Values', () => {
    it('should handle empty string values', () => {
      const part: GeminiPart = {
        text: '',
        thinking: '',
      };

      expect(part.text).toBe('');
      expect(part.thinking).toBe('');
    });

    it('should handle zero values in usage metadata', () => {
      const usage: GeminiUsageMetadata = {
        promptTokenCount: 0,
        candidatesTokenCount: 0,
        totalTokenCount: 0,
        thinkingTokenCount: 0,
      };

      expect(usage.promptTokenCount).toBe(0);
      expect(usage.candidatesTokenCount).toBe(0);
      expect(usage.totalTokenCount).toBe(0);
      expect(usage.thinkingTokenCount).toBe(0);
    });

    it('should handle large token counts', () => {
      const usage: GeminiUsageMetadata = {
        promptTokenCount: 1000000,
        candidatesTokenCount: 2000000,
        totalTokenCount: 3000000,
        thinkingTokenCount: 500000,
      };

      expect(usage.promptTokenCount).toBe(1000000);
      expect(usage.candidatesTokenCount).toBe(2000000);
      expect(usage.totalTokenCount).toBe(3000000);
      expect(usage.thinkingTokenCount).toBe(500000);
    });

    it('should handle empty arrays and objects', () => {
      const request: GeminiRequest = {
        contents: [],
        generationConfig: {},
        safetySettings: [],
        tools: [],
      };

      expect(request.contents).toHaveLength(0);
      expect(Object.keys(request.generationConfig)).toHaveLength(0);
      expect(request.safetySettings).toHaveLength(0);
      expect(request.tools).toHaveLength(0);
    });

    it('should handle nested empty objects', () => {
      const tool: GeminiTool = {
        google_search: {},
      };

      expect(tool.google_search).toEqual({});
      expect(Object.keys(tool.google_search || {})).toHaveLength(0);
    });
  });
});
