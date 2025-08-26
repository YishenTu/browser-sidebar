# Tab Content Extraction MVP (Phase 1) — Current Tab

## Overview

Deliver a reliable, fast, and private extraction of the current tab’s main content when the sidebar opens. Output clean Markdown suitable for AI prompts while preserving structure (headings, lists), code blocks, and tables. Keep the design minimal and aligned with our repo’s architecture and PRD.

## Goals and Non‑Goals

### Goals (Phase 1)

- Extract current tab content when the sidebar mounts or on manual trigger.
- Convert extracted HTML to clean Markdown with tables and code fences.
- Keep performance tight: fast-path target < 500ms; hard timeout 2s.
- Enforce size budgets; avoid mutating the page; sanitize unsafe HTML.
- Provide a simple React hook for the sidebar to access extraction results.

### Non‑Goals (Future Phases)

- Multi-tab extraction and @-mention selector.
- Selection range tracking and context markers.
- Live updates (MutationObserver) and infinite scroll handling.
- Image embedding / multimodal payloads.
- Token counting and advanced truncation.

## Architecture Overview

The sidebar UI runs inside the content script context (mounted via `src/tabext/index.ts`). For MVP speed and simplicity, we’ll directly call the extraction orchestrator from the sidebar (no message round‑trip). This avoids background relays and tab targeting complexity, reduces latency, and keeps the API surface small.

We’ll still keep our MessageBus types compatible so that in Phase 1.1 we can switch to a request/response flow if needed (details included below).

### Flow (MVP: direct call)

```
Sidebar mounts
  → useContentExtraction() (hook)
    → extractContent(options)
      → Readability → Markdown | Fallback → Markdown
    ← ExtractedContent (Markdown, metadata)
```

### Flow (Phase 1.1: MessageBus option)

```
Sidebar → MessageBus(EXTRACT_CONTENT, target=content)
  Background relay (optional) → tabs.sendMessage(tabId)
Content script → extractContent → StandardResponse
Sidebar ← StandardResponse(data | error)
```

## File Structure (repo‑aligned)

```
src/
├── tabext/
│   ├── index.ts                          # Entry (sidebar inject) [EXTEND]
│   ├── contentExtractor.ts               # Orchestrator [NEW]
│   ├── domUtils.ts                       # Safe DOM utils [NEW]
│   ├── extractors/
│   │   ├── readability.ts                # Readability adapter [NEW]
│   │   └── fallback.ts                   # Heuristic extractor [NEW]
│   └── markdown/
│       └── markdownConverter.ts          # HTML → Markdown [NEW]
├── types/
│   └── extraction.ts                     # Extraction types [NEW]
└── sidebar/
    └── hooks/
        └── useContentExtraction.ts       # React hook [NEW]
```

Path aliases: import via `@tabext/*` and `@types/*` per `tsconfig.json`.

## Data Contracts

### Types

File: `src/types/extraction.ts`

```ts
export interface ExtractedContent {
  title: string;
  url: string;
  domain: string;
  content: string; // Markdown
  textContent: string; // Plain text
  excerpt?: string;
  author?: string;
  publishedDate?: string;
  extractedAt: number;
  extractionMethod: 'readability' | 'fallback' | 'failed';
  metadata?: {
    wordCount: number;
    hasCodeBlocks: boolean;
    hasTables: boolean;
    truncated?: boolean; // Size/timeout budget hit
    timeoutMs?: number; // Effective timeout used
  };
}

export interface ExtractionOptions {
  includeLinks?: boolean; // default true
  maxLength?: number; // default 200_000 chars (post-conversion)
  timeout?: number; // default 2000 ms (hard cap)
}
```

Notes:

- We intentionally omit `error` from `ExtractedContent`. Failures are surfaced via exceptions or error results in the hook.
- `maxLength` truncates Markdown output; we also enforce pre‑conversion budgets.

### Messaging (Phase 1.1 only)

- Use existing `MessageType` values: `EXTRACT_CONTENT` and `CONTENT_EXTRACTED` (or `ERROR`).
- Prefer `@extension/messaging` StandardResponse for request/response rather than ad‑hoc message payloads.

## Implementation Plan

### Step 1 — DOM Utilities

File: `src/tabext/domUtils.ts`
Responsibilities:

- Non‑mutating helpers and safe lookups.
- Skip hidden/`aria-hidden` content.
- Metadata getters (title, author/byline, published time).

Skeleton:

