# Content Module

The content script runs in the page context. It injects the React sidebar, coordinates extraction, and routes typed messages between the page, background service worker, and UI.

## Overview

- Shadow-DOM sidebar injection and lifecycle management
- Domain-aware content extraction (Readability default with Raw/Defuddle/Selection fallbacks)
- Site-specific extractor plugins (pre-flight before Readability/Raw/Defuddle)
- Typed message routing with timeout safeguards
- DOM patching to safely resolve extension assets

## Structure

```
content/
├─ index.ts                 # Entry point, bootstraps sidebar + messaging
├─ core/
│  ├─ documentPatcher.ts   # Rewrites asset URLs for extension context
│  ├─ messageHandler.ts    # Handles background → content messages
│  └─ sidebarController.ts # Mount/unmount Shadow-DOM React app
├─ extraction/
│  ├─ orchestrator.ts      # Mode selection, timeout enforcement, domain rules
│  ├─ extractors/
│  │  ├─ readability.ts    # Reader-friendly HTML → Markdown (default)
│  │  ├─ raw.ts            # Raw HTML capture (tables / structured data)
│  │  └─ defuddle.ts       # Defuddle-backed article fallback
│  ├─ analyzers/           # Content + metadata analyzers
│  └─ sites/               # Site-specific plugins loaded ahead of extractors
└─ utils/
   ├─ domUtils.ts          # Safe DOM operations in content world
   └─ tabUtils.ts          # Tab helpers shared with background
```

## Initialization Flow

```
1. documentPatcher patches element creation/href handling
2. sidebarController mounts Shadow DOM root
3. messageHandler registers listeners + health checks
4. Content script notifies background (CONTENT_READY)
```

## Extraction Orchestrator

`extraction/orchestrator.ts` coordinates every extraction request:

1. Validates options (timeout, max length, link inclusion)
2. Resolves effective mode:
   - Explicit `mode` parameter from caller
   - Domain rule from saved settings (`chrome.storage.sync` → fallback to `local`)
   - Module-level default (`ExtractionMode.READABILITY` by default)
3. Runs site plugins (`extraction/sites/**/*.plugin.ts`) — first plugin returning data wins
4. Dynamically imports the correct extractor (cached between runs)
5. Executes extractor with timeout protection (Promise.race)
6. Runs analyzers (tables, code blocks, excerpts, metadata)
7. Returns structured `ExtractedContent`

### Extraction Modes

| Mode        | Best for               | Output                | Notes                                   |
| ----------- | ---------------------- | --------------------- | --------------------------------------- |
| Readability | Articles, blog posts   | Markdown + metadata   | Default, sanitizes HTML via Readability |
| Raw         | Tables, dashboards     | HTML + plaintext      | Skips Markdown for token-efficiency     |
| Defuddle    | Stubborn article pages | Markdown + metadata   | Uses `defuddle` fallback heuristics     |
| Selection   | User text selections   | Raw selection content | Triggered from sidebar selection flow   |

### Code Snippets

```ts
import { extractContent, setDefaultExtractionMode } from '@content/extraction/orchestrator';
import { ExtractionMode } from '@types/extraction';

// Set runtime default (e.g., testing)
setDefaultExtractionMode(ExtractionMode.RAW);

// Extract using domain-aware default (Readability unless settings override)
const content = await extractContent({ timeout: 4000, includeLinks: true });

// Force Defuddle and ignore cache
const defuddleContent = await extractContent({ forceRefresh: true }, ExtractionMode.DEFUDDLE);
```

## Messaging

- Responds to background `EXTRACT_TAB_CONTENT` requests with structured payloads.
- Emits `CONTENT_READY` once the script is ready.
- Supports `TOGGLE_SIDEBAR`, `CLOSE_SIDEBAR`, `PING`, and `PING`/`PONG` keep-alives.

```ts
import { createMessage } from '@types/messages';
import { sendMessage } from '@platform/chrome/runtime';

const ready = createMessage({
  type: 'CONTENT_READY',
  source: 'content',
  target: 'background',
  payload: { status: 'content-script-ready', url: location.href, title: document.title },
});

sendMessage(ready);
```

## Error Handling

- Per-request timeouts (default 2000 ms) with explicit errors (`Extraction timeout after X ms`).
- Extractors catch and normalize DOM errors (`ExtractionErrorType.EXTRACTION_DOM_ERROR`).
- Queue retry logic lives in the background `ExtractionQueue`; content script remains stateless.

## Performance Notes

- Dynamic imports cached after first load (Readability/Raw/Defuddle modules).
- Site plugin registry precomputed on first extraction.
- Timeout checks short-circuit long DOM traversals.
- Raw mode skips Markdown conversion for large tables.

## Testing

Use Vitest to exercise extraction and DOM helpers:

```bash
npm test -- tests/unit/content/extraction
npm test -- tests/unit/content/core
npm test -- tests/integration/content
```

Mock DOM APIs with jsdom; keep plugins defensive (return `null` on failure so the orchestrator can fall back).

## Security

- Never executes page scripts; only reads from DOM.
- Sanitizes Readability output via Markdown conversion.
- Respects restricted URL rules (`shared/utils/restrictedUrls`).
- Honors Chrome's isolated world — no direct access to page JS closures.
