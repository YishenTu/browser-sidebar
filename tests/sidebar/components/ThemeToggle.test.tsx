import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ThemeToggle } from '../../../src/sidebar/components/ThemeToggle';
import * as themeUtils from '../../../src/utils/theme';

// Mock the theme utilities
vi.mock('../../../src/utils/theme', () => ({
  getCurrentTheme: vi.fn(),
  setTheme: vi.fn(),
}));

describe('ThemeToggle Component', () => {
  let mockContainer: HTMLElement;

  beforeEach(() => {
    // Create mock sidebar container
    mockContainer = document.createElement('div');
    mockContainer.className = 'ai-sidebar-container';
    mockContainer.setAttribute('data-theme', 'light');
    document.body.appendChild(mockContainer);

    // Mock getCurrentTheme to return 'light' by default
    vi.mocked(themeUtils.getCurrentTheme).mockReturnValue('light');
  });

  afterEach(() => {
    if (document.body.contains(mockContainer)) {
      document.body.removeChild(mockContainer);
    }
    vi.clearAllMocks();
  });

  it('should render all theme options', () => {
    render(<ThemeToggle />);

    expect(screen.getByText('Light')).toBeInTheDocument();
    expect(screen.getByText('Dark')).toBeInTheDocument();
    expect(screen.getByText('Auto')).toBeInTheDocument();
    expect(screen.getByText('Theme:')).toBeInTheDocument();
  });

  it('should show current theme as active', () => {
    vi.mocked(themeUtils.getCurrentTheme).mockReturnValue('dark');

    render(<ThemeToggle />);

    const darkButton = screen.getByRole('button', { name: /🌙 Dark/i });
    expect(darkButton).toHaveClass('theme-toggle__option--active');
  });

  it('should call setTheme when clicking theme option', () => {
    render(<ThemeToggle />);

    const darkButton = screen.getByRole('button', { name: /🌙 Dark/i });
    fireEvent.click(darkButton);

    expect(themeUtils.setTheme).toHaveBeenCalledWith('dark');
  });

  it('should update active state when theme changes', () => {
    const { rerender } = render(<ThemeToggle />);

    // Initially light should be active
    const lightButton = screen.getByRole('button', { name: /☀️ Light/i });
    expect(lightButton).toHaveClass('theme-toggle__option--active');

    // Mock theme change to dark
    vi.mocked(themeUtils.getCurrentTheme).mockReturnValue('dark');

    // Click dark theme
    const darkButton = screen.getByRole('button', { name: /🌙 Dark/i });
    fireEvent.click(darkButton);

    // Re-render to see state update
    rerender(<ThemeToggle />);

    expect(darkButton).toHaveClass('theme-toggle__option--active');
  });

  it('should handle auto theme selection', () => {
    render(<ThemeToggle />);

    const autoButton = screen.getByRole('button', { name: /🌓 Auto/i });
    fireEvent.click(autoButton);

    expect(themeUtils.setTheme).toHaveBeenCalledWith('auto');
  });

  it('should apply custom className', () => {
    const { container } = render(<ThemeToggle className="custom-class" />);

    const themeToggle = container.querySelector('.theme-toggle');
    expect(themeToggle).toHaveClass('custom-class');
  });

  it('should show emoji icons for each theme', () => {
    render(<ThemeToggle />);

    // Check for emoji presence (text content includes emojis)
    expect(screen.getByText('☀️')).toBeInTheDocument(); // Light
    expect(screen.getByText('🌙')).toBeInTheDocument(); // Dark
    expect(screen.getByText('🌓')).toBeInTheDocument(); // Auto
  });

  it('should have accessible button labels', () => {
    render(<ThemeToggle />);

    expect(screen.getByRole('button', { name: /☀️ Light/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /🌙 Dark/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /🌓 Auto/i })).toBeInTheDocument();
  });

  it('should initialize with current theme from utils', () => {
    vi.mocked(themeUtils.getCurrentTheme).mockReturnValue('auto');

    render(<ThemeToggle />);

    expect(themeUtils.getCurrentTheme).toHaveBeenCalled();

    const autoButton = screen.getByRole('button', { name: /🌓 Auto/i });
    expect(autoButton).toHaveClass('theme-toggle__option--active');
  });
});
