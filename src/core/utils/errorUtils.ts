/**
 * @file Error Utilities
 *
 * Pure utility functions for error handling and classification
 */

import type { ErrorSource } from '@/types/errors';

/**
 * Error type guards and utilities
 */
export function isNetworkError(error: Error | string): boolean {
  const message = typeof error === 'string' ? error : error.message;
  return (
    message.toLowerCase().includes('network') ||
    message.toLowerCase().includes('timeout') ||
    message.toLowerCase().includes('connection') ||
    message.toLowerCase().includes('fetch')
  );
}

export function isAuthError(error: Error | string): boolean {
  const message = typeof error === 'string' ? error : error.message;
  return (
    message.toLowerCase().includes('unauthorized') ||
    message.toLowerCase().includes('401') ||
    message.toLowerCase().includes('403') ||
    message.toLowerCase().includes('api key') ||
    message.toLowerCase().includes('authentication')
  );
}

export function getErrorSource(error: Error | string): ErrorSource {
  if (isNetworkError(error)) return 'network';
  if (isAuthError(error)) return 'provider';

  const message = typeof error === 'string' ? error : error.message;
  if (message.toLowerCase().includes('chat') || message.toLowerCase().includes('message'))
    return 'chat';
  if (message.toLowerCase().includes('settings') || message.toLowerCase().includes('storage'))
    return 'settings';
  if (message.toLowerCase().includes('provider') || message.toLowerCase().includes('api'))
    return 'provider';

  return 'unknown';
}
