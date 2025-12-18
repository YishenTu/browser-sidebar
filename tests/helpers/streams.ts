/**
 * @file Stream Helpers
 *
 * Utilities for testing streaming responses:
 * - stringChunksToAsyncIterable() - Convert string chunks to async iterable
 * - SSE chunk builders for OpenAI-style streaming
 * - NDJSON chunk builders for Gemini-style streaming
 */

// =============================================================================
// Async Iterable Helpers
// =============================================================================

/**
 * Convert an array of string chunks to an async iterable.
 * Useful for simulating streaming responses.
 *
 * @param chunks - Array of string chunks
 * @param options - Options for the async iterable
 * @returns Async iterable of chunks
 *
 * @example
 * ```ts
 * const stream = stringChunksToAsyncIterable(['chunk1', 'chunk2']);
 * for await (const chunk of stream) {
 *   console.log(chunk);
 * }
 * ```
 */
export async function* stringChunksToAsyncIterable(
  chunks: string[],
  options: { delayMs?: number } = {}
): AsyncGenerator<string, void, unknown> {
  const { delayMs = 0 } = options;

  for (const chunk of chunks) {
    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    yield chunk;
  }
}

/**
 * Convert an array of Uint8Array chunks to an async iterable.
 *
 * @param chunks - Array of Uint8Array chunks
 * @param options - Options for the async iterable
 * @returns Async iterable of Uint8Array chunks
 */
export async function* bytesToAsyncIterable(
  chunks: Uint8Array[],
  options: { delayMs?: number } = {}
): AsyncGenerator<Uint8Array, void, unknown> {
  const { delayMs = 0 } = options;

  for (const chunk of chunks) {
    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    yield chunk;
  }
}

/**
 * Collect all chunks from an async iterable into an array.
 *
 * @param iterable - Async iterable to collect from
 * @returns Promise resolving to array of all chunks
 */
export async function collectAsyncIterable<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const results: T[] = [];
  for await (const item of iterable) {
    results.push(item);
  }
  return results;
}

// =============================================================================
// SSE (Server-Sent Events) Builders
// =============================================================================

/**
 * Build a single SSE event string.
 *
 * @param data - Event data (will be JSON stringified if object)
 * @param options - SSE event options
 * @returns SSE formatted string
 *
 * @example
 * ```ts
 * buildSSEEvent({ text: 'Hello' });
 * // Returns: "data: {\"text\":\"Hello\"}\n\n"
 *
 * buildSSEEvent('Hello', { event: 'message' });
 * // Returns: "event: message\ndata: Hello\n\n"
 * ```
 */
export function buildSSEEvent(
  data: unknown,
  options: { event?: string; id?: string; retry?: number } = {}
): string {
  const { event, id, retry } = options;
  const lines: string[] = [];

  if (id !== undefined) {
    lines.push(`id: ${id}`);
  }
  if (event !== undefined) {
    lines.push(`event: ${event}`);
  }
  if (retry !== undefined) {
    lines.push(`retry: ${retry}`);
  }

  const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
  lines.push(`data: ${dataStr}`);

  return lines.join('\n') + '\n\n';
}

/**
 * Build multiple SSE events from an array of data.
 *
 * @param dataArray - Array of event data
 * @returns Concatenated SSE events string
 */
export function buildSSEEvents(dataArray: unknown[]): string {
  return dataArray.map(data => buildSSEEvent(data)).join('');
}

/**
 * Build an SSE done event (OpenAI style).
 *
 * @returns SSE done event string
 */
export function buildSSEDone(): string {
  return 'data: [DONE]\n\n';
}

/**
 * Create a mock ReadableStream from SSE chunks.
 *
 * @param chunks - Array of SSE event strings
 * @returns Mock ReadableStream
 */
