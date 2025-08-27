# Content Extraction Refactoring Plan v2.0

## Executive Summary

Based on comprehensive analysis of Obsidian Web Clipper's battle-tested extraction system, we're pivoting from a custom "subtractive" approach to leveraging the proven **Defuddle library** combined with intelligent enhancement layers and a pragmatic **Readability fallback**. Defuddle uses heuristic algorithms similar to Mozilla Readability but with improved strategies for content preservation; when signals are weak (low word count, poor heading structure), we will automatically fall back to Readability and pick the better result via quality gates.

## Research Findings: Obsidian Web Clipper Deep Dive

### Analysis 1: Code Architecture Study

Our direct analysis of the Obsidian Web Clipper source code revealed:

#### Core Extraction Strategy
1. **Defuddle as Primary Engine**:
   - Uses DOM parsing, not regex matching for content extraction
   - Version 0.6.6 is currently used in production
   - More "forgiving" than Readability - preserves uncertain content rather than aggressively removing it
   - Returns comprehensive extraction results including title, author, published date, word count, parse time

2. **Multi-Stage Processing Pipeline**:
   ```javascript
   // Stage 1: Defuddle extraction
   const defuddled = new Defuddle(document, { url: document.URL }).parse();
   
   // Stage 2: DOM cleaning
   doc.querySelectorAll('script, style').forEach(el => el.remove());
   doc.querySelectorAll('*').forEach(el => el.removeAttribute('style'));
   
   // Stage 3: URL normalization
   // Convert all relative URLs to absolute for offline viewing
   
   // Stage 4: Markdown conversion
   const markdown = createMarkdownContent(content, currentUrl);
   ```

3. **Selection Handling**:
   - Detects and prioritizes user-selected text
   - Maintains selection in both HTML and Markdown formats
   - Can operate in selection-only mode or use selection to enhance full extraction

4. **Metadata Extraction**:
   - Comprehensive schema.org JSON-LD parsing
   - Meta tags captured for internal metadata (no templating)
   - Open Graph and Twitter Card support
   - Automatic favicon and main image detection

5. [Removed] Template Variable System (Obsidian-specific, not adopted in our project)

### Analysis 2: Extraction Philosophy Study (Chinese Analysis)

The comprehensive Chinese analysis revealed additional insights:

#### Content Identification Strategy

1. **Heuristic Algorithm Details**:
   - **DOM Tree Analysis**: Complete traversal of DOM structure, not just pattern matching
   - **Mobile CSS Detection**: Ingeniously uses mobile viewport styles to identify non-essential content
   - **Conservative Removal**: "宽松" (forgiving) strategy - when uncertain, preserve the content
   - **Special Content Preservation**: Maintains footnotes, math formulas, code blocks with formatting

2. **Noise Removal Approach**:
   - **Universal Patterns**: No site-specific hardcoding for Reddit, Medium, Zhihu, etc.
   - **Common Noise Elements**: Navigation, sidebars, footers, ads, cookie banners
   - **Smart Detection**: Elements hidden on mobile (display:none in mobile CSS) are likely non-essential
   - **Preserved Elements**: Comments at article end, footnotes, citations are kept

3. **Quality Over Quantity**:
   - Focuses on semantic HTML structure preservation
   - Prioritizes readability and content integrity
   - Handles special content types (tables, code, math) with dedicated rules

#### Technical Implementation Details

1. **No Site-Specific Logic**:
   - Obsidian doesn't maintain site-specific extraction rules
   - One universal algorithm works across all websites
   - Obsidian relies on user templates for customization (we will not adopt a template system)

2. **UI Architecture**:
   - Uses iframe for sidebar isolation (not Shadow DOM)
   - Content extraction happens in page context
   - Clean separation prevents CSS conflicts
   - Resizable, draggable interface

3. **Cleaning Pipeline Order**:
   ```javascript
   1. Remove <script> and <style> elements (security)
   2. Remove hidden elements using computed styles (before stripping) when needed
   3. Strip all inline style attributes (cleanliness)
   4. Convert relative URLs to absolute (offline support)
   5. Clean empty paragraphs and decorative elements
   ```
   Notes:
   - Hidden-element detection must happen before removing inline styles or via the extractor’s own heuristics; otherwise style-based visibility signals are lost.

## Refined Architecture Based on Research

### Core Components

