import { create } from 'zustand';
import { TabContent } from '../../types/tabs';

/**
 * @file Chat Store Implementation
 *
 * Manages chat conversation state including messages, loading states,
 * streaming support, and multi-tab content state using Zustand for state management.
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
  /** UI-specific display content (overrides content if provided) */
  displayContent?: string;
  /** Message creation timestamp */
  timestamp: Date;
  /** Current message status */
  status: MessageStatus;
  /** Error message if status is 'error' */
  error?: string;
  /** Message metadata including tab context */
  metadata?: {
    /** Indicates if tab content was injected into this message */
    hasTabContext?: boolean;
    /** Original user input before tab content injection */
    originalUserContent?: string;
    /** Tab ID for multi-tab support */
    tabId?: number | string;
    /** Tab title for context */
    tabTitle?: string;
    /** Tab URL for context */
    tabUrl?: string;
    /** Additional extensible metadata */
    [key: string]: unknown;
  };
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
  metadata?: {
    /** Indicates if tab content was injected into this message */
    hasTabContext?: boolean;
    /** Original user input before tab content injection */
    originalUserContent?: string;
    /** Tab ID for multi-tab support */
    tabId?: number | string;
    /** Tab title for context */
    tabTitle?: string;
    /** Tab URL for context */
    tabUrl?: string;
    /** Additional extensible metadata */
    [key: string]: unknown;
  };
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
  metadata?: {
    /** Indicates if tab content was injected into this message */
    hasTabContext?: boolean;
    /** Original user input before tab content injection */
    originalUserContent?: string;
    /** Tab ID for multi-tab support */
    tabId?: number | string;
    /** Tab title for context */
    tabTitle?: string;
    /** Tab URL for context */
    tabUrl?: string;
    /** Additional extensible metadata */
    [key: string]: unknown;
  };
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
  /** Last OpenAI response ID for conversation continuity */
  lastResponseId: string | null;

  // Multi-tab state
  /** Loaded tab content indexed by tab ID (serializable Record) */
  loadedTabs: Record<number, TabContent>;
  /** Currently active/selected tab ID for context */
  currentTabId: number | null;
  /** Whether the current tab has been auto-loaded in this session */
  hasAutoLoaded: boolean;
  /** Order in which tabs were selected/loaded (for deterministic truncation) */
  tabSelectionOrder: number[];

  // Actions for message management
  /** Add a new message to the conversation */
  addMessage: (options: CreateMessageOptions) => ChatMessage;
  /** Update an existing message */
  updateMessage: (id: string, updates: UpdateMessageOptions) => void;
  /** Append content to an existing message (for streaming) */
  appendToMessage: (id: string, content: string) => void;
  /** Delete a specific message */
  deleteMessage: (id: string) => void;
  /** Edit a message and remove all messages after it */
  editMessage: (id: string) => ChatMessage | undefined;
  /** Get the previous user message before an assistant message for regeneration */
  getPreviousUserMessage: (assistantMessageId: string) => ChatMessage | undefined;
  /** Remove an assistant message and all messages after it */
  removeMessageAndAfter: (id: string) => void;

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
  /** Set last response ID for conversation continuity */
  setLastResponseId: (responseId: string | null) => void;
  /** Get last response ID */
  getLastResponseId: () => string | null;

  // Actions for multi-tab state management
  /** Set all loaded tabs (replaces existing loadedTabs) */
  setLoadedTabs: (tabs: Record<number, TabContent>) => void;
  /** Add or update a single tab's content */
  addLoadedTab: (tabId: number, tabContent: TabContent) => void;
  /** Remove a tab from loaded tabs */
  removeLoadedTab: (tabId: number) => void;
  /** Set the currently active tab ID */
  setCurrentTabId: (tabId: number | null) => void;
  /** Mark that auto-load has been performed */
  setHasAutoLoaded: (value: boolean) => void;
  /** Get whether auto-load has been performed */
  getHasAutoLoaded: () => boolean;

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

  // Selectors for multi-tab data
  /** Get all loaded tabs */
  getLoadedTabs: () => Record<number, TabContent>;
  /** Get tab content by tab ID */
  getTabContent: (tabId: number) => TabContent | undefined;
  /** Get currently active tab content */
  getCurrentTabContent: () => TabContent | undefined;
  /** Get current tab ID */
  getCurrentTabId: () => number | null;
  /** Check if a specific tab is loaded */
  isTabLoaded: (tabId: number) => boolean;
  /** Get loaded tab IDs */
  getLoadedTabIds: () => number[];
  /** Get loaded tab count */
  getLoadedTabCount: () => number;
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
  lastResponseId: null,
  // Multi-tab initial state
  loadedTabs: {},
  currentTabId: null,
  hasAutoLoaded: false,
  tabSelectionOrder: [],

  // Message management actions
  addMessage: (options: CreateMessageOptions) => {
    const newMessage: ChatMessage = {
      id: options.id || generateMessageId(),
      role: options.role,
      content: options.content,
      displayContent: options.displayContent,
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
              // Merge metadata shallowly to prevent accidental loss
              metadata: updates.metadata
                ? { ...message.metadata, ...updates.metadata }
                : message.metadata,
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

  editMessage: (id: string) => {
    const state = get();
    const messageIndex = state.messages.findIndex(msg => msg.id === id);

    if (messageIndex === -1) {
      return undefined;
    }

    // Get the message to edit
    const messageToEdit = state.messages[messageIndex];

    // Remove all messages after this one
    set(state => ({
      ...state,
      messages: state.messages.slice(0, messageIndex + 1),
      lastResponseId: null, // Reset response ID since we're editing
    }));

    return messageToEdit;
  },

  getPreviousUserMessage: (assistantMessageId: string) => {
    const state = get();
    const assistantIndex = state.messages.findIndex(msg => msg.id === assistantMessageId);

    if (assistantIndex === -1) {
      return undefined;
    }

    // Find the previous user message
    for (let i = assistantIndex - 1; i >= 0; i--) {
      if (state.messages[i]?.role === 'user') {
        return state.messages[i];
      }
    }

    return undefined;
  },

  removeMessageAndAfter: (id: string) => {
    const state = get();
    const messageIndex = state.messages.findIndex(msg => msg.id === id);

    if (messageIndex === -1) {
      return;
    }

    // Remove this message and all messages after it
    set(state => ({
      ...state,
      messages: state.messages.slice(0, messageIndex),
      lastResponseId: null, // Reset response ID
    }));
  },

  // Conversation management actions
  clearConversation: () => {
    set({
      messages: [],
      error: null,
      isLoading: false,
      activeMessageId: null,
      lastResponseId: null,
      // Reset multi-tab state
      loadedTabs: {},
      currentTabId: null,
      hasAutoLoaded: false,
      tabSelectionOrder: [],
    });
  },

  startNewConversation: (conversationId?: string) => {
    set({
      conversationId: conversationId || generateConversationId(),
      messages: [],
      error: null,
      isLoading: false,
      activeMessageId: null,
      lastResponseId: null,
      // Reset multi-tab state
      loadedTabs: {},
      currentTabId: null,
      hasAutoLoaded: false,
      tabSelectionOrder: [],
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

  setLastResponseId: (responseId: string | null) => {
    set(state => ({ ...state, lastResponseId: responseId }));
  },

  getLastResponseId: () => {
    return get().lastResponseId;
  },

  // Multi-tab state management actions
  setLoadedTabs: (tabs: Record<number, TabContent>) => {
    set(state => ({ ...state, loadedTabs: tabs }));
  },

  addLoadedTab: (tabId: number, tabContent: TabContent) => {
    set(state => {
      // Update selection order - remove if exists and add to end
      const newOrder = state.tabSelectionOrder.filter(id => id !== tabId);
      newOrder.push(tabId);
      
      return {
        ...state,
        loadedTabs: {
          ...state.loadedTabs,
          [tabId]: tabContent,
        },
        tabSelectionOrder: newOrder,
      };
    });
  },

  removeLoadedTab: (tabId: number) => {
    set(state => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [tabId]: _removed, ...remainingTabs } = state.loadedTabs;
      const newOrder = state.tabSelectionOrder.filter(id => id !== tabId);
      
      return {
        ...state,
        loadedTabs: remainingTabs,
        // Clear currentTabId if it was the removed tab
        currentTabId: state.currentTabId === tabId ? null : state.currentTabId,
        tabSelectionOrder: newOrder,
      };
    });
  },

  setCurrentTabId: (tabId: number | null) => {
    set(state => ({ ...state, currentTabId: tabId }));
  },

  setHasAutoLoaded: (value: boolean) => {
    set(state => ({ ...state, hasAutoLoaded: value }));
  },

  getHasAutoLoaded: () => {
    return get().hasAutoLoaded;
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

  // Multi-tab selectors
  getLoadedTabs: () => {
    return get().loadedTabs;
  },

  getTabContent: (tabId: number) => {
    return get().loadedTabs[tabId];
  },

  getCurrentTabContent: () => {
    const state = get();
    return state.currentTabId ? state.loadedTabs[state.currentTabId] : undefined;
  },

  getCurrentTabId: () => {
    return get().currentTabId;
  },

  isTabLoaded: (tabId: number) => {
    return tabId in get().loadedTabs;
  },

  getLoadedTabIds: () => {
    return Object.keys(get().loadedTabs).map(id => parseInt(id, 10));
  },

  getLoadedTabCount: () => {
    return Object.keys(get().loadedTabs).length;
  },
}));

/**
 * Export the store hook as default for convenience
 */
export default useChatStore;
