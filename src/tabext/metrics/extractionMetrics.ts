/**
 * @file Extraction Quality Metrics
 * 
 * Calculates comprehensive metrics to evaluate the quality and completeness
 * of content extraction. Provides insights into coverage, noise reduction,
 * and content diversity.
 */

/**
 * Content completeness metrics
 */
export interface CompletenessMetrics {
  hasMainContent: boolean;
  hasComments: boolean;
  hasRelatedContent: boolean;
  hasMedia: boolean;
  hasCode: boolean;
  hasTables: boolean;
  hasLists: boolean;
  hasQuotes: boolean;
}

/**
 * Content statistics
 */
export interface ContentStatistics {
  wordCount: number;
  sentenceCount: number;
  paragraphCount: number;
  linkCount: number;
  imageCount: number;
  videoCount: number;
  codeBlockCount: number;
  tableCount: number;
  listCount: number;
  headingCount: number;
  avgSentenceLength: number;
  avgParagraphLength: number;
  readingTime: number; // in minutes
}

/**
 * Extraction quality metrics
 */
export interface ExtractionQualityMetrics {
  coverage: number;           // 0-100: How much content was captured
  noiseReduction: number;     // 0-100: How much noise was removed
  completeness: CompletenessMetrics;
  statistics: ContentStatistics;
  confidence: number;          // 0-100: Overall confidence score
  diversity: number;          // 0-100: Content type diversity
  structuralIntegrity: number; // 0-100: How well structure is preserved
}

/**
 * Class for calculating extraction quality metrics
 */
export class ExtractionMetrics {
  private static readonly WORDS_PER_MINUTE = 200; // Average reading speed

  /**
   * Calculate comprehensive metrics for extracted content
   */
  calculate(original: Element | Document, extracted: Element | string): ExtractionQualityMetrics {
    const originalElement = this.getBodyElement(original);
    const extractedElement = this.parseExtracted(extracted);

    const coverage = this.calculateCoverage(originalElement, extractedElement);
    const noiseReduction = this.calculateNoiseReduction(originalElement, extractedElement);
    const completeness = this.detectCompleteness(extractedElement);
    const statistics = this.calculateStatistics(extractedElement);
    const diversity = this.calculateDiversity(completeness, statistics);
    const structuralIntegrity = this.calculateStructuralIntegrity(extractedElement);
    const confidence = this.calculateConfidence(coverage, noiseReduction, diversity, structuralIntegrity);

    return {
      coverage,
      noiseReduction,
      completeness,
      statistics,
      confidence,
      diversity,
      structuralIntegrity
    };
  }

  /**
   * Get body element from document or element
   */
  private getBodyElement(input: Element | Document): Element {
    if (input instanceof Document) {
      return input.body;
    }
    return input;
  }

  /**
   * Parse extracted content into an element
   */
  private parseExtracted(extracted: Element | string): Element {
    if (typeof extracted === 'string') {
      const div = document.createElement('div');
      div.innerHTML = extracted;
      return div;
    }
    return extracted;
  }

  /**
   * Calculate content coverage percentage
   */
  private calculateCoverage(original: Element, extracted: Element): number {
    const originalText = this.getTextContent(original);
    const extractedText = this.getTextContent(extracted);

    if (originalText.length === 0) return 0;

    // Calculate how much of the original text is in the extracted content
    const originalWords = this.tokenize(originalText);
    const extractedWords = this.tokenize(extractedText);
    
    const originalSet = new Set(originalWords);
    const extractedSet = new Set(extractedWords);
    
    let matchCount = 0;
    extractedSet.forEach(word => {
      if (originalSet.has(word)) matchCount++;
    });

    // Also consider the length ratio
    const lengthRatio = Math.min(extractedText.length / originalText.length, 1);
    const wordCoverage = originalSet.size > 0 ? matchCount / originalSet.size : 0;

    // Weight both factors
    return Math.round((wordCoverage * 0.7 + lengthRatio * 0.3) * 100);
  }

