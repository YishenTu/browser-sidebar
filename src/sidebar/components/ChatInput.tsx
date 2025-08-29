import React, { useState, useCallback, useRef, useEffect } from 'react';
import { TextArea, TextAreaProps, CancelIcon } from '@ui/index';
import { useTabMention } from '@hooks/useTabMention';
import { TabMentionDropdown } from './TabMentionDropdown';
import { TabErrorBoundary } from './TabErrorBoundary';
// import { TabChip } from './TabChip';
import { calculateCaretDropdownPosition } from '@sidebar/utils/dropdownPosition';
import type { TabInfo, TabContent } from '@/types/tabs';

export interface ChatInputProps extends Omit<TextAreaProps, 'onKeyDown' | 'value' | 'onChange'> {
  /** Callback fired when message is sent */
  onSend: (message: string) => void;
  /** Callback fired when a tab is selected via @ mention */
  onMentionSelectTab?: (tabId: number) => void;
  /** Current message value (controlled) */
  value?: string;
  /** Default message value (uncontrolled) */
  defaultValue?: string;
  /** Callback fired when message changes */
  onChange?: (message: string) => void;
  /** Whether the component is in loading state */
  loading?: boolean;
  /** Callback fired when user cancels current operation */
  onCancel?: () => void;
  /** Whether to clear input after successful send */
  clearOnSend?: boolean;
  /** Cancel button label */
  cancelButtonLabel?: string;
  /** Aria label for the textarea */
  ariaLabel?: string;
  /** Additional CSS classes for the container */
  className?: string;
  /** Available tabs for @ mention functionality */
  availableTabs?: TabInfo[];
  /** Whether @ mention functionality is enabled */
  enableMentions?: boolean;
  /** Loaded tabs to display as chips */
  loadedTabs?: Record<number, TabContent>;
  /** Callback fired when a tab chip is removed */
  onTabRemove?: (tabId: number) => void;
}

/**
 * ChatInput Component
 *
 * A simplified chat input component with TextArea integration, send functionality,
 * keyboard shortcuts, and character counter. Contains only essential controls.
 */
