/**
 * @file Universal Content Detection System
 * 
 * Implements universal pattern detection that works across ALL websites
 * without any site-specific logic. Detects comments, Q&A, reviews, and
 * other content structures using generic patterns.
 */

/**
 * Content block information
 */
export interface ContentBlock {
  element: Element;
  textLength: number;
  linkDensity: number;
  depth: number;
  type?: 'comment' | 'qa' | 'review' | 'main' | 'related';
}

/**
 * Content structure detection result
 */
export interface ContentStructure {
  hasComments: boolean;
  hasQA: boolean;
  hasReviews: boolean;
  hasCodeBlocks: boolean;
  hasTables: boolean;
  contentBlocks: ContentBlock[];
  hierarchy: Map<Element, number>;
  mainContent?: Element;
  relatedContent: Element[];
}

/**
 * Universal content detector that works across all websites
 * Uses generic patterns instead of site-specific logic
 */
export class UniversalContentDetector {
  // Universal patterns for comments/discussions
  private static readonly COMMENT_PATTERNS = [
    // Generic comment patterns
    '[class*="comment"], [id*="comment"]',
    '[class*="reply"], [class*="response"]',
    '[class*="discussion"], [class*="thread"]',
    '[class*="post"], [class*="message"]',
    // Semantic HTML
    'article article', // Nested articles often indicate comments
    'section[class*="comment"]',
    // Common structural patterns
    '.comments, #comments, .comment-list',
    '.replies, .responses, .feedback',
    // Time-based content (usually comments)
    '[datetime]:has(p), [data-timestamp]:has(div)',
    // User-generated content patterns
    '[class*="user-content"], [class*="user-post"]',
    '[class*="author"]:has(+ div)',
    // Common forum patterns
    '.topic-reply, .forum-post, .discussion-item'
  ];

  // Universal patterns for main content
  private static readonly MAIN_CONTENT_PATTERNS = [
    'main, [role="main"]',
    'article:not([class*="comment"]):not([class*="reply"])',
    '[role="article"]',
    '.content:not(.comment-content), #content',
    '.post-content, .entry-content',
    '.main-content, .primary-content',
    '.article-body, .post-body',
    '[itemprop="articleBody"]'
  ];

  // Universal patterns for Q&A content
  private static readonly QA_PATTERNS = [
    '[class*="question"], [class*="answer"]',
    '[class*="faq"], [class*="qa"]',
    '.q-and-a, .qanda, .help-section',
    '.solution, .accepted-answer',
    '[itemprop="acceptedAnswer"], [itemprop="suggestedAnswer"]',
    '.best-answer, .top-answer',
    'dl:has(dt):has(dd)' // Definition lists often used for Q&A
  ];

  // Universal patterns for reviews
  private static readonly REVIEW_PATTERNS = [
    '[class*="review"], [class*="rating"]',
    '[class*="testimonial"], [class*="feedback"]',
    '.user-opinion, .customer-review',
    '[itemprop="review"], [itemprop="aggregateRating"]',
    '.product-review, .service-review',
    '.star-rating, .rating-stars',
    '.pros-and-cons, .verdict'
  ];

  // Universal patterns for code blocks
  private static readonly CODE_PATTERNS = [
    'pre, code',
    '.highlight, .codehilite',
    '.code-block, .syntax-highlight',
    '[class*="language-"], [class*="lang-"]',
    '.sourceCode, .source-code',
    '.hljs, .prism-code'
  ];

  // Universal patterns for tables
  private static readonly TABLE_PATTERNS = [
    'table:not(.layout-table)',
    '.data-table, .comparison-table',
    '.pricing-table, .feature-table',
    '[role="table"]',
    '.table-responsive table'
  ];

  /**
   * Detects content structure of a document
   */
  detectContentStructure(doc: Document): ContentStructure {
    const structure: ContentStructure = {
      hasComments: this.detectPattern(doc, UniversalContentDetector.COMMENT_PATTERNS),
      hasQA: this.detectPattern(doc, UniversalContentDetector.QA_PATTERNS),
      hasReviews: this.detectPattern(doc, UniversalContentDetector.REVIEW_PATTERNS),
      hasCodeBlocks: this.detectPattern(doc, UniversalContentDetector.CODE_PATTERNS),
      hasTables: this.detectPattern(doc, UniversalContentDetector.TABLE_PATTERNS),
      contentBlocks: this.findContentBlocks(doc),
      hierarchy: new Map(),
      relatedContent: []
    };

    // Build hierarchy map
    structure.hierarchy = this.detectHierarchy(doc);

    // Find main content
    structure.mainContent = this.findMainContent(doc);

    // Find related content
    structure.relatedContent = this.findRelatedContent(doc);

    return structure;
  }

  /**
   * Detects if any pattern exists in the document
   */
  private detectPattern(doc: Document, patterns: string[]): boolean {
    return patterns.some(selector => {
      try {
        return doc.querySelector(selector) !== null;
      } catch {
        // Invalid selector, skip
        return false;
      }
    });
  }

