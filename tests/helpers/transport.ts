/**
 * @file Transport Helpers
 *
 * Utilities for testing transport layer:
 * - createTransportStub() - Create a mock Transport implementation
 * - Transport response builders
 * - Call capture and assertion helpers
 */

import type { Transport, TransportRequest, TransportResponse } from '@transport/types';

// =============================================================================
// Transport Stub Types
// =============================================================================

/**
 * Captured call information for inspection in tests.
 */
export interface CapturedCall {
  /** The request that was made */
  request: TransportRequest;
  /** Timestamp of the call */
  timestamp: number;
  /** Call index (0-based) */
  index: number;
}

/**
 * Configuration for transport stub behavior.
 */
export interface TransportStubConfig {
  /** Response to return from request() */
  requestResponse?:
    | TransportResponse
    | ((req: TransportRequest) => TransportResponse | Promise<TransportResponse>);
  /** Error to throw from request() */
  requestError?: Error;
  /** Chunks to return from stream() */
  streamChunks?: string[] | Uint8Array[] | ((req: TransportRequest) => AsyncIterable<Uint8Array>);
  /** Error to throw from stream() */
  streamError?: Error;
  /** Delay before responding (ms) */
  delay?: number;
}

/**
 * Transport stub with call capture and inspection methods.
 */
export interface TransportStub extends Transport {
  /** All captured request() calls */
  requestCalls: CapturedCall[];
  /** All captured stream() calls */
  streamCalls: CapturedCall[];
  /** Get the last request() call */
  getLastRequestCall(): CapturedCall | undefined;
  /** Get the last stream() call */
  getLastStreamCall(): CapturedCall | undefined;
  /** Clear all captured calls */
  clearCalls(): void;
  /** Update stub configuration */
  configure(config: Partial<TransportStubConfig>): void;
  /** Get current configuration */
  getConfig(): TransportStubConfig;
}

// =============================================================================
// Default Responses
// =============================================================================

/**
 * Create a default successful transport response.
 */
export function createDefaultResponse(
  overrides: Partial<TransportResponse> = {}
): TransportResponse {
  return {
    status: 200,
    statusText: 'OK',
    headers: new Headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ success: true }),
    ...overrides,
  };
}

/**
 * Create an error transport response.
 */
export function createErrorResponse(
  status: number,
  message: string,
  overrides: Partial<TransportResponse> = {}
): TransportResponse {
  return {
    status,
    statusText: message,
    headers: new Headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ error: message }),
    ...overrides,
  };
}

// =============================================================================
// Transport Stub Factory
// =============================================================================

/**
 * Create a transport stub for testing.
 *
 * @param config - Initial configuration
 * @returns Transport stub with call capture and inspection methods
 *
 * @example
 * ```ts
 * const transport = createTransportStub({
 *   requestResponse: createDefaultResponse({ body: '{"data": "test"}' }),
 *   streamChunks: ['data: {"text": "Hello"}\n\n', 'data: [DONE]\n\n'],
 * });
 *
 * await transport.request({ url: '...', method: 'POST', headers: {} });
 *
 * expect(transport.requestCalls).toHaveLength(1);
 * expect(transport.requestCalls[0].request.url).toBe('...');
 * ```
 */
export function createTransportStub(config: TransportStubConfig = {}): TransportStub {
  let currentConfig: TransportStubConfig = { ...config };
  const requestCalls: CapturedCall[] = [];
  const streamCalls: CapturedCall[] = [];

  const stub: TransportStub = {
    requestCalls,
    streamCalls,

    async request(request: TransportRequest): Promise<TransportResponse> {
      // Capture the call
      requestCalls.push({
        request: { ...request },
        timestamp: Date.now(),
        index: requestCalls.length,
      });

      // Apply delay if configured
      if (currentConfig.delay && currentConfig.delay > 0) {
        await new Promise(resolve => setTimeout(resolve, currentConfig.delay));
      }

      // Check for abort signal
      if (request.signal?.aborted) {
        const error = new Error('Request aborted');
        error.name = 'AbortError';
        throw error;
      }

      // Throw error if configured
      if (currentConfig.requestError) {
        throw currentConfig.requestError;
      }

      // Return response
      if (typeof currentConfig.requestResponse === 'function') {
        return currentConfig.requestResponse(request);
      }

      return currentConfig.requestResponse ?? createDefaultResponse();
    },

    stream(request: TransportRequest): AsyncIterable<Uint8Array> {
      // Capture the call
      streamCalls.push({
        request: { ...request },
        timestamp: Date.now(),
        index: streamCalls.length,
      });

      // Return custom stream function if provided
      if (typeof currentConfig.streamChunks === 'function') {
        return currentConfig.streamChunks(request);
      }

      // Create async generator
      const chunks = currentConfig.streamChunks ?? [];
      const streamError = currentConfig.streamError;
      const delay = currentConfig.delay;
      const signal = request.signal;

      return {
        async *[Symbol.asyncIterator]() {
          // Check for error
          if (streamError) {
            throw streamError;
          }

          // Check for abort
          if (signal?.aborted) {
            const error = new Error('Request aborted');
            error.name = 'AbortError';
            throw error;
          }

          const encoder = new TextEncoder();

          for (const chunk of chunks) {
            // Apply delay
            if (delay && delay > 0) {
              await new Promise(resolve => setTimeout(resolve, delay));
            }

            // Check for abort during iteration
            if (signal?.aborted) {
              const error = new Error('Request aborted');
              error.name = 'AbortError';
              throw error;
            }

            // Yield chunk
            if (typeof chunk === 'string') {
              yield encoder.encode(chunk);
            } else {
              yield chunk;
            }
          }
        },
      };
    },

    getLastRequestCall(): CapturedCall | undefined {
      return requestCalls[requestCalls.length - 1];
    },

    getLastStreamCall(): CapturedCall | undefined {
      return streamCalls[streamCalls.length - 1];
    },

    clearCalls(): void {
      requestCalls.length = 0;
      streamCalls.length = 0;
    },

    configure(newConfig: Partial<TransportStubConfig>): void {
      currentConfig = { ...currentConfig, ...newConfig };
    },

    getConfig(): TransportStubConfig {
      return { ...currentConfig };
    },
  };

  return stub;
}

