/**
 * @file Key Service
 *
 * Unified service for API key management with storage, validation, and security.
 * Provides a simplified interface for the browser sidebar extension to manage
 * API keys across different providers with proper encryption and validation.
 *
 * Features:
 * - Encrypted storage using existing security utilities
 * - Provider-specific validation
 * - Transport integration for CORS handling
 * - Chrome storage API integration
 * - Support for built-in and custom providers
 */

import type { APIProvider } from '../../types/apiKeys';
import type { Transport } from '../../transport/types';
import * as Storage from '../../data/storage/chrome';
import { encryptText, decryptText, deriveKey, EncryptedData } from '../../data/security/crypto';
import { validateKeyFormat, maskAPIKey } from '../../types/apiKeys';
import { BackgroundProxyTransport } from '../../transport/BackgroundProxyTransport';
import { DirectFetchTransport } from '../../transport/DirectFetchTransport';
import { shouldProxy } from '../../transport/policy';

/**
 * Configuration for key validation endpoints
 */
interface ValidationEndpointConfig {
  url: string;
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  expectedStatus?: number[];
}

/**
 * Provider validation configurations
 */
const VALIDATION_ENDPOINTS: Partial<Record<APIProvider, ValidationEndpointConfig>> = {
  openai: {
    url: 'https://api.openai.com/v1/models',
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    expectedStatus: [200],
  },
  anthropic: {
    url: 'https://api.anthropic.com/v1/messages',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    },
    expectedStatus: [400], // Bad request is expected for validation (missing body)
  },
  google: {
    url: 'https://generativelanguage.googleapis.com/v1beta/models',
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    expectedStatus: [200],
  },
  gemini: {
    url: 'https://generativelanguage.googleapis.com/v1beta/models',
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    expectedStatus: [200],
  },
  openrouter: {
    url: 'https://openrouter.ai/api/v1/models',
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    expectedStatus: [200],
  },
};

/**
 * Storage keys for encrypted API keys
 */
const STORAGE_KEY_PREFIX = 'encrypted_api_key_';
const MASTER_KEY_STORAGE_KEY = 'master_key_salt';

/**
 * Key Service for managing API keys
 */
export class KeyService {
  private masterKey: CryptoKey | null = null;
  private transport: Transport;
  private isInitialized = false;

  constructor(transport?: Transport) {
    // Use provided transport or create appropriate one based on environment
    this.transport = transport || new BackgroundProxyTransport();
  }

