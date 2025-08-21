/**
 * Overlay Style Tests - Task 3.1
 * 
 * Critical tests for overlay functionality that MUST NOT be broken.
 * These styles ensure the sidebar appears correctly as an overlay on websites
 * using Shadow DOM isolation, fixed positioning, and high z-index.
 * 
 * Tests written FIRST (TDD RED phase) before implementation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mountSidebar, unmountSidebar } from '../../../src/sidebar/index';

describe('Critical Overlay Styles', () => {
  beforeEach(() => {
    // Clean up any existing sidebars
    unmountSidebar();
  });

  afterEach(() => {
    unmountSidebar();
  });

  describe('Z-Index Management', () => {
    it('should preserve maximum z-index for overlay visibility', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const unifiedStylesPath = path.resolve(__dirname, '../../../src/sidebar/styles/sidebar.css');
      const content = await fs.readFile(unifiedStylesPath, 'utf-8');
      
      // CRITICAL: Maximum z-index must be preserved
      expect(content).toContain('z-index: 2147483647');
      
      // Verify it's applied to the correct overlay class
      const overlayZIndexRegex = /\.ai-sidebar-overlay[^{]*{[^}]*z-index:\s*2147483647[^}]*}/s;
      expect(content).toMatch(overlayZIndexRegex);
    });

    it('should maintain z-index hierarchy for all overlay elements', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const unifiedStylesPath = path.resolve(__dirname, '../../../src/sidebar/styles/sidebar.css');
      const content = await fs.readFile(unifiedStylesPath, 'utf-8');
      
      // Verify stacking context isolation
      expect(content).toContain('isolation: isolate');
      
      // Verify no conflicting z-index values that could break overlay
      const highZIndexMatches = content.match(/z-index:\s*(\d+)/g);
      if (highZIndexMatches) {
        highZIndexMatches.forEach(match => {
          const value = parseInt(match.replace(/z-index:\s*/, ''));
          // Should only have the maximum z-index or reasonable lower values
          expect(value).toBeLessThanOrEqual(2147483647);
        });
      }
    });

    it('should test z-index in actual DOM environment', () => {
      // Mount sidebar to test actual z-index behavior
      mountSidebar();
      
      const hostElement = document.getElementById('ai-browser-sidebar-host');
      expect(hostElement).toBeTruthy();
      
      if (hostElement) {
        // Check host container z-index (set via inline styles)
        const computedStyle = window.getComputedStyle(hostElement);
        expect(computedStyle.zIndex).toBe('2147483646'); // Host is one layer below
        
        // Check shadow root content exists
        const shadowRoot = hostElement.shadowRoot;
        expect(shadowRoot).toBeTruthy();
        
        if (shadowRoot) {
          // Verify styles are injected (may not have overlay element yet due to React timing)
          const styleElement = shadowRoot.querySelector('style');
          expect(styleElement).toBeTruthy();
          
          if (styleElement) {
            const styleContent = styleElement.textContent || '';
            // The unified stylesheet content should be present
            expect(styleContent.length).toBeGreaterThan(1000);
          }
        }
      }
    });
  });

  describe('Fixed Positioning', () => {
    it('should preserve fixed positioning for overlay', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const unifiedStylesPath = path.resolve(__dirname, '../../../src/sidebar/styles/sidebar.css');
      const content = await fs.readFile(unifiedStylesPath, 'utf-8');
      
      // CRITICAL: Fixed positioning must be preserved
      expect(content).toContain('position: fixed');
      
      // Verify it's applied to the overlay class
      const overlayPositionRegex = /\.ai-sidebar-overlay[^{]*{[^}]*position:\s*fixed[^}]*}/s;
      expect(content).toMatch(overlayPositionRegex);
    });

    it('should maintain overlay positioning properties', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const unifiedStylesPath = path.resolve(__dirname, '../../../src/sidebar/styles/sidebar.css');
      const content = await fs.readFile(unifiedStylesPath, 'utf-8');
      
      // Verify box-sizing for predictable layout
      expect(content).toContain('box-sizing: border-box');
      
      // Verify background transparency for proper overlay
      expect(content).toContain('background: transparent');
    });

    it('should test positioning in actual DOM environment', () => {
      mountSidebar();
      
      const hostElement = document.getElementById('ai-browser-sidebar-host');
      expect(hostElement).toBeTruthy();
      
      if (hostElement) {
        const computedStyle = window.getComputedStyle(hostElement);
        expect(computedStyle.position).toBe('fixed');
        expect(computedStyle.top).toBe('0px');
        expect(computedStyle.left).toBe('0px');
        expect(computedStyle.width).toBe('100%');
        expect(computedStyle.height).toBe('100%');
      }
    });
  });

  describe('Pointer Events Management', () => {
    it('should preserve pointer-events configuration', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const unifiedStylesPath = path.resolve(__dirname, '../../../src/sidebar/styles/sidebar.css');
      const content = await fs.readFile(unifiedStylesPath, 'utf-8');
      
      // CRITICAL: Pointer events must be configured correctly
      expect(content).toContain('pointer-events: auto !important');
      expect(content).toContain('pointer-events: none');
      
      // The host should have pointer-events: none to not interfere with page
      // The overlay should have pointer-events: auto to be interactive
    });

    it('should test pointer events in actual DOM environment', () => {
      mountSidebar();
      
      const hostElement = document.getElementById('ai-browser-sidebar-host');
      expect(hostElement).toBeTruthy();
      
      if (hostElement) {
        const computedStyle = window.getComputedStyle(hostElement);
        expect(computedStyle.pointerEvents).toBe('none');
        
        // Check shadow root content
        const shadowRoot = hostElement.shadowRoot;
        if (shadowRoot) {
          const overlayElement = shadowRoot.querySelector('.ai-sidebar-overlay');
          if (overlayElement) {
            const overlayStyle = window.getComputedStyle(overlayElement);
            expect(overlayStyle.pointerEvents).toBe('auto');
          }
        }
      }
    });

    it('should preserve !important declarations for pointer events', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const unifiedStylesPath = path.resolve(__dirname, '../../../src/sidebar/styles/sidebar.css');
      const content = await fs.readFile(unifiedStylesPath, 'utf-8');
      
      // The !important is critical to override any page styles
      expect(content).toContain('pointer-events: auto !important');
    });
  });

  describe('Shadow DOM Compatibility', () => {
    it('should preserve Shadow DOM isolation styles', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const unifiedStylesPath = path.resolve(__dirname, '../../../src/sidebar/styles/sidebar.css');
      const content = await fs.readFile(unifiedStylesPath, 'utf-8');
      
      // CRITICAL: Stacking context isolation
      expect(content).toContain('isolation: isolate');
      
      // Verify CSS variable import is preserved (needed for Shadow DOM)
      expect(content).toContain("@import '../../styles/variables.css'");
    });

    it('should test Shadow DOM style injection', () => {
      mountSidebar();
      
      const hostElement = document.getElementById('ai-browser-sidebar-host');
      expect(hostElement).toBeTruthy();
      
      if (hostElement) {
        const shadowRoot = hostElement.shadowRoot;
        expect(shadowRoot).toBeTruthy();
        
        if (shadowRoot) {
          // Check that styles are injected into Shadow DOM
          const styleElement = shadowRoot.querySelector('style');
          expect(styleElement).toBeTruthy();
          
          if (styleElement) {
            const styleContent = styleElement.textContent || '';
            // The unified stylesheet should contain chat and icon button styles
            expect(styleContent).toContain('.chat-panel');
            expect(styleContent).toContain('.chat-input');
            expect(styleContent).toContain('.icon-button');
            expect(styleContent).toContain('textarea');
            // Should have substantial content (unified stylesheet)
            expect(styleContent.length).toBeGreaterThan(2000);
          }
        }
      }
    });

    it('should verify Shadow DOM prevents style leakage', () => {
      mountSidebar();
      
      const hostElement = document.getElementById('ai-browser-sidebar-host');
      const shadowRoot = hostElement?.shadowRoot;
      
      if (shadowRoot) {
        // Styles should be contained within shadow root
        const shadowStyles = shadowRoot.querySelectorAll('style');
        
        expect(shadowStyles.length).toBeGreaterThan(0);
        
        // Shadow DOM styles should contain unified styles
        shadowStyles.forEach(style => {
          const content = style.textContent || '';
          // Verify unified stylesheet content is present
          expect(content).toContain('.chat-panel');
          expect(content).toContain('.chat-input');
          expect(content).toContain('.icon-button');
          // Should be substantial (indicates unified stylesheet is loaded)
          expect(content.length).toBeGreaterThan(1000);
        });
        
        // Verify Shadow DOM isolation - styles are not on main page
        const mainPageChatStyles = document.querySelectorAll('style, link[href*="chat"]');
        expect(mainPageChatStyles.length).toBe(0);
      }
    });
  });

  describe('Resize Handle Functionality', () => {
    it('should preserve resize handle positioning', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const unifiedStylesPath = path.resolve(__dirname, '../../../src/sidebar/styles/sidebar.css');
      const content = await fs.readFile(unifiedStylesPath, 'utf-8');
      
      // CRITICAL: Resize handle must be positioned correctly
      expect(content).toContain('.ai-sidebar-resize-handle');
      expect(content).toContain('left: -4px');
      expect(content).toContain('width: 8px');
      expect(content).toContain('height: 100%');
      expect(content).toContain('cursor: ew-resize');
      expect(content).toContain('position: absolute');
    });

    it('should preserve resize handle hover effects', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const unifiedStylesPath = path.resolve(__dirname, '../../../src/sidebar/styles/sidebar.css');
      const content = await fs.readFile(unifiedStylesPath, 'utf-8');
      
      // Verify hover state
      expect(content).toContain('.ai-sidebar-resize-handle:hover');
      expect(content).toContain('var(--primary-500)');
      expect(content).toContain('opacity: 0.3');
    });
  });

  describe('Drag Functionality Styles', () => {
    it('should preserve drag-related cursor and user-select styles', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const unifiedStylesPath = path.resolve(__dirname, '../../../src/sidebar/styles/sidebar.css');
      const content = await fs.readFile(unifiedStylesPath, 'utf-8');
      
      // CRITICAL: Header must be draggable
      expect(content).toContain('cursor: grab');
      expect(content).toContain('user-select: none');
      
      // Should be applied to header
      expect(content).toContain('.ai-sidebar-header');
    });

    it('should preserve header layout for drag functionality', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const unifiedStylesPath = path.resolve(__dirname, '../../../src/sidebar/styles/sidebar.css');
      const content = await fs.readFile(unifiedStylesPath, 'utf-8');
      
      // Header must maintain layout for drag to work
      expect(content).toContain('height: var(--header-height)');
      expect(content).toContain('min-height: var(--header-height)');
    });
  });

  describe('Theme Variable Integration', () => {
    it('should preserve all critical CSS variables used in overlay', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const unifiedStylesPath = path.resolve(__dirname, '../../../src/sidebar/styles/sidebar.css');
      const content = await fs.readFile(unifiedStylesPath, 'utf-8');
      
      // Critical variables for overlay functionality
      const criticalVariables = [
        'var(--shadow-lg)',        // For elevation
        'var(--radius-lg)',        // For container shape
        'var(--background-secondary)', // For container background
        'var(--text-primary)',     // For text color
        'var(--border-primary)',   // For borders
        'var(--header-height)',    // For drag area
        'var(--spacing-sm)',       // For spacing
        'var(--spacing-md)',       // For spacing
        'var(--transition-fast)',  // For interactions
        'var(--hover-overlay)',    // For hover states
        'var(--active-overlay)',   // For active states
        'var(--primary-500)',      // For resize handle
      ];
      
      criticalVariables.forEach(variable => {
        expect(content).toContain(variable);
      });
    });

    it('should test CSS variables work in Shadow DOM environment', () => {
      mountSidebar();
      
      const hostElement = document.getElementById('ai-browser-sidebar-host');
      const shadowRoot = hostElement?.shadowRoot;
      
      if (shadowRoot) {
        // Check that CSS variable import is in the injected styles
        const styleElement = shadowRoot.querySelector('style');
        if (styleElement) {
          const styleContent = styleElement.textContent || '';
          // Should contain CSS variables usage
          expect(styleContent).toContain('var(--');
          
          // Check for specific variables from the unified stylesheet
          const variablePattern = /var\(--[\w-]+\)/g;
          const variables = styleContent.match(variablePattern);
          expect(variables).toBeTruthy();
          if (variables) {
            expect(variables.length).toBeGreaterThan(10); // Many variables should be used
          }
        }
        
        // Test that an element using CSS variables can be styled
        const chatElement = shadowRoot.querySelector('.chat-panel, .chat-input');
        if (chatElement) {
          const computedStyle = window.getComputedStyle(chatElement);
          // At minimum, should have some styling applied
          expect(computedStyle.display).toBeTruthy();
        }
      }
    });
  });

  describe('Performance and Memory', () => {
    it('should not create duplicate style elements', () => {
      mountSidebar();
      
      const hostElement = document.getElementById('ai-browser-sidebar-host');
      const shadowRoot = hostElement?.shadowRoot;
      
      if (shadowRoot) {
        const styleElements = shadowRoot.querySelectorAll('style');
        // Should only have one unified style element
        expect(styleElements.length).toBe(1);
        
        // Should contain all necessary styles
        const styleContent = styleElements[0].textContent || '';
        expect(styleContent.length).toBeGreaterThan(1000); // Substantial content
      }
    });

    it('should test unmounting cleans up properly', () => {
      mountSidebar();
      
      let hostElement = document.getElementById('ai-browser-sidebar-host');
      expect(hostElement).toBeTruthy();
      
      unmountSidebar();
      
      hostElement = document.getElementById('ai-browser-sidebar-host');
      expect(hostElement).toBeFalsy();
    });
  });

  describe('Regression Prevention', () => {
    it('should fail if critical overlay styles are missing', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const unifiedStylesPath = path.resolve(__dirname, '../../../src/sidebar/styles/sidebar.css');
      const content = await fs.readFile(unifiedStylesPath, 'utf-8');
      
      // These styles are CRITICAL and must exist
      const criticalStyles = [
        'position: fixed',
        'z-index: 2147483647',
        'pointer-events: auto !important',
        'isolation: isolate',
        '.ai-sidebar-overlay',
        '.ai-sidebar-container',
        '.ai-sidebar-resize-handle',
        'cursor: grab',
        'user-select: none'
      ];
      
      criticalStyles.forEach(style => {
        if (!content.includes(style)) {
          throw new Error(`Critical overlay style missing: ${style}`);
        }
      });
    });

    it('should maintain exact z-index value', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const unifiedStylesPath = path.resolve(__dirname, '../../../src/sidebar/styles/sidebar.css');
      const content = await fs.readFile(unifiedStylesPath, 'utf-8');
      
      // This exact value is critical - it's the maximum 32-bit signed integer
      expect(content).toContain('z-index: 2147483647');
      
      // Make sure it's not accidentally changed by checking specific boundaries
      expect(content).not.toContain('z-index: 21474836;'); // Missing last digit - not possible as substring
      expect(content).not.toContain('z-index: 21474836470'); // Extra digit
      expect(content).not.toContain('z-index: 999999'); // Lower value
      expect(content).not.toContain('z-index: 2147483648'); // One higher than max int32
    });
  });
});