  /**
   * Calculate noise reduction percentage
   */
  private calculateNoiseReduction(original: Element, extracted: Element): number {
    // Count noise elements in original
    const originalNoise = this.countNoiseElements(original);
    const extractedNoise = this.countNoiseElements(extracted);

    if (originalNoise === 0) return 100;

    const reduction = Math.max(0, originalNoise - extractedNoise) / originalNoise;
    return Math.round(reduction * 100);
  }

  /**
   * Count noise elements
   */
  private countNoiseElements(element: Element): number {
    let count = 0;
    
    const noiseSelectors = [
      'nav', '[role="navigation"]',
      '[class*="ad-"], [id*="ad-"]',
      '[class*="sponsor"], [class*="promoted"]',
      '.social-share, .share-buttons',
      '[class*="cookie"], [class*="gdpr"]',
      '[class*="newsletter"]:has(form)',
      'footer:not(:has(article)):not(:has(.comment))'
    ];

    noiseSelectors.forEach(selector => {
      try {
        count += element.querySelectorAll(selector).length;
      } catch {
        // Invalid selector, skip
      }
    });

    return count;
  }

  /**
   * Detect content completeness
   */
  private detectCompleteness(element: Element): CompletenessMetrics {
    return {
      hasMainContent: this.detectMainContent(element),
      hasComments: this.detectComments(element),
      hasRelatedContent: this.detectRelatedContent(element),
      hasMedia: this.detectMedia(element),
      hasCode: this.detectCode(element),
      hasTables: this.detectTables(element),
      hasLists: this.detectLists(element),
      hasQuotes: this.detectQuotes(element)
    };
  }

  private detectMainContent(element: Element): boolean {
    const mainSelectors = ['main', 'article', '[role="main"]', '.main-content'];
    return mainSelectors.some(sel => {
      try {
        const el = element.querySelector(sel);
        return el !== null && (el.textContent?.trim().length || 0) > 200;
      } catch {
        return false;
      }
    });
  }

  private detectComments(element: Element): boolean {
    const commentSelectors = [
      '[class*="comment"]', '[id*="comment"]',
      '.discussion', '.replies', '.feedback'
    ];
    return commentSelectors.some(sel => {
      try {
        return element.querySelector(sel) !== null;
      } catch {
        return false;
      }
    });
  }

  private detectRelatedContent(element: Element): boolean {
    const relatedSelectors = [
      '[class*="related"]', '[class*="similar"]',
      '.recommended', '.also-read'
    ];
    return relatedSelectors.some(sel => {
      try {
        return element.querySelector(sel) !== null;
      } catch {
        return false;
      }
    });
  }

  private detectMedia(element: Element): boolean {
    return element.querySelectorAll('img, picture, video, audio, iframe[src*="youtube"], iframe[src*="vimeo"]').length > 0;
  }

  private detectCode(element: Element): boolean {
    return element.querySelectorAll('pre, code, .highlight, .codehilite').length > 0;
  }

  private detectTables(element: Element): boolean {
    return element.querySelectorAll('table:not(.layout-table)').length > 0;
  }

  private detectLists(element: Element): boolean {
    return element.querySelectorAll('ul, ol, dl').length > 0;
  }

  private detectQuotes(element: Element): boolean {
    return element.querySelectorAll('blockquote, q, .quote').length > 0;
  }

  /**
   * Calculate content statistics
   */
  private calculateStatistics(element: Element): ContentStatistics {
    const text = this.getTextContent(element);
    const words = this.tokenize(text);
    const sentences = this.splitSentences(text);
    const paragraphs = element.querySelectorAll('p');

    const wordCount = words.length;
    const sentenceCount = sentences.length;
    const paragraphCount = paragraphs.length;

    return {
      wordCount,
      sentenceCount,
      paragraphCount,
      linkCount: element.querySelectorAll('a').length,
      imageCount: element.querySelectorAll('img, picture').length,
      videoCount: element.querySelectorAll('video, iframe[src*="youtube"], iframe[src*="vimeo"]').length,
      codeBlockCount: element.querySelectorAll('pre, code').length,
      tableCount: element.querySelectorAll('table').length,
      listCount: element.querySelectorAll('ul, ol, dl').length,
      headingCount: element.querySelectorAll('h1, h2, h3, h4, h5, h6').length,
      avgSentenceLength: sentenceCount > 0 ? Math.round(wordCount / sentenceCount) : 0,
      avgParagraphLength: paragraphCount > 0 ? Math.round(wordCount / paragraphCount) : 0,
      readingTime: Math.ceil(wordCount / ExtractionMetrics.WORDS_PER_MINUTE)
    };
  }

