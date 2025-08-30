import { create } from 'zustand';
import { TabContent } from '../../types/tabs';
import { normalizeUrl } from '../../shared/utils/urlNormalizer';

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
 * Session data structure for each tab+URL combination
 */
export interface SessionData {
  // Core message state
  messages: ChatMessage[];
  conversationId: string;
  lastResponseId: string | null;

  // Session-specific UI state
  isLoading: boolean;
  error: string | null;
  activeMessageId: string | null;

  // Multi-tab state
  loadedTabs: Record<number, TabContent>;
  tabSelectionOrder: number[];
  currentTabId: number | null;
  hasAutoLoaded: boolean;

  // Metadata
  tabId: number;
  url: string;
  createdAt: number;
  lastAccessedAt: number;
}

/**
 * Chat store state interface
 */
export interface ChatState {
  // Session management
  sessions: Record<string, SessionData>;
  activeSessionKey: string | null;
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
  /** Update the content of an already loaded tab (for editing) */
  updateTabContent: (tabId: number, editedContent: string) => void;
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

  // Session management actions
  /** Create a session key from tab ID and URL */
  createSessionKey: (tabId: number, url: string) => string;
  /** Get or create a session */
  getOrCreateSession: (tabId: number, url: string) => SessionData;
  /** Switch to a different session */
  switchSession: (tabId: number, url: string) => void;
  /** Clear a specific session */
  clearSession: (sessionKey: string) => void;
  /** Clear all sessions for a tab */
  clearTabSessions: (tabId: number) => void;
  /** Clear only the current active session */
  clearCurrentSession: () => void;
  /** Get the active session */
  getActiveSession: () => SessionData | null;
  /** Check if a session exists */
  hasSession: (tabId: number, url: string) => boolean;
  /** Get message count for a session */
  getSessionMessageCount: (tabId: number, url: string) => number;
  /** Get all session keys */
  getAllSessionKeys: () => string[];
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
 * Helper to create a normalized session key
 */
function createSessionKeyInternal(tabId: number, url: string): string {
  const normalizedUrl = normalizeUrl(url);
  return `tab_${tabId}:${normalizedUrl}`;
}

/**
 * Create a new session with default values
 */
function createNewSession(tabId: number, url: string): SessionData {
  return {
    messages: [],
    conversationId: generateConversationId(),
    lastResponseId: null,
    isLoading: false,
    error: null,
    activeMessageId: null,
    loadedTabs: {},
    tabSelectionOrder: [],
    currentTabId: null,
    hasAutoLoaded: false,
    tabId,
    url: normalizeUrl(url),
    createdAt: Date.now(),
    lastAccessedAt: Date.now(),
  };
}

/**
 * Create and configure the chat store using Zustand
 */
export const useChatStore = create<ChatState>((set, get) => ({
  // Session management state
  sessions: {},
  activeSessionKey: null,

  // Computed properties that proxy to active session
  messages: [],
  conversationId: null,
  isLoading: false,
  error: null,
  activeMessageId: null,
  lastResponseId: null,
  loadedTabs: {},
  currentTabId: null,
  hasAutoLoaded: false,
  tabSelectionOrder: [],

  // Session management methods
  createSessionKey: (tabId: number, url: string) => {
    return createSessionKeyInternal(tabId, url);
  },

  getOrCreateSession: (tabId: number, url: string) => {
    const sessionKey = createSessionKeyInternal(tabId, url);
    const existingSession = get().sessions[sessionKey];

    if (existingSession) {
      // Update last accessed time
      set(state => ({
        ...state, // Preserve entire state
        sessions: {
          ...state.sessions,
          [sessionKey]: {
            ...existingSession,
            lastAccessedAt: Date.now(),
          },
        },
      }));
      return existingSession;
    }

    // Create new session
    const newSession = createNewSession(tabId, url);
    set(state => ({
      ...state, // Preserve entire state
      sessions: {
        ...state.sessions,
        [sessionKey]: newSession,
      },
    }));
    return newSession;
  },

  switchSession: (tabId: number, url: string) => {
    const sessionKey = createSessionKeyInternal(tabId, url);
    const session = get().getOrCreateSession(tabId, url);

    // Set active session and update proxied properties
    set(state => ({
      ...state, // IMPORTANT: Preserve the entire state including sessions
      activeSessionKey: sessionKey,
      // Update all proxied properties from the session
      messages: session.messages,
      conversationId: session.conversationId,
      isLoading: session.isLoading,
      error: session.error,
      activeMessageId: session.activeMessageId,
      lastResponseId: session.lastResponseId,
      loadedTabs: session.loadedTabs,
      currentTabId: session.currentTabId,
      hasAutoLoaded: session.hasAutoLoaded,
      tabSelectionOrder: session.tabSelectionOrder,
    }));
  },

  clearSession: (sessionKey: string) => {
    set(state => {
      const remainingSessions = { ...state.sessions };
      delete remainingSessions[sessionKey];
      return {
        sessions: remainingSessions,
        // If we cleared the active session, reset proxied properties
        ...(state.activeSessionKey === sessionKey
          ? {
              activeSessionKey: null,
              messages: [],
              conversationId: null,
              isLoading: false,
              error: null,
              activeMessageId: null,
              lastResponseId: null,
              loadedTabs: {},
              currentTabId: null,
              hasAutoLoaded: false,
              tabSelectionOrder: [],
            }
          : {}),
      };
    });
  },

  clearTabSessions: (tabId: number) => {
    set(state => {
      const sessionKeysToRemove = Object.keys(state.sessions).filter(key =>
        key.startsWith(`tab_${tabId}:`)
      );

      const newSessions = { ...state.sessions };
      sessionKeysToRemove.forEach(key => {
        delete newSessions[key];
      });

      // Check if active session was cleared
      const activeCleared =
        state.activeSessionKey && sessionKeysToRemove.includes(state.activeSessionKey);

      return {
        ...state,
        sessions: newSessions,
        ...(activeCleared
          ? {
              activeSessionKey: null,
              messages: [],
              conversationId: null,
              isLoading: false,
              error: null,
              activeMessageId: null,
              lastResponseId: null,
              loadedTabs: {},
              currentTabId: null,
              hasAutoLoaded: false,
              tabSelectionOrder: [],
            }
          : {}),
      };
    });
  },

  clearCurrentSession: () => {
    const state = get();
    if (state.activeSessionKey) {
      // Create a fresh session for the same tab+URL
      const session = state.sessions[state.activeSessionKey];
      if (session) {
        const newSession = createNewSession(session.tabId, session.url);
        set(state => ({
          ...state,
          sessions: {
            ...state.sessions,
            [state.activeSessionKey!]: newSession,
          },
          // Update proxied properties
          messages: [],
          conversationId: newSession.conversationId,
          isLoading: false,
          error: null,
          activeMessageId: null,
          lastResponseId: null,
          loadedTabs: {},
          currentTabId: null,
          hasAutoLoaded: false,
          tabSelectionOrder: [],
        }));
      }
    }
  },

  getActiveSession: () => {
    const state = get();
    return state.activeSessionKey ? state.sessions[state.activeSessionKey] || null : null;
  },

  hasSession: (tabId: number, url: string) => {
    const sessionKey = createSessionKeyInternal(tabId, url);
    return sessionKey in get().sessions;
  },

  getSessionMessageCount: (tabId: number, url: string) => {
    const sessionKey = createSessionKeyInternal(tabId, url);
    const session = get().sessions[sessionKey];
    return session ? session.messages.length : 0;
  },

  getAllSessionKeys: () => {
    return Object.keys(get().sessions);
  },

  // Message management actions (now operate on active session)
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

    set(state => {
      if (!state.activeSessionKey) return state;

      const session = state.sessions[state.activeSessionKey];
      if (!session) return state;

      const updatedSession: SessionData = {
        ...session,
        messages: [...session.messages, newMessage],
      };

      return {
        ...state,
        sessions: {
          ...state.sessions,
          [state.activeSessionKey]: updatedSession,
        },
        messages: updatedSession.messages,
      };
    });

    return newMessage;
  },

  updateMessage: (id: string, updates: UpdateMessageOptions) => {
    set(state => {
      if (!state.activeSessionKey) return state;

      const session = state.sessions[state.activeSessionKey];
      if (!session) return state;

      const updatedMessages = session.messages.map(message =>
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
      );

      const updatedSession: SessionData = {
        ...session,
        messages: updatedMessages,
      };

      return {
        ...state,
        sessions: {
          ...state.sessions,
          [state.activeSessionKey]: updatedSession,
        },
        messages: updatedMessages,
      };
    });
  },

  appendToMessage: (id: string, content: string) => {
    set(state => {
      if (!state.activeSessionKey) return state;

      const session = state.sessions[state.activeSessionKey];
      if (!session) return state;

      const updatedMessages = session.messages.map(message =>
        message.id === id
          ? {
              ...message,
              content: message.content + content,
            }
          : message
      );

      const updatedSession: SessionData = {
        ...session,
        messages: updatedMessages,
      };

      return {
        ...state,
        sessions: {
          ...state.sessions,
          [state.activeSessionKey]: updatedSession,
        },
        messages: updatedMessages,
      };
    });
  },

  deleteMessage: (id: string) => {
    set(state => {
      if (!state.activeSessionKey) return state;

      const session = state.sessions[state.activeSessionKey];
      if (!session) return state;

      const updatedMessages = session.messages.filter(message => message.id !== id);

      const updatedSession: SessionData = {
        ...session,
        messages: updatedMessages,
      };

      return {
        ...state,
        sessions: {
          ...state.sessions,
          [state.activeSessionKey]: updatedSession,
        },
        messages: updatedMessages,
      };
    });
  },

  editMessage: (id: string) => {
    const state = get();
    if (!state.activeSessionKey) return undefined;

    const session = state.sessions[state.activeSessionKey];
    if (!session) return undefined;

    const messageIndex = session.messages.findIndex(msg => msg.id === id);

    if (messageIndex === -1) {
      return undefined;
    }

    // Get the message to edit
    const messageToEdit = session.messages[messageIndex];

    // Remove all messages after this one
    const updatedMessages = session.messages.slice(0, messageIndex + 1);
    const updatedSession: SessionData = {
      ...session,
      messages: updatedMessages,
      lastResponseId: null, // Reset response ID since we're editing
    };

    set(state => ({
      ...state,
      sessions: {
        ...state.sessions,
        [state.activeSessionKey!]: updatedSession,
      },
      messages: updatedMessages,
      lastResponseId: null,
    }));

    return messageToEdit;
  },

  getPreviousUserMessage: (assistantMessageId: string) => {
    const state = get();
    if (!state.activeSessionKey) return undefined;

    const session = state.sessions[state.activeSessionKey];
    if (!session) return undefined;

    const assistantIndex = session.messages.findIndex(msg => msg.id === assistantMessageId);

    if (assistantIndex === -1) {
      return undefined;
    }

    // Find the previous user message
    for (let i = assistantIndex - 1; i >= 0; i--) {
      if (session.messages[i]?.role === 'user') {
        return session.messages[i];
      }
    }

    return undefined;
  },

  removeMessageAndAfter: (id: string) => {
    const state = get();
    if (!state.activeSessionKey) return;

    const session = state.sessions[state.activeSessionKey];
    if (!session) return;

    const messageIndex = session.messages.findIndex(msg => msg.id === id);

    if (messageIndex === -1) {
      return;
    }

    // Remove this message and all messages after it
    const updatedMessages = session.messages.slice(0, messageIndex);
    const updatedSession: SessionData = {
      ...session,
      messages: updatedMessages,
      lastResponseId: null, // Reset response ID
    };

    set(state => ({
      ...state,
      sessions: {
        ...state.sessions,
        [state.activeSessionKey!]: updatedSession,
      },
      messages: updatedMessages,
      lastResponseId: null,
    }));
  },

  // Conversation management actions (now delegates to clearCurrentSession)
  clearConversation: () => {
    get().clearCurrentSession();
  },

  startNewConversation: (conversationId?: string) => {
    // This is similar to clearCurrentSession but with a specific conversation ID
    const state = get();
    if (state.activeSessionKey) {
      const session = state.sessions[state.activeSessionKey];
      if (session) {
        const newSession = {
          ...createNewSession(session.tabId, session.url),
          conversationId: conversationId || generateConversationId(),
        };
        set(state => ({
          ...state,
          sessions: {
            ...state.sessions,
            [state.activeSessionKey!]: newSession,
          },
          // Update proxied properties
          messages: [],
          conversationId: newSession.conversationId,
          isLoading: false,
          error: null,
          activeMessageId: null,
          lastResponseId: null,
          loadedTabs: {},
          currentTabId: null,
          hasAutoLoaded: false,
          tabSelectionOrder: [],
        }));
      }
    }
  },

  // State management actions
  setLoading: (loading: boolean) => {
    set(state => {
      if (!state.activeSessionKey) return { ...state, isLoading: loading };

      const session = state.sessions[state.activeSessionKey];
      if (!session) return { ...state, isLoading: loading };

      const updatedSession: SessionData = {
        ...session,
        isLoading: loading,
      };

      return {
        ...state,
        sessions: {
          ...state.sessions,
          [state.activeSessionKey]: updatedSession,
        },
        isLoading: loading,
      };
    });
  },

  setError: (error: string | null) => {
    set(state => {
      if (!state.activeSessionKey) return { ...state, error };

      const session = state.sessions[state.activeSessionKey];
      if (!session) return { ...state, isLoading: false };

      const updatedSession: SessionData = {
        ...session,
        error,
      };

      return {
        ...state,
        sessions: {
          ...state.sessions,
          [state.activeSessionKey]: updatedSession,
        },
        error,
      };
    });
  },

  clearError: () => {
    set(state => {
      if (!state.activeSessionKey) return { ...state, error: null };

      const session = state.sessions[state.activeSessionKey];
      if (!session) return { ...state, isLoading: false };

      const updatedSession: SessionData = {
        ...session,
        error: null,
      };

      return {
        ...state,
        sessions: {
          ...state.sessions,
          [state.activeSessionKey]: updatedSession,
        },
        error: null,
      };
    });
  },

  setActiveMessage: (messageId: string | null) => {
    set(state => {
      if (!state.activeSessionKey) return { ...state, activeMessageId: messageId };

      const session = state.sessions[state.activeSessionKey];
      if (!session) return { ...state, isLoading: false };

      const updatedSession: SessionData = {
        ...session,
        activeMessageId: messageId,
      };

      return {
        ...state,
        sessions: {
          ...state.sessions,
          [state.activeSessionKey]: updatedSession,
        },
        activeMessageId: messageId,
      };
    });
  },

  clearActiveMessage: () => {
    set(state => {
      if (!state.activeSessionKey) return { ...state, activeMessageId: null };

      const session = state.sessions[state.activeSessionKey];
      if (!session) return { ...state, isLoading: false };

      const updatedSession: SessionData = {
        ...session,
        activeMessageId: null,
      };

      return {
        ...state,
        sessions: {
          ...state.sessions,
          [state.activeSessionKey]: updatedSession,
        },
        activeMessageId: null,
      };
    });
  },

  setLastResponseId: (responseId: string | null) => {
    set(state => {
      if (!state.activeSessionKey) return { ...state, lastResponseId: responseId };

      const session = state.sessions[state.activeSessionKey];
      if (!session) return { ...state, isLoading: false };

      const updatedSession: SessionData = {
        ...session,
        lastResponseId: responseId,
      };

      return {
        ...state,
        sessions: {
          ...state.sessions,
          [state.activeSessionKey]: updatedSession,
        },
        lastResponseId: responseId,
      };
    });
  },

  getLastResponseId: () => {
    const state = get();
    if (!state.activeSessionKey) return null;
    const session = state.sessions[state.activeSessionKey];
    return session ? session.lastResponseId : null;
  },

  // Multi-tab state management actions (now work with active session)
  setLoadedTabs: (tabs: Record<number, TabContent>) => {
    set(state => {
      if (!state.activeSessionKey) return { ...state, loadedTabs: tabs };

      const session = state.sessions[state.activeSessionKey];
      if (!session) return { ...state, isLoading: false };

      const updatedSession: SessionData = {
        ...session,
        loadedTabs: tabs,
      };

      return {
        ...state,
        sessions: {
          ...state.sessions,
          [state.activeSessionKey]: updatedSession,
        },
        loadedTabs: tabs,
      };
    });
  },

  addLoadedTab: (tabId: number, tabContent: TabContent) => {
    set(state => {
      if (!state.activeSessionKey) {
        // If no active session, just update the proxy state
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
      }

      const session = state.sessions[state.activeSessionKey];
      if (!session) return state;

      const newOrder = session.tabSelectionOrder.filter(id => id !== tabId);
      newOrder.push(tabId);

      const updatedSession: SessionData = {
        ...session,
        loadedTabs: {
          ...session.loadedTabs,
          [tabId]: tabContent,
        },
        tabSelectionOrder: newOrder,
      };

      return {
        ...state,
        sessions: {
          ...state.sessions,
          [state.activeSessionKey]: updatedSession,
        },
        loadedTabs: updatedSession.loadedTabs,
        tabSelectionOrder: newOrder,
      };
    });
  },

  updateTabContent: (tabId: number, editedContent: string) => {
    set(state => {
      if (!state.activeSessionKey) {
        // If no active session, just update the proxy state
        const existingTab = state.loadedTabs[tabId];
        if (!existingTab) return state;

        return {
          ...state,
          loadedTabs: {
            ...state.loadedTabs,
            [tabId]: {
              ...existingTab,
              extractedContent: {
                ...existingTab.extractedContent,
                content: editedContent,
              },
            },
          },
        };
      }

      const session = state.sessions[state.activeSessionKey];
      if (!session) return state;

      const existingTab = session.loadedTabs[tabId];
      if (!existingTab) return state;

      const updatedLoadedTabs = {
        ...session.loadedTabs,
        [tabId]: {
          ...existingTab,
          extractedContent: {
            ...existingTab.extractedContent,
            content: editedContent,
          },
        },
      };

      const updatedSession: SessionData = {
        ...session,
        loadedTabs: updatedLoadedTabs,
      };

      return {
        ...state,
        sessions: {
          ...state.sessions,
          [state.activeSessionKey]: updatedSession,
        },
        loadedTabs: updatedLoadedTabs,
      };
    });
  },

  removeLoadedTab: (tabId: number) => {
    set(state => {
      if (!state.activeSessionKey) {
        // If no active session, just update the proxy state
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [tabId]: _removed, ...remainingTabs } = state.loadedTabs;
        const newOrder = state.tabSelectionOrder.filter(id => id !== tabId);

        return {
          ...state,
          loadedTabs: remainingTabs,
          currentTabId: state.currentTabId === tabId ? null : state.currentTabId,
          tabSelectionOrder: newOrder,
        };
      }

      const session = state.sessions[state.activeSessionKey];
      if (!session) return state;

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [tabId]: _removed, ...remainingTabs } = session.loadedTabs;
      const newOrder = session.tabSelectionOrder.filter(id => id !== tabId);

      const updatedSession: SessionData = {
        ...session,
        loadedTabs: remainingTabs,
        currentTabId: session.currentTabId === tabId ? null : session.currentTabId,
        tabSelectionOrder: newOrder,
      };

      return {
        ...state,
        sessions: {
          ...state.sessions,
          [state.activeSessionKey]: updatedSession,
        },
        loadedTabs: remainingTabs,
        currentTabId: updatedSession.currentTabId,
        tabSelectionOrder: newOrder,
      };
    });
  },

