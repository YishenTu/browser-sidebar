import React from 'react';
import { Spinner } from './ui';
import { ErrorIcon, RegenerateIcon } from './ui/Icons';

export type TabLoadingIndicatorStatus = 'idle' | 'loading' | 'error';
export type TabLoadingIndicatorSize = 'small' | 'medium' | 'large';

export interface TabLoadingIndicatorProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Current status of the tab loading process
   */
  status: TabLoadingIndicatorStatus;

  /**
   * Size variant for the indicator
   * @default "medium"
   */
  size?: TabLoadingIndicatorSize;

  /**
   * Custom error message to display in error state
   * @default "Failed to load tab content"
   */
  errorMessage?: string;

  /**
   * Callback function for retry action in error state
   */
  onRetry?: () => void;

  /**
   * Additional loading text to display alongside spinner
   */
  loadingText?: string;

  /**
   * Whether to show text labels (useful for compact layouts)
   * @default true
   */
  showText?: boolean;

  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * TabLoadingIndicator Component
 * 
 * A versatile loading indicator for tab extraction states with:
 * - Loading spinner with optional text
 * - Error state with retry functionality
 * - Multiple sizes for different UI contexts
 * - Smooth transitions between states
 * - Full accessibility support
 * 
 * Usage:
 * ```tsx
 * <TabLoadingIndicator
 *   status="loading"
 *   size="small"
 *   loadingText="Extracting content..."
 *   onRetry={() => handleRetry()}
 * />
 * ```
 */
export const TabLoadingIndicator: React.FC<TabLoadingIndicatorProps> = ({
  status,
  size = 'medium',
  errorMessage = 'Failed to load tab content',
  onRetry,
  loadingText,
  showText = true,
  className = '',
  style,
  ...rest
}) => {
  // Size configurations
  const sizeConfig = {
    small: {
      container: 'tab-loading-indicator--small',
      spinner: 'sm' as const,
      icon: 14,
      text: 'text-xs',
    },
    medium: {
      container: 'tab-loading-indicator--medium',
      spinner: 'md' as const,
      icon: 16,
      text: 'text-sm',
    },
    large: {
      container: 'tab-loading-indicator--large',
      spinner: 'lg' as const,
      icon: 20,
      text: 'text-base',
    },
  };

  const config = sizeConfig[size];
  const hasRetry = status === 'error' && onRetry;

  // Handle keyboard events for retry button
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if ((event.key === 'Enter' || event.key === ' ') && hasRetry) {
      event.preventDefault();
      onRetry?.();
    }
  };

  // Render loading state
  const renderLoading = () => (
    <div className="tab-loading-indicator__content" role="status" aria-live="polite">
      <Spinner
        size={config.spinner}
        aria-label="Loading tab content"
        className="tab-loading-indicator__spinner"
      />
      {showText && loadingText && (
        <span className={`tab-loading-indicator__text ${config.text}`}>
          {loadingText}
        </span>
      )}
    </div>
  );

  // Render error state
  const renderError = () => (
    <div className="tab-loading-indicator__content tab-loading-indicator__content--error">
      <div className="tab-loading-indicator__error-content">
        <ErrorIcon
          size={config.icon}
          className="tab-loading-indicator__error-icon"
          aria-hidden="true"
        />
        {showText && (
          <span className={`tab-loading-indicator__text ${config.text}`}>
            {errorMessage}
          </span>
        )}
      </div>
      {hasRetry && (
        <button
          type="button"
          onClick={onRetry}
          onKeyDown={handleKeyDown}
          className="tab-loading-indicator__retry-button"
          aria-label={`Retry loading: ${errorMessage}`}
          title="Retry loading"
        >
          <RegenerateIcon
            size={config.icon}
            className="tab-loading-indicator__retry-icon"
            aria-hidden="true"
          />
          {showText && size !== 'small' && (
            <span className="tab-loading-indicator__retry-text">Retry</span>
          )}
        </button>
      )}
    </div>
  );

  // Don't render anything for idle state
  if (status === 'idle') {
    return null;
  }

  return (
    <div
      className={`tab-loading-indicator ${config.container} ${className}`.trim()}
      style={style}
      {...rest}
    >
      {status === 'loading' && renderLoading()}
      {status === 'error' && renderError()}
    </div>
  );
};