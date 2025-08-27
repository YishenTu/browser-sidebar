# Tab Content Injection Implementation Plan

## Project Context

This implementation integrates the completed Tab Content Extraction MVP (Phase 6) with the existing chat system to create a true "chat-with-tab" product. Users can ask questions about the webpage they're viewing, with the content automatically provided as context to the AI.

## Current State Analysis

### ✅ Completed Components

- **Content Extraction**: Fully functional, auto-extracts when sidebar opens
  - Returns markdown-formatted content via `extractedContent.content`
  - Includes metadata: title, URL, domain, word count, extraction method
- **Chat System**: Complete with AI provider integration
  - Supports both OpenAI and Gemini providers
  - Full streaming and conversation management
- **Message Types**: System, user, and assistant roles supported
  - Chat store manages conversation history
  - All messages sent with each API call (stateless APIs)

### 🔍 Key Findings

1. **Content Format**: Already in markdown via `extractedContent.content` field
2. **API Behavior**: Both OpenAI and Gemini APIs are stateless
   - Full conversation history sent with every request
   - System messages included automatically in history
3. **UI Requirements**:
   - Users don't want content displayed in chat (takes too much space)
   - Content should be injected with first user message
   - Must remain in conversation history for context

## Design Decision: Two Simple Rules

### Why This Approach?

1. **Dead Simple**: Just check if first message, inject if yes
2. **Natural Context**: "I'm looking at this webpage" is natural first message
3. **History Continuity**: Content stays for all follow-ups
4. **Clean UI**: Only show user's actual question
5. **No State Management**: No variables to track or sync
6. **Foolproof**: Can't mess up two simple rules

## Implementation Pipeline

### Data Flow

```
User types question
    ↓
ChatPanel checks if first message
    ↓
If yes: Inject tab content + question
If no: Send question normally
    ↓
Store shows user question only (displayContent)
    ↓
API receives full content (content field)
    ↓
AI responds with webpage context
    ↓
Subsequent messages sent normally
(context maintained in history)
```

## Core Approach - Two Simple Rules

### Rule 1: Inject Once

**Tab content is injected ONLY with the first user message**

- Check: Is the chat history empty? (`messages.length === 0`)
- If yes → This is the first message, inject content
- If no → Send message normally

### Rule 2: Persist in History

**Content remains in chat history for all follow-up messages**

- The injected content stays in the conversation
- AI has full context for all subsequent messages
- No need to track injection state

### That's It!

- No complex state management needed
- No need to track `tabContextInjected`
- No synchronization issues
- No duplicate injection risks
- URL changes don't matter (content already in history)
- Multi-tab support is automatic (each tab has own message history)

## Implementation Strategy

### Phase 1: Message Enhancement

**File**: `src/data/store/chat.ts`

Add fields to track message display:

```typescript
export interface ChatMessage {
  // ... existing fields
  displayContent?: string; // What to show in UI (if different from content)
  metadata?: {
    // ... existing fields
    hasTabContext?: boolean; // Indicates message includes tab content
    originalUserContent?: string; // User's actual input without context
  };
}
```

### Phase 2: Content Injection in ChatPanel

**File**: `src/sidebar/ChatPanel.tsx`

```typescript
const handleSendMessage = useCallback(
  async (userInput: string) => {
    let actualContent = userInput;
    let displayContent = userInput;
    let metadata = {};

    // SIMPLE RULE: Inject only if chat history is empty
    const isFirstMessage = messages.length === 0;

    if (isFirstMessage && extractedContent?.content) {
      // Format the full content for API
      actualContent = `I'm looking at a webpage with the following content:

Title: ${extractedContent.title}
URL: ${extractedContent.url}
Domain: ${extractedContent.domain}

Content:
${extractedContent.content}

---
My question: ${userInput}`;

      // Only show user's original input in UI
      displayContent = userInput;

      // Track metadata
      metadata = {
        hasTabContext: true,
        originalUserContent: userInput,
        tabTitle: extractedContent.title,
        tabUrl: extractedContent.url,
      };
    }

    // Add message to store with both contents
    const message = addMessage({
      role: 'user',
      content: actualContent, // Full content for API
      displayContent: displayContent, // Just user input for UI
      status: 'sending',
      metadata,
    });

    // Send to AI (will use the full content)
    await sendMessage(actualContent, { streaming: true });
  },
  [extractedContent, messages, addMessage, sendMessage]
);
```

### Phase 3: Update Message Display

**File**: `src/sidebar/components/MessageBubble.tsx`

```typescript
// Use displayContent if available, otherwise use content
const messageText = message.displayContent || message.content;

// Add small indicator if message has tab context
{message.metadata?.hasTabContext && (
  <div className="tab-context-indicator">
    <Icon name="document" size={12} />
    <span className="tooltip">Includes page: {message.metadata.tabTitle}</span>
  </div>
)}
```

### Phase 4: Handle New Sessions (SIMPLIFIED)

**File**: `src/sidebar/ChatPanel.tsx`

