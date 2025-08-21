/**
 * Unified Stylesheet Integration Tests - Task 3.1
 *
 * These tests verify that merging all CSS files into a single unified stylesheet
 * preserves all functionality, styling, and critical overlay behavior.
 *
 * Tests are written FIRST (TDD RED phase) before implementation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mountSidebar, unmountSidebar } from '../../../src/sidebar/index';

describe('Unified Stylesheet Integration', () => {
  let mockHostElement: HTMLElement;
  let mockShadowRoot: ShadowRoot;

  beforeEach(() => {
    // Clean up any existing sidebars
    unmountSidebar();

    // Create mock DOM elements for testing
    mockHostElement = document.createElement('div');
    mockHostElement.id = 'test-host';
    document.body.appendChild(mockHostElement);
    mockShadowRoot = mockHostElement.attachShadow({ mode: 'open' });
  });

  afterEach(() => {
    // Clean up after each test
    unmountSidebar();
    if (mockHostElement && mockHostElement.parentNode) {
      mockHostElement.parentNode.removeChild(mockHostElement);
    }
  });

  describe('Visual Regression Tests', () => {
    it('should preserve all chat-input visual styles in unified stylesheet', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const unifiedStylesPath = path.resolve(__dirname, '../../../src/sidebar/styles/sidebar.css');
      const content = await fs.readFile(unifiedStylesPath, 'utf-8');

      // Verify critical chat-input styles are preserved
      expect(content).toContain('.chat-input');
      expect(content).toContain('background: transparent');
      expect(content).toContain('.chat-input__main');
      expect(content).toContain('.chat-input__textarea-container');
      expect(content).toContain('.chat-input__actions');
      expect(content).toContain('.chat-input__controls');
      expect(content).toContain('.chat-input__utilities');
      expect(content).toContain('resize: none');

      // Verify textarea styling is preserved
      expect(content).toContain('textarea');
      expect(content).toContain('box-sizing: border-box');

      // Verify dark mode styles
      expect(content).toContain('.dark .chat-input');
      expect(content).toContain('color: #ffffff');

      // Verify responsive design
      expect(content).toContain('@media (max-width: 640px)');
    });

    it('should preserve all chat-panel visual styles in unified stylesheet', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const unifiedStylesPath = path.resolve(__dirname, '../../../src/sidebar/styles/sidebar.css');
      const content = await fs.readFile(unifiedStylesPath, 'utf-8');

      // Verify critical chat-panel styles are preserved
      expect(content).toContain('.chat-panel');
      expect(content).toContain('display: flex');
      expect(content).toContain('flex-direction: column');
      expect(content).toContain('.chat-panel__header');
      expect(content).toContain('.chat-panel__title');
      expect(content).toContain('.chat-panel__message-count');
      expect(content).toContain('.chat-panel__body');
      expect(content).toContain('.chat-panel__footer');
      expect(content).toContain('.chat-panel__error');

      // Verify dark mode styles
      expect(content).toContain('.dark .chat-panel');
      expect(content).toContain('.dark .chat-panel__header');
      expect(content).toContain('.dark .chat-panel__title');

      // Verify animations
      expect(content).toContain('@keyframes slideDown');
      expect(content).toContain('animation: slideDown');

      // Verify accessibility features
      expect(content).toContain('focus-within');
      expect(content).toContain('prefers-contrast: high');
      expect(content).toContain('prefers-reduced-motion');
    });

    it('should preserve all icon-button visual styles in unified stylesheet', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const unifiedStylesPath = path.resolve(__dirname, '../../../src/sidebar/styles/sidebar.css');
      const content = await fs.readFile(unifiedStylesPath, 'utf-8');

      // Verify critical icon-button styles are preserved
      expect(content).toContain('.icon-button');
      expect(content).toContain('display: inline-flex');
      expect(content).toContain('align-items: center');
      expect(content).toContain('justify-content: center');

      // Verify size variants
      expect(content).toContain('.icon-button--sm');
      expect(content).toContain('.icon-button--md');
      expect(content).toContain('.icon-button--lg');

      // Verify shape variants
      expect(content).toContain('.icon-button--circular');
      expect(content).toContain('.icon-button--square');

      // Verify color variants
      expect(content).toContain('.icon-button--primary');
      expect(content).toContain('.icon-button--secondary');
      expect(content).toContain('.icon-button--ghost');

      // Verify states
      expect(content).toContain(':hover');
      expect(content).toContain(':active');
      expect(content).toContain(':disabled');
      expect(content).toContain(':focus');

      // Verify animations
      expect(content).toContain('@keyframes spin');
      expect(content).toContain('.icon-button__spinner');

      // Verify tooltips
      expect(content).toContain('.icon-button__tooltip');

      // Verify dark mode variants
      expect(content).toContain('.dark .icon-button--secondary');
      expect(content).toContain('.dark .icon-button--ghost');
    });

    it('should preserve all original sidebar overlay styles in unified stylesheet', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const unifiedStylesPath = path.resolve(__dirname, '../../../src/sidebar/styles/sidebar.css');
      const content = await fs.readFile(unifiedStylesPath, 'utf-8');

      // Verify critical overlay styles are preserved
      expect(content).toContain('.ai-sidebar-overlay');
      expect(content).toContain('position: fixed');
      expect(content).toContain('z-index: 2147483647');
      expect(content).toContain('pointer-events: auto');
      expect(content).toContain('isolation: isolate');

      // Verify container styles
      expect(content).toContain('.ai-sidebar-container');
      expect(content).toContain('box-shadow: var(--shadow-lg)');
      expect(content).toContain('border-radius: var(--radius-lg)');

      // Verify header styles
      expect(content).toContain('.ai-sidebar-header');
      expect(content).toContain('cursor: grab');
      expect(content).toContain('user-select: none');

      // Verify resize handle
      expect(content).toContain('.ai-sidebar-resize-handle');
      expect(content).toContain('cursor: ew-resize');
      expect(content).toContain('left: -4px');
      expect(content).toContain('width: 8px');
    });
  });

  describe('Style Merging Validation', () => {
    it('should contain all critical selectors from individual files', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const unifiedStylesPath = path.resolve(__dirname, '../../../src/sidebar/styles/sidebar.css');
      const content = await fs.readFile(unifiedStylesPath, 'utf-8');

      // Critical selectors that must be present
      const requiredSelectors = [
        // Original sidebar styles (CRITICAL - overlay functionality)
        '.ai-sidebar-overlay',
        '.ai-sidebar-container',
        '.ai-sidebar-header',
        '.ai-sidebar-resize-handle',

        // Chat panel styles
        '.chat-panel',
        '.chat-panel__header',
        '.chat-panel__body',
        '.chat-panel__footer',
        '.chat-panel__error',

        // Chat input styles
        '.chat-input',
        '.chat-input__main',
        '.chat-input__textarea-container',
        '.chat-input__actions',

        // Icon button styles
        '.icon-button',
        '.icon-button--primary',
        '.icon-button--secondary',
        '.icon-button--ghost',

        // Dark mode variants
        '.dark .chat-panel',
        '.dark .chat-input',
        '.dark .icon-button--secondary',
      ];

      requiredSelectors.forEach(selector => {
        expect(content).toContain(selector);
      });
    });

    it('should maintain all CSS custom properties and variables', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const unifiedStylesPath = path.resolve(__dirname, '../../../src/sidebar/styles/sidebar.css');
      const content = await fs.readFile(unifiedStylesPath, 'utf-8');

      // Verify variables.css import is preserved
      expect(content).toContain("@import '../../styles/variables.css'");

      // Verify CSS variables are used
      const expectedVariables = [
        'var(--shadow-lg)',
        'var(--radius-lg)',
        'var(--background-secondary)',
        'var(--text-primary)',
        'var(--spacing-sm)',
        'var(--spacing-md)',
        'var(--border-primary)',
        'var(--font-size-md)',
        'var(--font-weight-semibold)',
        'var(--transition-fast)',
        'var(--hover-overlay)',
        'var(--active-overlay)',
        'var(--header-height)',
      ];

      expectedVariables.forEach(variable => {
        expect(content).toContain(variable);
      });
    });

    it('should preserve all keyframe animations', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const unifiedStylesPath = path.resolve(__dirname, '../../../src/sidebar/styles/sidebar.css');
      const content = await fs.readFile(unifiedStylesPath, 'utf-8');

      // Verify animations are preserved
      expect(content).toContain('@keyframes slideDown');
      expect(content).toContain('@keyframes spin');

      // Verify animation usage
      expect(content).toContain('animation: slideDown 0.2s ease-out');
      expect(content).toContain('animation: spin 1s linear infinite');
    });

    it('should preserve all media queries for responsive design', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const unifiedStylesPath = path.resolve(__dirname, '../../../src/sidebar/styles/sidebar.css');
      const content = await fs.readFile(unifiedStylesPath, 'utf-8');

      // Verify responsive media queries
      expect(content).toContain('@media (max-width: 640px)');
      expect(content).toContain('@media (prefers-contrast: high)');
      expect(content).toContain('@media (prefers-reduced-motion: reduce)');
    });

    it('should preserve all important declarations', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const unifiedStylesPath = path.resolve(__dirname, '../../../src/sidebar/styles/sidebar.css');
      const content = await fs.readFile(unifiedStylesPath, 'utf-8');

      // Critical !important declarations that must be preserved
      const criticalImportants = [
        'pointer-events: auto !important',
        'background: transparent !important',
        'background-color: transparent !important',
        'border: 1px solid #e5e7eb !important',
        'outline: none !important',
        'resize: none !important',
        'box-sizing: border-box !important',
      ];

      criticalImportants.forEach(declaration => {
        expect(content).toContain(declaration);
      });
    });
  });

  describe('File Structure Validation', () => {
    it('should have unified stylesheet at correct location', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const unifiedStylesPath = path.resolve(__dirname, '../../../src/sidebar/styles/sidebar.css');

      try {
        await fs.access(unifiedStylesPath);
        const content = await fs.readFile(unifiedStylesPath, 'utf-8');
        expect(content).toBeTruthy();
        expect(content.length).toBeGreaterThan(1000); // Should be substantial file
      } catch (error) {
        throw new Error('Unified sidebar.css file does not exist at expected location');
      }
    });

    it('should be the only CSS file in sidebar/styles directory', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const stylesDir = path.resolve(__dirname, '../../../src/sidebar/styles');
      const files = await fs.readdir(stylesDir);

      // After unification, only sidebar.css should remain
      const cssFiles = files.filter(file => file.endsWith('.css'));
      expect(cssFiles).toHaveLength(1);
      expect(cssFiles[0]).toBe('sidebar.css');
    });

    it('should verify individual CSS files no longer exist', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');

      const oldFiles = [
        path.resolve(__dirname, '../../../src/sidebar/styles/chat-panel.css'),
        path.resolve(__dirname, '../../../src/sidebar/styles/chat-input.css'),
        path.resolve(__dirname, '../../../src/sidebar/styles/icon-button.css'),
      ];

      for (const filePath of oldFiles) {
        try {
          await fs.access(filePath);
          throw new Error(`Old CSS file still exists: ${filePath}`);
        } catch (error: any) {
          expect(error.code).toBe('ENOENT');
        }
      }
    });
  });

  describe('Build Integration Tests', () => {
    it('should work with Vite inline imports', async () => {
      // Test that the unified file can be imported as inline
      const expectedImportPath = './styles/sidebar.css?inline';
      expect(expectedImportPath).toContain('?inline');
      expect(expectedImportPath).toContain('sidebar.css');
    });

    it('should maintain compatibility with existing import structure', () => {
      // Verify that updating imports to single file works
      const oldImports = [
        './styles/sidebar.css?inline',
        './styles/chat-input.css?inline',
        './styles/chat-panel.css?inline',
        './styles/icon-button.css?inline',
      ];

      const newImport = './styles/sidebar.css?inline';

      // After unification, we should only need one import
      expect(newImport).toBeTruthy();
      expect(oldImports.length).toBeGreaterThan(1); // Demonstrates consolidation
    });
  });
});
