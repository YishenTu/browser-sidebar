/**
 * @file Simplified AI Chat Hook
 *
 * Main orchestrator hook that combines provider management, message handling,
 * and settings synchronization for AI chat functionality.
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
import type { AIProvider, ProviderType } from '../../../types/providers';

export function useAIChat(options: UseAIChatOptions = {}): UseAIChatReturn {
  const { enabled = true, autoInitialize = false } = options;

  const tabStore = useTabStore();
  const uiStore = useUIStore();
  const messageStore = useMessageStore();
  const settingsStore = useSettingsStore();
  const settings = settingsStore.settings;

  const tabExtraction = useTabExtraction();

  const providerManagerServiceRef = useRef<EngineManagerService | null>(null);
  const chatServiceRef = useRef<ChatService | null>(null);

  const hasActiveConversation = useCallback(() => {
    return useMessageStore.getState().hasMessages();
  }, []);

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

  // Provider initialization helper
  const serviceInitializeProviders = useCallback(async () => {
    if (!providerManagerServiceRef.current) return;
    try {
      await providerManagerServiceRef.current.initializeFromSettings();
      const activeProvider = providerManagerServiceRef.current.getActive();
      if (activeProvider && chatServiceRef.current) {
        const existing = chatServiceRef.current.getProvider();
        const streaming = chatServiceRef.current.isStreaming();
        const conversationActive = hasActiveConversation();
        if (existing && existing !== activeProvider && conversationActive) {
          // Do not swap providers mid conversation
          return;
        }
        if (!existing || existing !== activeProvider) {
          if (!streaming) {
            chatServiceRef.current.setProvider(activeProvider);
          }
        }
      }
    } catch (err) {
      // Silently ignore initialization errors unless critical
    }
  }, [hasActiveConversation]);

  // Auto-initialize
  useEffect(() => {
    if (!enabled || !autoInitialize) return;
    serviceInitializeProviders().catch(() => uiStore.setError('Failed to initialize AI providers'));
  }, [
    enabled,
    autoInitialize,
    settings?.apiKeys,
    settings?.selectedModel,
    serviceInitializeProviders,
    uiStore,
  ]);

  // Sync on settings change
  useEffect(() => {
    if (!enabled) return;
    serviceInitializeProviders();
  }, [
    enabled,
    settings.ai?.defaultProvider,
    settings.apiKeys,
    settings.selectedModel,
    serviceInitializeProviders,
  ]);

  // Sync tab extraction
  useEffect(() => {
    if (!enabled) return;
    const { currentTabContent, currentTabId, loadedTabs, hasAutoLoaded } = tabExtraction;
    const tabStoreState = useTabStore.getState();

    if (currentTabId !== null && tabStoreState.getCurrentTabId() !== currentTabId) {
      tabStore.setCurrentTabId(currentTabId);
    }
    if (tabStoreState.getHasAutoLoaded() !== hasAutoLoaded) {
      tabStore.setHasAutoLoaded(hasAutoLoaded);
    }
    if (currentTabContent && currentTabId !== null && !loadedTabs[currentTabId]) {
      tabStore.setLoadedTabs({
        ...loadedTabs,
        [currentTabId]: {
          tabInfo: {
            id: currentTabId,
            title: currentTabContent.title || 'Current Tab',
            url: currentTabContent.url || '',
            domain: currentTabContent.url ? new URL(currentTabContent.url).hostname : '',
            windowId: 0,
            active: true,
            index: 0,
            pinned: false,
            lastAccessed: Date.now(),
          },
          extractedContent: currentTabContent,
          extractionStatus: 'completed',
          isStale: false,
        },
      });
    }
  }, [enabled, tabExtraction, tabStore]);

  const serviceGetActiveProvider = useCallback((): AIProvider | null => {
    return providerManagerServiceRef.current?.getActive() || null;
  }, []);

  const serviceSwitchProvider = useCallback(
    async (providerType: ProviderType) => {
      if (!providerManagerServiceRef.current) throw new Error('Provider manager not initialized');

      const activeProvider = serviceGetActiveProvider();
      if (activeProvider?.type === providerType) {
        return;
      }

      if (chatServiceRef.current?.isStreaming()) {
        const error = new Error(
          'Cannot switch provider while a response is streaming. Wait for the reply to finish or cancel it.'
        );
        uiStore.setError(error.message);
        throw error;
      }

      if (hasActiveConversation()) {
        const error = new Error(
          'Cannot switch provider during an active conversation. Start a new session to change providers.'
        );
        uiStore.setError(error.message);
        throw error;
      }

      // Basic switch
      await providerManagerServiceRef.current.initializeFromSettings();
      await providerManagerServiceRef.current.switch(providerType);

      // Update chat service
      const newActive = providerManagerServiceRef.current.getActive();
      if (newActive && chatServiceRef.current && !chatServiceRef.current.isStreaming()) {
        chatServiceRef.current.setProvider(newActive);
      }
    },
    [hasActiveConversation, serviceGetActiveProvider, uiStore]
  );

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
    async (content: string, options: SendMessageOptions = {}) => {
      if (!enabled) return;
      if (!content.trim()) return;

      uiStore.clearError();
      uiStore.setLoading(true);

      let userMessageId: string | undefined;
      let assistantMessageId: string | undefined;

      try {
        const activeProvider = serviceGetActiveProvider();
        if (!activeProvider) throw new Error('No active AI provider configured');

        // Formatting logic
        const loadedTabs = useTabStore.getState().getLoadedTabs();
        const allLoadedTabs = Object.values(loadedTabs);
        const existingMessages = messageStore.getMessages();
        const userMessages = existingMessages.filter(
          m => m.role === 'user' && m.status !== 'pending'
        );
        const isFirst = userMessages.length === 0;

        let finalContent = content.trim();

        if (isFirst && allLoadedTabs.length > 0) {
          finalContent = formatTabContent(content.trim(), allLoadedTabs, {}).formatted;
        }

        // Add/Update User Message
        if (!options.skipUserMessage) {
          const pending = messageStore
            .getMessages()
            .find(m => m.role === 'user' && m.status === 'pending');
          if (pending) {
            messageStore.updateMessage(pending.id, { content: finalContent, status: 'sending' });
            userMessageId = pending.id;
          } else {
            const msg = messageStore.addMessage({
              role: 'user',
              content: finalContent,
              displayContent: options.displayContent || content.trim(),
              status: 'sending',
            });
            userMessageId = msg.id;
          }
        } else {
          userMessageId = messageStore.getUserMessages().slice(-1)[0]?.id;
        }

        // Create Assistant Message
        const modelInfo = getModelById(settingsStore.settings.selectedModel);
        const assistantMsg = messageStore.addMessage({
          role: 'assistant',
          content: '',
          status: 'streaming',
          metadata: { model: modelInfo?.name || 'AI Assistant' },
        });
        assistantMessageId = assistantMsg.id;
        uiStore.setActiveMessage(assistantMsg.id);

        // Prepare Stream
        const messages = messageStore
          .getMessages()
          .filter(m => m.id !== assistantMsg.id && m.content)
          .map(m => ({
            id: m.id,
            role: m.role as 'user' | 'assistant' | 'system',
            content: m.content,
            timestamp: new Date(m.timestamp),
            metadata: m.metadata,
          }));

        const systemPrompt = getSystemPrompt(activeProvider.type, allLoadedTabs.length > 0);

        if (chatServiceRef.current && !chatServiceRef.current.getProvider()) {
          chatServiceRef.current.setProvider(activeProvider);
        }

        const stream = chatServiceRef.current!.stream(messages, { systemPrompt });

        // Consume Stream
        let lastContent = '';
        let streamInterrupted = false;

        try {
          for await (const chunk of stream) {
            if (!chatServiceRef.current?.isStreaming()) {
              streamInterrupted = true;
              break;
            }
            const delta = chunk.choices?.[0]?.delta?.content || '';
            if (delta) {
              messageStore.appendToMessage(assistantMsg.id, delta);
              lastContent += delta;
            }
          }
        } catch (err) {
          streamInterrupted = true;
          // If we have content, we just mark interrupted. If not, we rethrow.
          if (!lastContent) throw err;

          // Append interruption note
          messageStore.appendToMessage(assistantMsg.id, '\n\n[Interrupted]');
        }

        // Finalize Assistant Message
        if (lastContent) {
          messageStore.updateMessage(assistantMsg.id, {
            status: 'received',
            metadata: { ...assistantMsg.metadata, partial: streamInterrupted },
          });
          // Finalize User Message
          if (userMessageId) {
            messageStore.updateMessage(userMessageId, { status: 'sent' });
          }
        } else {
          // No content received -> Error state
          messageStore.deleteMessage(assistantMsg.id);
          throw new Error('No content received');
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        uiStore.setError(msg);
        if (userMessageId) {
          messageStore.updateMessage(userMessageId, { status: 'error', error: msg });
        }
        // Ensure assistant message is gone if it was empty
        if (assistantMessageId) {
          const msg = messageStore.getMessageById(assistantMessageId);
          if (msg && !msg.content) {
            messageStore.deleteMessage(assistantMessageId);
          }
        }
      } finally {
        uiStore.setLoading(false);
        uiStore.clearActiveMessage();
      }
    },
    [enabled, hasActiveConversation, messageStore, serviceGetActiveProvider, uiStore]
  );

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
