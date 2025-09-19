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
export type MessageStatus = 'pending' | 'sending' | 'sent' | 'error' | 'streaming';

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
export function isValidMessageRole(value: unknown): value is MessageRole {
  return typeof value === 'string' && ['user', 'assistant', 'system'].includes(value);
}

/**
 * Type guard to check if a value is a valid MessageStatus
 */
export function isValidMessageStatus(value: unknown): value is MessageStatus {
  return (
    typeof value === 'string' &&
    ['pending', 'sending', 'sent', 'error', 'streaming'].includes(value)
  );
}

/**
 * Type guard to check if a value is a CodeBlock
 */
export function isCodeBlock(value: unknown): value is CodeBlock {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { language?: unknown }).language === 'string' &&
    typeof (value as { code?: unknown }).code === 'string' &&
    ((value as { filename?: unknown }).filename === undefined ||
      typeof (value as { filename?: unknown }).filename === 'string')
  );
}

/**
 * Type guard to check if a value is ComplexMessageContent
 */
export function isComplexMessageContent(value: unknown): value is ComplexMessageContent {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { text?: unknown }).text === 'string' &&
    ((value as { codeBlocks?: unknown }).codeBlocks === undefined ||
      (Array.isArray((value as { codeBlocks?: unknown }).codeBlocks) &&
        ((value as { codeBlocks?: unknown }).codeBlocks as unknown[]).every(isCodeBlock)))
  );
}

/**
 * Type guard to check if a value is StreamingContent
 */
export function isStreamingContent(value: unknown): value is StreamingContent {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { text?: unknown }).text === 'string' &&
    typeof (value as { isStreaming?: unknown }).isStreaming === 'boolean' &&
    typeof (value as { streamingId?: unknown }).streamingId === 'string'
  );
}

/**
 * Type guard to check if a value is valid MessageContent
 */
export function isMessageContent(value: unknown): value is MessageContent {
  return typeof value === 'string' || isComplexMessageContent(value) || isStreamingContent(value);
}

/**
 * Type guard to check if a value is a valid ChatMessage
 */
export function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  try {
    return (
      typeof (value as { id?: unknown }).id === 'string' &&
      isValidMessageRole((value as { role?: unknown }).role) &&
      isMessageContent((value as { content?: unknown }).content) &&
      typeof (value as { timestamp?: unknown }).timestamp === 'number' &&
      (value as { timestamp: number }).timestamp > 0 &&
      isValidMessageStatus((value as { status?: unknown }).status) &&
      ((value as { error?: unknown }).error === undefined ||
        (typeof (value as { error?: unknown }).error === 'object' &&
          (value as { error?: unknown }).error !== null &&
          typeof (value as { error?: { message?: unknown } }).error!.message === 'string')) &&
      ((value as { editable?: unknown }).editable === undefined ||
        typeof (value as { editable?: unknown }).editable === 'boolean') &&
      ((value as { deletable?: unknown }).deletable === undefined ||
        typeof (value as { deletable?: unknown }).deletable === 'boolean') &&
      ((value as { metadata?: unknown }).metadata === undefined ||
        typeof (value as { metadata?: unknown }).metadata === 'object')
    );
  } catch {
    // Handle circular references or other errors
    return false;
  }
}

/**
 * Type guard to check if a ChatMessage is a UserMessage
 */
export function isUserMessage(value: unknown): value is UserMessage {
  return isChatMessage(value) && value.role === 'user';
}

/**
 * Type guard to check if a ChatMessage is an AssistantMessage
 */
export function isAssistantMessage(value: unknown): value is AssistantMessage {
  return isChatMessage(value) && value.role === 'assistant';
}

/**
 * Type guard to check if a ChatMessage is a SystemMessage
 */
export function isSystemMessage(value: unknown): value is SystemMessage {
  return isChatMessage(value) && value.role === 'system';
}

/**
 * Type guard to check if a value is a valid ConversationMetadata
 */
export function isConversationMetadata(value: unknown): value is ConversationMetadata {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { createdAt?: unknown }).createdAt === 'number' &&
    typeof (value as { updatedAt?: unknown }).updatedAt === 'number' &&
    typeof (value as { messageCount?: unknown }).messageCount === 'number' &&
    (value as { messageCount: number }).messageCount >= 0 &&
    ((value as { tags?: unknown }).tags === undefined ||
      (Array.isArray((value as { tags?: unknown }).tags) &&
        ((value as { tags?: unknown }).tags as unknown[]).every(tag => typeof tag === 'string'))) &&
    ((value as { model?: unknown }).model === undefined ||
      typeof (value as { model?: unknown }).model === 'string') &&
    ((value as { totalTokens?: unknown }).totalTokens === undefined ||
      typeof (value as { totalTokens?: unknown }).totalTokens === 'number')
  );
}

/**
 * Type guard to check if a value is a valid Conversation
 */
export function isConversation(value: unknown): value is Conversation {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { id?: unknown }).id === 'string' &&
    typeof (value as { title?: unknown }).title === 'string' &&
    Array.isArray((value as { messages?: unknown }).messages) &&
    ((value as { messages?: unknown }).messages as unknown[]).every(isChatMessage) &&
    isConversationMetadata((value as { metadata?: unknown }).metadata) &&
    ((value as { archived?: unknown }).archived === undefined ||
      typeof (value as { archived?: unknown }).archived === 'boolean') &&
    ((value as { pinned?: unknown }).pinned === undefined ||
      typeof (value as { pinned?: unknown }).pinned === 'boolean')
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
