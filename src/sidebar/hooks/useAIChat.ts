/**
 * @file AI Chat Hook
 *
 * React hook that integrates real AI providers with the chat store.
 * Handles message sending, response streaming, error handling, provider
 * switching, rate limiting, and cancellation support.
 *
 * Features:
 * - Real AI provider integration via ProviderRegistry and ProviderFactory
 * - Streaming response support with token-by-token updates
 * - Rate limiting integration with automatic retries
 * - Request queue management with priority handling
 * - Provider switching and error recovery
 * - Message cancellation support
 * - Comprehensive error handling and formatting
 */

import { useCallback, useRef, useEffect, useMemo } from 'react';
import { useChatStore } from '@store/chat';
import { useSettingsStore } from '@store/settings';
import { ProviderRegistry } from '../../provider/ProviderRegistry';
import { ProviderFactory } from '../../provider/ProviderFactory';
import { RateLimiter } from '../../provider/RateLimiter';
import { RequestQueue, type RequestPriority } from '../../provider/RequestQueue';
import type { ProviderType, AIProvider, ProviderConfig } from '../../types/providers';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Options for sending messages
 */
interface SendMessageOptions {
  /** Whether to use streaming response (default: true) */
  streaming?: boolean;
  /** Request priority (default: 'high') */
  priority?: RequestPriority;
  /** Custom timeout in milliseconds */
  timeout?: number;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Options for initializing the hook
 */
interface UseAIChatOptions {
  /** Enable/disable the hook functionality */
  enabled?: boolean;
  /** Auto-initialize providers from settings */
  autoInitialize?: boolean;
}

/**
 * Return type for useAIChat hook
 */
interface UseAIChatReturn {
  /** Send a message to the active AI provider */
  sendMessage: (content: string, options?: SendMessageOptions) => Promise<void>;
  /** Cancel the current message/streaming operation */
  cancelMessage: () => void;
  /** Switch to a different provider */
  switchProvider: (providerType: ProviderType) => Promise<void>;
  /** Check if currently streaming a response */
  isStreaming: () => boolean;
  /** Get current provider statistics */
  getStats: () => any;
}

// ============================================================================
// Constants
// ============================================================================

/** Default token estimate for messages when provider estimation fails */
const DEFAULT_TOKEN_ESTIMATE = 100;

/** Default request timeout in milliseconds */
const DEFAULT_REQUEST_TIMEOUT = 30000;

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Custom hook for AI chat functionality with real providers
 */
export function useAIChat(options: UseAIChatOptions = {}): UseAIChatReturn {
  const {
    enabled = true,
    autoInitialize = false, // Disable auto-initialization for tests
  } = options;

  // Store hooks
  const chatStore = useChatStore();
  const settingsStore = useSettingsStore();
  // Reactive settings snapshot for effects to respond to changes
  const settings = useSettingsStore(state => state.settings);

  // Refs for persistent instances
  const registryRef = useRef<ProviderRegistry | null>(null);
  const factoryRef = useRef<ProviderFactory | null>(null);
  const rateLimiterRef = useRef<RateLimiter | null>(null);
  const requestQueueRef = useRef<RequestQueue | null>(null);
  const currentRequestRef = useRef<Promise<any> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Initialize provider infrastructure
  const initializeInfrastructure = useCallback(() => {
    if (!registryRef.current) {
      registryRef.current = new ProviderRegistry();
    }
    if (!factoryRef.current) {
      factoryRef.current = new ProviderFactory();
    }
    if (!rateLimiterRef.current) {
      rateLimiterRef.current = new RateLimiter();
    }
    if (!requestQueueRef.current && rateLimiterRef.current) {
      requestQueueRef.current = new RequestQueue(rateLimiterRef.current);
    }
  }, []);

  // Initialize on mount
  useEffect(() => {
    if (enabled) {
      initializeInfrastructure();
    }
  }, [enabled, initializeInfrastructure]);

  // Initialize providers from settings
  useEffect(() => {
    if (!enabled || !autoInitialize) return;

    const initializeProviders = async () => {
      try {
        const { settings } = settingsStore;
        if (!settings || !settings.apiKeys) {
          console.warn('No settings or API keys available for provider initialization');
          return;
        }
        const { apiKeys, ai } = settings;
        const defaultProvider = ai?.defaultProvider;

        if (!registryRef.current || !factoryRef.current) return;

        // Create provider configurations for each available API key
        const providerConfigs: ProviderConfig[] = [];

        if (apiKeys.openai) {
          providerConfigs.push({
            type: 'openai',
            config: {
              apiKey: apiKeys.openai,
              model: 'gpt-5-nano',
              temperature: 0.7,
              reasoningEffort: 'low',
              maxTokens: 4096,
              topP: 1.0,
              frequencyPenalty: 0.0,
              presencePenalty: 0.0,
            },
          });
        }

        if (apiKeys.google) {
          providerConfigs.push({
            type: 'gemini',
            config: {
              apiKey: apiKeys.google,
              model: 'gemini-2.5-flash-lite',
              temperature: 0.7,
              thinkingMode: 'off',
              showThoughts: false,
              maxTokens: 8192,
              topP: 0.95,
              topK: 40,
            },
          });
        }

        // Note: OpenRouter intentionally excluded for Phase 1

        // Create and register providers
        for (const config of providerConfigs) {
          try {
            const provider = await factoryRef.current.createProvider(config);
            registryRef.current.register(provider);
          } catch (error) {
            console.warn(`Failed to initialize ${config.type} provider:`, error);
          }
        }

        // Set active provider if specified and available
        if (
          defaultProvider &&
          registryRef.current &&
          registryRef.current.hasProvider(defaultProvider)
        ) {
          registryRef.current.setActiveProvider(defaultProvider);
        } else if (providerConfigs.length > 0 && registryRef.current && providerConfigs[0]) {
          // Default to first available provider
          registryRef.current.setActiveProvider(providerConfigs[0].type);
        }
      } catch (error) {
        console.error('Failed to initialize providers:', error);
        chatStore.setError('Failed to initialize AI providers');
      }
    };

    initializeProviders();
  }, [enabled, autoInitialize, settingsStore, chatStore]);

  // React to settings changes: register/unregister providers and select active
  useEffect(() => {
    if (!enabled) return;
    const registry = registryRef.current;
    const factory = factoryRef.current;
    if (!registry || !factory) return;

    const syncProviders = async () => {
      try {
        const { apiKeys, ai } = settings;

        // Helper to ensure a provider is registered when key exists, or unregistered when missing
        const ensureProvider = async (
          type: ProviderType,
          hasKey: boolean,
          config: ProviderConfig['config']
        ) => {
          const isRegistered = registry.hasProvider(type);
          if (hasKey && !isRegistered) {
            try {
              const provider = await factory.createProvider({ type, config });
              registry.register(provider);
            } catch (error) {
              console.warn(`Failed to (re)initialize ${type} provider:`, error);
            }
          } else if (!hasKey && isRegistered) {
            registry.unregister(type);
          }
        };

        // Desired configs using Phase 1 models/defaults
        const openAIConfig: ProviderConfig['config'] = {
          apiKey: apiKeys.openai as string,
          model: 'gpt-5-nano',
          temperature: 0.7,
          reasoningEffort: 'medium',
          maxTokens: 4096,
          topP: 1.0,
          frequencyPenalty: 0.0,
          presencePenalty: 0.0,
        } as any;

        const geminiConfig: ProviderConfig['config'] = {
          apiKey: apiKeys.google as string,
          model: 'gemini-2.5-flash-lite',
          temperature: 0.7,
          thinkingMode: 'off',
          showThoughts: false,
          maxTokens: 8192,
          topP: 0.95,
          topK: 40,
        } as any;

        await ensureProvider('openai', !!apiKeys.openai, openAIConfig);
        await ensureProvider('gemini', !!apiKeys.google, geminiConfig);

        // Re-select active provider if available
        const desired = ai?.defaultProvider;
        if (desired && registry.hasProvider(desired)) {
          try {
            registry.setActiveProvider(desired);
          } catch (err) {
            // ignore
          }
        }
      } catch (err) {
        console.warn('Failed to sync providers with settings:', err);
      }
    };

    syncProviders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, settings.ai?.defaultProvider, settings.apiKeys?.openai, settings.apiKeys?.google]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (currentRequestRef.current) {
        // Cancel ongoing request
        if (requestQueueRef.current) {
          requestQueueRef.current.cancel(currentRequestRef.current);
        }
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  /**
   * Estimate token count for a message
   */
  const estimateTokens = useCallback((content: string, provider?: AIProvider): number => {
    if (!provider) return DEFAULT_TOKEN_ESTIMATE;

    try {
      return provider.estimateTokens(content);
    } catch (error) {
      console.warn('Failed to estimate tokens:', error);
      return DEFAULT_TOKEN_ESTIMATE;
    }
  }, []);

  /**
   * Get the active AI provider
   */
  const getActiveProvider = useCallback((): AIProvider | null => {
    if (!registryRef.current) return null;
    return registryRef.current.getActiveProvider();
  }, []);

  /**
   * Handle streaming response from provider
   */
  const handleStreamingResponse = useCallback(
    async (provider: AIProvider, assistantMessage: any): Promise<void> => {
      if (!provider.streamChat) {
        throw new Error('Provider does not support streaming');
      }

      try {
        // Set active message for streaming
        chatStore.setActiveMessage(assistantMessage.id);

        // Create messages array for provider (user message already in store)
        const messages = chatStore.messages.map(msg => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.timestamp),
        }));

        // Start streaming (pass AbortSignal for cancellation)
        const stream = provider.streamChat(messages, {
          signal: abortControllerRef.current?.signal,
        });

        for await (const chunk of stream) {
          // Check if cancelled
          if (abortControllerRef.current?.signal.aborted) {
            break;
          }

          // Extract text content from streaming chunk
          const piece = (chunk as any)?.choices?.[0]?.delta?.content || '';
          if (piece) {
            // Append chunk to message
            chatStore.appendToMessage(assistantMessage.id, piece);
          }
        }

        // Mark streaming complete
        chatStore.updateMessage(assistantMessage.id, {
          status: 'received',
        });
      } catch (error) {
        // Handle streaming error
        const providerError = provider.formatError?.(error as Error);
        const errorMessage = providerError ? providerError.message : (error as Error).message;
        chatStore.updateMessage(assistantMessage.id, {
          status: 'error',
          error: errorMessage,
        });
        throw error;
      } finally {
        chatStore.clearActiveMessage();
      }
    },
    [chatStore]
  );

