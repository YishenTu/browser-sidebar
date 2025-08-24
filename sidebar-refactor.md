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

## Key Findings (from validation scan)

- Duplicate Escape handling: `src/sidebar/index.tsx` and `src/sidebar/ChatPanel.tsx` both bind Escape → close.
- Inline style overrides injected in `index.tsx` (large `textarea` block) duplicate rules already present in `src/sidebar/styles/sidebar.css`.
- `sidebar.css` mixes base layout, chat input, model selector, icon button, markdown tables, provider settings, utilities, and animations; contains "Removed …" notes and obsolete comments.
- Settings UI duplicated: `ChatPanel` contains an ad-hoc API key section while `components/Settings/ProviderSettings.tsx` and `components/Settings/ApiKeyInput.tsx` already exist.
- ~~Mocks present but unused by runtime: `src/sidebar/hooks/useMockChat.ts`, `src/utils/mockChat.ts` (only referenced by a path-alias test).~~ ✅ REMOVED
- `ChatPanel.tsx` is too large (drag/resize, layout, settings, error banner, chat flow, inline styles) — hard to test and evolve.

---

## Repo Validation Summary (current)

- Structure: New layout components (`Header`, `Body`, `Footer`, `ResizeHandles`) and `constants.ts` are present and wired. CSS is modularized and aggregated via `src/sidebar/styles/sidebar.css` (serves as the CSS entry).
- Inline CSS: A large `<style>` injection remains in `src/sidebar/index.tsx` for `textarea` and root container. This should be removed in favor of the modular CSS already in place. Pending.
- Settings UI: `ChatPanel.tsx` still renders an ad‑hoc settings panel with inline styles and `alert()` calls. Should be replaced by `ProviderSettings`/`ApiKeyInput`. Pending.
- Drag/Resize hooks: Logic remains embedded in `ChatPanel.tsx`. `useDragPosition` and `useResize` not yet extracted. Pending.
- Types and imports:
  - Several imports use the alias `@types/*`, which TypeScript treats like DefinitelyTyped packages, causing TS6137 errors. Should use `@/types/*` or rename alias.
  - `Body.tsx` type imports don’t match the message shape used by the store, causing assignment errors.
  - `src/data/storage/keys.ts` references files removed during storage simplification (e.g., `indexedDB`, `schema`, `chromeStorage`) and needs to be aligned with the simplified storage.
- Tests:
  - Numerous tests import from `@/security/*` or `../../src/security/*` but security code was moved to `src/data/security`. Either add compatibility re-exports under `src/security/*` or migrate tests to `@security/*` (existing alias).
  - Gemini SSE streaming tests fail parsing due to JSON extraction differences. Requires parser or fixture sync.
- Build: `tsc --noEmit` currently fails; fix types and imports before validating `vite build`.

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

Status: Header/Body/Footer/ResizeHandles/constants ✅ Completed. ChatPanel size reduction: Partially completed (logic still heavy; see steps 2 and 4).

2. Extract drag/resize behavior into hooks

- Add `src/sidebar/hooks/useDragPosition.ts`
  - Header drag with offset; returns `{ position, onMouseDown, isDragging }`.
- Add `src/sidebar/hooks/useResize.ts`
  - Handles edges/corners, clamps to min/max; returns `{ size, onMouseDown, isResizing }`.
- Unit-testable logic; simplifies `ChatPanel` and eases future tweaks.

Status: Pending (drag/resize logic remains embedded in `ChatPanel.tsx`).

3. Modularize CSS

- Use `src/sidebar/styles/sidebar.css` as the CSS entry, which imports:
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
- Replace per-component inline styles with classnames from the modular CSS where possible.
- Delete obsolete comments and unused selectors; keep variable-driven styling intact.

Status: CSS modularization ✅ Completed; aggregator name is `styles/sidebar.css` (doc updated to match). Inline layout styles remain in a few components (see step 4).

4. Remove inline styles and duplicate logic

- Delete injected `<style>` overrides in `src/sidebar/index.tsx`; rely on CSS modules. (Pending)
- Move any remaining ad-hoc inline styles in `ChatPanel` and layout components into classes.
- Keep critical accessibility attributes (roles, aria- labels) unchanged.

5. Deduplicate Escape/onClose handling

- Single source of truth: handle Escape inside `ChatPanel` only.
- `index.tsx` should expose `mountSidebar/unmountSidebar` and not bind global keydown.
- Ensure `onClose` sends `{ type: 'sidebar-closed' }` and unmounts exactly once.

Status: ✅ Completed (Escape handling centralized in `ChatPanel`).

