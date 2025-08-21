# AI Browser Sidebar Extension - STAGE 5: TAB CONTENT EXTRACTION

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
- [x] Stage 3: Storage & Security (18/18 tasks) ✅ COMPLETED
- [x] Stage 4: AI Provider System (22/22 tasks) ✅ COMPLETED
- [ ] Stage 5: Tab Content Extraction (0/21 tasks)

**Total Progress: 79/100 tasks**

---

## STAGE 5: TAB CONTENT EXTRACTION

Deliverable highlight: Complete tab content extraction system with multi-tab support, dynamic content monitoring, and AI integration. @-mention tab selector, parallel extraction, markdown conversion, and context aggregation for AI-powered web content analysis.

### Phase 5.1: Content Script Foundation

**Synchronization Point: Content script infrastructure required first**

⚡ **Sequential Tasks:**

- [ ] **Task 5.1.1a** - Content Script Entry 🧪
  - Prerequisites: Task 1.3.3
  - Tests First:
    - Test script injection
    - Test message handling
  - Description: Create content script entry
  - Deliverables:
    - `src/tabext/index.ts`
    - `tests/tabext/index.test.ts`
  - Acceptance: Script loads on pages

- [ ] **Task 5.1.1b** - DOM Access Utilities 🧪
  - Prerequisites: Task 5.1.1a
  - Tests First:
    - Test element selection
    - Test traversal
    - Test safety checks
  - Description: Create DOM utilities
  - Deliverables:
    - `src/tabext/domUtils.ts`
    - `tests/tabext/domUtils.test.ts`
  - Acceptance: DOM access works

- [ ] **Task 5.1.1c** - Content Script Messaging 🧪
  - Prerequisites: Task 5.1.1a
  - Tests First:
    - Test message sending
    - Test response handling
  - Description: Setup content script messaging
  - Deliverables:
    - `src/tabext/messaging.ts`
    - `tests/tabext/messaging.test.ts`
  - Acceptance: Messages pass correctly

- [ ] **Task 5.1.2a** - Readability Setup 🧪
  - Prerequisites: Task 5.1.1b
  - Tests First:
    - Test Readability import
    - Test configuration
  - Description: Setup Mozilla Readability
  - Deliverables:
    - Readability integration
    - Configuration
  - Acceptance: Readability loads

- [ ] **Task 5.1.2b** - Article Extraction 🧪
  - Prerequisites: Task 5.1.2a
  - Tests First:
    - Test article extraction
    - Test metadata extraction
    - Test fallback
  - Description: Implement article extraction
  - Deliverables:
    - `src/extraction/articleExtractor.ts`
    - `tests/extraction/articleExtractor.test.ts`
  - Acceptance: Articles extracted

- [ ] **Task 5.1.2c** - Extraction Fallbacks 🧪
  - Prerequisites: Task 5.1.2b
  - Tests First:
    - Test fallback strategies
    - Test custom extractors
  - Description: Create extraction fallbacks
  - Deliverables:
    - `src/extraction/fallbacks.ts`
    - `tests/extraction/fallbacks.test.ts`
  - Acceptance: Fallbacks work

### Phase 5.2: Extraction Features

**Synchronization Point: All extraction features ready**

🔄 **Parallelizable Tasks:**

- [ ] **Task 5.2.1a** - Selection Detection 🧪
  - Prerequisites: Task 5.1.1b
  - Tests First:
    - Test selection detection
    - Test range calculation
  - Description: Detect text selection
  - Deliverables:
    - `src/tabext/selectionDetector.ts`
    - `tests/tabext/selectionDetector.test.ts`
  - Acceptance: Selection detected

- [ ] **Task 5.2.1b** - Context Markers 🧪
  - Prerequisites: Task 5.2.1a
  - Tests First:
    - Test marker insertion
    - Test marker removal
    - Test preservation
  - Description: Add context markers
  - Deliverables:
    - `src/tabext/contextMarkers.ts`
    - `tests/tabext/contextMarkers.test.ts`
  - Acceptance: Markers work correctly

- [ ] **Task 5.2.2a** - Mutation Observer 🧪
  - Prerequisites: Task 5.1.1b
  - Tests First:
    - Test observer setup
    - Test change detection
    - Test debouncing
  - Description: Setup MutationObserver
  - Deliverables:
    - `src/tabext/mutationObserver.ts`
    - `tests/tabext/mutationObserver.test.ts`
  - Acceptance: Changes detected

- [ ] **Task 5.2.2b** - Dynamic Content Handler 🧪
  - Prerequisites: Task 5.2.2a
  - Tests First:
    - Test SPA handling
    - Test infinite scroll
    - Test lazy loading
  - Description: Handle dynamic content
  - Deliverables:
    - `src/tabext/dynamicContent.ts`
    - `tests/tabext/dynamicContent.test.ts`
  - Acceptance: Dynamic content handled

- [ ] **Task 5.2.3a** - HTML to Markdown 🧪
  - Prerequisites: Task 5.1.2b
  - Tests First:
    - Test conversion
    - Test structure preservation
    - Test special elements
  - Description: Convert HTML to markdown
  - Deliverables:
    - `src/extraction/htmlToMarkdown.ts`
    - `tests/extraction/htmlToMarkdown.test.ts`
  - Acceptance: Clean markdown output

- [ ] **Task 5.2.3b** - Code Block Extraction 🧪
  - Prerequisites: Task 5.2.3a
  - Tests First:
    - Test code detection
    - Test language detection
    - Test formatting
  - Description: Extract code blocks
  - Deliverables:
    - `src/extraction/codeExtractor.ts`
    - `tests/extraction/codeExtractor.test.ts`
  - Acceptance: Code extracted correctly

