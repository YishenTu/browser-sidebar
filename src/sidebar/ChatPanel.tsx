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
import type { ImageExtractedContent } from '@/types/extraction';
import { ContentPreview } from '@components/ContentPreview';
import { ScreenshotPreview, type ScreenshotPreviewData } from '@components/ScreenshotPreview';
import { createMessage, type CleanupTabCacheMessage } from '@/types/messages';
import { uploadFileToGemini } from '@/core/ai/gemini/fileUpload';
import { uploadFileToOpenAI } from '@/core/ai/openai/fileUpload';
import type { GeminiConfig, OpenAIConfig } from '@/types/providers';
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

const loadImageDimensions = (src: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    if (typeof Image === 'undefined') {
      resolve({ width: 0, height: 0 });
      return;
    }
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      reject(new Error('Failed to decode screenshot image'));
    };
    image.src = src;
  });
};

const SYSTEM_CAPTURE_HIDE_DELAY_MS = 600;
const CLIPBOARD_POLL_ATTEMPTS = 6;
const CLIPBOARD_POLL_INTERVAL_MS = 200;

interface ClipboardImageResult {
  dataUrl: string;
  width: number;
  height: number;
}

const blobToDataUrl = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read clipboard image'));
    reader.readAsDataURL(blob);
  });
};

const tryReadClipboardImage = async (): Promise<ClipboardImageResult | null> => {
  if (!navigator.clipboard || typeof navigator.clipboard.read !== 'function') {
    throw new Error('Clipboard read is not supported in this browser');
  }

  const items = await navigator.clipboard.read();
  for (const item of items) {
    const imageType = item.types.find(type => type.startsWith('image/'));
    if (!imageType) continue;

    const blob = await item.getType(imageType);
    const dataUrl = await blobToDataUrl(blob);
    const { width, height } = await loadImageDimensions(dataUrl);

    return {
      dataUrl,
      width,
      height,
    };
  }

  return null;
};

