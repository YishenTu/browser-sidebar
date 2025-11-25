/**
 * @file Screenshot capture hook
 * Custom React hook for handling screenshot capture and clipboard operations
 */

import { useState, useCallback, useRef } from 'react';
import {
  SYSTEM_CAPTURE_HIDE_DELAY_MS,
  CLIPBOARD_POLL_ATTEMPTS,
  CLIPBOARD_POLL_INTERVAL_MS,
  readClipboardImageWithRetries,
} from '@core/utils/screenshot';
import { uploadImage } from '@core/services/imageUploadService';
import { createFinalImageContent } from '@core/services/tabContent';
import type { ImageExtractedContent } from '@/types/extraction';
import type { ScreenshotPreviewData } from '@components/ScreenshotPreview';
import type { TabContent } from '@/types/tabs';
import { useSettingsStore } from '@store/settings';
import { useTabStore } from '@store/chat';
import { getTab } from '@platform/chrome/tabs';

export interface UseScreenshotCaptureOptions {
  onError?: (message: string, type?: 'error' | 'warning' | 'info') => void;
  onOpenSettings?: () => void;
}

export interface UseScreenshotCaptureReturn {
  screenshotPreview: ScreenshotPreviewData | null;
  showScreenshotPreview: boolean;
  isCapturingScreenshot: boolean;
  screenshotError: string | null;
  handleSystemClipboardCapture: () => Promise<void>;
  handleUseScreenshot: () => Promise<void>;
  handleCloseScreenshotPreview: () => void;
}

/**
 * Custom hook for screenshot capture functionality
 */
export function useScreenshotCapture(
  currentTabId: number | null,
  options?: UseScreenshotCaptureOptions
): UseScreenshotCaptureReturn {
  const { onError, onOpenSettings } = options || {};
  const [showScreenshotPreview, setShowScreenshotPreview] = useState(false);
  const [screenshotPreview, setScreenshotPreview] = useState<ScreenshotPreviewData | null>(null);
  const [screenshotError, setScreenshotError] = useState<string | null>(null);
  const [isCapturingScreenshot, setIsCapturingScreenshot] = useState(false);
  const systemCaptureInProgressRef = useRef(false);

  const tabStore = useTabStore();

  const handleCloseScreenshotPreview = useCallback(() => {
    setScreenshotPreview(null);
    setScreenshotError(null);
    setShowScreenshotPreview(false);
    setIsCapturingScreenshot(false);
  }, []);

  const handleUseScreenshot = useCallback(async () => {
    if (!screenshotPreview?.dataUrl) {
      onError?.('No screenshot available to use');
      return;
    }

    if (!currentTabId) {
      onError?.('No active tab available for attaching the image');
      return;
    }

    const state = useSettingsStore.getState();
    const currentModel = state.settings.selectedModel;
    const currentProvider = state.getProviderTypeForModel(currentModel);

    if (currentProvider !== 'gemini' && currentProvider !== 'openai') {
      const message = 'Screenshot uploads are only available for OpenAI and Gemini models.';
      setScreenshotError(message);
      onError?.(message);
      return;
    }

    const apiKey =
      currentProvider === 'gemini' ? state.settings.apiKeys.google : state.settings.apiKeys.openai;

    if (!apiKey) {
      onOpenSettings?.();
      throw new Error(`${currentProvider} API key is required for screenshot upload`);
    }

    const tabId = currentTabId;
    const existingTab = tabStore.getTabContent(tabId);
    const previousContent = existingTab?.extractedContent?.content;

    // Close the preview window immediately
    handleCloseScreenshotPreview();

    try {
      // Upload the screenshot with a callback to update tab content BEFORE queue processes
      const uploadResult = await uploadImage(
        { dataUrl: screenshotPreview.dataUrl },
        {
          apiKey,
          model: currentModel,
          provider: currentProvider,
          source: 'screenshot',
          dependencyReason: 'tab-screenshot',
          blockQueue: true,
          onBeforeQueueNotify: async result => {
            // Update tab content BEFORE the queue is notified
            const imageReference = {
              fileUri: result.fileUri,
              fileId: result.fileId,
              mimeType: result.mimeType,
            };
            const finalContent = createFinalImageContent(imageReference, screenshotPreview.dataUrl);

            // Check if tab exists in loaded tabs
            if (existingTab) {
              // Tab exists - update its content
              tabStore.updateTabContent(tabId, finalContent);
            } else {
              // Tab doesn't exist - create it with screenshot as content
              const tabInfo = await getTab(tabId);
              if (!tabInfo) {
                throw new Error('Unable to retrieve tab information');
              }

              const newTabContent: TabContent = {
                tabInfo,
                extractedContent: {
                  content: finalContent,
                  title: tabInfo.title || 'Screenshot',
                  url: tabInfo.url,
                  domain: tabInfo.domain,
                  excerpt: '',
                  textContent: '',
                  extractedAt: Date.now(),
                  extractionMethod: 'raw',
                },
                extractionStatus: 'completed',
              };

              tabStore.addLoadedTab(tabId, newTabContent);
            }

            // Small delay to ensure store update propagates
            await new Promise(resolve => setTimeout(resolve, 10));
          },
        }
      );

      if (!uploadResult) {
        throw new Error('Unable to create image reference for screenshot');
      }

      // Formatter test removed - content is updated in the callback
    } catch (error) {
      // Revert to previous content on failure
      if (existingTab) {
        if (previousContent !== undefined) {
          tabStore.updateTabContent(tabId, previousContent as string | ImageExtractedContent);
        } else {
          tabStore.updateTabContent(tabId, '');
        }
      } else {
        // If tab was newly created, remove it
        tabStore.removeLoadedTab(tabId);
      }

      onError?.(error instanceof Error ? error.message : 'Failed to upload screenshot', 'error');
    }
  }, [
    screenshotPreview,
    currentTabId,
    onError,
    onOpenSettings,
    handleCloseScreenshotPreview,
    tabStore,
  ]);

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
      onError?.(message);
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
      // Wait for sidebar to hide and user to take screenshot
      await new Promise(resolve => setTimeout(resolve, SYSTEM_CAPTURE_HIDE_DELAY_MS * 2));

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
      onError?.(`Screenshot failed: ${message}`);
    } finally {
      if (host) {
        host.style.visibility = previousVisibility ?? '';
        host.style.pointerEvents = previousPointerEvents ?? '';
      }
      setIsCapturingScreenshot(false);
      systemCaptureInProgressRef.current = false;
    }
  }, [onError]);

  return {
    screenshotPreview,
    showScreenshotPreview,
    isCapturingScreenshot,
    screenshotError,
    handleSystemClipboardCapture,
    handleUseScreenshot,
    handleCloseScreenshotPreview,
  };
}
