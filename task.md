# AI Browser Sidebar Extension - REFACTORING TASK BLUEPRINT

## Project Overview

**Goal**: Refactor the existing sidebar/chat panel into a unified, clean architecture under `/src/sidebar/` while preserving critical overlay functionality and adding a model selector feature.

**Critical Constraint**: The sidebar MUST remain as an overlay on top of websites using Shadow DOM isolation, fixed positioning, and high z-index. This functionality is working correctly and must not be broken.

**Target Design**: Clean, minimal chat interface matching the provided design @image.png with integrated model selector.

**Development Methodology**: Test-Driven Development (TDD) - Write tests first (RED) → Implement code (GREEN) → Refactor (REFACTOR)

## Execution Guidelines for Sub-Agents

- **Follow TDD cycle**: Write failing tests first for each task
- Tasks marked with 🔄 can be executed in parallel
- Tasks marked with ⚡ must be executed sequentially
- Tasks marked with 🧪 require test-first development
- Check prerequisites before starting any task
- Create interface contracts for components that will integrate
- Test each task independently before marking complete
- DO NOT modify Shadow DOM implementation or overlay positioning logic
- Preserve all resize and drag functionality
- Minimum test coverage: 90% for new code, maintain existing coverage

## Progress Tracking

- [x] Phase 0: Test Migration & Preparation (4/4 tasks)
- [x] Phase 1: Directory Restructuring (5/5 tasks) ✅ COMPLETED
- [x] Phase 2: Component Consolidation (4/4 tasks) ✅ COMPLETED
- [x] Phase 3: Style Unification (4/4 tasks) ✅ COMPLETED
- [ ] Phase 4: Model Selector Implementation (0/4 tasks)
- [ ] Phase 5: Integration & Testing (0/3 tasks)

**Total Progress: 17/23 tasks**

---

## PHASE 0: TEST MIGRATION & PREPARATION

**Synchronization Point: Existing tests must be updated before refactoring begins**

### 🔄 Parallelizable Tasks:

- [x] **Task 0.1** - Audit & Categorize Existing Tests 🧪
  - Prerequisites: None
  - Description: Review all tests in `/tests/` and categorize them
  - Categories:
    - **Keep & Update**: Tests that will need path updates after refactoring
    - **Remove**: Tests for demo components that will be deleted
    - **Migrate**: Tests that need to move to new locations
  - Deliverables:
    - Test audit document listing all tests and their fate
    - List of tests to keep:
      - `/tests/components/Chat/*.test.tsx` → Will move to `/tests/sidebar/components/`
      - `/tests/components/ui/*.test.tsx` → Will move to `/tests/sidebar/components/ui/`
      - `/tests/sidebar/*.test.tsx` → Will be updated for unified component
      - `/tests/store/*.test.ts` → Keep as-is
    - List of tests to remove:
      - Any tests for demo components
  - Acceptance: Complete audit document created

- [x] **Task 0.2** - Create Test Migration Script 🧪
  - Prerequisites: Task 0.1 complete
  - Description: Write a script to automatically update import paths in tests
  - Script should:
    - Update imports from `@/components/Chat/` to `@/sidebar/components/`
    - Update imports from `@/components/ui/` to `@/sidebar/components/ui/`
    - Update imports from `@/hooks/` to `@/sidebar/hooks/`
  - Deliverables:
    - `/scripts/migrate-tests.js` - automated test migration script
  - Acceptance: Script can update all test imports correctly

### ⚡ Sequential Tasks:

- [x] **Task 0.3** - Backup Existing Tests
  - Prerequisites: Task 0.1 complete
  - Description: Create backup of all existing tests before migration
  - Deliverables:
    - `/tests.backup/` directory with all current tests
  - Acceptance: All tests backed up successfully

- [x] **Task 0.4** - Create Test Structure for New Architecture
  - Prerequisites: Task 0.2 complete
  - Description: Set up new test directory structure
  - Create directories:
    - `/tests/sidebar/components/`
    - `/tests/sidebar/components/ui/`
    - `/tests/sidebar/hooks/`
    - `/tests/sidebar/styles/`
  - Deliverables:
    - New test directory structure created
  - Acceptance: All new directories exist

---

