import { useMemo } from 'react';
import { Dropdown, DropdownGroup } from '@ui/Dropdown';
import { getModelsByProvider, getProviderTypeForModelId } from '../../config/models';
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
  // Get API keys from settings store
  const apiKeys = useSettingsStore(state => state.settings.apiKeys);

  // Check if selected model's provider has an API key
  const providerType = getProviderTypeForModelId(value);
  const hasApiKey = useMemo(() => {
    if (providerType === 'openai') {
      return !!apiKeys?.openai;
    } else if (providerType === 'gemini') {
      return !!apiKeys?.google;
    }
    return false;
  }, [providerType, apiKeys]);

  // Group models by provider for the dropdown
  const dropdownGroups = useMemo<DropdownGroup[]>(() => {
    const openaiModels = getModelsByProvider('openai');
    const geminiModels = getModelsByProvider('gemini');

    const groups: DropdownGroup[] = [];

    if (openaiModels.length > 0) {
      groups.push({
        label: 'OpenAI',
        options: openaiModels.map(model => ({
          value: model.id,
          label: model.name,
        })),
      });
    }

    if (geminiModels.length > 0) {
      groups.push({
        label: 'Google Gemini',
        options: geminiModels.map(model => ({
          value: model.id,
          label: model.name,
        })),
      });
    }

    return groups;
  }, []);

  // Custom render for trigger to show "Add API KEY" when no key is set
  const renderTrigger = (
    selectedValue: string | undefined,
    selectedOption: { label: string; value: string } | undefined
  ) => {
    if (!hasApiKey && selectedValue) {
      return <span className="dropdown__value dropdown__value--no-key">Add API KEY</span>;
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
