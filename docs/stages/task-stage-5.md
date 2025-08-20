# Stage 5: Tab Content Extraction

## Overview
Implement tab content extraction system with multi-tab support, dynamic monitoring, and AI integration.

**Duration:** 2 weeks | **Tasks:** 21

## Prerequisites
- Content script infrastructure (Stage 1)
- Message passing system (Stage 1) 
- Chat UI with @-mention support (Stage 2)
- Storage for tab context (Stage 3)
- AI provider integration (Stage 4)

## Core Deliverables
1. Content extraction from webpages
2. Text selection with context
3. Multi-tab parallel extraction
4. Dynamic content monitoring
5. Markdown conversion
6. @-mention tab selector
7. Context aggregation for AI

---

## Phase 5.1: Content Script Foundation

### Task 5.1.1a - Content Script Entry
**Goal:** Create main content script with message handling

**Key Files:**
- `src/content/index.ts` - Main content script
- `tests/content/index.test.ts` - Test suite

**Core Features:**
- Message listener setup
- Component initialization  
- Metadata extraction
- Error handling
- Lifecycle management

**Acceptance Criteria:**
- [ ] Handles EXTRACT_CONTENT messages
- [ ] Extracts page metadata
- [ ] Initializes/destroys cleanly
- [ ] Tests pass

### Task 5.1.1b - DOM Access Utilities
**Goal:** Safe DOM manipulation and content detection

**Key Files:**
- `src/content/domUtils.ts` - DOM utilities
- `tests/content/domUtils.test.ts` - Test suite

**Core Features:**
- Safe element querying
- Visibility detection
- Text extraction
- Main content detection
- Link/image extraction

**Acceptance Criteria:**
- [ ] Safe DOM access works
- [ ] Finds main content areas
- [ ] Extracts visible text only
- [ ] Tests pass

### Remaining Tasks Summary

**Phase 5.1 (Content Foundation):**
- DOM Extractor - Parse page content
- Selection Handler - Manage text selections  
- Mutation Monitor - Track dynamic changes
- Message Types - Content extraction messages

**Phase 5.2 (Content Processing):**
- Markdown Converter - Convert HTML to markdown
- Text Sanitizer - Clean extracted content
- Content Aggregator - Combine multi-tab content
- Performance Optimizer - Efficient extraction

**Phase 5.3 (UI Integration):**
- Tab Selector UI - @-mention interface
- Context Display - Show extracted content
- Selection Highlighter - Visual feedback
- Background Coordinator - Multi-tab management

---

## Completion Checklist

### Core Features
- [ ] Content extraction from webpages
- [ ] Text selection handling
- [ ] Multi-tab parallel extraction  
- [ ] Dynamic content monitoring
- [ ] Markdown conversion
- [ ] @-mention tab selector
- [ ] Context aggregation for AI

### Quality Gates
- [ ] All tests passing (>95% coverage)
- [ ] No TypeScript/ESLint errors
- [ ] Performance: extraction <500ms
- [ ] Memory usage <50MB
- [ ] Security audit passed

### Integration Tests
- [ ] Extract from various websites
- [ ] Multi-tab context in AI chat
- [ ] Selection with context preservation
- [ ] Dynamic content updates

### Final Deliverables
- [ ] Production build ready
- [ ] Chrome Web Store assets
- [ ] Documentation complete
- [ ] User testing passed

---

**Stage 5:** 21 tasks | 2 weeks
**Project Total:** 100 tasks across 5 stages | 8-10 weeks