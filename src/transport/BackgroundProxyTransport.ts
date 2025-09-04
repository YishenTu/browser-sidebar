/**
 * BackgroundProxyTransport implementation for CORS-restricted endpoints
 *
 * Proxies requests through the background service worker to handle CORS restrictions
 * using the existing proxy infrastructure in background/proxyHandler.ts
 */

import {
  Transport,
  TransportRequest,
  TransportResponse,
  TransportNetworkError,
  TransportAbortError,
} from './types';
import { shouldProxy } from '@transport/policy';
import { createMessage } from '../types/messages';
import { sendMessage, connect } from '@platform/chrome/runtime';

/**
 * ProxyRequest interface (inlined to avoid import issues)
 */
interface ProxyRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

/**
 * Port-based streaming message types (matching proxyHandler.ts)
 */
type ProxyStreamStart = {
  type: 'start';
  headers?: Record<string, string>;
  status?: number;
  statusText?: string;
};

type ProxyStreamChunk = {
  type: 'chunk';
  chunk: string;
};

type ProxyStreamEnd = {
  type: 'end';
};

type ProxyStreamError = {
  type: 'error';
  message?: string;
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
};

type ProxyStreamMessage = ProxyStreamStart | ProxyStreamChunk | ProxyStreamEnd | ProxyStreamError;

/**
 * Response type for PROXY_REQUEST messages
 */
interface ProxyResponse {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body?: string;
  error?: string;
}

/**
 * BackgroundProxyTransport implementation
 * Routes requests through background service worker for CORS handling
 */
export class BackgroundProxyTransport implements Transport {
  /**
   * Convert TransportRequest to ProxyRequest format
   */
  private toProxyRequest(request: TransportRequest): ProxyRequest {
    return {
      url: request.url,
      method: request.method,
      headers: request.headers,
      body: request.body as string | undefined,
    };
  }

  /**
   * Convert headers object to Headers instance
   */
  private toHeaders(headers: Record<string, string>): Headers {
    const headersInstance = new Headers();
    for (const [key, value] of Object.entries(headers)) {
      headersInstance.set(key, value);
    }
    return headersInstance;
  }

  /**
   * Make a standard HTTP request through background proxy
   */
  async request(request: TransportRequest): Promise<TransportResponse> {
    // Check if this URL needs proxying via centralized policy
    if (!shouldProxy(request.url)) {
      throw new TransportNetworkError(`URL does not require proxying: ${request.url}`);
    }

    // Handle abort signal
    if (request.signal?.aborted) {
      throw new TransportAbortError('Request was aborted');
    }

    const proxyRequest = this.toProxyRequest(request);

    const message = createMessage({
      type: 'PROXY_REQUEST',
      source: 'sidebar',
      target: 'background',
      payload: proxyRequest,
    });

    return new Promise((resolve, reject) => {
      // Set up abort signal listener
      let abortListener: (() => void) | undefined;
      if (request.signal) {
        abortListener = () => {
          reject(new TransportAbortError('Request was aborted'));
        };
        request.signal.addEventListener('abort', abortListener, { once: true });
      }

      const cleanup = () => {
        if (request.signal && abortListener) {
          request.signal.removeEventListener('abort', abortListener);
        }
      };

      sendMessage(message as Record<string, unknown>)
        .then(result => {
          cleanup();

          if (!result.success || result.error) {
            reject(
              new TransportNetworkError(
                `Chrome runtime error: ${result.error?.message || 'Unknown error'}`
              )
            );
            return;
          }

          const response = result.data as ProxyResponse;

          // Handle missing response
          if (!response) {
            reject(new TransportNetworkError('No response from background proxy'));
            return;
          }

          // Convert proxy response to transport response format
          const transportResponse: TransportResponse = {
            status: response.status,
            statusText: response.statusText,
            headers: this.toHeaders(response.headers || {}),
          };

          // Handle error responses
          if (!response.ok) {
            transportResponse.body = response.body || response.error || 'Request failed';
          } else {
            transportResponse.body = response.body;
          }

          resolve(transportResponse);
        })
        .catch(error => {
          cleanup();
          reject(new TransportNetworkError(`Failed to send message: ${error.message}`));
        });
    });
  }

