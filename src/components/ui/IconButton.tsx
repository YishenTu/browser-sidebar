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

// CSS styles - using regular CSS to avoid Tailwind @apply issues in tests
const iconButtonStyles = `
.icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  outline: none;
  position: relative;
}

.icon-button:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5);
}

.icon-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

/* Sizes */
.icon-button--sm {
  width: 2rem;
  height: 2rem;
  font-size: 0.875rem;
}

.icon-button--md {
  width: 2.5rem;
  height: 2.5rem;
  font-size: 1rem;
}

.icon-button--lg {
  width: 3rem;
  height: 3rem;
  font-size: 1.125rem;
}

/* Shapes */
.icon-button--circular {
  border-radius: 9999px;
}

.icon-button--square {
  border-radius: 0.375rem;
}

/* Variants */
.icon-button--primary {
  background-color: #3b82f6;
  color: white;
}

.icon-button--primary:hover {
  background-color: #2563eb;
}

.icon-button--primary:active {
  background-color: #1d4ed8;
}

.icon-button--secondary {
  background-color: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
}

.icon-button--secondary:hover {
  background-color: #e5e7eb;
}

.icon-button--secondary:active {
  background-color: #d1d5db;
}

.icon-button--ghost {
  background-color: transparent;
  color: #4b5563;
}

.icon-button--ghost:hover {
  background-color: #f3f4f6;
}

.icon-button--ghost:active {
  background-color: #e5e7eb;
}

/* States */
.icon-button--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.icon-button--loading {
  cursor: not-allowed;
}

/* Spinner animation */
.icon-button__spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Tooltip */
.icon-button__tooltip-container {
  position: relative;
  display: inline-block;
}

.icon-button__tooltip {
  position: absolute;
  z-index: 50;
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  color: white;
  background-color: #111827;
  border-radius: 0.25rem;
  pointer-events: none;
  opacity: 1;
  
  /* Position tooltip above button */
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
}

.icon-button__tooltip::after {
  content: '';
  position: absolute;
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-top: 4px solid #111827;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
}

/* Dark mode tooltip */
.dark .icon-button__tooltip {
  background-color: #374151;
  color: #e5e7eb;
}

.dark .icon-button__tooltip::after {
  border-top-color: #374151;
}

/* Dark mode variants */
.dark .icon-button--secondary {
  background-color: #374151;
  color: #e5e7eb;
  border-color: #4b5563;
}

.dark .icon-button--secondary:hover {
  background-color: #4b5563;
}

.dark .icon-button--secondary:active {
  background-color: #6b7280;
}

.dark .icon-button--ghost {
  color: #9ca3af;
}

.dark .icon-button--ghost:hover {
  background-color: #1f2937;
}

.dark .icon-button--ghost:active {
  background-color: #374151;
}

/* Ensure icons are centered */
.icon-button svg {
  flex-shrink: 0;
}

/* Handle different icon sizes based on button size */
.icon-button--sm svg {
  width: 16px;
  height: 16px;
}

.icon-button--md svg {
  width: 20px;
  height: 20px;
}

.icon-button--lg svg {
  width: 24px;
  height: 24px;
}
`;

// Inject styles when component is first imported
if (typeof document !== 'undefined') {
  const styleId = 'icon-button-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = iconButtonStyles;
    document.head.appendChild(style);
  }
}
