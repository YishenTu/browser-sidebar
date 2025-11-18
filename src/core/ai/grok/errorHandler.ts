/**
 * @file Grok Error Handler
 *
 * Handles error processing and formatting for Grok API
 */

import type { ProviderError } from '../../../types/providers';

/**
 * Format error for Grok provider
 */
export function formatError(error: unknown): ProviderError {
  if (error instanceof Error) {
    // Check for network errors
    if (error.message.includes('fetch') || error.message.includes('network')) {
      return {
        type: 'network',
        message: error.message,
        code: 'NETWORK_ERROR',
        provider: 'grok',
      };
    }

    // Check for authentication errors
    if (error.message.includes('401') || error.message.includes('authentication')) {
      return {
        type: 'authentication',
        message: 'Invalid Grok API key',
        code: 'INVALID_API_KEY',
        provider: 'grok',
      };
    }

    // Check for rate limit errors
    if (error.message.includes('429') || error.message.includes('rate limit')) {
      return {
        type: 'rate_limit',
        message: 'Grok API rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED',
        provider: 'grok',
      };
    }

    // Default error
    return {
      type: 'unknown',
      message: error.message,
      code: 'UNKNOWN_ERROR',
      provider: 'grok',
    };
  }

  // Unknown error type
  return {
    type: 'unknown',
    message: 'An unknown error occurred',
    code: 'UNKNOWN_ERROR',
    provider: 'grok',
  };
}

/**
 * Wrap async generator with error handling
 */
export async function* withErrorHandlingGenerator<T>(
  generator: () => AsyncIterable<T>
): AsyncIterable<T> {
  try {
    yield* generator();
  } catch (error) {
    const formattedError = formatError(error);
    throw new Error(formattedError.message);
  }
}
