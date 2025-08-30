/**
 * @file Gemini Search Metadata Formatter
 *
 * Handles formatting of Google Search grounding metadata from Gemini responses.
 * Supports both camelCase and snake_case field names for compatibility.
 */

import type { GeminiSearchMetadata, FormattedSearchMetadata } from './types';

/**
 * Format search metadata for response
 * Handles both camelCase and snake_case field names
 */
export function formatSearchMetadata(
  metadata: GeminiSearchMetadata | unknown
): FormattedSearchMetadata | undefined {
  const searchInfo: FormattedSearchMetadata = {};

  // Extract search queries
  const queries = extractQueries(metadata);
  if (queries.length > 0) {
    searchInfo.queries = queries;
  }

  // Extract sources from grounding chunks
  const sources = extractSources(metadata);
  if (sources.length > 0) {
    searchInfo.sources = sources;
  }

  // Extract citations from grounding supports
  const citations = extractCitations(metadata);
  if (citations.length > 0) {
    searchInfo.citations = citations;
  }

  // Extract search widget content
  const searchWidget = extractSearchWidget(metadata);
  if (searchWidget) {
    searchInfo.searchWidget = searchWidget;
  }

  return Object.keys(searchInfo).length > 0 ? searchInfo : undefined;
}

/**
 * Extract search queries from metadata
 */
function extractQueries(metadata: unknown): string[] {
  const meta = metadata as { webSearchQueries?: string[]; web_search_queries?: string[] };
  const queries = meta.webSearchQueries || meta.web_search_queries;
  return queries || [];
}

/**
 * Extract sources from grounding chunks
 */
function extractSources(metadata: unknown): Array<{ url: string; title: string }> {
  const meta = metadata as { groundingChunks?: unknown[]; grounding_chunks?: unknown[] };
  const chunks = meta.groundingChunks || meta.grounding_chunks;

  if (!chunks?.length) {
    return [];
  }

  return (chunks as any[])
    .filter((chunk: any): boolean => chunk.web?.uri !== undefined)
    .map((chunk: any) => ({
      url: chunk.web.uri,
      title: chunk.web.title || 'Untitled',
    }));
}

/**
 * Extract citations from grounding supports
 */
function extractCitations(metadata: unknown): Array<{
  text: string;
  startIndex?: number;
  endIndex?: number;
  sourceIndices: number[];
}> {
  const meta = metadata as { groundingSupports?: unknown[]; grounding_supports?: unknown[] };
  const supports = meta.groundingSupports || meta.grounding_supports;

  if (!supports?.length) {
    return [];
  }

  return supports.map((support: any) => ({
    text: support.segment?.text || '',
    startIndex: support.segment?.startIndex || support.segment?.start_index,
    endIndex: support.segment?.endIndex || support.segment?.end_index,
    sourceIndices: support.groundingChunkIndices || support.grounding_chunk_indices || [],
  }));
}

/**
 * Extract search widget content
 */
function extractSearchWidget(metadata: unknown): string | undefined {
  const meta = metadata as {
    searchEntryPoint?: { renderedContent?: string; rendered_content?: string };
    search_entry_point?: { renderedContent?: string; rendered_content?: string };
  };
  const entryPoint = meta.searchEntryPoint || meta.search_entry_point;

  if (entryPoint) {
    return entryPoint.renderedContent || entryPoint.rendered_content;
  }

  return undefined;
}

/**
 * Check if metadata has search results
 */
export function hasSearchResults(metadata: unknown): boolean {
  if (!metadata) return false;

  const meta = metadata as {
    webSearchQueries?: unknown[];
    web_search_queries?: unknown[];
    groundingChunks?: unknown[];
    grounding_chunks?: unknown[];
    groundingSupports?: unknown[];
    grounding_supports?: unknown[];
    searchEntryPoint?: unknown;
    search_entry_point?: unknown;
  };

  // Check for any search-related fields
  return !!(
    meta.webSearchQueries?.length ||
    meta.web_search_queries?.length ||
    meta.groundingChunks?.length ||
    meta.grounding_chunks?.length ||
    meta.groundingSupports?.length ||
    meta.grounding_supports?.length ||
    meta.searchEntryPoint ||
    meta.search_entry_point
  );
}