```typescript
// New conversation = empty message history = next message is first
const handleNewConversation = () => {
  clearConversation(); // Empty messages array
  // Next message will be first, so content will be injected
};

// URL changes? Don't care! Content already in history
// Tab switches? Each tab has its own message history
```

### Phase 5: Provider Handling

**No changes needed** - Providers already handle messages correctly:

- They receive the full `content` field with tab context
- Chat history naturally includes the context for subsequent messages
- APIs are stateless so full history sent each time

## Implementation Phases

### Phase 1: Data Model Enhancement

#### Objective

Extend the chat message structure to support dual content (API vs UI display)

#### Modifications Required

1. **ChatMessage Interface** (`src/data/store/chat.ts`)
   - Add `displayContent?: string` field for UI-specific text
   - Extend metadata to track tab context inclusion
   - Maintain backward compatibility

2. **Store Methods**
   - Update `addMessage` to accept both content types
   - No changes to existing message flow

### Phase 2: Content Injection Logic

#### Objective

Implement smart content injection on first user message

#### Core Components

1. **Simple Check** (`src/sidebar/ChatPanel.tsx`)
   - Check if chat history is empty: `messages.length === 0`
   - No state tracking needed
   - No resets needed

2. **Message Formatting**
   - Create structured prompt with webpage context
   - Preserve original user input for display
   - Add metadata for tracking

### Phase 3: UI Display Updates

#### Objective

Show clean UI while maintaining full context in background

#### UI Changes

1. **MessageBubble Component** (`src/sidebar/components/MessageBubble.tsx`)
   - Use `displayContent` when available
   - Fall back to `content` for compatibility
   - Add subtle indicator for context inclusion

2. **Visual Indicators**
   - Small icon showing page context included
   - Tooltip with page title
   - No full content display

### Phase 4: State Synchronization

#### Objective

Handle new sessions and conversation changes gracefully

#### Synchronization Points

1. **New Sessions**
   - Reset injection flag when chat panel opens
   - Reset when user clicks new conversation button
   - Each tab maintains independent injection state

2. **URL Changes**
   - **DO NOT** reset injection or conversation
   - Preserve ongoing chat history
   - Content remains from original extraction

3. **Multi-Tab Support**
   - Each tab has its own chat panel instance
   - Tab-specific content extraction
   - Independent injection states per tab
   - Track tab ID in message metadata

4. **Edge Cases**
   - No extraction available: proceed normally
   - Extraction failure: show warning
   - Message editing: preserve structure

## Detailed Implementation Tasks

### Task 1: Enhance Message Interface (15 min)

- Add `displayContent` field to ChatMessage
- Add metadata fields for tab context tracking
- Update message creation to support both contents

### Task 2: Implement Content Injection (25 min)

- Modify handleSendMessage to inject content
- Format combined message for first user input
- Track injection state
- Set both content and displayContent

### Task 3: Update UI Components (20 min)

- Modify MessageBubble to use displayContent
- Add subtle indicator for context inclusion
- Ensure proper text rendering

### Task 4: Handle New Sessions (15 min)

- Reset injection on new sessions (mount, new conversation)
- Track tab ID for multi-tab support
- DO NOT reset on URL changes
- Clear injection flag only on new conversations

### Task 5: Test Integration (15 min)

- Verify content is sent to API
- Confirm UI shows only user input
- Test tab switching behavior
- Check conversation continuity

## Key Benefits

1. **Simplicity**: No system message complexity
2. **Natural flow**: Content is part of conversation history
3. **Clean UI**: Users see only their input
4. **API continuity**: Full context maintained in history
5. **No provider changes**: Works with existing implementation
6. **URL stability**: Conversations persist through navigation
7. **Multi-tab support**: Independent chat sessions per tab

## Edge Cases

- **No content extracted**: Send user message normally
- **Multiple questions**: Only inject on first message of each session
- **URL changes**: DO NOT affect ongoing conversation
- **New conversation**: Reset injection state for fresh context
- **Multiple tabs**: Each maintains independent chat state
- **Message editing**: Preserve original structure
- **Tab closing**: Clean up tab-specific state

## Visual Design

```
User sees in chat:
[User]: How does the authentication work?

API receives:
[User]: I'm looking at a webpage with the following content:
Title: Authentication Guide
URL: https://example.com/auth
Content: [full markdown content]
---
My question: How does the authentication work?

[Assistant]: Based on the page content, the authentication works by...

[User]: What about refresh tokens?  <- (no injection, just normal message)
```

## Testing Strategy

### Unit Tests

1. **Chat Store Tests**
   - Verify displayContent field works correctly
   - Test metadata preservation
   - Ensure backward compatibility

2. **Content Injection Tests**
   - Test first message injection
   - Verify subsequent messages normal
   - Check URL change behavior

### Integration Tests

1. **Provider Tests**
   - Verify OpenAI receives full content
   - Verify Gemini receives full content
   - Test streaming with injected content

2. **UI Tests**
   - Confirm only user input shown
   - Verify context indicator appears
   - Test tooltip functionality

### E2E Tests

