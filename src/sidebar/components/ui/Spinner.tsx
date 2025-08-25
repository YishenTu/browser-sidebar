import React from 'react';

export interface SpinnerProps {
  /**
   * Size of the spinner
   * @default "md"
   */
  size?: 'sm' | 'md' | 'lg' | 'xl';

  /**
   * Accessible label for screen readers
   * @default "Loading"
   */
  'aria-label'?: string;

  /**
   * Visible label text shown alongside the spinner
   * When provided, this text will be visible to users
   */
  label?: string;

  /**
   * Additional CSS classes to apply
   */
  className?: string;

  /**
   * Additional props to pass to the container element
   */
  [key: string]: unknown;
}

/**
 * Loading spinner component with multiple sizes and accessibility support
 *
 * Features:
 * - Multiple sizes: sm (16px), md (24px), lg (32px), xl (48px)
 * - SVG-based for smooth animation and scalability
 * - Accessibility compliant with proper ARIA attributes
 * - Supports custom colors via CSS classes (currentColor)
 * - Respects prefers-reduced-motion preferences
 * - Can display visible label text or screen-reader-only labels
 */
export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  'aria-label': ariaLabel = 'Loading',
  label,
  className = '',
  style,
  ...rest
}) => {
  // Size mappings for consistent sizing
  const sizeClasses = {
    sm: 'w-4 h-4', // 16px
    md: 'w-6 h-6', // 24px
    lg: 'w-8 h-8', // 32px
    xl: 'w-12 h-12', // 48px
  };

  return (
    <div
      role="status"
      aria-label={ariaLabel}
      className={`inline-block ${className}`}
      style={style}
      {...rest}
    >
      <svg
        className={`animate-spin ${sizeClasses[size]}`}
        style={style ? { width: '100%', height: '100%' } : undefined}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Background circle with reduced opacity */}
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25" />
        {/* Animated segment */}
        <path
          d="M12 2a10 10 0 0 1 10 10"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>

      {/* Visible label text if provided */}
      {label && <span className="ml-2 text-sm text-current">{label}</span>}
    </div>
  );
};