```typescript
interface ExtractionSystem {
  core: DefuddleExtractor;         // Proven extraction engine
  enhancers: EnhancementPipeline;  // Additional extraction layers
  cleaner: ContentCleaner;          // HTML sanitization
  converter: MarkdownConverter;     // Turndown-based conversion
  modes: ExtractionMode[];          // User-selectable modes
  metrics: QualityMetrics;          // Extraction quality tracking
}
```

### 1. Defuddle Integration (Core Engine)

```typescript
import Defuddle from 'defuddle';

class DefuddleExtractor {
  extract(options?: DefuddleOptions): ExtractedContent {
    // Defuddle's "forgiving" strategy preserves uncertain content
    const defuddled = new Defuddle(document, {
      url: document.URL,
      debug: false
    }).parse();

    return {
      // Core content from Defuddle
      title: defuddled.title,           // From <title>, og:title, or <h1>
      author: defuddled.author,         // Extracted from meta or structured data
      publishedDate: defuddled.published,
      content: defuddled.content,       // Main article HTML after noise removal
      description: defuddled.description,
      favicon: defuddled.favicon,
      image: defuddled.image,           // Main article image
      wordCount: defuddled.wordCount,
      parseTime: defuddled.parseTime,
      
      // Metadata - captured for internal use (no templating)
      schemaOrgData: defuddled.schemaOrgData,  // JSON-LD structured data
      metaTags: defuddled.metaTags || [],      // All meta tags (internal use)
      
      // Additional context
      domain: this.getDomain(document.URL),
      site: defuddled.site,             // Site name from meta
      extractionMethod: 'defuddle'
    };
  }
}
```

### 1.1 Fallback Extractor + Quality Gates

```typescript
import { Readability } from 'mozilla-readability';

class FallbackExtractor {
  chooseBest(defuddle: ExtractedContent, originalDoc: Document): ExtractedContent {
    // Gate on measurable quality signals
    const defScore = this.score(defuddle);

    const cloned = originalDoc.cloneNode(true) as Document;
    const readability = new Readability(cloned).parse();
    const readContent: ExtractedContent = readability ? {
      title: readability.title,
      author: '',
      publishedDate: '',
      content: readability.content,
      description: '',
      favicon: '',
      image: '',
      wordCount: readability.textContent?.split(/\s+/).length || 0,
      parseTime: 0,
      schemaOrgData: {},
      metaTags: [],
      domain: this.getDomain(originalDoc.URL),
      site: '',
      extractionMethod: 'readability'
    } : defuddle;

    const readScore = this.score(readContent);
    return readScore > defScore ? readContent : defuddle;
  }

  private score(ec: ExtractedContent): number {
    const headings = (ec.content.match(/<h[2-6][^>]*>/g) || []).length;
    const length = ec.wordCount || 0;
    return headings * 50 + Math.min(length, 3000); // simple, tunable heuristic
  }
}
```

### 2. Content Enhancement Pipeline

```typescript
class EnhancementPipeline {
  private enhancers = [
    new SelectionEnhancer(),      // User-selected text priority
    new CommentEnhancer(),        // Detect & preserve discussions
    new CodeBlockEnhancer(),      // Preserve code with syntax
    new MediaEnhancer(),          // Images, videos, embeds
    new TableEnhancer(),          // Data tables preservation
    new SchemaEnhancer(),         // schema.org structured data
    new FootnoteEnhancer()        // Preserve footnotes and citations
  ];

  enhance(baseContent: ExtractedContent, mode: ExtractionMode): EnhancedContent {
    let enhanced = baseContent;
    
    for (const enhancer of this.enhancers) {
      if (enhancer.appliesTo(mode)) {
        enhanced = enhancer.process(enhanced);
      }
    }
    
    return enhanced;
  }
}
```

### 3. HTML Cleaning Pipeline (Following Obsidian's Order)

