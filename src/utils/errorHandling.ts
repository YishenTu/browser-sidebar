/**
 * @file Error Handling Utilities
 * 
 * Provides standardized error handling for the extension with custom error types,
 * Chrome API error handling, and standardized error responses.
 */

/**
 * Extension-specific error codes
 */
export enum ErrorCode {
  // Message passing errors
  MESSAGE_TIMEOUT = 'MESSAGE_TIMEOUT',
  MESSAGE_VALIDATION_FAILED = 'MESSAGE_VALIDATION_FAILED',
  MESSAGE_SEND_FAILED = 'MESSAGE_SEND_FAILED',
  INVALID_MESSAGE_TARGET = 'INVALID_MESSAGE_TARGET',
  
  // Chrome API errors
  CHROME_RUNTIME_ERROR = 'CHROME_RUNTIME_ERROR',
  CHROME_STORAGE_ERROR = 'CHROME_STORAGE_ERROR',
  CHROME_TABS_ERROR = 'CHROME_TABS_ERROR',
  CHROME_SCRIPTING_ERROR = 'CHROME_SCRIPTING_ERROR',
  
  // Content script errors
  CONTENT_INJECTION_FAILED = 'CONTENT_INJECTION_FAILED',
  SIDEBAR_MOUNT_FAILED = 'SIDEBAR_MOUNT_FAILED',
  DOM_MANIPULATION_FAILED = 'DOM_MANIPULATION_FAILED',
  
  // Network and external errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  API_ERROR = 'API_ERROR',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  
  // General errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
}

/**
 * Extension-specific error class that extends the native Error class
 */
export class ExtensionError extends Error {
  public readonly code: ErrorCode;
  public readonly details?: Record<string, unknown>;
  public readonly timestamp: number;
  public readonly source?: string;

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.UNKNOWN_ERROR,
    details?: Record<string, unknown>,
    source?: string
  ) {
    super(message);
    this.name = 'ExtensionError';
    this.code = code;
    this.details = details;
    this.timestamp = Date.now();
    this.source = source;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ExtensionError);
    }
  }

  /**
   * Converts the error to a plain object for serialization
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      timestamp: this.timestamp,
      source: this.source,
      stack: this.stack,
    };
  }

  /**
   * Creates an ExtensionError from a plain object
   */
  static fromJSON(obj: Record<string, unknown>): ExtensionError {
    const error = new ExtensionError(
      obj.message as string,
      obj.code as ErrorCode,
      obj.details as Record<string, unknown>,
      obj.source as string
    );
    
    if (obj.stack) {
      error.stack = obj.stack as string;
    }
    
    return error;
  }
}

/**
 * Handles Chrome runtime errors and converts them to ExtensionErrors
 */
export function handleChromeError(
  operation: string,
  source?: string
): ExtensionError | null {
  const chromeError = chrome.runtime.lastError;
  
  if (!chromeError) {
    return null;
  }

  // Determine error code based on error message patterns
  let errorCode: ErrorCode = ErrorCode.CHROME_RUNTIME_ERROR;
  
  if (chromeError.message.includes('storage')) {
    errorCode = ErrorCode.CHROME_STORAGE_ERROR;
  } else if (chromeError.message.includes('tab')) {
    errorCode = ErrorCode.CHROME_TABS_ERROR;
  } else if (chromeError.message.includes('script')) {
    errorCode = ErrorCode.CHROME_SCRIPTING_ERROR;
  } else if (chromeError.message.includes('permission')) {
    errorCode = ErrorCode.PERMISSION_DENIED;
  }

  return new ExtensionError(
    `Chrome API error during ${operation}: ${chromeError.message}`,
    errorCode,
    {
      operation,
      originalError: chromeError.message,
    },
    source
  );
}

/**
 * Creates a standardized error response for message passing
 */
export interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code: ErrorCode;
    details?: Record<string, unknown>;
    timestamp: number;
  };
}

/**
 * Creates a standardized success response for message passing
 */
export interface SuccessResponse<T = unknown> {
  success: true;
  data?: T;
  timestamp: number;
}