```ts
export function isVisible(el: Element): boolean {
  const style = window.getComputedStyle(el as HTMLElement);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  if ((el as HTMLElement).offsetParent === null && style.position !== 'fixed') return false;
  const ariaHidden = (el as HTMLElement).getAttribute('aria-hidden');
  return ariaHidden !== 'true';
}

export function getPageMetadata() {
  const byline =
    document.querySelector('meta[name="author"], [itemprop="author"]')?.getAttribute('content') ||
    undefined;
  const pub =
    document
      .querySelector('meta[property="article:published_time"], time[datetime]')
      ?.getAttribute('content') || undefined;
  return {
    title: document.title,
    url: location.href,
    domain: location.hostname,
    byline,
    publishedDate: pub,
  };
}

export function clampText(text: string, max: number): { text: string; truncated: boolean } {
  if (text.length <= max) return { text, truncated: false };
  return { text: text.slice(0, max), truncated: true };
}
```

### Step 2 — Markdown Converter

File: `src/tabext/markdown/markdownConverter.ts`
Responsibilities:

- Sanitize HTML with DOMPurify before conversion.
- Turndown + GFM for tables and code fences.
- Add language fences when detectable; otherwise default triple‑backticks.
- Honor `includeLinks` to optionally strip link wrappers.
- Expose a single `htmlToMarkdown(html: string, opts?: { includeLinks?: boolean })` function.

Skeleton:

```ts
import DOMPurify from 'dompurify';

function detectLanguageFromClass(el: Element | null): string {
  if (!el) return '';
  const strategies = [
    () => el.getAttribute('data-language'),
    () => el.getAttribute('data-lang'),
    () => el.getAttribute('class')?.match(/(?:language-|lang-)([A-Za-z0-9_+-]+)/)?.[1],
    () =>
      el
        .querySelector('code')
        ?.getAttribute('class')
        ?.match(/language-(\w+)/)?.[1],
  ];
  for (const strategy of strategies) {
    const lang = strategy();
    if (lang) return lang;
  }
  return '';
}

let turndownCache: any | null = null;
let gfmCache: any | null = null;

export async function htmlToMarkdown(
  html: string,
  opts?: { includeLinks?: boolean }
): Promise<string> {
  // Sanitize before converting
  const clean = DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });

  if (!turndownCache || !gfmCache) {
    const [{ default: TurndownService }, { gfm }] = await Promise.all([
      import('turndown'),
      import('turndown-plugin-gfm'),
    ]);
    turndownCache = TurndownService;
    gfmCache = gfm;
  }

  const td = new turndownCache({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    strongDelimiter: '**',
    emDelimiter: '_',
  });
  td.use(gfmCache);

  if (opts?.includeLinks === false) {
    td.addRule('stripLinks', {
      filter: 'a',
      replacement: content => content,
    });
  }

  // Enhance code blocks with detected language when present
  td.addRule('fencedCodeWithLang', {
    filter: (node, options) => {
      return node.nodeName === 'PRE' && (node as HTMLPreElement).querySelector('code') !== null;
    },
    replacement: (_content, node) => {
      const code = (node as HTMLElement).querySelector('code');
      const lang = detectLanguageFromClass(code) || '';
      const text = code ? code.textContent || '' : node.textContent || '';
      return `\n\`\`\`${lang}\n${text}\n\`\`\`\n`;
    },
  });

  return td.turndown(clean);
}
```

### Step 3 — Readability Extractor

File: `src/tabext/extractors/readability.ts`
Responsibilities:

- Clone the document and run Readability without mutating the page.
- Preserve classes to retain `language-*` hints for code blocks; we sanitize later.
- Return `{ contentHTML, textContent, title, byline, excerpt }`.
- Clean up cloned document after parsing to prevent memory leaks.

Skeleton:

```ts
export interface ReadabilityResult {
  html: string; // article.content
  text: string; // article.textContent
  title?: string;
  byline?: string;
  excerpt?: string;
}

