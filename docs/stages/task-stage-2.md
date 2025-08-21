# AI Browser Sidebar Extension - STAGE 2: CHAT PANEL UI

## Project Overview

Building a privacy-focused browser extension that enables AI-powered chat with web content using BYOK (Bring Your Own Key) model. The project follows a UI-first approach with Test-Driven Development (TDD) methodology.

Architecture: The extension uses ONLY a custom injected React sidebar (no popup, no Chrome sidepanel) for universal browser compatibility. The sidebar is resizable (300-800px width), draggable, and injected by the content script. Communication flow: Extension Icon Click → Background Service Worker → Content Script → Sidebar React App.

## Execution Guidelines for Sub-Agents

- **Follow TDD cycle**: Write tests first (RED) → Implement code (GREEN) → Refactor (REFACTOR)
- Each task is self-contained with clear test requirements and deliverables
- Tasks marked with 🔄 can be executed in parallel
- Tasks marked with ⚡ must be executed sequentially
- Tasks marked with 🧪 require test-first development
- Check prerequisites before starting any task
- Create interface contracts for components that will integrate
- Write TypeScript with strict mode enabled
- Use functional React components with hooks
- Implement proper error boundaries and handling

## TDD Strategy

- **Unit Tests**: For all utility functions and business logic (Vitest)
- **Component Tests**: For all React components (React Testing Library)
- **Integration Tests**: For message passing and API interactions
- **E2E Tests**: For critical user journeys (Playwright)

## Progress Tracking

- [x] Stage 1: Extension Infrastructure (15/15 tasks) ✅ COMPLETED
- [x] Stage 2: Chat Panel UI (24/24 tasks) ✅ COMPLETED
- [ ] Stage 3: Storage & Security (0/18 tasks)
- [ ] Stage 4: AI Provider System (0/22 tasks)
- [ ] Stage 5: Tab Content Extraction (0/21 tasks)

**Total Progress: 39/100 tasks**

---

## STAGE 2: CHAT PANEL UI

Deliverable highlight: Complete React-based chat interface within the custom sidebar container. Chat UI with message display, markdown rendering, streaming text, theme system, and Zustand state management. All components mount inside existing Sidebar.tsx from Stage 1.

### Phase 2.1: UI Foundation

**Synchronization Point: Design system must be established first**

🔄 **Parallelizable Tasks:**

- [x] **Task 2.1.1a** - Tailwind Configuration 🧪
  - Prerequisites: Task 1.1.1b
  - Tests First:
    - Test Tailwind config is valid
    - Test custom theme values work
  - Description: Setup Tailwind with custom theme
  - Deliverables:
    - `tailwind.config.js` with theme
    - Custom color palette
    - Typography scale
  - Acceptance: Tailwind classes work

- [x] **Task 2.1.1b** - CSS Variables and Theme System 🧪
  - Prerequisites: Task 2.1.1a
  - Tests First:
    - Test CSS variables are defined
    - Test theme switching changes variables
  - Description: Create CSS variable system
  - Deliverables:
    - `src/styles/variables.css`
    - Light theme variables
    - Dark theme variables
  - Acceptance: CSS variables apply correctly

- [x] **Task 2.1.1c** - Base Component Styles
  - Prerequisites: Task 2.1.1b
  - Description: Create base component styles
  - Deliverables:
    - `src/styles/components.css`
    - Button styles
    - Input styles
    - Card styles
  - Acceptance: Base styles render correctly

- [x] **Task 2.1.2a** - Zustand Store Setup 🧪
  - Prerequisites: Task 1.2.2
  - Tests First:
    - Test store initialization
    - Test state updates
    - Test subscriptions work
  - Description: Configure Zustand stores
  - Deliverables:
    - `src/store/index.ts` - Store setup
    - `tests/store/index.test.ts`
  - Acceptance: Store manages state

- [x] **Task 2.1.2b** - Chat Store Implementation 🧪
  - Prerequisites: Task 2.1.2a
  - Tests First:
    - Test message addition
    - Test message deletion
    - Test conversation clearing
  - Description: Create chat-specific store
  - Deliverables:
    - `src/store/chat.ts` - Chat state
    - `tests/store/chat.test.ts`
    - Message management actions
  - Acceptance: Chat state updates correctly

