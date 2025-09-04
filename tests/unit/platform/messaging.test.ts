/**
 * Smoke tests for ChromeMessageBus wrapper
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Minimal chrome runtime mock that the wrapper expects on init
const onMessageListeners: Array<
  (msg: unknown, sender?: unknown, sendResponse?: unknown) => unknown
> = [];
const mockChrome: any = {
  runtime: {
    onMessage: {
      addListener: vi.fn((fn: any) => {
        onMessageListeners.push(fn);
      }),
      removeListener: vi.fn((fn: any) => {
        const i = onMessageListeners.indexOf(fn);
        if (i >= 0) onMessageListeners.splice(i, 1);
      }),
    },
  },
};

// Mock the extension messaging module before importing the SUT
vi.mock('@/extension/messaging', () => {
  // Define stub bus inside the factory (hoisted safe)
  class StubMessageBus {
    send = vi.fn(async (_type: unknown, _payload?: unknown) => ({
      success: true,
      data: { ok: true },
    }));
    sendWithRetry = vi.fn(async (_type: any, payload?: any) => {
      // Simulate async delivery and then emit a matching RESPONSE via chrome.onMessage
      setTimeout(() => {
        const requestId = payload?._requestId || `req_${Math.random().toString(36).slice(2)}`;
        const response = {
          id: `resp_${Math.random().toString(36).slice(2)}`,
          type: 'PONG',
          source: 'background',
          target: 'sidebar',
          timestamp: Date.now(),
          payload: { _isResponse: true, _requestId: requestId, echoed: payload },
        };
        onMessageListeners.forEach(fn => fn(response, {}, () => {}));
      }, 0);
      return { success: true, data: { retried: false } };
    });
    subscribe = vi.fn(() => vi.fn());
    request = vi.fn(async (_type: unknown, payload?: unknown) => ({ echoed: payload }));
    broadcast = vi.fn(async () => [{ success: true, data: { ok: true } }]);
    on = vi.fn(() => vi.fn());
    once = vi.fn(() => vi.fn());
    healthCheck = vi.fn(async () => ({ background: true, content: true, sidebar: true }));
    destroy = vi.fn();
  }
  const bus = new StubMessageBus();
  return {
    MessageBus: StubMessageBus,
    getMessageBus: () => bus,
    ping: vi.fn(async () => true),
  };
});

// Types and helpers from messaging wrapper
import {
  initializeChromeMessaging,
  resetChromeMessageBus,
  sendChromeMessage,
  requestResponse,
  broadcastMessage,
  checkMessagingHealth,
} from '@/platform/chrome/messaging';

describe('ChromeMessageBus (smoke)', () => {
  beforeEach(() => {
    // Attach chrome mock before first initialize
    Object.defineProperty(global, 'chrome', { value: mockChrome, writable: true });
    resetChromeMessageBus();
  });

  afterEach(() => {
    resetChromeMessageBus();
  });

  it('initializes and can send with retry', async () => {
    const bus = initializeChromeMessaging('background');
    expect(bus).toBeTruthy();
    const res = await sendChromeMessage('PING');
    expect(res.success).toBe(true);
  });

  it('supports request/response helper', async () => {
    initializeChromeMessaging('background');
    const result = await requestResponse('ECHO', { value: 42 });
    expect(result).toMatchObject({ echoed: { value: 42 } });
  });

  it('broadcasts and returns aggregated results', async () => {
    initializeChromeMessaging('content');
    const results = await broadcastMessage('PING', {}, ['background', 'sidebar']);
    expect(Array.isArray(results)).toBe(true);
    expect(results[0]?.success).toBe(true);
  });

  it('health check returns per-target booleans', async () => {
    initializeChromeMessaging('sidebar');
    const health = await checkMessagingHealth(['background', 'content']);
    expect(health.background).toBe(true);
    expect(health.content).toBe(true);
  });
});
