import React, { forwardRef, useState, useEffect } from 'react';

export interface IconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Icon to display - takes precedence over children */
  icon?: React.ReactNode;
  /** Icon as children - used when icon prop is not provided */
  children?: React.ReactNode;
  /** Button size */
  size?: 'sm' | 'md' | 'lg';
  /** Button variant/style */
  variant?: 'primary' | 'secondary' | 'ghost';
  /** Button shape */
  shape?: 'circular' | 'square';
  /** Loading state - shows spinner and disables button */
  loading?: boolean;
  /** Tooltip text to show on hover */
  tooltip?: string;
  /** Tooltip delay in milliseconds */
  tooltipDelay?: number;
  /** Additional CSS class names */
  className?: string;
}

/**
 * Spinner component for loading state
 */
const Spinner: React.FC<{ size: 'sm' | 'md' | 'lg' }> = ({ size }) => {
  const sizeMap = {
    sm: 12,
    md: 16,
    lg: 20,
  };

  const spinnerSize = sizeMap[size];

  return (
    <svg
      data-testid="icon-button-spinner"
      width={spinnerSize}
      height={spinnerSize}
      viewBox="0 0 24 24"
      className="icon-button__spinner"
      role="img"
      aria-label="Loading"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
        fill="none"
        className="opacity-25"
      />
      <path
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        className="opacity-75"
      />
    </svg>
  );
};

/**
 * Simple tooltip component
 */
const Tooltip: React.FC<{
  text: string;
  show: boolean;
  children: React.ReactNode;
}> = ({ text, show, children }) => {
  return (
    <div className="icon-button__tooltip-container">
      {children}
      {show && (
        <div className="icon-button__tooltip" role="tooltip">
          {text}
        </div>
      )}
    </div>
  );
};

/**
 * IconButton component for displaying icon-only buttons with tooltip support
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      icon,
      children,
      size = 'md',
      variant = 'secondary',
      shape = 'circular',
      loading = false,
      disabled = false,
      tooltip,
      tooltipDelay = 500,
      className = '',
      onClick,
      onMouseEnter,
      onMouseLeave,
      style,
      ...props
    },
    ref
  ) => {
    const [showTooltip, setShowTooltip] = useState(false);
    const [tooltipTimeout, setTooltipTimeout] = useState<NodeJS.Timeout | null>(null);

    // Clean up tooltip timeout on unmount
    useEffect(() => {
      return () => {
        if (tooltipTimeout) {
          clearTimeout(tooltipTimeout);
        }
      };
    }, [tooltipTimeout]);

    const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (tooltip && !loading && !disabled) {
        const timeout = setTimeout(() => {
          setShowTooltip(true);
        }, tooltipDelay);
        setTooltipTimeout(timeout);
      }
      onMouseEnter?.(e);
    };

    const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (tooltipTimeout) {
        clearTimeout(tooltipTimeout);
        setTooltipTimeout(null);
      }
      setShowTooltip(false);
      onMouseLeave?.(e);
    };

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (loading || disabled) {
        e.preventDefault();
        return;
      }
      onClick?.(e);
    };

    // Determine which icon to show
    const iconToShow = icon || children;

    // Build class names
    const baseClasses = 'icon-button';
    const sizeClass = `icon-button--${size}`;
    const variantClass = `icon-button--${variant}`;
    const shapeClass = `icon-button--${shape}`;
    const stateClasses = [loading && 'icon-button--loading', disabled && 'icon-button--disabled']
      .filter(Boolean)
      .join(' ');

    const buttonClasses = [
      baseClasses,
      sizeClass,
      variantClass,
      shapeClass,
      stateClasses,
      className,
    ]
      .filter(Boolean)
      .join(' ');

    const button = (
      <button
        ref={ref}
        type="button"
        className={buttonClasses}
        style={style}
        disabled={disabled || loading}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        {loading ? <Spinner size={size} /> : iconToShow}
      </button>
    );

    // Wrap with tooltip if needed
    if (tooltip) {
      return (
        <Tooltip text={tooltip} show={showTooltip}>
          {button}
        </Tooltip>
      );
    }

    return button;
  }
);

IconButton.displayName = 'IconButton';
