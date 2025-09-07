import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { TextArea, TextAreaProps, CloseIcon } from '@ui/index';
import { useTabMention } from '@hooks/useTabMention';
import { useSlashCommand } from '@hooks/useSlashCommand';
import { TabMentionDropdown } from './TabMentionDropdown';
import { SlashCommandDropdown } from './SlashCommandDropdown';
import { TabErrorBoundary } from './TabErrorBoundary';
import { searchSlashCommands, type SlashCommand } from '@/config/slashCommands';
import type { TabInfo, TabContent } from '@/types/tabs';

// Single source of truth for ChatInput dimensions
export const CHAT_INPUT_MIN_ROWS = 2;
export const CHAT_INPUT_MAX_ROWS = 8;

export interface ChatInputProps
  extends Omit<TextAreaProps, 'onKeyDown' | 'value' | 'onChange' | 'minRows' | 'maxRows'> {
  /** Callback fired when message is sent */
  onSend: (message: string, metadata?: { expandedPrompt?: string }) => void;
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
  /** Whether slash command functionality is enabled */
  enableSlashCommands?: boolean;
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
      placeholder,
      availableTabs = [],
      enableMentions = true,
      enableSlashCommands = true,
      onTabRemove: _onTabRemove,
      onMentionSelectTab,
      ...textAreaProps
    },
    ref
  ) => {
    // Internal state for uncontrolled mode
    const [internalValue, setInternalValue] = useState(defaultValue || '');

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
      y?: number;
      bottom?: number;
      width?: number;
    } | null>(null);
    const [filteredTabs, setFilteredTabs] = useState<TabInfo[]>([]);
    const [highlightedTabId, setHighlightedTabId] = useState<number | null>(null);

    // Slash command functionality state
    const [slashDropdownPosition, setSlashDropdownPosition] = useState<{
      x: number;
      y?: number;
      bottom?: number;
      width?: number;
    } | null>(null);
    const [filteredCommands, setFilteredCommands] = useState<SlashCommand[]>([]);
    // const [highlightedCommandId, setHighlightedCommandId] = useState<string | null>(null);  // Reserved for future use
    const [expandedPromptRef, setExpandedPromptRef] = useState<string | null>(null);

    // @ Mention hook
    const { mention, showDropdown, detectMention, clearMention } = useTabMention({
      enabled: enableMentions,
    });

    // Slash command hook
    const {
      slashCommand,
      showDropdown: showSlashDropdown,
      detectSlashCommand,
      insertSlashCommand,
      clearSlashCommand,
    } = useSlashCommand({
      enabled: enableSlashCommands,
    });

    // Merge refs
    React.useImperativeHandle(ref, () => textAreaRef.current!, []);

    // Track current query for memoization
    const [currentMentionQuery, setCurrentMentionQuery] = useState<string>('');

    // Memoize filtered tabs based on current query to avoid re-filtering on every render
    const memoizedFilteredTabs = useMemo(() => {
      if (!currentMentionQuery.trim()) {
        return availableTabs.slice(0, 10); // Show first 10 tabs if no query
      }

      const lowerQuery = currentMentionQuery.toLowerCase();
      return availableTabs
        .filter(
          tab =>
            tab.title.toLowerCase().includes(lowerQuery) ||
            tab.domain.toLowerCase().includes(lowerQuery) ||
            tab.url.toLowerCase().includes(lowerQuery)
        )
        .slice(0, 10); // Limit to 10 results
    }, [currentMentionQuery, availableTabs]);

    // Filter tabs based on mention query
    const filterTabsByQuery = useCallback(
      (query: string): TabInfo[] => {
        // Update current query for memoization
        if (query !== currentMentionQuery) {
          setCurrentMentionQuery(query);
        }

        // Return memoized result if query matches
        if (query === currentMentionQuery) {
          return memoizedFilteredTabs;
        }

        // Otherwise compute immediately for responsiveness
        if (!query.trim()) {
          return availableTabs.slice(0, 10);
        }

        const lowerQuery = query.toLowerCase();
        return availableTabs
          .filter(
            tab =>
              tab.title.toLowerCase().includes(lowerQuery) ||
              tab.domain.toLowerCase().includes(lowerQuery) ||
              tab.url.toLowerCase().includes(lowerQuery)
          )
          .slice(0, 10);
      },
      [availableTabs, currentMentionQuery, memoizedFilteredTabs]
    );

    // Handle cursor position change for mention and slash command detection
    const handleCursorPositionChange = useCallback(() => {
      const textarea = textAreaRef.current;
      if (!textarea) return;

      const cursorPosition = textarea.selectionStart || 0;

      // Check for @ mention
      if (enableMentions) {
        const detectedMention = detectMention(currentValue, cursorPosition);
        if (detectedMention) {
          // Filter tabs based on query
          const filtered = filterTabsByQuery(detectedMention.query);
          setFilteredTabs(filtered);

          // Calculate dropdown position (above input)
          try {
            const containerEl = textarea.closest('.chat-input__main') as HTMLElement | null;
            const rect = (containerEl || textarea).getBoundingClientRect();
            const x = rect.left;
            const gap = 6;
            const bottom = Math.max(8, window.innerHeight - rect.top + gap);
            setDropdownPosition({ x, bottom, width: rect.width });
          } catch (error) {
            setDropdownPosition(null);
          }

          // Clear slash command if @ mention is detected
          if (enableSlashCommands) {
            clearSlashCommand();
            setSlashDropdownPosition(null);
            setFilteredCommands([]);
          }
          return;
        } else {
          setFilteredTabs([]);
          setDropdownPosition(null);
        }
      }

      // Check for slash command
      if (enableSlashCommands) {
        const detectedSlash = detectSlashCommand(currentValue, cursorPosition);
        if (detectedSlash) {
          // Filter commands based on query
          const filtered = searchSlashCommands(detectedSlash.query);
          setFilteredCommands(filtered);

          // Calculate dropdown position (above input)
          try {
            const containerEl = textarea.closest('.chat-input__main') as HTMLElement | null;
            const rect = (containerEl || textarea).getBoundingClientRect();
            const x = rect.left;
            const gap = 6;
            const bottom = Math.max(8, window.innerHeight - rect.top + gap);
            setSlashDropdownPosition({ x, bottom, width: rect.width });
          } catch (error) {
            setSlashDropdownPosition(null);
          }

          // Clear @ mention if slash command is detected
          if (enableMentions) {
            clearMention();
            setDropdownPosition(null);
            setFilteredTabs([]);
          }
        } else {
          setFilteredCommands([]);
          setSlashDropdownPosition(null);
        }
      }
    }, [
      currentValue,
      detectMention,
      filterTabsByQuery,
      enableMentions,
      detectSlashCommand,
      enableSlashCommands,
      clearMention,
      clearSlashCommand,
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

        // Clear expanded prompt if user manually edits
        setExpandedPromptRef(null);

        // Trigger detection immediately with the new value
        const textarea = textAreaRef.current;
        if (!textarea) return;

        const cursorPosition = textarea.selectionStart || 0;

        // Check for @ mention first
        if (enableMentions) {
          const detectedMention = detectMention(newValue, cursorPosition);
          if (detectedMention) {
            const filtered = filterTabsByQuery(detectedMention.query);
            setFilteredTabs(filtered);

            try {
              const containerEl = textarea.closest('.chat-input__main') as HTMLElement | null;
              const rect = (containerEl || textarea).getBoundingClientRect();
              const x = rect.left;
              const gap = 6;
              const bottom = Math.max(8, window.innerHeight - rect.top + gap);
              setDropdownPosition({ x, bottom, width: rect.width });
            } catch (error) {
              setDropdownPosition(null);
            }

            // Clear slash command
            if (enableSlashCommands) {
              clearSlashCommand();
              setSlashDropdownPosition(null);
              setFilteredCommands([]);
            }
            return;
          } else {
            setFilteredTabs([]);
            setDropdownPosition(null);
          }
        }

        // Check for slash command
        if (enableSlashCommands) {
          const detectedSlash = detectSlashCommand(newValue, cursorPosition);
          if (detectedSlash) {
            const filtered = searchSlashCommands(detectedSlash.query);
            setFilteredCommands(filtered);

            try {
              const containerEl = textarea.closest('.chat-input__main') as HTMLElement | null;
              const rect = (containerEl || textarea).getBoundingClientRect();
              const x = rect.left;
              const gap = 6;
              const bottom = Math.max(8, window.innerHeight - rect.top + gap);
              setSlashDropdownPosition({ x, bottom, width: rect.width });
            } catch (error) {
              setSlashDropdownPosition(null);
            }

            // Clear @ mention
            if (enableMentions) {
              clearMention();
              setDropdownPosition(null);
              setFilteredTabs([]);
            }
          } else {
            setFilteredCommands([]);
            setSlashDropdownPosition(null);
          }
        }
      },
      [
        handleValueChange,
        detectMention,
        filterTabsByQuery,
        enableMentions,
        detectSlashCommand,
        enableSlashCommands,
        clearMention,
        clearSlashCommand,
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

        // Pass expanded prompt as metadata if available
        await onSend(
          trimmedMessage,
          expandedPromptRef ? { expandedPrompt: expandedPromptRef } : undefined
        );

        // Clear expanded prompt after sending
        setExpandedPromptRef(null);
      } finally {
        setIsSending(false);
      }
    }, [
      currentValue,
      onSend,
      clearOnSend,
      handleValueChange,
      isSending,
      loading,
      expandedPromptRef,
    ]);

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

    // Handle slash command selection
    const handleSlashCommandSelect = useCallback(
      (command: SlashCommand) => {
        const textarea = textAreaRef.current;
        if (!textarea || !slashCommand) return;

        // Insert the slash command and get the expanded prompt
        const result = insertSlashCommand(currentValue, command, slashCommand);

        // Update the display text (with slash command)
        handleValueChange(result.newText);

        // Store the expanded prompt for sending
        setExpandedPromptRef(result.expandedPrompt);

        // Clear slash command state and dropdown
        clearSlashCommand();
        setFilteredCommands([]);
        setSlashDropdownPosition(null);

        // Restore cursor position
        setTimeout(() => {
          if (textAreaRef.current) {
            textAreaRef.current.setSelectionRange(
              result.newCursorPosition,
              result.newCursorPosition
            );
            textAreaRef.current.focus();
          }
        }, 0);
      },
      [slashCommand, currentValue, handleValueChange, insertSlashCommand, clearSlashCommand]
    );

    // Handle slash dropdown close
    const handleSlashClose = useCallback(() => {
      clearSlashCommand();
      setFilteredCommands([]);
      setSlashDropdownPosition(null);

      // Return focus to textarea
      setTimeout(() => {
        if (textAreaRef.current) {
          textAreaRef.current.focus();
        }
      }, 0);
    }, [clearSlashCommand]);

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

        // If slash command dropdown is showing, let it handle certain keys
        if (showSlashDropdown && slashDropdownPosition && filteredCommands.length > 0) {
          // Let the dropdown handle navigation keys
          if (
            ['ArrowDown', 'ArrowUp', 'Enter', 'Escape', 'Tab', 'Home', 'End'].includes(event.key)
          ) {
            // Prevent default to stop cursor movement in textarea
            event.preventDefault();
            // The SlashCommandDropdown will handle these keys via its own listener
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
        showSlashDropdown,
        slashDropdownPosition,
        filteredCommands,
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
              {...textAreaProps}
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
              minRows={CHAT_INPUT_MIN_ROWS}
              maxRows={CHAT_INPUT_MAX_ROWS}
              tabIndex={0}
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

          {/* Slash command dropdown */}
          {enableSlashCommands && showSlashDropdown && slashDropdownPosition && (
            <TabErrorBoundary
              boundaryId="slash-command-dropdown"
              maxRetries={1}
              onError={(_error, _errorInfo) => {
                // Close dropdown on error to prevent UI issues
                handleSlashClose();
              }}
            >
              <SlashCommandDropdown
                commands={filteredCommands}
                onSelect={handleSlashCommandSelect}
                position={slashDropdownPosition}
                isOpen={true}
                onClose={handleSlashClose}
                // onHighlightChange={setHighlightedCommandId}
                maxVisibleCommands={10}
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
                  <CloseIcon />
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