## PHASE 1: DIRECTORY RESTRUCTURING

**Synchronization Point: All components must be moved before consolidation begins**

### 🔄 Parallelizable Tasks:

- [x] **Task 1.1** - Move Chat Components 🧪
  - Prerequisites: None
  - Tests First:
    - Write integration tests that verify components work in new location
    - Test import resolution from new paths
    - Test that all component exports are accessible
  - Description: Move all chat components from `/src/components/Chat/` to `/src/sidebar/components/`
  - Files to move:
    - `ChatInput.tsx`
    - `ChatPanel.tsx`
    - `MessageList.tsx`
    - `MessageBubble.tsx`
    - `StreamingText.tsx`
    - `TypingIndicator.tsx`
    - `MarkdownRenderer.tsx`
    - `CodeBlock.tsx`
    - `index.ts`
  - Test Deliverables:
    - `/tests/sidebar/components/imports.test.ts` - verify all imports work
  - Deliverables: All files relocated with updated import paths
  - Acceptance: All tests pass, components compile without errors

- [x] **Task 1.2** - Move UI Components 🧪
  - Prerequisites: None
  - Tests First:
    - Write tests for UI component imports from new location
    - Test component rendering with existing props
    - Verify no style regressions
  - Description: Move UI components from `/src/components/ui/` to `/src/sidebar/components/ui/`
  - Files to move:
    - `Button.tsx`
    - `Card.tsx`
    - `IconButton.tsx`
    - `Input.tsx`
    - `Spinner.tsx`
    - `TextArea.tsx`
    - `index.ts`
  - Test Deliverables:
    - `/tests/sidebar/components/ui/imports.test.ts` - verify UI imports
  - Deliverables: All UI components relocated with updated imports
  - Acceptance: All tests pass, no broken imports

- [x] **Task 1.3** - Move Hooks 🧪
  - Prerequisites: None
  - Tests First:
    - Write test for useMockChat hook in new location
    - Test hook integration with chat store
    - Verify streaming functionality
  - Description: Move `useMockChat.ts` from `/src/hooks/` to `/src/sidebar/hooks/`
  - Test Deliverables:
    - `/tests/sidebar/hooks/useMockChat.test.ts` - hook functionality tests
  - Deliverables: Hook relocated with updated imports
  - Acceptance: All hook tests pass in new location

- [x] **Task 1.4** - Consolidate Styles
  - Prerequisites: None
  - Tests First:
    - Write visual regression tests for current styles
    - Create style import tests
  - Description: Move all CSS files to `/src/sidebar/styles/`
  - Files to move:
    - `/src/styles/chat-input.css`
    - `/src/styles/chat-panel.css`
    - `/src/styles/icon-button.css`
  - Test Deliverables:
    - `/tests/sidebar/styles/imports.test.ts` - verify style loading
  - Deliverables: All styles in unified location
  - Acceptance: Visual tests pass, styles load correctly

### ⚡ Sequential Task:

- [x] **Task 1.5** - Remove Demo Components
  - Prerequisites: Tasks 1.1, 1.2 complete
  - Description: Delete `/src/components/demo/` folder and its contents
  - Deliverables: Demo folder removed
  - Acceptance: No broken imports, build succeeds

---

## PHASE 2: COMPONENT CONSOLIDATION

**Synchronization Point: Core refactoring - must be done carefully to preserve overlay**

### ⚡ Sequential Tasks:

- [x] **Task 2.1** - Create Unified ChatPanel Component 🧪
  - Prerequisites: Phase 1 complete
  - Tests First:
    - Write tests for overlay positioning (z-index, fixed position)
    - Test resize handle functionality (min/max width constraints)
    - Test drag functionality (position updates)
    - Test Shadow DOM isolation
    - Test component mounting/unmounting
  - Description: Merge `Sidebar.tsx` and `ChatPanel.tsx` into single `ChatPanel.tsx`
  - Critical Requirements:
    - PRESERVE resize handle functionality
    - PRESERVE drag functionality
    - PRESERVE Shadow DOM mounting
    - PRESERVE overlay positioning (fixed, z-index)
    - PRESERVE 85% height, centered positioning
  - Test Deliverables:
    - `/tests/sidebar/ChatPanel.test.tsx` - comprehensive component tests
    - `/tests/sidebar/ChatPanel.overlay.test.tsx` - overlay behavior tests
    - `/tests/sidebar/ChatPanel.resize.test.tsx` - resize functionality tests
    - `/tests/sidebar/ChatPanel.drag.test.tsx` - drag functionality tests
  - Deliverables:
    - `/src/sidebar/ChatPanel.tsx` - unified component
    - Remove old `ChatPanel.tsx` from components folder
  - Interface Contract:
    ```typescript
    interface ChatPanelProps {
      className?: string;
      onClose: () => void;
    }
    ```
  - Acceptance: All tests pass, overlay behavior preserved

