/**
 * @file API Keys Type Tests
 *
 * Tests for API key utility functions including masking, ID generation,
 * expiration checking, and type guards.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  maskAPIKey,
  generateKeyId,
  isKeyExpired,
  getDaysUntilExpiration,
  isAPIKeyMetadata,
  isEncryptedAPIKey,
  isAPIKeyStorage,
  isValidationResult,
  type APIKeyMetadata,
  type EncryptedAPIKey,
  type APIKeyStorage,
  type ValidationResult,
} from '@/types/apiKeys';
import type { EncryptedData } from '@/data/security/crypto';

const sampleEncryptedData: EncryptedData = {
  algorithm: 'AES-GCM',
  iv: new Uint8Array(12),
  data: new Uint8Array([1, 2, 3]),
  version: 1,
};

describe('maskAPIKey', () => {
  describe('basic masking', () => {
    it('should mask middle portion of key', () => {
      const result = maskAPIKey('sk-1234567890abcdef');

      expect(result).toContain('sk-1');
      expect(result).toContain('...');
      expect(result).toContain('cdef');
    });

    it('should show visibleChars characters at start and end', () => {
      const result = maskAPIKey('1234567890', 4);

      expect(result).toBe('1234...7890');
    });

    it('should default to 4 visible characters', () => {
      const result = maskAPIKey('abcdefghijklmnop');

      expect(result).toBe('abcd...mnop');
    });
  });

  describe('short keys', () => {
    it('should return *** for keys shorter than 2x visibleChars', () => {
      const result = maskAPIKey('short', 4);

      expect(result).toBe('***');
    });

    it('should return *** for keys equal to 2x visibleChars', () => {
      const result = maskAPIKey('12345678', 4);

      expect(result).toBe('***');
    });
  });

  describe('visibleChars limits', () => {
    it('should cap start characters at 8', () => {
      const result = maskAPIKey('a'.repeat(30), 10);

      expect(result.split('...')[0]!.length).toBe(8);
    });

    it('should cap end characters at 8', () => {
      const result = maskAPIKey('a'.repeat(30), 10);

      expect(result.split('...')[1]!.length).toBe(8);
    });
  });
});

describe('generateKeyId', () => {
  it('should include provider in ID', () => {
    const result = generateKeyId('openai');

    expect(result).toMatch(/^openai-/);
  });

  it('should include timestamp', () => {
    const before = Date.now();
    const result = generateKeyId('gemini');
    const after = Date.now();

    const parts = result.split('-');
    const timestampPart = parts[1];
    expect(timestampPart).toBeDefined();
    const timestamp = parseInt(timestampPart!, 10);

    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });

  it('should include random component', () => {
    const id1 = generateKeyId('openai');
    const id2 = generateKeyId('openai');

    // Should be different due to random component
    expect(id1).not.toBe(id2);
  });

  it('should include hash suffix when provided', () => {
    const result = generateKeyId('openai', 'abcd1234efgh5678');

    expect(result).toContain('abcd1234');
  });
});

describe('isKeyExpired', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const createMetadata = (expiresAt?: number): APIKeyMetadata => ({
    id: 'key-1',
    provider: 'openai',
    keyType: 'standard',
    status: 'active',
    name: 'Test Key',
    createdAt: Date.now() - 86400000,
    lastUsed: Date.now(),
    maskedKey: 'sk-...xxxx',
    expiresAt,
  });

  it('should return false when no expiresAt', () => {
    const result = isKeyExpired(createMetadata());

    expect(result).toBe(false);
  });

  it('should return false when key is not expired', () => {
    const futureTime = Date.now() + 86400000; // +1 day
    const result = isKeyExpired(createMetadata(futureTime));

    expect(result).toBe(false);
  });

  it('should return true when key is expired', () => {
    const pastTime = Date.now() - 86400000; // -1 day
    const result = isKeyExpired(createMetadata(pastTime));

    expect(result).toBe(true);
  });
});

describe('getDaysUntilExpiration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const createMetadata = (expiresAt?: number): APIKeyMetadata => ({
    id: 'key-1',
    provider: 'openai',
    keyType: 'standard',
    status: 'active',
    name: 'Test Key',
    createdAt: Date.now() - 86400000,
    lastUsed: Date.now(),
    maskedKey: 'sk-...xxxx',
    expiresAt,
  });

  it('should return null when no expiresAt', () => {
    const result = getDaysUntilExpiration(createMetadata());

    expect(result).toBeNull();
  });

  it('should return positive days for future expiration', () => {
    const futureTime = Date.now() + 3 * 86400000; // +3 days
    const result = getDaysUntilExpiration(createMetadata(futureTime));

    expect(result).toBe(3);
  });

  it('should return negative days for past expiration', () => {
    const pastTime = Date.now() - 2 * 86400000; // -2 days
    const result = getDaysUntilExpiration(createMetadata(pastTime));

    expect(result).toBe(-2);
  });

  it('should ceil partial days', () => {
    const futureTime = Date.now() + 1.5 * 86400000; // +1.5 days
    const result = getDaysUntilExpiration(createMetadata(futureTime));

    expect(result).toBe(2);
  });
});

describe('isAPIKeyMetadata', () => {
  const validMetadata: APIKeyMetadata = {
    id: 'key-1',
    provider: 'openai',
    keyType: 'standard',
    status: 'active',
    name: 'Test Key',
    createdAt: Date.now(),
    lastUsed: Date.now(),
    maskedKey: 'sk-...xxxx',
  };

  it('should return true for valid metadata', () => {
    expect(isAPIKeyMetadata(validMetadata)).toBe(true);
  });

  it('should return false for null', () => {
    expect(isAPIKeyMetadata(null)).toBe(false);
  });

  it('should return false for non-object', () => {
    expect(isAPIKeyMetadata('string')).toBe(false);
    expect(isAPIKeyMetadata(123)).toBe(false);
  });

  it('should return false when id is missing', () => {
    const { id, ...rest } = validMetadata;
    expect(isAPIKeyMetadata(rest)).toBe(false);
  });

  it('should return false when provider is missing', () => {
    const { provider, ...rest } = validMetadata;
    expect(isAPIKeyMetadata(rest)).toBe(false);
  });

  it('should return false when keyType is missing', () => {
    const { keyType, ...rest } = validMetadata;
    expect(isAPIKeyMetadata(rest)).toBe(false);
  });

  it('should return false when status is missing', () => {
    const { status, ...rest } = validMetadata;
    expect(isAPIKeyMetadata(rest)).toBe(false);
  });

  it('should return false when name is missing', () => {
    const { name, ...rest } = validMetadata;
    expect(isAPIKeyMetadata(rest)).toBe(false);
  });

  it('should return false when createdAt is wrong type', () => {
    expect(isAPIKeyMetadata({ ...validMetadata, createdAt: 'not-a-number' })).toBe(false);
  });

  it('should return false when lastUsed is wrong type', () => {
    expect(isAPIKeyMetadata({ ...validMetadata, lastUsed: 'not-a-number' })).toBe(false);
  });

  it('should return false when maskedKey is wrong type', () => {
    expect(isAPIKeyMetadata({ ...validMetadata, maskedKey: 123 })).toBe(false);
  });
});

describe('isEncryptedAPIKey', () => {
  const validEncrypted: EncryptedAPIKey = {
    id: 'key-1',
    metadata: {
      id: 'key-1',
      provider: 'openai',
      keyType: 'standard',
      status: 'active',
      name: 'Test Key',
      createdAt: Date.now(),
      lastUsed: Date.now(),
      maskedKey: 'sk-...xxxx',
    },
    encryptedData: sampleEncryptedData,
    keyHash: 'hash123',
    checksum: 'checksum123',
    storageVersion: 1,
    configuration: {},
  };

  it('should return true for valid encrypted key', () => {
    expect(isEncryptedAPIKey(validEncrypted)).toBe(true);
  });

  it('should return false for null', () => {
    expect(isEncryptedAPIKey(null)).toBe(false);
  });

  it('should return false when metadata is invalid', () => {
    expect(isEncryptedAPIKey({ ...validEncrypted, metadata: {} })).toBe(false);
  });

  it('should return false when encryptedData is missing', () => {
    const { encryptedData, ...rest } = validEncrypted;
    expect(isEncryptedAPIKey(rest)).toBe(false);
  });

  it('should return false when keyHash is missing', () => {
    const { keyHash, ...rest } = validEncrypted;
    expect(isEncryptedAPIKey(rest)).toBe(false);
  });

  it('should return false when checksum is missing', () => {
    const { checksum, ...rest } = validEncrypted;
    expect(isEncryptedAPIKey(rest)).toBe(false);
  });

  it('should return false when storageVersion is wrong type', () => {
    expect(isEncryptedAPIKey({ ...validEncrypted, storageVersion: 'v1' })).toBe(false);
  });

  it('should return false when configuration is missing', () => {
    const { configuration, ...rest } = validEncrypted;
    expect(isEncryptedAPIKey(rest)).toBe(false);
  });
});

describe('isAPIKeyStorage', () => {
  const validStorage: APIKeyStorage = {
    id: 'key-1',
    metadata: {
      id: 'key-1',
      provider: 'openai',
      keyType: 'standard',
      status: 'active',
      name: 'Test Key',
      createdAt: Date.now(),
      lastUsed: Date.now(),
      maskedKey: 'sk-...xxxx',
    },
    encryptedData: sampleEncryptedData,
    keyHash: 'hash123',
    checksum: 'checksum123',
    storageVersion: 1,
    configuration: {},
    usageStats: {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalCost: 0,
      avgRequestTime: 0,
      lastResetAt: Date.now(),
    },
    rotationStatus: {
      status: 'none',
      rotationHistory: [],
    },
  };

  it('should return true for valid storage', () => {
    expect(isAPIKeyStorage(validStorage)).toBe(true);
  });

  it('should return false when usageStats is missing', () => {
    const { usageStats, ...rest } = validStorage;
    expect(isAPIKeyStorage(rest)).toBe(false);
  });

  it('should return false when rotationStatus is missing', () => {
    const { rotationStatus, ...rest } = validStorage;
    expect(isAPIKeyStorage(rest)).toBe(false);
  });

  it('should return false when base EncryptedAPIKey is invalid', () => {
    expect(isAPIKeyStorage({ ...validStorage, metadata: {} })).toBe(false);
  });
});

describe('isValidationResult', () => {
  const validResult: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
  };

  it('should return true for valid result', () => {
    expect(isValidationResult(validResult)).toBe(true);
  });

  it('should return true with errors and warnings', () => {
    const result: ValidationResult = {
      isValid: false,
      errors: ['Error 1', 'Error 2'],
      warnings: ['Warning 1'],
    };
    expect(isValidationResult(result)).toBe(true);
  });

  it('should return false for null', () => {
    expect(isValidationResult(null)).toBe(false);
  });

  it('should return false when isValid is wrong type', () => {
    expect(isValidationResult({ ...validResult, isValid: 'true' })).toBe(false);
  });

  it('should return false when errors is not array', () => {
    expect(isValidationResult({ ...validResult, errors: 'error' })).toBe(false);
  });

  it('should return false when warnings is not array', () => {
    expect(isValidationResult({ ...validResult, warnings: 'warning' })).toBe(false);
  });
});
