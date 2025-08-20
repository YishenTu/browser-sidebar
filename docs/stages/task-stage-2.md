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

- [ ] All tests written and passing
- [ ] Component implementation complete
- [ ] Props and interfaces documented
- [ ] Accessibility attributes added
- [ ] No linting errors

### Stage Completion:

- [ ] All 24 tasks marked complete
- [ ] Integration tests pass
- [ ] Test coverage > 90%
- [ ] Theme system functional
- [ ] Mock chat system works
- [ ] Performance benchmarks met
- [ ] Accessibility tests pass

---

_Task Blueprint Version: 2.0 (TDD Edition)_  
_Stage 2 Tasks: 24_  
_Test-First Tasks: 21 (88%)_  
_Parallelizable: 17 (71%)_  
_Sequential: 7 (29%)_  
_Estimated Parallel Execution Paths: 4_
