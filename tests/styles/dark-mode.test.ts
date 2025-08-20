import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import React from 'react';

// Component to test dark mode functionality
const DarkModeTestComponent: React.FC<{ className: string; children?: React.ReactNode }> = ({
  className,
  children = 'Test content',
}) => {
  return React.createElement(
    'div',
    {
      className,
      'data-testid': 'dark-mode-element',
    },
    children
  );
};

describe('Dark Mode Functionality', () => {
  beforeEach(() => {
    // Create a style element with Tailwind dark mode CSS for testing
    const style = document.createElement('style');
    style.id = 'dark-mode-test-styles';
    style.textContent = `
      .bg-white { background-color: #ffffff; }
      .bg-gray-900 { background-color: #111827; }
      .text-gray-900 { color: #111827; }
      .text-gray-100 { color: #f3f4f6; }
      
      .dark .bg-white { background-color: #111827; }
      .dark .bg-gray-900 { background-color: #111827; }
      .dark .text-gray-900 { color: #f3f4f6; }
      .dark .text-gray-100 { color: #f3f4f6; }
      
      .dark .bg-primary-500 { background-color: #3b82f6; }
      .dark .bg-ai { background-color: #0ea5e9; }
      .dark .bg-user { background-color: #a855f7; }
      
      /* Sidebar specific dark mode styles */
      .ai-sidebar-container { background-color: #ffffff; color: #111827; }
      .dark .ai-sidebar-container { background-color: #111827; color: #f3f4f6; }
      
      .ai-sidebar-header { background-color: #f7f7f8; }
      .dark .ai-sidebar-header { background-color: #1f2937; }
    `;
    document.head.appendChild(style);
  });

  afterEach(() => {
    cleanup();
    const style = document.getElementById('dark-mode-test-styles');
    if (style) {
      style.remove();
    }
    // Clean up dark class from document
    document.documentElement.classList.remove('dark');
  });

  describe('Dark Mode Class Strategy', () => {
    it('should apply light mode styles by default', () => {
      const { getByTestId } = render(
        React.createElement(DarkModeTestComponent, { className: 'bg-white text-gray-900' })
      );
      const element = getByTestId('dark-mode-element');

      expect(element).toHaveClass('bg-white');
      expect(element).toHaveClass('text-gray-900');
      expect(getComputedStyle(element).backgroundColor).toBe('rgb(255, 255, 255)');
      expect(getComputedStyle(element).color).toBe('rgb(17, 24, 39)');
    });

    it('should apply dark mode styles when dark class is on document', () => {
      // Add dark class to document
      document.documentElement.classList.add('dark');

      const DarkWrapper = React.createElement(
        'div',
        { className: 'dark' },
        React.createElement(DarkModeTestComponent, {
          className: 'bg-white text-gray-900',
        })
      );

      const { getByTestId } = render(DarkWrapper);
      const element = getByTestId('dark-mode-element');

      expect(element).toHaveClass('bg-white');
      expect(element).toHaveClass('text-gray-900');
      // Dark mode should override the styles
      expect(getComputedStyle(element).backgroundColor).toBe('rgb(17, 24, 39)');
      expect(getComputedStyle(element).color).toBe('rgb(243, 244, 246)');
    });

    it('should toggle between light and dark modes', () => {
      const { getByTestId, rerender } = render(
        React.createElement(DarkModeTestComponent, { className: 'bg-white text-gray-900' })
      );
      const element = getByTestId('dark-mode-element');

      // Initially light mode
      expect(getComputedStyle(element).backgroundColor).toBe('rgb(255, 255, 255)');

      // Add dark class
      document.documentElement.classList.add('dark');
      const DarkWrapper = React.createElement(
        'div',
        { className: 'dark' },
        React.createElement(DarkModeTestComponent, {
          className: 'bg-white text-gray-900',
        })
      );
      rerender(DarkWrapper);

      // Should now be dark mode
      expect(getComputedStyle(element).backgroundColor).toBe('rgb(17, 24, 39)');

      // Remove dark class
      document.documentElement.classList.remove('dark');
      rerender(React.createElement(DarkModeTestComponent, { className: 'bg-white text-gray-900' }));

      // Should be back to light mode
      expect(getComputedStyle(element).backgroundColor).toBe('rgb(255, 255, 255)');
    });
  });

  describe('Custom Colors in Dark Mode', () => {
    it('should maintain custom primary colors in dark mode', () => {
      document.documentElement.classList.add('dark');

      const DarkWrapper = React.createElement(
        'div',
        { className: 'dark' },
        React.createElement(DarkModeTestComponent, {
          className: 'bg-primary-500',
        })
      );

      const { getByTestId } = render(DarkWrapper);
      const element = getByTestId('dark-mode-element');

      expect(element).toHaveClass('bg-primary-500');
      expect(getComputedStyle(element).backgroundColor).toBe('rgb(59, 130, 246)');
    });

    it('should maintain custom ai colors in dark mode', () => {
      document.documentElement.classList.add('dark');

      const DarkWrapper = React.createElement(
        'div',
        { className: 'dark' },
        React.createElement(DarkModeTestComponent, {
          className: 'bg-ai',
        })
      );

      const { getByTestId } = render(DarkWrapper);
      const element = getByTestId('dark-mode-element');

      expect(element).toHaveClass('bg-ai');
      expect(getComputedStyle(element).backgroundColor).toBe('rgb(14, 165, 233)');
    });

    it('should maintain custom user colors in dark mode', () => {
      document.documentElement.classList.add('dark');

      const DarkWrapper = React.createElement(
        'div',
        { className: 'dark' },
        React.createElement(DarkModeTestComponent, {
          className: 'bg-user',
        })
      );

      const { getByTestId } = render(DarkWrapper);
      const element = getByTestId('dark-mode-element');

      expect(element).toHaveClass('bg-user');
      expect(getComputedStyle(element).backgroundColor).toBe('rgb(168, 85, 247)');
    });
  });

  describe('Sidebar Dark Mode Integration', () => {
    it('should apply dark mode styles to sidebar container', () => {
      document.documentElement.classList.add('dark');

      const DarkWrapper = React.createElement(
        'div',
        { className: 'dark' },
        React.createElement(DarkModeTestComponent, {
          className: 'ai-sidebar-container',
        })
      );

      const { getByTestId } = render(DarkWrapper);
      const element = getByTestId('dark-mode-element');

      expect(element).toHaveClass('ai-sidebar-container');
      expect(getComputedStyle(element).backgroundColor).toBe('rgb(17, 24, 39)');
      expect(getComputedStyle(element).color).toBe('rgb(243, 244, 246)');
    });

    it('should apply dark mode styles to sidebar header', () => {
      document.documentElement.classList.add('dark');

      const DarkWrapper = React.createElement(
        'div',
        { className: 'dark' },
        React.createElement(DarkModeTestComponent, {
          className: 'ai-sidebar-header',
        })
      );

      const { getByTestId } = render(DarkWrapper);
      const element = getByTestId('dark-mode-element');

      expect(element).toHaveClass('ai-sidebar-header');
      expect(getComputedStyle(element).backgroundColor).toBe('rgb(31, 41, 55)');
    });

    it('should work with injected styles in shadow DOM context', () => {
      // Simulate the sidebar injection scenario
      const container = document.createElement('div');
      container.id = 'ai-browser-sidebar-root';
      document.body.appendChild(container);

      const style = document.createElement('style');
      style.textContent = `
        .ai-sidebar-container { background: #fff; }
        .dark .ai-sidebar-container { background: #111827; }
      `;
      document.head.appendChild(style);

      document.documentElement.classList.add('dark');

      const sidebarElement = document.createElement('div');
      sidebarElement.className = 'dark ai-sidebar-container';
      container.appendChild(sidebarElement);

      expect(getComputedStyle(sidebarElement).backgroundColor).toBe('rgb(17, 24, 39)');

      // Cleanup
      container.remove();
      style.remove();
    });
  });

  describe('Dark Mode State Management', () => {
    it('should provide a way to detect current theme', () => {
      // Light mode
      expect(document.documentElement.classList.contains('dark')).toBe(false);

      // Dark mode
      document.documentElement.classList.add('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('should handle theme changes dynamically', () => {
      const { getByTestId, rerender } = render(
        React.createElement(DarkModeTestComponent, { className: 'bg-white' })
      );
      const element = getByTestId('dark-mode-element');

      // Start in light mode
      expect(getComputedStyle(element).backgroundColor).toBe('rgb(255, 255, 255)');

      // Simulate theme toggle
      document.documentElement.classList.add('dark');

      // Re-render with dark class
      const DarkWrapper = React.createElement(
        'div',
        { className: 'dark' },
        React.createElement(DarkModeTestComponent, {
          className: 'bg-white',
        })
      );
      rerender(DarkWrapper);

      expect(getComputedStyle(element).backgroundColor).toBe('rgb(17, 24, 39)');
    });
  });
});
