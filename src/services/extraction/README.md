# ExtractionService

A high-level facade for requesting tab extraction from the sidebar or tests.
The service hides Chrome messaging details, adds retry/backoff logic, and
normalises errors so UI components can display consistent feedback.

## Surface

```ts
import {
  ExtractionService,
  createExtractionService,
  defaultExtractionService,
  extractCurrentTab,
  extractTabs,
  ExtractionError,
  ExtractionErrorType,
} from '@services/extraction';
```

* `ExtractionService` instances require a `MessageSource` (usually `'sidebar'`).
* `extractCurrentTab(options?)` resolves a `TabContent` payload or throws an
  `ExtractionError` with a typed `ExtractionErrorType`.
* `extractTabs(tabIds, options?)` runs multiple requests concurrently (honouring
  the queue inside `TabManager`) and returns a `BatchExtractionResult` with
  per-tab success flags.
* `getAllTabs()` proxies `GET_ALL_TABS` to the background worker so the UI can
  display metadata without directly calling `chrome.tabs`.

## Options

All extraction helpers accept `ServiceExtractionOptions`, which extend the
shared `ExtractionOptions` with:

* `mode?: ExtractionMode` – request Readability/Raw/Defuddle explicitly.
* `forceRefresh?: boolean` – bypass the background cache.
* `maxRetries?: number` and `retryDelay?: number` – tune the built-in retry
  loop (defaults to 2 attempts with a 1s delay).

## Error handling

Errors are surfaced as `ExtractionError` with a `type` enum:

* `TIMEOUT`, `TAB_NOT_FOUND`, `CONTENT_SCRIPT_UNAVAILABLE`, `RESTRICTED_URL`,
  `MESSAGING_ERROR`, or `UNKNOWN`.

Consumers should catch the error and branch on `error.type` to provide user
feedback.

## Messaging details

The service uses `createMessage()` from `@/types/messages` and
`sendMessageToTab()` / `sendMessageAsync()` from `@platform/chrome` to talk to
`extension/background/tabManager.ts`.  Responses mirror the `CONTENT_EXTRACTED`
payload used throughout the app.

## Testing

Use `createExtractionService()` in Vitest suites to inject a mocked message
transport or to assert retry behaviour.  The default singleton
(`defaultExtractionService`) is exported for convenience when dependency
injection is not required.
