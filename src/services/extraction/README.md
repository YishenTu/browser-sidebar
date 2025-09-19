# Extraction Service

High-level wrapper that lets the sidebar (or other callers) request tab content through the background script. It adds retry logic, error typing, and consistent `TabContent` formatting on top of the content script orchestrator.

## Features

- **Current tab extraction** — Auto-load the active tab when the sidebar mounts.
- **Multi-tab extraction** — Load other tabs on demand (used by @-mentions) with duplicate prevention.
- **Mode control** — Readability by default; explicitly request Raw, Defuddle, or Selection.
- **Retry handling** — Exponential backoff on transient failures (configurable).
- **Error classification** — Strongly typed `ExtractionErrorType` values.
- **Background messaging** — Uses the service worker queue/cache for consistency.

## Quick Usage

```ts
import { ExtractionService, extractCurrentTab, extractTabs } from '@services/extraction';
import { ExtractionMode } from '@types/extraction';

// Instance (e.g., in a hook)
const service = new ExtractionService('sidebar');
const current = await service.extractCurrentTab({
  mode: ExtractionMode.READABILITY,
  forceRefresh: true,
});

// Convenience helpers
await extractCurrentTab({ mode: ExtractionMode.SELECTION });
await extractTabs([tabIdA, tabIdB], { mode: ExtractionMode.RAW, maxRetries: 2 });
```

## Options

`ServiceExtractionOptions` extends core `ExtractionOptions`:

```ts
interface ServiceExtractionOptions extends ExtractionOptions {
  forceRefresh?: boolean; // Skip cache (default false)
  mode?: ExtractionMode; // READABILITY | RAW | DEFUDDLE | SELECTION
  maxRetries?: number; // Default 2
  retryDelay?: number; // Default 1000 ms
}
```

## Error Handling

Errors extend `ExtractionError` with a typed `type` field:

- `TIMEOUT` — content script timed out
- `TAB_NOT_FOUND` — tab closed or unavailable
- `RESTRICTED_URL` — blocked by restricted URL policy
- `CONTENT_SCRIPT_UNAVAILABLE` — content script missing/not ready
- `UNKNOWN` — fallback for unexpected issues

Callers can catch and switch on `error instanceof ExtractionError`. The hook `useTabExtraction` already maps these to user-friendly banners.

## Integration

- Delegates to background `TabManager` which respects cache TTLs and mode changes.
- Consumed by `useTabExtraction` to auto-load the current tab and provide `@` tab mentions.
- Cooperates with domain defaults: if no mode is passed, the content script still applies domain rules before running extraction.

## Testing

Unit tests live under `tests/unit/services/extraction/**`. Mock background messaging when running in Vitest (`sendMessage` from `@platform/chrome/runtime`).
