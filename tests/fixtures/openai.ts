/**
 * @file OpenAI Fixtures
 *
 * Test fixtures for OpenAI Responses API streaming events and SSE text chunks.
 * These fixtures provide realistic test data for OpenAI provider tests.
 */

import type {
  OpenAIStreamEvent,
  OpenAIResponse,
  OpenAIUsage,
  SearchMetadata,
} from '@/core/ai/openai/types';
import { buildSSEEvent, buildSSEDone } from '../helpers/streams';

// =============================================================================
// OpenAI Stream Events
// =============================================================================

/**
 * Response created event (first event in stream).
 */
export const responseCreatedEvent: OpenAIStreamEvent = {
  type: 'response.created',
  id: 'resp_abc123',
  response_id: 'resp_abc123',
  model: 'gpt-4o',
  created: 1705315800,
  status: 'in_progress',
};

/**
 * Content delta event (text output).
 */
export const contentDeltaEvent: OpenAIStreamEvent = {
  type: 'response.output_text.delta',
  delta: 'Hello, ',
  response_id: 'resp_abc123',
};

/**
 * Content delta event with structured delta.
 */
export const structuredContentDeltaEvent: OpenAIStreamEvent = {
  type: 'response.output_text.delta',
  delta: { output_text: 'world!' },
  response_id: 'resp_abc123',
};

/**
 * Output text done event.
 */
export const outputTextDoneEvent: OpenAIStreamEvent = {
  type: 'response.output_text.done',
  output_text: 'Hello, world!',
  response_id: 'resp_abc123',
};

/**
 * Response done event (final event with usage).
 */
export const responseDoneEvent: OpenAIStreamEvent = {
  type: 'response.done',
  id: 'resp_abc123',
  response_id: 'resp_abc123',
  model: 'gpt-4o',
  status: 'completed',
  finish_reason: 'stop',
  usage: {
    prompt_tokens: 15,
    completion_tokens: 3,
    total_tokens: 18,
  },
};

/**
 * Reasoning summary text delta event.
 */
export const reasoningDeltaEvent: OpenAIStreamEvent = {
  type: 'response.reasoning_summary_text.delta',
  delta: 'Let me think about this...',
  response_id: 'resp_reasoning123',
};

/**
 * Reasoning summary done event.
 */
export const reasoningSummaryDoneEvent: OpenAIStreamEvent = {
  type: 'response.reasoning_summary.done',
  summary: [{ text: 'I analyzed the problem step by step.' }],
  response_id: 'resp_reasoning123',
};

/**
 * Web search event.
 */
export const webSearchEvent: OpenAIStreamEvent = {
  type: 'response.output_item.added',
  item: {
    type: 'web_search_call',
    action: {
      type: 'web_search',
      query: 'TypeScript latest features 2024',
    },
  },
  response_id: 'resp_search123',
};

/**
 * Message output item event.
 */
export const messageOutputEvent: OpenAIStreamEvent = {
  type: 'response.output_item.done',
  item_type: 'message',
  item: {
    type: 'message',
    content: [
      {
        type: 'output_text',
        text: 'Here is the response.',
        annotations: [
          { type: 'url_citation', url: 'https://example.com', title: 'Example Source' },
        ],
      },
    ],
  },
  response_id: 'resp_msg123',
};

// =============================================================================
// OpenAI Responses (Non-Streaming)
// =============================================================================

/**
 * Complete response object.
 */
export const completeResponse: OpenAIResponse = {
  id: 'resp_complete123',
  response_id: 'resp_complete123',
  model: 'gpt-4o',
  output_text: 'This is a complete response.',
  status: 'completed',
  finish_reason: 'stop',
  usage: {
    prompt_tokens: 20,
    completion_tokens: 10,
    total_tokens: 30,
  },
  created: 1705315800,
};

/**
 * Response with reasoning output.
 */
export const responseWithReasoning: OpenAIResponse = {
  id: 'resp_reasoning123',
  response_id: 'resp_reasoning123',
  model: 'o1-preview',
  output_text: 'The answer is 42.',
  status: 'completed',
  finish_reason: 'stop',
  reasoning: {
    summary: [{ text: 'I considered the question carefully and determined the answer.' }],
  },
  usage: {
    prompt_tokens: 25,
    completion_tokens: 15,
    reasoning_tokens: 100,
    total_tokens: 140,
  },
  created: 1705315800,
};

/**
 * Response with output array.
 */
