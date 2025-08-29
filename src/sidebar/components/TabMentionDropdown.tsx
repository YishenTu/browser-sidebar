import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { TabInfo } from '@/types/tabs';
import { getFaviconUrlSync } from '@/sidebar/utils/favicon';
import '../styles/4-features/tab-mention-dropdown.css';

export interface TabMentionDropdownProps {
  /** Array of tab information objects */
  tabs: TabInfo[];
  /** Callback when a tab is selected */
  onSelect: (tabId: number) => void;
  /** Position object with x and y coordinates for absolute positioning */
  position: {
    x: number;
    y?: number;
    /** Optional bottom offset (preferred) to keep dropdown above the input */
    bottom?: number;
    // Optional explicit width to match input
    width?: number;
  };
  /** Whether the dropdown is open/visible */
  isOpen: boolean;
  /** Callback when dropdown should be closed */
  onClose: () => void;
  /** Custom CSS class */
  className?: string;
  /** Maximum number of tabs to show before virtualizing */
  maxVisibleTabs?: number;
  /** Maximum height for the dropdown menu */
  maxHeight?: number | string;
  /** Callback when highlighted item changes (for ARIA activedescendant) */
  onHighlightChange?: (tabId: number | null) => void;
}

/**
 * TabMentionDropdown Component
 *
 * A specialized dropdown for selecting browser tabs with @ mention functionality.
 * Features full accessibility with ARIA compliance, keyboard navigation, and
 * virtualization for large tab lists. Shows favicon, title, and domain for each tab.
 */
