/**
 * @file Shared Types for AI Hooks
 *
 * Common type definitions used across AI-related hooks.
 */

import type { AIProvider, ProviderType } from '../../../types/providers';
import type { ChatMessage } from '@store/chat';

/**
 * Options for sending messages
 */
export interface SendMessageOptions {
  /** Whether to use streaming response (default: true) */
  streaming?: boolean;
  /** Custom timeout in milliseconds */
  timeout?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Skip adding user message (for regeneration) */
  skipUserMessage?: boolean;
  /** UI-specific display content (overrides content for display) */
  displayContent?: string;
}

/**
 * Options for initializing the hook
 */
export interface UseAIChatOptions {
  /** Enable/disable the hook functionality */
  enabled?: boolean;
  /** Auto-initialize providers from settings */
  autoInitialize?: boolean;
}

/**
 * Return type for useAIChat hook
 */
export interface UseAIChatReturn {
  /** Send a message to the active AI provider */
  sendMessage: (content: string, options?: SendMessageOptions) => Promise<void>;
  /** Cancel the current message/streaming operation */
  cancelMessage: () => void;
  /** Switch to a different provider */
  switchProvider: (providerType: ProviderType) => Promise<void>;
  /** Check if currently streaming a response */
  isStreaming: () => boolean;
  /** Get current provider statistics */
  getStats: () => AIStats;
}

/**
 * Provider statistics
 */
export interface AIStats {
  activeProvider: ProviderType | null;
  registeredProviders: ProviderType[];
}

/**
 * Provider manager return type
 */
export interface UseProviderManagerReturn {
  /** Get the active provider */
  getActiveProvider: () => AIProvider | null;
  /** Switch to a different provider */
  switchProvider: (providerType: ProviderType) => Promise<void>;
  /** Initialize providers from settings */
  initializeProviders: () => Promise<void>;
  /** Get provider statistics */
  getStats: () => AIStats;
}

/**
 * Message handler return type
 */
export interface UseMessageHandlerReturn {
  /** Send a message */
  sendMessage: (content: string, options?: SendMessageOptions) => Promise<void>;
  /** Cancel current message */
  cancelMessage: () => void;
  /** Check if streaming */
  isStreaming: () => boolean;
}

/**
 * Stream handler return type
 */
export interface UseStreamHandlerReturn {
  /** Handle streaming response */
  handleStreamingResponse: (
    provider: AIProvider,
    assistantMessage: ChatMessage,
    userMessage?: ChatMessage
  ) => Promise<void>;
  /** Cancel streaming */
  cancelStreaming: () => void;
  /** Check if currently streaming */
  isStreaming: boolean;
}

/**
 * Settings sync return type
 */
export interface UseSettingsSyncReturn {
  /** Last initialized keys */
  lastInitializedKeys: { openai?: string; google?: string };
  /** Last initialized model */
  lastInitializedModel: string | null;
  /** Check if settings changed */
  hasSettingsChanged: () => boolean;
}
