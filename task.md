# Multi-Tab Content Injection - Task Execution Blueprint

## Project Overview

Implement a multi-tab content injection feature for the browser sidebar extension that allows users to:

- Auto-load current tab content once at session start
- Manually add multiple tab contents via `@` mention system
- View all loaded tabs via stacked ContentPreview components
- Send aggregated content with structured XML formatting to AI

**Key Constraint**: Preserve existing message flow architecture - only change content preparation layer

## Execution Guidelines

### For Sub-agents

- Each task is self-contained with clear deliverables
- Follow existing code patterns in the repository
- Use TypeScript strict mode for all new code
- Ensure React components use existing UI components from `@ui/`
- Test each component/function in isolation before marking complete

### For Orchestrator

- Review synchronization points after each phase
- Verify interface contracts between parallel tasks
- Run integration tests at phase boundaries
- Check that parallel tasks don't create conflicts

## Progress Tracking

**Overall Completion**: 38/38 tasks (100%) ✅ COMPLETE

- Phase 1 (Backend): 8/8 tasks ✅
- Phase 2 (Data Layer): 7/7 tasks ✅
- Phase 3 (UI Components): 9/9 tasks ✅
- Phase 4 (Integration): 9/9 tasks ✅
- Phase 5 (Polish): 4/4 tasks ✅

---

## Phase 1: Backend Infrastructure (Tab Management)

### 🔄 Parallel Tasks Block 1A

[x] **Task 1.1: Create Tab Type Definitions**

- **Prerequisites**: None
- **Type**: 🔄 Parallel
- **Description**: Create TypeScript interfaces for tab-related data structures
- **Deliverables**:
  - `src/types/tabs.ts` with TabInfo, TabContent, MultiTabExtractionState interfaces
- **Acceptance Criteria**:
  - All interfaces properly typed with serializable types (Record not Map)
  - Includes all fields from plan (id, title, url, domain, windowId, etc.)
  - Export all interfaces and type guards
- **Interface Contract**:
  - TabInfo must extend chrome.tabs.Tab subset
  - TabContent must include ExtractedContent from existing types

[x] **Task 1.2: Extend Message Type Definitions**

- **Prerequisites**: None
- **Type**: 🔄 Parallel
- **Description**: Add new message types for tab operations to existing message system
- **Deliverables**:
  - Modified `src/types/messages.ts` with GET_ALL_TABS and EXTRACT_TAB_CONTENT
- **Acceptance Criteria**:
  - Follow existing createMessage factory pattern
  - Add to MessageType union
  - Add to TypedMessage union with proper payloads
  - Include ExtractTabPayload interface
- **Interface Contract**:
  - GET_ALL_TABS: void → TabInfo[]
  - EXTRACT_TAB_CONTENT: {tabId, options} → ExtractedContent

[x] **Task 1.3: Create TabContentCache Class**

- **Prerequisites**: None
- **Type**: 🔄 Parallel
- **Description**: Implement MV3-compatible caching using chrome.storage.session
- **Deliverables**:
  - `src/extension/background/cache/TabContentCache.ts`
- **Acceptance Criteria**:
  - Uses chrome.storage.session for persistence
  - Implements TTL-based expiration (5 minutes)
  - Methods: get(), set(), clear(), isExpired()
  - Handles serialization of ExtractedContent
- **Interface Contract**:
  - Returns null for expired/missing content
  - Auto-cleans expired entries on read

### ⚡ Sequential Task 1B (depends on 1A)

[x] **Task 1.4: Create TabManager Service**

- **Prerequisites**: Task 1.1, Task 1.2
- **Type**: ⚡ Sequential
- **Description**: Implement service to manage browser tabs and content extraction
- **Deliverables**:
  - `src/extension/background/tabManager.ts`
- **Acceptance Criteria**:
  - getAllTabs() filters restricted URLs
  - extractTabContent() sends message to specific tab
  - Integrates with TabContentCache (Task 1.3)
  - Handles tabs without content scripts gracefully
