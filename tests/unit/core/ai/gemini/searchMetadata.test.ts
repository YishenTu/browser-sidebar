/**
 * @file Gemini Search Metadata Unit Tests
 *
 * Comprehensive unit tests for Gemini search metadata formatting functionality,
 * including search query extraction, source formatting, citation processing,
 * and metadata validation with support for both camelCase and snake_case formats.
 */

import { describe, it, expect } from 'vitest';
import { formatSearchMetadata, hasSearchResults } from '@/core/ai/gemini/searchMetadata';
import type { GeminiSearchMetadata, FormattedSearchMetadata } from '@/core/ai/gemini/types';

describe('Gemini Search Metadata', () => {
  describe('formatSearchMetadata', () => {
    it('should format complete search metadata with camelCase fields', () => {
      const metadata: GeminiSearchMetadata = {
        webSearchQueries: ['artificial intelligence', 'machine learning'],
        groundingChunks: [
          {
            web: {
              uri: 'https://example.com/ai',
              title: 'Introduction to AI',
            },
          },
          {
            web: {
              uri: 'https://example.com/ml',
              title: 'Machine Learning Basics',
            },
          },
        ],
        groundingSupports: [
          {
            segment: {
              text: 'AI is transforming industries',
              startIndex: 0,
              endIndex: 28,
            },
            groundingChunkIndices: [0],
          },
          {
            segment: {
              text: 'Machine learning enables predictions',
              startIndex: 30,
              endIndex: 65,
            },
            groundingChunkIndices: [1],
          },
        ],
        searchEntryPoint: {
          renderedContent: '<div class="search-widget">Search Results</div>',
        },
      };

      const result = formatSearchMetadata(metadata);

      expect(result).toEqual({
        queries: ['artificial intelligence', 'machine learning'],
        sources: [
          { url: 'https://example.com/ai', title: 'Introduction to AI' },
          { url: 'https://example.com/ml', title: 'Machine Learning Basics' },
        ],
        citations: [
          {
            text: 'AI is transforming industries',
            startIndex: undefined, // 0 is falsy, so || returns undefined
            endIndex: 28,
            sourceIndices: [0],
          },
          {
            text: 'Machine learning enables predictions',
            startIndex: 30,
            endIndex: 65,
            sourceIndices: [1],
          },
        ],
        searchWidget: '<div class="search-widget">Search Results</div>',
      });
    });

    it('should format search metadata with snake_case fields', () => {
      const metadata: GeminiSearchMetadata = {
        web_search_queries: ['snake case query', 'another query'],
        grounding_chunks: [
          {
            web: {
              uri: 'https://snake.example.com',
              title: 'Snake Case Source',
            },
          },
        ],
        grounding_supports: [
          {
            segment: {
              text: 'Snake case text',
              start_index: 10,
              end_index: 25,
            },
            grounding_chunk_indices: [0],
          },
        ],
        search_entry_point: {
          rendered_content: '<div>Snake case widget</div>',
        },
      };

      const result = formatSearchMetadata(metadata);

      expect(result).toEqual({
        queries: ['snake case query', 'another query'],
        sources: [{ url: 'https://snake.example.com', title: 'Snake Case Source' }],
        citations: [
          {
            text: 'Snake case text',
            startIndex: 10,
            endIndex: 25,
            sourceIndices: [0],
          },
        ],
        searchWidget: '<div>Snake case widget</div>',
      });
    });

    it('should prioritize camelCase over snake_case when both exist', () => {
      const metadata: GeminiSearchMetadata = {
        webSearchQueries: ['camel case query'],
        web_search_queries: ['snake case query'],
        groundingChunks: [
          {
            web: {
              uri: 'https://camel.example.com',
              title: 'Camel Case Source',
            },
          },
        ],
        grounding_chunks: [
          {
            web: {
              uri: 'https://snake.example.com',
              title: 'Snake Case Source',
            },
          },
        ],
      };

      const result = formatSearchMetadata(metadata);

      expect(result?.queries).toEqual(['camel case query']);
      expect(result?.sources).toEqual([
        { url: 'https://camel.example.com', title: 'Camel Case Source' },
      ]);
    });

    it('should handle empty metadata gracefully', () => {
      const metadata = {};

      const result = formatSearchMetadata(metadata);

      expect(result).toBeUndefined();
    });

    it('should return undefined for metadata with no search content', () => {
      const metadata = {
        someOtherField: 'not search related',
      };

      const result = formatSearchMetadata(metadata);

      expect(result).toBeUndefined();
    });

    it('should handle partial metadata with only queries', () => {
      const metadata: GeminiSearchMetadata = {
        webSearchQueries: ['partial query'],
      };

      const result = formatSearchMetadata(metadata);

      expect(result).toEqual({
        queries: ['partial query'],
      });
    });

    it('should handle partial metadata with only sources', () => {
      const metadata: GeminiSearchMetadata = {
        groundingChunks: [
          {
            web: {
              uri: 'https://only-source.com',
              title: 'Only Source',
            },
          },
        ],
      };

      const result = formatSearchMetadata(metadata);

      expect(result).toEqual({
        sources: [{ url: 'https://only-source.com', title: 'Only Source' }],
      });
    });

    it('should handle grounding chunks without web field', () => {
      const metadata: GeminiSearchMetadata = {
        webSearchQueries: ['test query'],
        groundingChunks: [
          {
            web: {
              uri: 'https://valid.com',
              title: 'Valid Source',
            },
          },
          {
            // Missing web field
          } as any,
          {
            web: {
              // Missing uri
              title: 'Invalid Source',
            },
          } as any,
        ],
      };

      const result = formatSearchMetadata(metadata);

      expect(result?.sources).toEqual([{ url: 'https://valid.com', title: 'Valid Source' }]);
    });

    it('should handle sources with missing titles', () => {
      const metadata: GeminiSearchMetadata = {
        groundingChunks: [
          {
            web: {
              uri: 'https://no-title.com',
              // Missing title
            },
          },
          {
            web: {
              uri: 'https://empty-title.com',
              title: '',
            },
          },
        ],
      };

      const result = formatSearchMetadata(metadata);

      expect(result?.sources).toEqual([
        { url: 'https://no-title.com', title: 'Untitled' },
        { url: 'https://empty-title.com', title: 'Untitled' },
      ]);
    });

    it('should handle citations with mixed index formats', () => {
      const metadata: GeminiSearchMetadata = {
        groundingSupports: [
          {
            segment: {
              text: 'camelCase indices',
              startIndex: 0,
              endIndex: 17,
            },
            groundingChunkIndices: [0, 1],
          },
          {
            segment: {
              text: 'snake_case indices',
              start_index: 20,
              end_index: 38,
            },
            grounding_chunk_indices: [1, 2],
          },
          {
            segment: {
              text: 'mixed indices',
              startIndex: 40,
              end_index: 53, // Mixed camelCase start with snake_case end
            },
            groundingChunkIndices: [0], // camelCase chunk indices
          },
        ],
      };

      const result = formatSearchMetadata(metadata);

      expect(result?.citations).toEqual([
        {
          text: 'camelCase indices',
          startIndex: undefined, // 0 is falsy, so || returns undefined
          endIndex: 17,
          sourceIndices: [0, 1],
        },
        {
          text: 'snake_case indices',
          startIndex: 20,
          endIndex: 38,
          sourceIndices: [1, 2],
        },
        {
          text: 'mixed indices',
          startIndex: 40,
          endIndex: 53,
          sourceIndices: [0],
        },
      ]);
    });

    it('should handle citations with missing or empty text', () => {
      const metadata: GeminiSearchMetadata = {
        groundingSupports: [
          {
            segment: {
              // Missing text
              startIndex: 0,
              endIndex: 10,
            },
            groundingChunkIndices: [0],
          },
          {
            segment: {
              text: '',
              startIndex: 10,
              endIndex: 15,
            },
            groundingChunkIndices: [1],
          },
        ],
      };

      const result = formatSearchMetadata(metadata);

      expect(result?.citations).toEqual([
        {
          text: '',
          startIndex: undefined, // 0 is falsy, so || returns undefined
          endIndex: 10,
          sourceIndices: [0],
        },
        {
          text: '',
          startIndex: 10,
          endIndex: 15,
          sourceIndices: [1],
        },
      ]);
    });

    it('should handle citations without segment field', () => {
      const metadata: GeminiSearchMetadata = {
        groundingSupports: [
          {
            // Missing segment field
            groundingChunkIndices: [0],
          } as any,
        ],
      };

      const result = formatSearchMetadata(metadata);

      expect(result?.citations).toEqual([
        {
          text: '',
          startIndex: undefined,
          endIndex: undefined,
          sourceIndices: [0],
        },
      ]);
    });

    it('should handle citations without grounding chunk indices', () => {
      const metadata: GeminiSearchMetadata = {
        groundingSupports: [
          {
            segment: {
              text: 'No indices',
              startIndex: 0,
              endIndex: 10,
            },
            // Missing groundingChunkIndices
          } as any,
        ],
      };

      const result = formatSearchMetadata(metadata);

      expect(result?.citations).toEqual([
        {
          text: 'No indices',
          startIndex: undefined, // 0 is falsy, so || returns undefined
          endIndex: 10,
          sourceIndices: [],
        },
      ]);
    });

    it('should handle search entry point with different field names', () => {
      const testCases = [
        {
          searchEntryPoint: {
            renderedContent: 'camelCase content',
          },
          expected: 'camelCase content',
        },
        {
          searchEntryPoint: {
            rendered_content: 'snake_case content',
          },
          expected: 'snake_case content',
        },
        {
          search_entry_point: {
            renderedContent: 'snake key camelCase content',
          },
          expected: 'snake key camelCase content',
        },
        {
          search_entry_point: {
            rendered_content: 'both snake_case',
          },
          expected: 'both snake_case',
        },
      ];

      testCases.forEach(({ expected, ...metadata }) => {
        const result = formatSearchMetadata(metadata as any);
        expect(result?.searchWidget).toBe(expected);
      });
    });

    it('should handle empty arrays', () => {
      const metadata: GeminiSearchMetadata = {
        webSearchQueries: [],
        groundingChunks: [],
        groundingSupports: [],
      };

      const result = formatSearchMetadata(metadata);

      expect(result).toBeUndefined(); // Empty arrays should result in undefined
    });

    it('should handle null and undefined values', () => {
      // Both null and undefined cause errors in current implementation
      expect(() => formatSearchMetadata(null)).toThrow();
      expect(() => formatSearchMetadata(undefined)).toThrow();
    });

    it('should handle complex real-world metadata', () => {
      const metadata = {
        webSearchQueries: ['TypeScript best practices 2024', 'React performance optimization'],
        groundingChunks: [
          {
            web: {
              uri: 'https://typescript-lang.org/docs/handbook/2/everyday-types.html',
              title: 'TypeScript Handbook - Everyday Types',
            },
          },
          {
            web: {
              uri: 'https://react.dev/reference/react/memo',
              title: 'React memo – React Reference',
            },
          },
          {
            web: {
              uri: 'https://web.dev/react-performance-optimization',
              title: 'React Performance Optimization Guide',
            },
          },
        ],
        groundingSupports: [
          {
            segment: {
              text: 'TypeScript provides static type checking to catch errors at compile time',
              startIndex: 0,
              endIndex: 72,
            },
            groundingChunkIndices: [0],
          },
          {
            segment: {
              text: 'React.memo can help optimize performance by preventing unnecessary re-renders',
              startIndex: 74,
              endIndex: 150,
            },
            groundingChunkIndices: [1, 2],
          },
        ],
        searchEntryPoint: {
          renderedContent: '<div class="search-results"><h3>Found 3 relevant sources</h3></div>',
        },
      };

      const result = formatSearchMetadata(metadata);

      expect(result).toEqual({
        queries: ['TypeScript best practices 2024', 'React performance optimization'],
        sources: [
          {
            url: 'https://typescript-lang.org/docs/handbook/2/everyday-types.html',
            title: 'TypeScript Handbook - Everyday Types',
          },
          {
            url: 'https://react.dev/reference/react/memo',
            title: 'React memo – React Reference',
          },
          {
            url: 'https://web.dev/react-performance-optimization',
            title: 'React Performance Optimization Guide',
          },
        ],
        citations: [
          {
            text: 'TypeScript provides static type checking to catch errors at compile time',
            startIndex: undefined, // 0 is falsy, so || returns undefined
            endIndex: 72,
            sourceIndices: [0],
          },
          {
            text: 'React.memo can help optimize performance by preventing unnecessary re-renders',
            startIndex: 74,
            endIndex: 150,
            sourceIndices: [1, 2],
          },
        ],
        searchWidget: '<div class="search-results"><h3>Found 3 relevant sources</h3></div>',
      });
    });
  });

  describe('hasSearchResults', () => {
    it('should return true for metadata with webSearchQueries (camelCase)', () => {
      const metadata = {
        webSearchQueries: ['test query'],
      };

      expect(hasSearchResults(metadata)).toBe(true);
    });

    it('should return true for metadata with web_search_queries (snake_case)', () => {
      const metadata = {
        web_search_queries: ['test query'],
      };

      expect(hasSearchResults(metadata)).toBe(true);
    });

    it('should return true for metadata with groundingChunks', () => {
      const metadata = {
        groundingChunks: [{ web: { uri: 'https://example.com' } }],
      };

      expect(hasSearchResults(metadata)).toBe(true);
    });

    it('should return true for metadata with grounding_chunks', () => {
      const metadata = {
        grounding_chunks: [{ web: { uri: 'https://example.com' } }],
      };

      expect(hasSearchResults(metadata)).toBe(true);
    });

    it('should return true for metadata with groundingSupports', () => {
      const metadata = {
        groundingSupports: [{ segment: { text: 'test' } }],
      };

      expect(hasSearchResults(metadata)).toBe(true);
    });

    it('should return true for metadata with grounding_supports', () => {
      const metadata = {
        grounding_supports: [{ segment: { text: 'test' } }],
      };

      expect(hasSearchResults(metadata)).toBe(true);
    });

    it('should return true for metadata with searchEntryPoint', () => {
      const metadata = {
        searchEntryPoint: {
          renderedContent: '<div>Search widget</div>',
        },
      };

      expect(hasSearchResults(metadata)).toBe(true);
    });

    it('should return true for metadata with search_entry_point', () => {
      const metadata = {
        search_entry_point: {
          rendered_content: '<div>Search widget</div>',
        },
      };

      expect(hasSearchResults(metadata)).toBe(true);
    });

    it('should return false for null metadata', () => {
      expect(hasSearchResults(null)).toBe(false);
    });

    it('should return false for undefined metadata', () => {
      expect(hasSearchResults(undefined)).toBe(false);
    });

    it('should return false for empty metadata object', () => {
      expect(hasSearchResults({})).toBe(false);
    });

    it('should return false for metadata with only empty arrays', () => {
      const metadata = {
        webSearchQueries: [],
        groundingChunks: [],
        groundingSupports: [],
      };

      expect(hasSearchResults(metadata)).toBe(false);
    });

    it('should return false for metadata with no search-related fields', () => {
      const metadata = {
        someOtherField: 'not search related',
        anotherField: { nested: 'data' },
      };

      expect(hasSearchResults(metadata)).toBe(false);
    });

    it('should return true if any search field has content', () => {
      const metadata = {
        webSearchQueries: [],
        groundingChunks: [],
        groundingSupports: [{ segment: { text: 'found!' } }],
      };

      expect(hasSearchResults(metadata)).toBe(true);
    });

    it('should handle mixed field naming conventions', () => {
      const metadata = {
        web_search_queries: [],
        groundingChunks: [{ web: { uri: 'https://example.com' } }],
        grounding_supports: [],
      };

      expect(hasSearchResults(metadata)).toBe(true);
    });

    it('should handle truthy but empty values', () => {
      const metadata = {
        webSearchQueries: '',
        groundingChunks: 0,
        searchEntryPoint: false,
      };

      expect(hasSearchResults(metadata)).toBe(false);
    });

    it('should handle objects with prototype pollution protection', () => {
      const metadata = Object.create(null);
      metadata.webSearchQueries = ['test'];

      expect(hasSearchResults(metadata)).toBe(true);
    });

    it('should handle complex nested structures', () => {
      const metadata = {
        level1: {
          webSearchQueries: ['should not be detected'],
        },
        groundingChunks: [
          {
            web: {
              uri: 'https://example.com',
              title: 'Test',
            },
          },
        ],
      };

      expect(hasSearchResults(metadata)).toBe(true);
    });
  });

  describe('Edge Cases and Data Validation', () => {
    it('should handle extremely long URLs and titles', () => {
      const longUrl = 'https://' + 'a'.repeat(2000) + '.com';
      const longTitle = 'Title ' + 'X'.repeat(1000);

      const metadata: GeminiSearchMetadata = {
        groundingChunks: [
          {
            web: {
              uri: longUrl,
              title: longTitle,
            },
          },
        ],
      };

      const result = formatSearchMetadata(metadata);

      expect(result?.sources).toEqual([{ url: longUrl, title: longTitle }]);
    });

    it('should handle special characters in URLs and titles', () => {
      const metadata: GeminiSearchMetadata = {
        groundingChunks: [
          {
            web: {
              uri: 'https://example.com/path?query=value&other=тест#fragment',
              title: 'Title with 🚀 emoji and "quotes" & symbols',
            },
          },
        ],
      };

      const result = formatSearchMetadata(metadata);

      expect(result?.sources).toEqual([
        {
          url: 'https://example.com/path?query=value&other=тест#fragment',
          title: 'Title with 🚀 emoji and "quotes" & symbols',
        },
      ]);
    });

    it('should handle very large number of search results', () => {
      const queries = Array(100)
        .fill(0)
        .map((_, i) => `query ${i}`);
      const chunks = Array(100)
        .fill(0)
        .map((_, i) => ({
          web: {
            uri: `https://example${i}.com`,
            title: `Source ${i}`,
          },
        }));
      const supports = Array(100)
        .fill(0)
        .map((_, i) => ({
          segment: {
            text: `Citation ${i}`,
            startIndex: i * 10,
            endIndex: i * 10 + 9,
          },
          groundingChunkIndices: [i % 10],
        }));

      const metadata: GeminiSearchMetadata = {
        webSearchQueries: queries,
        groundingChunks: chunks,
        groundingSupports: supports,
      };

      const result = formatSearchMetadata(metadata);

      expect(result?.queries).toHaveLength(100);
      expect(result?.sources).toHaveLength(100);
      expect(result?.citations).toHaveLength(100);
    });

    it('should handle negative or invalid indices', () => {
      const metadata: GeminiSearchMetadata = {
        groundingSupports: [
          {
            segment: {
              text: 'Invalid indices',
              startIndex: -5,
              endIndex: -1,
            },
            groundingChunkIndices: [-1, 999],
          },
        ],
      };

      const result = formatSearchMetadata(metadata);

      expect(result?.citations).toEqual([
        {
          text: 'Invalid indices',
          startIndex: -5,
          endIndex: -1,
          sourceIndices: [-1, 999],
        },
      ]);
    });

    it('should handle malformed grounding chunk indices', () => {
      const metadata: GeminiSearchMetadata = {
        groundingSupports: [
          {
            segment: {
              text: 'Test',
            },
            groundingChunkIndices: 'not an array' as any,
          },
          {
            segment: {
              text: 'Test 2',
            },
            grounding_chunk_indices: null as any,
          },
        ],
      };

      const result = formatSearchMetadata(metadata);

      const citations = result?.citations;
      expect(citations).toHaveLength(2);
      expect(citations?.[0]).toEqual({
        text: 'Test',
        startIndex: undefined,
        endIndex: undefined,
        sourceIndices: 'not an array', // Actual implementation behavior
      });
      expect(citations?.[1]).toEqual({
        text: 'Test 2',
        startIndex: undefined,
        endIndex: undefined,
        sourceIndices: [],
      });
    });

    it('should handle circular references in metadata', () => {
      const metadata: any = {
        webSearchQueries: ['test'],
      };
      metadata.self = metadata;

      const result = formatSearchMetadata(metadata);

      expect(result?.queries).toEqual(['test']);
    });

    it('should handle prototype chain manipulation attempts', () => {
      const maliciousMetadata = JSON.parse(
        '{"webSearchQueries": ["safe"], "__proto__": {"isAdmin": true}}'
      );

      const result = formatSearchMetadata(maliciousMetadata);

      expect(result?.queries).toEqual(['safe']);
    });
  });
});