export async function extractWithReadability(): Promise<ReadabilityResult | null> {
  let cloned: Document | null = null;

  try {
    const { Readability } = await import('@mozilla/readability');
    cloned = document.cloneNode(true) as Document;
    const reader = new Readability(cloned, {
      debug: false,
      keepClasses: true,
      // Use library defaults for perf; consider caps if needed in future
    });
    const article = reader.parse();
    if (!article || !article.content) return null;
    return {
      html: article.content,
      text: article.textContent || '',
      title: article.title || undefined,
      byline: article.byline || undefined,
      excerpt: article.excerpt || undefined,
    };
  } finally {
    // Explicit cleanup to help GC
    if (cloned) {
      cloned = null;
    }
  }
}
```

### Step 4 — Fallback Extractor

File: `src/tabext/extractors/fallback.ts`
Responsibilities:

- Heuristically select main region (`main`, `article`, `[role="main"]`, largest visible content block).
- Preserve headings, lists, tables, and code blocks.
- Strip scripts/styles/comments; respect visibility; stop at node/char budgets.

Skeleton:

```ts
function isVisibleElement(el: Element): boolean {
  const style = window.getComputedStyle(el as HTMLElement);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  if ((el as HTMLElement).offsetParent === null && style.position !== 'fixed') return false;
  return (el as HTMLElement).getAttribute('aria-hidden') !== 'true';
}

function scoreContainer(el: Element): number {
  if (!isVisibleElement(el)) return 0;
  const textLen = (el.textContent || '').trim().length;
  const h2 = el.querySelectorAll('h2').length;
  const h3 = el.querySelectorAll('h3').length;
  const p = el.querySelectorAll('p').length;
  return textLen + 50 * h2 + 30 * h3 + 10 * p;
}

function pickMainRoot(): Element | null {
  const candidates = [
    document.querySelector('main'),
    document.querySelector('article'),
    document.querySelector('[role="main"]'),
  ].filter(Boolean) as Element[];
  if (candidates.length) return candidates[0]!;
  // fallback: highest-scoring visible section
  let best: Element | null = null;
  let bestScore = 0;
  for (const el of Array.from(document.body.querySelectorAll('div, section'))) {
    const score = scoreContainer(el);
    if (score > bestScore) {
      best = el;
      bestScore = score;
    }
  }
  return best || document.body;
}

export function extractFallbackHTML(budgetChars = 500_000): {
  html: string;
  text: string;
  truncated: boolean;
} {
  const root = pickMainRoot();
  if (!root) return { html: '', text: '', truncated: false };

  const clone = root.cloneNode(true) as HTMLElement;
  // Remove non-content
  clone.querySelectorAll('script, style, noscript, iframe, canvas, svg').forEach(n => n.remove());
  // Drop hidden
  clone.querySelectorAll('*').forEach(el => {
    const style = window.getComputedStyle(el as HTMLElement);
    if (style.display === 'none' || style.visibility === 'hidden') el.remove();
  });

  let html = clone.innerHTML || '';
  let text = clone.textContent || '';
  let truncated = false;
  if (html.length > budgetChars) {
    html = html.slice(0, budgetChars);
    truncated = true;
  }
  if (text.length > budgetChars) {
    text = text.slice(0, budgetChars);
    truncated = true;
  }
  return { html, text, truncated };
}
```

### Step 5 — Orchestrator

File: `src/tabext/contentExtractor.ts`
Responsibilities:

- Try Readability first; fallback heuristics on null/short result.
- Sanitize and convert to Markdown; enforce size/timeout budgets.
- Compose `ExtractedContent` with metadata.

Skeleton:

````ts
import { htmlToMarkdown } from '@tabext/markdown/markdownConverter';
import { extractWithReadability } from '@tabext/extractors/readability';
import { extractFallbackHTML } from '@tabext/extractors/fallback';
import { getPageMetadata, clampText } from '@tabext/domUtils';
import type { ExtractedContent, ExtractionOptions } from '@types/extraction';

export async function extractContent(opts: ExtractionOptions = {}): Promise<ExtractedContent> {
  const started = performance.now();
  const timeoutMs = opts.timeout ?? 2000;
  const maxMarkdown = opts.maxLength ?? 200_000;

  async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    let t: number | undefined;
    return await Promise.race([
      p.finally(() => clearTimeout(t)),
      new Promise<never>((_, rej) => {
        t = window.setTimeout(() => rej(new Error(`Extraction timeout after ${ms}ms`)), ms);
      }),
    ]);
  }

  try {
    const meta = getPageMetadata();

    // Attempt Readability (with timeout)
    const readability = await withTimeout(extractWithReadability(), timeoutMs).catch(() => null);

    let method: ExtractedContent['extractionMethod'] = 'fallback';
    let html = '';
    let text = '';
    let truncatedPre = false;

    if (readability && readability.html && readability.text && readability.text.length > 200) {
      method = 'readability';
      html = readability.html;
      text = readability.text;
    } else {
      const fb = extractFallbackHTML(500_000);
      html = fb.html;
      text = fb.text;
      truncatedPre = fb.truncated;
    }

    const markdown = await withTimeout(
      htmlToMarkdown(html, { includeLinks: opts.includeLinks !== false }),
      Math.max(500, timeoutMs - 100)
    );
    const { text: mdClamped, truncated: truncatedPost } = clampText(markdown, maxMarkdown);

    const hasCodeBlocks = /```/.test(mdClamped);
    const hasTables = /(^|\n)\|[^\n]+\|/.test(mdClamped);
    const wordCount = (text || '').trim().split(/\s+/).filter(Boolean).length;

    return {
      title: readability?.title || meta.title,
      url: meta.url,
      domain: meta.domain,
      content: mdClamped,
      textContent: text,
      excerpt: readability?.excerpt,
      author: readability?.byline || meta.byline,
      publishedDate: (meta as any).publishedDate,
      extractedAt: Date.now(),
      extractionMethod: method,
      metadata: {
        wordCount,
        hasCodeBlocks,
        hasTables,
        truncated: truncatedPre || truncatedPost,
        timeoutMs,
      },
    };
  } catch (error) {
    // Fail safe
    return {
      title: document.title,
      url: location.href,
      domain: location.hostname,
      content: '',
      textContent: '',
      extractedAt: Date.now(),
      extractionMethod: 'failed',
      metadata: {
        wordCount: 0,
        hasCodeBlocks: false,
        hasTables: false,
        truncated: false,
        timeoutMs,
      },
    };
  } finally {
    const elapsed = performance.now() - started;
    void elapsed; // Optionally log in dev
  }
}
````

