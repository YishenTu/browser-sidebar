import React, { useState, useRef, useEffect, useCallback } from 'react';

export interface TooltipProps {
  /** The content to display in the tooltip */
  content: string | React.ReactNode;
  /** The element that triggers the tooltip */
  children: React.ReactElement;
  /** Tooltip position relative to trigger */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** Delay before showing tooltip (ms) */
  showDelay?: number;
  /** Delay before hiding tooltip (ms) */
  hideDelay?: number;
  /** Whether tooltip is disabled */
  disabled?: boolean;
  /** Custom CSS class */
  className?: string;
  /** Max width of tooltip */
  maxWidth?: number;
}

/**
 * Tooltip Component
 *
 * A simple tooltip component that shows content on hover or focus.
 * Handles positioning within Shadow DOM and provides accessibility features.
 */
export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  showDelay = 500,
  hideDelay = 100,
  disabled = false,
  className = '',
  maxWidth = 250,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [actualPosition, setActualPosition] = useState(position);
  const triggerRef = useRef<HTMLElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const showTimeoutRef = useRef<number | null>(null);
  const hideTimeoutRef = useRef<number | null>(null);

  // Clear timeouts on cleanup
  useEffect(() => {
    return () => {
      if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, []);

  // Calculate tooltip position to avoid viewport overflow
  const calculatePosition = useCallback((): { top: number; left: number } => {
    if (!triggerRef.current || !tooltipRef.current) {
      return { top: 0, left: 0 };
    }

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let top = 0;
    let left = 0;
    let newPosition = position;

    switch (position) {
      case 'top':
        top = triggerRect.top - tooltipRect.height - 8;
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;

        // Check if tooltip would go above viewport
        if (top < 8) {
          newPosition = 'bottom';
          top = triggerRect.bottom + 8;
        }
        break;

      case 'bottom':
        top = triggerRect.bottom + 8;
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;

        // Check if tooltip would go below viewport
        if (top + tooltipRect.height > viewportHeight - 8) {
          newPosition = 'top';
          top = triggerRect.top - tooltipRect.height - 8;
        }
        break;

      case 'left':
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        left = triggerRect.left - tooltipRect.width - 8;

        // Check if tooltip would go left of viewport
        if (left < 8) {
          newPosition = 'right';
          left = triggerRect.right + 8;
        }
        break;

      case 'right':
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        left = triggerRect.right + 8;

        // Check if tooltip would go right of viewport
        if (left + tooltipRect.width > viewportWidth - 8) {
          newPosition = 'left';
          left = triggerRect.left - tooltipRect.width - 8;
        }
        break;
    }

    // Keep tooltip within viewport bounds
    left = Math.max(8, Math.min(left, viewportWidth - tooltipRect.width - 8));
    top = Math.max(8, Math.min(top, viewportHeight - tooltipRect.height - 8));

    setActualPosition(newPosition);

    return { top, left };
  }, [position]);

  const showTooltip = () => {
    if (disabled || !content) return;

    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }

    showTimeoutRef.current = window.setTimeout(() => {
      setIsVisible(true);
      showTimeoutRef.current = null;
    }, showDelay);
  };

  const hideTooltip = () => {
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = null;
    }

    hideTimeoutRef.current = window.setTimeout(() => {
      setIsVisible(false);
      hideTimeoutRef.current = null;
    }, hideDelay);
  };

  // Handle mouse events
  const handleMouseEnter = () => showTooltip();
  const handleMouseLeave = () => hideTooltip();

  // Handle focus events for keyboard accessibility
  const handleFocus = () => showTooltip();
  const handleBlur = () => hideTooltip();

  // Clone the trigger element with event handlers
  const triggerElement = React.cloneElement(children, {
    ref: triggerRef,
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
    onFocus: handleFocus,
    onBlur: handleBlur,
    'aria-describedby': isVisible ? 'tooltip' : undefined,
  });

  // Calculate position when tooltip becomes visible
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (isVisible && tooltipRef.current) {
      const calculatedPosition = calculatePosition();
      setTooltipStyle({
        position: 'fixed',
        top: `${calculatedPosition.top}px`,
        left: `${calculatedPosition.left}px`,
        maxWidth: `${maxWidth}px`,
        zIndex: 10000,
      });
    }
  }, [isVisible, maxWidth, position, calculatePosition]);

  return (
    <>
      {triggerElement}
      {isVisible && content && (
        <div
          ref={tooltipRef}
          id="tooltip"
          role="tooltip"
          className={`tooltip tooltip--${actualPosition} ${className}`}
          style={tooltipStyle}
          onMouseEnter={() => {
            // Keep tooltip visible when hovering over it
            if (hideTimeoutRef.current) {
              clearTimeout(hideTimeoutRef.current);
              hideTimeoutRef.current = null;
            }
          }}
          onMouseLeave={hideTooltip}
        >
          <div className="tooltip__content">{content}</div>
          <div className={`tooltip__arrow tooltip__arrow--${actualPosition}`} />
        </div>
      )}
    </>
  );
};