- [x] **Task 2.1.2c** - Settings Store Implementation 🧪
  - Prerequisites: Task 2.1.2a
  - Tests First:
    - Test settings persistence
    - Test default values
    - Test migrations
  - Description: Create settings store
  - Deliverables:
    - `src/store/settings.ts` - Settings state
    - `tests/store/settings.test.ts`
  - Acceptance: Settings persist correctly

### Phase 2.2: Base Components

**Synchronization Point: Base components needed for complex ones**

🔄 **Parallelizable Tasks:**

- [x] **Task 2.2.1a** - Button Component 🧪
  - Prerequisites: Task 2.1.1c
  - Tests First:
    - Test button renders
    - Test click handler fires
    - Test disabled state
    - Test loading state
  - Description: Create reusable button component
  - Deliverables:
    - `src/components/ui/Button.tsx`
    - `tests/components/ui/Button.test.tsx`
  - Acceptance: Button works in all states

- [x] **Task 2.2.1b** - Input Component 🧪
  - Prerequisites: Task 2.1.1c
  - Tests First:
    - Test input renders
    - Test value changes
    - Test validation
    - Test error states
  - Description: Create input component
  - Deliverables:
    - `src/components/ui/Input.tsx`
    - `tests/components/ui/Input.test.tsx`
  - Acceptance: Input handles all cases

- [x] **Task 2.2.1c** - Card Component 🧪
  - Prerequisites: Task 2.1.1c
  - Tests First:
    - Test card renders
    - Test content projection
    - Test hover states
  - Description: Create card container component
  - Deliverables:
    - `src/components/ui/Card.tsx`
    - `tests/components/ui/Card.test.tsx`
  - Acceptance: Card displays content

- [x] **Task 2.2.1d** - IconButton Component 🧪
  - Prerequisites: Task 2.2.1a
  - Tests First:
    - Test icon renders
    - Test tooltip shows
    - Test sizes work
  - Description: Create icon button component
  - Deliverables:
    - `src/components/ui/IconButton.tsx`
    - `tests/components/ui/IconButton.test.tsx`
  - Acceptance: Icon buttons work

- [x] **Task 2.2.1e** - Spinner Component 🧪
  - Prerequisites: Task 2.1.1c
  - Tests First:
    - Test spinner renders
    - Test animation classes
    - Test sizes
  - Description: Create loading spinner
  - Deliverables:
    - `src/components/ui/Spinner.tsx`
    - `tests/components/ui/Spinner.test.tsx`
  - Acceptance: Spinner animates

### Phase 2.3: Chat Components

**Synchronization Point: All components integrate in Phase 2.4**

🔄 **Parallelizable Tasks:**

- [x] **Task 2.3.1a** - Message Type Definitions 🧪
  - Prerequisites: Task 1.1.2a
  - Tests First:
    - Test type definitions compile
    - Test type guards work
  - Description: Define message types
  - Deliverables:
    - `src/types/chat.ts` - Chat types
    - Type guards for messages
  - Acceptance: Types are comprehensive

- [x] **Task 2.3.1b** - Message Bubble Component 🧪
  - Prerequisites: Task 2.3.1a, Task 2.2.1c
  - Tests First:
    - Test user message renders
    - Test AI message renders
    - Test timestamp displays
  - Description: Create message bubble
  - Deliverables:
    - `src/components/Chat/MessageBubble.tsx`
    - `tests/components/Chat/MessageBubble.test.tsx`
  - Acceptance: Messages display correctly

- [x] **Task 2.3.1c** - Markdown Renderer 🧪
  - Prerequisites: Task 2.3.1b
  - Tests First:
    - Test markdown parsing
    - Test code blocks render
    - Test links work
    - Test XSS prevention
  - Description: Integrate react-markdown
  - Deliverables:
    - `src/components/Chat/MarkdownRenderer.tsx`
    - `tests/components/Chat/MarkdownRenderer.test.tsx`
    - Custom renderers
  - Acceptance: Markdown renders safely

