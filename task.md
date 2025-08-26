# Tab Content Extraction MVP - Task Execution Plan

## Project Overview

Build a reliable, fast, and private content extraction system for the current browser tab. The system extracts main content, converts to clean Markdown suitable for AI prompts, and provides a React hook for sidebar integration. Target performance: <500ms for simple pages, 2s hard timeout. Check @tabext-mvp.md for detail plan if needed.

## Task Execution Guidelines

- **Parallel Execution (🔄)**: Tasks marked with 🔄 can be executed simultaneously by different sub-agents
- **Sequential Execution (⚡)**: Tasks marked with ⚡ must be completed in order
- **Synchronization Points**: Review required after each phase before proceeding
- **Testing**: Each component must have unit tests before integration
- **Code Style**: Follow existing patterns in the codebase, use TypeScript strict mode

## Phase 0: Dependencies [Sequential]

### ⚡ [x] Task 0.1: Install Extraction Dependencies

**Prerequisites**: None
**Description**: Ensure required packages are installed and types compile
**Deliverables**:

- Add/install: `@mozilla/readability`, `turndown`, `turndown-plugin-gfm`
- Verify `dompurify` and `@types/dompurify` are present and compile
  **Acceptance Criteria**:
- Packages appear in `package.json` and lockfile
- CI typecheck passes with imports in stubs

## Phase 1: Foundation Types & Utilities [Parallelizable]

### 🔄 [x] Task 1.1: Create Extraction Types

**Prerequisites**: None
**Description**: Define TypeScript interfaces for extraction system
**Deliverables**:

- `src/types/extraction.ts` with ExtractedContent, ExtractionOptions interfaces
  **Acceptance Criteria**:
- Types match the “Types” contract in tabext-mvp.md (ExtractedContent, ExtractionOptions)
- Exports are properly typed
- No TypeScript errors
  **Interface Contract**: ExtractedContent, ExtractionOptions exported

### 🔄 [x] Task 1.2: Implement DOM Utilities

**Prerequisites**: None
**Description**: Create safe DOM manipulation and metadata extraction utilities
**Deliverables**:

- `src/tabext/domUtils.ts` with isVisible, getPageMetadata, clampText functions
  **Acceptance Criteria**:
- Functions handle edge cases (null elements, missing attributes)
- No DOM mutations occur
- Visibility detection covers common CSS scenarios (display:none, visibility:hidden, offscreen unless fixed, aria-hidden)
  **Interface Contract**: Export isVisible, getPageMetadata, clampText functions

### 🔄 [x] Task 1.3: Setup Markdown Converter Base

**Prerequisites**: None  
**Description**: Create HTML to Markdown converter with DOMPurify sanitization
**Deliverables**:

