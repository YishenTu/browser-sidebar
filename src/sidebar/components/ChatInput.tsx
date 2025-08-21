import React, { useState, useCallback, useRef, useEffect } from 'react';
import { TextArea, TextAreaProps } from '@/components/ui/TextArea';
import { cn } from '@/utils/cn';

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
  /** Whether to clear input after successful send */
  clearOnSend?: boolean;
  /** Whether to show character counter */
  showCounter?: boolean;
  /** Maximum character length */
  maxLength?: number;
  /** Send button label */
  sendButtonLabel?: string;
  /** Aria label for the textarea */
  ariaLabel?: string;
  /** Additional CSS classes for the container */
  className?: string;
}

// Icon components (simple SVGs for now)
const SendIcon: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path
      d="M7 11L12 6L17 11M12 18V7"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

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
      clearOnSend = true,
      showCounter = false,
      maxLength,
      sendButtonLabel = 'Send',
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
        await onSend(trimmedMessage);

        // Clear input if configured to do so
        if (clearOnSend) {
          handleValueChange('');
        }
      } finally {
        setIsSending(false);
      }
    }, [currentValue, onSend, clearOnSend, handleValueChange, isSending, loading]);

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
    // const canClear = !isDisabled && currentValue.length > 0; // Not used after simplification

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
        {/* Main input area with border */}
        <div
          className="chat-input__main"
          style={{
            border: '1px solid rgba(75, 85, 99, 0.3)',
            borderRadius: '12px',
            backgroundColor: 'transparent', // Same as main area
            position: 'relative',
            padding: '4px', // Reduced padding by half
            margin: '4px', // Reduced margin by half
          }}
        >
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
                border: 'none',
                borderRadius: '0',
                padding: '0.5rem 44px 0.5rem 0.75rem', // Extra padding right for send button
                color: '#e5e7eb',
                outline: 'none',
                boxShadow: 'none',
                width: '100%',
                resize: 'none',
              }}
              {...textAreaProps}
            />
          </div>

          {/* Action buttons row */}
          <div
            className="chat-input__actions"
            style={{
              position: 'absolute',
              right: '4px',
              bottom: '4px', // Back to bottom right corner
            }}
          >
            {/* Right side - send controls first in DOM for tab order */}
            <div className="chat-input__controls" style={{ display: 'flex', alignItems: 'center' }}>
              {showCounter && (
                <div className="chat-input__counter">
                  <CharacterCounter />
                </div>
              )}

              <button
                onClick={handleSend}
                disabled={!canSend}
                className="chat-input__send-button"
                aria-label={sendButtonLabel}
                style={{
                  background: canSend ? '#10b981' : '#374151',
                  opacity: canSend ? 1 : 0.5,
                  cursor: canSend ? 'pointer' : 'not-allowed',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                  color: 'white',
                }}
              >
                {isSending || loading ? (
                  <span className="spinner" style={{ width: '16px', height: '16px' }} />
                ) : (
                  <SendIcon />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

ChatInput.displayName = 'ChatInput';
