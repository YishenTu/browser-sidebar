import { useEffect, useMemo } from 'react';
import { Dropdown, DropdownGroup } from '@ui/Dropdown';
import { useSettingsStore } from '@/data/store/settings';

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
  const availableModels = useSettingsStore(state => state.settings.availableModels);

  // Check if selected model's provider has an API key
  // Keep legacy helper available if needed for future validation
  // const providerType = getProviderTypeForModelId(value);

  // Group models by provider for the dropdown
  const dropdownGroups = useMemo<DropdownGroup[]>(() => {
    if (!availableModels || availableModels.length === 0) return [];

    // Group by provider id/name
    const labelFor = (p: string) => {
      switch (p) {
        case 'openai':
          return 'OpenAI';
        case 'gemini':
          return 'Google Gemini';
        case 'openrouter':
          return 'OpenRouter';
        case 'deepseek':
          return 'DeepSeek';
        case 'qwen':
          return 'Qwen';
        case 'zhipu':
          return 'Zhipu';
        case 'kimi':
          return 'Kimi';
        default:
          return p;
      }
    };

    const order = (p: string) => {
      if (p === 'openai') return 0;
      if (p === 'gemini') return 1;
      if (p === 'openrouter') return 2;
      return 3;
    };

    const grouped = new Map<string, { value: string; label: string }[]>();
    for (const m of availableModels) {
      const key = m.provider;
      const arr = grouped.get(key) || [];
      arr.push({ value: m.id, label: m.name });
      grouped.set(key, arr);
    }

    return Array.from(grouped.entries())
      .sort((a, b) => order(a[0]) - order(b[0]) || labelFor(a[0]).localeCompare(labelFor(b[0])))
      .map(([provider, options]) => ({ label: labelFor(provider), options }));
  }, [availableModels]);

  // Determine if the currently selected value belongs to any available option
  const selectedInGroups = useMemo(() => {
    return dropdownGroups.some(g => g.options.some(o => o.value === value));
  }, [dropdownGroups, value]);

  // Check if ANY API keys exist (standard or compat)
  const hasAnyApiKey = useMemo(() => availableModels.length > 0, [availableModels]);

  // Auto-select a sensible default model when keys exist but the current selection
  // is not available (e.g., user just added a compat key while default model is OpenAI).
  useEffect(() => {
    // Only act when there is at least one available option and the current value
    // is not present among options.
    if (!hasAnyApiKey || selectedInGroups) return;

    // Pick the first available model as a sane default
    if (availableModels.length > 0 && availableModels[0]) {
      onChange(availableModels[0].id);
      return;
    }
  }, [hasAnyApiKey, selectedInGroups, availableModels, onChange]);

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
