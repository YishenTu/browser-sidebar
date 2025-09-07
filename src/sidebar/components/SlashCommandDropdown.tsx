import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { SlashCommand } from '@/config/slashCommands';
import '../styles/4-features/slash-command-dropdown.css';

export interface SlashCommandDropdownProps {
  /** Array of slash commands to display */
  commands: SlashCommand[];
  /** Callback when a command is selected */
  onSelect: (command: SlashCommand) => void;
  /** Position object with x and y coordinates for absolute positioning */
  position: {
    x: number;
    y?: number;
    /** Optional bottom offset (preferred) to keep dropdown above the input */
    bottom?: number;
    /** Optional explicit width to match input */
    width?: number;
  };
  /** Whether the dropdown is open/visible */
  isOpen: boolean;
  /** Callback when dropdown should be closed */
  onClose: () => void;
  /** Custom CSS class */
  className?: string;
  /** Maximum number of commands to show */
  maxVisibleCommands?: number;
  /** Maximum height for the dropdown menu */
  maxHeight?: number | string;
  /** Callback when highlighted item changes (for ARIA activedescendant) */
  onHighlightChange?: (commandId: string | null) => void;
}

/**
 * SlashCommandDropdown Component
 *
 * A specialized dropdown for selecting slash commands with keyboard navigation
 * and accessibility features. Shows command name, icon, and description.
 */
