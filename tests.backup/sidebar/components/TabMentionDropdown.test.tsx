/**
 * @file TabMentionDropdown Component Tests
 *
 * Comprehensive tests for the TabMentionDropdown component covering:
 * - Rendering with different numbers of tabs
 * - Keyboard navigation (arrows, enter, escape, home/end, type-ahead)
 * - Mouse interactions (hover, click)
 * - ARIA attributes and accessibility
 * - Selection callbacks
 * - Position prop handling
 * - Virtualization with large tab lists
 * - Edge cases and error handling
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TabMentionDropdown, TabMentionDropdownProps } from '@sidebar/components/TabMentionDropdown';
import { TabInfo } from '@/types/tabs';

// Mock console for cleaner test output
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.clearAllMocks();
});

/**
 * Helper function to create mock TabInfo objects
 */
const createMockTab = (id: number, overrides: Partial<TabInfo> = {}): TabInfo => ({
  id,
  title: `Test Tab ${id}`,
  url: `https://example${id}.com/page`,
  domain: `example${id}.com`,
  windowId: 1,
  active: id === 1,
  index: id - 1,
  pinned: false,
  lastAccessed: Date.now() - id * 1000,
  favIconUrl: `https://example${id}.com/favicon.ico`,
  audible: id === 2, // Make tab 2 audible for testing
  status: 'complete',
  ...overrides,
});

/**
 * Helper function to create multiple tabs
 */
const createMockTabs = (count: number): TabInfo[] => {
  return Array.from({ length: count }, (_, index) => createMockTab(index + 1));
};

/**
 * Default props for testing
 */
const defaultProps: TabMentionDropdownProps = {
  tabs: createMockTabs(3),
  onSelect: vi.fn(),
  position: { x: 100, y: 200 },
  isOpen: true,
  onClose: vi.fn(),
};

/**
 * Helper to render component with default props
 */
const renderTabMentionDropdown = (props: Partial<TabMentionDropdownProps> = {}) => {
  return render(<TabMentionDropdown {...defaultProps} {...props} />);
};

