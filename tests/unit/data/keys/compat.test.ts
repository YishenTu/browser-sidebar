/**
 * Unit tests for OpenAI-Compatible Provider Storage Module
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  addOrUpdateOpenAICompatProvider,
  listOpenAICompatProviders,
  getCompatProviderById,
  deleteOpenAICompatProvider,
  testCompatProviderConnection,
  type CompatProviderInput,
} from '@/data/storage/keys/compat';
import * as keyStorage from '@/data/storage/keys/index';

// Mock the key storage module
vi.mock('@/data/storage/keys/index');

describe('OpenAI-Compatible Provider Storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('addOrUpdateOpenAICompatProvider', () => {
    it('should add a new provider with correct storage format', async () => {
      const mockMetadata: any[] = [];
      vi.mocked(keyStorage.listAPIKeys).mockResolvedValue(mockMetadata);
      vi.mocked(keyStorage.addAPIKey).mockResolvedValue(undefined);

      const input: CompatProviderInput = {
        id: 'deepseek',
        apiKey: 'test-api-key',
        baseURL: 'https://api.deepseek.com',
        name: 'DeepSeek',
      };

      await addOrUpdateOpenAICompatProvider(input);

      expect(keyStorage.addAPIKey).toHaveBeenCalledWith({
        provider: 'compat-deepseek',
        name: 'DeepSeek',
        key: 'test-api-key',
        configuration: {
          endpoint: {
            baseUrl: 'https://api.deepseek.com',
            customHeaders: undefined,
          },
        },
      });
    });

    it('should update an existing provider', async () => {
      const existingKey = {
        id: 'key-123',
        metadata: {
          id: 'key-123',
          provider: 'compat-deepseek',
          name: 'DeepSeek Old',
          createdAt: Date.now() - 10000,
          lastUsed: Date.now() - 5000,
        },
        configuration: {},
      };

      vi.mocked(keyStorage.listAPIKeys).mockResolvedValue({
        keys: [existingKey],
        total: 1,
        hasMore: false,
      });
      vi.mocked(keyStorage.updateAPIKey).mockResolvedValue({} as any);

      const input: CompatProviderInput = {
        id: 'deepseek',
        apiKey: 'new-api-key',
        baseURL: 'https://api.deepseek.com/v2',
        name: 'DeepSeek Updated',
        headers: { 'X-Custom': 'header' },
      };

      await addOrUpdateOpenAICompatProvider(input);

      expect(keyStorage.updateAPIKey).toHaveBeenCalledWith('key-123', {
        name: 'DeepSeek Updated',
        configuration: {
          endpoint: {
            baseUrl: 'https://api.deepseek.com/v2',
            customHeaders: { 'X-Custom': 'header' },
          },
        },
      });
    });

    it('should handle custom provider with default model', async () => {
      vi.mocked(keyStorage.listAPIKeys).mockResolvedValue([]);
      vi.mocked(keyStorage.addAPIKey).mockResolvedValue(undefined);

      const input: CompatProviderInput = {
        id: 'custom-llm',
        apiKey: 'custom-key',
        baseURL: 'https://custom-llm.example.com',
        name: 'My Custom LLM',
        defaultModel: {
          id: 'custom-model-v1',
          name: 'Custom Model v1',
        },
      };

      await addOrUpdateOpenAICompatProvider(input);

      expect(keyStorage.addAPIKey).toHaveBeenCalledWith({
        provider: 'compat-custom-llm',
        name: 'My Custom LLM',
        key: 'custom-key',
        configuration: {
          endpoint: {
            baseUrl: 'https://custom-llm.example.com',
            customHeaders: undefined,
          },
          defaultModel: {
            id: 'custom-model-v1',
            name: 'Custom Model v1',
          },
        },
      });
    });

    it('should use default display name for known providers', async () => {
      vi.mocked(keyStorage.listAPIKeys).mockResolvedValue([]);
      vi.mocked(keyStorage.addAPIKey).mockResolvedValue(undefined);

      const input: CompatProviderInput = {
        id: 'qwen',
        apiKey: 'qwen-key',
        baseURL: 'https://api.qwen.com',
        // No name provided
      };

      await addOrUpdateOpenAICompatProvider(input);

      expect(keyStorage.addAPIKey).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'compat-qwen',
          name: 'Qwen', // Default name
        })
      );
    });
  });

  describe('listOpenAICompatProviders', () => {
    it('should filter and transform compat providers correctly', async () => {
      const mockKeys = [
        {
          id: 'key-1',
          metadata: {
            id: 'key-1',
            provider: 'compat-deepseek',
            name: 'DeepSeek',
          },
          configuration: {
            endpoint: { baseUrl: 'https://api.deepseek.com' },
          },
        },
        {
          id: 'key-2',
          metadata: {
            id: 'key-2',
            provider: 'openai', // Not a compat provider
            name: 'OpenAI',
          },
          configuration: {},
        },
        {
          id: 'key-3',
          metadata: {
            id: 'key-3',
            provider: 'compat-custom',
            name: 'Custom Provider',
          },
          configuration: {
            endpoint: { baseUrl: 'https://custom.com' },
            defaultModel: { id: 'model-1', name: 'Model 1' },
          },
        },
      ];

      vi.mocked(keyStorage.listAPIKeys).mockResolvedValue({
        keys: mockKeys,
        total: 3,
        hasMore: false,
      });

      const result = await listOpenAICompatProviders();

      expect(result).toEqual([
        {
          id: 'deepseek',
          name: 'DeepSeek',
          baseURL: 'https://api.deepseek.com',
        },
        {
          id: 'custom',
          name: 'Custom Provider',
          baseURL: 'https://custom.com',
          model: { id: 'model-1', name: 'Model 1' },
        },
      ]);
    });

    it('should return empty array when no compat providers exist', async () => {
      const mockKeys = [
        {
          id: 'key-1',
          metadata: { id: 'key-1', provider: 'openai', name: 'OpenAI' },
          configuration: {},
        },
        {
          id: 'key-2',
          metadata: { id: 'key-2', provider: 'google', name: 'Google' },
          configuration: {},
        },
      ];

      vi.mocked(keyStorage.listAPIKeys).mockResolvedValue({
        keys: mockKeys,
        total: 2,
        hasMore: false,
      });

      const result = await listOpenAICompatProviders();

      expect(result).toEqual([]);
    });

    it('should handle missing configuration gracefully', async () => {
      const mockKeys = [
        {
          id: 'key-1',
          metadata: {
            id: 'key-1',
            provider: 'compat-test',
            name: 'Test Provider',
          },
          // No configuration
        },
      ];

      vi.mocked(keyStorage.listAPIKeys).mockResolvedValue({
        keys: mockKeys,
        total: 1,
        hasMore: false,
      });

      const result = await listOpenAICompatProviders();

      expect(result).toEqual([
        {
          id: 'test',
          name: 'Test Provider',
          baseURL: '',
        },
      ]);
    });
  });

  describe('getCompatProviderById', () => {
    it('should retrieve and decrypt provider details', async () => {
      const mockKey = {
        id: 'key-123',
        metadata: {
          id: 'key-123',
          provider: 'compat-deepseek',
          name: 'DeepSeek',
        },
        configuration: {
          endpoint: {
            baseUrl: 'https://api.deepseek.com',
            customHeaders: { 'X-API-Version': 'v2' },
          },
        },
      };

      const mockFullKey = {
        key: 'decrypted-api-key',
      };

      vi.mocked(keyStorage.listAPIKeys).mockResolvedValue({
        keys: [mockKey],
        total: 1,
        hasMore: false,
      });
      vi.mocked(keyStorage.getAPIKey).mockResolvedValue(mockFullKey as any);

      const result = await getCompatProviderById('deepseek');

      expect(result).toEqual({
        id: 'deepseek',
        name: 'DeepSeek',
        apiKey: 'decrypted-api-key',
        baseURL: 'https://api.deepseek.com',
        headers: { 'X-API-Version': 'v2' },
      });

      expect(keyStorage.getAPIKey).toHaveBeenCalledWith('key-123');
    });

    it('should return null for non-existent provider', async () => {
      vi.mocked(keyStorage.listAPIKeys).mockResolvedValue({ keys: [], total: 0, hasMore: false });

      const result = await getCompatProviderById('nonexistent');

      expect(result).toBeNull();
      expect(keyStorage.getAPIKey).not.toHaveBeenCalled();
    });

    it('should return null if key decryption fails', async () => {
      const mockKey = {
        id: 'key-123',
        metadata: {
          id: 'key-123',
          provider: 'compat-test',
          name: 'Test',
        },
        configuration: {},
      };

      vi.mocked(keyStorage.listAPIKeys).mockResolvedValue({
        keys: [mockKey],
        total: 1,
        hasMore: false,
      });
      vi.mocked(keyStorage.getAPIKey).mockResolvedValue(null);

      const result = await getCompatProviderById('test');

      expect(result).toBeNull();
    });

    it('should handle custom provider with default model', async () => {
      const mockKey = {
        id: 'key-456',
        metadata: {
          id: 'key-456',
          provider: 'compat-custom',
          name: 'Custom LLM',
        },
        configuration: {
          endpoint: { baseUrl: 'https://custom.com' },
          defaultModel: { id: 'model-v1', name: 'Model v1' },
        },
      };

      vi.mocked(keyStorage.listAPIKeys).mockResolvedValue({
        keys: [mockKey],
        total: 1,
        hasMore: false,
      });
      vi.mocked(keyStorage.getAPIKey).mockResolvedValue({ key: 'custom-key' } as any);

      const result = await getCompatProviderById('custom');

      expect(result).toEqual({
        id: 'custom',
        name: 'Custom LLM',
        apiKey: 'custom-key',
        baseURL: 'https://custom.com',
        model: { id: 'model-v1', name: 'Model v1' },
      });
    });
  });

  describe('deleteOpenAICompatProvider', () => {
    it('should delete existing provider', async () => {
      const mockKey = {
        id: 'key-789',
        metadata: {
          id: 'key-789',
          provider: 'compat-deepseek',
          name: 'DeepSeek',
        },
        configuration: {},
      };

      vi.mocked(keyStorage.listAPIKeys).mockResolvedValue({
        keys: [mockKey],
        total: 1,
        hasMore: false,
      });
      vi.mocked(keyStorage.deleteAPIKey).mockResolvedValue(true);

      await deleteOpenAICompatProvider('deepseek');

      expect(keyStorage.deleteAPIKey).toHaveBeenCalledWith('key-789');
    });

    it('should handle deletion of non-existent provider gracefully', async () => {
      vi.mocked(keyStorage.listAPIKeys).mockResolvedValue({ keys: [], total: 0, hasMore: false });

      await deleteOpenAICompatProvider('nonexistent');

      expect(keyStorage.deleteAPIKey).not.toHaveBeenCalled();
    });
  });

  describe('testCompatProviderConnection', () => {
    beforeEach(() => {
      global.fetch = vi.fn();
    });

    it('should test connection successfully', async () => {
      const mockKey = {
        id: 'key-1',
        metadata: { id: 'key-1', provider: 'compat-deepseek', name: 'DeepSeek' },
        configuration: { endpoint: { baseUrl: 'https://api.deepseek.com' } },
      };

      vi.mocked(keyStorage.listAPIKeys).mockResolvedValue({
        keys: [mockKey],
        total: 1,
        hasMore: false,
      });
      vi.mocked(keyStorage.getAPIKey).mockResolvedValue({ key: 'test-key' } as any);

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
      } as Response);

      const result = await testCompatProviderConnection('deepseek');

      expect(result).toEqual({ success: true });
      expect(fetch).toHaveBeenCalledWith(
        'https://api.deepseek.com/models',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-key',
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should handle connection failure', async () => {
      const mockKey = {
        id: 'key-1',
        metadata: { id: 'key-1', provider: 'compat-test', name: 'Test' },
        configuration: { endpoint: { baseUrl: 'https://test.com' } },
      };

      vi.mocked(keyStorage.listAPIKeys).mockResolvedValue({
        keys: [mockKey],
        total: 1,
        hasMore: false,
      });
      vi.mocked(keyStorage.getAPIKey).mockResolvedValue({ key: 'test-key' } as any);

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      } as Response);

      const result = await testCompatProviderConnection('test');

      expect(result).toEqual({
        success: false,
        error: 'API returned 401: Unauthorized',
      });
    });

    it('should handle network errors', async () => {
      const mockKey = {
        id: 'key-1',
        metadata: { id: 'key-1', provider: 'compat-test', name: 'Test' },
        configuration: { endpoint: { baseUrl: 'https://test.com' } },
      };

      vi.mocked(keyStorage.listAPIKeys).mockResolvedValue({
        keys: [mockKey],
        total: 1,
        hasMore: false,
      });
      vi.mocked(keyStorage.getAPIKey).mockResolvedValue({ key: 'test-key' } as any);

      vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

      const result = await testCompatProviderConnection('test');

      expect(result).toEqual({
        success: false,
        error: 'Network error',
      });
    });

    it('should return error for non-existent provider', async () => {
      vi.mocked(keyStorage.listAPIKeys).mockResolvedValue({ keys: [], total: 0, hasMore: false });

      const result = await testCompatProviderConnection('nonexistent');

      expect(result).toEqual({
        success: false,
        error: 'Provider not found',
      });
    });

    it('should include custom headers in request', async () => {
      const mockKey = {
        id: 'key-1',
        metadata: { id: 'key-1', provider: 'compat-custom', name: 'Custom' },
        configuration: {
          endpoint: {
            baseUrl: 'https://custom.com',
            customHeaders: { 'X-Custom-Header': 'value' },
          },
        },
      };

      vi.mocked(keyStorage.listAPIKeys).mockResolvedValue({
        keys: [mockKey],
        total: 1,
        hasMore: false,
      });
      vi.mocked(keyStorage.getAPIKey).mockResolvedValue({ key: 'custom-key' } as any);

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response);

      await testCompatProviderConnection('custom');

      expect(fetch).toHaveBeenCalledWith(
        'https://custom.com/models',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer custom-key',
            'Content-Type': 'application/json',
            'X-Custom-Header': 'value',
          }),
        })
      );
    });
  });

  describe('Storage provider ID conversion', () => {
    it('should handle provider ID mapping correctly', async () => {
      // Test the flow of adding with bare ID and retrieving with bare ID
      vi.mocked(keyStorage.listAPIKeys).mockResolvedValue({ keys: [], total: 0, hasMore: false });
      vi.mocked(keyStorage.addAPIKey).mockResolvedValue({} as any);

      await addOrUpdateOpenAICompatProvider({
        id: 'my-provider', // Bare ID
        apiKey: 'key',
        baseURL: 'https://example.com',
      });

      // Should store with compat- prefix
      expect(keyStorage.addAPIKey).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'compat-my-provider',
        })
      );

      // Now test retrieval
      vi.mocked(keyStorage.listAPIKeys).mockResolvedValue({
        keys: [
          {
            id: 'key-1',
            metadata: {
              id: 'key-1',
              provider: 'compat-my-provider', // Stored with prefix
              name: 'my-provider',
            },
            configuration: { endpoint: { baseUrl: 'https://example.com' } },
          },
        ],
        total: 1,
        hasMore: false,
      });

      const providers = await listOpenAICompatProviders();

      // Should return without prefix
      expect(providers[0].id).toBe('my-provider');
    });
  });
});
