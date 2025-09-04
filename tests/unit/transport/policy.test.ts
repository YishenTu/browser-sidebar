import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  shouldProxy,
  addToAllowlist,
  removeFromAllowlist,
  addToDenylist,
  removeFromDenylist,
  getAllowlist,
  getDenylist,
  updatePolicyConfig,
  getPolicyConfig,
  resetPolicyConfig,
  isValidDomain,
  type PolicyConfig,
} from '@/transport/policy';

describe('Transport Policy Module', () => {
  // Mock console.warn to avoid noisy test output
  const mockConsoleWarn = vi.fn();
  const originalConsoleWarn = console.warn;

  beforeEach(() => {
    // Reset policy configuration to defaults before each test
    resetPolicyConfig();

    // Mock console.warn
    console.warn = mockConsoleWarn;
    mockConsoleWarn.mockClear();
  });

  afterEach(() => {
    // Restore original console.warn
    console.warn = originalConsoleWarn;

    // Extra reset to ensure clean state
    resetPolicyConfig();
  });

  describe('shouldProxy()', () => {
    describe('with default configuration', () => {
      it('should return true for api.moonshot.cn (default allowlist)', () => {
        expect(shouldProxy('https://api.moonshot.cn/v1/chat')).toBe(true);
      });

      it('should return false for domains not in allowlist', () => {
        expect(shouldProxy('https://api.openai.com/v1/chat')).toBe(false);
        expect(shouldProxy('https://example.com/api')).toBe(false);
      });

      it('should handle www prefixes correctly', () => {
        // Add www.example.com to allowlist
        addToAllowlist('www.example.com');

        // Both www and non-www should work
        expect(shouldProxy('https://www.example.com/api')).toBe(true);
        expect(shouldProxy('https://example.com/api')).toBe(true);
      });

      it('should handle subdomain matching correctly', () => {
        // Add parent domain to allowlist
        addToAllowlist('example.com');

        // Subdomains should be allowed
        expect(shouldProxy('https://api.example.com/v1')).toBe(true);
        expect(shouldProxy('https://cdn.example.com/files')).toBe(true);
        expect(shouldProxy('https://www.example.com/page')).toBe(true);

        // Different domains should not be allowed
        expect(shouldProxy('https://example.org/api')).toBe(false);
        expect(shouldProxy('https://notexample.com/api')).toBe(false);
      });
    });

    describe('with custom allowlist', () => {
      it('should proxy domains in custom allowlist', () => {
        addToAllowlist('custom-api.com');
        addToAllowlist('another-api.net');

        expect(shouldProxy('https://custom-api.com/v1')).toBe(true);
        expect(shouldProxy('https://another-api.net/endpoint')).toBe(true);
      });

      it('should not proxy default domain when overridden', () => {
        addToAllowlist('custom-api.com');

        // Remove default domain
        removeFromAllowlist('api.moonshot.cn');
        expect(shouldProxy('https://api.moonshot.cn/v1')).toBe(false);
        expect(shouldProxy('https://custom-api.com/v1')).toBe(true);
      });
    });

    describe('with denylist', () => {
      it('should not proxy denied domains even if in allowlist', () => {
        // Set up both allowlist and denylist
        addToAllowlist('example.com');
        addToDenylist('blocked.example.com');

        // Parent domain should be allowed
        expect(shouldProxy('https://api.example.com/v1')).toBe(true);

        // But denied subdomain should not be proxied
        expect(shouldProxy('https://blocked.example.com/api')).toBe(false);
      });

      it('should handle denylist precedence over allowlist', () => {
        // Add same domain to both lists
        addToAllowlist('conflict.com');
        addToDenylist('conflict.com');

        // Denylist should take precedence
        expect(shouldProxy('https://conflict.com/api')).toBe(false);
      });

      it('should handle subdomain denylist correctly', () => {
        // Add parent domain to allowlist, subdomain to denylist
        addToAllowlist('example.com');
        addToDenylist('example.com'); // Block the parent

        // All subdomains should be blocked
        expect(shouldProxy('https://example.com/api')).toBe(false);
        expect(shouldProxy('https://api.example.com/v1')).toBe(false);
        expect(shouldProxy('https://www.example.com/page')).toBe(false);
      });
    });

    describe('invalid URL handling', () => {
      it('should return false for invalid URLs', () => {
        expect(shouldProxy('not-a-url')).toBe(false);
        expect(shouldProxy('javascript:alert(1)')).toBe(false);
        expect(shouldProxy('')).toBe(false);
        expect(shouldProxy('ftp://example.com')).toBe(false); // Valid but different protocol
      });

      it('should handle invalid URLs without logging', () => {
        // Since we removed console.warn for production, just verify the behavior
        expect(shouldProxy('invalid-url')).toBe(false);
        expect(mockConsoleWarn).not.toHaveBeenCalled();
      });

      it('should handle malformed URLs gracefully', () => {
        const malformedUrls = [
          'http://',
          'https://',
          'http://.',
          'https://.',
          'http:// example.com',
          'https://[invalid]',
        ];

        malformedUrls.forEach(url => {
          expect(shouldProxy(url)).toBe(false);
        });
      });
    });

    describe('protocol handling', () => {
      it('should handle different protocols correctly', () => {
        addToAllowlist('example.com');

        expect(shouldProxy('https://example.com/api')).toBe(true);
        expect(shouldProxy('http://example.com/api')).toBe(true);
        expect(shouldProxy('ws://example.com/socket')).toBe(true);
        expect(shouldProxy('wss://example.com/socket')).toBe(true);
      });

      it('should handle URLs with ports', () => {
        addToAllowlist('example.com');

        expect(shouldProxy('https://example.com:8080/api')).toBe(true);
        expect(shouldProxy('http://example.com:3000/dev')).toBe(true);
      });

      it('should handle URLs with paths and query parameters', () => {
        addToAllowlist('example.com');

        expect(shouldProxy('https://example.com/api/v1/endpoint?param=value')).toBe(true);
        expect(shouldProxy('https://example.com/path/to/resource#fragment')).toBe(true);
      });
    });
  });

  describe('Allowlist Management', () => {
    describe('addToAllowlist()', () => {
      it('should add new domains to allowlist', () => {
        expect(addToAllowlist('new-domain.com')).toBe(true);
        expect(getAllowlist()).toContain('new-domain.com');
      });

      it('should return false when domain already exists', () => {
        addToAllowlist('existing-domain.com');
        expect(addToAllowlist('existing-domain.com')).toBe(false);
      });

      it('should normalize www prefixes when adding', () => {
        expect(addToAllowlist('www.example.com')).toBe(true);
        expect(getAllowlist()).toContain('example.com');
        expect(getAllowlist()).not.toContain('www.example.com');
      });

      it('should handle domains with www prefix normalization', () => {
        addToAllowlist('www.test.com');
        // Adding the same domain without www should return false
        expect(addToAllowlist('test.com')).toBe(false);
      });
    });

    describe('removeFromAllowlist()', () => {
      beforeEach(() => {
        addToAllowlist('removable-domain.com');
        addToAllowlist('another-domain.com');
      });

      it('should remove existing domains from allowlist', () => {
        expect(removeFromAllowlist('removable-domain.com')).toBe(true);
        expect(getAllowlist()).not.toContain('removable-domain.com');
        expect(getAllowlist()).toContain('another-domain.com'); // Other domains should remain
      });

      it('should return false when domain does not exist', () => {
        expect(removeFromAllowlist('non-existent-domain.com')).toBe(false);
      });

      it('should handle www prefix normalization when removing', () => {
        addToAllowlist('example.com');
        expect(removeFromAllowlist('www.example.com')).toBe(true);
        expect(getAllowlist()).not.toContain('example.com');
      });

      it('should not remove default domains unintentionally', () => {
        const originalDefault = 'api.moonshot.cn';
        expect(getAllowlist()).toContain(originalDefault);
        expect(removeFromAllowlist(originalDefault)).toBe(true);
        expect(getAllowlist()).not.toContain(originalDefault);
      });
    });

    describe('getAllowlist()', () => {
      it('should return copy of allowlist (not reference)', () => {
        const allowlist1 = getAllowlist();
        const allowlist2 = getAllowlist();

        // Should be different objects
        expect(allowlist1).not.toBe(allowlist2);

        // But with same content
        expect(allowlist1).toEqual(allowlist2);
      });

      it('should return default allowlist initially', () => {
        const allowlist = getAllowlist();
        expect(allowlist).toContain('api.moonshot.cn');
        expect(allowlist).toHaveLength(1);
      });

      it('should reflect changes after adding domains', () => {
        addToAllowlist('test1.com');
        addToAllowlist('test2.com');

        const allowlist = getAllowlist();
        expect(allowlist).toContain('test1.com');
        expect(allowlist).toContain('test2.com');
        expect(allowlist).toContain('api.moonshot.cn');
        expect(allowlist).toHaveLength(3);
      });

      it('should not allow external modification of allowlist', () => {
        const allowlist = getAllowlist();
        allowlist.push('hacker-domain.com');

        // Original allowlist should be unchanged
        expect(getAllowlist()).not.toContain('hacker-domain.com');
      });
    });
  });

  describe('Denylist Management', () => {
    describe('addToDenylist()', () => {
      it('should add new domains to denylist', () => {
        expect(addToDenylist('blocked-domain.com')).toBe(true);
        expect(getDenylist()).toContain('blocked-domain.com');
      });

      it('should return false when domain already exists in denylist', () => {
        addToDenylist('existing-blocked.com');
        expect(addToDenylist('existing-blocked.com')).toBe(false);
      });

      it('should initialize denylist if it does not exist', () => {
        // Denylist should be empty initially
        expect(getDenylist()).toEqual([]);

        addToDenylist('first-blocked.com');
        expect(getDenylist()).toContain('first-blocked.com');
      });

      it('should normalize www prefixes when adding to denylist', () => {
        expect(addToDenylist('www.blocked.com')).toBe(true);
        expect(getDenylist()).toContain('blocked.com');
        expect(getDenylist()).not.toContain('www.blocked.com');
      });
    });

    describe('removeFromDenylist()', () => {
      beforeEach(() => {
        addToDenylist('blocked1.com');
        addToDenylist('blocked2.com');
      });

      it('should remove existing domains from denylist', () => {
        expect(removeFromDenylist('blocked1.com')).toBe(true);
        expect(getDenylist()).not.toContain('blocked1.com');
        expect(getDenylist()).toContain('blocked2.com'); // Other domains should remain
      });

      it('should return false when domain does not exist in denylist', () => {
        expect(removeFromDenylist('non-existent.com')).toBe(false);
      });

      it('should return false when denylist is empty or undefined', () => {
        // Reset to have no denylist
        updatePolicyConfig({ proxyDenylist: undefined });
        expect(removeFromDenylist('any-domain.com')).toBe(false);
      });

      it('should handle www prefix normalization when removing from denylist', () => {
        addToDenylist('blocked.com');
        expect(removeFromDenylist('www.blocked.com')).toBe(true);
        expect(getDenylist()).not.toContain('blocked.com');
      });
    });

    describe('getDenylist()', () => {
      it('should return copy of denylist (not reference)', () => {
        addToDenylist('test-blocked.com');

        const denylist1 = getDenylist();
        const denylist2 = getDenylist();

        // Should be different objects
        expect(denylist1).not.toBe(denylist2);

        // But with same content
        expect(denylist1).toEqual(denylist2);
      });

      it('should return empty array initially', () => {
        const denylist = getDenylist();
        expect(denylist).toEqual([]);
        expect(Array.isArray(denylist)).toBe(true);
      });

      it('should return empty array when denylist is undefined', () => {
        updatePolicyConfig({ proxyDenylist: undefined });
        expect(getDenylist()).toEqual([]);
      });

      it('should reflect changes after adding domains', () => {
        addToDenylist('blocked1.com');
        addToDenylist('blocked2.com');

        const denylist = getDenylist();
        expect(denylist).toContain('blocked1.com');
        expect(denylist).toContain('blocked2.com');
        expect(denylist).toHaveLength(2);
      });

      it('should not allow external modification of denylist', () => {
        const denylist = getDenylist();
        denylist.push('hacker-domain.com');

        // Original denylist should be unchanged
        expect(getDenylist()).not.toContain('hacker-domain.com');
      });
    });
  });

  describe('Policy Configuration Management', () => {
    describe('updatePolicyConfig()', () => {
      it('should update allowlist configuration', () => {
        const newConfig: Partial<PolicyConfig> = {
          proxyAllowlist: ['new1.com', 'new2.com'],
        };

        updatePolicyConfig(newConfig);
        expect(getAllowlist()).toEqual(['new1.com', 'new2.com']);
      });

      it('should update denylist configuration', () => {
        const newConfig: Partial<PolicyConfig> = {
          proxyDenylist: ['blocked1.com', 'blocked2.com'],
        };

        updatePolicyConfig(newConfig);
        expect(getDenylist()).toEqual(['blocked1.com', 'blocked2.com']);
      });

      it('should update multiple configuration properties', () => {
        const newConfig: Partial<PolicyConfig> = {
          proxyAllowlist: ['allowed.com'],
          proxyDenylist: ['blocked.com'],
          enablePatternMatching: true,
        };

        updatePolicyConfig(newConfig);

        const config = getPolicyConfig();
        expect(config.proxyAllowlist).toEqual(['allowed.com']);
        expect(config.proxyDenylist).toEqual(['blocked.com']);
        expect(config.enablePatternMatching).toBe(true);
      });

      it('should preserve existing configuration when partially updating', () => {
        // Add some initial data
        addToAllowlist('existing.com');
        addToDenylist('existing-blocked.com');

        // Update only allowlist
        updatePolicyConfig({
          proxyAllowlist: ['new-allowed.com'],
        });

        const config = getPolicyConfig();
        expect(config.proxyAllowlist).toEqual(['new-allowed.com']);
        // Denylist should be preserved (though the reference might change)
        expect(config.proxyDenylist).toEqual(['existing-blocked.com']);
      });
    });

    describe('getPolicyConfig()', () => {
      it('should return copy of current configuration', () => {
        const config1 = getPolicyConfig();
        const config2 = getPolicyConfig();

        // Should be different objects
        expect(config1).not.toBe(config2);
        expect(config1.proxyAllowlist).not.toBe(config2.proxyAllowlist);

        // But with same content
        expect(config1).toEqual(config2);
      });

      it('should return default configuration initially', () => {
        const config = getPolicyConfig();

        expect(config.proxyAllowlist).toEqual(['api.moonshot.cn']);
        expect(config.proxyDenylist).toEqual([]);
        expect(config.enablePatternMatching).toBe(false);
      });

      it('should not allow external modification of returned config', () => {
        const config = getPolicyConfig();
        config.proxyAllowlist.push('hacker-domain.com');

        // Original config should be unchanged
        const freshConfig = getPolicyConfig();
        expect(freshConfig.proxyAllowlist).not.toContain('hacker-domain.com');
      });

      it('should reflect changes made through management functions', () => {
        addToAllowlist('test.com');
        addToDenylist('blocked.com');

        const config = getPolicyConfig();
        expect(config.proxyAllowlist).toContain('test.com');
        expect(config.proxyDenylist).toContain('blocked.com');
      });
    });

    describe('resetPolicyConfig()', () => {
      it('should reset to default configuration', () => {
        // Modify configuration
        addToAllowlist('custom.com');
        addToDenylist('blocked.com');
        updatePolicyConfig({ enablePatternMatching: true });

        // Reset
        resetPolicyConfig();

        // Should be back to defaults
        const config = getPolicyConfig();
        expect(config.proxyAllowlist).toEqual(['api.moonshot.cn']);
        expect(config.proxyDenylist).toEqual([]);
        expect(config.enablePatternMatching).toBe(false);
      });

      it('should clear all custom allowlist entries', () => {
        addToAllowlist('custom1.com');
        addToAllowlist('custom2.com');

        resetPolicyConfig();

        const allowlist = getAllowlist();
        expect(allowlist).toEqual(['api.moonshot.cn']);
        expect(allowlist).not.toContain('custom1.com');
        expect(allowlist).not.toContain('custom2.com');
      });

      it('should clear all denylist entries', () => {
        addToDenylist('blocked1.com');
        addToDenylist('blocked2.com');

        resetPolicyConfig();

        expect(getDenylist()).toEqual([]);
      });
    });
  });

  describe('Domain Validation', () => {
    describe('isValidDomain()', () => {
      it('should validate correct domain formats', () => {
        const validDomains = [
          'example.com',
          'api.example.com',
          'sub.api.example.com',
          'a.b.c.d.example.com',
          'test-domain.com',
          'domain123.com',
          '123domain.com',
          'x.co',
          'very-long-domain-name-that-is-still-valid.com',
        ];

        validDomains.forEach(domain => {
          expect(isValidDomain(domain)).toBe(true);
        });
      });

      it('should reject invalid domain formats', () => {
        const invalidDomains = [
          '', // Empty string
          '.example.com', // Leading dot
          'example.com.', // Trailing dot
          'example..com', // Double dots
          'example-.com', // Hyphen at end of label
          '-example.com', // Hyphen at start of label
          'example.com-', // Hyphen at end
          'example.', // Trailing dot after label
          '.com', // Just TLD with leading dot
          'example_com', // Underscore (invalid in hostnames)
          'example com', // Space
          'http://example.com', // URL instead of domain
          '192.168.1.1', // IP address (not a domain)
        ];

        invalidDomains.forEach(domain => {
          expect(isValidDomain(domain)).toBe(false);
        });
      });

      it('should enforce length limits', () => {
        // Domain too long (over 253 characters)
        const longDomain = 'a'.repeat(250) + '.com';
        expect(isValidDomain(longDomain)).toBe(false);

        // Label too long (over 63 characters)
        const longLabelDomain = 'a'.repeat(64) + '.com';
        expect(isValidDomain(longLabelDomain)).toBe(false);

        // Valid length domain
        const validLengthDomain = 'a'.repeat(50) + '.com';
        expect(isValidDomain(validLengthDomain)).toBe(true);
      });

      it('should handle edge cases', () => {
        // Minimum valid domain
        expect(isValidDomain('a.b')).toBe(true);

        // Numbers in domain
        expect(isValidDomain('123.456')).toBe(true);

        // Mix of letters, numbers, and hyphens
        expect(isValidDomain('a1-b2.c3-d4')).toBe(true);

        // International characters should be rejected (basic ASCII only)
        expect(isValidDomain('café.com')).toBe(false);
        expect(isValidDomain('münchen.de')).toBe(false);
      });
    });
  });

  describe('Subdomain Matching Behavior', () => {
    it('should match subdomains in allowlist', () => {
      addToAllowlist('example.com');

      // Direct domain
      expect(shouldProxy('https://example.com/api')).toBe(true);

      // One level subdomain
      expect(shouldProxy('https://api.example.com/v1')).toBe(true);
      expect(shouldProxy('https://cdn.example.com/files')).toBe(true);

      // Multiple level subdomains
      expect(shouldProxy('https://api.v1.example.com/endpoint')).toBe(true);
      expect(shouldProxy('https://deep.nested.sub.example.com/path')).toBe(true);

      // www subdomain
      expect(shouldProxy('https://www.example.com/page')).toBe(true);
    });

    it('should match subdomains in denylist', () => {
      addToAllowlist('example.com');
      addToDenylist('blocked.example.com');

      // Parent domain should still work
      expect(shouldProxy('https://example.com/api')).toBe(true);
      expect(shouldProxy('https://api.example.com/v1')).toBe(true);

      // Blocked subdomain should not work
      expect(shouldProxy('https://blocked.example.com/api')).toBe(false);

      // Sub-subdomains of blocked should also be blocked
      expect(shouldProxy('https://api.blocked.example.com/v1')).toBe(false);
    });

    it('should not match partial domain names', () => {
      addToAllowlist('example.com');

      // These should NOT match
      expect(shouldProxy('https://notexample.com/api')).toBe(false);
      expect(shouldProxy('https://example.com.evil.com/api')).toBe(false);
      expect(shouldProxy('https://fakeexample.com/api')).toBe(false);
      expect(shouldProxy('https://example.org/api')).toBe(false);
    });

    it('should handle www prefix normalization in subdomain matching', () => {
      // Add with www prefix
      addToAllowlist('www.example.com');

      // Both should work (normalized to example.com)
      expect(shouldProxy('https://www.example.com/api')).toBe(true);
      expect(shouldProxy('https://example.com/api')).toBe(true);

      // Subdomains should work
      expect(shouldProxy('https://api.example.com/v1')).toBe(true);
      expect(shouldProxy('https://cdn.www.example.com/files')).toBe(true);
    });

    it('should handle complex subdomain scenarios', () => {
      // Allow parent domain but deny specific subdomain
      addToAllowlist('company.com');
      addToDenylist('internal.company.com');

      // Public API should work
      expect(shouldProxy('https://api.company.com/public')).toBe(true);
      expect(shouldProxy('https://cdn.company.com/assets')).toBe(true);

      // Internal should be blocked
      expect(shouldProxy('https://internal.company.com/private')).toBe(false);
      expect(shouldProxy('https://api.internal.company.com/secret')).toBe(false);

      // Other subdomains of internal should also be blocked
      expect(shouldProxy('https://deep.internal.company.com/data')).toBe(false);
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete policy workflow', () => {
      // Start with clean slate
      resetPolicyConfig();

      // Add some allowed domains
      expect(addToAllowlist('api1.com')).toBe(true);
      expect(addToAllowlist('api2.com')).toBe(true);

      // Add some blocked domains
      expect(addToDenylist('blocked.api1.com')).toBe(true);

      // Test the policy decisions
      expect(shouldProxy('https://api1.com/endpoint')).toBe(true);
      expect(shouldProxy('https://api2.com/endpoint')).toBe(true);
      expect(shouldProxy('https://blocked.api1.com/endpoint')).toBe(false);
      expect(shouldProxy('https://unknown.com/endpoint')).toBe(false);

      // Modify configuration
      expect(removeFromAllowlist('api2.com')).toBe(true);
      expect(shouldProxy('https://api2.com/endpoint')).toBe(false);

      // Reset and verify
      resetPolicyConfig();
      expect(shouldProxy('https://api1.com/endpoint')).toBe(false);
      expect(shouldProxy('https://api.moonshot.cn/endpoint')).toBe(true); // Default restored
    });

    it('should maintain policy consistency across operations', () => {
      // Build complex policy
      addToAllowlist('service.com');
      addToAllowlist('api.service.com');
      addToDenylist('restricted.service.com');

      // Get baseline configuration
      const config1 = getPolicyConfig();

      // Perform some operations
      addToAllowlist('newservice.com');
      removeFromAllowlist('service.com');
      addToDenylist('newservice.com'); // Add to both lists

      // Verify policy decisions are consistent
      expect(shouldProxy('https://api.service.com/v1')).toBe(true); // Still allowed
      expect(shouldProxy('https://service.com/api')).toBe(false); // Removed from allowlist
      expect(shouldProxy('https://restricted.service.com/data')).toBe(false); // Still denied
      expect(shouldProxy('https://newservice.com/api')).toBe(false); // Denied takes precedence

      // Configuration should reflect all changes
      const config2 = getPolicyConfig();
      expect(config2.proxyAllowlist).toContain('api.service.com');
      expect(config2.proxyAllowlist).toContain('newservice.com');
      expect(config2.proxyAllowlist).not.toContain('service.com');
      expect(config2.proxyDenylist).toContain('restricted.service.com');
      expect(config2.proxyDenylist).toContain('newservice.com');
    });
  });
});
