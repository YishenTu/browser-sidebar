/**
 * @file Universal Filter Pipeline
 * 
 * Implements a chain of filters to remove noise from extracted content
 * while preserving all meaningful information. Works universally across
 * all websites without site-specific logic.
 */

/**
 * Base filter interface
 */
export interface ContentFilter {
  name: string;
  apply(element: Element): void;
}

/**
 * Filter for removing navigation elements
 */
export class NavigationFilter implements ContentFilter {
  name = 'NavigationFilter';

  private static readonly NAV_SELECTORS = [
    'nav',
    '[role="navigation"]',
    '[aria-label*="navigation" i]',
    '.nav:not(.nav-tabs)',
    '.navbar',
    '.menu:not(.context-menu)',
    '.breadcrumb',
    '#nav',
    '#navigation',
    '#menu:not(.dropdown-menu)',
    '.site-nav',
    '.main-nav',
    '.global-nav'
  ];

  apply(element: Element): void {
    NavigationFilter.NAV_SELECTORS.forEach(selector => {
      try {
        element.querySelectorAll(selector).forEach(el => {
          // Check if element contains article content or comments
          if (!this.containsContent(el)) {
            el.remove();
          }
        });
      } catch {
        // Invalid selector, skip
      }
    });
  }

  private containsContent(element: Element): boolean {
    // Check for article or comment content
    return element.querySelector('article, [class*="comment"], [class*="post"]') !== null ||
           element.textContent!.trim().length > 500;
  }
}

/**
 * Filter for removing advertisements
 */
export class AdvertisementFilter implements ContentFilter {
  name = 'AdvertisementFilter';

  // ML-like heuristics for ad detection
  private static readonly AD_PATTERNS = [
    /^ad[s]?[-_]/i,
    /[-_]ad[s]?$/i,
    /sponsor/i,
    /promoted/i,
    /advertisement/i,
    /^dfp[-_]/i,  // Google DFP ads
    /^gpt[-_]/i,  // Google Publisher Tag
  ];

  private static readonly AD_SELECTORS = [
    // Very specific ad selectors only
    '[data-google-query-id]',
    '.advertisement',
    '[id^="div-gpt-ad"]',
    '[id^="google_ads"]',
    'ins.adsbygoogle',
    'amp-ad',
    'amp-embed',
    'iframe[src*="doubleclick.net"]',
    'iframe[src*="googlesyndication.com"]',
    '.google-ad',
    '.ad-container',
    '.ad-wrapper'
  ];

  // Common ad sizes (width x height)
  private static readonly COMMON_AD_SIZES = [
    [728, 90],   // Leaderboard
    [300, 250],  // Medium Rectangle
    [336, 280],  // Large Rectangle
    [300, 600],  // Half Page
    [320, 50],   // Mobile Banner
    [320, 100],  // Large Mobile Banner
    [250, 250],  // Square
    [200, 200],  // Small Square
    [468, 60],   // Banner
    [234, 60],   // Half Banner
    [120, 600],  // Skyscraper
    [160, 600],  // Wide Skyscraper
    [300, 1050], // Portrait
    [970, 90],   // Large Leaderboard
    [970, 250],  // Billboard
    [980, 120],  // Panorama
  ];

  apply(element: Element): void {
    // Remove by selectors - but be more careful
    AdvertisementFilter.AD_SELECTORS.forEach(selector => {
      try {
        element.querySelectorAll(selector).forEach(el => {
          // Don't remove if it has substantial content
          const textLength = (el.textContent || '').trim().length;
          if (textLength < 100) { // Only remove small ad elements
            el.remove();
          }
        });
      } catch {
        // Invalid selector, skip
      }
    });

    // Be much more careful with pattern matching
    element.querySelectorAll('*').forEach(el => {
      const classStr = typeof el.className === 'string' ? el.className.toLowerCase() : '';
      const idStr = (el.id || '').toLowerCase();
      
      // Very specific ad patterns only
      const isDefinitelyAd = 
        /\bgoogle[-_]?ad/i.test(classStr + ' ' + idStr) ||
        /\badsense/i.test(classStr + ' ' + idStr) ||
        /\bad[-_]?banner/i.test(classStr + ' ' + idStr) ||
        /\bsponsored[-_]?content/i.test(classStr + ' ' + idStr);
      
      if (isDefinitelyAd && (el.textContent || '').trim().length < 100) {
        el.remove();
      }
    });

    // Remove by common ad sizes
    element.querySelectorAll('iframe, div[style*="width"][style*="height"]').forEach(el => {
      if (el instanceof HTMLElement && this.isCommonAdSize(el)) {
        el.remove();
      }
    });
  }

