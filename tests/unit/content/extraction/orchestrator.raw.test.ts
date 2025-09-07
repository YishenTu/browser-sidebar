import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';
import { ExtractionMode } from '../../../../src/types/extraction';

// Resolve absolute module paths to make mocking robust with Vite's resolver
const orchestratorPath = path.resolve(
  __dirname,
  '../../../..',
  'src/content/extraction/orchestrator.ts'
);
const rawExtractorPath = path.resolve(
  __dirname,
  '../../../..',
  'src/content/extraction/extractors/raw.ts'
);

// We will mock the RAW extractor per-test with vi.doMock to avoid hoisting issues

describe('orchestrator RAW mode', () => {
  beforeEach(() => {
    vi.resetModules();
    // Ensure a predictable document for metadata
    document.title = 'Test Page';
    document.body.innerHTML = '<main><p>Body</p></main>';
  });

  it('uses RAW metadata.hasTables when provided', async () => {
    await vi.doMock(rawExtractorPath, () => ({ extractWithRaw: vi.fn() }));
    const { extractWithRaw } = (await import(rawExtractorPath)) as unknown as {
      extractWithRaw: ReturnType<typeof vi.fn>;
    };

    extractWithRaw.mockResolvedValueOnce({
      title: 'Has Tables',
      url: 'https://example.com/x',
      domain: 'example.com',
      content: '<table><tr><td>A</td></tr></table>',
      textContent: 'A',
      excerpt: 'A',
      extractedAt: Date.now(),
      extractionMethod: 'raw',
      metadata: { hasTables: true, truncated: false },
    });

    const orchestrator = await import(orchestratorPath);
    const { extractContent } = orchestrator as unknown as {
      extractContent: (opts?: any, mode?: any) => Promise<any>;
    };

    const result = await extractContent({}, ExtractionMode.RAW);
    expect(result.extractionMethod).toBe('raw');
    expect(result.metadata?.hasTables).toBe(true);
  });

  it('generates RAW excerpt from textContent (no HTML artifacts)', async () => {
    await vi.doMock(rawExtractorPath, () => ({ extractWithRaw: vi.fn() }));
    const { extractWithRaw } = (await import(rawExtractorPath)) as unknown as {
      extractWithRaw: ReturnType<typeof vi.fn>;
    };

    extractWithRaw.mockResolvedValueOnce({
      title: 'HTML Content',
      url: 'https://example.com/y',
      domain: 'example.com',
      content: '<p><b>HELLO</b> WORLD</p>',
      textContent: 'HELLO WORLD',
      excerpt: '',
      extractedAt: Date.now(),
      extractionMethod: 'raw',
      metadata: { hasTables: false, truncated: false },
    });

    const orchestrator = await import(orchestratorPath);
    const { extractContent } = orchestrator as unknown as {
      extractContent: (opts?: any, mode?: any) => Promise<any>;
    };

    const result = await extractContent({}, ExtractionMode.RAW);
    expect(result.extractionMethod).toBe('raw');
    // Excerpt should be derived from plain text, not HTML markup
    expect(result.excerpt).toContain('HELLO WORLD');
    expect(result.excerpt).not.toMatch(/<[^>]+>/);
  });
});
