/**
 * @file API Key Types Test
 *
 * Test-driven development (TDD) tests for API key type definitions.
 * This test file validates type compilation, integration with existing
 * storage and encryption types, and ensures complete type coverage.
 */

import { describe, test, expect, beforeEach } from 'vitest';
import type {
  APIProvider,
  APIKeyMetadata,
  APIKeyConfiguration,
  EncryptedAPIKey,
  APIKeyUsageStats,
  APIKeyValidationSchema,
  ProviderValidationRules,
  APIKeyManager,
  APIKeyStorage,
  RotationConfig,
  RateLimitConfig,
  ProxyConfig,
  APIEndpointConfig,
  ValidationResult,
  CreateAPIKeyInput,
  UpdateAPIKeyInput,
  APIKeyQueryOptions,
  APIKeyListResult,
  APIKeyStatus,
  APIKeyType,
  APIKeyPermissions,
  APIKeySecurityConfig,
  APIKeyRotationStatus
} from '../../src/types/apiKeys';

// Import related types for integration testing
import type { StorageVersion, APIKeyStorage as StorageAPIKeyStorage } from '../../src/types/storage';
import type { EncryptedData } from '../../src/security/crypto';
import type { EncryptionService } from '../../src/security/encryptionService';

describe('API Key Types - TDD Tests', () => {
  // Test basic type definitions
  describe('Provider Types', () => {
    test('APIProvider enum should include all supported providers', () => {
      const openaiProvider: APIProvider = 'openai';
      const anthropicProvider: APIProvider = 'anthropic';
      const googleProvider: APIProvider = 'google';
      const customProvider: APIProvider = 'custom';

      expect(openaiProvider).toBe('openai');
      expect(anthropicProvider).toBe('anthropic');
      expect(googleProvider).toBe('google');
      expect(customProvider).toBe('custom');
    });

    test('APIKeyType should support all key types', () => {
      const standard: APIKeyType = 'standard';
      const pro: APIKeyType = 'pro';
      const enterprise: APIKeyType = 'enterprise';

      expect(standard).toBe('standard');
      expect(pro).toBe('pro');
      expect(enterprise).toBe('enterprise');
    });

    test('APIKeyStatus should cover all states', () => {
      const active: APIKeyStatus = 'active';
      const inactive: APIKeyStatus = 'inactive';
      const expired: APIKeyStatus = 'expired';
      const revoked: APIKeyStatus = 'revoked';
      const rotating: APIKeyStatus = 'rotating';

      expect(active).toBe('active');
      expect(inactive).toBe('inactive');
      expect(expired).toBe('expired');
      expect(revoked).toBe('revoked');
      expect(rotating).toBe('rotating');
    });
  });

  // Test core interfaces
  describe('Core Interfaces', () => {
    test('APIKeyMetadata should have complete metadata structure', () => {
      const metadata: APIKeyMetadata = {
        id: 'key-123',
        provider: 'openai',
        keyType: 'standard',
        status: 'active',
        name: 'My OpenAI Key',
        description: 'Primary key for GPT models',
        createdAt: Date.now(),
        lastUsed: Date.now(),
        expiresAt: Date.now() + 86400000, // 24 hours
        maskedKey: 'sk-...abc123',
        permissions: ['read', 'write'],
        tags: ['production', 'gpt-4'],
        userId: 'user-123',
        organizationId: 'org-456'
      };

      expect(metadata.id).toBe('key-123');
      expect(metadata.provider).toBe('openai');
      expect(metadata.keyType).toBe('standard');
      expect(metadata.status).toBe('active');
    });

    test('APIKeyConfiguration should support full configuration', () => {
      const config: APIKeyConfiguration = {
        rateLimit: {
          requestsPerMinute: 60,
          requestsPerHour: 3600,
          requestsPerDay: 86400,
          tokensPerMinute: 150000,
          enforceLimit: true
        },
        endpoint: {
          baseUrl: 'https://api.openai.com/v1',
          customHeaders: {
            'X-Custom-Header': 'value'
          },
          timeout: 30000,
          retries: 3
        },
        proxy: {
          enabled: true,
          host: 'proxy.example.com',
          port: 8080,
          auth: {
            username: 'user',
            password: 'pass'
          }
        },
        rotation: {
          enabled: true,
          intervalDays: 30,
          warnDays: 7,
          autoRotate: false
        },
        security: {
          allowedOrigins: ['https://example.com'],
          ipWhitelist: ['192.168.1.0/24'],
          requireHTTPS: true,
          encryptionLevel: 'high'
        }
      };

      expect(config.rateLimit?.requestsPerMinute).toBe(60);
      expect(config.endpoint?.baseUrl).toBe('https://api.openai.com/v1');
      expect(config.proxy?.enabled).toBe(true);
      expect(config.rotation?.enabled).toBe(true);
      expect(config.security?.requireHTTPS).toBe(true);
    });

    test('EncryptedAPIKey should integrate with encryption system', () => {
      const encryptedKey: EncryptedAPIKey = {
        id: 'key-123',
        metadata: {
          id: 'key-123',
          provider: 'anthropic',
          keyType: 'pro',
          status: 'active',
          name: 'Claude API Key',
          createdAt: Date.now(),
          lastUsed: Date.now(),
          maskedKey: 'sk-ant-...xyz789'
        },
        encryptedData: {
          algorithm: 'AES-GCM',
          iv: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
          data: new Uint8Array([/* encrypted key bytes */]),
          version: 1
        },
        keyHash: 'sha256-hash-of-key',
        checksum: 'integrity-checksum',
        storageVersion: 1,
        configuration: {}
      };

      expect(encryptedKey.id).toBe('key-123');
      expect(encryptedKey.metadata.provider).toBe('anthropic');
      expect(encryptedKey.encryptedData.algorithm).toBe('AES-GCM');
    });

    test('APIKeyUsageStats should track comprehensive usage', () => {
      const stats: APIKeyUsageStats = {
        totalRequests: 12500,
        successfulRequests: 12000,
        failedRequests: 500,
        totalTokens: 2500000,
        inputTokens: 1500000,
        outputTokens: 1000000,
        totalCost: 125.50,
        avgRequestTime: 850,
        lastResetAt: Date.now() - 86400000,
        dailyStats: [
          {
            date: new Date().toISOString().split('T')[0],
            requests: 500,
            tokens: 100000,
            cost: 5.25
          }
        ],
        weeklyStats: [
          {
            week: '2024-01',
            requests: 3500,
            tokens: 700000,
            cost: 36.75
          }
        ],
        monthlyStats: [
          {
            month: '2024-01',
            requests: 15000,
            tokens: 3000000,
            cost: 157.50
          }
        ]
      };

      expect(stats.totalRequests).toBe(12500);
      expect(stats.totalCost).toBe(125.50);
      expect(stats.dailyStats).toHaveLength(1);
      expect(stats.monthlyStats).toHaveLength(1);
    });
  });

  // Test validation schemas
  describe('Validation Schemas', () => {
    test('ProviderValidationRules should define patterns for all providers', () => {
      const rules: ProviderValidationRules = {
        openai: {
          pattern: /^sk-[A-Za-z0-9]{48}$/,
          minLength: 51,
          maxLength: 51,
          requiredPrefix: 'sk-',
          description: 'OpenAI API keys start with sk- followed by 48 characters'
        },
        anthropic: {
          pattern: /^sk-ant-[A-Za-z0-9]{52}$/,
          minLength: 59,
          maxLength: 59,
          requiredPrefix: 'sk-ant-',
          description: 'Anthropic API keys start with sk-ant- followed by 52 characters'
        },
        google: {
          pattern: /^AIza[A-Za-z0-9_-]{35}$/,
          minLength: 39,
          maxLength: 39,
          requiredPrefix: 'AIza',
          description: 'Google API keys start with AIza followed by 35 characters'
        },
        custom: {
          pattern: /^.{1,}$/,
          minLength: 1,
          maxLength: 1000,
          description: 'Custom provider keys can be any format'
        }
      };

      expect(rules.openai.requiredPrefix).toBe('sk-');
      expect(rules.anthropic.requiredPrefix).toBe('sk-ant-');
      expect(rules.google.requiredPrefix).toBe('AIza');
      expect(rules.custom.maxLength).toBe(1000);
    });

    test('APIKeyValidationSchema should provide complete validation', () => {
      const schema: APIKeyValidationSchema = {
        validateKey: (key: string, provider: APIProvider) => ({
          isValid: true,
          errors: [],
          warnings: [],
          provider,
          keyType: 'standard',
          estimatedTier: 'standard'
        }),
        validateConfiguration: (config: APIKeyConfiguration) => ({
          isValid: true,
          errors: [],
          warnings: []
        }),
        getProviderRules: (provider: APIProvider) => ({
          pattern: /^sk-[A-Za-z0-9]{48}$/,
          minLength: 51,
          maxLength: 51,
          requiredPrefix: 'sk-',
          description: 'Test provider rule'
        }),
        maskKey: (key: string) => key.length > 10 ? `${key.slice(0, 3)}...${key.slice(-4)}` : '***'
      };

      const validation = schema.validateKey('sk-test123', 'openai');
      expect(validation.isValid).toBe(true);
      expect(validation.provider).toBe('openai');

      const masked = schema.maskKey('sk-1234567890abcdef');
      expect(masked).toBe('sk-...cdef');
    });
  });

  // Test manager interface
  describe('API Key Manager', () => {
    test('APIKeyManager should provide complete CRUD operations', () => {
      const manager: APIKeyManager = {
        // Create operations
        createKey: async (input: CreateAPIKeyInput) => {
          const encryptedKey: EncryptedAPIKey = {
            id: 'new-key-id',
            metadata: {
              id: 'new-key-id',
              provider: input.provider,
              keyType: 'standard',
              status: 'active',
              name: input.name,
              createdAt: Date.now(),
              lastUsed: 0,
              maskedKey: '***'
            },
            encryptedData: {} as EncryptedData,
            keyHash: 'hash',
            checksum: 'checksum',
            storageVersion: 1,
            configuration: input.configuration || {}
          };
          return encryptedKey;
        },

        // Read operations
        getKey: async (id: string) => null,
        listKeys: async (options?: APIKeyQueryOptions) => ({
          keys: [],
          total: 0,
          hasMore: false,
          nextCursor: undefined
        }),
        findKeys: async (query: Partial<APIKeyMetadata>) => [],

        // Update operations
        updateKey: async (id: string, updates: UpdateAPIKeyInput) => {
          throw new Error('Key not found');
        },
        updateKeyStatus: async (id: string, status: APIKeyStatus) => {
          throw new Error('Key not found');
        },

        // Delete operations
        deleteKey: async (id: string) => false,
        revokeKey: async (id: string) => false,

        // Validation operations
        validateKey: async (key: string, provider: APIProvider) => ({
          isValid: false,
          errors: ['Invalid key format'],
          warnings: []
        }),
        testKeyConnection: async (id: string) => ({
          success: false,
          responseTime: 0,
          error: 'Connection failed'
        }),

        // Usage operations
        recordUsage: async (id: string, usage: any) => {},
        getUsageStats: async (id: string, period?: string) => ({
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
          totalTokens: 0,
          inputTokens: 0,
          outputTokens: 0,
          totalCost: 0,
          avgRequestTime: 0,
          lastResetAt: Date.now()
        }),

        // Rotation operations
        rotateKey: async (id: string) => ({
          success: false,
          newKeyId: undefined,
          rollbackAvailable: false
        }),
        scheduleRotation: async (id: string, config: RotationConfig) => {},
        cancelRotation: async (id: string) => false,

        // Utility operations
        exportKeys: async (includeSecrets?: boolean) => ({}),
        importKeys: async (data: any) => ({ success: 0, failed: 0, errors: [] }),
        clearCache: async () => {},
        getHealthStatus: async () => ({
          healthy: true,
          checks: []
        })
      };

      // Test manager interface is complete
      expect(typeof manager.createKey).toBe('function');
      expect(typeof manager.getKey).toBe('function');
      expect(typeof manager.updateKey).toBe('function');
      expect(typeof manager.deleteKey).toBe('function');
      expect(typeof manager.validateKey).toBe('function');
    });
  });

  // Test integration with existing storage types
  describe('Storage Integration', () => {
    test('APIKeyStorage should extend existing storage interface', () => {
      // This tests that our new APIKeyStorage integrates with existing storage types
      const apiKeyStorageItem: APIKeyStorage = {
        id: 'storage-key-123',
        metadata: {
          id: 'storage-key-123',
          provider: 'openai',
          keyType: 'standard',
          status: 'active',
          name: 'Storage Test Key',
          createdAt: Date.now(),
          lastUsed: Date.now(),
          maskedKey: 'sk-...test'
        },
        encryptedData: {} as EncryptedData,
        keyHash: 'test-hash',
        checksum: 'test-checksum',
        storageVersion: 1 as StorageVersion,
        configuration: {},
        usageStats: {
          totalRequests: 100,
          successfulRequests: 95,
          failedRequests: 5,
          totalTokens: 10000,
          inputTokens: 6000,
          outputTokens: 4000,
          totalCost: 2.50,
          avgRequestTime: 500,
          lastResetAt: Date.now()
        },
        rotationStatus: {
          status: 'none',
          lastRotation: undefined,
          nextScheduledRotation: undefined,
          rotationHistory: []
        }
      };

      expect(apiKeyStorageItem.id).toBe('storage-key-123');
      expect(apiKeyStorageItem.metadata.provider).toBe('openai');
      expect(apiKeyStorageItem.storageVersion).toBe(1);
      expect(apiKeyStorageItem.usageStats?.totalRequests).toBe(100);
    });

    test('APIKeyStorage should be compatible with existing StorageSchema', () => {
      // This would be used in the main StorageSchema's apiKeys record
      const storageRecord: Record<string, APIKeyStorage> = {
        'key-1': {
          id: 'key-1',
          metadata: {
            id: 'key-1',
            provider: 'anthropic',
            keyType: 'pro',
            status: 'active',
            name: 'Test Key',
            createdAt: Date.now(),
            lastUsed: Date.now(),
            maskedKey: 'sk-ant-...test'
          },
          encryptedData: {} as EncryptedData,
          keyHash: 'hash',
          checksum: 'checksum',
          storageVersion: 1,
          configuration: {}
        }
      };

      expect(Object.keys(storageRecord)).toHaveLength(1);
      expect(storageRecord['key-1'].metadata.provider).toBe('anthropic');
    });
  });

  // Test TypeScript strict mode compliance
  describe('TypeScript Strict Mode', () => {
    test('All optional fields should be properly typed', () => {
      // Test that optional fields can be undefined
      const minimalMetadata: APIKeyMetadata = {
        id: 'minimal-key',
        provider: 'openai',
        keyType: 'standard',
        status: 'active',
        name: 'Minimal Key',
        createdAt: Date.now(),
        lastUsed: 0,
        maskedKey: 'sk-...minimal'
      };

      const fullMetadata: APIKeyMetadata = {
        ...minimalMetadata,
        description: 'Full description',
        expiresAt: Date.now() + 86400000,
        permissions: ['read'],
        tags: ['test'],
        userId: 'user-123',
        organizationId: 'org-456'
      };

      expect(minimalMetadata.description).toBeUndefined();
      expect(fullMetadata.description).toBe('Full description');
    });

    test('Required fields should be enforced', () => {
      // This test ensures TypeScript compiler enforces required fields
      const createInput: CreateAPIKeyInput = {
        key: 'sk-test123456789',
        provider: 'openai',
        name: 'Test Key'
      };

      expect(createInput.key).toBe('sk-test123456789');
      expect(createInput.provider).toBe('openai');
      expect(createInput.name).toBe('Test Key');
    });

    test('Union types should work correctly', () => {
      const providers: APIProvider[] = ['openai', 'anthropic', 'google', 'custom'];
      const statuses: APIKeyStatus[] = ['active', 'inactive', 'expired', 'revoked', 'rotating'];
      const keyTypes: APIKeyType[] = ['standard', 'pro', 'enterprise'];

      expect(providers).toHaveLength(4);
      expect(statuses).toHaveLength(5);
      expect(keyTypes).toHaveLength(3);
    });
  });
});