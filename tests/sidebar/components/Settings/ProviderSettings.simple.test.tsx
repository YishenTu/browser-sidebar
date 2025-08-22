/**
 * @file Provider Settings Component - Simplified Tests
 * 
 * Focused tests for core Provider Settings functionality to validate the TDD implementation
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, beforeEach, afterEach, it, expect } from 'vitest';
import { useSettingsStore } from '@store/settings';
import { ProviderSettings } from '@components/Settings/ProviderSettings';
import type { ProviderType } from '@types/providers';

// Mock Zustand store
vi.mock('@store/settings', () => ({
  useSettingsStore: vi.fn()
}));

interface MockStore {
  settings: {
    ai: {
      defaultProvider: ProviderType | null;
      temperature: number;
      maxTokens: number;
      reasoningEffort?: string;
      thinkingMode?: string;
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

describe('ProviderSettings Component - Core Tests', () => {
  let mockStore: MockStore;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    
    mockStore = {
      settings: {
        ai: {
          defaultProvider: null,
          temperature: 0.7,
          maxTokens: 2048,
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
  // Core Rendering Tests
  // ============================================================================

  it('should render the provider settings component', () => {
    render(<ProviderSettings />);
    
    expect(screen.getByRole('combobox', { name: /select ai provider/i })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: /temperature/i })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: /max tokens/i })).toBeInTheDocument();
  });

  it('should show supported provider options', async () => {
    render(<ProviderSettings />);
    
    const providerSelect = screen.getByRole('combobox', { name: /select ai provider/i });
    await user.click(providerSelect);
    
    expect(screen.getByRole('option', { name: /openai/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /gemini/i })).toBeInTheDocument();
    // OpenRouter not supported
  });

  // ============================================================================
  // Provider-Specific Controls
  // ============================================================================

  it('should show OpenAI-specific controls when OpenAI is selected', () => {
    const mockWithOpenAI = {
      ...mockStore,
      settings: {
        ...mockStore.settings,
        ai: { ...mockStore.settings.ai, defaultProvider: 'openai' as const }
      }
    };
    (useSettingsStore as any).mockReturnValue(mockWithOpenAI);
    
    render(<ProviderSettings />);
    
    expect(screen.getByRole('combobox', { name: /reasoning effort/i })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /thinking mode/i })).not.toBeInTheDocument();
  });

  it('should show Gemini-specific controls when Gemini is selected', () => {
    const mockWithGemini = {
      ...mockStore,
      settings: {
        ...mockStore.settings,
        ai: { ...mockStore.settings.ai, defaultProvider: 'gemini' as const }
      }
    };
    (useSettingsStore as any).mockReturnValue(mockWithGemini);
    
    render(<ProviderSettings />);
    
    expect(screen.getByRole('combobox', { name: /thinking mode/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /show thoughts/i })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /reasoning effort/i })).not.toBeInTheDocument();
  });

  // OpenRouter-specific controls test removed

  // ============================================================================
  // Model Selection Tests
  // ============================================================================

  it('should show OpenAI models when OpenAI is selected', () => {
    const mockWithOpenAI = {
      ...mockStore,
      settings: {
        ...mockStore.settings,
        ai: { ...mockStore.settings.ai, defaultProvider: 'openai' as const }
      }
    };
    (useSettingsStore as any).mockReturnValue(mockWithOpenAI);
    
    render(<ProviderSettings />);
    
    const modelSelect = screen.getByRole('combobox', { name: /select model/i });
    expect(modelSelect).not.toBeDisabled();
  });

  it('should disable model selection when no provider is selected', () => {
    render(<ProviderSettings />);
    
    const modelSelect = screen.getByRole('combobox', { name: /select model/i });
    expect(modelSelect).toBeDisabled();
  });

  // ============================================================================
  // Temperature Control Tests
  // ============================================================================

  it('should display current temperature value', () => {
    const mockWithTemp = {
      ...mockStore,
      settings: {
        ...mockStore.settings,
        ai: { ...mockStore.settings.ai, temperature: 1.2 }
      }
    };
    (useSettingsStore as any).mockReturnValue(mockWithTemp);
    
    render(<ProviderSettings />);
    
    expect(screen.getByText('1.2')).toBeInTheDocument();
    
    const temperatureSlider = screen.getByRole('slider', { name: /temperature/i });
    expect(temperatureSlider).toHaveValue('1.2');
  });

  it('should update temperature when slider changes', () => {
    render(<ProviderSettings />);
    
    const temperatureSlider = screen.getByRole('slider', { name: /temperature/i });
    fireEvent.change(temperatureSlider, { target: { value: '1.5' } });
    
    expect(temperatureSlider).toHaveValue('1.5');
  });

  // ============================================================================
  // Validation Tests
  // ============================================================================

  it('should enforce temperature constraints', () => {
    render(<ProviderSettings />);
    
    const temperatureSlider = screen.getByRole('slider', { name: /temperature/i });
    
    // Check min/max attributes
    expect(temperatureSlider).toHaveAttribute('min', '0');
    expect(temperatureSlider).toHaveAttribute('max', '2');
    expect(temperatureSlider).toHaveAttribute('step', '0.1');
  });

  // ============================================================================
  // Provider Status Display
  // ============================================================================

  it('should show correct provider status', () => {
    // Set up mock with OpenAI provider selected
    const mockStoreWithProvider = {
      ...mockStore,
      settings: {
        ...mockStore.settings,
        ai: {
          ...mockStore.settings.ai,
          defaultProvider: 'openai' as const
        }
      }
    };
    
    (useSettingsStore as any).mockReturnValue(mockStoreWithProvider);
    
    render(<ProviderSettings />);
    
    expect(screen.getByText(/provider:/i)).toBeInTheDocument();
    // The status section should show OpenAI as the selected provider
    expect(screen.getAllByText(/openai/i).length).toBeGreaterThan(0);
  });

  it('should show "None Selected" when no provider is selected', () => {
    render(<ProviderSettings />);
    
    expect(screen.getByText(/none selected/i)).toBeInTheDocument();
  });

  it('should show API key status', () => {
    render(<ProviderSettings />);
    
    expect(screen.getByText(/api key/i)).toBeInTheDocument();
    expect(screen.getByText(/not configured/i)).toBeInTheDocument();
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  it('should display error messages', () => {
    mockStore.error = 'Test error message';
    render(<ProviderSettings />);
    
    expect(screen.getByText(/test error message/i)).toBeInTheDocument();
  });

  it('should show loading state', () => {
    mockStore.isLoading = true;
    render(<ProviderSettings />);
    
    expect(screen.getByText(/saving/i)).toBeInTheDocument();
  });

  // ============================================================================
  // Accessibility Tests
  // ============================================================================

  it('should have proper ARIA labels', () => {
    render(<ProviderSettings />);
    
    expect(screen.getByRole('combobox', { name: /select ai provider/i })).toHaveAttribute('aria-label');
    expect(screen.getByRole('slider', { name: /temperature/i })).toHaveAttribute('aria-label');
    expect(screen.getByRole('spinbutton', { name: /max tokens/i })).toHaveAttribute('aria-label');
  });

  it('should support keyboard navigation', async () => {
    render(<ProviderSettings />);
    
    const providerSelect = screen.getByRole('combobox', { name: /select ai provider/i });
    
    // Tab to provider select
    await user.tab();
    expect(providerSelect).toHaveFocus();
  });

  it('should have live region for temperature updates', () => {
    render(<ProviderSettings />);
    
    const temperatureValue = screen.getByText('0.7');
    expect(temperatureValue).toHaveAttribute('aria-live', 'polite');
  });
});
