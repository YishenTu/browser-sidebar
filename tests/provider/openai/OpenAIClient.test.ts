/**
 * @file OpenAI Client Tests
 *
 * Test-first implementation (TDD) for the OpenAI client setup.
 * Tests client initialization, configuration, authentication, and readiness for Response API.
 *
 * Following TDD methodology:
 * - RED: Write comprehensive tests first
 * - GREEN: Implement minimal code to pass tests
 * - REFACTOR: Optimize while maintaining test coverage
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenAIClient } from '../../../src/provider/openai/OpenAIClient';
import type { OpenAIConfig, ProviderValidationResult } from '../../../src/types/providers';

// Mock the OpenAI SDK
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation((config) => ({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    defaultHeaders: config.defaultHeaders,
    timeout: config.timeout,
    maxRetries: config.maxRetries,
    // Mock other properties we might need
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
    models: {
      list: vi.fn(),
    },
  })),
}));

describe('OpenAIClient', () => {
  let client: OpenAIClient;
  const validConfig: OpenAIConfig = {
    apiKey: 'sk-test-key-123',
    temperature: 0.7,
    reasoningEffort: 'medium',
    model: 'gpt-4o',
    maxTokens: 4000,
    topP: 1.0,
    frequencyPenalty: 0.0,
    presencePenalty: 0.0,
    seed: 42,
    user: 'test-user',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    client = new OpenAIClient();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('should create an OpenAIClient instance', () => {
      expect(client).toBeInstanceOf(OpenAIClient);
      expect(client.isInitialized()).toBe(false);
      expect(client.getOpenAIInstance()).toBeNull();
    });

    it('should not initialize OpenAI SDK in constructor', async () => {
      const { default: OpenAI } = await import('openai');
      const MockedOpenAI = vi.mocked(OpenAI);
      expect(MockedOpenAI).not.toHaveBeenCalled();
    });
  });

  describe('initialize()', () => {
    it('should initialize OpenAI client with valid API key', async () => {
      await client.initialize(validConfig);

      expect(client.isInitialized()).toBe(true);
      expect(client.getOpenAIInstance()).not.toBeNull();
    });

    it('should initialize OpenAI client with correct default configuration', async () => {
      await client.initialize(validConfig);

      const openaiInstance = client.getOpenAIInstance();
      expect(openaiInstance).not.toBeNull();
      expect(client.isInitialized()).toBe(true);
      
      // Verify configuration was stored
      const storedConfig = client.getConfiguration();
      expect(storedConfig?.apiKey).toBe('sk-test-key-123');
    });

    it('should initialize OpenAI client with custom configuration options', async () => {
      const customConfig = {
        ...validConfig,
        customOptions: {
          baseURL: 'https://api.custom-openai.com/v1',
          timeout: 30000,
          maxRetries: 5,
          headers: {
            'X-Custom-Header': 'custom-value',
          },
        },
      };

      await client.initialize(customConfig);

      const openaiInstance = client.getOpenAIInstance();
      expect(openaiInstance).not.toBeNull();
      expect(client.isInitialized()).toBe(true);
      
      // Verify configuration was stored with custom options
      const storedConfig = client.getConfiguration();
      expect(storedConfig?.customOptions?.baseURL).toBe('https://api.custom-openai.com/v1');
      expect(storedConfig?.customOptions?.timeout).toBe(30000);
      expect(storedConfig?.customOptions?.maxRetries).toBe(5);
      expect(storedConfig?.customOptions?.headers).toEqual({
        'X-Custom-Header': 'custom-value',
      });
    });

    it('should throw error when initializing with invalid API key', async () => {
      const invalidConfig = {
        ...validConfig,
        apiKey: '',
      };

      await expect(client.initialize(invalidConfig)).rejects.toThrow(
        'Configuration validation failed: API key is required and cannot be empty'
      );
      expect(client.isInitialized()).toBe(false);
    });

    it('should throw error when initializing with malformed API key', async () => {
      const invalidConfig = {
        ...validConfig,
        apiKey: 'invalid-key-format',
      };

      await expect(client.initialize(invalidConfig)).rejects.toThrow(
        'Configuration validation failed: API key must start with "sk-"'
      );
      expect(client.isInitialized()).toBe(false);
    });

    it('should allow reinitialization with different config', async () => {
      await client.initialize(validConfig);
      expect(client.isInitialized()).toBe(true);

      const newConfig = {
        ...validConfig,
        apiKey: 'sk-new-key-456',
      };

      await client.initialize(newConfig);
      expect(client.isInitialized()).toBe(true);
      
      // Verify the new configuration is stored
      const storedConfig = client.getConfiguration();
      expect(storedConfig?.apiKey).toBe('sk-new-key-456');
    });
  });

  describe('validateConfiguration()', () => {
    it('should validate correct configuration', () => {
      const result = client.validateConfiguration(validConfig);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate configuration with custom options', () => {
      const configWithCustomOptions = {
        ...validConfig,
        customOptions: {
          baseURL: 'https://custom.openai.com/v1',
          timeout: 45000,
          maxRetries: 2,
          headers: { 'X-Custom-Header': 'custom-value' },
        },
      };

      const result = client.validateConfiguration(configWithCustomOptions);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty API key', () => {
      const invalidConfig = {
        ...validConfig,
        apiKey: '',
      };

      const result = client.validateConfiguration(invalidConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('API key is required and cannot be empty');
    });

    it('should reject non-string API key', () => {
      const invalidConfig = {
        ...validConfig,
        apiKey: 123 as any, // Use a number instead of null
      };

      const result = client.validateConfiguration(invalidConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('API key must be a string');
    });

    it('should reject API key that does not start with "sk-"', () => {
      const invalidConfig = {
        ...validConfig,
        apiKey: 'invalid-key-123',
      };

      const result = client.validateConfiguration(invalidConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('API key must start with "sk-"');
    });

    it('should validate custom baseURL format', () => {
      const invalidConfig = {
        ...validConfig,
        customOptions: {
          baseURL: 'not-a-valid-url',
        },
      };

      const result = client.validateConfiguration(invalidConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Custom baseURL must be a valid URL');
    });

    it('should validate timeout range', () => {
      const invalidConfig = {
        ...validConfig,
        customOptions: {
          timeout: -1000,
        },
      };

      const result = client.validateConfiguration(invalidConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Timeout must be a positive number');
    });

    it('should validate maxRetries range', () => {
      const invalidConfig = {
        ...validConfig,
        customOptions: {
          maxRetries: -1,
        },
      };

      const result = client.validateConfiguration(invalidConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Max retries must be a non-negative number');
    });

    it('should validate headers format', () => {
      const invalidConfig = {
        ...validConfig,
        customOptions: {
          headers: 'invalid-headers' as any,
        },
      };

      const result = client.validateConfiguration(invalidConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Headers must be an object');
    });
  });

  describe('testConnection()', () => {
    it('should test connection successfully with valid configuration', async () => {
      const mockListModels = vi.fn().mockResolvedValue({
        data: [
          { id: 'gpt-4o', object: 'model' },
          { id: 'gpt-3.5-turbo', object: 'model' },
        ],
      });

      // Setup mock to return the mocked list function
      const { default: OpenAI } = await import('openai');
      const MockedOpenAI = vi.mocked(OpenAI);
      MockedOpenAI.mockImplementation((config) => ({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
        models: {
          list: mockListModels,
        },
      } as any));

      await client.initialize(validConfig);
      const result = await client.testConnection();

      expect(result).toBe(true);
      expect(mockListModels).toHaveBeenCalledOnce();
    });

    it('should fail connection test with invalid API key', async () => {
      const mockListModels = vi.fn().mockRejectedValue(
        new Error('Invalid API key')
      );

      const { default: OpenAI } = await import('openai');
      const MockedOpenAI = vi.mocked(OpenAI);
      MockedOpenAI.mockImplementation((config) => ({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
        models: {
          list: mockListModels,
        },
      } as any));

      await client.initialize(validConfig);
      const result = await client.testConnection();

      expect(result).toBe(false);
      expect(mockListModels).toHaveBeenCalledOnce();
    });

    it('should throw error when testing connection without initialization', async () => {
      await expect(client.testConnection()).rejects.toThrow(
        'OpenAI client is not initialized'
      );
    });

    it('should handle network errors gracefully', async () => {
      const mockListModels = vi.fn().mockRejectedValue(
        new Error('Network error')
      );

      const { default: OpenAI } = await import('openai');
      const MockedOpenAI = vi.mocked(OpenAI);
      MockedOpenAI.mockImplementation((config) => ({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
        models: {
          list: mockListModels,
        },
      } as any));

      await client.initialize(validConfig);
      const result = await client.testConnection();

      expect(result).toBe(false);
    });
  });

  describe('getConfiguration()', () => {
    it('should return null when not initialized', () => {
      const config = client.getConfiguration();
      expect(config).toBeNull();
    });

    it('should return current configuration after initialization', async () => {
      await client.initialize(validConfig);
      const config = client.getConfiguration();

      expect(config).toEqual(validConfig);
    });

    it('should return updated configuration after reinitialization', async () => {
      await client.initialize(validConfig);

      const newConfig = {
        ...validConfig,
        apiKey: 'sk-new-key-789',
        temperature: 0.9,
      };

      await client.initialize(newConfig);
      const config = client.getConfiguration();

      expect(config).toEqual(newConfig);
    });
  });

  describe('reset()', () => {
    it('should reset client to uninitialized state', async () => {
      await client.initialize(validConfig);
      expect(client.isInitialized()).toBe(true);

      client.reset();

      expect(client.isInitialized()).toBe(false);
      expect(client.getOpenAIInstance()).toBeNull();
      expect(client.getConfiguration()).toBeNull();
    });

    it('should allow reinitialization after reset', async () => {
      await client.initialize(validConfig);
      client.reset();

      await client.initialize(validConfig);
      expect(client.isInitialized()).toBe(true);
    });
  });

  describe('getOpenAIInstance()', () => {
    it('should return null when not initialized', () => {
      expect(client.getOpenAIInstance()).toBeNull();
    });

    it('should return OpenAI instance after initialization', async () => {
      await client.initialize(validConfig);
      const instance = client.getOpenAIInstance();

      expect(instance).not.toBeNull();
      // OpenAI instance structure is mocked - verify it exists
      expect(instance).toBeTruthy();
    });

    it('should return same instance on multiple calls', async () => {
      await client.initialize(validConfig);
      const instance1 = client.getOpenAIInstance();
      const instance2 = client.getOpenAIInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('Authentication Handling', () => {
    it('should handle API key authentication in headers', async () => {
      await client.initialize(validConfig);
      const instance = client.getOpenAIInstance();

      expect(instance).not.toBeNull();
      // Verify configuration contains the API key
      const storedConfig = client.getConfiguration();
      expect(storedConfig?.apiKey).toBe('sk-test-key-123');
    });

    it('should merge custom headers with authentication', async () => {
      const configWithHeaders = {
        ...validConfig,
        customOptions: {
          headers: {
            'X-Custom-Header': 'custom-value',
            'User-Agent': 'custom-agent',
          },
        },
      };

      await client.initialize(configWithHeaders);
      const instance = client.getOpenAIInstance();

      expect(instance).not.toBeNull();
      // Verify custom headers are stored in configuration
      const storedConfig = client.getConfiguration();
      expect(storedConfig?.customOptions?.headers).toEqual({
        'X-Custom-Header': 'custom-value',
        'User-Agent': 'custom-agent',
      });
    });

    it('should not allow overriding Authorization header in custom headers', () => {
      const configWithAuthHeader = {
        ...validConfig,
        customOptions: {
          headers: {
            'Authorization': 'Bearer malicious-key',
          },
        },
      };

      const result = client.validateConfiguration(configWithAuthHeader);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Cannot override Authorization header in custom headers'
      );
    });
  });

  describe('Configuration Persistence', () => {
    it('should maintain configuration after successful initialization', async () => {
      const config = { ...validConfig };
      await client.initialize(config);

      // Modify original config object
      config.temperature = 0.9;

      // Client should maintain its own copy
      const storedConfig = client.getConfiguration();
      expect(storedConfig?.temperature).toBe(0.7);
    });

    it('should clear configuration after reset', async () => {
      await client.initialize(validConfig);
      expect(client.getConfiguration()).not.toBeNull();

      client.reset();
      expect(client.getConfiguration()).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle initialization errors gracefully', async () => {
      const { default: OpenAI } = await import('openai');
      const MockedOpenAI = vi.mocked(OpenAI);
      MockedOpenAI.mockImplementation(() => {
        throw new Error('SDK initialization failed');
      });

      await expect(client.initialize(validConfig)).rejects.toThrow(
        'SDK initialization failed'
      );
      expect(client.isInitialized()).toBe(false);
    });

    it('should provide detailed error information for validation failures', () => {
      const invalidConfig = {
        apiKey: 'invalid',
        temperature: 0.7,
        reasoningEffort: 'invalid' as any,
        customOptions: {
          timeout: -1,
          headers: 'invalid' as any,
        },
      };

      const result = client.validateConfiguration(invalidConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('API key must start with "sk-"');
      expect(result.errors).toContain('Timeout must be a positive number');
      expect(result.errors).toContain('Headers must be an object');
    });
  });

  describe('Response API Readiness', () => {
    it('should be ready for Response API integration', async () => {
      await client.initialize(validConfig);
      const instance = client.getOpenAIInstance();

      // Verify client exists and is ready for Response API
      expect(instance).not.toBeNull();
      expect(client.isInitialized()).toBe(true);
      
      // The OpenAI client structure is ready for Response API methods
      // (actual methods will be available in the real OpenAI SDK)
    });

    it('should support configuration required for Response API', async () => {
      const responseApiConfig = {
        ...validConfig,
        customOptions: {
          timeout: 120000, // Longer timeout for Response API
          maxRetries: 2,
        },
      };

      await client.initialize(responseApiConfig);
      const instance = client.getOpenAIInstance();

      expect(instance).not.toBeNull();
      
      // Verify configuration options are stored
      const storedConfig = client.getConfiguration();
      expect(storedConfig?.customOptions?.timeout).toBe(120000);
      expect(storedConfig?.customOptions?.maxRetries).toBe(2);
    });
  });
});