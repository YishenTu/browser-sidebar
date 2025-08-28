/**
 * @file Visual Regression Tests for MultiTabContentPreview Component
 *
 * Visual snapshot tests for the MultiTabContentPreview component covering:
 * - Different numbers of loaded tabs (1, 3, 5, 10+ tabs)
 * - Loading states for individual tabs
 * - Error states for individual tabs
 * - Warning banners for excessive tabs
 * - Layout integrity with various tab configurations
 * - Tab expansion/collapse states
 * - Content preview integration in various states
 */

import React from 'react';
import { render } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MultiTabContentPreview, MultiTabContentPreviewProps } from '@sidebar/components/MultiTabContentPreview';
import type { TabContent } from '@/types/tabs';
import type { ExtractedContent } from '@/types/extraction';

// Mock external dependencies
vi.mock('@sidebar/components/ContentPreview', () => ({
  ContentPreview: vi.fn(({ content, loading, error, className, tabId }) => (
    <div data-testid="content-preview" className={className} data-tab-id={tabId}>
      {loading && <div data-testid="loading-spinner">Loading...</div>}
      {error && <div data-testid="error-message">{error.message}</div>}
      {content && (
        <div data-testid="content-text">
          <h3>{content.title || 'No Title'}</h3>
          <p>{content.text || 'No content'}</p>
          <div className="content-metadata">
            <span className="word-count">{content.wordCount || 0} words</span>
            <span className="reading-time">{content.readingTime || 0} min read</span>
          </div>
        </div>
      )}
      <div className="content-actions">
        <button data-testid="reextract-button">Re-extract</button>
        <button data-testid="clear-content-button">Clear</button>
      </div>
    </div>
  )),
}));

vi.mock('@ui/Alert', () => ({
  Alert: vi.fn(({ type, message, className, showIcon }) => (
    <div data-testid="alert" className={`alert alert-${type} ${className || ''}`} data-show-icon={showIcon}>
      {showIcon && <span className="alert-icon">⚠</span>}
      <span className="alert-message">{message}</span>
    </div>
  )),
}));

vi.mock('@ui/Spinner', () => ({
  Spinner: vi.fn(({ size, className }) => (
    <div data-testid="spinner" className={`spinner spinner-${size || 'md'} ${className || ''}`}>
      <div className="spinner-circle"></div>
    </div>
  )),
}));

