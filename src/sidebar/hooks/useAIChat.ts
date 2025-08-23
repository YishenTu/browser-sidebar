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
 * - Provider switching and error recovery
 * - Message cancellation support
 * - Comprehensive error handling and formatting
 */

import { useCallback, useRef, useEffect, useMemo } from 'react';
import { useChatStore } from '@store/chat';
import { useSettingsStore } from '@store/settings';
import { ProviderRegistry } from '../../provider/ProviderRegistry';
import { ProviderFactory } from '../../provider/ProviderFactory';
import { SUPPORTED_MODELS } from '../../config/models';
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
  const currentRequestRef = useRef<Promise<any> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Track the last initialized API keys to prevent re-initialization on every settings change
  const lastInitializedKeysRef = useRef<{ openai?: string; google?: string }>({});
  // Track if we're currently initializing to prevent concurrent initialization
  const isInitializingRef = useRef<boolean>(false);

  // Initialize provider infrastructure
  const initializeInfrastructure = useCallback(() => {
    if (!registryRef.current) {
      registryRef.current = new ProviderRegistry();
    }
    if (!factoryRef.current) {
      factoryRef.current = new ProviderFactory();
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
      // Prevent concurrent initialization
      if (isInitializingRef.current) {
        return;
      }
      
      try {
        isInitializingRef.current = true;
        
        const { settings } = settingsStore;
        if (!settings || !settings.apiKeys) {
          console.warn('No settings or API keys available for provider initialization');
          isInitializingRef.current = false;
          return;
        }
        const { apiKeys, ai } = settings;
        const defaultProvider = ai?.defaultProvider;

        // Check if API keys have actually changed - if not, skip re-initialization
        const keysChanged = 
          apiKeys.openai !== lastInitializedKeysRef.current.openai ||
          apiKeys.google !== lastInitializedKeysRef.current.google;
        
        if (!keysChanged && registryRef.current && registryRef.current.getRegisteredProviders().length > 0) {
          // Keys haven't changed and we already have providers initialized
          isInitializingRef.current = false;
          return;
        }

        // Update the last initialized keys
        lastInitializedKeysRef.current = {
          openai: apiKeys.openai || undefined,
          google: apiKeys.google || undefined,
        };

        if (!registryRef.current || !factoryRef.current) {
          isInitializingRef.current = false;
          return;
        }

        // Clear existing providers before re-initializing
        if (registryRef.current) {
          const existingProviders = registryRef.current.getRegisteredProviders();
          for (const providerType of existingProviders) {
            registryRef.current.unregister(providerType);
          }
        }

        // Create provider configurations for each available API key
        // Use the first available model for each provider from config
        const providerConfigs: ProviderConfig[] = [];
        
        // Find default models for each provider from SUPPORTED_MODELS
        const defaultOpenAIModel = SUPPORTED_MODELS.find(m => m.provider === 'openai');
        const defaultGeminiModel = SUPPORTED_MODELS.find(m => m.provider === 'gemini');

        if (apiKeys.openai && defaultOpenAIModel) {
          providerConfigs.push({
            type: 'openai',
            config: {
              apiKey: apiKeys.openai,
              model: defaultOpenAIModel.id,
              reasoningEffort: defaultOpenAIModel.reasoningEffort || 'low',
            },
          });
        }

        if (apiKeys.google && defaultGeminiModel) {
          providerConfigs.push({
            type: 'gemini',
            config: {
              apiKey: apiKeys.google,
              model: defaultGeminiModel.id,
              thinkingBudget: defaultGeminiModel.thinkingBudget || '0',
              showThoughts: false,
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
      } finally {
        isInitializingRef.current = false;
      }
    };

    initializeProviders();
    // Only initialize on API key changes, not model changes
  }, [enabled, autoInitialize, settings?.apiKeys?.openai, settings?.apiKeys?.google, chatStore]);

  // React to settings changes: register/unregister providers and select active
  useEffect(() => {
    if (!enabled) return;
    const registry = registryRef.current;
    const factory = factoryRef.current;
    if (!registry || !factory) return;
    
    // Don't sync if we're still initializing
    if (isInitializingRef.current) return;

    const syncProviders = async () => {
      try {
        const { apiKeys } = settings;

        // Helper to ensure a provider is registered when key exists, or unregistered when missing
        const ensureProvider = async (
          type: ProviderType,
          hasKey: boolean,
          config: ProviderConfig['config']
        ) => {
          const isRegistered = registry.hasProvider(type);
          if (hasKey) {
            // Always unregister first to ensure fresh configuration
            if (isRegistered) {
              registry.unregister(type);
            }
            // Then create and register with new config
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

        // Get selected model from settings
        const selectedModelId = settings.selectedModel;
        const selectedModel = SUPPORTED_MODELS.find(m => m.id === selectedModelId);
        
        if (!selectedModel) {
          console.warn(`Selected model not found: ${selectedModelId}`);
          return;
        }

        // Only update the provider that matches the selected model
        // Keep both providers registered if API keys exist
        if (selectedModel.provider === 'openai' && apiKeys.openai) {
          const openAIConfig: ProviderConfig['config'] = {
            apiKey: apiKeys.openai as string,
            model: selectedModelId,
            reasoningEffort: selectedModel.reasoningEffort || 'low',
          } as any;
          await ensureProvider('openai', true, openAIConfig);
          
          // Set OpenAI as active provider
          if (registry.hasProvider('openai')) {
            try {
              registry.setActiveProvider('openai');
            } catch (err) {
              console.warn('Failed to set OpenAI as active provider:', err);
            }
          }
        }
        
        if (selectedModel.provider === 'gemini' && apiKeys.google) {
          const geminiConfig: ProviderConfig['config'] = {
            apiKey: apiKeys.google as string,
            model: selectedModelId,
            thinkingBudget: selectedModel.thinkingBudget || '0',
            showThoughts: false,
          } as any;
          await ensureProvider('gemini', true, geminiConfig);
          
          // Set Gemini as active provider
          if (registry.hasProvider('gemini')) {
            try {
              registry.setActiveProvider('gemini');
            } catch (err) {
              console.warn('Failed to set Gemini as active provider:', err);
            }
          }
        }
      } catch (err) {
        console.warn('Failed to sync providers with settings:', err);
      }
    };

    // Debounce to prevent rapid re-initialization
    const timeoutId = setTimeout(syncProviders, 300);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, settings.ai?.defaultProvider, settings.apiKeys?.openai, settings.apiKeys?.google, settings.selectedModel]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clean up current request if any
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
    async (provider: AIProvider, assistantMessage: any, userMessage?: any): Promise<void> => {
      if (!provider.streamChat) {
        throw new Error('Provider does not support streaming');
      }

      try {
        // Set active message for streaming
        chatStore.setActiveMessage(assistantMessage.id);

        // Build messages array for the provider
        // If we have userMessage passed in (first message case), use it directly
        // Get all messages from store including the new user message
        // We need to get a fresh copy of messages from the store
        const currentMessages = useChatStore.getState().messages;
        
        
        // If userMessage was just created and is the only real message, use it directly
        // This handles the case where the store might not have updated yet
        let messages;
        
        if (userMessage && currentMessages.filter(m => m.role === 'user' && m.content).length === 1) {
          // First message case - use the userMessage directly
          messages = [{
            id: userMessage.id,
            role: userMessage.role,
            content: userMessage.content,
            timestamp: userMessage.timestamp instanceof Date ? userMessage.timestamp : new Date(userMessage.timestamp),
          }];
        } else {
          // Get messages from store for follow-up messages
          messages = currentMessages
            .filter(msg => {
              // Exclude the empty assistant message we just created for streaming
              if (msg.id === assistantMessage.id) {
                return false;
              }
              // Include all non-empty messages
              if (!msg.content || msg.content.trim() === '') {
                return false;
              }
              return true;
            })
            .map(msg => ({
              id: msg.id,
              role: msg.role,
              content: msg.content,
              timestamp: new Date(msg.timestamp),
            }));
        }

        // Ensure we have at least one message
        if (messages.length === 0) {
          throw new Error('No valid messages to send to AI provider');
        }

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
        let errorMessage = 'An unexpected error occurred';

        if (error instanceof Error) {
          errorMessage = error.message;
        }

        // Try to get more specific error from provider
        const providerError = provider.formatError?.(error as Error);
        if (providerError) {
          errorMessage = providerError.message;
        }

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
      // Create messages array for provider (only non-empty messages)
      const messages = chatStore.messages
        .filter(msg => msg.content.trim() !== '') // Filter out empty messages
        .map(msg => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.timestamp),
        }));

      // Get response from provider
      const response = await provider.chat(messages, {
        signal: abortControllerRef.current?.signal,
      });

      // Get the selected model from settings
      const selectedModel = settingsStore.settings.selectedModel;
      const modelInfo = settingsStore.settings.availableModels.find(m => m.id === selectedModel);
      
      // Add assistant message to store with model metadata
      chatStore.addMessage({
        role: 'assistant',
        content: response.content,
        status: 'received',
        metadata: {
          model: modelInfo?.name || selectedModel || 'Unknown Model'
        }
      });
    },
    [chatStore, settingsStore]
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


        // Create request function
        const requestFn = async () => {
          // Create abort controller for this request
          abortControllerRef.current = new AbortController();

          try {
            if (streaming && typeof provider.streamChat === 'function') {
              // Get the selected model from settings
              const selectedModel = settingsStore.settings.selectedModel;
              const modelInfo = settingsStore.settings.availableModels.find(m => m.id === selectedModel);
              
              
              // Create assistant message for streaming with model metadata
              const assistantMessage = chatStore.addMessage({
                role: 'assistant',
                content: '',
                status: 'streaming',
                metadata: {
                  model: modelInfo?.name || selectedModel || 'Unknown Model'
                }
              });

              await handleStreamingResponse(provider, assistantMessage, userMessage);
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

        // Execute request directly
        await requestFn();
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
          // Check if provider is registered before trying to switch
          if (!registryRef.current.hasProvider(providerType)) {
            console.warn(`Provider ${providerType} is not registered yet`);
            return;
          }
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
      // Queue and rate limiting stats removed (not needed for BYOK model)
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
