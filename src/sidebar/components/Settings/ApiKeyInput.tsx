/**
 * @file API Key Input Component
 *
 * A secure, accessible component for inputting and validating AI provider API keys.
 * Features masked input, live validation, secure storage integration, and comprehensive
 * error handling with support for multiple providers.
 *
 * Security Features:
 * - Password-type input by default (masked)
 * - No API key logging to console
 * - Secure memory cleanup on unmount
 * - Encrypted storage integration
 *
 * Validation Features:
 * - Format validation per provider
 * - Live API endpoint testing
 * - Debounced validation to prevent spam
 * - Clear success/error states
 *
 * Accessibility Features:
 * - ARIA labels and announcements
 * - Keyboard navigation support
 * - Screen reader compatible
 * - Focus management
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Button } from '@ui/Button';
import { Input } from '@ui/Input';
import { Card } from '@ui/Card';
import { cn } from '@sidebar/lib/cn';

// Services and types
import { APIKeyValidationService } from '../../../provider/validation';
import { addAPIKey } from '../../../storage/apiKeys';
import type { ProviderType } from '../../../types/providers';
import type { ValidationResult as ValidationServiceResult } from '../../../provider/validation';
import type { EncryptedAPIKey } from '../../../types/apiKeys';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface ApiKeyInputProps {
  /** Provider type for this API key */
  provider: ProviderType;
  /** Initial value for the input */
  value?: string;
  /** Whether to validate on input change (debounced) */
  validateOnChange?: boolean;
  /** Whether to validate on input blur */
  validateOnBlur?: boolean;
  /** Enable save functionality */
  enableSave?: boolean;
  /** Debounce delay for validation in milliseconds */
  debounceMs?: number;
  /** Custom CSS class */
  className?: string;
  /** Called when input value changes */
  onChange?: (value: string) => void;
  /** Called when validation completes */
  onValidation?: (result: ValidationCallbackResult) => void;
  /** Called when key is successfully saved */
  onSave?: (result: SaveCallbackResult) => void;
}

interface ValidationCallbackResult {
  isValid: boolean;
  key: string;
  result: ValidationServiceResult;
}

interface SaveCallbackResult {
  key: string;
  result: EncryptedAPIKey;
}

interface ValidationState {
  isValidating: boolean;
  isValid: boolean | null;
  result: ValidationServiceResult | null;
  error: string | null;
}

interface SaveState {
  isSaving: boolean;
  success: boolean;
  error: string | null;
}

// ============================================================================
// Provider Configuration
// ============================================================================

const PROVIDER_CONFIG = {
  openai: {
    label: 'OpenAI API Key',
    hint: 'Starts with "sk-" followed by 48 characters',
    placeholder: 'sk-proj1234567890...',
    maxLength: 100,
  },
  gemini: {
    label: 'Google Gemini API Key',
    hint: 'Starts with "AIza" followed by 35 characters',
    placeholder: 'AIza1234567890...',
    maxLength: 100,
  },
} as const;

// Map ProviderType to APIProvider for storage compatibility
const PROVIDER_TYPE_TO_API_PROVIDER: Record<ProviderType, string> = {
  openai: 'openai',
  gemini: 'google', // Map gemini to google for API storage
  // openrouter removed (not implemented)
} as any;

// ============================================================================
// Custom Hooks
// ============================================================================

/**
 * Hook for debounced value updates
 */
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook for managing validation service
 */
function useValidationService() {
  const serviceRef = useRef<APIKeyValidationService | null>(null);
  const validationIdRef = useRef<number>(0);

  const getService = useCallback(() => {
    if (!serviceRef.current) {
      serviceRef.current = new APIKeyValidationService({
        timeout: 10000,
        enableCache: true,
      });
    }
    return serviceRef.current;
  }, []);

  const validate = useCallback(
    async (
      key: string,
      provider: ProviderType,
      options?: { skipLiveValidation?: boolean }
    ): Promise<ValidationServiceResult> => {
      const currentValidationId = ++validationIdRef.current;
      const service = getService();

      try {
        const result = await service.validateAPIKey(key, provider, {
          skipLiveValidation: options?.skipLiveValidation || false,
          timeout: 10000,
          enableCache: true,
        });

        // Check if this validation is still current (not cancelled by newer request)
        if (currentValidationId === validationIdRef.current) {
          return result;
        }

        // Return a cancelled result if validation was superseded
        throw new Error('Validation cancelled');
      } catch (error) {
        if (currentValidationId === validationIdRef.current) {
          throw error;
        }
        throw new Error('Validation cancelled');
      }
    },
    [getService]
  );

  return { validate };
}

// ============================================================================
// Main Component
// ============================================================================

