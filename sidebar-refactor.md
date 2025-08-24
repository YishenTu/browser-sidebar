# Sidebar Refactor Plan

This plan proposes a focused, incremental refactor of the sidebar UI to remove dead code and mocks, reduce inline styles, modularize CSS, and split long files into smaller, testable units — without changing user-visible behavior.

## Goals

- ~~Remove no-longer-needed mock code from the production bundle.~~ ✅ COMPLETED
- Eliminate dead code, duplicate logic, and overuse of inline styles.
- Split `ChatPanel` into logical subcomponents and hooks.
- Break the monolithic `sidebar.css` into smaller modules.
- Keep behavior and look-and-feel unchanged; simplify maintenance and testing.

---

## Recent Structural Changes (Completed)

- **Mock code removed**: `useMockChat.ts` and `mockChat.ts` deleted completely
- **Directory reorganization**:
  - `backend/` → `extension/background/` (Chrome extension infrastructure)
  - `core/messaging.ts` → `extension/messaging/index.ts`
  - `store/` → `data/store/` (unified data management)
  - `storage/` simplified (removed complex IndexedDB)
  - `cn.ts` → `sidebar/lib/cn.ts` (UI utility)
  - `theme.ts` → `sidebar/contexts/theme.ts`
  - `variables.css` → `sidebar/styles/variables.css`
- **useAIChat modularized**: Split 800+ line hook into focused modules:
  - `hooks/ai/useProviderManager.ts` - Provider management
  - `hooks/ai/useStreamHandler.ts` - Stream handling
  - `hooks/ai/useMessageHandler.ts` - Message handling
  - `hooks/ai/useAIChat.ts` - Simplified orchestrator
  - `hooks/ai/types.ts` - Shared types

---

## Key Findings (from code scan)

- Duplicate Escape handling: `src/sidebar/index.tsx` and `src/sidebar/ChatPanel.tsx` both bind Escape → close.
- Inline style overrides injected in `index.tsx` (large `textarea` block) duplicate rules already present in `src/sidebar/styles/sidebar.css`.
- `sidebar.css` mixes base layout, chat input, model selector, icon button, markdown tables, provider settings, utilities, and animations; contains "Removed …" notes and obsolete comments.
- Settings UI duplicated: `ChatPanel` contains an ad-hoc API key section while `components/Settings/ProviderSettings.tsx` and `components/Settings/ApiKeyInput.tsx` already exist.
- ~~Mocks present but unused by runtime: `src/sidebar/hooks/useMockChat.ts`, `src/utils/mockChat.ts` (only referenced by a path-alias test).~~ ✅ REMOVED
- `ChatPanel.tsx` is too large (drag/resize, layout, settings, error banner, chat flow, inline styles) — hard to test and evolve.

---

## Refactor Plan (phased)

1. Split `ChatPanel` into modules

- Create `src/sidebar/components/layout/Header.tsx`
  - Title/actions, `ModelSelector`, new-session, settings toggle, close button.
- Create `src/sidebar/components/layout/ErrorBanner.tsx`
  - Dismissible error banner using `useChatStore().clearError`.
- Create `src/sidebar/components/layout/Body.tsx`
  - Wraps `MessageList`, accepts `height` and `messages/isLoading` props.
- Create `src/sidebar/components/layout/Footer.tsx`
  - Wraps `ChatInput` and related controls.
- Create `src/sidebar/components/layout/ResizeHandles.tsx`
  - Pure presentation for N/E/S/W/diagonals with proper `aria-label`s.
- Add `src/sidebar/constants.ts` for sizing: `MIN/MAX/DEFAULT_WIDTH`, `MIN/MAX_HEIGHT`, `SIDEBAR_HEIGHT_RATIO`, paddings.
- Reduce `src/sidebar/ChatPanel.tsx` to orchestration only.

2. Extract drag/resize behavior into hooks

- Add `src/sidebar/hooks/useDragPosition.ts`
  - Header drag with offset; returns `{ position, onMouseDown, isDragging }`.
- Add `src/sidebar/hooks/useResize.ts`
  - Handles edges/corners, clamps to min/max; returns `{ size, onMouseDown, isResizing }`.
- Unit-testable logic; simplifies `ChatPanel` and eases future tweaks.

3. Modularize CSS

- Add `src/sidebar/styles/index.css` which imports:
  - `base.css` — overlay/container, tokens import.
  - `header.css` — header layout and actions styling.
  - `body.css` — message area, row alignment, bubbles baseline.
  - `footer.css` — footer container.
  - `chat-input.css` — all `.chat-input*` and textarea overrides.
  - `resize.css` — `.ai-sidebar-resize-handle*`.
  - `model-selector.css` — `.model-selector*`.
  - `icon-button.css` — `.icon-button*` (consider colocating with component).
  - `markdown.css` — tables within `.ai-sidebar-body`.
  - `provider-settings.css` — `.provider-settings*`.
  - `utilities.css`, `animations.css` — `.sr-only`, spinner/keyframes, shared utils.
- Replace `import './styles/sidebar.css?inline'` with `index.css?inline`.
- Delete obsolete comments and unused selectors; keep variable-driven styling intact.

4. Remove inline styles and duplicate logic

