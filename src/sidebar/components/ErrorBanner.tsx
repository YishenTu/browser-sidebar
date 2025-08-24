/**
 * @file Error Banner Component
 *
 * Unified error banner that displays errors from the centralized error context.
 */

import { useError } from '@contexts/ErrorContext';

export interface ErrorBannerProps {
  /** Custom CSS class */
  className?: string;
}

/**
 * Error Banner Component
 *
 * Displays the current error from the error context with consistent styling
 * and dismissal functionality.
 */
export function ErrorBanner({ className = '' }: ErrorBannerProps) {
  const { currentError, errorQueue, dismissError } = useError();

  if (!currentError) {
    return null;
  }

  const getBackgroundColor = () => {
    switch (currentError.type) {
      case 'error':
        return '#fee';
      case 'warning':
        return '#fff3cd';
      case 'info':
        return '#d1ecf1';
      default:
        return '#fee';
    }
  };

  const getBorderColor = () => {
    switch (currentError.type) {
      case 'error':
        return '#fcc';
      case 'warning':
        return '#ffeaa7';
      case 'info':
        return '#bee5eb';
      default:
        return '#fcc';
    }
  };

  const getTextColor = () => {
    switch (currentError.type) {
      case 'error':
        return '#c00';
      case 'warning':
        return '#856404';
      case 'info':
        return '#0c5460';
      default:
        return '#c00';
    }
  };

  const getIcon = () => {
    switch (currentError.type) {
      case 'error':
        return (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        );
      case 'warning':
        return (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        );
      case 'info':
        return (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className={`ai-sidebar-error-banner ${className}`}
      style={{
        backgroundColor: getBackgroundColor(),
        borderBottom: `1px solid ${getBorderColor()}`,
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        color: getTextColor(),
        fontSize: '14px',
        position: 'relative',
      }}
      role="alert"
      aria-live="assertive"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
        {getIcon()}
        <span>{currentError.message}</span>
        {errorQueue.length > 0 && (
          <span
            style={{
              marginLeft: '8px',
              fontSize: '12px',
              opacity: 0.7,
            }}
          >
            (+{errorQueue.length} more)
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {currentError.action && (
          <button
            onClick={currentError.action.handler}
            style={{
              background: 'none',
              border: `1px solid ${getTextColor()}`,
              color: getTextColor(),
              cursor: 'pointer',
              padding: '2px 8px',
              fontSize: '12px',
              borderRadius: '3px',
              opacity: 0.8,
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '0.8')}
          >
            {currentError.action.label}
          </button>
        )}

        {currentError.dismissible && (
          <button
            onClick={() => dismissError(currentError.id)}
            style={{
              background: 'none',
              border: 'none',
              color: getTextColor(),
              cursor: 'pointer',
              padding: '4px',
              fontSize: '18px',
              lineHeight: '1',
              opacity: 0.7,
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}
            aria-label="Dismiss error"
            title="Dismiss"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
