# Stage 2 Continuation Plan — Chat Panel UI (Fixes, Refactors, and Polish)

This document outlines concrete follow-ups to fully realize Stage 2’s deliverables, align documentation, and harden the UI for production. It prioritizes correctness, accessibility, performance, and clean integration within the shadow DOM sidebar container.

## 0) Executive Summary

- P0: Mount `ChatPanel` inside the sidebar and wrap with `ThemeProvider`.
- P0: Sync documentation status for Stage 2 across docs.
- P1: Fix style injection for components rendered inside shadow DOM; extract inline CSS.
- P1: Improve virtualization correctness (dynamic heights, at-bottom detection, `outerRef`).
- P1: Reduce test act() warnings and improve robustness with `userEvent`.
- P2: Tighten a11y and keyboard flows; finalize perf/overscan and memoization.
- P2: Optionally wire `mockChat` to ChatPanel for demo streaming.

---

## 1) Sidebar Integration (Mount Chat Panel)

- Goal: Replace the placeholder preview UI in `src/sidebar/Sidebar.tsx` with the real `ChatPanel`, wrapped by `ThemeProvider` so Stage 2 renders in the sidebar as intended.
- Changes:
  - Import `ThemeProvider` from `src/contexts/ThemeContext.tsx` and `ChatPanel` from `src/components/Chat/ChatPanel.tsx`.
  - Render inside `.ai-sidebar-container` > `.ai-sidebar-content` region.
  - Ensure height fills the content pane (flex column with header; ChatPanel stretches to available height). `ChatPanel` already lays out its own header/body/footer and passes `height` to `MessageList`.
- Acceptance:
  - Sidebar shows functional chat panel in dev build.
  - Theme toggling persists and reflects in UI.

Notes: Keep drag/resize logic intact. Continue sending `sidebar-closed` on close.

---

## 2) Documentation Sync

- Problem: Conflicting status.
  - `docs/stages/task-stage-2.md` + `docs/planning/task-overview.md`: Stage 2 Completed (24/24).
  - `docs/README.md`: Stage 2 In Progress (0%).
- Actions:
  - Update `docs/README.md` Project Status row for Stage 2 to Completed 100% (or change Stage 2 docs to “In Progress” if we choose to reflect the current integration gap). Recommend marking Completed after executing item (1).
- Acceptance: No contradictions remain in Stage tables and progress summaries.

---

## 3) Shadow DOM Styles — Extract Inline Component CSS

- Problem: `ChatPanel.tsx` and `ChatInput.tsx` inject `<style>` into `document.head`. When rendered inside a shadow root, these styles do not apply.
- Fix:
  - Extract embedded CSS strings into proper CSS files:
    - `src/styles/chat-panel.css`
    - `src/styles/chat-input.css`
  - Import and bundle alongside existing sidebar/global styles that are injected into the shadow root in `src/sidebar/index.tsx`.
  - Remove runtime style injection blocks from the components.
- Acceptance:
  - Styles for ChatPanel/Input apply correctly inside the shadow root.
  - No component-level style injection into `document.head` remains.

---

## 4) Virtualization Robustness (MessageList)

- Problems:
  - Uses a fixed `DEFAULT_ITEM_HEIGHT` and private `List.state` access.
  - IntersectionObserver root isn’t tied to the virtualized list container.
- Fixes:
  1. Dynamic Heights:
     - Implement item measurement for `VariableSizeList`:
       - Wrap each item with a `ref` that measures `offsetHeight` and caches to `itemHeights.current[index]`.
       - Call `virtualListRef.current?.resetAfterIndex(index, false)` when heights change.
       - Debounce batched updates for performance.
     - Keep a conservative min height to avoid thrash.
  2. At-Bottom Detection Without Private State:
     - Rely on `onScroll`’s `scrollOffset` and known viewport height to compute bottom proximity; do not read `virtualListRef.current.state`.
  3. IntersectionObserver Root:
     - Provide `outerRef` to the `List` and capture its element; use that as `IntersectionObserver` root (for non-viewport detection inside shadow DOM).
  4. API Surface:
     - Keep `virtualizationThreshold` prop; tune `OVERSCAN_COUNT` for smoothness (e.g., 6–10).
- Tests:
  - Extend virtualization tests to assert dynamic height recalculation and bottom detection with `outerRef`.
- Acceptance:
  - Smooth scrolling with 1k–2k messages; dynamic content height changes are respected; no private state access.

---

## 5) Testing Improvements (Warnings, Robustness)