export function ApiKeyInput({
  provider,
  value = '',
  validateOnChange = false,
  validateOnBlur = false,
  enableSave = false,
  debounceMs = 500,
  className,
  onChange,
  onValidation,
  onSave,
}: ApiKeyInputProps) {
  // ============================================================================
  // State Management
  // ============================================================================

  const [inputValue, setInputValue] = useState(value);
  const [isVisible, setIsVisible] = useState(false);
  const [validation, setValidation] = useState<ValidationState>({
    isValidating: false,
    isValid: null,
    result: null,
    error: null,
  });
  const [saveState, setSaveState] = useState<SaveState>({
    isSaving: false,
    success: false,
    error: null,
  });

  // Refs for cleanup and focus management
  const inputRef = useRef<HTMLInputElement>(null);
  const componentMountedRef = useRef(true);

  // Custom hooks
  const { validate } = useValidationService();
  const debouncedInputValue = useDebounce(inputValue, debounceMs);

  // Provider configuration
  const config = useMemo(() => {
    return (
      PROVIDER_CONFIG[provider as keyof typeof PROVIDER_CONFIG] || {
        label: 'API Key',
        hint: 'Enter your API key',
        placeholder: 'Enter API key...',
        maxLength: 100,
      }
    );
  }, [provider]);

  // ============================================================================
  // Effect Handlers
  // ============================================================================

  // Handle component unmount cleanup
  useEffect(() => {
    componentMountedRef.current = true;
    return () => {
      componentMountedRef.current = false;
      // Clear sensitive data from DOM
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    };
  }, []);

  // Handle controlled value changes
  useEffect(() => {
    if (value !== inputValue) {
      setInputValue(value);
    }
  }, [value]);

  // Handle debounced validation on change
  useEffect(() => {
    if (validateOnChange && debouncedInputValue.trim() && debouncedInputValue !== value) {
      handleValidation(debouncedInputValue);
    }
  }, [debouncedInputValue, validateOnChange, value]);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      let newValue = event.target.value;

      // Trim whitespace and limit length
      if (newValue.length > config.maxLength) {
        newValue = newValue.substring(0, config.maxLength);
      }

      setInputValue(newValue);
      onChange?.(newValue);

      // Reset validation and save states when input changes
      if (validation.result) {
        setValidation({
          isValidating: false,
          isValid: null,
          result: null,
          error: null,
        });
      }
      if (saveState.success || saveState.error) {
        setSaveState({
          isSaving: false,
          success: false,
          error: null,
        });
      }
    },
    [config.maxLength, onChange, validation.result, saveState]
  );

  const handleInputBlur = useCallback(
    (event: React.FocusEvent<HTMLInputElement>) => {
      const trimmedValue = event.target.value.trim();
      if (trimmedValue !== inputValue) {
        setInputValue(trimmedValue);
        onChange?.(trimmedValue);
      }

      if (validateOnBlur && trimmedValue) {
        handleValidation(trimmedValue);
      }
    },
    [inputValue, onChange, validateOnBlur]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter' && inputValue.trim()) {
        event.preventDefault();
        handleValidation(inputValue.trim());
      }
    },
    [inputValue]
  );

  const handleToggleVisibility = useCallback(() => {
    setIsVisible(prev => !prev);
  }, []);

  const handleClear = useCallback(() => {
    setInputValue('');
    onChange?.('');
    setValidation({
      isValidating: false,
      isValid: null,
      result: null,
      error: null,
    });
    setSaveState({
      isSaving: false,
      success: false,
      error: null,
    });

    // Focus input after clearing
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [onChange]);

  const handleValidation = useCallback(
    async (keyToValidate?: string) => {
      const key = keyToValidate || inputValue.trim();

      if (!key) return;

      setValidation({
        isValidating: true,
        isValid: null,
        result: null,
        error: null,
      });

      try {
        const result = await validate(key, provider);

        // Only update state if component is still mounted
        if (componentMountedRef.current) {
          setValidation({
            isValidating: false,
            isValid: result.isValid,
            result,
            error: result.isValid ? null : result.errors[0] || 'Validation failed',
          });

          // Call validation callback
          onValidation?.({
            isValid: result.isValid,
            key,
            result,
          });
        }
      } catch (error) {
        if (componentMountedRef.current) {
          const errorMessage =
            error instanceof Error && !error.message.includes('cancelled')
              ? error.message
              : 'Validation failed';

          setValidation({
            isValidating: false,
            isValid: false,
            result: null,
            error: errorMessage,
          });
        }
      }
    },
    [inputValue, provider, validate, onValidation]
  );

  const handleSave = useCallback(async () => {
    const key = inputValue.trim();
    if (!key || !validation.isValid) return;

    setSaveState({
      isSaving: true,
      success: false,
      error: null,
    });

    try {
      const result = await addAPIKey({
        key,
        provider: PROVIDER_TYPE_TO_API_PROVIDER[provider] as any, // Cast needed due to type mismatch
        name: `${config.label} - ${new Date().toLocaleDateString()}`,
      });

      if (componentMountedRef.current) {
        setSaveState({
          isSaving: false,
          success: true,
          error: null,
        });

        // Call save callback
        onSave?.({
          key,
          result,
        });

        // Clear input after successful save
        setTimeout(() => {
          handleClear();
        }, 2000);
      }
    } catch (error) {
      if (componentMountedRef.current) {
        setSaveState({
          isSaving: false,
          success: false,
          error: error instanceof Error ? error.message : 'Failed to save key',
        });
      }
    }
  }, [inputValue, validation.isValid, provider, config.label, onSave, handleClear]);

  // ============================================================================
  // Render Helpers
  // ============================================================================

  const getValidationStatusIcon = () => {
    if (validation.isValidating) {
      return (
        <svg className="animate-spin h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      );
    } else if (validation.isValid === true) {
      return (
        <svg
          className="h-4 w-4 text-green-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      );
    } else if (validation.isValid === false) {
      return (
        <svg className="h-4 w-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      );
    }
    return null;
  };

  const getToggleIcon = () => {
    if (isVisible) {
      return (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L12 12m6.121-6.121A2.99 2.99 0 0019 12a2.99 2.99 0 00-.879 2.121m-6.242-6.242L21 21"
          />
        </svg>
      );
    } else {
      return (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
          />
        </svg>
      );
    }
  };

  const renderValidationStatus = () => {
    if (validation.isValidating) {
      return (
        <div className="flex items-center space-x-2 text-blue-600" role="status" aria-live="polite">
          {getValidationStatusIcon()}
          <span className="text-sm">Validating...</span>
        </div>
      );
    }

    if (validation.isValid === true && validation.result) {
      return (
        <div
          className="flex items-center space-x-2 text-green-600"
          role="status"
          aria-live="polite"
        >
          {getValidationStatusIcon()}
          <div className="text-sm">
            <span className="font-medium">Valid</span>
            {validation.result.liveValidation && (
              <span className="ml-2 text-gray-500">
                Response time: {validation.result.liveValidation.responseTime}ms
              </span>
            )}
          </div>
        </div>
      );
    }

    if (validation.isValid === false) {
      return (
        <div className="flex items-center space-x-2 text-red-600" role="alert">
          {getValidationStatusIcon()}
          <span className="text-sm">{validation.error}</span>
        </div>
      );
    }

    return null;
  };

  const renderSaveStatus = () => {
    if (saveState.isSaving) {
      return (
        <div className="flex items-center space-x-2 text-blue-600" role="status" aria-live="polite">
          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span className="text-sm">Saving...</span>
        </div>
      );
    }

    if (saveState.success) {
      return (
        <div
          className="flex items-center space-x-2 text-green-600"
          role="status"
          aria-live="polite"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-sm">Key saved successfully!</span>
        </div>
      );
    }

    if (saveState.error) {
      return (
        <div className="flex items-center space-x-2 text-red-600" role="alert">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
          <span className="text-sm">Failed to save: {saveState.error}</span>
        </div>
      );
    }

    return null;
  };

  // ============================================================================
  // Main Render
  // ============================================================================

  return (
    <Card variant="basic" padding="md" className={cn('api-key-input', className)}>
      <div data-testid="api-key-input" className={cn('space-y-4', className)}>
        {/* Input Section */}
        <div className="space-y-2">
          <Input
            ref={inputRef}
            type={isVisible ? 'text' : 'password'}
            label={config.label}
            placeholder={config.placeholder}
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            onKeyDown={handleKeyDown}
            maxLength={config.maxLength}
            autoComplete="off"
            spellCheck={false}
            className="pr-20" // Space for toggle and clear buttons
            rightIcon={
              <div className="flex items-center space-x-1">
                {/* Clear button */}
                {inputValue && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="p-1 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
                    aria-label="Clear key"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                )}

                {/* Toggle visibility button */}
                <button
                  type="button"
                  onClick={handleToggleVisibility}
                  className="p-1 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
                  aria-label={isVisible ? 'Hide API key' : 'Show API key'}
                >
                  {getToggleIcon()}
                </button>
              </div>
            }
          />

          <p className="text-sm text-gray-500">{config.hint}</p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-3">
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => handleValidation()}
            disabled={!inputValue.trim() || validation.isValidating}
            loading={validation.isValidating}
            loadingText="Validating..."
          >
            Validate Key
          </Button>

          {enableSave && validation.isValid && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleSave}
              disabled={saveState.isSaving}
              loading={saveState.isSaving}
              loadingText="Saving..."
            >
              Save Key
            </Button>
          )}
        </div>

        {/* Status Messages */}
        <div className="space-y-2">
          {renderValidationStatus()}
          {enableSave && renderSaveStatus()}
        </div>
      </div>
    </Card>
  );
}

export default ApiKeyInput;
