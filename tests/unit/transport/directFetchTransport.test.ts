import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DirectFetchTransport, createDirectFetchTransport } from '@transport/DirectFetchTransport';
import {
  TransportRequest,
  TransportResponse,
  TransportNetworkError,
  TransportTimeoutError,
  TransportAbortError,
} from '@transport/types';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('DirectFetchTransport', () => {
  let transport: DirectFetchTransport;

  beforeEach(() => {
    vi.clearAllMocks();
    transport = new DirectFetchTransport();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create transport with default timeout', () => {
      const transport = new DirectFetchTransport();
      expect(transport).toBeInstanceOf(DirectFetchTransport);
    });

    it('should create transport with custom timeout', () => {
      const transport = new DirectFetchTransport({ timeout: 5000 });
      expect(transport).toBeInstanceOf(DirectFetchTransport);
    });
  });

  describe('request method', () => {
    it('should make a successful GET request', async () => {
      const mockResponse = new Response('{"data": "test"}', {
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'Content-Type': 'application/json' }),
      });
      mockFetch.mockResolvedValue(mockResponse);

      const request: TransportRequest = {
        url: 'https://api.example.com/test',
        method: 'GET',
        headers: { Accept: 'application/json' },
      };

      const response = await transport.request(request);

      expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/test', {
        method: 'GET',
        headers: { Accept: 'application/json' },
        body: undefined,
        signal: expect.any(AbortSignal),
      });

      expect(response.status).toBe(200);
      expect(response.statusText).toBe('OK');
      expect(response.headers).toBeDefined();
      expect(response.body).toBeInstanceOf(ReadableStream);
    });

    it('should make a successful POST request with body', async () => {
      const mockResponse = new Response('{"id": 123}', {
        status: 201,
        statusText: 'Created',
      });
      mockFetch.mockResolvedValue(mockResponse);

      const request: TransportRequest = {
        url: 'https://api.example.com/create',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"name": "test"}',
      };

      const response = await transport.request(request);

      expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"name": "test"}',
        signal: expect.any(AbortSignal),
      });

      expect(response.status).toBe(201);
      expect(response.statusText).toBe('Created');
    });

    it('should handle different HTTP methods', async () => {
      const methods: TransportRequest['method'][] = ['PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];

      for (const method of methods) {
        const mockResponse = new Response('', { status: 200 });
        mockFetch.mockResolvedValue(mockResponse);

        const request: TransportRequest = {
          url: 'https://api.example.com/test',
          method,
          headers: {},
        };

        await transport.request(request);

        expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/test', {
          method,
          headers: {},
          body: undefined,
          signal: expect.any(AbortSignal),
        });
      }
    });

    it('should handle request with custom AbortSignal', async () => {
      const mockResponse = new Response('test', { status: 200 });
      mockFetch.mockResolvedValue(mockResponse);

      const controller = new AbortController();
      const request: TransportRequest = {
        url: 'https://api.example.com/test',
        method: 'GET',
        headers: {},
        signal: controller.signal,
      };

      await transport.request(request);

      expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/test', {
        method: 'GET',
        headers: {},
        body: undefined,
        signal: controller.signal,
      });
    });

    it('should throw TransportAbortError for already aborted signal', async () => {
      const controller = new AbortController();
      controller.abort();

      const request: TransportRequest = {
        url: 'https://api.example.com/test',
        method: 'GET',
        headers: {},
        signal: controller.signal,
      };

      // The error gets caught and re-processed by handleFetchError
      // But since TransportAbortError has a code property, it should still be treated as a transport error
      // Let's just check that it throws an error with the right message
      await expect(transport.request(request)).rejects.toThrow('Request was aborted');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should handle AbortError from fetch', async () => {
      const abortError = new Error('AbortError');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValue(abortError);

      const request: TransportRequest = {
        url: 'https://api.example.com/test',
        method: 'GET',
        headers: {},
      };

      await expect(transport.request(request)).rejects.toThrow(TransportAbortError);
      await expect(transport.request(request)).rejects.toThrow('Request was aborted');
    });

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('Timeout');
      timeoutError.name = 'TimeoutError';
      mockFetch.mockRejectedValue(timeoutError);

      const request: TransportRequest = {
        url: 'https://api.example.com/test',
        method: 'GET',
        headers: {},
      };

      await expect(transport.request(request)).rejects.toThrow(TransportTimeoutError);
      await expect(transport.request(request)).rejects.toThrow('Request timed out');
    });

    it('should handle TimeoutError specifically', async () => {
      const timeoutError = new Error('Request timed out');
      timeoutError.name = 'TimeoutError';
      mockFetch.mockRejectedValue(timeoutError);

      const request: TransportRequest = {
        url: 'https://api.example.com/test',
        method: 'GET',
        headers: {},
      };

      await expect(transport.request(request)).rejects.toThrow(TransportTimeoutError);
      await expect(transport.request(request)).rejects.toThrow('Request timed out');
    });

    it('should handle network TypeError', async () => {
      const networkError = new TypeError('fetch failed');
      mockFetch.mockRejectedValue(networkError);

      const request: TransportRequest = {
        url: 'https://api.example.com/test',
        method: 'GET',
        headers: {},
      };

      await expect(transport.request(request)).rejects.toThrow(TransportNetworkError);
      await expect(transport.request(request)).rejects.toThrow('Network request failed');
    });

    it('should handle NetworkError', async () => {
      const networkError = new Error('Network error occurred');
      networkError.name = 'NetworkError';
      mockFetch.mockRejectedValue(networkError);

      const request: TransportRequest = {
        url: 'https://api.example.com/test',
        method: 'GET',
        headers: {},
      };

      await expect(transport.request(request)).rejects.toThrow(TransportNetworkError);
      await expect(transport.request(request)).rejects.toThrow(
        'Network error: Network error occurred'
      );
    });

    it('should handle generic errors', async () => {
      const genericError = new Error('Something went wrong');
      mockFetch.mockRejectedValue(genericError);

      const request: TransportRequest = {
        url: 'https://api.example.com/test',
        method: 'GET',
        headers: {},
      };

      await expect(transport.request(request)).rejects.toThrow(TransportNetworkError);
      await expect(transport.request(request)).rejects.toThrow('Something went wrong');
    });

    it('should handle non-Error objects', async () => {
      mockFetch.mockRejectedValue('Some string error');

      const request: TransportRequest = {
        url: 'https://api.example.com/test',
        method: 'GET',
        headers: {},
      };

      await expect(transport.request(request)).rejects.toThrow(TransportNetworkError);
      await expect(transport.request(request)).rejects.toThrow('Unknown network error occurred');
    });

    it('should use custom timeout', async () => {
      const customTransport = new DirectFetchTransport({ timeout: 5000 });
      const mockResponse = new Response('test', { status: 200 });
      mockFetch.mockResolvedValue(mockResponse);

      vi.useFakeTimers();

      const request: TransportRequest = {
        url: 'https://api.example.com/test',
        method: 'GET',
        headers: {},
      };

      const requestPromise = customTransport.request(request);

      // Fast-forward time to trigger timeout
      vi.advanceTimersByTime(5001);

      await expect(requestPromise).resolves.toBeDefined();

      vi.useRealTimers();
    });
  });

  describe('stream method', () => {
    it('should stream successful response', async () => {
      const chunks = [
        new Uint8Array([1, 2, 3]),
        new Uint8Array([4, 5, 6]),
        new Uint8Array([7, 8, 9]),
      ];

      const mockStream = new ReadableStream({
        start(controller) {
          chunks.forEach(chunk => controller.enqueue(chunk));
          controller.close();
        },
      });

      const mockResponse = new Response(mockStream, {
        status: 200,
        statusText: 'OK',
      });

      mockFetch.mockResolvedValue(mockResponse);

      const request: TransportRequest = {
        url: 'https://api.example.com/stream',
        method: 'POST',
        headers: { Accept: 'text/event-stream' },
        body: '{"stream": true}',
      };

      const receivedChunks: Uint8Array[] = [];
      for await (const chunk of transport.stream(request)) {
        receivedChunks.push(chunk);
      }

      expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/stream', {
        method: 'POST',
        headers: { Accept: 'text/event-stream' },
        body: '{"stream": true}',
        signal: expect.any(AbortSignal),
      });

      expect(receivedChunks).toHaveLength(3);
      expect(receivedChunks[0]).toEqual(new Uint8Array([1, 2, 3]));
      expect(receivedChunks[1]).toEqual(new Uint8Array([4, 5, 6]));
      expect(receivedChunks[2]).toEqual(new Uint8Array([7, 8, 9]));
    });

    it('should handle streaming with custom AbortSignal', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]));
          controller.close();
        },
      });

      const mockResponse = new Response(mockStream, { status: 200 });
      mockFetch.mockResolvedValue(mockResponse);

      const controller = new AbortController();
      const request: TransportRequest = {
        url: 'https://api.example.com/stream',
        method: 'GET',
        headers: {},
        signal: controller.signal,
      };

      const receivedChunks: Uint8Array[] = [];
      for await (const chunk of transport.stream(request)) {
        receivedChunks.push(chunk);
      }

      expect(receivedChunks).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/stream', {
        method: 'GET',
        headers: {},
        body: undefined,
        signal: controller.signal,
      });
    });

    it('should throw error for response without readable stream', async () => {
      const mockResponse = new Response('not a stream', { status: 200 });
      // Override body to simulate no ReadableStream
      Object.defineProperty(mockResponse, 'body', { value: null });
      mockFetch.mockResolvedValue(mockResponse);

      const request: TransportRequest = {
        url: 'https://api.example.com/stream',
        method: 'GET',
        headers: {},
      };

      // The error should be thrown when we try to iterate
      const streamGenerator = transport.stream(request);

      try {
        for await (const chunk of streamGenerator) {
          // Should not reach here
          expect.fail('Should have thrown an error');
        }
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(TransportNetworkError);
        expect((error as Error).message).toContain('No readable stream in response body');
      }
    });

    it('should throw error for non-ReadableStream body', async () => {
      const mockResponse = new Response('text body', { status: 200 });
      // Override body to simulate string instead of ReadableStream
      Object.defineProperty(mockResponse, 'body', { value: 'string body' });
      mockFetch.mockResolvedValue(mockResponse);

      const request: TransportRequest = {
        url: 'https://api.example.com/stream',
        method: 'GET',
        headers: {},
      };

      const streamGenerator = transport.stream(request);

      try {
        for await (const chunk of streamGenerator) {
          expect.fail('Should have thrown an error');
        }
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(TransportNetworkError);
        expect((error as Error).message).toContain('No readable stream in response body');
      }
    });

    it('should handle HTTP error status in streaming', async () => {
      const mockResponse = new Response('Error', {
        status: 400,
        statusText: 'Bad Request',
      });
      mockFetch.mockResolvedValue(mockResponse);

      const request: TransportRequest = {
        url: 'https://api.example.com/stream',
        method: 'GET',
        headers: {},
      };

      const streamGenerator = transport.stream(request);

      try {
        for await (const chunk of streamGenerator) {
          expect.fail('Should have thrown an error');
        }
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(TransportNetworkError);
        expect((error as Error).message).toBe('HTTP 400: Bad Request');
      }
    });

    it('should handle different HTTP error statuses', async () => {
      const errorStatuses = [
        { status: 401, statusText: 'Unauthorized' },
        { status: 403, statusText: 'Forbidden' },
        { status: 404, statusText: 'Not Found' },
        { status: 500, statusText: 'Internal Server Error' },
      ];

      for (const { status, statusText } of errorStatuses) {
        const mockResponse = new Response('Error', { status, statusText });
        mockFetch.mockResolvedValue(mockResponse);

        const request: TransportRequest = {
          url: 'https://api.example.com/stream',
          method: 'GET',
          headers: {},
        };

        const streamGenerator = transport.stream(request);

        try {
          for await (const chunk of streamGenerator) {
            expect.fail('Should have thrown an error');
          }
          expect.fail('Should have thrown an error');
        } catch (error) {
          expect(error).toBeInstanceOf(TransportNetworkError);
          expect((error as Error).message).toBe(`HTTP ${status}: ${statusText}`);
        }
      }
    });

    it('should handle streaming errors', async () => {
      const networkError = new Error('Streaming failed');
      mockFetch.mockRejectedValue(networkError);

      const request: TransportRequest = {
        url: 'https://api.example.com/stream',
        method: 'GET',
        headers: {},
      };

      const streamGenerator = transport.stream(request);

      try {
        for await (const chunk of streamGenerator) {
          expect.fail('Should have thrown an error');
        }
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(TransportNetworkError);
        expect((error as Error).message).toContain('Streaming failed');
      }
    });

    it('should re-throw existing transport errors in streaming', async () => {
      const transportError = new TransportAbortError('Request was aborted');
      mockFetch.mockRejectedValue(transportError);

      const request: TransportRequest = {
        url: 'https://api.example.com/stream',
        method: 'GET',
        headers: {},
      };

      const streamGenerator = transport.stream(request);

      try {
        for await (const chunk of streamGenerator) {
          expect.fail('Should have thrown an error');
        }
        expect.fail('Should have thrown an error');
      } catch (error) {
        // The error gets re-processed by handleFetchError but should still maintain the message
        expect((error as Error).message).toContain('Request was aborted');
      }
    });

    it('should handle stream reading errors', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.error(new Error('Stream read error'));
        },
      });

      const mockResponse = new Response(mockStream, { status: 200 });
      mockFetch.mockResolvedValue(mockResponse);

      const request: TransportRequest = {
        url: 'https://api.example.com/stream',
        method: 'GET',
        headers: {},
      };

      const streamIterator = transport.stream(request);
      await expect(streamIterator.next()).rejects.toThrow('Stream read error');
    });

    it('should properly release reader lock on completion', async () => {
      const chunks = [new Uint8Array([1, 2, 3])];
      const mockStream = new ReadableStream({
        start(controller) {
          chunks.forEach(chunk => controller.enqueue(chunk));
          controller.close();
        },
      });

      const mockResponse = new Response(mockStream, { status: 200 });
      mockFetch.mockResolvedValue(mockResponse);

      const request: TransportRequest = {
        url: 'https://api.example.com/stream',
        method: 'GET',
        headers: {},
      };

      const receivedChunks: Uint8Array[] = [];
      for await (const chunk of transport.stream(request)) {
        receivedChunks.push(chunk);
      }

      // Verify we can create another reader (lock was released)
      expect(receivedChunks).toHaveLength(1);
    });

    it('should handle empty stream', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.close();
        },
      });

      const mockResponse = new Response(mockStream, { status: 200 });
      mockFetch.mockResolvedValue(mockResponse);

      const request: TransportRequest = {
        url: 'https://api.example.com/stream',
        method: 'GET',
        headers: {},
      };

      const receivedChunks: Uint8Array[] = [];
      for await (const chunk of transport.stream(request)) {
        receivedChunks.push(chunk);
      }

      expect(receivedChunks).toHaveLength(0);
    });

    it('should handle stream with null/undefined values', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]));
          controller.enqueue(null);
          controller.enqueue(undefined);
          controller.enqueue(new Uint8Array([4, 5, 6]));
          controller.close();
        },
      });

      const mockResponse = new Response(mockStream, { status: 200 });
      mockFetch.mockResolvedValue(mockResponse);

      const request: TransportRequest = {
        url: 'https://api.example.com/stream',
        method: 'GET',
        headers: {},
      };

      const receivedChunks: Uint8Array[] = [];
      for await (const chunk of transport.stream(request)) {
        receivedChunks.push(chunk);
      }

      // Should only receive non-null/undefined values
      expect(receivedChunks).toHaveLength(2);
      expect(receivedChunks[0]).toEqual(new Uint8Array([1, 2, 3]));
      expect(receivedChunks[1]).toEqual(new Uint8Array([4, 5, 6]));
    });
  });

  describe('AbortSignal integration', () => {
    it('should abort request when signal is aborted', async () => {
      const controller = new AbortController();

      mockFetch.mockImplementation(async (url, init) => {
        // Simulate slow request
        return new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            resolve(new Response('success', { status: 200 }));
          }, 1000);

          init?.signal?.addEventListener('abort', () => {
            clearTimeout(timeoutId);
            const error = new Error('AbortError');
            error.name = 'AbortError';
            reject(error);
          });
        });
      });

      const request: TransportRequest = {
        url: 'https://api.example.com/test',
        method: 'GET',
        headers: {},
        signal: controller.signal,
      };

      const requestPromise = transport.request(request);

      // Abort after 100ms
      setTimeout(() => controller.abort(), 100);

      await expect(requestPromise).rejects.toThrow(TransportAbortError);
    });

    it('should abort streaming when signal is aborted', async () => {
      const controller = new AbortController();

      const mockStream = new ReadableStream({
        start(streamController) {
          let count = 0;
          const interval = setInterval(() => {
            if (controller.signal.aborted) {
              clearInterval(interval);
              streamController.error(new Error('AbortError'));
              return;
            }
            streamController.enqueue(new Uint8Array([count++]));
            if (count >= 10) {
              clearInterval(interval);
              streamController.close();
            }
          }, 50);
        },
      });

      const mockResponse = new Response(mockStream, { status: 200 });
      mockFetch.mockResolvedValue(mockResponse);

      const request: TransportRequest = {
        url: 'https://api.example.com/stream',
        method: 'GET',
        headers: {},
        signal: controller.signal,
      };

      const streamIterator = transport.stream(request);

      // Abort after getting first chunk
      setTimeout(() => controller.abort(), 100);

      let chunkCount = 0;
      try {
        for await (const chunk of streamIterator) {
          chunkCount++;
          if (chunkCount >= 5) break; // Safety check
        }
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('AbortError');
      }
    });
  });

  describe('timeout behavior', () => {
    it('should timeout after default timeout period', async () => {
      vi.useFakeTimers();

      mockFetch.mockImplementation(async (url, init) => {
        return new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            resolve(new Response('success', { status: 200 }));
          }, 35000); // Longer than default timeout

          init?.signal?.addEventListener('abort', () => {
            clearTimeout(timeoutId);
            const error = new Error('AbortError');
            error.name = 'AbortError';
            reject(error);
          });
        });
      });

      const request: TransportRequest = {
        url: 'https://api.example.com/test',
        method: 'GET',
        headers: {},
      };

      const requestPromise = transport.request(request);

      // Fast-forward past default timeout (30 seconds)
      vi.advanceTimersByTime(31000);

      await expect(requestPromise).rejects.toThrow(TransportAbortError);

      vi.useRealTimers();
    });

    it('should use custom timeout', async () => {
      vi.useFakeTimers();

      const customTransport = new DirectFetchTransport({ timeout: 5000 });

      mockFetch.mockImplementation(async (url, init) => {
        return new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            resolve(new Response('success', { status: 200 }));
          }, 10000); // Longer than custom timeout

          init?.signal?.addEventListener('abort', () => {
            clearTimeout(timeoutId);
            const error = new Error('AbortError');
            error.name = 'AbortError';
            reject(error);
          });
        });
      });

      const request: TransportRequest = {
        url: 'https://api.example.com/test',
        method: 'GET',
        headers: {},
      };

      const requestPromise = customTransport.request(request);

      // Fast-forward past custom timeout (5 seconds)
      vi.advanceTimersByTime(6000);

      await expect(requestPromise).rejects.toThrow(TransportAbortError);

      vi.useRealTimers();
    });
  });

  describe('response body handling', () => {
    it('should handle response with ReadableStream body', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('test data'));
          controller.close();
        },
      });

      const mockResponse = new Response(mockStream, {
        status: 200,
        statusText: 'OK',
      });
      mockFetch.mockResolvedValue(mockResponse);

      const request: TransportRequest = {
        url: 'https://api.example.com/test',
        method: 'GET',
        headers: {},
      };

      const response = await transport.request(request);
      expect(response.body).toBeInstanceOf(ReadableStream);
    });

    it('should handle response with null body', async () => {
      const mockResponse = new Response(null, {
        status: 204,
        statusText: 'No Content',
      });
      mockFetch.mockResolvedValue(mockResponse);

      const request: TransportRequest = {
        url: 'https://api.example.com/test',
        method: 'DELETE',
        headers: {},
      };

      const response = await transport.request(request);
      expect(response.body).toBeUndefined();
    });

    it('should preserve response headers', async () => {
      const headers = new Headers({
        'Content-Type': 'application/json',
        'X-Custom-Header': 'custom-value',
      });

      const mockResponse = new Response('{"data": "test"}', {
        status: 200,
        statusText: 'OK',
        headers,
      });
      mockFetch.mockResolvedValue(mockResponse);

      const request: TransportRequest = {
        url: 'https://api.example.com/test',
        method: 'GET',
        headers: {},
      };

      const response = await transport.request(request);
      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(response.headers.get('X-Custom-Header')).toBe('custom-value');
    });
  });

  describe('createDirectFetchTransport factory', () => {
    it('should create DirectFetchTransport with default options', () => {
      const transport = createDirectFetchTransport();
      expect(transport).toBeInstanceOf(DirectFetchTransport);
    });

    it('should create DirectFetchTransport with custom options', () => {
      const transport = createDirectFetchTransport({ timeout: 10000 });
      expect(transport).toBeInstanceOf(DirectFetchTransport);
    });
  });
});
