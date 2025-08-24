import { create } from 'zustand';

/**
 * @file Chat Store Implementation
 *
 * Manages chat conversation state including messages, loading states,
 * and streaming support using Zustand for state management.
 */

/**
 * Message role types
 */
export type MessageRole = 'user' | 'assistant' | 'system';

/**
 * Message status types for tracking message lifecycle
 */
export type MessageStatus =
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
  /** Message creation timestamp */
  timestamp: Date;
  /** Current message status */
  status: MessageStatus;
  /** Error message if status is 'error' */
  error?: string;
  /** Additional metadata for the message */
  metadata?: Record<string, unknown>;
}

/**
 * Options for creating a new message
 */
export interface CreateMessageOptions {
  /** Message role */
  role: MessageRole;
  /** Message content */
  content: string;
  /** Optional custom ID (auto-generated if not provided) */
  id?: string;
  /** Optional custom timestamp (current time if not provided) */
  timestamp?: Date;
  /** Optional custom status (auto-determined by role if not provided) */
  status?: MessageStatus;
  /** Optional error message */
  error?: string;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Options for updating an existing message
 */
export interface UpdateMessageOptions {
  /** New content (optional) */
  content?: string;
  /** New status (optional) */
  status?: MessageStatus;
  /** New error message (optional) */
  error?: string;
  /** New metadata (optional) */
  metadata?: Record<string, unknown>;
}

/**
 * Chat store state interface
 */
export interface ChatState {
  // Core state
  /** Array of chat messages in chronological order */
  messages: ChatMessage[];
  /** Current conversation ID */
  conversationId: string | null;
  /** Loading state for async operations */
  isLoading: boolean;
  /** Current error message */
  error: string | null;
  /** ID of currently active message (for streaming) */
  activeMessageId: string | null;

  // Actions for message management
  /** Add a new message to the conversation */
  addMessage: (options: CreateMessageOptions) => ChatMessage;
  /** Update an existing message */
  updateMessage: (id: string, updates: UpdateMessageOptions) => void;
  /** Append content to an existing message (for streaming) */
  appendToMessage: (id: string, content: string) => void;
  /** Delete a specific message */
  deleteMessage: (id: string) => void;

  // Actions for conversation management
  /** Clear all messages and reset conversation state */
  clearConversation: () => void;
  /** Start a new conversation with optional ID */
  startNewConversation: (conversationId?: string) => void;

  // Actions for state management
  /** Set loading state */
  setLoading: (loading: boolean) => void;
  /** Set error state */
  setError: (error: string | null) => void;
  /** Clear error state */
  clearError: () => void;
  /** Set active message for streaming */
  setActiveMessage: (messageId: string | null) => void;
  /** Clear active message */
  clearActiveMessage: () => void;

  // Selectors for accessing data
  /** Get all user messages */
  getUserMessages: () => ChatMessage[];
  /** Get all assistant messages */
  getAssistantMessages: () => ChatMessage[];
  /** Get the last message in the conversation */
  getLastMessage: () => ChatMessage | undefined;
  /** Get a message by its ID */
  getMessageById: (id: string) => ChatMessage | undefined;
  /** Check if conversation has any messages */
  hasMessages: () => boolean;
  /** Get total message count */
  getMessageCount: () => number;
}

/**
 * Generate a unique message ID
 */
function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate a unique conversation ID
 */
function generateConversationId(): string {
  return `conv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Determine default status based on message role
 */
function getDefaultStatus(role: MessageRole): MessageStatus {
  switch (role) {
    case 'user':
      return 'sent';
    case 'assistant':
      return 'received';
    case 'system':
      return 'received';
    default:
      return 'received';
  }
}

/**
 * Create and configure the chat store using Zustand
 */
export const useChatStore = create<ChatState>((set, get) => ({
  // Initial state
  messages: [],
  conversationId: null,
  isLoading: false,
  error: null,
  activeMessageId: null,

  // Message management actions
  addMessage: (options: CreateMessageOptions) => {
    const newMessage: ChatMessage = {
      id: options.id || generateMessageId(),
      role: options.role,
      content: options.content,
      timestamp: options.timestamp || new Date(),
      status: options.status || getDefaultStatus(options.role),
      error: options.error,
      metadata: options.metadata,
    };

    set(state => ({
      ...state,
      messages: [...state.messages, newMessage],
    }));

    return newMessage;
  },

  updateMessage: (id: string, updates: UpdateMessageOptions) => {
    set(state => ({
      ...state,
      messages: state.messages.map(message =>
        message.id === id
          ? {
              ...message,
              ...updates,
              // Preserve original timestamp and ID
              timestamp: message.timestamp,
              id: message.id,
            }
          : message
      ),
    }));
  },

  appendToMessage: (id: string, content: string) => {
    set(state => ({
      ...state,
      messages: state.messages.map(message =>
        message.id === id
          ? {
              ...message,
              content: message.content + content,
            }
          : message
      ),
    }));
  },

  deleteMessage: (id: string) => {
    set(state => ({
      ...state,
      messages: state.messages.filter(message => message.id !== id),
    }));
  },

  // Conversation management actions
  clearConversation: () => {
    set({
      messages: [],
      error: null,
      isLoading: false,
      activeMessageId: null,
    });
  },

  startNewConversation: (conversationId?: string) => {
    set({
      conversationId: conversationId || generateConversationId(),
      messages: [],
      error: null,
      isLoading: false,
      activeMessageId: null,
    });
  },

  // State management actions
  setLoading: (loading: boolean) => {
    set(state => ({ ...state, isLoading: loading }));
  },

  setError: (error: string | null) => {
    set(state => ({ ...state, error }));
  },

  clearError: () => {
    set(state => ({ ...state, error: null }));
  },

  setActiveMessage: (messageId: string | null) => {
    set(state => ({ ...state, activeMessageId: messageId }));
  },

  clearActiveMessage: () => {
    // Use a simpler update that doesn't rely on state spreading
    set({ activeMessageId: null });
  },

  // Selectors
  getUserMessages: () => {
    return get().messages.filter(message => message.role === 'user');
  },

  getAssistantMessages: () => {
    return get().messages.filter(message => message.role === 'assistant');
  },

  getLastMessage: () => {
    const messages = get().messages;
    return messages.length > 0 ? messages[messages.length - 1] : undefined;
  },

  getMessageById: (id: string) => {
    return get().messages.find(message => message.id === id);
  },

  hasMessages: () => {
    return get().messages.length > 0;
  },

  getMessageCount: () => {
    return get().messages.length;
  },
}));

/**
 * Export the store hook as default for convenience
 */
export default useChatStore;