- **Interface Contract**:
  - Exports TabManager class with singleton pattern
  - Methods return Promises with proper error handling

[x] **Task 1.5: Implement GET_ALL_TABS Handler**

- **Prerequisites**: Task 1.4
- **Type**: ⚡ Sequential
- **Description**: Add message handler in background script
- **Deliverables**:
  - Modified `src/extension/background/messageHandler.ts`
- **Acceptance Criteria**:
  - Uses chrome.tabs.query({}) to get all tabs
  - Maps chrome.tabs.Tab to TabInfo interface
  - Filters restricted URLs (chrome://, extension://, etc.)
  - Returns sorted by lastAccessed
- **Risk**: Handle incognito tabs appropriately

[x] **Task 1.6: Implement EXTRACT_TAB_CONTENT Handler**

- **Prerequisites**: Task 1.4, Task 1.3
- **Type**: ⚡ Sequential
- **Description**: Add handler for tab-specific content extraction with timeout
- **Deliverables**:
  - Modified `src/extension/background/messageHandler.ts`
- **Acceptance Criteria**:
  - Checks cache first before extraction
  - Implements 5-second timeout per tab
  - Returns structured error for timeouts/failures
  - Handles closed tabs gracefully
  - Sends extraction message to specific tab's content script
  - Handles missing content scripts with fallback
  - Updates cache after successful extraction
- **Risk**: May need chrome.scripting.executeScript for unmatched hosts

[x] **Task 1.7: Update Content Script Message Handler**

- **Prerequisites**: Task 1.2
- **Type**: ⚡ Sequential
- **Description**: Handle EXTRACT_TAB_CONTENT in content script
- **Deliverables**:
  - Modified `src/tabext/core/messageHandler.ts`
- **Acceptance Criteria**:
  - Responds to EXTRACT_TAB_CONTENT message
  - Uses existing extractContent function
  - Returns ExtractedContent or error
  - Handles extraction options properly

[x] **Task 1.8: Create ExtractionQueue Class**

- **Prerequisites**: None
- **Type**: 🔄 Parallel
- **Description**: Implement queue to limit concurrent extractions
- **Deliverables**:
  - `src/extension/background/queue/ExtractionQueue.ts`
- **Acceptance Criteria**:
  - Limits to 3 concurrent extractions
  - Queue operations with Promise resolution
  - Proper error propagation
  - Process next item when slot available

**Synchronization Point 1**: All Phase 1 tasks complete, backend ready for integration

---

## Phase 2: Data Layer

### 🔄 Parallel Tasks Block 2A

[x] **Task 2.1: Create useMultiTabExtraction Hook**

- **Prerequisites**: Task 1.1
- **Type**: 🔄 Parallel
- **Description**: Main hook for managing multi-tab extraction state and operations
- **Deliverables**:
  - `src/sidebar/hooks/useMultiTabExtraction.ts`
- **Acceptance Criteria**:
  - Auto-loads current tab ONCE on mount
  - Tracks hasAutoLoaded flag
  - Prevents duplicate tab loading
  - Uses Record<number, TabContent> for state
  - Integrates with chrome.runtime.sendMessage
- **Interface Contract**:
  - Returns UseMultiTabExtractionReturn interface from plan
  - extractTabById prevents loading already-loaded tabs

[x] **Task 2.2: Create useTabMention Hook**

- **Prerequisites**: None
- **Type**: 🔄 Parallel
- **Description**: Hook for detecting @ mentions and managing dropdown state
- **Deliverables**:
  - `src/sidebar/hooks/useTabMention.ts`
- **Acceptance Criteria**:
  - Detects @ only after whitespace or line start
  - Debounces detection at 100ms for performance
  - Stops on punctuation
  - Tracks cursor position
  - Returns mention state and query string
  - Handles text insertion after selection
- **Interface Contract**:
  - detectMention() returns {startIndex, query} or null
  - insertTab() replaces @ mention with tab reference

[x] **Task 2.3: Add Multi-Tab State to Zustand Store**

- **Prerequisites**: Task 1.1
- **Type**: 🔄 Parallel
- **Description**: Extend chat store to include multi-tab state
- **Deliverables**:
  - Modified `src/data/store/chat.ts` (correct path per repo structure)
- **Acceptance Criteria**:
  - Add loadedTabs: Record<number, TabContent>
  - Add currentTabId: number | null
  - Add actions: setLoadedTabs, addLoadedTab, removeLoadedTab
  - Maintain serializable state
- **Interface Contract**:
  - Compatible with existing chat store structure
  - Actions follow existing naming patterns

### ⚡ Sequential Tasks 2B (depends on 2A)

[x] **Task 2.4: Create Tab Filtering Utilities**

- **Prerequisites**: Task 2.1
- **Type**: ⚡ Sequential
- **Description**: Utility functions for filtering available tabs
- **Deliverables**:
  - `src/sidebar/utils/tabFilters.ts`
- **Acceptance Criteria**:
  - canLoadTab() checks duplicates and current tab
  - getAvailableTabs() filters loaded and restricted tabs
  - isRestrictedUrl() checks chrome://, extension://, etc.
- **Interface Contract**:
  - Pure functions with no side effects
  - Work with Record<number, TabContent>

[x] **Task 2.5: Create Content Aggregation Formatter**

- **Prerequisites**: Task 1.1
- **Type**: ⚡ Sequential
- **Description**: Format multiple tab contents with XML structure and size limits
- **Deliverables**:
  - `src/sidebar/utils/contentFormatter.ts`
- **Acceptance Criteria**:
  - formatMultiTabContent() creates XML structure
  - Escapes XML special characters in titles
  - Enforces max combined size (1MB default)
  - Truncates oldest or least-recently-selected tabs when size exceeded
  - Returns warning flag when content was truncated
  - Handles null/undefined content gracefully
  - Follows format from plan exactly
- **Interface Contract**:
  - Input: userMessage, currentTab, additionalTabs, maxSize?
  - Output: {formatted: string, truncated: boolean, truncatedTabs: number[]}

[x] **Task 2.6: Create Dropdown Position Calculator**

- **Prerequisites**: None
- **Type**: 🔄 Parallel
- **Description**: Calculate dropdown position in Shadow DOM
- **Deliverables**:
  - `src/sidebar/utils/dropdownPosition.ts`
- **Acceptance Criteria**:
  - Works within Shadow DOM context
  - Accounts for scroll position
  - Dynamic line height calculation
  - Returns x, y, maxX, maxY coordinates
- **Risk**: Shadow DOM styling complexities

[x] **Task 2.7: Integration Tests for Data Layer**

- **Prerequisites**: Task 2.1, Task 2.2, Task 2.3
- **Type**: ⚡ Sequential
- **Description**: Test data layer components work together
- **Deliverables**:
  - `tests/integration/multi-tab-data.test.ts`
- **Acceptance Criteria**:
  - Tests auto-load on mount
  - Tests duplicate prevention
  - Tests state persistence
  - Tests mention detection edge cases

**Synchronization Point 2**: Data layer complete and tested

---

## Phase 3: UI Components

### 🔄 Parallel Tasks Block 3A

[x] **Task 3.1: Create TabMentionDropdown Component**

- **Prerequisites**: Task 1.1
- **Type**: 🔄 Parallel
- **Description**: Dropdown component for tab selection
- **Deliverables**:
  - `src/sidebar/components/TabMentionDropdown.tsx`
  - `src/sidebar/styles/tab-mention-dropdown.css`
- **Acceptance Criteria**:
  - Full ARIA compliance (combobox pattern)
  - Keyboard navigation (arrows, enter, escape)
  - Shows favicon, title, domain for each tab
  - Virtualizes list if >20 tabs
  - Click and keyboard selection work
- **Interface Contract**:
  - Props: tabs[], onSelect, position, isOpen
  - Emits tabId on selection

[x] **Task 3.2: Create MultiTabContentPreview Component**

- **Prerequisites**: Task 1.1
- **Type**: 🔄 Parallel
- **Description**: Container managing multiple ContentPreview instances
- **Deliverables**:
  - `src/sidebar/components/MultiTabContentPreview.tsx`
  - `src/sidebar/styles/multi-tab-content.css`
- **Acceptance Criteria**:
  - Renders ContentPreview for current tab
  - Renders ContentPreview for each additional tab
  - Warns user if >10 tabs loaded
  - Handles individual tab removal
  - Shows loading state per tab
  - Clear all button when multiple tabs
  - Verifies ContentPreview supports onReextract/onClearContent props
- **Interface Contract**:
  - Uses existing ContentPreview component
  - Props match MultiTabContentSection from plan

[x] **Task 3.2b: Adjust ContentPreview for Multi-Tab Context**

- **Prerequisites**: Task 3.2
- **Type**: ⚡ Sequential
- **Description**: Minor adjustments to ContentPreview if needed for multi-tab support
- **Deliverables**:
  - Modified `src/sidebar/components/ContentPreview.tsx` (if needed)
- **Acceptance Criteria**:
  - Ensures onReextract prop works for individual tabs
  - Ensures onClearContent prop works for individual tabs
  - Adds tab identifier to differentiate multiple instances
  - No breaking changes to existing usage
- **Note**: Only needed if ContentPreview doesn't fully support required props

[x] **Task 3.3: Create Tab Loading Indicators**

- **Prerequisites**: None
- **Type**: 🔄 Parallel
- **Description**: Visual indicators for tab loading states
- **Deliverables**:
  - `src/sidebar/components/TabLoadingIndicator.tsx`
- **Acceptance Criteria**:
  - Shows spinner during extraction
  - Shows error state with retry
  - Smooth transitions
  - Consistent with existing UI patterns

### ⚡ Sequential Tasks 3B (depends on 3A and Phase 2)

[x] **Task 3.4: Enhance ChatInput with @ Mention**

- **Prerequisites**: Task 2.2, Task 3.1, Task 2.6
- **Type**: ⚡ Sequential
- **Description**: Add @ mention detection and dropdown to ChatInput
- **Deliverables**:
  - Modified `src/sidebar/components/ChatInput.tsx`
- **Acceptance Criteria**:
  - Detects @ character using useTabMention hook
  - Shows TabMentionDropdown at cursor position
  - Handles tab selection and text insertion
  - Maintains existing ChatInput functionality
- **Risk**: Complex integration with existing component

[x] **Task 3.5: Update ChatPanel with Multi-Tab Preview**

- **Prerequisites**: Task 3.2, Task 2.1
- **Type**: ⚡ Sequential
- **Description**: Integrate MultiTabContentPreview into ChatPanel
- **Deliverables**:
  - Modified `src/sidebar/ChatPanel.tsx`
- **Acceptance Criteria**:
  - Shows MultiTabContentPreview above ChatInput
  - Auto-loads current tab on mount
  - Connects to useMultiTabExtraction hook
  - Maintains existing ChatPanel functionality

[x] **Task 3.6: Add Tab Chips to Input Area**

- **Prerequisites**: Task 3.4
- **Type**: ⚡ Sequential
- **Description**: Visual chips showing selected tabs in input
- **Deliverables**:
  - `src/sidebar/components/TabChip.tsx`
  - Modified ChatInput to show chips
- **Acceptance Criteria**:
  - Shows mini tab indicators
  - Click to remove
  - Hover for tooltip
  - Doesn't interfere with text input

[x] **Task 3.7: Component Tests**

- **Prerequisites**: Task 3.1, Task 3.2
- **Type**: ⚡ Sequential
- **Description**: Test UI components
- **Deliverables**:
  - `tests/sidebar/components/TabMentionDropdown.test.tsx`
  - `tests/sidebar/components/MultiTabContentPreview.test.tsx`
- **Acceptance Criteria**:
  - Tests keyboard navigation
  - Tests ARIA attributes
  - Tests selection callbacks
  - Tests loading states

[x] **Task 3.8: Accessibility Testing**

- **Prerequisites**: Task 3.1, Task 3.4
- **Type**: ⚡ Sequential
- **Description**: Ensure WCAG 2.1 AA compliance
- **Deliverables**:
  - `tests/sidebar/accessibility-tabs.test.tsx`
- **Acceptance Criteria**:
  - Screen reader compatibility
  - Keyboard-only navigation
  - Focus management
  - ARIA labels and roles

**Synchronization Point 3**: All UI components complete and tested

---

## Phase 4: Integration

### ⚡ Sequential Tasks (all tasks depend on previous phases)

[x] **Task 4.1: Update useAIChat Hook**

- **Prerequisites**: Phase 2 complete, Task 2.5
- **Type**: ⚡ Sequential
- **Description**: Modify AI chat hook to include multi-tab content
- **Deliverables**:
  - Modified `src/sidebar/hooks/ai/useAIChat.ts`
- **Acceptance Criteria**:
  - Integrates with useMultiTabExtraction
  - Gets loaded tabs from store
  - Maintains existing functionality
- **Critical**: Don't break existing chat flow

[x] **Task 4.2: Update Message Handler for Multi-Tab**

- **Prerequisites**: Task 4.1, Task 2.5
- **Type**: ⚡ Sequential
- **Description**: Modify message handler to format multi-tab content
- **Deliverables**:
  - Modified `src/sidebar/hooks/ai/useMessageHandler.ts`
- **Acceptance Criteria**:
  - Sanitizes content before formatting
  - Escapes titles and ensures content is markdown-safe
  - Calls formatMultiTabContent before sending
  - Handles truncation warnings from formatter
  - Includes all loaded tab contents
  - Preserves existing message structure
  - Only changes content preparation

[x] **Task 4.3: Connect Background Service to Frontend**

- **Prerequisites**: Phase 1 complete, Task 4.1
- **Type**: ⚡ Sequential
- **Description**: Ensure message passing works end-to-end
- **Deliverables**:
  - Integration verification tests
- **Acceptance Criteria**:
  - GET_ALL_TABS returns tab list
  - EXTRACT_TAB_CONTENT extracts and caches
  - Error handling works properly
  - Cache invalidation works

[x] **Task 4.4: Session State Management**

- **Prerequisites**: Task 2.3, Task 4.2
- **Type**: ⚡ Sequential
- **Description**: Ensure proper state lifecycle and cache cleanup
- **Deliverables**:
  - Modified ChatPanel for session management
- **Acceptance Criteria**:
  - Current tab loads once on mount
  - Loaded tabs persist during session
  - State clears on sidebar close
  - Background TabContentCache cleared for loaded tab IDs on close
  - Sends cleanup message to background on unmount
  - No memory leaks

[x] **Task 4.5: Error Boundary Implementation**

- **Prerequisites**: Task 4.1
- **Type**: ⚡ Sequential
- **Description**: Add error boundaries for tab operations
- **Deliverables**:
  - `src/sidebar/components/TabErrorBoundary.tsx`
- **Acceptance Criteria**:
  - Catches extraction errors
  - Shows user-friendly messages
  - Allows retry
  - Doesn't crash sidebar

[x] **Task 4.6: End-to-End Testing**

- **Prerequisites**: Task 4.3, Task 4.4
- **Type**: ⚡ Sequential
- **Description**: Full flow testing
- **Deliverables**:
  - `tests/e2e/multi-tab-flow.test.ts`
- **Acceptance Criteria**:
  - Tests auto-load on open
  - Tests @ mention flow
  - Tests message sending with multiple tabs
  - Tests tab removal and re-add

[x] **Task 4.7: Performance Testing**

- **Prerequisites**: Task 4.6
- **Type**: ⚡ Sequential
- **Description**: Ensure performance targets met
- **Deliverables**:
  - `tests/performance/multi-tab-perf.test.ts`
- **Acceptance Criteria**:
  - Extraction under 2s per tab
  - Dropdown renders under 100ms
  - No UI jank with 10+ tabs
  - Memory usage reasonable

[x] **Task 4.8: Accessibility Tests for TabMentionDropdown**

- **Prerequisites**: Task 3.1, Task 3.4
- **Type**: ⚡ Sequential
- **Description**: A11y tests for dropdown combobox pattern
- **Deliverables**:
  - `tests/sidebar/accessibility-dropdown.test.tsx`
- **Acceptance Criteria**:
  - Tests ARIA combobox keyboard navigation
  - Tests aria-activedescendant updates
  - Tests roving tabindex
  - Tests screen reader announcements
  - Tests focus trap and escape handling

[x] **Task 4.9: Visual Regression Tests for Stacked Previews**

- **Prerequisites**: Task 3.2, Task 3.5
- **Type**: ⚡ Sequential
- **Description**: Visual snapshot tests for multi-tab previews
- **Deliverables**:
  - `tests/sidebar/visual-multi-tab.test.tsx`
- **Acceptance Criteria**:
  - Snapshots for 1, 3, 5, 10+ tabs loaded
  - Snapshots for loading states
  - Snapshots for error states
  - Snapshots for truncation warnings
  - Tests layout doesn't break with many tabs

**Synchronization Point 4**: Full integration complete and tested

---

## Phase 5: Polish & UX

### 🔄 Parallel Tasks (can be done in parallel after Phase 4)

[x] **Task 5.1: Add Loading Animations**

- **Prerequisites**: Phase 4 complete
- **Type**: 🔄 Parallel
- **Description**: Smooth loading states and transitions
- **Deliverables**:
  - CSS animations for tab loading
  - Skeleton loaders for content
- **Acceptance Criteria**:
  - Smooth fade-in/out
  - No jarring layout shifts
  - Consistent with existing animations

[x] **Task 5.2: Add Favicon Fetching**

- **Prerequisites**: Phase 4 complete
- **Type**: 🔄 Parallel
- **Description**: Fetch and display tab favicons
- **Deliverables**:
  - Favicon display in dropdown and chips
- **Acceptance Criteria**:
  - Falls back to generic icon on error
  - Caches favicon URLs
  - Uses Google favicon service

[x] **Task 5.3: Add Keyboard Shortcuts**

- **Prerequisites**: Phase 4 complete
- **Type**: 🔄 Parallel
- **Description**: Power user keyboard shortcuts
- **Deliverables**:
  - input `@` to open dropdown (check if already implement first)
  - Escape to close
  - Tab to navigate
- **Acceptance Criteria**:
  - Doesn't conflict with existing shortcuts
  - Works in Shadow DOM
  - Discoverable via tooltip

[x] **Task 5.4: Documentation and Help**

- **Prerequisites**: Phase 4 complete
- **Type**: 🔄 Parallel
- **Description**: User documentation
- **Deliverables**:
  - Inline help tooltips
  - First-time user guide
  - Update README.md
- **Acceptance Criteria**:
  - Clear explanation of @ mention
  - Screenshots of feature
  - Troubleshooting section

**Final Synchronization**: All phases complete, ready for release

---

## Risk Mitigation Notes

1. **Shadow DOM Complexity**: Task 2.6 and 3.1 may face styling challenges
   - Mitigation: Use React portal if needed for dropdown

2. **Content Script Availability**: Task 1.6 may fail on some pages
   - Mitigation: Implement chrome.scripting.executeScript fallback

3. **Performance with Many Tabs**: Task 3.1 may lag with 50+ tabs
   - Mitigation: Implement virtual scrolling early

4. **Message Size Limits**: Task 2.5 may hit Chrome message size limits
   - Mitigation: Implement content chunking or compression

5. **Service Worker Suspension**: Task 1.3 cache may be lost
   - Mitigation: Use chrome.storage.session as planned

## Success Metrics

- ✅ Current tab auto-loads once per session
- ✅ @ mention works throughout conversation
- ✅ No duplicate tab loading
- ✅ All tabs show in ContentPreview components
- ✅ Content sent with proper XML structure
- ✅ Existing chat flow unchanged
- ✅ Performance targets met
- ✅ Accessibility compliant
