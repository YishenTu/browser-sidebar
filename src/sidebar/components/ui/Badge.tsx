import React from 'react';

export type BadgeVariant = 'default' | 'warning' | 'error' | 'success' | 'info';
export type BadgeSize = 'small' | 'medium' | 'large';

export interface BadgeProps {
  /** Badge content */
  children: React.ReactNode;
  /** Visual variant */
  variant?: BadgeVariant;
  /** Size of the badge */
  size?: BadgeSize;
  /** Whether the badge should be displayed as a pill (rounded) */
  pill?: boolean;
  /** Custom CSS class */
  className?: string;
  /** Maximum value to display (e.g., "99+") */
  max?: number;
  /** Whether to show the badge */
  show?: boolean;
}

/**
 * Badge Component
 *
 * A reusable badge/counter component for displaying counts, statuses, or labels.
 */
export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'medium',
  pill = false,
  className = '',
  max,
  show = true,
}) => {
  if (!show) return null;

  const formatContent = () => {
    if (typeof children === 'number' && max && children > max) {
      return `${max}+`;
    }
    return children;
  };

  return (
    <span
      className={`badge badge--${variant} badge--${size} ${pill ? 'badge--pill' : ''} ${className}`}
    >
      {formatContent()}
    </span>
  );
};

/**
 * CharacterCounter Component
 *
 * A specialized badge for showing character counts with limit warnings.
 */
export interface CharacterCounterProps {
  /** Current character count */
  count: number;
  /** Maximum allowed characters */
  max?: number;
  /** Warning threshold as percentage (0-1) */
  warningThreshold?: number;
  /** Custom CSS class */
  className?: string;
  /** Whether to show the counter */
  show?: boolean;
}

export const CharacterCounter: React.FC<CharacterCounterProps> = ({
  count,
  max,
  warningThreshold = 0.8,
  className = '',
  show = true,
}) => {
  if (!show) return null;

  const getVariant = (): BadgeVariant => {
    if (!max) return 'default';

    const percentage = count / max;
    if (percentage >= 1) return 'error';
    if (percentage >= warningThreshold) return 'warning';
    return 'default';
  };

  const text = max ? `${count}/${max}` : `${count}`;

  return (
    <Badge variant={getVariant()} size="small" className={`character-counter ${className}`}>
      {text}
    </Badge>
  );
};

export default Badge;
