/**
 * @file Gemini Fixtures
 *
 * Test fixtures for Gemini API responses including:
 * - JSON array mode responses
 * - SSE/NDJSON streaming chunks
 * - Mixed chunk patterns for cross-chunk assembly tests
 */

import type {
  GeminiResponse,
  GeminiCandidate,
  GeminiResponsePart,
  GeminiUsageMetadata,
  GeminiSearchMetadata,
  GeminiRequest,
} from '@/core/ai/gemini/types';
import { buildSSEEvent, buildNDJSONLine } from '../helpers/streams';

// =============================================================================
// Response Parts
// =============================================================================

/**
 * Simple text part.
 */
export const textPart: GeminiResponsePart = {
  text: 'Hello, world!',
};

/**
 * Thinking part (for models with thinking).
 */
export const thinkingPart: GeminiResponsePart = {
  thinking: 'Let me analyze this step by step...',
  thought: true,
};

/**
 * Thought signature part (Gemini 3).
 */
export const thoughtSignaturePart: GeminiResponsePart = {
  thoughtSignature: 'encrypted-thought-signature-abc123',
};

/**
 * Combined thinking and text parts.
 */
export const thinkingAndTextParts: GeminiResponsePart[] = [
  { thinking: 'First, I need to understand the problem...', thought: true },
  { text: 'Based on my analysis, the answer is...' },
  { thoughtSignature: 'sig-xyz789' },
];

// =============================================================================
// Candidates
// =============================================================================

/**
 * Simple text candidate.
 */
export const textCandidate: GeminiCandidate = {
  content: {
    parts: [{ text: 'This is a simple response.' }],
    role: 'model',
  },
  finishReason: 'STOP',
  index: 0,
};

/**
 * Candidate with thinking tokens.
 */
export const thinkingCandidate: GeminiCandidate = {
  content: {
    parts: [
      { thinking: 'Let me think about this...', thought: true },
      { text: 'The answer is 42.' },
    ],
    role: 'model',
  },
  finishReason: 'STOP',
  index: 0,
};

/**
 * Candidate with thought signature (Gemini 3).
 */
export const thoughtSignatureCandidate: GeminiCandidate = {
  content: {
    parts: [
      { thinking: 'Processing the request...', thought: true },
      { text: 'Here is the result.' },
      { thoughtSignature: 'enc-sig-001' },
    ],
    role: 'model',
  },
  finishReason: 'STOP',
  index: 0,
};

/**
 * Candidate with grounding metadata (web search).
 */
export const searchCandidate: GeminiCandidate = {
  content: {
    parts: [{ text: 'According to recent sources, TypeScript 5.4...' }],
    role: 'model',
  },
  finishReason: 'STOP',
  index: 0,
  groundingMetadata: {
    webSearchQueries: ['TypeScript 5.4 features'],
    groundingChunks: [
      { web: { uri: 'https://typescriptlang.org', title: 'TypeScript Documentation' } },
      { web: { uri: 'https://devblogs.microsoft.com', title: 'TypeScript Blog' } },
    ],
    groundingSupports: [
      {
        segment: {
          startIndex: 0,
          endIndex: 50,
          text: 'According to recent sources, TypeScript 5.4...',
        },
        groundingChunkIndices: [0, 1],
      },
    ],
  },
};

// =============================================================================
// Usage Metadata
// =============================================================================

/**
 * Basic usage metadata.
 */
export const basicUsageMetadata: GeminiUsageMetadata = {
  promptTokenCount: 25,
  candidatesTokenCount: 50,
  totalTokenCount: 75,
};

/**
 * Usage metadata with thinking tokens.
 */
export const thinkingUsageMetadata: GeminiUsageMetadata = {
  promptTokenCount: 30,
  candidatesTokenCount: 40,
  totalTokenCount: 170,
  thinkingTokenCount: 100,
};

// =============================================================================
// Search Metadata
// =============================================================================

/**
 * Web search metadata.
 */
export const webSearchMetadata: GeminiSearchMetadata = {
  webSearchQueries: ['latest JavaScript features 2024'],
  groundingChunks: [
    { web: { uri: 'https://developer.mozilla.org', title: 'MDN Web Docs' } },
    { web: { uri: 'https://javascript.info', title: 'JavaScript.info' } },
  ],
  groundingSupports: [
    {
      segment: { startIndex: 0, endIndex: 100, text: 'JavaScript ES2024 introduces...' },
      groundingChunkIndices: [0],
    },
  ],
};