```typescript
class ContentCleaner {
  clean(html: string): string {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Step 1: Security - Remove all scripts (keep JSON-LD) and stylesheets
    doc.querySelectorAll('script:not([type="application/ld+json"])').forEach(el => el.remove());
    doc.querySelectorAll('link[rel="stylesheet"], link[as="style"], style').forEach(el => el.remove());
    
    // Step 2: Cleanliness - Remove all inline styles
    doc.querySelectorAll('*').forEach(el => {
      el.removeAttribute('style');
    });
    
    // Step 3: Offline Support - Normalize URLs to absolute
    this.normalizeUrls(doc, new URL(document.URL));
    
    // Step 4: Remove now-empty decorative elements
    
    // Step 5: Clean empty elements
    doc.querySelectorAll('p, div, span').forEach(el => {
      if (!el.textContent?.trim() && !el.querySelector('img, video, iframe')) {
        el.remove();
      }
    });
    
    return doc.body.innerHTML;
  }

  private normalizeUrls(doc: Document, baseUrl: URL): void {
    // Critical for offline viewing - convert all relative to absolute
    doc.querySelectorAll('[src], [href], [srcset]').forEach(element => {
      ['src', 'href', 'srcset'].forEach(attr => {
        const value = element.getAttribute(attr);
        if (!value) return;
        
        if (attr === 'srcset') {
          // Handle responsive images
          const normalized = value.split(',').map(src => {
            const [url, size] = src.trim().split(' ');
            try {
              return `${new URL(url, baseUrl).href}${size ? ' ' + size : ''}`;
            } catch {
              return src;
            }
          }).join(', ');
          element.setAttribute(attr, normalized);
        } else {
          const proto = value.split(':')[0];
          const isAbsoluteHttp = value.startsWith('http') || value.startsWith('//');
          const isDataOrHash = value.startsWith('data:') || value.startsWith('#');
          if (!isAbsoluteHttp && !isDataOrHash) {
            try {
              element.setAttribute(attr, new URL(value, baseUrl).href);
            } catch {}
          } else if (!['http', 'https', 'data'].includes(proto)) {
            // Handle extension and custom protocols by attempting to coerce
            try {
              const parts = value.split('://');
              if (parts.length > 1) {
                const rest = parts[1];
                const looksLikeDomain = /\w+\.[\w.-]+/.test(rest.split('/')[0]);
                if (looksLikeDomain) {
                  element.setAttribute(attr, `${baseUrl.protocol}//${rest}`);
                }
              }
            } catch {}
          }
        }
      });
    });
  }
}
```

### 4. Advanced Markdown Conversion

```typescript
import TurndownService from 'turndown';
import * as turndownPluginGfm from 'turndown-plugin-gfm';

class MarkdownConverter {
  private turndown: TurndownService;

  constructor() {
    this.turndown = new TurndownService({
      headingStyle: 'atx',
      hr: '---',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
      emDelimiter: '*',
      strongDelimiter: '**',
      preformattedCode: true
    });

    // Add GFM support (tables, strikethrough, task lists)
    this.turndown.use(turndownPluginGfm.gfm);

    // Keep important elements (align with Obsidian + math/svg)
    this.turndown.keep(['iframe', 'video', 'audio', 'sup', 'sub', 'mark', 'svg', 'math']);
    
    // Remove unwanted elements
    this.turndown.remove(['script', 'style', 'button']);

    // Custom rules for special content
    this.addCustomRules();
  }