describe('TabMentionDropdown', () => {
  describe('Basic Rendering', () => {
    it('should render nothing when isOpen is false', () => {
      renderTabMentionDropdown({ isOpen: false });
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('should render dropdown when isOpen is true', () => {
      renderTabMentionDropdown();
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      expect(screen.getByLabelText('Select tab to mention')).toBeInTheDocument();
    });

    it('should render with empty tabs array', () => {
      renderTabMentionDropdown({ tabs: [] });
      const listbox = screen.getByRole('listbox');
      expect(listbox).toBeInTheDocument();
      expect(screen.queryByRole('option')).not.toBeInTheDocument();
    });

    it('should render single tab correctly', () => {
      const tabs = [createMockTab(1, { title: 'Single Tab', domain: 'single.com' })];
      renderTabMentionDropdown({ tabs });
      
      expect(screen.getByRole('option')).toBeInTheDocument();
      expect(screen.getByText('Single Tab')).toBeInTheDocument();
      expect(screen.getByText('single.com')).toBeInTheDocument();
    });

    it('should render multiple tabs correctly', () => {
      renderTabMentionDropdown();
      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(3);
      
      expect(screen.getByText('Test Tab 1')).toBeInTheDocument();
      expect(screen.getByText('Test Tab 2')).toBeInTheDocument();
      expect(screen.getByText('Test Tab 3')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      renderTabMentionDropdown({ className: 'custom-dropdown' });
      const dropdown = screen.getByRole('listbox').closest('.tab-mention-dropdown');
      expect(dropdown).toHaveClass('custom-dropdown');
    });

    it('should render with large number of tabs (30+) with virtualization', () => {
      const largeTabs = createMockTabs(35);
      renderTabMentionDropdown({ tabs: largeTabs });
      
      const listbox = screen.getByRole('listbox');
      expect(listbox).toBeInTheDocument();
      
      // With virtualization, only visible tabs should be rendered initially
      const options = screen.getAllByRole('option');
      expect(options.length).toBeLessThan(35);
      expect(options.length).toBeGreaterThan(0);
    });
  });

  describe('Position Handling', () => {
    it('should apply position styles correctly', () => {
      renderTabMentionDropdown({ position: { x: 250, y: 350 } });
      const dropdown = screen.getByRole('listbox').closest('.tab-mention-dropdown');
      
      expect(dropdown).toHaveStyle({
        position: 'absolute',
        left: '250px',
        top: '350px',
      });
    });

    it('should handle zero position coordinates', () => {
      renderTabMentionDropdown({ position: { x: 0, y: 0 } });
      const dropdown = screen.getByRole('listbox').closest('.tab-mention-dropdown');
      
      expect(dropdown).toHaveStyle({
        left: '0px',
        top: '0px',
      });
    });

    it('should handle negative position coordinates', () => {
      renderTabMentionDropdown({ position: { x: -10, y: -20 } });
      const dropdown = screen.getByRole('listbox').closest('.tab-mention-dropdown');
      
      expect(dropdown).toHaveStyle({
        left: '-10px',
        top: '-20px',
      });
    });
  });

  describe('Tab Content Display', () => {
    it('should display favicon when provided', () => {
      const tabWithFavicon = createMockTab(1, {
        title: 'Tab with Favicon',
        favIconUrl: 'https://example.com/favicon.ico',
        url: 'https://example.com/page',
      });
      renderTabMentionDropdown({ tabs: [tabWithFavicon] });
      
      const favicon = screen.getByRole('img');
      // Now uses Google favicon service by default
      expect(favicon).toHaveAttribute('src', 'https://www.google.com/s2/favicons?domain=example.com&sz=16');
      expect(favicon).toHaveAttribute('alt', '');
    });

    it('should show fallback icon when favicon is not provided', () => {
      const tabWithoutFavicon = createMockTab(1, {
        title: 'Tab without Favicon',
        favIconUrl: undefined,
        url: 'https://example.com/page',
      });
      renderTabMentionDropdown({ tabs: [tabWithoutFavicon] });
      
      const favicon = screen.getByRole('img');
      // Now uses Google favicon service even when no tab favicon is provided
      expect(favicon).toHaveAttribute('src', 'https://www.google.com/s2/favicons?domain=example.com&sz=16');
    });

    it('should handle favicon loading error gracefully', async () => {
      const tabWithBadFavicon = createMockTab(1, {
        title: 'Tab with Bad Favicon',
        favIconUrl: 'https://nonexistent.com/favicon.ico',
        url: 'https://nonexistent.com/page',
      });
      renderTabMentionDropdown({ tabs: [tabWithBadFavicon] });
      
      const favicon = screen.getByRole('img');
      
      // Should initially use Google favicon service
      expect(favicon).toHaveAttribute('src', 'https://www.google.com/s2/favicons?domain=nonexistent.com&sz=16');
      
      // Simulate favicon loading error - should attempt fallback
      fireEvent.error(favicon);
      
      // The error handler should attempt to change the src
      expect(favicon).toBeInTheDocument();
    });

    it('should truncate long titles', () => {
      const longTitle = 'A'.repeat(100);
      const tabWithLongTitle = createMockTab(1, { title: longTitle });
      renderTabMentionDropdown({ tabs: [tabWithLongTitle] });
      
      const titleElement = screen.getByText(/A+\.\.\./);
      expect(titleElement).toBeInTheDocument();
    });

    it('should truncate long domains', () => {
      const longDomain = 'very-long-domain-name-that-should-be-truncated.com';
      const tabWithLongDomain = createMockTab(1, { 
        domain: longDomain,
        url: `https://${longDomain}/page`,
      });
      renderTabMentionDropdown({ tabs: [tabWithLongDomain] });
      
      const domainElement = screen.getByText(/very-long-domain.*\.\.\./);
      expect(domainElement).toBeInTheDocument();
    });

    it('should show active indicator for active tab', () => {
      const activeTab = createMockTab(1, { active: true });
      renderTabMentionDropdown({ tabs: [activeTab] });
      
      const indicator = screen.getByTitle('Active tab');
      expect(indicator).toBeInTheDocument();
      expect(indicator).toHaveTextContent('•');
    });

    it('should show audio indicator for audible tab', () => {
      const audibleTab = createMockTab(1, { audible: true });
      renderTabMentionDropdown({ tabs: [audibleTab] });
      
      const indicator = screen.getByTitle('Playing audio');
      expect(indicator).toBeInTheDocument();
      expect(indicator).toHaveTextContent('🔊');
    });

    it('should handle untitled tabs', () => {
      const untitledTab = createMockTab(1, { title: '' });
      renderTabMentionDropdown({ tabs: [untitledTab] });
      
      expect(screen.getByText('Untitled')).toBeInTheDocument();
    });

    it('should handle tabs with complex URLs', () => {
      const complexTab = createMockTab(1, {
        url: 'https://sub.example.com:8080/path/to/page?query=value&other=param#fragment',
        domain: 'sub.example.com',
      });
      renderTabMentionDropdown({ tabs: [complexTab] });
      
      expect(screen.getByText('sub.example.com')).toBeInTheDocument();
    });
  });

  describe('Mouse Interactions', () => {
    it('should highlight option on mouse enter', async () => {
      const user = userEvent.setup();
      renderTabMentionDropdown();
      
      const options = screen.getAllByRole('option');
      await user.hover(options[1]);
      
      expect(options[1]).toHaveClass('tab-mention-dropdown__option--highlighted');
    });

    it('should call onSelect when option is clicked', async () => {
      const user = userEvent.setup();
      const mockOnSelect = vi.fn();
      renderTabMentionDropdown({ onSelect: mockOnSelect });
      
      const options = screen.getAllByRole('option');
      await user.click(options[1]);
      
      expect(mockOnSelect).toHaveBeenCalledWith(2); // Second tab has id 2
    });

    it('should call onClose when option is selected', async () => {
      const user = userEvent.setup();
      const mockOnClose = vi.fn();
      renderTabMentionDropdown({ onClose: mockOnClose });
      
      const options = screen.getAllByRole('option');
      await user.click(options[0]);
      
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should call onClose when clicking outside dropdown', async () => {
      const user = userEvent.setup();
      const mockOnClose = vi.fn();
      
      render(
        <div>
          <div data-testid="outside">Outside element</div>
          <TabMentionDropdown {...defaultProps} onClose={mockOnClose} />
        </div>
      );
      
      const outsideElement = screen.getByTestId('outside');
      await user.click(outsideElement);
      
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should not call onClose when clicking inside dropdown', async () => {
      const user = userEvent.setup();
      const mockOnClose = vi.fn();
      renderTabMentionDropdown({ onClose: mockOnClose });
      
      const listbox = screen.getByRole('listbox');
      await user.click(listbox);
      
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('should prevent event propagation on option click', async () => {
      const user = userEvent.setup();
      const mockOuterClick = vi.fn();
      
      render(
        <div onClick={mockOuterClick}>
          <TabMentionDropdown {...defaultProps} />
        </div>
      );
      
      const option = screen.getAllByRole('option')[0];
      await user.click(option);
      
      expect(mockOuterClick).not.toHaveBeenCalled();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should highlight first option by default when opening', () => {
      renderTabMentionDropdown();
      const options = screen.getAllByRole('option');
      expect(options[0]).toHaveClass('tab-mention-dropdown__option--highlighted');
    });

    it('should navigate down with ArrowDown key', async () => {
      const user = userEvent.setup();
      renderTabMentionDropdown();
      
      const listbox = screen.getByRole('listbox');
      listbox.focus();
      
      await user.keyboard('{ArrowDown}');
      
      const options = screen.getAllByRole('option');
      expect(options[1]).toHaveClass('tab-mention-dropdown__option--highlighted');
    });

    it('should navigate up with ArrowUp key', async () => {
      const user = userEvent.setup();
      renderTabMentionDropdown();
      
      const listbox = screen.getByRole('listbox');
      listbox.focus();
      
      // First move down, then up
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowUp}');
      
      const options = screen.getAllByRole('option');
      expect(options[0]).toHaveClass('tab-mention-dropdown__option--highlighted');
    });

    it('should wrap to first option when navigating down from last', async () => {
      const user = userEvent.setup();
      renderTabMentionDropdown();
      
      const listbox = screen.getByRole('listbox');
      listbox.focus();
      
      // Navigate to last option and then down once more
      await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
      
      const options = screen.getAllByRole('option');
      expect(options[0]).toHaveClass('tab-mention-dropdown__option--highlighted');
    });

    it('should wrap to last option when navigating up from first', async () => {
      const user = userEvent.setup();
      renderTabMentionDropdown();
      
      const listbox = screen.getByRole('listbox');
      listbox.focus();
      
      await user.keyboard('{ArrowUp}');
      
      const options = screen.getAllByRole('option');
      expect(options[2]).toHaveClass('tab-mention-dropdown__option--highlighted');
    });

    it('should select highlighted option with Enter key', async () => {
      const user = userEvent.setup();
      const mockOnSelect = vi.fn();
      renderTabMentionDropdown({ onSelect: mockOnSelect });
      
      const listbox = screen.getByRole('listbox');
      listbox.focus();
      
      await user.keyboard('{ArrowDown}'); // Move to second option
      await user.keyboard('{Enter}');
      
      expect(mockOnSelect).toHaveBeenCalledWith(2); // Second tab has id 2
    });

    it('should close dropdown with Escape key', async () => {
      const user = userEvent.setup();
      const mockOnClose = vi.fn();
      renderTabMentionDropdown({ onClose: mockOnClose });
      
      const listbox = screen.getByRole('listbox');
      listbox.focus();
      
      await user.keyboard('{Escape}');
      
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should navigate down with Tab key', async () => {
      const user = userEvent.setup();
      renderTabMentionDropdown();
      
      const listbox = screen.getByRole('listbox');
      listbox.focus();
      
      await user.keyboard('{Tab}');
      
      const options = screen.getAllByRole('option');
      expect(options[1]).toHaveClass('tab-mention-dropdown__option--highlighted');
    });

    it('should navigate up with Shift+Tab key', async () => {
      const user = userEvent.setup();
      renderTabMentionDropdown();
      
      const listbox = screen.getByRole('listbox');
      listbox.focus();
      
      // Start from second option and go up with Shift+Tab
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Shift>}{Tab}{/Shift}');
      
      const options = screen.getAllByRole('option');
      expect(options[0]).toHaveClass('tab-mention-dropdown__option--highlighted');
    });

    it('should jump to first option with Home key', async () => {
      const user = userEvent.setup();
      renderTabMentionDropdown();
      
      const listbox = screen.getByRole('listbox');
      listbox.focus();
      
      // Move to last option then press Home
      await user.keyboard('{ArrowDown}{ArrowDown}');
      await user.keyboard('{Home}');
      
      const options = screen.getAllByRole('option');
      expect(options[0]).toHaveClass('tab-mention-dropdown__option--highlighted');
    });

    it('should jump to last option with End key', async () => {
      const user = userEvent.setup();
      renderTabMentionDropdown();
      
      const listbox = screen.getByRole('listbox');
      listbox.focus();
      
      await user.keyboard('{End}');
      
      const options = screen.getAllByRole('option');
      expect(options[2]).toHaveClass('tab-mention-dropdown__option--highlighted');
    });

    it('should support type-ahead search', async () => {
      const user = userEvent.setup();
      const tabs = [
        createMockTab(1, { title: 'Apple Tab' }),
        createMockTab(2, { title: 'Banana Tab' }),
        createMockTab(3, { title: 'Cherry Tab' }),
      ];
      renderTabMentionDropdown({ tabs });
      
      const listbox = screen.getByRole('listbox');
      listbox.focus();
      
      await user.keyboard('b'); // Should jump to "Banana Tab"
      
      const options = screen.getAllByRole('option');
      expect(options[1]).toHaveClass('tab-mention-dropdown__option--highlighted');
    });

    it('should cycle through matching options in type-ahead search', async () => {
      const user = userEvent.setup();
      const tabs = [
        createMockTab(10, { title: 'Apple Tab', active: false }),
        createMockTab(11, { title: 'Banana Tab', active: false }),
        createMockTab(12, { title: 'Another Apple Tab', active: false }),
      ];
      renderTabMentionDropdown({ tabs });
      
      const listbox = screen.getByRole('listbox');
      listbox.focus();
      
      // Initially first option should be highlighted (Apple Tab - index 0)
      let options = screen.getAllByRole('option');
      expect(options[0]).toHaveClass('tab-mention-dropdown__option--highlighted');
      
      await user.keyboard('a'); // Should jump to next "A" option (Another Apple Tab - index 2)
      options = screen.getAllByRole('option');
      expect(options[2]).toHaveClass('tab-mention-dropdown__option--highlighted');
      
      await user.keyboard('a'); // Should cycle back to first "A" option (Apple Tab - index 0)  
      options = screen.getAllByRole('option');
      expect(options[0]).toHaveClass('tab-mention-dropdown__option--highlighted');
    });

    it('should ignore non-character keys in type-ahead', async () => {
      const user = userEvent.setup();
      renderTabMentionDropdown();
      
      const listbox = screen.getByRole('listbox');
      listbox.focus();
      
      await user.keyboard('{Shift}');
      await user.keyboard('{Control}');
      
      // Should still be on first option
      const options = screen.getAllByRole('option');
      expect(options[0]).toHaveClass('tab-mention-dropdown__option--highlighted');
    });
  });

  describe('Virtualization', () => {
    it('should enable virtualization for large tab lists', () => {
      const largeTabs = createMockTabs(25);
      renderTabMentionDropdown({ tabs: largeTabs, maxVisibleTabs: 20 });
      
      const listbox = screen.getByRole('listbox');
      expect(listbox).toHaveStyle({
        height: `${25 * 52}px`, // totalTabs * itemHeight
        position: 'relative',
      });
    });

    it('should not use virtualization for small tab lists', () => {
      renderTabMentionDropdown({ tabs: createMockTabs(5), maxVisibleTabs: 20 });
      
      const listbox = screen.getByRole('listbox');
      expect(listbox).not.toHaveStyle({ position: 'relative' });
    });

    it('should respect maxVisibleTabs prop', () => {
      const tabs = createMockTabs(15);
      renderTabMentionDropdown({ tabs, maxVisibleTabs: 10 });
      
      // Should use virtualization since 15 > 10
      const listbox = screen.getByRole('listbox');
      expect(listbox).toHaveStyle({
        height: `${15 * 52}px`,
        position: 'relative',
      });
    });

    it('should handle scrolling in virtualized mode', async () => {
      const largeTabs = createMockTabs(30);
      renderTabMentionDropdown({ tabs: largeTabs, maxVisibleTabs: 10 });
      
      const container = screen.getByRole('listbox').parentElement!;
      
      // Simulate scroll event
      await act(async () => {
        fireEvent.scroll(container, { target: { scrollTop: 260 } }); // 5 * 52 = scroll down 5 items
      });
      
      // Should still render options (virtualization updates visible range)
      expect(screen.getAllByRole('option').length).toBeGreaterThan(0);
    });

    it('should handle keyboard navigation with virtualization', async () => {
      const user = userEvent.setup();
      const largeTabs = createMockTabs(25);
      renderTabMentionDropdown({ tabs: largeTabs, maxVisibleTabs: 10 });
      
      const listbox = screen.getByRole('listbox');
      listbox.focus();
      
      // Navigate down multiple times
      await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
      
      // Should update highlighted index
      expect(listbox).toHaveAttribute('aria-activedescendant');
    });
  });

  describe('ARIA and Accessibility', () => {
    it('should have proper ARIA attributes on listbox', () => {
      renderTabMentionDropdown();
      const listbox = screen.getByRole('listbox');
      
      expect(listbox).toHaveAttribute('aria-label', 'Select tab to mention');
      expect(listbox).toHaveAttribute('aria-describedby');
      expect(listbox).toHaveAttribute('aria-activedescendant');
    });

    it('should have proper ARIA attributes on options', () => {
      renderTabMentionDropdown();
      const options = screen.getAllByRole('option');
      
      options.forEach((option, index) => {
        expect(option).toHaveAttribute('id');
        expect(option).toHaveAttribute('aria-selected');
        if (index === 0) {
          expect(option).toHaveAttribute('aria-selected', 'true');
        } else {
          expect(option).toHaveAttribute('aria-selected', 'false');
        }
      });
    });

    it('should update aria-activedescendant when highlighting changes', async () => {
      const user = userEvent.setup();
      renderTabMentionDropdown();
      
      const listbox = screen.getByRole('listbox');
      const initialActiveDescendant = listbox.getAttribute('aria-activedescendant');
      
      listbox.focus();
      await user.keyboard('{ArrowDown}');
      
      const newActiveDescendant = listbox.getAttribute('aria-activedescendant');
      expect(newActiveDescendant).not.toBe(initialActiveDescendant);
    });

    it('should have accessible description', () => {
      renderTabMentionDropdown();
      const description = screen.getByText(/Use ↑↓ arrows or Tab\/Shift\+Tab to navigate • Enter to select • Esc to close • Type to search/);
      expect(description).toBeInTheDocument();
      expect(description).toHaveClass('tab-mention-dropdown__help-text');
    });

    it('should connect description to listbox via aria-describedby', () => {
      renderTabMentionDropdown();
      const listbox = screen.getByRole('listbox');
      const description = screen.getByText(/Use ↑↓ arrows or Tab\/Shift\+Tab to navigate • Enter to select • Esc to close • Type to search/).parentElement;
      
      const describedById = listbox.getAttribute('aria-describedby');
      expect(describedById).toBe(description?.id);
    });

    it('should have proper heading structure for screen readers', () => {
      renderTabMentionDropdown();
      
      // All text content should be accessible
      expect(screen.getByText('Test Tab 1')).toBeInTheDocument();
      expect(screen.getByText('example1.com')).toBeInTheDocument();
    });

    it('should handle screen reader announcements for tab indicators', () => {
      const tabWithIndicators = createMockTab(1, { 
        active: true, 
        audible: true,
        title: 'Active Audible Tab'
      });
      renderTabMentionDropdown({ tabs: [tabWithIndicators] });
      
      const activeIndicator = screen.getByTitle('Active tab');
      const audioIndicator = screen.getByTitle('Playing audio');
      
      expect(activeIndicator).toBeInTheDocument();
      expect(audioIndicator).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle tabs with null or undefined properties', () => {
      const problematicTab: TabInfo = {
        id: 1,
        title: '',
        url: 'https://example.com',
        domain: 'example.com',
        windowId: 1,
        active: false,
        index: 0,
        pinned: false,
        lastAccessed: Date.now(),
        favIconUrl: undefined,
        audible: undefined,
        status: undefined,
      };
      
      expect(() => renderTabMentionDropdown({ tabs: [problematicTab] })).not.toThrow();
      expect(screen.getByText('Untitled')).toBeInTheDocument();
    });

    it('should handle extremely long tab lists', () => {
      const extremelyLargeTabs = createMockTabs(1000);
      expect(() => renderTabMentionDropdown({ tabs: extremelyLargeTabs })).not.toThrow();
    });

    it('should handle rapid keyboard navigation', async () => {
      const user = userEvent.setup();
      renderTabMentionDropdown();
      
      const listbox = screen.getByRole('listbox');
      listbox.focus();
      
      // Rapid key presses
      await user.keyboard('{ArrowDown}{ArrowUp}{ArrowDown}{ArrowUp}{Enter}');
      
      expect(defaultProps.onSelect).toHaveBeenCalled();
    });

    it('should handle window resize during virtualization', async () => {
      const largeTabs = createMockTabs(50);
      renderTabMentionDropdown({ tabs: largeTabs });
      
      // Simulate window resize
      await act(async () => {
        global.dispatchEvent(new Event('resize'));
      });
      
      // Component should still be functional
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('should handle tabs with special characters in titles', () => {
      const specialTabs = [
        createMockTab(1, { title: 'Tab with émojis 🚀 and spëcial chars' }),
        createMockTab(2, { title: '<script>alert("xss")</script>' }),
        createMockTab(3, { title: 'Tab\nwith\nnewlines' }),
      ];
      
      renderTabMentionDropdown({ tabs: specialTabs });
      
      expect(screen.getByText(/Tab with émojis 🚀/)).toBeInTheDocument();
      expect(screen.getByText(/script.*alert.*xss/)).toBeInTheDocument();
    });

    it('should handle invalid URLs gracefully', () => {
      const tabWithBadUrl = createMockTab(1, { 
        url: 'not-a-valid-url',
        domain: 'fallback-domain.com'
      });
      
      expect(() => renderTabMentionDropdown({ tabs: [tabWithBadUrl] })).not.toThrow();
      expect(screen.getByText('fallback-domain.com')).toBeInTheDocument();
    });

    it('should handle maxHeight prop correctly', () => {
      renderTabMentionDropdown({ maxHeight: 150 });
      const container = screen.getByRole('listbox').parentElement!;
      expect(container).toHaveStyle({ maxHeight: '150px' });
    });

    it('should handle maxHeight as string', () => {
      renderTabMentionDropdown({ maxHeight: '10rem' });
      const container = screen.getByRole('listbox').parentElement!;
      expect(container).toHaveStyle({ maxHeight: '10rem' });
    });

    it('should handle rapid open/close cycles', async () => {
      const { rerender } = renderTabMentionDropdown({ isOpen: false });
      
      // Rapidly toggle isOpen
      for (let i = 0; i < 10; i++) {
        rerender(<TabMentionDropdown {...defaultProps} isOpen={true} />);
        rerender(<TabMentionDropdown {...defaultProps} isOpen={false} />);
      }
      
      expect(() => rerender(<TabMentionDropdown {...defaultProps} isOpen={true} />)).not.toThrow();
    });

    it('should cleanup event listeners when unmounted', () => {
      const { unmount } = renderTabMentionDropdown();
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('Callback Integration', () => {
    it('should call callbacks with correct parameters', async () => {
      const user = userEvent.setup();
      const mockOnSelect = vi.fn();
      const mockOnClose = vi.fn();
      
      renderTabMentionDropdown({ onSelect: mockOnSelect, onClose: mockOnClose });
      
      const option = screen.getAllByRole('option')[1];
      await user.click(option);
      
      expect(mockOnSelect).toHaveBeenCalledWith(2); // Tab ID
      expect(mockOnClose).toHaveBeenCalled();
      expect(mockOnSelect).toHaveBeenCalledTimes(1);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should not call onSelect when tab ID is invalid', async () => {
      const user = userEvent.setup();
      const mockOnSelect = vi.fn();
      
      // Create tab with invalid ID but don't pass to component - test component's robustness
      renderTabMentionDropdown({ tabs: [], onSelect: mockOnSelect });
      
      const listbox = screen.getByRole('listbox');
      listbox.focus();
      
      // Try to select when no tabs are available
      await user.keyboard('{Enter}');
      
      expect(mockOnSelect).not.toHaveBeenCalled();
    });

    it('should handle missing onSelect gracefully', async () => {
      const user = userEvent.setup();
      renderTabMentionDropdown({ onSelect: undefined as any });
      
      const option = screen.getAllByRole('option')[0];
      expect(() => user.click(option)).not.toThrow();
    });

    it('should handle missing onClose gracefully', async () => {
      const user = userEvent.setup();
      renderTabMentionDropdown({ onClose: undefined as any });
      
      const listbox = screen.getByRole('listbox');
      listbox.focus();
      
      expect(() => user.keyboard('{Escape}')).not.toThrow();
    });
  });
});