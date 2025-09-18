# Site-specific extractors

The orchestrator can hand control to specialised plugins before falling back to
Readability/Raw/Defuddle.  Any module in this directory that default-exports a
`SiteExtractorPlugin` is loaded eagerly via `import.meta.glob` and evaluated in
the order it is discovered.

## How it works

1. `index.ts` gathers every `./**/*.plugin.ts` file under this folder and any
   developer overrides placed in the gitignored `/site-plugins/` directory at the
   repository root.
2. When extraction runs, `trySitePlugins()` calls `plugin.matches(document)` for
   each plugin.  The first plugin that returns `true` and resolves a non-null
   `ExtractedContent` short-circuits the normal extraction flow.
3. Plugins should fail softly—return `null` on errors so the default extractor
   can continue.

## Plugin contract

```ts
export interface SiteExtractorPlugin {
  id: string;
  matches(doc: Document): boolean;
  extract(
    doc: Document,
    options: { includeLinks?: boolean }
  ): Promise<ExtractedContent | null> | ExtractedContent | null;
}
```

* `matches` runs synchronously, so keep it lightweight and avoid DOM mutation.
* `extract` may return either plain text, Markdown, or any other
  `ExtractedContent` shape.  Reuse helpers from `@core/extraction` where
  possible.

## Adding a new plugin

1. Create `your-domain.plugin.ts` alongside this README.
2. Default-export a plugin that uses structural heuristics (selectors, metadata
   attributes) rather than brittle text matching.
3. Catch unexpected exceptions and return `null` so the orchestrator falls back
   gracefully.
4. If a plugin needs to stay private, place it under `/site-plugins/` instead—
   it will load automatically but remains ignored by git.

## Tips

* Prefer `doc.location.hostname` or URL parsing to domain-match—plugins run in
  the page context and have access to a live `document`.
* Do not fetch external resources or execute script tags; extraction must remain
  self-contained for security reasons.
* When debugging, inspect `sitePlugins` in the console—it is exported from
  `index.ts` for quick introspection.
