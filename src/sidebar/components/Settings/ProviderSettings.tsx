/**
 * @file Provider Settings Component
 *
 * UI component for configuring AI provider settings including provider selection,
 * model configuration, and provider-specific parameters.
 *
 * Features:
 * - Provider selection (OpenAI, Gemini)
 * - Model selection based on provider
 * - Temperature slider (0.0-2.0)
 * - OpenAI: reasoning_effort dropdown
 * - Gemini: thinking_mode toggle, thought visibility checkbox
 * - Parameter validation per model
 * - Configuration persistence to settings store
 * - Provider status display
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSettingsStore } from '@store/settings';
import { Button } from '@ui/Button';
import { Input } from '@ui/Input';
import { Card } from '@ui/Card';
import { cn } from '@utils/cn';
import type { ProviderType, ReasoningEffort, ThinkingMode } from '@/types/providers';
import type { AISettings, AIProvider } from '@/types/settings';

// ============================================================================
// Types and Constants
// ============================================================================

interface ProviderOption {
  value: ProviderType;
  label: string;
  description: string;
}

interface ModelOption {
  value: string;
  label: string;
  maxTokens: number;
  description: string;
}

interface ValidationError {
  field: string;
  message: string;
}

// Extended AI settings interface for provider-specific settings
interface ExtendedAISettings extends Omit<AISettings, 'defaultProvider'> {
  defaultProvider: AIProvider;
  selectedModel?: string | null;
  reasoningEffort?: ReasoningEffort;
  thinkingMode?: ThinkingMode;
  showThoughts?: boolean;
  maxThinkingTokens?: number;
}

// Provider options - restricted to supported providers only
const PROVIDER_OPTIONS: ProviderOption[] = [
  {
    value: 'openai',
    label: 'OpenAI',
    description: 'GPT-5 Nano - Fast and efficient nano model',
  },
  {
    value: 'gemini',
    label: 'Google Gemini',
    description: 'Gemini 2.5 Flash Lite - Lightweight flash model',
  },
];

// Model options per provider - restricted to supported models only
const PROVIDER_MODELS: Partial<Record<ProviderType, ModelOption[]>> = {
  openai: [
    {
      value: 'gpt-5-nano',
      label: 'GPT-5 Nano',
      maxTokens: 4096,
      description: 'Fast and efficient nano model',
    },
  ],
  gemini: [
    {
      value: 'gemini-2.5-flash-lite',
      label: 'Gemini 2.5 Flash Lite',
      maxTokens: 8192,
      description: 'Lightweight flash model',
    },
  ],
};

// Reasoning effort options
const REASONING_EFFORTS: { value: ReasoningEffort; label: string; description: string }[] = [
  { value: 'low', label: 'Low', description: 'Faster responses, less reasoning' },
  { value: 'medium', label: 'Medium', description: 'Balanced speed and reasoning' },
  { value: 'high', label: 'High', description: 'Slower responses, more thorough reasoning' },
];

// Thinking mode options
const THINKING_MODES: { value: ThinkingMode; label: string; description: string }[] = [
  { value: 'off', label: 'Off', description: 'No visible thinking process' },
  { value: 'dynamic', label: 'Dynamic', description: 'Shows thinking process when beneficial' },
];

// Debounce delay for saving changes (ms)
const SAVE_DEBOUNCE_DELAY = 500;

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

// ============================================================================
// Main Component
// ============================================================================

/**
 * Provider Settings Component
 */
