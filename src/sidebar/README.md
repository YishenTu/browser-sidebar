# Sidebar UI

React components that render the in-tab chat experience live under
`src/sidebar/`.  The UI is mounted inside a Shadow DOM root (see
`ChatPanel.tsx`) so it stays isolated from host-page styles.

## Directory overview

```
sidebar/
├─ ChatPanel.tsx      # Top-level component rendered by the content script
├─ index.tsx          # Mount/unmount helpers used by sidebarController
├─ components/        # Presentational and composite UI pieces
├─ contexts/          # React contexts (error boundary, layout)
├─ hooks/             # Sidebar-specific hooks (providers, streaming, layout)
├─ styles/            # Layered CSS (see styles/README.md)
├─ utils/             # Client-side helpers (clipboard, keyboard, formatting)
└─ constants.ts       # Shared constants (layer names, CSS selectors, IDs)
```

### Components

`components/index.ts` re-exports the most common pieces.  Highlights include:

* Conversation surface: `MessageList`, `MessageBubble`, `StreamingText`,
  `ThinkingWrapper`, `SearchSources`, and `ScreenshotPreview`.
* Input + controls: `ChatInput`, `SlashCommandDropdown`, `ModelSelector`,
  `ContentPreview`, `TabMentionDropdown`.
* Layout and plumbing: `components/layout/*`, `TabErrorBoundary`,
  `TabLoadingIndicator`, and `withTabErrorBoundary`.
* Shared UI primitives live under `components/ui/` (buttons, dropdowns, tooltips,
  modal, icons, etc.).

### Hooks

* `hooks/ai/` contains providers for chat streaming (`useAIChat`), provider
  management, and stream event handling.
* Other notable hooks: `useSlashCommand`, `useTabMention`, `useResize`,
  `useDragPosition`, and `useFocusTrap`.

Hooks generally wrap Zustand selectors and service calls so components stay thin.

### Contexts

* `contexts/ErrorContext.tsx` exposes error-reporting helpers shared across the
  tree.
* Additional contexts provide access to layout state and tab metadata.

### Styles

Layered CSS lives in `styles/` and is imported once from `styles/index.css`.
Follow the guidance in `styles/README.md` when adding new rules to maintain the
`@layer` cascade order.

### Messaging

UI-level messaging helpers (e.g. `utils/sendMessage`) funnel through the services
layer so components do not directly depend on Chrome APIs.  Any new messaging
capability should be added to a service first and then consumed by hooks.

## Development tips

* Use the path aliases (`@sidebar/components`, `@sidebar/hooks`, etc.) to avoid
  brittle relative imports.
* Prefer selectors (`useStore(state => ...)`) when reading from Zustand stores to
  minimise re-renders.
* Keep `ChatPanel.tsx` minimal—heavy logic belongs in hooks so it can be reused
  by Storybook stories or tests.
