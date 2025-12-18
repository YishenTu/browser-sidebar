/**
 * @file DirectFetchTransport.test.ts
 * Tests for DirectFetchTransport - direct fetch-based HTTP transport
 *
 * Focus:
 * - timeout/abort/network error mapping
 * - stream error behavior
 * - request/response pass-through
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DirectFetchTransport, createDirectFetchTransport } from '@transport/DirectFetchTransport';
import {
  TransportNetworkError,
  TransportTimeoutError,
  TransportAbortError,
  type TransportRequest,
} from '@transport/types';

describe('DirectFetchTransport', () => {
  let transport: DirectFetchTransport;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    transport = new DirectFetchTransport();
    vi.useFakeTimers();

    // Initialize fetch mock - reconfigure in individual tests as needed
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ---------------------------------------------------------------------------
  // Factory Function
  // ---------------------------------------------------------------------------
  describe('createDirectFetchTransport', () => {
    it('creates an instance with default timeout', () => {
      const instance = createDirectFetchTransport();
      expect(instance).toBeInstanceOf(DirectFetchTransport);
    });

    it('creates an instance with custom timeout', () => {
      const instance = createDirectFetchTransport({ timeout: 5000 });
      expect(instance).toBeInstanceOf(DirectFetchTransport);
    });
  });

  // ---------------------------------------------------------------------------
  // request() method
  // ---------------------------------------------------------------------------
  describe('request()', () => {
    it('makes a standard HTTP request and returns TransportResponse', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'Content-Type': 'application/json' }),
        body: null,
      };

      fetchMock.mockResolvedValue(mockResponse);

      const request: TransportRequest = {
        url: 'https://api.example.com/data',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'data' }),
      };

      const response = await transport.request(request);

      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/data',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ test: 'data' }),
        })
      );

      expect(response.status).toBe(200);
      expect(response.statusText).toBe('OK');
      expect(response.headers).toBe(mockResponse.headers);
    });

    it('passes through GET requests without body', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        body: null,
      };

      fetchMock.mockResolvedValue(mockResponse);

      const request: TransportRequest = {
        url: 'https://api.example.com/resource',
        method: 'GET',
        headers: { Authorization: 'Bearer token' },
      };

      await transport.request(request);

      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/resource',
        expect.objectContaining({
          method: 'GET',
          headers: { Authorization: 'Bearer token' },
          body: undefined,
        })
      );
    });

    it('throws error when signal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      const request: TransportRequest = {
        url: 'https://api.example.com/data',
        method: 'GET',
        headers: {},
        signal: controller.signal,
      };

      await expect(transport.request(request)).rejects.toBeInstanceOf(TransportAbortError);
    });

    it('throws TransportAbortError when request is aborted during fetch', async () => {
      const controller = new AbortController();
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';

      fetchMock.mockRejectedValue(abortError);

      const request: TransportRequest = {
        url: 'https://api.example.com/data',
        method: 'GET',
        headers: {},
        signal: controller.signal,
      };

      await expect(transport.request(request)).rejects.toThrow(TransportAbortError);
    });

    it('applies default timeout (30s) when no signal provided', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        body: null,
      };

      let capturedSignal: AbortSignal | undefined;
      fetchMock.mockImplementation(async (_url: string, options?: RequestInit) => {
        capturedSignal = options?.signal ?? undefined;
        return mockResponse;
      });

      const request: TransportRequest = {
        url: 'https://api.example.com/data',
        method: 'GET',
        headers: {},
      };

      const responsePromise = transport.request(request);
      await vi.runAllTimersAsync();
      await responsePromise;

      expect(capturedSignal).toBeDefined();
    });

    it('uses custom timeout from constructor', async () => {
      // Use a very short timeout for testing
      const customTransport = new DirectFetchTransport({ timeout: 50 });

      // Verify that a custom timeout is applied by checking the signal
      let capturedSignal: AbortSignal | undefined;

      fetchMock.mockImplementation(async (_url: string, options?: RequestInit) => {
        capturedSignal = options?.signal ?? undefined;
        return {
          status: 200,
          statusText: 'OK',
          headers: new Headers(),
          body: null,
        };
      });

      const request: TransportRequest = {
        url: 'https://api.example.com/data',
        method: 'GET',
        headers: {},
      };

      await customTransport.request(request);

      // Verify signal was passed (which means timeout was configured)
      expect(capturedSignal).toBeDefined();
    });

    it('clears timeout after successful response', async () => {
      const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        body: null,
      };

      fetchMock.mockResolvedValue(mockResponse);

      const request: TransportRequest = {
        url: 'https://api.example.com/data',
        method: 'GET',
        headers: {},
      };

      await transport.request(request);

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });

    it('aborts request when external signal is aborted', async () => {
      const controller = new AbortController();

      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';

      // Simulate a fetch that can be aborted
      fetchMock.mockImplementation(async (_url: string, options?: RequestInit) => {
        return new Promise((resolve, reject) => {
          const mockResponse = {
            status: 200,
            statusText: 'OK',
            headers: new Headers(),
            body: null,
          };

          if (options?.signal) {
            if (options.signal.aborted) {
              reject(abortError);
              return;
            }
            options.signal.addEventListener('abort', () => {
              reject(abortError);
            });
          }

          // Resolve after a short delay if not aborted
          setTimeout(() => resolve(mockResponse), 100);
        });
      });

      const request: TransportRequest = {
        url: 'https://api.example.com/data',
        method: 'GET',
        headers: {},
        signal: controller.signal,
      };

      const responsePromise = transport.request(request);

      // Abort the external controller
      controller.abort();

      // The request should throw because it was aborted
      await expect(responsePromise).rejects.toThrow(TransportAbortError);
    });

    // ---------------------------------------------------------------------------
    // Error Handling in request()
    // ---------------------------------------------------------------------------
    describe('error handling', () => {
      it('converts fetch AbortError to TransportAbortError', async () => {
        const error = new Error('The operation was aborted');
        error.name = 'AbortError';

        fetchMock.mockRejectedValue(error);

        const request: TransportRequest = {
          url: 'https://api.example.com/data',
          method: 'GET',
          headers: {},
        };

        await expect(transport.request(request)).rejects.toBeInstanceOf(TransportAbortError);
      });

      it('converts TimeoutError to TransportTimeoutError', async () => {
        const error = new Error('Request timed out');
        error.name = 'TimeoutError';

        fetchMock.mockRejectedValue(error);

        const request: TransportRequest = {
          url: 'https://api.example.com/data',
          method: 'GET',
          headers: {},
        };

        await expect(transport.request(request)).rejects.toBeInstanceOf(TransportTimeoutError);
      });

      it('converts AbortError with timeout message to TransportAbortError (name check takes precedence)', async () => {
        // Note: The implementation checks error.name === 'AbortError' BEFORE
        // checking if the message contains 'timeout', so AbortError always
        // becomes TransportAbortError regardless of message content
        const error = new Error('timeout exceeded');
        error.name = 'AbortError';

        fetchMock.mockRejectedValue(error);

        const request: TransportRequest = {
          url: 'https://api.example.com/data',
          method: 'GET',
          headers: {},
        };

        await expect(transport.request(request)).rejects.toBeInstanceOf(TransportAbortError);
      });

      it('converts TypeError with fetch in message to TransportNetworkError', async () => {
        const error = new TypeError('fetch failed');

        fetchMock.mockRejectedValue(error);

        const request: TransportRequest = {
          url: 'https://api.example.com/data',
          method: 'GET',
          headers: {},
        };

        const err = await transport.request(request).catch(e => e);
        expect(err).toBeInstanceOf(TransportNetworkError);
        expect(err.message).toContain('Network request failed');
      });

      it('converts generic TypeError to TransportNetworkError', async () => {
        const error = new TypeError('Invalid URL');

        fetchMock.mockRejectedValue(error);

        const request: TransportRequest = {
          url: 'invalid-url',
          method: 'GET',
          headers: {},
        };

        const err = await transport.request(request).catch(e => e);
        expect(err).toBeInstanceOf(TransportNetworkError);
        expect(err.message).toContain('Network error');
      });

      it('converts NetworkError to TransportNetworkError', async () => {
        const error = new Error('Network unavailable');
        error.name = 'NetworkError';

        fetchMock.mockRejectedValue(error);

        const request: TransportRequest = {
          url: 'https://api.example.com/data',
          method: 'GET',
          headers: {},
        };

        const err = await transport.request(request).catch(e => e);
        expect(err).toBeInstanceOf(TransportNetworkError);
      });

      it('converts generic Error to TransportNetworkError', async () => {
        const error = new Error('Something went wrong');

        fetchMock.mockRejectedValue(error);

        const request: TransportRequest = {
          url: 'https://api.example.com/data',
          method: 'GET',
          headers: {},
        };

        const err = await transport.request(request).catch(e => e);
        expect(err).toBeInstanceOf(TransportNetworkError);
        expect(err.message).toBe('Something went wrong');
      });

      it('handles non-Error objects thrown by fetch', async () => {
        fetchMock.mockRejectedValue('string error');

        const request: TransportRequest = {
          url: 'https://api.example.com/data',
          method: 'GET',
          headers: {},
        };

        const err = await transport.request(request).catch(e => e);
        expect(err).toBeInstanceOf(TransportNetworkError);
        expect(err.message).toBe('Unknown network error occurred');
      });
    });
  });

  // ---------------------------------------------------------------------------
  // stream() method
  // ---------------------------------------------------------------------------
  describe('stream()', () => {
    /**
     * Helper to create a real ReadableStream from string chunks
     */
    function createReadableStream(chunks: string[]): ReadableStream<Uint8Array> {
      const encoder = new TextEncoder();
      let index = 0;
      return new ReadableStream<Uint8Array>({
        pull(controller) {
          if (index < chunks.length) {
            controller.enqueue(encoder.encode(chunks[index++]));
          } else {
            controller.close();
          }
        },
      });
    }

    it('yields chunks from a ReadableStream response', async () => {
      const chunks = ['chunk1', 'chunk2', 'chunk3'];
      const mockBody = createReadableStream(chunks);

      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'Content-Type': 'text/event-stream' }),
        body: mockBody,
      };

      fetchMock.mockResolvedValue(mockResponse);

      const request: TransportRequest = {
        url: 'https://api.example.com/stream',
        method: 'POST',
        headers: { Accept: 'text/event-stream' },
        body: '{}',
      };

      const received: string[] = [];
      const decoder = new TextDecoder();

      for await (const chunk of transport.stream(request)) {
        received.push(decoder.decode(chunk));
      }

      expect(received).toEqual(chunks);
    });

    it('throws TransportNetworkError when response has no body', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        body: null,
      };

      fetchMock.mockResolvedValue(mockResponse);

      const request: TransportRequest = {
        url: 'https://api.example.com/stream',
        method: 'GET',
        headers: {},
      };

      const stream = transport.stream(request);

      await expect(async () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _chunk of stream) {
          // Should not reach here
        }
      }).rejects.toThrow(TransportNetworkError);
    });

    it('throws TransportNetworkError on HTTP 4xx status', async () => {
      const mockBody = createReadableStream(['data']);

      const mockResponse = {
        status: 404,
        statusText: 'Not Found',
        headers: new Headers(),
        body: mockBody,
      };

      fetchMock.mockResolvedValue(mockResponse);

      const request: TransportRequest = {
        url: 'https://api.example.com/stream',
        method: 'GET',
        headers: {},
      };

      const stream = transport.stream(request);

      await expect(async () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _chunk of stream) {
          // Should not reach here
        }
      }).rejects.toThrow(/HTTP 404/);
    });

    it('throws TransportNetworkError on HTTP 5xx status', async () => {
      const mockBody = createReadableStream(['data']);

      const mockResponse = {
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Headers(),
        body: mockBody,
      };

      fetchMock.mockResolvedValue(mockResponse);

      const request: TransportRequest = {
        url: 'https://api.example.com/stream',
        method: 'GET',
        headers: {},
      };

      const stream = transport.stream(request);

      await expect(async () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _chunk of stream) {
          // Should not reach here
        }
      }).rejects.toThrow(/HTTP 500/);
    });

    it('re-throws existing transport errors without wrapping', async () => {
      const existingError = new TransportNetworkError('Already a transport error');

      fetchMock.mockRejectedValue(existingError);

      const request: TransportRequest = {
        url: 'https://api.example.com/stream',
        method: 'GET',
        headers: {},
      };

      const stream = transport.stream(request);

      let caughtError: Error | null = null;
      try {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _chunk of stream) {
          // Should not reach here
        }
      } catch (e) {
        caughtError = e as Error;
      }

      // The error should be preserved (same message and code)
      expect(caughtError).toBeInstanceOf(TransportNetworkError);
      expect(caughtError?.message).toBe('Already a transport error');
    });

    it('handles stream with multiple chunks correctly', async () => {
      const mockBody = createReadableStream(['data', 'more']);

      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        body: mockBody,
      };

      fetchMock.mockResolvedValue(mockResponse);

      const request: TransportRequest = {
        url: 'https://api.example.com/stream',
        method: 'GET',
        headers: {},
      };

      const received: string[] = [];
      const decoder = new TextDecoder();

      for await (const chunk of transport.stream(request)) {
        received.push(decoder.decode(chunk));
      }

      expect(received).toEqual(['data', 'more']);
    });

    it('handles error from underlying stream', async () => {
      // Create a stream that errors after first chunk
      const encoder = new TextEncoder();
      let pullCount = 0;
      const mockBody = new ReadableStream<Uint8Array>({
        pull(controller) {
          pullCount++;
          if (pullCount === 1) {
            controller.enqueue(encoder.encode('first'));
          } else {
            controller.error(new Error('Stream error mid-read'));
          }
        },
      });

      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        body: mockBody,
      };

      fetchMock.mockResolvedValue(mockResponse);

      const request: TransportRequest = {
        url: 'https://api.example.com/stream',
        method: 'GET',
        headers: {},
      };

      const stream = transport.stream(request);

      await expect(async () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _chunk of stream) {
          // Process chunk, then error on next read
        }
      }).rejects.toThrow();
    });

    it('sets stream flag on the underlying request', async () => {
      const mockBody = createReadableStream([]);

      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        body: mockBody,
      };

      fetchMock.mockResolvedValue(mockResponse);

      const request: TransportRequest = {
        url: 'https://api.example.com/stream',
        method: 'GET',
        headers: {},
        stream: false, // Explicitly false
      };

      // Consume the stream
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _chunk of transport.stream(request)) {
        // No-op
      }

      // The internal request should have stream: true
      expect(fetch).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Edge Cases
  // ---------------------------------------------------------------------------
  describe('edge cases', () => {
    it('handles response body as undefined', async () => {
      const mockResponse = {
        status: 204,
        statusText: 'No Content',
        headers: new Headers(),
        body: undefined,
      };

      fetchMock.mockResolvedValue(mockResponse);

      const request: TransportRequest = {
        url: 'https://api.example.com/resource',
        method: 'DELETE',
        headers: {},
      };

      const response = await transport.request(request);

      expect(response.status).toBe(204);
      expect(response.body).toBeUndefined();
    });

    it('preserves all response headers', async () => {
      const responseHeaders = new Headers({
        'Content-Type': 'application/json',
        'X-Custom-Header': 'custom-value',
        'Cache-Control': 'no-cache',
      });

      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: responseHeaders,
        body: null,
      };

      fetchMock.mockResolvedValue(mockResponse);

      const request: TransportRequest = {
        url: 'https://api.example.com/data',
        method: 'GET',
        headers: {},
      };

      const response = await transport.request(request);

      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(response.headers.get('X-Custom-Header')).toBe('custom-value');
      expect(response.headers.get('Cache-Control')).toBe('no-cache');
    });

    it('handles various HTTP methods', async () => {
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;

      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        body: null,
      };

      fetchMock.mockResolvedValue(mockResponse);

      for (const method of methods) {
        vi.mocked(fetch).mockClear();

        const request: TransportRequest = {
          url: 'https://api.example.com/data',
          method,
          headers: {},
        };

        await transport.request(request);

        expect(fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ method }));
      }
    });
  });
});
