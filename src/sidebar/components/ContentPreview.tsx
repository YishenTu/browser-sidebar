/**
 * @file Content Preview Component
 *
 * Main container component for displaying extracted content from browser tabs.
 * Handles both single tab and multiple tab scenarios, orchestrating TabContentItem components.
 * Includes warning for excessive tabs and individual tab management controls.
 */

import React from 'react';
import { TabContentItem } from './TabContentItem';
import { Alert } from '@ui/Alert';
import type { TabContent } from '@/types/tabs';
import type { ExtractionMode } from '@/types/extraction';

export interface ContentPreviewProps {
  /** Current tab content (shown first) */
  currentTabContent: TabContent | null;
  /** Additional tabs content */
  additionalTabsContent: TabContent[];
  /** Callback to remove a specific tab by ID */
  onRemoveTab: (tabId: number) => void;
  /** Callback to re-extract content for a specific tab with optional mode */
  onReextractTab: (tabId: number, options?: { mode?: ExtractionMode }) => void;
  /** Callback to clear content for a specific tab */
  onClearTabContent: (tabId: number) => void;
  /** Callback when content is edited */
  onContentEdit?: (tabId: number | string, editedContent: string) => void;
  /** Custom CSS class */
  className?: string;
}

/**
 * Content Preview Component
 *
 * Main component for displaying content from browser tabs:
 * - Orchestrates TabContentItem components for each tab
 * - Current tab content at the top (if available)
 * - Additional tabs below with same styling
 * - Warnings and controls for managing multiple tabs
 * - Individual loading/error states per tab
 */
export const ContentPreview: React.FC<ContentPreviewProps> = ({
  currentTabContent,
  additionalTabsContent,
  onRemoveTab: _onRemoveTab,
  onReextractTab,
  onClearTabContent,
  onContentEdit,
  className = '',
}) => {
  const totalTabs = (currentTabContent ? 1 : 0) + additionalTabsContent.length;
  const hasExcessiveTabs = totalTabs > 10;

  // If no content at all, don't render anything
  if (!currentTabContent && additionalTabsContent.length === 0) {
    return null;
  }

  return (
    <div className={`tab-content-preview ${className}`}>
      {/* Warning for excessive tabs */}
      {hasExcessiveTabs && (
        <Alert
          type="warning"
          message={`You have ${totalTabs} tabs loaded. Consider reducing the number for better performance.`}
          dismissible={false}
          className="tab-warning"
          showIcon={true}
        />
      )}

      {/* Current tab content */}
      {currentTabContent && (
        <TabContentItem
          content={currentTabContent.extractedContent}
          loading={currentTabContent.extractionStatus === 'extracting'}
          error={
            currentTabContent.extractionStatus === 'failed' && currentTabContent.extractionError
              ? new Error(currentTabContent.extractionError)
              : null
          }
          onReextract={options => {
            onReextractTab(currentTabContent.tabInfo.id, options);
          }}
          onClearContent={() => onClearTabContent(currentTabContent.tabInfo.id)}
          onContentEdit={onContentEdit}
          tabId={currentTabContent.tabInfo.id}
          className="tab-content-preview-item"
        />
      )}

      {/* Additional tabs - styled the same as current tab */}
      {additionalTabsContent.map(tabContent => (
        <TabContentItem
          key={tabContent.tabInfo.id}
          content={tabContent.extractedContent}
          loading={tabContent.extractionStatus === 'extracting'}
          error={
            tabContent.extractionStatus === 'failed' && tabContent.extractionError
              ? new Error(tabContent.extractionError)
              : null
          }
          onReextract={options => onReextractTab(tabContent.tabInfo.id, options)}
          onClearContent={() => onClearTabContent(tabContent.tabInfo.id)}
          onContentEdit={onContentEdit}
          tabId={tabContent.tabInfo.id}
          className="tab-content-preview-item"
        />
      ))}
    </div>
  );
};

export default ContentPreview;
