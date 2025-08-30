# Tab ID + URL Based Chat Session Management Implementation Plan

## Overview

Implement a session management system where chat history persists in memory based on the combination of tab ID and URL. Each unique tab+URL pair maintains its own independent chat session.

## Core Requirements

1. **No persistent storage** - All sessions exist only in memory
2. **Manual clear preserved** - User can manually clear current session via UI button
3. **Tab+URL session keys** - Sessions identified by `tab_${tabId}:${normalizedUrl}`
4. **Automatic session switching** - Load appropriate session when sidebar opens
5. **Preserve open chat behavior** - URL changes while chat is open don't affect current conversation
6. **Memory management** - Clear all sessions for a tab when tab closes
7. **Content edit restrictions** - Disable extracted content editing once chat starts for specific tab+URL session

## Detailed Implementation Plan

### Phase 1: Update Data Store Structure

#### File: `/src/data/store/chat.ts`

**New State Properties:**

```typescript
sessions: Record<string, SessionData>; // All chat sessions (using Record for better Zustand compatibility)
activeSessionKey: string | null; // Current active session
```

**SessionData Structure:**

```typescript
interface SessionData {
  // Core message state
  messages: ChatMessage[];
  conversationId: string;
  lastResponseId: string | null;

  // Session-specific UI state
  isLoading: boolean;
  error: string | null;
  activeMessageId: string | null;

  // Multi-tab state
  loadedTabs: Record<number, TabContent>;
  tabSelectionOrder: number[];
  currentTabId: number | null;
  hasAutoLoaded: boolean;

  // Metadata
  tabId: number; // The tab this session belongs to
  url: string; // The URL this session is for (normalized)
  createdAt: number;
  lastAccessedAt: number;
}
```

**New Methods:**

- `createSessionKey(tabId: number, url: string): string` - Generate normalized session key
- `getOrCreateSession(tabId: number, url: string): SessionData` - Get existing or create new
- `switchSession(tabId: number, url: string): void` - Switch active session
- `clearSession(sessionKey: string): void` - Clear specific session
- `clearTabSessions(tabId: number): void` - Clear all sessions for a tab
- `clearCurrentSession(): void` - Clear only the active session (for manual clear button)
- `getActiveSession(): SessionData | null` - Get current active session
- `hasSession(tabId: number, url: string): boolean` - Check if session exists
- `getSessionMessageCount(tabId: number, url: string): number` - Get message count for session
- `getAllSessionKeys(): string[]` - Get all session keys (for debugging/memory management)

**Modified Methods:**

- Update all existing methods to operate on active session instead of direct state

**Why Record instead of Map:**

- Better Zustand compatibility (proper change detection)
- Serializable for debugging and DevTools
- Consistent with existing codebase patterns (`loadedTabs`, etc.)
- Easier TypeScript inference

### Phase 2: Create Session Management Hook

#### New File: `/src/sidebar/hooks/useSessionManager.ts`

**Responsibilities:**

- Get current tab ID and URL on mount
- Switch to appropriate session
- Listen for tab close events
- Handle session lifecycle

**Key Functions:**

```typescript
import { useEffect, useRef } from 'react';
import { useChatStore } from '@/data/store/chat';
import { createMessage } from '@/types/messages';

export function useSessionManager() {
  const { switchSession, clearTabSessions } = useChatStore();
  const currentSessionRef = useRef<{ tabId: number; url: string } | null>(null);

  // Get current tab info on mount
  useEffect(() => {
    async function initSession() {
      try {
        const message = createMessage({
          type: 'GET_TAB_INFO',
          source: 'sidebar',
          target: 'background',
        });

        const response = await chrome.runtime.sendMessage(message);
        if (response?.payload?.tabId && response?.payload?.url) {
          const { tabId, url } = response.payload;
          currentSessionRef.current = { tabId, url };
          switchSession(tabId, url);
        }
      } catch (error) {
        console.error('Failed to initialize session:', error);
      }
    }

    initSession();
  }, [switchSession]);

  // Listen for tab removal events
  useEffect(() => {
    const handleMessage = (message: any) => {
      if (message.type === 'TAB_CLOSED' && message.payload?.tabId) {
        clearTabSessions(message.payload.tabId);

        // If the closed tab was our current session, clear the ref
        if (currentSessionRef.current?.tabId === message.payload.tabId) {
          currentSessionRef.current = null;
        }
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, [clearTabSessions]);

  return { currentSession: currentSessionRef.current };
}
```

### Phase 3: Update ChatPanel Component

#### File: `/src/sidebar/ChatPanel.tsx`

**Changes:**

1. Remove automatic `clearConversation()` on mount (lines 218-220)
2. Add `useSessionManager()` hook at the top of the component
3. Update manual clear button to use `clearCurrentSession()` instead of `clearConversation()`
4. Pass session info to child components that need it (like TabContentItem)

### Phase 4: Enhance Background Message Handling

