import { useEffect, useMemo, useState } from 'react';
import { Dropdown, DropdownGroup } from '@ui/Dropdown';
import {
  getModelsByProvider,
  getModelsByProviderId,
  getDefaultModelForProvider,
} from '../../config/models';
import { useSettingsStore } from '@/data/store/settings';
import { listOpenAICompatProviders } from '@/data/storage/keys/compat';

export interface ModelSelectorProps {
  /** Current selected model ID */
  value: string;
  /** Callback when model selection changes */
  onChange: (modelId: string) => void;
  /** Disabled state */
  disabled?: boolean;
  /** Custom CSS class */
  className?: string;
  /** ARIA label for accessibility */
  'aria-label'?: string;
}

/**
 * ModelSelector Component
 *
 * A dropdown component for selecting AI models with full keyboard navigation
 * and accessibility support.
 *
 * @example
 * ```tsx
 * <ModelSelector
 *   value="gpt-5-nano"
 *   onChange={(modelId) => setSelectedModel(modelId)}
 *   disabled={false}
 * />
 * ```
 */
export function ModelSelector({
  value,
  onChange,
  disabled = false,
  className,
  'aria-label': ariaLabel = 'Select AI model',
}: ModelSelectorProps) {
  // Get API keys from settings store
  const apiKeys = useSettingsStore(state => state.settings.apiKeys);
  const availableModels = useSettingsStore(state => state.settings.availableModels);

  // Load OpenAI-compatible providers that have stored keys
  const [compatProviders, setCompatProviders] = useState<
    Array<{ id: string; name: string; baseURL: string; model?: { id: string; name: string } }>
  >([]);

  // Reload compat providers whenever availableModels or apiKeys change
  // This ensures we pick up newly saved providers (both standard and compat)
  useEffect(() => {
    let cancelled = false;

    const loadCompatProviders = async () => {
      try {
        const providers = await listOpenAICompatProviders();
        if (!cancelled) {
          setCompatProviders(
            providers.map(p => ({ id: p.id, name: p.name, baseURL: p.baseURL, model: p.model }))
          );
        }
      } catch (error) {
        console.error('Failed to load compat providers:', error);
        if (!cancelled) setCompatProviders([]);
      }
    };

    // Always reload compat providers when settings change
    loadCompatProviders();

    return () => {
      cancelled = true;
    };
  }, [availableModels, apiKeys]); // Watch both for changes

  // Check if selected model's provider has an API key
  // Keep legacy helper available if needed for future validation
  // const providerType = getProviderTypeForModelId(value);

  // Group models by provider for the dropdown
  const dropdownGroups = useMemo<DropdownGroup[]>(() => {
    const groups: DropdownGroup[] = [];

    // Core providers: only include if a key exists
    if (apiKeys?.openai) {
      const openaiModels = getModelsByProvider('openai');
      if (openaiModels.length > 0) {
        groups.push({
          label: 'OpenAI',
          options: openaiModels.map(model => ({ value: model.id, label: model.name })),
        });
      }
    }

    if (apiKeys?.google) {
      const geminiModels = getModelsByProvider('gemini');
      if (geminiModels.length > 0) {
        groups.push({
          label: 'Google Gemini',
          options: geminiModels.map(model => ({ value: model.id, label: model.name })),
        });
      }
    }

    if (apiKeys?.openrouter) {
      const openrouterModels = getModelsByProvider('openrouter');
      if (openrouterModels.length > 0) {
        groups.push({
          label: 'OpenRouter',
          options: openrouterModels.map(model => ({ value: model.id, label: model.name })),
        });
      }
    }

    // OpenAI-compatible providers (built-in or custom) loaded from storage
    for (const p of compatProviders) {
      // Try built-in model list first (from config)
      const presetModels = getModelsByProviderId(p.id);
      let options: { value: string; label: string }[] = [];
      if (presetModels.length > 0) {
        options = presetModels.map(m => ({ value: m.id, label: m.name }));
      } else if (p.model) {
        // Custom provider with a single model stored
        options = [{ value: p.model.id, label: p.model.name }];
      }

      if (options.length > 0) {
        groups.push({ label: p.name, options });
      }
    }

    return groups;
  }, [apiKeys?.openai, apiKeys?.google, apiKeys?.openrouter, compatProviders]);

  // Determine if the currently selected value belongs to any available option
  const selectedInGroups = useMemo(() => {
    return dropdownGroups.some(g => g.options.some(o => o.value === value));
  }, [dropdownGroups, value]);

  // Check if ANY API keys exist (standard or compat)
  const hasAnyApiKey = useMemo(() => {
    const hasStandardKey = !!(apiKeys?.openai || apiKeys?.google || apiKeys?.openrouter);
    const hasCompatKey = compatProviders.length > 0;
    return hasStandardKey || hasCompatKey;
  }, [apiKeys, compatProviders]);

  // Auto-select a sensible default model when keys exist but the current selection
  // is not available (e.g., user just added a compat key while default model is OpenAI).
  useEffect(() => {
    // Only act when there is at least one available option and the current value
    // is not present among options.
    if (!hasAnyApiKey || selectedInGroups) return;

    // Try standard providers first, in order of likelihood
    if (apiKeys?.openai) {
      const id = getDefaultModelForProvider('openai');
      if (id) {
        onChange(id);
        return;
      }
    }
    if (apiKeys?.google) {
      const id = getDefaultModelForProvider('gemini');
      if (id) {
        onChange(id);
        return;
      }
    }
    if (apiKeys?.openrouter) {
      const id = getDefaultModelForProvider('openrouter');
      if (id) {
        onChange(id);
        return;
      }
    }

    // Otherwise, pick the first compat provider's default/built-in model
    // Prefer a built-in preset's default if available
    const firstCompat = compatProviders[0];
    if (firstCompat) {
      // Built-in compat providers have predefined models in config
      const presetDefault = getDefaultModelForProvider(firstCompat.id);
      if (presetDefault) {
        onChange(presetDefault);
        return;
      }
      // Custom provider: use its stored default model if present
      if (firstCompat.model?.id) {
        onChange(firstCompat.model.id);
        return;
      }
      // Fallback: first model from config group (if any)
      const presetModels = getModelsByProviderId(firstCompat.id);
      if (presetModels.length > 0) {
        const firstModel = presetModels[0];
        if (firstModel) {
          onChange(firstModel.id);
          return;
        }
      }
    }
  }, [
    hasAnyApiKey,
    selectedInGroups,
    apiKeys?.openai,
    apiKeys?.google,
    apiKeys?.openrouter,
    compatProviders,
    onChange,
  ]);

  // Custom render for trigger to show "Add API KEY" when no key is set
  const renderTrigger = (
    selectedValue: string | undefined,
    selectedOption: { label: string; value: string } | undefined
  ) => {
    // Only show "Add API KEY" if there are NO keys at all
    if (!hasAnyApiKey) {
      return <span className="dropdown__value dropdown__value--no-key">Add API KEY</span>;
    }

    // If we have keys but the current selection isn't available, prompt selection
    if (!selectedInGroups && selectedValue) {
      return <span className="dropdown__value">Select model...</span>;
    }

    // Default rendering for when API key exists
    return (
      <span className="dropdown__value">
        {selectedOption ? selectedOption.label : 'Select model...'}
      </span>
    );
  };

  return (
    <Dropdown
      value={value}
      onChange={onChange}
      groups={dropdownGroups}
      placeholder="Select model..."
      disabled={disabled}
      className={`model-selector ${className || ''}`}
      triggerClassName="model-selector__trigger"
      menuClassName="model-selector__dropdown"
      aria-label={ariaLabel}
      renderTrigger={renderTrigger}
    />
  );
}