- `src/tabext/markdown/markdownConverter.ts` with `htmlToMarkdown(html, { includeLinks? })`
- Custom Turndown rule `fencedCodeWithLang` to output code blocks as ```lang fences from `<pre><code>` elements
- Dynamic imports for Turndown + GFM with simple in-module caching
  **Acceptance Criteria**:
- DOMPurify sanitizes HTML before conversion
- Turndown configured with GFM plugin
- Language detection for code blocks works (uses language-\* class hints when present)
- Link stripping option functional when `opts.includeLinks === false`
- Custom `fencedCodeWithLang` Turndown rule implemented
- Dynamic import caching avoids reloading libraries on subsequent calls
  **Interface Contract**: Export async `htmlToMarkdown(html: string, opts?: { includeLinks?: boolean })`

## Phase 2: Extractor Components [Parallelizable]

### 🔄 [x] Task 2.1: Implement Readability Extractor

**Prerequisites**: Task 1.1
**Description**: Create Mozilla Readability adapter for article extraction
**Deliverables**:

- `src/tabext/extractors/readability.ts` with extractWithReadability function
- Install @mozilla/readability dependency
  **Acceptance Criteria**:
- Document cloned before parsing (no mutations)
- Memory cleanup after extraction
- Returns null for non-article pages
- Preserves class attributes for code detection (keepClasses: true)
  **Interface Contract**: Export extractWithReadability(): Promise<ReadabilityResult | null>

### 🔄 [x] Task 2.2: Implement Fallback Extractor

**Prerequisites**: Task 1.2
**Description**: Create heuristic content extractor for non-article pages
**Deliverables**:

- `src/tabext/extractors/fallback.ts` with extractFallbackHTML function
  **Acceptance Criteria**:
- Selects best content container (main, article, highest-scoring visible div/section)
- Scoring algorithm: h2=50, h3=30, p=10 points, plus text length; only visible elements considered
- Removes scripts, styles, hidden elements using `window.getComputedStyle`
- Enforces character budget (500KB default)
- Returns truncation flag when content exceeds budget
  **Interface Contract**: Export extractFallbackHTML(budgetChars?: number)

## Phase 3: Core Orchestrator [Sequential]

### ⚡ [x] Task 3.1: Create Content Extractor Orchestrator

**Prerequisites**: Tasks 1.1, 1.2, 1.3, 2.1, 2.2
**Description**: Implement main extraction orchestrator with timeout and fallback logic
**Deliverables**:

- `src/tabext/contentExtractor.ts` with extractContent function
  **Acceptance Criteria**:
- Tries Readability first, falls back to heuristic on failure
- Enforces 2s timeout (configurable)
- Clamps Markdown output to 200K chars
- Detects code blocks and tables in output
- Passes includeLinks option through to Markdown converter (default includeLinks=true)
- Returns metadata with word count and truncation status
- Maps publishedDate from DOM metadata when available
- Loads heavy libs via dynamic import and caches modules between calls
  **Interface Contract**: Export extractContent(opts?: ExtractionOptions): Promise<ExtractedContent>

### ⚡ [x] Task 3.2: Add Extraction Error Handling

**Prerequisites**: Task 3.1
**Description**: Enhance orchestrator with comprehensive error handling
**Deliverables**:

- Updated `src/tabext/contentExtractor.ts` with try-catch, timeout handling
  **Acceptance Criteria**:
- Graceful degradation on extraction failure
- Returns minimal valid ExtractedContent on error
- Timeout errors properly caught and logged
- Performance timing captured using `performance.now()`; reference result (e.g., `void elapsed`) to avoid unused warnings

## Phase 4: React Integration [Sequential]

### ⚡ [x] Task 4.1: Create React Hook for Content Extraction

**Prerequisites**: Task 3.1
**Description**: Build React hook for sidebar to trigger and consume extraction
**Deliverables**:

- `src/sidebar/hooks/useContentExtraction.ts` with useContentExtraction hook
  **Acceptance Criteria**:
- Hook exposes content, loading, error, reextract
- Auto-extracts on mount when auto=true
- Handles errors gracefully
- Properly manages loading states
  **Interface Contract**: Export useContentExtraction(auto?: boolean)

### ⚡ [x] Task 4.2: Optional - Add Message Bus Integration

**Prerequisites**: Task 4.1
**Description**: Add content script message handler for future decoupling
**Deliverables**:

- Updated `src/tabext/index.ts` with EXTRACT_CONTENT handler
  **Acceptance Criteria**:
- Handler uses subscribeWithResponse pattern
- Returns ExtractedContent via StandardResponse
- Compatible with existing MessageBus types
  **Interface Contract**: Message handler for EXTRACT_CONTENT

## Phase 5: Testing Suite [Parallelizable after Phase 3]

### 🔄 [x] Task 5.1: Unit Tests for Utilities

**Prerequisites**: Tasks 1.2, 1.3
**Description**: Create unit tests for DOM utils and Markdown converter
**Deliverables**:

- `tests/unit/tabext/domUtils.test.ts`
- `tests/unit/tabext/markdownConverter.test.ts`
  **Acceptance Criteria**:
- > 90% code coverage
- Edge cases tested (null, empty, malformed inputs)
- Performance benchmarks included

### 🔄 [x] Task 5.2: Unit Tests for Extractors

**Prerequisites**: Tasks 2.1, 2.2
**Description**: Create unit tests for Readability and fallback extractors
**Deliverables**:

- `tests/unit/tabext/readability.test.ts`
- `tests/unit/tabext/fallback.test.ts`
  **Acceptance Criteria**:
- Test with fixture HTML documents
- Verify no DOM mutations occur
- Budget enforcement tested

### 🔄 [x] Task 5.3: Integration Tests

**Prerequisites**: Task 3.1
**Description**: End-to-end tests for content extraction pipeline
**Deliverables**:

- `tests/integration/tabext/extractContent.test.ts`
  **Acceptance Criteria**:
- Tests with real-world HTML fixtures (news, blog, docs, GitHub README, StackOverflow, landing page)
- Timeout behavior verified and truncation flags properly set
- Performance target under 500ms for simple pages; hard timeout 2s

## Phase 6: UI Integration [Sequential]

### ⚡ [ ] Task 6.1: Integrate Hook into ChatPanel

**Prerequisites**: Task 4.1
**Description**: Add content extraction to sidebar UI
**Deliverables**:

- Updated `src/sidebar/ChatPanel.tsx` with extraction preview
  **Acceptance Criteria**:
- Shows extracted content preview (title, domain, excerpt)
- Loading state displayed during extraction
- Error states handled gracefully
- Re-extract button functional
  **Interface Contract**: Uses useContentExtraction hook

### ⚡ [ ] Task 6.2: Add Extraction Status UI

**Prerequisites**: Task 6.1
**Description**: Create UI components for extraction status
**Deliverables**:

- Status indicator in sidebar header
- Extraction metadata display
  **Acceptance Criteria**:
- Shows extraction method (readability/fallback)
- Displays word count and truncation status
- Indicates presence of code blocks/tables

### 🔄 [ ] Task 6.3 (Optional): Add Quality Metrics

**Prerequisites**: Task 3.1
**Description**: Implement simple content quality scoring for UX hints
**Deliverables**:

- `scoreContentQuality(content: ExtractedContent)` utility or inline in orchestrator
- Signals: hasTitle, wordCount, hasStructure (headings/paragraphs), hasCode
  **Acceptance Criteria**:
- Returns score 0–100 and signals object
- Used to optionally surface a “quality” badge in preview

## Synchronization Points

### After Phase 1 & 2 Completion

- Review all interfaces ensure compatibility
- Verify no circular dependencies
- Check TypeScript compilation

### After Phase 3 Completion

- Manual testing on sample pages
- Performance profiling
- Review error handling coverage

### After Phase 5 Completion

- Verify >90% test coverage
- Review test failures and edge cases
- Performance benchmark validation

### Before Phase 6

- Ensure all core functionality tested
- Review React hook implementation
- Verify sidebar compatibility

## Risk Mitigation

### Performance Risks

- **Risk**: Readability library too slow on complex pages
- **Mitigation**: Strict 2s timeout, fallback to heuristic extraction

### Memory Risks

- **Risk**: Large DOM clones causing memory issues
- **Mitigation**: Explicit cleanup, character budgets, avoid keeping references

### Compatibility Risks

- **Risk**: Content script conflicts with existing code
- **Mitigation**: Minimal footprint, no global pollution, Shadow DOM isolation

### Security Risks

- **Risk**: XSS through extracted content
- **Mitigation**: DOMPurify sanitization before Markdown conversion

## Progress Tracking

### Overall Completion: 13/16 tasks (81%)

**Phase 0**: [x] (1/1)
**Phase 1**: [x] [x] [x] (3/3)
**Phase 2**: [x] [x] (2/2)  
**Phase 3**: [x] [x] (2/2)
**Phase 4**: [x] [x] (2/2)
**Phase 5**: [x] [x] [x] (3/3)
**Phase 6**: [ ] [ ] [ ] (0/3, includes optional 6.3)

### Critical Path

1. Task 1.1 → Task 3.1 → Task 4.1 → Task 6.1 (Types → Orchestrator → Hook → UI)
2. Parallel paths can reduce total time by ~40%

## Notes for Sub-Agents

- Use existing project patterns from `src/` directory
- Follow TypeScript strict mode settings
- Import using path aliases (@tabext/_, @types/_, etc.)
- All async functions must handle promise rejections
- Keep bundle size minimal with dynamic imports and simple in-module caching
- Preserve existing MessageBus compatibility; for MVP, prefer direct orchestrator call from sidebar; Phase 1.1 may add EXTRACT_CONTENT handler using subscribeWithResponse
- Test in isolation before integration