/**
 * Union type for all response types
 */
export type StandardResponse<T = unknown> = SuccessResponse<T> | ErrorResponse;

/**
 * Creates a standardized error response
 */
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
    extensionError = new ExtensionError(
      error.message,
      ErrorCode.UNKNOWN_ERROR,
      { ...details, originalStack: error.stack }
    );
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

/**
 * Creates a standardized success response
 */
export function createSuccessResponse<T = unknown>(data?: T): SuccessResponse<T> {
  return {
    success: true,
    data,
    timestamp: Date.now(),
  };
}

/**
 * Wraps a function to automatically handle Chrome API errors
 */
export function withChromeErrorHandling<T extends unknown[], R>(
  fn: (...args: T) => R,
  operation: string,
  source?: string
): (...args: T) => R {
  return (...args: T): R => {
    try {
      const result = fn(...args);
      
      // Check for Chrome runtime errors after execution
      const chromeError = handleChromeError(operation, source);
      if (chromeError) {
        throw chromeError;
      }
      
      return result;
    } catch (error) {
      // If it's already an ExtensionError, re-throw it
      if (error instanceof ExtensionError) {
        throw error;
      }
      
      // Otherwise, wrap it in an ExtensionError
      throw new ExtensionError(
        `Error during ${operation}: ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.UNKNOWN_ERROR,
        {
          operation,
          originalError: error instanceof Error ? error.message : String(error),
        },
        source
      );
    }
  };
}

/**
 * Logs errors with consistent formatting
 */
export function logError(error: ExtensionError | Error, context?: string): void {
  const prefix = context ? `[${context}]` : '[Extension]';
  
  if (error instanceof ExtensionError) {
    console.error(`${prefix} ExtensionError [${error.code}]:`, {
      message: error.message,
      details: error.details,
      source: error.source,
      timestamp: new Date(error.timestamp).toISOString(),
      stack: error.stack,
    });
  } else {
    console.error(`${prefix} Unexpected Error:`, {
      message: error.message,
      stack: error.stack,
    });
  }
}

/**
 * Utility to check if an error is retriable based on its type
 */
export function isRetriableError(error: ExtensionError | Error): boolean {
  if (!(error instanceof ExtensionError)) {
    return false;
  }

  const retriableErrorCodes = [
    ErrorCode.MESSAGE_TIMEOUT,
    ErrorCode.MESSAGE_SEND_FAILED,
    ErrorCode.NETWORK_ERROR,
    ErrorCode.CHROME_RUNTIME_ERROR,
  ];

  return retriableErrorCodes.includes(error.code);
}

/**
 * Utility to determine if an error should be reported to the user
 */
export function shouldReportToUser(error: ExtensionError | Error): boolean {
  if (!(error instanceof ExtensionError)) {
    return true; // Report unexpected errors to user
  }

  const internalErrorCodes = [
    ErrorCode.MESSAGE_VALIDATION_FAILED,
    ErrorCode.CONFIGURATION_ERROR,
  ];

  return !internalErrorCodes.includes(error.code);
}

/**
 * Creates a user-friendly error message from an ExtensionError
 */
export function createUserFriendlyMessage(error: ExtensionError | Error): string {
  if (!(error instanceof ExtensionError)) {
    return 'An unexpected error occurred. Please try again.';
  }

  switch (error.code) {
    case ErrorCode.MESSAGE_TIMEOUT:
      return 'Request timed out. Please try again.';
    
    case ErrorCode.PERMISSION_DENIED:
      return 'Permission denied. Please check extension permissions.';
    
    case ErrorCode.NETWORK_ERROR:
      return 'Network error. Please check your connection and try again.';
    
    case ErrorCode.API_ERROR:
      return 'Service temporarily unavailable. Please try again later.';
    
    case ErrorCode.CONTENT_INJECTION_FAILED:
      return 'Unable to load sidebar on this page. Try refreshing the page.';
    
    default:
      return error.message || 'An error occurred. Please try again.';
  }
}