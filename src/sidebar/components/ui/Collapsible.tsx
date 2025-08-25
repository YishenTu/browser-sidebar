import React, { useState, useEffect } from 'react';
import { ChevronDownIcon, ChevronRightIcon } from './Icons';

export interface CollapsibleProps {
  /** Header content or render function */
  header: React.ReactNode | ((isCollapsed: boolean) => React.ReactNode);
  /** Main content */
  children: React.ReactNode;
  /** Whether initially collapsed */
  initialCollapsed?: boolean;
  /** Custom class for the container */
  className?: string;
  /** Custom class for the header */
  headerClassName?: string;
  /** Custom class for the content */
  contentClassName?: string;
  /** Whether to show chevron icon */
  showChevron?: boolean;
  /** Position of chevron icon */
  chevronPosition?: 'left' | 'right';
  /** Callback when collapsed state changes */
  onToggle?: (collapsed: boolean) => void;
  /** Whether the collapsible is controlled */
  collapsed?: boolean;
  /** Auto-collapse after a delay (in ms) */
  autoCollapseDelay?: number;
}

/**
 * Collapsible Component
 *
 * A reusable component for expandable/collapsible content sections.
 * Can be used in controlled or uncontrolled mode.
 */
export const Collapsible: React.FC<CollapsibleProps> = ({
  header,
  children,
  initialCollapsed = false,
  className = '',
  headerClassName = '',
  contentClassName = '',
  showChevron = true,
  chevronPosition = 'left',
  onToggle,
  collapsed: controlledCollapsed,
  autoCollapseDelay,
}) => {
  const [internalCollapsed, setInternalCollapsed] = useState(initialCollapsed);
  const isControlled = controlledCollapsed !== undefined;
  const isCollapsed = isControlled ? controlledCollapsed : internalCollapsed;

  useEffect(() => {
    if (autoCollapseDelay && !isCollapsed) {
      const timer = setTimeout(() => {
        if (isControlled) {
          onToggle?.(true);
        } else {
          setInternalCollapsed(true);
          onToggle?.(true);
        }
      }, autoCollapseDelay);

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [autoCollapseDelay, isCollapsed, isControlled, onToggle]);

  const handleToggle = () => {
    const newState = !isCollapsed;

    if (!isControlled) {
      setInternalCollapsed(newState);
    }

    onToggle?.(newState);
  };

  const renderHeader = () => {
    if (typeof header === 'function') {
      return header(isCollapsed);
    }
    return header;
  };

  const chevronIcon = isCollapsed ? (
    <ChevronRightIcon size={16} className="collapsible-chevron" />
  ) : (
    <ChevronDownIcon size={16} className="collapsible-chevron" />
  );

  return (
    <div className={`collapsible ${className} ${isCollapsed ? 'collapsed' : 'expanded'}`}>
      <button
        onClick={handleToggle}
        className={`collapsible-header ${headerClassName}`}
        aria-expanded={!isCollapsed}
        aria-label={isCollapsed ? 'Expand section' : 'Collapse section'}
      >
        {showChevron && chevronPosition === 'left' && chevronIcon}
        <span className="collapsible-header-content">{renderHeader()}</span>
        {showChevron && chevronPosition === 'right' && chevronIcon}
      </button>

      <div
        className={`collapsible-content ${contentClassName}`}
        style={{ display: isCollapsed ? 'none' : 'block' }}
      >
        {children}
      </div>
    </div>
  );
};

export default Collapsible;
