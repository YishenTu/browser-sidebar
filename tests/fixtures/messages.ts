/**
 * @file Message Fixtures
 *
 * Test fixtures for ProviderChatMessage, sections, attachments, and thoughtSignatures.
 * These fixtures provide consistent, reusable test data for message-related tests.
 */

import type { ProviderChatMessage, StreamChunk } from '@/types/providers';
import type { ChatMessage, ComplexMessageContent } from '@/types/chat';

// =============================================================================
// Provider Chat Messages
// =============================================================================

/**
 * Create a provider chat message fixture.
 */
export function createProviderChatMessage(
  overrides: Partial<ProviderChatMessage> = {}
): ProviderChatMessage {
  return {
    id: 'msg-test-001',
    role: 'user',
    content: 'Hello, how can you help me today?',
    timestamp: new Date('2024-01-15T10:30:00Z'),
    ...overrides,
  };
}

/**
 * Simple user message fixture.
 */
export const simpleUserMessage: ProviderChatMessage = {
  id: 'msg-user-001',
  role: 'user',
  content: 'What is TypeScript?',
  timestamp: new Date('2024-01-15T10:30:00Z'),
};

/**
 * Simple assistant message fixture.
 */
export const simpleAssistantMessage: ProviderChatMessage = {
  id: 'msg-asst-001',
  role: 'assistant',
  content:
    'TypeScript is a strongly typed programming language that builds on JavaScript, giving you better tooling at any scale.',
  timestamp: new Date('2024-01-15T10:30:05Z'),
  metadata: {
    tokens: 25,
    model: 'gpt-4o',
  },
};

/**
 * System message fixture.
 */
export const systemMessage: ProviderChatMessage = {
  id: 'msg-sys-001',
  role: 'system',
  content: 'You are a helpful assistant that explains programming concepts clearly.',
  timestamp: new Date('2024-01-15T10:29:00Z'),
};

/**
 * Message with thinking/reasoning tokens.
 */
export const messageWithThinking: ProviderChatMessage = {
  id: 'msg-asst-002',
  role: 'assistant',
  content: 'The answer is 42.',
  thinking: 'Let me think about this step by step...',
  timestamp: new Date('2024-01-15T10:31:00Z'),
  metadata: {
    tokens: 15,
    thinkingTokens: 50,
    model: 'o1-preview',
  },
};

/**
 * A typical conversation array.
 */
export const conversationMessages: ProviderChatMessage[] = [
  systemMessage,
  simpleUserMessage,
  simpleAssistantMessage,
];

/**
 * Message with metadata.
 */
export const messageWithMetadata: ProviderChatMessage = {
  id: 'msg-meta-001',
  role: 'assistant',
  content: 'Here is the code you requested.',
  timestamp: new Date('2024-01-15T10:32:00Z'),
  metadata: {
    tokens: 150,
    model: 'gpt-4o',
    responseTime: 1250,
    searchResults: [
      { title: 'TypeScript Docs', url: 'https://typescriptlang.org', snippet: 'Official docs' },
    ],
  },
};

// =============================================================================
// Chat Message Fixtures (Internal App Format)
// =============================================================================

/**
 * Create a chat message fixture.
 */
export function createChatMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'chat-msg-001',
    role: 'user',
    content: 'Test message content',
    timestamp: Date.now(),
    status: 'sent',
    ...overrides,
  };
}

/**
 * User chat message fixture.
 */
export const userChatMessage: ChatMessage = {
  id: 'chat-user-001',
  role: 'user',
  content: 'Can you explain async/await?',
  timestamp: 1705315800000,
  status: 'sent',
  editable: true,
};

/**
 * Assistant chat message fixture.
 */
export const assistantChatMessage: ChatMessage = {
  id: 'chat-asst-001',
  role: 'assistant',
  content: 'Async/await is syntactic sugar for handling promises in JavaScript.',
  timestamp: 1705315805000,
  status: 'sent',
  editable: false,
  metadata: {
    tokens: 20,
    model: 'gpt-4o',
    responseTime: 450,
  },
};

/**
 * Streaming chat message fixture.
 */
export const streamingChatMessage: ChatMessage = {
  id: 'chat-stream-001',
  role: 'assistant',
  content: {
    text: 'Here is the partial response...',
    isStreaming: true,
    streamingId: 'stream-001',
  },
  timestamp: 1705315810000,
  status: 'streaming',
};

/**
 * Error chat message fixture.
 */
export const errorChatMessage: ChatMessage = {
  id: 'chat-error-001',
  role: 'assistant',
  content: '',
  timestamp: 1705315815000,
  status: 'error',
  error: {
    message: 'Rate limit exceeded. Please try again later.',
    code: 'rate_limit_exceeded',
  },
};

