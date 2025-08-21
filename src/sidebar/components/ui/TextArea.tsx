import React, {
  forwardRef,
  useId,
  useRef,
  useEffect,
  useCallback,
  useImperativeHandle,
} from 'react';
import { cn } from '@utils/cn';

export interface TextAreaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'> {
  /** TextArea size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Error state */
  error?: boolean;
  /** Success state */
  success?: boolean;
  /** Label text */
  label?: string;
  /** Helper text displayed below textarea */
  helperText?: string;
  /** Error message displayed when error is true */
  errorMessage?: string;
  /** Success message displayed when success is true */
  successMessage?: string;
  /** Minimum number of rows (default: 2) */
  minRows?: number;
  /** Maximum number of rows (default: 10) */
  maxRows?: number;
  /** Wrap component in ai-sidebar-container for proper styling */
  withContainer?: boolean;
}

/**
 * TextArea Component
 *
 * An auto-resizing textarea component with support for different sizes, states,
 * labels, and validation messages.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <TextArea placeholder="Enter your message" />
 *
 * // With label and helper text
 * <TextArea
 *   label="Message"
 *   helperText="Enter your message here"
 *   placeholder="Type something..."
 * />
 *
 * // Error state
 * <TextArea
 *   error
 *   errorMessage="Message is required"
 *   placeholder="Enter message"
 * />
 *
 * // Auto-resizing with row limits
 * <TextArea
 *   minRows={3}
 *   maxRows={8}
 *   placeholder="This will auto-resize..."
 * />
 * ```
 */
export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  (
    {
      size = 'md',
      error = false,
      success = false,
      label,
      helperText,
      errorMessage,
      successMessage,
      minRows = 2,
      maxRows = 10,
      withContainer = false,
      className,
      id: providedId,
      'aria-describedby': ariaDescribedBy,
      value,
      defaultValue,
      onChange,
      onInput,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const id = providedId || generatedId;
    const helperId = `${id}-helper`;
    const errorId = `${id}-error`;
    const successId = `${id}-success`;

    const textAreaRef = useRef<HTMLTextAreaElement | null>(null);

    // Merge refs: keep internal ref and expose it via forwarded ref
    const mergedRef = useCallback((element: HTMLTextAreaElement | null) => {
      textAreaRef.current = element;
    }, []);
    useImperativeHandle(ref, () => textAreaRef.current as unknown as HTMLTextAreaElement, []);

    // Calculate line height based on size
    const getLineHeight = useCallback(() => {
      const lineHeights = {
        sm: 20, // 1.25rem * 16px
        md: 24, // 1.5rem * 16px
        lg: 28, // 1.75rem * 16px
      };
      return lineHeights[size];
    }, [size]);

    // Auto-resize functionality
    const adjustHeight = useCallback(() => {
      const textarea = textAreaRef.current;
      if (!textarea) return;

      const lineHeight = getLineHeight();
      const minHeight = minRows * lineHeight;
      const maxHeight = maxRows * lineHeight;

      // Temporarily set height to auto and hide overflow to get accurate scrollHeight
      textarea.style.height = 'auto';
      textarea.style.overflow = 'hidden';

      // Get content height - use scrollHeight but account for padding/border
      const scrollHeight = textarea.scrollHeight;

      // Calculate new height within constraints
      let newHeight = Math.max(scrollHeight, minHeight);
      let shouldShowScrollbar = false;

      if (newHeight > maxHeight) {
        newHeight = maxHeight;
        shouldShowScrollbar = true;
      }

      // Apply the new height and overflow
      textarea.style.height = `${newHeight}px`;
      textarea.style.overflowY = shouldShowScrollbar ? 'auto' : 'hidden';
    }, [minRows, maxRows, getLineHeight]);

    // Handle value changes
    const handleChange = useCallback(
      (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        // Call provided onChange first
        onChange?.(event);

        // Then adjust height
        requestAnimationFrame(() => {
          adjustHeight();
        });
      },
      [onChange, adjustHeight]
    );

    const handleInput = useCallback(
      (event: React.FormEvent<HTMLTextAreaElement>) => {
        // Call provided onInput first
        onInput?.(event);

        // Then adjust height
        requestAnimationFrame(() => {
          adjustHeight();
        });
      },
      [onInput, adjustHeight]
    );

    // Adjust height on mount and when value/size changes
    useEffect(() => {
      adjustHeight();
    }, [adjustHeight, value, defaultValue, size]);

    // Build aria-describedby
    const describedByIds = [];
    if (helperText) describedByIds.push(helperId);
    if (error && errorMessage) describedByIds.push(errorId);
    if (success && successMessage) describedByIds.push(successId);
    if (ariaDescribedBy) describedByIds.push(ariaDescribedBy);

    // Build textarea classes
    const textAreaClasses = cn(
      'textarea',
      `textarea-${size}`,
      {
        error: error,
        success: success,
      },
      className
    );

    const textAreaElement = (
      <div className="relative">
        <textarea
          ref={mergedRef}
          id={id}
          className={textAreaClasses}
          aria-describedby={describedByIds.length > 0 ? describedByIds.join(' ') : undefined}
          aria-invalid={error ? 'true' : undefined}
          value={value ?? undefined}
          defaultValue={defaultValue ?? undefined}
          onChange={handleChange}
          onInput={handleInput}
          style={{
            resize: 'none', // Disable manual resize
            minHeight: `${minRows * getLineHeight()}px`,
            background: 'transparent',
            backgroundColor: 'transparent',
            outline: 'none',
            boxShadow: 'none',
            width: '100%',
            boxSizing: 'border-box',
          }}
          {...props}
        />
      </div>
    );

    const labelElement = label && (
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
    );

    const helperElement = helperText && (
      <p id={helperId} className="mt-1 text-sm text-gray-500">
        {helperText}
      </p>
    );

    const errorElement = error && errorMessage && (
      <p id={errorId} className="mt-1 text-sm error-text">
        {errorMessage}
      </p>
    );

    const successElement = success && successMessage && (
      <p id={successId} className="mt-1 text-sm success-text">
        {successMessage}
      </p>
    );

    const content = (
      <div className="w-full">
        {labelElement}
        {textAreaElement}
        {helperElement}
        {errorElement}
        {successElement}
      </div>
    );

    if (withContainer) {
      return <div className="ai-sidebar-container">{content}</div>;
    }

    return content;
  }
);

TextArea.displayName = 'TextArea';
