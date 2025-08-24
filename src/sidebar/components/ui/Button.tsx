import React from 'react';
import { cn } from '@sidebar/lib/cn';

// Button variant types
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

// Button props interface
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingText?: string;
  disabled?: boolean;
  className?: string;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

/**
 * Reusable Button component with multiple variants, sizes, and states.
 *
 * Features:
 * - Multiple variants: primary, secondary, ghost, danger, outline
 * - Three sizes: sm, md (default), lg
 * - Loading state with spinner
 * - Disabled state
 * - Full accessibility support
 * - Forward ref support
 * - Integrates with existing CSS base styles
 *
 * @example
 * ```tsx
 * <Button variant="primary" size="md" onClick={() => console.log('clicked')}>
 *   Click me
 * </Button>
 *
 * <Button loading loadingText="Processing...">
 *   Submit
 * </Button>
 * ```
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      loading = false,
      loadingText,
      disabled = false,
      className,
      onClick,
      type = 'button',
      ...props
    },
    ref
  ) => {
    // Determine if button should be disabled
    const isDisabled = disabled || loading;

    // Handle click events
    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      // Prevent click if disabled or loading
      if (isDisabled) {
        event.preventDefault();
        return;
      }

      // Call the provided onClick handler
      onClick?.(event);
    };

    // Build CSS classes
    const buttonClasses = cn(
      // Base button classes from components.css
      'btn',
      // Variant classes
      `btn-${variant}`,
      // Size classes
      `btn-${size}`,
      // Loading state class
      loading && 'loading',
      // Custom className
      className
    );

    // Determine what content to show
    const buttonContent = loading && loadingText ? loadingText : children;

    return (
      <button
        ref={ref}
        type={type}
        className={buttonClasses}
        disabled={isDisabled}
        aria-disabled={isDisabled}
        onClick={handleClick}
        {...props}
      >
        {buttonContent}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
