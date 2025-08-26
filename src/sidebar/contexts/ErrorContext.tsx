/**
 * @file Error Context
 *
 * Centralized error management context to prevent multiple error banners
 * and provide consistent error handling across the application.
 */

import { createContext, useState, useCallback, ReactNode } from 'react';

export interface AppError {
  id: string;
  message: string;
  type: 'error' | 'warning' | 'info';
  source: 'chat' | 'settings' | 'provider' | 'network' | 'unknown';
  timestamp: Date;
  dismissible: boolean;
  action?: {
    label: string;
    handler: () => void;
  };
}

interface ErrorContextValue {
  /** Current active error (only one shown at a time) */
  currentError: AppError | null;
  /** Queue of pending errors */
  errorQueue: AppError[];
  /** Add an error to the queue */
  addError: (error: Omit<AppError, 'id' | 'timestamp'>) => void;
  /** Clear the current error and show next in queue */
  dismissError: (id?: string) => void;
  /** Clear all errors */
  clearAllErrors: () => void;
  /** Check if there are any errors */
  hasErrors: () => boolean;
}

export const ErrorContext = createContext<ErrorContextValue | undefined>(undefined);

export interface ErrorProviderProps {
  children: ReactNode;
}

/**
 * Error Provider Component
 *
 * Manages application-wide error state with a queue system to prevent
 * multiple simultaneous error banners.
 */
export function ErrorProvider({ children }: ErrorProviderProps) {
  const [currentError, setCurrentError] = useState<AppError | null>(null);
  const [errorQueue, setErrorQueue] = useState<AppError[]>([]);

  const addError = useCallback(
    (error: Omit<AppError, 'id' | 'timestamp'>) => {
      const newError: AppError = {
        ...error,
        id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
      };

      setErrorQueue(queue => {
        // If this is the first error, show it immediately
        if (!currentError && queue.length === 0) {
          setCurrentError(newError);
          return [];
        }
        // Otherwise, add to queue
        return [...queue, newError];
      });

      // If no current error, show this one
      if (!currentError) {
        setCurrentError(newError);
      }
    },
    [currentError]
  );

  const dismissError = useCallback(
    (id?: string) => {
      // If dismissing a specific error
      if (id) {
        // If it's the current error, clear it and show next
        if (currentError?.id === id) {
          const nextError = errorQueue[0];
          setCurrentError(nextError || null);
          setErrorQueue(queue => queue.slice(1));
        } else {
          // Remove from queue
          setErrorQueue(queue => queue.filter(e => e.id !== id));
        }
      } else {
        // Dismiss current error and show next
        const nextError = errorQueue[0];
        setCurrentError(nextError || null);
        setErrorQueue(queue => queue.slice(1));
      }
    },
    [currentError, errorQueue]
  );

  const clearAllErrors = useCallback(() => {
    setCurrentError(null);
    setErrorQueue([]);
  }, []);

  const hasErrors = useCallback(() => {
    return currentError !== null || errorQueue.length > 0;
  }, [currentError, errorQueue]);

  const value: ErrorContextValue = {
    currentError,
    errorQueue,
    addError,
    dismissError,
    clearAllErrors,
    hasErrors,
  };

  return <ErrorContext.Provider value={value}>{children}</ErrorContext.Provider>;
}

// useError hook is exported from ./useError.ts to avoid React Fast Refresh warnings
