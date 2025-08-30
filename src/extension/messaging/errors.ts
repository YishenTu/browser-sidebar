/**
 * @file Error handling utilities for extension messaging
 */

export enum ErrorCode {
  MESSAGE_TIMEOUT = 'MESSAGE_TIMEOUT',
  MESSAGE_VALIDATION_FAILED = 'MESSAGE_VALIDATION_FAILED',
  MESSAGE_SEND_FAILED = 'MESSAGE_SEND_FAILED',
  INVALID_MESSAGE_TARGET = 'INVALID_MESSAGE_TARGET',
  CHROME_RUNTIME_ERROR = 'CHROME_RUNTIME_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
}

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
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ExtensionError);
    }
  }

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
}

export function handleChromeError(operation: string, source?: string): ExtensionError | null {
  const chromeError = chrome.runtime.lastError;
  if (!chromeError) return null;
  const msg = chromeError.message ?? '';
  return new ExtensionError(
    `Chrome API error during ${operation}: ${msg}`,
    ErrorCode.CHROME_RUNTIME_ERROR,
    { operation, originalError: msg },
    source
  );
}

export function logError(_error: ExtensionError | Error, _context?: string): void {
  // Error logging functionality removed
}

export function isRetriableError(error: ExtensionError | Error): boolean {
  return (
    error instanceof ExtensionError &&
    [
      ErrorCode.MESSAGE_TIMEOUT,
      ErrorCode.MESSAGE_SEND_FAILED,
      ErrorCode.CHROME_RUNTIME_ERROR,
    ].includes(error.code)
  );
}
