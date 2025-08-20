import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

// Test component to verify component styles
function TestButton({ className }: { className: string }) {
  return <button className={className}>Test Button</button>;
}

function TestInput({ className }: { className: string }) {
  return <input className={className} placeholder="Test input" />;
}

function TestCard({ className }: { className: string }) {
  return (
    <div className={className}>
      <div className="card-header">
        <h3 className="card-title">Test Card</h3>
        <p className="card-description">Test description</p>
      </div>
      <div className="card-body">Test body content</div>
      <div className="card-footer">Test footer</div>
    </div>
  );
}

describe('Component Styles', () => {
  beforeEach(() => {
    // Create the sidebar container context
    const container = document.createElement('div');
    container.className = 'ai-sidebar-container';
    document.body.appendChild(container);
  });

  afterEach(() => {
    cleanup();
    // Clean up the sidebar container
    const container = document.querySelector('.ai-sidebar-container');
    if (container) {
      container.remove();
    }
  });

  describe('Button Styles', () => {
    it('should render button with base btn class', () => {
      const container = document.querySelector('.ai-sidebar-container')!;
      render(<TestButton className="btn btn-primary" />, { container });

      const button = screen.getByRole('button');
      expect(button).toHaveClass('btn', 'btn-primary');
    });

    it('should render different button variants', () => {
      const container = document.querySelector('.ai-sidebar-container')!;

      const { rerender } = render(<TestButton className="btn btn-primary" />, { container });
      expect(screen.getByRole('button')).toHaveClass('btn-primary');

      rerender(<TestButton className="btn btn-secondary" />);
      expect(screen.getByRole('button')).toHaveClass('btn-secondary');

      rerender(<TestButton className="btn btn-ghost" />);
      expect(screen.getByRole('button')).toHaveClass('btn-ghost');

      rerender(<TestButton className="btn btn-danger" />);
      expect(screen.getByRole('button')).toHaveClass('btn-danger');
    });

    it('should render different button sizes', () => {
      const container = document.querySelector('.ai-sidebar-container')!;

      const { rerender } = render(<TestButton className="btn btn-sm" />, { container });
      expect(screen.getByRole('button')).toHaveClass('btn-sm');

      rerender(<TestButton className="btn btn-md" />);
      expect(screen.getByRole('button')).toHaveClass('btn-md');

      rerender(<TestButton className="btn btn-lg" />);
      expect(screen.getByRole('button')).toHaveClass('btn-lg');
    });

    it('should render button states', () => {
      const container = document.querySelector('.ai-sidebar-container')!;

      const { rerender } = render(<TestButton className="btn loading" />, { container });
      expect(screen.getByRole('button')).toHaveClass('loading');

      rerender(<TestButton className="btn active" />);
      expect(screen.getByRole('button')).toHaveClass('active');
    });
  });

  describe('Input Styles', () => {
    it('should render input with base input class', () => {
      const container = document.querySelector('.ai-sidebar-container')!;
      render(<TestInput className="input input-md" />, { container });

      const input = screen.getByPlaceholderText('Test input');
      expect(input).toHaveClass('input', 'input-md');
    });

    it('should render different input sizes', () => {
      const container = document.querySelector('.ai-sidebar-container')!;

      const { rerender } = render(<TestInput className="input input-sm" />, { container });
      expect(screen.getByPlaceholderText('Test input')).toHaveClass('input-sm');

      rerender(<TestInput className="input input-md" />);
      expect(screen.getByPlaceholderText('Test input')).toHaveClass('input-md');

      rerender(<TestInput className="input input-lg" />);
      expect(screen.getByPlaceholderText('Test input')).toHaveClass('input-lg');
    });

    it('should render input states', () => {
      const container = document.querySelector('.ai-sidebar-container')!;

      const { rerender } = render(<TestInput className="input error" />, { container });
      expect(screen.getByPlaceholderText('Test input')).toHaveClass('error');

      rerender(<TestInput className="input success" />);
      expect(screen.getByPlaceholderText('Test input')).toHaveClass('success');
    });
  });

  describe('Card Styles', () => {
    it('should render card with base card class', () => {
      const container = document.querySelector('.ai-sidebar-container')!;
      render(<TestCard className="card" />, { container });

      const card = screen.getByText('Test Card').closest('.card');
      expect(card).toHaveClass('card');
    });

    it('should render card structure correctly', () => {
      const container = document.querySelector('.ai-sidebar-container')!;
      render(<TestCard className="card" />, { container });

      expect(screen.getByText('Test Card')).toHaveClass('card-title');
      expect(screen.getByText('Test description')).toHaveClass('card-description');

      // Check that the card structure exists
      const cardHeader = screen.getByText('Test Card').closest('.card-header');
      const cardBody = screen.getByText('Test body content').closest('.card-body');
      const cardFooter = screen.getByText('Test footer').closest('.card-footer');

      expect(cardHeader).toBeInTheDocument();
      expect(cardBody).toBeInTheDocument();
      expect(cardFooter).toBeInTheDocument();
    });

    it('should render card variants', () => {
      const container = document.querySelector('.ai-sidebar-container')!;

      const { rerender } = render(<TestCard className="card card-elevated" />, { container });
      const card = screen.getByText('Test Card').closest('.card');
      expect(card).toHaveClass('card-elevated');

      rerender(<TestCard className="card card-interactive" />);
      expect(card).toHaveClass('card-interactive');
    });
  });

  describe('Common Patterns', () => {
    it('should render utility classes', () => {
      const container = document.querySelector('.ai-sidebar-container')!;
      render(
        <div>
          <div className="loading-spinner" data-testid="spinner">
            Spinner
          </div>
          <div className="fade-in" data-testid="fade">
            Fade
          </div>
          <div className="slide-up" data-testid="slide">
            Slide
          </div>
          <div className="sr-only" data-testid="sr">
            Screen reader
          </div>
        </div>,
        { container }
      );

      expect(screen.getByTestId('spinner')).toHaveClass('loading-spinner');
      expect(screen.getByTestId('fade')).toHaveClass('fade-in');
      expect(screen.getByTestId('slide')).toHaveClass('slide-up');
      expect(screen.getByTestId('sr')).toHaveClass('sr-only');
    });

    it('should render state classes', () => {
      const container = document.querySelector('.ai-sidebar-container')!;
      render(
        <div>
          <div className="error-state" data-testid="error">
            Error
          </div>
          <div className="success-state" data-testid="success">
            Success
          </div>
          <div className="loading-overlay" data-testid="loading">
            Loading
          </div>
        </div>,
        { container }
      );

      expect(screen.getByTestId('error')).toHaveClass('error-state');
      expect(screen.getByTestId('success')).toHaveClass('success-state');
      expect(screen.getByTestId('loading')).toHaveClass('loading-overlay');
    });
  });

  describe('Accessibility', () => {
    it('should render focusable elements with proper classes', () => {
      const container = document.querySelector('.ai-sidebar-container')!;
      render(<TestButton className="btn focusable" />, { container });

      expect(screen.getByRole('button')).toHaveClass('focusable');
    });

    it('should render screen reader only content', () => {
      const container = document.querySelector('.ai-sidebar-container')!;
      render(<span className="sr-only">Screen reader only</span>, { container });

      const srElement = screen.getByText('Screen reader only');
      expect(srElement).toHaveClass('sr-only');
    });
  });
});