export const TabMentionDropdown: React.FC<TabMentionDropdownProps> = ({
  tabs,
  onSelect,
  position,
  isOpen,
  onClose,
  className = '',
  maxVisibleTabs = 20,
  maxHeight = 300,
  onHighlightChange,
}) => {
  const [highlightedIndex, setHighlightedIndex] = useState(-1); // Start with no selection for accessibility
  const [virtualizedRange, setVirtualizedRange] = useState<{ start: number; end: number }>({
    start: 0,
    end: Math.min(tabs.length, maxVisibleTabs),
  });

  const menuRef = useRef<HTMLUListElement>(null);
  const optionRefs = useRef<(HTMLLIElement | null)[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // const menuId = useId();

  // Determine if virtualization is needed
  const shouldVirtualize = tabs.length > maxVisibleTabs;

  // Virtual scrolling calculations
  const itemHeight = 24; // Extra compact rows
  const containerHeight = Math.min(tabs.length * itemHeight, maxHeight as number);
  const scrollTop = scrollContainerRef.current?.scrollTop || 0;
  const visibleStart = Math.floor(scrollTop / itemHeight);
  const visibleEnd = Math.min(
    visibleStart + Math.ceil(containerHeight / itemHeight) + 1,
    tabs.length
  );

  // Update virtualization range when needed
  useEffect(() => {
    if (shouldVirtualize) {
      setVirtualizedRange({ start: visibleStart, end: visibleEnd });
    }
  }, [shouldVirtualize, visibleStart, visibleEnd]);

  // Get visible tabs for rendering
  const visibleTabs = useMemo(() => {
    if (!shouldVirtualize) {
      return tabs.map((tab, index) => ({ tab, originalIndex: index }));
    }

    return tabs
      .slice(virtualizedRange.start, virtualizedRange.end)
      .map((tab, index) => ({ tab, originalIndex: virtualizedRange.start + index }));
  }, [tabs, shouldVirtualize, virtualizedRange]);

  const handleSelect = useCallback(
    (tabId: number) => {
      onSelect(tabId);
      onClose();
    },
    [onSelect, onClose]
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: Event) => {
      const mouseEvent = event as MouseEvent;
      const target = mouseEvent.target as Node;

      // Check if click is outside the dropdown menu
      if (menuRef.current && !menuRef.current.contains(target)) {
        onClose();
      }
    };

    // Use Shadow DOM root or document
    const rootNode = (menuRef.current?.getRootNode() || document) as Document | ShadowRoot;
    rootNode.addEventListener('mousedown', handleClickOutside);
    return () => {
      rootNode.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: Event) => {
      const keyboardEvent = event as KeyboardEvent;

      switch (keyboardEvent.key) {
        case 'ArrowDown':
          keyboardEvent.preventDefault();
          keyboardEvent.stopPropagation(); // Prevent input from seeing this
          setHighlightedIndex(prev => {
            // If no item is highlighted, start at the first item
            if (prev === -1) return 0;
            // Otherwise, move to next item or wrap to beginning
            return prev < tabs.length - 1 ? prev + 1 : 0;
          });
          break;

        case 'ArrowUp':
          keyboardEvent.preventDefault();
          keyboardEvent.stopPropagation(); // Prevent input from seeing this
          setHighlightedIndex(prev => {
            // If no item is highlighted, start at the last item
            if (prev === -1) return tabs.length - 1;
            // Otherwise, move to previous item or wrap to end
            return prev > 0 ? prev - 1 : tabs.length - 1;
          });
          break;

        case 'Enter':
          keyboardEvent.preventDefault();
          keyboardEvent.stopPropagation(); // Prevent form submission
          if (highlightedIndex >= 0 && highlightedIndex < tabs.length) {
            const selectedTab = tabs[highlightedIndex];
            if (selectedTab) {
              handleSelect(selectedTab.id);
            }
          }
          break;

        case 'Escape':
          keyboardEvent.preventDefault();
          keyboardEvent.stopPropagation(); // Prevent sidebar from closing
          onClose();
          break;

        case 'Tab':
          keyboardEvent.preventDefault();
          keyboardEvent.stopPropagation(); // Prevent input from seeing this
          if (keyboardEvent.shiftKey) {
            // Shift+Tab: Navigate up
            setHighlightedIndex(prev => {
              if (prev === -1) return tabs.length - 1;
              return prev > 0 ? prev - 1 : tabs.length - 1;
            });
          } else {
            // Tab: Navigate down
            setHighlightedIndex(prev => {
              if (prev === -1) return 0;
              return prev < tabs.length - 1 ? prev + 1 : 0;
            });
          }
          break;

        case 'Home':
          keyboardEvent.preventDefault();
          keyboardEvent.stopPropagation();
          setHighlightedIndex(0);
          break;

        case 'End':
          keyboardEvent.preventDefault();
          keyboardEvent.stopPropagation();
          setHighlightedIndex(tabs.length - 1);
          break;

        default: {
          // Type-ahead search by tab title
          const char = keyboardEvent.key.toLowerCase();
          if (char.length === 1) {
            const startIndex = highlightedIndex + 1;
            const matchIndex = tabs.findIndex((_, i) => {
              const index = (startIndex + i) % tabs.length;
              return tabs[index]?.title.toLowerCase().startsWith(char);
            });

            if (matchIndex !== -1) {
              setHighlightedIndex((startIndex + matchIndex) % tabs.length);
            }
          }
          break;
        }
      }
    };

    const rootNode = (menuRef.current?.getRootNode() || document) as Document | ShadowRoot;
    // Use capture phase to intercept events before input handlers
    rootNode.addEventListener('keydown', handleKeyDown, true);
    return () => rootNode.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, highlightedIndex, tabs, handleSelect, onClose]);

  // Scroll highlighted option into view
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && shouldVirtualize) {
      const targetScrollTop = highlightedIndex * itemHeight;
      const currentScrollTop = scrollContainerRef.current?.scrollTop || 0;
      const containerHeight = scrollContainerRef.current?.clientHeight || 0;

      if (targetScrollTop < currentScrollTop) {
        scrollContainerRef.current?.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
      } else if (targetScrollTop + itemHeight > currentScrollTop + containerHeight) {
        const newScrollTop = targetScrollTop - containerHeight + itemHeight;
        scrollContainerRef.current?.scrollTo({ top: newScrollTop, behavior: 'smooth' });
      }
    } else if (isOpen && highlightedIndex >= 0) {
      // Non-virtualized scrolling
      const option = optionRefs.current[highlightedIndex];
      if (option && scrollContainerRef.current) {
        const optionRect = option.getBoundingClientRect();
        const containerRect = scrollContainerRef.current.getBoundingClientRect();

        if (optionRect.bottom > containerRect.bottom) {
          option.scrollIntoView({ block: 'end', behavior: 'smooth' });
        } else if (optionRect.top < containerRect.top) {
          option.scrollIntoView({ block: 'start', behavior: 'smooth' });
        }
      }
    }
  }, [highlightedIndex, isOpen, shouldVirtualize]);

  // Reset highlighted index when opening
  useEffect(() => {
    if (isOpen) {
      setHighlightedIndex(-1); // Start with no selection for accessibility
    }
  }, [isOpen]);

  // Notify parent of highlight changes
  useEffect(() => {
    if (onHighlightChange && isOpen && tabs.length > 0) {
      const highlightedTab = tabs[highlightedIndex];
      onHighlightChange(highlightedTab?.id || null);
    }
  }, [highlightedIndex, isOpen, tabs, onHighlightChange]);

  const handleScroll = useCallback(() => {
    if (!shouldVirtualize) return;

    const scrollTop = scrollContainerRef.current?.scrollTop || 0;
    const newVisibleStart = Math.floor(scrollTop / itemHeight);
    const newVisibleEnd = Math.min(
      newVisibleStart + Math.ceil(containerHeight / itemHeight) + 1,
      tabs.length
    );

    setVirtualizedRange({ start: newVisibleStart, end: newVisibleEnd });
  }, [shouldVirtualize, containerHeight, tabs.length]);

  const renderTabOption = useCallback(
    (tab: TabInfo, originalIndex: number, isHighlighted: boolean) => {
      const truncateText = (text: string, maxLength: number) => {
        return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
      };

      return (
        <li
          key={tab.id}
          ref={shouldVirtualize ? undefined : el => (optionRefs.current[originalIndex] = el)}
          id={`tab-option-${tab.id}`}
          role="option"
          aria-selected={isHighlighted}
          className={`tab-mention-dropdown__option ${
            isHighlighted ? 'tab-mention-dropdown__option--highlighted' : ''
          } ${tab.active ? 'tab-mention-dropdown__option--active' : ''}`}
          onClick={e => {
            e.preventDefault();
            e.stopPropagation();
            setHighlightedIndex(originalIndex);
            handleSelect(tab.id);
          }}
          onMouseEnter={() => setHighlightedIndex(originalIndex)}
          style={
            shouldVirtualize
              ? {
                  position: 'absolute',
                  top: originalIndex * itemHeight,
                  left: 0,
                  right: 0,
                  height: itemHeight,
                }
              : undefined
          }
        >
          {/* Style similar to collapsed ContentPreview header */}
          <div className="tab-mention-dropdown__option-content">
            <div className="tab-mention-dropdown__header-main">
              <div className="tab-mention-dropdown__title-wrapper">
                <img
                  src={getFaviconUrlSync(tab.url, tab.favIconUrl, { size: 16 }).url}
                  alt=""
                  className="tab-mention-dropdown__favicon-img"
                  width="16"
                  height="16"
                  onError={e => {
                    // Use fallback from favicon utility
                    const fallback = getFaviconUrlSync('', undefined, { size: 16 });
                    (e.target as HTMLImageElement).src = fallback.url;
                  }}
                />
                <span className="tab-mention-dropdown__title">
                  {truncateText(tab.title || 'Untitled', 50)}
                </span>
              </div>
            </div>
            {/* Audio indicator only */}
            {tab.audible && (
              <div className="tab-mention-dropdown__indicators">
                <span className="tab-mention-dropdown__audio-indicator" title="Playing audio">
                  🔊
                </span>
              </div>
            )}
          </div>
        </li>
      );
    },
    [handleSelect, shouldVirtualize]
  );

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={`tab-mention-dropdown ${className}`}
      style={{
        // Position the wrapper div
        position: 'fixed',
        left: `${position.x}px`,
        ...(position.bottom !== undefined
          ? { bottom: `${position.bottom}px` }
          : { top: `${position.y}px` }),
        // Ensure it sits on top of everything in the overlay
        zIndex: 2147483647,
        // If width provided, match the input width
        width: position.width ? `${position.width}px` : undefined,
      }}
    >
      <ul
        ref={el => {
          menuRef.current = el;
          scrollContainerRef.current = el;
        }}
        id="tab-mention-listbox"
        role="listbox"
        aria-label="Select tab to mention"
        aria-activedescendant={
          highlightedIndex >= 0 && tabs[highlightedIndex]
            ? `tab-option-${tabs[highlightedIndex].id}`
            : undefined
        }
        className="tab-mention-dropdown__menu"
        style={{
          // Override default positioning since parent is already positioned
          position: 'relative',
          top: 'auto',
          left: 'auto',
          right: 'auto',
          ...(shouldVirtualize
            ? {
                // Visible height should be clamped to maxHeight; total scroll height is provided by absolute items
                height: Math.min(
                  tabs.length * itemHeight,
                  typeof maxHeight === 'number' ? maxHeight : Number(maxHeight)
                ),
              }
            : {}),
          maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight,
          // Make menu width follow wrapper (input) width if provided
          width: position.width ? '100%' : undefined,
          minWidth: position.width ? undefined : '320px',
          maxWidth: position.width ? 'none' : '500px',
          margin: 0,
        }}
        onMouseLeave={() => setHighlightedIndex(-1)}
        onScroll={shouldVirtualize ? handleScroll : undefined}
      >
        {tabs.length === 0 ? (
          <li role="presentation" className="tab-mention-dropdown__empty">
            No tabs found. Keep typing to search.
          </li>
        ) : (
          visibleTabs.map(({ tab, originalIndex }) =>
            renderTabOption(tab, originalIndex, originalIndex === highlightedIndex)
          )
        )}
      </ul>
    </div>
  );
};

export default TabMentionDropdown;
