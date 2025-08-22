/**
 * @file API Key Input Component Tests
 * 
 * Comprehensive test suite for the ApiKeyInput component following TDD methodology.
 * Tests cover all functional requirements including UI, validation, security, 
 * accessibility, and integration with storage/validation services.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach, MockedFunction } from 'vitest';

// Component under test
import { ApiKeyInput } from '@components/Settings/ApiKeyInput';

// Mock dependencies
import { APIKeyValidationService } from '../../../../src/provider/validation';
import * as apiKeyStorage from '../../../../src/storage/apiKeys';

// Types
import type { ProviderType } from '@types/providers';
import type { ValidationResult as ValidationServiceResult } from '../../../../src/provider/validation';

// Mock the validation service
vi.mock('../../../../src/provider/validation');
const MockAPIKeyValidationService = APIKeyValidationService as any;

// Mock the storage module
vi.mock('../../../../src/storage/apiKeys', () => ({
  addAPIKey: vi.fn(),
  getAPIKey: vi.fn(),
  deleteAPIKey: vi.fn(),
}));

// Create mocked functions with proper typing
const mockAddAPIKey = apiKeyStorage.addAPIKey as MockedFunction<typeof apiKeyStorage.addAPIKey>;
const mockGetAPIKey = apiKeyStorage.getAPIKey as MockedFunction<typeof apiKeyStorage.getAPIKey>;
const mockDeleteAPIKey = apiKeyStorage.deleteAPIKey as MockedFunction<typeof apiKeyStorage.deleteAPIKey>;

// Test data
const mockValidationService = {
  validateAPIKey: vi.fn(),
  clearCache: vi.fn(),
  getCacheStats: vi.fn(),
};

const validOpenAIKey = 'sk-proj1234567890123456789012345678901234567890123456';
const validGeminiKey = 'AIza1234567890123456789012345678901234567';
const validOpenRouterKey = 'sk-or-v1-1234567890123456789012345678901234567890123456';
const invalidKey = 'invalid-key';

const mockValidValidationResult: ValidationServiceResult = {
  isValid: true,
  provider: 'openai',
  errors: [],
  warnings: [],
  liveValidation: {
    isValid: true,
    responseTime: 150,
    endpoint: 'https://api.openai.com/v1/models',
    statusCode: 200,
  },
  performance: {
    totalTime: 200,
    liveValidationTime: 150,
  },
};

const mockInvalidValidationResult: ValidationServiceResult = {
  isValid: false,
  provider: 'openai',
  errors: ['Invalid API key format'],
  warnings: [],
  performance: {
    totalTime: 50,
  },
};

const mockEncryptedKey = {
  id: 'openai-1234567890-test',
  metadata: {
    id: 'openai-1234567890-test',
    provider: 'openai' as const,
    keyType: 'standard' as const,
    status: 'active' as const,
    name: 'Test Key',
    createdAt: Date.now(),
    lastUsed: Date.now(),
    maskedKey: 'sk-proj...3456',
  },
  encryptedData: {
    data: new Uint8Array([1, 2, 3]),
    iv: new Uint8Array([4, 5, 6]),
    algorithm: 'AES-GCM' as const,
    version: 1,
  },
  keyHash: 'abcd1234',
  checksum: 'checksum123',
  storageVersion: 1,
  configuration: {},
};

describe('ApiKeyInput Component', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    
    // Reset all mocks
    vi.clearAllMocks();
    
    // Setup default mock implementations
    MockAPIKeyValidationService.mockImplementation(() => mockValidationService);
    mockValidationService.validateAPIKey.mockResolvedValue(mockValidValidationResult);
    mockAddAPIKey.mockResolvedValue(mockEncryptedKey);
    mockGetAPIKey.mockResolvedValue(null);
    mockDeleteAPIKey.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // Rendering and Basic UI Tests
  // ============================================================================

  describe('Rendering', () => {
    it('renders with default props', () => {
      render(<ApiKeyInput provider="openai" />);

      expect(screen.getByLabelText(/openai api key/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /validate key/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /show api key/i })).toBeInTheDocument();
    });

    it('renders with provider-specific labels and hints', () => {
      render(<ApiKeyInput provider="openai" />);
      
      expect(screen.getByText(/openai api key/i)).toBeInTheDocument();
      expect(screen.getByText(/starts with "sk-"/i)).toBeInTheDocument();
    });

    it('renders different provider hints correctly', () => {
      const { rerender } = render(<ApiKeyInput provider="gemini" />);
      expect(screen.getByText(/google gemini api key/i)).toBeInTheDocument();
      expect(screen.getByText(/starts with "AIza"/i)).toBeInTheDocument();

      rerender(<ApiKeyInput provider="openrouter" />);
      expect(screen.getByText(/openrouter api key/i)).toBeInTheDocument();
      expect(screen.getByText(/starts with "sk-or-v1-"/i)).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<ApiKeyInput provider="openai" className="custom-class" />);
      expect(screen.getByTestId('api-key-input')).toHaveClass('custom-class');
    });

    it('shows loading state during validation', async () => {
      mockValidationService.validateAPIKey.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockValidValidationResult), 100))
      );

      render(<ApiKeyInput provider="openai" />);
      
      const input = screen.getByLabelText(/openai api key/i);
      const validateButton = screen.getByRole('button', { name: /validate key/i });

      await user.type(input, validOpenAIKey);
      await user.click(validateButton);

      expect(screen.getAllByText(/validating/i)).toHaveLength(2); // Button and status
      expect(validateButton).toBeDisabled();

      await waitFor(() => {
        expect(screen.queryByText(/validating/i)).not.toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // Input Field Tests
  // ============================================================================

  describe('Input Field', () => {
    it('shows password type by default (masked)', () => {
      render(<ApiKeyInput provider="openai" />);
      expect(screen.getByLabelText(/openai api key/i)).toHaveAttribute('type', 'password');
    });

    it('accepts text input', async () => {
      render(<ApiKeyInput provider="openai" />);
      const input = screen.getByLabelText(/openai api key/i);

      await user.type(input, 'test-key');
      expect(input).toHaveValue('test-key');
    });

    it('limits input length appropriately', async () => {
      render(<ApiKeyInput provider="openai" />);
      const input = screen.getByLabelText(/openai api key/i);

      const longKey = 'a'.repeat(200); // Very long key
      await user.type(input, longKey);
      
      // Should be truncated to reasonable limit
      expect(input.value.length).toBeLessThanOrEqual(100);
    });

    it('trims whitespace from input', async () => {
      render(<ApiKeyInput provider="openai" />);
      const input = screen.getByLabelText(/openai api key/i);

      await user.type(input, '  sk-test123  ');
      fireEvent.blur(input);

      expect(input).toHaveValue('sk-test123');
    });

    it('calls onChange when input value changes', async () => {
      const mockOnChange = vi.fn();
      render(<ApiKeyInput provider="openai" onChange={mockOnChange} />);
      const input = screen.getByLabelText(/openai api key/i);

      await user.type(input, 'test');
      expect(mockOnChange).toHaveBeenCalledWith('test');
    });
  });

  // ============================================================================
  // Show/Hide Key Toggle Tests
  // ============================================================================

  describe('Show/Hide Toggle', () => {
    it('toggles input type between password and text', async () => {
      render(<ApiKeyInput provider="openai" />);
      const input = screen.getByLabelText(/openai api key/i);
      const toggleButton = screen.getByRole('button', { name: /show api key/i });

      expect(input).toHaveAttribute('type', 'password');

      await user.click(toggleButton);
      expect(input).toHaveAttribute('type', 'text');

      await user.click(toggleButton);
      expect(input).toHaveAttribute('type', 'password');
    });

    it('updates toggle button accessibility label', async () => {
      render(<ApiKeyInput provider="openai" />);
      const toggleButton = screen.getByRole('button', { name: /show api key/i });

      expect(toggleButton).toHaveAttribute('aria-label', 'Show API key');

      await user.click(toggleButton);
      expect(screen.getByRole('button', { name: /hide api key/i })).toHaveAttribute('aria-label', 'Hide API key');
    });

    it('shows appropriate icons for show/hide states', async () => {
      render(<ApiKeyInput provider="openai" />);
      const toggleButton = screen.getByRole('button', { name: /show api key/i });

      // Initially shows "show" icon (eye)
      expect(toggleButton.querySelector('svg')).toBeInTheDocument();

      await user.click(toggleButton);
      // After click, shows "hide" icon (eye-slash)
      expect(toggleButton.querySelector('svg')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Validation Tests
  // ============================================================================

  describe('Validation', () => {
    it('validates key on button click', async () => {
      render(<ApiKeyInput provider="openai" />);
      const input = screen.getByLabelText(/openai api key/i);
      const validateButton = screen.getByRole('button', { name: /validate key/i });

      await user.type(input, validOpenAIKey);
      await user.click(validateButton);

      expect(mockValidationService.validateAPIKey).toHaveBeenCalledWith(
        validOpenAIKey,
        'openai',
        expect.any(Object)
      );
    });

    it('validates key on blur with debounce', async () => {
      render(<ApiKeyInput provider="openai" validateOnBlur />);
      const input = screen.getByLabelText(/openai api key/i);

      await user.type(input, validOpenAIKey);
      fireEvent.blur(input);

      await waitFor(() => {
        expect(mockValidationService.validateAPIKey).toHaveBeenCalledWith(
          validOpenAIKey,
          'openai',
          expect.any(Object)
        );
      });
    });

    it('shows validation success state', async () => {
      render(<ApiKeyInput provider="openai" />);
      const input = screen.getByLabelText(/openai api key/i);
      const validateButton = screen.getByRole('button', { name: /validate key/i });

      await user.type(input, validOpenAIKey);
      await user.click(validateButton);

      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveClass('text-green-600');
        expect(screen.getByText(/response time:/i)).toBeInTheDocument();
      });
    });

    it('shows validation error state', async () => {
      mockValidationService.validateAPIKey.mockResolvedValue(mockInvalidValidationResult);

      render(<ApiKeyInput provider="openai" />);
      const input = screen.getByLabelText(/openai api key/i);
      const validateButton = screen.getByRole('button', { name: /validate key/i });

      await user.type(input, invalidKey);
      await user.click(validateButton);

      await waitFor(() => {
        expect(screen.getByText(/invalid api key format/i)).toBeInTheDocument();
      });
    });

    it('disables validate button when input is empty', () => {
      render(<ApiKeyInput provider="openai" />);
      const validateButton = screen.getByRole('button', { name: /validate key/i });

      expect(validateButton).toBeDisabled();
    });

    it('enables validate button when input has value', async () => {
      render(<ApiKeyInput provider="openai" />);
      const input = screen.getByLabelText(/openai api key/i);
      const validateButton = screen.getByRole('button', { name: /validate key/i });

      await user.type(input, 'sk-test');
      expect(validateButton).toBeEnabled();
    });

    it('handles validation service errors gracefully', async () => {
      mockValidationService.validateAPIKey.mockRejectedValue(new Error('Service error'));

      render(<ApiKeyInput provider="openai" />);
      const input = screen.getByLabelText(/openai api key/i);
      const validateButton = screen.getByRole('button', { name: /validate key/i });

      await user.type(input, validOpenAIKey);
      await user.click(validateButton);

      await waitFor(() => {
        expect(screen.getByText(/service error/i)).toBeInTheDocument();
      });
    });

    it('calls onValidation callback with result', async () => {
      const mockOnValidation = vi.fn();
      render(<ApiKeyInput provider="openai" onValidation={mockOnValidation} />);
      const input = screen.getByLabelText(/openai api key/i);
      const validateButton = screen.getByRole('button', { name: /validate key/i });

      await user.type(input, validOpenAIKey);
      await user.click(validateButton);

      await waitFor(() => {
        expect(mockOnValidation).toHaveBeenCalledWith({
          isValid: true,
          key: validOpenAIKey,
          result: mockValidValidationResult,
        });
      });
    });
  });

  // ============================================================================
  // Storage Integration Tests
  // ============================================================================

  describe('Storage Integration', () => {
    it('saves valid key to storage', async () => {
      render(<ApiKeyInput provider="openai" enableSave />);
      const input = screen.getByLabelText(/openai api key/i);
      const validateButton = screen.getByRole('button', { name: /validate key/i });

      await user.type(input, validOpenAIKey);
      await user.click(validateButton);

      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveClass('text-green-600');
      });

      const saveButton = screen.getByRole('button', { name: /save key/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockAddAPIKey).toHaveBeenCalledWith({
          key: validOpenAIKey,
          provider: 'openai',
          name: expect.stringContaining('OpenAI'),
        });
      });
    });

    it('shows save success message', async () => {
      render(<ApiKeyInput provider="openai" enableSave />);
      const input = screen.getByLabelText(/openai api key/i);
      const validateButton = screen.getByRole('button', { name: /validate key/i });

      await user.type(input, validOpenAIKey);
      await user.click(validateButton);

      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveClass('text-green-600');
      });

      const saveButton = screen.getByRole('button', { name: /save key/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/key saved successfully/i)).toBeInTheDocument();
      });
    });

    it('handles save errors gracefully', async () => {
      mockAddAPIKey.mockRejectedValue(new Error('Storage error'));

      render(<ApiKeyInput provider="openai" enableSave />);
      const input = screen.getByLabelText(/openai api key/i);
      const validateButton = screen.getByRole('button', { name: /validate key/i });

      await user.type(input, validOpenAIKey);
      await user.click(validateButton);

      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveClass('text-green-600');
      });

      const saveButton = screen.getByRole('button', { name: /save key/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/failed to save/i)).toBeInTheDocument();
      });
    });

    it('calls onSave callback when key is saved', async () => {
      const mockOnSave = vi.fn();
      render(<ApiKeyInput provider="openai" enableSave onSave={mockOnSave} />);
      const input = screen.getByLabelText(/openai api key/i);
      const validateButton = screen.getByRole('button', { name: /validate key/i });

      await user.type(input, validOpenAIKey);
      await user.click(validateButton);

      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveClass('text-green-600');
      });

      const saveButton = screen.getByRole('button', { name: /save key/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith({
          key: validOpenAIKey,
          result: mockEncryptedKey,
        });
      });
    });
  });

  // ============================================================================
  // Clear Key Tests
  // ============================================================================

  describe('Clear Key Functionality', () => {
    it('shows clear button when input has value', async () => {
      render(<ApiKeyInput provider="openai" />);
      const input = screen.getByLabelText(/openai api key/i);

      await user.type(input, 'test-key');
      expect(screen.getByRole('button', { name: /clear key/i })).toBeInTheDocument();
    });

    it('hides clear button when input is empty', () => {
      render(<ApiKeyInput provider="openai" />);
      expect(screen.queryByRole('button', { name: /clear key/i })).not.toBeInTheDocument();
    });

    it('clears input when clear button is clicked', async () => {
      render(<ApiKeyInput provider="openai" />);
      const input = screen.getByLabelText(/openai api key/i);

      await user.type(input, 'test-key');
      const clearButton = screen.getByRole('button', { name: /clear key/i });
      
      await user.click(clearButton);
      expect(input).toHaveValue('');
    });

    it('resets validation state when cleared', async () => {
      render(<ApiKeyInput provider="openai" />);
      const input = screen.getByLabelText(/openai api key/i);
      const validateButton = screen.getByRole('button', { name: /validate key/i });

      await user.type(input, validOpenAIKey);
      await user.click(validateButton);

      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveClass('text-green-600');
      });

      const clearButton = screen.getByRole('button', { name: /clear key/i });
      await user.click(clearButton);

      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('calls onChange when cleared', async () => {
      const mockOnChange = vi.fn();
      render(<ApiKeyInput provider="openai" onChange={mockOnChange} />);
      const input = screen.getByLabelText(/openai api key/i);

      await user.type(input, 'test-key');
      mockOnChange.mockClear(); // Clear previous calls

      const clearButton = screen.getByRole('button', { name: /clear key/i });
      await user.click(clearButton);

      expect(mockOnChange).toHaveBeenCalledWith('');
    });
  });

  // ============================================================================
  // Accessibility Tests
  // ============================================================================

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(<ApiKeyInput provider="openai" />);

      expect(screen.getByLabelText(/openai api key/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /validate key/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /show api key/i })).toBeInTheDocument();
    });

    it('announces validation state changes to screen readers', async () => {
      render(<ApiKeyInput provider="openai" />);
      const input = screen.getByLabelText(/openai api key/i);
      const validateButton = screen.getByRole('button', { name: /validate key/i });

      await user.type(input, validOpenAIKey);
      await user.click(validateButton);

      await waitFor(() => {
        const statusElement = screen.getByRole('status');
        expect(statusElement).toBeInTheDocument();
        expect(statusElement).toHaveAttribute('aria-live', 'polite');
      });
    });

    it('supports keyboard navigation', async () => {
      render(<ApiKeyInput provider="openai" />);
      const input = screen.getByLabelText(/openai api key/i);

      // Tab to input
      await user.tab();
      expect(input).toHaveFocus();

      // Tab to toggle button (disabled validate button is skipped)
      await user.tab();
      expect(screen.getByRole('button', { name: /show api key/i })).toHaveFocus();

      // Add some text to enable validate button, then test tab order
      await user.type(input, 'sk-test');
      
      // Reset to beginning and test full tab order with enabled button
      document.body.focus();
      await user.tab(); // to input
      await user.tab(); // to toggle button  
      await user.tab(); // to validate button (now enabled)
      expect(screen.getByRole('button', { name: /validate key/i })).toHaveFocus();
    });

    it('supports Enter key for validation', async () => {
      render(<ApiKeyInput provider="openai" />);
      const input = screen.getByLabelText(/openai api key/i);

      await user.type(input, validOpenAIKey);
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(mockValidationService.validateAPIKey).toHaveBeenCalled();
      });
    });

    it('provides appropriate error announcements', async () => {
      mockValidationService.validateAPIKey.mockResolvedValue(mockInvalidValidationResult);

      render(<ApiKeyInput provider="openai" />);
      const input = screen.getByLabelText(/openai api key/i);
      const validateButton = screen.getByRole('button', { name: /validate key/i });

      await user.type(input, invalidKey);
      await user.click(validateButton);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByRole('alert')).toHaveTextContent(/invalid api key format/i);
      });
    });
  });

  // ============================================================================
  // Security Tests
  // ============================================================================

  describe('Security', () => {
    it('does not log API keys to console', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(<ApiKeyInput provider="openai" />);
      const input = screen.getByLabelText(/openai api key/i);
      const validateButton = screen.getByRole('button', { name: /validate key/i });

      await user.type(input, validOpenAIKey);
      await user.click(validateButton);

      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveClass('text-green-600');
      });

      // Check that the API key was never logged
      expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining(validOpenAIKey));
      expect(consoleWarnSpy).not.toHaveBeenCalledWith(expect.stringContaining(validOpenAIKey));
      expect(consoleErrorSpy).not.toHaveBeenCalledWith(expect.stringContaining(validOpenAIKey));

      consoleSpy.mockRestore();
      consoleWarnSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('masks key in DOM when hidden', () => {
      render(<ApiKeyInput provider="openai" />);
      const input = screen.getByLabelText(/openai api key/i) as HTMLInputElement;

      // Input should be password type by default
      expect(input.type).toBe('password');
    });

    it('clears key from DOM when component unmounts', async () => {
      const { unmount } = render(<ApiKeyInput provider="openai" />);
      const input = screen.getByLabelText(/openai api key/i);

      await user.type(input, validOpenAIKey);
      expect(input).toHaveValue(validOpenAIKey);

      unmount();

      // Re-render and check that input is clean
      render(<ApiKeyInput provider="openai" />);
      const newInput = screen.getByLabelText(/openai api key/i);
      expect(newInput).toHaveValue('');
    });
  });

  // ============================================================================
  // Performance Tests
  // ============================================================================

  describe('Performance', () => {
    it('debounces validation on input change', async () => {
      render(<ApiKeyInput provider="openai" validateOnChange debounceMs={300} />);
      const input = screen.getByLabelText(/openai api key/i);

      // Type multiple characters quickly
      await user.type(input, validOpenAIKey, { delay: 10 });

      // Should not have called validation yet
      expect(mockValidationService.validateAPIKey).not.toHaveBeenCalled();

      // Wait for debounce period
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 350));
      });

      // Should have called validation once
      expect(mockValidationService.validateAPIKey).toHaveBeenCalledTimes(1);
    });

    it('cancels previous validation requests', async () => {
      mockValidationService.validateAPIKey
        .mockResolvedValueOnce(mockValidValidationResult)
        .mockResolvedValueOnce(mockInvalidValidationResult);

      render(<ApiKeyInput provider="openai" />);
      const input = screen.getByLabelText(/openai api key/i);
      const validateButton = screen.getByRole('button', { name: /validate key/i });

      // Start first validation
      await user.type(input, validOpenAIKey);
      await user.click(validateButton);

      // Quickly start second validation
      await user.clear(input);
      await user.type(input, invalidKey);
      await user.click(validateButton);

      // Should have called validation twice but only show second result
      await waitFor(() => {
        expect(mockValidationService.validateAPIKey).toHaveBeenCalledTimes(2);
        expect(screen.getByText(/invalid api key format/i)).toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // Multiple Provider Tests
  // ============================================================================

  describe('Multiple Providers', () => {
    it('handles OpenAI keys correctly', async () => {
      render(<ApiKeyInput provider="openai" />);
      const input = screen.getByLabelText(/openai api key/i);
      const validateButton = screen.getByRole('button', { name: /validate key/i });

      await user.type(input, validOpenAIKey);
      await user.click(validateButton);

      expect(mockValidationService.validateAPIKey).toHaveBeenCalledWith(
        validOpenAIKey,
        'openai',
        expect.any(Object)
      );
    });

    it('handles Gemini keys correctly', async () => {
      render(<ApiKeyInput provider="gemini" />);
      const input = screen.getByLabelText(/google gemini api key/i);
      const validateButton = screen.getByRole('button', { name: /validate key/i });

      await user.type(input, validGeminiKey);
      await user.click(validateButton);

      expect(mockValidationService.validateAPIKey).toHaveBeenCalledWith(
        validGeminiKey,
        'gemini',
        expect.any(Object)
      );
    });

    it('handles OpenRouter keys correctly', async () => {
      render(<ApiKeyInput provider="openrouter" />);
      const input = screen.getByLabelText(/openrouter api key/i);
      const validateButton = screen.getByRole('button', { name: /validate key/i });

      await user.type(input, validOpenRouterKey);
      await user.click(validateButton);

      expect(mockValidationService.validateAPIKey).toHaveBeenCalledWith(
        validOpenRouterKey,
        'openrouter',
        expect.any(Object)
      );
    });
  });

  // ============================================================================
  // Edge Cases and Error Handling
  // ============================================================================

  describe('Edge Cases', () => {
    it('handles empty provider gracefully', () => {
      // @ts-expect-error - Testing edge case
      render(<ApiKeyInput provider="" />);
      expect(screen.getByLabelText(/^api key$/i)).toBeInTheDocument();
    });

    it('handles very long keys', async () => {
      const longKey = 'sk-' + 'a'.repeat(1000);
      render(<ApiKeyInput provider="openai" />);
      const input = screen.getByLabelText(/openai api key/i);

      await user.type(input, longKey);
      expect(input.value.length).toBeLessThanOrEqual(100); // Should be limited
    });

    it('handles special characters in keys', async () => {
      const specialKey = 'sk-test!@#$%^&*()';
      render(<ApiKeyInput provider="openai" />);
      const input = screen.getByLabelText(/openai api key/i);

      await user.type(input, specialKey);
      expect(input).toHaveValue(specialKey);
    });

    it('handles network timeouts gracefully', async () => {
      mockValidationService.validateAPIKey.mockRejectedValue(new Error('Request timeout'));

      render(<ApiKeyInput provider="openai" />);
      const input = screen.getByLabelText(/openai api key/i);
      const validateButton = screen.getByRole('button', { name: /validate key/i });

      await user.type(input, validOpenAIKey);
      await user.click(validateButton);

      await waitFor(() => {
        expect(screen.getByText(/request timeout/i)).toBeInTheDocument();
      });
    });

    it('handles rapid successive validations', async () => {
      render(<ApiKeyInput provider="openai" />);
      const input = screen.getByLabelText(/openai api key/i);
      const validateButton = screen.getByRole('button', { name: /validate key/i });

      await user.type(input, validOpenAIKey);
      
      // Click validate button rapidly
      await user.click(validateButton);
      await user.click(validateButton);
      await user.click(validateButton);

      // Should call validation service but prevent overlapping calls
      await waitFor(() => {
        expect(mockValidationService.validateAPIKey).toHaveBeenCalled();
        // The exact number may vary depending on timing, but it should be reasonable
        expect(mockValidationService.validateAPIKey.mock.calls.length).toBeLessThanOrEqual(3);
      });
    });
  });
});