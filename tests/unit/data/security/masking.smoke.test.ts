/**
 * @file masking.smoke.test.ts
 * Smoke tests for data masking module
 *
 * Tests the core masking functionality including:
 * - maskText: input validation, irreversible/partial masking
 * - validateMaskPermission: permission validation and expiration
 * - createMaskingKey: key generation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  maskText,
  validateMaskPermission,
  createMaskingKey,
  type MaskPermission,
} from '@/data/security/masking';

describe('masking smoke tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('maskText - input validation', () => {
    it('throws on non-string input', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect(maskText(123 as any, 'irreversible')).rejects.toThrow(
        'Invalid input: text must be a string'
      );
    });

    it('throws on invalid mask type', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect(maskText('test', 'invalid' as any)).rejects.toThrow('Invalid mask type');
    });

    it('handles empty string', async () => {
      const result = await maskText('', 'irreversible');
      expect(result.maskedText).toBe('');
      expect(result.canUnmask).toBe(false);
    });
  });

  describe('maskText - irreversible', () => {
    it('masks alphanumeric characters with asterisks', async () => {
      const result = await maskText('Hello123', 'irreversible');
      expect(result.maskedText).toBe('********');
      expect(result.maskType).toBe('irreversible');
      expect(result.canUnmask).toBe(false);
    });

    it('preserves special characters', async () => {
      const result = await maskText('Hello-World!', 'irreversible');
      expect(result.maskedText).toBe('*****-*****!');
    });

    it('preserves spaces', async () => {
      const result = await maskText('Hello World', 'irreversible');
      expect(result.maskedText).toBe('***** *****');
    });
  });

  describe('maskText - partial', () => {
    it('masks with default showLast=4', async () => {
      const result = await maskText('1234567890', 'partial');
      expect(result.maskedText).toBe('******7890');
    });

    it('preserves formatting characters with preserveFormatting=true', async () => {
      const result = await maskText('123-45-6789', 'partial', {
        partialOptions: { showFirst: 0, showLast: 4, preserveFormatting: true },
      });
      expect(result.maskedText).toBe('***-**-6789');
    });

    it('handles short strings', async () => {
      const result = await maskText('123', 'partial', {
        partialOptions: { showFirst: 0, showLast: 4 },
      });
      // String is shorter than showLast, so it should be unmasked
      expect(result.maskedText).toBe('123');
    });

    it('handles custom showFirst and showLast', async () => {
      const result = await maskText('1234567890', 'partial', {
        partialOptions: { showFirst: 2, showLast: 2, preserveFormatting: false },
      });
      expect(result.maskedText).toBe('12******90');
    });
  });

  describe('validateMaskPermission', () => {
    it('returns false when permission not granted', async () => {
      const permission: MaskPermission = {
        granted: false,
        reason: 'test',
        timestamp: new Date(),
      };
      expect(await validateMaskPermission(permission)).toBe(false);
    });

    it('returns true for valid authorized_user permission', async () => {
      const permission: MaskPermission = {
        granted: true,
        reason: 'authorized_user',
        timestamp: new Date(),
      };
      expect(await validateMaskPermission(permission)).toBe(true);
    });

    it('returns true for admin_override permission', async () => {
      const permission: MaskPermission = {
        granted: true,
        reason: 'admin_override',
        timestamp: new Date(),
      };
      expect(await validateMaskPermission(permission)).toBe(true);
    });

    it('returns false for invalid permission reason', async () => {
      const permission: MaskPermission = {
        granted: true,
        reason: 'invalid_reason',
        timestamp: new Date(),
      };
      expect(await validateMaskPermission(permission)).toBe(false);
    });

    it('returns false when permission is expired', async () => {
      const permission: MaskPermission = {
        granted: true,
        reason: 'authorized_user',
        timestamp: new Date(Date.now() - 10000), // 10 seconds ago
        expiresIn: 5000, // 5 seconds expiration
      };
      expect(await validateMaskPermission(permission)).toBe(false);
    });

    it('returns true when permission is not yet expired', async () => {
      const permission: MaskPermission = {
        granted: true,
        reason: 'authorized_user',
        timestamp: new Date(Date.now() - 2000), // 2 seconds ago
        expiresIn: 5000, // 5 seconds expiration
      };
      expect(await validateMaskPermission(permission)).toBe(true);
    });
  });

  describe('createMaskingKey', () => {
    it('generates a hex string key', async () => {
      const key = await createMaskingKey('test-purpose');
      expect(key).toMatch(/^[0-9a-f]{64}$/);
    });

    it('generates different keys for different purposes', async () => {
      const key1 = await createMaskingKey('purpose1');
      // Advance time to ensure different timestamp
      vi.advanceTimersByTime(1);
      const key2 = await createMaskingKey('purpose2');
      expect(key1).not.toBe(key2);
    });

    it('generates different keys for same purpose at different times', async () => {
      const key1 = await createMaskingKey('same-purpose');
      vi.advanceTimersByTime(1);
      const key2 = await createMaskingKey('same-purpose');
      // Keys should be different because of random component
      expect(key1).not.toBe(key2);
    });
  });

  describe('MaskingResult properties', () => {
    it('includes originalLength in result', async () => {
      const result = await maskText('Hello World', 'irreversible');
      expect(result.originalLength).toBe(11);
    });

    it('includes preservedFormatting flag for partial masking', async () => {
      const result = await maskText('123-456', 'partial', {
        partialOptions: { preserveFormatting: true },
      });
      expect(result.preservedFormatting).toBe(true);
    });
  });
});
