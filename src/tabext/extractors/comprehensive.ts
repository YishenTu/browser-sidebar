/**
 * @file Universal Comprehensive Extractor
 * 
 * A universal content extractor that captures ALL meaningful content
 * while removing only navigation, ads, and overlays. Works equally well
 * on all websites without site-specific logic.
 * 
 * Philosophy: Start with everything, subtract only true noise.
 */

import { UniversalContentDetector } from '../detectors/universalContentDetector';
import { UniversalFilterPipeline } from '../filters/universalFilterPipeline';
import { ExtractionMetrics, type ExtractionQualityMetrics } from '../metrics/extractionMetrics';
import { SPADetector } from '../detectors/spaDetector';

// =============================================================================
// Types and Interfaces
// =============================================================================

/**
 * Result from comprehensive content extraction
 */
export interface ComprehensiveResult {
  /** HTML content extracted */
  content: string;
  /** Plain text content extracted */
  textContent: string;
  /** Whether content was truncated due to budget limits */
  isTruncated: boolean;
  /** Extraction mode used */
  mode: 'comprehensive';
  /** Content structure analysis */
  structure?: ContentStructure;
}

/**
 * Analysis of content structure found on the page
 */
export interface ContentStructure {
  hasComments: boolean;
  hasQA: boolean;
  hasReviews: boolean;
  hasMainContent: boolean;
  contentBlockCount: number;
  hasCodeBlocks?: boolean;
  hasTables?: boolean;
  metrics?: ExtractionQualityMetrics;
}

// =============================================================================
// Universal Comprehensive Extractor
// =============================================================================

export class UniversalComprehensiveExtractor {
  private detector: UniversalContentDetector;
  private filterPipeline: UniversalFilterPipeline;
  private metricsCalculator: ExtractionMetrics;
  private spaDetector: SPADetector;

  constructor() {
    this.detector = new UniversalContentDetector();
    this.filterPipeline = new UniversalFilterPipeline();
    this.metricsCalculator = new ExtractionMetrics();
    this.spaDetector = new SPADetector();
  }

  // Selectors for content to remove (true noise)
  static readonly NOISE_SELECTORS = [
    // Navigation (but be careful)
    'nav:not(:has(article)):not(:has(main))',
    'header > nav',
    'footer > nav',
    '.navbar:not(:has(.content))',
    
    // Very specific ad selectors only
    '.google-ad',
    '.advertisement',
    '[data-google-query-id]',
    'ins.adsbygoogle',
    
    // Overlays and modals
    '.modal:not(.active), .overlay:not(.visible)',
    '[role="dialog"]:not(.open)',
    '.popup:not(.visible), .lightbox:not(.active)',
    
    // Cookie/GDPR notices
    '[class*="cookie"], [class*="gdpr"], [class*="consent"]',
    '[class*="privacy-banner"], [class*="notice-banner"]',
    '[class*="compliance"], [class*="opt-in"]',
    
    // Social widgets
    '.social-share, .share-buttons, .social-icons',
    '[class*="share-this"], [class*="add-this"]',
    '.social-media-buttons, .share-widget',
    
    // Newsletter/Subscribe
    '[class*="newsletter"], [class*="subscribe"]',
    '.email-signup, .mailing-list',
    '[class*="signup-form"], [class*="email-form"]',
    
    // Footer (conditional - only if no content)
    'footer:not(:has(.comments)):not(:has(article)):not(:has([class*="comment"]))',
    
    // Hidden elements
    '[style*="display: none"], [style*="display:none"]',
    '[style*="visibility: hidden"], [style*="visibility:hidden"]',
    '[hidden], [aria-hidden="true"]',
    '.hidden, .invisible, .sr-only'
  ];
  
  // Selectors for content to always preserve
  static readonly PRESERVE_SELECTORS = [
    // Comments and discussions (most important for forums)
    '[class*="comment"], [id*="comment"], #comments',
    '.comments-section, .discussion, .replies',
    '[class*="discuss"], .conversation, .thread',
    '[class*="reply"], [class*="response"]',
    '[class*="post"], [class*="message"]',
    'article article', // Nested articles often are comments
    'section[class*="comment"]',
    '[datetime]:has(p)', // Time-stamped content
    '[data-timestamp]:has(div)',
    
    // Reviews and ratings
    '[class*="review"], [class*="rating"]',
    '.testimonial, .feedback, .user-opinion',
    '.customer-review, .user-review',
    '[itemtype*="Review"], [itemtype*="Rating"]',
    
    // Q&A sections
    '.answer, .question, [class*="faq"]',
    '.qa-section, .help-section',
    '[class*="question"], [class*="answer"]',
    '.qanda, .q-and-a',
    
    // Code and technical content
    'pre, code, .highlight, .codehilite',
    '.code-block, .syntax-highlight',
    '.language-, .hljs',
    '[class*="sourceCode"], .CodeMirror',
    
    // Data tables
    'table:not(.layout), .data-table',
    '.comparison-table, .pricing-table',
    'table[class*="data"], table[class*="info"]',
    
    // Main article content
    'article, [role="article"], main, [role="main"]',
    '.post-content, .entry-content, .article-content',
    '.content-body, .main-content',
    
    // Embedded content
    'figure, figcaption, blockquote',
    '.embed, .media-container',
    'video, audio, iframe[src*="youtube"], iframe[src*="vimeo"]',
    
    // Lists and structured content
    '.content ul, .content ol',
    'article ul, article ol',
    'main ul, main ol'
  ];