  setCurrentTabId: (tabId: number | null) => {
    set(state => {
      if (!state.activeSessionKey) return { ...state, currentTabId: tabId };

      const session = state.sessions[state.activeSessionKey];
      if (!session) return { ...state, isLoading: false };

      const updatedSession: SessionData = {
        ...session,
        currentTabId: tabId,
      };

      return {
        ...state,
        sessions: {
          ...state.sessions,
          [state.activeSessionKey]: updatedSession,
        },
        currentTabId: tabId,
      };
    });
  },

  setHasAutoLoaded: (value: boolean) => {
    set(state => {
      if (!state.activeSessionKey) return { ...state, hasAutoLoaded: value };

      const session = state.sessions[state.activeSessionKey];
      if (!session) return { ...state, isLoading: false };

      const updatedSession: SessionData = {
        ...session,
        hasAutoLoaded: value,
      };

      return {
        ...state,
        sessions: {
          ...state.sessions,
          [state.activeSessionKey]: updatedSession,
        },
        hasAutoLoaded: value,
      };
    });
  },

  getHasAutoLoaded: () => {
    const state = get();
    if (!state.activeSessionKey) return false;
    const session = state.sessions[state.activeSessionKey];
    return session ? session.hasAutoLoaded : false;
  },

  // Selectors (now work with active session)
  getUserMessages: () => {
    const state = get();
    if (!state.activeSessionKey) return [];
    const session = state.sessions[state.activeSessionKey];
    return session ? session.messages.filter(message => message.role === 'user') : [];
  },

