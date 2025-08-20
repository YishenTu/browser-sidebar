import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ThemeToggle } from '../../../src/sidebar/components/ThemeToggle';
import type { Theme } from '../../../src/types/settings';

// Mock the ThemeContext
const mockSetTheme = vi.fn();
const mockUseTheme = vi.fn();

vi.mock('../../../src/contexts/ThemeContext', () => ({
  useTheme: () => mockUseTheme(),
}));

// Note: ThemeProviderWrapper removed as tests mock useTheme directly

describe('ThemeToggle Component', () => {
  beforeEach(() => {
    // Setup default theme context mock
    mockUseTheme.mockReturnValue({
      theme: 'light' as Theme,
      effectiveTheme: 'light' as const,
      isSystemTheme: false,
      setTheme: mockSetTheme,
    });
  });

  afterEach(() => {
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
    mockUseTheme.mockReturnValue({
      theme: 'dark' as Theme,
      effectiveTheme: 'dark' as const,
      isSystemTheme: false,
      setTheme: mockSetTheme,
    });

    render(<ThemeToggle />);

    const darkButton = screen.getByRole('button', { name: /🌙 Dark/i });
    expect(darkButton).toHaveClass('theme-toggle__option--active');
  });

  it('should call setTheme when clicking theme option', () => {
    render(<ThemeToggle />);

    const darkButton = screen.getByRole('button', { name: /🌙 Dark/i });
    fireEvent.click(darkButton);

    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });

  it('should update active state when theme changes', () => {
    const { rerender } = render(<ThemeToggle />);

    // Initially light should be active
    const lightButton = screen.getByRole('button', { name: /☀️ Light/i });
    expect(lightButton).toHaveClass('theme-toggle__option--active');

    // Mock theme change to dark
    mockUseTheme.mockReturnValue({
      theme: 'dark' as Theme,
      effectiveTheme: 'dark' as const,
      isSystemTheme: false,
      setTheme: mockSetTheme,
    });

    // Re-render to see state update
    rerender(<ThemeToggle />);

    const darkButton = screen.getByRole('button', { name: /🌙 Dark/i });
    expect(darkButton).toHaveClass('theme-toggle__option--active');
  });

  it('should handle auto theme selection', () => {
    render(<ThemeToggle />);

    const autoButton = screen.getByRole('button', { name: /🌓 Auto/i });
    fireEvent.click(autoButton);

    expect(mockSetTheme).toHaveBeenCalledWith('auto');
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

  it('should initialize with current theme from context', () => {
    mockUseTheme.mockReturnValue({
      theme: 'auto' as Theme,
      effectiveTheme: 'light' as const,
      isSystemTheme: true,
      setTheme: mockSetTheme,
    });

    render(<ThemeToggle />);

    const autoButton = screen.getByRole('button', { name: /🌓 Auto/i });
    expect(autoButton).toHaveClass('theme-toggle__option--active');
  });
});
