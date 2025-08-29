/**
 * @file Raw Mode Extractor
 *
 * Extracts content with minimal processing to preserve HTML structure,
 * especially tables. Alternative to Defuddle for table-heavy pages.
 */

import { isVisible } from '@tabext/utils/domUtils';
import type { ExtractedContent } from '@/types/extraction';

/**
 * Configuration options for raw mode extraction
 */
interface RawModeOptions {
  /** Selector hints for main content containers */
  root_hints?: string[];
  /** Remove class attributes (default: true) */
  strip_class?: boolean;
  /** Preserve id attributes (default: true) */
  keep_id?: boolean;
  /** Inject ::before/::after content (default: false) */
  inject_pseudo?: boolean;
  /** Handle Shadow DOM (default: false, future feature) */
  shadow_aware?: boolean;

  // Stripping toggles - all default to false (don't strip) for testing
  /** Strip invisible elements (default: false for testing) */
  strip_invisible?: boolean;
  /** Strip script tags (default: false for testing) */
  strip_scripts?: boolean;
  /** Strip style tags (default: false for testing) */
  strip_styles?: boolean;
  /** Strip link tags (default: false for testing) */
  strip_links?: boolean;
  /** Strip noscript tags (default: false for testing) */
  strip_noscript?: boolean;
  /** Strip iframe tags (default: false for testing) */
  strip_iframes?: boolean;
  /** Strip object tags (default: false for testing) */
  strip_objects?: boolean;
  /** Strip embed tags (default: false for testing) */
  strip_embeds?: boolean;
  /** Strip applet tags (default: false for testing) */
  strip_applets?: boolean;
  /** Strip svg tags (default: false for testing) */
  strip_svg?: boolean;
  /** Strip canvas tags (default: false for testing) */
  strip_canvas?: boolean;
  /** Strip event handlers (onclick, etc.) (default: false for testing) */
  strip_event_handlers?: boolean;
  /** Strip javascript: URLs (default: false for testing) */
  strip_javascript_urls?: boolean;
  /** Only keep safe attributes (default: false for testing) */
  strip_unsafe_attrs?: boolean;
  /** Try to find main content area (default: false for testing) */
  find_main_content?: boolean;
}

/**
 * Extract content in raw mode (preserves HTML structure, especially tables)
 *
 * @param options - Raw mode extraction options
 * @returns Extracted content with preserved HTML structure
 */
export async function extractWithRaw(options?: RawModeOptions): Promise<ExtractedContent> {
  // 1. Find the best root element for content (or use body if disabled)
  const root =
    options?.find_main_content !== false ? pickRoot(document, options?.root_hints) : document.body;

  // 2. Create a clean document for processing
  const cleanDoc = document.implementation.createHTMLDocument('raw');

  // 3. Deep clone nodes with optional sanitization
  const clonedRoot = deepCloneVisible(root, cleanDoc, options);
  if (clonedRoot) {
    cleanDoc.body.appendChild(clonedRoot);
  }

  // 4. URL normalization will be handled by orchestrator via normalizeUrls()
  // Don't duplicate that work here

  // 5. Calculate metadata
  const tables = cleanDoc.querySelectorAll('table');
  const textContent = cleanDoc.body.textContent || '';
  const hasCodeBlocks = cleanDoc.querySelectorAll('pre, code').length > 0;

  // 6. Return full ExtractedContent shape
  const result = {
    title: document.title || 'Untitled',
    url: window.location.href,
    domain: window.location.hostname,
    content: cleanDoc.body.innerHTML, // Raw HTML
    textContent,
    excerpt: textContent.substring(0, 200) + (textContent.length > 200 ? '...' : ''),
    extractedAt: Date.now(),
    extractionMethod: 'raw' as const,
    metadata: {
      hasCodeBlocks,
      hasTables: tables.length > 0,
      truncated: false,
    },
  };

  return result;
}

/**
 * Pick the best root element for content extraction
 *
 * @param doc - Document to search in
 * @param hints - Optional selector hints for known content containers
 * @returns Best root element for extraction
 */
function pickRoot(doc: Document, hints?: string[]): Element {
  // Try user-provided hints first
  if (hints) {
    for (const selector of hints) {
      try {
        const el = doc.querySelector(selector);
        if (el && isVisible(el)) {
          return el;
        }
      } catch (e) {
        // Invalid selector, skip
      }
    }
  }

  // Try common content containers
  const commonSelectors = [
    'main',
    'article',
    '[role="main"]',
    '#content',
    '.content',
    '.main-content',
    '.post-content',
    '.entry-content',
    '.article-content',
  ];

  for (const selector of commonSelectors) {
    try {
      const el = doc.querySelector(selector);
      if (el && isVisible(el)) {
        return el;
      }
    } catch (e) {
      // Invalid selector, skip
    }
  }

  // Fallback to body
  return doc.body;
}

/**
 * Deep clone visible nodes with security sanitization
 *
 * @param source - Source element to clone
 * @param targetDoc - Target document for cloned nodes
 * @param options - Raw mode options
 * @returns Cloned and sanitized element
 */