export const responseWithOutputs: OpenAIResponse = {
  id: 'resp_outputs123',
  response_id: 'resp_outputs123',
  model: 'gpt-4o',
  output: [
    {
      type: 'message',
      content: [
        {
          type: 'output_text',
          text: 'Response content here.',
          annotations: [],
        },
      ],
    },
  ],
  status: 'completed',
  finish_reason: 'stop',
  usage: {
    prompt_tokens: 15,
    completion_tokens: 8,
    total_tokens: 23,
  },
  created: 1705315800,
};

/**
 * Response with web search results.
 */
export const responseWithSearch: OpenAIResponse = {
  id: 'resp_search123',
  response_id: 'resp_search123',
  model: 'gpt-4o',
  output_text: 'Based on my search, here are the results...',
  output: [
    {
      type: 'web_search_call',
      action: { type: 'web_search', query: 'latest news' },
    },
    {
      type: 'message',
      content: [
        {
          type: 'output_text',
          text: 'Based on my search, here are the results...',
          annotations: [
            { type: 'url_citation', url: 'https://news.example.com', title: 'News Article' },
            { type: 'url_citation', url: 'https://blog.example.com', title: 'Blog Post' },
          ],
        },
      ],
    },
  ],
  status: 'completed',
  finish_reason: 'stop',
  usage: {
    prompt_tokens: 30,
    completion_tokens: 50,
    total_tokens: 80,
  },
  created: 1705315800,
};

// =============================================================================
// Usage Fixtures
// =============================================================================

/**
 * Basic usage object.
 */
export const basicUsage: OpenAIUsage = {
  prompt_tokens: 15,
  completion_tokens: 25,
  total_tokens: 40,
};

/**
 * Usage with input/output tokens (alternative format).
 */
export const alternativeUsage: OpenAIUsage = {
  input_tokens: 20,
  output_tokens: 30,
  total_tokens: 50,
};

/**
 * Usage with reasoning tokens.
 */
export const reasoningUsage: OpenAIUsage = {
  prompt_tokens: 25,
  completion_tokens: 15,
  reasoning_tokens: 100,
  total_tokens: 140,
};

// =============================================================================
// Search Metadata Fixtures
// =============================================================================

/**
 * Search metadata with sources.
 */
export const searchMetadata: SearchMetadata = {
  sources: [
    {
      title: 'TypeScript Documentation',
      url: 'https://www.typescriptlang.org/docs/',
      snippet: 'TypeScript is a strongly typed programming language...',
    },
    {
      title: 'TypeScript GitHub',
      url: 'https://github.com/microsoft/TypeScript',
      snippet: 'TypeScript repository with source code and issues...',
    },
  ],
};

/**
 * Empty search metadata.
 */
export const emptySearchMetadata: SearchMetadata = {
  sources: [],
};

// =============================================================================
// SSE Text Chunks
// =============================================================================

/**
 * SSE chunk for response created event.
 */
export const sseResponseCreated = buildSSEEvent(responseCreatedEvent);

/**
 * SSE chunk for content delta.
 */
export const sseContentDelta = buildSSEEvent(contentDeltaEvent);

/**
 * SSE chunk for response done.
 */
export const sseResponseDone = buildSSEEvent(responseDoneEvent);

/**
 * SSE done marker.
 */
export const sseDone = buildSSEDone();

/**
 * Complete SSE stream for a simple response.
 */
export const simpleSSEStream: string[] = [
  buildSSEEvent({
    type: 'response.created',
    response_id: 'resp_001',
    model: 'gpt-4o',
    status: 'in_progress',
  }),
  buildSSEEvent({ type: 'response.output_text.delta', delta: 'Hello' }),
  buildSSEEvent({ type: 'response.output_text.delta', delta: ', ' }),
  buildSSEEvent({ type: 'response.output_text.delta', delta: 'world!' }),
  buildSSEEvent({ type: 'response.output_text.done', output_text: 'Hello, world!' }),
  buildSSEEvent({
    type: 'response.done',
    response_id: 'resp_001',
    status: 'completed',
    finish_reason: 'stop',
    usage: { prompt_tokens: 10, completion_tokens: 3, total_tokens: 13 },
  }),
  buildSSEDone(),
];

/**
 * SSE stream with reasoning (for o1 models).
 */
export const reasoningSSEStream: string[] = [
  buildSSEEvent({
    type: 'response.created',
    response_id: 'resp_o1',
    model: 'o1-preview',
    status: 'in_progress',
  }),
  buildSSEEvent({ type: 'response.reasoning_summary_text.delta', delta: 'Let me think...' }),
  buildSSEEvent({ type: 'response.reasoning_summary_text.delta', delta: ' about this problem.' }),
  buildSSEEvent({
    type: 'response.reasoning_summary.done',
    summary: [{ text: 'Let me think... about this problem.' }],
  }),
  buildSSEEvent({ type: 'response.output_text.delta', delta: 'The answer is 42.' }),
  buildSSEEvent({ type: 'response.output_text.done', output_text: 'The answer is 42.' }),
  buildSSEEvent({
    type: 'response.done',
    response_id: 'resp_o1',
    status: 'completed',
    finish_reason: 'stop',
    usage: { prompt_tokens: 15, completion_tokens: 10, reasoning_tokens: 50, total_tokens: 75 },
  }),
  buildSSEDone(),
];