  private matchesAdPattern(text: string): boolean {
    return AdvertisementFilter.AD_PATTERNS.some(pattern => pattern.test(text));
  }

  private isCommonAdSize(element: HTMLElement): boolean {
    const width = element.offsetWidth || parseInt(element.style.width) || 0;
    const height = element.offsetHeight || parseInt(element.style.height) || 0;

    return AdvertisementFilter.COMMON_AD_SIZES.some(([w, h]) => 
      Math.abs(width - w) < 5 && Math.abs(height - h) < 5
    );
  }
}

/**
 * Filter for removing overlays and modals
 */
export class OverlayFilter implements ContentFilter {
  name = 'OverlayFilter';

  private static readonly OVERLAY_SELECTORS = [
    '.modal:not(.show):not(.in):not(.active)',
    '.overlay:not(.visible):not(.active)',
    '.popup:not(.visible):not(.open)',
    '[role="dialog"]:not(.open):not(.show)',
    '.lightbox:not(.active)',
    '.backdrop',
    '.modal-backdrop',
    '.overlay-backdrop'
  ];

  apply(element: Element): void {
    OverlayFilter.OVERLAY_SELECTORS.forEach(selector => {
      try {
        element.querySelectorAll(selector).forEach(el => el.remove());
      } catch {
        // Invalid selector, skip
      }
    });

    // Remove hidden overlays by style
    element.querySelectorAll('[style*="position: fixed"], [style*="position:fixed"]').forEach(el => {
      if (el instanceof HTMLElement) {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
          el.remove();
        }
      }
    });
  }
}

/**
 * Filter for removing cookie and privacy notices
 */
export class PrivacyNoticeFilter implements ContentFilter {
  name = 'PrivacyNoticeFilter';

  private static readonly PRIVACY_SELECTORS = [
    '[class*="cookie"]:not(.cookie-recipe)',
    '[class*="gdpr"]',
    '[class*="consent"]',
    '[class*="privacy-banner"]',
    '[class*="notice-banner"]',
    '[id*="cookie"]:not(#cookie-recipe)',
    '[id*="gdpr"]',
    '[id*="consent"]',
    '.privacy-popup',
    '.cookie-notice',
    '.gdpr-notice',
    '#cookieConsent',
    '[data-cookie-banner]',
    'noscript' // Remove noscript fallback content
  ];

  apply(element: Element): void {
    PrivacyNoticeFilter.PRIVACY_SELECTORS.forEach(selector => {
      try {
        element.querySelectorAll(selector).forEach(el => {
          // Check it's actually a notice and not content about cookies/privacy
          if (this.isPrivacyNotice(el)) {
            el.remove();
          }
        });
      } catch {
        // Invalid selector, skip
      }
    });
  }

  private isPrivacyNotice(element: Element): boolean {
    const text = element.textContent?.toLowerCase() || '';
    const hasAcceptButton = element.querySelector('button[class*="accept"], button[class*="agree"], button[class*="ok"]') !== null;
    const hasPrivacyKeywords = /accept.*cookie|cookie.*policy|gdpr|privacy.*policy|we use cookies/.test(text);
    const isSmallText = text.length < 500;

    return hasAcceptButton || (hasPrivacyKeywords && isSmallText);
  }
}

/**
 * Filter for removing social media widgets
 */
export class SocialWidgetFilter implements ContentFilter {
  name = 'SocialWidgetFilter';

  private static readonly SOCIAL_SELECTORS = [
    '.social-share',
    '.share-buttons',
    '.social-icons',
    '[class*="share-this"]',
    '[class*="add-this"]',
    '.social-media-icons',
    '.social-links:not(.author-social)',
    '.share-widget',
    '.sharing-buttons',
    '[class*="facebook-like"]',
    '[class*="twitter-share"]',
    '[class*="pinterest-button"]',
    'iframe[src*="facebook.com/plugins"]',
    'iframe[src*="platform.twitter.com"]'
  ];

  apply(element: Element): void {
    SocialWidgetFilter.SOCIAL_SELECTORS.forEach(selector => {
      try {
        element.querySelectorAll(selector).forEach(el => el.remove());
      } catch {
        // Invalid selector, skip
      }
    });
  }
}

/**
 * Filter for removing newsletter signup forms
 */
export class NewsletterFilter implements ContentFilter {
  name = 'NewsletterFilter';