vi.mock('@ui/Icons', () => ({
  CloseIcon: vi.fn(({ size }) => (
    <svg data-testid="close-icon" width={size} height={size} viewBox="0 0 24 24">
      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )),
  WarningIcon: vi.fn(({ size, className }) => (
    <svg data-testid="warning-icon" width={size} height={size} className={className} viewBox="0 0 24 24">
      <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" fill="currentColor"/>
    </svg>
  )),
  Layers: vi.fn(({ size }) => (
    <svg data-testid="layers-icon" width={size} height={size} viewBox="0 0 24 24">
      <path d="M12 2l8 4-8 4-8-4 8-4zM4 12l8 4 8-4M4 16l8 4 8-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

/**
 * Helper to create mock extracted content with realistic data
 */
const createMockExtractedContent = (overrides: Partial<ExtractedContent> = {}): ExtractedContent => ({
  text: 'This is sample extracted content from a webpage. It contains multiple sentences to simulate real content extraction. The content includes various elements like headings, paragraphs, and metadata.',
  markdown: '# Sample Article\n\nThis is sample extracted content from a webpage. It contains multiple sentences to simulate real content extraction.\n\n## Subsection\n\nThe content includes various elements like headings, paragraphs, and metadata.\n\n- List item 1\n- List item 2\n- List item 3',
  title: 'Sample Article Title',
  url: 'https://example.com/article',
  domain: 'example.com',
  timestamp: Date.now(),
  wordCount: 42,
  readingTime: 2,
  language: 'en',
  ...overrides,
});

/**
 * Helper to create mock TabContent with realistic data
 */
const createMockTabContent = (
  tabId: number, 
  overrides: Partial<TabContent> = {}
): TabContent => ({
  tabInfo: {
    id: tabId,
    title: `Test Article ${tabId} - Lorem Ipsum Content`,
    url: `https://example${tabId}.com/article-${tabId}`,
    domain: `example${tabId}.com`,
    windowId: 1,
    active: tabId === 1,
    index: tabId - 1,
    pinned: false,
    lastAccessed: Date.now() - tabId * 1000,
    favIconUrl: `https://example${tabId}.com/favicon.ico`,
  },
  extractedContent: createMockExtractedContent({
    text: `This is extracted content from tab ${tabId}. It contains detailed information about the webpage content and various metadata. The content is rich and includes multiple paragraphs, headings, and other elements that would be found in a typical webpage.`,
    title: `Article ${tabId}: Comprehensive Guide`,
    url: `https://example${tabId}.com/article-${tabId}`,
    domain: `example${tabId}.com`,
    wordCount: 120 + tabId * 10,
    readingTime: Math.ceil((120 + tabId * 10) / 200),
  }),
  extractionStatus: 'completed',
  ...overrides,
});

/**
 * Default props for testing with realistic content
 */
const defaultProps: MultiTabContentPreviewProps = {
  currentTabContent: null,
  additionalTabsContent: [],
  onRemoveTab: vi.fn(),
  onClearAllTabs: vi.fn(),
  onReextractTab: vi.fn(),
  onClearTabContent: vi.fn(),
};

/**
 * Helper to render component with default props and snapshot
 */
const renderAndSnapshot = (props: Partial<MultiTabContentPreviewProps> = {}, description = '') => {
  const { container } = render(<MultiTabContentPreview {...defaultProps} {...props} />);
  expect(container.firstChild).toMatchSnapshot(description);
  return container;
};

describe('MultiTabContentPreview Visual Regression Tests', () => {
  describe('Tab Count Variations', () => {
    it('should match snapshot with no tabs (empty state)', () => {
      renderAndSnapshot(
        {
          currentTabContent: null,
          additionalTabsContent: [],
        },
        'no-tabs-empty-state'
      );
    });

    it('should match snapshot with single current tab only', () => {
      renderAndSnapshot(
        {
          currentTabContent: createMockTabContent(1),
          additionalTabsContent: [],
        },
        'single-current-tab-only'
      );
    });

    it('should match snapshot with 3 total tabs (1 current + 2 additional)', () => {
      renderAndSnapshot(
        {
          currentTabContent: createMockTabContent(1),
          additionalTabsContent: [
            createMockTabContent(2),
            createMockTabContent(3),
          ],
        },
        'three-total-tabs'
      );
    });

    it('should match snapshot with 5 total tabs (1 current + 4 additional)', () => {
      const additionalTabs = Array.from({ length: 4 }, (_, i) => createMockTabContent(i + 2));
      renderAndSnapshot(
        {
          currentTabContent: createMockTabContent(1),
          additionalTabsContent: additionalTabs,
        },
        'five-total-tabs'
      );
    });

    it('should match snapshot with exactly 10 tabs (threshold, no warning)', () => {
      const additionalTabs = Array.from({ length: 9 }, (_, i) => createMockTabContent(i + 2));
      renderAndSnapshot(
        {
          currentTabContent: createMockTabContent(1),
          additionalTabsContent: additionalTabs,
        },
        'ten-total-tabs-no-warning'
      );
    });

    it('should match snapshot with 12 tabs (shows warning banner)', () => {
      const additionalTabs = Array.from({ length: 11 }, (_, i) => createMockTabContent(i + 2));
      renderAndSnapshot(
        {
          currentTabContent: createMockTabContent(1),
          additionalTabsContent: additionalTabs,
        },
        'twelve-tabs-with-warning'
      );
    });

    it('should match snapshot with 20+ tabs (excessive tabs with warning)', () => {
      const additionalTabs = Array.from({ length: 24 }, (_, i) => createMockTabContent(i + 2));
      renderAndSnapshot(
        {
          currentTabContent: createMockTabContent(1),
          additionalTabsContent: additionalTabs,
        },
        'twenty-five-tabs-excessive-with-warning'
      );
    });

    it('should match snapshot with only additional tabs (no current tab)', () => {
      const additionalTabs = Array.from({ length: 3 }, (_, i) => createMockTabContent(i + 1));
      renderAndSnapshot(
        {
          currentTabContent: null,
          additionalTabsContent: additionalTabs,
        },
        'additional-tabs-only-no-current'
      );
    });
  });

  describe('Loading States Visual Tests', () => {
    it('should match snapshot with current tab in loading state', () => {
      const loadingCurrentTab = createMockTabContent(1, {
        extractionStatus: 'extracting',
      });
      
      renderAndSnapshot(
        {
          currentTabContent: loadingCurrentTab,
          additionalTabsContent: [createMockTabContent(2)],
        },
        'current-tab-loading-state'
      );
    });

    it('should match snapshot with multiple tabs in different loading states', () => {
      const loadingTab = createMockTabContent(2, {
        extractionStatus: 'extracting',
      });
      const pendingTab = createMockTabContent(3, {
        extractionStatus: 'pending',
      });
      const completedTab = createMockTabContent(4, {
        extractionStatus: 'completed',
      });

      renderAndSnapshot(
        {
          currentTabContent: createMockTabContent(1),
          additionalTabsContent: [loadingTab, pendingTab, completedTab],
        },
        'mixed-loading-states'
      );
    });

    it('should match snapshot with all tabs in loading state', () => {
      const loadingCurrentTab = createMockTabContent(1, {
        extractionStatus: 'extracting',
      });
      const loadingAdditionalTabs = Array.from({ length: 3 }, (_, i) => 
        createMockTabContent(i + 2, { extractionStatus: 'extracting' })
      );

      renderAndSnapshot(
        {
          currentTabContent: loadingCurrentTab,
          additionalTabsContent: loadingAdditionalTabs,
        },
        'all-tabs-loading-state'
      );
    });

    it('should match snapshot with cached tab state', () => {
      const cachedTab = createMockTabContent(2, {
        extractionStatus: 'cached',
      });

      renderAndSnapshot(
        {
          currentTabContent: createMockTabContent(1),
          additionalTabsContent: [cachedTab],
        },
        'cached-tab-state'
      );
    });

    it('should match snapshot with pending tab state', () => {
      const pendingTab = createMockTabContent(2, {
        extractionStatus: 'pending',
      });

      renderAndSnapshot(
        {
          currentTabContent: createMockTabContent(1),
          additionalTabsContent: [pendingTab],
        },
        'pending-tab-state'
      );
    });
  });

  describe('Error States Visual Tests', () => {
    it('should match snapshot with current tab in error state', () => {
      const errorCurrentTab = createMockTabContent(1, {
        extractionStatus: 'failed',
        extractionError: 'Network timeout occurred while extracting content',
      });

      renderAndSnapshot(
        {
          currentTabContent: errorCurrentTab,
          additionalTabsContent: [createMockTabContent(2)],
        },
        'current-tab-error-state'
      );
    });

    it('should match snapshot with multiple tabs in error state', () => {
      const errorTab1 = createMockTabContent(2, {
        extractionStatus: 'failed',
        extractionError: 'Content extraction failed: Access denied',
      });
      const errorTab2 = createMockTabContent(3, {
        extractionStatus: 'failed',
        extractionError: 'JavaScript execution timeout',
      });

      renderAndSnapshot(
        {
          currentTabContent: createMockTabContent(1),
          additionalTabsContent: [errorTab1, errorTab2],
        },
        'multiple-tabs-error-state'
      );
    });

    it('should match snapshot with mixed error and success states', () => {
      const errorTab = createMockTabContent(2, {
        extractionStatus: 'failed',
        extractionError: 'Failed to load page content',
      });
      const loadingTab = createMockTabContent(3, {
        extractionStatus: 'extracting',
      });
      const completedTab = createMockTabContent(4, {
        extractionStatus: 'completed',
      });

      renderAndSnapshot(
        {
          currentTabContent: createMockTabContent(1),
          additionalTabsContent: [errorTab, loadingTab, completedTab],
        },
        'mixed-error-success-states'
      );
    });

    it('should match snapshot with error tab without error message', () => {
      const errorTabNoMessage = createMockTabContent(2, {
        extractionStatus: 'failed',
        extractionError: undefined,
      });

      renderAndSnapshot(
        {
          currentTabContent: createMockTabContent(1),
          additionalTabsContent: [errorTabNoMessage],
        },
        'error-tab-no-message'
      );
    });

    it('should match snapshot with all tabs in error state', () => {
      const errorCurrentTab = createMockTabContent(1, {
        extractionStatus: 'failed',
        extractionError: 'Current tab extraction failed',
      });
      const errorAdditionalTabs = Array.from({ length: 3 }, (_, i) => 
        createMockTabContent(i + 2, {
          extractionStatus: 'failed',
          extractionError: `Tab ${i + 2} extraction failed: Generic error`,
        })
      );

      renderAndSnapshot(
        {
          currentTabContent: errorCurrentTab,
          additionalTabsContent: errorAdditionalTabs,
        },
        'all-tabs-error-state'
      );
    });
  });

  describe('Warning Banner Visual Tests', () => {
    it('should match snapshot with warning banner for 11 tabs', () => {
      const manyTabs = Array.from({ length: 10 }, (_, i) => createMockTabContent(i + 2));
      
      renderAndSnapshot(
        {
          currentTabContent: createMockTabContent(1),
          additionalTabsContent: manyTabs,
        },
        'warning-banner-eleven-tabs'
      );
    });

    it('should match snapshot with warning banner for 15 tabs', () => {
      const manyTabs = Array.from({ length: 14 }, (_, i) => createMockTabContent(i + 2));
      
      renderAndSnapshot(
        {
          currentTabContent: createMockTabContent(1),
          additionalTabsContent: manyTabs,
        },
        'warning-banner-fifteen-tabs'
      );
    });

    it('should match snapshot with warning banner and various tab states', () => {
      const manyTabs = Array.from({ length: 12 }, (_, i) => {
        const tabId = i + 2;
        // Mix different states across the many tabs
        if (i % 4 === 0) {
          return createMockTabContent(tabId, { extractionStatus: 'extracting' });
        } else if (i % 4 === 1) {
          return createMockTabContent(tabId, {
            extractionStatus: 'failed',
            extractionError: `Tab ${tabId} failed to load`,
          });
        } else if (i % 4 === 2) {
          return createMockTabContent(tabId, { extractionStatus: 'pending' });
        } else {
          return createMockTabContent(tabId, { extractionStatus: 'completed' });
        }
      });
      
      renderAndSnapshot(
        {
          currentTabContent: createMockTabContent(1),
          additionalTabsContent: manyTabs,
        },
        'warning-banner-with-mixed-states'
      );
    });

    it('should match snapshot with warning banner for excessive tabs (50+)', () => {
      const excessiveTabs = Array.from({ length: 49 }, (_, i) => 
        createMockTabContent(i + 2, {
          // Most tabs completed to avoid cluttering the snapshot
          extractionStatus: 'completed',
        })
      );
      
      renderAndSnapshot(
        {
          currentTabContent: createMockTabContent(1),
          additionalTabsContent: excessiveTabs,
        },
        'warning-banner-fifty-tabs-excessive'
      );
    });
  });

  describe('Layout Integrity Visual Tests', () => {
    it('should match snapshot with long tab titles (layout integrity)', () => {
      const longTitleTabs = [
        createMockTabContent(2, {
          tabInfo: {
            ...createMockTabContent(2).tabInfo,
            title: 'Very Long Tab Title That Should Be Handled Gracefully by the Layout System Without Breaking',
            domain: 'very-long-domain-name-example.com',
          },
        }),
        createMockTabContent(3, {
          tabInfo: {
            ...createMockTabContent(3).tabInfo,
            title: 'Another Extremely Long Title for Testing Layout Edge Cases in Multi-Tab Content Preview Component',
            domain: 'another-very-long-domain-example-site.org',
          },
        }),
      ];
      
      renderAndSnapshot(
        {
          currentTabContent: createMockTabContent(1, {
            tabInfo: {
              ...createMockTabContent(1).tabInfo,
              title: 'Current Tab with Moderately Long Title for Layout Testing',
            },
          }),
          additionalTabsContent: longTitleTabs,
        },
        'long-titles-layout-integrity'
      );
    });

    it('should match snapshot with special characters in titles', () => {
      const specialCharTabs = [
        createMockTabContent(2, {
          tabInfo: {
            ...createMockTabContent(2).tabInfo,
            title: 'Tab with émojis 🚀🔥💯 and unicode ñáéíóú',
            domain: 'émoji-test.com',
          },
        }),
        createMockTabContent(3, {
          tabInfo: {
            ...createMockTabContent(3).tabInfo,
            title: 'Tab with "quotes" & <brackets> [symbols] {braces}',
            domain: 'special-chars.net',
          },
        }),
      ];
      
      renderAndSnapshot(
        {
          currentTabContent: createMockTabContent(1),
          additionalTabsContent: specialCharTabs,
        },
        'special-characters-layout'
      );
    });

    it('should match snapshot with various content lengths', () => {
      const varyingContentTabs = [
        createMockTabContent(2, {
          extractedContent: createMockExtractedContent({
            text: 'Short content.',
            wordCount: 2,
            readingTime: 1,
          }),
        }),
        createMockTabContent(3, {
          extractedContent: createMockExtractedContent({
            text: 'Medium length content that spans multiple sentences and provides a good example of typical webpage content extraction. This includes various elements and demonstrates normal content flow.',
            wordCount: 24,
            readingTime: 1,
          }),
        }),
        createMockTabContent(4, {
          extractedContent: createMockExtractedContent({
            text: 'This is a very long piece of extracted content that would typically come from a comprehensive article or blog post. It includes multiple paragraphs, detailed information, and extensive coverage of the topic at hand. This type of content extraction would be common for research articles, news pieces, or documentation pages that contain substantial amounts of information. The content flows naturally and provides significant value to the user who is trying to understand the source material.',
            wordCount: 85,
            readingTime: 5,
          }),
        }),
      ];
      
      renderAndSnapshot(
        {
          currentTabContent: createMockTabContent(1),
          additionalTabsContent: varyingContentTabs,
        },
        'varying-content-lengths-layout'
      );
    });

    it('should match snapshot with tabs missing favicons', () => {
      const noFaviconTabs = [
        createMockTabContent(2, {
          tabInfo: {
            ...createMockTabContent(2).tabInfo,
            favIconUrl: undefined,
          },
        }),
        createMockTabContent(3, {
          tabInfo: {
            ...createMockTabContent(3).tabInfo,
            favIconUrl: '',
          },
        }),
      ];
      
      renderAndSnapshot(
        {
          currentTabContent: createMockTabContent(1),
          additionalTabsContent: noFaviconTabs,
        },
        'missing-favicons-layout'
      );
    });

    it('should match snapshot with mixed tab configurations (comprehensive layout test)', () => {
      const mixedTabs = [
        // Loading tab with long title
        createMockTabContent(2, {
          tabInfo: {
            ...createMockTabContent(2).tabInfo,
            title: 'Loading Tab with Very Long Title for Layout Testing',
          },
          extractionStatus: 'extracting',
        }),
        // Error tab with special characters
        createMockTabContent(3, {
          tabInfo: {
            ...createMockTabContent(3).tabInfo,
            title: 'Error Tab with émojis 🚨 & symbols',
            favIconUrl: undefined,
          },
          extractionStatus: 'failed',
          extractionError: 'Complex error message with detailed information about what went wrong',
        }),
        // Completed tab with short content
        createMockTabContent(4, {
          tabInfo: {
            ...createMockTabContent(4).tabInfo,
            title: 'Short',
          },
          extractedContent: createMockExtractedContent({
            text: 'Brief.',
            wordCount: 1,
          }),
          extractionStatus: 'completed',
        }),
        // Pending tab with normal content
        createMockTabContent(5, {
          extractionStatus: 'pending',
        }),
      ];
      
      renderAndSnapshot(
        {
          currentTabContent: createMockTabContent(1, {
            extractionStatus: 'completed',
          }),
          additionalTabsContent: mixedTabs,
        },
        'comprehensive-mixed-configurations'
      );
    });

    it('should match snapshot with layout stress test (many tabs with warnings)', () => {
      // Create 15 tabs with various states and configurations to stress-test layout
      const stressTabs = Array.from({ length: 14 }, (_, i) => {
        const tabId = i + 2;
        const configs = [
          // Long title, loading
          {
            tabInfo: {
              title: `Very Long Tab Title ${tabId} That Tests Layout Boundaries`,
              favIconUrl: `https://example${tabId}.com/favicon.ico`,
            },
            extractionStatus: 'extracting' as const,
          },
          // Error with special chars
          {
            tabInfo: {
              title: `Error Tab ${tabId} 🚨`,
              favIconUrl: undefined,
            },
            extractionStatus: 'failed' as const,
            extractionError: `Error ${tabId}: Network failure`,
          },
          // Normal completed
          {
            extractionStatus: 'completed' as const,
          },
          // Pending
          {
            extractionStatus: 'pending' as const,
          },
        ];
        
        const config = configs[i % configs.length];
        return createMockTabContent(tabId, config);
      });
      
      renderAndSnapshot(
        {
          currentTabContent: createMockTabContent(1),
          additionalTabsContent: stressTabs,
        },
        'layout-stress-test-fifteen-tabs'
      );
    });
  });

  describe('Edge Cases Visual Tests', () => {
    it('should match snapshot with untitled tabs', () => {
      const untitledTabs = [
        createMockTabContent(2, {
          tabInfo: {
            ...createMockTabContent(2).tabInfo,
            title: '',
          },
        }),
        createMockTabContent(3, {
          tabInfo: {
            ...createMockTabContent(3).tabInfo,
            title: '   ', // whitespace only
          },
        }),
      ];
      
      renderAndSnapshot(
        {
          currentTabContent: createMockTabContent(1),
          additionalTabsContent: untitledTabs,
        },
        'untitled-tabs-edge-case'
      );
    });

    it('should match snapshot with empty content', () => {
      const emptyContentTabs = [
        createMockTabContent(2, {
          extractedContent: createMockExtractedContent({
            text: '',
            title: '',
            wordCount: 0,
            readingTime: 0,
          }),
        }),
      ];
      
      renderAndSnapshot(
        {
          currentTabContent: createMockTabContent(1, {
            extractedContent: createMockExtractedContent({
              text: '',
              wordCount: 0,
            }),
          }),
          additionalTabsContent: emptyContentTabs,
        },
        'empty-content-edge-case'
      );
    });

    it('should match snapshot with maximum realistic tab count', () => {
      // Test with a realistic maximum that someone might actually encounter
      const maxTabs = Array.from({ length: 29 }, (_, i) => 
        createMockTabContent(i + 2, {
          extractionStatus: 'completed',
          extractedContent: createMockExtractedContent({
            text: `Content from tab ${i + 2}`,
            wordCount: 10 + i,
          }),
        })
      );
      
      renderAndSnapshot(
        {
          currentTabContent: createMockTabContent(1),
          additionalTabsContent: maxTabs,
        },
        'maximum-realistic-tab-count-thirty'
      );
    });
  });
});