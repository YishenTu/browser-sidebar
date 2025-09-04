import {
  Transport,
  TransportRequest,
  TransportResponse,
  TransportNetworkError,
  TransportTimeoutError,
  TransportAbortError,
} from './types';

/**
 * Direct fetch-based transport implementation
 * Uses native fetch API for HTTP communication with streaming support
 */
export class DirectFetchTransport implements Transport {
  private readonly defaultTimeout: number;

  constructor(options?: { timeout?: number }) {
    this.defaultTimeout = options?.timeout ?? 30000; // 30 seconds default
  }

  /**
   * Make a standard HTTP request using fetch
   */
  async request(request: TransportRequest): Promise<TransportResponse> {
    try {
      const fetchOptions: RequestInit = {
        method: request.method,
        headers: request.headers,
        body: request.body,
        signal: request.signal,
      };

      // Create timeout signal if no abort signal provided
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => {
        timeoutController.abort();
      }, this.defaultTimeout);

      // Combine signals if both exist
      if (request.signal) {
        // If request is already aborted, throw immediately
        if (request.signal.aborted) {
          throw new TransportAbortError('Request was aborted');
        }

        // Listen for abort on the request signal
        request.signal.addEventListener('abort', () => {
          timeoutController.abort();
        });
      } else {
        fetchOptions.signal = timeoutController.signal;
      }

      let response: Response;
      try {
        response = await fetch(request.url, fetchOptions);
      } finally {
        clearTimeout(timeoutId);
      }

      // Convert fetch Response to TransportResponse
      const transportResponse: TransportResponse = {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        body: response.body || undefined,
      };

      return transportResponse;
    } catch (error) {
      return this.handleFetchError(error);
    }
  }

  /**
   * Make a streaming HTTP request
   * Returns an async iterable for consuming the stream
   */
  async *stream(request: TransportRequest): AsyncIterable<Uint8Array> {
    try {
      const streamingRequest = { ...request, stream: true };
      const response = await this.request(streamingRequest);

      if (!response.body || !(response.body instanceof ReadableStream)) {
        throw new TransportNetworkError('No readable stream in response body');
      }

      // Check for HTTP error status
      if (response.status >= 400) {
        throw new TransportNetworkError(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body.getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          if (value) {
            yield value;
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      // If it's already a transport error, re-throw
      if (this.isTransportError(error)) {
        throw error;
      }

      throw this.handleFetchError(error);
    }
  }

  /**
   * Handle and convert fetch errors to appropriate TransportError types
   */
  private handleFetchError(error: unknown): never {
    if (error instanceof Error) {
      // Handle AbortError specifically
      if (error.name === 'AbortError') {
        throw new TransportAbortError('Request was aborted');
      }

      // Handle timeout (AbortError with timeout context)
      if (
        error.name === 'TimeoutError' ||
        (error.name === 'AbortError' && error.message.includes('timeout'))
      ) {
        throw new TransportTimeoutError('Request timed out');
      }

      // Handle network errors
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new TransportNetworkError('Network request failed', error);
      }

      // Handle other fetch-related errors
      if (error.name === 'TypeError' || error.name === 'NetworkError') {
        throw new TransportNetworkError(`Network error: ${error.message}`, error);
      }

      // Generic network error for other cases
      throw new TransportNetworkError(error.message, error);
    }

    // Fallback for non-Error objects
    throw new TransportNetworkError('Unknown network error occurred');
  }

  /**
   * Check if an error is already a TransportError
   */
  private isTransportError(error: unknown): error is Error & { code?: string } {
    return (
      error instanceof Error &&
      'code' in error &&
      typeof (error as Error & { code?: string }).code === 'string'
    );
  }
}

/**
 * Create a new DirectFetchTransport instance
 */
export function createDirectFetchTransport(options?: { timeout?: number }): DirectFetchTransport {
  return new DirectFetchTransport(options);
}
