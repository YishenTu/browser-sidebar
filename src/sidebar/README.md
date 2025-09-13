# Sidebar Module

React Shadow‑DOM chat UI: model selector, streaming, extraction preview, settings, and utilities.

## Directory Structure

```
sidebar/
├─ ChatPanel.tsx            # Main UI entry
├─ index.tsx                # Mount/unmount into Shadow DOM
├─ components/
│  ├─ layout/               # Header/Footer/Body/ResizeHandles
│  ├─ ChatInput.tsx         # Multiline input (+ cancel when streaming)
│  ├─ CodeBlock.tsx         # Syntax‑highlighted code
│  ├─ ContentPreview.tsx    # Extracted page content preview
│  ├─ ErrorBanner.tsx
│  ├─ MarkdownRenderer.tsx  # GFM + KaTeX
│  ├─ MessageBubble.tsx
│  ├─ MessageList.tsx       # Virtualized list
│  ├─ ModelSelector.tsx
│  ├─ SearchSources.tsx
│  ├─ Settings/Settings.tsx
│  ├─ SlashCommandDropdown.tsx
│  ├─ StreamingText.tsx
│  ├─ TabContentItem.tsx
│  ├─ TabErrorBoundary.tsx
│  ├─ TabLoadingIndicator.tsx
│  ├─ TabMentionDropdown.tsx
│  ├─ ThinkingWrapper.tsx
│  └─ ui/ (Alert, Collapsible, CopyButton, Dropdown, FullscreenModal, Icons, Spinner, TextArea, Tooltip)
├─ contexts/ (ErrorContext.tsx, useError, etc.)
├─ hooks/
│  ├─ ai/ (useAIChat, useMessageHandler, useProviderManager, useStreamHandler)
│  ├─ useSlashCommand.ts
│  ├─ useDragPosition.ts
│  ├─ useResize.ts
│  └─ useTabMention.ts
└─ styles/ (layered CSS; see styles/README.md)
```

### Layout & Components

- Header (draggable), Footer (input/actions), Body (scrollable), Resize handles
- MessageList (virtualized), MessageBubble, StreamingText
- ModelSelector with capability hints
- ContentPreview + TabContentItem for extracted page data
- SlashCommandDropdown; ThinkingWrapper when provider supports reasoning

### State Management

- In‑memory chat/session stores under `@data/store`: `useSessionStore`, `useMessageStore`, `useTabStore`, `useUIStore`
- Persistent settings/API keys via `useSettingsStore` (Chrome storage)
- ErrorContext for cross‑component error reporting

## Messaging

The UI communicates with the background using the typed protocol in `@types/messages.ts`:

- Sidebar toggle/close
- Tab metadata (`GET_TAB_INFO`, `GET_ALL_TABS`)
- Content extraction (`EXTRACT_TAB_CONTENT`) with stream‑safe timeouts

## Styling

Layered CSS in `styles/` with Shadow‑DOM isolation. See `styles/README.md` for guidance and conventions.

## Performance

- Virtualized lists for long chats
- Memoization and selective re‑renders
- Stream buffering to keep smooth output

## Accessibility

- Keyboard navigation; accessible labels/roles
- Escape closes modal and header close button (Esc) tooltips
- Cancel button appears while streaming; supports keyboard focus

## Browser Compatibility

Chromium‑based browsers (Chrome, Edge, Arc, Brave, Opera). Some pages (e.g., `chrome://`) are restricted by design.

## Slash Commands

Type `/` to open the dropdown; filter by typing (`↑/↓` to navigate, `Enter` to select). The command expands into a template; some commands choose a one‑turn model (e.g., `/fact-check` → `gemini-2.5-flash`).

Built‑ins: `summarize`, `explain`, `analyze`, `comment`, `fact-check`, `rephrase`.
