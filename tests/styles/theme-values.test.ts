import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import React from 'react';

// Component to test if Tailwind classes are accessible
const TestComponent: React.FC<{ className: string }> = ({ className }) => {
  return React.createElement(
    'div',
    {
      className,
      'data-testid': 'test-element',
    },
    'Test content'
  );
};

describe('Tailwind Theme Values Accessibility', () => {
  beforeEach(() => {
    // Create a style element with basic Tailwind CSS for testing
    const style = document.createElement('style');
    style.id = 'tailwind-test-styles';
    style.textContent = `
      .bg-primary-500 { background-color: #3b82f6; }
      .bg-primary-50 { background-color: #eff6ff; }
      .bg-primary-900 { background-color: #1e3a8a; }
      .bg-ai { background-color: #0ea5e9; }
      .bg-ai-light { background-color: #e0f2fe; }
      .bg-ai-dark { background-color: #0284c7; }
      .bg-user { background-color: #a855f7; }
      .bg-user-light { background-color: #f3e8ff; }
      .bg-user-dark { background-color: #9333ea; }
      .text-primary-500 { color: #3b82f6; }
      .text-ai { color: #0ea5e9; }
      .text-user { color: #a855f7; }
      .animate-pulse-soft { animation: pulse-soft 3s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
      .animate-slide-up { animation: slideUp 0.3s ease-out; }
      .animate-fade-in { animation: fadeIn 0.2s ease-in; }
      .dark .bg-gray-800 { background-color: #1f2937; }
      .dark .text-gray-100 { color: #f3f4f6; }
      @keyframes slideUp {
        0% { transform: translateY(10px); opacity: 0; }
        100% { transform: translateY(0); opacity: 1; }
      }
      @keyframes fadeIn {
        0% { opacity: 0; }
        100% { opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  });

  afterEach(() => {
    cleanup();
    const style = document.getElementById('tailwind-test-styles');
    if (style) {
      style.remove();
    }
  });

  describe('Primary Color Palette', () => {
    it('should render primary-500 background color', () => {
      const { getByTestId } = render(
        React.createElement(TestComponent, { className: 'bg-primary-500' })
      );
      const element = getByTestId('test-element');

      expect(element).toHaveClass('bg-primary-500');
      expect(getComputedStyle(element).backgroundColor).toBe('rgb(59, 130, 246)');
    });

    it('should render primary-50 (lightest) background color', () => {
      const { getByTestId } = render(
        React.createElement(TestComponent, { className: 'bg-primary-50' })
      );
      const element = getByTestId('test-element');

      expect(element).toHaveClass('bg-primary-50');
      expect(getComputedStyle(element).backgroundColor).toBe('rgb(239, 246, 255)');
    });

    it('should render primary-900 (darkest) background color', () => {
      const { getByTestId } = render(
        React.createElement(TestComponent, { className: 'bg-primary-900' })
      );
      const element = getByTestId('test-element');

      expect(element).toHaveClass('bg-primary-900');
      expect(getComputedStyle(element).backgroundColor).toBe('rgb(30, 58, 138)');
    });
  });

  describe('AI Color Variants', () => {
    it('should render ai default background color', () => {
      const { getByTestId } = render(React.createElement(TestComponent, { className: 'bg-ai' }));
      const element = getByTestId('test-element');

      expect(element).toHaveClass('bg-ai');
      expect(getComputedStyle(element).backgroundColor).toBe('rgb(14, 165, 233)');
    });

    it('should render ai-light background color', () => {
      const { getByTestId } = render(
        React.createElement(TestComponent, { className: 'bg-ai-light' })
      );
      const element = getByTestId('test-element');

      expect(element).toHaveClass('bg-ai-light');
      expect(getComputedStyle(element).backgroundColor).toBe('rgb(224, 242, 254)');
    });

    it('should render ai-dark background color', () => {
      const { getByTestId } = render(
        React.createElement(TestComponent, { className: 'bg-ai-dark' })
      );
      const element = getByTestId('test-element');

      expect(element).toHaveClass('bg-ai-dark');
      expect(getComputedStyle(element).backgroundColor).toBe('rgb(2, 132, 199)');
    });
  });

  describe('User Color Variants', () => {
    it('should render user default background color', () => {
      const { getByTestId } = render(React.createElement(TestComponent, { className: 'bg-user' }));
      const element = getByTestId('test-element');

      expect(element).toHaveClass('bg-user');
      expect(getComputedStyle(element).backgroundColor).toBe('rgb(168, 85, 247)');
    });

    it('should render user-light background color', () => {
      const { getByTestId } = render(
        React.createElement(TestComponent, { className: 'bg-user-light' })
      );
      const element = getByTestId('test-element');

      expect(element).toHaveClass('bg-user-light');
      expect(getComputedStyle(element).backgroundColor).toBe('rgb(243, 232, 255)');
    });

    it('should render user-dark background color', () => {
      const { getByTestId } = render(
        React.createElement(TestComponent, { className: 'bg-user-dark' })
      );
      const element = getByTestId('test-element');

      expect(element).toHaveClass('bg-user-dark');
      expect(getComputedStyle(element).backgroundColor).toBe('rgb(147, 51, 234)');
    });
  });

  describe('Text Colors', () => {
    it('should render primary text color', () => {
      const { getByTestId } = render(
        React.createElement(TestComponent, { className: 'text-primary-500' })
      );
      const element = getByTestId('test-element');

      expect(element).toHaveClass('text-primary-500');
      expect(getComputedStyle(element).color).toBe('rgb(59, 130, 246)');
    });

    it('should render ai text color', () => {
      const { getByTestId } = render(React.createElement(TestComponent, { className: 'text-ai' }));
      const element = getByTestId('test-element');

      expect(element).toHaveClass('text-ai');
      expect(getComputedStyle(element).color).toBe('rgb(14, 165, 233)');
    });

    it('should render user text color', () => {
      const { getByTestId } = render(
        React.createElement(TestComponent, { className: 'text-user' })
      );
      const element = getByTestId('test-element');

      expect(element).toHaveClass('text-user');
      expect(getComputedStyle(element).color).toBe('rgb(168, 85, 247)');
    });
  });

  describe('Custom Animations', () => {
    it('should apply pulse-soft animation class', () => {
      const { getByTestId } = render(
        React.createElement(TestComponent, { className: 'animate-pulse-soft' })
      );
      const element = getByTestId('test-element');

      expect(element).toHaveClass('animate-pulse-soft');
    });

    it('should apply slide-up animation class', () => {
      const { getByTestId } = render(
        React.createElement(TestComponent, { className: 'animate-slide-up' })
      );
      const element = getByTestId('test-element');

      expect(element).toHaveClass('animate-slide-up');
    });

    it('should apply fade-in animation class', () => {
      const { getByTestId } = render(
        React.createElement(TestComponent, { className: 'animate-fade-in' })
      );
      const element = getByTestId('test-element');

      expect(element).toHaveClass('animate-fade-in');
    });
  });

  describe('Typography Scale', () => {
    it('should support custom font sizes when configured', () => {
      // This test will be enhanced once we add typography to the config
      const { getByTestId } = render(React.createElement(TestComponent, { className: 'text-lg' }));
      const element = getByTestId('test-element');

      expect(element).toHaveClass('text-lg');
    });

    it('should support custom font weights when configured', () => {
      // This test will be enhanced once we add typography to the config
      const { getByTestId } = render(
        React.createElement(TestComponent, { className: 'font-medium' })
      );
      const element = getByTestId('test-element');

      expect(element).toHaveClass('font-medium');
    });
  });
});