  /**
   * Extract comprehensive content from document
   * 
   * @param doc - Document to extract from
   * @param budgetChars - Maximum characters to extract (default 1MB)
   * @returns Comprehensive extraction result
   */
  extract(doc: Document, budgetChars: number = 1000000): ComprehensiveResult {
    try {
      // Step 0: Check for SPA and fallback pages (but be less aggressive)
      const spaStatus = this.spaDetector.detect(doc);
      
      // Only return early for Twitter/X when we detect the JS disabled message
      if (spaStatus.isFallbackPage && spaStatus.framework === 'twitter') {
        console.warn('Twitter fallback page detected, trying special extraction');
        return this.extractTwitterContent(doc, budgetChars);
      }
      
      // For other SPAs, just log a warning but continue with normal extraction
      if (spaStatus.isSPA && !spaStatus.isLoaded) {
        console.warn('SPA may not be fully loaded, but continuing with extraction');
      }
      
      // Clone body to avoid modifying original
      const clone = doc.body.cloneNode(true) as HTMLElement;
      
      // Step 1: Detect content structure using universal detector
      const detectedStructure = this.detector.detectContentStructure(doc);
      
      // Step 2: Apply universal filter pipeline OR legacy selectors, not both
      // For now, just use the legacy selectors since they're more tested
      const filtered = clone;
      this.removeNoise(filtered);
      
      // Step 4: Clean empty elements
      this.cleanEmptyElements(filtered);
      
      // Step 5: Process special elements
      this.processSpecialElements(filtered);
      
      // Step 6: Calculate quality metrics
      const metrics = this.metricsCalculator.calculate(doc, filtered);
      
      // Step 7: Extract and truncate if needed
      let content = filtered.innerHTML;
      let textContent = filtered.textContent || '';
      let isTruncated = false;
      
      if (content.length > budgetChars) {
        content = content.substring(0, budgetChars);
        textContent = textContent.substring(0, budgetChars);
        isTruncated = true;
      }
      
      // Step 8: Combine structure with metrics
      const structure: ContentStructure = {
        hasComments: detectedStructure.hasComments,
        hasQA: detectedStructure.hasQA,
        hasReviews: detectedStructure.hasReviews,
        hasMainContent: detectedStructure.mainContent !== undefined,
        contentBlockCount: detectedStructure.contentBlocks.length,
        hasCodeBlocks: detectedStructure.hasCodeBlocks,
        hasTables: detectedStructure.hasTables,
        metrics
      };
      
      return {
        content,
        textContent,
        isTruncated,
        mode: 'comprehensive',
        structure
      };
    } catch (error) {
      console.warn('Comprehensive extraction failed:', error);
      // Return full body as fallback
      return {
        content: doc.body.innerHTML,
        textContent: doc.body.textContent || '',
        isTruncated: false,
        mode: 'comprehensive'
      };
    }
  }
  
  /**
   * Remove noise while preserving important content
   */
  private removeNoise(element: HTMLElement): void {
    // Smart removal - check for preserved content first
    UniversalComprehensiveExtractor.NOISE_SELECTORS.forEach(selector => {
      try {
        element.querySelectorAll(selector).forEach(el => {
          // Check if element contains important content
          const hasPreservedContent = UniversalComprehensiveExtractor.PRESERVE_SELECTORS
            .some(preserve => {
              try {
                return el.querySelector(preserve) !== null;
              } catch {
                return false;
              }
            });
          
          // Only remove if no preserved content inside
          if (!hasPreservedContent) {
            el.remove();
          }
        });
      } catch (error) {
        // Skip invalid selectors
        console.debug('Skipping invalid selector:', selector);
      }
    });
  }
  
