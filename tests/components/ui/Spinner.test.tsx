import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Spinner } from '@/sidebar/components/ui/Spinner';

describe('Spinner', () => {
  it('renders spinner with correct role and default aria-label', () => {
    render(<Spinner />);

    const spinner = screen.getByRole('status');
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveAttribute('aria-label', 'Loading');
  });

  it('renders with custom aria-label', () => {
    render(<Spinner aria-label="Processing data" />);

    const spinner = screen.getByRole('status');
    expect(spinner).toHaveAttribute('aria-label', 'Processing data');
  });

  it('renders with custom label text', () => {
    render(<Spinner label="Please wait..." />);

    expect(screen.getByText('Please wait...')).toBeInTheDocument();
    // When label prop is provided, it should be visible text, not just aria-label
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('applies animation classes', () => {
    render(<Spinner />);

    const spinner = screen.getByRole('status');
    // Should have animation class or data attribute for CSS animation
    expect(spinner.firstChild).toHaveClass('animate-spin');
  });

  it('renders different sizes correctly', () => {
    const { rerender } = render(<Spinner size="sm" />);
    let spinner = screen.getByRole('status');
    expect(spinner.firstChild).toHaveClass('w-4', 'h-4'); // 16px

    rerender(<Spinner size="md" />);
    spinner = screen.getByRole('status');
    expect(spinner.firstChild).toHaveClass('w-6', 'h-6'); // 24px

    rerender(<Spinner size="lg" />);
    spinner = screen.getByRole('status');
    expect(spinner.firstChild).toHaveClass('w-8', 'h-8'); // 32px

    rerender(<Spinner size="xl" />);
    spinner = screen.getByRole('status');
    expect(spinner.firstChild).toHaveClass('w-12', 'h-12'); // 48px
  });

  it('defaults to medium size when no size specified', () => {
    render(<Spinner />);

    const spinner = screen.getByRole('status');
    expect(spinner.firstChild).toHaveClass('w-6', 'h-6');
  });

  it('merges custom className with default classes', () => {
    render(<Spinner className="custom-spinner" />);

    const spinner = screen.getByRole('status');
    expect(spinner).toHaveClass('custom-spinner');
    // Should still have its default classes
    expect(spinner).toHaveClass('inline-block');
  });

  it('forwards additional props to container element', () => {
    render(<Spinner data-testid="loading-spinner" />);

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('renders SVG spinner by default', () => {
    render(<Spinner />);

    const svg = screen.getByRole('status').querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('viewBox');
  });

  it('supports different color variants through currentColor', () => {
    render(<Spinner className="text-blue-500" />);

    const spinner = screen.getByRole('status');
    expect(spinner).toHaveClass('text-blue-500');
    // SVG should inherit color through currentColor
    const svg = spinner.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('has proper accessibility attributes', () => {
    render(<Spinner />);

    const spinner = screen.getByRole('status');
    expect(spinner).toHaveAttribute('aria-label');
    expect(spinner).toHaveAttribute('role', 'status');

    // Should be announced to screen readers but not interrupt
    expect(spinner).not.toHaveAttribute('aria-live', 'assertive');
  });

  it('handles screen reader text correctly when label is provided', () => {
    render(<Spinner label="Loading content" />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Loading content')).toBeInTheDocument();
    // Text should be visible to screen readers
    const text = screen.getByText('Loading content');
    expect(text).not.toHaveClass('sr-only');
  });

  it('renders with screen reader only text when no visible label', () => {
    render(<Spinner />);

    const spinner = screen.getByRole('status');
    expect(spinner).toHaveAttribute('aria-label', 'Loading');
    // No visible text should be present
    expect(screen.queryByText('Loading')).not.toBeInTheDocument();
  });

  it('maintains aspect ratio for all sizes', () => {
    const sizes = ['sm', 'md', 'lg', 'xl'] as const;

    sizes.forEach(size => {
      const { unmount } = render(<Spinner size={size} />);
      const svg = screen.getByRole('status').querySelector('svg');

      expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
      // SVG should maintain square aspect ratio
      if (svg) {
        // Handle SVG className which might be SVGAnimatedString
        const classNames = svg.className.baseVal || svg.className;
        const classList = classNames.split(' ');
        const widthClass = classList.find(cls => cls.startsWith('w-'));
        const heightClass = classList.find(cls => cls.startsWith('h-'));
        expect(widthClass?.replace('w-', '')).toBe(heightClass?.replace('h-', ''));
      }

      // Clean up between iterations
      unmount();
    });
  });

  it('supports reduced motion preferences', () => {
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

    render(<Spinner />);

    const spinner = screen.getByRole('status');
    expect(spinner).toBeInTheDocument();
    // Animation should still be applied but CSS will handle reduced motion
    expect(spinner.firstChild).toHaveClass('animate-spin');
  });
});
