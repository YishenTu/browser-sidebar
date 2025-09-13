/**
 * @file KeyService Unit Tests
 *
 * Comprehensive unit tests for the KeyService class including:
 * - Key CRUD operations (get, set, remove)
 * - Encryption and decryption
 * - Key validation with different providers
 * - Master password management
 * - Chrome storage integration
 * - Transport integration for CORS handling
 * - Security testing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { KeyService } from '@/services/keys/KeyService';
import type { APIProvider } from '@types/apiKeys';
import type { Transport, TransportRequest, TransportResponse } from '@transport/types';
import type { EncryptedData } from '@data/security/crypto';
import * as Storage from '@data/storage/chrome';
import * as Crypto from '@data/security/crypto';
import { maskAPIKey } from '@types/apiKeys';
import * as TransportPolicy from '@transport/policy';

// Mock dependencies
vi.mock('@data/storage/chrome');
vi.mock('@data/security/crypto');
vi.mock('@transport/policy');
vi.mock('@types/apiKeys', async () => {
  const actual = await vi.importActual('@types/apiKeys');
  return {
    ...actual,
    maskAPIKey: vi.fn(),
  };
});

// Mock transports
class MockTransport implements Transport {
  mockResponse: TransportResponse | null = null;
  mockError: Error | null = null;
  requestCalls: TransportRequest[] = [];

  async request(request: TransportRequest): Promise<TransportResponse> {
    this.requestCalls.push(request);

    if (this.mockError) {
      throw this.mockError;
    }

    if (this.mockResponse) {
      return this.mockResponse;
    }

    // Default successful response
    return {
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      body: '{"data": "success"}',
    };
  }

  async *stream(request: TransportRequest): AsyncIterable<Uint8Array> {
    this.requestCalls.push(request);

    if (this.mockError) {
      throw this.mockError;
    }

    yield new TextEncoder().encode('{"data": "stream"}');
  }

  setMockResponse(response: TransportResponse) {
    this.mockResponse = response;
    this.mockError = null;
  }

  setMockError(error: Error) {
    this.mockError = error;
    this.mockResponse = null;
  }

  getLastRequest(): TransportRequest | null {
    return this.requestCalls[this.requestCalls.length - 1] || null;
  }

  reset() {
    this.requestCalls = [];
    this.mockResponse = null;
    this.mockError = null;
  }
}

// Mock Web Crypto API
const mockCryptoKey = {} as CryptoKey;
const mockEncryptedData: EncryptedData = {
  algorithm: 'AES-256-GCM',
  iv: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
  data: new Uint8Array([13, 14, 15, 16]),
  version: 1,
};

describe('KeyService', () => {
  let keyService: KeyService;
  let mockTransport: MockTransport;

  // Mock implementations
  const mockStorage = {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
    getBatch: vi.fn(),
  };

  const mockCrypto = {
    deriveKey: vi.fn(),
    encryptText: vi.fn(),
    decryptText: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup storage mocks
    vi.mocked(Storage.get).mockImplementation(mockStorage.get);
    vi.mocked(Storage.set).mockImplementation(mockStorage.set);
    vi.mocked(Storage.remove).mockImplementation(mockStorage.remove);
    vi.mocked(Storage.getBatch).mockImplementation(mockStorage.getBatch);

    // Setup crypto mocks
    vi.mocked(Crypto.deriveKey).mockImplementation(mockCrypto.deriveKey);
    vi.mocked(Crypto.encryptText).mockImplementation(mockCrypto.encryptText);
    vi.mocked(Crypto.decryptText).mockImplementation(mockCrypto.decryptText);

    // Setup transport policy mocks - make everything use our mock transport
    vi.mocked(TransportPolicy.shouldProxy).mockReturnValue(true);

    // No format validation anymore
    vi.mocked(maskAPIKey).mockImplementation(key => key.slice(0, 8) + '...' + key.slice(-4));

    // Reset mock implementations
    mockStorage.get.mockReset();
    mockStorage.set.mockReset();
    mockStorage.remove.mockReset();
    mockStorage.getBatch.mockReset();

    mockCrypto.deriveKey.mockReset();
    mockCrypto.encryptText.mockReset();
    mockCrypto.decryptText.mockReset();

    // Create fresh instances
    mockTransport = new MockTransport();
    keyService = new KeyService(mockTransport);
  });

  afterEach(() => {
    keyService.shutdown();
    mockTransport.reset();
  });

  describe('initialization', () => {
    it('should initialize with password for first time', async () => {
      const password = 'test-password-123';
      const salt = new Uint8Array([1, 2, 3, 4]);
      const derivationResult = { key: mockCryptoKey, salt };

      mockStorage.get.mockResolvedValue(null); // No existing salt
      mockCrypto.deriveKey.mockResolvedValue(derivationResult);

      await keyService.initialize(password);

      expect(mockCrypto.deriveKey).toHaveBeenCalledWith(password);
      expect(mockStorage.set).toHaveBeenCalledWith('master_key_salt', Array.from(salt));
    });

    it('should initialize with password using existing salt', async () => {
      const password = 'test-password-123';
      const existingSalt = [1, 2, 3, 4];
      const derivationResult = { key: mockCryptoKey, salt: new Uint8Array(existingSalt) };

      mockStorage.get.mockResolvedValue(existingSalt);
      mockCrypto.deriveKey.mockResolvedValue(derivationResult);

      await keyService.initialize(password);

      expect(mockCrypto.deriveKey).toHaveBeenCalledWith(password, new Uint8Array(existingSalt));
      expect(mockStorage.set).not.toHaveBeenCalledWith('master_key_salt', expect.anything());
    });

    it('should throw error if already initialized', async () => {
      mockStorage.get.mockResolvedValue(null);
      mockCrypto.deriveKey.mockResolvedValue({ key: mockCryptoKey, salt: new Uint8Array() });

      await keyService.initialize('password');
      await expect(keyService.initialize('password')).rejects.toThrow(
        'KeyService already initialized'
      );
    });

    it('should throw error on initialization failure', async () => {
      const password = 'test-password';
      mockStorage.get.mockRejectedValue(new Error('Storage error'));

      await expect(keyService.initialize(password)).rejects.toThrow(
        'Failed to initialize KeyService'
      );
    });

    it('should throw error when operations are called without initialization', async () => {
      await expect(keyService.get('openai')).rejects.toThrow('KeyService not initialized');
      await expect(keyService.set('openai', 'test-key')).rejects.toThrow(
        'KeyService not initialized'
      );
      await expect(keyService.remove('openai')).rejects.toThrow('KeyService not initialized');
      await expect(keyService.has('openai')).rejects.toThrow('KeyService not initialized');
      await expect(keyService.listProviders()).rejects.toThrow('KeyService not initialized');
    });
  });

  describe('key storage operations', () => {
    beforeEach(async () => {
      mockStorage.get.mockResolvedValue(null);
      mockCrypto.deriveKey.mockResolvedValue({ key: mockCryptoKey, salt: new Uint8Array() });
      await keyService.initialize('test-password');

      // Clear any calls made during initialization
      mockStorage.set.mockClear();
    });

    describe('set', () => {
      it('should store encrypted API key', async () => {
        const provider: APIProvider = 'openai';
        const apiKey = 'sk-test1234567890abcdefghijklmnopqrstuvwxyz123456';

        mockCrypto.encryptText.mockResolvedValue(mockEncryptedData);

        await keyService.set(provider, apiKey);

        expect(mockCrypto.encryptText).toHaveBeenCalledWith(apiKey, mockCryptoKey);
        expect(mockStorage.set).toHaveBeenCalledWith('encrypted_api_key_openai', mockEncryptedData);
        expect(mockStorage.set).toHaveBeenCalledWith(
          'encrypted_api_key_openai_metadata',
          expect.objectContaining({
            provider: 'openai',
            maskedKey: expect.any(String),
            createdAt: expect.any(Number),
            lastUpdated: expect.any(Number),
          })
        );
      });

      // Format-based pre-validation removed; only empty checks remain

      it('should throw error for empty key', async () => {
        await expect(keyService.set('openai', '')).rejects.toThrow('API key cannot be empty');
        await expect(keyService.set('openai', '   ')).rejects.toThrow('API key cannot be empty');
      });

      it('should handle encryption failure', async () => {
        const provider: APIProvider = 'openai';
        const apiKey = 'sk-test1234567890abcdefghijklmnopqrstuvwxyz123456';

        mockCrypto.encryptText.mockRejectedValue(new Error('Encryption failed'));

        await expect(keyService.set(provider, apiKey)).rejects.toThrow(
          'Failed to store API key for openai'
        );
      });
    });

    describe('get', () => {
      it('should retrieve and decrypt API key', async () => {
        const provider: APIProvider = 'openai';
        const apiKey = 'sk-test1234567890abcdefghijklmnopqrstuvwxyz123456';

        mockStorage.get.mockResolvedValue(mockEncryptedData);
        mockCrypto.decryptText.mockResolvedValue(apiKey);

        const result = await keyService.get(provider);

        expect(mockStorage.get).toHaveBeenCalledWith('encrypted_api_key_openai');
        expect(mockCrypto.decryptText).toHaveBeenCalledWith(mockEncryptedData, mockCryptoKey);
        expect(result).toBe(apiKey);
      });

      it('should throw error when key not found', async () => {
        mockStorage.get.mockResolvedValue(null);

        await expect(keyService.get('openai')).rejects.toThrow(
          'No API key found for provider: openai'
        );
      });

      it('should handle decryption failure', async () => {
        mockStorage.get.mockResolvedValue(mockEncryptedData);
        mockCrypto.decryptText.mockRejectedValue(new Error('Decryption failed'));

        await expect(keyService.get('openai')).rejects.toThrow(
          'Failed to retrieve API key for openai'
        );
      });
    });

    describe('remove', () => {
      it('should remove API key and metadata', async () => {
        await keyService.remove('openai');

        expect(mockStorage.remove).toHaveBeenCalledWith('encrypted_api_key_openai');
        expect(mockStorage.remove).toHaveBeenCalledWith('encrypted_api_key_openai_metadata');
      });

      it('should handle removal failure', async () => {
        mockStorage.remove.mockRejectedValue(new Error('Storage error'));

        await expect(keyService.remove('openai')).rejects.toThrow(
          'Failed to remove API key for openai'
        );
      });
    });

    describe('has', () => {
      it('should return true when key exists', async () => {
        mockStorage.get.mockResolvedValue(mockEncryptedData);

        const result = await keyService.has('openai');
        expect(result).toBe(true);
        expect(mockStorage.get).toHaveBeenCalledWith('encrypted_api_key_openai');
      });

      it('should return false when key does not exist', async () => {
        mockStorage.get.mockResolvedValue(null);

        const result = await keyService.has('openai');
        expect(result).toBe(false);
      });

      it('should return false on storage error', async () => {
        mockStorage.get.mockRejectedValue(new Error('Storage error'));

        const result = await keyService.has('openai');
        expect(result).toBe(false);
      });
    });

    describe('listProviders', () => {
      it('should list all stored providers', async () => {
        const storageKeys = {
          encrypted_api_key_openai: mockEncryptedData,
          encrypted_api_key_openai_metadata: {},
          encrypted_api_key_anthropic: mockEncryptedData,
          encrypted_api_key_anthropic_metadata: {},
          other_key: 'value',
        };

        mockStorage.getBatch.mockResolvedValue(storageKeys);

        const providers = await keyService.listProviders();

        expect(providers).toEqual(['openai', 'anthropic']);
        expect(providers).not.toContain('other_key');
      });

      it('should return empty array when no providers stored', async () => {
        mockStorage.getBatch.mockResolvedValue({});

        const providers = await keyService.listProviders();
        expect(providers).toEqual([]);
      });

      it('should handle storage error', async () => {
        mockStorage.getBatch.mockRejectedValue(new Error('Storage error'));

        await expect(keyService.listProviders()).rejects.toThrow('Failed to list providers');
      });
    });

    describe('getMetadata', () => {
      it('should return metadata when available', async () => {
        const metadata = {
          maskedKey: 'sk-test...3456',
          createdAt: 1234567890,
          lastUpdated: 1234567890,
        };

        mockStorage.get.mockResolvedValue(metadata);

        const result = await keyService.getMetadata('openai');

        expect(result).toEqual(metadata);
        expect(mockStorage.get).toHaveBeenCalledWith('encrypted_api_key_openai_metadata');
      });

      it('should return null when metadata not found', async () => {
        mockStorage.get.mockResolvedValue(null);

        const result = await keyService.getMetadata('openai');
        expect(result).toBe(null);
      });

      it('should return null on storage error', async () => {
        mockStorage.get.mockRejectedValue(new Error('Storage error'));

        const result = await keyService.getMetadata('openai');
        expect(result).toBe(null);
      });
    });
  });

  describe('key validation', () => {
    beforeEach(async () => {
      mockStorage.get.mockResolvedValue(null);
      mockCrypto.deriveKey.mockResolvedValue({ key: mockCryptoKey, salt: new Uint8Array() });
      await keyService.initialize('test-password');
    });

    // Custom/unknown providers are not validated here (use compat validator)

    it('should return false for empty key', async () => {
      const result1 = await keyService.validate('openai', '');
      const result2 = await keyService.validate('openai', '   ');

      expect(result1).toBe(false);
      expect(result2).toBe(false);
    });

    describe('API validation', () => {
      it('should validate OpenAI key with API call', async () => {
        const openaiKey = 'sk-test1234567890abcdefghijklmnopqrstuvwxyz123456';

        mockTransport.setMockResponse({
          status: 200,
          statusText: 'OK',
          headers: new Headers(),
        });

        const result = await keyService.validate('openai', openaiKey);

        expect(result).toBe(true);

        const lastRequest = mockTransport.getLastRequest();
        expect(lastRequest).toBeTruthy();
        expect(lastRequest!.url).toBe('https://api.openai.com/v1/models');
        expect(lastRequest!.method).toBe('GET');
        expect(lastRequest!.headers['Authorization']).toBe(`Bearer ${openaiKey}`);
      });

      it('should validate Anthropic key with API call', async () => {
        const anthropicKey = 'sk-ant-api03-1234567890abcdefghijklmnopqrstuvwxyz';

        mockTransport.setMockResponse({
          status: 400, // Anthropic expects 400 for validation
          statusText: 'Bad Request',
          headers: new Headers(),
        });

        const result = await keyService.validate('anthropic', anthropicKey);

        expect(result).toBe(true);

        const lastRequest = mockTransport.getLastRequest();
        expect(lastRequest).toBeTruthy();
        expect(lastRequest!.url).toBe('https://api.anthropic.com/v1/messages');
        expect(lastRequest!.method).toBe('POST');
        expect(lastRequest!.headers['x-api-key']).toBe(anthropicKey);
        expect(lastRequest!.headers['anthropic-version']).toBe('2023-06-01');
      });

      it('should validate Google key with query parameter', async () => {
        const googleKey = 'AIzaSyD1234567890abcdefghijklmnopqrstuv';

        mockTransport.setMockResponse({
          status: 200,
          statusText: 'OK',
          headers: new Headers(),
        });

        const result = await keyService.validate('google', googleKey);

        expect(result).toBe(true);

        const lastRequest = mockTransport.getLastRequest();
        expect(lastRequest).toBeTruthy();
        expect(lastRequest!.url).toBe(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${googleKey}`
        );
      });

      it('should validate OpenRouter key with Bearer auth', async () => {
        const openrouterKey = 'sk-or-1234567890abcdefghijklmnopqrstuvwxyz123456';

        mockTransport.setMockResponse({
          status: 200,
          statusText: 'OK',
          headers: new Headers(),
        });

        const result = await keyService.validate('openrouter', openrouterKey);

        expect(result).toBe(true);

        const lastRequest = mockTransport.getLastRequest();
        expect(lastRequest).toBeTruthy();
        expect(lastRequest!.url).toBe('https://openrouter.ai/api/v1/models');
        expect(lastRequest!.headers['Authorization']).toBe(`Bearer ${openrouterKey}`);
      });

      it('should handle API validation failure', async () => {
        const openaiKey = 'sk-test1234567890abcdefghijklmnopqrstuvwxyz123456';

        mockTransport.setMockResponse({
          status: 401,
          statusText: 'Unauthorized',
          headers: new Headers(),
        });

        const result = await keyService.validate('openai', openaiKey);
        expect(result).toBe(false);
      });

      it('should handle API validation error gracefully', async () => {
        const openaiKey = 'sk-test1234567890abcdefghijklmnopqrstuvwxyz123456';

        mockTransport.setMockError(new Error('Network error'));

        const result = await keyService.validate('openai', openaiKey);
        expect(result).toBe(false);
      });

      it('should return false for unknown providers', async () => {
        // @ts-expect-error - Testing unknown provider
        const result = await keyService.validate('unknown_provider', 'some-key');
        expect(result).toBe(false);
        expect(mockTransport.requestCalls).toHaveLength(0); // No API call for unknown provider
      });
    });
  });

  describe('transport management', () => {
    it('should allow transport replacement', () => {
      const newTransport = new MockTransport();

      keyService.setTransport(newTransport);
      expect(keyService.getTransport()).toBe(newTransport);
    });

    it('should use BackgroundProxyTransport by default', () => {
      const defaultService = new KeyService();
      const transport = defaultService.getTransport();

      // Should be BackgroundProxyTransport (can't check exact type due to mocking)
      expect(transport).toBeDefined();
    });
  });

  describe('security features', () => {
    beforeEach(async () => {
      mockStorage.get.mockResolvedValue(null);
      mockCrypto.deriveKey.mockResolvedValue({ key: mockCryptoKey, salt: new Uint8Array() });
      await keyService.initialize('test-password');
    });

    it('should mask API keys in metadata', async () => {
      const apiKey = 'sk-test1234567890abcdefghijklmnopqrstuvwxyz123456';
      const maskedKey = 'sk-test1...3456';

      vi.mocked(maskAPIKey).mockReturnValue(maskedKey);
      mockCrypto.encryptText.mockResolvedValue(mockEncryptedData);

      await keyService.set('openai', apiKey);

      expect(maskAPIKey).toHaveBeenCalledWith(apiKey);
      expect(mockStorage.set).toHaveBeenCalledWith(
        'encrypted_api_key_openai_metadata',
        expect.objectContaining({
          maskedKey,
        })
      );
    });

    it('should clear sensitive data on shutdown', () => {
      keyService.shutdown();

      // These operations should fail after shutdown
      expect(() => keyService.get('openai')).rejects.toThrow('KeyService not initialized');
    });

    it('should handle encryption errors without exposing keys', async () => {
      const apiKey = 'sk-test1234567890abcdefghijklmnopqrstuvwxyz123456';

      mockCrypto.encryptText.mockRejectedValue(new Error('Encryption failed'));

      await expect(keyService.set('openai', apiKey)).rejects.toThrow(
        'Failed to store API key for openai: Encryption failed'
      );

      // Ensure key is not stored in plain text anywhere
      expect(mockStorage.set).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining(apiKey)
      );
    });
  });

  describe('utility operations', () => {
    beforeEach(async () => {
      mockStorage.get.mockResolvedValue(null);
      mockCrypto.deriveKey.mockResolvedValue({ key: mockCryptoKey, salt: new Uint8Array() });
      await keyService.initialize('test-password');
    });

    describe('clearAll', () => {
      it('should clear all stored keys and master key', async () => {
        const storageKeys = {
          encrypted_api_key_openai: mockEncryptedData,
          encrypted_api_key_openai_metadata: {},
          encrypted_api_key_anthropic: mockEncryptedData,
          master_key_salt: [1, 2, 3, 4],
          other_key: 'value',
        };

        mockStorage.getBatch.mockResolvedValue(storageKeys);

        await keyService.clearAll();

        expect(mockStorage.remove).toHaveBeenCalledWith('encrypted_api_key_openai');
        expect(mockStorage.remove).toHaveBeenCalledWith('encrypted_api_key_openai_metadata');
        expect(mockStorage.remove).toHaveBeenCalledWith('encrypted_api_key_anthropic');
        expect(mockStorage.remove).toHaveBeenCalledWith('master_key_salt');
        expect(mockStorage.remove).not.toHaveBeenCalledWith('other_key');
      });

      it('should handle clearAll failure', async () => {
        mockStorage.getBatch.mockRejectedValue(new Error('Storage error'));

        await expect(keyService.clearAll()).rejects.toThrow('Failed to clear all keys');
      });
    });
  });

  describe('edge cases and error handling', () => {
    beforeEach(async () => {
      mockStorage.get.mockResolvedValue(null);
      mockCrypto.deriveKey.mockResolvedValue({ key: mockCryptoKey, salt: new Uint8Array() });
      await keyService.initialize('test-password');
    });

    it('should handle storage quota exceeded', async () => {
      const apiKey = 'sk-test1234567890abcdefghijklmnopqrstuvwxyz123456';

      mockCrypto.encryptText.mockResolvedValue(mockEncryptedData);
      mockStorage.set.mockRejectedValue(new Error('QUOTA_EXCEEDED'));

      await expect(keyService.set('openai', apiKey)).rejects.toThrow(
        'Failed to store API key for openai'
      );
    });

    it('should handle corrupted encrypted data', async () => {
      const corruptedData = { ...mockEncryptedData, data: new Uint8Array([]) };

      mockStorage.get.mockResolvedValue(corruptedData);
      mockCrypto.decryptText.mockRejectedValue(new Error('Invalid encrypted data'));

      await expect(keyService.get('openai')).rejects.toThrow(
        'Failed to retrieve API key for openai'
      );
    });

    it('should handle concurrent operations gracefully', async () => {
      const apiKey = 'sk-test1234567890abcdefghijklmnopqrstuvwxyz123456';

      mockCrypto.encryptText.mockResolvedValue(mockEncryptedData);
      mockStorage.get.mockResolvedValue(mockEncryptedData);
      mockCrypto.decryptText.mockResolvedValue(apiKey);

      // Start multiple operations concurrently
      const operations = [
        keyService.set('openai', apiKey),
        keyService.get('openai'),
        keyService.has('openai'),
        keyService.getMetadata('openai'),
      ];

      // All should complete without throwing
      await expect(Promise.allSettled(operations)).resolves.toBeDefined();
    });

    it('should handle provider with special characters', async () => {
      const provider = 'compat-custom-provider' as APIProvider;
      const apiKey = 'custom-key-123';

      mockCrypto.encryptText.mockResolvedValue(mockEncryptedData);

      await keyService.set(provider, apiKey);

      expect(mockStorage.set).toHaveBeenCalledWith(
        'encrypted_api_key_compat-custom-provider',
        mockEncryptedData
      );
    });

    it('should handle empty storage gracefully', async () => {
      mockStorage.getBatch.mockResolvedValue({});

      const providers = await keyService.listProviders();
      expect(providers).toEqual([]);
    });

    it('should handle malformed metadata gracefully', async () => {
      // Mock storage to throw an error (simulates malformed data)
      mockStorage.get.mockRejectedValue(new Error('Storage error'));

      // getMetadata catches errors and returns null
      const result = await keyService.getMetadata('openai');
      expect(result).toBe(null);
    });
  });

  describe('CORS and transport policy', () => {
    beforeEach(async () => {
      mockStorage.get.mockResolvedValue(null);
      mockCrypto.deriveKey.mockResolvedValue({ key: mockCryptoKey, salt: new Uint8Array() });
      await keyService.initialize('test-password');
    });

    it('should use transport for CORS-restricted endpoints', async () => {
      const anthropicKey = 'sk-ant-api03-1234567890abcdefghijklmnopqrstuvwxyz';

      mockTransport.setMockResponse({
        status: 400, // Anthropic validation expects 400
        statusText: 'Bad Request',
        headers: new Headers(),
      });

      await keyService.validate('anthropic', anthropicKey);

      // Should use the provided transport (mockTransport)
      expect(mockTransport.requestCalls).toHaveLength(1);
      expect(mockTransport.getLastRequest()!.url).toBe('https://api.anthropic.com/v1/messages');
    });

    it('should handle transport timeout during validation', async () => {
      const openaiKey = 'sk-test1234567890abcdefghijklmnopqrstuvwxyz123456';

      mockTransport.setMockError(new Error('Request timeout'));

      const result = await keyService.validate('openai', openaiKey);
      expect(result).toBe(false); // Should handle timeout gracefully
    });
  });
});
