import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { render, userEvent } from '@tests/utils/test-utils';
import { Sidebar } from '@sidebar/Sidebar';

// Mock the unmountSidebar function
vi.mock('@sidebar/index', () => ({
  unmountSidebar: vi.fn(),
}));

describe('Sidebar Component', () => {
  beforeEach(() => {
    // Clear DOM before each test
    document.body.innerHTML = '';
    document.head.innerHTML = '';
    
    // Mock window dimensions for consistent testing
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
    // Clean up after each test
    document.body.innerHTML = '';
    document.head.innerHTML = '';
    vi.clearAllMocks();
  });

  it('renders sidebar with correct structure and content', () => {
    render(<Sidebar />);

    // Check that main elements are rendered
    expect(screen.getByRole('dialog', { name: 'AI Browser Sidebar' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'AI Browser Sidebar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close sidebar' })).toBeInTheDocument();
    expect(screen.getByText('Chat with any webpage using AI')).toBeInTheDocument();
    expect(screen.getByText('Drag header to move • Drag left edge to resize')).toBeInTheDocument();
  });

  it('has correct accessibility attributes', () => {
    render(<Sidebar />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-label', 'AI Browser Sidebar');
    expect(dialog).toHaveAttribute('aria-modal', 'false');
    expect(dialog).toHaveAttribute('tabindex', '-1');

    const closeButton = screen.getByRole('button', { name: 'Close sidebar' });
    expect(closeButton).toHaveAttribute('title', 'Close (Esc)');
  });

  it('closes sidebar when close button is clicked', async () => {
    const user = userEvent.setup();
    render(<Sidebar />);

    const closeButton = screen.getByRole('button', { name: 'Close sidebar' });
    await user.click(closeButton);

    // Verify the close function was called
    const { unmountSidebar } = await import('@sidebar/index');
    expect(unmountSidebar).toHaveBeenCalledOnce();
  });

  it('closes sidebar when Escape key is pressed', async () => {
    const user = userEvent.setup();
    render(<Sidebar />);

    // Press Escape key
    await user.keyboard('{Escape}');

    // Verify the close function was called
    const { unmountSidebar } = await import('@sidebar/index');
    expect(unmountSidebar).toHaveBeenCalledOnce();
  });

  it('applies correct default styles and positioning', () => {
    render(<Sidebar />);

    const sidebar = screen.getByRole('dialog');
    const styles = window.getComputedStyle(sidebar);
    
    // Check that positioning and dimensions are set
    expect(sidebar).toHaveStyle({ width: '400px' }); // DEFAULT_WIDTH
    expect(sidebar).toHaveStyle({ height: '680px' }); // 85% of 800px window height
    expect(sidebar).toHaveStyle({ left: '800px' }); // window.innerWidth - DEFAULT_WIDTH
  });

  it('has resize handle element', () => {
    render(<Sidebar />);

    const resizeHandle = document.querySelector('.ai-sidebar-resize-handle');
    expect(resizeHandle).toBeInTheDocument();
  });

  it('header has proper dragging cursor styles', () => {
    render(<Sidebar />);

    const header = document.querySelector('.ai-sidebar-header') as HTMLElement;
    expect(header).toBeInTheDocument();
    
    // Default cursor should be grab
    expect(header).toHaveStyle({ cursor: 'grab' });
  });

  it('sends message to background script when closed', async () => {
    const user = userEvent.setup();
    render(<Sidebar />);

    const closeButton = screen.getByRole('button', { name: 'Close sidebar' });
    await user.click(closeButton);

    // Verify chrome.runtime.sendMessage was called
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'sidebar-closed' });
  });

  it('focuses sidebar on mount for accessibility', () => {
    render(<Sidebar />);

    const sidebar = screen.getByRole('dialog');
    expect(document.activeElement).toBe(sidebar);
  });
});