  getAssistantMessages: () => {
    const state = get();
    if (!state.activeSessionKey) return [];
    const session = state.sessions[state.activeSessionKey];
    return session ? session.messages.filter(message => message.role === 'assistant') : [];
  },

  getLastMessage: () => {
    const state = get();
    if (!state.activeSessionKey) return undefined;
    const session = state.sessions[state.activeSessionKey];
    if (!session) return undefined;
    const messages = session.messages;
    return messages.length > 0 ? messages[messages.length - 1] : undefined;
  },

  getMessageById: (id: string) => {
    const state = get();
    if (!state.activeSessionKey) return undefined;
    const session = state.sessions[state.activeSessionKey];
    return session ? session.messages.find(message => message.id === id) : undefined;
  },

  hasMessages: () => {
    const state = get();
    if (!state.activeSessionKey) return false;
    const session = state.sessions[state.activeSessionKey];
    return session ? session.messages.length > 0 : false;
  },

  getMessageCount: () => {
    const state = get();
    if (!state.activeSessionKey) return 0;
    const session = state.sessions[state.activeSessionKey];
    return session ? session.messages.length : 0;
  },

  // Multi-tab selectors (now work with active session)
  getLoadedTabs: () => {
    const state = get();
    if (!state.activeSessionKey) return {};
    const session = state.sessions[state.activeSessionKey];
    return session ? session.loadedTabs : {};
  },