/**
 * Complex content message fixture.
 */
export const complexContentMessage: ChatMessage = {
  id: 'chat-complex-001',
  role: 'assistant',
  content: {
    text: 'Here is an example of TypeScript code:',
    codeBlocks: [
      {
        language: 'typescript',
        code: 'const greeting: string = "Hello, World!";\nconsole.log(greeting);',
        filename: 'example.ts',
      },
    ],
  } as ComplexMessageContent,
  timestamp: 1705315820000,
  status: 'sent',
};

// =============================================================================
// Message Sections (for multi-part content)
// =============================================================================

/**
 * Section types for provider messages.
 */
export interface MessageSection {
  type: 'text' | 'image' | 'code' | 'file';
  content: string;
  metadata?: Record<string, unknown>;
}

/**
 * Text section fixture.
 */
export const textSection: MessageSection = {
  type: 'text',
  content: 'This is a text section explaining the concept.',
};

/**
 * Image section fixture.
 */
export const imageSection: MessageSection = {
  type: 'image',
  content:
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  metadata: {
    mimeType: 'image/png',
    width: 100,
    height: 100,
  },
};

/**
 * Code section fixture.
 */
export const codeSection: MessageSection = {
  type: 'code',
  content: 'function hello() { return "world"; }',
  metadata: {
    language: 'javascript',
  },
};

/**
 * File section fixture.
 */
export const fileSection: MessageSection = {
  type: 'file',
  content: 'fileId:abc123',
  metadata: {
    filename: 'document.pdf',
    mimeType: 'application/pdf',
    size: 1024,
  },
};

/**
 * Multi-section message array.
 */
export const multiSectionContent: MessageSection[] = [textSection, codeSection, textSection];

// =============================================================================
// Attachments
// =============================================================================

/**
 * Attachment fixture type.
 */
export interface MessageAttachment {
  id: string;
  type: 'image' | 'file';
  name: string;
  mimeType: string;
  size: number;
  url?: string;
  data?: string;
  status: 'pending' | 'uploading' | 'uploaded' | 'error';
  uploadProgress?: number;
  fileId?: string;
}

/**
 * Image attachment fixture (pending).
 */
export const pendingImageAttachment: MessageAttachment = {
  id: 'attach-001',
  type: 'image',
  name: 'screenshot.png',
  mimeType: 'image/png',
  size: 15000,
  data: 'data:image/png;base64,iVBORw0KGgo...',
  status: 'pending',
};

/**
 * Image attachment fixture (uploaded).
 */
export const uploadedImageAttachment: MessageAttachment = {
  id: 'attach-002',
  type: 'image',
  name: 'photo.jpg',
  mimeType: 'image/jpeg',
  size: 25000,
  status: 'uploaded',
  fileId: 'file_abc123',
  url: 'https://api.provider.com/files/file_abc123',
};

/**
 * File attachment fixture.
 */
export const fileAttachment: MessageAttachment = {
  id: 'attach-003',
  type: 'file',
  name: 'document.pdf',
  mimeType: 'application/pdf',
  size: 102400,
  status: 'uploaded',
  fileId: 'file_def456',
};

/**
 * Uploading attachment fixture.
 */
export const uploadingAttachment: MessageAttachment = {
  id: 'attach-004',
  type: 'image',
  name: 'large-image.png',
  mimeType: 'image/png',
  size: 500000,
  status: 'uploading',
  uploadProgress: 45,
};

/**
 * Error attachment fixture.
 */
export const errorAttachment: MessageAttachment = {
  id: 'attach-005',
  type: 'file',
  name: 'too-large.zip',
  mimeType: 'application/zip',
  size: 50000000,
  status: 'error',
};

// =============================================================================
// Thought Signatures (for models with thinking)
// =============================================================================

/**
 * Thought signature fixture type.
 */
export interface ThoughtSignature {
  id: string;
  collapsed: boolean;
  thinkingContent: string;
  thinkingTokens: number;
  timestamp: number;
}

/**
 * Basic thought signature fixture.
 */
export const basicThoughtSignature: ThoughtSignature = {
  id: 'thought-001',
  collapsed: true,
  thinkingContent:
    'Let me analyze this step by step.\n1. First, I consider...\n2. Then, I evaluate...',
  thinkingTokens: 150,
  timestamp: 1705315800000,
};

/**
 * Expanded thought signature fixture.
 */
export const expandedThoughtSignature: ThoughtSignature = {
  id: 'thought-002',
  collapsed: false,
  thinkingContent:
    'To solve this problem, I need to:\n\n' +
    '1. Parse the input data\n' +
    '2. Validate the format\n' +
    '3. Apply the transformation\n' +
    '4. Return the result\n\n' +
    'Let me work through each step...',
  thinkingTokens: 500,
  timestamp: 1705315900000,
};

