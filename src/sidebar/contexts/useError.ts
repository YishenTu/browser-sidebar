/**
 * @file useError Hook
 *
 * Hook to use the error context, separated from ErrorContext
 * to avoid React Fast Refresh warnings
 */

import { useContext } from 'react';
import { ErrorContext } from './ErrorContext';

/**
 * Hook to use the error context
 */
export function useError() {
  const context = useContext(ErrorContext);
  if (!context) {
    throw new Error('useError must be used within an ErrorProvider');
  }
  return context;
}
