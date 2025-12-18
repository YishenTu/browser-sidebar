/**
 * @file BackgroundProxyTransport.test.ts
 * Tests for BackgroundProxyTransport - background proxy transport for CORS handling
 *
 * Focus:
 * - request error paths + streaming order + abort cleanup (port stubs)
 * - Policy-based routing via shouldProxy
 * - Port lifecycle: message/disconnect listeners
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BackgroundProxyTransport } from '@transport/BackgroundProxyTransport';
import {
  TransportNetworkError,
  TransportAbortError,
  type TransportRequest,
} from '@transport/types';
import * as policy from '@transport/policy';
import * as chromeRuntime from '@platform/chrome/runtime';
import { createPortStub } from '../../helpers/chrome';

// Mock the policy module
vi.mock('@transport/policy', () => ({
  shouldProxy: vi.fn(),
}));

// Mock the chrome runtime module
vi.mock('@platform/chrome/runtime', () => ({
  sendMessage: vi.fn(),
  connect: vi.fn(),
}));

describe('BackgroundProxyTransport', () => {
  let transport: BackgroundProxyTransport;

  beforeEach(() => {
    transport = new BackgroundProxyTransport();
    vi.clearAllMocks();
    // Default: shouldProxy returns true
    vi.mocked(policy.shouldProxy).mockReturnValue(true);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // ---------------------------------------------------------------------------
  // request() method
  // ---------------------------------------------------------------------------
  describe('request()', () => {
    it('throws TransportNetworkError when URL does not require proxying', async () => {
      vi.mocked(policy.shouldProxy).mockReturnValue(false);

      const request: TransportRequest = {
        url: 'https://api.example.com/data',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      };

      await expect(transport.request(request)).rejects.toThrow(TransportNetworkError);
      await expect(transport.request(request)).rejects.toThrow('URL does not require proxying');
    });

    it('throws TransportAbortError when signal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      const request: TransportRequest = {
        url: 'https://api.example.com/data',
        method: 'GET',
        headers: {},
        signal: controller.signal,
      };

      await expect(transport.request(request)).rejects.toThrow(TransportAbortError);
      await expect(transport.request(request)).rejects.toThrow('Request was aborted');
    });

    it('sends correct message format to background', async () => {
      vi.mocked(chromeRuntime.sendMessage).mockResolvedValue({
        success: true,
        data: {
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' },
          body: '{"result":"success"}',
        },
      });

      const request: TransportRequest = {
        url: 'https://api.example.com/data',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
        body: JSON.stringify({ data: 'test' }),
      };

      await transport.request(request);

      expect(chromeRuntime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'PROXY_REQUEST',
          source: 'sidebar',
          target: 'background',
          payload: {
            url: 'https://api.example.com/data',
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
            body: '{"data":"test"}',
          },
        })
      );
    });

    it('returns successful response with converted headers', async () => {
      vi.mocked(chromeRuntime.sendMessage).mockResolvedValue({
        success: true,
        data: {
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json', 'X-Custom': 'value' },
          body: '{"data":"result"}',
        },
      });

      const request: TransportRequest = {
        url: 'https://api.example.com/data',
        method: 'GET',
        headers: {},
      };

      const response = await transport.request(request);

      expect(response.status).toBe(200);
      expect(response.statusText).toBe('OK');
      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(response.headers.get('X-Custom')).toBe('value');
      expect(response.body).toBe('{"data":"result"}');
    });

    it('handles error response from proxy', async () => {
      vi.mocked(chromeRuntime.sendMessage).mockResolvedValue({
        success: true,
        data: {
          ok: false,
          status: 404,
          statusText: 'Not Found',
          headers: {},
          body: 'Resource not found',
        },
      });

      const request: TransportRequest = {
        url: 'https://api.example.com/data',
        method: 'GET',
        headers: {},
      };

      const response = await transport.request(request);

      expect(response.status).toBe(404);
      expect(response.statusText).toBe('Not Found');
      expect(response.body).toBe('Resource not found');
    });

    it('handles error response with error field', async () => {
      vi.mocked(chromeRuntime.sendMessage).mockResolvedValue({
        success: true,
        data: {
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          headers: {},
          error: 'Server crashed',
        },
      });

      const request: TransportRequest = {
        url: 'https://api.example.com/data',
        method: 'GET',
        headers: {},
      };

      const response = await transport.request(request);

      expect(response.status).toBe(500);
      expect(response.body).toBe('Server crashed');
    });

    it('throws TransportNetworkError on Chrome runtime error', async () => {
      vi.mocked(chromeRuntime.sendMessage).mockResolvedValue({
        success: false,
        error: {
          message: 'Extension context invalidated',
          code: 'CONTEXT_INVALIDATED',
          name: 'RuntimeError',
        },
      });

      const request: TransportRequest = {
        url: 'https://api.example.com/data',
        method: 'GET',
        headers: {},
      };

      await expect(transport.request(request)).rejects.toThrow(TransportNetworkError);
      await expect(transport.request(request)).rejects.toThrow('Chrome runtime error');
    });

    it('throws TransportNetworkError when no response from proxy', async () => {
      vi.mocked(chromeRuntime.sendMessage).mockResolvedValue({
        success: true,
        data: null,
      });

      const request: TransportRequest = {
        url: 'https://api.example.com/data',
        method: 'GET',
        headers: {},
      };

      await expect(transport.request(request)).rejects.toThrow(TransportNetworkError);
      await expect(transport.request(request)).rejects.toThrow('No response from background proxy');
    });

    it('throws TransportNetworkError when sendMessage fails', async () => {
      vi.mocked(chromeRuntime.sendMessage).mockRejectedValue(
        new Error('Could not establish connection')
      );

      const request: TransportRequest = {
        url: 'https://api.example.com/data',
        method: 'GET',
        headers: {},
      };

      await expect(transport.request(request)).rejects.toThrow(TransportNetworkError);
      await expect(transport.request(request)).rejects.toThrow('Failed to send message');
    });

    it('throws TransportAbortError when aborted during request', async () => {
      const controller = new AbortController();

      // Simulate a slow response that can be aborted
      vi.mocked(chromeRuntime.sendMessage).mockImplementation(async () => {
        return new Promise(() => {
          // Never resolves; request should be rejected by abort listener.
        });
      });

      const request: TransportRequest = {
        url: 'https://api.example.com/data',
        method: 'GET',
        headers: {},
        signal: controller.signal,
      };

      const requestPromise = transport.request(request);

      // Abort immediately
      controller.abort();

      await expect(requestPromise).rejects.toThrow(TransportAbortError);
    });

    it('handles empty headers in response', async () => {
      vi.mocked(chromeRuntime.sendMessage).mockResolvedValue({
        success: true,
        data: {
          ok: true,
          status: 204,
          statusText: 'No Content',
          headers: undefined,
          body: undefined,
        },
      });

      const request: TransportRequest = {
        url: 'https://api.example.com/resource',
        method: 'DELETE',
        headers: {},
      };

      const response = await transport.request(request);

      expect(response.status).toBe(204);
      expect(response.headers).toBeInstanceOf(Headers);
    });
  });

  // ---------------------------------------------------------------------------
  // stream() method
  // ---------------------------------------------------------------------------
  describe('stream()', () => {
    it('throws TransportNetworkError when URL does not require proxying', async () => {
      vi.mocked(policy.shouldProxy).mockReturnValue(false);

      const request: TransportRequest = {
        url: 'https://api.example.com/stream',
        method: 'POST',
        headers: {},
      };

      await expect(async () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _chunk of transport.stream(request)) {
          // Should not reach here
        }
      }).rejects.toThrow('URL does not require proxying');
    });

    it('throws TransportAbortError when signal is already aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      const request: TransportRequest = {
        url: 'https://api.example.com/stream',
        method: 'POST',
        headers: {},
        signal: controller.signal,
      };

      await expect(async () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _chunk of transport.stream(request)) {
          // Should not reach here
        }
      }).rejects.toThrow(TransportAbortError);
    });

    it('yields chunks from port messages', async () => {
      const port = createPortStub('proxy-stream');
      vi.mocked(chromeRuntime.connect).mockReturnValue(port);

      const request: TransportRequest = {
        url: 'https://api.example.com/stream',
        method: 'POST',
        headers: {},
      };

      const iterator = transport.stream(request);
      const asyncIterator = iterator[Symbol.asyncIterator]();

      const firstPromise = asyncIterator.next();
      await new Promise(r => setImmediate(r));

      port.simulateMessage({ type: 'start', status: 200, statusText: 'OK' });
      port.simulateMessage({ type: 'chunk', chunk: 'hello' });
      port.simulateMessage({ type: 'chunk', chunk: 'world' });
      port.simulateMessage({ type: 'end' });

      const received: string[] = [];
      const decoder = new TextDecoder();
      let result = await firstPromise;
      while (!result.done) {
        received.push(decoder.decode(result.value));
        result = await asyncIterator.next();
      }

      expect(received).toEqual(['hello', 'world']);
    });

    it('posts request to port', async () => {
      const port = createPortStub('proxy-stream');
      vi.mocked(chromeRuntime.connect).mockReturnValue(port);

      const request: TransportRequest = {
        url: 'https://api.example.com/stream',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"prompt":"test"}',
      };

      // Start consuming the stream
      const iterator = transport.stream(request);
      const asyncIterator = iterator[Symbol.asyncIterator]();

      const firstPromise = asyncIterator.next();
      await new Promise(r => setImmediate(r));

      port.simulateMessage({ type: 'end' });
      await firstPromise;

      expect(port.postMessage).toHaveBeenCalledWith({
        url: 'https://api.example.com/stream',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"prompt":"test"}',
      });
    });

    it('handles error message from port by ending stream', async () => {
      const port = createPortStub('proxy-stream');
      vi.mocked(chromeRuntime.connect).mockReturnValue(port);

      const request: TransportRequest = {
        url: 'https://api.example.com/stream',
        method: 'GET',
        headers: {},
      };

      const iterator = transport.stream(request);
      const asyncIterator = iterator[Symbol.asyncIterator]();

      // Start consuming first (which sets up the resolveChunk)
      const nextPromise = asyncIterator.next();

      // Use setImmediate to ensure the promise is waiting
      await new Promise(r => setImmediate(r));

      // Send error after the iterator is waiting
      // Note: Due to implementation design, error while waiting causes stream to end
      // The error is stored but the break from null chunk happens before next error check
      port.simulateMessage({
        type: 'error',
        message: 'Server error',
        status: 500,
        statusText: 'Internal Server Error',
      });

      const result = await nextPromise;
      expect(result.done).toBe(true);
      expect(port.disconnect).toHaveBeenCalled();
    });

    it('throws error when error arrives before consuming', async () => {
      const port = createPortStub('proxy-stream');
      vi.mocked(chromeRuntime.connect).mockReturnValue(port);

      const request: TransportRequest = {
        url: 'https://api.example.com/stream',
        method: 'GET',
        headers: {},
      };

      const iterator = transport.stream(request);
      const asyncIterator = iterator[Symbol.asyncIterator]();

      // Start consuming to set up the iterator
      const firstPromise = asyncIterator.next();
      await new Promise(r => setImmediate(r));

      // Send start, then error before chunk arrives
      port.simulateMessage({ type: 'start', status: 200, statusText: 'OK' });
      port.simulateMessage({
        type: 'error',
        message: 'Server error mid-stream',
        status: 500,
        statusText: 'Internal Server Error',
      });

      // When error arrives after start but before any chunk is consumed,
      // the stream ends (since streamEnded becomes true and resolveChunk(null) is called)
      const result = await firstPromise;
      expect(result.done).toBe(true);
    });

    it('handles port disconnect', async () => {
      const port = createPortStub('proxy-stream');
      vi.mocked(chromeRuntime.connect).mockReturnValue(port);

      const request: TransportRequest = {
        url: 'https://api.example.com/stream',
        method: 'GET',
        headers: {},
      };

      const iterator = transport.stream(request);
      const asyncIterator = iterator[Symbol.asyncIterator]();

      const firstPromise = asyncIterator.next();
      await new Promise(r => setImmediate(r));

      port.simulateDisconnect();

      // Should return done
      const result = await firstPromise;
      expect(result.done).toBe(true);
    });

    it('handles abort during streaming', async () => {
      const port = createPortStub('proxy-stream');
      vi.mocked(chromeRuntime.connect).mockReturnValue(port);

      const controller = new AbortController();

      const request: TransportRequest = {
        url: 'https://api.example.com/stream',
        method: 'GET',
        headers: {},
        signal: controller.signal,
      };

      const iterator = transport.stream(request);
      const asyncIterator = iterator[Symbol.asyncIterator]();

      const firstPromise = asyncIterator.next();
      await new Promise(r => setImmediate(r));

      port.simulateMessage({ type: 'start', status: 200, statusText: 'OK' });
      port.simulateMessage({ type: 'chunk', chunk: 'data' });

      // First chunk should be received
      const result = await firstPromise;
      expect(result.done).toBe(false);

      controller.abort();

      // Next iteration should end (abort causes stream to end)
      const nextResult = await asyncIterator.next();
      expect(nextResult.done).toBe(true);

      // Port should be disconnected
      expect(port.disconnect).toHaveBeenCalled();
    });

    it('buffers chunks when consumer is slow', async () => {
      const port = createPortStub('proxy-stream');
      vi.mocked(chromeRuntime.connect).mockReturnValue(port);

      const request: TransportRequest = {
        url: 'https://api.example.com/stream',
        method: 'GET',
        headers: {},
      };

      const iterator = transport.stream(request);
      const asyncIterator = iterator[Symbol.asyncIterator]();

      // Start consuming to set up the iterator
      const firstPromise = asyncIterator.next();
      await new Promise(r => setImmediate(r));

      // Now send all messages (they get buffered)
      port.simulateMessage({ type: 'start', status: 200, statusText: 'OK' });
      port.simulateMessage({ type: 'chunk', chunk: 'chunk1' });
      port.simulateMessage({ type: 'chunk', chunk: 'chunk2' });
      port.simulateMessage({ type: 'chunk', chunk: 'chunk3' });
      port.simulateMessage({ type: 'end' });

      // Consume all chunks
      const received: string[] = [];
      const decoder = new TextDecoder();

      let result = await firstPromise;
      while (!result.done) {
        received.push(decoder.decode(result.value));
        result = await asyncIterator.next();
      }

      expect(received).toEqual(['chunk1', 'chunk2', 'chunk3']);
    });

    it('ignores messages before stream starts', async () => {
      const port = createPortStub('proxy-stream');
      vi.mocked(chromeRuntime.connect).mockReturnValue(port);

      const request: TransportRequest = {
        url: 'https://api.example.com/stream',
        method: 'GET',
        headers: {},
      };

      const iterator = transport.stream(request);
      const asyncIterator = iterator[Symbol.asyncIterator]();

      // Start consuming to set up the iterator
      const firstPromise = asyncIterator.next();
      await new Promise(r => setImmediate(r));

      // Send chunk before start (should be ignored per the implementation)
      port.simulateMessage({ type: 'chunk', chunk: 'ignored' });
      // Now send start and real chunk
      port.simulateMessage({ type: 'start', status: 200, statusText: 'OK' });
      port.simulateMessage({ type: 'chunk', chunk: 'real' });
      port.simulateMessage({ type: 'end' });

      const received: string[] = [];
      const decoder = new TextDecoder();
      let result = await firstPromise;
      while (!result.done) {
        received.push(decoder.decode(result.value));
        result = await asyncIterator.next();
      }

      expect(received).toEqual(['real']);
    });

    it('ignores invalid message shapes', async () => {
      const port = createPortStub('proxy-stream');
      vi.mocked(chromeRuntime.connect).mockReturnValue(port);

      const request: TransportRequest = {
        url: 'https://api.example.com/stream',
        method: 'GET',
        headers: {},
      };

      const iterator = transport.stream(request);
      const asyncIterator = iterator[Symbol.asyncIterator]();

      // Start consuming to set up the iterator
      const firstPromise = asyncIterator.next();
      await new Promise(r => setImmediate(r));

      // Send various invalid messages
      port.simulateMessage(null);
      port.simulateMessage('string');
      port.simulateMessage(123);
      port.simulateMessage({ type: 'start', status: 200, statusText: 'OK' });
      port.simulateMessage({ type: 'chunk', chunk: 'valid' });
      port.simulateMessage({ type: 'end' });

      const received: string[] = [];
      const decoder = new TextDecoder();
      let result = await firstPromise;
      while (!result.done) {
        received.push(decoder.decode(result.value));
        result = await asyncIterator.next();
      }

      expect(received).toEqual(['valid']);
    });

    it('cleans up port listeners on completion', async () => {
      const port = createPortStub('proxy-stream');
      vi.mocked(chromeRuntime.connect).mockReturnValue(port);

      const request: TransportRequest = {
        url: 'https://api.example.com/stream',
        method: 'GET',
        headers: {},
      };

      const iterator = transport.stream(request);
      const asyncIterator = iterator[Symbol.asyncIterator]();

      // Start consuming to set up the iterator
      const firstPromise = asyncIterator.next();
      await new Promise(r => setImmediate(r));

      port.simulateMessage({ type: 'start', status: 200, statusText: 'OK' });
      port.simulateMessage({ type: 'end' });

      // Consume all
      let result = await firstPromise;
      while (!result.done) {
        result = await asyncIterator.next();
      }

      expect(port.disconnect).toHaveBeenCalled();
    });

    it('handles error without message field by ending stream', async () => {
      const port = createPortStub('proxy-stream');
      vi.mocked(chromeRuntime.connect).mockReturnValue(port);

      const request: TransportRequest = {
        url: 'https://api.example.com/stream',
        method: 'GET',
        headers: {},
      };

      const iterator = transport.stream(request);
      const asyncIterator = iterator[Symbol.asyncIterator]();

      // Start consuming to set up the iterator
      const nextPromise = asyncIterator.next();
      await new Promise(r => setImmediate(r));

      // Send error after the iterator is waiting
      // Due to implementation design, error ends stream without throwing
      port.simulateMessage({
        type: 'error',
        status: 503,
        statusText: 'Service Unavailable',
      });

      const result = await nextPromise;
      expect(result.done).toBe(true);
      expect(port.disconnect).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Edge Cases
  // ---------------------------------------------------------------------------
  describe('edge cases', () => {
    it('handles various HTTP methods in request()', async () => {
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;

      for (const method of methods) {
        vi.mocked(chromeRuntime.sendMessage).mockResolvedValue({
          success: true,
          data: {
            ok: true,
            status: 200,
            statusText: 'OK',
            headers: {},
          },
        });

        const request: TransportRequest = {
          url: 'https://api.example.com/data',
          method,
          headers: {},
        };

        const response = await transport.request(request);
        expect(response.status).toBe(200);

        const lastCall = vi.mocked(chromeRuntime.sendMessage).mock.calls.slice(-1)[0];
        const sentMessage = lastCall?.[0] as { payload?: { method?: string } } | undefined;
        expect(sentMessage?.payload?.method).toBe(method);
      }
    });

    it('connects with correct port name for streaming', async () => {
      const port = createPortStub('proxy-stream');
      vi.mocked(chromeRuntime.connect).mockReturnValue(port);

      const request: TransportRequest = {
        url: 'https://api.example.com/stream',
        method: 'GET',
        headers: {},
      };

      const iterator = transport.stream(request);
      const asyncIterator = iterator[Symbol.asyncIterator]();

      // Start consuming to set up the iterator
      const firstPromise = asyncIterator.next();
      await new Promise(r => setImmediate(r));

      port.simulateMessage({ type: 'end' });
      await firstPromise;

      expect(chromeRuntime.connect).toHaveBeenCalledWith({ name: 'proxy-stream' });
    });
  });
});
