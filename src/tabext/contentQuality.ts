/**
 * @file Content Quality Scoring Utility
 *
 * Provides content quality assessment functionality for extracted web page content.
 * Analyzes various signals to generate a quality score and provide UX hints for content previews.
 */

import type { ExtractedContent } from '../types/extraction';

/**
 * Quality signals detected in content
 */
export interface QualitySignals {
  /** Whether content has a meaningful title */
  hasTitle: boolean;
  /** Whether content has sufficient word count (>= 100 words) */
  hasSufficientWordCount: boolean;
  /** Whether content has structural elements (headings/paragraphs) */
  hasStructure: boolean;
  /** Whether content contains code blocks */
  hasCode: boolean;
  /** Whether content contains tables */
  hasTables: boolean;
  /** Whether content has meaningful excerpt */
  hasExcerpt: boolean;
  /** Whether content has author information */
  hasAuthor: boolean;
}

/**
 * Quality levels based on score thresholds
 */
export type QualityLevel = 'low' | 'medium' | 'high';

/**
 * Content quality assessment result
 */
export interface ContentQuality {
  /** Quality score from 0-100 */
  score: number;
  /** Quality level categorization */
  qualityLevel: QualityLevel;
  /** Individual quality signals detected */
  signals: QualitySignals;
}

/**
 * Analyzes extracted content and returns a quality score with signals
 *
 * Scoring breakdown:
 * - Title present: 20 points
 * - Word count (scaled 0-30 points, min 100 words for full points)
 * - Structure indicators: 25 points
 * - Code blocks: 15 points
 * - Tables: 10 points
 * - Author information: 5 points (bonus)
 * - Meaningful excerpt: 5 points (bonus)
 *
 * @param content - ExtractedContent object to analyze
 * @returns Quality assessment with score, level, and signals
 */
export function scoreContentQuality(content: ExtractedContent): ContentQuality {
  let score = 0;

  // Extract data with fallback to deprecated fields for compatibility
  const wordCount = content.metadata?.wordCount ?? content.wordCount ?? 0;
  const hasCodeBlocks = content.metadata?.hasCodeBlocks ?? content.hasCode ?? false;
  const hasTables = content.metadata?.hasTables ?? content.hasTables ?? false;
  const title = content.title?.trim() || '';
  const excerpt = content.excerpt?.trim() || '';
  const author = content.author?.trim() || '';
  // Use content first, then fall back to deprecated markdown field for backwards compatibility
  const markdownContent = content.content || content.markdown || '';

  // Signal 1: Title presence (20 points)
  const hasTitle = title.length > 0 && title !== 'Untitled' && title !== 'No title available';
  if (hasTitle) {
    score += 20;
  }

  // Signal 2: Word count (0-30 points, scaled)
  const hasSufficientWordCount = wordCount >= 100;
  if (wordCount > 0) {
    // Scale word count points: 0-30 points
    // Full points at 100+ words, linearly scaled below that
    const wordCountPoints = Math.min(30, Math.floor((wordCount / 100) * 30));
    score += wordCountPoints;
  }

  // Signal 3: Structure indicators (25 points)
  const hasStructure = detectStructure(markdownContent);
  if (hasStructure) {
    score += 25;
  }

  // Signal 4: Code blocks (15 points)
  const hasCode = hasCodeBlocks;
  if (hasCode) {
    score += 15;
  }

  // Signal 5: Tables (10 points)
  if (hasTables) {
    score += 10;
  }

  // Bonus Signal 6: Author information (5 points)
  const hasAuthor = author.length > 0;
  if (hasAuthor) {
    score += 5;
  }

  // Bonus Signal 7: Meaningful excerpt (5 points)
  const hasExcerpt = excerpt.length > 20; // More than just a truncated sentence
  if (hasExcerpt) {
    score += 5;
  }

  // Ensure score is within bounds
  score = Math.min(100, Math.max(0, score));

  // Determine quality level based on score
  const qualityLevel = determineQualityLevel(score);

  // Build signals object
  const signals: QualitySignals = {
    hasTitle,
    hasSufficientWordCount,
    hasStructure,
    hasCode,
    hasTables,
    hasExcerpt,
    hasAuthor,
  };

  return {
    score,
    qualityLevel,
    signals,
  };
}

/**
 * Detects structural elements in markdown content
 * Looks for headings, paragraphs, lists, etc.
 */
function detectStructure(markdownContent: string): boolean {
  if (!markdownContent || markdownContent.trim().length === 0) {
    return false;
  }

  const lines = markdownContent.split('\n').map(line => line.trim());

  // Check for headings (# ## ###)
  const hasHeadings = lines.some(line => /^#{1,6}\s+.+/.test(line));

  // Check for paragraph structure (multiple lines with content)
  const contentLines = lines.filter(line => line.length > 20); // Meaningful content lines
  const hasMultipleParagraphs = contentLines.length >= 3;

  // Check for lists (- * + or numbered)
  const hasLists = lines.some(line => /^[-*+]\s+.+|^\d+\.\s+.+/.test(line));

  // Check for blockquotes
  const hasBlockquotes = lines.some(line => /^>\s+.+/.test(line));

  // Consider content structured if it has at least 2 of these elements
  const structuralElements = [hasHeadings, hasMultipleParagraphs, hasLists, hasBlockquotes];
  const structuralScore = structuralElements.filter(Boolean).length;

  return structuralScore >= 2;
}

/**
 * Determines quality level based on numeric score
 */
function determineQualityLevel(score: number): QualityLevel {
  if (score >= 70) {
    return 'high';
  } else if (score >= 40) {
    return 'medium';
  } else {
    return 'low';
  }
}

/**
 * Gets a human-readable description of the quality level
 */
export function getQualityDescription(level: QualityLevel): string {
  switch (level) {
    case 'high':
      return 'High Quality';
    case 'medium':
      return 'Medium Quality';
    case 'low':
      return 'Low Quality';
    default:
      return 'Unknown Quality';
  }
}

/**
 * Gets the appropriate badge variant for a quality level
 */
export function getQualityBadgeVariant(level: QualityLevel): 'success' | 'warning' | 'error' {
  switch (level) {
    case 'high':
      return 'success';
    case 'medium':
      return 'warning';
    case 'low':
      return 'error';
    default:
      return 'error';
  }
}
