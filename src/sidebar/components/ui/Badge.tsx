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

export default Badge;
