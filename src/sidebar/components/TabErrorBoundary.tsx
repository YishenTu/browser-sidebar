/**
 * @file Tab Error Boundary Component
 *
 * React Error Boundary specifically designed for tab extraction operations.
 * Catches JavaScript errors in tab-related components and displays user-friendly
 * error messages with retry functionality. Prevents tab operation failures from
 * crashing the entire sidebar.
 */

import { Component, ErrorInfo, ReactNode } from 'react';
import { Alert } from '@ui/Alert';
import '../styles/4-features/tab-error-boundary.css';

export interface TabErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
  retryCount: number;
}

export interface TabErrorBoundaryProps {
  children: ReactNode;
  /** Custom fallback component to render instead of default error UI */
  fallback?: (error: Error, retry: () => void, reset: () => void) => ReactNode;
  /** Maximum number of automatic retries before showing persistent error */
  maxRetries?: number;
  /** Callback when an error occurs */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Custom error boundary identifier for logging */
  boundaryId?: string;
  /** Whether to log errors to console (default: true) */
  logErrors?: boolean;
  /** Custom CSS class */
  className?: string;
}

/**
 * Tab Error Boundary Component
 *
 * Catches and handles errors that occur within tab extraction components.
 * Provides user-friendly error messages and retry functionality to recover
 * from transient failures without crashing the entire sidebar.
 *
 * Features:
 * - Catches all JavaScript errors in child components
 * - Displays user-friendly error messages
 * - Retry mechanism with configurable max attempts
 * - Integration with existing Alert UI component
 * - Error logging and reporting
 * - Graceful fallback UI
 */
export class TabErrorBoundary extends Component<TabErrorBoundaryProps, TabErrorBoundaryState> {
  private retryTimeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(props: TabErrorBoundaryProps) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<TabErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorId: `tab-error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError, logErrors = true } = this.props;

    // Update state with error info
    this.setState({
      errorInfo,
    });

    // Log error details
    if (logErrors) {
      // Error logging would happen here
    }

    // Call custom error handler
    if (onError) {
      onError(error, errorInfo);
    }

    // Check if this looks like a tab extraction error and attempt auto-retry
    if (this.isTabExtractionError(error) && this.state.retryCount < (this.props.maxRetries || 2)) {
      this.scheduleRetry();
    }
  }

  override componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  /**
   * Determines if the error is likely related to tab extraction operations
   */
  private isTabExtractionError(error: Error): boolean {
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';

    // Look for common tab extraction error patterns
    const tabExtractionKeywords = [
      'tab',
      'extraction',
      'content script',
      'chrome.tabs',
      'sendmessage',
      'multitab',
      'tabinfo',
      'favicon',
      'readability',
    ];

    return tabExtractionKeywords.some(
      keyword => message.includes(keyword) || stack.includes(keyword)
    );
  }

  /**
   * Schedule an automatic retry after a short delay
   */
  private scheduleRetry = () => {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }

    // Exponential backoff: 1s, 2s, 4s...
    const delay = Math.pow(2, this.state.retryCount) * 1000;

    this.retryTimeoutId = setTimeout(
      () => {
        this.handleRetry();
      },
      Math.min(delay, 5000)
    ); // Cap at 5 seconds
  };

  /**
   * Retry the operation by resetting the error boundary
   */
  private handleRetry = () => {
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: prevState.retryCount + 1,
    }));
  };

  /**
   * Reset the error boundary to its initial state
   */
  private handleReset = () => {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: 0,
    });
  };

  /**
   * Get user-friendly error message based on error type
   */
  private getErrorMessage(error: Error): string {
    const message = error.message.toLowerCase();

    if (message.includes('network') || message.includes('fetch')) {
      return 'Unable to connect to tabs. Please check your network connection.';
    }

    if (message.includes('timeout') || message.includes('timed out')) {
      return 'Tab operation timed out. The page might be loading or unresponsive.';
    }

    if (message.includes('permission') || message.includes('denied')) {
      return 'Missing permissions to access tab content. Please refresh the page and try again.';
    }

    if (message.includes('content script')) {
      return 'Unable to communicate with the page. Try refreshing the page.';
    }

    if (this.isTabExtractionError(error)) {
      return 'Unable to extract content from tabs. This might be a temporary issue.';
    }

    // Generic error message
    return 'An unexpected error occurred while processing tabs.';
  }

  /**
   * Get error type for Alert component styling
   */
  private getErrorType(): 'error' | 'warning' {
    const { error } = this.state;

    if (!error) return 'error';

    const message = error.message.toLowerCase();

    // Warnings for non-critical errors
    if (message.includes('timeout') || message.includes('network')) {
      return 'warning';
    }

    return 'error';
  }

  override render() {
    const { hasError, error, retryCount } = this.state;
    const { children, fallback, maxRetries = 2, className = '' } = this.props;

    if (hasError && error) {
      // Use custom fallback if provided
      if (fallback) {
        return (
          <div className={`tab-error-boundary ${className}`}>
            {fallback(error, this.handleRetry, this.handleReset)}
          </div>
        );
      }

      // Default error UI
      const errorMessage = this.getErrorMessage(error);
      const errorType = this.getErrorType();
      const canRetry = retryCount < maxRetries;

      return (
        <div className={`tab-error-boundary ${className}`}>
          <Alert
            type={errorType}
            message={errorMessage}
            dismissible={true}
            onDismiss={this.handleReset}
            action={
              canRetry
                ? {
                    label: 'Retry',
                    handler: this.handleRetry,
                  }
                : undefined
            }
            className="tab-error-boundary__alert"
            showIcon={true}
          >
            {retryCount > 0 && (
              <div className="tab-error-boundary__retry-info">
                {canRetry
                  ? `Attempt ${retryCount + 1} of ${maxRetries + 1}`
                  : 'Max retries reached'}
              </div>
            )}

            {process.env['NODE_ENV'] === 'development' && (
              <details className="tab-error-boundary__debug">
                <summary>Error Details (Development)</summary>
                <pre className="tab-error-boundary__error-details">
                  {error.name}: {error.message}
                  {'\n'}
                  {error.stack}
                </pre>
              </details>
            )}
          </Alert>
        </div>
      );
    }

    return children;
  }
}

export default TabErrorBoundary;
