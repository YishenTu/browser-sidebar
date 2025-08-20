import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Button } from '@/components/ui/Button';

/**
 * Integration tests for Button component with CSS styles.
 * These tests verify that the Button component integrates correctly with the
 * component styles defined in components.css within the sidebar container context.
 */
describe('Button Component - CSS Integration', () => {
  beforeEach(() => {
    // Create the sidebar container context required for CSS styles
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

  it('renders within sidebar container context and applies correct CSS classes', () => {
    const container = document.querySelector('.ai-sidebar-container')!;
    render(
      <Button variant="primary" size="md">
        Test Button
      </Button>,
      { container }
    );

    const button = screen.getByRole('button');
    expect(button).toHaveClass('btn', 'btn-primary', 'btn-md');
    expect(button).toHaveTextContent('Test Button');
  });

  it('applies loading state classes correctly', () => {
    const container = document.querySelector('.ai-sidebar-container')!;
    render(<Button loading>Loading Button</Button>, { container });

    const button = screen.getByRole('button');
    expect(button).toHaveClass('btn', 'loading');
    expect(button).toBeDisabled();
  });

  it('merges custom classes with default classes', () => {
    const container = document.querySelector('.ai-sidebar-container')!;
    render(
      <Button variant="secondary" size="lg" className="custom-test-class">
        Custom Button
      </Button>,
      { container }
    );

    const button = screen.getByRole('button');
    expect(button).toHaveClass('btn', 'btn-secondary', 'btn-lg', 'custom-test-class');
  });

  it('applies secondary variant classes correctly within sidebar context', () => {
    const container = document.querySelector('.ai-sidebar-container')!;
    render(<Button variant="secondary">Secondary Button</Button>, { container });

    const button = screen.getByRole('button');
    expect(button).toHaveClass('btn', 'btn-secondary');
  });

  it('applies small size classes correctly within sidebar context', () => {
    const container = document.querySelector('.ai-sidebar-container')!;
    render(<Button size="sm">Small Button</Button>, { container });

    const button = screen.getByRole('button');
    expect(button).toHaveClass('btn', 'btn-sm');
  });

  it('works correctly with sidebar CSS scoping', () => {
    // Test without sidebar container (should still work but may not have scoped styles)
    render(<Button>Outside Sidebar</Button>);
    const outsideButton = screen.getByRole('button');
    expect(outsideButton).toHaveClass('btn', 'btn-primary', 'btn-md');

    // Test within sidebar container (should have scoped styles)
    const container = document.querySelector('.ai-sidebar-container')!;
    render(<Button>Inside Sidebar</Button>, { container });
    const insideButton = screen.getAllByRole('button')[1]; // Second button
    expect(insideButton).toHaveClass('btn', 'btn-primary', 'btn-md');
  });
});
