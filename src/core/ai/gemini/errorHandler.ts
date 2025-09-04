/**
 * @file Gemini Error Handler
 *
 * Centralized error handling for Gemini API interactions.
 * Handles authentication, rate limiting, validation errors, and network issues.
 */

import type { ProviderError, ErrorType } from '../../../types/providers';
import { GEMINI_API_CONFIG } from './types';

/**
 * Error response structure from Gemini API
 */
interface GeminiErrorResponse {
  error?: {
    message?: string;
    code?: string;
    status?: string;
    details?: Array<{
      reason?: string;
      message?: string;
    }>;
    retry_after?: number;
  };
  message?: string;
  status?: number;
}

/**
 * Handle error responses from Gemini API
 */
export async function handleErrorResponse(response: Response): Promise<never> {
  let errorData: GeminiErrorResponse = {};

  try {
    errorData = await response.json();
  } catch {
    // If JSON parsing fails, use response status
    errorData = {
      status: response.status,
      message: response.statusText,
    };
  }

  // Extract retry-after header for rate limiting
  const retryAfter = response.headers?.get?.('retry-after');
  if (retryAfter) {
    if (!errorData.error) {
      errorData.error = {};
    }
    errorData.error.retry_after = parseInt(retryAfter, 10);
  }

  // Create specific error message based on status
  const specificMessage = getSpecificErrorMessage(response.status, errorData);

  const formattedError = formatError({
    ...errorData,
    status: response.status,
    message: specificMessage || errorData.error?.message || errorData.message || 'Unknown error',
  });

  // Create error with provider error properties
  const error = new Error(specificMessage || formattedError.message) as Error &
    typeof formattedError;
  Object.assign(error, formattedError);

  throw error;
}

/**
 * Get specific error message based on status code
 */
function getSpecificErrorMessage(status: number, errorData: GeminiErrorResponse): string {
  switch (status) {
    case 400:
      return getBadRequestMessage(errorData);
    case 401:
      return 'Authentication failed. Please check your Google API key is valid and has Gemini API enabled.';
    case 403:
      return 'Access denied. Make sure your Google API key has access to Gemini API. You may need to enable it at console.cloud.google.com';
    case 404:
      return 'Model not found. The selected Gemini model may not be available in your region or with your API key.';
    case 429:
      return getRateLimitMessage(errorData);
    case 500:
      return 'Gemini API server error. Please try again later.';
    case 503:
      return 'Gemini API service unavailable. Please try again later.';
    default:
      return '';
  }
}

/**
 * Get bad request error message with details
 */
function getBadRequestMessage(errorData: GeminiErrorResponse): string {
  const details = errorData.error?.details
    ?.map(d => d.reason || d.message)
    .filter(Boolean)
    .join(', ');

  return details
    ? `Invalid request: ${details}`
    : `Bad request: ${errorData.error?.message || errorData.message || 'Unknown error'}`;
}

/**
 * Get rate limit error message with retry information
 */
function getRateLimitMessage(errorData: GeminiErrorResponse): string {
  const retryAfter = errorData.error?.retry_after;
  if (retryAfter) {
    return `Rate limit exceeded. Please retry after ${retryAfter} seconds.`;
  }
  return 'Rate limit exceeded. Please wait before making more requests.';
}

/**
 * Format error into provider error structure
 */