const readClipboardImageWithRetries = async (
  attempts: number,
  intervalMs: number
): Promise<ClipboardImageResult | null> => {
  for (let i = 0; i < attempts; i += 1) {
    const image = await tryReadClipboardImage();
    if (image) {
      return image;
    }

    if (i < attempts - 1) {
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
  }

  return null;
};

const isSystemCaptureHotkey = (
  event: KeyboardEvent,
  hotkey: { enabled: boolean; modifiers: string[]; key: string }
): boolean => {
  if (!hotkey.enabled || !hotkey.key) {
    return false;
  }

  // Check if all required modifiers are pressed
  const modifiersMatch =
    (!hotkey.modifiers.includes('ctrl') || event.ctrlKey) &&
    (!hotkey.modifiers.includes('alt') || event.altKey) &&
    (!hotkey.modifiers.includes('shift') || event.shiftKey) &&
    (!hotkey.modifiers.includes('meta') || event.metaKey) &&
    // Also check that ONLY the required modifiers are pressed
    hotkey.modifiers.includes('ctrl') === event.ctrlKey &&
    hotkey.modifiers.includes('alt') === event.altKey &&
    hotkey.modifiers.includes('shift') === event.shiftKey &&
    hotkey.modifiers.includes('meta') === event.metaKey;

  if (!modifiersMatch) {
    return false;
  }

  // Check if the key matches (case-insensitive)
  const pressedKey = event.key.toLowerCase();
  const configuredKey = hotkey.key.toLowerCase();

  // Handle both event.key and event.code for better compatibility
  if (pressedKey === configuredKey) {
    return true;
  }

  // Handle digit keys generically - if configured key is a digit, check the code
  if (configuredKey.match(/^[0-9]$/)) {
    const digitCode = `Digit${configuredKey}`;
    const numpadCode = `Numpad${configuredKey}`;
    if (event.code === digitCode || event.code === numpadCode) {
      return true;
    }
  }

  // Handle function keys (F1-F12)
  if (configuredKey.match(/^f([1-9]|1[0-2])$/i)) {
    if (event.code.toLowerCase() === configuredKey.toLowerCase()) {
      return true;
    }
  }

  return false;
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

  // Edit mode state
  const [editingMessage, setEditingMessage] = useState<{ id: string; content: string } | null>(
    null
  );
  const [showScreenshotPreview, setShowScreenshotPreview] = useState(false);
  const [screenshotPreview, setScreenshotPreview] = useState<ScreenshotPreviewData | null>(null);
  const [, setScreenshotError] = useState<string | null>(null);
  const [, setIsCapturingScreenshot] = useState(false);
  const systemCaptureInProgressRef = useRef(false);

  const handleCloseScreenshotPreview = useCallback(() => {
    setScreenshotPreview(null);
    setScreenshotError(null);
    setShowScreenshotPreview(false);
    setIsCapturingScreenshot(false);
  }, []);

  const handleUseScreenshot = useCallback(async () => {
    if (!screenshotPreview?.dataUrl) {
      showError('No screenshot available to use');
      return;
    }

    if (!currentTabId) {
      showError('No active tab available for attaching the image');
      return;
    }

    const tabId = currentTabId;
    const existingTab = tabStore.getTabContent(tabId);
    const previousContent = existingTab?.extractedContent?.content;

    // Close the preview window immediately
    handleCloseScreenshotPreview();

    // Optimistically switch to image mode while upload is in progress
    const optimisticImageContent: ImageExtractedContent = {
      type: 'image',
      mimeType: 'image/png',
      dataUrl: screenshotPreview.dataUrl,
      uploadState: 'uploading',
    };
    tabStore.updateTabContent(tabId, optimisticImageContent);

    try {
      // Convert data URL to blob
      const response = await fetch(screenshotPreview.dataUrl);
      const blob = await response.blob();
      const file = new File([blob], `screenshot_${Date.now()}.png`, { type: 'image/png' });

      // Check current provider
      const state = useSettingsStore.getState();
      const currentModel = state.settings.selectedModel;
      const currentProvider = state.getProviderTypeForModel(currentModel);

      let imageReference: { fileUri?: string; fileId?: string; mimeType: string } | null = null;

      if (currentProvider === 'gemini') {
        const apiKey = state.settings.apiKeys.google;
        if (!apiKey) {
          setShowSettings(true);
          throw new Error('Gemini API key is required for screenshot upload');
        }

        const geminiConfig: GeminiConfig = {
          apiKey,
          model: currentModel,
        };

        const metadata = await uploadFileToGemini(file, geminiConfig, {
          displayName: `Screenshot_${Date.now()}`,
          mimeType: 'image/png',
        });

        imageReference = {
          fileUri: metadata.uri,
          mimeType: 'image/png',
        };
      } else if (currentProvider === 'openai') {
        const apiKey = state.settings.apiKeys.openai;
        if (!apiKey) {
          setShowSettings(true);
          throw new Error('OpenAI API key is required for screenshot upload');
        }

        const openaiConfig: OpenAIConfig = {
          apiKey,
          model: currentModel,
        };

        const metadata = await uploadFileToOpenAI(file, openaiConfig, {
          fileName: `screenshot_${Date.now()}.png`,
          purpose: 'vision',
        });

        imageReference = {
          fileId: metadata.id,
          mimeType: 'image/png',
        };
      } else {
        throw new Error(`Screenshot upload is not supported for ${currentProvider} provider`);
      }

      if (!imageReference) {
        throw new Error('Unable to create image reference for screenshot');
      }

      // Replace current tab's content with the final image reference
      const finalImageContent: ImageExtractedContent = {
        type: 'image',
        fileUri: imageReference.fileUri,
        fileId: imageReference.fileId,
        mimeType: imageReference.mimeType,
        dataUrl: screenshotPreview.dataUrl,
        uploadState: 'ready',
      };

      tabStore.updateTabContent(tabId, finalImageContent);

      // Test the formatter with the updated content (best-effort)
      try {
        const { formatTabContent } = await import('@services/chat/contentFormatter');
        const currentTabContentObj = tabStore.getTabContent(tabId);
        if (currentTabContentObj) {
          const testTabContent = {
            ...currentTabContentObj,
            extractedContent: {
              ...currentTabContentObj.extractedContent,
              content: finalImageContent,
            },
          };
          formatTabContent('', [testTabContent]);
        }
      } catch (formatError) {
        console.warn('Screenshot formatter verification failed', formatError);
      }
    } catch (error) {
      // Revert to previous content on failure
      if (previousContent !== undefined) {
        tabStore.updateTabContent(tabId, previousContent as string | ImageExtractedContent);
      } else {
        tabStore.updateTabContent(tabId, '');
      }

      showError(error instanceof Error ? error.message : 'Failed to upload screenshot', 'error');
    }
  }, [screenshotPreview, currentTabId, showError, handleCloseScreenshotPreview, tabStore]);

  const handleSystemClipboardCapture = useCallback(async () => {
    if (systemCaptureInProgressRef.current) {
      return;
    }

    const clipboardSupported = Boolean(
      typeof navigator !== 'undefined' &&
        navigator.clipboard &&
        typeof navigator.clipboard.read === 'function'
    );

    if (!clipboardSupported) {
      const message = 'Clipboard image access is not available in this browser.';
      setScreenshotError(message);
      setScreenshotPreview(null);
      setShowScreenshotPreview(true);
      showError(message);
      return;
    }

    systemCaptureInProgressRef.current = true;

    const captureStart = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const host = document.getElementById('ai-browser-sidebar-host');
    const previousVisibility = host?.style.visibility;
    const previousPointerEvents = host?.style.pointerEvents;

    setScreenshotError(null);
    setScreenshotPreview(null);
    setShowScreenshotPreview(true);
    setIsCapturingScreenshot(true);

    if (host) {
      host.style.visibility = 'hidden';
      host.style.pointerEvents = 'none';
    }

    try {
      await new Promise(resolve => setTimeout(resolve, SYSTEM_CAPTURE_HIDE_DELAY_MS));

      const clipboardImage = await readClipboardImageWithRetries(
        CLIPBOARD_POLL_ATTEMPTS,
        CLIPBOARD_POLL_INTERVAL_MS
      );

      if (!clipboardImage) {
        throw new Error(
          'No screenshot found in the clipboard. Press Option+Shift+2 to capture and ensure the screenshot copies to the clipboard.'
        );
      }

      const captureDuration =
        (typeof performance !== 'undefined' ? performance.now() : Date.now()) - captureStart;

      const resolvedWidth =
        clipboardImage.width || (typeof window !== 'undefined' ? window.innerWidth : 0);
      const resolvedHeight =
        clipboardImage.height || (typeof window !== 'undefined' ? window.innerHeight : 0);

      setScreenshotPreview({
        dataUrl: clipboardImage.dataUrl,
        width: resolvedWidth,
        height: resolvedHeight,
        capturedAt: Date.now(),
        durationMs: captureDuration,
        captureMethod: 'system-shortcut',
        captureBeyondViewport: undefined,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to read screenshot from clipboard';
      setScreenshotError(message);
      showError(`Screenshot failed: ${message}`);
    } finally {
      if (host) {
        host.style.visibility = previousVisibility ?? '';
        host.style.pointerEvents = previousPointerEvents ?? '';
      }
      setIsCapturingScreenshot(false);
      systemCaptureInProgressRef.current = false;
    }
  }, [showError]);

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
            // Check if this is the first user message in the conversation
            // If it is, we need to re-inject tab content
            const userMessages = messages.filter(m => m.role === 'user');
            isFirstMessage = userMessages.length > 0 && userMessages[0]?.id === editingMessage.id;
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
              // Include attachments if provided
              ...(metadata?.attachments ? { attachments: metadata.attachments } : {}),
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
          // For the first message, don't update content here - let useMessageHandler handle it
          // This ensures tab content injection happens properly
          if (isFirstMessage) {
            // Update status and displayContent immediately for UI feedback
            // Let sendMessage handle content with tab injection
            updateMessage(editingMessage.id, {
              displayContent: displayContent,
              status: 'sending',
            });
          } else {
            // For non-first messages, update normally
            updateMessage(editingMessage.id, {
              content: messageContent,
              displayContent: displayContent,
              status: 'sending',
              metadata: Object.keys(messageMetadata).length > 0 ? messageMetadata : undefined,
            });
          }

          // Send message without creating a duplicate user message
          // For first message, pass the raw user input so it can be formatted with tabs
          await sendMessage(isFirstMessage ? userInput : messageContent, {
            skipUserMessage: true, // Prevent duplicate user message
            displayContent: displayContent,
            metadata: Object.keys(messageMetadata).length > 0 ? messageMetadata : undefined,
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
      // For slash commands, always use the displayContent (which shows the slash command)
      // For regular messages with tab context, use originalUserContent
      // Otherwise use displayContent or content
      let editContent: string;

      if (message.metadata?.['usedSlashCommand'] && message.displayContent) {
        // If a slash command was used, show the slash command text
        editContent = message.displayContent;
      } else if (message.metadata?.originalUserContent) {
        // For messages with tab context, use the original user input
        editContent = message.metadata.originalUserContent;
      } else {
        // Default to displayContent or content
        editContent = message.displayContent || message.content;
      }

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

  // Handle image paste for providers that support file uploads
  const handleImagePaste = useCallback(
    async (file: File): Promise<{ fileUri?: string; fileId?: string; mimeType: string } | null> => {
      try {
        // Check if current provider is Gemini
        const state = useSettingsStore.getState();
        const currentModel = state.settings.selectedModel;
        const currentProvider = state.getProviderTypeForModel(currentModel);

        if (currentProvider === 'gemini') {
          // Get Gemini config from API keys
          const apiKey = state.settings.apiKeys.google;
          if (!apiKey) {
            throw new Error('Gemini API key is required for file upload');
          }

          const geminiConfig: GeminiConfig = {
            apiKey,
            model: currentModel,
          };

          const metadata = await uploadFileToGemini(file, geminiConfig, {
            displayName: `Image_${Date.now()}`,
            mimeType: file.type,
          });

          return {
            fileUri: metadata.uri,
            mimeType: file.type,
          };
        }

        if (currentProvider === 'openai') {
          const apiKey = state.settings.apiKeys.openai;
          if (!apiKey) {
            throw new Error('OpenAI API key is required for file upload');
          }

          const openaiConfig: OpenAIConfig = {
            apiKey,
            model: currentModel,
          };

          const metadata = await uploadFileToOpenAI(file, openaiConfig, {
            fileName: file.name || `image_${Date.now()}`,
            purpose: 'vision',
          });

          return {
            fileId: metadata.id, // OpenAI uses fileId, not fileUri
            mimeType: file.type,
          };
        }

        // For other providers without upload support, return null so UI removes attachment
        return null;
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
