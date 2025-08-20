import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getCurrentTheme,
  setTheme,
  toggleTheme,
  getEffectiveTheme,
  getCSSVariable,
  setCSSVariable,
  getSidebarContainer,
  createThemeMediaQueryListener,
  createAutoThemeUpdater,
  getVariable,
  setVariable,
  CSS_VARIABLES,
} from '../../src/utils/theme';

describe('Theme Utilities', () => {
  let mockContainer: HTMLElement;

  beforeEach(() => {
    // Create mock sidebar container
    mockContainer = document.createElement('div');
    mockContainer.className = 'ai-sidebar-container';
    mockContainer.setAttribute('data-theme', 'light');
    document.body.appendChild(mockContainer);

    // Mock CSS variables
    Object.defineProperty(mockContainer.style, 'setProperty', {
      value: vi.fn(),
      writable: true,
    });

    // Mock getComputedStyle
    vi.spyOn(window, 'getComputedStyle').mockImplementation(
      () =>
        ({
          getPropertyValue: vi.fn((prop: string) => {
            const values: Record<string, string> = {
              '--primary-500': '#3b82f6',
              '--background-primary': '#f9fafb',
              '--text-primary': '#111827',
              '--spacing-md': '0.75rem',
            };
            return values[prop] || '';
          }),
        }) as any
    );
  });

  afterEach(() => {
    if (document.body.contains(mockContainer)) {
      document.body.removeChild(mockContainer);
    }
    vi.restoreAllMocks();
  });

  describe('Theme Management', () => {
    it('should get current theme from container', () => {
      expect(getCurrentTheme(mockContainer)).toBe('light');

      mockContainer.setAttribute('data-theme', 'dark');
      expect(getCurrentTheme(mockContainer)).toBe('dark');

      mockContainer.setAttribute('data-theme', 'auto');
      expect(getCurrentTheme(mockContainer)).toBe('auto');
    });

    it('should return light theme as default when no theme is set', () => {
      mockContainer.removeAttribute('data-theme');
      expect(getCurrentTheme(mockContainer)).toBe('light');
    });

    it('should set theme on container', () => {
      setTheme('dark', mockContainer);
      expect(mockContainer.getAttribute('data-theme')).toBe('dark');

      setTheme('auto', mockContainer);
      expect(mockContainer.getAttribute('data-theme')).toBe('auto');
    });

    it('should add and remove no-transitions class when setting theme', () => {
      const addClassSpy = vi.spyOn(mockContainer.classList, 'add');
      const removeClassSpy = vi.spyOn(mockContainer.classList, 'remove');

      setTheme('dark', mockContainer);

      expect(addClassSpy).toHaveBeenCalledWith('no-transitions');

      // Should schedule removal of no-transitions class
      return new Promise<void>(resolve => {
        requestAnimationFrame(() => {
          expect(removeClassSpy).toHaveBeenCalledWith('no-transitions');
          resolve();
        });
      });
    });

    it('should toggle between light and dark themes', () => {
      mockContainer.setAttribute('data-theme', 'light');
      const newTheme = toggleTheme(mockContainer);
      expect(newTheme).toBe('dark');
      expect(mockContainer.getAttribute('data-theme')).toBe('dark');

      const toggledBack = toggleTheme(mockContainer);
      expect(toggledBack).toBe('light');
      expect(mockContainer.getAttribute('data-theme')).toBe('light');
    });

    it('should get effective theme resolving auto to actual theme', () => {
      // Mock matchMedia
      const mockMatchMedia = vi.fn().mockImplementation(query => ({
        matches: query === '(prefers-color-scheme: dark)' ? false : true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));
      vi.stubGlobal('matchMedia', mockMatchMedia);

      mockContainer.setAttribute('data-theme', 'auto');
      expect(getEffectiveTheme(mockContainer)).toBe('light');

      // Test dark system preference
      mockMatchMedia.mockImplementation(query => ({
        matches: query === '(prefers-color-scheme: dark)' ? true : false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));

      expect(getEffectiveTheme(mockContainer)).toBe('dark');

      // Test explicit themes
      mockContainer.setAttribute('data-theme', 'light');
      expect(getEffectiveTheme(mockContainer)).toBe('light');

      mockContainer.setAttribute('data-theme', 'dark');
      expect(getEffectiveTheme(mockContainer)).toBe('dark');
    });
  });

  describe('CSS Variable Access', () => {
    it('should get CSS variable values', () => {
      const value = getCSSVariable('--primary-500', mockContainer);
      expect(value).toBe('#3b82f6');

      expect(window.getComputedStyle).toHaveBeenCalledWith(mockContainer);
    });

    it('should set CSS variable values', () => {
      setCSSVariable('--custom-color', '#ff0000', mockContainer);
      expect(mockContainer.style.setProperty).toHaveBeenCalledWith('--custom-color', '#ff0000');
    });

    it('should return empty string for non-existent variables', () => {
      const value = getCSSVariable('--non-existent', mockContainer);
      expect(value).toBe('');
    });

    it('should use type-safe variable getters and setters', () => {
      const value = getVariable('PRIMARY_500', mockContainer);
      expect(value).toBe('#3b82f6');

      setVariable('PRIMARY_500', '#0000ff', mockContainer);
      expect(mockContainer.style.setProperty).toHaveBeenCalledWith('--primary-500', '#0000ff');
    });
  });

  describe('Container Detection', () => {
    it('should find sidebar container in DOM', () => {
      const container = getSidebarContainer();
      expect(container).toBe(mockContainer);
    });

    it('should return null when no sidebar container exists', () => {
      if (document.body.contains(mockContainer)) {
        document.body.removeChild(mockContainer);
      }
      const container = getSidebarContainer();
      expect(container).toBeNull();
    });

    it('should work without explicit container parameter', () => {
      expect(getCurrentTheme()).toBe('light');

      setTheme('dark');
      expect(getCurrentTheme()).toBe('dark');
    });
  });

  describe('Media Query Listeners', () => {
    it('should create media query listener for system theme changes', () => {
      const callback = vi.fn();
      const mockMediaQuery = {
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };

      vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(mockMediaQuery));

      const cleanup = createThemeMediaQueryListener(callback);

      expect(window.matchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
      expect(callback).toHaveBeenCalledWith(true);
      expect(mockMediaQuery.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));

      // Test cleanup
      cleanup();
      expect(mockMediaQuery.removeEventListener).toHaveBeenCalledWith(
        'change',
        expect.any(Function)
      );
    });

    it('should create auto theme updater that responds to system changes', () => {
      const mockMediaQuery = {
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };

      vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(mockMediaQuery));

      mockContainer.setAttribute('data-theme', 'auto');
      const cleanup = createAutoThemeUpdater(mockContainer);

      expect(window.matchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
      expect(mockMediaQuery.addEventListener).toHaveBeenCalled();

      cleanup();
      expect(mockMediaQuery.removeEventListener).toHaveBeenCalled();
    });
  });

  describe('CSS Variables Constants', () => {
    it('should define all expected CSS variable constants', () => {
      expect(CSS_VARIABLES.PRIMARY_500).toBe('--primary-500');
      expect(CSS_VARIABLES.BACKGROUND_PRIMARY).toBe('--background-primary');
      expect(CSS_VARIABLES.TEXT_PRIMARY).toBe('--text-primary');
      expect(CSS_VARIABLES.SPACING_MD).toBe('--spacing-md');
      expect(CSS_VARIABLES.RADIUS_MD).toBe('--radius-md');
      expect(CSS_VARIABLES.SHADOW_MD).toBe('--shadow-md');
      expect(CSS_VARIABLES.TRANSITION_FAST).toBe('--transition-fast');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing container gracefully', () => {
      if (document.body.contains(mockContainer)) {
        document.body.removeChild(mockContainer);
      }

      expect(() => {
        getCurrentTheme();
        setTheme('dark');
        getCSSVariable('--primary-500');
        setCSSVariable('--test', 'value');
      }).not.toThrow();

      expect(getCurrentTheme()).toBe('light');
      expect(getCSSVariable('--primary-500')).toBe('');
    });
  });
});
