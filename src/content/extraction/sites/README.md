# Site-Specific Extraction Plugins

This folder hosts site extractor plugins that run before Readability/Raw/Defuddle.
Plugins are small modules that recognize a domain and return an `ExtractedContent` result.

How It Works

- The registry auto-loads all `*.plugin.ts` files under this folder.
- At runtime, Readability calls `trySitePlugins(document, options)`; the first matching plugin wins.
- If no plugin handles the page, normal Readability (or the chosen mode) continues.

Add/Remove a Plugin (repo-managed)

1. Create `your-site.plugin.ts` in this folder.
2. Default-export a `SiteExtractorPlugin`:

```ts
import type { SiteExtractorPlugin } from './types';
import type { ExtractedContent } from '@/types/extraction';

const plugin: SiteExtractorPlugin = {
  id: 'example',
  matches: (doc: Document) => doc.location.hostname.endsWith('example.com'),
  extract: async (doc, options): Promise<ExtractedContent | null> => {
    // return null to defer to normal extraction
    // or return an ExtractedContent with markdown/textContent/etc.
    return null;
  },
};

export default plugin;
```

User (local) Plugins (gitignored)

- Keep private plugins in `site-plugins/` (repo root). This directory is gitignored.
- The registry auto-loads `site-plugins/**/*.plugin.ts` via the `@site` alias.
- You can place any site-specific tests under `site-plugins/` as well (they will be ignored by git). If you want to run them locally, point Vitest to that path explicitly.

Notes

- Keep plugins focused and fail-soft: catch errors and return `null` to fall back.
- Do not execute scripts or fetch remote data from plugins.
- Prefer structural selectors; avoid hard-coding language-specific keywords.