  /**
   * Clean up empty elements that add no value
   */
  private cleanEmptyElements(element: HTMLElement): void {
    const emptyElements = element.querySelectorAll('div, section, span, p');
    
    emptyElements.forEach(el => {
      const text = el.textContent?.trim() || '';
      const hasChildren = el.children.length > 0;
      const hasImages = el.querySelector('img, svg, video, audio, iframe') !== null;
      
      // Remove if empty and has no meaningful content
      if (!text && !hasChildren && !hasImages) {
        el.remove();
      }
    });
  }
  
  /**
   * Process special elements for better extraction
   */
  private processSpecialElements(element: HTMLElement): void {
    // Convert SVG icons to text representation
    element.querySelectorAll('svg').forEach(svg => {
      const title = svg.querySelector('title')?.textContent;
      if (title) {
        const span = document.createElement('span');
        span.textContent = `[${title}]`;
        svg.replaceWith(span);
      } else if (svg.getAttribute('aria-label')) {
        const span = document.createElement('span');
        span.textContent = `[${svg.getAttribute('aria-label')}]`;
        svg.replaceWith(span);
      }
    });
    
    // Preserve alt text for images
    element.querySelectorAll('img').forEach(img => {
      const alt = img.getAttribute('alt');
      if (alt && !img.nextSibling?.textContent?.includes(alt)) {
        const span = document.createElement('span');
        span.textContent = ` [Image: ${alt}] `;
        img.parentNode?.insertBefore(span, img.nextSibling);
      }
    });
  }
  
  /**
   * Extract content from Twitter/X specifically
   */
  private extractTwitterContent(doc: Document, budgetChars: number): ComprehensiveResult {
    // Look for actual tweet content
    const tweets = doc.querySelectorAll('[data-testid="tweet"], [role="article"], [data-testid="cellInnerDiv"]');
    
    if (tweets.length === 0) {
      // No tweets found, look for any timeline content
      const timeline = doc.querySelector('[aria-label*="Timeline"], [role="region"], main');
      
      if (timeline) {
        const content = timeline.innerHTML;
        const textContent = timeline.textContent || '';
        
        return {
          content: content.substring(0, budgetChars),
          textContent: textContent.substring(0, budgetChars),
          isTruncated: content.length > budgetChars,
          mode: 'comprehensive',
          structure: {
            hasComments: true, // Twitter is all comments/posts
            hasQA: false,
            hasReviews: false,
            hasMainContent: true,
            contentBlockCount: 1,
            hasCodeBlocks: false,
            hasTables: false
          }
        };
      }
    }
    
    // Extract tweets
    let content = '';
    let textContent = '';
    
    tweets.forEach(tweet => {
      if (content.length < budgetChars) {
        content += tweet.innerHTML;
        textContent += tweet.textContent || '';
      }
    });
    
    return {
      content: content || '<p>No Twitter content found. The page may still be loading.</p>',
      textContent: textContent || 'No Twitter content found. The page may still be loading.',
      isTruncated: content.length > budgetChars,
      mode: 'comprehensive',
      structure: {
        hasComments: tweets.length > 0,
        hasQA: false,
        hasReviews: false,
        hasMainContent: tweets.length > 0,
        contentBlockCount: tweets.length,
        hasCodeBlocks: false,
        hasTables: false
      }
    };
  }

  /**
   * Analyze content structure to understand what's on the page
   */
  private analyzeStructure(doc: Document): ContentStructure {
    // Check for comments/discussions
    const hasComments = UniversalComprehensiveExtractor.PRESERVE_SELECTORS
      .slice(0, 9) // Comment-related selectors
      .some(selector => {
        try {
          return doc.querySelector(selector) !== null;
        } catch {
          return false;
        }
      });
    
    // Check for Q&A content
    const hasQA = [
      '.answer, .question, [class*="faq"]',
      '.qa-section, .help-section',
      '[class*="question"], [class*="answer"]'
    ].some(selector => {
      try {
        return doc.querySelector(selector) !== null;
      } catch {
        return false;
      }
    });
    
    // Check for reviews
    const hasReviews = [
      '[class*="review"], [class*="rating"]',
      '.testimonial, .feedback, .user-opinion'
    ].some(selector => {
      try {
        return doc.querySelector(selector) !== null;
      } catch {
        return false;
      }
    });
    
    // Check for main content
    const hasMainContent = doc.querySelector('main, article, [role="main"], [role="article"]') !== null;
    
    // Count content blocks
    const contentBlocks = doc.querySelectorAll('article, section, .post, .comment, .answer');
    
    return {
      hasComments,
      hasQA,
      hasReviews,
      hasMainContent,
      contentBlockCount: contentBlocks.length
    };
  }
}

/**
 * Factory function for comprehensive extraction
 */
export function extractComprehensive(
  doc: Document = document,
  budgetChars?: number
): ComprehensiveResult {
  const extractor = new UniversalComprehensiveExtractor();
  return extractor.extract(doc, budgetChars);
}