/**
 * @file Pattern Detection
 *
 * Pattern detection for sensitive data in text. Provides pattern matching
 * for common sensitive data types like email addresses, credit cards,
 * phone numbers, SSNs, API keys, etc.
 */

// =============================================================================
// Types and Interfaces
// =============================================================================

/**
 * Pattern types for sensitive data detection
 */
export type PatternType =
  | 'email'
  | 'phone'
  | 'ssn'
  | 'credit_card'
  | 'api_key'
  | 'ip_address'
  | 'url'
  | 'date'
  | 'custom';

/**
 * A match found by the pattern detector
 */
export interface PatternMatch {
  /** Type of pattern matched */
  type: PatternType | string;
  /** The matched value */
  value: string;
  /** Start index in the original text */
  startIndex: number;
  /** End index in the original text (exclusive) */
  endIndex: number;
  /** Confidence score (0-1) */
  confidence?: number;
  /** Additional context about the match */
  context?: string;
}

/**
 * Configuration for the pattern detector
 */
export interface PatternDetectorConfig {
  /** Pattern types to enable (defaults to all) */
  enabledPatterns?: string[];
  /** Custom patterns to add */
  customPatterns?: CustomPattern[];
  /** Minimum confidence threshold (0-1) */
  minConfidence?: number;
  /** Maximum number of matches to return */
  maxMatches?: number;
}

/**
 * Custom pattern definition
 */
export interface CustomPattern {
  /** Unique name for this pattern */
  name: string;
  /** Regular expression to match */
  pattern: RegExp;
  /** Optional validator function */
  validator?: (match: string) => boolean;
  /** Confidence level for matches (0-1) */
  confidence?: number;
}

/**
 * Result of pattern detection
 */
export interface DetectionResult {
  /** All matches found */
  matches: PatternMatch[];
  /** Total number of matches */
  totalMatches: number;
  /** Time taken in milliseconds */
  processingTimeMs?: number;
  /** Breakdown by pattern type */
  patternBreakdown?: Record<string, number>;
}

// =============================================================================
// Built-in Patterns
// =============================================================================

/**
 * Built-in patterns for common sensitive data types
 */
const BUILT_IN_PATTERNS: Record<string, { pattern: RegExp; confidence: number }> = {
  email: {
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    confidence: 0.95,
  },
  phone: {
    pattern: /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g,
    confidence: 0.8,
  },
  ssn: {
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    confidence: 0.9,
  },
  credit_card: {
    pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    confidence: 0.85,
  },
  api_key: {
    pattern: /(?:sk|pk|api|key|token|secret)[-_]?[a-zA-Z0-9]{16,}/gi,
    confidence: 0.7,
  },
  ip_address: {
    pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    confidence: 0.9,
  },
  url: {
    pattern: /https?:\/\/[^\s<>"{}|\\^`[\]]+/g,
    confidence: 0.95,
  },
  date: {
    pattern: /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g,
    confidence: 0.7,
  },
};

// =============================================================================
// Pattern Detector Class
// =============================================================================

/**
 * Pattern detector for finding sensitive data in text
 *
 * @example
 * ```ts
 * const detector = new PatternDetector({
 *   enabledPatterns: ['email', 'phone', 'ssn'],
 * });
 *
 * const result = await detector.detectAll('Contact: john@example.com or 555-123-4567');
 * console.log(result.matches); // Array of PatternMatch
 * ```
 */
export class PatternDetector {
  private readonly enabledPatterns: Set<string>;
  private readonly customPatterns: CustomPattern[];
  private readonly minConfidence: number;
  private readonly maxMatches: number;

  constructor(config: PatternDetectorConfig = {}) {
    const {
      enabledPatterns = Object.keys(BUILT_IN_PATTERNS),
      customPatterns = [],
      minConfidence = 0,
      maxMatches = 1000,
    } = config;

    this.enabledPatterns = new Set(enabledPatterns);
    this.customPatterns = customPatterns;
    this.minConfidence = minConfidence;
    this.maxMatches = maxMatches;
  }

  /**
   * Detect all patterns in the given text
   */
  async detectAll(text: string): Promise<DetectionResult> {
    const startTime = Date.now();
    const matches: PatternMatch[] = [];
    const patternBreakdown: Record<string, number> = {};

    // Check built-in patterns
    for (const [type, { pattern, confidence }] of Object.entries(BUILT_IN_PATTERNS)) {
      if (!this.enabledPatterns.has(type)) continue;
      if (confidence < this.minConfidence) continue;

      // Reset regex lastIndex for global patterns
      pattern.lastIndex = 0;

      let match;
      while ((match = pattern.exec(text)) !== null && matches.length < this.maxMatches) {
        matches.push({
          type: type as PatternType,
          value: match[0],
          startIndex: match.index,
          endIndex: match.index + match[0].length,
          confidence,
        });

        patternBreakdown[type] = (patternBreakdown[type] || 0) + 1;
      }
    }

    // Check custom patterns
    for (const customPattern of this.customPatterns) {
      if (!this.enabledPatterns.has(customPattern.name)) continue;

      const confidence = customPattern.confidence ?? 0.5;
      if (confidence < this.minConfidence) continue;

      // Reset regex lastIndex for global patterns
      customPattern.pattern.lastIndex = 0;

      let match;
      while (
        (match = customPattern.pattern.exec(text)) !== null &&
        matches.length < this.maxMatches
      ) {
        // Run validator if provided
        if (customPattern.validator && !customPattern.validator(match[0])) {
          continue;
        }

        matches.push({
          type: customPattern.name,
          value: match[0],
          startIndex: match.index,
          endIndex: match.index + match[0].length,
          confidence,
        });

        patternBreakdown[customPattern.name] = (patternBreakdown[customPattern.name] || 0) + 1;
      }
    }

    // Sort by start index
    matches.sort((a, b) => a.startIndex - b.startIndex);

    return {
      matches,
      totalMatches: matches.length,
      processingTimeMs: Date.now() - startTime,
      patternBreakdown,
    };
  }

  /**
   * Detect a specific pattern type in text
   */
  async detect(text: string, patternType: string): Promise<PatternMatch[]> {
    const result = await this.detectAll(text);
    return result.matches.filter(m => m.type === patternType);
  }

  /**
   * Check if text contains any sensitive patterns
   */
  async containsSensitiveData(text: string): Promise<boolean> {
    const result = await this.detectAll(text);
    return result.totalMatches > 0;
  }

  /**
   * Get all enabled pattern types
   */
  getEnabledPatterns(): string[] {
    return Array.from(this.enabledPatterns);
  }

  /**
   * Add a custom pattern
   */
  addCustomPattern(pattern: CustomPattern): void {
    this.customPatterns.push(pattern);
    this.enabledPatterns.add(pattern.name);
  }

  /**
   * Remove a custom pattern by name
   */
  removeCustomPattern(name: string): boolean {
    const index = this.customPatterns.findIndex(p => p.name === name);
    if (index !== -1) {
      this.customPatterns.splice(index, 1);
      this.enabledPatterns.delete(name);
      return true;
    }
    return false;
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a pattern detector with default settings
 */
export function createPatternDetector(config?: PatternDetectorConfig): PatternDetector {
  return new PatternDetector(config);
}

// =============================================================================
// Default Export
// =============================================================================

export default {
  PatternDetector,
  createPatternDetector,
};
