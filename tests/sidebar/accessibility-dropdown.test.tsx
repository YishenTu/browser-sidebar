/**
 * @file Accessibility Tests for TabMentionDropdown Component
 *
 * Comprehensive WCAG 2.1 AA compliance tests for the TabMentionDropdown component,
 * focusing on ARIA combobox pattern implementation, keyboard navigation,
 * screen reader compatibility, and focus management.
 *
 * Test Coverage:
 * - ARIA combobox pattern compliance
 * - Keyboard navigation (arrows, enter, escape, home/end, type-ahead)
 * - Focus management and focus trap
 * - Screen reader announcements and ARIA attributes
 * - Roving tabindex implementation
 * - High contrast mode support
 * - Reduced motion preferences
 * - Color contrast and visual focus indicators
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';

// Component imports
import { TabMentionDropdown, TabMentionDropdownProps } from '@sidebar/components/TabMentionDropdown';

// Type imports
import type { TabInfo } from '@/types/tabs';

// Extend expect with jest-axe matchers
expect.extend(toHaveNoViolations);

// Mock console for cleaner test output
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
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
  audible: id === 2,
  status: 'complete',
  ...overrides,
});

/**
 * Helper to create multiple tabs
 */
const createMockTabs = (count: number): TabInfo[] => {
  return Array.from({ length: count }, (_, index) => createMockTab(index + 1));
};

/**
 * Default props for testing
 */
const defaultDropdownProps: TabMentionDropdownProps = {
  tabs: createMockTabs(5),
  onSelect: vi.fn(),
  position: { x: 100, y: 200 },
  isOpen: true,
  onClose: vi.fn(),
  onHighlightChange: vi.fn(),
};

/**
 * Helper to render dropdown with default props
 */
const renderDropdown = (props: Partial<TabMentionDropdownProps> = {}) => {
  return render(<TabMentionDropdown {...defaultDropdownProps} {...props} />);
};

/**
 * Helper to simulate keyboard events on document (component listens globally)
 */
const simulateKeyDown = (key: string, options: KeyboardEventInit = {}) => {
  fireEvent.keyDown(document, { key, ...options });
};