- [x] **Task 2.2** - Simplify ChatInput Component 🧪
  - Prerequisites: Task 2.1 complete
  - Tests First:
    - Update existing ChatInput tests to remove utility button tests
    - Test that only send and clear buttons remain
    - Test keyboard shortcuts still work
    - Test textarea functionality preserved
  - Description: Remove utility buttons (attach, voice, settings) from ChatInput
  - Keep: Send button, clear button, textarea
  - Remove: AttachIcon, VoiceIcon, SettingsIcon components and buttons
  - Test Deliverables:
    - Updated `/tests/sidebar/components/ChatInput.test.tsx`
  - Deliverables: Simplified `/src/sidebar/components/ChatInput.tsx`
  - Acceptance: All updated tests pass, only essential controls visible

- [x] **Task 2.3** - Update Component Imports 🧪
  - Prerequisites: Tasks 2.1, 2.2 complete
  - Tests First:
    - Write import resolution tests for all components
    - Test build process with new imports
  - Description: Update all import paths to use new `/src/sidebar/` structure
  - Files to update:
    - All components in `/src/sidebar/components/`
    - `/src/sidebar/index.tsx`
    - Store files that import components
  - Test Deliverables:
    - `/tests/sidebar/imports.integration.test.ts`
  - Deliverables: All imports use `@/sidebar/` or relative paths
  - Acceptance: Import tests pass, build succeeds

- [x] **Task 2.4** - Update index.tsx Mount Logic 🧪
  - Prerequisites: Task 2.3 complete
  - Tests First:
    - Test Shadow DOM creation and mounting
    - Test style injection into Shadow DOM
    - Test component unmounting and cleanup
  - Description: Update `/src/sidebar/index.tsx` to mount new unified ChatPanel
  - Critical: DO NOT change Shadow DOM implementation
  - Test Deliverables:
    - Updated `/tests/sidebar/mount-unmount.test.tsx`
  - Deliverables: Updated mounting logic for ChatPanel
  - Acceptance: Shadow DOM tests pass, sidebar mounts correctly

---

## PHASE 3: STYLE UNIFICATION

**Synchronization Point: Styles must be consolidated before adding new features**

### 🔄 Parallelizable Tasks:

- [x] **Task 3.1** - Create Unified Stylesheet 🧪
  - Prerequisites: Phase 2 complete
  - Tests First:
    - Write visual regression tests for current appearance
    - Test critical overlay styles (z-index, position, pointer-events)
    - Test theme variables work correctly
    - Test Shadow DOM style injection
  - Description: Merge all CSS into single `/src/sidebar/styles/sidebar.css`
  - Merge from:
    - `sidebar.css` (preserve overlay styles!)
    - `chat-panel.css`
    - `chat-input.css`
    - `icon-button.css`
  - Critical styles to preserve:
    ```css
    z-index: 2147483647
    position: fixed
    pointer-events management
    Shadow DOM overrides
    ```
  - Test Deliverables:
    - `/tests/sidebar/styles/unified.test.ts` - style integration tests
    - `/tests/sidebar/styles/overlay.test.ts` - overlay style tests
  - Deliverables: Single unified `sidebar.css`
  - Acceptance: All style tests pass, visual regression tests pass

- [x] **Task 3.2** - Remove Old Style Files
  - Prerequisites: Task 3.1 complete
  - Description: Delete old CSS files after merging
  - Files to remove:
    - `/src/styles/chat-input.css`
    - `/src/styles/chat-panel.css`
    - `/src/styles/icon-button.css`
  - Deliverables: Old files removed
  - Acceptance: No broken style imports

