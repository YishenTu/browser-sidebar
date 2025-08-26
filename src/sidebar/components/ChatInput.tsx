import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  TextArea,
  TextAreaProps,
  SendIcon,
  CancelIcon,
  CharacterCounter,
  Spinner,
} from '@ui/index';

export interface ChatInputProps extends Omit<TextAreaProps, 'onKeyDown' | 'value' | 'onChange'> {
  /** Callback fired when message is sent */
  onSend: (message: string) => void;
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
  /** Whether to show character counter */
  showCounter?: boolean;
  /** Maximum character length */
  maxLength?: number;
  /** Send button label */
  sendButtonLabel?: string;
  /** Cancel button label */
  cancelButtonLabel?: string;
  /** Aria label for the textarea */
  ariaLabel?: string;
  /** Additional CSS classes for the container */
  className?: string;
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
      showCounter = false,
      maxLength,
      sendButtonLabel = 'Send',
      cancelButtonLabel = 'Cancel',
      ariaLabel = 'Chat message input',
      className,
      placeholder = 'Type your message here...',
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

    // Merge refs
    React.useImperativeHandle(ref, () => textAreaRef.current!, []);

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

        // Respect maxLength if provided
        if (maxLength && newValue.length > maxLength) {
          return;
        }

        handleValueChange(newValue);
      },
      [handleValueChange, maxLength]
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

    // Handle keyboard shortcuts
    const handleKeyDown = useCallback(
      (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Always stop propagation to prevent webpage shortcuts from being triggered
        event.stopPropagation();

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
      },
      [handleSend, loading, isSending, currentValue, handleValueChange]
    );

    // Stop all keyboard event propagation when the input is focused
    const handleKeyUp = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      event.stopPropagation();
    }, []);

    const handleKeyPress = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      event.stopPropagation();
    }, []);

    // Calculate character count
    const charCount = currentValue.length;

    // Determine if buttons should be disabled
    const isDisabled = loading || isSending;
    const canSend = !isDisabled && currentValue.trim().length > 0;

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
              placeholder={placeholder}
              disabled={isDisabled}
              aria-label={ariaLabel}
              minRows={1}
              maxRows={8}
              tabIndex={0}
              {...textAreaProps}
            />
          </div>

          {/* Action buttons row */}
          <div className="chat-input__actions">
            {/* Right side - send controls first in DOM for tab order */}
            <div className="chat-input__controls">
              {showCounter && (
                <div className="chat-input__counter">
                  <CharacterCounter count={charCount} max={maxLength} show={true} />
                </div>
              )}

              {loading && onCancel ? (
                <button
                  onClick={handleCancel}
                  className="chat-input__cancel-button"
                  aria-label={cancelButtonLabel}
                >
                  <CancelIcon />
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!canSend}
                  className="chat-input__send-button"
                  aria-label={sendButtonLabel}
                >
                  {isSending || loading ? <Spinner size="sm" /> : <SendIcon />}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
);

ChatInput.displayName = 'ChatInput';
