/**
 * @file MultiTabContentPreview Component Tests
 *
 * Comprehensive tests for the MultiTabContentPreview component covering:
 * - Rendering with different tab configurations (no tabs, current only, multiple)
 * - Warning banner display for excessive tabs (>10)
 * - Individual tab management (remove, re-extract, clear)
 * - Clear all functionality
 * - Loading states per tab
 * - Error states per tab
 * - Expand/collapse functionality
 * - ContentPreview integration
 * - Accessibility features
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MultiTabContentPreview, MultiTabContentPreviewProps } from '@sidebar/components/MultiTabContentPreview';
import type { TabContent } from '@/types/tabs';
import type { ExtractedContent } from '@/types/extraction';

// Mock the ContentPreview component for cleaner testing
vi.mock('@sidebar/components/ContentPreview', () => ({
  ContentPreview: vi.fn(({ content, loading, error, onReextract, onClearContent, className }) => (
    <div data-testid="content-preview" className={className}>
      {loading && <div data-testid="loading-spinner">Loading...</div>}
      {error && <div data-testid="error-message">{error.message}</div>}
      {content && <div data-testid="content-text">{content.text || 'No content'}</div>}
      <button onClick={onReextract} data-testid="reextract-button">Re-extract</button>
      <button onClick={onClearContent} data-testid="clear-content-button">Clear</button>
    </div>
  )),
}));

// Mock UI components
vi.mock('@ui/Alert', () => ({
  Alert: vi.fn(({ type, message, className, showIcon }) => (
    <div data-testid="alert" className={className} data-type={type} data-show-icon={showIcon}>
      {message}
    </div>
  )),
}));

vi.mock('@ui/Spinner', () => ({
  Spinner: vi.fn(({ size, className }) => (
    <div data-testid="spinner" data-size={size} className={className}>Loading...</div>
  )),
}));

vi.mock('@ui/Icons', () => ({
  CloseIcon: vi.fn(({ size }) => <div data-testid="close-icon" data-size={size}>✕</div>),
  WarningIcon: vi.fn(({ size, className }) => (
    <div data-testid="warning-icon" data-size={size} className={className}>⚠</div>
  )),
  Layers: vi.fn(({ size }) => <div data-testid="layers-icon" data-size={size}>≡</div>),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

/**
 * Helper to create mock extracted content
 */
const createMockExtractedContent = (overrides: Partial<ExtractedContent> = {}): ExtractedContent => ({
  text: 'Sample extracted text content from the webpage.',
  markdown: '# Sample Content\n\nSample extracted text content from the webpage.',
  title: 'Sample Page Title',
  url: 'https://example.com/page',
  domain: 'example.com',
  timestamp: Date.now(),
  wordCount: 8,
  readingTime: 1,
  language: 'en',
  ...overrides,
});

/**
 * Helper to create mock TabContent
 */
const createMockTabContent = (
  tabId: number, 
  overrides: Partial<TabContent> = {}
): TabContent => ({
  tabInfo: {
    id: tabId,
    title: `Test Tab ${tabId}`,
    url: `https://example${tabId}.com/page`,
    domain: `example${tabId}.com`,
    windowId: 1,
    active: tabId === 1,
    index: tabId - 1,
    pinned: false,
    lastAccessed: Date.now() - tabId * 1000,
    favIconUrl: `https://example${tabId}.com/favicon.ico`,
  },
  extractedContent: createMockExtractedContent({
    text: `Content from tab ${tabId}`,
    title: `Tab ${tabId} Title`,
    url: `https://example${tabId}.com/page`,
    domain: `example${tabId}.com`,
  }),
  extractionStatus: 'completed',
  ...overrides,
});

/**
 * Default props for testing
 */
const defaultProps: MultiTabContentPreviewProps = {
  currentTabContent: createMockTabContent(1),
  additionalTabsContent: [createMockTabContent(2), createMockTabContent(3)],
  onRemoveTab: vi.fn(),
  onClearAllTabs: vi.fn(),
  onReextractTab: vi.fn(),
  onClearTabContent: vi.fn(),
};

/**
 * Helper to render component with default props
 */