### ⚡ Sequential Task:

- [x] **Task 3.3** - Update Style Imports
  - Prerequisites: Tasks 3.1, 3.2 complete
  - Description: Update `/src/sidebar/index.tsx` to import only unified stylesheet
  - Remove multiple style imports, use single import
  - Deliverables: Simplified style imports
  - Acceptance: Styles load correctly in Shadow DOM

- [x] **Task 3.4** - Mimic Style
  - @image.png in root dir is the desire style, mimic it! ignore function buttons

---

## PHASE 4: MODEL SELECTOR IMPLEMENTATION

**Synchronization Point: New feature addition**

### 🔄 Parallelizable Tasks:

- [ ] **Task 4.1** - Create ModelSelector Component 🧪
  - Prerequisites: Phase 3 complete
  - Tests First:
    - Test component renders with mock models
    - Test dropdown open/close behavior
    - Test model selection changes
    - Test disabled state
    - Test keyboard navigation
  - Description: Create dropdown component for AI model selection
  - Mock models: GPT-4, GPT-3.5, Claude 3, Claude 2, Gemini Pro, Llama 2
  - Test Deliverables:
    - `/tests/sidebar/components/ModelSelector.test.tsx`
  - Deliverables: `/src/sidebar/components/ModelSelector.tsx`
  - Interface Contract:
    ```typescript
    interface ModelSelectorProps {
      value: string;
      onChange: (model: string) => void;
      disabled?: boolean;
    }
    ```
  - Acceptance: All component tests pass

- [ ] **Task 4.2** - Update Settings Store 🧪
  - Prerequisites: None
  - Tests First:
    - Test store initialization with default model
    - Test model selection persistence
    - Test available models list
    - Test model switching action
  - Description: Add model selection to settings store
  - Add fields:
    - `selectedModel: string`
    - `availableModels: Model[]`
  - Test Deliverables:
    - Updated `/tests/store/settings.test.ts` with model tests
  - Deliverables: Updated `/src/store/settings.ts`
  - Interface Contract:
    ```typescript
    interface Model {
      id: string;
      name: string;
      provider: string;
      available: boolean;
    }
    ```
  - Acceptance: Store tests pass, model selection persists

### ⚡ Sequential Tasks:

- [ ] **Task 4.3** - Integrate ModelSelector into Header 🧪
  - Prerequisites: Tasks 4.1, 4.2 complete
  - Tests First:
    - Test ModelSelector renders in header
    - Test store integration (selection persists)
    - Test disabled state during chat loading
    - Test integration with ChatPanel
  - Description: Add ModelSelector to ChatPanel header
  - Position: Header left side, after title
  - Connect to settings store
  - Test Deliverables:
    - Updated `/tests/sidebar/ChatPanel.test.tsx` with selector tests
  - Deliverables: Updated ChatPanel with model selector
  - Acceptance: Integration tests pass, selector works in header

- [ ] **Task 4.4** - Style ModelSelector 🧪
  - Prerequisites: Task 4.3 complete
  - Tests First:
    - Test dark mode styles
    - Test light mode styles
    - Test hover/focus states
    - Visual regression tests
  - Description: Add styles for model selector to match design
  - Dark mode support
  - Consistent with overall theme
  - Test Deliverables:
    - `/tests/sidebar/components/ModelSelector.visual.test.tsx`
  - Deliverables: Styled model selector
  - Acceptance: Visual tests pass, matches design

---

## PHASE 5: INTEGRATION & TESTING

**Synchronization Point: Final validation and cleanup**

### ⚡ Sequential Tasks:

- [ ] **Task 5.1** - Comprehensive Integration Testing 🧪
  - Prerequisites: All Phase 1-4 tasks complete
  - Tests to Run/Write:
    - E2E test: Full sidebar lifecycle (mount, interact, unmount)
    - Integration test: Model selector + chat flow
    - Visual regression test: Compare before/after refactoring
    - Performance test: Ensure no degradation
    - Accessibility test: ARIA attributes, keyboard navigation
  - Test areas:
    - Overlay displays correctly (z-index, positioning)
    - Resize/drag functionality works
    - Model selector functions and persists
    - Chat input/output works
    - Theme switching works
    - Shadow DOM isolation maintained
    - Message passing with background script
  - Test Deliverables:
    - `/tests/e2e/sidebar-refactored.test.ts`
    - `/tests/integration/model-selector-chat.test.ts`
    - `/tests/sidebar/performance.test.ts`
    - `/tests/sidebar/accessibility.test.ts`
  - Deliverables: All integration tests passing
  - Acceptance: 100% test pass rate, no regressions

