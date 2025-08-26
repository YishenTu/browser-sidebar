/**
 * @file Fallback Content Extractor
 *
 * Heuristic content extractor for non-article pages when Readability fails.
 * Uses a priority system: main -> article -> scored div/section elements.
 */

import { isVisible } from '../domUtils';

// =============================================================================
// Types and Interfaces
// =============================================================================

/**
 * Result from fallback content extraction
 */
export interface FallbackResult {
  /** HTML content extracted */
  content: string;
  /** Plain text content extracted (without HTML tags) */
  textContent: string;
  /** Whether content was truncated due to budget limits */
  isTruncated: boolean;
  /** Method used to extract content */
  method: 'main' | 'article' | 'scored';
}

/**
 * Internal scoring result for elements
 */
interface ScoredElement {
  element: Element;
  score: number;
}

// =============================================================================
// Main Extraction Function
// =============================================================================

/**
 * Extracts content using heuristic fallback methods from a specific document
 *
 * @param doc - The document to extract content from
 * @param budgetChars - Maximum characters to extract (default 500KB)
 * @returns Fallback result with content, truncation flag, and method used
 */
export function extractFallbackHTMLFrom(
  doc: Document,
  budgetChars: number = 500000
): FallbackResult {
  let content = '';
  let textContent = '';
  let method: FallbackResult['method'] = 'scored'; // Default fallback method

  try {
    // Strategy 1: Try <main> element first
    const mainElement = doc.querySelector('main');
    if (mainElement && isVisible(mainElement)) {
      const cleaned = cleanElementWithText(mainElement);
      content = cleaned.html;
      textContent = cleaned.text;
      method = 'main';
    }

    // Strategy 2: Try <article> elements (select longest visible one)
    if (!content || !content.trim()) {
      const articleElement = findBestArticleFrom(doc);
      if (articleElement) {
        const cleaned = cleanElementWithText(articleElement);
        content = cleaned.html;
        textContent = cleaned.text;
        method = 'article';
      }
    }

    // Strategy 3: Fall back to scoring algorithm
    if (!content || !content.trim()) {
      const scoredElement = findHighestScoredElementFrom(doc);
      if (scoredElement) {
        const cleaned = cleanElementWithText(scoredElement);
        content = cleaned.html;
        textContent = cleaned.text;
        method = 'scored';
      }
    }

    // Final fallback: extract from body if nothing else works
    if (!content || !content.trim()) {
      const bodyElement = doc.body;
      if (bodyElement) {
        const cleaned = cleanElementWithText(bodyElement);
        content = cleaned.html;
        textContent = cleaned.text;
        method = 'scored'; // Keep as 'scored' since it's the fallback method
      }
    }

    // Ensure we always have some content
    if (!content || !content.trim()) {
      content = doc.title || 'No content available';
      textContent = doc.title || 'No content available';
    }
  } catch (error) {
    // Handle any errors gracefully
    content = doc.title || 'Content extraction failed';
    textContent = doc.title || 'Content extraction failed';
    method = 'scored';
  }

  // Enforce character budget on both HTML and text
  const { finalContent, finalText, isTruncated } = enforceCharacterBudgetWithText(
    content,
    textContent,
    budgetChars
  );

  return {
    content: finalContent,
    textContent: finalText,
    isTruncated,
    method,
  };
}

/**
 * Extracts content using heuristic fallback methods from the global document
 *
 * @param budgetChars - Maximum characters to extract (default 500KB)
 * @returns Fallback result with content, truncation flag, and method used
 */
export function extractFallbackHTML(budgetChars: number = 500000): FallbackResult {
  return extractFallbackHTMLFrom(document, budgetChars);
}

// =============================================================================
// Content Selection Strategies
// =============================================================================

/**
 * Finds the best article element (longest visible one) from the provided document
 */
function findBestArticleFrom(doc: Document): Element | null {
  const articles = Array.from(doc.querySelectorAll('article'));
  let bestArticle: Element | null = null;
  let longestLength = 0;

  for (const article of articles) {
    if (isVisible(article)) {
      const textLength = getTextLength(article);
      if (textLength > longestLength) {
        longestLength = textLength;
        bestArticle = article;
      }
    }
  }

  return bestArticle;
}

/**
 * Finds the element with highest content score from the provided document
 */
function findHighestScoredElementFrom(doc: Document): Element | null {
  const candidates = Array.from(doc.querySelectorAll('div, section'));
  const scoredElements: ScoredElement[] = [];

  for (const element of candidates) {
    if (isVisible(element)) {
      const score = calculateContentScore(element);
      if (score > 0) {
        scoredElements.push({ element, score });
      }
    }
  }

  // Sort by score (highest first) and return the best one
  scoredElements.sort((a, b) => b.score - a.score);
  return scoredElements.length > 0 ? scoredElements[0]?.element || null : null;
}

// =============================================================================
// Scoring Algorithm
// =============================================================================

/**
 * Calculates content score for an element based on headings, paragraphs, and text length
 *
 * Scoring:
 * - h1 elements: +100 points each
 * - h2 elements: +50 points each
 * - h3 elements: +30 points each
 * - p elements: +10 points each
 * - Text length: +1 point per 100 characters
 */