### Step 6 — Content Script Integration

File: `src/tabext/index.ts`

For MVP, no messaging needed. Keep current sidebar injection behavior. Optionally add a small handler for Phase 1.1 (see below) but do not wire until needed.

Phase 1.1 (optional) — add MessageBus subscription with `subscribeWithResponse`:

```ts
import { subscribeWithResponse } from '@extension/messaging';
import { extractContent } from '@tabext/contentExtractor';

subscribeWithResponse('EXTRACT_CONTENT', async payload => {
  // payload may include ExtractionOptions
  return await extractContent((payload as any) ?? {});
});
```

### Step 7 — Sidebar Hook

File: `src/sidebar/hooks/useContentExtraction.ts`

MVP: directly call orchestrator. Expose `content`, `loading`, `error`, `reextract`.

```ts
import { useCallback, useEffect, useState } from 'react';
import { extractContent } from '@tabext/contentExtractor';
import type { ExtractedContent, ExtractionOptions } from '@types/extraction';

export function useContentExtraction(auto = true) {
  const [content, setContent] = useState<ExtractedContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (options?: ExtractionOptions) => {
    setLoading(true);
    setError(null);
    try {
      const result = await extractContent(options);
      setContent(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (auto) void run();
  }, [auto, run]);

  return { content, loading, error, reextract: run } as const;
}
```

Phase 1.1 (optional): switch to MessageBus (`MessageBus.getInstance('sidebar')`) and a background relay handler. See “MessageBus Relay” below.

### Step 8 — Sidebar Integration (Preview)

File: `src/sidebar/ChatPanel.tsx` (minimal UI changes)

- Import and use the hook; show a small header preview box.
- Add a “Re‑extract” button.

Example:

```tsx
const { content, loading, error, reextract } = useContentExtraction(true);
// Render: status line + domain/title + excerpt
```

## Performance Budgets and Policies

- Fast path target: < 500ms for simple article pages (Readability → Markdown).
- Hard timeout: 2s end‑to‑end per extraction (configurable via `options.timeout`).
- Pre‑conversion budget: cap HTML/text at ~500KB (fallback); prefer library defaults for Readability.
- Post‑conversion budget: clamp Markdown to 200k chars by default.
- Avoid DOM mutations: always use clones; never alter the page.
- Dynamic imports for heavy libs to keep idle bundle light; cache loaded modules between calls.

## Security and Privacy

- Sanitize HTML before Markdown conversion using DOMPurify.
- Do not evaluate or inject scripts; libraries are bundled via Vite.
- Respect host permissions and blocked domains (PRD future work).
- No persistence in MVP; keep data in memory only.

## Dependencies

Add libraries (dev already includes DOMPurify):

```bash
npm install @mozilla/readability turndown turndown-plugin-gfm
```

