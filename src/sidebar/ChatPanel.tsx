/**
 * @file Unified ChatPanel Component
 *
 * Unified component that merges Sidebar.tsx and the existing ChatPanel.tsx functionality.
 * Provides a complete chat interface with overlay positioning, resize/drag capabilities,
 * and Shadow DOM isolation.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { unmountSidebar } from './index';
import { useSettingsStore } from '@store/settings';
import { useError } from '@contexts/useError';
import { getErrorSource } from '@core/utils/errorUtils';
import { ErrorBanner } from '@components/ErrorBanner';
import {
  useSessionStore,
  useMessageStore,
  useTabStore,
  useUIStore,
  type ChatMessage,
} from '@store/chat';
import { useAIChat } from '@hooks/ai';
import { useTabExtraction } from '@hooks/useTabExtraction';
import { useSessionManager } from '@hooks/useSessionManager';
import { TabContentItem } from '@components/TabContentItem';
import { ExtractionMode } from '@/types/extraction';
import { ContentPreview } from '@components/ContentPreview';
import { ScreenshotPreview } from '@components/ScreenshotPreview';
import { createMessage, type CleanupTabCacheMessage } from '@/types/messages';
import { sendMessage as sendRuntimeMessage } from '@platform/chrome/runtime';
// Custom hooks
import { useScreenshotCapture } from '@hooks/useScreenshotCapture';
import { useMessageEditing } from '@hooks/useMessageEditing';
import { useSidebarPosition } from '@hooks/useSidebarPosition';
// Extracted services
import { isSystemCaptureHotkey } from '@core/utils/hotkeys';
import { uploadImage as uploadImageUnified } from '@core/services/imageUploadService';
import { switchModel } from '@core/services/modelSwitching';
import { prepareMessageContent, buildMessageMetadata } from '@core/services/messageEditing';
import {
  filterAdditionalTabs,
  shouldShowContentPreview,
  isMultiTabMode,
} from '@core/services/tabContent';

// Layout components
import { Header } from '@components/layout/Header';
import { Body } from '@components/layout/Body';
import { Footer } from '@components/layout/Footer';
import { ResizeHandles } from '@components/layout/ResizeHandles';

// Settings components
import { Settings } from '@components/Settings/Settings';

export interface ChatPanelProps {
  /** Custom CSS class name */
  className?: string;
  /** Callback when sidebar is closed */
  onClose: () => void;
  /** Initial selected text from the page */
  initialSelectedText?: string;
}

/**
 * Unified ChatPanel Component
 *
 * A complete chat interface that combines overlay positioning, resize/drag functionality,
 * and chat components into a single unified component. Features:
 *
 * - Fixed overlay positioning with high z-index
 * - Resizable width (300-800px) with left edge drag handle
 * - Draggable positioning by header
 * - 85% viewport height, vertically centered
 * - Shadow DOM isolation
 * - Keyboard accessibility (Escape to close)
 * - Chat functionality with message history and AI responses
 * - Centralized error management
 *
 * @example
 * ```tsx
 * <ChatPanel onClose={() => unmountSidebar()} />
 * ```
 */
