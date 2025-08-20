/**
 * @file Chat Type Definitions
 *
 * Comprehensive TypeScript type definitions for the chat system including
 * message types, conversation structure, and runtime type validation.
 *
 * Supports different message roles, streaming content, error states,
 * markdown content, code blocks, and conversation management.
 */

// =============================================================================
// Core Type Definitions
// =============================================================================

/**
 * Valid message roles in the chat system
 */
export type MessageRole = 'user' | 'assistant' | 'system';

/**
 * Message status indicating current state
 */
export type MessageStatus = 'sending' | 'sent' | 'error' | 'streaming';

/**
 * Code block structure for syntax-highlighted content
 */
export interface CodeBlock {
  /** Programming language for syntax highlighting */
  language: string;
  /** The actual code content */
  code: string;
  /** Optional filename for context */
  filename?: string;
}

/**
 * Complex message content with support for code blocks and markdown
 */
export interface ComplexMessageContent {
  /** Main text content (markdown supported) */
  text: string;
  /** Array of code blocks */
  codeBlocks?: CodeBlock[];
}

/**
 * Streaming content for real-time AI responses
 */
export interface StreamingContent {
  /** Current text content (partial or complete) */
  text: string;
  /** Whether content is still streaming */
  isStreaming: boolean;
  /** Unique identifier for the streaming session */
  streamingId: string;
}

/**
 * Union type for all possible message content formats
 */
export type MessageContent = string | ComplexMessageContent | StreamingContent;

/**
 * Base chat message interface
 */
export interface ChatMessage {
  /** Unique message identifier */
  id: string;
  /** Message role (user, assistant, system) */
  role: MessageRole;
  /** Message content (string, complex, or streaming) */
  content: MessageContent;
  /** Message creation timestamp */
  timestamp: number;
  /** Current message status */
  status: MessageStatus;
  /** Optional error information */
  error?: {
    message: string;
    code?: string;
  };
  /** Whether message can be edited (default: false) */
  editable?: boolean;
  /** Whether message can be deleted (default: true) */
  deletable?: boolean;
  /** Optional metadata */
  metadata?: {
    tokens?: number;
    model?: string;
    responseTime?: number;
    [key: string]: unknown;
  };
}

/**
 * User message type (more specific typing)
 */
export interface UserMessage extends ChatMessage {
  role: 'user';
  editable?: true; // Users can edit their messages
}

/**
 * Assistant message type (more specific typing)
 */
export interface AssistantMessage extends ChatMessage {
  role: 'assistant';
  editable?: false; // Assistant messages cannot be edited
}

/**
 * System message type (more specific typing)
 */
export interface SystemMessage extends ChatMessage {
  role: 'system';
  editable?: false; // System messages cannot be edited
  deletable?: false; // System messages cannot be deleted
}

/**
 * Conversation metadata
 */
export interface ConversationMetadata {
  /** When conversation was created */
  createdAt: number;
  /** When conversation was last updated */
  updatedAt: number;
  /** Total number of messages */
  messageCount: number;
  /** Optional conversation tags */
  tags?: string[];
  /** AI model used */
  model?: string;
  /** Total tokens used */
  totalTokens?: number;
}

/**
 * Complete conversation structure
 */
export interface Conversation {
  /** Unique conversation identifier */
  id: string;
  /** Conversation title */
  title: string;
  /** Array of chat messages */
  messages: ChatMessage[];
  /** Conversation metadata */
  metadata: ConversationMetadata;
  /** Whether conversation is archived */
  archived?: boolean;
  /** Whether conversation is pinned */
  pinned?: boolean;
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard to check if a value is a valid MessageRole
 */
export function isValidMessageRole(value: any): value is MessageRole {
  return typeof value === 'string' && ['user', 'assistant', 'system'].includes(value);
}

/**
 * Type guard to check if a value is a valid MessageStatus
 */
export function isValidMessageStatus(value: any): value is MessageStatus {
  return typeof value === 'string' && ['sending', 'sent', 'error', 'streaming'].includes(value);
}

/**
 * Type guard to check if a value is a CodeBlock
 */
export function isCodeBlock(value: any): value is CodeBlock {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.language === 'string' &&
    typeof value.code === 'string' &&
    (value.filename === undefined || typeof value.filename === 'string')
  );
}

/**
 * Type guard to check if a value is ComplexMessageContent
 */
export function isComplexMessageContent(value: any): value is ComplexMessageContent {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.text === 'string' &&
    (value.codeBlocks === undefined ||
      (Array.isArray(value.codeBlocks) && value.codeBlocks.every(isCodeBlock)))
  );
}

/**
 * Type guard to check if a value is StreamingContent
 */
export function isStreamingContent(value: any): value is StreamingContent {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.text === 'string' &&
    typeof value.isStreaming === 'boolean' &&
    typeof value.streamingId === 'string'
  );
}

/**
 * Type guard to check if a value is valid MessageContent
 */
export function isMessageContent(value: any): value is MessageContent {
  return typeof value === 'string' || isComplexMessageContent(value) || isStreamingContent(value);
}

/**
 * Type guard to check if a value is a valid ChatMessage
 */
export function isChatMessage(value: any): value is ChatMessage {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  try {
    return (
      typeof value.id === 'string' &&
      isValidMessageRole(value.role) &&
      isMessageContent(value.content) &&
      typeof value.timestamp === 'number' &&
      value.timestamp > 0 &&
      isValidMessageStatus(value.status) &&
      (value.error === undefined ||
        (typeof value.error === 'object' &&
          value.error !== null &&
          typeof value.error.message === 'string')) &&
      (value.editable === undefined || typeof value.editable === 'boolean') &&
      (value.deletable === undefined || typeof value.deletable === 'boolean') &&
      (value.metadata === undefined || typeof value.metadata === 'object')
    );
  } catch {
    // Handle circular references or other errors
    return false;
  }
}

