/**
 * @file Shared Error Types
 *
 * Common error types used across the application
 */

/**
 * Error source categories
 */
export type ErrorSource = 'chat' | 'settings' | 'provider' | 'network' | 'unknown';

/**
 * Error severity levels
 */
export type ErrorType = 'error' | 'warning' | 'info';

/**
 * Base error structure for application errors
 */
export interface AppError {
  id: string;
  message: string;
  type: ErrorType;
  source: ErrorSource;
  timestamp: Date;
  dismissible: boolean;
  action?: {
    label: string;
    handler: () => void;
  };
}