  /**
   * Finds all substantial text blocks in the document
   */
  private findContentBlocks(doc: Document): ContentBlock[] {
    const blocks: ContentBlock[] = [];
    const candidates = doc.querySelectorAll('div, section, article, aside, main, li');

    candidates.forEach(element => {
      // Skip if already processed as part of a larger block
      if (blocks.some(b => b.element.contains(element))) {
        return;
      }

      const textLength = this.getTextLength(element);
      const linkDensity = this.calculateLinkDensity(element);
      const depth = this.getDepth(element);

      // Content block if has substantial text and low link density
      if (textLength > 100 && linkDensity < 0.3) {
        blocks.push({
          element,
          textLength,
          linkDensity,
          depth,
          type: this.classifyBlockType(element)
        });
      }
    });

    // Sort by text length (longest first)
    return blocks.sort((a, b) => b.textLength - a.textLength);
  }

  /**
   * Classifies the type of a content block
   */
  private classifyBlockType(element: Element): ContentBlock['type'] {
    const classAndId = `${element.className} ${element.id}`.toLowerCase();

    // Check for comment patterns
    if (UniversalContentDetector.COMMENT_PATTERNS.some(pattern => {
      try {
        const selector = pattern.replace(/\[.*?\]/g, ''); // Remove attribute selectors
        return classAndId.includes(selector.replace(/[.#]/g, ''));
      } catch {
        return false;
      }
    })) {
      return 'comment';
    }

    // Check for Q&A patterns
    if (classAndId.includes('question') || classAndId.includes('answer') || 
        classAndId.includes('faq') || classAndId.includes('qa')) {
      return 'qa';
    }

    // Check for review patterns
    if (classAndId.includes('review') || classAndId.includes('rating') || 
        classAndId.includes('testimonial')) {
      return 'review';
    }

    // Check for main content patterns
    if (element.tagName === 'MAIN' || element.getAttribute('role') === 'main' ||
        element.tagName === 'ARTICLE' || classAndId.includes('main-content')) {
      return 'main';
    }

    // Check for related content
    if (classAndId.includes('related') || classAndId.includes('similar') || 
        classAndId.includes('also')) {
      return 'related';
    }

    return undefined;
  }

  /**
   * Calculates the link density of an element
   */
  private calculateLinkDensity(element: Element): number {
    const text = element.textContent || '';
    const textLength = text.trim().length;
    
    if (textLength === 0) return 1;

    const links = element.querySelectorAll('a');
    let linkTextLength = 0;
    
    links.forEach(link => {
      linkTextLength += (link.textContent || '').trim().length;
    });

    return linkTextLength / textLength;
  }

  /**
   * Gets the text length of an element (excluding child elements)
   */
  private getTextLength(element: Element): number {
    const text = element.textContent || '';
    return text.trim().length;
  }

  /**
   * Gets the depth of an element in the DOM tree
   */
  private getDepth(element: Element): number {
    let depth = 0;
    let current = element.parentElement;
    
    while (current && current !== document.body) {
      depth++;
      current = current.parentElement;
    }
    
    return depth;
  }

  /**
   * Builds a hierarchy map of elements to their depths
   */
  private detectHierarchy(doc: Document): Map<Element, number> {
    const hierarchy = new Map<Element, number>();
    const walker = doc.createTreeWalker(
      doc.body,
      NodeFilter.SHOW_ELEMENT,
      null
    );

    let node = walker.nextNode();
    while (node) {
      if (node instanceof Element) {
        hierarchy.set(node, this.getDepth(node));
      }
      node = walker.nextNode();
    }

    return hierarchy;
  }

  /**
   * Finds the main content element
   */
  private findMainContent(doc: Document): Element | undefined {
    // Try semantic patterns first
    for (const selector of UniversalContentDetector.MAIN_CONTENT_PATTERNS) {
      try {
        const element = doc.querySelector(selector);
        if (element && this.getTextLength(element) > 200) {
          return element;
        }
      } catch {
        // Invalid selector, skip
      }
    }

    // Fall back to largest content block
    const blocks = this.findContentBlocks(doc);
    const mainBlock = blocks.find(b => b.type === 'main') || blocks[0];
    return mainBlock?.element;
  }

  /**
   * Finds related content elements
   */
  private findRelatedContent(doc: Document): Element[] {
    const related: Element[] = [];
    const patterns = [
      '[class*="related"]',
      '[class*="similar"]',
      '[class*="also-read"]',
      '[class*="recommended"]',
      '.sidebar article',
      'aside article'
    ];

    patterns.forEach(selector => {
      try {
        doc.querySelectorAll(selector).forEach(element => {
          if (this.getTextLength(element) > 50 && !related.includes(element)) {
            related.push(element);
          }
        });
      } catch {
        // Invalid selector, skip
      }
    });

    return related;
  }

  /**
   * Analyzes content quality and completeness
   */
  analyzeContentQuality(structure: ContentStructure): {
    completeness: number;
    diversity: number;
    depth: number;
  } {
    let score = 0;
    const maxScore = 5;

    // Check for different content types
    if (structure.hasComments) score++;
    if (structure.hasQA) score++;
    if (structure.hasReviews) score++;
    if (structure.hasCodeBlocks) score++;
    if (structure.hasTables) score++;

    const completeness = (score / maxScore) * 100;

    // Calculate content diversity
    const blockTypes = new Set(structure.contentBlocks.map(b => b.type).filter(Boolean));
    const diversity = (blockTypes.size / 5) * 100;

    // Calculate average depth
    const depths = structure.contentBlocks.map(b => b.depth);
    const avgDepth = depths.length > 0 
      ? depths.reduce((a, b) => a + b, 0) / depths.length 
      : 0;

    return {
      completeness,
      diversity,
      depth: avgDepth
    };
  }
}