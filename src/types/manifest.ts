/**
 * TypeScript type definitions for Chrome Extension Manifest V3
 * 
 * This module provides comprehensive type definitions for Chrome extension
 * manifest.json files following the Manifest V3 specification, with
 * specific support for the custom sidebar architecture.
 */

/**
 * Icon sizes supported by Chrome extensions
 */
export type IconSize = '16' | '32' | '48' | '128' | '256';

/**
 * Icon configuration object mapping sizes to file paths
 */
export type IconConfig = {
  [K in IconSize]?: string;
} & {
  [key: string]: string;
};

/**
 * Background script configuration for Manifest V3
 */
export interface BackgroundConfig {
  /** Path to the service worker script */
  service_worker: string;
  /** Module type for the service worker */
  type?: 'module';
}

/**
 * Browser action configuration (toolbar button)
 */
export interface ActionConfig {
  /** Default icon configurations */
  default_icon?: IconConfig;
  /** Default title shown on hover */
  default_title?: string;
  /** Default popup HTML file (not used in custom sidebar architecture) */
  default_popup?: string;
}

/**
 * Content script configuration
 */
export interface ContentScript {
  /** URL patterns where the script should run */
  matches: string[];
  /** JavaScript files to inject */
  js?: string[];
  /** CSS files to inject */
  css?: string[];
  /** When to inject the script */
  run_at?: 'document_start' | 'document_end' | 'document_idle';
  /** Whether to inject into all frames */
  all_frames?: boolean;
  /** Whether to inject into frames with about: schemes */
  match_about_blank?: boolean;
  /** Exclude patterns */
  exclude_matches?: string[];
  /** Include globs */
  include_globs?: string[];
  /** Exclude globs */
  exclude_globs?: string[];
  /** World to execute script in */
  world?: 'ISOLATED' | 'MAIN';
}

/**
 * Web accessible resources configuration
 */
export interface WebAccessibleResource {
  /** Resource patterns that should be web accessible */
  resources: string[];
  /** URL patterns that can access these resources */
  matches: string[];
  /** Extension IDs that can access these resources */
  extension_ids?: string[];
  /** Whether to use dynamic URL */
  use_dynamic_url?: boolean;
}

/**
 * Content Security Policy configuration
 */
export interface ContentSecurityPolicy {
  /** CSP for extension pages */
  extension_pages?: string;
  /** CSP for sandboxed pages */
  sandbox?: string;
}

/**
 * Host permissions - URL patterns for host access
 */
export type HostPermission = string;

/**
 * Chrome extension permissions
 */
export type Permission = 
  | 'activeTab'
  | 'alarms'
  | 'background'
  | 'bookmarks'
  | 'browsingData'
  | 'certificateProvider'
  | 'clipboardRead'
  | 'clipboardWrite'
  | 'contentSettings'
  | 'contextMenus'
  | 'cookies'
  | 'debugger'
  | 'declarativeContent'
  | 'declarativeNetRequest'
  | 'declarativeNetRequestFeedback'
  | 'declarativeNetRequestWithHostAccess'
  | 'desktopCapture'
  | 'documentScan'
  | 'downloads'
  | 'enterprise.deviceAttributes'
  | 'enterprise.hardwarePlatform'
  | 'enterprise.networkingAttributes'
  | 'enterprise.platformKeys'
  | 'fileBrowserHandler'
  | 'fileSystemProvider'
  | 'fontSettings'
  | 'gcm'
  | 'geolocation'
  | 'history'
  | 'identity'
  | 'idle'
  | 'loginState'
  | 'management'
  | 'nativeMessaging'
  | 'notifications'
  | 'offscreen'
  | 'pageCapture'
  | 'platformKeys'
  | 'power'
  | 'printerProvider'
  | 'printing'
  | 'printingMetrics'
  | 'privacy'
  | 'processes'
  | 'proxy'
  | 'scripting'
  | 'search'
  | 'sessions'
  | 'sidePanel'
  | 'storage'
  | 'system.cpu'
  | 'system.display'
  | 'system.memory'
  | 'system.storage'
  | 'tabCapture'
  | 'tabGroups'
  | 'tabs'
  | 'topSites'
  | 'tts'
  | 'ttsEngine'
  | 'unlimitedStorage'
  | 'vpnProvider'
  | 'wallpaper'
  | 'webNavigation'
  | 'webRequest'
  | 'webRequestBlocking';

