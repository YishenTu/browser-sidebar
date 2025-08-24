/**
 * @file Provider Settings Component
 *
 * UI component for configuring AI provider settings including provider selection,
 * model configuration, and provider-specific parameters.
 *
 * Features:
 * - Provider selection (OpenAI, Gemini)
 * - Model selection based on provider
 * - OpenAI: reasoning_effort dropdown
 * - Gemini: thinking_budget toggle, thought visibility checkbox
 * - Parameter validation per model
 * - Configuration persistence to settings store
 * - Provider status display
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSettingsStore } from '@store/settings';
import { Button } from '@ui/Button';
import { Card } from '@ui/Card';
import { cn } from '@sidebar/lib/cn';
import type { ProviderType, ReasoningEffort, ThinkingBudget } from '@/types/providers';
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
  thinkingBudget?: ThinkingBudget;
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
      description: 'Fast and efficient nano model',
    },
  ],
  gemini: [
    {
      value: 'gemini-2.5-flash-lite',
      label: 'Gemini 2.5 Flash Lite',
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

// Thinking budget options
const THINKING_BUDGETS: { value: ThinkingBudget; label: string; description: string }[] = [
  { value: '0', label: 'Off', description: 'No visible thinking process' },
  { value: '-1', label: 'Dynamic', description: 'Shows thinking process when beneficial' },
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
  const [lastSavedState, setLastSavedState] = useState<Partial<ExtendedAISettings>>({});

  // Initialize form state from settings
  useEffect(() => {
    // Defer state updates to avoid updating during render
    const timeoutId = setTimeout(() => {
      const aiSettings = settings.ai as any; // Type assertion for extended properties
      const initialState: Partial<ExtendedAISettings> = {
        defaultProvider: settings.ai.defaultProvider,
        streamResponse: settings.ai.streamResponse,
        reasoningEffort: aiSettings.reasoningEffort || 'medium',
        thinkingBudget: aiSettings.thinkingBudget || '0',
        showThoughts: aiSettings.showThoughts || false,
        maxThinkingTokens: aiSettings.maxThinkingTokens || 25000,
        selectedModel: settings.selectedModel || null,
      };

      setFormState(initialState);
      setLastSavedState(initialState); // Track what we initialized with
      setIsInitialized(true);
    }, 0);

    return () => clearTimeout(timeoutId);
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

  // ============================================================================
  // Validation Functions
  // ============================================================================

  const validateForm = useCallback((): ValidationError[] => {
    const errors: ValidationError[] = [];
    return errors;
  }, []);

  // ============================================================================
  // Save Logic
  // ============================================================================

  const saveSettings = useCallback(
    async (newSettings: Partial<ExtendedAISettings>) => {
      const errors = validateForm();

      if (errors.length > 0) {
        setValidationErrors(errors);
        return;
      }

      setValidationErrors([]);

      try {
        // Extract only AISettings properties
        const coreAISettings: AISettings = {
          defaultProvider: newSettings.defaultProvider ?? settings.ai.defaultProvider,
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

    // Check if form state is different from last saved state
    const hasChanges = Object.keys(debouncedFormState).some(key => {
      const formValue = debouncedFormState[key as keyof typeof debouncedFormState];
      const savedValue = lastSavedState[key as keyof typeof lastSavedState];

      // Deep comparison for objects/arrays, simple comparison for primitives
      if (typeof formValue === 'object' && formValue !== null && savedValue !== null) {
        return JSON.stringify(formValue) !== JSON.stringify(savedValue);
      }
      return formValue !== savedValue;
    });

    if (hasChanges) {
      // Use setTimeout to defer the state update to avoid updating during render
      const timeoutId = setTimeout(() => {
        saveSettings(debouncedFormState);
        setLastSavedState(debouncedFormState); // Update last saved state after saving
      }, 0);

      return () => clearTimeout(timeoutId);
    }
  }, [debouncedFormState, lastSavedState, saveSettings, isInitialized]);

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
        newState.thinkingBudget = '0';
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

  const handleReasoningEffortChange = useCallback((reasoningEffort: ReasoningEffort) => {
    setFormState(prev => ({
      ...prev,
      reasoningEffort,
    }));
  }, []);

  const handleThinkingBudgetChange = useCallback((thinkingBudget: ThinkingBudget) => {
    setFormState(prev => ({
      ...prev,
      thinkingBudget,
      showThoughts: thinkingBudget === '0' ? false : prev.showThoughts,
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
      {currentModel && <p className="provider-settings__description">{currentModel.description}</p>}
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
          <label htmlFor="thinking-budget" className="provider-settings__label">
            Thinking Budget
          </label>
          <select
            id="thinking-budget"
            role="combobox"
            aria-label="Thinking budget"
            value={formState.thinkingBudget || '0'}
            onChange={e => handleThinkingBudgetChange(e.target.value as ThinkingBudget)}
            className="provider-settings__select"
          >
            {THINKING_BUDGETS.map(budget => (
              <option key={budget.value} value={budget.value}>
                {budget.label}
              </option>
            ))}
          </select>
          {THINKING_BUDGETS.map(
            budget =>
              formState.thinkingBudget === budget.value && (
                <p key={budget.value} className="provider-settings__description">
                  {budget.description}
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
              disabled={formState.thinkingBudget === '0'}
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
