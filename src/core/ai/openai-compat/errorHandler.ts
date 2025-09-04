/**
 * Error handler for OpenAI-Compatible providers
 */

import type { ProviderError, ErrorType } from '@/types/providers';

/**
 * Map OpenAI-Compatible API errors to ProviderError format
 */
export function mapErrorToProviderError(error: unknown): ProviderError {
  // Default error structure
  const providerError: ProviderError = {
    type: 'unknown' as ErrorType,
    message: 'Unknown error occurred',
    code: 'UNKNOWN_ERROR',
    provider: 'openai_compat',
    details: {},
  };

  if (error instanceof Error) {
    providerError.message = error.message;

    // Check if it's an OpenAI SDK error
    const openAIError = error as {
      status?: number;
      headers?: Record<string, string>;
      error?: unknown;
      type?: string;
      code?: string;
      message?: string;
    };

    if (typeof openAIError.status === 'number') {
      providerError.details!.statusCode = openAIError.status;

      switch (openAIError.status) {
        case 401:
          providerError.type = 'authentication';
          providerError.code = 'AUTHENTICATION_ERROR';
          providerError.message = 'Invalid API key or authentication failed';
          break;
        case 429:
          providerError.type = 'rate_limit';
          providerError.code = 'RATE_LIMIT_ERROR';
          providerError.message = 'Rate limit exceeded';

          // Extract retry-after header if available
          if (openAIError.headers?.['retry-after']) {
            providerError.retryAfter = parseInt(openAIError.headers['retry-after']);
          }
          break;
        case 400:
          providerError.type = 'validation';
          providerError.code = 'VALIDATION_ERROR';
          providerError.message =
            (openAIError.error as { message?: string } | undefined)?.message ||
            'Invalid request parameters';
          break;
        case 404:
          providerError.type = 'validation';
          providerError.code = 'MODEL_NOT_FOUND';
          providerError.message = 'Model not found or endpoint not available';
          break;
        case 500:
        case 502:
        case 503:
        case 504:
          providerError.type = 'network';
          providerError.code = 'SERVER_ERROR';
          providerError.message = 'Server error occurred';
          break;
        default:
          if (openAIError.status >= 400 && openAIError.status < 500) {
            providerError.type = 'validation';
            providerError.code = 'CLIENT_ERROR';
          } else {
            providerError.type = 'network';
            providerError.code = 'NETWORK_ERROR';
          }
      }
    } else if (openAIError.code === 'ECONNREFUSED' || openAIError.code === 'ENOTFOUND') {
      providerError.type = 'network';
      providerError.code = 'CONNECTION_ERROR';
      providerError.message = 'Failed to connect to the API endpoint';
    } else if (openAIError.message?.includes('timeout')) {
      providerError.type = 'network';
      providerError.code = 'TIMEOUT_ERROR';
      providerError.message = 'Request timed out';
    }

    // Add error details
    if (openAIError.error) {
      providerError.details!['error'] = openAIError.error;
    }
    if (openAIError.type) {
      providerError.details!['errorType'] = openAIError.type;
    }
  }

  // Add timestamp
  providerError.details!['timestamp'] = new Date();

  return providerError;
}