  private addCustomRules(): void {
    // Preserve figures with captions
    this.turndown.addRule('figure', {
      filter: 'figure',
      replacement: (content, node) => {
        const figure = node as HTMLElement;
        const img = figure.querySelector('img');
        const caption = figure.querySelector('figcaption');
        
        if (!img) return content;
        
        const alt = img.alt || '';
        const src = img.src || '';
        const captionText = caption ? `\n*${caption.textContent}*` : '';
        
        return `\n\n![${alt}](${src})${captionText}\n\n`;
      }
    });

    // Handle footnotes properly
    this.turndown.addRule('footnote', {
      filter: (node) => {
        return node.nodeName === 'SUP' && 
               node.querySelector('a[href^="#fn"]') !== null;
      },
      replacement: (content, node) => {
        const link = node.querySelector('a[href^="#fn"]');
        const id = link?.getAttribute('href')?.replace('#', '');
        return `[^${id}]`;
      }
    });

    // Convert common embeds to canonical links (YouTube, Twitter/X)
    this.turndown.addRule('embedToMarkdown', {
      filter: (node: Node) => node instanceof HTMLIFrameElement && !!node.getAttribute('src'),
      replacement: (content, node: Node) => {
        if (!(node instanceof HTMLIFrameElement)) return content;
        const src = node.getAttribute('src') || '';
        const yt = src.match(/(?:youtube\.com|youtu\.be)\/(?:embed\/|watch\?v=)?([a-zA-Z0-9_-]+)/);
        if (yt?.[1]) return `![](https://www.youtube.com/watch?v=${yt[1]})`;
        const tw = src.match(/(?:twitter\.com|x\.com)\/.*?(?:status|statuses)\/(\d+)/);
        if (tw?.[1]) return `![](https://x.com/i/status/${tw[1]})`;
        return content;
      }
    });

    // KaTeX/MathML to LaTeX (outline only; actual implementation uses mathml-to-latex)
    // Also remove empty links and compress newlines post-process.
  }
}
```

## Extraction Modes (Refined)

### 1. Smart Mode (Default)
- Uses Defuddle's "forgiving" extraction
- Preserves footnotes, math, code blocks
- Removes only confirmed noise (nav, ads, overlays)
- Leverages mobile CSS detection for smarter filtering

### 2. Article Mode
- Traditional article extraction
- Similar to browser "reader mode"
- Focuses on main content, removes comments

### 3. Selection Mode
- Prioritizes user-selected content
- Maintains formatting and context
- Can extract just selection or enhance full extraction

### 4. Comprehensive Mode
- Includes comments and discussions
- Preserves Q&A sections and reviews
- Maximum content preservation

### 5. Minimal Mode
- Plain text only, no HTML processing
- Fastest performance (<100ms)
- For quick preview or API limits

## Key Insights from Research

### Defuddle's "Forgiving" Philosophy
- **Conservative Removal**: When uncertain, keep the content
- **Mobile CSS Intelligence**: Uses mobile styles to identify non-essential elements
- **No Site-Specific Rules**: Universal algorithm works everywhere
- **Special Content Aware**: Preserves footnotes, math, code automatically

### Obsidian's Success Factors
1. **Simplicity**: One algorithm for all sites
2. **Quality**: Focus on semantic HTML preservation
3. **Security**: Automatic script/style removal
4. **Offline Support**: URL normalization is critical
5. **Flexibility**: Obsidian offers a template system (not applicable to our project)

### What We Should Adopt
1. **Use Defuddle**: Don't reinvent the wheel
2. **Fallback Extractor**: Add Readability with quality gates when Defuddle is weak
3. **Follow Cleaning Order**: Security → Visibility checks → Cleanliness → Offline Support
4. **Shadow DOM UI**: Keep our Shadow DOM sidebar (consistent with our architecture); isolate extraction in content context
5. **No Site-Specific Code**: Universal patterns only

### What We Can Enhance
1. **Comment Detection**: Our enhancer can add better comment preservation
2. **Quality Metrics**: Add extraction quality scoring
3. **Multiple Modes**: Offer more extraction modes than Obsidian
4. **Real-time Preview**: Show extraction results live
5. **Performance Monitoring**: Track and optimize extraction speed

### Multi‑Tab Aggregation (New)
- Maintain per‑tab `ExtractedTabContext` with sanitized HTML, markdown, and metadata
- Dedupe by canonical URL; group by domain/topic; allow user to select which tabs feed the prompt
- Token‑aware merge: score paragraphs by heading proximity and density; keep top N tokens per tab
- Show quick per‑tab stats (wordCount, extractionMethod, parseTime) for troubleshooting

### Testing Strategy (New)
- Add fixtures for news/blog/docs/arXiv/e‑commerce pages (JSDOM)
- Assertions: extractor choice under gates, URL normalization correctness, markdown rules coverage, selection‑first behavior
- Performance budgets: parse+clean+convert under <500ms typical on CI
- Coverage >90% per repository guidelines

## Implementation Roadmap

### Phase 1: Core Integration (Days 1-3)
```bash
npm install defuddle turndown turndown-plugin-gfm
```
- [ ] Integrate Defuddle library
- [ ] Implement ContentCleaner with proper order
- [ ] Setup basic extraction pipeline
- [ ] Add extraction mode selector to UI

### Phase 1.5: Fallback + Gates (Days 3-4)
- [ ] Add Readability fallback and heuristic scoring
- [ ] Switch to best candidate (method flag + metrics)

### Phase 2: Enhancement Layer (Days 4-6)
- [ ] Implement SelectionEnhancer
- [ ] Implement CommentEnhancer
- [ ] Implement FootnoteEnhancer
- [ ] Add URL normalization

### Phase 3: Markdown Conversion (Days 7-9)
- [ ] Setup Turndown with GFM plugin
- [ ] Add custom rules for figures, footnotes
- [ ] Handle code blocks with language detection
- [ ] Test markdown quality

### Phase 4: Quality & Polish (Days 10-12)
- [ ] Add extraction metrics
- [ ] Add extraction preview UI
- [ ] Performance optimization

### Phase 5: Multi‑Tab Context (Days 12-14)
- [ ] Store per‑tab contexts in state
- [ ] Aggregator with token‑aware merge and dedupe
- [ ] Minimal UI to pick tabs and preview merged context

## Success Metrics

- **Extraction Quality**: >90% meaningful content captured
- **Performance**: <500ms for typical pages
- **Universal Coverage**: Works on all sites without configuration
- **Comment Support**: 100% of discussions preserved in Comprehensive mode
- **User Satisfaction**: Fewer complaints about missing content

## Current Implementation Analysis

### Existing Architecture Review

Based on analysis of `src/tabext/`, our current implementation has:

#### Strengths to Keep:
1. **Modular Extractor System**: Already have separate extractors (readability, fallback, comprehensive)
2. **Comprehensive Mode**: Already attempts to preserve all content (similar philosophy to our target)
3. **Fallback Logic**: Good error handling and fallback chain
4. **Markdown Conversion**: Already using a markdown converter
5. **Performance Monitoring**: Extraction time tracking already in place
6. **Content Feature Detection**: Already detecting code blocks, tables, word count

#### Weaknesses to Address:
1. **No Defuddle Integration**: Using Mozilla Readability as primary, not Defuddle
2. **Comprehensive Extractor Issues**: 
   - Over-aggressive noise removal (removing too much)
   - No mobile CSS detection
   - No "forgiving" strategy
3. **No URL Normalization**: Missing critical offline support
4. **No Schema.org Extraction**: Missing rich metadata

6. **Limited Markdown Rules**: Missing custom rules for figures, footnotes, embeds

## Implementation Decision: Incremental Refactor

**Decision Date**: 2025-08-27  
**Approach Selected**: Incremental Refactor (within existing `src/tabext` structure)

### Rationale for Incremental Refactor
1. **Minimize Disruption**: Keep current `contentExtractor.ts` and extractors; add Defuddle alongside.
2. **Reuse Proven Pieces**: Leverage our `contentQuality.ts`, `markdown/markdownConverter.ts`, and dynamic imports.
3. **Faster Adoption**: Ship improvements step-by-step; keep Comprehensive mode intact for forums/Q&A.
4. **Testing Continuity**: Extend current tests rather than a wholesale rewrite.

## Implementation Plan: Targeted Changes

### Phase 1: Setup & Core (Days 1–2)

1. Install dependencies
```bash
npm install defuddle turndown turndown-plugin-gfm
npm install --save-dev @types/turndown
```

2. Add Defuddle extractor
```text
File: src/tabext/extractors/defuddle.ts
- Defuddle-first extraction returning { title, author, publishedDate, contentHtml, description, favicon, image, wordCount, parseTime, schemaOrgData, metaTags, site, extractionMethod: 'defuddle' }
```

3. Wire Readability fallback with gates
```text
File: src/tabext/contentExtractor.ts
- Import extractWithDefuddle()
- Use scoreContentQuality() (from src/tabext/contentQuality.ts) to choose between Defuddle and Readability when in SMART/ARTICLE mode
- Log extractionMethod and scores
```

### Phase 2: Cleaning & URL Normalization (Days 3–4)

1. Add URL normalization utility
```text
File: src/tabext/domUtils.ts (or new src/tabext/cleaners/ContentCleaner.ts)
- normalize href/src/srcset to absolute, handle // URLs and extension protocols
- Ensure visibility checks (if used) happen before stripping inline styles
```

2. Adjust cleaning order in pipeline
```text
Order: remove scripts (keep JSON-LD) + stylesheets → optional visibility checks → strip inline styles → normalize URLs → remove empty/decorative nodes
```

### Phase 3: Markdown Rules (Days 5–6)

1. Enhance existing converter (do not replace)
```text
File: src/tabext/markdown/markdownConverter.ts
- Add rules: figures+captions, footnotes, common embeds (YouTube/X), math hooks
- Keep DOMPurify + dynamic imports, includeLinks option, whitespace cleanup
```

### Phase 4: Selection & Enhancers (Days 7–8)

1. Capture selection
```text
File: src/tabext/contentExtractor.ts
- If window.getSelection() has HTML, capture and pass into pipeline
```

2. Add SelectionEnhancer
```text
File: src/tabext/enhancers/SelectionEnhancer.ts
- Prioritize selection in output (and generate selection markdown via htmlToMarkdown)
```

### Phase 5: Metrics & Multi‑Tab (Days 9–11)

1. Metrics
```text
Reuse src/tabext/contentQuality.ts and/or src/tabext/metrics/extractionMetrics.ts for quality gates and diagnostics
```

2. Multi‑tab context (optional for Phase 5)
```text
Persist per‑tab contexts in data store; token‑aware merge; simple UI to choose tabs
```

### Phase 4–5: Cleaning & Markdown Conversion (Covered Above)

Refer to Phase 2 (Cleaning & URL Normalization) and Phase 3 (Markdown Rules). We will:
- Implement cleaning in `src/tabext/domUtils.ts` or `src/tabext/cleaners/ContentCleaner.ts` (no v2 tree)
- Extend `src/tabext/markdown/markdownConverter.ts` with custom rules; keep dynamic import and sanitization
    // Figures with captions
    // Footnotes
    // YouTube/Twitter embeds
    // Code blocks with language
    // Math formulas
  }
}
```