- Goal: Eliminate `act(...)` warnings and improve reliability.
- Actions:
  - Prefer `@testing-library/user-event` over `fireEvent` for interactive flows; await async operations.
  - Where setState follows an event (e.g., copy tooltips, send actions), ensure tests await the resulting microtask (`waitFor`/`findByRole`/`findByText`).
  - Keep `vi.useFakeTimers()`-based tests explicit; advance timers where expected.
- Acceptance:
  - No `act(...)` warnings in Stage 2 component test runs.

---

## 6) Accessibility Polish

- Ensure aria semantics are consistent within shadow DOM and with virtualization:
  - `MessageList` virtualized container reflects `role="log"`/`aria-live="polite"` on the effective scrolling element.
  - Maintain accessible names for controls (`IconButton` tooltips double as labels; confirm via tests).
  - Verify keyboard flow: focus order within `ChatInput` and header controls; Esc still closes sidebar.
- Tests:
  - Add assertions for `outerRef` container’s a11y attributes in virtual mode.

---

## 7) Performance Tuning

- Overscan: Revisit `OVERSCAN_COUNT` for typical laptop viewports; target ~1–1.5 screens of buffer.
- Throttling/Debounce: Keep the 50ms scroll throttle; consider `requestAnimationFrame` for scroll UI state updates.
- Memoization: Confirm `memoizedMessages` is only used in non-virtual mode; ensure `MessageBubble` is pure where feasible.
- CSS: Prefer CSS transitions disabled during first paint of theme application (already present with `.no-transitions`).
- Acceptance: No jank on rapid message appends; low CPU during idle scroll.

---

## 8) Optional: Wire Mock Chat for Demo Flow

- Option A (UI-only demo): On send, generate a streaming assistant response using `src/utils/mockChat.ts` and render via `StreamingText` in `MessageBubble` for assistant messages.
- Option B (Keep minimal): Maintain current user-only append to stay focused on Stage 2 UI; defer AI plumbing to Stage 4.
- If A:
  - Add a `useMockChat()` hook to orchestrate `sendUserMessage` → `enqueueMockResponse` with streaming callbacks that update the chat store.
  - Acceptance: Demo shows end-to-end (user send + streamed assistant) without external API.

---

## 9) Theming Consistency

- Ensure `ChatPanel` styles use CSS variables from `variables.css` (e.g., border, background, text colors) rather than hard-coded hex values.
- Confirm `ThemeProvider` + `useSettingsStore` updates set `data-theme` on `.ai-sidebar-container` or equivalent root.
- Acceptance: Visual parity in light/dark modes; smooth transitions with no flashes.

---

## 10) Code Cleanliness & Structure

- Remove any reliance on private internals (react-window state references).
- Keep file naming and aliases consistent (`@/…`, `@components/…`).
- Avoid leaking styles outside shadow DOM; centralize sidebar styles.
- Document props and public interfaces in component headers.

---

## 11) Rollout Plan & Estimates

- P0 (0.5–1 day):
  - Mount `ChatPanel` + `ThemeProvider` in sidebar.
  - Docs status sync.
- P1 (1.5–2.5 days):
  - Extract inline CSS → shadow-root-friendly styles.
  - Virtualization fixes: dynamic heights, `outerRef`, at-bottom logic.
  - Test warning cleanup (`userEvent`, awaits).
- P2 (1–2 days):
  - A11y polish, perf tuning, optional mock chat wiring, theming variable sweep.

---

## 12) Acceptance Checklist

- [ ] ChatPanel mounted in `Sidebar.tsx` with ThemeProvider.
- [ ] Docs reflect consistent Stage 2 status.
- [ ] No component-level style injection into `document.head`.
- [ ] Virtualized list uses dynamic heights and `outerRef`; no private state access.
- [ ] No `act(...)` warnings in component tests; tests pass locally.
- [ ] A11y attributes preserved in both regular and virtual modes.
- [ ] Smooth performance with large message sets; reasonable overscan.
- [ ] Theming uses CSS variables and switches correctly.
- [ ] (Optional) Demo streaming via `mockChat` works.

---

## 13) References

- Sidebar mounting: `src/sidebar/Sidebar.tsx`
- Chat UI: `src/components/Chat/*`
- State: `src/store/*`
- Theme: `src/contexts/ThemeContext.tsx`, `src/styles/variables.css`
- Styles: `src/styles/components.css`, `src/styles/globals.css`
- Tests: `tests/components/Chat/*`, `tests/contexts/*`, `tests/store/*`
- Virtualization: `MessageList`, `tests/components/Chat/MessageList.virtualization.test.tsx`
