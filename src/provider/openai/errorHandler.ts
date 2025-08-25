/**
 * @file OpenAI Error Handler
 *
 * Handles error processing and formatting for OpenAI API errors,
 * including rate limits, authentication, and network errors.
 */

import type { ProviderError, ErrorType } from '../../types/providers';
import type { OpenAIError } from './types';

/**
 * Format OpenAI error into provider error structure
 */
export function formatError(error: any): ProviderError {
  let errorType: ErrorType = 'unknown';
  let message = 'Unknown error occurred';
  let code = 'UNKNOWN_ERROR';
  let retryAfter: number | undefined;

  // Handle OpenAI API errors
  if (error?.error) {
    const apiError = error.error;
    message = apiError.message || message;
    code = apiError.code || code;

    // Determine error type based on OpenAI error structure
    if (apiError.type === 'invalid_request_error' || apiError.code?.includes('api_key')) {
      errorType = 'authentication';
    } else if (apiError.type === 'rate_limit_error' || apiError.code?.includes('rate_limit')) {
      errorType = 'rate_limit';
      // Extract retry-after from headers if available
      if (error.headers?.['retry-after']) {
        retryAfter = parseInt(error.headers['retry-after'], 10);
      }
    } else if (apiError.type?.includes('network') || error.code === 'ECONNREFUSED') {
      errorType = 'network';
    } else if (apiError.type?.includes('validation')) {
      errorType = 'validation';
    }
  } else if (error instanceof Error) {
    message = error.message;

    // Handle common JavaScript/network errors
    if (error.name === 'NetworkError' || error.message.includes('network')) {
      errorType = 'network';
      code = 'NETWORK_ERROR';
    } else if (error.message.includes('abort')) {
      errorType = 'network';
      code = 'REQUEST_ABORTED';
    }
  }

  return createProviderError(errorType, message, code, {
    retryAfter,
    details: {
      statusCode: error?.status || error?.statusCode,
      originalError: error,
    },
  });
}

/**
 * Create a provider error with standard structure
 */
export function createProviderError(
  type: ErrorType,
  message: string,
  code: string,
  details?: {
    retryAfter?: number;
    details?: any;
  }
): ProviderError {
  const error: ProviderError = {
    type,
    message,
    code,
    provider: 'openai',
  };

  if (details?.retryAfter) {
    error.retryAfter = details.retryAfter;
  }
  if (details?.details) {
    error.details = details.details;
  }

  return error;
}

/**
 * Handle error response from OpenAI API
 */
export async function handleErrorResponse(response: Response): Promise<void> {
  let errorData: OpenAIError | null = null;

  try {
    errorData = await response.json();
  } catch {
    // If we can't parse JSON, create a basic error
    throw formatError({
      error: {
        message: `HTTP ${response.status}: ${response.statusText}`,
        type: 'api_error',
        code: `HTTP_${response.status}`,
      },
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
    });
  }

  // Throw formatted error
  throw formatError({
    ...errorData,
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
  });
}

/**
 * Wrap async function with error handling
 */
export async function withErrorHandling<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    // Wrap in Error instance with ProviderError fields for consistency
    const formatted = formatError(error);
    const providerError = new Error(formatted.message) as Error & typeof formatted;
    Object.assign(providerError, formatted);
    throw providerError;
  }
}

/**
 * Wrap async generator with error handling
 */
export async function* withErrorHandlingGenerator<T>(fn: () => AsyncIterable<T>): AsyncIterable<T> {
  try {
    yield* fn();
  } catch (error) {
    const formatted = formatError(error);
    const providerError = new Error(formatted.message) as Error & typeof formatted;
    Object.assign(providerError, formatted);
    throw providerError;
  }
}