6. Consolidate Settings UI

- Replace the ad-hoc settings section in `ChatPanel` with `components/Settings/ProviderSettings` and `ApiKeyInput`. (Pending)
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

Status: Pending (typecheck/tests currently failing; see below).

---

## Type & Test Fixes (blocking)

- Alias hygiene: Replace all imports from `@types/*` with `@/types/*` (or rename alias to `@app-types/*`) to resolve TS6137 errors.
- Message types: Align `Body.tsx` to use `ChatMessage[]` from the chat store (`@store/chat`) or unify on a single `ChatMessage` type to avoid assignment errors.
- Storage service: Update `src/data/storage/keys.ts` to reflect simplified storage. Remove or replace references to removed modules (`indexedDB`, `schema`, `chromeStorage`) and use `@storage/chrome` + `@security/*` instead.
- Test paths: Migrate tests that import from `@/security/*` or `../../src/security/*` to the new alias `@security/*` (or add compatibility re-exports in `src/security/*`). Extend `scripts/migrate-tests.js` to automate this.
- Streaming parsing: Fix Gemini SSE parsing or test fixtures so streaming tests pass (several JSON parse errors indicate extraction mismatch).

---

## File Changes (high-level)

- Modify
  - `src/sidebar/index.tsx` — remove inline style injection and global Escape listener; keep Shadow DOM + root mount.
  - `src/sidebar/ChatPanel.tsx` — slim down, delegate to subcomponents and hooks; remove inline styles; call `onClose` consistently.
  - `src/sidebar/styles/sidebar.css` — acts as aggregator for modular CSS.

- Add (Completed unless noted)
  - `src/sidebar/constants.ts`
  - `src/sidebar/hooks/useDragPosition.ts` (Pending)
  - `src/sidebar/hooks/useResize.ts` (Pending)
  - `src/sidebar/components/layout/Header.tsx`
  - `src/sidebar/components/layout/ErrorBanner.tsx`
  - `src/sidebar/components/layout/Body.tsx`
  - `src/sidebar/components/layout/Footer.tsx`
  - `src/sidebar/components/layout/ResizeHandles.tsx`
  - `src/sidebar/styles/sidebar.css` (aggregator)
  - `src/sidebar/styles/{base,header,body,footer,chat-input,resize-handles,model-selector,icon-button,markdown-content,provider-settings,katex-math,variables}.css`

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
- `npm run typecheck` and `npm run build` succeed; `npm test` is green.

---

## Rollout Steps

Phase 1 — Quick wins and unblockers

1. Replace `@types/*` imports with `@/types/*` (or rename alias) across `src/`.
2. Fix `Body.tsx` to use `ChatMessage[]` consistently with the store.
3. Remove the injected `<style>` block in `src/sidebar/index.tsx`; ensure `chat-input.css` covers textarea overrides.

Phase 2 — UI consolidation and cleanup 4. Swap ad‑hoc settings UI in `ChatPanel.tsx` for `ProviderSettings` + `ApiKeyInput`; replace `alert()` with `ErrorBanner`/inline status. 5. Move remaining inline styles from `Header`, `ResizeHandles`, and `Body` into CSS modules.

Phase 3 — Behavior extraction and tests 6. Extract `useDragPosition` and `useResize` hooks and refactor `ChatPanel` to consume them. 7. Extend `scripts/migrate-tests.js` to update security/type import paths; migrate or add shim re‑exports. 8. Fix Gemini SSE parsing or fixtures until streaming tests pass. 9. Run `npm run lint`, `npm run typecheck`, `npm test`, then `npx vite build`.

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

---

## Future Work (proposals)

- Alias hygiene: avoid `@types/*` alias to prevent collision with DT packages; prefer `@/types/*` or `@app-types/*`.
- Chat message type unification: choose and enforce a single `ChatMessage` definition across UI/store/types (or namespace clearly) to prevent assignment errors.
- Accessibility: improve focus management and keyboard navigation across header, message list, and input; add tests.
- CSS tokens: introduce CSS variables for header/footer heights and spacing to avoid repeating `calc(100% - 60px - 70px)` inline.
- Error handling: remove `window.alert` usage throughout; route through `ErrorProvider` + `ErrorBanner` and component-local statuses.
- Background messaging helper: centralize message creation/validation for `extension/background/*` using `@/types/messages` to reduce duplication.
- E2E coverage: add Playwright (or similar) for overlay mount, resize/drag, escape-to-close, settings flow, and model switching.
- Performance: review virtualization thresholds and memoization in `MessageList` to ensure smooth large histories.