/**
 * Search metadata with snake_case (API sometimes returns this).
 */
export const snakeCaseSearchMetadata: GeminiSearchMetadata = {
  web_search_queries: ['Python async await'],
  grounding_chunks: [{ web: { uri: 'https://docs.python.org', title: 'Python Docs' } }],
  grounding_supports: [
    {
      segment: { start_index: 0, end_index: 50, text: 'Python async/await...' },
      grounding_chunk_indices: [0],
    },
  ],
  search_entry_point: {
    rendered_content: '<div>Search results...</div>',
  },
};

// =============================================================================
// Complete Responses
// =============================================================================

/**
 * Simple text response.
 */
export const simpleResponse: GeminiResponse = {
  candidates: [textCandidate],
  usageMetadata: basicUsageMetadata,
};

/**
 * Response with thinking.
 */
export const thinkingResponse: GeminiResponse = {
  candidates: [thinkingCandidate],
  usageMetadata: thinkingUsageMetadata,
};

/**
 * Response with thought signature.
 */
export const thoughtSignatureResponse: GeminiResponse = {
  candidates: [thoughtSignatureCandidate],
  usageMetadata: thinkingUsageMetadata,
};

/**
 * Response with web search results.
 */
export const searchResponse: GeminiResponse = {
  candidates: [searchCandidate],
  usageMetadata: basicUsageMetadata,
  groundingMetadata: webSearchMetadata,
};

/**
 * Empty response (no candidates).
 */
export const emptyResponse: GeminiResponse = {
  candidates: [],
  usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 0, totalTokenCount: 10 },
};

// =============================================================================
// JSON Array Mode Responses
// =============================================================================

/**
 * Single chunk JSON array (complete response).
 */
export const singleChunkJsonArray: GeminiResponse[] = [simpleResponse];

/**
 * Multi-chunk JSON array response sequence.
 */
export const multiChunkJsonArray: GeminiResponse[] = [
  {
    candidates: [
      {
        content: { parts: [{ text: 'Part 1: ' }], role: 'model' },
        index: 0,
      },
    ],
  },
  {
    candidates: [
      {
        content: { parts: [{ text: 'Part 2: ' }], role: 'model' },
        index: 0,
      },
    ],
  },
  {
    candidates: [
      {
        content: { parts: [{ text: 'End.' }], role: 'model' },
        finishReason: 'STOP',
        index: 0,
      },
    ],
    usageMetadata: basicUsageMetadata,
  },
];

// =============================================================================
// SSE/NDJSON Streaming Chunks
// =============================================================================

/**
 * SSE event for content delta.
 */
export const sseContentDelta = buildSSEEvent({
  candidates: [{ content: { parts: [{ text: 'Hello' }], role: 'model' }, index: 0 }],
});

/**
 * SSE event for thinking delta.
 */
export const sseThinkingDelta = buildSSEEvent({
  candidates: [
    {
      content: { parts: [{ thinking: 'Analyzing...', thought: true }], role: 'model' },
      index: 0,
    },
  ],
});

/**
 * SSE event for completion.
 */
export const sseCompletion = buildSSEEvent({
  candidates: [
    {
      content: { parts: [{ text: '' }], role: 'model' },
      finishReason: 'STOP',
      index: 0,
    },
  ],
  usageMetadata: basicUsageMetadata,
});

/**
 * NDJSON line for content delta.
 */
export const ndjsonContentDelta = buildNDJSONLine({
  candidates: [{ content: { parts: [{ text: 'World!' }], role: 'model' }, index: 0 }],
});

/**
 * Complete SSE stream sequence.
 */
export const simpleSSEStream: string[] = [
  buildSSEEvent({
    candidates: [{ content: { parts: [{ text: 'Hello' }], role: 'model' }, index: 0 }],
  }),
  buildSSEEvent({
    candidates: [{ content: { parts: [{ text: ', ' }], role: 'model' }, index: 0 }],
  }),
  buildSSEEvent({
    candidates: [{ content: { parts: [{ text: 'world!' }], role: 'model' }, index: 0 }],
  }),
  buildSSEEvent({
    candidates: [{ content: { parts: [], role: 'model' }, finishReason: 'STOP', index: 0 }],
    usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 3, totalTokenCount: 13 },
  }),
];