export const SlashCommandDropdown: React.FC<SlashCommandDropdownProps> = memo(
  ({
    commands,
    onSelect,
    position,
    isOpen,
    onClose,
    className = '',
    maxVisibleCommands = 10,
    maxHeight = 300,
    onHighlightChange,
  }) => {
    const [highlightedIndex, setHighlightedIndex] = useState(-1); // Start with no selection
    const menuRef = useRef<HTMLUListElement>(null);
    const optionRefs = useRef<(HTMLLIElement | null)[]>([]);

    const handleSelect = useCallback(
      (command: SlashCommand) => {
        onSelect(command);
        onClose();
      },
      [onSelect, onClose]
    );

    // Close dropdown when clicking outside
    useEffect(() => {
      if (!isOpen) return;

      const handleClickOutside = (event: Event) => {
        const mouseEvent = event as MouseEvent;
        const target = mouseEvent.target as Node;

        // Check if click is outside the dropdown menu
        if (menuRef.current && !menuRef.current.contains(target)) {
          onClose();
        }
      };

      // Use Shadow DOM root or document
      const rootNode = (menuRef.current?.getRootNode() || document) as Document | ShadowRoot;
      rootNode.addEventListener('mousedown', handleClickOutside);
      return () => {
        rootNode.removeEventListener('mousedown', handleClickOutside);
      };
    }, [isOpen, onClose]);

    // Handle keyboard navigation
    useEffect(() => {
      if (!isOpen) return;

      const handleKeyDown = (event: Event) => {
        const keyboardEvent = event as KeyboardEvent;

        switch (keyboardEvent.key) {
          case 'ArrowDown':
            keyboardEvent.preventDefault();
            keyboardEvent.stopPropagation();
            setHighlightedIndex(prev => {
              if (prev === -1) return 0;
              return prev < commands.length - 1 ? prev + 1 : 0;
            });
            break;

          case 'ArrowUp':
            keyboardEvent.preventDefault();
            keyboardEvent.stopPropagation();
            setHighlightedIndex(prev => {
              if (prev === -1) return commands.length - 1;
              return prev > 0 ? prev - 1 : commands.length - 1;
            });
            break;

          case 'Enter':
            keyboardEvent.preventDefault();
            keyboardEvent.stopPropagation();
            if (highlightedIndex >= 0 && highlightedIndex < commands.length) {
              const selectedCommand = commands[highlightedIndex];
              if (selectedCommand) {
                handleSelect(selectedCommand);
              }
            }
            break;

          case 'Escape':
            keyboardEvent.preventDefault();
            keyboardEvent.stopPropagation();
            onClose();
            break;

          case 'Tab':
            keyboardEvent.preventDefault();
            keyboardEvent.stopPropagation();
            if (keyboardEvent.shiftKey) {
              // Shift+Tab: Navigate up
              setHighlightedIndex(prev => {
                if (prev === -1) return commands.length - 1;
                return prev > 0 ? prev - 1 : commands.length - 1;
              });
            } else {
              // Tab: Navigate down
              setHighlightedIndex(prev => {
                if (prev === -1) return 0;
                return prev < commands.length - 1 ? prev + 1 : 0;
              });
            }
            break;

          case 'Home':
            keyboardEvent.preventDefault();
            keyboardEvent.stopPropagation();
            setHighlightedIndex(0);
            break;

          case 'End':
            keyboardEvent.preventDefault();
            keyboardEvent.stopPropagation();
            setHighlightedIndex(commands.length - 1);
            break;

          default: {
            // Type-ahead search by command name
            const char = keyboardEvent.key.toLowerCase();
            if (char.length === 1) {
              const startIndex = highlightedIndex + 1;
              const matchIndex = commands.findIndex((_, i) => {
                const index = (startIndex + i) % commands.length;
                return commands[index]?.name.toLowerCase().startsWith(char);
              });

              if (matchIndex !== -1) {
                setHighlightedIndex((startIndex + matchIndex) % commands.length);
              }
            }
            break;
          }
        }
      };

      const rootNode = (menuRef.current?.getRootNode() || document) as Document | ShadowRoot;
      // Use capture phase to intercept events before input handlers
      rootNode.addEventListener('keydown', handleKeyDown, true);
      return () => rootNode.removeEventListener('keydown', handleKeyDown, true);
    }, [isOpen, highlightedIndex, commands, handleSelect, onClose]);

    // Scroll highlighted option into view
    useEffect(() => {
      if (isOpen && highlightedIndex >= 0) {
        const option = optionRefs.current[highlightedIndex];
        if (option && menuRef.current) {
          const optionRect = option.getBoundingClientRect();
          const containerRect = menuRef.current.getBoundingClientRect();

          if (optionRect.bottom > containerRect.bottom) {
            option.scrollIntoView({ block: 'end', behavior: 'smooth' });
          } else if (optionRect.top < containerRect.top) {
            option.scrollIntoView({ block: 'start', behavior: 'smooth' });
          }
        }
      }
    }, [highlightedIndex, isOpen]);

    // Reset highlighted index when opening
    useEffect(() => {
      if (isOpen) {
        setHighlightedIndex(-1); // Start with no selection
      }
    }, [isOpen]);

    // Notify parent of highlight changes
    useEffect(() => {
      if (onHighlightChange && isOpen && commands.length > 0) {
        const highlightedCommand = commands[highlightedIndex];
        onHighlightChange(highlightedCommand?.name || null);
      }
    }, [highlightedIndex, isOpen, commands, onHighlightChange]);

    const renderCommandOption = useCallback(
      (command: SlashCommand, index: number, isHighlighted: boolean) => {
        return (
          <li
            key={command.name}
            ref={el => (optionRefs.current[index] = el)}
            id={`slash-command-option-${command.name}`}
            role="option"
            aria-selected={isHighlighted}
            className={`slash-command-dropdown__option ${
              isHighlighted ? 'slash-command-dropdown__option--highlighted' : ''
            }`}
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              setHighlightedIndex(index);
              handleSelect(command);
            }}
            onMouseEnter={() => setHighlightedIndex(index)}
          >
            <div className="slash-command-dropdown__option-content">
              <span className="slash-command-dropdown__name">/{command.name}</span>
              <span className="slash-command-dropdown__description">{command.description}</span>
            </div>
          </li>
        );
      },
      [handleSelect]
    );

    if (!isOpen) {
      return null;
    }

    // Limit visible commands
    const visibleCommands = commands.slice(0, maxVisibleCommands);

    return (
      <div
        className={`slash-command-dropdown ${className}`}
        style={{
          position: 'fixed',
          left: `${position.x}px`,
          ...(position.bottom !== undefined
            ? { bottom: `${position.bottom}px` }
            : { top: `${position.y}px` }),
          zIndex: 2147483647,
          width: position.width ? `${position.width}px` : undefined,
        }}
      >
        <ul
          ref={menuRef}
          id="slash-command-listbox"
          role="listbox"
          aria-label="Select slash command"
          aria-activedescendant={
            highlightedIndex >= 0 && visibleCommands[highlightedIndex]
              ? `slash-command-option-${visibleCommands[highlightedIndex].name}`
              : undefined
          }
          className="slash-command-dropdown__menu"
          style={{
            position: 'relative',
            top: 'auto',
            left: 'auto',
            right: 'auto',
            maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight,
            width: position.width ? '100%' : undefined,
            minWidth: position.width ? undefined : '280px',
            maxWidth: position.width ? 'none' : '400px',
            margin: 0,
          }}
          onMouseLeave={() => setHighlightedIndex(-1)}
        >
          {visibleCommands.length === 0 ? (
            <li role="presentation" className="slash-command-dropdown__empty">
              No commands found. Type to search.
            </li>
          ) : (
            visibleCommands.map((command, index) =>
              renderCommandOption(command, index, index === highlightedIndex)
            )
          )}
        </ul>
      </div>
    );
  }
);

SlashCommandDropdown.displayName = 'SlashCommandDropdown';

export default SlashCommandDropdown;