- Delete injected `<style>` overrides in `src/sidebar/index.tsx`; rely on CSS modules.
- Move any remaining ad-hoc inline styles in `ChatPanel` and layout components into classes.
- Keep critical accessibility attributes (roles, aria- labels) unchanged.

5. Deduplicate Escape/onClose handling

- Single source of truth: handle Escape inside `ChatPanel` only.
- `index.tsx` should expose `mountSidebar/unmountSidebar` and not bind global keydown.
- Ensure `onClose` sends `{ type: 'sidebar-closed' }` and unmounts exactly once.

6. Consolidate Settings UI

- Replace the ad-hoc settings section in `ChatPanel` with `components/Settings/ProviderSettings` and `ApiKeyInput`.
- Keep model-switch flow: if selected provider key is missing, open settings panel.
- Avoid `alert()`; prefer inline banners/status from settings components.

~~7) Remove or gate the mock code~~ ✅ COMPLETED

- ~~Option A (preferable): Move `src/sidebar/hooks/useMockChat.ts` and `src/utils/mockChat.ts` under `tests/__mocks__/` and update the path-alias test to import from test utils.~~
- ~~Option B: Guard exports behind `import.meta.env.DEV` and configure Vite `define` so mocks tree-shake in prod builds. Update tests to tolerate dev-only exports.~~
- Mock code has been completely removed from the codebase

8. Clean up dead/commented code

- Remove duplicate/unused CSS selectors and "Removed …" notes.
- Remove commented-out code in `MessageList` or replace with a precise TODO and planned work item.
- Ensure `ThemeProvider` and `setTheme` side effects are not duplicated; centralize if possible.

9. Quality gates

- Run `npm run lint`, `npm run typecheck`, `npm test`.
- Build with `npx vite build` and load unpacked to verify styling/positioning.

---

## File Changes (high-level)

- Modify
  - `src/sidebar/index.tsx` — remove inline style injection and global Escape listener; keep Shadow DOM + root mount.
  - `src/sidebar/ChatPanel.tsx` — slim down, delegate to subcomponents and hooks; remove inline styles; call `onClose` consistently.
  - `src/sidebar/styles/sidebar.css` — split into modules; leave a shim that imports `styles/index.css` (temporarily) or replace usage.

- Add (Pending)
  - `src/sidebar/constants.ts`
  - `src/sidebar/hooks/useDragPosition.ts`
  - `src/sidebar/hooks/useResize.ts`
  - `src/sidebar/components/layout/Header.tsx`
  - `src/sidebar/components/layout/ErrorBanner.tsx`
  - `src/sidebar/components/layout/Body.tsx`
  - `src/sidebar/components/layout/Footer.tsx`
  - `src/sidebar/components/layout/ResizeHandles.tsx`
  - `src/sidebar/styles/index.css`
  - `src/sidebar/styles/{base,header,body,footer,chat-input,resize,model-selector,icon-button,markdown,provider-settings,utilities,animations}.css`

- ✅ Completed Relocations
  - `backend/` → `extension/background/`
  - `core/messaging.ts` → `extension/messaging/index.ts`
  - `store/` → `data/store/`
  - `cn.ts` → `sidebar/lib/cn.ts`
  - `variables.css` → `sidebar/styles/variables.css`
  - Split `useAIChat.ts` into `hooks/ai/` modules

- ✅ Removed
  - Mock code (`useMockChat.ts`, `mockChat.ts`) - completely removed
  - Path-alias test - no longer needed
  - Complex IndexedDB implementation - simplified storage layer

---

## Acceptance Criteria

- Sidebar mounts in Shadow DOM; visuals unchanged; no inline CSS overrides remain.
- Dragging and resizing work with min/max clamps and correct cursors.
- Escape-to-close works via a single code path that also notifies background.
- Model switching prompts for missing keys and opens settings UI; validation works in-UI.
- No mock code in production bundle; tests still pass.
- `npm run build` succeeds; `npm test` green.

---

## Rollout Steps

1. Extract hooks and subcomponents; keep `sidebar.css` as-is temporarily.
2. Swap `ChatPanel` to use new pieces; verify behavior.
3. Modularize CSS file-by-file; update imports to `styles/index.css`.
4. Remove inline CSS from `index.tsx`; validate textarea and input styling.
5. Replace ad-hoc settings in `ChatPanel` with `ProviderSettings`/`ApiKeyInput`.
6. Remove or dev-gate mocks; update tests if paths change.
7. Clean pass: lint, typecheck, tests; `npx vite build`.

---

## Notes / Risks

- CSS scoping is inside Shadow DOM; moving rules to files should be safe as long as selectors remain identical.
- ~~Path-alias tests reference `@utils/mockChat` and `@hooks/useMockChat`; if moved, update tests accordingly or add dev-gating.~~ ✅ Mock code and path-alias test removed
- Keep `z-index` and pointer-events behavior; they are critical for overlay.
- Consider adding unit tests for `useDragPosition` and `useResize` once extracted.
- New directory structure updates:
  - Background scripts now in `extension/background/`
  - Messaging types in `extension/messaging/`
  - Data layer consolidated in `data/` (store, storage)
  - AI hooks modularized in `sidebar/hooks/ai/`
