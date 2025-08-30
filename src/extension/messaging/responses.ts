/**
 * @file Response creation utilities for extension messaging
 */

import { ExtensionError, ErrorCode } from './errors';

export interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code: ErrorCode;
    details?: Record<string, unknown>;
    timestamp: number;
  };
}

export interface SuccessResponse<T = unknown> {
  success: true;
  data?: T;
  timestamp: number;
}

export type StandardResponse<T = unknown> = SuccessResponse<T> | ErrorResponse;

export function createErrorResponse(
  error: ExtensionError | Error | string,
  details?: Record<string, unknown>
): ErrorResponse {
  let extensionError: ExtensionError;
  if (typeof error === 'string') {
    extensionError = new ExtensionError(error, ErrorCode.UNKNOWN_ERROR, details);
  } else if (error instanceof ExtensionError) {
    extensionError = error;
  } else {
    extensionError = new ExtensionError(error.message, ErrorCode.UNKNOWN_ERROR, {
      ...details,
      originalStack: error.stack,
    });
  }
  return {
    success: false,
    error: {
      message: extensionError.message,
      code: extensionError.code,
      details: extensionError.details,
      timestamp: extensionError.timestamp,
    },
  };
}

export function createSuccessResponse<T = unknown>(data?: T): SuccessResponse<T> {
  return { success: true, data, timestamp: Date.now() };
}
