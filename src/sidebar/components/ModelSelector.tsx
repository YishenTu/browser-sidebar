import React, { useState, useRef, useEffect, useId, useMemo } from 'react';
import { cn } from '@utils/cn';
import { getModelsByProvider } from '../../config/models';

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
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  
  // Group models by provider
  const groupedModels = useMemo(() => {
    const openaiModels = getModelsByProvider('openai');
    const geminiModels = getModelsByProvider('gemini');
    return [
      { provider: 'OpenAI', models: openaiModels },
      { provider: 'Google Gemini', models: geminiModels },
    ].filter(group => group.models.length > 0);
  }, []);
  
  // Flatten models for keyboard navigation
  const flatModels = useMemo(() => {
    return groupedModels.flatMap(group => group.models);
  }, [groupedModels]);

  const containerRef = useRef<HTMLDivElement>(null);
  const comboboxRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);
  const optionRefs = useRef<(HTMLLIElement | null)[]>([]);

  const comboboxId = useId();
  const listboxId = useId();

  // Find current value index by model ID
  const selectedIndex = flatModels.findIndex(model => model.id === value);
  const selectedModel = flatModels.find(model => model.id === value);

  const handleSelectModel = React.useCallback(
    (modelId: string) => {
      // Only trigger onChange if the value actually changed
      if (modelId !== value) {
        onChange(modelId);
      }
      setIsOpen(false);
      setHighlightedIndex(-1);
      comboboxRef.current?.focus();
    },
    [onChange, value]
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return undefined;

    function handleClickOutside(event: Event) {
      const mouseEvent = event as MouseEvent;
      if (containerRef.current && !containerRef.current.contains(mouseEvent.target as Node)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    }

    // Get the root node (shadow root or document) where this component is mounted
    const rootNode = (containerRef.current?.getRootNode() || document) as Document | ShadowRoot;

    rootNode.addEventListener('mousedown', handleClickOutside);
    return () => {
      rootNode.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle keyboard navigation
  useEffect(() => {
    function handleKeyDown(event: Event) {
      const keyboardEvent = event as KeyboardEvent;
      if (!isOpen || disabled) return;

      switch (keyboardEvent.key) {
        case 'ArrowDown':
          keyboardEvent.preventDefault();
          setHighlightedIndex(prev => (prev < flatModels.length - 1 ? prev + 1 : 0));
          break;

        case 'ArrowUp':
          keyboardEvent.preventDefault();
          setHighlightedIndex(prev => (prev > 0 ? prev - 1 : flatModels.length - 1));
          break;

        case 'Enter':
          keyboardEvent.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < flatModels.length) {
            const model = flatModels[highlightedIndex];
            if (model) {
              handleSelectModel(model.id);
            }
          }
          break;

        case 'Escape':
          keyboardEvent.preventDefault();
          setIsOpen(false);
          setHighlightedIndex(-1);
          comboboxRef.current?.focus();
          break;

        case 'Tab':
          setIsOpen(false);
          setHighlightedIndex(-1);
          break;

        default:
          // No action for other keys
          break;
      }
    }

    if (isOpen) {
      // Get the root node (shadow root or document) where this component is mounted
      const rootNode = (containerRef.current?.getRootNode() || document) as Document | ShadowRoot;
      rootNode.addEventListener('keydown', handleKeyDown);
      return () => rootNode.removeEventListener('keydown', handleKeyDown);
    }
    return undefined;
  }, [isOpen, highlightedIndex, disabled, handleSelectModel, flatModels]);

  // Scroll highlighted option into view
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0) {
      const option = optionRefs.current[highlightedIndex];
      if (option && listboxRef.current) {
        const optionRect = option.getBoundingClientRect();
        const listRect = listboxRef.current.getBoundingClientRect();

        if (optionRect.bottom > listRect.bottom) {
          option.scrollIntoView({ block: 'end' });
        } else if (optionRect.top < listRect.top) {
          option.scrollIntoView({ block: 'start' });
        }
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleToggleDropdown = (e: React.MouseEvent) => {
    if (disabled) return;

    e.preventDefault();
    e.stopPropagation();

    setIsOpen(prev => !prev);
    if (!isOpen) {
      // When opening, highlight current selection
      setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
    } else {
      setHighlightedIndex(-1);
    }
  };

  const handleComboboxKeyDown = (event: React.KeyboardEvent) => {
    if (disabled) return;

    switch (event.key) {
      case 'Enter':
      case ' ':
      case 'ArrowDown':
      case 'ArrowUp':
        event.preventDefault();
        setIsOpen(true);
        setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
        break;
    }
  };

  const handleFocus = () => {
    comboboxRef.current?.classList.add('model-selector__trigger--focused');
  };

  const handleBlur = () => {
    comboboxRef.current?.classList.remove('model-selector__trigger--focused');
  };

  const handleOptionClick = (modelId: string, index: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setHighlightedIndex(index);
    handleSelectModel(modelId);
  };

  const handleOptionMouseEnter = (index: number) => {
    setHighlightedIndex(index);
  };

  return (
    <div ref={containerRef} className={cn('model-selector', className)}>
      <button
        ref={comboboxRef}
        id={comboboxId}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-label={ariaLabel}
        aria-activedescendant={
          isOpen && highlightedIndex >= 0 ? `${listboxId}-option-${highlightedIndex}` : undefined
        }
        disabled={disabled}
        className={cn('model-selector__trigger', {
          'model-selector__trigger--open': isOpen,
          'model-selector__trigger--disabled': disabled,
          'model-selector__trigger--focused':
            typeof document !== 'undefined' && document.activeElement === comboboxRef.current,
        })}
        onClick={e => handleToggleDropdown(e)}
        onKeyDown={handleComboboxKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        value={value}
        style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
      >
        <span className="model-selector__value">{selectedModel?.name || 'Select model...'}</span>
        <span
          className={cn('model-selector__icon', {
            'model-selector__icon--rotated': isOpen,
          })}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <ul
          ref={listboxRef}
          id={listboxId}
          role="listbox"
          aria-label="Available AI models"
          className="model-selector__dropdown"
        >
          {groupedModels.map((group, groupIndex) => (
            <React.Fragment key={group.provider}>
              {groupIndex > 0 && <li className="model-selector__divider" role="separator" />}
              <li className="model-selector__group-header" role="presentation">
                {group.provider}
              </li>
              {group.models.map((model) => {
                const index = flatModels.findIndex(m => m.id === model.id);
                return (
                  <li
                    key={model.id}
                    ref={el => (optionRefs.current[index] = el)}
                    id={`${listboxId}-option-${index}`}
                    role="option"
                    aria-selected={model.id === value}
                    className={cn('model-selector__option', {
                      'model-selector__option--selected': model.id === value,
                      'model-selector__option--highlighted': index === highlightedIndex,
                    })}
                    onClick={e => handleOptionClick(model.id, index, e)}
                    onMouseEnter={() => handleOptionMouseEnter(index)}
                  >
                    <div className="model-selector__option-content">
                      <div className="model-selector__option-name">{model.name}</div>
                    </div>
                  </li>
                );
              })}
            </React.Fragment>
          ))}
        </ul>
      )}
    </div>
  );
}

// Note: Styles for ModelSelector are now in src/sidebar/styles/sidebar.css
// This ensures they work properly within the Shadow DOM