// =============================================================================
// Response Builders
// =============================================================================

/**
 * Build a JSON response.
 */
export function buildJsonResponse(data: unknown, status: number = 200): TransportResponse {
  return {
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: new Headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  };
}

/**
 * Build a streaming response body.
 */
export function buildStreamBody(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;

  return new ReadableStream({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]!));
        index++;
      } else {
        controller.close();
      }
    },
  });
}

/**
 * Build a transport response with streaming body.
 */
export function buildStreamingResponse(
  chunks: string[],
  headers: Record<string, string> = {}
): TransportResponse {
  return {
    status: 200,
    statusText: 'OK',
    headers: new Headers({
      'Content-Type': 'text/event-stream',
      ...headers,
    }),
    body: buildStreamBody(chunks),
  };
}

// =============================================================================
// Assertion Helpers
// =============================================================================

/**
 * Assert that a request was made with expected properties.
 */
export function assertRequestMade(
  stub: TransportStub,
  expected: Partial<TransportRequest>,
  callIndex: number = 0
): void {
  const call = stub.requestCalls[callIndex];
  if (!call) {
    throw new Error(
      `No request call at index ${callIndex}. Total calls: ${stub.requestCalls.length}`
    );
  }

  if (expected.url !== undefined && call.request.url !== expected.url) {
    throw new Error(`Expected URL "${expected.url}", got "${call.request.url}"`);
  }

  if (expected.method !== undefined && call.request.method !== expected.method) {
    throw new Error(`Expected method "${expected.method}", got "${call.request.method}"`);
  }

  if (expected.headers !== undefined) {
    for (const [key, value] of Object.entries(expected.headers)) {
      if (call.request.headers[key] !== value) {
        throw new Error(
          `Expected header "${key}: ${value}", got "${key}: ${call.request.headers[key]}"`
        );
      }
    }
  }

  if (expected.body !== undefined && call.request.body !== expected.body) {
    throw new Error(`Expected body "${expected.body}", got "${call.request.body}"`);
  }
}

/**
 * Assert that a stream was requested with expected properties.
 */
export function assertStreamMade(
  stub: TransportStub,
  expected: Partial<TransportRequest>,
  callIndex: number = 0
): void {
  const call = stub.streamCalls[callIndex];
  if (!call) {
    throw new Error(
      `No stream call at index ${callIndex}. Total calls: ${stub.streamCalls.length}`
    );
  }

  if (expected.url !== undefined && call.request.url !== expected.url) {
    throw new Error(`Expected URL "${expected.url}", got "${call.request.url}"`);
  }

  if (expected.method !== undefined && call.request.method !== expected.method) {
    throw new Error(`Expected method "${expected.method}", got "${call.request.method}"`);
  }
}

/**
 * Get the parsed JSON body from a request call.
 */
export function getRequestBody<T = unknown>(stub: TransportStub, callIndex: number = 0): T {
  const call = stub.requestCalls[callIndex];
  if (!call) {
    throw new Error(`No request call at index ${callIndex}`);
  }

  if (typeof call.request.body !== 'string') {
    throw new Error('Request body is not a string');
  }

  return JSON.parse(call.request.body) as T;
}

// =============================================================================
// Mock Transport Factories
// =============================================================================

/**
 * Create a transport that always succeeds with a specific response.
 */
export function createSuccessTransport(response: unknown): TransportStub {
  return createTransportStub({
    requestResponse: buildJsonResponse(response),
  });
}

/**
 * Create a transport that always fails with a specific error.
 */
export function createErrorTransport(error: Error): TransportStub {
  return createTransportStub({
    requestError: error,
    streamError: error,
  });
}

/**
 * Create a transport that returns different responses based on URL.
 */
export function createRoutedTransport(
  routes: Record<string, TransportResponse | ((req: TransportRequest) => TransportResponse)>
): TransportStub {
  return createTransportStub({
    requestResponse: req => {
      const route = routes[req.url];
      if (!route) {
        return createErrorResponse(404, `No route for ${req.url}`);
      }
      return typeof route === 'function' ? route(req) : route;
    },
  });
}
