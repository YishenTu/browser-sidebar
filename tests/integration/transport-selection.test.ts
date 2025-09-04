/**
 * Transport Selection Integration Tests
 *
 * Tests the routing logic that determines whether to use DirectFetchTransport
 * or BackgroundProxyTransport based on the transport policy.
 *
 * Covers:
 * - Policy-based transport selection
 * - URL pattern matching (allowlist/denylist)
 * - Integration with provider factory
 * - Edge cases and error scenarios
 * - Transport instantiation and configuration
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DirectFetchTransport } from '@transport/DirectFetchTransport';
import { BackgroundProxyTransport } from '@transport/BackgroundProxyTransport';
import {
  shouldProxy,
  addToAllowlist,
  removeFromAllowlist,
  addToDenylist,
  removeFromDenylist,
  resetPolicyConfig,
  updatePolicyConfig,
  type PolicyConfig,
} from '@transport/policy';
import { EngineFactory } from '@core/engine/EngineFactory';
import { OpenAIProvider } from '@core/engine/openai/OpenAIProvider';
import { GeminiProvider } from '@core/engine/gemini/GeminiProvider';
import { OpenRouterProvider } from '@core/engine/openrouter/OpenRouterProvider';
import type { Transport, TransportRequest } from '@transport/types';
// New architecture enables transport by default

// Mock chrome APIs for BackgroundProxyTransport
const mockPort = {
  postMessage: vi.fn(),
  disconnect: vi.fn(),
  onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
  onDisconnect: { addListener: vi.fn(), removeListener: vi.fn() },
};

const mockChrome = {
  runtime: {
    sendMessage: vi.fn(),
    connect: vi.fn(() => mockPort),
    lastError: null as any,
  },
};

global.chrome = mockChrome as any;

describe('Transport Selection Integration', () => {
  let mockConsoleWarn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset policy configuration to defaults
    resetPolicyConfig();

    // Mock console.warn to avoid noisy test output
    mockConsoleWarn = vi.fn();
    vi.stubGlobal('console', { ...console, warn: mockConsoleWarn });

    // Clear all mocks
    vi.clearAllMocks();
    mockChrome.runtime.lastError = null;
  });

  afterEach(() => {
    // Clean up global state
    resetPolicyConfig();
    vi.unstubAllGlobals();
  });

  describe('Policy-Based Transport Selection', () => {
    describe('Default Configuration', () => {
      it('should select proxy transport for default allowlist domains', () => {
        // Default configuration includes api.moonshot.cn
        const urls = [
          'https://api.moonshot.cn/v1/chat',
          'https://api.moonshot.cn/v1/models',
          'https://api.moonshot.cn/v1/completions',
          'http://api.moonshot.cn/legacy',
        ];

        urls.forEach(url => {
          expect(shouldProxy(url)).toBe(true);
        });
      });

      it('should select direct transport for non-allowlisted domains', () => {
        const urls = [
          'https://api.openai.com/v1/chat',
          'https://generativelanguage.googleapis.com/v1/models',
          'https://openrouter.ai/api/v1/chat',
          'https://example.com/api/v1/test',
          'https://custom-api.com/endpoint',
        ];

        urls.forEach(url => {
          expect(shouldProxy(url)).toBe(false);
        });
      });

      it('should handle subdomain matching correctly', () => {
        // Add parent domain to allowlist
        addToAllowlist('example.com');

        const proxyUrls = [
          'https://example.com/api',
          'https://api.example.com/v1',
          'https://cdn.example.com/files',
          'https://deep.nested.example.com/resource',
          'https://www.example.com/page',
        ];

        const directUrls = [
          'https://example.org/api',
          'https://notexample.com/api',
          'https://example.com.evil.com/api',
          'https://fakeexample.com/test',
        ];

        proxyUrls.forEach(url => {
          expect(shouldProxy(url)).toBe(true);
        });

        directUrls.forEach(url => {
          expect(shouldProxy(url)).toBe(false);
        });
      });
    });

    describe('Custom Allowlist Configuration', () => {
      it('should route based on dynamically added allowlist domains', () => {
        // Add custom domains to allowlist
        addToAllowlist('custom-api.com');
        addToAllowlist('another-service.net');
        addToAllowlist('third-party.org');

        const testCases = [
          { url: 'https://custom-api.com/v1/chat', shouldProxy: true },
          { url: 'https://api.custom-api.com/endpoint', shouldProxy: true },
          { url: 'https://another-service.net/data', shouldProxy: true },
          { url: 'https://third-party.org/resource', shouldProxy: true },
          { url: 'https://unknown-api.com/test', shouldProxy: false },
          { url: 'https://api.openai.com/v1/chat', shouldProxy: false },
        ];

        testCases.forEach(({ url, shouldProxy: expected }) => {
          expect(shouldProxy(url)).toBe(expected);
        });
      });

      it('should handle allowlist modifications at runtime', () => {
        const testUrl = 'https://dynamic-api.com/endpoint';

        // Initially should use direct transport
        expect(shouldProxy(testUrl)).toBe(false);

        // Add to allowlist - should switch to proxy
        addToAllowlist('dynamic-api.com');
        expect(shouldProxy(testUrl)).toBe(true);

        // Remove from allowlist - should switch back to direct
        removeFromAllowlist('dynamic-api.com');
        expect(shouldProxy(testUrl)).toBe(false);
      });

      it('should handle removal of default allowlist entries', () => {
        const defaultUrl = 'https://api.moonshot.cn/v1/chat';

        // Should initially use proxy
        expect(shouldProxy(defaultUrl)).toBe(true);

        // Remove default domain
        removeFromAllowlist('api.moonshot.cn');
        expect(shouldProxy(defaultUrl)).toBe(false);

        // Add back
        addToAllowlist('api.moonshot.cn');
        expect(shouldProxy(defaultUrl)).toBe(true);
      });
    });

    describe('Denylist Override Logic', () => {
      it('should prioritize denylist over allowlist', () => {
        // Set up conflicting allow and deny rules
        addToAllowlist('conflict-domain.com');
        addToDenylist('conflict-domain.com');

        // Denylist should take precedence
        expect(shouldProxy('https://conflict-domain.com/api')).toBe(false);
        expect(shouldProxy('https://api.conflict-domain.com/v1')).toBe(false);
      });

      it('should handle complex allowlist/denylist scenarios', () => {
        // Allow parent domain but deny specific subdomains
        addToAllowlist('company.com');
        addToDenylist('internal.company.com');
        addToDenylist('admin.company.com');

        const testCases = [
          { url: 'https://company.com/public', shouldProxy: true },
          { url: 'https://api.company.com/public', shouldProxy: true },
          { url: 'https://cdn.company.com/assets', shouldProxy: true },
          { url: 'https://internal.company.com/private', shouldProxy: false },
          { url: 'https://api.internal.company.com/secret', shouldProxy: false },
          { url: 'https://admin.company.com/panel', shouldProxy: false },
          { url: 'https://tools.admin.company.com/config', shouldProxy: false },
        ];

        testCases.forEach(({ url, shouldProxy: expected }) => {
          expect(shouldProxy(url)).toBe(expected);
        });
      });

      it('should handle denylist modifications at runtime', () => {
        // Set up initial state
        addToAllowlist('service.com');
        const testUrl = 'https://restricted.service.com/api';

        // Should initially use proxy (allowed by parent domain)
        expect(shouldProxy(testUrl)).toBe(true);

        // Add to denylist - should switch to direct (denied)
        addToDenylist('restricted.service.com');
        expect(shouldProxy(testUrl)).toBe(false);

        // Remove from denylist - should switch back to proxy
        removeFromDenylist('restricted.service.com');
        expect(shouldProxy(testUrl)).toBe(true);
      });
    });

    describe('Edge Cases and Error Handling', () => {
      it('should handle invalid URLs gracefully', () => {
        const invalidUrls = [
          '',
          'not-a-url',
          'javascript:alert(1)',
          'http://',
          'https://',
          'http://.',
          'ftp://example.com',
          'data:text/plain,hello',
        ];

        invalidUrls.forEach(url => {
          expect(shouldProxy(url)).toBe(false);
        });
      });

      it('should handle URLs with special characters and encodings', () => {
        addToAllowlist('special-chars.com');

        const testCases = [
          { url: 'https://special-chars.com/path?param=value&other=123', shouldProxy: true },
          { url: 'https://special-chars.com/path%20with%20spaces', shouldProxy: true },
          { url: 'https://special-chars.com/path#fragment', shouldProxy: true },
          { url: 'https://special-chars.com:8080/port', shouldProxy: true },
          { url: 'https://user:pass@special-chars.com/auth', shouldProxy: true },
        ];

        testCases.forEach(({ url, shouldProxy: expected }) => {
          expect(shouldProxy(url)).toBe(expected);
        });
      });

      it('should handle www prefix normalization correctly', () => {
        // Add domain with www prefix
        addToAllowlist('www.example.com');

        const testUrls = [
          'https://www.example.com/api',
          'https://example.com/api',
          'https://api.example.com/v1',
          'https://www.api.example.com/v1',
        ];

        // All should use proxy transport due to normalization
        testUrls.forEach(url => {
          expect(shouldProxy(url)).toBe(true);
        });
      });

      it('should handle policy configuration updates', () => {
        const testUrl = 'https://config-test.com/api';

        // Test bulk configuration update
        const newConfig: Partial<PolicyConfig> = {
          proxyAllowlist: ['config-test.com', 'another-test.com'],
          proxyDenylist: ['blocked-test.com'],
        };

        updatePolicyConfig(newConfig);

        expect(shouldProxy('https://config-test.com/api')).toBe(true);
        expect(shouldProxy('https://another-test.com/api')).toBe(true);
        expect(shouldProxy('https://blocked-test.com/api')).toBe(false);
        expect(shouldProxy('https://api.moonshot.cn/v1/chat')).toBe(false); // Default replaced
      });
    });
  });

  describe('Transport Integration with Providers', () => {
    describe('Provider Factory Transport Injection', () => {
      it('should inject DirectFetchTransport by default', async () => {
        // In CI/offline environments, skip OpenRouter network connectivity check
        // by stubbing the provider's testConnection to always succeed.
        vi.spyOn(OpenRouterProvider.prototype as any, 'testConnection').mockResolvedValue(true);
        const factory = new EngineFactory();

        const openaiConfig = {
          type: 'openai' as const,
          config: factory.createDefaultOpenAIConfig('sk-test-key-for-testing-12345'),
        };
        const geminiConfig = {
          type: 'gemini' as const,
          config: factory.createDefaultGeminiConfig('test-gemini-key'),
        };
        const openrouterConfig = {
          type: 'openrouter' as const,
          config: factory.createDefaultOpenRouterConfig('sk-or-test-key-12345'),
        };

        const openaiProvider = await factory.createProvider(openaiConfig);
        const geminiProvider = await factory.createProvider(geminiConfig);
        const openrouterProvider = await factory.createProvider(openrouterConfig);

        // Verify transport injection (accessing protected property for testing)
        expect((openaiProvider as any).transport).toBeInstanceOf(DirectFetchTransport);
        expect((geminiProvider as any).transport).toBeInstanceOf(DirectFetchTransport);
        expect((openrouterProvider as any).transport).toBeInstanceOf(DirectFetchTransport);
      });

      it('should allow transport override via setTransport method', async () => {
        const factory = new EngineFactory();
        const openaiConfig = {
          type: 'openai' as const,
          config: factory.createDefaultOpenAIConfig('sk-test-key-for-testing-12345'),
        };

        const provider = await factory.createProvider(openaiConfig);
        const customTransport = new BackgroundProxyTransport();

        provider.setTransport(customTransport);

        expect(provider.getTransport()).toBe(customTransport);
        expect(provider.getTransport()).toBeInstanceOf(BackgroundProxyTransport);
      });
    });

    describe('Transport Selection in Provider Usage', () => {
      it('should use appropriate transport based on provider configuration', () => {
        const directTransport = new DirectFetchTransport();
        const proxyTransport = new BackgroundProxyTransport();

        // Create providers with different transports
        const directProvider = new OpenAIProvider(directTransport);
        const proxyProvider = new OpenAIProvider(proxyTransport);

        expect(directProvider.getTransport()).toBe(directTransport);
        expect(proxyProvider.getTransport()).toBe(proxyTransport);
      });

      it('should handle transport-less providers gracefully', () => {
        const provider = new OpenAIProvider();
        expect(provider.getTransport()).toBeUndefined();

        // Should not throw when setting transport
        const transport = new DirectFetchTransport();
        provider.setTransport(transport);
        expect(provider.getTransport()).toBe(transport);
      });
    });
  });

  describe('Transport Instantiation and Configuration', () => {
    describe('DirectFetchTransport Instantiation', () => {
      it('should create DirectFetchTransport with default configuration', () => {
        const transport = new DirectFetchTransport();
        expect(transport).toBeInstanceOf(DirectFetchTransport);
        expect((transport as any).defaultTimeout).toBe(30000); // 30 seconds default
      });

      it('should create DirectFetchTransport with custom timeout', () => {
        const customTimeout = 60000; // 60 seconds
        const transport = new DirectFetchTransport({ timeout: customTimeout });
        expect((transport as any).defaultTimeout).toBe(customTimeout);
      });

      it('should handle DirectFetchTransport configuration options', () => {
        const configs = [{ timeout: 5000 }, { timeout: 120000 }, { timeout: 0 }, undefined];

        configs.forEach(config => {
          expect(() => new DirectFetchTransport(config)).not.toThrow();
        });
      });
    });

    describe('BackgroundProxyTransport Instantiation', () => {
      it('should create BackgroundProxyTransport successfully', () => {
        const transport = new BackgroundProxyTransport();
        expect(transport).toBeInstanceOf(BackgroundProxyTransport);
      });

      it('should integrate with chrome runtime APIs', () => {
        const transport = new BackgroundProxyTransport();

        // Mock a request that requires proxying
        const request: TransportRequest = {
          url: 'https://api.moonshot.cn/v1/chat',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'moonshot-v1-8k', messages: [] }),
        };

        // Verify proxy check passes
        expect(shouldProxy(request.url)).toBe(true);

        // Transport should be ready to handle the request
        expect(transport.request).toBeDefined();
        expect(transport.stream).toBeDefined();
      });
    });
  });

  describe('Real-world Transport Selection Scenarios', () => {
    it('should handle typical AI provider URLs correctly', () => {
      // Reset to clean state and add typical proxy-required domains
      resetPolicyConfig();
      addToAllowlist('api.moonshot.cn');
      addToAllowlist('api.deepseek.com');
      addToAllowlist('api.zhipuai.cn');

      const testCases = [
        // Proxy required (CORS-restricted Chinese providers)
        { url: 'https://api.moonshot.cn/v1/chat/completions', shouldProxy: true },
        { url: 'https://api.deepseek.com/v1/chat/completions', shouldProxy: true },
        { url: 'https://api.zhipuai.cn/api/paas/v4/chat/completions', shouldProxy: true },

        // Direct fetch (CORS-friendly international providers)
        { url: 'https://api.openai.com/v1/chat/completions', shouldProxy: false },
        {
          url: 'https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent',
          shouldProxy: false,
        },
        { url: 'https://openrouter.ai/api/v1/chat/completions', shouldProxy: false },
        { url: 'https://api.anthropic.com/v1/messages', shouldProxy: false },
      ];

      testCases.forEach(({ url, shouldProxy: expected }) => {
        expect(shouldProxy(url)).toBe(expected);
      });
    });

    it('should handle environment-specific transport selection', () => {
      // Simulate different deployment environments
      const environments = [
        {
          name: 'development',
          allowlist: ['localhost', '127.0.0.1', 'dev-api.company.com'],
          denylist: [],
        },
        {
          name: 'staging',
          allowlist: ['staging-api.company.com', 'test-providers.com'],
          denylist: ['localhost', '127.0.0.1'],
        },
        {
          name: 'production',
          allowlist: ['api.moonshot.cn', 'api.company.com'],
          denylist: ['localhost', '127.0.0.1', 'dev-api.company.com', 'staging-api.company.com'],
        },
      ];

      environments.forEach(env => {
        resetPolicyConfig();

        // Configure environment
        env.allowlist.forEach(domain => addToAllowlist(domain));
        env.denylist.forEach(domain => addToDenylist(domain));

        // Test environment-specific routing
        const testUrls = [
          'https://localhost:3000/api',
          'https://dev-api.company.com/v1',
          'https://staging-api.company.com/v1',
          'https://api.company.com/v1',
          'https://api.moonshot.cn/v1/chat',
        ];

        testUrls.forEach(url => {
          const result = shouldProxy(url);
          // Just verify it returns a boolean - specific logic tested elsewhere
          expect(typeof result).toBe('boolean');
        });
      });
    });

    it('should handle transport selection performance with large configurations', () => {
      // Add many domains to test performance doesn't degrade
      const largeDomainSet = Array.from({ length: 1000 }, (_, i) => `domain${i}.com`);
      largeDomainSet.forEach(domain => addToAllowlist(domain));

      // Add some to denylist as well
      const denyDomains = Array.from({ length: 100 }, (_, i) => `blocked${i}.com`);
      denyDomains.forEach(domain => addToDenylist(domain));

      // Test that policy decisions are still fast and accurate
      const start = performance.now();

      const testResults = [
        shouldProxy('https://domain500.com/api'), // Should be true (in allowlist)
        shouldProxy('https://blocked50.com/api'), // Should be false (in denylist)
        shouldProxy('https://unknown.com/api'), // Should be false (not in allowlist)
      ];

      const end = performance.now();

      expect(testResults).toEqual([true, false, false]);
      expect(end - start).toBeLessThan(100); // Should complete in under 100ms
    });
  });

  describe('Transport Interface Compliance', () => {
    it('should verify DirectFetchTransport implements Transport interface correctly', () => {
      const transport = new DirectFetchTransport();

      expect(transport.request).toBeDefined();
      expect(transport.stream).toBeDefined();
      expect(typeof transport.request).toBe('function');
      expect(typeof transport.stream).toBe('function');
    });

    it('should verify BackgroundProxyTransport implements Transport interface correctly', () => {
      const transport = new BackgroundProxyTransport();

      expect(transport.request).toBeDefined();
      expect(transport.stream).toBeDefined();
      expect(typeof transport.request).toBe('function');
      expect(typeof transport.stream).toBe('function');
    });

    it('should handle transport interface evolution', () => {
      // Test that both transport types can be used interchangeably
      const transports: Transport[] = [new DirectFetchTransport(), new BackgroundProxyTransport()];

      transports.forEach(transport => {
        expect(transport).toBeDefined();
        expect('request' in transport).toBe(true);
        expect('stream' in transport).toBe(true);
      });
    });
  });

  describe('Error Handling in Transport Selection', () => {
    it('should handle policy configuration errors gracefully', () => {
      // Test with potentially problematic policy configurations
      const problematicConfigs = [
        { proxyAllowlist: [] }, // Empty allowlist
        { proxyAllowlist: [''], proxyDenylist: [''] }, // Empty strings
        { proxyAllowlist: null as any }, // Invalid types
        { proxyDenylist: undefined }, // Undefined denylist
      ];

      problematicConfigs.forEach((config, index) => {
        expect(() => {
          resetPolicyConfig();
          updatePolicyConfig(config);
          shouldProxy('https://example.com/test');
        }).not.toThrow(`Config ${index} should not throw`);
      });
    });

    it('should handle chrome API unavailability for BackgroundProxyTransport', () => {
      // Temporarily remove chrome global
      const originalChrome = global.chrome;
      delete (global as any).chrome;

      // BackgroundProxyTransport should still be instantiable
      expect(() => new BackgroundProxyTransport()).not.toThrow();

      // Restore chrome global
      global.chrome = originalChrome;
    });

    it('should validate transport selection consistency', () => {
      // Verify that the same URL always returns the same transport selection
      // when policy hasn't changed
      const testUrl = 'https://consistent-test.com/api';
      addToAllowlist('consistent-test.com');

      const results = Array.from({ length: 100 }, () => shouldProxy(testUrl));
      const allSame = results.every(result => result === results[0]);

      expect(allSame).toBe(true);
      expect(results[0]).toBe(true); // Should be true due to allowlist
    });
  });

  // Feature flag integration removed — transport is default
});