  /**
   * Make a streaming HTTP request through background proxy port
   * Returns an async iterable for consuming the stream
   */
  async *stream(request: TransportRequest): AsyncIterable<Uint8Array> {
    // Check if this URL needs proxying via centralized policy
    if (!shouldProxy(request.url)) {
      throw new TransportNetworkError(`URL does not require proxying: ${request.url}`);
    }

    // Handle abort signal
    if (request.signal?.aborted) {
      throw new TransportAbortError('Request was aborted');
    }

    const proxyRequest = this.toProxyRequest(request);
    const port = connect({ name: 'proxy-stream' });
    const encoder = new TextEncoder();

    let streamStarted = false;
    let streamEnded = false;
    let error: Error | null = null;
    const chunks: Uint8Array[] = [];
    let resolveChunk: ((chunk: Uint8Array | null) => void) | null = null;

    // Set up abort signal listener
    let abortListener: (() => void) | undefined;
    if (request.signal) {
      abortListener = () => {
        error = new TransportAbortError('Request was aborted');
        streamEnded = true;
        if (resolveChunk) {
          resolveChunk(null);
        }
        try {
          port.disconnect();
        } catch {
          // Ignore disconnect errors
        }
      };
      request.signal.addEventListener('abort', abortListener, { once: true });
    }

    const cleanup = () => {
      if (request.signal && abortListener) {
        request.signal.removeEventListener('abort', abortListener);
      }
    };

    // Handle port messages
    port.onMessage.addListener((raw: unknown) => {
      if (!raw || typeof raw !== 'object') return;

      const msg = raw as ProxyStreamMessage;
      switch (msg.type) {
        case 'start':
          streamStarted = true;
          // For streaming, we don't need to do anything special with headers
          // The caller will handle response metadata differently
          break;

        case 'chunk':
          if (streamStarted && !streamEnded) {
            const chunk = encoder.encode(msg.chunk);
            if (resolveChunk) {
              resolveChunk(chunk);
              resolveChunk = null;
            } else {
              chunks.push(chunk);
            }
          }
          break;

        case 'end':
          streamEnded = true;
          if (resolveChunk) {
            resolveChunk(null);
            resolveChunk = null;
          }
          cleanup();
          try {
            port.disconnect();
          } catch {
            // Ignore disconnect errors
          }
          break;

        case 'error':
          error = new TransportNetworkError(
            msg.message || 'Proxy stream error',
            new Error(`Status: ${msg.status}, StatusText: ${msg.statusText}`)
          );
          streamEnded = true;
          if (resolveChunk) {
            resolveChunk(null);
            resolveChunk = null;
          }
          cleanup();
          try {
            port.disconnect();
          } catch {
            // Ignore disconnect errors
          }
          break;
      }
    });

    // Handle port disconnect
    port.onDisconnect.addListener(() => {
      if (!streamEnded) {
        streamEnded = true;
        if (resolveChunk) {
          resolveChunk(null);
          resolveChunk = null;
        }
        cleanup();
      }
    });

    // Start the request
    port.postMessage(proxyRequest);

    // Generator function to yield chunks
    try {
      while (!streamEnded || chunks.length > 0) {
        // Check for errors
        if (error) {
          throw error;
        }

        // Yield any buffered chunks first
        if (chunks.length > 0) {
          yield chunks.shift()!;
          continue;
        }

        // If stream is ended and no more chunks, break
        if (streamEnded) {
          break;
        }

        // Wait for next chunk
        const chunk = await new Promise<Uint8Array | null>(resolve => {
          resolveChunk = resolve;
        });

        if (chunk === null) {
          // Stream ended or aborted
          break;
        }

        yield chunk;
      }
    } finally {
      cleanup();
      try {
        port.disconnect();
      } catch {
        // Ignore disconnect errors
      }
    }
  }
}
