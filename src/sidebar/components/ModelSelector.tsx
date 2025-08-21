import React, { useState, useRef, useEffect, useId } from 'react';
import { cn } from '@utils/cn';

export interface ModelSelectorProps {
  /** Current selected model value */
  value: string;
  /** Callback when model selection changes */
  onChange: (model: string) => void;
  /** Available AI models to select from */
  models?: string[];
  /** Disabled state */
  disabled?: boolean;
  /** Custom CSS class */
  className?: string;
  /** ARIA label for accessibility */
  'aria-label'?: string;
}

const DEFAULT_MODELS = ['GPT-4', 'GPT-3.5', 'Claude 3', 'Claude 2', 'Gemini Pro', 'Llama 2'];

/**
 * ModelSelector Component
 *
 * A dropdown component for selecting AI models with full keyboard navigation
 * and accessibility support.
 *
 * @example
 * ```tsx
 * <ModelSelector
 *   value="GPT-4"
 *   onChange={(model) => setSelectedModel(model)}
 *   models={['GPT-4', 'Claude 3', 'Gemini Pro']}
 *   disabled={false}
 * />
 * ```
 */
export function ModelSelector({
  value,
  onChange,
  models = DEFAULT_MODELS,
  disabled = false,
  className,
  'aria-label': ariaLabel = 'Select AI model',
}: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isFocused, setIsFocused] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const comboboxRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);
  const optionRefs = useRef<(HTMLLIElement | null)[]>([]);

  const comboboxId = useId();
  const listboxId = useId();

  // Find current value index
  const selectedIndex = models.findIndex(model => model === value);

  const handleSelectModel = React.useCallback(
    (model: string) => {
      // Only trigger onChange if the value actually changed
      if (model !== value) {
        onChange(model);
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

    // Use a small timeout to prevent the dropdown from closing immediately when opened
    const timeoutId = setTimeout(() => {
      rootNode.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
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
          setHighlightedIndex(prev => (prev < models.length - 1 ? prev + 1 : 0));
          break;

        case 'ArrowUp':
          keyboardEvent.preventDefault();
          setHighlightedIndex(prev => (prev > 0 ? prev - 1 : models.length - 1));
          break;

        case 'Enter':
          keyboardEvent.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < models.length) {
            const selectedModel = models[highlightedIndex];
            if (selectedModel) {
              handleSelectModel(selectedModel);
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
  }, [isOpen, highlightedIndex, models, disabled, handleSelectModel]);

  // Scroll highlighted option into view
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0) {
      const option = optionRefs.current[highlightedIndex];
      if (option && listboxRef.current) {
        const optionRect = option.getBoundingClientRect();
        const listRect = listboxRef.current.getBoundingClientRect();

        if (optionRect.bottom > listRect.bottom) {
          option.scrollIntoView({ block: 'end', behavior: 'smooth' });
        } else if (optionRect.top < listRect.top) {
          option.scrollIntoView({ block: 'start', behavior: 'smooth' });
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

  const handleOptionClick = (model: string, index: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setHighlightedIndex(index);
    handleSelectModel(model);
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
          'model-selector__trigger--focused': isFocused,
        })}
        onClick={e => handleToggleDropdown(e)}
        onKeyDown={handleComboboxKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        value={value}
      >
        <span className="model-selector__value">{value || 'Select model...'}</span>
      </button>

      {isOpen && (
        <ul
          ref={listboxRef}
          id={listboxId}
          role="listbox"
          aria-label="Available AI models"
          className="model-selector__dropdown"
        >
          {models.map((model, index) => (
            <li
              key={model}
              ref={el => (optionRefs.current[index] = el)}
              id={`${listboxId}-option-${index}`}
              role="option"
              aria-selected={model === value}
              className={cn('model-selector__option', {
                'model-selector__option--selected': model === value,
                'model-selector__option--highlighted': index === highlightedIndex,
              })}
              onClick={e => handleOptionClick(model, index, e)}
              onMouseEnter={() => handleOptionMouseEnter(index)}
            >
              {model}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Note: Styles for ModelSelector are now in src/sidebar/styles/sidebar.css
// This ensures they work properly within the Shadow DOM
