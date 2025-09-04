/**
 * Smoke tests for EnhancedKeepAlive and re-exported base keepAlive
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Minimal chrome API used by keepAlive internals
const mockChrome: any = {
  runtime: {
    getPlatformInfo: vi.fn(() =>
      Promise.resolve({ os: 'mac', arch: 'x86-64', nacl_arch: 'x86-64' })
    ),
  },
  storage: {
    local: {
      getBytesInUse: vi.fn(() => Promise.resolve(0)),
    },
  },
};

// Mock the base keepAlive implementation used by the wrapper
vi.mock('@/extension/background/keepAlive', () => {
  let running = false;
  class KeepAlive {
    start() {
      if (running) return false;
      running = true;
      return true;
    }
    stop() {
      if (!running) return false;
      running = false;
      return true;
    }
    isActive() {
      return running;
    }
  }
  const getKeepAlive = () => new KeepAlive();
  return {
    KeepAlive,
    getKeepAlive,
    startKeepAlive: () => getKeepAlive().start(),
    stopKeepAlive: () => getKeepAlive().stop(),
    isKeepAliveActive: () => new KeepAlive().isActive(),
  };
});

import {
  startEnhancedKeepAlive,
  stopEnhancedKeepAlive,
  isEnhancedKeepAliveActive,
  getEnhancedKeepAliveStats,
  startKeepAlive,
  stopKeepAlive,
  isKeepAliveActive,
} from '@/platform/chrome/keepAlive';

describe('KeepAlive (smoke)', () => {
  beforeEach(() => {
    Object.defineProperty(global, 'chrome', { value: mockChrome, writable: true });
  });

  afterEach(() => {
    // no-op
  });

  it('starts and stops enhanced keepAlive (timer strategy)', async () => {
    const started = await startEnhancedKeepAlive({ strategy: 'timer', interval: 5_000 });
    expect(started).toBe(true);
    expect(isEnhancedKeepAliveActive()).toBe(true);

    const stats = getEnhancedKeepAliveStats();
    expect(stats).not.toBeNull();
    expect(stats?.isActive).toBe(true);

    const stopped = stopEnhancedKeepAlive();
    expect(stopped).toBe(true);
  });

  it('re-exported base functions are callable', async () => {
    // These come from the mocked base implementation
    const s1 = await startKeepAlive({ interval: 1_000 });
    expect(typeof s1).toBe('boolean');
    const active = isKeepAliveActive();
    expect(typeof active).toBe('boolean');
    const s2 = stopKeepAlive();
    expect(typeof s2).toBe('boolean');
  });
});