### Phase 6: Integration & Testing (Days 12–14)

1. UI integration
- Add extraction mode selector in sidebar (Article/Comprehensive/Minimal)
- Display extractor used + quality score for diagnostics

2. Test suite
```text
Files under tests/tabext/
- defuddle.test.ts (Defuddle integration contract)
- quality-gates.test.ts (gate decisions using contentQuality)
- url-normalization.test.ts (href/src/srcset, protocol-relative)
- markdown-rules.test.ts (figures, footnotes, embeds)
- fixtures/ (reddit, stackoverflow, medium, arxiv)
```

3. Cleanup
- No deletions of existing modules; keep Comprehensive extractor
- Incrementally refactor as needed after green tests

### Files to Keep
- `src/tabext/domUtils.ts` - Enhance with URL normalization
- `src/tabext/extractors/fallback.ts` - Last resort
- `src/types/extraction.ts` - Extend only if we add selection fields later

### Files To Not Create/Replace
- No `extractors-v2/*` tree, no `contentExtractorV2.ts`
- Do not replace `markdown/markdownConverter.ts`; extend it

## Complete Implementation Schedule

### Week 1 (Days 1–7)
- Day 1–2: Core integration
  - Install dependencies (defuddle, turndown + gfm)
  - Add `src/tabext/extractors/defuddle.ts`
  - Wire Defuddle + Readability gates in `contentExtractor.ts` using `contentQuality.ts`
