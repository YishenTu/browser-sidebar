/**
 * @file Multi-Tab Content Preview Usage Example
 * 
 * Example showing how to integrate the MultiTabContentPreview component
 * with the multi-tab content injection feature.
 */

import React from 'react';
import { MultiTabContentPreview } from './MultiTabContentPreview';
import type { TabContent } from '@/types/tabs';

// Example usage in a parent component (like ChatPanel)
export const MultiTabContentPreviewUsageExample: React.FC = () => {
  // Mock data - in real usage, this would come from useMultiTabExtraction hook
  const currentTabContent: TabContent | null = {
    tabInfo: {
      id: 1,
      title: 'GitHub - Multi-Tab Browser Extension',
      url: 'https://github.com/user/multi-tab-extension',
      domain: 'github.com',
      windowId: 1,
      favIconUrl: 'https://github.com/favicon.ico',
      active: true,
      index: 0,
      pinned: false,
      lastAccessed: Date.now(),
    },
    extractedContent: {
      title: 'GitHub - Multi-Tab Browser Extension',
      content: 'A comprehensive multi-tab content extraction system...',
      url: 'https://github.com/user/multi-tab-extension',
      domain: 'github.com',
      textContent: 'Repository description and documentation...',
      excerpt: 'A comprehensive multi-tab content extraction system for browser extensions.',
    },
    extractionStatus: 'completed',
  };

  const additionalTabsContent: TabContent[] = [
    {
      tabInfo: {
        id: 2,
        title: 'React Documentation',
        url: 'https://react.dev/learn',
        domain: 'react.dev',
        windowId: 1,
        active: false,
        index: 1,
        pinned: false,
        lastAccessed: Date.now() - 1000,
      },
      extractedContent: {
        title: 'React Documentation',
        content: 'Learn React with our comprehensive guide...',
        url: 'https://react.dev/learn',
        domain: 'react.dev',
        textContent: 'Complete documentation for React...',
        excerpt: 'Learn React with our comprehensive guide and examples.',
      },
      extractionStatus: 'completed',
    },
    {
      tabInfo: {
        id: 3,
        title: 'TypeScript Handbook',
        url: 'https://www.typescriptlang.org/docs/',
        domain: 'typescriptlang.org',
        windowId: 1,
        active: false,
        index: 2,
        pinned: false,
        lastAccessed: Date.now() - 2000,
      },
      extractedContent: {
        title: 'TypeScript Handbook',
        content: 'The TypeScript Handbook is a comprehensive guide...',
        url: 'https://www.typescriptlang.org/docs/',
        domain: 'typescriptlang.org',
        textContent: 'TypeScript documentation and tutorials...',
        excerpt: 'The TypeScript Handbook is a comprehensive guide to TypeScript.',
      },
      extractionStatus: 'extracting',
    },
  ];

  const handleRemoveTab = (tabId: number) => {
    // In real usage: dispatch action to remove tab from state
  };

  const handleClearAllTabs = () => {
    // In real usage: dispatch action to clear all tabs
  };

  const handleReextractTab = (tabId: number) => {
    // In real usage: trigger re-extraction for specific tab
  };

  const handleClearTabContent = (tabId: number) => {
    // In real usage: clear content for specific tab
  };

  return (
    <div style={{ padding: '16px', maxWidth: '600px' }}>
      <h2>Multi-Tab Content Preview Example</h2>
      
      <MultiTabContentPreview
        currentTabContent={currentTabContent}
        additionalTabsContent={additionalTabsContent}
        onRemoveTab={handleRemoveTab}
        onClearAllTabs={handleClearAllTabs}
        onReextractTab={handleReextractTab}
        onClearTabContent={handleClearTabContent}
      />
    </div>
  );
};

/* Integration with useMultiTabExtraction hook:

import { useMultiTabExtraction } from '@hooks/useMultiTabExtraction';

export const ChatPanel: React.FC = () => {
  const {
    currentTabContent,
    additionalTabs,
    removeTab,
    clearAllTabs,
    extractTab,
    clearTabContent,
  } = useMultiTabExtraction();

  return (
    <div className="chat-panel">
      <MultiTabContentPreview
        currentTabContent={currentTabContent}
        additionalTabsContent={additionalTabs}
        onRemoveTab={removeTab}
        onClearAllTabs={clearAllTabs}
        onReextractTab={extractTab}
        onClearTabContent={clearTabContent}
      />
    </div>
  );
};

*/