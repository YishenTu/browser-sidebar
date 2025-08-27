# Tab Content Injection Implementation Tasks

## Project Overview

Integrate the completed Tab Content Extraction MVP with the existing chat system to enable "chat-with-tab" functionality. Users can ask questions about the webpage they're viewing, with content automatically injected as context on the first message only.

## Core Implementation Strategy

**Two Simple Rules:**

1. **Inject Once**: Tab content is injected ONLY with the first user message (when `messages.length === 0`)
2. **Persist in History**: Content remains in chat history for all follow-up messages

## Task Execution Guidelines

- Sub-agents should focus on their specific task without modifying unrelated code
- All file paths are absolute from project root
- Test changes locally before marking complete
- Preserve existing functionality while adding new features
- Follow existing code patterns and conventions

---

## Phase 1: Data Model Enhancement 🔄 (Parallelizable)

### [x] Task 1.1: Extend ChatMessage Interface

- **Prerequisites**: None
- **Description**: Add fields to ChatMessage interface to support dual content display and multi-tab tracking
- **Files to modify**: `/src/data/store/chat.ts`
- **Deliverables**:
  - Add `displayContent?: string` field for UI-specific text
  - Add metadata fields: `hasTabContext?: boolean`, `originalUserContent?: string`
  - Add `tabId?: number | string` for multi-tab support
  - Add `tabTitle?: string`, `tabUrl?: string` for tab context
  - Ensure backward compatibility with existing messages
- **Acceptance Criteria**:
  - TypeScript compilation passes
  - Existing message creation still works
  - New fields are optional
  - Each tab maintains independent message history

### [x] Task 1.2: Update Store Methods

- **Prerequisites**: Task 1.1
- **Description**: Modify addMessage to accept both content types
- **Files to modify**: `/src/data/store/chat.ts`
- **Deliverables**:
  - Update `addMessage` method signature to accept displayContent
  - Ensure metadata is properly stored
- **Acceptance Criteria**:
  - Can create messages with both content and displayContent
  - Existing code using addMessage continues to work

---

## Phase 2: Content Injection Logic ⚡ (Sequential)

### [x] Task 2.0: Add Tab ID Message Handler

- **Prerequisites**: Task 1.1
- **Description**: Add background message handler to return tab ID
- **Files to modify**: `/src/extension/background/messageHandler.ts`
- **Deliverables**:
  - Add message type `GET_TAB_ID` to message types
  - Handle message in background, return sender.tab.id
  - Ensure response works with async/await in content script
- **Acceptance Criteria**:
  - Background correctly returns tab ID
  - Content script can request and receive tab ID
  - No errors in message passing

### [x] Task 2.1: Import Dependencies

- **Prerequisites**: Task 1.1, Task 1.2
- **Description**: Add necessary imports to ChatPanel
- **Files to modify**: `/src/sidebar/ChatPanel.tsx`
- **Deliverables**:
  - Import extractedContent from content store (if needed)
  - Ensure all required types are imported
- **Acceptance Criteria**:
  - No TypeScript import errors
  - All required dependencies available

### [x] Task 2.2: Implement Content Injection in handleSendMessage

