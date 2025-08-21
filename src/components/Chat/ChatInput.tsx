import React, { useState, useCallback, useRef, useEffect } from 'react';
import { TextArea, TextAreaProps } from '@/components/ui/TextArea';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { cn } from '@/utils/cn';
import { useSettingsStore } from '@/store/settings';

export interface ChatInputProps extends Omit<TextAreaProps, 'onKeyDown' | 'value' | 'onChange'> {
  /** Callback fired when message is sent */
  onSend: (message: string) => void;
  /** Callback fired when clear button is clicked */
  onClear?: () => void;
  /** Current message value (controlled) */
  value?: string;
  /** Default message value (uncontrolled) */
  defaultValue?: string;
  /** Callback fired when message changes */
  onChange?: (message: string) => void;
  /** Whether the component is in loading state */
  loading?: boolean;
  /** Whether to clear input after successful send */
  clearOnSend?: boolean;
  /** Whether to show character counter */
  showCounter?: boolean;
  /** Maximum character length */
  maxLength?: number;
  /** Send button label */
  sendButtonLabel?: string;
  /** Clear button label */
  clearButtonLabel?: string;
  /** Aria label for the textarea */
  ariaLabel?: string;
  /** Additional CSS classes for the container */
  className?: string;
}

// Icon components (simple SVGs for now)
const SendIcon: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22,2 15,22 11,13 2,9" />
  </svg>
);

const ClearIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const AttachIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.64 16.2a2 2 0 0 1-2.83-2.83l8.49-8.4" />
  </svg>
);

const VoiceIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="22" />
  </svg>
);

const SettingsIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 1v6m0 6v6" />
    <path d="M9 12H1m22-6h-6M9 12h6m6 0h-6M9 12H1" />
  </svg>
);

/**
 * ChatInput Component
 *
 * A comprehensive chat input component with TextArea integration, send functionality,
 * keyboard shortcuts, character counter, and placeholder action buttons.
 */
export const ChatInput = React.forwardRef<HTMLTextAreaElement, ChatInputProps>(
  (
    {
      onSend,
      onClear,
      value,
      defaultValue,
      onChange,
      loading = false,
      clearOnSend = true,
      showCounter = false,
      maxLength,
      sendButtonLabel = 'Send',
      clearButtonLabel = 'Clear',
      ariaLabel = 'Chat message input',
      className,
      placeholder = 'Type your message here...',
      ...textAreaProps
    },
    ref
  ) => {
    // Internal state for uncontrolled mode
    const [internalValue, setInternalValue] = useState(defaultValue || '');
    const { theme } = useSettingsStore();

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
        await onSend(trimmedMessage);

        // Clear input if configured to do so
        if (clearOnSend) {
          handleValueChange('');
        }
      } finally {
        setIsSending(false);
      }
    }, [currentValue, onSend, clearOnSend, handleValueChange, isSending, loading]);

    // Handle clear
    const handleClear = useCallback(() => {
      if (onClear) {
        onClear();
      } else {
        handleValueChange('');
      }
    }, [onClear, handleValueChange]);

    // Handle keyboard shortcuts
    const handleKeyDown = useCallback(
      (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
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

    // Calculate character count and status
    const charCount = currentValue.length;
    const isNearLimit = maxLength ? charCount / maxLength >= 0.8 : false;
    const isAtLimit = maxLength ? charCount >= maxLength : false;

    // Determine if buttons should be disabled
    const isDisabled = loading || isSending;
    const canSend = !isDisabled && currentValue.trim().length > 0;
    const canClear = !isDisabled && currentValue.length > 0;

    // Character counter component
    const CharacterCounter: React.FC = () => {
      if (!showCounter) return null;

      const counterText = maxLength ? `${charCount}/${maxLength}` : `${charCount}`;
      const counterClasses = cn('text-xs', {
        'text-amber-600': isNearLimit && !isAtLimit,
        'text-red-600': isAtLimit,
        'text-gray-500': !isNearLimit && !isAtLimit,
      });

      return (
        <span
          className={cn(counterClasses, { warning: isNearLimit && !isAtLimit, error: isAtLimit })}
        >
          {counterText}
        </span>
      );
    };

    // Focus textarea when component mounts
    useEffect(() => {
      if (textAreaRef.current && !loading) {
        textAreaRef.current.focus();
      }
    }, [loading]);

    return (
      <div className={cn('chat-input', className)}>
        {/* Main input area */}
        <div className="chat-input__main">
          <div className="chat-input__textarea-container">
            <TextArea
              ref={textAreaRef}
              value={currentValue}
              onChange={handleTextAreaChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={isDisabled}
              aria-label={ariaLabel}
              minRows={1}
              maxRows={8}
              tabIndex={0}
              style={{
                background: 'transparent',
                backgroundColor: 'transparent',
                border: theme === 'dark' ? '1px solid #4b5563' : '1px solid #e5e7eb',
                borderRadius: '0.5rem',
                padding: '0.75rem',
                color: theme === 'dark' ? '#ffffff' : '#4b5563', // White in dark mode, gray in light mode
                outline: 'none',
                boxShadow: 'none',
              }}
              {...textAreaProps}
            />
          </div>

          {/* Action buttons row */}
          <div className="chat-input__actions">
            {/* Right side - send controls first in DOM for tab order */}
            <div className="chat-input__controls">
              {showCounter && (
                <div className="chat-input__counter">
                  <CharacterCounter />
                </div>
              )}

              <IconButton
                icon={<ClearIcon />}
                size="sm"
                variant="ghost"
                onClick={handleClear}
                disabled={!canClear}
                tooltip={clearButtonLabel}
                aria-label={clearButtonLabel}
              />

              <Button
                onClick={handleSend}
                disabled={!canSend}
                loading={isSending || loading}
                loadingText="Sending..."
                size="sm"
                variant="primary"
                className={cn('chat-input__send-button', { loading: isSending || loading })}
                aria-label={sendButtonLabel}
              >
                <SendIcon />
                <span className="sr-only">{sendButtonLabel}</span>
              </Button>
            </div>

            {/* Left side - utility buttons */}
            <div className="chat-input__utilities">
              <IconButton
                icon={<AttachIcon />}
                size="sm"
                variant="ghost"
                tooltip="Attach file (coming soon)"
                disabled={isDisabled}
                aria-label="Attach file"
              />
              <IconButton
                icon={<VoiceIcon />}
                size="sm"
                variant="ghost"
                tooltip="Voice input (coming soon)"
                disabled={isDisabled}
                aria-label="Voice input"
              />
              <IconButton
                icon={<SettingsIcon />}
                size="sm"
                variant="ghost"
                tooltip="Settings (coming soon)"
                disabled={isDisabled}
                aria-label="Settings"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }
);

ChatInput.displayName = 'ChatInput';
