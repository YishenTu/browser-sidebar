/**
 * @file Multi-Tab Content Preview Component
 *
 * Container component for displaying extracted content from multiple browser tabs.
 * Shows current tab first, followed by additional tabs in collapsible sections.
 * Includes warning for excessive tabs and individual tab management controls.
 */

import React from 'react';
import { ContentPreview } from './ContentPreview';
import { Alert } from '@ui/Alert';
import type { TabContent } from '@/types/tabs';

export interface MultiTabContentPreviewProps {
  /** Current tab content (shown first) */
  currentTabContent: TabContent | null;
  /** Additional tabs content */
  additionalTabsContent: TabContent[];
  /** Callback to remove a specific tab by ID */
  onRemoveTab: (tabId: number) => void;
  /** Callback to re-extract content for a specific tab */
  onReextractTab: (tabId: number) => void;
  /** Callback to clear content for a specific tab */
  onClearTabContent: (tabId: number) => void;
  /** Custom CSS class */
  className?: string;
}

/**
 * Multi-Tab Content Preview Component
 *
 * Displays content from multiple browser tabs in a structured layout:
 * - Current tab content at the top (if available)
 * - Additional tabs in collapsible sections below
 * - Warnings and controls for managing multiple tabs
 * - Individual loading/error states per tab
 */
export const MultiTabContentPreview: React.FC<MultiTabContentPreviewProps> = ({
  currentTabContent,
  additionalTabsContent,
  onRemoveTab,
  onReextractTab,
  onClearTabContent,
  className = '',
}) => {
  const totalTabs = (currentTabContent ? 1 : 0) + additionalTabsContent.length;
  const hasExcessiveTabs = totalTabs > 10;


  // If no content at all, don't render anything
  if (!currentTabContent && additionalTabsContent.length === 0) {
    return null;
  }

  return (
    <div className={`multi-tab-content-preview ${className}`}>
      {/* Warning for excessive tabs */}
      {hasExcessiveTabs && (
        <Alert
          type="warning"
          message={`You have ${totalTabs} tabs loaded. Consider reducing the number for better performance.`}
          dismissible={false}
          className="multi-tab-warning"
          showIcon={true}
        />
      )}


      {/* Current tab content */}
      {currentTabContent && (
        <ContentPreview
          content={currentTabContent.extractedContent}
          loading={currentTabContent.extractionStatus === 'extracting'}
          error={
            currentTabContent.extractionStatus === 'failed' && currentTabContent.extractionError
              ? new Error(currentTabContent.extractionError)
              : null
          }
          onReextract={() => onReextractTab(currentTabContent.tabInfo.id)}
          onClearContent={() => onClearTabContent(currentTabContent.tabInfo.id)}
          tabId={currentTabContent.tabInfo.id}
          className="multi-tab-content-preview-item"
        />
      )}

      {/* Additional tabs - styled the same as current tab */}
      {additionalTabsContent.map((tabContent) => (
        <ContentPreview
          key={tabContent.tabInfo.id}
          content={tabContent.extractedContent}
          loading={tabContent.extractionStatus === 'extracting'}
          error={
            tabContent.extractionStatus === 'failed' && tabContent.extractionError
              ? new Error(tabContent.extractionError)
              : null
          }
          onReextract={() => onReextractTab(tabContent.tabInfo.id)}
          onClearContent={() => onClearTabContent(tabContent.tabInfo.id)}
          tabId={tabContent.tabInfo.id}
          className="multi-tab-content-preview-item"
        />
      ))}
    </div>
  );
};

export default MultiTabContentPreview;