- **Prerequisites**: Task 2.1
- **Description**: Modify handleSendMessage to inject content on first message with tab tracking
- **Files to modify**: `/src/sidebar/ChatPanel.tsx`
- **Deliverables**:
  - Check if first message using `messages.length === 0`
  - Format content with webpage metadata and user question
  - Set both content (for API) and displayContent (for UI)
  - Add metadata to track injection including tabId
  - Request tab ID via `chrome.runtime.sendMessage` to background (content scripts can't access chrome.tabs)
  - Background responds with sender.tab.id
- **Acceptance Criteria**:
  - First message includes tab content in API call
  - Subsequent messages sent normally
  - No content injection on non-first messages
  - UI shows only user input, not injected content
  - Performance impact < 100ms
  - TabId correctly tracked in metadata via background messaging

### [x] Task 2.3: Update Message Creation Call

- **Prerequisites**: Task 2.2
- **Description**: Ensure message is created with both contents
- **Files to modify**: `/src/sidebar/ChatPanel.tsx`
- **Deliverables**:
  - Pass both content and displayContent to addMessage
  - Include metadata object with injection tracking
- **Acceptance Criteria**:
  - Message stored correctly with both content fields
  - Metadata properly attached to message

---

## Phase 3: UI Display Updates 🔄 (Parallelizable after Phase 2)

### [x] Task 3.1: Update MessageBubble Display Logic

- **Prerequisites**: Task 1.1
- **Description**: Modify MessageBubble to use displayContent when available
- **Files to modify**: `/src/sidebar/components/MessageBubble.tsx`
- **Deliverables**:
  - Use `message.displayContent || message.content` for rendering
  - Update copy functionality to use `displayContent || content` for user messages
  - Ensure proper text rendering for both cases
- **Acceptance Criteria**:
  - Messages with displayContent show only that content
  - Messages without displayContent show regular content
  - Copy button copies displayContent (not injected content) for user messages
  - No visual breaking changes

### [x] Task 3.2: Add Context Indicator

- **Prerequisites**: Task 3.1
- **Description**: Add visual indicator for messages with tab context
- **Files to modify**: `/src/sidebar/components/MessageBubble.tsx`
- **Deliverables**:
  - Small icon/badge when `message.metadata?.hasTabContext` is true
  - Tooltip showing page title from metadata
  - CSS styling for indicator
- **Acceptance Criteria**:
  - Indicator appears only on messages with tab context
  - Tooltip displays page title on hover
  - Indicator is subtle and non-intrusive

### [x] Task 3.3: Style Context Indicator

- **Prerequisites**: Task 3.2
- **Description**: Add CSS for context indicator
- **Files to modify**: `/src/sidebar/styles/sidebar.css`
- **Deliverables**:
  - `.tab-context-indicator` class styling
  - Tooltip styling
  - Icon positioning and sizing
- **Acceptance Criteria**:
  - Indicator visually appealing and consistent with design
  - Tooltip properly positioned and readable

---

## Phase 4: Session Management ⚡ (Sequential)

### [x] Task 4.1: Handle New Conversation and Panel Open

- **Prerequisites**: Task 2.2
- **Description**: Ensure new conversations and panel reopening allow fresh injection
- **Files to modify**: `/src/sidebar/ChatPanel.tsx`
- **Deliverables**:
  - Verify clearConversation empties messages array
  - Handle panel mount/unmount for fresh sessions
  - No additional state management needed (empty array = inject on next)
- **Acceptance Criteria**:
  - New conversation button clears all messages
  - Panel reopening starts fresh conversation (empty messages)
  - Next message after clear/reopen gets content injection
  - Note: Tab close automatically cleans content script state (no persistence after tab close)

### [x] Task 4.2: Verify URL Change Behavior

- **Prerequisites**: Task 4.1
- **Description**: Ensure URL changes don't affect ongoing conversation
- **Files to modify**: None (verification only)
- **Deliverables**:
  - Document that URL changes preserve conversation
  - Verify content remains from original extraction
- **Acceptance Criteria**:
  - Changing URLs doesn't clear messages
  - Existing conversation continues normally
  - No re-injection on URL change

### [x] Task 4.3: Handle Message Editing

- **Prerequisites**: Task 3.1
- **Description**: Preserve edit flow with original user content
- **Files to modify**: `/src/sidebar/components/Footer.tsx`, `/src/sidebar/ChatPanel.tsx`
- **Deliverables**:
  - Edit mode should use `metadata.originalUserContent || displayContent || content`
  - On resend after edit: rebuild injection if first message, otherwise send normally
  - Preserve metadata structure during edit
- **Acceptance Criteria**:
  - Edit shows user's original input, not injected content
  - Edited first message re-injects content
  - Edited subsequent messages don't inject
  - Metadata preserved through edit cycle

### [x] Task 4.4: Add Error Notifications

- **Prerequisites**: Task 2.2
- **Description**: Show user-friendly error when extraction fails
- **Files to modify**: `/src/sidebar/ChatPanel.tsx`
- **Deliverables**:
  - Check if extraction failed or unavailable
  - Display warning using ErrorBanner component
  - Allow message to proceed without injection
- **Acceptance Criteria**:
  - User sees clear warning about missing context
  - Chat continues normally without injection
  - Error dismissible by user

---

## Phase 5: Testing & Validation 🔄 (Parallelizable)

### [x] Task 5.1: Unit Tests - Store and Injection Logic

- **Prerequisites**: All Phase 2 tasks
- **Description**: Create unit tests for data model and injection logic
- **Files to create**: `/tests/store/chat-injection.test.ts`
- **Deliverables**:
  - Test displayContent field storage and retrieval
  - Test metadata preservation including tabId
  - Test first message injection logic
  - Test subsequent message handling
- **Acceptance Criteria**:
  - All tests pass
  - > 90% coverage of modified store methods
  - Edge cases covered (null content, empty messages)

### [x] Task 5.2: Integration Tests - Provider Streaming

- **Prerequisites**: Task 5.1
- **Description**: Test providers handle injected content correctly
- **Files to create**: `/tests/integration/provider-injection.test.ts`
- **Deliverables**:
  - Test OpenAI streaming with injected content
  - Test Gemini streaming with injected content
  - Verify large content handling (200K chars)
  - Test conversation history preservation
- **Acceptance Criteria**:
  - Both providers handle injected content
  - Streaming works without errors
  - Context maintained in subsequent calls
  - Performance within 100ms overhead

### [x] Task 5.3: UI Tests - Display and Interaction

- **Prerequisites**: Task 3.1, 3.2
- **Description**: Test UI components handle dual content correctly
- **Files to create**: `/tests/sidebar/components/MessageBubble-injection.test.tsx`
- **Deliverables**:
  - Test displayContent rendering
  - Test context indicator appearance
  - Test tooltip functionality
  - Test copy behavior (copies displayContent)
  - Test edit flow preservation
- **Acceptance Criteria**:
  - UI shows only user input for injected messages
  - Context indicator visible and functional
  - Copy/edit use correct content
  - Accessibility standards met

### [x] Task 5.4: E2E Tests - Full User Workflows

- **Prerequisites**: All previous tasks
- **Description**: Test complete user flows end-to-end
- **Files to create**: `/tests/e2e/content-injection.test.ts`
- **Deliverables**:
  - Test: Open sidebar → Extract → Ask question → Get response
  - Test: Multiple tab switching with independent contexts
  - Test: New conversation reset flow
  - Test: Panel close/reopen behavior
  - Test: URL changes preserve conversation
  - Test: Edit and resend first message
- **Acceptance Criteria**:
  - All user flows work as expected
  - Multi-tab independence verified
  - Performance < 100ms impact
  - No memory leaks on tab close

---

## Synchronization Points

### After Phase 1 ✓

- Orchestrator verify: Data model changes compile
- Check: No breaking changes to existing functionality

### After Phase 2 ✓

- Orchestrator verify: Content injection logic works
- Check: First message includes content, subsequent don't

### After Phase 3 ✓

- Orchestrator verify: UI displays correctly
- Check: Clean UI with subtle indicators

### After Phase 4 ✓

- Orchestrator verify: Session management correct
- Check: New conversations reset properly

### After Phase 5 ✓

- Final verification: Complete user flow works
- Check: All acceptance criteria met

---

## Risk Mitigation

### Potential Blockers

1. **Content extraction not available**: Task 2.2 should handle gracefully with null check
2. **TypeScript errors**: Task 1.1 must ensure backward compatibility
3. **UI breaking**: Task 3.1 must preserve existing message rendering
4. **Performance issues**: Monitor with large content (already clamped to 200K)

### Critical Path

Tasks 1.1 → 1.2 → 2.1 → 2.2 form the critical path. These must be completed sequentially for core functionality.

---

## Progress Tracking

### Phase Completion

- [x] Phase 1: Data Model (2 tasks)
- [x] Phase 2: Injection Logic (4 tasks)
- [x] Phase 3: UI Updates (3 tasks)
- [x] Phase 4: Session Management (2 tasks)
- [x] Phase 4.5: Edit and Error Handling (2 tasks)
- [x] Phase 5: Testing (4 tasks)

### Overall Progress

- Total Tasks: 17
- Completed: 17
- In Progress: 0
- Remaining: 0

---

## Interface Contracts

### ChatMessage Interface Extension

```typescript
interface ChatMessage {
  // existing fields...
  displayContent?: string;
  metadata?: {
    hasTabContext?: boolean;
    originalUserContent?: string;
    tabId?: number | string;
    tabTitle?: string;
    tabUrl?: string;
  };
}
```

### Content Injection Format

```typescript
const injectedContent = `I'm looking at a webpage with the following content:

Title: ${extractedContent.title}
URL: ${extractedContent.url}
Domain: ${extractedContent.domain}

Content:
${extractedContent.content}

---
My question: ${userInput}`;
```

### Execution Priority

1. **High Priority**: Tasks 1.1, 1.2, 2.1, 2.2 (core functionality)
2. **Medium Priority**: Tasks 3.1, 3.2, 4.1 (user experience)
3. **Low Priority**: Tasks 3.3, 4.2, 5.1-5.4 (polish and validation)

---

## Notes for Sub-Agents

- **DO NOT** modify provider implementations - they already handle messages correctly
- **DO NOT** add system messages - use user message injection as specified
- **DO NOT** track state beyond empty message check - simplicity is key
- **DO NOT** use chrome.tabs API in content scripts - request tab ID from background instead
- **DO** preserve existing functionality while adding new features
- **DO** follow the existing code style and patterns
- **DO** test your changes before marking complete

### Important Architecture Notes

- **Tab ID Retrieval**: Content scripts cannot access chrome.tabs API. Must request tab ID from background service worker via chrome.runtime.sendMessage
- **Tab State Cleanup**: Content script state (including sidebar) is automatically cleaned when tab closes. Only use chrome.tabs.onRemoved in background if caching tab-specific data there
