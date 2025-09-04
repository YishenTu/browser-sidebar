/**
 * Copy of transport-only OpenAICompatClient for compat provider shims
 */
import type { OpenAICompatibleConfig } from '@/types/providers';
import { BackgroundProxyTransport, DirectFetchTransport, shouldProxy } from '@/transport';

export class OpenAICompatClient {
  private config: OpenAICompatibleConfig;
  private readonly transport: BackgroundProxyTransport | DirectFetchTransport;

  constructor(config: OpenAICompatibleConfig) {
    this.config = config;
    this.transport = shouldProxy(config.baseURL)
      ? new BackgroundProxyTransport()
      : new DirectFetchTransport();
  }

  async *streamCompletion(
    request: Record<string, unknown>,
    signal?: AbortSignal
  ): AsyncIterable<unknown> {
    const url = `${this.config.baseURL.replace(/\/$/, '')}/chat/completions`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
      ...(this.config.headers || {}),
    };
    const transportRequest = {
      url,
      method: 'POST' as const,
      headers,
      body: JSON.stringify({ ...request, stream: true }),
      stream: true,
      signal,
    };
    const decoder = new TextDecoder();
    let buffer = '';
    for await (const chunk of this.transport.stream(transportRequest)) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        try {
          yield JSON.parse(data);
        } catch {
          /* ignore */
        }
      }
    }
  }

  async testConnection(): Promise<boolean> {
    return !!(this.config.apiKey && this.config.baseURL);
  }
  getConfig(): OpenAICompatibleConfig {
    return this.config;
  }
}
