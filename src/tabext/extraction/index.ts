/**
 * @file Extraction Module Exports
 *
 * Public API for content extraction functionality.
 */

export { extractContent } from './orchestrator';
export { htmlToMarkdown } from './converters/markdownConverter';
export type { MarkdownConversionOptions } from './converters/markdownConverter';

// Re-export analyzer functions if needed externally
export { detectCodeBlocks, detectTables, generateExcerpt } from './analyzers/contentAnalyzer';

export { getPageMetadata, type PageMetadata } from './analyzers/metadataExtractor';
