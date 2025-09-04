/**
 * @file Provider Contract Test Utilities
 *
 * Shared utilities and helpers for provider contract testing.
 * Provides reusable functions for validating StreamChunk compliance,
 * creating mock data, and performing consistent validation across all providers.
 */

import type {
  StreamChunk,
  StreamChoice,
  Delta,
  Usage,
  FinishReason,
  ProviderError,
  AIProvider,
  ProviderChatMessage,
} from '@types/providers';

/**
 * Validation result for contract compliance
 */
export interface ContractValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Test configuration for provider contract testing
 */
export interface ProviderTestConfig {
  name: string;
  provider: AIProvider;
  supportsThinking: boolean;
  supportsSearchResults: boolean;
  supportsUsageMetadata: boolean;
}

/**
 * Validates a StreamChunk for contract compliance
 */
export function validateStreamChunk(
  chunk: unknown,
  providerName: string
): ContractValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!chunk || typeof chunk !== 'object') {
    errors.push(`${providerName}: StreamChunk must be an object`);
    return { isValid: false, errors, warnings };
  }

  const streamChunk = chunk as any;

  // Validate required fields
  validateRequiredField(streamChunk, 'id', 'string', errors, providerName);
  validateRequiredField(streamChunk, 'object', 'string', errors, providerName);
  validateRequiredField(streamChunk, 'created', 'number', errors, providerName);
  validateRequiredField(streamChunk, 'model', 'string', errors, providerName);
  validateRequiredField(streamChunk, 'choices', 'array', errors, providerName);

  // Validate choices array
  if (Array.isArray(streamChunk.choices)) {
    if (streamChunk.choices.length === 0) {
      errors.push(`${providerName}: choices array cannot be empty`);
    } else {
      streamChunk.choices.forEach((choice: unknown, index: number) => {
        const choiceValidation = validateStreamChoice(choice, providerName, index);
        errors.push(...choiceValidation.errors);
        warnings.push(...choiceValidation.warnings);
      });
    }
  }

  // Validate optional fields
  if (streamChunk.usage !== undefined) {
    const usageValidation = validateUsage(streamChunk.usage, providerName);
    errors.push(...usageValidation.errors);
    warnings.push(...usageValidation.warnings);
  }

  if (streamChunk.metadata !== undefined) {
    const metadataValidation = validateMetadata(streamChunk.metadata, providerName);
    errors.push(...metadataValidation.errors);
    warnings.push(...metadataValidation.warnings);
  }

  // Validate specific field values
  if (streamChunk.created <= 0) {
    errors.push(`${providerName}: created timestamp must be positive`);
  }

  if (streamChunk.id && streamChunk.id.trim() === '') {
    errors.push(`${providerName}: id cannot be empty string`);
  }

  if (streamChunk.object && streamChunk.object.trim() === '') {
    errors.push(`${providerName}: object cannot be empty string`);
  }

  if (streamChunk.model && streamChunk.model.trim() === '') {
    errors.push(`${providerName}: model cannot be empty string`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates a StreamChoice for contract compliance
 */
export function validateStreamChoice(
  choice: unknown,
  providerName: string,
  index?: number
): ContractValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const prefix = `${providerName}${index !== undefined ? ` choice[${index}]` : ''}`;

  if (!choice || typeof choice !== 'object') {
    errors.push(`${prefix}: StreamChoice must be an object`);
    return { isValid: false, errors, warnings };
  }

  const streamChoice = choice as any;

  // Validate required fields
  validateRequiredField(streamChoice, 'index', 'number', errors, prefix);
  validateRequiredField(streamChoice, 'delta', 'object', errors, prefix);

  // finishReason is required but can be null
  if (!('finishReason' in streamChoice)) {
    errors.push(`${prefix}: finishReason field is required (can be null)`);
  } else if (streamChoice.finishReason !== null) {
    const validFinishReasons: FinishReason[] = ['stop', 'length', 'content_filter', 'tool_calls'];
    if (!validFinishReasons.includes(streamChoice.finishReason)) {
      errors.push(
        `${prefix}: finishReason must be one of ${validFinishReasons.join(', ')} or null`
      );
    }
  }

  // Validate index value
  if (typeof streamChoice.index === 'number' && streamChoice.index < 0) {
    errors.push(`${prefix}: index must be non-negative`);
  }

  // Validate delta
  if (streamChoice.delta) {
    const deltaValidation = validateDelta(streamChoice.delta, prefix);
    errors.push(...deltaValidation.errors);
    warnings.push(...deltaValidation.warnings);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates a Delta for contract compliance
 */
export function validateDelta(delta: unknown, prefix: string): ContractValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!delta || typeof delta !== 'object') {
    errors.push(`${prefix}: delta must be an object`);
    return { isValid: false, errors, warnings };
  }

  const deltaObj = delta as any;

  // Validate optional fields have correct types
  if (deltaObj.role !== undefined) {
    if (typeof deltaObj.role !== 'string') {
      errors.push(`${prefix}: delta.role must be a string when present`);
    } else if (!['user', 'assistant', 'system'].includes(deltaObj.role)) {
      errors.push(`${prefix}: delta.role must be one of 'user', 'assistant', 'system'`);
    }
  }

  if (deltaObj.content !== undefined && typeof deltaObj.content !== 'string') {
    errors.push(`${prefix}: delta.content must be a string when present`);
  }

  if (deltaObj.thinking !== undefined && typeof deltaObj.thinking !== 'string') {
    errors.push(`${prefix}: delta.thinking must be a string when present`);
  }

  // Check for unexpected fields (warning only)
  const allowedFields = ['role', 'content', 'thinking'];
  const actualFields = Object.keys(deltaObj);
  const unexpectedFields = actualFields.filter(field => !allowedFields.includes(field));

  if (unexpectedFields.length > 0) {
    warnings.push(`${prefix}: delta contains unexpected fields: ${unexpectedFields.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates Usage metadata for contract compliance
 */
export function validateUsage(usage: unknown, providerName: string): ContractValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const prefix = `${providerName} usage`;

  if (!usage || typeof usage !== 'object') {
    errors.push(`${prefix}: usage must be an object when present`);
    return { isValid: false, errors, warnings };
  }

  const usageObj = usage as any;

  // Validate required fields
  validateRequiredField(usageObj, 'promptTokens', 'number', errors, prefix);
  validateRequiredField(usageObj, 'completionTokens', 'number', errors, prefix);
  validateRequiredField(usageObj, 'totalTokens', 'number', errors, prefix);

  // Validate values are non-negative
  ['promptTokens', 'completionTokens', 'totalTokens'].forEach(field => {
    if (typeof usageObj[field] === 'number' && usageObj[field] < 0) {
      errors.push(`${prefix}: ${field} must be non-negative`);
    }
  });

  // Validate optional thinking tokens
  if (usageObj.thinkingTokens !== undefined) {
    if (typeof usageObj.thinkingTokens !== 'number') {
      errors.push(`${prefix}: thinkingTokens must be a number when present`);
    } else if (usageObj.thinkingTokens < 0) {
      errors.push(`${prefix}: thinkingTokens must be non-negative`);
    }
  }

  // Validate total calculation (warning only)
  if (
    typeof usageObj.promptTokens === 'number' &&
    typeof usageObj.completionTokens === 'number' &&
    typeof usageObj.totalTokens === 'number'
  ) {
    const expectedTotal =
      usageObj.promptTokens + usageObj.completionTokens + (usageObj.thinkingTokens || 0);
    if (usageObj.totalTokens !== expectedTotal) {
      warnings.push(
        `${prefix}: totalTokens (${usageObj.totalTokens}) doesn't match sum of components (${expectedTotal})`
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates metadata for contract compliance
 */
export function validateMetadata(
  metadata: unknown,
  providerName: string
): ContractValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const prefix = `${providerName} metadata`;

  if (!metadata || typeof metadata !== 'object') {
    errors.push(`${prefix}: metadata must be an object when present`);
    return { isValid: false, errors, warnings };
  }

  const metadataObj = metadata as any;

  // Validate search results if present
  if (metadataObj.searchResults !== undefined) {
    const searchValidation = validateSearchResults(metadataObj.searchResults, prefix);
    errors.push(...searchValidation.errors);
    warnings.push(...searchValidation.warnings);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates search results structure
 */
export function validateSearchResults(
  searchResults: unknown,
  prefix: string
): ContractValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (Array.isArray(searchResults)) {
    // Direct array format
    searchResults.forEach((result: unknown, index: number) => {
      const resultValidation = validateSearchResult(result, `${prefix} searchResults[${index}]`);
      errors.push(...resultValidation.errors);
      warnings.push(...resultValidation.warnings);
    });
  } else if (typeof searchResults === 'object' && searchResults !== null) {
    // Object format with sources property
    const searchObj = searchResults as any;
    if (searchObj.sources && Array.isArray(searchObj.sources)) {
      searchObj.sources.forEach((source: unknown, index: number) => {
        const sourceValidation = validateSearchResult(
          source,
          `${prefix} searchResults.sources[${index}]`
        );
        errors.push(...sourceValidation.errors);
        warnings.push(...sourceValidation.warnings);
      });
    } else {
      warnings.push(`${prefix}: searchResults object doesn't contain valid sources array`);
    }
  } else {
    errors.push(`${prefix}: searchResults must be an array or object with sources property`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates individual search result
 */
export function validateSearchResult(result: unknown, prefix: string): ContractValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!result || typeof result !== 'object') {
    errors.push(`${prefix}: search result must be an object`);
    return { isValid: false, errors, warnings };
  }

  const resultObj = result as any;

  // Validate required fields
  validateRequiredField(resultObj, 'title', 'string', errors, prefix);
  validateRequiredField(resultObj, 'url', 'string', errors, prefix);

  // Validate optional fields
  if (resultObj.snippet !== undefined && typeof resultObj.snippet !== 'string') {
    errors.push(`${prefix}: snippet must be a string when present`);
  }

  if (resultObj.domain !== undefined && typeof resultObj.domain !== 'string') {
    errors.push(`${prefix}: domain must be a string when present`);
  }

  // Validate URL format (warning only)
  if (typeof resultObj.url === 'string') {
    try {
      new URL(resultObj.url);
    } catch {
      warnings.push(`${prefix}: url appears to be invalid: ${resultObj.url}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates a ProviderError for contract compliance
 */
export function validateProviderError(
  error: unknown,
  providerName: string
): ContractValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const prefix = `${providerName} error`;

  if (!error || typeof error !== 'object') {
    errors.push(`${prefix}: error must be an object`);
    return { isValid: false, errors, warnings };
  }

  const errorObj = error as any;

  // Validate required fields
  validateRequiredField(errorObj, 'type', 'string', errors, prefix);
  validateRequiredField(errorObj, 'message', 'string', errors, prefix);
  validateRequiredField(errorObj, 'code', 'string', errors, prefix);
  validateRequiredField(errorObj, 'provider', 'string', errors, prefix);

  // Validate error type
  if (typeof errorObj.type === 'string') {
    const validTypes = ['authentication', 'rate_limit', 'network', 'validation', 'unknown'];
    if (!validTypes.includes(errorObj.type)) {
      errors.push(`${prefix}: type must be one of ${validTypes.join(', ')}`);
    }
  }

  // Validate provider type
  if (typeof errorObj.provider === 'string') {
    const validProviders = ['openai', 'gemini', 'openrouter', 'openai_compat'];
    if (!validProviders.includes(errorObj.provider)) {
      errors.push(`${prefix}: provider must be one of ${validProviders.join(', ')}`);
    }
  }

  // Validate optional retryAfter
  if (errorObj.retryAfter !== undefined) {
    if (typeof errorObj.retryAfter !== 'number' || errorObj.retryAfter <= 0) {
      errors.push(`${prefix}: retryAfter must be a positive number when present`);
    }
  }

  // Validate optional details
  if (errorObj.details !== undefined) {
    if (typeof errorObj.details !== 'object' || errorObj.details === null) {
      errors.push(`${prefix}: details must be an object when present`);
    } else {
      // Validate common detail fields
      if (
        errorObj.details.statusCode !== undefined &&
        typeof errorObj.details.statusCode !== 'number'
      ) {
        errors.push(`${prefix}: details.statusCode must be a number when present`);
      }
      if (
        errorObj.details.timestamp !== undefined &&
        !(errorObj.details.timestamp instanceof Date)
      ) {
        errors.push(`${prefix}: details.timestamp must be a Date when present`);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Helper function to validate required field
 */
function validateRequiredField(
  obj: any,
  field: string,
  expectedType: string,
  errors: string[],
  prefix: string
): void {
  if (!(field in obj)) {
    errors.push(`${prefix}: missing required field '${field}'`);
    return;
  }

  const value = obj[field];
  let isCorrectType = false;

  switch (expectedType) {
    case 'string':
      isCorrectType = typeof value === 'string';
      break;
    case 'number':
      isCorrectType = typeof value === 'number';
      break;
    case 'boolean':
      isCorrectType = typeof value === 'boolean';
      break;
    case 'object':
      isCorrectType = typeof value === 'object' && value !== null;
      break;
    case 'array':
      isCorrectType = Array.isArray(value);
      break;
  }

  if (!isCorrectType) {
    errors.push(`${prefix}: field '${field}' must be of type ${expectedType}`);
  }
}

/**
 * Creates a mock StreamChunk for testing
 */
export function createMockStreamChunk(overrides: Partial<StreamChunk> = {}): StreamChunk {
  const defaultChunk: StreamChunk = {
    id: `mock-chunk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    object: 'response.chunk',
    created: Math.floor(Date.now() / 1000),
    model: 'mock-model',
    choices: [
      {
        index: 0,
        delta: { content: 'Mock content' },
        finishReason: null,
      },
    ],
  };

  return { ...defaultChunk, ...overrides };
}

/**
 * Creates a mock provider error for testing
 */
export function createMockProviderError(overrides: Partial<ProviderError> = {}): ProviderError {
  const defaultError: ProviderError = {
    type: 'unknown',
    message: 'Mock error message',
    code: 'MOCK_ERROR',
    provider: 'openai',
  };

  return { ...defaultError, ...overrides };
}

/**
 * Creates mock chat messages for testing
 */
export function createMockMessages(count: number = 1): ProviderChatMessage[] {
  const messages: ProviderChatMessage[] = [];

  for (let i = 0; i < count; i++) {
    messages.push({
      id: `mock-msg-${i}`,
      role: i === 0 ? 'user' : 'assistant',
      content: `Mock message content ${i + 1}`,
      timestamp: new Date(),
    });
  }

  return messages;
}

/**
 * Asserts that all validation results are successful
 */
export function assertContractCompliance(
  validationResults: ContractValidationResult[],
  context: string
): void {
  const allErrors: string[] = [];
  const allWarnings: string[] = [];

  validationResults.forEach(result => {
    allErrors.push(...result.errors);
    allWarnings.push(...result.warnings);
  });

  if (allErrors.length > 0) {
    throw new Error(`Contract compliance failures in ${context}:\n${allErrors.join('\n')}`);
  }

  if (allWarnings.length > 0) {
    console.warn(`Contract compliance warnings in ${context}:\n${allWarnings.join('\n')}`);
  }
}