- [ ] **Task 5.2.3c** - Table Extraction 🧪
  - Prerequisites: Task 5.2.3a
  - Tests First:
    - Test table detection
    - Test markdown tables
  - Description: Extract tables
  - Deliverables:
    - `src/extraction/tableExtractor.ts`
    - `tests/extraction/tableExtractor.test.ts`
  - Acceptance: Tables extracted

- [ ] **Task 5.2.4a** - Tab Manager 🧪
  - Prerequisites: Task 5.1.1c
  - Tests First:
    - Test tab enumeration
    - Test tab filtering
  - Description: Create tab manager
  - Deliverables:
    - `src/extraction/tabManager.ts`
    - `tests/extraction/tabManager.test.ts`
  - Acceptance: Tabs managed

- [ ] **Task 5.2.4b** - Parallel Extraction 🧪
  - Prerequisites: Task 5.2.4a
  - Tests First:
    - Test parallel execution
    - Test progress tracking
    - Test error handling
  - Description: Implement parallel extraction
  - Deliverables:
    - `src/extraction/parallelExtractor.ts`
    - `tests/extraction/parallelExtractor.test.ts`
  - Acceptance: Parallel extraction works

### Phase 5.3: UI Integration

**Synchronization Point: Complete extraction system**

⚡ **Sequential Tasks:**

- [ ] **Task 5.3.1a** - Tab Search Component 🧪
  - Prerequisites: Task 5.2.4a, Task 2.4.1
  - Tests First:
    - Test search functionality
    - Test filtering
    - Test keyboard navigation
  - Description: Create tab search UI
  - Deliverables:
    - `src/components/Chat/TabSearch.tsx`
    - `tests/components/Chat/TabSearch.test.tsx`
  - Acceptance: Tab search works

- [ ] **Task 5.3.1b** - @Mention Handler 🧪
  - Prerequisites: Task 5.3.1a
  - Tests First:
    - Test @ trigger
    - Test selection
    - Test insertion
  - Description: Implement @mention
  - Deliverables:
    - `src/components/Chat/MentionHandler.tsx`
    - `tests/components/Chat/MentionHandler.test.tsx`
  - Acceptance: @mentions work

- [ ] **Task 5.3.2** - Content Preview 🧪
  - Prerequisites: Task 5.3.1b
  - Tests First:
    - Test content display
    - Test truncation
    - Test source attribution
  - Description: Display extracted content
  - Deliverables:
    - `src/components/Chat/ContentPreview.tsx`
    - `tests/components/Chat/ContentPreview.test.tsx`
  - Acceptance: Content displays clearly

- [ ] **Task 5.3.3a** - Context Aggregator 🧪
  - Prerequisites: Task 5.3.2
  - Tests First:
    - Test aggregation
    - Test deduplication
    - Test ordering
  - Description: Aggregate tab content
  - Deliverables:
    - `src/extraction/contextAggregator.ts`
    - `tests/extraction/contextAggregator.test.ts`
  - Acceptance: Context aggregated

- [ ] **Task 5.3.3b** - Token Counter 🧪
  - Prerequisites: Task 5.3.3a
  - Tests First:
    - Test token counting
    - Test truncation
  - Description: Count and manage tokens
  - Deliverables:
    - `src/utils/tokenCounter.ts`
    - `tests/utils/tokenCounter.test.ts`
  - Acceptance: Tokens counted correctly

- [ ] **Task 5.3.4** - Final Integration 🧪
  - Prerequisites: Task 5.3.3b, Task 4.3.5
  - Tests First:
    - Test end-to-end flow
    - Test error handling
    - Test performance
  - Description: Complete integration
  - Deliverables:
    - Final integration code
    - E2E tests
    - Performance optimizations
  - Acceptance: Complete product works

---

## Synchronization Points

### Critical Review Points:

1. **After Phase 5.1**: Content script foundation ready
2. **After Phase 5.2**: All extraction features functional
3. **After Phase 5.3**: Complete product with full integration

### Test Coverage Requirements:

- Unit Tests: > 90% coverage
- Component Tests: All extraction components tested
- Integration Tests: All content extraction APIs tested
- E2E Tests: Complete user journeys tested

## Risk Mitigation

### Testing Strategy:

1. **Content Tests First**: Write failing tests before extraction implementation
2. **Mock DOM APIs**: Mock browser APIs and content structures
3. **Content Testing**: Test with various website structures
4. **Performance Testing**: Test with large pages and multiple tabs
5. **Integration Testing**: Test complete AI chat with web content

### Potential Blockers:

1. **Cross-Origin Issues**: Handle iframe and CORS restrictions
2. **Dynamic Content**: Handle SPA and infinite scroll content
3. **Performance**: Optimize extraction for large pages
4. **Content Security**: Validate and sanitize extracted content
5. **Browser Compatibility**: Test across different browsers

## Completion Criteria

### Task Completion:

- [ ] All tests written and passing
- [ ] Extraction implementation complete
- [ ] UI integration functional
- [ ] Performance benchmarks met
- [ ] No linting errors

### Stage Completion:

- [ ] All 21 tasks marked complete
- [ ] Integration tests pass
- [ ] Test coverage > 90%
- [ ] Extraction works on various sites
- [ ] Complete product functional
- [ ] Performance metrics met
- [ ] Security audit passed

### Project Completion:

- [ ] All 100 tasks complete
- [ ] E2E test suite passes
- [ ] Security audit complete
- [ ] Performance metrics met
- [ ] Chrome Web Store ready

---

_Task Blueprint Version: 2.0 (TDD Edition)_  
_Stage 5 Tasks: 21_  
_Test-First Tasks: 21 (100%)_  
_Parallelizable: 9 (43%)_  
_Sequential: 12 (57%)_  
_Estimated Parallel Execution Paths: 3_  
_PROJECT TOTAL: 100 TASKS_