/**
 * SSE stream with web search.
 */
export const webSearchSSEStream: string[] = [
  buildSSEEvent({
    type: 'response.created',
    response_id: 'resp_search',
    model: 'gpt-4o',
    status: 'in_progress',
  }),
  buildSSEEvent({
    type: 'response.output_item.added',
    item: {
      type: 'web_search_call',
      action: { type: 'web_search', query: 'latest TypeScript features' },
    },
  }),
  buildSSEEvent({ type: 'response.output_text.delta', delta: 'Based on ' }),
  buildSSEEvent({
    type: 'response.output_text.delta',
    delta: 'my search, TypeScript 5.4 includes...',
  }),
  buildSSEEvent({
    type: 'response.output_item.done',
    item: {
      type: 'message',
      content: [
        {
          type: 'output_text',
          text: 'Based on my search, TypeScript 5.4 includes...',
          annotations: [
            { type: 'url_citation', url: 'https://typescriptlang.org', title: 'TypeScript Docs' },
          ],
        },
      ],
    },
  }),
  buildSSEEvent({
    type: 'response.done',
    response_id: 'resp_search',
    status: 'completed',
    finish_reason: 'stop',
    usage: { prompt_tokens: 20, completion_tokens: 15, total_tokens: 35 },
  }),
  buildSSEDone(),
];

/**
 * SSE stream with error.
 */
export const errorSSEStream: string[] = [
  buildSSEEvent({
    type: 'error',
    error: {
      message: 'Rate limit exceeded',
      type: 'rate_limit_error',
      code: 'rate_limit_exceeded',
    },
  }),
];

// =============================================================================
// Event Sequences
// =============================================================================

/**
 * Create a simple text stream event sequence.
 */
export function createTextStreamEvents(text: string, chunkSize: number = 5): OpenAIStreamEvent[] {
  const events: OpenAIStreamEvent[] = [
    { type: 'response.created', response_id: 'resp_gen', model: 'gpt-4o', status: 'in_progress' },
  ];

  // Add delta events
  for (let i = 0; i < text.length; i += chunkSize) {
    events.push({
      type: 'response.output_text.delta',
      delta: text.slice(i, i + chunkSize),
    });
  }

  // Add completion events
  events.push({ type: 'response.output_text.done', output_text: text });
  events.push({
    type: 'response.done',
    response_id: 'resp_gen',
    status: 'completed',
    finish_reason: 'stop',
    usage: {
      prompt_tokens: 10,
      completion_tokens: text.split(' ').length,
      total_tokens: 10 + text.split(' ').length,
    },
  });

  return events;
}

/**
 * Create SSE text chunks from event sequence.
 */
export function createSSEChunks(events: OpenAIStreamEvent[]): string[] {
  const chunks = events.map(event => buildSSEEvent(event));
  chunks.push(buildSSEDone());
  return chunks;
}

/**
 * Concatenate SSE chunks for single-chunk tests.
 */
export function concatenateSSE(chunks: string[]): string {
  return chunks.join('');
}

// =============================================================================
// Error Responses
// =============================================================================

/**
 * Authentication error response.
 */
export const authErrorResponse = {
  error: {
    message: 'Invalid API key provided',
    type: 'invalid_api_key',
    code: 'invalid_api_key',
  },
};

/**
 * Rate limit error response.
 */
export const rateLimitErrorResponse = {
  error: {
    message: 'Rate limit exceeded. Please slow down.',
    type: 'rate_limit_error',
    code: 'rate_limit_exceeded',
  },
};

/**
 * Content filter error response.
 */
export const contentFilterErrorResponse = {
  error: {
    message: 'Your request was rejected due to content policy.',
    type: 'content_policy_violation',
    code: 'content_filter',
  },
};

/**
 * Model not found error response.
 */
export const modelNotFoundErrorResponse = {
  error: {
    message: 'The model `gpt-5` does not exist',
    type: 'invalid_request_error',
    code: 'model_not_found',
  },
};

/**
 * Server error response.
 */
export const serverErrorResponse = {
  error: {
    message: 'Internal server error',
    type: 'server_error',
    code: 'internal_error',
  },
};
