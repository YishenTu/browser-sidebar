/**
 * @file AI Hooks Module
 *
 * Export the main AI chat hook and related types.
 */

export { useAIChat as default, useAIChat } from './useAIChat';
export type { UseAIChatOptions, UseAIChatReturn, SendMessageOptions, AIStats } from './types';

// Export individual hooks for testing purposes
export { useProviderManager } from './useProviderManager';
export { useMessageHandler } from './useMessageHandler';
export { useStreamHandler } from './useStreamHandler';