- [x] **Task 2.3.1d** - Code Block Component 🧪
  - Prerequisites: Task 2.3.1c
  - Tests First:
    - Test syntax highlighting
    - Test copy button
    - Test language detection
  - Description: Create code block with highlighting
  - Deliverables:
    - `src/components/Chat/CodeBlock.tsx`
    - `tests/components/Chat/CodeBlock.test.tsx`
  - Acceptance: Code highlights correctly

- [x] **Task 2.3.2a** - Message List Container 🧪
  - Prerequisites: Task 2.3.1b
  - Tests First:
    - Test message rendering
    - Test scrolling behavior
    - Test empty state
  - Description: Create scrollable message list
  - Deliverables:
    - `src/components/Chat/MessageList.tsx`
    - `tests/components/Chat/MessageList.test.tsx`
  - Acceptance: List scrolls correctly

- [x] **Task 2.3.2b** - Virtual Scrolling 🧪
  - Prerequisites: Task 2.3.2a
  - Tests First:
    - Test virtualization with 1000+ items
    - Test scroll position preservation
  - Description: Add virtual scrolling for performance
  - Deliverables:
    - Virtual scrolling integration
    - Performance optimizations
  - Acceptance: Handles 1000+ messages smoothly

- [x] **Task 2.3.3a** - TextArea Component 🧪
  - Prerequisites: Task 2.2.1b
  - Tests First:
    - Test multi-line input
    - Test auto-resize
    - Test max height
  - Description: Create auto-resizing textarea
  - Deliverables:
    - `src/components/ui/TextArea.tsx`
    - `tests/components/ui/TextArea.test.tsx`
  - Acceptance: TextArea resizes properly

- [x] **Task 2.3.3b** - Chat Input Component 🧪
  - Prerequisites: Task 2.3.3a
  - Tests First:
    - Test message submission
    - Test keyboard shortcuts
    - Test disabled during send
  - Description: Create chat input with controls
  - Deliverables:
    - `src/components/Chat/ChatInput.tsx`
    - `tests/components/Chat/ChatInput.test.tsx`
  - Acceptance: Input handles all interactions

- [x] **Task 2.3.4a** - Streaming Text Component 🧪
  - Prerequisites: Task 2.3.1b
  - Tests First:
    - Test token-by-token rendering
    - Test cursor animation
    - Test completion detection
  - Description: Create streaming text display
  - Deliverables:
    - `src/components/Chat/StreamingText.tsx`
    - `tests/components/Chat/StreamingText.test.tsx`
  - Acceptance: Smooth streaming display

- [x] **Task 2.3.4b** - Typing Indicator 🧪
  - Prerequisites: Task 2.2.1e
  - Tests First:
    - Test animation
    - Test show/hide logic
  - Description: Create typing indicator
  - Deliverables:
    - `src/components/Chat/TypingIndicator.tsx`
    - `tests/components/Chat/TypingIndicator.test.tsx`
  - Acceptance: Indicator animates

### Phase 2.4: UI Integration

**Synchronization Point: Complete UI ready for testing**

⚡ **Sequential Tasks:**

- [x] **Task 2.4.1** - Chat Panel Layout 🧪
  - Prerequisites: All Phase 2.3 tasks
  - Tests First:
    - Test layout structure
    - Test responsive behavior
    - Test component integration
  - Description: Assemble chat components
  - Deliverables:
    - `src/components/Chat/ChatPanel.tsx`
    - `tests/components/Chat/ChatPanel.test.tsx`
    - Header, body, footer sections
  - Acceptance: Complete chat UI works

- [x] **Task 2.4.2** - Theme Provider 🧪
  - Prerequisites: Task 2.4.1
  - Tests First:
    - Test theme switching
    - Test persistence
    - Test system detection
  - Description: Implement theme context
  - Deliverables:
    - `src/contexts/ThemeContext.tsx`
    - `tests/contexts/ThemeContext.test.tsx`
    - Theme toggle component
  - Acceptance: Themes switch correctly

- [x] **Task 2.4.3** - Mock Chat System 🧪
  - Prerequisites: Task 2.4.1
  - Tests First:
    - Test mock message generation
    - Test streaming simulation
  - Description: Create mock chat for testing
  - Deliverables:
    - `src/utils/mockChat.ts`
    - `tests/utils/mockChat.test.ts`
    - Mock conversations
  - Acceptance: Can demo full chat flow

---

## Synchronization Points