export function createSSEReadableStream(chunks: string[]): ReadableStream<Uint8Array> {
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

// =============================================================================
// NDJSON (Newline Delimited JSON) Builders
// =============================================================================

/**
 * Build a single NDJSON line from data.
 *
 * @param data - Data to serialize
 * @returns NDJSON line string (with newline)
 *
 * @example
 * ```ts
 * buildNDJSONLine({ text: 'Hello' });
 * // Returns: "{\"text\":\"Hello\"}\n"
 * ```
 */
export function buildNDJSONLine(data: unknown): string {
  return JSON.stringify(data) + '\n';
}

/**
 * Build multiple NDJSON lines from an array of data.
 *
 * @param dataArray - Array of data to serialize
 * @returns Concatenated NDJSON lines string
 */
export function buildNDJSONLines(dataArray: unknown[]): string {
  return dataArray.map(data => buildNDJSONLine(data)).join('');
}

/**
 * Create a mock ReadableStream from NDJSON data.
 *
 * @param dataArray - Array of data objects
 * @returns Mock ReadableStream
 */
export function createNDJSONReadableStream(dataArray: unknown[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;

  return new ReadableStream({
    pull(controller) {
      if (index < dataArray.length) {
        controller.enqueue(encoder.encode(buildNDJSONLine(dataArray[index])));
        index++;
      } else {
        controller.close();
      }
    },
  });
}

// =============================================================================
// JSON Array Stream Builders (Gemini style)
// =============================================================================

/**
 * Build JSON array stream chunks.
 * Gemini sometimes returns JSON arrays split across chunks.
 *
 * @param objects - Array of objects to serialize
 * @returns Array of string chunks simulating partial JSON
 *
 * @example
 * ```ts
 * buildJSONArrayChunks([{a: 1}, {b: 2}]);
 * // Returns: ['[', '{"a":1}', ',', '{"b":2}', ']']
 * ```
 */
export function buildJSONArrayChunks(objects: unknown[]): string[] {
  if (objects.length === 0) {
    return ['[]'];
  }

  const chunks: string[] = ['['];
  objects.forEach((obj, index) => {
    if (index > 0) {
      chunks.push(',');
    }
    chunks.push(JSON.stringify(obj));
  });
  chunks.push(']');

  return chunks;
}

/**
 * Build JSON array chunks with interleaved content (simulates real streaming).
 * Splits objects across chunk boundaries.
 *
 * @param objects - Array of objects
 * @param splitLength - Approximate length to split at
 * @returns Array of string chunks with partial JSON
 */
export function buildJSONArrayChunksInterleaved(
  objects: unknown[],
  splitLength: number = 50
): string[] {
  const fullJson = JSON.stringify(objects);
  const chunks: string[] = [];

  for (let i = 0; i < fullJson.length; i += splitLength) {
    chunks.push(fullJson.slice(i, i + splitLength));
  }

  return chunks;
}

// =============================================================================
// Mock Response Builders
// =============================================================================

/**
 * Create a mock Response object with a streaming body.
 *
 * @param body - ReadableStream for the response body
 * @param options - Response options
 * @returns Mock Response object
 */
export function createMockStreamResponse(
  body: ReadableStream<Uint8Array>,
  options: {
    status?: number;
    headers?: Record<string, string>;
  } = {}
): Response {
  const { status = 200, headers = {} } = options;

  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: new Headers({
      'Content-Type': 'text/event-stream',
      ...headers,
    }),
    body,
    bodyUsed: false,
    clone: function () {
      return this;
    },
    text: async function (): Promise<string> {
      const reader = body.getReader();
      const decoder = new TextDecoder();
      let result = '';
      let done = false;
      while (!done) {
        const readResult = await reader.read();
        done = readResult.done;
        if (!done && readResult.value) {
          result += decoder.decode(readResult.value, { stream: true });
        }
      }
      return result;
    },
    json: async function (): Promise<unknown> {
      const textContent = await this.text();
      return JSON.parse(textContent);
    },
    blob: async () => new Blob([]),
    arrayBuffer: async () => new ArrayBuffer(0),
    formData: async () => new FormData(),
    redirected: false,
    type: 'default' as ResponseType,
    url: 'https://api.example.com/stream',
  } as Response;
}

/**
 * Create a mock fetch function that returns a streaming response.
 *
 * @param chunks - Array of string chunks to stream
 * @param options - Response options
 * @returns Mock fetch function
 */
export function createStreamingFetchMock(
  chunks: string[],
  options: { status?: number; headers?: Record<string, string>; delayMs?: number } = {}
): typeof fetch {
  const { status = 200, headers = {}, delayMs = 0 } = options;

  return async () => {
    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    const stream = createSSEReadableStream(chunks);
    return createMockStreamResponse(stream, { status, headers });
  };
}

// =============================================================================
// Stream Parsing Helpers
// =============================================================================

/**
 * Parse SSE text into individual events.
 *
 * @param sseText - Raw SSE text
 * @returns Array of parsed event objects
 */
export function parseSSEText(
  sseText: string
): Array<{ event?: string; data: string; id?: string }> {
  const events: Array<{ event?: string; data: string; id?: string }> = [];
  const rawEvents = sseText.split('\n\n').filter(e => e.trim());

  for (const rawEvent of rawEvents) {
    const lines = rawEvent.split('\n');
    let event: string | undefined;
    let data = '';
    let id: string | undefined;

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        event = line.slice(7);
      } else if (line.startsWith('data: ')) {
        data = line.slice(6);
      } else if (line.startsWith('id: ')) {
        id = line.slice(4);
      }
    }

    if (data) {
      events.push({ event, data, id });
    }
  }

  return events;
}

/**
 * Parse NDJSON text into array of objects.
 *
 * @param ndjsonText - Raw NDJSON text
 * @returns Array of parsed objects
 */
export function parseNDJSONText(ndjsonText: string): unknown[] {
  return ndjsonText
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));
}

// =============================================================================
// Error Stream Helpers
// =============================================================================

/**
 * Create a ReadableStream that errors after a certain number of chunks.
 *
 * @param chunks - Chunks to emit before error
 * @param error - Error to throw
 * @returns ReadableStream that errors
 */
export function createErroringReadableStream(
  chunks: string[],
  error: Error
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;

  return new ReadableStream({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]!));
        index++;
      } else {
        controller.error(error);
      }
    },
  });
}

/**
 * Create a mock fetch that returns a stream that errors.
 *
 * @param successChunks - Chunks to emit before error
 * @param error - Error to throw
 * @returns Mock fetch function
 */
export function createErroringFetchMock(successChunks: string[], error: Error): typeof fetch {
  return async () => {
    const stream = createErroringReadableStream(successChunks, error);
    return createMockStreamResponse(stream);
  };
}
