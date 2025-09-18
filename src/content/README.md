# Content Script

Code under `src/content/` runs inside each tab.  It injects the React sidebar,
mediates background ↔ page messaging, and owns the extraction pipeline that
turns the active document into structured text for the chat surface.

## Layout

```
content/
├─ index.ts                  # Bootstrap: patch document, mount sidebar, wire messages
├─ core/
│  ├─ documentPatcher.ts     # Rewrites asset URLs so imported CSS/fonts load inside the tab
│  ├─ messageHandler.ts      # Typed message dispatcher (TOGGLE_SIDEBAR, EXTRACT_TAB_CONTENT, …)
│  └─ sidebarController.ts   # Mount/unmount React app inside a Shadow DOM root
├─ extraction/
│  ├─ orchestrator.ts        # Chooses an extraction mode and enforces timeouts
│  ├─ extractors/            # Readability, Raw HTML, and Defuddle implementations
│  ├─ analyzers/             # Metadata + discussion detectors appended to results
│  └─ sites/                 # Optional site-specific plugins loaded at runtime
└─ utils/
   ├─ domUtils.ts            # DOM helpers that avoid clobbering the host page
   └─ tabUtils.ts            # Glue for tab metadata + message payloads
```

## Extraction pipeline

* `orchestrator.ts` normalises `ExtractionOptions`, applies domain-specific
  defaults saved in Chrome storage, and races the chosen extractor against a
  timeout.  Supported modes (`ExtractionMode`) are **readability** (default),
  **raw**, **defuddle**, and a **selection** fallback that emits the current user
  selection when present.
* Extractors live in `extraction/extractors/` and are lazy-loaded to keep the
  injected bundle small.  Readability converts DOM → Markdown via
  `@core/extraction/markdownConverter`, Raw returns a lightly cleaned HTML/Markdown
  pair, and Defuddle delegates to the third-party parser.
* After extraction the orchestrator runs the analyzers: `metadataExtractor`
  collects title/author/description, while `discussionExtractor` identifies forum
  threads and highlights useful snippets.
* `extraction/sites/` exposes opt-in plugins (`*.plugin.ts`) that can short-circuit
  the default modes for known domains.  The loader also picks up local overrides
  from the gitignored `/site-plugins/` directory so developers can test private
  rules without committing them.

The resolved `ExtractedContent` is cached by the background service worker but
always originates from this pipeline.

## Messaging contract

`core/messageHandler.ts` registers handlers for a small set of typed messages
(see `@/types/messages.ts`):

* `TOGGLE_SIDEBAR` / `CLOSE_SIDEBAR` drive sidebar visibility.
* `PING` responds with `PONG` so the background can detect whether the content
  script is available and decide if it should inject again.
* `EXTRACT_TAB_CONTENT` runs the orchestrator and returns
  `CONTENT_EXTRACTED` with the resulting payload (or `ERROR` if extraction
  fails).  Timeouts and errors propagate back to the background worker so the UI
  can surface them.

Message handlers use the shared `createMessage` helper to guarantee consistent
shape and timestamps across extension components.

## Working with the sidebar controller

`sidebarController.ts` ensures the UI is mounted in a Shadow DOM container
attached to the document body.  It tracks whether the root exists, provides
helpers for focus/cleanup, and exposes `showSidebar`/`hideSidebar` so the
background can toggle the UI without re-injecting the bundle.

## Extending the module

* Add a new extractor under `extraction/extractors/` and update the switch in
  `orchestrator.ts` when a new mode is required.
* Register additional message types in `core/messageHandler.ts` and export their
  payload definitions from `@/types/messages`.
* Keep DOM helpers pure and side-effect free—anything that mutates the page
  should be centralised in `documentPatcher.ts` or an extractor to avoid
  surprising host pages.