  /**
   * Calculate content diversity score
   */
  private calculateDiversity(completeness: CompletenessMetrics, statistics: ContentStatistics): number {
    let score = 0;
    let maxScore = 0;

    // Check completeness features (40 points)
    const completenessFeatures = Object.values(completeness);
    const completenessTrue = completenessFeatures.filter(v => v === true).length;
    score += (completenessTrue / completenessFeatures.length) * 40;
    maxScore += 40;

    // Check for varied content types (60 points)
    if (statistics.imageCount > 0) score += 10;
    if (statistics.videoCount > 0) score += 10;
    if (statistics.codeBlockCount > 0) score += 10;
    if (statistics.tableCount > 0) score += 10;
    if (statistics.listCount > 0) score += 10;
    if (statistics.headingCount > 2) score += 10;
    maxScore += 60;

    return Math.round((score / maxScore) * 100);
  }

  /**
   * Calculate structural integrity
   */
  private calculateStructuralIntegrity(element: Element): number {
    let score = 0;

    // Check for proper heading hierarchy
    const headings = element.querySelectorAll('h1, h2, h3, h4, h5, h6');
    if (this.hasProperHeadingHierarchy(Array.from(headings))) {
      score += 25;
    }

    // Check for paragraph structure
    const paragraphs = element.querySelectorAll('p');
    if (paragraphs.length > 0) {
      score += 25;
    }

    // Check for list structure preservation
    const lists = element.querySelectorAll('ul, ol');
    if (lists.length > 0) {
      score += 25;
    }

    // Check for semantic HTML preservation
    const semanticElements = element.querySelectorAll('article, section, aside, main, header, footer');
    if (semanticElements.length > 0) {
      score += 25;
    }

    return score;
  }

  /**
   * Check if headings follow proper hierarchy
   */
  private hasProperHeadingHierarchy(headings: Element[]): boolean {
    if (headings.length === 0) return false;

    let lastLevel = 0;
    for (const heading of headings) {
      const level = parseInt(heading.tagName[1]);
      if (lastLevel > 0 && level > lastLevel + 1) {
        return false; // Skip in hierarchy
      }
      lastLevel = level;
    }
    return true;
  }

  /**
   * Calculate overall confidence score
   */
  private calculateConfidence(
    coverage: number,
    noiseReduction: number,
    diversity: number,
    structuralIntegrity: number
  ): number {
    // Weighted average of all metrics
    const weights = {
      coverage: 0.3,
      noiseReduction: 0.2,
      diversity: 0.25,
      structuralIntegrity: 0.25
    };

    const score = 
      coverage * weights.coverage +
      noiseReduction * weights.noiseReduction +
      diversity * weights.diversity +
      structuralIntegrity * weights.structuralIntegrity;

    return Math.round(score);
  }

  /**
   * Get clean text content
   */
  private getTextContent(element: Element): string {
    // Clone to avoid modifying original
    const clone = element.cloneNode(true) as Element;
    
    // Remove script and style elements
    clone.querySelectorAll('script, style, noscript').forEach(el => el.remove());
    
    return clone.textContent?.trim() || '';
  }

  /**
   * Tokenize text into words
   */
  private tokenize(text: string): string[] {
    return text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 0);
  }

  /**
   * Split text into sentences
   */
  private splitSentences(text: string): string[] {
    return text.split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }
}