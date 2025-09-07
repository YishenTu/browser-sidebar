import React, {
  forwardRef,
  useId,
  useRef,
  useEffect,
  useCallback,
  useImperativeHandle,
} from 'react';

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
  /** Minimum number of rows */
  minRows: number;
  /** Maximum number of rows */
  maxRows: number;
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
      minRows,
      maxRows,
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

    // Simple auto-resize functionality
    const adjustHeight = useCallback(() => {
      const textarea = textAreaRef.current;
      if (!textarea) return;

      // Reset to min height to get accurate scrollHeight
      textarea.style.height = 'inherit';

      // Get the scroll height
      const scrollHeight = textarea.scrollHeight;

      // Set the height, respecting max
      const lineHeight = getLineHeight();
      const maxHeight = maxRows * lineHeight;

      if (scrollHeight > maxHeight) {
        textarea.style.height = `${maxHeight}px`;
        textarea.style.overflowY = 'auto';
      } else {
        textarea.style.height = `${scrollHeight}px`;
        textarea.style.overflowY = 'hidden';
      }
    }, [maxRows, getLineHeight]);

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
    const textAreaClasses = `textarea textarea-${size}${error ? ' error' : ''}${success ? ' success' : ''}${className ? ` ${className}` : ''}`;

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
          rows={minRows}
          style={{
            resize: 'none',
            overflow: 'hidden',
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