  /**
   * Initialize the service with a password for encryption
   */
  async initialize(password: string): Promise<void> {
    if (this.isInitialized) {
      throw new Error('KeyService already initialized');
    }

    try {
      // Get or create salt for key derivation
      const salt = await Storage.get<Uint8Array>(MASTER_KEY_STORAGE_KEY);
      let derivationResult;

      if (!salt) {
        // First time - create new salt and derive key
        derivationResult = await deriveKey(password);
        await Storage.set(MASTER_KEY_STORAGE_KEY, Array.from(derivationResult.salt));
      } else {
        // Use existing salt
        const saltArray = new Uint8Array(salt);
        derivationResult = await deriveKey(password, saltArray);
      }

      this.masterKey = derivationResult.key;
      this.isInitialized = true;
    } catch (error) {
      throw new Error(
        `Failed to initialize KeyService: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Ensure the service is initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized || !this.masterKey) {
      throw new Error('KeyService not initialized. Call initialize() first.');
    }
  }

  /**
   * Get API key for a provider
   */
  async get(provider: APIProvider): Promise<string> {
    this.ensureInitialized();

    try {
      const storageKey = `${STORAGE_KEY_PREFIX}${provider}`;
      const encryptedData = await Storage.get<EncryptedData>(storageKey);

      if (!encryptedData) {
        throw new Error(`No API key found for provider: ${provider}`);
      }

      // Decrypt the key
      const decryptedKey = await decryptText(encryptedData, this.masterKey!);
      return decryptedKey;
    } catch (error) {
      if (error instanceof Error && error.message.includes('No API key found')) {
        throw error;
      }
      throw new Error(
        `Failed to retrieve API key for ${provider}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Set API key for a provider
   */
  async set(provider: APIProvider, key: string): Promise<void> {
    this.ensureInitialized();

    if (!key || key.trim() === '') {
      throw new Error('API key cannot be empty');
    }

    // Validate key format
    const validation = validateKeyFormat(key, provider);
    if (!validation.isValid) {
      throw new Error(`Invalid API key format: ${validation.errors.join(', ')}`);
    }

    try {
      // Encrypt the key
      const encryptedData = await encryptText(key, this.masterKey!);

      // Store the encrypted key
      const storageKey = `${STORAGE_KEY_PREFIX}${provider}`;
      await Storage.set(storageKey, encryptedData);

      // Store metadata for display purposes (masked key, creation time, etc.)
      const metadata = {
        provider,
        maskedKey: maskAPIKey(key),
        createdAt: Date.now(),
        lastUpdated: Date.now(),
      };

      const metadataKey = `${storageKey}_metadata`;
      await Storage.set(metadataKey, metadata);
    } catch (error) {
      throw new Error(
        `Failed to store API key for ${provider}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Remove API key for a provider
   */
  async remove(provider: APIProvider): Promise<void> {
    this.ensureInitialized();

    try {
      const storageKey = `${STORAGE_KEY_PREFIX}${provider}`;
      const metadataKey = `${storageKey}_metadata`;

      await Storage.remove(storageKey);
      await Storage.remove(metadataKey);
    } catch (error) {
      throw new Error(
        `Failed to remove API key for ${provider}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Check if API key exists for a provider
   */
  async has(provider: APIProvider): Promise<boolean> {
    this.ensureInitialized();

    try {
      const storageKey = `${STORAGE_KEY_PREFIX}${provider}`;
      const encryptedData = await Storage.get(storageKey);
      return encryptedData !== null;
    } catch {
      return false;
    }
  }

  /**
   * List all providers that have API keys stored
   */
  async listProviders(): Promise<APIProvider[]> {
    this.ensureInitialized();

    try {
      // Get all storage keys
      const allKeys = await Storage.getBatch([]);
      const providers: APIProvider[] = [];

      for (const key of Object.keys(allKeys)) {
        if (key.startsWith(STORAGE_KEY_PREFIX) && !key.endsWith('_metadata')) {
          const provider = key.replace(STORAGE_KEY_PREFIX, '') as APIProvider;
          providers.push(provider);
        }
      }

      return providers;
    } catch (error) {
      throw new Error(
        `Failed to list providers: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get metadata for a provider (without exposing the actual key)
   */
  async getMetadata(
    provider: APIProvider
  ): Promise<{ maskedKey: string; createdAt: number; lastUpdated: number } | null> {
    this.ensureInitialized();

    try {
      const metadataKey = `${STORAGE_KEY_PREFIX}${provider}_metadata`;
      const metadata = await Storage.get<{
        provider: APIProvider;
        maskedKey: string;
        createdAt: number;
        lastUpdated: number;
      }>(metadataKey);
      return metadata || null;
    } catch {
      return null;
    }
  }

  /**
   * Validate an API key for a specific provider
   */
  async validate(provider: APIProvider, key: string): Promise<boolean> {
    if (!key || key.trim() === '') {
      return false;
    }

    // First validate the format
    const formatValidation = validateKeyFormat(key, provider);
    if (!formatValidation.isValid) {
      return false;
    }

    // For custom and unknown providers, format validation is sufficient
    if (provider === 'custom' || !VALIDATION_ENDPOINTS[provider]) {
      return true;
    }

    // For known providers, test the key with their API
    return this.testKeyWithAPI(provider, key);
  }

  /**
   * Test an API key against the provider's API
   */
  private async testKeyWithAPI(provider: APIProvider, key: string): Promise<boolean> {
    const endpoint = VALIDATION_ENDPOINTS[provider];
    if (!endpoint) {
      // No validation endpoint configured, assume valid if format is correct
      return true;
    }

    try {
      // Prepare headers with the API key
      const headers = { ...endpoint.headers };

      // Add authentication header based on provider
      switch (provider) {
        case 'openai':
        case 'openrouter':
          headers['Authorization'] = `Bearer ${key}`;
          break;
        case 'anthropic':
          headers['x-api-key'] = key;
          break;
        case 'google':
        case 'gemini':
          // Google APIs use key as query parameter
          endpoint.url = endpoint.url.includes('?')
            ? `${endpoint.url}&key=${key}`
            : `${endpoint.url}?key=${key}`;
          break;
        default:
          headers['Authorization'] = `Bearer ${key}`;
      }

      // Choose appropriate transport based on URL
      const transport = shouldProxy(endpoint.url) ? this.transport : new DirectFetchTransport();

      // Make the validation request
      const response = await transport.request({
        url: endpoint.url,
        method: endpoint.method,
        headers,
        body: endpoint.method === 'POST' ? '{}' : undefined, // Empty JSON body for POST requests
      });

      // Check if response status is expected
      const expectedStatuses = endpoint.expectedStatus || [200];
      return expectedStatuses.includes(response.status);
    } catch (error) {
      // If validation request fails, we can't confirm the key is valid
      // But we don't want to throw here - just return false
      return false;
    }
  }

  /**
   * Update transport implementation (useful for testing)
   */
  setTransport(transport: Transport): void {
    this.transport = transport;
  }

  /**
   * Get current transport implementation
   */
  getTransport(): Transport {
    return this.transport;
  }

  /**
   * Clear all stored keys (useful for testing or reset)
   */
  async clearAll(): Promise<void> {
    this.ensureInitialized();

    try {
      const allKeys = await Storage.getBatch([]);
      const keysToRemove = Object.keys(allKeys).filter(
        key => key.startsWith(STORAGE_KEY_PREFIX) || key === MASTER_KEY_STORAGE_KEY
      );

      for (const key of keysToRemove) {
        await Storage.remove(key);
      }
    } catch (error) {
      throw new Error(
        `Failed to clear all keys: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Shutdown the service and clear sensitive data from memory
   */
  shutdown(): void {
    this.masterKey = null;
    this.isInitialized = false;
  }
}

/**
 * Default export for convenience
 */
export default KeyService;