/**
 * Optional permissions that can be requested at runtime
 */
export interface OptionalPermissions {
  /** Permissions that can be requested */
  permissions?: Permission[];
  /** Host permissions that can be requested */
  host_permissions?: HostPermission[];
}

/**
 * Chrome Extension Manifest V3 interface
 * 
 * This interface defines the complete structure for a Chrome extension
 * manifest.json file following Manifest V3 specifications, with support
 * for the custom sidebar architecture used in this project.
 */
export interface ChromeManifest {
  /** Manifest version - must be 3 for modern extensions */
  manifest_version: 3;
  
  /** Extension name displayed to users */
  name: string;
  
  /** Extension version (semver format recommended) */
  version: string;
  
  /** Brief description of the extension */
  description: string;
  
  /** Required permissions for the extension */
  permissions?: Permission[];
  
  /** Host permissions for accessing web content */
  host_permissions?: HostPermission[];
  
  /** Background script configuration */
  background?: BackgroundConfig;
  
  /** Browser action (toolbar button) configuration */
  action?: ActionConfig;
  
  /** Content scripts to inject into web pages */
  content_scripts?: ContentScript[];
  
  /** Extension icons */
  icons?: IconConfig;
  
  /** Resources accessible to web pages */
  web_accessible_resources?: WebAccessibleResource[];
  
  /** Content Security Policy */
  content_security_policy?: ContentSecurityPolicy;
  
  /** Optional permissions */
  optional_permissions?: OptionalPermissions;
  
  /** Minimum Chrome version required */
  minimum_chrome_version?: string;
  
  /** Short extension name for space-constrained areas */
  short_name?: string;
  
  /** Author information */
  author?: string;
  
  /** Homepage URL */
  homepage_url?: string;
  
  /** Update URL for extension updates */
  update_url?: string;
  
  /** Default locale for internationalization */
  default_locale?: string;
  
  /** Key for extension ID consistency during development */
  key?: string;
  
  /** OAuth2 configuration */
  oauth2?: {
    client_id: string;
    scopes: string[];
  };
  
  /** Chrome URL overrides */
  chrome_url_overrides?: {
    newtab?: string;
    bookmarks?: string;
    history?: string;
  };
  
  /** Commands (keyboard shortcuts) */
  commands?: {
    [commandName: string]: {
      suggested_key?: {
        default?: string;
        windows?: string;
        mac?: string;
        chromeos?: string;
        linux?: string;
      };
      description?: string;
      global?: boolean;
    };
  };
  
  /** Omnibox keyword */
  omnibox?: {
    keyword: string;
  };
  
  /** File browser handlers */
  file_browser_handlers?: Array<{
    id: string;
    default_title: string;
    file_filters: string[];
  }>;
  
  /** Import/export configuration */
  import?: Array<{
    id: string;
    minimum_version?: string;
  }>;
  
  /** Export configuration */
  export?: {
    whitelist?: string[];
  };
  
  /** Incognito behavior */
  incognito?: 'spanning' | 'split' | 'not_allowed';
  
  /** Side panel configuration (not used in custom sidebar architecture) */
  side_panel?: {
    default_path: string;
  };
}

/**
 * Type guard to check if an object is a valid ChromeManifest
 */
export function isChromeManifest(obj: unknown): obj is ChromeManifest {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }
  
  const manifest = obj as Partial<ChromeManifest>;
  
  // Check required fields
  return (
    manifest.manifest_version === 3 &&
    typeof manifest.name === 'string' &&
    typeof manifest.version === 'string' &&
    typeof manifest.description === 'string'
  );
}

/**
 * Validation result for manifest validation
 */
export interface ManifestValidationResult {
  /** Whether the manifest is valid */
  isValid: boolean;
  /** Validation errors if any */
  errors: string[];
  /** Validation warnings if any */
  warnings: string[];
}

/**
 * Validates a Chrome extension manifest object
 * 
 * @param manifest - The manifest object to validate
 * @returns Validation result with errors and warnings
 */
