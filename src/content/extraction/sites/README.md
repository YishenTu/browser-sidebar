# Site-Specific Extraction Plugins

Plugins in this folder run _before_ the standard Readability/Raw/Defuddle pipeline. They let you short-circuit the normal extractor when a site needs custom markup handling (paywalls, heavy scripting, etc.). Selection mode bypasses plugins entirely.

## How It Works

1. The registry glob-imports every `*.plugin.ts` file in this folder.
2. `trySitePlugins(document, options)` executes each plugin in registration order.
3. The first plugin that returns an `ExtractedContent` wins; returning `null` defers to the main extractor.
4. If no plugin handles the page, the orchestrator falls back to Readability (or the selected mode) as usual.

## Creating a Plugin

```ts
import type { SiteExtractorPlugin } from './types';
import type { ExtractedContent } from '@/types/extraction';

const plugin: SiteExtractorPlugin = {
  id: 'example',
  matches: doc => doc.location.hostname.endsWith('example.com'),
  async extract(doc, options): Promise<ExtractedContent | null> {
    // Custom extraction logic...
    return null; // return null to fall back to standard extraction
  },
};

export default plugin;
```

## Local (Git-Ignored) Plugins

- Keep private plugins under `site-plugins/` in the repo root (gitignored).
- They are auto-loaded via the `@site` alias.
- Local tests can live alongside your plugins if you target them explicitly with Vitest.

## Guidelines

- Fail soft: catch errors and return `null` so the main extractor can continue.
- Avoid network requests or executing page scripts.
- Prefer structural selectors or metadata over brittle text matching.
- Remember that Selection mode bypasses plugins — keep plugins scoped to Readability/Raw/Defuddle use cases.
