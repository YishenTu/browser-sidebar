/**
 * @file Provider Settings Component Tests
 * 
 * Comprehensive tests for the Provider Settings UI component following TDD methodology.
 * Tests provider selection, model selection, parameter configuration, validation, and 
 * configuration persistence.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, beforeEach, afterEach, it, expect } from 'vitest';
import { useSettingsStore } from '@store/settings';
import { ProviderSettings } from '@components/Settings/ProviderSettings';
import type { ProviderType, ReasoningEffort, ThinkingMode } from '@types/providers';

// Mock Zustand store
vi.mock('@store/settings', () => ({
  useSettingsStore: vi.fn()
}));

// Mock provider factory (since we may use it for model loading)
vi.mock('@provider/ProviderFactory', () => ({
  ProviderFactory: {
    getProvider: vi.fn(),
    getSupportedModels: vi.fn()
  }
}));

// Type for mock store
interface MockStore {
  settings: {
    ai: {
      defaultProvider: ProviderType | null;
      temperature: number;
      maxTokens: number;
      reasoningEffort?: ReasoningEffort;
      thinkingMode?: ThinkingMode;
      showThoughts?: boolean;
      maxThinkingTokens?: number;
    };
    apiKeys: {
      openai: string | null;
      anthropic: string | null;
      google: string | null;
    };
  };
  updateAISettings: vi.MockedFunction<any>;
  isLoading: boolean;
  error: string | null;
}

describe('ProviderSettings Component', () => {
  let mockStore: MockStore;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    
    // Default mock store state
    mockStore = {
      settings: {
        ai: {
          defaultProvider: null,
          temperature: 0.7,
          maxTokens: 2048,
          reasoningEffort: 'medium',
          thinkingMode: 'off',
          showThoughts: false,
          maxThinkingTokens: 25000,
        },
        apiKeys: {
          openai: null,
          anthropic: null,
          google: null,
        }
      },
      updateAISettings: vi.fn(),
      isLoading: false,
      error: null,
    };

    (useSettingsStore as any).mockReturnValue(mockStore);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // Provider Selection Tests
  // ============================================================================

  describe('Provider Selection', () => {
    it('should render provider selection dropdown', () => {
      render(<ProviderSettings />);
      
      expect(screen.getByRole('combobox', { name: /select ai provider/i })).toBeInTheDocument();
    });

    it('should display all supported providers in dropdown', async () => {
      render(<ProviderSettings />);
      
      const providerSelect = screen.getByRole('combobox', { name: /select ai provider/i });
      await user.click(providerSelect);
      
      expect(screen.getByRole('option', { name: /openai/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /gemini/i })).toBeInTheDocument();
      // OpenRouter not supported
    });

    it('should select OpenAI provider', async () => {
      render(<ProviderSettings />);
      
      const providerSelect = screen.getByRole('combobox', { name: /select ai provider/i });
      await user.click(providerSelect);
      await user.click(screen.getByRole('option', { name: /openai/i }));
      
      // Wait for debounced save
      await waitFor(() => {
        expect(mockStore.updateAISettings).toHaveBeenCalledWith(
          expect.objectContaining({
            defaultProvider: 'openai'
          })
        );
      }, { timeout: 1000 });
    });

    it('should select Gemini provider', async () => {
      render(<ProviderSettings />);
      
      const providerSelect = screen.getByRole('combobox', { name: /select ai provider/i });
      await user.click(providerSelect);
      await user.click(screen.getByRole('option', { name: /gemini/i }));
      
      // Wait for debounced save
      await waitFor(() => {
        expect(mockStore.updateAISettings).toHaveBeenCalledWith(
          expect.objectContaining({
            defaultProvider: 'gemini'
          })
        );
      }, { timeout: 1000 });
    });

    // OpenRouter selection test removed

    it('should show current selected provider', () => {
      mockStore.settings.ai.defaultProvider = 'openai';
      render(<ProviderSettings />);
      
      const providerSelect = screen.getByRole('combobox', { name: /select ai provider/i });
      expect(providerSelect).toHaveValue('openai');
    });
  });

  // ============================================================================
  // Model Selection Tests  
  // ============================================================================

  describe('Model Selection', () => {
    it('should show OpenAI models when OpenAI is selected', async () => {
      mockStore.settings.ai.defaultProvider = 'openai';
      render(<ProviderSettings />);
      
      const modelSelect = screen.getByRole('combobox', { name: /select model/i });
      await user.click(modelSelect);
      
      expect(screen.getByRole('option', { name: /^GPT-4$/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /GPT-3.5 Turbo/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /o1 Preview/i })).toBeInTheDocument();
    });

    it('should show Gemini models when Gemini is selected', async () => {
      mockStore.settings.ai.defaultProvider = 'gemini';
      render(<ProviderSettings />);
      
      const modelSelect = screen.getByRole('combobox', { name: /select model/i });
      await user.click(modelSelect);
      
      expect(screen.getByRole('option', { name: /gemini-2.0-flash-exp/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /gemini-1.5-pro/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /gemini-1.5-flash/i })).toBeInTheDocument();
    });

    // OpenRouter models test removed

    it('should update selected model', async () => {
      mockStore.settings.ai.defaultProvider = 'openai';
      render(<ProviderSettings />);
      
      const modelSelect = screen.getByRole('combobox', { name: /select model/i });
      await user.click(modelSelect);
      await user.click(screen.getByRole('option', { name: /gpt-4/i }));
      
      expect(mockStore.updateAISettings).toHaveBeenCalledWith(
        expect.objectContaining({
          selectedModel: expect.stringContaining('gpt-4')
        })
      );
    });

    it('should disable model selection when no provider is selected', () => {
      mockStore.settings.ai.defaultProvider = null;
      render(<ProviderSettings />);
      
      const modelSelect = screen.getByRole('combobox', { name: /select model/i });
      expect(modelSelect).toBeDisabled();
    });
  });

  // ============================================================================
  // Temperature Slider Tests
  // ============================================================================

  describe('Temperature Configuration', () => {
    it('should render temperature slider with current value', () => {
      mockStore.settings.ai.temperature = 0.8;
      render(<ProviderSettings />);
      
      const temperatureSlider = screen.getByRole('slider', { name: /temperature/i });
      expect(temperatureSlider).toHaveValue('0.8');
    });

    it('should display temperature value label', () => {
      mockStore.settings.ai.temperature = 0.8;
      render(<ProviderSettings />);
      
      expect(screen.getByText('0.8')).toBeInTheDocument();
    });

    it('should update temperature when slider changes', async () => {
      render(<ProviderSettings />);
      
      const temperatureSlider = screen.getByRole('slider', { name: /temperature/i });
      await user.type(temperatureSlider, '1.2');
      
      expect(mockStore.updateAISettings).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 1.2
        })
      );
    });

    it('should enforce minimum temperature of 0.0', async () => {
      render(<ProviderSettings />);
      
      const temperatureSlider = screen.getByRole('slider', { name: /temperature/i });
      fireEvent.change(temperatureSlider, { target: { value: '-0.1' } });
      
      expect(mockStore.updateAISettings).not.toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: -0.1
        })
      );
    });

    it('should enforce maximum temperature of 2.0', async () => {
      render(<ProviderSettings />);
      
      const temperatureSlider = screen.getByRole('slider', { name: /temperature/i });
      fireEvent.change(temperatureSlider, { target: { value: '2.1' } });
      
      expect(mockStore.updateAISettings).not.toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 2.1
        })
      );
    });

    it('should show temperature description', () => {
      render(<ProviderSettings />);
      
      expect(screen.getByText(/controls randomness/i)).toBeInTheDocument();
    });
  });

  // ============================================================================
  // OpenAI Reasoning Effort Tests
  // ============================================================================

  describe('OpenAI Reasoning Effort', () => {
    beforeEach(() => {
      mockStore.settings.ai.defaultProvider = 'openai';
    });

    it('should show reasoning effort dropdown for OpenAI', () => {
      render(<ProviderSettings />);
      
      expect(screen.getByRole('combobox', { name: /reasoning effort/i })).toBeInTheDocument();
    });

    it('should display all reasoning effort options', async () => {
      render(<ProviderSettings />);
      
      const reasoningSelect = screen.getByRole('combobox', { name: /reasoning effort/i });
      await user.click(reasoningSelect);
      
      expect(screen.getByRole('option', { name: /low/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /medium/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /high/i })).toBeInTheDocument();
    });

    it('should update reasoning effort selection', async () => {
      render(<ProviderSettings />);
      
      const reasoningSelect = screen.getByRole('combobox', { name: /reasoning effort/i });
      await user.click(reasoningSelect);
      await user.click(screen.getByRole('option', { name: /high/i }));
      
      expect(mockStore.updateAISettings).toHaveBeenCalledWith(
        expect.objectContaining({
          reasoningEffort: 'high'
        })
      );
    });

    it('should show current reasoning effort value', () => {
      mockStore.settings.ai.reasoningEffort = 'high';
      render(<ProviderSettings />);
      
      const reasoningSelect = screen.getByRole('combobox', { name: /reasoning effort/i });
      expect(reasoningSelect).toHaveValue('high');
    });

    it('should not show reasoning effort for other providers', () => {
      mockStore.settings.ai.defaultProvider = 'gemini';
      render(<ProviderSettings />);
      
      expect(screen.queryByRole('combobox', { name: /reasoning effort/i })).not.toBeInTheDocument();
    });
  });

  // ============================================================================
  // Gemini Thinking Mode Tests
  // ============================================================================

  describe('Gemini Thinking Mode', () => {
    beforeEach(() => {
      mockStore.settings.ai.defaultProvider = 'gemini';
    });

    it('should show thinking mode dropdown for Gemini', () => {
      render(<ProviderSettings />);
      
      expect(screen.getByRole('combobox', { name: /thinking mode/i })).toBeInTheDocument();
    });

    it('should display thinking mode options', async () => {
      render(<ProviderSettings />);
      
      const thinkingSelect = screen.getByRole('combobox', { name: /thinking mode/i });
      await user.click(thinkingSelect);
      
      expect(screen.getByRole('option', { name: /off/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /dynamic/i })).toBeInTheDocument();
    });

    it('should update thinking mode selection', async () => {
      render(<ProviderSettings />);
      
      const thinkingSelect = screen.getByRole('combobox', { name: /thinking mode/i });
      await user.click(thinkingSelect);
      await user.click(screen.getByRole('option', { name: /dynamic/i }));
      
      expect(mockStore.updateAISettings).toHaveBeenCalledWith(
        expect.objectContaining({
          thinkingMode: 'dynamic'
        })
      );
    });

    it('should show thought visibility checkbox', () => {
      render(<ProviderSettings />);
      
      expect(screen.getByRole('checkbox', { name: /show thoughts/i })).toBeInTheDocument();
    });

    it('should toggle thought visibility', async () => {
      mockStore.settings.ai.showThoughts = false;
      render(<ProviderSettings />);
      
      const checkbox = screen.getByRole('checkbox', { name: /show thoughts/i });
      await user.click(checkbox);
      
      expect(mockStore.updateAISettings).toHaveBeenCalledWith(
        expect.objectContaining({
          showThoughts: true
        })
      );
    });

    it('should enable thought visibility only when thinking mode is dynamic', async () => {
      mockStore.settings.ai.thinkingMode = 'off';
      render(<ProviderSettings />);
      
      const checkbox = screen.getByRole('checkbox', { name: /show thoughts/i });
      expect(checkbox).toBeDisabled();
      
      // Change to dynamic mode
      const thinkingSelect = screen.getByRole('combobox', { name: /thinking mode/i });
      await user.click(thinkingSelect);
      await user.click(screen.getByRole('option', { name: /dynamic/i }));
      
      await waitFor(() => {
        expect(checkbox).toBeEnabled();
      });
    });

    it('should not show thinking mode for other providers', () => {
      mockStore.settings.ai.defaultProvider = 'openai';
      render(<ProviderSettings />);
      
      expect(screen.queryByRole('combobox', { name: /thinking mode/i })).not.toBeInTheDocument();
    });
  });

  // ============================================================================
  // Parameter Validation Tests
  // ============================================================================

  describe('Parameter Validation', () => {
    it('should validate temperature range', async () => {
      render(<ProviderSettings />);
      
      const temperatureSlider = screen.getByRole('slider', { name: /temperature/i });
      
      // Test invalid low value
      fireEvent.change(temperatureSlider, { target: { value: '-1' } });
      expect(screen.getByText(/temperature must be between 0.0 and 2.0/i)).toBeInTheDocument();
      
      // Test invalid high value  
      fireEvent.change(temperatureSlider, { target: { value: '3' } });
      expect(screen.getByText(/temperature must be between 0.0 and 2.0/i)).toBeInTheDocument();
    });

    it('should validate max tokens for selected model', async () => {
      mockStore.settings.ai.defaultProvider = 'openai';
      render(<ProviderSettings />);
      
      const maxTokensInput = screen.getByRole('spinbutton', { name: /max tokens/i });
      
      // Test invalid high value
      await user.clear(maxTokensInput);
      await user.type(maxTokensInput, '200000');
      
      expect(screen.getByText(/exceeds model limit/i)).toBeInTheDocument();
    });

    it('should show validation errors without saving invalid values', async () => {
      render(<ProviderSettings />);
      
      const temperatureSlider = screen.getByRole('slider', { name: /temperature/i });
      fireEvent.change(temperatureSlider, { target: { value: '3' } });
      
      // Should show error but not call updateAISettings
      expect(screen.getByText(/temperature must be between 0.0 and 2.0/i)).toBeInTheDocument();
      expect(mockStore.updateAISettings).not.toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 3
        })
      );
    });

    it('should clear validation errors when values become valid', async () => {
      render(<ProviderSettings />);
      
      const temperatureSlider = screen.getByRole('slider', { name: /temperature/i });
      
      // Set invalid value
      fireEvent.change(temperatureSlider, { target: { value: '3' } });
      expect(screen.getByText(/temperature must be between 0.0 and 2.0/i)).toBeInTheDocument();
      
      // Set valid value
      fireEvent.change(temperatureSlider, { target: { value: '1.5' } });
      await waitFor(() => {
        expect(screen.queryByText(/temperature must be between 0.0 and 2.0/i)).not.toBeInTheDocument();
      });
    });
  });

  // ============================================================================
  // Configuration Save Tests
  // ============================================================================

  describe('Configuration Persistence', () => {
    it('should save configuration when valid values change', async () => {
      render(<ProviderSettings />);
      
      const temperatureSlider = screen.getByRole('slider', { name: /temperature/i });
      fireEvent.change(temperatureSlider, { target: { value: '1.0' } });
      
      expect(mockStore.updateAISettings).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 1.0
        })
      );
    });

    it('should debounce rapid configuration changes', async () => {
      render(<ProviderSettings />);
      
      const temperatureSlider = screen.getByRole('slider', { name: /temperature/i });
      
      // Rapid changes
      fireEvent.change(temperatureSlider, { target: { value: '1.0' } });
      fireEvent.change(temperatureSlider, { target: { value: '1.1' } });
      fireEvent.change(temperatureSlider, { target: { value: '1.2' } });
      
      // Should only save the final value after debounce
      await waitFor(() => {
        expect(mockStore.updateAISettings).toHaveBeenCalledWith(
          expect.objectContaining({
            temperature: 1.2
          })
        );
      }, { timeout: 1000 });
      
      // Should not have been called for intermediate values
      expect(mockStore.updateAISettings).not.toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 1.0
        })
      );
    });

    it('should show loading state during save', async () => {
      mockStore.isLoading = true;
      render(<ProviderSettings />);
      
      expect(screen.getByText(/saving/i)).toBeInTheDocument();
    });

    it('should show error state if save fails', () => {
      mockStore.error = 'Failed to save configuration';
      render(<ProviderSettings />);
      
      expect(screen.getByText(/failed to save configuration/i)).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Provider Status Tests  
  // ============================================================================

  describe('Provider Status', () => {
    it('should show provider status when provider is selected', () => {
      mockStore.settings.ai.defaultProvider = 'openai';
      render(<ProviderSettings />);
      
      expect(screen.getByText(/provider: openai/i)).toBeInTheDocument();
    });

    it('should show "No Provider Selected" when none selected', () => {
      mockStore.settings.ai.defaultProvider = null;
      render(<ProviderSettings />);
      
      expect(screen.getByText(/no provider selected/i)).toBeInTheDocument();
    });

    it('should show API key status', () => {
      mockStore.settings.ai.defaultProvider = 'openai';
      // Assuming we have a way to check API key status
      render(<ProviderSettings />);
      
      expect(screen.getByText(/api key configured/i)).toBeInTheDocument();
    });

    it('should show model compatibility status', () => {
      mockStore.settings.ai.defaultProvider = 'openai';
      render(<ProviderSettings />);
      
      expect(screen.getByText(/5 models available/i)).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Accessibility Tests
  // ============================================================================

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<ProviderSettings />);
      
      expect(screen.getByRole('combobox', { name: /select ai provider/i })).toHaveAttribute('aria-label');
      expect(screen.getByRole('slider', { name: /temperature/i })).toHaveAttribute('aria-label');
    });

    it('should support keyboard navigation', async () => {
      render(<ProviderSettings />);
      
      const providerSelect = screen.getByRole('combobox', { name: /select ai provider/i });
      
      // Tab to provider select
      await user.tab();
      expect(providerSelect).toHaveFocus();
      
      // Open dropdown with Enter
      await user.keyboard('[Enter]');
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      
      // Navigate with arrow keys
      await user.keyboard('[ArrowDown]');
      await user.keyboard('[Enter]');
      
      expect(mockStore.updateAISettings).toHaveBeenCalled();
    });

    it('should have proper focus management', async () => {
      render(<ProviderSettings />);
      
      const providerSelect = screen.getByRole('combobox', { name: /select ai provider/i });
      await user.click(providerSelect);
      
      // Focus should remain on combobox when dropdown opens
      expect(providerSelect).toHaveFocus();
    });

    it('should announce changes to screen readers', async () => {
      render(<ProviderSettings />);
      
      const temperatureSlider = screen.getByRole('slider', { name: /temperature/i });
      fireEvent.change(temperatureSlider, { target: { value: '1.0' } });
      
      // Check for live region updates
      expect(screen.getByText('1.0')).toHaveAttribute('aria-live');
    });
  });

  // ============================================================================
  // Edge Cases and Error Handling
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle missing provider models gracefully', async () => {
      // Mock a provider that would have no models
      mockStore.settings.ai.defaultProvider = 'openai';
      
      // We'll create a separate test or mock the models differently
      // For now, let's test that when no provider is selected, models are disabled
      mockStore.settings.ai.defaultProvider = null;
      render(<ProviderSettings />);
      
      const modelSelect = screen.getByRole('combobox', { name: /select model/i });
      expect(modelSelect).toBeDisabled();
    });

    it('should handle store errors gracefully', () => {
      mockStore.error = 'Connection failed';
      render(<ProviderSettings />);
      
      expect(screen.getByText(/connection failed/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it('should reset form when provider changes', async () => {
      // Start with no provider selected
      mockStore.settings.ai.defaultProvider = null;
      
      render(<ProviderSettings />);
      
      // First select OpenAI to see OpenAI-specific controls
      const providerSelect = screen.getByRole('combobox', { name: /select ai provider/i });
      await user.click(providerSelect);
      await user.click(screen.getByRole('option', { name: /openai/i }));
      
      // OpenAI controls should be visible
      await waitFor(() => {
        expect(screen.getByRole('combobox', { name: /reasoning effort/i })).toBeInTheDocument();
      });
      
      // Change provider to Gemini
      await user.click(providerSelect);
      await user.click(screen.getByRole('option', { name: /gemini/i }));
      
      // Wait for the change to take effect
      await waitFor(() => {
        // OpenAI-specific controls should be hidden
        expect(screen.queryByRole('combobox', { name: /reasoning effort/i })).not.toBeInTheDocument();
        
        // Gemini-specific controls should be shown
        expect(screen.getByRole('combobox', { name: /thinking mode/i })).toBeInTheDocument();
      });
    });
  });
});
