import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TypingIndicator } from '../../../src/components/Chat/TypingIndicator';

// Mock RAF for animation testing
let rafSpy: any;

beforeEach(() => {
  rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
    setTimeout(cb, 16); // 60fps
    return 1;
  });
});

afterEach(() => {
  rafSpy?.mockRestore();
  vi.clearAllTimers();
});

describe('TypingIndicator', () => {
  // Basic rendering tests
  describe('Rendering', () => {
    it('renders when visible is true', () => {
      render(<TypingIndicator visible={true} />);

      const indicator = screen.getByRole('status');
      expect(indicator).toBeInTheDocument();
      expect(indicator).toHaveAttribute('aria-label', 'AI is typing');
    });

    it('does not render when visible is false', () => {
      render(<TypingIndicator visible={false} />);

      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('does not render when visible is undefined (default false)', () => {
      render(<TypingIndicator />);

      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });

  // Text and content tests
  describe('Text Content', () => {
    it('displays default text "AI is typing"', () => {
      render(<TypingIndicator visible={true} />);

      expect(screen.getByText('AI is typing')).toBeInTheDocument();
    });

    it('displays custom text when provided', () => {
      render(<TypingIndicator visible={true} text="Claude is thinking..." />);

      expect(screen.getByText('Claude is thinking...')).toBeInTheDocument();
      expect(screen.queryByText('AI is typing')).not.toBeInTheDocument();
    });

    it('updates aria-label when custom text is provided', () => {
      render(<TypingIndicator visible={true} text="Assistant is responding" />);

      const indicator = screen.getByRole('status');
      expect(indicator).toHaveAttribute('aria-label', 'Assistant is responding');
    });
  });

  // Size variants tests
  describe('Size Variants', () => {
    it('renders with small size correctly', () => {
      render(<TypingIndicator visible={true} size="small" />);

      const indicator = screen.getByRole('status');
      expect(indicator).toHaveClass('text-xs');

      // Check dot sizing
      const dots = indicator.querySelectorAll('.typing-dot');
      expect(dots).toHaveLength(3);
      dots.forEach(dot => {
        expect(dot).toHaveClass('w-1', 'h-1');
      });
    });

    it('renders with medium size correctly (default)', () => {
      render(<TypingIndicator visible={true} />);

      const indicator = screen.getByRole('status');
      expect(indicator).toHaveClass('text-sm');

      const dots = indicator.querySelectorAll('.typing-dot');
      expect(dots).toHaveLength(3);
      dots.forEach(dot => {
        expect(dot).toHaveClass('w-1.5', 'h-1.5');
      });
    });

    it('renders with large size correctly', () => {
      render(<TypingIndicator visible={true} size="large" />);

      const indicator = screen.getByRole('status');
      expect(indicator).toHaveClass('text-base');

      const dots = indicator.querySelectorAll('.typing-dot');
      expect(dots).toHaveLength(3);
      dots.forEach(dot => {
        expect(dot).toHaveClass('w-2', 'h-2');
      });
    });
  });

  // Animation tests
  describe('Animations', () => {
    it('applies animation classes to dots', () => {
      render(<TypingIndicator visible={true} />);

      const dots = screen.getAllByTestId(/typing-dot-\d/);
      expect(dots).toHaveLength(3);

      dots.forEach(dot => {
        expect(dot).toHaveClass('animate-bounce');
      });
    });

    it('applies different animation delays to dots', () => {
      render(<TypingIndicator visible={true} />);

      const dot1 = screen.getByTestId('typing-dot-0');
      const dot2 = screen.getByTestId('typing-dot-1');
      const dot3 = screen.getByTestId('typing-dot-2');

      // Check that each dot has a different animation delay
      expect(dot1.style.animationDelay).toBe('0ms');
      expect(dot2.style.animationDelay).toBe('150ms');
      expect(dot3.style.animationDelay).toBe('300ms');
    });

    it('supports custom animation speed', () => {
      render(<TypingIndicator visible={true} speed="slow" />);

      const dots = screen.getAllByTestId(/typing-dot-\d/);
      dots.forEach(dot => {
        expect(dot.style.animationDuration).toBe('1.5s');
      });
    });

    it('supports fast animation speed', () => {
      render(<TypingIndicator visible={true} speed="fast" />);

      const dots = screen.getAllByTestId(/typing-dot-\d/);
      dots.forEach(dot => {
        expect(dot.style.animationDuration).toBe('0.5s');
      });
    });

    it('uses default animation speed when not specified', () => {
      render(<TypingIndicator visible={true} />);

      const dots = screen.getAllByTestId(/typing-dot-\d/);
      dots.forEach(dot => {
        expect(dot.style.animationDuration).toBe('1s');
      });
    });
  });

  // Transition tests
  describe('Transitions', () => {
    it('applies fade-in transition when becoming visible', () => {
      const { rerender } = render(<TypingIndicator visible={false} />);

      expect(screen.queryByRole('status')).not.toBeInTheDocument();

      rerender(<TypingIndicator visible={true} />);

      const indicator = screen.getByRole('status');
      expect(indicator).toBeInTheDocument();
      expect(indicator).toHaveClass('animate-in');
      expect(indicator).toHaveClass('fade-in-0');
    });

    it('applies slide-in animation', () => {
      render(<TypingIndicator visible={true} />);

      const indicator = screen.getByRole('status');
      expect(indicator).toHaveClass('slide-in-from-left-2');
    });
  });

  // Accessibility tests
  describe('Accessibility', () => {
    it('has proper role and aria attributes', () => {
      render(<TypingIndicator visible={true} />);

      const indicator = screen.getByRole('status');
      expect(indicator).toHaveAttribute('role', 'status');
      expect(indicator).toHaveAttribute('aria-label', 'AI is typing');
      expect(indicator).toHaveAttribute('aria-live', 'polite');
    });

    it('is properly announced to screen readers', () => {
      render(<TypingIndicator visible={true} />);

      const indicator = screen.getByRole('status');
      expect(indicator).toHaveAttribute('aria-live', 'polite');
      // Should not be assertive to avoid interrupting other content
      expect(indicator).not.toHaveAttribute('aria-live', 'assertive');
    });

    it('supports screen reader optimized text', () => {
      render(<TypingIndicator visible={true} srText="Loading response from AI assistant" />);

      const indicator = screen.getByRole('status');
      expect(indicator).toHaveAttribute('aria-label', 'Loading response from AI assistant');

      // Visual text should still be the default or custom text
      expect(screen.getByText('AI is typing')).toBeInTheDocument();
    });

    it('respects prefers-reduced-motion', () => {
      // Mock prefers-reduced-motion
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: (query: string) => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => {},
        }),
      });

      render(<TypingIndicator visible={true} />);

      const dots = screen.getAllByTestId(/typing-dot-\d/);
      dots.forEach(dot => {
        // Should still have animation classes but CSS will handle reduced motion
        expect(dot).toHaveClass('animate-bounce');
      });
    });
  });

  // Styling and customization tests
  describe('Styling and Customization', () => {
    it('accepts custom className', () => {
      render(<TypingIndicator visible={true} className="custom-typing-indicator" />);

      const indicator = screen.getByRole('status');
      expect(indicator).toHaveClass('custom-typing-indicator');
    });

    it('merges custom className with default classes', () => {
      render(<TypingIndicator visible={true} className="text-blue-500" />);

      const indicator = screen.getByRole('status');
      expect(indicator).toHaveClass('text-blue-500');
      expect(indicator).toHaveClass('flex', 'items-center', 'gap-1');
    });

    it('forwards additional props to container element', () => {
      render(<TypingIndicator visible={true} data-testid="typing-indicator" />);

      expect(screen.getByTestId('typing-indicator')).toBeInTheDocument();
    });

    it('supports different dot colors through CSS custom properties', () => {
      render(<TypingIndicator visible={true} className="text-green-500" />);

      const indicator = screen.getByRole('status');
      expect(indicator).toHaveClass('text-green-500');

      const dots = screen.getAllByTestId(/typing-dot-\d/);
      dots.forEach(dot => {
        expect(dot).toHaveClass('bg-current');
      });
    });
  });

  // Edge cases and error handling
  describe('Edge Cases', () => {
    it('handles empty text gracefully', () => {
      render(<TypingIndicator visible={true} text="" />);

      const indicator = screen.getByRole('status');
      expect(indicator).toBeInTheDocument();

      // Should not display empty text
      expect(indicator.textContent).toBe('');
    });

    it('handles very long text', () => {
      const longText =
        'AI is processing your request and generating a very detailed response that might take a while to complete';
      render(<TypingIndicator visible={true} text={longText} />);

      expect(screen.getByText(longText)).toBeInTheDocument();
    });

    it('handles rapid visibility changes', () => {
      const { rerender } = render(<TypingIndicator visible={true} />);

      // Rapidly toggle visibility
      for (let i = 0; i < 5; i++) {
        rerender(<TypingIndicator visible={false} />);
        rerender(<TypingIndicator visible={true} />);
      }

      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  // Performance tests
  describe('Performance', () => {
    it('does not re-render unnecessarily when props do not change', () => {
      const { rerender } = render(<TypingIndicator visible={true} text="AI is typing" />);

      const indicator = screen.getByRole('status');
      const initialElement = indicator;

      // Re-render with same props
      rerender(<TypingIndicator visible={true} text="AI is typing" />);

      // Element reference should remain the same (React optimization)
      expect(screen.getByRole('status')).toBe(initialElement);
    });

    it('cleans up animations when unmounted', () => {
      const { unmount } = render(<TypingIndicator visible={true} />);

      expect(screen.getByRole('status')).toBeInTheDocument();

      unmount();

      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      // Animation cleanup should happen automatically
    });
  });
});