### Critical Review Points:

1. **After Phase 2.1**: Design system and state management ready
2. **After Phase 2.2**: Base components tested and reusable
3. **After Phase 2.3**: All chat components functional
4. **After Phase 2.4**: Complete UI integrated and tested

### Test Coverage Requirements:

- Unit Tests: > 90% coverage
- Component Tests: All components tested
- Integration Tests: All component interactions tested
- UI Tests: Theme switching and responsive design tested

## Risk Mitigation

### Testing Strategy:

1. **Component Tests First**: Write failing tests before implementation
2. **Mock External Dependencies**: Mock Chrome APIs, state stores
3. **Component Isolation**: Test components in isolation with React Testing Library
4. **Integration Testing**: Test component interactions and state flow
5. **Visual Testing**: Test theme switching and responsive behavior

### Potential Blockers:

1. **React Testing**: Use React Testing Library best practices
2. **State Management**: Use proper Zustand testing patterns
3. **Theme Testing**: Mock CSS variable changes
4. **Component Integration**: Test component communication
5. **Performance Testing**: Test virtual scrolling with large datasets

## Completion Criteria

### Task Completion:

- [x] All tests written and passing
- [x] Component implementation complete
- [x] Props and interfaces documented
- [x] Accessibility attributes added
- [x] No linting errors

### Stage Completion:

- [x] All 24 tasks marked complete
- [x] Integration tests pass
- [x] Test coverage > 90%
- [x] Theme system functional
- [x] Mock chat system works
- [x] Performance benchmarks met
- [x] Accessibility tests pass

---

_Task Blueprint Version: 2.0 (TDD Edition)_  
_Stage 2 Tasks: 24_  
_Test-First Tasks: 21 (88%)_  
_Parallelizable: 17 (71%)_  
_Sequential: 7 (29%)_  
_Estimated Parallel Execution Paths: 4_

---

# Refactoring Blueprint (Merged from task.md) — Completed

This section consolidates the full refactoring blueprint previously tracked in `task.md`. All tasks are complete and the Stage 2 UI now lives under `src/sidebar/` with Shadow DOM overlay preserved.

## Project Overview

Goal: Refactor the existing sidebar/chat panel into a unified, clean architecture under `/src/sidebar/` while preserving critical overlay functionality and adding a model selector feature.

Critical Constraint: The sidebar remains an overlay on top of websites using Shadow DOM isolation, fixed positioning, and high z-index. This functionality is working and must not be broken.

Target Design: Clean, minimal chat interface matching the provided design (`/image.png`) with integrated model selector.

Development Methodology: Test-Driven Development (TDD) - Write tests first (RED) → Implement code (GREEN) → Refactor (REFACTOR)

## Execution Guidelines

- Follow TDD cycle strictly
- Tasks marked with 🔄 can run in parallel; ⚡ are sequential
- 🧪 indicates test-first development
- Do not modify Shadow DOM or overlay positioning logic
- Preserve resize and drag functionality
- Minimum test coverage: 90% for new code

## Progress Tracking

- [x] Phase 0: Test Migration & Preparation (4/4 tasks)
- [x] Phase 1: Directory Restructuring (5/5 tasks) ✅ COMPLETED
- [x] Phase 2: Component Consolidation (4/4 tasks) ✅ COMPLETED
- [x] Phase 3: Style Unification (4/4 tasks) ✅ COMPLETED
- [x] Phase 4: Model Selector Implementation (4/4 tasks) ✅ COMPLETED
- [x] Phase 5: Integration & Testing (3/3 tasks) ✅ COMPLETED

Total Progress: 23/23 tasks ✅ ALL TASKS COMPLETED

---

## PHASE 0: TEST MIGRATION & PREPARATION

Synchronization Point: Existing tests must be updated before refactoring begins

🔄 Task 0.1 - Audit & Categorize Existing Tests 🧪

- Review all tests in `/tests/` and categorize them (Keep & Update, Remove, Migrate)
- Deliverables: Test audit document and migration list

🔄 Task 0.2 - Create Test Migration Script 🧪

- `/scripts/migrate-tests.js` to update import paths for new structure

⚡ Task 0.3 - Backup Existing Tests

- Create `/tests.backup/` directory with all current tests