  /**
   * Handle non-streaming response from provider
   */
  const handleNonStreamingResponse = useCallback(
    async (provider: AIProvider): Promise<void> => {
      // Create messages array for provider (user message already in store)
      const messages = chatStore.messages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.timestamp),
      }));

      // Get response from provider
      const response = await provider.chat(messages, {
        signal: abortControllerRef.current?.signal,
      });

      // Add assistant message to store
      chatStore.addMessage({
        role: 'assistant',
        content: response.content,
        status: 'received',
      });
    },
    [chatStore]
  );

  /**
   * Send a message to the active AI provider
   */
  const sendMessage = useCallback(
    async (content: string, options: SendMessageOptions = {}): Promise<void> => {
      if (!enabled) return;

      // Validate input
      const trimmedContent = content.trim();
      if (!trimmedContent) {
        return; // Don't send empty messages
      }

      const {
        streaming = true,
        priority = 'high',
        timeout = DEFAULT_REQUEST_TIMEOUT,
        metadata,
      } = options;

      try {
        // Clear any previous errors
        chatStore.clearError();
        settingsStore.clearError();

        // Set loading state
        chatStore.setLoading(true);

        // Get active provider
        const provider = getActiveProvider();
        if (!provider) {
          throw new Error('No active AI provider configured');
        }

        // Add user message to chat store
        const userMessage = chatStore.addMessage({
          role: 'user',
          content: trimmedContent,
          status: 'sending',
        });

        // Estimate token usage
        const tokens = estimateTokens(trimmedContent, provider);

        // Create request function
        const requestFn = async () => {
          // Create abort controller for this request
          abortControllerRef.current = new AbortController();

          try {
            if (streaming && typeof provider.streamChat === 'function') {
              // Create assistant message for streaming
              const assistantMessage = chatStore.addMessage({
                role: 'assistant',
                content: '',
                status: 'streaming',
              });

              await handleStreamingResponse(provider, assistantMessage);
            } else {
              // Non-streaming response
              await handleNonStreamingResponse(provider);
            }

            // Mark user message as sent on success
            chatStore.updateMessage(userMessage.id, {
              status: 'sent',
            });
          } catch (error) {
            // Handle provider errors
            const providerError = provider.formatError?.(error as Error);
            const errorMessage = providerError ? providerError.message : (error as Error).message;
            chatStore.setError(errorMessage);

            // Mark user message as error
            chatStore.updateMessage(userMessage.id, {
              status: 'error',
              error: errorMessage,
            });

            throw error;
          }
        };

        // Enqueue request with rate limiting
        if (requestQueueRef.current) {
          const providerType = registryRef.current?.getActiveProviderType();
          if (!providerType) {
            throw new Error('No active provider type');
          }

          currentRequestRef.current = requestQueueRef.current.enqueue(requestFn, {
            provider: providerType,
            tokens,
            priority,
            timeout,
            metadata,
          });

          await currentRequestRef.current;
        } else {
          // Fallback: execute directly if no queue
          await requestFn();
        }
      } catch (error) {
        // Handle general errors
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        chatStore.setError(errorMessage);
      } finally {
        // Clear loading state
        chatStore.setLoading(false);
        currentRequestRef.current = null;
      }
    },
    [
      enabled,
      chatStore,
      settingsStore,
      getActiveProvider,
      estimateTokens,
      handleStreamingResponse,
      handleNonStreamingResponse,
    ]
  );

  /**
   * Cancel the current message/streaming operation
   */
  const cancelMessage = useCallback(() => {
    // Cancel current request in queue
    if (requestQueueRef.current && currentRequestRef.current) {
      requestQueueRef.current.cancel(currentRequestRef.current);
    }

    // Abort any ongoing operations
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Clear active message and loading state
    chatStore.clearActiveMessage();
    chatStore.setLoading(false);
  }, [chatStore]);

  /**
   * Switch to a different provider
   */
  const switchProvider = useCallback(
    async (providerType: ProviderType) => {
      try {
        // Clear any errors
        chatStore.clearError();
        settingsStore.clearError();

        // Switch provider in registry
        if (registryRef.current) {
          registryRef.current.setActiveProvider(providerType);
        }

        // Update settings store
        await settingsStore.updateAISettings({
          ...settingsStore.settings.ai,
          defaultProvider: providerType,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        chatStore.setError(`Failed to switch provider: ${errorMessage}`);
      }
    },
    [chatStore, settingsStore]
  );

  /**
   * Check if currently streaming a response
   */
  const isStreaming = useCallback((): boolean => {
    return chatStore.activeMessageId !== null;
  }, [chatStore.activeMessageId]);

  /**
   * Get current provider and queue statistics
   */
  const getStats = useCallback(() => {
    return {
      activeProvider: registryRef.current?.getActiveProviderType() || null,
      queueStats: requestQueueRef.current?.getStats() || null,
      rateLimiter: {
        openai: rateLimiterRef.current?.getProviderStats('openai') || null,
        gemini: rateLimiterRef.current?.getProviderStats('gemini') || null,
        // openrouter removed/not implemented
      },
    };
  }, []);

  // Memoize return object to prevent unnecessary re-renders
  return useMemo(
    () => ({
      sendMessage,
      cancelMessage,
      switchProvider,
      isStreaming,
      getStats,
    }),
    [sendMessage, cancelMessage, switchProvider, isStreaming, getStats]
  );
}

export default useAIChat;
