/**
 * Theme System Utilities
 * Provides functions for theme switching and CSS variable access
 */

export type ThemeMode = 'light' | 'dark' | 'auto';

/**
 * Gets the current theme mode from the sidebar container
 */
export function getCurrentTheme(container?: HTMLElement): ThemeMode {
  const sidebarContainer = container || getSidebarContainer();
  if (!sidebarContainer) return 'light';

  const theme = sidebarContainer.getAttribute('data-theme') as ThemeMode;
  return theme || 'light';
}

/**
 * Sets the theme on the sidebar container
 */
export function setTheme(theme: ThemeMode, container?: HTMLElement): void {
  const sidebarContainer = container || getSidebarContainer();
  if (!sidebarContainer) return;

  // Temporarily disable transitions to prevent flash
  sidebarContainer.classList.add('no-transitions');

  // Set the theme
  sidebarContainer.setAttribute('data-theme', theme);

  // Re-enable transitions after a frame
  requestAnimationFrame(() => {
    sidebarContainer.classList.remove('no-transitions');
  });
}

/**
 * Toggles between light and dark themes
 */
export function toggleTheme(container?: HTMLElement): ThemeMode {
  const current = getCurrentTheme(container);
  const newTheme: ThemeMode = current === 'dark' ? 'light' : 'dark';
  setTheme(newTheme, container);
  return newTheme;
}

/**
 * Gets the effective theme (resolves 'auto' to actual theme)
 */
export function getEffectiveTheme(container?: HTMLElement): 'light' | 'dark' {
  const theme = getCurrentTheme(container);

  if (theme === 'auto') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  return theme;
}

/**
 * Gets a CSS variable value from the sidebar container
 */
export function getCSSVariable(variableName: string, container?: HTMLElement): string {
  const sidebarContainer = container || getSidebarContainer();
  if (!sidebarContainer) return '';

  const computedStyles = getComputedStyle(sidebarContainer);
  const value = computedStyles.getPropertyValue(variableName).trim();

  return value;
}

/**
 * Sets a CSS variable on the sidebar container
 */
export function setCSSVariable(variableName: string, value: string, container?: HTMLElement): void {
  const sidebarContainer = container || getSidebarContainer();
  if (!sidebarContainer) return;

  sidebarContainer.style.setProperty(variableName, value);
}

/**
 * Gets the sidebar container element
 */
export function getSidebarContainer(): HTMLElement | null {
  // First try to find it in the shadow DOM
  const hostContainer = document.getElementById('ai-browser-sidebar-host');
  if (hostContainer && hostContainer.shadowRoot) {
    const container = hostContainer.shadowRoot.querySelector('.ai-sidebar-container');
    if (container) return container as HTMLElement;
  }

  // Fallback to document query (for tests or non-shadow DOM mode)
  return document.querySelector('.ai-sidebar-container');
}

/**
 * Creates a theme-aware media query listener
 */
export function createThemeMediaQueryListener(callback: (isDark: boolean) => void): () => void {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  const handler = (e: MediaQueryListEvent) => {
    callback(e.matches);
  };

  // Set initial state
  callback(mediaQuery.matches);

  // Listen for changes
  mediaQuery.addEventListener('change', handler);

  // Return cleanup function
  return () => {
    mediaQuery.removeEventListener('change', handler);
  };
}

/**
 * Hook for auto theme that updates when system preference changes
 */
export function createAutoThemeUpdater(container?: HTMLElement): () => void {
  return createThemeMediaQueryListener(_isDark => {
    const current = getCurrentTheme(container);
    if (current === 'auto') {
      // Force a re-render by temporarily removing and re-adding the attribute
      const sidebarContainer = container || getSidebarContainer();
      if (sidebarContainer) {
        sidebarContainer.removeAttribute('data-theme');
        requestAnimationFrame(() => {
          sidebarContainer.setAttribute('data-theme', 'auto');
        });
      }
    }
  });
}

/**
 * Common CSS variables used throughout the app
 */
export const CSS_VARIABLES = {
  // Colors
  PRIMARY_500: '--primary-500',
  PRIMARY_600: '--primary-600',

  // Backgrounds
  BACKGROUND_PRIMARY: '--background-primary',
  BACKGROUND_SECONDARY: '--background-secondary',
  BACKGROUND_ELEVATED: '--background-elevated',

  // Text
  TEXT_PRIMARY: '--text-primary',
  TEXT_SECONDARY: '--text-secondary',
  TEXT_MUTED: '--text-muted',

  // Borders
  BORDER_PRIMARY: '--border-primary',
  BORDER_SECONDARY: '--border-secondary',

  // Spacing
  SPACING_XS: '--spacing-xs',
  SPACING_SM: '--spacing-sm',
  SPACING_MD: '--spacing-md',
  SPACING_LG: '--spacing-lg',
  SPACING_XL: '--spacing-xl',

  // Radius
  RADIUS_SM: '--radius-sm',
  RADIUS_MD: '--radius-md',
  RADIUS_LG: '--radius-lg',

  // Shadows
  SHADOW_SM: '--shadow-sm',
  SHADOW_MD: '--shadow-md',
  SHADOW_LG: '--shadow-lg',

  // Transitions
  TRANSITION_FAST: '--transition-fast',
  TRANSITION_MEDIUM: '--transition-medium',
} as const;

/**
 * Type-safe CSS variable getter
 */
export function getVariable(variable: keyof typeof CSS_VARIABLES, container?: HTMLElement): string {
  return getCSSVariable(CSS_VARIABLES[variable], container);
}

/**
 * Type-safe CSS variable setter
 */
export function setVariable(
  variable: keyof typeof CSS_VARIABLES,
  value: string,
  container?: HTMLElement
): void {
  setCSSVariable(CSS_VARIABLES[variable], value, container);
}
