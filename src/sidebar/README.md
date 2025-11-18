# Sidebar Module

The sidebar is a Shadow-DOM React app. It renders the chat UI, handles streaming, surfaces extraction previews, and wires user actions into the service layer. UI logic stays here; provider logic lives in `@core`/`@services`.

## Directory Structure

```
sidebar/
├─ ChatPanel.tsx           # Unified entry (layout, settings, capture, messaging)
├─ index.tsx               # Mount/unmount into Shadow DOM root
├─ components/
│  ├─ layout/              # Header, Body, Footer, ResizeHandles
│  ├─ Settings/            # Settings panel (keys, compat providers, domain rules)
│  ├─ ScreenshotPreview.tsx# Inline screenshot management
│  ├─ ContentPreview.tsx   # Extracted tab content viewer
│  ├─ ModelSelector.tsx    # Model dropdown with capability badges
│  ├─ SlashCommandDropdown.tsx
│  ├─ TabMentionDropdown.tsx
│  ├─ MessageList.tsx / MessageBubble.tsx / StreamingText.tsx
│  ├─ ErrorBanner.tsx, TabErrorBoundary.tsx, TabLoadingIndicator.tsx
│  └─ ui/                  # Buttons, dropdowns, tooltips, alerts
├─ hooks/
│  ├─ ai/                  # useAIChat, useMessageHandler, useProviderManager, useStreamHandler
│  ├─ useTabExtraction.ts  # Multi-tab extraction + cache orchestration
│  ├─ useSlashCommand.ts / useTabMention.ts
│  ├─ useScreenshotCapture.ts
│  ├─ useMessageEditing.ts
│  ├─ useSidebarPosition.ts (drag + resize)
│  ├─ useDragPosition.ts / useResize.ts (low-level geometry wrappers)
│  └─ useSessionManager.ts
├─ contexts/
│  └─ ErrorContext (with hook re-export)
├─ utils/
│  └─ dropdownPosition.ts  # DOM wrappers around core positioning helpers
├─ styles/                 # Layered CSS (see styles/README.md)
└─ constants.ts            # Layout defaults/readability thresholds
```

## Responsibilities

- Render chat history with streaming updates, reasoning indicators, and markdown/KaTeX rendering.
- Manage tab extraction (auto-load current tab, @-mention to load others, preview cards).
- Handle screenshot capture (configurable hotkey, capture modal, upload via core services).
- Expose Settings UI for API keys, compat provider vault, domain defaults, debug toggles, screenshot hotkey.
- Provide slash command + @ mention UX powered by core text-processing utilities.
- Coordinate session switching via `useSessionManager`/Zustand stores.

## State Management

Hooks talk to the shared stores exported from `@data/store/chat`:

- `useSessionStore` — active session per `tabId + normalizedUrl`.
- `useMessageStore` — message list with edit/remove helpers.
- `useTabStore` — extracted tab cache per session (current tab + additional tabs).
- `useUIStore` — loading flags, error ids, streaming status.
- `useSettingsStore` — persisted settings (API keys, compat providers, domain rules, screenshot hotkey, UI prefs).

## Key Hooks

- `useAIChat` — Initializes providers, streams responses, handles cancel & retry.
- `useProviderManager` — Boots providers from saved keys/compat providers, exposes model capability info.
- `useTabExtraction` — Talks to background extraction service, maintains loaded tab order, auto-loads the current tab once.
- `useScreenshotCapture` — Detects hotkeys (using `@core/utils/hotkeys`), captures screenshots, drives `ScreenshotPreview`.
- `useMessageEditing` — Inline editing, re-send, “continue writing” flows.
- `useSidebarPosition` — Simple wrapper over geometry utils for drag/resize.

## Slash Commands & Mentions

- `/summarize`, `/explain`, `/analyze`, `/comment`, `/fact-check` (Gemini), `/rephrase`.
- Keyboard: `↑/↓` navigate, `Enter` confirm, `Esc` cancel.
- `@` opens the tab mention dropdown populated via `useTabExtraction`.

## Settings Panel Highlights

- Validate & store BYOK keys (OpenAI, Gemini, Grok, OpenRouter) before updating the settings store.
- Manage OpenAI-compatible providers (built-ins + custom) via `@data/storage/keys/compat`.
- Configure domain extraction defaults and screenshot hotkey.
- Toggle debug mode and other UI preferences.

## Styling & Theming

See `styles/README.md` for the layered CSS approach. All styles live under a Shadow DOM root, so no leakage into host pages.

## Testing

- Component tests live under `tests/integration/sidebar/**`.
- Hook tests under `tests/integration/sidebar/hooks/**`.
- Prefer React Testing Library + jsdom with mocked stores and services.