export const ChatPanel: React.FC<ChatPanelProps> = ({
  className,
  onClose,
  initialSelectedText,
}) => {
  const { addError } = useError();

  // Helper function to show errors/warnings/info using the error context
  const showError = useCallback(
    (message: string, type: 'error' | 'warning' | 'info' = 'error') => {
      addError({ message, type, source: 'chat' as const, dismissible: true });
    },
    [addError]
  );

  // Store selected text for potential use (but don't show notification)
  useEffect(() => {
    if (initialSelectedText) {
      // Store the selected text for context without showing a notification
      // This could be used to:
      // 1. Pre-fill the input field
      // 2. Add as context to the first message
      // 3. Store in a ref for later use
      // For now, we just preserve it without any UI notification
    }
  }, [initialSelectedText]);

  // Use custom hook for sidebar positioning
  const {
    position,
    isDragging,
    width,
    sidebarHeight,
    handleHeaderMouseDown,
    handleResizeMouseDown,
  } = useSidebarPosition();

  // Settings store integration
  const selectedModel = useSettingsStore(state => state.settings.selectedModel);
  const updateSelectedModel = useSettingsStore(state => state.updateSelectedModel);
  const getProviderTypeForModel = useSettingsStore(state => state.getProviderTypeForModel);
  const loadSettings = useSettingsStore(state => state.loadSettings);
  const screenshotHotkey = useSettingsStore(state => state.settings.ui?.screenshotHotkey);
  const [settingsInitialized, setSettingsInitialized] = useState(false);

  // Load settings on mount and track when they're ready
  useEffect(() => {
    loadSettings()
      .then(() => {
        setSettingsInitialized(true);
      })
      .catch((_error: unknown) => {
        // Still initialize even if settings fail to load
        // This allows the app to work with default settings
        setSettingsInitialized(true);
      });

    // Fallback timeout to ensure we don't get stuck on loading screen
    const timeout = setTimeout(() => {
      // Silently proceed with defaults after timeout
      setSettingsInitialized(true);
    }, 3000); // 3 second timeout

    return () => clearTimeout(timeout);
  }, [loadSettings]);

  // Dark theme is applied by default via CSS variables

  // Session management - initializes session based on tab+URL
  useSessionManager(); // Initialize session manager for side effects

  // Chat store and AI chat integration
  const sessionStore = useSessionStore();
  const messageStore = useMessageStore();
  const tabStore = useTabStore();
  const uiStore = useUIStore();

  const messages = messageStore.getMessages();
  const isLoading = uiStore.isLoading();
  const clearCurrentSession = sessionStore.clearCurrentSession;
  const hasMessages = messageStore.hasMessages;
  const editMessage = messageStore.editMessage;
  const getPreviousUserMessage = messageStore.getPreviousUserMessage;
  const removeMessageAndAfter = messageStore.removeMessageAndAfter;
  const updateMessage = messageStore.updateMessage;
  const updateTabContent = tabStore.updateTabContent;
  const { sendMessage, switchProvider, cancelMessage, isStreaming } = useAIChat({
    enabled: true,
    autoInitialize: true, // Auto-initialize providers from settings
  });

  // Note: Session manager automatically switches to appropriate session on mount
  // No need to clear conversation anymore - each tab+URL has its own session

  // Tab extraction integration (handles both current tab and additional tabs)
  const {
    currentTabContent,
    currentTabId,
    loadedTabs,
    availableTabs,
    extractCurrentTab,
    extractTabById,
    removeLoadedTab,
    loading: tabExtractionLoading,
    error: tabExtractionError,
  } = useTabExtraction();

  // Keep a local copy of the current tab's TabInfo (to get real favIconUrl)
  const [currentTabInfo, setCurrentTabInfo] = useState<{
    favIconUrl?: string;
    url?: string;
    title?: string;
    domain?: string;
  } | null>(null);

  // When currentTabId is known, fetch full tab list once and extract current tab's info
  useEffect(() => {
    let didCancel = false;
    (async () => {
      if (!currentTabId) return;
      try {
        const { createExtractionService } = await import('@services/extraction/ExtractionService');
        const tabs = await createExtractionService('sidebar').getAllTabs();
        const ct = Array.isArray(tabs) ? tabs.find(t => t.id === currentTabId) : undefined;
        if (!didCancel && ct) {
          setCurrentTabInfo({
            favIconUrl: ct.favIconUrl,
            url: ct.url,
            title: ct.title,
            domain: ct.domain,
          });
        }
      } catch {
        // Ignore failures; fallback logic will handle icons
      }
    })();
    return () => {
      didCancel = true;
    };
  }, [currentTabId]);

  // Settings panel state
  const [showSettings, setShowSettings] = useState(false);

  // Use screenshot capture hook
  const {
    screenshotPreview,
    showScreenshotPreview,
    handleSystemClipboardCapture,
    handleUseScreenshot,
    handleCloseScreenshotPreview,
  } = useScreenshotCapture(currentTabId, {
    onError: showError,
    onOpenSettings: () => setShowSettings(true),
  });

  // Use message editing hook
  const messageEditingHook = useMessageEditing({
    messages,
    editMessage,
    updateMessage,
    sendMessage,
  });
  const { editingMessage, handleEditMessage, handleClearEdit } = messageEditingHook;

  // Handle sending messages
  const handleSendMessage = useCallback(
    async (
      userInput: string,
      metadata?: {
        expandedPrompt?: string;
        modelOverride?: string;
        attachments?: Array<{ type: string; data?: string; fileUri?: string; mimeType?: string }>;
      }
    ) => {
      try {
        // Try to handle edited message first
        const handled = await messageEditingHook.handleSendEditedMessage(userInput, metadata);
        if (handled) return;

        // For new messages (exclude pending messages when checking)
        const nonPendingMessages = messages.filter(m => m.status !== 'pending');
        const isFirstMessage = nonPendingMessages.length === 0;
        const { messageContent, displayContent } = prepareMessageContent(userInput, metadata);
        const messageMetadata = buildMessageMetadata(false, {}, metadata);

        // Handle content extraction errors or missing content for first message
        if (isFirstMessage) {
          if (tabExtractionError) {
            // Silently proceed without webpage context if extraction failed
          } else if (!currentTabContent && !tabExtractionLoading) {
            // Silently proceed without webpage context if no content available
          }
        }

        // Send message with content injection for first message or normal content for subsequent messages
        await sendMessage(messageContent, {
          displayContent: displayContent,
          metadata: Object.keys(messageMetadata).length > 0 ? messageMetadata : undefined,
        });
      } catch (error) {
        // Add error to centralized error context
        const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
        addError({
          message: errorMessage,
          type: 'error',
          source: getErrorSource(error instanceof Error ? error : errorMessage),
          dismissible: true,
        });
      }
    },
    [
      sendMessage,
      addError,
      messageEditingHook,
      messages,
      currentTabContent,
      tabExtractionError,
      tabExtractionLoading,
    ]
  );

  // Handle message being queued (show as pending)
  const handleMessageQueued = useCallback(
    (message: string, metadata?: Record<string, unknown>) => {
      // Add message with pending status
      messageStore.addMessage({
        role: 'user',
        content: message,
        status: 'pending',
        metadata,
      });
    },
    [messageStore]
  );

  // Handle clear conversation (now clears only current session)
  const handleClearConversation = useCallback(() => {
    if (hasMessages()) {
      clearCurrentSession();
      handleClearEdit(); // Clear edit mode when clearing conversation
    }
  }, [hasMessages, clearCurrentSession, handleClearEdit]);

  // Handle regenerate message
  const handleRegenerateMessage = useCallback(
    async (message: ChatMessage) => {
      if (message.role !== 'assistant') return;

      // Get the previous user message (to get its content for regeneration)
      const previousUserMessage = getPreviousUserMessage(message.id);
      if (!previousUserMessage) {
        addError({
          message: 'Cannot find the previous user message to regenerate',
          type: 'error',
          source: 'chat',
          dismissible: true,
        });
        return;
      }

      // Remove ONLY the assistant message and all messages after it
      // This keeps the original user message in place
      removeMessageAndAfter(message.id);

      // Send a new AI response without adding a new user message
      try {
        await sendMessage(previousUserMessage.content, {
          skipUserMessage: true, // This prevents adding a duplicate user message
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to regenerate response';
        addError({
          message: errorMessage,
          type: 'error',
          source: getErrorSource(error instanceof Error ? error : errorMessage),
          dismissible: true,
        });
      }
    },
    [getPreviousUserMessage, removeMessageAndAfter, sendMessage, addError]
  );

  // Handle model change
  const handleModelChange = useCallback(
    async (modelId: string): Promise<void> => {
      const result = await switchModel({
        modelId,
        updateSelectedModel,
        switchProvider,
        getProviderTypeForModel,
        onApiKeyMissing: () => setShowSettings(true),
      });

      if (!result.success && result.error && result.error !== 'API key required') {
        showError(`Failed to switch to ${modelId}: ${result.error}`, 'error');
      }
    },
    [updateSelectedModel, switchProvider, getProviderTypeForModel, showError]
  );

  // Tab extraction callback handlers
  const handleRemoveTab = useCallback(
    (tabId: number) => {
      removeLoadedTab(tabId);
    },
    [removeLoadedTab]
  );

  // Handle image paste for providers that support file uploads
  const handleImagePaste = useCallback(
    async (
      file: File,
      options?: { uploadId?: string; previewUrl?: string; mimeType?: string }
    ): Promise<{
      fileUri?: string;
      fileId?: string;
      mimeType: string;
      uploadId?: string;
    } | null> => {
      try {
        const state = useSettingsStore.getState();
        const currentModel = state.settings.selectedModel;
        const currentProvider = state.getProviderTypeForModel(currentModel);

        if (currentProvider !== 'gemini' && currentProvider !== 'openai') {
          showError(
            'Image attachments are currently available only for OpenAI and Gemini models.',
            'info'
          );
          return null;
        }

        const apiKey =
          currentProvider === 'gemini'
            ? state.settings.apiKeys.google
            : state.settings.apiKeys.openai;

        if (!apiKey) {
          throw new Error(`${currentProvider} API key is required for file upload`);
        }

        // Use unified image upload service
        // Always registers with queue to get upload ID for tracking
        const result = await uploadImageUnified(
          { file },
          {
            apiKey,
            model: currentModel,
            provider: currentProvider,
            source: 'paste',
            uploadId: options?.uploadId,
          }
        );

        if (!result) {
          return null;
        }

        // Return in the format expected by ChatInput (including uploadId from queue registration)
        return {
          fileUri: result.fileUri,
          fileId: result.fileId,
          mimeType: result.mimeType,
          uploadId: result.uploadId ?? options?.uploadId,
        };
      } catch (error) {
        showError(error instanceof Error ? error.message : 'Failed to upload image');
        return null;
      }
    },
    [showError]
  );

  const handleReextractTab = useCallback(
    (tabId: number, options?: { mode?: ExtractionMode }) => {
      // Re-extract tab content
      extractTabById(tabId, options);
    },
    [extractTabById]
  );

  // Add a new tab via @ mention selection
  const handleAddTab = useCallback(
    (tabId: number) => {
      extractTabById(tabId);
    },
    [extractTabById]
  );

  const handleClearTabContent = useCallback(
    (tabId: number) => {
      removeLoadedTab(tabId);
    },
    [removeLoadedTab]
  );

  // Handle content edit callback - directly update store
  const handleContentEdit = useCallback(
    (tabId: number | string, editedContent: string) => {
      if (typeof tabId === 'number') {
        updateTabContent(tabId, editedContent);
      }
    },
    [updateTabContent]
  );

  // Window resize handling is now managed by useSidebarPosition hook

  // Handle close functionality
  const handleClose = useCallback(() => {
    unmountSidebar();
    // sendMessage({ type: 'sidebar-closed' }); // TODO: Implement proper sidebar closed message
    onClose();
  }, [onClose]);

  // Cleanup is handled by useAIChat hook internally
  // No need for additional cleanup here

  // Handle Escape key to cancel streaming or close sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Use empty hotkey if settings not loaded yet
      const hotkey = screenshotHotkey || {
        enabled: true,
        modifiers: [],
        key: '',
      };

      if (isSystemCaptureHotkey(e, hotkey)) {
        if (!e.repeat) {
          handleSystemClipboardCapture();
        }
        return;
      }

      if (e.key === 'Escape') {
        // Don't close if the dropdown handled the event or if dropdown is visible
        if (e.defaultPrevented) return;

        // Check if dropdown is open by looking for the element
        const dropdown = document.querySelector('.tab-mention-dropdown');
        if (dropdown) return;

        // If streaming, cancel the stream instead of closing
        if (isStreaming()) {
          cancelMessage();
          return;
        }

        // Otherwise close the sidebar
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleClose, isStreaming, cancelMessage, handleSystemClipboardCapture, screenshotHotkey]);

  // Set tabindex for keyboard navigation but don't auto-focus to preserve selection
  useEffect(() => {
    const sidebar = document.querySelector('.ai-sidebar-container') as HTMLElement;
    if (sidebar) {
      sidebar.setAttribute('tabindex', '-1');
      // Don't auto-focus to preserve text selection on the page
      // sidebar.focus(); // Removed to preserve selection
    }
  }, []);

  // Sidebar unmount: do NOT clear chat/session state so history persists across toggles.
  // Optionally inform background to clear extraction cache without touching in-memory store.
  useEffect(() => {
    return () => {
      try {
        const loadedTabIds = useTabStore.getState().getLoadedTabIds();

        if (loadedTabIds.length > 0) {
          const cleanupMessage = createMessage({
            type: 'CLEANUP_TAB_CACHE',
            payload: { tabIds: loadedTabIds },
            source: 'sidebar',
            target: 'background',
          }) as CleanupTabCacheMessage;

          sendRuntimeMessage(cleanupMessage).catch(() => {
            // Ignore errors during unmount cleanup
          });
        }
      } catch {
        // Ignore cleanup errors on unmount
      }
    };
  }, []);

  // Header and resize handlers are now managed by useSidebarPosition hook

  // Show loading spinner while settings are being loaded
  if (!settingsInitialized) {
    return (
      <div
        className={`ai-sidebar-container ai-sidebar-container--loading ${className || ''}`}
        role="dialog"
        aria-label="AI Browser Sidebar Loading"
        aria-modal="false"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: `${width}px`,
          height: `${sidebarHeight}px`,
        }}
        data-testid="chat-panel-loading"
      >
        <div className="ai-sidebar-loading-icon">⌛</div>
        <div>Loading settings...</div>
      </div>
    );
  }

  return (
    <div
      className={`ai-sidebar-container ${className || ''}`}
      role="dialog"
      aria-label="AI Browser Sidebar"
      aria-modal="false"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${width}px`,
        height: `${sidebarHeight}px`,
      }}
      data-testid="chat-panel"
    >
      <Header
        selectedModel={selectedModel}
        onModelChange={handleModelChange}
        isLoading={isLoading}
        hasMessages={hasMessages()}
        onClearConversation={handleClearConversation}
        onToggleSettings={() => setShowSettings(!showSettings)}
        onClose={handleClose}
        onMouseDown={handleHeaderMouseDown}
        isDragging={isDragging}
        extractedContent={currentTabContent}
        contentLoading={tabExtractionLoading}
        contentError={tabExtractionError}
      />

      {/* Centralized Error Banner */}
      <ErrorBanner />

      {/* Content Extraction Preview - Only render if there's actual content or loading/error state */}
      {shouldShowContentPreview(
        currentTabContent,
        loadedTabs,
        tabExtractionLoading,
        tabExtractionError
      ) &&
        (isMultiTabMode(currentTabContent, loadedTabs) ? (
          // Multi-tab mode: show ContentPreview
          <ContentPreview
            currentTabContent={
              currentTabContent && currentTabId
                ? {
                    tabInfo: {
                      id: currentTabId,
                      title: currentTabInfo?.title || currentTabContent.title || 'Current Tab',
                      url: currentTabInfo?.url || currentTabContent.url || '',
                      domain:
                        currentTabInfo?.domain ||
                        currentTabContent.domain ||
                        (currentTabContent.url
                          ? new URL(currentTabContent.url).hostname
                          : 'example.com'),
                      favIconUrl: currentTabInfo?.favIconUrl,
                      windowId: 0,
                      active: true,
                      index: 0,
                      pinned: false,
                      lastAccessed: currentTabContent.extractedAt || Date.now(),
                    },
                    extractedContent: currentTabContent,
                    extractionStatus: tabExtractionLoading ? 'extracting' : 'completed',
                    isStale: false,
                  }
                : null
            }
            additionalTabsContent={filterAdditionalTabs(loadedTabs, currentTabId)}
            onRemoveTab={handleRemoveTab}
            onReextractTab={handleReextractTab}
            onClearTabContent={handleClearTabContent}
            onContentEdit={handleContentEdit}
            className="ai-sidebar-content-preview"
          />
        ) : (
          // Fallback to single-tab mode: show TabContentItem only if there's loading/error state
          <TabContentItem
            content={currentTabContent}
            loading={tabExtractionLoading}
            error={tabExtractionError}
            onContentEdit={handleContentEdit}
            onReextract={options => extractCurrentTab(options)}
            onClearContent={() => currentTabId && removeLoadedTab(currentTabId)}
            className="tab-content-preview-item"
            // Get tabInfo from loadedTabs if current tab is loaded
            tabInfo={
              currentTabId && loadedTabs[currentTabId]
                ? loadedTabs[currentTabId].tabInfo
                : undefined
            }
          />
        ))}

      {showScreenshotPreview && (
        <ScreenshotPreview
          screenshot={screenshotPreview}
          onClose={handleCloseScreenshotPreview}
          onUseImage={handleUseScreenshot}
        />
      )}

      {showSettings ? (
        <div className="ai-sidebar-settings-panel">
          <Settings />
        </div>
      ) : (
        <Body
          messages={messages}
          isLoading={isLoading}
          emptyMessage=""
          height="calc(100% - 60px - 70px)"
          onEditMessage={handleEditMessage}
          onRegenerateMessage={handleRegenerateMessage}
        />
      )}

      <Footer
        onSend={handleSendMessage}
        onMessageQueued={handleMessageQueued}
        onCancel={cancelMessage}
        loading={isLoading}
        editingMessage={editingMessage?.content}
        onClearEdit={handleClearEdit}
        availableTabs={availableTabs}
        loadedTabs={loadedTabs}
        onImagePaste={handleImagePaste}
        onTabRemove={handleRemoveTab}
        onMentionSelectTab={handleAddTab}
      />
      {/* Resize handles placed inside the container */}
      <ResizeHandles onMouseDown={handleResizeMouseDown} />
    </div>
  );
};

export default ChatPanel;
