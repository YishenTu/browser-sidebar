import { describe, it, expect } from 'vitest';
import { Config } from 'tailwindcss';
import tailwindConfig from '../../tailwind.config.js';

describe('Tailwind Configuration', () => {
  it('should have valid configuration structure', () => {
    expect(tailwindConfig).toBeDefined();
    expect(tailwindConfig.content).toBeDefined();
    expect(tailwindConfig.darkMode).toBe('class');
    expect(tailwindConfig.theme).toBeDefined();
  });

  it('should include correct content paths for all React components', () => {
    const config = tailwindConfig as Config;
    const content = config.content as string[];

    expect(content).toContain('./src/**/*.{ts,tsx}');
    expect(content).toContain('./src/sidebar/**/*.{ts,tsx}');
    // Verify it captures all our component paths
    expect(content.some(path => path.includes('src/**'))).toBe(true);
  });

  it('should have dark mode configured as class strategy', () => {
    const config = tailwindConfig as Config;
    expect(config.darkMode).toBe('class');
  });

  it('should have custom colors defined', () => {
    const config = tailwindConfig as Config;
    const colors = config.theme?.extend?.colors;

    expect(colors).toBeDefined();
    expect(colors).toHaveProperty('primary');
    expect(colors).toHaveProperty('ai');
    expect(colors).toHaveProperty('user');
  });

  it('should have primary color palette with all shades', () => {
    const config = tailwindConfig as Config;
    const primaryColors = config.theme?.extend?.colors?.primary;

    expect(primaryColors).toBeDefined();
    expect(primaryColors).toHaveProperty('50');
    expect(primaryColors).toHaveProperty('100');
    expect(primaryColors).toHaveProperty('200');
    expect(primaryColors).toHaveProperty('300');
    expect(primaryColors).toHaveProperty('400');
    expect(primaryColors).toHaveProperty('500');
    expect(primaryColors).toHaveProperty('600');
    expect(primaryColors).toHaveProperty('700');
    expect(primaryColors).toHaveProperty('800');
    expect(primaryColors).toHaveProperty('900');
  });

  it('should have ai and user colors with light, default, and dark variants', () => {
    const config = tailwindConfig as Config;
    const colors = config.theme?.extend?.colors;

    expect(colors?.ai).toHaveProperty('light');
    expect(colors?.ai).toHaveProperty('DEFAULT');
    expect(colors?.ai).toHaveProperty('dark');

    expect(colors?.user).toHaveProperty('light');
    expect(colors?.user).toHaveProperty('DEFAULT');
    expect(colors?.user).toHaveProperty('dark');
  });

  it('should have custom animations defined', () => {
    const config = tailwindConfig as Config;
    const animations = config.theme?.extend?.animation;

    expect(animations).toBeDefined();
    expect(animations).toHaveProperty('pulse-soft');
    expect(animations).toHaveProperty('slide-up');
    expect(animations).toHaveProperty('fade-in');
  });

  it('should have corresponding keyframes for custom animations', () => {
    const config = tailwindConfig as Config;
    const keyframes = config.theme?.extend?.keyframes;

    expect(keyframes).toBeDefined();
    expect(keyframes).toHaveProperty('slideUp');
    expect(keyframes).toHaveProperty('fadeIn');
  });

  it('should have valid CSS color values', () => {
    const config = tailwindConfig as Config;
    const colors = config.theme?.extend?.colors;

    // Test that color values are valid hex colors
    const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;

    expect(hexColorRegex.test(colors?.ai?.light as string)).toBe(true);
    expect(hexColorRegex.test(colors?.ai?.DEFAULT as string)).toBe(true);
    expect(hexColorRegex.test(colors?.ai?.dark as string)).toBe(true);

    expect(hexColorRegex.test(colors?.user?.light as string)).toBe(true);
    expect(hexColorRegex.test(colors?.user?.DEFAULT as string)).toBe(true);
    expect(hexColorRegex.test(colors?.user?.dark as string)).toBe(true);
  });

  it('should have typography configuration', () => {
    const config = tailwindConfig as Config;
    const fontSize = config.theme?.extend?.fontSize;
    const fontWeight = config.theme?.extend?.fontWeight;
    const lineHeight = config.theme?.extend?.lineHeight;

    expect(fontSize).toBeDefined();
    expect(fontWeight).toBeDefined();
    expect(lineHeight).toBeDefined();

    // Test specific font sizes
    expect(fontSize).toHaveProperty('xs');
    expect(fontSize).toHaveProperty('sm');
    expect(fontSize).toHaveProperty('base');
    expect(fontSize).toHaveProperty('lg');

    // Test font weights
    expect(fontWeight).toHaveProperty('medium');
    expect(fontWeight).toHaveProperty('semibold');
    expect(fontWeight).toHaveProperty('bold');
  });

  it('should have enhanced color palettes with all shades', () => {
    const config = tailwindConfig as Config;
    const colors = config.theme?.extend?.colors;

    // Test enhanced ai colors
    expect(colors?.ai).toHaveProperty('50');
    expect(colors?.ai).toHaveProperty('500');
    expect(colors?.ai).toHaveProperty('900');

    // Test enhanced user colors
    expect(colors?.user).toHaveProperty('50');
    expect(colors?.user).toHaveProperty('500');
    expect(colors?.user).toHaveProperty('900');

    // Test semantic colors
    expect(colors).toHaveProperty('success');
    expect(colors).toHaveProperty('warning');
    expect(colors).toHaveProperty('error');
    expect(colors).toHaveProperty('sidebar');
  });

  it('should have sidebar-specific design tokens', () => {
    const config = tailwindConfig as Config;
    const zIndex = config.theme?.extend?.zIndex;
    const maxWidth = config.theme?.extend?.maxWidth;
    const minWidth = config.theme?.extend?.minWidth;

    expect(zIndex).toHaveProperty('sidebar');
    expect(maxWidth).toHaveProperty('sidebar');
    expect(minWidth).toHaveProperty('sidebar');

    expect(zIndex?.sidebar).toBe('2147483647');
    expect(maxWidth?.sidebar).toBe('800px');
    expect(minWidth?.sidebar).toBe('300px');
  });

  it('should have enhanced animations', () => {
    const config = tailwindConfig as Config;
    const animations = config.theme?.extend?.animation;

    expect(animations).toHaveProperty('slide-up');
    expect(animations).toHaveProperty('slide-down');
    expect(animations).toHaveProperty('slide-in-right');
    expect(animations).toHaveProperty('slide-out-right');
    expect(animations).toHaveProperty('fade-in');
    expect(animations).toHaveProperty('fade-out');
    expect(animations).toHaveProperty('typing');
  });
});
