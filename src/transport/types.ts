/**
 * Transport layer abstractions for HTTP communication
 * Provides unified interface for both direct fetch and proxied requests
 */

export interface TransportRequest {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
  headers: Record<string, string>;
  body?: string | ArrayBuffer | FormData;
  stream?: boolean;
  signal?: AbortSignal;
}

export interface TransportResponse {
  status: number;
  statusText: string;
  headers: Headers;
  body?: ReadableStream<Uint8Array> | ArrayBuffer | string;
}

export type TransportStream = ReadableStream<Uint8Array> | AsyncIterable<string | Uint8Array>;

export interface Transport {
  /**
   * Make a standard HTTP request
   */
  request(request: TransportRequest): Promise<TransportResponse>;

  /**
   * Make a streaming HTTP request
   * Returns an async iterable for consuming the stream
   */
  stream(request: TransportRequest): AsyncIterable<Uint8Array>;
}

export interface TransportError extends Error {
  status?: number;
  statusText?: string;
  code?: string;
}

export class TransportNetworkError extends Error implements TransportError {
  code = 'NETWORK_ERROR';
  constructor(
    message: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'TransportNetworkError';
  }
}

export class TransportTimeoutError extends Error implements TransportError {
  code = 'TIMEOUT';
  constructor(message: string) {
    super(message);
    this.name = 'TransportTimeoutError';
  }
}

export class TransportAbortError extends Error implements TransportError {
  code = 'ABORTED';
  constructor(message: string) {
    super(message);
    this.name = 'TransportAbortError';
  }
}
