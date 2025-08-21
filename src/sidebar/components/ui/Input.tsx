import React, { forwardRef, useId } from 'react';
import { cn } from '@utils/cn';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Input size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Error state */
  error?: boolean;
  /** Success state */
  success?: boolean;
  /** Label text */
  label?: string;
  /** Helper text displayed below input */
  helperText?: string;
  /** Error message displayed when error is true */
  errorMessage?: string;
  /** Success message displayed when success is true */
  successMessage?: string;
  /** Left side icon */
  leftIcon?: React.ReactNode;
  /** Right side icon */
  rightIcon?: React.ReactNode;
  /** Wrap component in ai-sidebar-container for proper styling */
  withContainer?: boolean;
}

/**
 * Input Component
 *
 * A flexible input component with support for different sizes, states, icons,
 * labels, and validation messages.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <Input placeholder="Enter text" />
 *
 * // With label and helper text
 * <Input
 *   label="Username"
 *   helperText="Must be at least 3 characters"
 *   placeholder="Enter username"
 * />
 *
 * // Error state
 * <Input
 *   error
 *   errorMessage="Username is required"
 *   placeholder="Enter username"
 * />
 *
 * // With icons
 * <Input
 *   leftIcon={<SearchIcon />}
 *   rightIcon={<ClearIcon />}
 *   placeholder="Search..."
 * />
 * ```
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      size = 'md',
      error = false,
      success = false,
      label,
      helperText,
      errorMessage,
      successMessage,
      leftIcon,
      rightIcon,
      withContainer = false,
      className,
      type = 'text',
      id: providedId,
      'aria-describedby': ariaDescribedBy,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const id = providedId || generatedId;
    const helperId = `${id}-helper`;
    const errorId = `${id}-error`;
    const successId = `${id}-success`;

    // Build aria-describedby
    const describedByIds = [];
    if (helperText) describedByIds.push(helperId);
    if (error && errorMessage) describedByIds.push(errorId);
    if (success && successMessage) describedByIds.push(successId);
    if (ariaDescribedBy) describedByIds.push(ariaDescribedBy);

    // Build input classes
    const inputClasses = cn(
      'input',
      `input-${size}`,
      {
        error: error,
        success: success,
        'pl-10': leftIcon,
        'pr-10': rightIcon,
      },
      className
    );

    const inputElement = (
      <div className="relative">
        {/* Left Icon */}
        {leftIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{leftIcon}</div>
        )}

        {/* Input Element */}
        <input
          ref={ref}
          type={type}
          id={id}
          className={inputClasses}
          aria-describedby={describedByIds.length > 0 ? describedByIds.join(' ') : undefined}
          aria-invalid={error ? 'true' : undefined}
          {...props}
        />

        {/* Right Icon */}
        {rightIcon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">{rightIcon}</div>
        )}
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
        {inputElement}
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

Input.displayName = 'Input';