  private static readonly NEWSLETTER_SELECTORS = [
    '[class*="newsletter"]:has(form)',
    '[class*="subscribe"]:has(form)',
    '.email-signup',
    '.mailing-list',
    '.signup-form',
    '.subscribe-form',
    '[id*="newsletter"]:has(form)',
    '[id*="subscribe"]:has(form)',
    'form[action*="newsletter"]',
    'form[action*="subscribe"]'
  ];

  apply(element: Element): void {
    NewsletterFilter.NEWSLETTER_SELECTORS.forEach(selector => {
      try {
        element.querySelectorAll(selector).forEach(el => {
          // Only remove if it's a form, not article about newsletters
          if (el.querySelector('input[type="email"], input[name*="email"]')) {
            el.remove();
          }
        });
      } catch {
        // Invalid selector, skip
      }
    });
  }
}

/**
 * Filter for removing empty elements
 */
export class EmptyElementFilter implements ContentFilter {
  name = 'EmptyElementFilter';

  apply(element: Element): void {
    // Remove empty paragraphs, divs, sections
    const emptySelectors = ['p', 'div', 'section', 'article', 'span'];
    
    emptySelectors.forEach(tag => {
      element.querySelectorAll(tag).forEach(el => {
        if (this.isEmpty(el)) {
          el.remove();
        }
      });
    });

    // Remove consecutive br tags
    element.querySelectorAll('br + br + br').forEach(el => el.remove());
  }

  private isEmpty(element: Element): boolean {
    const text = element.textContent?.trim() || '';
    const hasNoText = text.length === 0;
    const hasNoImages = element.querySelectorAll('img, picture, svg').length === 0;
    const hasNoMedia = element.querySelectorAll('video, audio, iframe').length === 0;
    const hasNoChildren = element.children.length === 0;

    return hasNoText && hasNoImages && hasNoMedia && (hasNoChildren || 
           Array.from(element.children).every(child => this.isEmpty(child)));
  }
}

/**
 * Filter for removing duplicate content
 */
export class DuplicateContentFilter implements ContentFilter {
  name = 'DuplicateContentFilter';

  apply(element: Element): void {
    const seenTexts = new Set<string>();
    const minLength = 100; // Minimum text length to consider for deduplication

    element.querySelectorAll('p, div, section').forEach(el => {
      const text = el.textContent?.trim() || '';
      
      if (text.length >= minLength) {
        if (seenTexts.has(text)) {
          el.remove();
        } else {
          seenTexts.add(text);
        }
      }
    });
  }
}

/**
 * Filter for removing footer elements conditionally
 */
export class FooterFilter implements ContentFilter {
  name = 'FooterFilter';

  apply(element: Element): void {
    element.querySelectorAll('footer').forEach(footer => {
      // Keep footer if it contains comments or articles
      const hasComments = footer.querySelector('[class*="comment"], [id*="comment"]') !== null;
      const hasArticles = footer.querySelector('article') !== null;
      const hasSubstantialText = (footer.textContent?.trim().length || 0) > 500;

      if (!hasComments && !hasArticles && !hasSubstantialText) {
        footer.remove();
      }
    });
  }
}

/**
 * Universal filter pipeline that applies all filters in sequence
 */
export class UniversalFilterPipeline {
  private filters: ContentFilter[];

  constructor(customFilters?: ContentFilter[]) {
    this.filters = customFilters || [
      new NavigationFilter(),
      new AdvertisementFilter(),
      new OverlayFilter(),
      new PrivacyNoticeFilter(),
      new SocialWidgetFilter(),
      new NewsletterFilter(),
      new FooterFilter(),
      new EmptyElementFilter(),
      new DuplicateContentFilter()
    ];
  }

  /**
   * Process an element through all filters
   */
  process(element: Element): Element {
    // Clone to avoid modifying original
    const processed = element.cloneNode(true) as Element;

    // Apply each filter in sequence
    for (const filter of this.filters) {
      try {
        filter.apply(processed);
      } catch (error) {
        console.warn(`Filter ${filter.name} failed:`, error);
      }
    }

    return processed;
  }

  /**
   * Add a custom filter to the pipeline
   */
  addFilter(filter: ContentFilter): void {
    this.filters.push(filter);
  }

  /**
   * Remove a filter by name
   */
  removeFilter(name: string): void {
    this.filters = this.filters.filter(f => f.name !== name);
  }

  /**
   * Get list of active filters
   */
  getFilters(): string[] {
    return this.filters.map(f => f.name);
  }
}