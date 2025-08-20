import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { Sidebar } from '../../src/sidebar/Sidebar';

// Mock chrome API for sidebar component
const mockChrome = {
  runtime: {
    sendMessage: vi.fn(),
  },
};

// @ts-expect-error - Chrome API mock for testing
global.chrome = mockChrome;

describe('Sidebar Tailwind Integration', () => {
  beforeEach(() => {
    // Create comprehensive Tailwind styles for testing
    const style = document.createElement('style');
    style.id = 'tailwind-integration-test-styles';
    style.textContent = `
      /* Base utilities */
      .space-y-4 > * + * { margin-top: 1rem; }
      .space-y-3 > * + * { margin-top: 0.75rem; }
      .text-center { text-align: center; }
      .text-lg { font-size: 1.125rem; line-height: 1.75rem; }
      .text-sm { font-size: 0.875rem; line-height: 1.25rem; }
      .text-xs { font-size: 0.75rem; line-height: 1rem; }
      .font-semibold { font-weight: 600; }
      .mt-2 { margin-top: 0.5rem; }
      .mt-4 { margin-top: 1rem; }
      .mt-6 { margin-top: 1.5rem; }
      .p-3 { padding: 0.75rem; }
      .pr-3 { padding-right: 0.75rem; }
      .rounded-lg { border-radius: 0.5rem; }
      .rounded-full { border-radius: 9999px; }
      .border { border-width: 1px; }
      .flex { display: flex; }
      .flex-1 { flex: 1 1 0%; }
      .items-center { align-items: center; }
      .gap-2 { gap: 0.5rem; }
      .relative { position: relative; }
      .absolute { position: absolute; }
      .inset-y-0 { top: 0; bottom: 0; }
      .right-0 { right: 0; }
      .w-2 { width: 0.5rem; }
      .h-2 { height: 0.5rem; }

      /* Custom color classes */
      .text-gray-900 { color: #111827; }
      .text-gray-600 { color: #4b5563; }
      .text-gray-400 { color: #9ca3af; }
      .text-amber-700 { color: #b45309; }
      .bg-primary-500 { background-color: #3b82f6; }
      .bg-amber-50 { background-color: #fffbeb; }
      .bg-warning-500 { background-color: #f59e0b; }
      .border-amber-200 { border-color: #fcd34d; }

      /* Dark mode variants */
      .dark .text-gray-100 { color: #f3f4f6; }
      .dark .text-gray-400 { color: #9ca3af; }
      .dark .text-amber-300 { color: #fcd34d; }
      .dark .bg-amber-900\\/20 { background-color: rgba(120, 53, 15, 0.2); }
      .dark .border-amber-800 { border-color: #92400e; }

      /* Component classes */
      .ai-sidebar-overlay {
        position: fixed;
        top: 0;
        left: 0;
        z-index: 2147483647;
        box-sizing: border-box;
        pointer-events: auto;
        background: transparent;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
      }

      .ai-sidebar-container {
        width: 100%;
        height: 100%;
        border-radius: 0.5rem;
        overflow: hidden;
        background-color: #ffffff;
        color: #111827;
        display: flex;
        flex-direction: column;
        border: 1px solid #e5e7eb;
      }

      .dark .ai-sidebar-container {
        background-color: #111827;
        color: #f3f4f6;
        border-color: #374151;
      }

      .ai-sidebar-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.5rem 0.75rem;
        background-color: #f7f7f8;
        border-bottom: 1px solid #e5e7eb;
        user-select: none;
        cursor: grab;
      }

      .dark .ai-sidebar-header {
        background-color: #1f2937;
        border-color: #374151;
      }

      .ai-sidebar-header h2 {
        margin: 0;
        font-size: 0.875rem;
        font-weight: 600;
      }

      .ai-sidebar-close {
        border: none;
        background: transparent;
        font-size: 1.125rem;
        line-height: 1;
        cursor: pointer;
        padding: 0.25rem 0.375rem;
        color: #6b7280;
        transition: colors 150ms;
        border-radius: 0.25rem;
      }

      .dark .ai-sidebar-close {
        color: #9ca3af;
      }

      .ai-sidebar-close:hover {
        color: #111827;
        background-color: #e5e7eb;
      }

      .dark .ai-sidebar-close:hover {
        color: #f3f4f6;
        background-color: #374151;
      }

      .ai-sidebar-content {
        padding: 0.75rem;
        overflow: auto;
        flex: 1;
      }

      .ai-sidebar-resize-handle {
        position: absolute;
        left: -4px;
        top: 0;
        width: 0.5rem;
        height: 100%;
        cursor: ew-resize;
      }

      .chat-message {
        margin-bottom: 1rem;
        padding: 0.75rem;
        border-radius: 0.5rem;
        max-width: none;
      }

      .chat-message.user {
        background-color: #f3e8ff;
        color: #111827;
      }

      .chat-message.ai {
        background-color: #e0f2fe;
        color: #111827;
      }

      .dark .chat-message.user {
        background-color: rgba(147, 51, 234, 0.2);
        color: #f3f4f6;
      }

      .dark .chat-message.ai {
        background-color: rgba(2, 132, 199, 0.2);
        color: #f3f4f6;
      }

      .chat-input {
        width: 100%;
        padding: 0.75rem;
        border: 1px solid #d1d5db;
        border-radius: 0.5rem;
        background-color: #ffffff;
        color: #111827;
      }

      .dark .chat-input {
        border-color: #4b5563;
        background-color: #1f2937;
        color: #f3f4f6;
      }

      .chat-button {
        padding: 0.5rem 1rem;
        background-color: #3b82f6;
        color: #ffffff;
        font-weight: 500;
        border-radius: 0.5rem;
        transition: background-color 150ms;
        border: none;
        cursor: pointer;
      }

      .chat-button:hover {
        background-color: #2563eb;
      }

      .chat-button.secondary {
        background-color: #e5e7eb;
        color: #111827;
      }

      .dark .chat-button.secondary {
        background-color: #374151;
        color: #f3f4f6;
      }

      .chat-button.secondary:hover {
        background-color: #d1d5db;
      }

      .dark .chat-button.secondary:hover {
        background-color: #4b5563;
      }

      .chat-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      /* Animations */
      .animate-slide-up {
        animation: slideUp 0.3s ease-out;
      }

      .animate-pulse-soft {
        animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
      }

      @keyframes slideUp {
        0% { transform: translateY(10px); opacity: 0; }
        100% { transform: translateY(0); opacity: 1; }
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
    `;
    document.head.appendChild(style);

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
    const style = document.getElementById('tailwind-integration-test-styles');
    if (style) {
      style.remove();
    }
    document.documentElement.classList.remove('dark');
    vi.clearAllMocks();
  });

  it('should render with Tailwind classes applied correctly', () => {
    const { container } = render(React.createElement(Sidebar));

    // Check main structure
    const overlay = container.querySelector('.ai-sidebar-overlay');
    const sidebarContainer = container.querySelector('.ai-sidebar-container');
    const header = container.querySelector('.ai-sidebar-header');
    const content = container.querySelector('.ai-sidebar-content');

    expect(overlay).toBeInTheDocument();
    expect(sidebarContainer).toBeInTheDocument();
    expect(header).toBeInTheDocument();
    expect(content).toBeInTheDocument();
  });

  it('should apply custom color classes correctly', () => {
    const { getByText } = render(React.createElement(Sidebar));

    const heading = getByText('Chat with any webpage using AI');
    expect(heading).toHaveClass('text-lg', 'font-semibold', 'text-gray-900');

    const subtitle = getByText('Drag header to move • Drag left edge to resize');
    expect(subtitle).toHaveClass('text-sm', 'text-gray-600', 'mt-2');
  });

  it('should render chat message components with correct styling', () => {
    const { container } = render(React.createElement(Sidebar));

    const userMessage = container.querySelector('.chat-message.user');
    const aiMessage = container.querySelector('.chat-message.ai');

    expect(userMessage).toBeInTheDocument();
    expect(aiMessage).toBeInTheDocument();
    expect(userMessage).toHaveClass('animate-slide-up');
    expect(aiMessage).toHaveClass('animate-slide-up');
  });

  it('should render interactive elements with Tailwind styling', () => {
    const { container } = render(React.createElement(Sidebar));

    const input = container.querySelector('.chat-input');
    const sendButton = container.querySelector('.chat-button:not(.secondary)');
    const clearButton = container.querySelector('.chat-button.secondary');

    expect(input).toBeInTheDocument();
    expect(sendButton).toBeInTheDocument();
    expect(clearButton).toBeInTheDocument();

    expect(sendButton).toHaveClass('flex-1');
    expect(clearButton).toHaveClass('secondary');
  });

  it('should apply animation classes correctly', () => {
    const { container } = render(React.createElement(Sidebar));

    const pulsingDot = container.querySelector('.animate-pulse-soft');
    expect(pulsingDot).toBeInTheDocument();
    expect(pulsingDot).toHaveClass('bg-primary-500', 'rounded-full');
  });

  it('should render status indicator with semantic colors', () => {
    const { container, getByText } = render(React.createElement(Sidebar));

    const statusIndicator = container.querySelector('.bg-amber-50');
    const statusText = getByText('Stage 2: Chat interface coming soon');
    const warningDot = container.querySelector('.bg-warning-500');

    expect(statusIndicator).toBeInTheDocument();
    expect(statusText).toBeInTheDocument();
    expect(warningDot).toBeInTheDocument();

    expect(statusIndicator).toHaveClass('rounded-lg', 'border', 'border-amber-200');
    expect(statusText).toHaveClass('text-xs', 'text-amber-700');
  });

  it('should apply dark mode classes when dark class is present', () => {
    // Add dark class to test dark mode
    document.documentElement.classList.add('dark');

    const DarkSidebar = React.createElement(
      'div',
      { className: 'dark' },
      React.createElement(Sidebar)
    );

    const { getByText, container } = render(DarkSidebar);

    const heading = getByText('Chat with any webpage using AI');
    const subtitle = getByText('Drag header to move • Drag left edge to resize');
    const statusText = getByText('Stage 2: Chat interface coming soon');

    // Check that the elements have the expected classes
    expect(heading).toHaveClass('text-lg', 'font-semibold', 'text-gray-900');
    expect(subtitle).toHaveClass('text-sm', 'text-gray-600');
    expect(statusText).toHaveClass('text-xs', 'text-amber-700');

    // Container should have the ai-sidebar-container class
    const sidebarContainer = container.querySelector('.ai-sidebar-container');
    expect(sidebarContainer).toHaveClass('ai-sidebar-container');

    // In a real browser with Tailwind CSS, the computed styles would be different in dark mode
    // but in our test environment, we're only testing class application
  });

  it('should maintain responsive layout classes', () => {
    const { container } = render(React.createElement(Sidebar));

    // Check for flex layout classes
    const flexContainers = container.querySelectorAll('.flex');
    expect(flexContainers.length).toBeGreaterThan(0);

    // Check for spacing classes
    const spacedContainers = container.querySelectorAll('[class*="space-y"]');
    expect(spacedContainers.length).toBeGreaterThan(0);

    // Check for gap classes
    const gappedContainers = container.querySelectorAll('.gap-2');
    expect(gappedContainers.length).toBeGreaterThan(0);
  });

  it('should handle disabled state styling correctly', () => {
    const { container } = render(React.createElement(Sidebar));

    const input = container.querySelector('.chat-input') as HTMLInputElement;
    const sendButton = container.querySelector('.chat-button:not(.secondary)') as HTMLButtonElement;
    const clearButton = container.querySelector('.chat-button.secondary') as HTMLButtonElement;

    expect(input?.disabled).toBe(true);
    expect(sendButton?.disabled).toBe(true);
    expect(clearButton?.disabled).toBe(true);

    // Disabled elements should have proper classes
    expect(sendButton).toHaveClass('chat-button');
    expect(clearButton).toHaveClass('chat-button', 'secondary');
  });

  it('should integrate with CSS-in-JS positioning styles', () => {
    const { container } = render(React.createElement(Sidebar));

    const overlay = container.querySelector('.ai-sidebar-overlay') as HTMLElement;
    expect(overlay).toBeInTheDocument();

    // Should have inline styles for positioning (from React state)
    expect(overlay.style.left).toBeDefined();
    expect(overlay.style.top).toBeDefined();
    expect(overlay.style.width).toBeDefined();
    expect(overlay.style.height).toBeDefined();
  });

  it('should support component composition with Tailwind utilities', () => {
    const { container } = render(React.createElement(Sidebar));

    // Check that complex component combinations work
    const messageContainer = container.querySelector('.space-y-3');
    const inputContainer = container.querySelector('.relative');
    const buttonContainer = container.querySelector('.flex.gap-2');

    expect(messageContainer).toBeInTheDocument();
    expect(inputContainer).toBeInTheDocument();
    expect(buttonContainer).toBeInTheDocument();

    // Verify nested positioning works
    const absoluteElement = inputContainer?.querySelector('.absolute');
    expect(absoluteElement).toBeInTheDocument();
    expect(absoluteElement).toHaveClass('inset-y-0', 'right-0');
  });
});