  getTabContent: (tabId: number) => {
    const state = get();
    if (!state.activeSessionKey) return undefined;
    const session = state.sessions[state.activeSessionKey];
    return session ? session.loadedTabs[tabId] : undefined;
  },

  getCurrentTabContent: () => {
    const state = get();
    if (!state.activeSessionKey) return undefined;
    const session = state.sessions[state.activeSessionKey];
    if (!session) return undefined;
    return session.currentTabId ? session.loadedTabs[session.currentTabId] : undefined;
  },

  getCurrentTabId: () => {
    const state = get();
    if (!state.activeSessionKey) return null;
    const session = state.sessions[state.activeSessionKey];
    return session ? session.currentTabId : null;
  },

  isTabLoaded: (tabId: number) => {
    const state = get();
    if (!state.activeSessionKey) return false;
    const session = state.sessions[state.activeSessionKey];
    return session ? tabId in session.loadedTabs : false;
  },

  getLoadedTabIds: () => {
    const state = get();
    if (!state.activeSessionKey) return [];
    const session = state.sessions[state.activeSessionKey];
    return session ? Object.keys(session.loadedTabs).map(id => parseInt(id, 10)) : [];
  },

  getLoadedTabCount: () => {
    const state = get();
    if (!state.activeSessionKey) return 0;
    const session = state.sessions[state.activeSessionKey];
    return session ? Object.keys(session.loadedTabs).length : 0;
  },
}));

/**
 * Export the store hook as default for convenience
 */
export default useChatStore;
