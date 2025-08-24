/**
 * @file AI Chat Hook (Re-export)
 *
 * This file re-exports the modularized AI chat hook for backward compatibility.
 * The actual implementation has been moved to the ai/ subdirectory for better organization.
 */

export { useAIChat as default, useAIChat } from './ai';
export type { UseAIChatOptions, UseAIChatReturn, SendMessageOptions } from './ai';
