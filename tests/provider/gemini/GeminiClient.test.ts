/**
 * @file Gemini Client Tests
 *
 * Test-first implementation for the GeminiClient class.
 * Tests client initialization, configuration validation, authentication,
 * and basic setup required for chat generation with thinking modes.
 *
 * This is the RED phase of TDD - comprehensive tests written before implementation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GeminiClient } from '../../../src/provider/gemini/GeminiClient';
import type {
  ProviderConfig,
  GeminiConfig,
  ProviderValidationResult,
  ProviderError,
  ModelConfig,
  ProviderChatMessage,
} from '../../../src/types/providers';

describe('GeminiClient', () => {
  let client: GeminiClient;
  let validConfig: ProviderConfig;
  let validGeminiConfig: GeminiConfig;
  let mockMessages: ProviderChatMessage[];

  beforeEach(() => {
    client = new GeminiClient();

    validGeminiConfig = {
      apiKey: 'test-gemini-api-key-12345',
      temperature: 0.7,
      thinkingMode: 'dynamic',
      showThoughts: true,
      model: 'gemini-2.5-flash-lite',
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
        content: 'Hello, Gemini!',
        timestamp: new Date(),
      },
    ];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor and Properties', () => {
    it('should initialize with correct provider type and capabilities', () => {
      expect(client.type).toBe('gemini');
      expect(client.name).toBe('Google Gemini');
      expect(client.capabilities).toEqual({
        streaming: true,
        temperature: true,
        reasoning: false,
        thinking: true,
        multimodal: true,
        functionCalling: true,
        maxContextLength: 2000000, // Max context length across all Gemini models
        supportedModels: ['gemini-2.5-flash-lite'],
      });
    });

    it('should start unconfigured', () => {
      expect(client.isConfigured()).toBe(false);
      expect(client.getConfig()).toBeNull();
    });

    it('should have required methods from BaseProvider', () => {
      expect(typeof client.initialize).toBe('function');
      expect(typeof client.validateConfig).toBe('function');
      expect(typeof client.testConnection).toBe('function');
      expect(typeof client.chat).toBe('function');
      expect(typeof client.streamChat).toBe('function');
      expect(typeof client.getModels).toBe('function');
      expect(typeof client.getModel).toBe('function');
      expect(typeof client.estimateTokens).toBe('function');
      expect(typeof client.formatError).toBe('function');
    });
  });

  describe('Configuration Validation', () => {
    it('should validate valid configuration', () => {
      const result = client.validateConfig(validGeminiConfig);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject missing API key', () => {
      const invalidConfig = { ...validGeminiConfig, apiKey: '' };
      const result = client.validateConfig(invalidConfig);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid API key');
    });

    it('should reject non-string API key', () => {
      const invalidConfig = { ...validGeminiConfig, apiKey: 123 as any };
      const result = client.validateConfig(invalidConfig);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid API key');
    });

    it('should reject invalid temperature values', () => {
      const testCases = [
        { temperature: -0.1, desc: 'below minimum' },
        { temperature: 2.1, desc: 'above maximum' },
        { temperature: 'not-a-number' as any, desc: 'non-numeric' },
        { temperature: NaN, desc: 'NaN' },
      ];

      testCases.forEach(({ temperature, desc }) => {
        const invalidConfig = { ...validGeminiConfig, temperature };
        const result = client.validateConfig(invalidConfig);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Invalid temperature');
      });
    });

    it('should accept valid temperature range (0.0 to 2.0)', () => {
      const validTemperatures = [0.0, 0.5, 1.0, 1.5, 2.0];

      validTemperatures.forEach(temperature => {
        const config = { ...validGeminiConfig, temperature };
        const result = client.validateConfig(config);
        expect(result.isValid).toBe(true);
      });
    });

    it('should reject invalid thinking modes', () => {
      const invalidModes = ['on', 'static', 'auto', '', null, undefined];

      invalidModes.forEach(thinkingMode => {
        const invalidConfig = { ...validGeminiConfig, thinkingMode: thinkingMode as any };
        const result = client.validateConfig(invalidConfig);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Invalid thinking mode');
      });
    });

    it('should accept valid thinking modes', () => {
      const validModes = ['off', 'dynamic'];

      validModes.forEach(thinkingMode => {
        const config = { ...validGeminiConfig, thinkingMode: thinkingMode as any };
        const result = client.validateConfig(config);
        expect(result.isValid).toBe(true);
      });
    });

    it('should reject invalid showThoughts value', () => {
      const invalidValues = ['true', 'false', 1, 0, null, undefined];

      invalidValues.forEach(showThoughts => {
        const invalidConfig = { ...validGeminiConfig, showThoughts: showThoughts as any };
        const result = client.validateConfig(invalidConfig);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Invalid show thoughts setting');
      });
    });

    it('should reject missing or invalid model', () => {
      const invalidModels = ['', null, undefined, 123];

      invalidModels.forEach(model => {
        const invalidConfig = { ...validGeminiConfig, model: model as any };
        const result = client.validateConfig(invalidConfig);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Invalid model');
      });
    });

    it('should reject invalid maxTokens values', () => {
      const invalidValues = [0, -1, 'not-a-number', null, undefined];

      invalidValues.forEach(maxTokens => {
        const invalidConfig = { ...validGeminiConfig, maxTokens: maxTokens as any };
        const result = client.validateConfig(invalidConfig);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Invalid max tokens');
      });
    });

    it('should reject invalid topP values', () => {
      const invalidValues = [0, -0.1, 1.1, 'not-a-number', null, undefined];

      invalidValues.forEach(topP => {
        const invalidConfig = { ...validGeminiConfig, topP: topP as any };
        const result = client.validateConfig(invalidConfig);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Invalid top P');
      });
    });

    it('should accept valid topP range (0 < topP <= 1)', () => {
      const validValues = [0.1, 0.5, 0.8, 1.0];

      validValues.forEach(topP => {
        const config = { ...validGeminiConfig, topP };
        const result = client.validateConfig(config);
        expect(result.isValid).toBe(true);
      });
    });

    it('should reject invalid topK values', () => {
      const invalidValues = [0, -1, 'not-a-number', null, undefined];

      invalidValues.forEach(topK => {
        const invalidConfig = { ...validGeminiConfig, topK: topK as any };
        const result = client.validateConfig(invalidConfig);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Invalid top K');
      });
    });

    it('should validate optional safety settings format', () => {
      // Valid safety settings should pass
      const validSafetyConfig = {
        ...validGeminiConfig,
        safetySettings: [
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_LOW_AND_ABOVE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ],
      };

      let result = client.validateConfig(validSafetyConfig);
      expect(result.isValid).toBe(true);

      // Missing safety settings should pass (optional)
      const noSafetyConfig = { ...validGeminiConfig };
      delete noSafetyConfig.safetySettings;

      result = client.validateConfig(noSafetyConfig);
      expect(result.isValid).toBe(true);

      // Invalid safety settings format should fail
      const invalidSafetyConfig = {
        ...validGeminiConfig,
        safetySettings: 'invalid' as any,
      };

      result = client.validateConfig(invalidSafetyConfig);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid safety settings format');
    });

    it('should validate optional stop sequences format', () => {
      // Valid stop sequences should pass
      const validStopConfig = {
        ...validGeminiConfig,
        stopSequences: ['END', 'STOP', 'FINISH'],
      };

      let result = client.validateConfig(validStopConfig);
      expect(result.isValid).toBe(true);

      // Missing stop sequences should pass (optional)
      const noStopConfig = { ...validGeminiConfig };
      delete noStopConfig.stopSequences;

      result = client.validateConfig(noStopConfig);
      expect(result.isValid).toBe(true);

      // Invalid stop sequences format should fail
      const invalidStopConfig = {
        ...validGeminiConfig,
        stopSequences: 'invalid' as any,
      };

      result = client.validateConfig(invalidStopConfig);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid stop sequences format');
    });

    it('should accumulate multiple validation errors', () => {
      const invalidConfig = {
        apiKey: '',
        temperature: 3.0,
        thinkingMode: 'invalid' as any,
        showThoughts: 'not-boolean' as any,
        model: '',
        maxTokens: -1,
        topP: 1.5,
        topK: 0,
      };

      const result = client.validateConfig(invalidConfig);
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(8);
      expect(result.errors).toContain('Invalid API key');
      expect(result.errors).toContain('Invalid temperature');
      expect(result.errors).toContain('Invalid thinking mode');
      expect(result.errors).toContain('Invalid show thoughts setting');
      expect(result.errors).toContain('Invalid model');
      expect(result.errors).toContain('Invalid max tokens');
      expect(result.errors).toContain('Invalid top P');
      expect(result.errors).toContain('Invalid top K');
    });
  });

  describe('Initialization', () => {
    it('should initialize successfully with valid configuration', async () => {
      await expect(client.initialize(validConfig)).resolves.not.toThrow();
      expect(client.isConfigured()).toBe(true);
      expect(client.getConfig()).toEqual(validConfig);
    });

    it('should reject initialization with invalid configuration', async () => {
      const invalidConfig = {
        type: 'gemini' as const,
        config: { ...validGeminiConfig, apiKey: '' },
      };

      await expect(client.initialize(invalidConfig)).rejects.toThrow(
        'Configuration validation failed'
      );
      expect(client.isConfigured()).toBe(false);
    });

    it('should reject initialization with wrong provider type', async () => {
      const wrongTypeConfig = {
        type: 'openai' as const,
        config: validGeminiConfig,
      };

      await expect(client.initialize(wrongTypeConfig)).rejects.toThrow(
        'Invalid provider type for Gemini client'
      );
      expect(client.isConfigured()).toBe(false);
    });

    it('should setup API client configuration after successful initialization', async () => {
      await client.initialize(validConfig);

      // Verify internal API client is configured (private members)
      expect(client.isConfigured()).toBe(true);
      const storedConfig = client.getConfig();
      expect(storedConfig?.config).toEqual(validGeminiConfig);
    });

    it('should reset previous configuration on re-initialization', async () => {
      // First initialization
      await client.initialize(validConfig);
      expect(client.isConfigured()).toBe(true);

      // Second initialization with different config
      const newConfig = {
        ...validConfig,
        config: {
          ...validGeminiConfig,
          temperature: 0.5,
          model: 'gemini-2.5-flash-lite',
        },
      };

      await client.initialize(newConfig);
      expect(client.isConfigured()).toBe(true);

      const storedConfig = client.getConfig();
      expect(storedConfig?.config.temperature).toBe(0.5);
      expect(storedConfig?.config.model).toBe('gemini-2.5-flash-lite');
    });
  });

  describe('Authentication', () => {
    beforeEach(async () => {
      await client.initialize(validConfig);
    });

    it('should test connection successfully with valid API key', async () => {
      // Mock successful API response
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ models: [] }),
      });

      const result = await client.testConnection();
      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('generativelanguage.googleapis.com'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-goog-api-key': 'test-gemini-api-key-12345',
          }),
        })
      );
    });

    it('should fail connection test with invalid API key', async () => {
      // Mock 401 authentication error
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({
          error: {
            code: 401,
            message: 'API key not valid. Please pass a valid API key.',
            status: 'UNAUTHENTICATED',
          },
        }),
      });

      const result = await client.testConnection();
      expect(result).toBe(false);
    });

    it('should fail connection test with network error', async () => {
      // Mock network failure
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await client.testConnection();
      expect(result).toBe(false);
    });

    it('should fail connection test with rate limit error', async () => {
      // Mock 429 rate limit error
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: async () => ({
          error: {
            code: 429,
            message: 'Quota exceeded for requests per minute per project.',
            status: 'RESOURCE_EXHAUSTED',
          },
        }),
      });

      const result = await client.testConnection();
      expect(result).toBe(false);
    });

    it('should use correct authentication headers in requests', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ models: [] }),
      });

      await client.testConnection();

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-goog-api-key': 'test-gemini-api-key-12345',
            'Content-Type': 'application/json',
          }),
        })
      );
    });
  });

  describe('Model Management', () => {
    beforeEach(async () => {
      await client.initialize(validConfig);
    });

    it('should return supported models list', () => {
      const models = client.getModels();
      expect(models).toHaveLength(1);

      const modelIds = models.map(m => m.id);
      expect(modelIds).toContain('gemini-2.5-flash-lite');

      // Check model structure
      const geminiFlashLite = models.find(m => m.id === 'gemini-2.5-flash-lite');
      expect(geminiFlashLite).toEqual({
        id: 'gemini-2.5-flash-lite',
        name: 'Gemini 2.5 Flash Lite',
        provider: 'gemini',
        maxTokens: 65536, // Updated from model card
        contextLength: 1048576, // Updated from model card
        costPer1kTokens: {
          input: 0.00005,
          output: 0.0001,
        },
        capabilities: {
          streaming: true,
          temperature: true,
          reasoning: false,
          thinking: true,
          multimodal: false,
          functionCalling: true,
        },
        parameters: {
          temperature: { min: 0.0, max: 2.0, default: 1.0 },
          topP: { min: 0.1, max: 1.0, default: 0.95 },
          thinkingMode: ['off', 'dynamic'],
        },
      });
    });

    it('should find specific model by ID', () => {
      const model = client.getModel('gemini-2.5-flash-lite');
      expect(model).toBeDefined();
      expect(model?.name).toBe('Gemini 2.5 Flash Lite');
      expect(model?.provider).toBe('gemini');
    });

    it('should return undefined for non-existent model', () => {
      const model = client.getModel('non-existent-model');
      expect(model).toBeUndefined();
    });

    it('should include thinking capabilities in model configs', () => {
      const models = client.getModels();

      models.forEach(model => {
        expect(model.capabilities.thinking).toBe(true);
        expect(model.parameters.thinkingMode).toEqual(['off', 'dynamic']);
      });
    });

    it('should have multimodal support for vision models', () => {
      const visionModel = client.getModel('gemini-2.5-flash-lite');
      expect(visionModel?.capabilities.multimodal).toBe(true);
    });
  });

  describe('Token Estimation', () => {
    beforeEach(async () => {
      await client.initialize(validConfig);
    });

    it('should estimate tokens for text input', () => {
      const text = 'This is a test message for token estimation';
      const tokens = client.estimateTokens(text);
      expect(typeof tokens).toBe('number');
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(text.length); // Should be more efficient than 1 char = 1 token
    });

    it('should handle empty text', () => {
      const tokens = client.estimateTokens('');
      expect(tokens).toBe(0);
    });

    it('should handle unicode text', () => {
      const unicodeText = '你好世界🌍こんにちは';
      const tokens = client.estimateTokens(unicodeText);
      expect(typeof tokens).toBe('number');
      expect(tokens).toBeGreaterThan(0);
    });

    it('should scale reasonably with text length', () => {
      const shortText = 'Hello world';
      const longText = shortText.repeat(10);

      const shortTokens = client.estimateTokens(shortText);
      const longTokens = client.estimateTokens(longText);

      expect(longTokens).toBeGreaterThan(shortTokens);
      expect(longTokens).toBeLessThanOrEqual(shortTokens * 10 * 1.5); // Allow for some overhead
    });
  });

  describe('Error Formatting', () => {
    it('should format generic errors correctly', () => {
      const genericError = new Error('Something went wrong');
      const formatted = client.formatError(genericError);

      expect(formatted).toEqual({
        type: 'unknown',
        message: 'Something went wrong',
        code: 'GEMINI_ERROR',
        provider: 'gemini',
        details: expect.objectContaining({
          timestamp: expect.any(Date),
        }),
      });
    });

    it('should format authentication errors', () => {
      const authError = {
        status: 401,
        message: 'Invalid API key',
        code: 'UNAUTHENTICATED',
      };

      const formatted = client.formatError(authError);
      expect(formatted.type).toBe('authentication');
      expect(formatted.message).toBe('Invalid API key');
      expect(formatted.code).toBe('GEMINI_AUTH_ERROR');
    });

    it('should format rate limit errors', () => {
      const rateLimitError = {
        status: 429,
        message: 'Quota exceeded',
        code: 'RESOURCE_EXHAUSTED',
      };

      const formatted = client.formatError(rateLimitError);
      expect(formatted.type).toBe('rate_limit');
      expect(formatted.message).toBe('Quota exceeded');
      expect(formatted.code).toBe('GEMINI_RATE_LIMIT');
      expect(formatted.retryAfter).toBeDefined();
    });

    it('should format network errors', () => {
      const networkError = { message: 'Network connection failed' };
      const formatted = client.formatError(networkError);

      expect(formatted.type).toBe('network');
      expect(formatted.message).toBe('Network connection failed');
      expect(formatted.code).toBe('GEMINI_NETWORK_ERROR');
    });

    it('should handle unknown error structures', () => {
      const unknownError = { someProperty: 'value' };
      const formatted = client.formatError(unknownError);

      expect(formatted.type).toBe('unknown');
      expect(formatted.message).toBe('An unexpected error occurred');
      expect(formatted.code).toBe('GEMINI_ERROR');
    });

    it('should include error details when available', () => {
      const detailedError = {
        status: 400,
        message: 'Invalid request',
        code: 'INVALID_ARGUMENT',
        details: {
          field: 'temperature',
          value: 'invalid',
        },
      };

      const formatted = client.formatError(detailedError);
      expect(formatted.details).toMatchObject({
        statusCode: 400,
        field: 'temperature',
        value: 'invalid',
        timestamp: expect.any(Date),
      });
    });
  });

  describe('Configuration Management', () => {
    it('should reset configuration properly', async () => {
      await client.initialize(validConfig);
      expect(client.isConfigured()).toBe(true);

      client.reset();
      expect(client.isConfigured()).toBe(false);
      expect(client.getConfig()).toBeNull();
    });

    it('should maintain rate limiting history through reset', async () => {
      await client.initialize(validConfig);

      // Mock a request to create history
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ models: [] }),
      });
      await client.testConnection();

      const historyBeforeReset = client.getRequestHistory();
      expect(historyBeforeReset).toHaveLength(1);

      client.reset();
      const historyAfterReset = client.getRequestHistory();
      expect(historyAfterReset).toHaveLength(0);
    });
  });

  describe('Future Chat Preparation', () => {
    beforeEach(async () => {
      await client.initialize(validConfig);
    });

    it('should be ready for chat implementation in next task', () => {
      // Verify the client has all necessary setup for chat methods
      expect(client.isConfigured()).toBe(true);
      expect(typeof client.chat).toBe('function');
      expect(typeof client.streamChat).toBe('function');
    });

    it('should support thinking mode configuration for future chat', () => {
      const config = client.getConfig()?.config as GeminiConfig;
      expect(config.thinkingMode).toBe('dynamic');
      expect(config.showThoughts).toBe(true);
    });

    it('should have proper model selection for thinking capabilities', () => {
      const models = client.getModels();
      const allModelsSupportThinking = models.every(model => model.capabilities.thinking === true);
      expect(allModelsSupportThinking).toBe(true);
    });
  });

  describe('Edge Cases and Error Conditions', () => {
    it('should handle null or undefined configuration gracefully', () => {
      expect(() => client.validateConfig(null as any)).not.toThrow();
      expect(() => client.validateConfig(undefined as any)).not.toThrow();

      const result = client.validateConfig(null as any);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should require initialization before operations', async () => {
      // Client starts unconfigured
      expect(client.isConfigured()).toBe(false);

      // Operations that require configuration should fail appropriately
      expect(() => client.getConfig()).not.toThrow(); // Returns null
      expect(client.getConfig()).toBeNull();
    });

    it('should handle concurrent initialization attempts', async () => {
      const initPromise1 = client.initialize(validConfig);
      const initPromise2 = client.initialize(validConfig);

      await Promise.all([initPromise1, initPromise2]);
      expect(client.isConfigured()).toBe(true);
    });
  });
});
