import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';

// Resolve module paths to avoid Vite alias issues
const readabilityPath = path.resolve(
  __dirname,
  '../../../../src/content/extraction/extractors/readability.ts'
);

describe('Readability extractor - tables', () => {
  beforeEach(() => {
    vi.resetModules();
    document.title = 'Table Test';
  });

  it('sets hasTables based on final markdown and preserves table as markdown', async () => {
    // Mock Readability.parse() output by patching the class import
    await vi.doMock('@mozilla/readability', () => ({
      Readability: class {
        constructor() {}
        parse() {
          return {
            title: 'Has Table',
            content:
              '<article><h1>Header</h1><table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table></article>',
            textContent: 'Header A B 1 2',
            excerpt: 'Header...',
          };
        }
      },
    }));

    const { extractWithReadability } = (await import(readabilityPath)) as unknown as {
      extractWithReadability: (opts?: any) => Promise<any>;
    };

    const result = await extractWithReadability();
    // GFM header row exists
    expect(result.content).toMatch(/\|\s*A\s*\|\s*B\s*\|/);
    // No raw HTML table should remain
    expect(result.content).not.toMatch(/<\s*table[\s>]/i);
    expect(result.metadata?.hasTables).toBe(true); // detection after conversion
  });
});