function deepCloneVisible(
  source: Element,
  targetDoc: Document,
  options?: RawModeOptions
): Element | null {
  // Skip invisible elements (if enabled)
  if (options?.strip_invisible !== false && !isVisible(source)) {
    return null;
  }

  // Build list of tags to skip based on options (all default to false = don't strip)
  const dangerousTags: string[] = [];

  if (options?.strip_scripts !== false) dangerousTags.push('SCRIPT');
  if (options?.strip_styles !== false) dangerousTags.push('STYLE');
  if (options?.strip_links !== false) dangerousTags.push('LINK');
  if (options?.strip_noscript !== false) dangerousTags.push('NOSCRIPT');
  if (options?.strip_iframes !== false) dangerousTags.push('IFRAME');
  if (options?.strip_objects !== false) dangerousTags.push('OBJECT');
  if (options?.strip_embeds !== false) dangerousTags.push('EMBED');
  if (options?.strip_applets !== false) dangerousTags.push('APPLET');
  if (options?.strip_svg !== false) dangerousTags.push('SVG');
  if (options?.strip_canvas !== false) dangerousTags.push('CANVAS');

  if (dangerousTags.includes(source.tagName)) {
    return null;
  }

  // Create the cloned element
  const clone = targetDoc.createElement(source.tagName.toLowerCase());

  if (options?.strip_unsafe_attrs !== false) {
    // Only copy safe attributes (original behavior)
    const safeAttributes = [
      'href',
      'src',
      'srcset',
      'alt',
      'title',
      'width',
      'height',
      'colspan',
      'rowspan',
      'scope',
      'headers',
      'role',
      'aria-label',
      'aria-describedby',
      'data-src',
      'data-srcset',
    ];

    // Optionally include id
    if (options?.keep_id !== false) {
      safeAttributes.push('id');
    }

    // Optionally include class (for code language detection)
    if (!options?.strip_class) {
      safeAttributes.push('class');
    }

    for (const attr of safeAttributes) {
      const value = source.getAttribute(attr);
      if (value) {
        // Skip javascript: URLs if stripping is enabled
        if (options?.strip_javascript_urls !== false && (attr === 'href' || attr === 'src')) {
          if (value.startsWith('javascript:')) {
            continue;
          }
        }
        try {
          clone.setAttribute(attr, value);
        } catch (e) {
          // Skip invalid attributes (malformed HTML)
          console.warn('[RAW] Skipping invalid attribute:', attr);
        }
      }
    }
  } else {
    // Copy ALL attributes (testing mode)
    Array.from(source.attributes).forEach(attr => {
      // Skip event handlers if stripping is enabled
      if (options?.strip_event_handlers !== false && attr.name.startsWith('on')) {
        return;
      }

      // Skip javascript: URLs if stripping is enabled
      if (
        options?.strip_javascript_urls !== false &&
        (attr.name === 'href' || attr.name === 'src') &&
        attr.value.startsWith('javascript:')
      ) {
        return;
      }

      try {
        clone.setAttribute(attr.name, attr.value);
      } catch (e) {
        // Skip invalid attributes (malformed HTML)
        console.warn('[RAW] Skipping invalid attribute:', attr.name);
      }
    });
  }

  // Handle text nodes
  for (const child of Array.from(source.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent;
      if (text && text.trim()) {
        clone.appendChild(targetDoc.createTextNode(text));
      }
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const clonedChild = deepCloneVisible(child as Element, targetDoc, options);
      if (clonedChild) {
        clone.appendChild(clonedChild);
      }
    }
  }

  // Inject pseudo-elements if requested (future feature)
  if (options?.inject_pseudo && window.getComputedStyle) {
    try {
      const before = window.getComputedStyle(source, '::before').content;
      const after = window.getComputedStyle(source, '::after').content;

      if (before && before !== 'none' && before !== '""') {
        const cleanContent = before.replace(/^["']|["']$/g, '');
        if (cleanContent) {
          clone.insertBefore(targetDoc.createTextNode(cleanContent), clone.firstChild);
        }
      }

      if (after && after !== 'none' && after !== '""') {
        const cleanContent = after.replace(/^["']|["']$/g, '');
        if (cleanContent) {
          clone.appendChild(targetDoc.createTextNode(cleanContent));
        }
      }
    } catch (e) {
      // Ignore pseudo-element extraction errors
    }
  }

  return clone;
}

/**
 * Site-specific configurations for known problematic sites
 * Can be extended in the future for better extraction
 */
export const SITE_CONFIGS: Record<string, RawModeOptions> = {
  'qichacha.com': {
    root_hints: ['.company-detail', '.layout-content'],
    inject_pseudo: true, // They use ::before for some labels
  },
  'bloomberg.com': {
    root_hints: ['.content-main', 'article'],
  },
  'github.com': {
    root_hints: ['.repository-content', '.markdown-body', 'article'],
  },
  'stackoverflow.com': {
    root_hints: ['#mainbar', '.question', '.answer'],
  },
};