export function validateManifest(manifest: unknown): ManifestValidationResult {
  const result: ManifestValidationResult = {
    isValid: true,
    errors: [],
    warnings: []
  };
  
  // Check if manifest is an object
  if (typeof manifest !== 'object' || manifest === null) {
    result.isValid = false;
    result.errors.push('Manifest must be an object');
    return result;
  }
  
  const m = manifest as Partial<ChromeManifest>;
  
  // Validate required fields
  if (m.manifest_version !== 3) {
    result.isValid = false;
    result.errors.push('manifest_version must be 3');
  }
  
  if (typeof m.name !== 'string' || m.name.trim() === '') {
    result.isValid = false;
    result.errors.push('name must be a non-empty string');
  }
  
  if (typeof m.version !== 'string' || m.version.trim() === '') {
    result.isValid = false;
    result.errors.push('version must be a non-empty string');
  }
  
  if (typeof m.description !== 'string' || m.description.trim() === '') {
    result.isValid = false;
    result.errors.push('description must be a non-empty string');
  }
  
  // Validate permissions array
  if (m.permissions && !Array.isArray(m.permissions)) {
    result.isValid = false;
    result.errors.push('permissions must be an array');
  }
  
  // Validate host_permissions array
  if (m.host_permissions && !Array.isArray(m.host_permissions)) {
    result.isValid = false;
    result.errors.push('host_permissions must be an array');
  }
  
  // Validate background configuration
  if (m.background) {
    if (typeof m.background !== 'object') {
      result.isValid = false;
      result.errors.push('background must be an object');
    } else {
      if (typeof m.background.service_worker !== 'string') {
        result.isValid = false;
        result.errors.push('background.service_worker must be a string');
      }
    }
  }
  
  // Validate content_scripts array
  if (m.content_scripts) {
    if (!Array.isArray(m.content_scripts)) {
      result.isValid = false;
      result.errors.push('content_scripts must be an array');
    } else {
      m.content_scripts.forEach((script, index) => {
        if (!script.matches || !Array.isArray(script.matches)) {
          result.isValid = false;
          result.errors.push(`content_scripts[${index}].matches must be an array`);
        }
      });
    }
  }
  
  // Validate icons object
  if (m.icons && typeof m.icons !== 'object') {
    result.isValid = false;
    result.errors.push('icons must be an object');
  }
  
  // Custom sidebar architecture validation
  if (m.action?.default_popup) {
    result.warnings.push(
      'default_popup is set but this extension uses a custom sidebar architecture. ' +
      'Consider removing default_popup for consistency.'
    );
  }
  
  if (m.side_panel) {
    result.warnings.push(
      'side_panel is configured but this extension uses a custom sidebar architecture. ' +
      'The side_panel configuration will be ignored.'
    );
  }
  
  // Check for required permissions for custom sidebar
  const requiredPermissions = ['tabs', 'activeTab', 'scripting'];
  const missingPermissions = requiredPermissions.filter(
    perm => !m.permissions?.includes(perm as Permission)
  );
  
  if (missingPermissions.length > 0) {
    result.warnings.push(
      `Missing recommended permissions for custom sidebar: ${missingPermissions.join(', ')}`
    );
  }
  
  return result;
}

/**
 * Creates a basic manifest template for the custom sidebar architecture
 */
export function createSidebarManifestTemplate(): ChromeManifest {
  return {
    manifest_version: 3,
    name: 'AI Browser Sidebar',
    version: '1.0.0',
    description: 'Chat with any webpage using AI. Privacy-focused extension with BYOK support.',
    
    permissions: ['storage', 'tabs', 'activeTab', 'scripting'],
    host_permissions: ['<all_urls>'],
    
    background: {
      service_worker: 'src/background/index.ts',
      type: 'module'
    },
    
    action: {
      default_title: 'Toggle AI Browser Sidebar'
    },
    
    content_scripts: [
      {
        matches: ['<all_urls>'],
        js: ['src/content/index.ts'],
        run_at: 'document_idle',
        all_frames: false
      }
    ],
    
    icons: {
      '16': 'icons/icon16.png',
      '32': 'icons/icon32.png',
      '48': 'icons/icon48.png',
      '128': 'icons/icon128.png'
    },
    
    web_accessible_resources: [
      {
        resources: ['icons/*'],
        matches: ['<all_urls>']
      }
    ]
  };
}