import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock visibility to avoid jsdom layout limitations
vi.mock('@tabext/utils/domUtils', () => ({
  isVisible: () => true,
}));

// Import after mocks
import { extractWithRaw } from '@/tabext/extraction/extractors/raw';

describe('Raw extractor - basic', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('removes dangerous elements and preserves tables with attributes', async () => {
    document.body.innerHTML = `
      <div id="root">
        <script>console.log('x');</script>
        <svg><rect /></svg>
        <canvas></canvas>
        <table>
          <tr><th>H1</th><th>H2</th></tr>
          <tr><td colspan="2">C</td></tr>
        </table>
        <a href="/relative/path">link</a>
        <div style="display:none"><p>hidden</p></div>
      </div>
    `;

    const result = await extractWithRaw({ root_hints: ['#root'] });

    expect(result.extractionMethod).toBe('raw');
    expect(result.metadata?.hasTables).toBe(true);

    // Table preserved with attributes
    expect(result.content).toContain('<table');
    expect(result.content).toContain('colspan="2"');

    // Dangerous elements removed
    expect(result.content).not.toContain('<script');
    expect(result.content).not.toContain('<svg');
    expect(result.content).not.toContain('<canvas');

    // Link preserved (normalization happens in orchestrator)
    expect(result.content).toContain('<a');
    expect(result.content).toContain('href="/relative/path"');
  });
});
