import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the defuddle module
vi.mock('defuddle', () => ({
  default: vi.fn().mockImplementation((document: Document, options: any) => ({
    parse: () => ({
      title: 'Test Article Title',
      author: 'John Doe',
      published: '2024-01-15',
      content: '<p>Test article content with <b>formatting</b></p>',
      description: 'A test article description',
      favicon: '',
      image: '',
      wordCount: 10,
      parseTime: 123,
      schemaOrgData: { '@type': 'Article', name: 'Test Article' },
      metaTags: [{ property: 'og:title', content: 'Test Article Title' }],
      site: 'example.com',
    }),
  })),
}));

describe('Defuddle Extractor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should extract content successfully with defuddle', async () => {
    // Import after mocking
    const { extractWithDefuddle } = await import('@tabext/extractors/defuddle');

    const result = await extractWithDefuddle();

    // Check basic fields
    expect(result.title).toBe('Test Article Title');
    expect(result.author).toBe('John Doe');
    expect(result.publishedDate).toBe('2024-01-15');
    expect(result.extractionMethod).toBe('defuddle');

    // Check content
    expect(result.content).toContain('Test article content');
    expect(result.textContent).toContain('Test article content');

    // Check metadata
    expect(result.metadata?.wordCount).toBe(10);
    expect(result.metadata?.timeoutMs).toBe(123);
    expect(result.metadata?.schemaOrgData).toEqual({ '@type': 'Article', name: 'Test Article' });
    expect(result.metadata?.metaTags).toEqual([
      { property: 'og:title', content: 'Test Article Title' },
    ]);

    // Check backward compatibility
    expect(result.wordCount).toBe(10);
  });

  it('should handle defuddle extraction failure gracefully', async () => {
    // Mock failure
    vi.resetModules();
    vi.mock('defuddle', () => ({
      default: vi.fn().mockImplementation(() => {
        throw new Error('Defuddle parsing failed');
      }),
    }));

    const { extractWithDefuddle } = await import('@tabext/extractors/defuddle');

    const result = await extractWithDefuddle();

    // Should return failure result
    expect(result.extractionMethod).toBe('failed');
    expect(result.title).toBe('');
    expect(result.content).toBe('');
    expect(result.metadata?.wordCount).toBe(0);
  });

  it('should detect code blocks and tables in defuddle content', async () => {
    // Mock with code and tables
    vi.resetModules();
    vi.mock('defuddle', () => ({
      default: vi.fn().mockImplementation((document: Document, options: any) => ({
        parse: () => ({
          title: 'Technical Article',
          author: '',
          published: '',
          content:
            '<pre>const x = 1;</pre><code>inline</code><table><tr><td>Data</td></tr></table>',
          description: '',
          favicon: '',
          image: '',
          wordCount: 5,
          parseTime: 50,
          schemaOrgData: undefined,
          metaTags: undefined,
          site: '',
        }),
      })),
    }));

    const { extractWithDefuddle } = await import('@tabext/extractors/defuddle');

    const result = await extractWithDefuddle();

    expect(result.metadata?.hasCodeBlocks).toBe(true);
    expect(result.metadata?.hasTables).toBe(true);
    expect(result.hasCode).toBe(true);
    expect(result.hasTables).toBe(true);
  });
});