/**
 * SSE stream with thinking tokens.
 */
export const thinkingSSEStream: string[] = [
  buildSSEEvent({
    candidates: [
      {
        content: {
          parts: [{ thinking: 'Let me think about this...', thought: true }],
          role: 'model',
        },
        index: 0,
      },
    ],
  }),
  buildSSEEvent({
    candidates: [
      {
        content: { parts: [{ text: 'The answer is ' }], role: 'model' },
        index: 0,
      },
    ],
  }),
  buildSSEEvent({
    candidates: [
      {
        content: { parts: [{ text: '42.' }], role: 'model' },
        index: 0,
      },
    ],
  }),
  buildSSEEvent({
    candidates: [
      {
        content: { parts: [{ thoughtSignature: 'sig-001' }], role: 'model' },
        finishReason: 'STOP',
        index: 0,
      },
    ],
    usageMetadata: thinkingUsageMetadata,
  }),
];

/**
 * NDJSON stream sequence.
 */
export const simpleNDJSONStream: string[] = [
  buildNDJSONLine({
    candidates: [{ content: { parts: [{ text: 'Hello' }], role: 'model' }, index: 0 }],
  }),
  buildNDJSONLine({
    candidates: [{ content: { parts: [{ text: ' there!' }], role: 'model' }, index: 0 }],
  }),
  buildNDJSONLine({
    candidates: [{ content: { parts: [], role: 'model' }, finishReason: 'STOP', index: 0 }],
    usageMetadata: basicUsageMetadata,
  }),
];

// =============================================================================
// Mixed/Partial Chunk Patterns (for cross-chunk assembly tests)
// =============================================================================

/**
 * JSON array split across chunks (opening bracket separate).
 */
export const partialJsonArrayChunks: string[] = [
  '[',
  JSON.stringify({
    candidates: [{ content: { parts: [{ text: 'Hello' }], role: 'model' }, index: 0 }],
  }),
  ',',
  JSON.stringify({
    candidates: [{ content: { parts: [{ text: ' world' }], role: 'model' }, index: 0 }],
  }),
  ']',
];

/**
 * JSON object split mid-key (tests bracket depth handling).
 */
export const splitMidKeyChunks: string[] = [
  '{"cand',
  'idates":[{"content":{"parts":[{"text":"Hello"}],"role":"model"},"index":0}]}',
];

/**
 * JSON with escaped characters split across chunks.
 */
export const escapedStringSplitChunks: string[] = [
  '{"candidates":[{"content":{"parts":[{"text":"Hello\\"',
  'World\\nNew line"}],"role":"model"},"index":0}]}',
];

/**
 * Nested braces that could cause false end detection.
 */
export const nestedBracesChunks: string[] = [
  '{"candidates":[{"content":{"parts":[{"text":"Code: function() { return { a: 1 }; }"}]',
  ',"role":"model"},"index":0}]}',
];

/**
 * SSE with blank line delimiter (flush trigger).
 */
export const sseWithBlankLines: string[] = [
  'data: {"candidates":[{"content":{"parts":[{"text":"Part1"}]}}]}\n\n',
  'data: {"candidates":[{"content":{"parts":[{"text":"Part2"}]}}]}\n\n',
];

/**
 * Stream with [DONE] marker.
 */
export const streamWithDoneMarker: string[] = [
  'data: {"candidates":[{"content":{"parts":[{"text":"Hello"}]}}]}\n\n',
  'data: [DONE]\n\n',
];

// =============================================================================
// Malformed Input Patterns (for error handling tests)
// =============================================================================

/**
 * Invalid JSON that should not cause infinite loop.
 */
export const malformedJsonChunks: string[] = [
  '{"candidates":[{"content":{',
  // Missing closing braces - should eventually timeout or error gracefully
];

/**
 * Truncated response.
 */
export const truncatedResponse: string = '{"candidates":[{"content":{"parts":[{"text":"Trunca';

/**
 * Response with unexpected structure.
 */
