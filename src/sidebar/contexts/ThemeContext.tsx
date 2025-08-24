/* eslint-disable react-refresh/only-export-components */
/**
 * @file Theme Context
 *
 * React Context for theme management that integrates with the settings store
 * and theme utilities. Provides theme state and controls throughout the app.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useSettingsStore } from '@store/settings';
import { setTheme as setDOMTheme, getEffectiveTheme, createThemeMediaQueryListener } from './theme';
import type { Theme } from '@/types/settings';

/**
 * Theme context interface
 */
interface ThemeContextValue {
  /** Current theme setting ('light', 'dark', or 'auto') */
  theme: Theme;
  /** Effective theme after resolving 'auto' ('light' or 'dark') */
  effectiveTheme: 'light' | 'dark';
  /** Whether the theme is set to system/auto mode */
  isSystemTheme: boolean;
  /** Function to change the theme */
  setTheme: (theme: Theme) => Promise<void>;
}

/**
 * Theme context
 */
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * Hook to access theme context
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

/**
 * Theme provider props
 */
interface ThemeProviderProps {
  children: React.ReactNode;
}

/**
 * Theme provider component
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  const { settings, updateTheme, loadSettings } = useSettingsStore();
  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>('light');

  /**
   * Update the effective theme based on current theme setting
   */
  const updateEffectiveTheme = useCallback(() => {
    try {
      const effective = getEffectiveTheme();
      setEffectiveTheme(effective);
    } catch (error) {
      console.error('Failed to get effective theme:', error);
      setEffectiveTheme('light'); // Fallback
    }
  }, []);

  /**
   * Apply theme to DOM
   */
  const applyTheme = useCallback(
    (theme: Theme) => {
      try {
        setDOMTheme(theme);
        updateEffectiveTheme();
      } catch (error) {
        console.error('Failed to apply theme to DOM:', error);
      }
    },
    [updateEffectiveTheme]
  );

  /**
   * Handle theme changes
   */
  const handleSetTheme = useCallback(
    async (newTheme: Theme) => {
      try {
        // Apply theme to DOM immediately for responsiveness
        applyTheme(newTheme);

        // Persist to storage
        await updateTheme(newTheme);
      } catch (error) {
        console.error('Failed to update theme:', error);
        // Revert DOM changes on error
        applyTheme(settings.theme);
      }
    },
    [applyTheme, updateTheme, settings.theme]
  );

  /**
   * Handle system theme changes when in auto mode
   */
  const handleSystemThemeChange = useCallback(
    (_isDark: boolean) => {
      if (settings.theme === 'auto') {
        updateEffectiveTheme();
      }
    },
    [settings.theme, updateEffectiveTheme]
  );

  // Load settings on mount
  useEffect(() => {
    loadSettings().catch(error => {
      console.error('Failed to load settings:', error);
    });
  }, [loadSettings]);

  // Apply theme when settings change
  useEffect(() => {
    applyTheme(settings.theme);
  }, [settings.theme, applyTheme]);

  // Setup system theme listener
  useEffect(() => {
    const cleanup = createThemeMediaQueryListener(handleSystemThemeChange);
    return cleanup;
  }, [handleSystemThemeChange]);

  // Initial effective theme calculation
  useEffect(() => {
    updateEffectiveTheme();
  }, [updateEffectiveTheme]);

  const contextValue: ThemeContextValue = {
    theme: settings.theme,
    effectiveTheme,
    isSystemTheme: settings.theme === 'auto',
    setTheme: handleSetTheme,
  };

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
}

/**
 * Higher-order component to provide theme context
 */
export function withTheme<P extends object>(
  Component: React.ComponentType<P & { theme: ThemeContextValue }>
): React.ComponentType<P> {
  return function WrappedComponent(props: P) {
    const theme = useTheme();
    return <Component {...props} theme={theme} />;
  };
}

export default ThemeProvider;
