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
  metadata: GeminiSearchMetadata | any
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
function extractQueries(metadata: any): string[] {
  const queries = metadata.webSearchQueries || metadata.web_search_queries;
  return queries || [];
}

/**
 * Extract sources from grounding chunks
 */
function extractSources(metadata: any): Array<{ url: string; title: string }> {
  const chunks = metadata.groundingChunks || metadata.grounding_chunks;

  if (!chunks?.length) {
    return [];
  }

  return chunks
    .filter((chunk: any) => chunk.web?.uri)
    .map((chunk: any) => ({
      url: chunk.web.uri,
      title: chunk.web.title || 'Untitled',
    }));
}

/**
 * Extract citations from grounding supports
 */
function extractCitations(metadata: any): Array<{
  text: string;
  startIndex?: number;
  endIndex?: number;
  sourceIndices: number[];
}> {
  const supports = metadata.groundingSupports || metadata.grounding_supports;

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
function extractSearchWidget(metadata: any): string | undefined {
  const entryPoint = metadata.searchEntryPoint || metadata.search_entry_point;

  if (entryPoint) {
    return entryPoint.renderedContent || entryPoint.rendered_content;
  }

  return undefined;
}

/**
 * Check if metadata has search results
 */
export function hasSearchResults(metadata: any): boolean {
  if (!metadata) return false;

  // Check for any search-related fields
  return !!(
    metadata.webSearchQueries?.length ||
    metadata.web_search_queries?.length ||
    metadata.groundingChunks?.length ||
    metadata.grounding_chunks?.length ||
    metadata.groundingSupports?.length ||
    metadata.grounding_supports?.length ||
    metadata.searchEntryPoint ||
    metadata.search_entry_point
  );
}
