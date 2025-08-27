/**
 * @file SPA (Single Page Application) Detection
 * 
 * Detects when a page is a JavaScript-rendered SPA and whether
 * content has been loaded or if we're seeing a fallback page.
 */

/**
 * Detection result for SPA status
 */
export interface SPADetectionResult {
  isSPA: boolean;
  isLoaded: boolean;
  isFallbackPage: boolean;
  hasActualContent: boolean;
  framework?: string;
  recommendations?: string[];
}

/**
 * Detector for Single Page Applications and their loading state
 */
export class SPADetector {
  // Patterns indicating a no-JS fallback page
  private static readonly FALLBACK_PATTERNS = [
    /javascript is (not available|disabled)/i,
    /please enable javascript/i,
    /switch to a supported browser/i,
    /this site requires javascript/i,
    /turn on javascript/i,
    /javascript must be enabled/i,
    /noscript/i
  ];

  // Common SPA frameworks and their indicators
  private static readonly SPA_INDICATORS = {
    react: [
      '#root', '#__next', '.react-root',
      '[data-reactroot]', '[data-react-root]',
      '__reactInternalInstance', '__reactContainere'
    ],
    vue: [
      '#app', '.vue-app',
      '[data-v-]', '__vue__', '__vue_app__'
    ],
    angular: [
      '[ng-version]', 'ng-app', '[ng-controller]',
      'app-root', '[_ngcontent-]'
    ],
    twitter: [
      'div[data-testid]', '[role="article"]',
      '[data-testid="tweet"]', '[data-testid="cellInnerDiv"]'
    ]
  };

  // Minimum content thresholds (more reasonable)
  private static readonly MIN_CONTENT_LENGTH = 100; // Lower threshold - some pages are legitimately small
  private static readonly MIN_INTERACTIVE_ELEMENTS = 2; // Lower threshold - simple pages exist

  /**
   * Detect if the current page is a SPA and its loading state
   */
  detect(doc: Document): SPADetectionResult {
    const bodyText = doc.body.textContent || '';
    const bodyHTML = doc.body.innerHTML;

    // Check for fallback page
    const isFallbackPage = this.isFallbackPage(bodyText, bodyHTML);
    
    // Check for SPA indicators
    const framework = this.detectFramework(doc);
    const isSPA = framework !== undefined || this.hasSPACharacteristics(doc);
    
    // Check if content is actually loaded
    const hasActualContent = this.hasActualContent(doc);
    const isLoaded = !isFallbackPage && hasActualContent;

    // Generate recommendations
    const recommendations = this.generateRecommendations(isSPA, isLoaded, isFallbackPage);

    return {
      isSPA,
      isLoaded,
      isFallbackPage,
      hasActualContent,
      framework,
      recommendations
    };
  }

  /**
   * Check if this is a JavaScript-disabled fallback page
   */
  private isFallbackPage(text: string, html: string): boolean {
    // Only check for explicit JavaScript disabled messages
    const hasFallbackText = SPADetector.FALLBACK_PATTERNS.some(pattern => 
      pattern.test(text)
    );

    // Check for noscript tags ONLY if they contain JS disabled messages
    const hasNoscriptWithJSMessage = /<noscript[^>]*>[\s\S]*?(javascript|JavaScript)[\s\S]*?<\/noscript>/i.test(html) &&
                                     text.length < 1000;

    // More specific check - must have BOTH error-like content AND JS-related keywords
    const hasJSErrorMessage = text.length < 500 && 
                              (text.toLowerCase().includes('javascript') || 
                               text.toLowerCase().includes('script')) &&
                              (text.toLowerCase().includes('disabled') || 
                               text.toLowerCase().includes('not available') ||
                               text.toLowerCase().includes('required'));

    return hasFallbackText || hasNoscriptWithJSMessage || hasJSErrorMessage;
  }

  /**
   * Detect which SPA framework is being used
   */
  private detectFramework(doc: Document): string | undefined {
    // Check for React
    if (this.hasReactIndicators(doc)) return 'react';
    
    // Check for Vue
    if (this.hasVueIndicators(doc)) return 'vue';
    
    // Check for Angular
    if (this.hasAngularIndicators(doc)) return 'angular';
    
    // Check for Twitter/X specifically
    if (this.isTwitter(doc)) return 'twitter';
    
    return undefined;
  }

