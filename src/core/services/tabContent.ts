/**
 * @file Tab content management service
 * Handles operations related to tab content extraction and updates
 */

import type { ImageExtractedContent, ExtractedContent } from '@/types/extraction';
import type { TabContent } from '@/types/tabs';

export interface TabInfo {
  id?: number;
  title?: string;
  url?: string;
  domain?: string;
  favIconUrl?: string;
  windowId?: number;
  active?: boolean;
  index?: number;
  pinned?: boolean;
  lastAccessed?: number;
}

/**
 * Build tab info object for current tab
 */
export function buildCurrentTabInfo(
  currentTabId: number | null,
  currentTabInfo: Partial<TabInfo> | null,
  currentTabContent: ExtractedContent | null
): TabInfo | undefined {
  if (!currentTabContent || !currentTabId) {
    return undefined;
  }

  return {
    id: currentTabId,
    title: currentTabInfo?.title || currentTabContent.title || 'Current Tab',
    url: currentTabInfo?.url || currentTabContent.url || '',
    domain:
      currentTabInfo?.domain ||
      currentTabContent.domain ||
      (currentTabContent.url ? new URL(currentTabContent.url).hostname : 'example.com'),
    favIconUrl: currentTabInfo?.favIconUrl,
    windowId: 0,
    active: true,
    index: 0,
    pinned: false,
    lastAccessed: currentTabContent.extractedAt || Date.now(),
  };
}

/**
 * Create final image content after successful upload
 */
export function createFinalImageContent(
  imageReference: { fileUri?: string; fileId?: string; mimeType: string },
  dataUrl: string
): ImageExtractedContent {
  return {
    type: 'image',
    fileUri: imageReference.fileUri,
    fileId: imageReference.fileId,
    mimeType: imageReference.mimeType,
    dataUrl,
    uploadState: 'ready',
  };
}

/**
 * Filter additional tabs to exclude current tab
 */
export function filterAdditionalTabs(
  loadedTabs: Record<string, TabContent>,
  currentTabId: number | null
): TabContent[] {
  return Object.entries(loadedTabs)
    .filter(([tabId]) => Number(tabId) !== currentTabId)
    .map(([, tabContent]) => tabContent);
}

/**
 * Check if content preview should be shown
 */
export function shouldShowContentPreview(
  currentTabContent: ExtractedContent | null,
  loadedTabs: Record<string, TabContent>,
  tabExtractionLoading: boolean,
  tabExtractionError: Error | null
): boolean {
  return !!(
    currentTabContent ||
    Object.keys(loadedTabs).length > 0 ||
    tabExtractionLoading ||
    tabExtractionError
  );
}

/**
 * Check if multi-tab mode is active
 */
export function isMultiTabMode(
  currentTabContent: ExtractedContent | null,
  loadedTabs: Record<string, TabContent>
): boolean {
  return !!(currentTabContent || Object.keys(loadedTabs).length > 0);
}
