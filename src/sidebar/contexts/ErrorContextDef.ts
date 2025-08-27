/**
 * @file Error Context Definition
 *
 * Separated context definition to avoid React Fast Refresh warnings
 */

import { createContext } from 'react';

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

export interface ErrorContextValue {
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