export const ChatInput = React.forwardRef<HTMLTextAreaElement, ChatInputProps>(
  (
    {
      onSend,
      value,
      defaultValue,
      onChange,
      loading = false,
      onCancel,
      clearOnSend = true,
      cancelButtonLabel = 'Cancel',
      ariaLabel = 'Chat message input',
      className,
      placeholder = 'Type your message here... (use @ to mention tabs)',
      availableTabs = [],
      enableMentions = true,
      onTabRemove: _onTabRemove,
      onMentionSelectTab,
      ...textAreaProps
    },
    ref
  ) => {
    // Internal state for uncontrolled mode
    const [internalValue, setInternalValue] = useState(defaultValue || '');
    // const theme = useSettingsStore(state => state.settings.theme); // Not used after simplification

    // Determine if we're in controlled mode
    const isControlled = value !== undefined;
    const currentValue = isControlled ? value : internalValue;

    // Track if we're currently sending to prevent double submission
    const [isSending, setIsSending] = useState(false);

    // Ref for textarea
    const textAreaRef = useRef<HTMLTextAreaElement>(null);

    // @ Mention functionality state
    const [dropdownPosition, setDropdownPosition] = useState<{
      x: number;
      y: number;
      width?: number;
    } | null>(null);
    const [filteredTabs, setFilteredTabs] = useState<TabInfo[]>([]);
    const [highlightedTabId, setHighlightedTabId] = useState<number | null>(null);

    // @ Mention hook
    const { mention, showDropdown, detectMention, clearMention } = useTabMention({
      enabled: enableMentions,
    });

    // Merge refs
    React.useImperativeHandle(ref, () => textAreaRef.current!, []);

    // Filter tabs based on mention query
    const filterTabsByQuery = useCallback(
      (query: string): TabInfo[] => {
        if (!query.trim()) {
          return availableTabs.slice(0, 10); // Show first 10 tabs if no query
        }

        const lowerQuery = query.toLowerCase();
        return availableTabs
          .filter(
            tab =>
              tab.title.toLowerCase().includes(lowerQuery) ||
              tab.domain.toLowerCase().includes(lowerQuery) ||
              tab.url.toLowerCase().includes(lowerQuery)
          )
          .slice(0, 10); // Limit to 10 results
      },
      [availableTabs]
    );

    // Handle cursor position change for mention detection
    const handleCursorPositionChange = useCallback(() => {
      const textarea = textAreaRef.current;
      if (!textarea || !enableMentions) {
        return;
      }

      const cursorPosition = textarea.selectionStart || 0;
      // Call detectMention which returns the immediate result
      const detectedMention = detectMention(currentValue, cursorPosition);

      // Use the immediate detection result, not the hook state
      if (detectedMention) {
        // Filter tabs based on query
        const filtered = filterTabsByQuery(detectedMention.query);
        setFilteredTabs(filtered);

        // Calculate dropdown position (above input)
        try {
          // Align dropdown with the bordered input container rather than the textarea
          const containerEl = textarea.closest('.chat-input__main') as HTMLElement | null;
          const rect = (containerEl || textarea).getBoundingClientRect();
          // Constants synced with dropdown CSS (for future height calculation)
          // const ROW_HEIGHT = 28; // must match .tab-mention-dropdown__option min-height
          // const PADDING_VERTICAL = 8; // menu padding 4 top + 4 bottom
          // const BORDER = 2; // 1px top + 1px bottom
          // const MAX_HEIGHT = 240; // visual cap for menu height
          // const estimatedHeight = Math.min(filtered.length * ROW_HEIGHT + PADDING_VERTICAL + BORDER, MAX_HEIGHT);
          const x = rect.left;
          const gap = 6;
          // Use fixed-position bottom offset so the dropdown bottom aligns above input, independent of its actual height
          const bottom = Math.max(8, window.innerHeight - rect.top + gap);
          setDropdownPosition({ x, bottom, width: rect.width });
        } catch (error) {
          setDropdownPosition(null);
        }
      } else {
        setFilteredTabs([]);
        setDropdownPosition(null);
      }
    }, [
      currentValue,
      detectMention,
      filterTabsByQuery,
      enableMentions,
      calculateCaretDropdownPosition,
    ]);

    // Handle value changes
    const handleValueChange = useCallback(
      (newValue: string) => {
        if (!isControlled) {
          setInternalValue(newValue);
        }
        onChange?.(newValue);
      },
      [isControlled, onChange]
    );

    // Handle textarea change
    const handleTextAreaChange = useCallback(
      (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = event.target.value;
        handleValueChange(newValue);

        // Trigger mention detection immediately with the new value
        const textarea = textAreaRef.current;
        if (textarea && enableMentions) {
          const cursorPosition = textarea.selectionStart || 0;
          const detectedMention = detectMention(newValue, cursorPosition);

          if (detectedMention) {
            // Filter tabs and set up dropdown immediately
            const filtered = filterTabsByQuery(detectedMention.query);
            setFilteredTabs(filtered);

            // Calculate dropdown position (above input)
            try {
              // Align dropdown with the bordered input container rather than the textarea
              const containerEl = textarea.closest('.chat-input__main') as HTMLElement | null;
              const rect = (containerEl || textarea).getBoundingClientRect();
              // Constants synced with dropdown CSS
              // const ROW_HEIGHT = 28;
              // const PADDING_VERTICAL = 8;
              // const BORDER = 2;
              // const MAX_HEIGHT = 240;
              // const estimatedHeight = Math.min(filtered.length * ROW_HEIGHT + PADDING_VERTICAL + BORDER, MAX_HEIGHT);
              const x = rect.left;
              const gap = 6;
              const bottom = Math.max(8, window.innerHeight - rect.top + gap);
              setDropdownPosition({ x, bottom, width: rect.width });
            } catch (error) {
              setDropdownPosition(null);
            }
          } else {
            setFilteredTabs([]);
            setDropdownPosition(null);
          }
        }
      },
      [
        handleValueChange,
        detectMention,
        filterTabsByQuery,
        enableMentions,
        calculateCaretDropdownPosition,
      ]
    );

    // Send message
    const handleSend = useCallback(async () => {
      if (isSending || loading) return;

      const trimmedMessage = currentValue.trim();
      if (!trimmedMessage) return;

      setIsSending(true);

      try {
        // Clear input immediately after initiating send (before awaiting response)
        if (clearOnSend) {
          handleValueChange('');
        }

        await onSend(trimmedMessage);
      } finally {
        setIsSending(false);
      }
    }, [currentValue, onSend, clearOnSend, handleValueChange, isSending, loading]);

    // Handle cancel
    const handleCancel = useCallback(() => {
      if (onCancel) {
        onCancel();
      }
    }, [onCancel]);

    // Handle tab selection from mention dropdown
    const handleTabSelect = useCallback(
      (tabId: number) => {
        const textarea = textAreaRef.current;
        if (!textarea || !mention) return;

        // Remove the @mention text from the input (do not insert any placeholder)
        const startIndex = mention.startIndex;
        const endIndex = startIndex + 1 + (mention.query?.length || 0); // @ + query

        const before = currentValue.slice(0, startIndex);
        const after = currentValue.slice(endIndex);
        const newText = before + after;

        // Update the text value without the mention
        handleValueChange(newText);

        // Invoke callback to trigger extraction of the selected tab
        if (onMentionSelectTab) {
          onMentionSelectTab(tabId);
        }

        // Clear mention and dropdown
        clearMention();
        setFilteredTabs([]);
        setDropdownPosition(null);

        // Restore cursor position at the place where mention began
        setTimeout(() => {
          if (textAreaRef.current) {
            textAreaRef.current.setSelectionRange(startIndex, startIndex);
            textAreaRef.current.focus();
          }
        }, 0);
      },
      [mention, currentValue, handleValueChange, clearMention, onMentionSelectTab]
    );

    // Handle mention dropdown close
    const handleMentionClose = useCallback(() => {
      clearMention();
      setFilteredTabs([]);
      setDropdownPosition(null);

      // Return focus to textarea
      setTimeout(() => {
        if (textAreaRef.current) {
          textAreaRef.current.focus();
        }
      }, 0);
    }, [clearMention]);

    // Handle keyboard shortcuts
    const handleKeyDown = useCallback(
      (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Always stop propagation to prevent webpage shortcuts from being triggered
        event.stopPropagation();

        // If mention dropdown is showing, let it handle certain keys
        if (showDropdown && dropdownPosition && filteredTabs.length > 0) {
          // Let the dropdown handle navigation keys
          if (
            ['ArrowDown', 'ArrowUp', 'Enter', 'Escape', 'Tab', 'Home', 'End'].includes(event.key)
          ) {
            // Prevent default to stop cursor movement in textarea
            event.preventDefault();
            // The TabMentionDropdown will handle these keys via its own listener
            return;
          }
        }

        if (loading || isSending) {
          if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
            event.preventDefault();
          }
          return;
        }

        // Enter to send (unless Shift+Enter or Ctrl+Enter for new line)
        if (event.key === 'Enter') {
          if (!event.shiftKey && !event.ctrlKey && !event.metaKey) {
            event.preventDefault();
            handleSend();
          } else if (event.ctrlKey && !event.shiftKey && !event.metaKey) {
            // Handle Ctrl+Enter for new line explicitly (needed for JSDOM testing)
            event.preventDefault();
            const textarea = event.target as HTMLTextAreaElement;
            const { selectionStart, selectionEnd } = textarea;
            const newValue =
              currentValue.slice(0, selectionStart) + '\n' + currentValue.slice(selectionEnd);
            handleValueChange(newValue);

            // Move cursor after the inserted newline
            setTimeout(() => {
              if (textAreaRef.current) {
                textAreaRef.current.setSelectionRange(selectionStart + 1, selectionStart + 1);
              }
            }, 0);
          }
          // Shift+Enter allows default new line behavior
        }

        // Trigger mention detection on cursor movement keys (@ is handled by onChange)
        if (['ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) {
          setTimeout(handleCursorPositionChange, 0);
        }
      },
      [
        handleSend,
        loading,
        isSending,
        currentValue,
        handleValueChange,
        showDropdown,
        dropdownPosition,
        filteredTabs,
        handleCursorPositionChange,
      ]
    );

    // Stop all keyboard event propagation when the input is focused
    const handleKeyUp = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      event.stopPropagation();
    }, []);

    const handleKeyPress = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      event.stopPropagation();
    }, []);

    // Handle textarea clicks to update cursor position for mention detection
    const handleTextAreaClick = useCallback(() => {
      // Delay to ensure cursor position is updated
      setTimeout(handleCursorPositionChange, 10);
    }, [handleCursorPositionChange]);

    // Handle textarea selection changes
    const handleTextAreaSelect = useCallback(() => {
      handleCursorPositionChange();
    }, [handleCursorPositionChange]);

    // Determine if buttons should be disabled
    const isDisabled = loading || isSending;

    // Get loaded tab info for display as chips (for future use)
    // const loadedTabsArray = Object.values(loadedTabs || {});
    // const hasLoadedTabs = loadedTabsArray.length > 0;

    // Handle tab chip removal (for future use)
    // const handleTabChipRemove = useCallback(
    //   (tabId: number) => {
    //     if (onTabRemove) {
    //       onTabRemove(tabId);
    //     }
    //   },
    //   [onTabRemove]
    // );

    // Focus textarea when component mounts
    useEffect(() => {
      if (textAreaRef.current && !loading) {
        textAreaRef.current.focus();
      }
    }, [loading]);

    return (
      <div className={`chat-input${className ? ` ${className}` : ''}`}>
        {/* Main input area with border */}
        <div className="chat-input__main">
          <div className="chat-input__textarea-container">
            <TextArea
              ref={textAreaRef}
              value={currentValue}
              onChange={handleTextAreaChange}
              onKeyDown={handleKeyDown}
              onKeyUp={handleKeyUp}
              onKeyPress={handleKeyPress}
              onClick={handleTextAreaClick}
              onSelect={handleTextAreaSelect}
              placeholder={placeholder}
              disabled={isDisabled}
              aria-label={ariaLabel}
              aria-autocomplete={enableMentions ? 'list' : undefined}
              aria-controls={enableMentions ? 'tab-mention-listbox' : undefined}
              aria-activedescendant={
                enableMentions && showDropdown && highlightedTabId
                  ? `tab-option-${highlightedTabId}`
                  : undefined
              }
              minRows={1}
              maxRows={8}
              tabIndex={0}
              {...textAreaProps}
            />
          </div>

          {/* @ Mention dropdown */}
          {enableMentions && showDropdown && dropdownPosition && (
            <TabErrorBoundary
              boundaryId="tab-mention-dropdown"
              maxRetries={1}
              onError={(_error, _errorInfo) => {
                // Close dropdown on error to prevent UI issues
                handleMentionClose();
              }}
            >
              <TabMentionDropdown
                tabs={filteredTabs}
                onSelect={handleTabSelect}
                position={dropdownPosition}
                isOpen={true}
                onClose={handleMentionClose}
                onHighlightChange={setHighlightedTabId}
                maxVisibleTabs={10}
                maxHeight={240}
              />
            </TabErrorBoundary>
          )}

          {/* Action buttons row - only show cancel when loading */}
          {loading && onCancel && (
            <div className="chat-input__actions">
              <div className="chat-input__controls">
                <button
                  onClick={handleCancel}
                  className="chat-input__cancel-button"
                  aria-label={cancelButtonLabel}
                >
                  <CancelIcon />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
);

ChatInput.displayName = 'ChatInput';