## Testing Strategy

### Unit Tests (Vitest + jsdom)

- `tests/unit/tabext/domUtils.test.ts` — visibility, metadata, clamping.
- `tests/unit/tabext/markdownConverter.test.ts` — HTML→MD, code fence languages, tables.
- `tests/unit/tabext/readability.test.ts` — fixtures for simple articles; null handling.
- `tests/unit/tabext/fallback.test.ts` — main node selection, budgets, strip non‑content.

### Integration

- `tests/integration/tabext/extractContent.test.ts` — end‑to‑end on fixtures: news, blog, docs, GitHub README, StackOverflow.
- Performance tests with large synthetic DOM to verify timeouts and truncation flags.

### E2E (manual for MVP)

1. News article (BBC/CNN) — headings + paragraphs preserved.
2. Blog post (Medium/Dev.to) — fenced code with language where present.
3. Documentation page (MDN/React docs) — tables/lists preserved.
4. GitHub README — Markdown-like content stable.
5. Stack Overflow question — code and Q/A structure correctly extracted.
6. Plain landing page — fallback extraction works reasonably.
7. Timeout/size budget case — graceful failure or truncation badge.

## MessageBus Relay (Phase 1.1, optional)

If/when decoupling is desired, add a background relay handler so sidebar can call content via runtime messaging.

### Background handler

File: `src/extension/background/messageHandler.ts`

```ts
// During registry setup
registry.registerHandler(
  'EXTRACT_CONTENT',
  async (message, sender) => {
    const tabId = sender.tab?.id;
    if (!tabId) throw new Error('No tabId for EXTRACT_CONTENT');
    const response = await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, message, resp => {
        const err = chrome.runtime.lastError;
        if (err) reject(new Error(err.message));
        else resolve(resp);
      });
    });
    return response;
  },
  'Relay extraction to content'
);
```

### Content script responder

File: `src/tabext/index.ts`

```ts
subscribeWithResponse('EXTRACT_CONTENT', async payload => await extractContent(payload as any));
```

### Sidebar sender

File: `src/sidebar/hooks/useContentExtraction.ts`

```ts
import { MessageBus } from '@extension/messaging';
const bus = MessageBus.getInstance('sidebar');
const resp = await bus.sendWithRetry('EXTRACT_CONTENT', options, { target: 'content' });
if (resp.success) setContent(resp.data as ExtractedContent);
else setError(resp.error.message);
```

## Rollout and Timeline

Day 1–2: Core modules

- Types, DOM utils, Markdown converter (sanitization), Readability adapter.

Day 3–4: Orchestrator + Hook + Integration

- Fallback extractor, orchestrator with budgets/timeouts, sidebar hook + minimal UI.

Day 5: Tests + Polish

- Unit/integration tests, performance tweaks, docs, error messages.

## Acceptance Criteria

- Extracts main content for ≥ 90% typical article pages.
- Produces clean Markdown with fenced code and GFM tables.
- Enforces timeout and size budgets; sets `metadata.truncated` when clamped.
- Does not mutate the page DOM; no CSP violations.
- Adds ≤ minimal bundle weight at idle (heavy libs dynamic‑imported).

## Quality Metrics (Optional Enhancement)

Consider adding a simple content quality score for better UX:

```typescript
interface QualityMetrics {
  score: number; // 0-100
  signals: {
    hasTitle: boolean;
    wordCount: number;
    hasStructure: boolean; // headings, paragraphs
    hasCode: boolean;
  };
}

function scoreContentQuality(content: ExtractedContent): QualityMetrics {
  const signals = {
    hasTitle: !!content.title && content.title.length > 0,
    wordCount: content.metadata?.wordCount || 0,
    hasStructure: (content.content.match(/\n#{1,6} /g) || []).length > 0,
    hasCode: content.metadata?.hasCodeBlocks || false,
  };

  let score = 0;
  if (signals.hasTitle) score += 25;
  if (signals.wordCount > 300) score += 25;
  if (signals.hasStructure) score += 25;
  if (signals.hasCode) score += 25;

  return { score: Math.min(100, score), signals };
}
```

## Notes and Future Work

- Selection tracking with DOM Range markers.
- MutationObserver for SPA updates.
- Image handling for multimodal providers.
- Caching with TTL; token counting for provider constraints.
- Structured data extraction (JSON-LD, OpenGraph).
- Enhanced CSP handling with manifest V3 world isolation.