export function ProviderSettings() {
  const { settings, updateAISettings, isLoading, error } = useSettingsStore();

  // Local state for form values
  const [formState, setFormState] = useState<Partial<ExtendedAISettings>>({});
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize form state from settings
  useEffect(() => {
    const aiSettings = settings.ai as any; // Type assertion for extended properties
    const initialState: Partial<ExtendedAISettings> = {
      defaultProvider: settings.ai.defaultProvider,
      temperature: settings.ai.temperature,
      maxTokens: settings.ai.maxTokens,
      streamResponse: settings.ai.streamResponse,
      reasoningEffort: aiSettings.reasoningEffort || 'medium',
      thinkingMode: aiSettings.thinkingMode || 'off',
      showThoughts: aiSettings.showThoughts || false,
      maxThinkingTokens: aiSettings.maxThinkingTokens || 25000,
      selectedModel: settings.selectedModel || null,
    };

    setFormState(initialState);
    setIsInitialized(true);
  }, [settings.ai, settings.selectedModel]);

  // Debounce form state changes for saving
  const debouncedFormState = useDebounce(formState, SAVE_DEBOUNCE_DELAY);

  // Get current provider models
  const currentModels = useMemo(() => {
    return formState.defaultProvider ? PROVIDER_MODELS[formState.defaultProvider] || [] : [];
  }, [formState.defaultProvider]);

  // Get current model details
  const currentModel = useMemo(() => {
    return currentModels.find(model => model.value === formState.selectedModel);
  }, [currentModels, formState.selectedModel]);

  // Feature support flags (UI-only; mirrors provider capabilities)
  const temperatureSupported = useMemo(() => {
    // gpt-5-nano does not accept temperature in the OpenAI Responses API
    if (formState.defaultProvider === 'openai' && formState.selectedModel === 'gpt-5-nano') {
      return false;
    }
    return true;
  }, [formState.defaultProvider, formState.selectedModel]);

  // ============================================================================
  // Validation Functions
  // ============================================================================

  const validateTemperature = useCallback((temp: number): string | null => {
    if (temp < 0.0 || temp > 2.0) {
      return 'Temperature must be between 0.0 and 2.0';
    }
    return null;
  }, []);

  const validateMaxTokens = useCallback((tokens: number, modelMaxTokens: number): string | null => {
    if (tokens > modelMaxTokens) {
      return `Exceeds model limit of ${modelMaxTokens.toLocaleString()} tokens`;
    }
    if (tokens < 1) {
      return 'Max tokens must be at least 1';
    }
    return null;
  }, []);

  const validateForm = useCallback(
    (state: Partial<ExtendedAISettings>): ValidationError[] => {
      const errors: ValidationError[] = [];

      // Validate temperature
      if (typeof state.temperature === 'number') {
        const tempError = validateTemperature(state.temperature);
        if (tempError) {
          errors.push({ field: 'temperature', message: tempError });
        }
      }

      // Validate max tokens
      if (typeof state.maxTokens === 'number' && currentModel) {
        const tokensError = validateMaxTokens(state.maxTokens, currentModel.maxTokens);
        if (tokensError) {
          errors.push({ field: 'maxTokens', message: tokensError });
        }
      }

      return errors;
    },
    [validateTemperature, validateMaxTokens, currentModel]
  );

  // ============================================================================
  // Save Logic
  // ============================================================================

  const saveSettings = useCallback(
    async (newSettings: Partial<ExtendedAISettings>) => {
      const errors = validateForm(newSettings);

      if (errors.length > 0) {
        setValidationErrors(errors);
        return;
      }

      setValidationErrors([]);

      try {
        // Extract only AISettings properties
        const coreAISettings: AISettings = {
          defaultProvider: newSettings.defaultProvider ?? settings.ai.defaultProvider,
          temperature: newSettings.temperature ?? settings.ai.temperature,
          maxTokens: newSettings.maxTokens ?? settings.ai.maxTokens,
          streamResponse: newSettings.streamResponse ?? settings.ai.streamResponse,
        };

        await updateAISettings(coreAISettings);

        // Handle selectedModel separately if it exists in the store
        if (
          newSettings.selectedModel !== undefined &&
          'updateSelectedModel' in useSettingsStore.getState()
        ) {
          const { updateSelectedModel } = useSettingsStore.getState() as any;
          if (updateSelectedModel) {
            await updateSelectedModel(newSettings.selectedModel);
          }
        }
      } catch (error) {
        console.error('Failed to save AI settings:', error);
      }
    },
    [settings.ai, updateAISettings, validateForm]
  );

  // Save debounced changes - only when there are actual changes and after initialization
  useEffect(() => {
    if (!isInitialized || Object.keys(debouncedFormState).length === 0) return;

    // Check if form state is different from current settings
    const hasChanges = Object.keys(debouncedFormState).some(key => {
      const formValue = debouncedFormState[key as keyof typeof debouncedFormState];
      const settingsValue = (settings.ai as any)[key];
      return formValue !== settingsValue;
    });

    if (hasChanges) {
      saveSettings(debouncedFormState);
    }
  }, [debouncedFormState, saveSettings, settings.ai, isInitialized]);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleProviderChange = useCallback(
    (provider: string) => {
      const actualProvider = provider === '' ? null : (provider as AIProvider);

      const newState = {
        ...formState,
        defaultProvider: actualProvider,
        selectedModel: null, // Reset model selection
      };

      // Reset provider-specific settings
      if (actualProvider === 'openai') {
        newState.reasoningEffort = 'medium';
      } else if (actualProvider === 'gemini') {
        newState.thinkingMode = 'off';
        newState.showThoughts = false;
      }

      setFormState(newState);
    },
    [formState]
  );

  const handleModelChange = useCallback((modelId: string) => {
    setFormState(prev => ({
      ...prev,
      selectedModel: modelId,
    }));
  }, []);

  const handleTemperatureChange = useCallback((temperature: number) => {
    setFormState(prev => ({
      ...prev,
      temperature,
    }));
  }, []);

  const handleMaxTokensChange = useCallback((maxTokens: number) => {
    setFormState(prev => ({
      ...prev,
      maxTokens,
    }));
  }, []);

  const handleReasoningEffortChange = useCallback((reasoningEffort: ReasoningEffort) => {
    setFormState(prev => ({
      ...prev,
      reasoningEffort,
    }));
  }, []);

  const handleThinkingModeChange = useCallback((thinkingMode: ThinkingMode) => {
    setFormState(prev => ({
      ...prev,
      thinkingMode,
      showThoughts: thinkingMode === 'off' ? false : prev.showThoughts,
    }));
  }, []);

  const handleShowThoughtsChange = useCallback((showThoughts: boolean) => {
    setFormState(prev => ({
      ...prev,
      showThoughts,
    }));
  }, []);

  // OpenRouter maxThinkingTokens removed with provider

  // ============================================================================
  // Helper Functions
  // ============================================================================

  const getValidationError = useCallback(
    (field: string): string | undefined => {
      return validationErrors.find(error => error.field === field)?.message;
    },
    [validationErrors]
  );

  const hasApiKey = useCallback((): boolean => {
    if (!formState.defaultProvider) return false;

    // This would check against actual API key store in real implementation
    // For now, assume we have API key configuration status
    const apiKeyField =
      formState.defaultProvider === 'openai'
        ? 'openai'
        : formState.defaultProvider === 'gemini'
          ? 'google'
          : null;

    return !!(
      apiKeyField &&
      settings.apiKeys &&
      settings.apiKeys[apiKeyField as keyof typeof settings.apiKeys]
    );
  }, [formState.defaultProvider, settings.apiKeys]);

  // ============================================================================
  // Render Helpers
  // ============================================================================

  const renderProviderSelect = () => (
    <div className="provider-settings__field">
      <label htmlFor="provider-select" className="provider-settings__label">
        AI Provider
      </label>
      <select
        id="provider-select"
        role="combobox"
        aria-label="Select AI provider"
        value={formState.defaultProvider || ''}
        onChange={e => handleProviderChange(e.target.value)}
        className={cn('provider-settings__select', {
          'provider-settings__select--error': getValidationError('defaultProvider'),
        })}
      >
        <option value="">Select a provider...</option>
        {PROVIDER_OPTIONS.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {PROVIDER_OPTIONS.map(
        option =>
          formState.defaultProvider === option.value && (
            <p key={option.value} className="provider-settings__description">
              {option.description}
            </p>
          )
      )}
    </div>
  );

  const renderModelSelect = () => (
    <div className="provider-settings__field">
      <label htmlFor="model-select" className="provider-settings__label">
        Model
      </label>
      <select
        id="model-select"
        role="combobox"
        aria-label="Select model"
        value={formState.selectedModel || ''}
        onChange={e => handleModelChange(e.target.value)}
        disabled={!formState.defaultProvider || currentModels.length === 0}
        className={cn('provider-settings__select', {
          'provider-settings__select--disabled': !formState.defaultProvider,
          'provider-settings__select--error': getValidationError('selectedModel'),
        })}
      >
        {currentModels.length === 0 ? (
          <option value="">No models available</option>
        ) : (
          <>
            <option value="">Select a model...</option>
            {currentModels.map(model => (
              <option key={model.value} value={model.value}>
                {model.label}
              </option>
            ))}
          </>
        )}
      </select>
      {currentModel && (
        <p className="provider-settings__description">
          {currentModel.description} (Max: {currentModel.maxTokens.toLocaleString()} tokens)
        </p>
      )}
    </div>
  );

  const renderTemperatureSlider = () => (
    <div className="provider-settings__field">
      <label htmlFor="temperature-slider" className="provider-settings__label">
        Temperature
        <span className="provider-settings__value" aria-live="polite">
          {formState.temperature?.toFixed(1) || '0.7'}
        </span>
      </label>
      <input
        id="temperature-slider"
        type="range"
        role="slider"
        aria-label="Temperature (controls randomness)"
        min="0"
        max="2"
        step="0.1"
        value={formState.temperature || 0.7}
        onChange={e => handleTemperatureChange(parseFloat(e.target.value))}
        disabled={!temperatureSupported}
        className={cn('provider-settings__slider', {
          'provider-settings__slider--error': getValidationError('temperature'),
          'provider-settings__slider--disabled': !temperatureSupported,
        })}
      />
      <div className="provider-settings__slider-labels">
        <span>0.0 (Focused)</span>
        <span>2.0 (Creative)</span>
      </div>
      {temperatureSupported ? (
        <p className="provider-settings__description">
          Controls randomness in responses. Higher values make output more creative.
        </p>
      ) : (
        <p className="provider-settings__description">
          Not applicable for this model; outputs are deterministic and ignore temperature.
        </p>
      )}
      {getValidationError('temperature') && (
        <p className="provider-settings__error">{getValidationError('temperature')}</p>
      )}
    </div>
  );

  const renderMaxTokensInput = () => (
    <div className="provider-settings__field">
      <label htmlFor="max-tokens" className="provider-settings__label">
        Max Tokens
      </label>
      <Input
        id="max-tokens"
        type="number"
        role="spinbutton"
        aria-label="Max tokens"
        min="1"
        max={currentModel?.maxTokens || 4096}
        value={
          formState.maxTokens ||
          (currentModel?.maxTokens ? Math.min(2048, currentModel.maxTokens) : 2048)
        }
        onChange={e => handleMaxTokensChange(parseInt(e.target.value))}
        error={!!getValidationError('maxTokens')}
        errorMessage={getValidationError('maxTokens')}
        helperText="Maximum number of tokens to generate"
        className="provider-settings__input"
      />
    </div>
  );

  const renderOpenAISettings = () => {
    if (formState.defaultProvider !== 'openai') return null;

    return (
      <div className="provider-settings__section">
        <h3 className="provider-settings__section-title">OpenAI Settings</h3>

        <div className="provider-settings__field">
          <label htmlFor="reasoning-effort" className="provider-settings__label">
            Reasoning Effort
          </label>
          <select
            id="reasoning-effort"
            role="combobox"
            aria-label="Reasoning effort level"
            value={formState.reasoningEffort || 'medium'}
            onChange={e => handleReasoningEffortChange(e.target.value as ReasoningEffort)}
            className="provider-settings__select"
          >
            {REASONING_EFFORTS.map(effort => (
              <option key={effort.value} value={effort.value}>
                {effort.label}
              </option>
            ))}
          </select>
          {REASONING_EFFORTS.map(
            effort =>
              formState.reasoningEffort === effort.value && (
                <p key={effort.value} className="provider-settings__description">
                  {effort.description}
                </p>
              )
          )}
        </div>
      </div>
    );
  };

  const renderGeminiSettings = () => {
    if (formState.defaultProvider !== 'gemini') return null;

    return (
      <div className="provider-settings__section">
        <h3 className="provider-settings__section-title">Gemini Settings</h3>

        <div className="provider-settings__field">
          <label htmlFor="thinking-mode" className="provider-settings__label">
            Thinking Mode
          </label>
          <select
            id="thinking-mode"
            role="combobox"
            aria-label="Thinking mode"
            value={formState.thinkingMode || 'off'}
            onChange={e => handleThinkingModeChange(e.target.value as ThinkingMode)}
            className="provider-settings__select"
          >
            {THINKING_MODES.map(mode => (
              <option key={mode.value} value={mode.value}>
                {mode.label}
              </option>
            ))}
          </select>
          {THINKING_MODES.map(
            mode =>
              formState.thinkingMode === mode.value && (
                <p key={mode.value} className="provider-settings__description">
                  {mode.description}
                </p>
              )
          )}
        </div>

        <div className="provider-settings__field">
          <label className="provider-settings__checkbox-label">
            <input
              type="checkbox"
              role="checkbox"
              aria-label="Show thoughts in responses"
              checked={formState.showThoughts || false}
              disabled={formState.thinkingMode === 'off'}
              onChange={e => handleShowThoughtsChange(e.target.checked)}
              className="provider-settings__checkbox"
            />
            <span>Show Thoughts</span>
          </label>
          <p className="provider-settings__description">
            Display the model&apos;s thinking process in responses
          </p>
        </div>
      </div>
    );
  };

  // OpenRouter settings removed

  const renderStatus = () => (
    <Card variant="basic" padding="md" className="provider-settings__status">
      <Card.Header>
        <Card.Title level={4}>Provider Status</Card.Title>
      </Card.Header>
      <Card.Body>
        <div className="provider-settings__status-item">
          <span className="provider-settings__status-label">Provider:</span>
          <span
            className={cn('provider-settings__status-value', {
              'provider-settings__status-value--inactive': !formState.defaultProvider,
            })}
          >
            {formState.defaultProvider
              ? PROVIDER_OPTIONS.find(p => p.value === formState.defaultProvider)?.label
              : 'None Selected'}
          </span>
        </div>

        <div className="provider-settings__status-item">
          <span className="provider-settings__status-label">API Key:</span>
          <span
            className={cn('provider-settings__status-value', {
              'provider-settings__status-value--active': hasApiKey(),
              'provider-settings__status-value--inactive': !hasApiKey(),
            })}
          >
            {hasApiKey() ? 'Configured' : 'Not Configured'}
          </span>
        </div>

        <div className="provider-settings__status-item">
          <span className="provider-settings__status-label">Models:</span>
          <span className="provider-settings__status-value">{currentModels.length} available</span>
        </div>
      </Card.Body>
    </Card>
  );

  const renderError = () => {
    if (!error) return null;

    return (
      <div className="provider-settings__error-banner" role="alert">
        <p>{error}</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => window.location.reload()}
          aria-label="Retry loading settings"
        >
          Retry
        </Button>
      </div>
    );
  };

  const renderLoading = () => {
    if (!isLoading) return null;

    return (
      <div className="provider-settings__loading" aria-live="polite">
        <p>Saving configuration...</p>
      </div>
    );
  };

  // ============================================================================
  // Main Render
  // ============================================================================

  return (
    <div className="provider-settings">
      <Card variant="elevated" padding="lg">
        <Card.Header>
          <Card.Title level={2}>Provider Settings</Card.Title>
          <Card.Description>Configure your AI provider and model preferences</Card.Description>
        </Card.Header>

        <Card.Body>
          {renderError()}
          {renderLoading()}

          <div className="provider-settings__form">
            {renderProviderSelect()}
            {renderModelSelect()}
            {renderTemperatureSlider()}
            {renderMaxTokensInput()}
            {renderOpenAISettings()}
            {renderGeminiSettings()}
            {/* OpenRouter settings removed */}
          </div>
        </Card.Body>
      </Card>

      {renderStatus()}
    </div>
  );
}

export default ProviderSettings;
