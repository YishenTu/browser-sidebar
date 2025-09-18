/**
 * @file Simplified AI Chat Hook
 *
 * Main orchestrator hook that combines provider management, message handling,
 * and settings synchronization for AI chat functionality.
 *
 * Supports both legacy hook-based implementation and new service-based implementation
 * controlled by the refactorMode feature flag.
 */

import { useEffect, useMemo, useRef, useCallback } from 'react';
import { useSettingsStore } from '@store/settings';
import { useTabStore, useUIStore, useMessageStore } from '@store/chat';
import { useTabExtraction } from '../useTabExtraction';
import { EngineManagerService } from '../../../services/engine/EngineManagerService';
import { ChatService } from '../../../services/chat/ChatService';
import { getModelById } from '../../../config/models';
import { getSystemPrompt } from '../../../config/systemPrompt';
import { formatTabContent } from '../../../services/chat/contentFormatter';
import type { UseAIChatOptions, UseAIChatReturn, SendMessageOptions } from './types';
import type { TabContent } from '../../../types/tabs';
import type { AIProvider, ProviderType } from '../../../types/providers';
import type { ProviderChatMessage } from '../../../types/providers';

/**
 * Custom hook for AI chat functionality with real providers
 *
 * This is a simplified orchestrator that delegates specific responsibilities
 * to specialized hooks for better maintainability and testing.
 *
 * With refactorMode enabled, uses the service layer instead of hooks.
 */
