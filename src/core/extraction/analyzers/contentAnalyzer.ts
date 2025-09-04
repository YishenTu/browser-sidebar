/**
 * @file Content Analyzer
 *
 * Analyzes content features like code blocks, tables, word count, and generates excerpts.
 */

/**
 * Detects code blocks in markdown content (triple backticks)
 */
export function detectCodeBlocks(markdown: string): boolean {
  return /```[\s\S]*?```/.test(markdown);
}

/**
 * Detects tables in markdown content (pipe separators)
 */
export function detectTables(markdown: string): boolean {
  // Look for lines with pipe separators that suggest table structure
  const lines = markdown.split('\n');
  return lines.some(line => {
    const pipes = (line.match(/\|/g) || []).length;
    return pipes >= 2; // At least 2 pipes suggest a table row
  });
}

/**
 * Generates a brief excerpt from the content (first ~200 characters)
 */
export function generateExcerpt(markdown: string): string {
  if (!markdown) {
    return '';
  }

  // Remove markdown syntax for excerpt
  const cleanText = markdown
    .replace(/```[\s\S]*?```/g, '[code]') // Replace code blocks
    .replace(/`[^`]+`/g, '[code]') // Replace inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Convert links to text
    .replace(/[#*_~]/g, '') // Remove formatting
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();

  // Truncate to approximately 200 characters, breaking at word boundaries
  if (cleanText.length <= 200) {
    return cleanText;
  }

  const truncated = cleanText.substring(0, 200);
  const lastSpaceIndex = truncated.lastIndexOf(' ');

  if (lastSpaceIndex > 150) {
    // Only break at word if it's not too short
    return truncated.substring(0, lastSpaceIndex) + '...';
  }

  return truncated + '...';
}