  /**
   * Check for React indicators
   */
  private hasReactIndicators(doc: Document): boolean {
    // Check for React root elements
    const hasRootElement = doc.querySelector('#root, #__next, .react-root') !== null;
    
    // Check for React attributes
    const hasReactAttrs = doc.querySelector('[data-reactroot], [data-react-root]') !== null;
    
    // Check for React in window object (if accessible)
    const hasReactGlobal = typeof (window as any).React !== 'undefined' ||
                          typeof (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__ !== 'undefined';
    
    return hasRootElement || hasReactAttrs || hasReactGlobal;
  }

  /**
   * Check for Vue indicators
   */
  private hasVueIndicators(doc: Document): boolean {
    // Check for Vue root elements
    const hasAppElement = doc.querySelector('#app, .vue-app') !== null;
    
    // Check for Vue attributes (v-data attributes)
    const hasVueAttrs = doc.querySelector('[data-v-]') !== null;
    
    // Check for Vue in window object
    const hasVueGlobal = typeof (window as any).Vue !== 'undefined' ||
                        typeof (window as any).__VUE__ !== 'undefined';
    
    return hasAppElement || hasVueAttrs || hasVueGlobal;
  }

  /**
   * Check for Angular indicators
   */
  private hasAngularIndicators(doc: Document): boolean {
    // Check for Angular attributes
    const hasNgVersion = doc.querySelector('[ng-version]') !== null;
    const hasNgApp = doc.querySelector('[ng-app], app-root') !== null;
    const hasNgContent = doc.querySelector('[_ngcontent-]') !== null;
    
    // Check for Angular in window object
    const hasAngularGlobal = typeof (window as any).ng !== 'undefined';
    
    return hasNgVersion || hasNgApp || hasNgContent || hasAngularGlobal;
  }

  /**
   * Check if this is Twitter/X specifically
   */
  private isTwitter(doc: Document): boolean {
    const domain = doc.location?.hostname || '';
    const isTwitterDomain = domain.includes('twitter.com') || domain.includes('x.com');
    
    // Check for Twitter-specific elements
    const hasTwitterElements = doc.querySelector('[data-testid="tweet"], [role="article"]') !== null;
    
    return isTwitterDomain || hasTwitterElements;
  }

  /**
   * Check for general SPA characteristics
   */
  private hasSPACharacteristics(doc: Document): boolean {
    // Check for minimal initial HTML with a root container
    const hasRootContainer = doc.querySelector('#root, #app, .app-root, [id*="root"]') !== null;
    
    // Check for heavy use of data attributes (common in SPAs)
    const dataAttributes = doc.querySelectorAll('[data-id], [data-testid], [data-component]');
    const hasDataAttributes = dataAttributes.length > 10;
    
    // Check for dynamic content indicators
    const hasDynamicContent = doc.querySelectorAll('[class*="loading"], [class*="spinner"], [class*="skeleton"]').length > 0;
    
    return hasRootContainer && (hasDataAttributes || hasDynamicContent);
  }

  /**
   * Check if actual content has been loaded
   */
  private hasActualContent(doc: Document): boolean {
    // Check text content length
    const textLength = (doc.body.textContent || '').trim().length;
    if (textLength < SPADetector.MIN_CONTENT_LENGTH) return false;
    
    // Check for interactive elements
    const interactiveElements = doc.querySelectorAll('a, button, input, select, textarea, [role="button"], [onclick]');
    if (interactiveElements.length < SPADetector.MIN_INTERACTIVE_ELEMENTS) return false;
    
    // Check for content indicators
    const hasArticles = doc.querySelector('article, [role="article"], .post, .content, main') !== null;
    const hasHeadings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6').length > 0;
    const hasParagraphs = doc.querySelectorAll('p').length > 3;
    const hasLists = doc.querySelectorAll('ul, ol').length > 0;
    
    // For Twitter specifically, check for tweets
    if (this.isTwitter(doc)) {
      const hasTweets = doc.querySelector('[data-testid="cellInnerDiv"], [role="article"], [data-testid="tweet"]') !== null;
      return hasTweets;
    }
    
    return hasArticles || hasHeadings || hasParagraphs || hasLists;
  }

  /**
   * Generate recommendations based on detection results
   */
  private generateRecommendations(isSPA: boolean, isLoaded: boolean, isFallbackPage: boolean): string[] {
    const recommendations: string[] = [];
    
    if (isFallbackPage) {
      recommendations.push('Page shows JavaScript-disabled fallback. Wait for content to load.');
      recommendations.push('Consider waiting 1-2 seconds before extraction.');
    }
    
    if (isSPA && !isLoaded) {
      recommendations.push('SPA detected but content not fully loaded.');
      recommendations.push('Try extraction after page interaction or scroll.');
      recommendations.push('Consider using a delay or mutation observer.');
    }
    
    if (!isSPA && !isLoaded) {
      recommendations.push('Page may still be loading. Check network activity.');
    }
    
    return recommendations;
  }

  /**
   * Wait for SPA content to load with timeout
   */
  async waitForContent(doc: Document, timeout: number = 5000): Promise<boolean> {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const checkContent = () => {
        const result = this.detect(doc);
        
        if (result.hasActualContent || Date.now() - startTime > timeout) {
          resolve(result.hasActualContent);
          return;
        }
        
        // Check again in 250ms
        setTimeout(checkContent, 250);
      };
      
      checkContent();
    });
  }
}