function calculateContentScore(element: Element): number {
  let score = 0;

  try {
    // Count headings and paragraphs (only visible ones)
    const h1Count = countVisibleElements(element, 'h1');
    const h2Count = countVisibleElements(element, 'h2');
    const h3Count = countVisibleElements(element, 'h3');
    const pCount = countVisibleElements(element, 'p');

    // Apply scoring weights
    score += h1Count * 100;
    score += h2Count * 50;
    score += h3Count * 30;
    score += pCount * 10;

    // Add text length score (1 point per 100 characters)
    const textLength = getTextLength(element);
    score += Math.floor(textLength / 100);
  } catch (error) {
    // Return 0 score if there's any error
    return 0;
  }

  return score;
}

/**
 * Counts visible elements of a specific tag within a container
 */
function countVisibleElements(container: Element, tagName: string): number {
  const elements = container.querySelectorAll(tagName);
  let count = 0;

  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];
    if (element && isVisible(element)) {
      count++;
    }
  }

  return count;
}

/**
 * Gets the total text length of an element
 */
function getTextLength(element: Element): number {
  try {
    return element.textContent?.length || 0;
  } catch (error) {
    return 0;
  }
}

// =============================================================================
// Content Cleaning
// =============================================================================

/**
 * Cleans an element and returns both HTML and text content
 */
function cleanElementWithText(element: Element): { html: string; text: string } {
  try {
    // Clone the element to avoid modifying the original DOM
    const clone = element.cloneNode(true) as Element;

    // Remove script, style, and other non-content elements
    removeElementsBySelector(
      clone,
      'script, style, noscript, iframe, canvas, svg, nav, aside[aria-label*="ad"], aside[aria-label*="advertisement"]'
    );

    // Remove hidden elements (using special logic for cloned nodes)
    removeHiddenElements(clone);

    // Extract text content from the cleaned clone
    const text = clone.textContent || '';
    const html = clone.innerHTML || text;

    return { html, text };
  } catch (error) {
    // Fallback if cleaning fails
    const text = element.textContent || '';
    return { html: text, text };
  }
}

/**
 * Removes elements matching a CSS selector from a container
 */
function removeElementsBySelector(container: Element, selector: string): void {
  const elements = container.querySelectorAll(selector);
  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];
    if (element) {
      element.remove();
    }
  }
}

/**
 * Removes hidden elements from a container
 * Note: Since we're working with a cloned node, we need a special visibility check
 */
function removeHiddenElements(container: Element): void {
  const allElements = container.querySelectorAll('*');

  for (let i = allElements.length - 1; i >= 0; i--) {
    const element = allElements[i] as HTMLElement;
    if (!element) continue;

    // Check for obviously hidden elements using attributes and inline styles
    // We can't use getComputedStyle on detached nodes reliably
    const style = element.getAttribute('style');
    const ariaHidden = element.getAttribute('aria-hidden');
    const hidden = element.getAttribute('hidden');

    // Check common hiding patterns
    if (ariaHidden === 'true' || hidden !== null) {
      element.remove();
      continue;
    }

    // Check inline styles for common hiding patterns
    if (style) {
      const styleStr = style.toLowerCase();
      if (
        styleStr.includes('display:none') ||
        styleStr.includes('display: none') ||
        styleStr.includes('visibility:hidden') ||
        styleStr.includes('visibility: hidden') ||
        styleStr.includes('opacity:0') ||
        styleStr.includes('opacity: 0')
      ) {
        element.remove();
      }
    }
  }
}

// =============================================================================
// Budget Enforcement
// =============================================================================

/**
 * Enforces character budget on both HTML and text content
 */
function enforceCharacterBudgetWithText(
  htmlContent: string,
  textContent: string,
  budgetChars: number
): { finalContent: string; finalText: string; isTruncated: boolean } {
  if (htmlContent.length <= budgetChars && textContent.length <= budgetChars) {
    return {
      finalContent: htmlContent,
      finalText: textContent,
      isTruncated: false,
    };
  }

  // Truncate HTML at element boundary
  const truncatedHtml = truncateAtElementBoundary(htmlContent, budgetChars);

  // Truncate text at word boundary
  let truncatedText = textContent;
  if (textContent.length > budgetChars) {
    truncatedText = textContent.substring(0, budgetChars);
    const lastSpace = truncatedText.lastIndexOf(' ');
    if (lastSpace > budgetChars * 0.8) {
      truncatedText = truncatedText.substring(0, lastSpace) + '...';
    }
  }

  return {
    finalContent: truncatedHtml,
    finalText: truncatedText,
    isTruncated: true,
  };
}

/**
 * Truncates content at element boundary when possible
 */
function truncateAtElementBoundary(content: string, maxChars: number): string {
  if (content.length <= maxChars) {
    return content;
  }

  // Find the last complete element before the character limit
  let truncationPoint = maxChars;

  // Look backward for a closing tag
  for (let i = maxChars - 1; i >= Math.max(0, maxChars - 1000); i--) {
    if (content[i] === '>' && i > 0) {
      // Check if this is a closing tag
      let j = i - 1;
      while (j >= 0 && content[j] !== '<') {
        j--;
      }
      if (j >= 0 && content[j + 1] === '/') {
        truncationPoint = i + 1;
        break;
      }
    }
  }

  return content.substring(0, truncationPoint);
}