export function formatError(error: unknown): ProviderError {
  let errorType: ErrorType = 'unknown';
  let message = 'An unexpected error occurred';
  let code = 'GEMINI_ERROR';
  let retryAfter: number | undefined;
  let details: Record<string, unknown> = {
    timestamp: new Date(),
  };

  const err = error as {
    message?: string;
    error?: { message?: string; code?: string; retry_after?: number };
    status?: number;
    code?: string;
    details?: Record<string, unknown>;
    field?: string;
    value?: unknown;
    name?: string;
  };

  // Handle different error structures
  if (err) {
    // Extract message
    if (err.message) {
      message = err.message;
    } else if (err.error?.message) {
      message = err.error.message;
    }

    // Determine error type based on status or code
    errorType = determineErrorType(err);
    code = getErrorCode(errorType);

    // Set retry after for rate limits
    if (errorType === 'rate_limit') {
      retryAfter = err.error?.retry_after || GEMINI_API_CONFIG.DEFAULT_RETRY_AFTER;
    }

    // Add status code to details if available
    if (err.status) {
      details['statusCode'] = err.status;
    }

    // Add additional error details
    if (err.details) {
      details = { ...details, ...err.details };
    }

    // Add error-specific details
    if (err.field) {
      details['field'] = err.field;
    }
    if (err.value) {
      details['value'] = err.value;
    }

    // Add original error code if present
    if (err.error?.code) {
      details['originalCode'] = err.error.code;
    }
  }

  const providerError: ProviderError = {
    type: errorType,
    message,
    code,
    provider: 'gemini',
    details,
  };

  if (retryAfter !== undefined) {
    providerError.retryAfter = retryAfter;
  }

  return providerError;
}

/**
 * Determine error type from error object
 */
function determineErrorType(error: unknown): ErrorType {
  const err = error as {
    status?: number;
    code?: string;
    message?: string;
    name?: string;
  };

  // Check by HTTP status
  if (err.status === 401 || err.code === 'UNAUTHENTICATED') {
    return 'authentication';
  }
  if (err.status === 429 || err.code === 'RESOURCE_EXHAUSTED') {
    return 'rate_limit';
  }
  if (err.status === 400 || err.code === 'INVALID_ARGUMENT') {
    return 'validation';
  }
  if (err.status === 403 || err.code === 'PERMISSION_DENIED') {
    return 'authentication';
  }

  // Check by error message content
  if (err.message) {
    const lowerMessage = err.message.toLowerCase();
    if (lowerMessage.includes('network') || lowerMessage.includes('fetch')) {
      return 'network';
    }
    if (lowerMessage.includes('auth') || lowerMessage.includes('api key')) {
      return 'authentication';
    }
    if (lowerMessage.includes('rate') || lowerMessage.includes('quota')) {
      return 'rate_limit';
    }
    if (lowerMessage.includes('invalid') || lowerMessage.includes('validation')) {
      return 'validation';
    }
  }

  // Check for abort errors
  if (err.name === 'AbortError') {
    return 'network';
  }

  return 'unknown';
}

/**
 * Get error code for error type
 */
function getErrorCode(errorType: ErrorType): string {
  const codeMap: Record<ErrorType, string> = {
    authentication: 'GEMINI_AUTH_ERROR',
    rate_limit: 'GEMINI_RATE_LIMIT',
    validation: 'GEMINI_VALIDATION_ERROR',
    network: 'GEMINI_NETWORK_ERROR',
    unknown: 'GEMINI_ERROR',
  };

  return codeMap[errorType];
}

/**
 * Check if error is already formatted as ProviderError
 */
export function isProviderError(error: unknown): error is ProviderError {
  return (
    !!error &&
    typeof error === 'object' &&
    'type' in error &&
    'provider' in error &&
    (error as { provider: unknown }).provider === 'gemini'
  );
}

/**
 * Wrap error handling for async operations
 */
export async function withErrorHandling<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    // Handle abort errors
    if (error instanceof Error && error.name === 'AbortError') {
      throw error;
    }

    // If already a provider error, re-throw
    if (isProviderError(error)) {
      throw error;
    }

    // Format and throw as provider error
    const formattedError = formatError(error);
    const providerError = new Error(formattedError.message) as Error & typeof formattedError;
    Object.assign(providerError, formattedError);
    throw providerError;
  }
}

/**
 * Wrap error handling for async generator operations
 */
export async function* withErrorHandlingGenerator<T>(
  operation: () => AsyncGenerator<T>
): AsyncGenerator<T> {
  try {
    yield* operation();
  } catch (error) {
    // Handle abort errors
    if (error instanceof Error && error.name === 'AbortError') {
      throw error;
    }

    // If already a provider error, re-throw
    if (isProviderError(error)) {
      throw error;
    }

    // Format and throw as provider error
    const formattedError = formatError(error);
    const providerError = new Error(formattedError.message) as Error & typeof formattedError;
    Object.assign(providerError, formattedError);
    throw providerError;
  }
}