- [ ] **Task 5.2** - Update Path Aliases and Test Coverage 🧪
  - Prerequisites: Task 5.1 complete
  - Tests First:
    - Test that all path aliases resolve correctly
    - Run coverage report and ensure >90%
  - Description: Update tsconfig paths for new structure
  - Add: `"@sidebar/*": ["src/sidebar/*"]`
  - Update existing component imports
  - Generate coverage report
  - Test Deliverables:
    - Coverage report showing >90% coverage
  - Deliverables: Updated tsconfig.json, coverage report
  - Acceptance: Path aliases work, coverage meets requirements

- [ ] **Task 5.3** - Documentation and Test Documentation Update
  - Prerequisites: Task 5.2 complete
  - Description: Update all documentation
  - Updates needed:
    - CLAUDE.md with new structure
    - Test README with new test locations
    - Document new file organization
    - Update component locations
    - Add model selector documentation
    - Document TDD approach used
  - Deliverables:
    - Updated CLAUDE.md
    - Updated /tests/README.md
  - Acceptance: Documentation complete and accurate

---

## Risk Mitigation

### Critical Areas to Preserve:

1. **Shadow DOM Implementation** - Do not modify mounting logic
2. **Overlay Positioning** - Maintain z-index and fixed positioning
3. **Resize/Drag** - Keep all mouse event handlers intact
4. **Message Passing** - Preserve chrome.runtime communication

### Potential Blockers:

1. **Import Path Issues** - Test thoroughly after moving files
2. **Style Conflicts** - Verify Shadow DOM isolation after merging styles
3. **State Management** - Ensure stores connect properly after refactoring
4. **Theme Variables** - Verify CSS variables work in unified stylesheet

### Rollback Plan:

- Git commit before each phase
- Test after each phase completion
- Ability to revert individual phases if issues arise

---

## Test-Driven Development Metrics

### Test Requirements by Phase:

- **Phase 0**: 4 tasks - Test migration and preparation
- **Phase 1**: 5 tasks - All with test-first approach
- **Phase 2**: 4 tasks - Critical overlay behavior tests
- **Phase 3**: 3 tasks - Visual regression and style tests
- **Phase 4**: 4 tasks - New feature with full test coverage
- **Phase 5**: 3 tasks - Integration and E2E testing

### Test Coverage Goals:

- **Unit Tests**: >90% coverage for all new code
- **Integration Tests**: All component interactions tested
- **E2E Tests**: Critical user journeys covered
- **Visual Tests**: Before/after regression testing
- **Performance Tests**: No degradation from current implementation

## Completion Criteria

### Phase Completion Requirements:

- [ ] All tests written before implementation (RED phase)
- [ ] All tests passing after implementation (GREEN phase)
- [ ] Code refactored for quality (REFACTOR phase)
- [ ] No build errors
- [ ] No runtime errors
- [ ] Overlay functionality preserved
- [ ] Features work as expected
- [ ] Test coverage >90%

### Overall Success Metrics:

- [ ] Single unified component structure under `/src/sidebar/`
- [ ] Model selector integrated and functional
- [ ] All styles consolidated into one file
- [ ] Clean import structure with no scattered files
- [ ] Overlay behavior identical to current implementation
- [ ] All tests passing (100% pass rate)
- [ ] Test coverage >90% for new code
- [ ] No performance regressions
- [ ] Documentation updated with test information

---

_Task Blueprint Version: 2.0 (TDD Edition)_  
_Total Tasks: 23_  
_Test-First Tasks: 19 (83%)_  
_Parallelizable: 9 (39%)_  
_Sequential: 14 (61%)_  
_Estimated Parallel Execution Paths: 3_  
_Minimum Test Coverage Target: 90%_