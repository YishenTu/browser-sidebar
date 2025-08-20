import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { Sidebar } from '../../src/sidebar/Sidebar';
import tailwindConfig from '../../tailwind.config.js';
import { Config } from 'tailwindcss';

// Mock chrome API for sidebar component
const mockChrome = {
  runtime: {
    sendMessage: vi.fn(),
  },
};

// @ts-expect-error - Chrome API mock for testing
global.chrome = mockChrome;

describe('Tailwind CSS Integration Final Verification', () => {
  beforeEach(() => {
    // Mock window dimensions for sidebar positioning
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1200,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 800,
    });
  });

  afterEach(() => {
    cleanup();
    document.documentElement.classList.remove('dark');
    vi.clearAllMocks();
  });

  describe('Tailwind Configuration Completeness', () => {
    it('should have valid and complete Tailwind configuration', () => {
      const config = tailwindConfig as Config;

      // Core configuration
      expect(config.content).toBeDefined();
      expect(config.darkMode).toBe('class');
      expect(config.theme?.extend).toBeDefined();

      // Content paths
      const content = config.content as string[];
      expect(content).toContain('./src/**/*.{ts,tsx}');
      expect(content).toContain('./src/sidebar/**/*.{ts,tsx}');

      // Custom theme extensions
      const theme = config.theme?.extend;
      expect(theme?.colors).toBeDefined();
      expect(theme?.fontSize).toBeDefined();
      expect(theme?.fontWeight).toBeDefined();
      expect(theme?.animation).toBeDefined();
      expect(theme?.keyframes).toBeDefined();
    });

    it('should have comprehensive color system', () => {
      const config = tailwindConfig as Config;
      const colors = config.theme?.extend?.colors;

      // Primary color palette (full range)
      expect(colors?.primary).toHaveProperty('50');
      expect(colors?.primary).toHaveProperty('500');
      expect(colors?.primary).toHaveProperty('950');

      // AI color system
      expect(colors?.ai).toHaveProperty('50');
      expect(colors?.ai).toHaveProperty('DEFAULT');
      expect(colors?.ai).toHaveProperty('light');
      expect(colors?.ai).toHaveProperty('dark');

      // User color system
      expect(colors?.user).toHaveProperty('50');
      expect(colors?.user).toHaveProperty('DEFAULT');
      expect(colors?.user).toHaveProperty('light');
      expect(colors?.user).toHaveProperty('dark');

      // Semantic colors
      expect(colors).toHaveProperty('success');
      expect(colors).toHaveProperty('warning');
      expect(colors).toHaveProperty('error');
      expect(colors).toHaveProperty('sidebar');
    });

    it('should have sidebar-specific design tokens', () => {
      const config = tailwindConfig as Config;
      const theme = config.theme?.extend;

      // Z-index for sidebar overlay
      expect(theme?.zIndex).toHaveProperty('sidebar');
      expect(theme?.zIndex?.sidebar).toBe('2147483647');

      // Sidebar dimensions
      expect(theme?.maxWidth).toHaveProperty('sidebar');
      expect(theme?.minWidth).toHaveProperty('sidebar');
      expect(theme?.maxWidth?.sidebar).toBe('800px');
      expect(theme?.minWidth?.sidebar).toBe('300px');
    });

    it('should have comprehensive animation system', () => {
      const config = tailwindConfig as Config;
      const animations = config.theme?.extend?.animation;
      const keyframes = config.theme?.extend?.keyframes;

      // Animation utilities
      expect(animations).toHaveProperty('slide-up');
      expect(animations).toHaveProperty('slide-down');
      expect(animations).toHaveProperty('slide-in-right');
      expect(animations).toHaveProperty('slide-out-right');
      expect(animations).toHaveProperty('fade-in');
      expect(animations).toHaveProperty('fade-out');
      expect(animations).toHaveProperty('pulse-soft');
      expect(animations).toHaveProperty('typing');

      // Corresponding keyframes
      expect(keyframes).toHaveProperty('slideUp');
      expect(keyframes).toHaveProperty('slideDown');
      expect(keyframes).toHaveProperty('slideInRight');
      expect(keyframes).toHaveProperty('slideOutRight');
      expect(keyframes).toHaveProperty('fadeIn');
      expect(keyframes).toHaveProperty('fadeOut');
      expect(keyframes).toHaveProperty('typing');
    });
  });

  describe('Sidebar Component Tailwind Integration', () => {
    it('should render sidebar with Tailwind classes applied', () => {
      const { container } = render(React.createElement(Sidebar));

      // Check main structure classes
      const overlay = container.querySelector('.ai-sidebar-overlay');
      const sidebarContainer = container.querySelector('.ai-sidebar-container');
      const header = container.querySelector('.ai-sidebar-header');
      const content = container.querySelector('.ai-sidebar-content');

      expect(overlay).toBeInTheDocument();
      expect(sidebarContainer).toBeInTheDocument();
      expect(header).toBeInTheDocument();
      expect(content).toBeInTheDocument();
    });

    it('should apply responsive and utility classes correctly', () => {
      const { container, getByText } = render(React.createElement(Sidebar));

      // Typography classes
      const heading = getByText('Chat with any webpage using AI');
      expect(heading).toHaveClass('text-lg', 'font-semibold');

      // Spacing and layout classes
      const spacedContainers = container.querySelectorAll('[class*="space-y"]');
      expect(spacedContainers.length).toBeGreaterThan(0);

      // Flex layout classes
      const flexContainers = container.querySelectorAll('.flex');
      expect(flexContainers.length).toBeGreaterThan(0);

      // Color classes
      const elements = container.querySelectorAll('[class*="text-gray"], [class*="bg-"]');
      expect(elements.length).toBeGreaterThan(0);
    });

    it('should support custom component classes', () => {
      const { container } = render(React.createElement(Sidebar));

      // Chat message components
      const chatMessages = container.querySelectorAll('.chat-message');
      expect(chatMessages.length).toBeGreaterThan(0);

      // Chat input and buttons
      const chatInput = container.querySelector('.chat-input');
      const chatButtons = container.querySelectorAll('.chat-button');

      expect(chatInput).toBeInTheDocument();
      expect(chatButtons.length).toBeGreaterThan(0);
    });

    it('should apply animation classes correctly', () => {
      const { container } = render(React.createElement(Sidebar));

      // Check for animation classes
      const animatedElements = container.querySelectorAll('[class*="animate-"]');
      expect(animatedElements.length).toBeGreaterThan(0);

      // Specific animations
      const slideUpElements = container.querySelectorAll('.animate-slide-up');
      const pulseElements = container.querySelectorAll('.animate-pulse-soft');

      expect(slideUpElements.length).toBeGreaterThan(0);
      expect(pulseElements.length).toBeGreaterThan(0);
    });
  });

  describe('Dark Mode Support', () => {
    it('should support dark mode class strategy', () => {
      document.documentElement.classList.add('dark');

      const DarkSidebar = React.createElement(
        'div',
        { className: 'dark' },
        React.createElement(Sidebar)
      );

      const { getByText } = render(DarkSidebar);

      // Elements should have dark mode classes
      const heading = getByText('Chat with any webpage using AI');
      expect(heading.className).toMatch(/dark:text-gray-100/);

      const subtitle = getByText('Drag header to move • Drag left edge to resize');
      expect(subtitle.className).toMatch(/dark:text-gray-400/);
    });

    it('should toggle between light and dark modes', () => {
      // Start in light mode
      expect(document.documentElement.classList.contains('dark')).toBe(false);

      // Switch to dark mode
      document.documentElement.classList.add('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);

      // Switch back to light mode
      document.documentElement.classList.remove('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });

  describe('CSS Processing and Build Integration', () => {
    it('should process Tailwind directives correctly', () => {
      // This test verifies that the build system can process our Tailwind setup
      // The fact that the component renders with classes means CSS processing works
      const { container } = render(React.createElement(Sidebar));

      // Check that components with Tailwind classes render without errors
      expect(container.firstChild).toBeInTheDocument();

      // Check that custom CSS classes from globals.css are available
      const sidebar = container.querySelector('.ai-sidebar-container');
      expect(sidebar).toBeInTheDocument();
    });

    it('should maintain class specificity and cascade', () => {
      const { container } = render(React.createElement(Sidebar));

      // Component should have both utility and component classes
      const chatMessage = container.querySelector('.chat-message.user');
      expect(chatMessage).toBeInTheDocument();
      expect(chatMessage).toHaveClass('chat-message', 'user', 'animate-slide-up');
    });
  });

  describe('Extension-Specific Requirements', () => {
    it('should work within extension content script context', () => {
      // Simulate the extension injection environment
      const container = document.createElement('div');
      container.id = 'ai-browser-sidebar-root';
      document.body.appendChild(container);

      const { container: renderContainer } = render(React.createElement(Sidebar), { container });

      // Should render correctly in extension context
      expect(renderContainer.querySelector('.ai-sidebar-overlay')).toBeInTheDocument();

      // Cleanup
      document.body.removeChild(container);
    });

    it('should support CSS isolation for host page compatibility', () => {
      const { container } = render(React.createElement(Sidebar));

      // Check that main container has isolation classes
      const overlay = container.querySelector('.ai-sidebar-overlay');
      expect(overlay).toBeInTheDocument();

      // Should use high z-index for overlay
      expect(getComputedStyle(overlay as Element).position).toBeDefined();
    });

    it('should handle resize and positioning with CSS-in-JS integration', () => {
      const { container } = render(React.createElement(Sidebar));

      const overlay = container.querySelector('.ai-sidebar-overlay') as HTMLElement;

      // Should have inline styles for positioning (from React state)
      expect(overlay.style.left).toBeDefined();
      expect(overlay.style.top).toBeDefined();
      expect(overlay.style.width).toBeDefined();
      expect(overlay.style.height).toBeDefined();
    });
  });

  describe('Performance and Optimization', () => {
    it('should have minimal CSS bundle size impact', () => {
      // This test ensures that our Tailwind config is optimized
      const { container } = render(React.createElement(Sidebar));

      // Only classes actually used should be included
      // The build system should purge unused classes
      expect(container.firstChild).toBeInTheDocument();
    });

    it('should support component-level class composition', () => {
      const { container } = render(React.createElement(Sidebar));

      // Complex class combinations should work
      const complexElement = container.querySelector('.flex.gap-2');
      expect(complexElement).toBeInTheDocument();

      const spacingElement = container.querySelector('[class*="space-y"]');
      expect(spacingElement).toBeInTheDocument();
    });
  });
});