#### File: `/src/extension/background/messageHandler.ts`

**New Message Type:** `GET_TAB_INFO`

```typescript
interface GetTabInfoPayload {
  tabId: number;
  url: string;
  title?: string;
}
```

**Update Handler:**

```typescript
static async handleGetTabInfo(
  message: Message<void>,
  sender: chrome.runtime.MessageSender
): Promise<Message<GetTabInfoPayload>> {
  if (!sender.tab?.id || !sender.tab?.url) {
    throw new Error('Unable to determine tab info');
  }

  return createMessage<GetTabInfoPayload>({
    type: 'GET_TAB_INFO',
    payload: {
      tabId: sender.tab.id,
      url: sender.tab.url,
      title: sender.tab.title
    },
    source: 'background',
    target: message.source,
  });
}
```

### Phase 5: Add Tab Lifecycle Monitoring

#### File: `/src/extension/background/tabManager.ts`

**Add Tab Removal Listener:**

```typescript
// In constructor or initialization
chrome.tabs.onRemoved.addListener(tabId => {
  // Send message to sidebar if open
  chrome.runtime.sendMessage({
    type: 'TAB_CLOSED',
    payload: { tabId },
  });

  // Clear cache for this tab
  this.cache.clear(tabId);
});
```

### Phase 6: URL Normalization Utility

#### New File: `/src/shared/utils/urlNormalizer.ts`

```typescript
export function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    // Remove trailing slash from pathname
    let normalized = urlObj.origin + urlObj.pathname.replace(/\/$/, '');
    // Include search params (different params = different session)
    if (urlObj.search) {
      normalized += urlObj.search;
    }
    // Exclude hash by default (same page, different anchor = same session)
    // This can be made configurable later
    return normalized;
  } catch {
    return url; // Return as-is if parsing fails
  }
}
```

### Phase 7: Update TabContentItem for Edit Restrictions

#### File: `/src/sidebar/components/TabContentItem.tsx`

**Changes:**

1. Import session checking from chat store
2. Check if current tab+URL session has messages
3. Conditionally render edit functionality in FullscreenModal

**Implementation:**

```typescript
// In TabContentItem component
import { useChatStore } from '@/data/store/chat';
import { useSessionManager } from '@/sidebar/hooks/useSessionManager';

const { getSessionMessageCount } = useChatStore();
const { currentSession } = useSessionManager();

// Check if editing should be disabled for current session
const messageCount = currentSession
  ? getSessionMessageCount(currentSession.tabId, currentSession.url)
  : 0;
const isEditDisabled = messageCount > 0;

// Pass to FullscreenModal
<FullscreenModal
  ...
  editable={!!content && !isEditDisabled}
  ...
/>
```

**Store Method Addition:**

```typescript
// In chat.ts store
getSessionMessageCount: (tabId: number, url: string): number => {
  const sessionKey = createSessionKey(tabId, url);
  const session = get().sessions[sessionKey]; // Record access syntax
  return session ? session.messages.length : 0;
};
```

## Testing Strategy

### Test Cases

1. **Session Persistence**
   - Open Tab A at `example.com`, start chat
   - Close sidebar, reopen → Same conversation continues
2. **URL Navigation**
   - In Tab A, navigate from `example.com` to `example.com/page2`
   - Close and reopen sidebar → New session
   - Navigate back to `example.com`
   - Close and reopen sidebar → Original session restored

3. **Multiple Tabs**
   - Tab A at `example.com` with conversation
   - Tab B at `example.com` → Different session
   - Both maintain independent conversations

4. **Tab Closure**
   - Tab A has multiple sessions at different URLs
   - Close Tab A → All Tab A sessions cleared from memory

5. **Manual Clear**
   - Clear button only clears current tab+URL session
   - Other sessions remain intact

6. **Open Chat Navigation**
   - Chat open while navigating → Conversation continues
   - Only switches session on sidebar reopen

7. **Content Edit Restrictions**
   - Tab A at `example.com`, no chat → Can edit extracted content
   - Start chat in Tab A at `example.com` → Edit button hidden
   - Tab B at `example.com`, no chat → Can still edit (different session)
   - Tab A navigate to `example.com/page2` → Can edit (new session, no chat yet)

## Migration Considerations

