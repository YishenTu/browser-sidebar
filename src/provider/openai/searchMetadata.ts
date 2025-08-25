/**
 * @file OpenAI Search Metadata Handler
 *
 * Handles formatting and processing of web search metadata
 * from OpenAI's web search tool responses.
 */

import type { ProviderChatMessage } from '../../types/providers';

/**
 * Format search metadata from OpenAI response
 */
export function formatSearchMetadata(sources: any[]): any {
  if (!sources || !Array.isArray(sources)) {
    return null;
  }

  const formattedSources = sources
    .filter(source => source && source.url)
    .map(source => ({
      title: source.title || 'Untitled',
      url: source.url,
      snippet: source.snippet,
    }));

  if (formattedSources.length === 0) {
    return null;
  }

  return {
    sources: formattedSources,
  };
}

/**
 * Create fallback search metadata from query
 */
export function createFallbackSearchMetadata(
  query?: string,
  messages?: ProviderChatMessage[]
): any {
  if (query) {
    return {
      sources: [
        {
          title: `Web search: "${query}"`,
          url: 'https://www.google.com/search?q=' + encodeURIComponent(query),
        },
      ],
    };
  }

  // Try to infer from messages if no specific query
  if (messages && messages.length > 0) {
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();

    if (lastUserMessage) {
      const userQuery = lastUserMessage.content.slice(0, 100); // Use first 100 chars as query
      return {
        sources: [
          {
            title: 'Real-time web search',
            url: 'https://www.google.com/search?q=' + encodeURIComponent(userQuery),
          },
        ],
      };
    }
  }

  return null;
}

/**
 * Merge search metadata from multiple sources
 */
export function mergeSearchMetadata(...metadataArrays: any[]): any {
  const allSources: any[] = [];
  const seenUrls = new Set<string>();

  for (const metadata of metadataArrays) {
    if (metadata?.sources && Array.isArray(metadata.sources)) {
      for (const source of metadata.sources) {
        if (source.url && !seenUrls.has(source.url)) {
          seenUrls.add(source.url);
          allSources.push(source);
        }
      }
    }
  }

  if (allSources.length === 0) {
    return null;
  }

  return {
    sources: allSources,
  };
}

/**
 * Handle search metadata for streaming events
 * Centralizes the logic for processing search metadata from OpenAI stream events
 */
export function handleStreamSearchMetadata(
  event: any,
  extractedMetadata: any,
  currentMetadata: any,
  messages?: ProviderChatMessage[]
): any {
  // Handle web search events
  if (event.type === 'response.output_item.done' && event.item?.type === 'web_search_call') {
    // This is a web search event
    if (extractedMetadata) {
      // We have metadata with a query
      return currentMetadata || extractedMetadata;
    } else {
      // Web search was performed but no query in the event
      // Create fallback using the user's messages
      if (!currentMetadata) {
        return createFallbackSearchMetadata(undefined, messages);
      }
      return currentMetadata;
    }
  } else if (extractedMetadata) {
    // Other types of search metadata (e.g., citations)
    return currentMetadata || extractedMetadata;
  }

  return currentMetadata;
}