export function useAIChat(options: UseAIChatOptions = {}): UseAIChatReturn {
  const { enabled = true, autoInitialize = false } = options;

  const tabStore = useTabStore();
  const uiStore = useUIStore();
  const messageStore = useMessageStore();
  const settingsStore = useSettingsStore();
  const settings = settingsStore.settings;

  // Initialize tab extraction hook (always use legacy implementation)
  const tabExtraction = useTabExtraction();

  // Service layer instances
  const providerManagerServiceRef = useRef<EngineManagerService | null>(null);
  const chatServiceRef = useRef<ChatService | null>(null);

  // Initialize services
  useEffect(() => {
    if (!enabled) return;
    if (!providerManagerServiceRef.current) {
      providerManagerServiceRef.current = EngineManagerService.getInstance({
        autoInitialize: autoInitialize,
        enableStats: true,
      });
    }
    if (!chatServiceRef.current) {
      chatServiceRef.current = new ChatService();
    }
  }, [enabled, autoInitialize]);

  // Service-based provider initialization
  const serviceInitializeProviders = useCallback(async () => {
    if (!providerManagerServiceRef.current) return;
    try {
      await providerManagerServiceRef.current.initializeFromSettings();
      // Update chat service with active provider if available
      try {
        const activeProvider = providerManagerServiceRef.current.getActive();
        if (activeProvider && chatServiceRef.current) {
          // Avoid interrupting any in‑flight stream; only set when
          // there is no active stream or when provider type differs.
          const existing = chatServiceRef.current.getProvider();
          const streaming = chatServiceRef.current.isStreaming();
          // If the provider instance differs (even if type is the same), update it
          if (!existing || existing !== activeProvider) {
            if (!streaming) {
              chatServiceRef.current.setProvider(activeProvider);
            }
          }
        }
      } catch (err) {
        // Silently ignore when no providers are configured yet
        const msg = (err as Error)?.message || '';
        const benign =
          msg.includes('No active provider available') ||
          msg.includes('Settings or API keys not available');
        if (!benign) {
          // Service-based provider initialization warning
        }
      }
    } catch (error) {
      // Service-based provider initialization failed
    }
  }, []);

  // Auto-initialize providers from settings
  useEffect(() => {
    if (!enabled || !autoInitialize) return;

    const initialize = async () => {
      try {
        await serviceInitializeProviders();
      } catch (_error) {
        uiStore.setError('Failed to initialize AI providers');
      }
    };

    initialize();
  }, [
    enabled,
    autoInitialize,
    settings?.apiKeys?.openai,
    settings?.apiKeys?.google,
    settings?.selectedModel,
    serviceInitializeProviders,
    uiStore,
  ]);

  // Sync providers with settings changes
  useEffect(() => {
    if (!enabled) return;

    const syncProviders = async () => {
      try {
        await serviceInitializeProviders();
      } catch (_error) {
        // Ignore initialization errors - provider will handle retry
      }
    };

    // Apply immediately to ensure model switches reflect in the next request
    syncProviders();
  }, [
    enabled,
    settings.ai?.defaultProvider,
    settings.apiKeys?.openai,
    settings.apiKeys?.google,
    settings.selectedModel,
    serviceInitializeProviders,
  ]);

  // Sync tab extraction state with chat store
  useEffect(() => {
    if (!enabled) return;

    const { currentTabContent, currentTabId, loadedTabs, hasAutoLoaded } = tabExtraction;

    // Update chat store with current tab information only if changed
    // The Zustand hook returns a snapshot of state/actions; to access
    // the store API use the hook function itself.
    const tabStoreState = useTabStore.getState();

    if (currentTabId !== null && tabStoreState.getCurrentTabId() !== currentTabId) {
      tabStore.setCurrentTabId(currentTabId);
    }

    // Update has auto-loaded state only if changed
    if (tabStoreState.getHasAutoLoaded() !== hasAutoLoaded) {
      tabStore.setHasAutoLoaded(hasAutoLoaded);
    }

    // Only update loaded tabs if there's an actual change
    // Since loadedTabs already comes from the store via useTabExtraction,
    // we don't need to set it back unless we're adding the current tab
    if (currentTabContent && currentTabId !== null && !loadedTabs[currentTabId]) {
      // Create TabContent structure for current tab
      const currentTabAsTabContent: TabContent = {
        tabInfo: {
          id: currentTabId,
          title: currentTabContent.title || 'Current Tab',
          url: currentTabContent.url || '',
          domain: currentTabContent.url ? new URL(currentTabContent.url).hostname : '',
          windowId: 0, // Default window ID
          active: true,
          index: 0, // Default index
          pinned: false, // Default pinned state
          lastAccessed: Date.now(),
        },
        extractedContent: currentTabContent,
        extractionStatus: 'completed' as const,
        isStale: false,
      };

      // Only update if current tab is not already in loaded tabs
      const updatedTabs: Record<number, TabContent> = {
        ...loadedTabs,
        [currentTabId]: currentTabAsTabContent,
      };
      tabStore.setLoadedTabs(updatedTabs);
    }
  }, [
    enabled,
    tabExtraction.currentTabContent,
    tabExtraction.currentTabId,
    tabExtraction.loadedTabs,
    tabExtraction.hasAutoLoaded,
    tabStore,
    tabExtraction,
  ]);

  // Service-based implementations
  const serviceGetActiveProvider = useCallback((): AIProvider | null => {
    if (!providerManagerServiceRef.current) return null;
    try {
      return providerManagerServiceRef.current.getActive();
    } catch {
      return null;
    }
  }, []);

  const serviceSwitchProvider = useCallback(async (providerType: ProviderType): Promise<void> => {
    if (!providerManagerServiceRef.current)
      throw new Error('Provider manager service not initialized');

    // Ensure providers are (re)initialized so the target provider is registered
    await providerManagerServiceRef.current.initializeFromSettings();

    await providerManagerServiceRef.current.switch(providerType);

    // Update chat service with new active provider without interrupting streams unnecessarily
    const newActiveProvider = providerManagerServiceRef.current.getActive();
    if (newActiveProvider && chatServiceRef.current) {
      const existing = chatServiceRef.current.getProvider();
      const streaming = chatServiceRef.current.isStreaming();
      // Always replace if the instance changed (regardless of type)
      if (!existing || existing !== newActiveProvider) {
        if (!streaming) {
          chatServiceRef.current.setProvider(newActiveProvider);
        }
      }
    }
  }, []);

  const serviceGetStats = useCallback(() => {
    if (!providerManagerServiceRef.current) {
      return { activeProvider: null, registeredProviders: [] };
    }
    const stats = providerManagerServiceRef.current.getStats();
    return {
      activeProvider: stats.activeProvider,
      registeredProviders: stats.registeredProviders,
    };
  }, []);

  const serviceCancelMessage = useCallback(() => {
    if (chatServiceRef.current) {
      chatServiceRef.current.cancel();
    }
    uiStore.setLoading(false);
  }, [uiStore]);

  const serviceIsStreaming = useCallback(() => {
    return chatServiceRef.current?.isStreaming() ?? false;
  }, []);

  const serviceSendMessage = useCallback(
    async (content: string, options: SendMessageOptions = {}): Promise<void> => {
      if (!enabled) return;

      // Validate input
      const trimmedContent = content.trim();
      if (!trimmedContent) {
        return; // Don't send empty messages
      }

      const { skipUserMessage = false, displayContent, metadata } = options;

      // Model override variables need to be accessible in finally block
      let modelOverride: string | undefined;
      let originalModel: string | undefined;
      let switchedProvider = false;

      try {
        // Clear any previous errors
        uiStore.clearError();
        settingsStore.clearError();

        // Set loading state
        uiStore.setLoading(true);

        // Get active provider
        if (!chatServiceRef.current) {
          throw new Error('Chat service not initialized');
        }

        const activeProvider = serviceGetActiveProvider();
        if (!activeProvider) {
          throw new Error('No active AI provider configured. Please add an API key in settings.');
        }

        // Prepare message content with tab context if available
        let finalContent = trimmedContent;
        const finalDisplayContent = displayContent || trimmedContent;
        let hasTabContext = false;
        let formatResult: ReturnType<typeof formatTabContent> | undefined;

        // Check if this is the first message in the conversation
        const existingMessages = messageStore.getMessages();
        const isFirstMessage = existingMessages.filter(m => m.role === 'user').length === 0;

        // Check if we have loaded tabs to include
        const loadedTabs = useTabStore.getState().getLoadedTabs();
        const loadedTabIds = Object.keys(loadedTabs).map(id => parseInt(id, 10));

        // Always format the first message (with or without tabs)
        if (isFirstMessage) {
          // Get all loaded tabs (may be empty array)
          const allLoadedTabs = loadedTabIds
            .map(tabId => loadedTabs[tabId])
            .filter((tab): tab is TabContent => Boolean(tab));

          // Format the content - will add system instruction even if no tabs
          formatResult = formatTabContent(trimmedContent, allLoadedTabs);

          // Use formatted content for AI but keep original for display
          finalContent = formatResult.formatted;
          hasTabContext = allLoadedTabs.length > 0;
        }

        // Add user message to chat store (unless we're regenerating)
        let userMessage;
        if (!skipUserMessage) {
          userMessage = messageStore.addMessage({
            role: 'user',
            content: finalContent,
            displayContent: finalDisplayContent,
            status: 'sending',
            metadata: {
              ...metadata,
              hasTabContext,
              originalUserContent: hasTabContext ? trimmedContent : undefined,
              sections: formatResult?.sections,
            },
          });
        } else {
          // For regeneration, get the last user message
          const lastUserMessage = messageStore.getUserMessages().slice(-1)[0];
          if (!lastUserMessage) {
            throw new Error('No user message found for regeneration');
          }
          userMessage = lastUserMessage;

          // Update the user message with new content if tab context changed
          if (hasTabContext && userMessage.content !== finalContent) {
            messageStore.updateMessage(userMessage.id, {
              content: finalContent,
              metadata: {
                ...userMessage.metadata,
                hasTabContext,
                originalUserContent: trimmedContent,
                sections: formatResult?.sections,
              },
            });
          }
        }

        try {
          // Check for model override from slash commands
          modelOverride = metadata?.['modelOverride'] as string | undefined;

          // If there's a model override, temporarily switch to that model —
          // only if it is present in availableModels (gated by stored keys).
          if (modelOverride) {
            const state = useSettingsStore.getState();
            const available = state.settings.availableModels.some(
              m => m.id === modelOverride && m.available
            );
            if (!available) {
              // Slash command requested unavailable model - fall back to default
              modelOverride = undefined;
            } else {
              originalModel = state.settings.selectedModel;
              const targetProviderType = state.getProviderTypeForModel(modelOverride);
              const currentProviderType = activeProvider.type;

              if (targetProviderType && targetProviderType !== currentProviderType) {
                await serviceSwitchProvider(targetProviderType);
                switchedProvider = true;
              }

              await state.updateSelectedModel(modelOverride);
              await serviceInitializeProviders();
              const updatedProvider = serviceGetActiveProvider();
              if (updatedProvider && chatServiceRef.current) {
                chatServiceRef.current.setProvider(updatedProvider);
              }

              const prevType = state.getProviderTypeForModel(originalModel);
              if (
                prevType === 'openai' &&
                (targetProviderType !== 'openai' || modelOverride !== originalModel)
              ) {
                uiStore.setLastResponseId(null);
              }
            }
          }

          // Get the model info (either override or selected)
          const currentModel = modelOverride || settingsStore.settings.selectedModel;
          const modelInfo = getModelById(currentModel);

          // Create assistant message for streaming with model metadata
          const assistantMessage = messageStore.addMessage({
            role: 'assistant',
            content: '',
            status: 'streaming',
            metadata: {
              model: modelInfo?.name || 'AI Assistant',
            },
          });

          // Set active message for streaming
          uiStore.setActiveMessage(assistantMessage.id);

          // Get current messages from store for conversation context
          const currentMessages = useMessageStore.getState().getMessages();

          // Build messages array for the provider
          let messages: ProviderChatMessage[];

          if (
            userMessage &&
            currentMessages.filter(m => m.role === 'user' && m.content).length === 1
          ) {
            // First message case - use the userMessage directly
            messages = [
              {
                id: userMessage.id,
                role: userMessage.role as 'user',
                content: userMessage.content,
                timestamp:
                  userMessage.timestamp instanceof Date
                    ? userMessage.timestamp
                    : new Date(userMessage.timestamp),
                metadata: userMessage.metadata, // Include metadata for attachments
              },
            ];
          } else {
            // Get messages from store for follow-up messages
            messages = currentMessages
              .filter(msg => {
                // Exclude the empty assistant message we just created
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
                role: msg.role as 'user' | 'assistant',
                content: msg.content,
                timestamp: new Date(msg.timestamp),
                metadata: msg.metadata, // Include metadata for attachments
              }));
          }

          // Ensure we have at least one message
          if (messages.length === 0) {
            throw new Error('No valid messages to send to AI provider');
          }

          // Get last response ID for conversation continuity (OpenAI Response API)
          const previousResponseId = uiStore.getLastResponseId();

          // Check if we have tab content loaded
          const loadedTabs = useTabStore.getState().getLoadedTabs();
          const hasTabContent = Object.keys(loadedTabs).length > 0;

          // Get the system prompt with the actual provider that will handle the stream.
          // If a model override occurred, ChatService's provider may have changed.
          const providerForPrompt =
            chatServiceRef.current?.getProvider() || serviceGetActiveProvider() || activeProvider;
          const systemPrompt = getSystemPrompt(providerForPrompt.type, hasTabContent);

          // Ensure ChatService has an active provider (in case init just finished)
          if (chatServiceRef.current && !chatServiceRef.current.getProvider() && activeProvider) {
            chatServiceRef.current.setProvider(activeProvider);
          }

          // Start streaming using ChatService
          const stream = chatServiceRef.current.stream(messages, {
            previousResponseId: previousResponseId || undefined,
            systemPrompt,
          });

          let lastSuccessfulContent = '';
          let thinkingContent = '';
          let isThinkingPhase = true;
          let streamInterrupted = false;
          let searchMetadata: unknown = null;
          let responseId: string | null = null;

          let lastStreamError: unknown = null;
          try {
            for await (const chunk of stream) {
              // Check if cancelled
              if (chatServiceRef.current && !chatServiceRef.current.isStreaming()) {
                streamInterrupted = true;
                break;
              }

              // Extract thinking and content from streaming chunk
              const thinking = chunk?.choices?.[0]?.delta?.thinking || '';
              const content = chunk?.choices?.[0]?.delta?.content || '';

              // Check for search metadata in the chunk
              if (chunk.metadata?.['searchResults']) {
                searchMetadata = chunk.metadata['searchResults'];
              }

              // Check for response ID in the chunk (OpenAI Response API)
              if (chunk.metadata?.['responseId']) {
                responseId = chunk.metadata?.['responseId'] as string;
              }

              // Handle thinking content - append deltas for real-time streaming
              if (thinking) {
                thinkingContent += thinking;
                const currentMsg = messageStore.getMessageById(assistantMessage.id);
                messageStore.updateMessage(assistantMessage.id, {
                  metadata: {
                    ...(currentMsg?.metadata || {}),
                    thinking: thinkingContent,
                    thinkingStreaming: true,
                  },
                });
              }

              // Handle regular content
              if (content) {
                // Mark end of thinking phase when content starts
                if (isThinkingPhase && thinkingContent) {
                  isThinkingPhase = false;
                  const currentMsg = messageStore.getMessageById(assistantMessage.id);
                  messageStore.updateMessage(assistantMessage.id, {
                    metadata: {
                      ...(currentMsg?.metadata || {}),
                      thinking: thinkingContent,
                      thinkingStreaming: false,
                    },
                  });
                }
                // Append the content chunk
                messageStore.appendToMessage(assistantMessage.id, content);
                lastSuccessfulContent += content;

                // Update search metadata if we have it
                if (searchMetadata) {
                  const currentMsg = messageStore.getMessageById(assistantMessage.id);
                  messageStore.updateMessage(assistantMessage.id, {
                    metadata: {
                      ...(currentMsg?.metadata || {}),
                      searchResults: searchMetadata,
                    },
                  });
                }
              }
            }
          } catch (streamError) {
            // Streaming was interrupted
            streamInterrupted = true;
            lastStreamError = streamError;

            // Append recovery message if we got partial content
            if (lastSuccessfulContent && lastSuccessfulContent.length > 0) {
              messageStore.appendToMessage(
                assistantMessage.id,
                '\n\n[Stream interrupted. Message may be incomplete.]'
              );
            }
          }

          // Update message status based on streaming result
          const finalMsg = messageStore.getMessageById(assistantMessage.id);
          if (streamInterrupted && lastSuccessfulContent.length > 0) {
            messageStore.updateMessage(assistantMessage.id, {
              status: 'received',
              metadata: {
                ...(finalMsg?.metadata || {}),
                partial: true,
                interrupted: true,
                thinking: thinkingContent || undefined,
                thinkingStreaming: false,
                ...(searchMetadata ? { searchResults: searchMetadata } : {}),
              },
            });
          } else if (!streamInterrupted) {
            messageStore.updateMessage(assistantMessage.id, {
              status: 'received',
              metadata: {
                ...(finalMsg?.metadata || {}),
                thinking: thinkingContent || undefined,
                thinkingStreaming: false,
                ...(searchMetadata ? { searchResults: searchMetadata } : {}),
              },
            });
            // Store response ID if we got one (OpenAI Response API)
            if (responseId) {
              uiStore.setLastResponseId(responseId);
            }
          } else {
            // Stream was interrupted with no content - remove the empty assistant message
            messageStore.deleteMessage(assistantMessage.id);
            // Surface the underlying error if available; otherwise emit generic message
            if (lastStreamError instanceof Error) {
              throw lastStreamError;
            }
            throw new Error('Stream interrupted before receiving any content');
          }

          // Mark user message as sent on success
          messageStore.updateMessage(userMessage.id, {
            status: 'sent',
          });
        } catch (error) {
          // Handle provider errors
          const providerError = activeProvider.formatError?.(error as Error);
          const errorMessage = providerError ? providerError.message : (error as Error).message;
          uiStore.setError(errorMessage);

          // Mark user message as error
          messageStore.updateMessage(userMessage.id, {
            status: 'error',
            error: errorMessage,
          });

          throw error;
        }
      } catch (error) {
        // Handle general errors
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        uiStore.setError(errorMessage);
        throw error;
      } finally {
        // Clear loading state
        uiStore.setLoading(false);
        // Clear active message
        try {
          uiStore.clearActiveMessage();
        } catch {
          // Ignore cleanup errors
        }
        // Restore original model if we temporarily switched for a slash command
        if (modelOverride && originalModel) {
          try {
            // Restore the original model
            await settingsStore.updateSelectedModel(originalModel);

            if (switchedProvider) {
              // Switch back to the original provider type
              const originalProviderType = settingsStore.getProviderTypeForModel(originalModel);
              if (originalProviderType) {
                await serviceSwitchProvider(originalProviderType);
              }
            } else {
              // Provider type didn't change; reinitialize to apply model
              await serviceInitializeProviders();
              const restoredProvider = serviceGetActiveProvider();
              if (restoredProvider && chatServiceRef.current) {
                chatServiceRef.current.setProvider(restoredProvider);
              }
            }
          } catch {
            // Don't throw - we don't want to break the chat flow
          }
        }
      }
    },
    [
      enabled,
      settingsStore,
      uiStore,
      serviceGetActiveProvider,
      messageStore,
      serviceSwitchProvider,
      serviceInitializeProviders,
      chatServiceRef,
    ]
  );

  // Cleanup on unmount only (empty dependency array)
  useEffect(() => {
    return () => {
      // Cancel any ongoing operations
      serviceCancelMessage();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty array - only run on mount/unmount

  // Memoize return object to prevent unnecessary re-renders
  return useMemo(() => {
    return {
      sendMessage: serviceSendMessage,
      cancelMessage: serviceCancelMessage,
      switchProvider: serviceSwitchProvider,
      isStreaming: serviceIsStreaming,
      getStats: serviceGetStats,
      tabExtraction,
    };
  }, [
    serviceSendMessage,
    serviceCancelMessage,
    serviceSwitchProvider,
    serviceIsStreaming,
    serviceGetStats,
    tabExtraction,
  ]);
}

export default useAIChat;
