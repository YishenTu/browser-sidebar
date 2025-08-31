/**
 * @file Chat Store
 *
 * Central export point for all chat-related stores and types.
 * The chat functionality has been refactored into specialized stores:
 *
 * - sessionStore: Manages browser tab sessions
 * - messageStore: Handles message CRUD operations
 * - tabStore: Manages tab content state
 * - uiStore: Controls UI state (loading, errors, etc.)
 */

// Export all types
export * from './types';

// Export all stores
export { useSessionStore } from './stores/sessionStore';
export { useMessageStore } from './stores/messageStore';
export { useTabStore } from './stores/tabStore';
export { useUIStore } from './stores/uiStore';

// Export helper utilities
export * from './utils/chatHelpers';