- No data migration needed (no persistent storage)
- Graceful handling of existing users (they'll just get new sessions)

## Performance Considerations

1. **Memory Limits**
   - Max sessions per tab: 20 URLs (sliding window, remove oldest)
   - Total max sessions: 100 across all tabs
   - LRU eviction when limits exceeded
   - Warning at 80% capacity

2. **Cleanup Strategy**
   - Clear sessions when tab closes
   - Manual memory pressure relief
   - browser closes
   - extension unload

3. **Optimization**
   - Lazy loading of inactive sessions
   - Compress large message content
   - Debounce session switches

## Future Enhancements

1. **Optional Persistence**
   - Add setting to persist favorite sessions
   - Export/import conversation history

2. **Session Management UI**
   - Show list of active sessions
   - Allow switching between recent sessions
   - Session search/filter

3. **Smart URL Grouping**
   - Option to group similar URLs (e.g., ignore query params)
   - Domain-level sessions option

## Implementation Order

1. **Core Session Management** (Phase 1-2)
   - Update store with session map
   - Create session manager hook

2. **Integration** (Phase 3-4)
   - Update ChatPanel to use sessions
   - Enhance background messaging

3. **Lifecycle & Cleanup** (Phase 5)
   - Add tab removal handling
   - Implement memory management

4. **Polish** (Phase 6-7)
   - URL normalization
   - Content edit restrictions
   - Testing and refinement

## Success Criteria

- ✅ Chat sessions persist based on tab+URL
- ✅ Navigation creates appropriate new/restored sessions
- ✅ Tab closure cleans up memory
- ✅ Manual clear only affects current session
- ✅ No persistent storage used
- ✅ Current open-chat behavior preserved
- ✅ Content editing disabled once chat starts for specific tab+URL

## Implementation Summary

### What Was Actually Done

1. **Store Structure Updates** (`/src/data/store/chat.ts`)
   - Added `sessions: Record<string, SessionData>` to maintain all sessions in memory
   - Added `activeSessionKey: string | null` to track current session
   - Implemented all session management methods as planned
   - Fixed critical state spreading issues to ensure sessions persist across sidebar unmount/remount

2. **Session Manager Hook** (`/src/sidebar/hooks/useSessionManager.ts`)
   - Created hook to manage session lifecycle
   - Gets tab info on mount and switches to appropriate session
   - Listens for TAB_CLOSED events to clean up sessions
   - Returns current session info for other components to use

3. **ChatPanel Integration** (`/src/sidebar/ChatPanel.tsx`)
   - Removed automatic `clearConversation()` on mount
   - Added `useSessionManager()` hook
   - Updated clear button to use `clearCurrentSession()`
   - Now preserves conversation when sidebar reopens

4. **Background Message Handling** (`/src/extension/background/messageHandler.ts`)
   - Added GET_TAB_INFO handler to return tab ID and URL
   - Message types already existed, just needed handler implementation

5. **Tab Lifecycle Monitoring** (`/src/extension/background/sidebarManager.ts`)
   - Added TAB_CLOSED message broadcasting when tabs are removed
   - Sessions are now properly cleaned up when tabs close

6. **URL Normalization** (`/src/shared/utils/urlNormalizer.ts`)
   - Created utility to normalize URLs for consistent session keys
   - Removes trailing slashes, preserves query params, excludes hash

7. **Content Edit Restrictions** (`/src/sidebar/components/TabContentItem.tsx`)
   - Added `useSessionEditRestriction()` hook usage
   - Edit functionality now disabled when session has messages
   - Each session independently tracks its edit restriction

### Key Implementation Details

**Memory-Only Storage**: Sessions are stored in the Zustand store's JavaScript memory, not persisted to disk. They survive sidebar unmount/remount because the store remains in memory, but are lost when the browser/extension restarts.

**State Preservation Fix**: The critical fix was adding spread operators (`...state`) in state updates to preserve the entire state including the sessions object. Without this, sessions were being lost on every state update.

**Session Keys**: Format is `tab_${tabId}:${normalizedUrl}` where the URL is normalized to handle trailing slashes and exclude hash fragments.

**Background Script Integration**: Initially attempted to move session storage to the background script for better persistence, but this was overly complex. The simpler solution of fixing the state spreading in Zustand was sufficient.

### Testing Results

✅ **Session Persistence**: Conversations persist when sidebar is closed and reopened
✅ **URL-Based Sessions**: Different URLs in the same tab get different sessions
✅ **Tab Isolation**: Same URL in different tabs maintains independent sessions
✅ **Tab Cleanup**: Sessions are properly cleared when tabs are closed
✅ **Manual Clear**: Clear button only affects the current session
✅ **Edit Restrictions**: Content editing disabled once a session has messages

### Known Limitations

1. Sessions are lost on browser restart (by design - memory only)
2. No session limit enforcement yet (could implement LRU eviction if needed)
3. No session list UI (future enhancement)

### Files Modified

- `/src/data/store/chat.ts` - Added session management
- `/src/sidebar/ChatPanel.tsx` - Removed auto-clear, added session manager
- `/src/sidebar/components/TabContentItem.tsx` - Added edit restrictions
- `/src/sidebar/hooks/useSessionManager.ts` - New file for session lifecycle
- `/src/extension/background/messageHandler.ts` - Added GET_TAB_INFO handler
- `/src/extension/background/sidebarManager.ts` - Added TAB_CLOSED broadcasting
- `/src/shared/utils/urlNormalizer.ts` - New URL normalization utility
- `/src/types/messages.ts` - Added message type definitions