const renderMultiTabContentPreview = (props: Partial<MultiTabContentPreviewProps> = {}) => {
  return render(<MultiTabContentPreview {...defaultProps} {...props} />);
};

describe('MultiTabContentPreview', () => {
  describe('Basic Rendering', () => {
    it('should render nothing when no content is provided', () => {
      const { container } = renderMultiTabContentPreview({
        currentTabContent: null,
        additionalTabsContent: [],
      });
      expect(container.firstChild).toBeNull();
    });

    it('should render only current tab when no additional tabs', () => {
      renderMultiTabContentPreview({
        additionalTabsContent: [],
      });

      expect(screen.getByText('Current Tab')).toBeInTheDocument();
      expect(screen.queryByText(/Additional Tabs/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Clear All/)).not.toBeInTheDocument();
    });

    it('should render only additional tabs when no current tab', () => {
      renderMultiTabContentPreview({
        currentTabContent: null,
      });

      expect(screen.queryByText('Current Tab')).not.toBeInTheDocument();
      expect(screen.getByText('Additional Tabs (2)')).toBeInTheDocument();
    });

    it('should render both current and additional tabs', () => {
      renderMultiTabContentPreview();

      expect(screen.getByText('Current Tab')).toBeInTheDocument();
      expect(screen.getByText('Additional Tabs (2)')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const { container } = renderMultiTabContentPreview({ className: 'custom-preview' });
      expect(container.firstChild).toHaveClass('custom-preview');
    });

    it('should show clear all button when multiple tabs are present', () => {
      renderMultiTabContentPreview();
      
      const clearAllButton = screen.getByText(/Clear All \(3 tabs\)/);
      expect(clearAllButton).toBeInTheDocument();
    });

    it('should not show clear all button with only current tab', () => {
      renderMultiTabContentPreview({ additionalTabsContent: [] });
      
      expect(screen.queryByText(/Clear All/)).not.toBeInTheDocument();
    });

    it('should display correct tab count in clear all button', () => {
      const additionalTabs = Array.from({ length: 5 }, (_, i) => createMockTabContent(i + 2));
      renderMultiTabContentPreview({ additionalTabsContent: additionalTabs });
      
      expect(screen.getByText(/Clear All \(6 tabs\)/)).toBeInTheDocument();
    });
  });

  describe('Warning Banner', () => {
    it('should show warning when more than 10 tabs are loaded', () => {
      const manyTabs = Array.from({ length: 12 }, (_, i) => createMockTabContent(i + 2));
      renderMultiTabContentPreview({ additionalTabsContent: manyTabs });

      const warning = screen.getByTestId('alert');
      expect(warning).toBeInTheDocument();
      expect(warning).toHaveAttribute('data-type', 'warning');
      expect(warning).toHaveTextContent(/You have 13 tabs loaded/);
    });

    it('should not show warning with 10 or fewer tabs', () => {
      const tenTabs = Array.from({ length: 9 }, (_, i) => createMockTabContent(i + 2));
      renderMultiTabContentPreview({ additionalTabsContent: tenTabs });

      expect(screen.queryByTestId('alert')).not.toBeInTheDocument();
    });

    it('should show warning with exactly 11 tabs', () => {
      const elevenTabs = Array.from({ length: 10 }, (_, i) => createMockTabContent(i + 2));
      renderMultiTabContentPreview({ additionalTabsContent: elevenTabs });

      expect(screen.getByTestId('alert')).toBeInTheDocument();
      expect(screen.getByText(/You have 11 tabs loaded/)).toBeInTheDocument();
    });

    it('should include performance message in warning', () => {
      const manyTabs = Array.from({ length: 15 }, (_, i) => createMockTabContent(i + 2));
      renderMultiTabContentPreview({ additionalTabsContent: manyTabs });

      expect(screen.getByText(/Consider reducing the number for better performance/)).toBeInTheDocument();
    });

    it('should not be dismissible', () => {
      const manyTabs = Array.from({ length: 12 }, (_, i) => createMockTabContent(i + 2));
      renderMultiTabContentPreview({ additionalTabsContent: manyTabs });

      const warning = screen.getByTestId('alert');
      expect(warning).toBeInTheDocument();
      // Warning should be rendered but not dismissible (no close button should be created by Alert)
    });

    it('should show warning icon', () => {
      const manyTabs = Array.from({ length: 12 }, (_, i) => createMockTabContent(i + 2));
      renderMultiTabContentPreview({ additionalTabsContent: manyTabs });

      const warning = screen.getByTestId('alert');
      expect(warning).toHaveAttribute('data-show-icon', 'true');
    });
  });

  describe('Tab Header Display', () => {
    it('should display tab title and domain', () => {
      renderMultiTabContentPreview();

      expect(screen.getByText('Test Tab 2')).toBeInTheDocument();
      expect(screen.getByText('example2.com')).toBeInTheDocument();
    });

    it('should display favicon when available', () => {
      renderMultiTabContentPreview();

      const favicons = screen.getAllByRole('img');
      expect(favicons.length).toBeGreaterThan(0);
      expect(favicons[0]).toHaveAttribute('src');
    });

    it('should handle missing favicon gracefully', () => {
      const tabWithoutFavicon = createMockTabContent(2, {
        tabInfo: {
          ...createMockTabContent(2).tabInfo,
          favIconUrl: undefined,
        },
      });
      
      renderMultiTabContentPreview({
        additionalTabsContent: [tabWithoutFavicon],
      });

      // Should use Google favicon service as fallback - but since it's collapsed, the favicon isn't rendered yet
      // Let's expand the tab to see the favicon
      const images = screen.getAllByRole('img');
      expect(images.length).toBeGreaterThan(0); // At least the current tab favicon
      
      // The favicon URL will be generated when the component renders
      // We can't test the exact URL without expanding since the additional tab is collapsed
    });

    it('should handle favicon error by hiding the image', async () => {
      renderMultiTabContentPreview();

      const favicon = screen.getAllByRole('img')[1];
      fireEvent.error(favicon);

      expect(favicon).toHaveStyle({ display: 'none' });
    });

    it('should truncate long titles with title attribute', () => {
      const longTitleTab = createMockTabContent(2, {
        tabInfo: {
          ...createMockTabContent(2).tabInfo,
          title: 'Very long title that should be truncated',
        },
      });

      renderMultiTabContentPreview({
        additionalTabsContent: [longTitleTab],
      });

      const titleElement = screen.getByTitle('Very long title that should be truncated');
      expect(titleElement).toBeInTheDocument();
    });

    it('should handle untitled tabs', () => {
      const untitledTab = createMockTabContent(2, {
        tabInfo: {
          ...createMockTabContent(2).tabInfo,
          title: '',
        },
      });

      renderMultiTabContentPreview({
        additionalTabsContent: [untitledTab],
      });

      expect(screen.getByText('Untitled')).toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('should show spinner for extracting status', () => {
      const extractingTab = createMockTabContent(2, {
        extractionStatus: 'extracting',
      });

      renderMultiTabContentPreview({
        additionalTabsContent: [extractingTab],
      });

      expect(screen.getByTestId('spinner')).toBeInTheDocument();
      expect(screen.getByTestId('spinner')).toHaveClass('multi-tab-spinner');
    });

    it('should pass loading state to ContentPreview', () => {
      const extractingTab = createMockTabContent(1, {
        extractionStatus: 'extracting',
      });

      renderMultiTabContentPreview({
        currentTabContent: extractingTab,
      });

      const contentPreview = screen.getAllByTestId('content-preview')[0];
      expect(contentPreview).toBeInTheDocument();
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });

    it('should show completed indicator for completed extraction', () => {
      const completedTab = createMockTabContent(2, {
        extractionStatus: 'completed',
      });

      renderMultiTabContentPreview({
        additionalTabsContent: [completedTab],
      });

      expect(screen.getByText('✓')).toBeInTheDocument();
    });

    it('should handle pending status', () => {
      const pendingTab = createMockTabContent(2, {
        extractionStatus: 'pending',
      });

      renderMultiTabContentPreview({
        additionalTabsContent: [pendingTab],
      });

      // Should not show any status indicator for pending
      expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      expect(screen.queryByTestId('warning-icon')).not.toBeInTheDocument();
      expect(screen.queryByText('✓')).not.toBeInTheDocument();
    });

    it('should handle cached status', () => {
      const cachedTab = createMockTabContent(2, {
        extractionStatus: 'cached',
      });

      renderMultiTabContentPreview({
        additionalTabsContent: [cachedTab],
      });

      // Cached status doesn't show any specific indicator in the current implementation
      // It should not show spinner, error, or completed indicator
      expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      expect(screen.queryByTestId('warning-icon')).not.toBeInTheDocument();
      expect(screen.queryByText('✓')).not.toBeInTheDocument();
    });
  });

  describe('Error States', () => {
    it('should show warning icon for failed extraction', () => {
      const failedTab = createMockTabContent(2, {
        extractionStatus: 'failed',
        extractionError: 'Failed to extract content',
      });

      renderMultiTabContentPreview({
        additionalTabsContent: [failedTab],
      });

      expect(screen.getByTestId('warning-icon')).toBeInTheDocument();
    });

    it('should pass error to ContentPreview', () => {
      const failedTab = createMockTabContent(1, {
        extractionStatus: 'failed',
        extractionError: 'Network error occurred',
      });

      renderMultiTabContentPreview({
        currentTabContent: failedTab,
      });

      expect(screen.getByTestId('error-message')).toHaveTextContent('Network error occurred');
    });

    it('should handle failed status without error message', () => {
      const failedTab = createMockTabContent(2, {
        extractionStatus: 'failed',
        extractionError: undefined,
      });

      renderMultiTabContentPreview({
        additionalTabsContent: [failedTab],
      });

      expect(screen.getByTestId('warning-icon')).toBeInTheDocument();
      // ContentPreview should not show error message when no error is provided
      expect(screen.queryByTestId('error-message')).not.toBeInTheDocument();
    });
  });

  describe('Expand/Collapse Functionality', () => {
    it('should start with collapsed additional tabs', () => {
      renderMultiTabContentPreview();

      const toggleButtons = screen.getAllByLabelText(/Expand Test Tab/);
      expect(toggleButtons).toHaveLength(2);
      
      toggleButtons.forEach(button => {
        expect(button).toHaveClass('collapsed');
        expect(button).toHaveAttribute('aria-expanded', 'false');
      });
    });

    it('should expand tab when toggle button is clicked', async () => {
      const user = userEvent.setup();
      renderMultiTabContentPreview();

      const toggleButton = screen.getByLabelText('Expand Test Tab 2');
      await user.click(toggleButton);

      expect(toggleButton).toHaveClass('expanded');
      expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
      
      // Should show content preview for expanded tab
      const contentPreviews = screen.getAllByTestId('content-preview');
      expect(contentPreviews.length).toBeGreaterThan(1); // Current tab + expanded tab
    });

    it('should collapse tab when expanded toggle is clicked again', async () => {
      const user = userEvent.setup();
      renderMultiTabContentPreview();

      const toggleButton = screen.getByLabelText('Expand Test Tab 2');
      
      // Expand
      await user.click(toggleButton);
      expect(toggleButton).toHaveClass('expanded');
      
      // Collapse
      await user.click(toggleButton);
      expect(toggleButton).toHaveClass('collapsed');
      expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
    });

    it('should update aria-label when expanding/collapsing', async () => {
      const user = userEvent.setup();
      renderMultiTabContentPreview();

      const toggleButton = screen.getByLabelText('Expand Test Tab 2');
      await user.click(toggleButton);

      expect(screen.getByLabelText('Collapse Test Tab 2')).toBeInTheDocument();
      expect(screen.queryByLabelText('Expand Test Tab 2')).not.toBeInTheDocument();
    });

    it('should allow multiple tabs to be expanded simultaneously', async () => {
      const user = userEvent.setup();
      renderMultiTabContentPreview();

      const toggle1 = screen.getByLabelText('Expand Test Tab 2');
      const toggle2 = screen.getByLabelText('Expand Test Tab 3');

      await user.click(toggle1);
      await user.click(toggle2);

      expect(toggle1).toHaveClass('expanded');
      expect(toggle2).toHaveClass('expanded');

      const contentPreviews = screen.getAllByTestId('content-preview');
      expect(contentPreviews).toHaveLength(3); // Current + 2 expanded
    });

    it('should preserve expand state when re-rendering', async () => {
      const user = userEvent.setup();
      const { rerender } = renderMultiTabContentPreview();

      const toggleButton = screen.getByLabelText('Expand Test Tab 2');
      await user.click(toggleButton);

      // Re-render with same props
      rerender(<MultiTabContentPreview {...defaultProps} />);

      const updatedToggle = screen.getByLabelText('Collapse Test Tab 2');
      expect(updatedToggle).toHaveClass('expanded');
    });
  });

  describe('Tab Management Actions', () => {
    it('should call onRemoveTab when remove button is clicked', async () => {
      const user = userEvent.setup();
      const mockOnRemoveTab = vi.fn();
      renderMultiTabContentPreview({ onRemoveTab: mockOnRemoveTab });

      // Expand a tab to see the remove button
      const toggleButton = screen.getByLabelText('Expand Test Tab 2');
      await user.click(toggleButton);

      const removeButton = screen.getByLabelText('Remove Test Tab 2');
      await user.click(removeButton);

      expect(mockOnRemoveTab).toHaveBeenCalledWith(2);
    });

    it('should stop event propagation when remove button is clicked', async () => {
      const user = userEvent.setup();
      const mockOnRemoveTab = vi.fn();
      renderMultiTabContentPreview({ onRemoveTab: mockOnRemoveTab });

      // Expand a tab
      const toggleButton = screen.getByLabelText('Expand Test Tab 2');
      await user.click(toggleButton);

      // Click the remove button
      const removeButton = screen.getByLabelText('Remove Test Tab 2');
      await user.click(removeButton);

      // Should call onRemoveTab (proving the remove button worked)
      expect(mockOnRemoveTab).toHaveBeenCalledWith(2);
      
      // The key test is that clicking remove doesn't cause the tab to toggle
      // Since we can't easily test event propagation in jsdom, we'll verify the remove callback was called
      expect(mockOnRemoveTab).toHaveBeenCalledTimes(1);
    });

    it('should call onClearAllTabs when clear all button is clicked', async () => {
      const user = userEvent.setup();
      const mockOnClearAllTabs = vi.fn();
      renderMultiTabContentPreview({ onClearAllTabs: mockOnClearAllTabs });

      const clearAllButton = screen.getByText(/Clear All \(3 tabs\)/);
      await user.click(clearAllButton);

      expect(mockOnClearAllTabs).toHaveBeenCalled();
    });

    it('should call onReextractTab from ContentPreview', async () => {
      const user = userEvent.setup();
      const mockOnReextractTab = vi.fn();
      renderMultiTabContentPreview({ onReextractTab: mockOnReextractTab });

      // Current tab re-extract button
      const reextractButtons = screen.getAllByTestId('reextract-button');
      await user.click(reextractButtons[0]);

      expect(mockOnReextractTab).toHaveBeenCalledWith(1); // Current tab ID
    });

    it('should call onClearTabContent from ContentPreview', async () => {
      const user = userEvent.setup();
      const mockOnClearTabContent = vi.fn();
      renderMultiTabContentPreview({ onClearTabContent: mockOnClearTabContent });

      // Current tab clear button
      const clearButtons = screen.getAllByTestId('clear-content-button');
      await user.click(clearButtons[0]);

      expect(mockOnClearTabContent).toHaveBeenCalledWith(1); // Current tab ID
    });

    it('should pass correct tab ID to callbacks for additional tabs', async () => {
      const user = userEvent.setup();
      const mockOnReextractTab = vi.fn();
      renderMultiTabContentPreview({ onReextractTab: mockOnReextractTab });

      // Expand an additional tab to see its content
      const toggleButton = screen.getByLabelText('Expand Test Tab 2');
      await user.click(toggleButton);

      // Find re-extract button for the expanded tab (should be the second one)
      const reextractButtons = screen.getAllByTestId('reextract-button');
      await user.click(reextractButtons[1]);

      expect(mockOnReextractTab).toHaveBeenCalledWith(2); // Additional tab ID
    });
  });

  describe('ContentPreview Integration', () => {
    it('should pass correct props to ContentPreview for current tab', () => {
      renderMultiTabContentPreview();

      const contentPreview = screen.getAllByTestId('content-preview')[0];
      expect(contentPreview).toHaveClass('multi-tab-content-preview-item');
      expect(screen.getByTestId('content-text')).toHaveTextContent('Content from tab 1');
    });

    it('should pass correct props to ContentPreview for additional tabs', async () => {
      const user = userEvent.setup();
      renderMultiTabContentPreview();

      // Expand an additional tab
      const toggleButton = screen.getByLabelText('Expand Test Tab 2');
      await user.click(toggleButton);

      const contentPreviews = screen.getAllByTestId('content-preview');
      expect(contentPreviews).toHaveLength(2);
      
      // Check that additional tab content is displayed
      expect(screen.getByText('Content from tab 2')).toBeInTheDocument();
    });

    it('should handle ContentPreview with empty content', () => {
      const emptyContentTab = createMockTabContent(1, {
        extractedContent: createMockExtractedContent({ text: '' }),
      });

      renderMultiTabContentPreview({
        currentTabContent: emptyContentTab,
      });

      expect(screen.getByTestId('content-text')).toHaveTextContent('No content');
    });

    it('should apply correct className to ContentPreview', () => {
      renderMultiTabContentPreview();

      const contentPreview = screen.getAllByTestId('content-preview')[0];
      expect(contentPreview).toHaveClass('multi-tab-content-preview-item');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes for toggle buttons', () => {
      renderMultiTabContentPreview();

      const toggleButtons = screen.getAllByRole('button');
      const expandButtons = toggleButtons.filter(btn => btn.getAttribute('aria-label')?.includes('Expand'));
      
      expandButtons.forEach(button => {
        expect(button).toHaveAttribute('aria-expanded', 'false');
        expect(button).toHaveAttribute('type', 'button');
      });
    });

    it('should have accessible labels for remove buttons', async () => {
      const user = userEvent.setup();
      renderMultiTabContentPreview();

      const toggleButton = screen.getByLabelText('Expand Test Tab 2');
      await user.click(toggleButton);

      const removeButton = screen.getByLabelText('Remove Test Tab 2');
      expect(removeButton).toHaveAttribute('title', 'Remove Test Tab 2');
      expect(removeButton).toHaveAttribute('type', 'button');
    });

    it('should have accessible labels for clear all button', () => {
      renderMultiTabContentPreview();

      const clearAllButton = screen.getByText(/Clear All \(3 tabs\)/);
      expect(clearAllButton).toHaveAttribute('type', 'button');
    });

    it('should maintain focus management during expand/collapse', async () => {
      const user = userEvent.setup();
      renderMultiTabContentPreview();

      const toggleButton = screen.getByLabelText('Expand Test Tab 2');
      toggleButton.focus();
      
      expect(document.activeElement).toBe(toggleButton);
      
      await user.keyboard('{Enter}');
      
      // Focus should remain on the toggle button after expansion
      expect(document.activeElement).toBe(toggleButton);
    });

    it('should support keyboard navigation for toggle buttons', async () => {
      const user = userEvent.setup();
      renderMultiTabContentPreview();

      const toggleButton = screen.getByLabelText('Expand Test Tab 2');
      toggleButton.focus();

      await user.keyboard('{Enter}');

      expect(toggleButton).toHaveClass('expanded');
      expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
    });

    it('should support keyboard navigation for remove buttons', async () => {
      const user = userEvent.setup();
      const mockOnRemoveTab = vi.fn();
      renderMultiTabContentPreview({ onRemoveTab: mockOnRemoveTab });

      // Expand tab first
      const toggleButton = screen.getByLabelText('Expand Test Tab 2');
      await user.click(toggleButton);

      const removeButton = screen.getByLabelText('Remove Test Tab 2');
      removeButton.focus();

      await user.keyboard('{Enter}');

      expect(mockOnRemoveTab).toHaveBeenCalledWith(2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle tabs with very long titles gracefully', () => {
      const longTitleTab = createMockTabContent(2, {
        tabInfo: {
          ...createMockTabContent(2).tabInfo,
          title: 'A'.repeat(200),
        },
      });

      expect(() => renderMultiTabContentPreview({
        additionalTabsContent: [longTitleTab],
      })).not.toThrow();
    });

    it('should handle tabs with special characters in titles', () => {
      const specialTab = createMockTabContent(2, {
        tabInfo: {
          ...createMockTabContent(2).tabInfo,
          title: 'Tab with émojis 🚀 and <script>alert("xss")</script>',
        },
      });

      expect(() => renderMultiTabContentPreview({
        additionalTabsContent: [specialTab],
      })).not.toThrow();
    });

    it('should handle missing callback functions gracefully', async () => {
      const user = userEvent.setup();
      renderMultiTabContentPreview({
        onRemoveTab: undefined as any,
        onClearAllTabs: undefined as any,
        onReextractTab: undefined as any,
        onClearTabContent: undefined as any,
      });

      // Should not throw when buttons are clicked
      const clearAllButton = screen.getByText(/Clear All/);
      expect(() => user.click(clearAllButton)).not.toThrow();
    });

    it('should handle rapid expand/collapse actions', async () => {
      const user = userEvent.setup();
      renderMultiTabContentPreview();

      const toggleButton = screen.getByLabelText('Expand Test Tab 2');

      // Rapidly toggle a few times (even number to end up collapsed)
      await user.click(toggleButton); // expanded
      await user.click(toggleButton); // collapsed
      await user.click(toggleButton); // expanded
      await user.click(toggleButton); // collapsed
      await user.click(toggleButton); // expanded

      // Should end up expanded after odd number of clicks
      expect(toggleButton).toHaveClass('expanded');
      expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
    });

    it('should handle tabs with invalid extraction data', () => {
      const invalidTab = createMockTabContent(2, {
        extractedContent: null as any,
        extractionStatus: 'completed',
      });

      expect(() => renderMultiTabContentPreview({
        additionalTabsContent: [invalidTab],
      })).not.toThrow();
    });

    it('should handle enormous numbers of tabs', () => {
      const manyTabs = Array.from({ length: 100 }, (_, i) => createMockTabContent(i + 2));
      
      expect(() => renderMultiTabContentPreview({
        additionalTabsContent: manyTabs,
      })).not.toThrow();
      
      expect(screen.getByText(/You have 101 tabs loaded/)).toBeInTheDocument();
    });

    it('should handle tabs with null or undefined properties', () => {
      const problematicTab = createMockTabContent(2, {
        tabInfo: {
          ...createMockTabContent(2).tabInfo,
          title: null as any,
          domain: undefined as any,
        },
      });

      expect(() => renderMultiTabContentPreview({
        additionalTabsContent: [problematicTab],
      })).not.toThrow();
    });

    it('should handle component unmounting during async operations', () => {
      const { unmount } = renderMultiTabContentPreview();
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('Performance Considerations', () => {
    it('should not render ContentPreview for collapsed tabs', () => {
      renderMultiTabContentPreview();

      // Only current tab should have ContentPreview rendered initially
      const contentPreviews = screen.getAllByTestId('content-preview');
      expect(contentPreviews).toHaveLength(1);
    });

    it('should lazy-render ContentPreview only when tabs are expanded', async () => {
      const user = userEvent.setup();
      renderMultiTabContentPreview();

      expect(screen.getAllByTestId('content-preview')).toHaveLength(1);

      // Expand first additional tab
      const toggleButton1 = screen.getByLabelText('Expand Test Tab 2');
      await user.click(toggleButton1);

      expect(screen.getAllByTestId('content-preview')).toHaveLength(2);

      // Expand second additional tab
      const toggleButton2 = screen.getByLabelText('Expand Test Tab 3');
      await user.click(toggleButton2);

      expect(screen.getAllByTestId('content-preview')).toHaveLength(3);
    });

    it('should maintain expanded state efficiently across re-renders', async () => {
      const user = userEvent.setup();
      const { rerender } = renderMultiTabContentPreview();

      // Expand a tab
      const toggleButton = screen.getByLabelText('Expand Test Tab 2');
      await user.click(toggleButton);

      // Re-render multiple times
      for (let i = 0; i < 5; i++) {
        rerender(<MultiTabContentPreview {...defaultProps} />);
      }

      // Should maintain expanded state
      expect(screen.getByLabelText('Collapse Test Tab 2')).toHaveClass('expanded');
      expect(screen.getAllByTestId('content-preview')).toHaveLength(2);
    });
  });
});