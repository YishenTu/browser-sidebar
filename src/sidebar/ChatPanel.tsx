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
import { ErrorProvider } from '@contexts/ErrorContext';
import { useError } from '@contexts/useError';
import { getErrorSource } from '@contexts/errorUtils';
import { ErrorBanner } from '@components/ErrorBanner';
import { useChatStore, type ChatMessage } from '@store/chat';
import { useAIChat } from '@hooks/useAIChat';
import { useContentExtraction } from '@hooks/useContentExtraction';
import { ContentPreview } from '@components/ContentPreview';
// Import for Task 2.2: Content Injection with Tab ID tracking
import { getCurrentTabIdSafe } from '@tabext/tabUtils';

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
}

/**
 * Inner ChatPanel Component that uses the error context
 */
const ChatPanelInner: React.FC<ChatPanelProps> = ({ className, onClose }) => {
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
      .catch((error: unknown) => {
        console.error('Failed to load settings:', error);
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

  // Chat store and AI chat integration
  const {
    messages,
    isLoading,
    clearConversation,
    hasMessages,
    editMessage,
    getPreviousUserMessage,
    removeMessageAndAfter,
    updateMessage,
  } = useChatStore();
  const { sendMessage, switchProvider, cancelMessage } = useAIChat({
    enabled: true,
    autoInitialize: true, // Auto-initialize providers from settings
  });

  // Issue 1 Fix: Clear conversation on component mount to ensure fresh session
  useEffect(() => {
    clearConversation();
  }, [clearConversation]);

  // Content extraction integration
  const {
    content: extractedContent,
    loading: contentLoading,
    error: contentError,
    reextract,
    clearContent,
  } = useContentExtraction(true); // Auto-extract content when sidebar opens

  // Settings panel state
  const [showSettings, setShowSettings] = useState(false);

  // Edit mode state
  const [editingMessage, setEditingMessage] = useState<{ id: string; content: string } | null>(
    null
  );

  // Handle sending messages
  const handleSendMessage = useCallback(
    async (userInput: string) => {
      try {
        let isFirstMessage = false;
        let editedMessageMetadata: any = {};
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

        let messageContent = userInput;
        let displayContent = userInput;
        let messageMetadata: any = wasEditing ? editedMessageMetadata : {};

        // Handle content extraction errors or missing content for first message
        if (isFirstMessage) {
          if (contentError) {
            // Show warning about extraction failure, but allow message to proceed
            showError(
              `Failed to extract webpage content: ${contentError.message}. Your message will be sent without webpage context.`,
              'warning'
            );
          } else if (!extractedContent && !contentLoading) {
            // Show warning about missing content, but allow message to proceed
            showError(
              'No webpage content available. Your message will be sent without webpage context.',
              'warning'
            );
          }
        }

        // Inject content on first message with tab tracking
        if (isFirstMessage && extractedContent) {
          try {
            // Get tab ID for metadata
            const tabId = await getCurrentTabIdSafe();

            // Format content with webpage metadata and user question
            const injectedContent = `I'm looking at a webpage with the following content:

Title: ${extractedContent.title}
URL: ${extractedContent.url}
Domain: ${extractedContent.domain}

Content:
${extractedContent.content}

---
My question: ${userInput}`;

            // Set content for API and displayContent for UI
            messageContent = injectedContent;
            displayContent = userInput; // UI shows only user input

            // Add/update metadata to track injection including tabId
            // For edited messages, preserve existing metadata and update injection-specific fields
            messageMetadata = {
              ...messageMetadata, // Preserve existing metadata
              hasTabContext: true,
              originalUserContent: userInput,
              tabId: tabId,
              tabTitle: extractedContent.title,
              tabUrl: extractedContent.url,
            };
          } catch (tabError) {
            // If tab ID retrieval fails, continue without it but still inject content
            console.warn('Failed to get tab ID for content injection:', tabError);

            const injectedContent = `I'm looking at a webpage with the following content:

Title: ${extractedContent.title}
URL: ${extractedContent.url}
Domain: ${extractedContent.domain}

Content:
${extractedContent.content}

---
My question: ${userInput}`;

            messageContent = injectedContent;
            displayContent = userInput;
            messageMetadata = {
              ...messageMetadata, // Preserve existing metadata
              hasTabContext: true,
              originalUserContent: userInput,
              tabTitle: extractedContent.title,
              tabUrl: extractedContent.url,
            };
          }
        }

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
            streaming: true,
            skipUserMessage: true, // Prevent duplicate user message
          });
        } else {
          // Send message with content injection for first message or normal content for subsequent messages
          await sendMessage(messageContent, {
            streaming: true,
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
      messages.length,
      extractedContent,
      contentError,
      contentLoading,
      showError,
    ]
  );

  // Handle clear conversation
  const handleClearConversation = useCallback(() => {
    if (hasMessages() && window.confirm('Clear conversation? This cannot be undone.')) {
      clearConversation();
      setEditingMessage(null); // Clear edit mode when clearing conversation
    }
  }, [hasMessages, clearConversation]);

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
          streaming: true,
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
        // Get the provider type for this model
        const providerType = getProviderTypeForModel(modelId);

        // Check if the API key exists for this provider
        const settings = useSettingsStore.getState();
        const apiKeys = settings.settings.apiKeys;

        let hasApiKey = false;
        if (providerType === 'openai') {
          hasApiKey = !!apiKeys?.openai;
        } else if (providerType === 'gemini') {
          hasApiKey = !!apiKeys?.google;
        }

        if (!hasApiKey) {
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
          if (providerType) {
            await switchProvider(providerType);
          }
        } catch (switchError) {
          // Rollback: Restore previous model if provider switch failed
          console.error('Provider switch failed, rolling back model selection:', switchError);
          await updateSelectedModel(previousModel);

          // Show error to user
          const errorMsg =
            switchError instanceof Error ? switchError.message : 'Failed to switch provider';
          showError(`Failed to switch to ${modelId}: ${errorMsg}`, 'error');
          throw switchError; // Re-throw to be caught by outer catch
        }
      } catch (err) {
        // Log error but don't show additional alert if we already showed one
        console.warn('Failed to switch model/provider:', err);
      }
    },
    [selectedModel, getProviderTypeForModel, updateSelectedModel, switchProvider, showError]
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
    chrome.runtime.sendMessage({ type: 'sidebar-closed' });
    onClose();
  }, [onClose]);

  // Cleanup is handled by useAIChat hook internally
  // No need for additional cleanup here

  // Handle Escape key to close sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleClose]);

  // Auto-focus sidebar when opened for accessibility
  useEffect(() => {
    const sidebar = document.querySelector('.ai-sidebar-overlay') as HTMLElement;
    if (sidebar) {
      sidebar.setAttribute('tabindex', '-1');
      sidebar.focus();
    }
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
        className={`ai-sidebar-overlay ai-sidebar-container--loading ${className || ''}`}
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
        <div>
          <div className="ai-sidebar-loading-icon">⌛</div>
          <div>Loading settings...</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`ai-sidebar-overlay ${className || ''}`}
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
      <div className="ai-sidebar-container" data-testid="sidebar-container">
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
          extractedContent={extractedContent}
          contentLoading={contentLoading}
          contentError={contentError}
        />

        {/* Centralized Error Banner */}
        <ErrorBanner />

        {/* Content Extraction Preview */}
        <ContentPreview
          content={extractedContent}
          loading={contentLoading}
          error={contentError}
          onReextract={reextract}
          onClearContent={clearContent}
          className="ai-sidebar-content-preview"
        />

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
          placeholder={editingMessage ? 'Edit your message...' : 'Ask about this webpage...'}
          editingMessage={editingMessage?.content}
          onClearEdit={handleClearEdit}
        />
      </div>

      {/* Resize handles placed AFTER the container so they are not covered */}
      <ResizeHandles onMouseDown={handleResizeMouseDown} />
    </div>
  );
};

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
export const ChatPanel: React.FC<ChatPanelProps> = props => {
  return (
    <ErrorProvider>
      <ChatPanelInner {...props} />
    </ErrorProvider>
  );
};

export default ChatPanel;