1. **User Flow**
   - Open sidebar → Extract content → Ask question
   - Verify AI response uses page context
   - Ask follow-up → Verify context maintained

2. **URL Changes**
   - Change URL → Verify conversation preserved
   - Content remains from original extraction
   - No re-injection occurs

3. **New Sessions**
   - Click new conversation → Fresh injection
   - Close and reopen panel → Fresh injection

4. **Multi-Tab**
   - Open multiple tabs with sidebars
   - Verify independent content injection
   - Each tab maintains own state

## Success Criteria

✅ Tab content automatically injected with first user message  
✅ Only user's input visible in chat UI (clean interface)
✅ Full context sent to API and maintained in history  
✅ Works seamlessly with both OpenAI and Gemini providers
✅ Minimal UI clutter with subtle context indicators
✅ Natural conversation flow for users
✅ Graceful handling of edge cases
✅ Performance impact < 100ms

## Risk Mitigation

### Potential Risks

1. **Large Content Size**
   - Risk: API token limits exceeded
   - Mitigation: Content already clamped to 200K chars
   - Future: Implement smart truncation

2. **Content Injection Failure**
   - Risk: Extraction fails or unavailable
   - Mitigation: Graceful fallback to normal chat
   - User notification of missing context

3. **UI Confusion**
   - Risk: Users unaware of context inclusion
   - Mitigation: Clear visual indicators
   - Future: Settings to control behavior

## Timeline

### Development Schedule

- **Task 1-2**: 40 minutes (core implementation)
  - 15 min: Message interface updates
  - 25 min: Content injection logic
- **Task 3-4**: 35 minutes (UI and state)
  - 20 min: UI component updates
  - 15 min: State management
- **Task 5**: 15 minutes (testing)
  - Manual testing with real pages
  - Provider verification
- **Total: ~90 minutes**

### Rollout Plan

1. **Phase 1**: Core implementation (Tasks 1-2)
2. **Phase 2**: UI polish (Tasks 3-4)
3. **Phase 3**: Testing & refinement (Task 5)
4. **Phase 4**: User feedback & iteration

## Why This Simple Approach Works

### No State Management Needed

By following the two simple rules, we eliminate all state management complexity:

1. **Empty History Check**: `messages.length === 0`
2. **Inject if Empty**: Add content to the first message
3. **Done**: Content stays in history for all future messages

### Benefits

- **Zero State Variables**: No `tabContextInjected` to track
- **No Synchronization**: Nothing to keep in sync
- **No Edge Cases**: Can't inject twice, can't lose state
- **Automatic Persistence**: Content in history = context preserved
- **URL Change Safe**: Content already captured, no re-injection needed
- **Multi-tab Simple**: Each tab's message history is independent

## Technical Architecture

### Message Flow Architecture

```
┌─────────────┐     ┌──────────────┐     ┌───────────┐
│   ChatPanel │────>│  Chat Store  │────>│    API    │
│             │     │              │     │           │
│ - Inject    │     │ - content    │     │ Full      │
│   content   │     │ - displayContent│     │ Context   │
│ - Track     │     │ - metadata   │     │           │
│   state     │     │              │     │           │
└─────────────┘     └──────────────┘     └───────────┘
       ↑                    ↓                   ↓
       │            ┌──────────────┐     ┌───────────┐
       │            │ MessageBubble│     │    AI     │
       └────────────│              │<────│  Response │
                    │ Shows only   │     │           │
                    │ displayContent│     │ With      │
                    └──────────────┘     │ Context   │
                                        └───────────┘
```

### Why Not System Messages?

- System messages would need to be tracked separately
- More complex to hide from UI
- User messages are more natural for "I'm looking at this content" context
- Simpler implementation with existing infrastructure

### API Behavior Analysis

#### OpenAI API

- **Stateless**: No conversation memory between calls
- **History Management**: Full message array sent each time
- **System Message Support**: Extracts and uses in instructions field
- **Context Window**: Automatically included in all subsequent calls

#### Gemini API

- **Stateless**: Requires full history each call
- **ChatSession Alternative**: Can use session API for state management
- **Content Format**: Accepts messages with user/model roles
- **Context Persistence**: Maintained through conversation history

### Memory & Performance Considerations

#### Current Implementation

- **No limits**: Full content sent for complete context
- **Natural truncation**: Content already clamped to 200K chars in extraction
- **History growth**: Each message adds to total context

#### Future Optimizations

- **Context windowing**: Limit to last N messages + initial context
- **Smart summarization**: Compress older messages while preserving context
- **Selective inclusion**: Only include relevant parts based on query
- **Token counting**: Track and optimize token usage

### Security & Privacy

1. **Content Isolation**
   - Tab content only accessible within conversation
   - No cross-tab content leakage
   - Clear on new conversation only

2. **API Security**
   - Content sent over HTTPS
   - User's own API keys used (BYOK model)
   - No server-side storage

3. **User Control**
   - Content injection transparent via indicators
   - Can clear conversation anytime
   - Future: Toggle content inclusion in settings
