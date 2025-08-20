/**
 * @file Example usage of Chrome manifest types
 * 
 * This file demonstrates how to use the manifest types in practice
 * for type checking and validation in extension development.
 */

import {
  ChromeManifest,
  validateManifest,
  createSidebarManifestTemplate,
  isChromeManifest,
  Permission
} from './manifest';

/**
 * Example: Creating a type-safe manifest configuration
 */
export function createExtensionManifest(config: {
  name: string;
  version: string;
  description: string;
  permissions?: Permission[];
}): ChromeManifest {
  const template = createSidebarManifestTemplate();
  
  return {
    ...template,
    name: config.name,
    version: config.version,
    description: config.description,
    permissions: config.permissions || template.permissions
  };
}

/**
 * Example: Validating a manifest at runtime
 */
export function validateExtensionManifest(manifest: unknown): {
  success: boolean;
  manifest?: ChromeManifest;
  issues: string[];
} {
  // Type guard check
  if (!isChromeManifest(manifest)) {
    return {
      success: false,
      issues: ['Invalid manifest structure']
    };
  }
  
  // Detailed validation
  const validation = validateManifest(manifest);
  
  if (!validation.isValid) {
    return {
      success: false,
      issues: validation.errors
    };
  }
  
  return {
    success: true,
    manifest,
    issues: validation.warnings
  };
}

/**
 * Example: Type-safe manifest updates
 */
export function updateManifestPermissions(
  manifest: ChromeManifest,
  newPermissions: Permission[]
): ChromeManifest {
  return {
    ...manifest,
    permissions: [...(manifest.permissions || []), ...newPermissions]
  };
}

/**
 * Example usage in extension development:
 * 
 * ```typescript
 * import { createExtensionManifest, validateExtensionManifest } from './manifest-example';
 * 
 * // Create a new manifest
 * const manifest = createExtensionManifest({
 *   name: 'My AI Sidebar',
 *   version: '1.0.0',
 *   description: 'Custom AI sidebar extension'
 * });
 * 
 * // Validate manifest from external source
 * const loadedManifest = JSON.parse(manifestJson);
 * const result = validateExtensionManifest(loadedManifest);
 * 
 * if (result.success) {
 *   console.log('Manifest is valid!');
 *   if (result.issues.length > 0) {
 *     console.warn('Warnings:', result.issues);
 *   }
 * } else {
 *   console.error('Invalid manifest:', result.issues);
 * }
 * ```
 */