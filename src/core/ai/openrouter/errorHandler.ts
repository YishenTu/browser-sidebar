/**
 * OpenRouter Error Handler
 */

import type { ProviderError, ErrorType } from '../../../types/providers';
import type { OpenRouterError } from './types';

/**
 * Map OpenRouter error to ProviderError
 */
export function mapErrorToProviderError(error: unknown): ProviderError {
  // Handle fetch/network errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return {
      type: 'network',
      message: 'Network error: Unable to connect to OpenRouter',
      code: 'NETWORK_ERROR',
      provider: 'openrouter',
      details: {
        timestamp: new Date(),
      },
    };
  }

  // Handle abort errors
  if (error instanceof Error && error.name === 'AbortError') {
    return {
      type: 'network',
      message: 'Request was cancelled',
      code: 'REQUEST_CANCELLED',
      provider: 'openrouter',
      details: {
        timestamp: new Date(),
      },
    };
  }

  // Handle HTTP response errors
  if (error instanceof Response) {
    return mapResponseToProviderError(error);
  }

  // Handle OpenRouter API errors
  if (isOpenRouterError(error)) {
    return mapOpenRouterError(error);
  }

  // Handle generic errors
  if (error instanceof Error) {
    return {
      type: 'unknown',
      message: error.message,
      code: 'UNKNOWN_ERROR',
      provider: 'openrouter',
      details: {
        timestamp: new Date(),
        originalError: error.message,
      },
    };
  }

  // Fallback for unknown error types
  return {
    type: 'unknown',
    message: 'An unknown error occurred',
    code: 'UNKNOWN_ERROR',
    provider: 'openrouter',
    details: {
      timestamp: new Date(),
      originalError: String(error),
    },
  };
}

/**
 * Map HTTP response to ProviderError
 */
function mapResponseToProviderError(response: Response): ProviderError {
  const statusCode = response.status;
  let errorType: ErrorType;
  let message: string;
  let code: string;

  switch (statusCode) {
    case 401:
    case 403:
      errorType = 'authentication';
      message = 'Invalid or missing API key';
      code = 'AUTH_ERROR';
      break;
    case 402:
      errorType = 'rate_limit';
      message = 'Insufficient credits or quota exceeded';
      code = 'QUOTA_EXCEEDED';
      break;
    case 404:
      errorType = 'validation';
      message = 'Model not found or invalid endpoint';
      code = 'NOT_FOUND';
      break;
    case 429:
      errorType = 'rate_limit';
      message = 'Rate limit exceeded';
      code = 'RATE_LIMIT';
      break;
    case 500:
    case 502:
    case 503:
    case 504:
      errorType = 'network';
      message = 'OpenRouter service error';
      code = 'SERVICE_ERROR';
      break;
    default:
      errorType = 'unknown';
      message = `HTTP error ${statusCode}`;
      code = `HTTP_${statusCode}`;
  }

  const error: ProviderError = {
    type: errorType,
    message,
    code,
    provider: 'openrouter',
    details: {
      statusCode,
      timestamp: new Date(),
    },
  };

  // Add retry-after header if present
  const retryAfter = response.headers.get('Retry-After');
  if (retryAfter) {
    error.retryAfter = parseInt(retryAfter, 10);
  }

  return error;
}

/**
 * Map OpenRouter API error to ProviderError
 */
function mapOpenRouterError(error: OpenRouterError): ProviderError {
  const errorMessage = error.error.message;
  const errorType = error.error.type;
  const errorCode = error.error.code;

  let type: ErrorType;
  let code: string;

  // Map error types
  if (errorType === 'invalid_request_error') {
    type = 'validation';
    code = 'INVALID_REQUEST';
  } else if (errorType === 'authentication_error') {
    type = 'authentication';
    code = 'AUTH_ERROR';
  } else if (errorType === 'rate_limit_error') {
    type = 'rate_limit';
    code = 'RATE_LIMIT';
  } else if (errorType === 'api_error') {
    type = 'network';
    code = 'API_ERROR';
  } else {
    type = 'unknown';
    code = errorCode?.toString() || 'UNKNOWN_ERROR';
  }

  return {
    type,
    message: errorMessage,
    code,
    provider: 'openrouter',
    details: {
      timestamp: new Date(),
      originalType: errorType,
      originalCode: errorCode,
    },
  };
}

/**
 * Type guard for OpenRouter errors
 */
function isOpenRouterError(error: unknown): error is OpenRouterError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'error' in error &&
    typeof (error as { error: unknown }).error === 'object' &&
    (error as { error: unknown }).error !== null &&
    'message' in (error as { error: Record<string, unknown> }).error
  );
}

/**
 * Extract retry delay from error
 */
export function getRetryDelay(error: ProviderError): number | null {
  if (error.retryAfter) {
    return error.retryAfter * 1000; // Convert seconds to milliseconds
  }

  // Default retry delays based on error type
  switch (error.type) {
    case 'rate_limit':
      return 60000; // 1 minute
    case 'network':
      return 5000; // 5 seconds
    default:
      return null;
  }
}
