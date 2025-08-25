import React, { useState, useRef, useEffect, useId, useMemo, useCallback } from 'react';

export interface DropdownOption {
  /** Unique identifier for the option */
  value: string;
  /** Display label for the option */
  label: string;
  /** Optional icon or element to display */
  icon?: React.ReactNode;
  /** Whether the option is disabled */
  disabled?: boolean;
  /** Optional description */
  description?: string;
}

export interface DropdownGroup {
  /** Group label */
  label: string;
  /** Options in this group */
  options: DropdownOption[];
}

export interface DropdownProps {
  /** Current selected value */
  value?: string;
  /** Callback when selection changes */
  onChange: (value: string) => void;
  /** List of options or grouped options */
  options?: DropdownOption[];
  /** Grouped options (alternative to flat options) */
  groups?: DropdownGroup[];
  /** Placeholder text when no value selected */
  placeholder?: string;
  /** Whether the dropdown is disabled */
  disabled?: boolean;
  /** Custom CSS class */
  className?: string;
  /** Custom CSS class for the trigger button */
  triggerClassName?: string;
  /** Custom CSS class for the dropdown menu */
  menuClassName?: string;
  /** ARIA label for accessibility */
  'aria-label'?: string;
  /** Custom render function for the trigger */
  renderTrigger?: (
    value: string | undefined,
    option: DropdownOption | undefined,
    isOpen: boolean
  ) => React.ReactNode;
  /** Custom render function for options */
  renderOption?: (
    option: DropdownOption,
    isSelected: boolean,
    isHighlighted: boolean
  ) => React.ReactNode;
  /** Whether to close on selection */
  closeOnSelect?: boolean;
  /** Maximum height for the dropdown menu */
  maxHeight?: number | string;
}

/**
 * Dropdown Component
 *
 * A reusable dropdown component with full keyboard navigation and accessibility support.
 * Can be used with flat options or grouped options.
 */
