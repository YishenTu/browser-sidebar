/**
 * @file Message Type Definitions
 *
 * Core type definitions for chat messages and related operations
 */

/**
 * Message role types
 */
export type MessageRole = 'user' | 'assistant' | 'system';

/**
 * Message status types for tracking message lifecycle
 */
export type MessageStatus =
  | 'pending' // User message queued, waiting for uploads
  | 'sending' // User message being sent
  | 'sent' // User message successfully sent
  | 'streaming' // AI message being streamed
  | 'received' // AI message fully received
  | 'error'; // Message failed to send/receive

/**
 * Individual chat message structure
 */
export interface ChatMessage {
  /** Unique message identifier */
  id: string;
  /** Message role (user, assistant, system) */
  role: MessageRole;
  /** Message content/text */
  content: string;
  /** UI-specific display content (overrides content if provided) */
  displayContent?: string;
  /** Message creation timestamp */
  timestamp: Date;
  /** Current message status */
  status: MessageStatus;
  /** Error message if status is 'error' */
  error?: string;
  /** Message metadata including tab context */
  metadata?: MessageMetadata;
}

/**
 * Message metadata structure
 */
export interface MessageMetadata {
  /** Indicates if tab content was injected into this message */
  hasTabContext?: boolean;
  /** Original user input before tab content injection */
  originalUserContent?: string;
  /** Tab ID for tab support */
  tabId?: number | string;
  /** Tab title for context */
  tabTitle?: string;
  /** Tab URL for context */
  tabUrl?: string;
  /** Additional extensible metadata */
  [key: string]: unknown;
}

/**
 * Options for creating a new message
 */
export interface CreateMessageOptions {
  /** Message role */
  role: MessageRole;
  /** Message content */
  content: string;
  /** Optional UI-specific display content */
  displayContent?: string;
  /** Optional custom ID (auto-generated if not provided) */
  id?: string;
  /** Optional custom timestamp (current time if not provided) */
  timestamp?: Date;
  /** Optional custom status (auto-determined by role if not provided) */
  status?: MessageStatus;
  /** Optional error message */
  error?: string;
  /** Optional metadata */
  metadata?: MessageMetadata;
}

/**
 * Options for updating an existing message
 */
export interface UpdateMessageOptions {
  /** New content (optional) */
  content?: string;
  /** New UI-specific display content (optional) */
  displayContent?: string;
  /** New status (optional) */
  status?: MessageStatus;
  /** New error message (optional) */
  error?: string;
  /** New metadata (optional) */
  metadata?: MessageMetadata;
}
