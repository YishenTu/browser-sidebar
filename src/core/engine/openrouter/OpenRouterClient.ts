/**
 * Minimal stub of OpenRouterClient for tests (transport-only runtime doesn't use it).
 */
import type { OpenRouterConfig } from '@/types/providers';

export class OpenRouterClient {
  // Keep the constructor signature for mocks
  constructor(private _config: OpenRouterConfig) {}
  // Legacy shape for tests that may call these
  getClient(): {
    chat: {
      completions: {
        create: () => Promise<{ [Symbol.asyncIterator](): AsyncGenerator<never, void, unknown> }>;
      };
    };
  } {
    return {
      chat: { completions: { create: async () => ({ async *[Symbol.asyncIterator]() {} }) } },
    };
  }
  async testConnection(): Promise<boolean> {
    return !!this._config?.apiKey;
  }
  updateConfig(cfg: OpenRouterConfig): void {
    this._config = cfg;
  }
}
