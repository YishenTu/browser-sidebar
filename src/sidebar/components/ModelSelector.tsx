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
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
    return undefined;
  }, [isOpen]);

  // Handle keyboard navigation
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!isOpen || disabled) return;

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setHighlightedIndex(prev => (prev < models.length - 1 ? prev + 1 : 0));
          break;

        case 'ArrowUp':
          event.preventDefault();
          setHighlightedIndex(prev => (prev > 0 ? prev - 1 : models.length - 1));
          break;

        case 'Enter':
          event.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < models.length) {
            const selectedModel = models[highlightedIndex];
            if (selectedModel) {
              handleSelectModel(selectedModel);
            }
          }
          break;

        case 'Escape':
          event.preventDefault();
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
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
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

  const handleToggleDropdown = () => {
    if (disabled) return;

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

  const handleOptionClick = (model: string, index: number) => {
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
        onClick={handleToggleDropdown}
        onKeyDown={handleComboboxKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        value={value}
      >
        <span className="model-selector__value">{value || 'Select model...'}</span>
        <span
          className={cn('model-selector__icon', isOpen && 'model-selector__icon--rotated')}
          aria-hidden="true"
        >
          ▼
        </span>
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
              onClick={() => handleOptionClick(model, index)}
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

// CSS-in-JS styles using CSS variables
const modelSelectorStyles = `
.model-selector {
  position: relative;
  width: 100%;
  font-family: inherit;
}

.model-selector--header {
  width: 140px;
  margin-right: 8px;
  flex-shrink: 0;
}

.model-selector__trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--background-primary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: var(--transition-fast);
  min-height: 40px;
}

.model-selector__trigger:hover:not(:disabled) {
  border-color: var(--border-hover);
  background: var(--background-hover);
}

.model-selector__trigger:focus {
  outline: none;
  border-color: var(--primary-500);
  box-shadow: 0 0 0 2px var(--primary-100);
}

.model-selector__trigger--open {
  border-color: var(--primary-500);
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
}

.model-selector__trigger--disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background: var(--background-disabled);
}

.model-selector__value {
  flex: 1;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-selector__icon {
  margin-left: var(--spacing-sm);
  transition: var(--transition-fast);
  font-size: 10px;
  color: var(--text-muted);
}

.model-selector__icon--rotated {
  transform: rotate(180deg);
}

.model-selector__dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: var(--background-primary);
  border: 1px solid var(--primary-500);
  border-top: none;
  border-radius: 0 0 var(--radius-md) var(--radius-md);
  box-shadow: var(--shadow-lg);
  z-index: 1000;
  max-height: 200px;
  overflow-y: auto;
  list-style: none;
  margin: 0;
  padding: 0;
}

.model-selector__option {
  padding: var(--spacing-sm) var(--spacing-md);
  cursor: pointer;
  transition: var(--transition-fast);
  color: var(--text-primary);
  font-size: var(--font-size-sm);
}

.model-selector__option:hover,
.model-selector__option--highlighted {
  background: var(--background-hover);
}

.model-selector__option--selected {
  background: var(--primary-50);
  color: var(--primary-700);
  font-weight: var(--font-weight-medium);
}

.model-selector__option--selected.model-selector__option--highlighted {
  background: var(--primary-100);
}
`;

// Inject styles when component is first imported
if (typeof document !== 'undefined') {
  const styleId = 'model-selector-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = modelSelectorStyles;
    document.head.appendChild(style);
  }
}
