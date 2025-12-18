/**
 * @file Transport Policy Tests
 *
 * Tests for the transport policy module that determines routing
 * for HTTP requests (direct vs proxy).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  shouldProxy,
  isValidDomain,
  addToAllowlist,
  removeFromAllowlist,
  addToDenylist,
  removeFromDenylist,
  getAllowlist,
  getDenylist,
  resetPolicyConfig,
  updatePolicyConfig,
  getPolicyConfig,
} from '@transport/policy';

describe('shouldProxy', () => {
  beforeEach(() => {
    resetPolicyConfig();
  });

  describe('invalid URLs', () => {
    it('should return false for invalid URL', () => {
      expect(shouldProxy('not-a-url')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(shouldProxy('')).toBe(false);
    });

    it('should return false for URL without protocol', () => {
      expect(shouldProxy('example.com/path')).toBe(false);
    });
  });

  describe('allowlist matching', () => {
    it('should return true for exact domain match in allowlist', () => {
      expect(shouldProxy('https://api.moonshot.cn/endpoint')).toBe(true);
    });

    it('should return true for subdomain match', () => {
      addToAllowlist('example.com');
      expect(shouldProxy('https://api.example.com/path')).toBe(true);
    });

    it('should return false for non-allowlisted domain', () => {
      expect(shouldProxy('https://api.openai.com/v1/chat')).toBe(false);
    });

    it('should handle www. prefix normalization', () => {
      addToAllowlist('example.com');
      expect(shouldProxy('https://www.example.com/path')).toBe(true);
    });

    it('should normalize www. in allowlist entries', () => {
      addToAllowlist('www.example.com');
      expect(shouldProxy('https://example.com/path')).toBe(true);
    });
  });

  describe('denylist precedence', () => {
    it('should return false for denylisted domain even if allowlisted', () => {
      addToAllowlist('example.com');
      addToDenylist('blocked.example.com');

      expect(shouldProxy('https://blocked.example.com/path')).toBe(false);
    });

    it('should allow non-denied subdomains when parent is allowlisted', () => {
      addToAllowlist('example.com');
      addToDenylist('blocked.example.com');

      expect(shouldProxy('https://api.example.com/path')).toBe(true);
    });

    it('should deny subdomains of denied parent', () => {
      addToAllowlist('example.com');
      addToDenylist('api.example.com');

      expect(shouldProxy('https://v1.api.example.com/path')).toBe(false);
    });
  });

  describe('subdomain matching', () => {
    it('should match direct subdomains', () => {
      addToAllowlist('api.example.com');
      expect(shouldProxy('https://api.example.com/path')).toBe(true);
    });

    it('should match nested subdomains', () => {
      addToAllowlist('example.com');
      expect(shouldProxy('https://v1.api.example.com/path')).toBe(true);
    });

    it('should not match partial domain names', () => {
      addToAllowlist('example.com');
      // 'notexample.com' should NOT match 'example.com'
      expect(shouldProxy('https://notexample.com/path')).toBe(false);
    });
  });
});

describe('isValidDomain', () => {
  it('should return true for valid domain', () => {
    expect(isValidDomain('example.com')).toBe(true);
    expect(isValidDomain('api.example.com')).toBe(true);
    expect(isValidDomain('sub.domain.example.com')).toBe(true);
  });

  it('should return true for domain with hyphens', () => {
    expect(isValidDomain('my-domain.com')).toBe(true);
    expect(isValidDomain('api-v2.example.com')).toBe(true);
  });

  it('should return false for IPv4 addresses', () => {
    expect(isValidDomain('192.168.1.1')).toBe(false);
    expect(isValidDomain('10.0.0.1')).toBe(false);
    expect(isValidDomain('127.0.0.1')).toBe(false);
  });

  it('should return false for invalid formats', () => {
    expect(isValidDomain('')).toBe(false);
    expect(isValidDomain('.')).toBe(false);
    expect(isValidDomain('.com')).toBe(false);
    expect(isValidDomain('example.')).toBe(false);
  });

  it('should return false for domains exceeding length limit', () => {
    const longDomain = 'a'.repeat(254) + '.com';
    expect(isValidDomain(longDomain)).toBe(false);
  });

  it('should return false for domains with invalid characters', () => {
    expect(isValidDomain('example_domain.com')).toBe(false);
    expect(isValidDomain('example domain.com')).toBe(false);
  });

  it('should handle edge cases for label length', () => {
    // Maximum label length is 63 characters
    const maxLabel = 'a'.repeat(63);
    expect(isValidDomain(`${maxLabel}.com`)).toBe(true);

    const tooLongLabel = 'a'.repeat(64);
    expect(isValidDomain(`${tooLongLabel}.com`)).toBe(false);
  });
});

describe('allowlist management', () => {
  beforeEach(() => {
    resetPolicyConfig();
  });

  describe('addToAllowlist', () => {
    it('should add new domain and return true', () => {
      const result = addToAllowlist('new.example.com');

      expect(result).toBe(true);
      expect(getAllowlist()).toContain('new.example.com');
    });

    it('should return false for duplicate domain', () => {
      addToAllowlist('example.com');
      const result = addToAllowlist('example.com');

      expect(result).toBe(false);
    });

    it('should normalize www. prefix', () => {
      addToAllowlist('www.example.com');

      expect(getAllowlist()).toContain('example.com');
    });
  });

  describe('removeFromAllowlist', () => {
    it('should remove existing domain and return true', () => {
      addToAllowlist('example.com');
      const result = removeFromAllowlist('example.com');

      expect(result).toBe(true);
      expect(getAllowlist()).not.toContain('example.com');
    });

    it('should return false for non-existent domain', () => {
      const result = removeFromAllowlist('nonexistent.com');

      expect(result).toBe(false);
    });

    it('should normalize www. prefix', () => {
      addToAllowlist('example.com');
      const result = removeFromAllowlist('www.example.com');

      expect(result).toBe(true);
    });
  });

  describe('getAllowlist', () => {
    it('should return copy of allowlist', () => {
      const list = getAllowlist();
      list.push('modified.com');

      expect(getAllowlist()).not.toContain('modified.com');
    });
  });
});

describe('denylist management', () => {
  beforeEach(() => {
    resetPolicyConfig();
  });

  describe('addToDenylist', () => {
    it('should add new domain and return true', () => {
      const result = addToDenylist('blocked.com');

      expect(result).toBe(true);
      expect(getDenylist()).toContain('blocked.com');
    });

    it('should return false for duplicate domain', () => {
      addToDenylist('blocked.com');
      const result = addToDenylist('blocked.com');

      expect(result).toBe(false);
    });
  });

  describe('removeFromDenylist', () => {
    it('should remove existing domain and return true', () => {
      addToDenylist('blocked.com');
      const result = removeFromDenylist('blocked.com');

      expect(result).toBe(true);
      expect(getDenylist()).not.toContain('blocked.com');
    });

    it('should return false for non-existent domain', () => {
      const result = removeFromDenylist('nonexistent.com');

      expect(result).toBe(false);
    });
  });

  describe('getDenylist', () => {
    it('should return copy of denylist', () => {
      addToDenylist('blocked.com');
      const list = getDenylist();
      list.push('modified.com');

      expect(getDenylist()).not.toContain('modified.com');
    });

    it('should return empty array when no denylist', () => {
      expect(getDenylist()).toEqual([]);
    });
  });
});

describe('resetPolicyConfig', () => {
  it('should restore default allowlist', () => {
    addToAllowlist('custom.com');
    resetPolicyConfig();

    expect(getAllowlist()).toContain('api.moonshot.cn');
    expect(getAllowlist()).not.toContain('custom.com');
  });

  it('should clear denylist', () => {
    addToDenylist('blocked.com');
    resetPolicyConfig();

    expect(getDenylist()).toEqual([]);
  });

  it('should reset enablePatternMatching', () => {
    updatePolicyConfig({ enablePatternMatching: true });
    resetPolicyConfig();

    expect(getPolicyConfig().enablePatternMatching).toBe(false);
  });
});

describe('updatePolicyConfig', () => {
  beforeEach(() => {
    resetPolicyConfig();
  });

  it('should update partial config', () => {
    updatePolicyConfig({ enablePatternMatching: true });

    const config = getPolicyConfig();
    expect(config.enablePatternMatching).toBe(true);
    // Original allowlist should be preserved
    expect(config.proxyAllowlist).toContain('api.moonshot.cn');
  });

  it('should replace allowlist when provided', () => {
    updatePolicyConfig({ proxyAllowlist: ['new.com'] });

    expect(getAllowlist()).toEqual(['new.com']);
  });
});

describe('getPolicyConfig', () => {
  beforeEach(() => {
    resetPolicyConfig();
  });

  it('should return copy of config', () => {
    const config = getPolicyConfig();
    config.proxyAllowlist.push('modified.com');

    expect(getAllowlist()).not.toContain('modified.com');
  });

  it('should include all config properties', () => {
    const config = getPolicyConfig();

    expect(config).toHaveProperty('proxyAllowlist');
    expect(config).toHaveProperty('proxyDenylist');
    expect(config).toHaveProperty('enablePatternMatching');
  });
});
