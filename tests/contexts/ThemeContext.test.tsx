/**
 * @file ThemeContext Tests
 *
 * Comprehensive test suite for the ThemeContext using TDD methodology.
 * Tests theme switching, persistence, system detection, and React integration.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';
import { chromeMockUtils } from '../setup/chrome-mock';

// Mock the theme utilities before importing the context
vi.mock('../../src/utils/theme', () => ({
  getCurrentTheme: vi.fn(),
  setTheme: vi.fn(),
  getEffectiveTheme: vi.fn(),
  createThemeMediaQueryListener: vi.fn(),
  getSidebarContainer: vi.fn(),
}));

// Mock the settings store before importing the context
vi.mock('../../src/store/settings', () => ({
  useSettingsStore: vi.fn(),
}));

// Import after mocking
import { ThemeProvider, useTheme } from '../../src/contexts/ThemeContext';
import { useSettingsStore } from '../../src/store/settings';
import * as themeUtils from '../../src/utils/theme';
import type { Theme } from '../../src/types/settings';

// Test component to use the theme context
const TestComponent = ({ onThemeChange }: { onThemeChange?: (theme: Theme, effectiveTheme: 'light' | 'dark') => void }) => {
  const { theme, effectiveTheme, setTheme, isSystemTheme } = useTheme();
  
  React.useEffect(() => {
    if (onThemeChange) {
      onThemeChange(theme, effectiveTheme);
    }
  }, [theme, effectiveTheme, onThemeChange]);

  return (
    <div>
      <div data-testid="current-theme">{theme}</div>
      <div data-testid="effective-theme">{effectiveTheme}</div>
      <div data-testid="is-system-theme">{isSystemTheme.toString()}</div>
      <button 
        data-testid="set-light" 
        onClick={() => setTheme('light')}
      >
        Set Light
      </button>
      <button 
        data-testid="set-dark" 
        onClick={() => setTheme('dark')}
      >
        Set Dark
      </button>
      <button 
        data-testid="set-auto" 
        onClick={() => setTheme('auto')}
      >
        Set Auto
      </button>
    </div>
  );
};

// Mock media query list
const createMockMediaQueryList = (matches: boolean) => ({
  matches,
  media: '(prefers-color-scheme: dark)',
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
  dispatchEvent: vi.fn(),
  onchange: null,
});

describe('ThemeContext', () => {
  // Mock functions
  const mockUpdateTheme = vi.fn();
  const mockLoadSettings = vi.fn();
  const mockSetTheme = vi.fn();
  const mockGetCurrentTheme = vi.fn();
  const mockGetEffectiveTheme = vi.fn();
  const mockCreateThemeMediaQueryListener = vi.fn();
  const mockGetSidebarContainer = vi.fn();

  // Mock media query
  let mockMediaQueryList: ReturnType<typeof createMockMediaQueryList>;
  let mockMatchMedia: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    chromeMockUtils.resetMocks();

    // Setup media query mocks
    mockMediaQueryList = createMockMediaQueryList(false);
    mockMatchMedia = vi.fn(() => mockMediaQueryList);
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: mockMatchMedia,
    });

    // Setup theme utility mocks
    mockGetCurrentTheme.mockReturnValue('light');
    mockGetEffectiveTheme.mockReturnValue('light');
    mockGetSidebarContainer.mockReturnValue(document.createElement('div'));
    mockCreateThemeMediaQueryListener.mockReturnValue(() => {});

    vi.mocked(themeUtils.getCurrentTheme).mockImplementation(mockGetCurrentTheme);
    vi.mocked(themeUtils.setTheme).mockImplementation(mockSetTheme);
    vi.mocked(themeUtils.getEffectiveTheme).mockImplementation(mockGetEffectiveTheme);
    vi.mocked(themeUtils.createThemeMediaQueryListener).mockImplementation(mockCreateThemeMediaQueryListener);
    vi.mocked(themeUtils.getSidebarContainer).mockImplementation(mockGetSidebarContainer);

    // Setup settings store mock
    mockLoadSettings.mockResolvedValue(undefined);
    mockUpdateTheme.mockResolvedValue(undefined);

    const mockSettingsStore = {
      settings: {
        theme: 'light' as Theme,
        version: 1,
        ui: {
          fontSize: 'medium' as const,
          compactMode: false,
          showTimestamps: true,
          showAvatars: true,
          animationsEnabled: true,
        },
        ai: {
          defaultProvider: null,
          temperature: 0.7,
          maxTokens: 2048,
          streamResponse: true,
        },
        privacy: {
          saveConversations: true,
          shareAnalytics: false,
          clearOnClose: false,
        },
        apiKeys: {
          openai: null,
          anthropic: null,
          google: null,
        },
      },
      isLoading: false,
      error: null,
      updateTheme: mockUpdateTheme,
      loadSettings: mockLoadSettings,
      updateUIPreferences: vi.fn().mockResolvedValue(undefined),
      updateAISettings: vi.fn().mockResolvedValue(undefined),
      updatePrivacySettings: vi.fn().mockResolvedValue(undefined),
      updateAPIKeyReferences: vi.fn().mockResolvedValue(undefined),
      resetToDefaults: vi.fn().mockResolvedValue(undefined),
      setError: vi.fn(),
    };

    vi.mocked(useSettingsStore).mockReturnValue(mockSettingsStore);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('ThemeProvider Initialization', () => {
    it('should provide theme context to child components', () => {
      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('current-theme')).toBeInTheDocument();
      expect(screen.getByTestId('effective-theme')).toBeInTheDocument();
      expect(screen.getByTestId('is-system-theme')).toBeInTheDocument();
    });

    it('should initialize with theme from settings store', () => {
      const mockStore = vi.mocked(useSettingsStore).getMockImplementation()!;
      vi.mocked(useSettingsStore).mockReturnValue({
        ...mockStore(),
        settings: {
          ...mockStore().settings,
          theme: 'dark',
        },
      });

      mockGetCurrentTheme.mockReturnValue('dark');
      mockGetEffectiveTheme.mockReturnValue('dark');

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('current-theme')).toHaveTextContent('dark');
      expect(screen.getByTestId('effective-theme')).toHaveTextContent('dark');
    });

    it('should load settings on mount', () => {
      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      expect(mockLoadSettings).toHaveBeenCalled();
    });

    it('should apply theme to sidebar container on initialization', () => {
      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      expect(mockSetTheme).toHaveBeenCalledWith('light');
    });

    it('should throw error when useTheme is used outside provider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<TestComponent />);
      }).toThrow('useTheme must be used within a ThemeProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('Theme Switching', () => {
    it('should update theme when setTheme is called', async () => {
      mockUpdateTheme.mockResolvedValue(undefined);

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      fireEvent.click(screen.getByTestId('set-dark'));

      await waitFor(() => {
        expect(mockUpdateTheme).toHaveBeenCalledWith('dark');
      });
    });

    it('should update DOM when theme changes', async () => {
      mockUpdateTheme.mockResolvedValue(undefined);

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      fireEvent.click(screen.getByTestId('set-dark'));

      await waitFor(() => {
        expect(mockSetTheme).toHaveBeenCalledWith('dark');
      });
    });

    it('should handle all theme modes', async () => {
      mockUpdateTheme.mockResolvedValue(undefined);

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      // Test light theme
      fireEvent.click(screen.getByTestId('set-light'));
      await waitFor(() => {
        expect(mockUpdateTheme).toHaveBeenCalledWith('light');
      });

      // Test dark theme
      fireEvent.click(screen.getByTestId('set-dark'));
      await waitFor(() => {
        expect(mockUpdateTheme).toHaveBeenCalledWith('dark');
      });

      // Test auto theme
      fireEvent.click(screen.getByTestId('set-auto'));
      await waitFor(() => {
        expect(mockUpdateTheme).toHaveBeenCalledWith('auto');
      });
    });

    it('should update effective theme when theme changes', async () => {
      mockUpdateTheme.mockResolvedValue(undefined);
      
      // First render with light theme
      const { rerender } = render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('effective-theme')).toHaveTextContent('light');

      // Update mock to return dark theme
      mockGetEffectiveTheme.mockReturnValue('dark');

      // Trigger theme change
      fireEvent.click(screen.getByTestId('set-dark'));

      // Force re-render with new theme
      const mockStore = vi.mocked(useSettingsStore).getMockImplementation()!;
      vi.mocked(useSettingsStore).mockReturnValue({
        ...mockStore(),
        settings: {
          ...mockStore().settings,
          theme: 'dark',
        },
      });

      rerender(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('effective-theme')).toHaveTextContent('dark');
      });
    });
  });

  describe('System Theme Detection', () => {
    it('should detect system theme preference', () => {
      mockMediaQueryList.matches = true;
      mockGetEffectiveTheme.mockReturnValue('dark');

      const mockStore = vi.mocked(useSettingsStore).getMockImplementation()!;
      vi.mocked(useSettingsStore).mockReturnValue({
        ...mockStore(),
        settings: {
          ...mockStore().settings,
          theme: 'auto',
        },
      });

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('is-system-theme')).toHaveTextContent('true');
      expect(screen.getByTestId('effective-theme')).toHaveTextContent('dark');
    });

    it('should respond to system theme changes when in auto mode', () => {
      let mediaQueryCallback: (isDark: boolean) => void;
      mockCreateThemeMediaQueryListener.mockImplementation((callback) => {
        mediaQueryCallback = callback;
        return () => {};
      });

      const mockStore = vi.mocked(useSettingsStore).getMockImplementation()!;
      vi.mocked(useSettingsStore).mockReturnValue({
        ...mockStore(),
        settings: {
          ...mockStore().settings,
          theme: 'auto',
        },
      });

      const onThemeChange = vi.fn();

      render(
        <ThemeProvider>
          <TestComponent onThemeChange={onThemeChange} />
        </ThemeProvider>
      );

      // Simulate system theme change to dark
      act(() => {
        mockGetEffectiveTheme.mockReturnValue('dark');
        mediaQueryCallback!(true);
      });

      expect(onThemeChange).toHaveBeenCalledWith('auto', 'dark');
    });

    it('should not respond to system theme changes when not in auto mode', () => {
      let mediaQueryCallback: (isDark: boolean) => void;
      mockCreateThemeMediaQueryListener.mockImplementation((callback) => {
        mediaQueryCallback = callback;
        return () => {};
      });

      const mockStore = vi.mocked(useSettingsStore).getMockImplementation()!;
      vi.mocked(useSettingsStore).mockReturnValue({
        ...mockStore(),
        settings: {
          ...mockStore().settings,
          theme: 'light',
        },
      });

      const onThemeChange = vi.fn();

      render(
        <ThemeProvider>
          <TestComponent onThemeChange={onThemeChange} />
        </ThemeProvider>
      );

      // Clear the initial call
      onThemeChange.mockClear();

      // Simulate system theme change to dark (should not affect light theme)
      act(() => {
        mediaQueryCallback!(true);
      });

      expect(onThemeChange).not.toHaveBeenCalled();
    });

    it('should cleanup media query listener on unmount', () => {
      const mockCleanup = vi.fn();
      mockCreateThemeMediaQueryListener.mockReturnValue(mockCleanup);

      const { unmount } = render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      unmount();

      expect(mockCleanup).toHaveBeenCalled();
    });
  });

  describe('Theme Persistence', () => {
    it('should persist theme changes to settings store', async () => {
      mockUpdateTheme.mockResolvedValue(undefined);

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      fireEvent.click(screen.getByTestId('set-dark'));

      await waitFor(() => {
        expect(mockUpdateTheme).toHaveBeenCalledWith('dark');
      });
    });

    it('should handle theme persistence errors gracefully', async () => {
      const error = new Error('Storage failed');
      mockUpdateTheme.mockRejectedValue(error);

      // Mock console.error to avoid test output pollution
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      fireEvent.click(screen.getByTestId('set-dark'));

      await waitFor(() => {
        expect(mockUpdateTheme).toHaveBeenCalledWith('dark');
      });

      // Should log the error
      expect(consoleSpy).toHaveBeenCalledWith('Failed to update theme:', error);

      consoleSpy.mockRestore();
    });

    it('should sync with settings store changes', () => {
      const mockStore = vi.mocked(useSettingsStore).getMockImplementation()!;
      
      const { rerender } = render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('current-theme')).toHaveTextContent('light');

      // Simulate settings store update
      vi.mocked(useSettingsStore).mockReturnValue({
        ...mockStore(),
        settings: {
          ...mockStore().settings,
          theme: 'dark',
        },
      });

      mockGetCurrentTheme.mockReturnValue('dark');
      mockGetEffectiveTheme.mockReturnValue('dark');

      rerender(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('current-theme')).toHaveTextContent('dark');
    });
  });

  describe('Theme Context State', () => {
    it('should correctly identify system theme mode', () => {
      const mockStore = vi.mocked(useSettingsStore).getMockImplementation()!;
      
      // Test auto mode
      vi.mocked(useSettingsStore).mockReturnValue({
        ...mockStore(),
        settings: {
          ...mockStore().settings,
          theme: 'auto',
        },
      });

      const { rerender } = render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('is-system-theme')).toHaveTextContent('true');

      // Test non-auto mode
      vi.mocked(useSettingsStore).mockReturnValue({
        ...mockStore(),
        settings: {
          ...mockStore().settings,
          theme: 'light',
        },
      });

      rerender(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('is-system-theme')).toHaveTextContent('false');
    });

    it('should provide correct theme and effective theme values', () => {
      // Test light theme
      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('current-theme')).toHaveTextContent('light');
      expect(screen.getByTestId('effective-theme')).toHaveTextContent('light');
    });

    it('should update state immediately on theme change', async () => {
      mockUpdateTheme.mockResolvedValue(undefined);

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      // Initial state
      expect(screen.getByTestId('current-theme')).toHaveTextContent('light');

      // Change theme
      fireEvent.click(screen.getByTestId('set-dark'));

      // Should update immediately (optimistically)
      await waitFor(() => {
        expect(mockUpdateTheme).toHaveBeenCalledWith('dark');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle settings loading errors', () => {
      const mockStore = vi.mocked(useSettingsStore).getMockImplementation()!;
      vi.mocked(useSettingsStore).mockReturnValue({
        ...mockStore(),
        error: 'Failed to load settings',
      });

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      // Should still render with fallback theme
      expect(screen.getByTestId('current-theme')).toBeInTheDocument();
    });

    it('should handle missing sidebar container gracefully', () => {
      mockGetSidebarContainer.mockReturnValue(null);

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      // Should still provide context
      expect(screen.getByTestId('current-theme')).toBeInTheDocument();
    });

    it('should handle theme utility errors gracefully', () => {
      mockGetCurrentTheme.mockImplementation(() => {
        throw new Error('Theme utility error');
      });

      // Mock console.error to avoid test output pollution
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      // Should still render with default theme
      expect(screen.getByTestId('current-theme')).toBeInTheDocument();

      consoleSpy.mockRestore();
    });
  });
});