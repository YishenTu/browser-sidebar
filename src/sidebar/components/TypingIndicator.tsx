import React from 'react';

export interface TypingIndicatorProps {
  /**
   * Whether the typing indicator is visible
   * @default false
   */
  visible?: boolean;

  /**
   * Text to display alongside the typing animation
   * @default "AI is typing"
   */
  text?: string;

  /**
   * Screen reader optimized text (overrides aria-label)
   * Falls back to text prop if not provided
   */
  srText?: string;

  /**
   * Size variant for the typing indicator
   * @default "medium"
   */
  size?: 'small' | 'medium' | 'large';

  /**
   * Animation speed for the dots
   * @default "normal"
   */
  speed?: 'slow' | 'normal' | 'fast';

  /**
   * Additional CSS classes to apply
   */
  className?: string;

  /**
   * Additional props to pass to the container element
   */
  [key: string]: unknown;
}

/**
 * Typing indicator component with animated dots for AI responses
 *
 * Features:
 * - Three animated dots with sequential bounce animation
 * - Configurable size variants (small, medium, large)
 * - Customizable text and animation speed
 * - Smooth fade-in/fade-out transitions
 * - Full accessibility support with ARIA attributes
 * - Respects prefers-reduced-motion preferences
 * - Supports custom styling through className
 */
export const TypingIndicator: React.FC<TypingIndicatorProps> = ({
  visible = false,
  text = 'AI is typing',
  srText,
  size = 'medium',
  speed = 'normal',
  className = '',
  ...rest
}) => {
  // Don't render if not visible
  if (!visible) {
    return null;
  }

  // Size configurations
  const sizeConfig = {
    small: {
      textClass: 'text-xs',
      dotClasses: 'w-1 h-1',
    },
    medium: {
      textClass: 'text-sm',
      dotClasses: 'w-1.5 h-1.5',
    },
    large: {
      textClass: 'text-base',
      dotClasses: 'w-2 h-2',
    },
  };

  // Animation speed configurations
  const speedConfig = {
    slow: '1.5s',
    normal: '1s',
    fast: '0.5s',
  };

  // Animation delays for sequential dot animation
  const dotDelays = ['0ms', '150ms', '300ms'];

  // Get configuration for current size
  const { textClass, dotClasses } = sizeConfig[size];
  const animationDuration = speedConfig[speed];

  // Use screen reader text if provided, otherwise fall back to text
  const ariaLabel = srText || text;

  return (
    <div
      role="status"
      aria-label={ariaLabel}
      aria-live="polite"
      className={`
        flex items-center gap-1 
        ${textClass}
        animate-in fade-in-0 slide-in-from-left-2 duration-300
        ${className}
      `.trim()}
      {...rest}
    >
      {/* Text content */}
      {text && <span className="text-current">{text}</span>}

      {/* Animated dots container */}
      <div className="flex items-center gap-0.5 ml-1">
        {[0, 1, 2].map(index => (
          <div
            key={index}
            data-testid={`typing-dot-${index}`}
            className={`
              typing-dot
              ${dotClasses}
              bg-current
              rounded-full
              animate-bounce
            `.trim()}
            style={{
              animationDelay: dotDelays[index],
              animationDuration: animationDuration,
            }}
          />
        ))}
      </div>
    </div>
  );
};
