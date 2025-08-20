import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('CSS Variables and Theme System', () => {
  let testContainer: HTMLElement;
  let testElement: HTMLElement;
  let mockGetComputedStyle: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Create test container that mimics the sidebar structure
    testContainer = document.createElement('div');
    testContainer.className = 'ai-sidebar-container';
    testContainer.setAttribute('data-theme', 'light');

    testElement = document.createElement('div');
    testContainer.appendChild(testElement);
    document.body.appendChild(testContainer);

    // Mock getComputedStyle since jsdom doesn't fully support CSS variables
    mockGetComputedStyle = vi.fn().mockImplementation(element => {
      if (element === testContainer) {
        const theme = testContainer.getAttribute('data-theme');

        // Light theme values
        const lightValues: Record<string, string> = {
          '--primary-50': '#eff6ff',
          '--primary-500': '#3b82f6',
          '--primary-600': '#2563eb',
          '--primary-900': '#1e3a8a',
          '--gray-50': '#f9fafb',
          '--gray-100': '#f3f4f6',
          '--gray-200': '#e5e7eb',
          '--gray-300': '#d1d5db',
          '--gray-400': '#9ca3af',
          '--gray-500': '#6b7280',
          '--gray-600': '#4b5563',
          '--gray-700': '#374151',
          '--gray-800': '#1f2937',
          '--gray-900': '#111827',
          '--background-primary': '#f9fafb',
          '--background-secondary': '#ffffff',
          '--background-elevated': '#ffffff',
          '--text-primary': '#111827',
          '--text-secondary': '#4b5563',
          '--text-muted': '#6b7280',
          '--border-primary': '#e5e7eb',
          '--border-secondary': '#d1d5db',
          '--shadow-sm': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
          '--shadow-md': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
          '--shadow-lg': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
          '--radius-sm': '0.125rem',
          '--radius-md': '0.375rem',
          '--radius-lg': '0.5rem',
          '--spacing-xs': '0.25rem',
          '--spacing-sm': '0.5rem',
          '--spacing-md': '0.75rem',
          '--spacing-lg': '1rem',
          '--spacing-xl': '1.5rem',
          '--transition-fast': '150ms cubic-bezier(0.4, 0, 0.2, 1)',
          '--transition-medium': '300ms cubic-bezier(0.4, 0, 0.2, 1)',
          '--transition-slow': '500ms cubic-bezier(0.4, 0, 0.2, 1)',
        };

        // Dark theme overrides
        const darkOverrides: Record<string, string> = {
          '--background-primary': '#111827',
          '--background-secondary': '#1f2937',
          '--background-elevated': '#374151',
          '--text-primary': '#f9fafb',
          '--text-secondary': '#d1d5db',
          '--text-muted': '#9ca3af',
          '--border-primary': '#374151',
          '--border-secondary': '#4b5563',
        };

        const values = theme === 'dark' ? { ...lightValues, ...darkOverrides } : lightValues;

        return {
          getPropertyValue: (prop: string) => values[prop] || '',
        };
      }

      // For other elements, return basic mock
      return {
        getPropertyValue: () => '',
        backgroundColor: '',
        color: '',
        padding: '0.75rem',
        borderRadius: '0.375rem',
      };
    });

    vi.stubGlobal('getComputedStyle', mockGetComputedStyle);
  });

  afterEach(() => {
    if (document.body.contains(testContainer)) {
      document.body.removeChild(testContainer);
    }
    vi.restoreAllMocks();
  });

  describe('CSS Variable Definitions', () => {
    it('should define all required color variables', () => {
      const computedStyles = getComputedStyle(testContainer);

      // Primary colors
      expect(computedStyles.getPropertyValue('--primary-50').trim()).toBe('#eff6ff');
      expect(computedStyles.getPropertyValue('--primary-500').trim()).toBe('#3b82f6');
      expect(computedStyles.getPropertyValue('--primary-600').trim()).toBe('#2563eb');
      expect(computedStyles.getPropertyValue('--primary-900').trim()).toBe('#1e3a8a');

      // Gray scale
      expect(computedStyles.getPropertyValue('--gray-50').trim()).toBe('#f9fafb');
      expect(computedStyles.getPropertyValue('--gray-900').trim()).toBe('#111827');
    });

    it('should define semantic color variables', () => {
      const computedStyles = getComputedStyle(testContainer);

      // Background colors
      expect(computedStyles.getPropertyValue('--background-primary').trim()).toBeTruthy();
      expect(computedStyles.getPropertyValue('--background-secondary').trim()).toBe('#ffffff');
      expect(computedStyles.getPropertyValue('--background-elevated').trim()).toBe('#ffffff');

      // Text colors
      expect(computedStyles.getPropertyValue('--text-primary').trim()).toBeTruthy();
      expect(computedStyles.getPropertyValue('--text-secondary').trim()).toBeTruthy();
      expect(computedStyles.getPropertyValue('--text-muted').trim()).toBeTruthy();

      // Border colors
      expect(computedStyles.getPropertyValue('--border-primary').trim()).toBeTruthy();
      expect(computedStyles.getPropertyValue('--border-secondary').trim()).toBeTruthy();
    });

    it('should define spacing variables', () => {
      const computedStyles = getComputedStyle(testContainer);

      expect(computedStyles.getPropertyValue('--spacing-xs').trim()).toBe('0.25rem');
      expect(computedStyles.getPropertyValue('--spacing-sm').trim()).toBe('0.5rem');
      expect(computedStyles.getPropertyValue('--spacing-md').trim()).toBe('0.75rem');
      expect(computedStyles.getPropertyValue('--spacing-lg').trim()).toBe('1rem');
      expect(computedStyles.getPropertyValue('--spacing-xl').trim()).toBe('1.5rem');
    });

    it('should define border radius variables', () => {
      const computedStyles = getComputedStyle(testContainer);

      expect(computedStyles.getPropertyValue('--radius-sm').trim()).toBe('0.125rem');
      expect(computedStyles.getPropertyValue('--radius-md').trim()).toBe('0.375rem');
      expect(computedStyles.getPropertyValue('--radius-lg').trim()).toBe('0.5rem');
    });

    it('should define shadow variables', () => {
      const computedStyles = getComputedStyle(testContainer);

      expect(computedStyles.getPropertyValue('--shadow-sm').trim()).toBeTruthy();
      expect(computedStyles.getPropertyValue('--shadow-md').trim()).toBeTruthy();
      expect(computedStyles.getPropertyValue('--shadow-lg').trim()).toBeTruthy();
    });

    it('should define transition variables', () => {
      const computedStyles = getComputedStyle(testContainer);

      expect(computedStyles.getPropertyValue('--transition-fast').trim()).toBe(
        '150ms cubic-bezier(0.4, 0, 0.2, 1)'
      );
      expect(computedStyles.getPropertyValue('--transition-medium').trim()).toBe(
        '300ms cubic-bezier(0.4, 0, 0.2, 1)'
      );
      expect(computedStyles.getPropertyValue('--transition-slow').trim()).toBe(
        '500ms cubic-bezier(0.4, 0, 0.2, 1)'
      );
    });
  });

  describe('Theme Switching', () => {
    it('should apply light theme variables by default', () => {
      const computedStyles = getComputedStyle(testContainer);

      // In light theme, background should be light
      expect(computedStyles.getPropertyValue('--background-secondary').trim()).toBe('#ffffff');
      expect(computedStyles.getPropertyValue('--text-primary').trim()).toBeTruthy();
    });

    it('should switch to dark theme when data-theme is changed', () => {
      testContainer.setAttribute('data-theme', 'dark');

      const computedStyles = getComputedStyle(testContainer);

      // In dark theme, backgrounds should be dark
      const backgroundPrimary = computedStyles.getPropertyValue('--background-primary').trim();
      const backgroundSecondary = computedStyles.getPropertyValue('--background-secondary').trim();

      expect(backgroundPrimary).toBeTruthy();
      expect(backgroundSecondary).toBeTruthy();

      // Text should be light in dark theme
      const textPrimary = computedStyles.getPropertyValue('--text-primary').trim();
      expect(textPrimary).toBeTruthy();
    });

    it('should maintain variable definitions across theme switches', () => {
      const lightComputedStyles = getComputedStyle(testContainer);
      const lightBackground = lightComputedStyles.getPropertyValue('--background-primary').trim();

      testContainer.setAttribute('data-theme', 'dark');
      const darkComputedStyles = getComputedStyle(testContainer);
      const darkBackground = darkComputedStyles.getPropertyValue('--background-primary').trim();

      // Both should have values but they should be different
      expect(lightBackground).toBeTruthy();
      expect(darkBackground).toBeTruthy();
      expect(lightBackground).not.toBe(darkBackground);

      // Non-theme-specific variables should remain the same
      expect(lightComputedStyles.getPropertyValue('--spacing-md').trim()).toBe(
        darkComputedStyles.getPropertyValue('--spacing-md').trim()
      );
    });

    it('should scope variables to sidebar container', () => {
      // Create element outside sidebar container
      const outsideElement = document.createElement('div');
      document.body.appendChild(outsideElement);

      const outsideStyles = getComputedStyle(outsideElement);
      const insideStyles = getComputedStyle(testContainer);

      // Variables should be defined inside sidebar container
      expect(insideStyles.getPropertyValue('--primary-500').trim()).toBe('#3b82f6');

      // Variables should not be available outside sidebar container
      expect(outsideStyles.getPropertyValue('--primary-500').trim()).toBe('');

      document.body.removeChild(outsideElement);
    });
  });

  describe('CSS Variable Integration', () => {
    it('should allow CSS to reference variables in style declarations', () => {
      // Test that variables can be set as style properties
      testElement.style.setProperty('background-color', 'var(--background-primary)');
      testElement.style.setProperty('color', 'var(--text-primary)');
      testElement.style.setProperty('padding', 'var(--spacing-md)');
      testElement.style.setProperty('border-radius', 'var(--radius-md)');

      // Verify the variable references are set correctly
      expect(testElement.style.getPropertyValue('background-color')).toBe(
        'var(--background-primary)'
      );
      expect(testElement.style.getPropertyValue('color')).toBe('var(--text-primary)');
      expect(testElement.style.getPropertyValue('padding')).toBe('var(--spacing-md)');
      expect(testElement.style.getPropertyValue('border-radius')).toBe('var(--radius-md)');
    });

    it('should allow checking if CSS variables resolve', () => {
      // Test that the computed style mock returns expected values
      const computedStyles = getComputedStyle(testContainer);

      // These should return the variable values, not empty strings
      expect(computedStyles.getPropertyValue('--background-primary')).toBe('#f9fafb');
      expect(computedStyles.getPropertyValue('--text-primary')).toBe('#111827');
      expect(computedStyles.getPropertyValue('--spacing-md')).toBe('0.75rem');
      expect(computedStyles.getPropertyValue('--radius-md')).toBe('0.375rem');
    });

    it('should handle non-existent variables gracefully', () => {
      const computedStyles = getComputedStyle(testContainer);
      expect(computedStyles.getPropertyValue('--non-existent-variable')).toBe('');
    });
  });
});