/**
 * Long thought signature fixture.
 */
export const longThoughtSignature: ThoughtSignature = {
  id: 'thought-003',
  collapsed: true,
  thinkingContent: 'A'.repeat(5000) + '... (truncated for brevity)',
  thinkingTokens: 2500,
  timestamp: 1705316000000,
};

// =============================================================================
// Stream Chunk Fixtures
// =============================================================================

/**
 * Create a stream chunk fixture.
 */
export function createStreamChunk(overrides: Partial<StreamChunk> = {}): StreamChunk {
  return {
    id: 'chunk-001',
    object: 'chat.completion.chunk',
    created: 1705315800,
    model: 'gpt-4o',
    choices: [
      {
        index: 0,
        delta: { content: 'Hello' },
        finishReason: null,
      },
    ],
    ...overrides,
  };
}

/**
 * Content delta chunk fixture.
 */
export const contentDeltaChunk: StreamChunk = {
  id: 'chunk-content',
  object: 'chat.completion.chunk',
  created: 1705315800,
  model: 'gpt-4o',
  choices: [
    {
      index: 0,
      delta: { content: ' world!' },
      finishReason: null,
    },
  ],
};

/**
 * Role delta chunk fixture (first chunk).
 */
export const roleDeltaChunk: StreamChunk = {
  id: 'chunk-role',
  object: 'chat.completion.chunk',
  created: 1705315800,
  model: 'gpt-4o',
  choices: [
    {
      index: 0,
      delta: { role: 'assistant' },
      finishReason: null,
    },
  ],
};

/**
 * Finish chunk fixture (last chunk).
 */
export const finishChunk: StreamChunk = {
  id: 'chunk-finish',
  object: 'chat.completion.chunk',
  created: 1705315801,
  model: 'gpt-4o',
  choices: [
    {
      index: 0,
      delta: {},
      finishReason: 'stop',
    },
  ],
  usage: {
    promptTokens: 10,
    completionTokens: 15,
    totalTokens: 25,
  },
};

/**
 * Thinking delta chunk fixture.
 */
export const thinkingDeltaChunk: StreamChunk = {
  id: 'chunk-thinking',
  object: 'chat.completion.chunk',
  created: 1705315800,
  model: 'o1-preview',
  choices: [
    {
      index: 0,
      delta: { thinking: 'Let me consider...' },
      finishReason: null,
    },
  ],
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create a sequence of stream chunks representing a complete response.
 */
export function createStreamChunkSequence(content: string, chunkSize: number = 5): StreamChunk[] {
  const chunks: StreamChunk[] = [];
  const created = Math.floor(Date.now() / 1000);

  // First chunk with role
  chunks.push({
    id: 'chunk-seq-0',
    object: 'chat.completion.chunk',
    created,
    model: 'gpt-4o',
    choices: [{ index: 0, delta: { role: 'assistant' }, finishReason: null }],
  });

  // Content chunks
  for (let i = 0; i < content.length; i += chunkSize) {
    const chunkContent = content.slice(i, i + chunkSize);
    chunks.push({
      id: `chunk-seq-${chunks.length}`,
      object: 'chat.completion.chunk',
      created,
      model: 'gpt-4o',
      choices: [{ index: 0, delta: { content: chunkContent }, finishReason: null }],
    });
  }

  // Final chunk
  chunks.push({
    id: `chunk-seq-${chunks.length}`,
    object: 'chat.completion.chunk',
    created,
    model: 'gpt-4o',
    choices: [{ index: 0, delta: {}, finishReason: 'stop' }],
    usage: {
      promptTokens: 10,
      completionTokens: content.length,
      totalTokens: 10 + content.length,
    },
  });

  return chunks;
}

/**
 * Create messages for testing a multi-turn conversation.
 */
export function createConversationFixture(turns: number = 3): ProviderChatMessage[] {
  const messages: ProviderChatMessage[] = [systemMessage];
  const baseTime = new Date('2024-01-15T10:30:00Z').getTime();

  for (let i = 0; i < turns; i++) {
    messages.push({
      id: `msg-user-${i}`,
      role: 'user',
      content: `User message ${i + 1}`,
      timestamp: new Date(baseTime + i * 10000),
    });

    messages.push({
      id: `msg-asst-${i}`,
      role: 'assistant',
      content: `Assistant response ${i + 1}`,
      timestamp: new Date(baseTime + i * 10000 + 5000),
      metadata: { tokens: 20 + i * 5 },
    });
  }

  return messages;
}