⚡ Task 0.4 - Create Test Structure for New Architecture

- Create `/tests/sidebar/{components,components/ui,hooks,styles}/`

---

## PHASE 1: DIRECTORY RESTRUCTURING

Synchronization Point: All components must be moved before consolidation begins

🔄 Task 1.1 - Move Chat Components 🧪

- Move `/src/components/Chat/*` → `/src/sidebar/components/`

🔄 Task 1.2 - Move UI Components 🧪

- Move `/src/components/ui/*` → `/src/sidebar/components/ui/`

🔄 Task 1.3 - Move Hooks 🧪

- Move `/src/hooks/useMockChat.ts` → `/src/sidebar/hooks/`

🔄 Task 1.4 - Consolidate Styles

- Move `/src/styles/*` (chat related) → `/src/sidebar/styles/`

⚡ Task 1.5 - Remove Demo Components

- Delete `/src/components/demo/`

---

## PHASE 2: COMPONENT CONSOLIDATION

Synchronization Point: Core refactoring - preserve overlay

⚡ Task 2.1 - Create Unified ChatPanel Component 🧪

- Merge `Sidebar.tsx` and `ChatPanel.tsx` into `/src/sidebar/ChatPanel.tsx`
- Preserve: resize, drag, Shadow DOM mounting, overlay positioning

⚡ Task 2.2 - Simplify ChatInput Component 🧪

- Remove auxiliary buttons; keep send, clear, textarea

⚡ Task 2.3 - Update Component Imports 🧪

- Use `@/sidebar/...` or relative paths consistently

⚡ Task 2.4 - Update index.tsx Mount Logic 🧪

- Mount unified ChatPanel; keep Shadow DOM implementation unchanged

---

## PHASE 3: STYLE UNIFICATION

🔄 Task 3.1 - Create Unified Stylesheet 🧪

- Merge all CSS into `src/sidebar/styles/sidebar.css`
- Preserve overlay criticals: `z-index: 2147483647`, `position: fixed`, pointer-events, Shadow DOM overrides

🔄 Task 3.2 - Remove Old Style Files

- Delete legacy CSS files migrated in 3.1

⚡ Task 3.3 - Update Style Imports

- Sidebar imports single unified stylesheet

⚡ Task 3.4 - Mimic Design

- Match `/image.png` styling; ignore non-essential buttons

---

## PHASE 4: MODEL SELECTOR IMPLEMENTATION

🔄 Task 4.1 - ModelSelector Component 🧪 → `src/sidebar/components/ModelSelector.tsx`
Interface:

```ts
interface ModelSelectorProps {
  value: string;
  onChange: (model: string) => void;
  disabled?: boolean;
}
```

🔄 Task 4.2 - Update Settings Store 🧪 → `src/store/settings.ts`
Interface additions:

```ts
interface Model {
  id: string;
  name: string;
  provider: string;
  available: boolean;
}
```

Fields: `selectedModel: string`, `availableModels: Model[]`

⚡ Task 4.3 - Integrate ModelSelector into Header 🧪

- Render in ChatPanel header; connect to store

⚡ Task 4.4 - Style ModelSelector 🧪

- Dark/light, hover/focus, visual parity with design

---

## PHASE 5: INTEGRATION & TESTING

⚡ Task 5.1 - Comprehensive Integration Testing 🧪

- E2E lifecycle, overlay behavior, resize/drag, selector persistence, Shadow DOM, messaging

⚡ Task 5.2 - Update Path Aliases and Coverage 🧪

- Ensure `@sidebar/*` paths; coverage >90%

⚡ Task 5.3 - Documentation Updates

- Update docs and tests README; document TDD approach and new organization

---

## Risk Mitigation

Critical to preserve: Shadow DOM, overlay z-index/positioning, resize/drag handlers, chrome.runtime messaging

Potential blockers: Import paths, style conflicts within Shadow DOM, state wiring, CSS variables

Rollback: Commit per phase, test after each, revert phase if needed

---

## TDD Metrics and Completion Criteria

- Unit/Integration/E2E/Visual/Performance coverage; >90% for new code
- Overall success: unified `/src/sidebar/`, integrated model selector, consolidated styles, clean imports, overlay parity, all tests passing, no regressions