/**
 * Type guard to check if a ChatMessage is a UserMessage
 */
export function isUserMessage(value: any): value is UserMessage {
  return isChatMessage(value) && value.role === 'user';
}

/**
 * Type guard to check if a ChatMessage is an AssistantMessage
 */
export function isAssistantMessage(value: any): value is AssistantMessage {
  return isChatMessage(value) && value.role === 'assistant';
}

/**
 * Type guard to check if a ChatMessage is a SystemMessage
 */
export function isSystemMessage(value: any): value is SystemMessage {
  return isChatMessage(value) && value.role === 'system';
}

/**
 * Type guard to check if a value is a valid ConversationMetadata
 */
export function isConversationMetadata(value: any): value is ConversationMetadata {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.createdAt === 'number' &&
    typeof value.updatedAt === 'number' &&
    typeof value.messageCount === 'number' &&
    value.messageCount >= 0 &&
    (value.tags === undefined ||
      (Array.isArray(value.tags) && value.tags.every((tag: any) => typeof tag === 'string'))) &&
    (value.model === undefined || typeof value.model === 'string') &&
    (value.totalTokens === undefined || typeof value.totalTokens === 'number')
  );
}

/**
 * Type guard to check if a value is a valid Conversation
 */
export function isConversation(value: any): value is Conversation {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    Array.isArray(value.messages) &&
    value.messages.every(isChatMessage) &&
    isConversationMetadata(value.metadata) &&
    (value.archived === undefined || typeof value.archived === 'boolean') &&
    (value.pinned === undefined || typeof value.pinned === 'boolean')
  );
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generates a unique message ID
 */
function generateMessageId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `msg_${timestamp}_${random}`;
}

/**
 * Generates a unique conversation ID
 */
function generateConversationId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `conv_${timestamp}_${random}`;
}

/**
 * Creates a new chat message with proper defaults
 */
export function createChatMessage(params: {
  role: MessageRole;
  content: MessageContent;
  status?: MessageStatus;
  id?: string;
  timestamp?: number;
  error?: ChatMessage['error'];
  editable?: boolean;
  deletable?: boolean;
  metadata?: ChatMessage['metadata'];
}): ChatMessage {
  const now = Date.now();

  return {
    id: params.id || generateMessageId(),
    role: params.role,
    content: params.content,
    timestamp: params.timestamp || now,
    status: params.status || 'sending',
    error: params.error,
    editable: params.editable,
    deletable: params.deletable,
    metadata: params.metadata,
  };
}

/**
 * Creates a new user message
 */
export function createUserMessage(
  content: MessageContent,
  options: {
    status?: MessageStatus;
    id?: string;
    timestamp?: number;
    metadata?: ChatMessage['metadata'];
  } = {}
): UserMessage {
  return {
    ...createChatMessage({
      role: 'user',
      content,
      ...options,
    }),
    role: 'user',
    editable: true,
  } as UserMessage;
}

/**
 * Creates a new assistant message
 */
export function createAssistantMessage(
  content: MessageContent,
  options: {
    status?: MessageStatus;
    id?: string;
    timestamp?: number;
    metadata?: ChatMessage['metadata'];
  } = {}
): AssistantMessage {
  return {
    ...createChatMessage({
      role: 'assistant',
      content,
      ...options,
    }),
    role: 'assistant',
    editable: false,
  } as AssistantMessage;
}

/**
 * Creates a new system message
 */
export function createSystemMessage(
  content: MessageContent,
  options: {
    status?: MessageStatus;
    id?: string;
    timestamp?: number;
    metadata?: ChatMessage['metadata'];
  } = {}
): SystemMessage {
  return {
    ...createChatMessage({
      role: 'system',
      content,
      status: options.status || 'sent', // System messages are usually sent immediately
      ...options,
    }),
    role: 'system',
    editable: false,
    deletable: false,
  } as SystemMessage;
}

/**
 * Creates a new conversation
 */
export function createConversation(
  title: string,
  options: {
    id?: string;
    messages?: ChatMessage[];
    archived?: boolean;
    pinned?: boolean;
    metadata?: Partial<ConversationMetadata>;
  } = {}
): Conversation {
  const now = Date.now();
  const messages = options.messages || [];

  return {
    id: options.id || generateConversationId(),
    title,
    messages,
    metadata: {
      createdAt: now,
      updatedAt: now,
      messageCount: messages.length,
      ...options.metadata,
    },
    archived: options.archived,
    pinned: options.pinned,
  };
}

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Extract the content type from a message
 */
export type ExtractMessageContent<T extends ChatMessage> = T['content'];

/**
 * Extract messages of a specific role from conversation
 */
export type MessagesOfRole<T extends MessageRole> = T extends 'user'
  ? UserMessage
  : T extends 'assistant'
    ? AssistantMessage
    : T extends 'system'
      ? SystemMessage
      : never;

/**
 * Conversation update payload for partial updates
 */
export interface ConversationUpdate {
  title?: string;
  archived?: boolean;
  pinned?: boolean;
  metadata?: Partial<ConversationMetadata>;
}

/**
 * Message update payload for editing messages
 */
export interface MessageUpdate {
  content?: MessageContent;
  status?: MessageStatus;
  error?: ChatMessage['error'];
  metadata?: ChatMessage['metadata'];
}
