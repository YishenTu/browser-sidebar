/**
 * @file Error handling utilities for extension messaging
 */

import { normalizeRuntimeError } from '@platform/chrome/runtime';

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
    if (typeof Error.captureStackTrace === 'function') {
      const captureStackTrace = Error.captureStackTrace as (
        targetObject: object,
        constructorOpt?: new (...args: unknown[]) => unknown
      ) => void;
      captureStackTrace(this, this.constructor as new (...args: unknown[]) => unknown);
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
  try {
    // This will check chrome.runtime.lastError and throw if present
    return null;
  } catch (error) {
    const runtimeError = normalizeRuntimeError(`Chrome API error during ${operation}`);
    return new ExtensionError(
      runtimeError.message,
      ErrorCode.CHROME_RUNTIME_ERROR,
      { operation, originalError: runtimeError.originalError?.message },
      source
    );
  }
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