export const unexpectedStructure: GeminiResponse = {
  // @ts-expect-error - Testing unexpected structure
  unexpectedField: 'value',
  candidates: undefined,
};

// =============================================================================
// Request Fixtures
// =============================================================================

/**
 * Simple chat request.
 */
export const simpleChatRequest: GeminiRequest = {
  contents: [{ role: 'user', parts: [{ text: 'Hello' }] }],
  generationConfig: {
    maxOutputTokens: 1024,
  },
};

/**
 * Request with system instruction.
 */
export const requestWithSystem: GeminiRequest = {
  contents: [{ role: 'user', parts: [{ text: 'What is TypeScript?' }] }],
  generationConfig: {
    maxOutputTokens: 2048,
  },
  systemInstruction: {
    parts: [{ text: 'You are a helpful programming assistant.' }],
  },
};

/**
 * Request with thinking config (Gemini 2.5).
 */
export const requestWithThinkingConfig: GeminiRequest = {
  contents: [{ role: 'user', parts: [{ text: 'Solve this math problem...' }] }],
  generationConfig: {
    maxOutputTokens: 4096,
    thinkingConfig: {
      thinkingBudget: 1024,
      includeThoughts: true,
    },
  },
};

/**
 * Request with thinking level (Gemini 3).
 */
export const requestWithThinkingLevel: GeminiRequest = {
  contents: [{ role: 'user', parts: [{ text: 'Complex reasoning task...' }] }],
  generationConfig: {
    maxOutputTokens: 4096,
    thinkingLevel: 'high',
  },
};

/**
 * Multi-turn conversation request.
 */
export const multiTurnRequest: GeminiRequest = {
  contents: [
    { role: 'user', parts: [{ text: 'What is JavaScript?' }] },
    { role: 'model', parts: [{ text: 'JavaScript is a programming language...' }] },
    { role: 'user', parts: [{ text: 'How does it differ from TypeScript?' }] },
  ],
  generationConfig: {
    maxOutputTokens: 2048,
  },
};

/**
 * Request with thought signature from previous turn.
 */
export const requestWithThoughtSignature: GeminiRequest = {
  contents: [
    { role: 'user', parts: [{ text: 'First question' }] },
    {
      role: 'model',
      parts: [{ text: 'First answer' }, { thoughtSignature: 'prev-sig-001' }],
    },
    { role: 'user', parts: [{ text: 'Follow-up question' }] },
  ],
  generationConfig: {
    maxOutputTokens: 2048,
    thinkingLevel: 'medium',
  },
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create a streaming response sequence for testing.
 */
export function createStreamSequence(
  text: string,
  options: { chunkSize?: number; includeThinking?: boolean } = {}
): GeminiResponse[] {
  const { chunkSize = 10, includeThinking = false } = options;
  const responses: GeminiResponse[] = [];

  // Add thinking chunk if requested
  if (includeThinking) {
    responses.push({
      candidates: [
        {
          content: {
            parts: [{ thinking: 'Processing the request...', thought: true }],
            role: 'model',
          },
          index: 0,
        },
      ],
    });
  }

  // Split text into chunks
  for (let i = 0; i < text.length; i += chunkSize) {
    const chunk = text.slice(i, i + chunkSize);
    const isLast = i + chunkSize >= text.length;

    responses.push({
      candidates: [
        {
          content: {
            parts: [{ text: chunk }],
            role: 'model',
          },
          finishReason: isLast ? 'STOP' : undefined,
          index: 0,
        },
      ],
      usageMetadata: isLast
        ? {
            promptTokenCount: 20,
            candidatesTokenCount: Math.ceil(text.length / 4),
            totalTokenCount: 20 + Math.ceil(text.length / 4),
          }
        : undefined,
    });
  }

  return responses;
}

/**
 * Create SSE chunks from response sequence.
 */
export function createSSEFromResponses(responses: GeminiResponse[]): string[] {
  return responses.map(r => buildSSEEvent(r));
}

/**
 * Create NDJSON from response sequence.
 */
export function createNDJSONFromResponses(responses: GeminiResponse[]): string[] {
  return responses.map(r => buildNDJSONLine(r));
}

/**
 * Create a JSON array string from responses.
 */
export function createJsonArrayString(responses: GeminiResponse[]): string {
  return JSON.stringify(responses);
}