export const Dropdown: React.FC<DropdownProps> = ({
  value,
  onChange,
  options = [],
  groups = [],
  placeholder = 'Select...',
  disabled = false,
  className = '',
  triggerClassName = '',
  menuClassName = '',
  'aria-label': ariaLabel = 'Select option',
  renderTrigger,
  renderOption,
  closeOnSelect = true,
  maxHeight = 300,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  // Flatten all options for keyboard navigation
  const flatOptions = useMemo(() => {
    if (groups.length > 0) {
      return groups.flatMap(group => group.options);
    }
    return options;
  }, [options, groups]);

  // Find selected option
  const selectedOption = flatOptions.find(opt => opt.value === value);
  const selectedIndex = flatOptions.findIndex(opt => opt.value === value);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const optionRefs = useRef<(HTMLLIElement | null)[]>([]);

  const triggerId = useId();
  const menuId = useId();

  const handleSelect = useCallback(
    (optionValue: string) => {
      const option = flatOptions.find(opt => opt.value === optionValue);
      if (option && !option.disabled && optionValue !== value) {
        onChange(optionValue);
      }

      if (closeOnSelect) {
        setIsOpen(false);
        setHighlightedIndex(-1);
        triggerRef.current?.focus();
      }
    },
    [onChange, value, flatOptions, closeOnSelect]
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: Event) => {
      const mouseEvent = event as MouseEvent;
      if (containerRef.current && !containerRef.current.contains(mouseEvent.target as Node)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };

    const rootNode = (containerRef.current?.getRootNode() || document) as Document | ShadowRoot;
    rootNode.addEventListener('mousedown', handleClickOutside);
    return () => {
      rootNode.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen || disabled) return;

    const handleKeyDown = (event: Event) => {
      const keyboardEvent = event as KeyboardEvent;
      switch (keyboardEvent.key) {
        case 'ArrowDown':
          keyboardEvent.preventDefault();
          setHighlightedIndex(prev => {
            let next = prev < flatOptions.length - 1 ? prev + 1 : 0;
            // Skip disabled options
            while (flatOptions[next]?.disabled && next < flatOptions.length - 1) {
              next++;
            }
            return next;
          });
          break;

        case 'ArrowUp':
          keyboardEvent.preventDefault();
          setHighlightedIndex(prev => {
            let next = prev > 0 ? prev - 1 : flatOptions.length - 1;
            // Skip disabled options
            while (flatOptions[next]?.disabled && next > 0) {
              next--;
            }
            return next;
          });
          break;

        case 'Enter':
          keyboardEvent.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < flatOptions.length) {
            const option = flatOptions[highlightedIndex];
            if (option && !option.disabled) {
              handleSelect(option.value);
            }
          }
          break;

        case 'Escape':
          keyboardEvent.preventDefault();
          setIsOpen(false);
          setHighlightedIndex(-1);
          triggerRef.current?.focus();
          break;

        case 'Tab':
          setIsOpen(false);
          setHighlightedIndex(-1);
          break;

        case 'Home':
          keyboardEvent.preventDefault();
          setHighlightedIndex(0);
          break;

        case 'End':
          keyboardEvent.preventDefault();
          setHighlightedIndex(flatOptions.length - 1);
          break;

        default: {
          // Type-ahead search
          const char = keyboardEvent.key.toLowerCase();
          if (char.length === 1) {
            const startIndex = highlightedIndex + 1;
            const matchIndex = flatOptions.findIndex((_, i) => {
              const index = (startIndex + i) % flatOptions.length;
              return (
                flatOptions[index]?.label.toLowerCase().startsWith(char) &&
                !flatOptions[index]?.disabled
              );
            });

            if (matchIndex !== -1) {
              setHighlightedIndex((startIndex + matchIndex) % flatOptions.length);
            }
          }
          break;
        }
      }
    };

    const rootNode = (containerRef.current?.getRootNode() || document) as Document | ShadowRoot;
    rootNode.addEventListener('keydown', handleKeyDown);
    return () => rootNode.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, highlightedIndex, disabled, handleSelect, flatOptions]);

  // Scroll highlighted option into view
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0) {
      const option = optionRefs.current[highlightedIndex];
      if (option && menuRef.current) {
        const optionRect = option.getBoundingClientRect();
        const menuRect = menuRef.current.getBoundingClientRect();

        if (optionRect.bottom > menuRect.bottom) {
          option.scrollIntoView({ block: 'end', behavior: 'smooth' });
        } else if (optionRect.top < menuRect.top) {
          option.scrollIntoView({ block: 'start', behavior: 'smooth' });
        }
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleToggle = (e: React.MouseEvent) => {
    if (disabled) return;

    e.preventDefault();
    e.stopPropagation();

    setIsOpen(prev => !prev);
    if (!isOpen) {
      setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
    } else {
      setHighlightedIndex(-1);
    }
  };

  const handleTriggerKeyDown = (event: React.KeyboardEvent) => {
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

  const renderDefaultTrigger = () => {
    if (renderTrigger) {
      return renderTrigger(value, selectedOption, isOpen);
    }

    return (
      <>
        <span className="dropdown__value">
          {selectedOption ? (
            <>
              {selectedOption.icon && (
                <span className="dropdown__value-icon">{selectedOption.icon}</span>
              )}
              {selectedOption.label}
            </>
          ) : (
            placeholder
          )}
        </span>
      </>
    );
  };

  const renderDefaultOption = (
    option: DropdownOption,
    isSelected: boolean,
    isHighlighted: boolean
  ) => {
    if (renderOption) {
      return renderOption(option, isSelected, isHighlighted);
    }

    return (
      <div className="dropdown__option-content">
        {option.icon && <span className="dropdown__option-icon">{option.icon}</span>}
        <div className="dropdown__option-text">
          <div className="dropdown__option-label">{option.label}</div>
          {option.description && (
            <div className="dropdown__option-description">{option.description}</div>
          )}
        </div>
      </div>
    );
  };

  const renderOptions = () => {
    if (groups.length > 0) {
      return groups.map((group, groupIndex) => (
        <React.Fragment key={group.label}>
          {groupIndex > 0 && <li className="dropdown__divider" role="separator" />}
          <li className="dropdown__group-header" role="presentation">
            {group.label}
          </li>
          {group.options.map(option => {
            const index = flatOptions.findIndex(opt => opt.value === option.value);
            const isSelected = option.value === value;
            const isHighlighted = index === highlightedIndex;

            return (
              <li
                key={option.value}
                ref={el => (optionRefs.current[index] = el)}
                id={`${menuId}-option-${index}`}
                role="option"
                aria-selected={isSelected}
                aria-disabled={option.disabled}
                className={`dropdown__option ${isSelected ? 'dropdown__option--selected' : ''} ${isHighlighted ? 'dropdown__option--highlighted' : ''} ${option.disabled ? 'dropdown__option--disabled' : ''}`}
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!option.disabled) {
                    setHighlightedIndex(index);
                    handleSelect(option.value);
                  }
                }}
                onMouseEnter={() => !option.disabled && setHighlightedIndex(index)}
              >
                {renderDefaultOption(option, isSelected, isHighlighted)}
              </li>
            );
          })}
        </React.Fragment>
      ));
    }

    return flatOptions.map((option, index) => {
      const isSelected = option.value === value;
      const isHighlighted = index === highlightedIndex;

      return (
        <li
          key={option.value}
          ref={el => (optionRefs.current[index] = el)}
          id={`${menuId}-option-${index}`}
          role="option"
          aria-selected={isSelected}
          aria-disabled={option.disabled}
          className={`dropdown__option ${isSelected ? 'dropdown__option--selected' : ''} ${isHighlighted ? 'dropdown__option--highlighted' : ''} ${option.disabled ? 'dropdown__option--disabled' : ''}`}
          onClick={e => {
            e.preventDefault();
            e.stopPropagation();
            if (!option.disabled) {
              setHighlightedIndex(index);
              handleSelect(option.value);
            }
          }}
          onMouseEnter={() => !option.disabled && setHighlightedIndex(index)}
        >
          {renderDefaultOption(option, isSelected, isHighlighted)}
        </li>
      );
    });
  };

  return (
    <div ref={containerRef} className={`dropdown ${className}`}>
      <button
        ref={triggerRef}
        id={triggerId}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={menuId}
        aria-label={ariaLabel}
        aria-activedescendant={
          isOpen && highlightedIndex >= 0 ? `${menuId}-option-${highlightedIndex}` : undefined
        }
        disabled={disabled}
        className={`dropdown__trigger ${triggerClassName} ${isOpen ? 'dropdown__trigger--open' : ''} ${disabled ? 'dropdown__trigger--disabled' : ''}`}
        onClick={handleToggle}
        onKeyDown={handleTriggerKeyDown}
      >
        {renderDefaultTrigger()}
      </button>

      {isOpen && (
        <ul
          ref={menuRef}
          id={menuId}
          role="listbox"
          aria-label={ariaLabel}
          className={`dropdown__menu ${menuClassName}`}
          style={{ maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight }}
        >
          {renderOptions()}
        </ul>
      )}
    </div>
  );
};

export default Dropdown;
