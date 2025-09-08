/**
 * @file Unified ChatPanel Component
 *
 * Unified component that merges Sidebar.tsx and the existing ChatPanel.tsx functionality.
 * Provides a complete chat interface with overlay positioning, resize/drag capabilities,
 * and Shadow DOM isolation.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDragPosition } from '@hooks/useDragPosition';
import { useResize } from '@hooks/useResize';
import { unmountSidebar } from './index';
import { useSettingsStore } from '@store/settings';
import { useError } from '@contexts/useError';
import { getErrorSource } from '@contexts/errorUtils';
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
import { createMessage, type CleanupTabCacheMessage } from '@/types/messages';
import { sendMessage as sendRuntimeMessage } from '@platform/chrome/runtime';

// Layout components
import { Header } from '@components/layout/Header';
import { Body } from '@components/layout/Body';
import { Footer } from '@components/layout/Footer';
import { ResizeHandles } from '@components/layout/ResizeHandles';

// Settings components
import { Settings } from '@components/Settings/Settings';

// Import sizing constants
import {
  MIN_WIDTH,
  MAX_WIDTH,
  DEFAULT_WIDTH,
  MIN_HEIGHT,
  MAX_HEIGHT,
  getInitialY,
  getSidebarHeight,
  getInitialX,
} from './constants';

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

  // First, create state for size to use in drag bounds
  const [currentSize, setCurrentSize] = useState({
    width: DEFAULT_WIDTH,
    height: getSidebarHeight(),
  });

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

  // Use drag hook for header dragging with DYNAMIC bounds based on current size
  const {
    position,
    isDragging,
    onMouseDown: handleDragMouseDown,
    setPosition,
  } = useDragPosition({
    initialPosition: { x: getInitialX(), y: getInitialY() },
    bounds: {
      minX: 0,
      maxX: window.innerWidth - currentSize.width, // Use current size, not DEFAULT_WIDTH
      minY: 0,
      maxY: window.innerHeight - currentSize.height, // Use current size, not getSidebarHeight()
    },
  });

  // Track the starting position AND size for resize operations
  const resizeStartPositionRef = useRef(position);
  const resizeStartSizeRef = useRef(currentSize);

  // Use resize hook for edge/corner resizing
  const {
    size,
    onMouseDown: createResizeHandler,
    setSize,
  } = useResize({
    initialSize: { width: DEFAULT_WIDTH, height: getSidebarHeight() },
    minSize: { width: MIN_WIDTH, height: MIN_HEIGHT },
    maxSize: { width: MAX_WIDTH, height: MAX_HEIGHT },
    onResizeStart: () => {
      // Save the starting position AND size when resize begins
      resizeStartPositionRef.current = { ...position };
      resizeStartSizeRef.current = { ...size };
    },
    onResize: (newSize, _handle, deltaPosition) => {
      // Update current size for drag bounds
      setCurrentSize(newSize);

      // When resizing from left or top edges, update position to keep opposite edge fixed
      if (deltaPosition) {
        const newPosition = {
          x: resizeStartPositionRef.current.x + deltaPosition.x,
          y: resizeStartPositionRef.current.y + deltaPosition.y,
        };

        // IMPORTANT: Bypass drag bounds during resize by setting position directly
        // The drag bounds are meant for dragging, not resizing
        setPosition(newPosition);
      }
    },
  });

  // Sync size state
  useEffect(() => {
    setCurrentSize(size);
  }, [size]);

  // For compatibility with existing code
  const width = size.width;
  const height = size.height;
  const sidebarHeight = height;

  // Settings store integration
  const selectedModel = useSettingsStore(state => state.settings.selectedModel);
  const updateSelectedModel = useSettingsStore(state => state.updateSelectedModel);
  const getProviderTypeForModel = useSettingsStore(state => state.getProviderTypeForModel);
  const loadSettings = useSettingsStore(state => state.loadSettings);
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

  // Edit mode state
  const [editingMessage, setEditingMessage] = useState<{ id: string; content: string } | null>(
    null
  );

  // Handle sending messages
  const handleSendMessage = useCallback(
    async (userInput: string, metadata?: { expandedPrompt?: string; modelOverride?: string }) => {
      try {
        let isFirstMessage = false;
        let editedMessageMetadata: Record<string, unknown> = {};
        let wasEditing = false;

        // If we're editing, get the metadata from the original message and determine if it's the first message
        if (editingMessage) {
          wasEditing = true;
          const originalMessage = messages.find(msg => msg.id === editingMessage.id);
          if (originalMessage) {
            // Preserve the original metadata structure
            editedMessageMetadata = originalMessage.metadata || {};
            // Determine if this was the first message by checking if it has tab context
            isFirstMessage = !!originalMessage.metadata?.hasTabContext;
          }

          // Remove all messages after the edited one
          editMessage(editingMessage.id);
          // Clear edit mode
          setEditingMessage(null);
        } else {
          // For new messages, check if this is the first message
          isFirstMessage = messages.length === 0;
        }

        // Use expanded prompt if available (from slash commands), otherwise use user input
        const messageContent = metadata?.expandedPrompt || userInput;
        const displayContent = userInput; // Always show original input in UI
        const messageMetadata: Record<string, unknown> = wasEditing
          ? editedMessageMetadata
          : {
              ...metadata,
              // Store that a slash command was used if expanded prompt exists
              usedSlashCommand: !!metadata?.expandedPrompt,
              // Pass model override if provided (from slash commands)
              ...(metadata?.modelOverride ? { modelOverride: metadata.modelOverride } : {}),
            };

        // Handle content extraction errors or missing content for first message
        if (isFirstMessage) {
          if (tabExtractionError) {
            // Silently proceed without webpage context if extraction failed
          } else if (!currentTabContent && !tabExtractionLoading) {
            // Silently proceed without webpage context if no content available
          }
        }

        // Tab extraction system will handle content injection
        // Just pass the user input directly - formatting happens in useMessageHandler
        // The displayContent remains the user input for UI display

        // Issue 2 Fix: Handle editing vs new message properly
        if (wasEditing && editingMessage) {
          // Update the existing message instead of creating a new one
          updateMessage(editingMessage.id, {
            content: messageContent,
            displayContent: displayContent,
            status: 'sending',
            metadata: Object.keys(messageMetadata).length > 0 ? messageMetadata : undefined,
          });

          // Send message without creating a duplicate user message
          await sendMessage(messageContent, {
            skipUserMessage: true, // Prevent duplicate user message
          });
        } else {
          // Send message with content injection for first message or normal content for subsequent messages
          await sendMessage(messageContent, {
            displayContent: displayContent,
            metadata: Object.keys(messageMetadata).length > 0 ? messageMetadata : undefined,
          });
        }
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
      editingMessage,
      editMessage,
      updateMessage,
      messages,
      currentTabContent,
      tabExtractionError,
      tabExtractionLoading,
    ]
  );

  // Handle clear conversation (now clears only current session)
  const handleClearConversation = useCallback(() => {
    if (hasMessages()) {
      clearCurrentSession();
      setEditingMessage(null); // Clear edit mode when clearing conversation
    }
  }, [hasMessages, clearCurrentSession]);

  // Handle edit message
  const handleEditMessage = useCallback((message: ChatMessage) => {
    if (message.role === 'user') {
      // Use original user content for editing, not injected content
      // Priority: metadata.originalUserContent || displayContent || content
      const editContent =
        message.metadata?.originalUserContent || message.displayContent || message.content;
      setEditingMessage({ id: message.id, content: editContent });
    }
  }, []);

  // Handle clear edit
  const handleClearEdit = useCallback(() => {
    setEditingMessage(null);
  }, []);

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
      // Store the previous model for potential rollback
      const previousModel = selectedModel;

      try {
        // Gate by availability list (driven by stored keys + compat providers)
        const state = useSettingsStore.getState();
        const isAvailable = state.settings.availableModels.some(
          m => m.id === modelId && m.available
        );

        if (!isAvailable) {
          // Show settings panel if API key is missing
          setShowSettings(true);
          // User will see the settings panel to add API key
          return;
        }

        // Atomic operation: Try to switch both model and provider
        // If either fails, rollback both
        try {
          // First update the model in settings
          await updateSelectedModel(modelId);

          // Then switch the provider
          const providerType = getProviderTypeForModel(modelId);
          if (providerType) {
            await switchProvider(providerType);
          }

          // Guard: If staying on OpenAI but changing models, clear previous_response_id
          const prevProvider = getProviderTypeForModel(previousModel);
          if (prevProvider === 'openai' && providerType === 'openai' && modelId !== previousModel) {
            // Clear stored response id so the next OpenAI call sends full history
            useUIStore.getState().setLastResponseId(null);
          }
        } catch (switchError) {
          // Rollback: Restore previous model if provider switch failed
          await updateSelectedModel(previousModel);

          // Show error to user
          const errorMsg =
            switchError instanceof Error ? switchError.message : 'Failed to switch provider';
          showError(`Failed to switch to ${modelId}: ${errorMsg}`, 'error');
          throw switchError; // Re-throw to be caught by outer catch
        }
      } catch (err) {
        // Error switching model/provider
      }
    },
    [selectedModel, getProviderTypeForModel, updateSelectedModel, switchProvider, showError]
  );

  // Tab extraction callback handlers
  const handleRemoveTab = useCallback(
    (tabId: number) => {
      removeLoadedTab(tabId);
    },
    [removeLoadedTab]
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

  // Update bounds when window resizes
  useEffect(() => {
    const handleWindowResize = () => {
      // Update position bounds
      setPosition({
        x: Math.min(position.x, window.innerWidth - size.width),
        y: Math.min(position.y, window.innerHeight - size.height),
      });

      // Update size if needed
      setSize({
        width: Math.min(size.width, window.innerWidth),
        height: Math.min(size.height, window.innerHeight * 0.85),
      });
    };

    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [position, size, setPosition, setSize]);

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
  }, [handleClose, isStreaming, cancelMessage]);

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

  // Handle header mouse down for dragging
  const handleHeaderMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only start dragging if not clicking on close button, clear button, or ModelSelector
      const target = e.target as HTMLElement;
      if (
        target.classList.contains('ai-sidebar-close') ||
        target.closest('.ai-sidebar-clear') ||
        target.closest('.model-selector') ||
        target.closest('button')
      ) {
        return;
      }

      handleDragMouseDown(e);
    },
    [handleDragMouseDown]
  );

  // Generic resize mouse down handler for any edge/corner
  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent, dir: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw') => {
      if (isDragging) return;
      const handler = createResizeHandler(dir);
      handler(e);
    },
    [isDragging, createResizeHandler]
  );

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
      {(currentTabContent ||
        Object.keys(loadedTabs).length > 0 ||
        tabExtractionLoading ||
        tabExtractionError) &&
        (currentTabContent || Object.keys(loadedTabs).length > 0 ? (
          // Multi-tab mode: show ContentPreview
          <ContentPreview
            currentTabContent={
              currentTabContent
                ? {
                    tabInfo: {
                      id: currentTabId || 0,
                      title: currentTabInfo?.title || currentTabContent.title || 'Current Tab',
                      url: currentTabInfo?.url || currentTabContent.url || '',
                      domain:
                        currentTabInfo?.domain ||
                        currentTabContent.domain ||
                        new URL(currentTabContent.url || 'https://example.com').hostname,
                      // Prefer actual current tab favicon if available
                      favIconUrl: currentTabInfo?.favIconUrl,
                      windowId: 0, // Required field - using default
                      active: true, // Current tab is active
                      index: 0, // Required field - using default
                      pinned: false, // Required field - using default
                      lastAccessed: currentTabContent.extractedAt || Date.now(),
                    },
                    extractedContent: currentTabContent,
                    extractionStatus: tabExtractionLoading ? 'extracting' : 'completed',
                    isStale: false,
                  }
                : null
            }
            additionalTabsContent={Object.entries(loadedTabs)
              .filter(([tabId]) => Number(tabId) !== currentTabId) // Filter out current tab from additional tabs
              .map(([, tabContent]) => tabContent)}
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
        onCancel={cancelMessage}
        loading={isLoading}
        editingMessage={editingMessage?.content}
        onClearEdit={handleClearEdit}
        availableTabs={availableTabs}
        loadedTabs={loadedTabs}
        onTabRemove={handleRemoveTab}
        onMentionSelectTab={handleAddTab}
      />
      {/* Resize handles placed inside the container */}
      <ResizeHandles onMouseDown={handleResizeMouseDown} />
    </div>
  );
};

export default ChatPanel;