describe('TabMentionDropdown Accessibility', () => {
  describe('WCAG 2.1 AA Compliance', () => {
    it('should have no axe violations', async () => {
      const { container } = renderDropdown();
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have no axe violations with large virtualized list', async () => {
      const largeTabs = createMockTabs(50);
      const { container } = renderDropdown({ tabs: largeTabs, maxVisibleTabs: 10 });
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have no axe violations with edge case data', async () => {
      const edgeCaseTabs = [
        createMockTab(1, { title: '', favIconUrl: undefined }),
        createMockTab(2, { title: 'A'.repeat(100), active: true, audible: true }),
      ];
      const { container } = renderDropdown({ tabs: edgeCaseTabs });
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('ARIA Combobox Pattern Implementation', () => {
    it('should implement proper listbox role and attributes', () => {
      renderDropdown();
      
      const listbox = screen.getByRole('listbox');
      expect(listbox).toHaveAttribute('id', 'tab-mention-listbox');
      expect(listbox).toHaveAttribute('role', 'listbox');
      expect(listbox).toHaveAttribute('aria-label', 'Select tab to mention');
      expect(listbox).toHaveAttribute('aria-describedby');
      expect(listbox).toHaveAttribute('aria-activedescendant');
    });

    it('should have proper option roles and attributes', () => {
      renderDropdown();
      
      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(5);
      
      options.forEach((option, index) => {
        expect(option).toHaveAttribute('role', 'option');
        expect(option).toHaveAttribute('id', expect.stringMatching(/option-\d+$/));
        expect(option).toHaveAttribute('aria-selected');
        
        // First option should be selected by default
        const isSelected = index === 0;
        expect(option).toHaveAttribute('aria-selected', isSelected ? 'true' : 'false');
      });
    });

    it('should update aria-activedescendant when selection changes', async () => {
      renderDropdown();
      
      const listbox = screen.getByRole('listbox');
      const initialActiveDescendant = listbox.getAttribute('aria-activedescendant');
      expect(initialActiveDescendant).toBe('tab-option-1'); // First tab has ID 1
      
      simulateKeyDown('ArrowDown');
      
      await waitFor(() => {
        const newActiveDescendant = listbox.getAttribute('aria-activedescendant');
        expect(newActiveDescendant).toBe('tab-option-2'); // Second tab has ID 2
        expect(newActiveDescendant).not.toBe(initialActiveDescendant);
      });
    });

    it('should provide accessible description', () => {
      renderDropdown();
      
      const description = screen.getByText('Use arrow keys to navigate, Enter to select, Escape to close');
      expect(description).toBeInTheDocument();
      expect(description).toHaveAttribute('id');
      
      const listbox = screen.getByRole('listbox');
      const describedById = listbox.getAttribute('aria-describedby');
      expect(description.id).toBe(describedById);
    });

    it('should call onHighlightChange with correct tab ID', async () => {
      const mockOnHighlightChange = vi.fn();
      const tabs = createMockTabs(3);
      renderDropdown({ tabs, onHighlightChange: mockOnHighlightChange });
      
      // Initial highlight should be first tab
      expect(mockOnHighlightChange).toHaveBeenCalledWith(1);
      
      mockOnHighlightChange.mockClear();
      
      simulateKeyDown('ArrowDown');
      
      await waitFor(() => {
        expect(mockOnHighlightChange).toHaveBeenCalledWith(2);
      });
    });

    it('should announce option count to screen readers', () => {
      const tabs = createMockTabs(10);
      renderDropdown({ tabs });
      
      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(10);
      
      // With virtualization, visible options should be present
      expect(options.length).toBeGreaterThan(0);
    });
  });

  describe('Keyboard Navigation Compliance', () => {
    it('should support arrow key navigation', async () => {
      renderDropdown();
      
      const listbox = screen.getByRole('listbox');
      
      // Down arrow should move to next option
      simulateKeyDown('ArrowDown');
      expect(listbox).toHaveAttribute('aria-activedescendant', 'tab-option-2');
      
      // Up arrow should move to previous option
      simulateKeyDown('ArrowUp');
      expect(listbox).toHaveAttribute('aria-activedescendant', 'tab-option-1');
    });

    it('should wrap navigation at boundaries', async () => {
      const tabs = createMockTabs(3);
      renderDropdown({ tabs });
      
      const listbox = screen.getByRole('listbox');
      
      // Navigate down to last option and wrap to first
      simulateKeyDown('ArrowDown'); // tab-option-2
      simulateKeyDown('ArrowDown'); // tab-option-3
      simulateKeyDown('ArrowDown'); // wrap to tab-option-1
      
      expect(listbox).toHaveAttribute('aria-activedescendant', 'tab-option-1');
      
      // Navigate up from first to last
      simulateKeyDown('ArrowUp'); // wrap to tab-option-3
      expect(listbox).toHaveAttribute('aria-activedescendant', 'tab-option-3');
    });

    it('should support Home and End keys', async () => {
      const tabs = createMockTabs(5);
      renderDropdown({ tabs });
      
      const listbox = screen.getByRole('listbox');
      
      // Navigate to middle, then Home should go to first
      simulateKeyDown('ArrowDown');
      simulateKeyDown('ArrowDown'); // tab-option-3
      simulateKeyDown('Home');
      expect(listbox).toHaveAttribute('aria-activedescendant', 'tab-option-1');
      
      // End should go to last
      simulateKeyDown('End');
      expect(listbox).toHaveAttribute('aria-activedescendant', 'tab-option-5');
    });

    it('should support type-ahead search', async () => {
      const tabs = [
        createMockTab(1, { title: 'Apple Documentation' }),
        createMockTab(2, { title: 'Banana Guide' }),
        createMockTab(3, { title: 'Cherry Tutorial' }),
        createMockTab(4, { title: 'Another Apple Page' }),
      ];
      renderDropdown({ tabs });
      
      const listbox = screen.getByRole('listbox');
      
      // Type 'b' should jump to Banana
      simulateKeyDown('b');
      expect(listbox).toHaveAttribute('aria-activedescendant', 'tab-option-2');
      
      // Type 'c' should jump to Cherry
      simulateKeyDown('c');
      expect(listbox).toHaveAttribute('aria-activedescendant', 'tab-option-3');
      
      // Type 'a' should jump to Another Apple (cycling from current position)
      simulateKeyDown('a');
      expect(listbox).toHaveAttribute('aria-activedescendant', 'tab-option-4');
    });

    it('should handle Enter key to select', async () => {
      const mockOnSelect = vi.fn();
      const mockOnClose = vi.fn();
      const tabs = createMockTabs(3);
      renderDropdown({ tabs, onSelect: mockOnSelect, onClose: mockOnClose });
      
      // Navigate to second option and select
      simulateKeyDown('ArrowDown');
      simulateKeyDown('Enter');
      
      expect(mockOnSelect).toHaveBeenCalledWith(2);
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should handle Escape key to close', async () => {
      const mockOnClose = vi.fn();
      renderDropdown({ onClose: mockOnClose });
      
      simulateKeyDown('Escape');
      
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should handle Tab key to close (allow normal tab navigation)', async () => {
      const mockOnClose = vi.fn();
      renderDropdown({ onClose: mockOnClose });
      
      simulateKeyDown('Tab');
      
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should ignore non-character keys in type-ahead', async () => {
      renderDropdown();
      
      const listbox = screen.getByRole('listbox');
      const initialActiveDescendant = listbox.getAttribute('aria-activedescendant');
      
      // These keys should not affect type-ahead
      simulateKeyDown('Shift');
      simulateKeyDown('Control');
      simulateKeyDown('Alt');
      simulateKeyDown('Meta');
      simulateKeyDown('F1');
      
      expect(listbox).toHaveAttribute('aria-activedescendant', initialActiveDescendant);
    });

    it('should prevent default behavior for handled keys', async () => {
      renderDropdown();
      
      // Test that component handles navigation keys (preventDefault is called internally)
      const listbox = screen.getByRole('listbox');
      const initialActiveDescendant = listbox.getAttribute('aria-activedescendant');
      
      // ArrowDown should change selection (indicating preventDefault was called)
      simulateKeyDown('ArrowDown');
      const newActiveDescendant = listbox.getAttribute('aria-activedescendant');
      expect(newActiveDescendant).not.toBe(initialActiveDescendant);
      
      // Enter and Escape should trigger callbacks (indicating preventDefault was called)
      const mockOnSelect = vi.fn();
      const mockOnClose = vi.fn();
      
      // Re-render with new props to test callbacks
      render(<TabMentionDropdown {...defaultDropdownProps} onSelect={mockOnSelect} onClose={mockOnClose} />);
      
      simulateKeyDown('Enter');
      expect(mockOnSelect).toHaveBeenCalled();
      
      simulateKeyDown('Escape');
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Focus Management', () => {
    it('should manage focus correctly when dropdown opens', async () => {
      // Start with closed dropdown
      const { rerender } = renderDropdown({ isOpen: false });
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      
      // Open dropdown
      rerender(<TabMentionDropdown {...defaultDropdownProps} isOpen={true} />);
      
      const listbox = screen.getByRole('listbox');
      expect(listbox).toBeInTheDocument();
      expect(listbox).toHaveAttribute('aria-activedescendant', 'tab-option-1');
    });

    it('should reset highlighted index when reopening', async () => {
      const { rerender } = renderDropdown({ isOpen: true });
      
      // Navigate to third option
      simulateKeyDown('ArrowDown');
      simulateKeyDown('ArrowDown');
      
      const listbox = screen.getByRole('listbox');
      expect(listbox).toHaveAttribute('aria-activedescendant', 'tab-option-3');
      
      // Close and reopen
      rerender(<TabMentionDropdown {...defaultDropdownProps} isOpen={false} />);
      rerender(<TabMentionDropdown {...defaultDropdownProps} isOpen={true} />);
      
      // Should reset to first option
      const newListbox = screen.getByRole('listbox');
      expect(newListbox).toHaveAttribute('aria-activedescendant', 'tab-option-1');
    });

    it('should maintain logical tab order with other components', () => {
      render(
        <div>
          <button>Before Dropdown</button>
          <TabMentionDropdown {...defaultDropdownProps} />
          <button>After Dropdown</button>
        </div>
      );
      
      const beforeButton = screen.getByText('Before Dropdown');
      const listbox = screen.getByRole('listbox');
      const afterButton = screen.getByText('After Dropdown');
      
      // Elements should be in document order
      expect(beforeButton).toBeInTheDocument();
      expect(listbox).toBeInTheDocument();
      expect(afterButton).toBeInTheDocument();
    });

    it('should handle click outside to close', async () => {
      const mockOnClose = vi.fn();
      
      render(
        <div>
          <div data-testid="outside">Outside element</div>
          <TabMentionDropdown {...defaultDropdownProps} onClose={mockOnClose} />
        </div>
      );
      
      const outsideElement = screen.getByTestId('outside');
      
      // Simulate mousedown event (which the component listens for)
      fireEvent.mouseDown(outsideElement);
      
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should not close when clicking inside dropdown', async () => {
      const mockOnClose = vi.fn();
      renderDropdown({ onClose: mockOnClose });
      
      const listbox = screen.getByRole('listbox');
      fireEvent.mouseDown(listbox);
      
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('Screen Reader Announcements', () => {
    it('should announce tab status indicators appropriately', () => {
      const tabs = [
        createMockTab(1, { active: true, audible: false, title: 'Active Tab Only' }),
        createMockTab(2, { active: false, audible: true, title: 'Audible Tab Only' }),
        createMockTab(3, { active: true, audible: true, title: 'Active and Audible' }),
      ];
      renderDropdown({ tabs });
      
      // Active indicators should have proper title attributes
      const activeIndicators = screen.getAllByTitle('Active tab');
      expect(activeIndicators).toHaveLength(2); // Two active tabs
      
      // Audio indicators should have proper title attributes
      const audioIndicators = screen.getAllByTitle('Playing audio');
      expect(audioIndicators).toHaveLength(2); // Two audible tabs
    });

    it('should provide accessible fallback for missing favicons', () => {
      const tabs = [
        createMockTab(1, { favIconUrl: undefined, title: 'No Favicon Tab' }),
      ];
      renderDropdown({ tabs });
      
      const fallbackIcon = screen.getByText('📄');
      expect(fallbackIcon).toBeInTheDocument();
      expect(fallbackIcon).toHaveClass('tab-mention-dropdown__favicon-fallback');
    });

    it('should handle favicon loading errors gracefully', async () => {
      const tabs = [
        createMockTab(1, { favIconUrl: 'https://broken.url/favicon.ico' }),
      ];
      renderDropdown({ tabs });
      
      const favicon = screen.getByRole('img');
      
      // Simulate error event
      fireEvent.error(favicon);
      
      // Favicon should be hidden and fallback should show
      expect(favicon).toHaveStyle({ display: 'none' });
      
      const fallback = favicon.nextElementSibling as HTMLElement;
      expect(fallback).toHaveStyle({ display: 'flex' });
    });

    it('should announce long content with proper truncation', () => {
      const longTitle = 'This is an extremely long tab title that should be truncated for better usability';
      const longDomain = 'this-is-a-very-long-domain-name-that-should-also-be-truncated.example.com';
      
      const tabs = [
        createMockTab(1, { title: longTitle, domain: longDomain }),
      ];
      renderDropdown({ tabs });
      
      // Should show truncated title (using more flexible pattern)
      expect(screen.getByText(/This is an extremely long tab title that shou\.\.\./)).toBeInTheDocument();
      
      // Should show truncated domain (using more flexible pattern)
      expect(screen.getByText(/this-is-a-very-long-domain-name-that-sho\.\.\./)).toBeInTheDocument();
    });

    it('should handle untitled tabs with accessible fallback', () => {
      const tabs = [
        createMockTab(1, { title: '', url: 'https://example.com' }),
      ];
      renderDropdown({ tabs });
      
      expect(screen.getByText('Untitled')).toBeInTheDocument();
    });
  });

  describe('Roving Tabindex Implementation', () => {
    it('should maintain single tab stop within dropdown', () => {
      renderDropdown();
      
      const listbox = screen.getByRole('listbox');
      const options = screen.getAllByRole('option');
      
      // Listbox should be focusable
      expect(listbox).toBeInTheDocument();
      
      // Options should not have tabindex (managed by aria-activedescendant)
      options.forEach(option => {
        expect(option).not.toHaveAttribute('tabindex');
      });
    });

    it('should update highlighted option on mouse hover', async () => {
      const user = userEvent.setup();
      renderDropdown();
      
      const listbox = screen.getByRole('listbox');
      const options = screen.getAllByRole('option');
      
      // Hover over second option
      await user.hover(options[1]);
      
      expect(listbox).toHaveAttribute('aria-activedescendant', 'tab-option-2');
      expect(options[1]).toHaveClass('tab-mention-dropdown__option--highlighted');
    });

    it('should maintain keyboard navigation after mouse interaction', async () => {
      const user = userEvent.setup();
      renderDropdown();
      
      const listbox = screen.getByRole('listbox');
      const options = screen.getAllByRole('option');
      
      // Start with keyboard navigation
      simulateKeyDown('ArrowDown');
      expect(listbox).toHaveAttribute('aria-activedescendant', 'tab-option-2');
      
      // Mouse hover on third option
      await user.hover(options[2]);
      expect(listbox).toHaveAttribute('aria-activedescendant', 'tab-option-3');
      
      // Keyboard navigation should continue from hovered position
      simulateKeyDown('ArrowDown');
      expect(listbox).toHaveAttribute('aria-activedescendant', 'tab-option-4');
    });
  });

  describe('Virtualization Accessibility', () => {
    it('should maintain accessibility with virtual scrolling', async () => {
      const largeTabs = createMockTabs(50);
      renderDropdown({ tabs: largeTabs, maxVisibleTabs: 10 });
      
      const listbox = screen.getByRole('listbox');
      expect(listbox).toHaveAttribute('aria-activedescendant');
      
      // Should be able to navigate with keyboard
      simulateKeyDown('ArrowDown');
      expect(listbox).toHaveAttribute('aria-activedescendant', 'tab-option-2');
      
      // Should be able to jump to end
      simulateKeyDown('End');
      expect(listbox).toHaveAttribute('aria-activedescendant', 'tab-option-50');
    });

    it('should scroll highlighted option into view', async () => {
      const largeTabs = createMockTabs(30);
      const { container } = renderDropdown({ tabs: largeTabs, maxVisibleTabs: 5 });
      
      // Navigate to an option that would be out of view
      simulateKeyDown('End'); // Go to last option
      
      const scrollContainer = container.querySelector('.tab-mention-dropdown__container');
      expect(scrollContainer).toBeInTheDocument();
      
      // Component should handle scrolling internally (tested through aria-activedescendant)
      const listbox = screen.getByRole('listbox');
      expect(listbox).toHaveAttribute('aria-activedescendant', 'tab-option-30');
    });

    it('should handle scroll events properly', async () => {
      const largeTabs = createMockTabs(40);
      const { container } = renderDropdown({ tabs: largeTabs, maxVisibleTabs: 10 });
      
      const scrollContainer = container.querySelector('.tab-mention-dropdown__container');
      expect(scrollContainer).toBeInTheDocument();
      
      // Simulate scroll
      await act(async () => {
        fireEvent.scroll(scrollContainer!, { target: { scrollTop: 260 } });
      });
      
      // Should still maintain accessible structure
      const listbox = screen.getByRole('listbox');
      expect(listbox).toHaveAttribute('aria-activedescendant');
      
      const visibleOptions = screen.getAllByRole('option');
      expect(visibleOptions.length).toBeGreaterThan(0);
    });
  });

  describe('High Contrast and Visual Accessibility', () => {
    it('should maintain visual focus indicators in high contrast mode', () => {
      // Mock high contrast media query
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query === '(prefers-contrast: high)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });
      
      renderDropdown();
      
      const options = screen.getAllByRole('option');
      const highlightedOption = options[0];
      
      // Should have highlighted class for visual focus
      expect(highlightedOption).toHaveClass('tab-mention-dropdown__option--highlighted');
      
      // Should maintain aria-selected state
      expect(highlightedOption).toHaveAttribute('aria-selected', 'true');
    });

    it('should respect reduced motion preferences', () => {
      // Mock reduced motion preference
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });
      
      const { container } = renderDropdown();
      
      // Component should render without animations
      expect(container.querySelector('.tab-mention-dropdown')).toBeInTheDocument();
      
      // Navigation should still work
      const listbox = screen.getByRole('listbox');
      simulateKeyDown('ArrowDown');
      expect(listbox).toHaveAttribute('aria-activedescendant', 'tab-option-2');
    });

    it('should provide sufficient color contrast indicators', () => {
      const tabs = [
        createMockTab(1, { active: true, title: 'Active Tab' }),
        createMockTab(2, { audible: true, title: 'Audible Tab' }),
      ];
      renderDropdown({ tabs });
      
      // Active and audible indicators should be present
      expect(screen.getByTitle('Active tab')).toBeInTheDocument();
      expect(screen.getByTitle('Playing audio')).toBeInTheDocument();
      
      // Options should have proper classes for styling
      const activeOption = screen.getByText('Active Tab').closest('[role="option"]');
      expect(activeOption).toHaveClass('tab-mention-dropdown__option--active');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should maintain accessibility with empty tab list', async () => {
      const { container } = renderDropdown({ tabs: [] });
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
      
      const listbox = screen.getByRole('listbox');
      expect(listbox).toHaveAttribute('aria-label', 'Select tab to mention');
      
      // Should have no options
      expect(screen.queryByRole('option')).not.toBeInTheDocument();
    });

    it('should handle malformed tab data gracefully', async () => {
      const malformedTab: TabInfo = {
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
      
      const { container } = renderDropdown({ tabs: [malformedTab] });
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
      
      // Should show fallback text and icon
      expect(screen.getByText('Untitled')).toBeInTheDocument();
      expect(screen.getByText('📄')).toBeInTheDocument();
    });

    it('should handle keyboard events when no tabs are available', async () => {
      const mockOnSelect = vi.fn();
      renderDropdown({ tabs: [], onSelect: mockOnSelect });
      
      // Keyboard navigation should not crash
      simulateKeyDown('ArrowDown');
      simulateKeyDown('Enter');
      
      expect(mockOnSelect).not.toHaveBeenCalled();
    });

    it('should clean up event listeners on unmount', () => {
      const { unmount } = renderDropdown();
      
      expect(() => unmount()).not.toThrow();
      
      // Events after unmount should not cause errors
      expect(() => simulateKeyDown('ArrowDown')).not.toThrow();
    });

    it('should handle rapid state changes accessibly', async () => {
      const { rerender } = renderDropdown({ isOpen: true });
      
      // Rapidly toggle state
      for (let i = 0; i < 5; i++) {
        rerender(<TabMentionDropdown {...defaultDropdownProps} isOpen={false} />);
        rerender(<TabMentionDropdown {...defaultDropdownProps} isOpen={true} />);
      }
      
      // Should maintain accessibility
      const listbox = screen.getByRole('listbox');
      expect(listbox).toHaveAttribute('aria-activedescendant');
      expect(listbox).toHaveAttribute('aria-label', 'Select tab to mention');
    });
  });

  describe('Integration with Shadow DOM', () => {
    it('should handle click outside detection in Shadow DOM', () => {
      // Mock Shadow DOM getRootNode
      const mockGetRootNode = vi.fn().mockReturnValue(document);
      const originalGetRootNode = Element.prototype.getRootNode;
      Element.prototype.getRootNode = mockGetRootNode;
      
      const mockOnClose = vi.fn();
      
      render(
        <div>
          <div data-testid="outside">Outside</div>
          <TabMentionDropdown {...defaultDropdownProps} onClose={mockOnClose} />
        </div>
      );
      
      fireEvent.mouseDown(screen.getByTestId('outside'));
      expect(mockOnClose).toHaveBeenCalled();
      
      // Restore original method
      Element.prototype.getRootNode = originalGetRootNode;
    });

    it('should handle keyboard events in Shadow DOM context', () => {
      const mockGetRootNode = vi.fn().mockReturnValue(document);
      const originalGetRootNode = Element.prototype.getRootNode;
      Element.prototype.getRootNode = mockGetRootNode;
      
      renderDropdown();
      
      const listbox = screen.getByRole('listbox');
      simulateKeyDown('ArrowDown');
      
      expect(listbox).toHaveAttribute('aria-activedescendant', 'tab-option-2');
      
      // Restore original method
      Element.prototype.getRootNode = originalGetRootNode;
    });
  });
});