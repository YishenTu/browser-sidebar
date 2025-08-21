/**
 * @file Tests for Chrome manifest type definitions and validation
 */

import { describe, it, expect } from 'vitest';
import {
  ChromeManifest,
  isChromeManifest,
  validateManifest,
  createSidebarManifestTemplate,
  type IconConfig,
  type Permission,
  type ContentScript,
} from '../../src/types/manifest';

describe('ChromeManifest Types', () => {
  const validManifest: ChromeManifest = {
    manifest_version: 3,
    name: 'Test Extension',
    version: '1.0.0',
    description: 'A test extension',
    permissions: ['storage', 'tabs'],
    background: {
      service_worker: 'background.js',
    },
    content_scripts: [
      {
        matches: ['<all_urls>'],
        js: ['content.js'],
      },
    ],
    icons: {
      '16': 'icon16.png',
      '48': 'icon48.png',
    },
  };

  describe('isChromeManifest', () => {
    it('should return true for valid manifest', () => {
      expect(isChromeManifest(validManifest)).toBe(true);
    });

    it('should return false for invalid manifest version', () => {
      const invalid = { ...validManifest, manifest_version: 2 };
      expect(isChromeManifest(invalid)).toBe(false);
    });

    it('should return false for missing name', () => {
      const invalid = { ...validManifest };
      delete (invalid as any).name;
      expect(isChromeManifest(invalid)).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(isChromeManifest('not an object')).toBe(false);
      expect(isChromeManifest(null)).toBe(false);
    });
  });

  describe('validateManifest', () => {
    it('should validate correct manifest', () => {
      const result = validateManifest(validManifest);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should catch missing required fields', () => {
      const invalid = { manifest_version: 3 };
      const result = validateManifest(invalid);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('name must be a non-empty string');
      expect(result.errors).toContain('version must be a non-empty string');
      expect(result.errors).toContain('description must be a non-empty string');
    });

    it('should validate permissions array', () => {
      const invalid = { ...validManifest, permissions: 'not an array' };
      const result = validateManifest(invalid);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('permissions must be an array');
    });

    it('should validate background configuration', () => {
      const invalid = {
        ...validManifest,
        background: { service_worker: 123 as any },
      };
      const result = validateManifest(invalid);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('background.service_worker must be a string');
    });

    it('should validate content_scripts array and structure', () => {
      const invalidArray = { ...validManifest, content_scripts: 'not an array' };
      let result = validateManifest(invalidArray);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('content_scripts must be an array');

      const invalidScript = {
        ...validManifest,
        content_scripts: [{ js: ['test.js'] }], // missing matches
      };
      result = validateManifest(invalidScript);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('content_scripts[0].matches must be an array');
    });

    it('should warn about popup in custom sidebar architecture', () => {
      const withPopup = {
        ...validManifest,
        action: {
          default_popup: 'popup.html',
        },
      };
      const result = validateManifest(withPopup);

      expect(result.isValid).toBe(true);
      expect(
        result.warnings.some(warning =>
          warning.includes('default_popup is set but this extension uses a custom sidebar')
        )
      ).toBe(true);
    });

    it('should warn about side_panel configuration', () => {
      const withSidePanel = {
        ...validManifest,
        side_panel: {
          default_path: 'sidepanel.html',
        },
      };
      const result = validateManifest(withSidePanel);

      expect(result.isValid).toBe(true);
      expect(
        result.warnings.some(warning =>
          warning.includes('side_panel is configured but this extension uses a custom sidebar')
        )
      ).toBe(true);
    });

    it('should warn about missing sidebar permissions', () => {
      const withoutSidebarPerms = {
        ...validManifest,
        permissions: ['storage'] as Permission[],
      };
      const result = validateManifest(withoutSidebarPerms);

      expect(result.isValid).toBe(true);
      expect(
        result.warnings.some(warning =>
          warning.includes('Missing recommended permissions for custom sidebar')
        )
      ).toBe(true);
    });
  });

  describe('createSidebarManifestTemplate', () => {
    it('should create valid sidebar manifest template', () => {
      const template = createSidebarManifestTemplate();

      expect(template.manifest_version).toBe(3);
      expect(template.name).toBe('AI Browser Sidebar');
      expect(template.permissions).toContain('tabs');
      expect(template.permissions).toContain('activeTab');
      expect(template.permissions).toContain('scripting');
      expect(template.background?.service_worker).toBe('src/background/index.ts');
      expect(template.content_scripts).toHaveLength(1);
      expect(template.content_scripts?.[0].matches).toEqual(['<all_urls>']);

      const validationResult = validateManifest(template);
      expect(validationResult.isValid).toBe(true);
    });
  });

  describe('Real manifest validation', () => {
    it('should validate the actual project manifest.json', async () => {
      // Load the actual manifest.json from the project
      const fs = await import('fs');
      const path = await import('path');

      const manifestPath = path.resolve(process.cwd(), 'manifest.json');
      const manifestContent = fs.readFileSync(manifestPath, 'utf8');
      const manifest = JSON.parse(manifestContent);

      expect(isChromeManifest(manifest)).toBe(true);

      const result = validateManifest(manifest);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);

      // Should have no warnings since this manifest is designed for custom sidebar
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('Type compatibility', () => {
    it('should allow standard icon sizes', () => {
      const icons: IconConfig = {
        '16': 'icon16.png',
        '32': 'icon32.png',
        '48': 'icon48.png',
        '128': 'icon128.png',
      };

      expect(icons['16']).toBe('icon16.png');
    });

    it('should allow custom icon sizes', () => {
      const icons: IconConfig = {
        '64': 'icon64.png',
        '256': 'icon256.png',
      };

      expect(icons['64']).toBe('icon64.png');
    });

    it('should work with content script configuration', () => {
      const contentScript: ContentScript = {
        matches: ['https://*.example.com/*'],
        js: ['content.js'],
        run_at: 'document_idle',
        all_frames: false,
        world: 'ISOLATED',
      };

      expect(contentScript.matches).toEqual(['https://*.example.com/*']);
      expect(contentScript.run_at).toBe('document_idle');
    });
  });
});