- Day 3–4: Cleaning & URLs
  - Add URL normalization util (domUtils or ContentCleaner)
  - Integrate cleaning order into pipeline
- Day 5: Markdown rules
  - Extend `markdown/markdownConverter.ts` with figures, footnotes, embeds, math hooks
- Day 6: Selection
  - Capture selection in `contentExtractor.ts`
  - Add `SelectionEnhancer.ts` and wire it
- Day 7: Tests
  - Add fixtures and unit tests for gates, URL normalization, markdown rules

### Week 2 (Days 8–14)
- Day 8: Optional tuning
  - Adjust Comprehensive extractor selectors as needed
- Day 9–10: Optional schema/meta helpers
  - Add JSON-LD/meta extraction helpers for internal use (no templating)
- Day 11: Optional multi‑tab scaffolding
  - Store per‑tab contexts, token‑aware merge
- Day 12–13: UI integration
  - Mode selector, diagnostics (method + score)
- Day 14: Performance/cleanup
  - Verify budgets, minor refactors; no deletions of core modules


## Success Criteria Checklist

### Functionality
- [ ] Defuddle extracts content successfully
- [ ] Quality gates choose best extractor
- [ ] URL normalization works for offline viewing
- [ ] Schema.org data extracted
- [ ] Comments preserved in comprehensive mode
- [ ] Footnotes handled correctly
- [ ] YouTube/Twitter embeds converted
- [ ] Selection prioritization works

### Performance
- [ ] Extraction under 500ms for typical pages
- [ ] Memory usage reasonable (<100MB)
- [ ] No blocking of main thread
- [ ] Smooth streaming for large pages

### Quality
- [ ] >90% meaningful content captured
- [ ] Markdown output clean and readable
- [ ] No broken images/links after normalization
- [ ] Consistent results across browsers

### Compatibility
- [ ] Works on all major websites
- [ ] Handles SPAs gracefully
- [ ] No site-specific code required
- [ ] Fallback chain always produces output

## Conclusion

By adopting Obsidian's proven approach with Defuddle at its core, enhanced by our custom pipeline for comments and special content, we can achieve superior extraction quality with less development effort. The key is to leverage what works (Defuddle's forgiving extraction) while adding value through our enhancement layers and multiple extraction modes.

The current implementation provides a good foundation but needs fundamental changes to match Obsidian's quality. A complete rewrite is recommended for cleaner architecture, though incremental migration is possible if disruption needs to be minimized.
