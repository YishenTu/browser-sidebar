/**
 * @file Error Banner Component
 *
 * Unified error banner that displays errors from the centralized error context.
 */

import { useError } from '@contexts/ErrorContext';
import { Alert } from '@ui/Alert';

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

  const badge = errorQueue.length > 0 ? `(+${errorQueue.length} more)` : undefined;

  return (
    <Alert
      type={currentError.type}
      message={currentError.message}
      dismissible={currentError.dismissible}
      onDismiss={() => dismissError(currentError.id)}
      action={currentError.action}
      className={`ai-sidebar-error-banner ${className}`}
      badge={badge}
      showIcon={true}
    />
  );
}
