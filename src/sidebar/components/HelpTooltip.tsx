import React from 'react';
import { Tooltip } from '@ui/Tooltip';
import { HelpIcon } from '@ui/Icons';

export interface HelpTooltipProps {
  /** The help content to display in the tooltip */
  content: string | React.ReactNode;
  /** Size of the help icon */
  iconSize?: number;
  /** Tooltip position relative to the icon */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** Custom CSS class for the icon button */
  className?: string;
  /** ARIA label for the help button */
  ariaLabel?: string;
  /** Whether the help tooltip is disabled */
  disabled?: boolean;
}

/**
 * HelpTooltip Component
 * 
 * A clickable help icon that displays a tooltip with helpful information.
 * Used throughout the multi-tab feature to provide contextual help.
 */
export const HelpTooltip: React.FC<HelpTooltipProps> = ({
  content,
  iconSize = 14,
  position = 'top',
  className = '',
  ariaLabel = 'Show help information',
  disabled = false,
}) => {
  return (
    <Tooltip
      content={content}
      position={position}
      disabled={disabled}
      showDelay={200}
      hideDelay={100}
      maxWidth={300}
      className="help-tooltip"
    >
      <button
        type="button"
        className={`help-tooltip__trigger ${className}`}
        aria-label={ariaLabel}
        tabIndex={0}
      >
        <HelpIcon size={iconSize} className="help-tooltip__icon" />
      </button>
    </Tooltip>
  );
};