# Multi-Tab Content Injection Implementation Plan

## Overview

Implement a feature that allows users to inject content from multiple browser tabs into their AI chat prompts using an `@` mention system.

## Architecture Design

### 1. Data Structures

**TabInfo Type** (`src/types/tabs.ts`)

```typescript
interface TabInfo {
  id: number;
  title: string;
  url: string;
  domain: string;
  windowId?: number;
  index?: number;
  favIconUrl?: string;
  incognito?: boolean;
  active: boolean;
  lastAccessed?: number;
}

interface TabContent extends TabInfo {
  content: ExtractedContent | null;
  loading: boolean;
  extractedAt?: number;
  error: Error | null;
}

interface MultiTabExtractionState {
  currentTab: TabContent | null;
  availableTabs: TabInfo[];
  loadedTabs: Record<number, TabContent>; // Changed from Map to Record for serialization
}
```

### 2. Component Architecture

**TabMentionDropdown Component** (`src/sidebar/components/TabMentionDropdown.tsx`)

- Floating dropdown that appears when user types `@`
- Shows list of available tabs with favicon, title, and domain
- Excludes already loaded tabs
- Full ARIA support with combobox pattern
- Keyboard navigation (arrow keys, enter, escape)
- Click to select
- Virtualization for >20 tabs

```typescript
// Accessibility-compliant dropdown structure
<div
  role="combobox"
  aria-expanded={isOpen}
  aria-haspopup="listbox"
  aria-owns="tab-listbox"
>
  <ul
    id="tab-listbox"
    role="listbox"
    aria-label="Available browser tabs"
  >
    {tabs.map((tab, index) => (
      <li
        key={tab.id}
        role="option"
        aria-selected={index === selectedIndex}
        id={`tab-option-${tab.id}`}
        tabIndex={index === selectedIndex ? 0 : -1}
      >
        {/* Tab content */}
      </li>
    ))}
  </ul>
</div>
```

**Enhanced ChatInput Component**

- Detect `@` character trigger
- Calculate cursor position for dropdown placement
- Handle tab selection and insertion
- Display selected tabs as chips/badges

**Multi-Tab Content Preview** (`src/sidebar/components/MultiTabContentPreview.tsx`)

- Container component that manages multiple ContentPreview instances
- Each loaded tab gets its own ContentPreview component
- Stack ContentPreview components vertically
- Allow individual tab content removal
- Show extraction status for each tab

### 3. Hook Architecture

**useMultiTabExtraction Hook** (`src/sidebar/hooks/useMultiTabExtraction.ts`)

```typescript
interface UseMultiTabExtractionReturn {
  // State
  currentTabContent: ExtractedContent | null;
  currentTabId: number | null; // Track current tab to prevent duplicates
  loadedTabs: Record<number, TabContent>; // Changed from Map for serialization
  availableTabs: TabInfo[];
  hasAutoLoaded: boolean; // Track if auto-load has occurred

  // Actions
  extractCurrentTab: () => Promise<void>; // Called ONCE on mount
  extractTabById: (tabId: number) => Promise<void>; // Called via @ mentions
  removeLoadedTab: (tabId: number) => void;
  clearAllTabs: () => void;

  // Status
  loading: boolean;
  loadingTabIds: number[]; // Changed from Set for serialization
  error: Error | null;
}

// Hook implementation with auto-load logic
const useMultiTabExtraction = (): UseMultiTabExtractionReturn => {
  const [hasAutoLoaded, setHasAutoLoaded] = useState(false);
  const [currentTabId, setCurrentTabId] = useState<number | null>(null);

  // Auto-load current tab ONCE on mount
  useEffect(() => {
    if (!hasAutoLoaded) {
      extractCurrentTab().then(() => {
        setHasAutoLoaded(true);
      });
    }
  }, []); // Empty deps = only on mount

  // ... rest of implementation
};
```

**useTabMention Hook** (`src/sidebar/hooks/useTabMention.ts`)

- Detect `@` character in input
- Manage dropdown visibility
- Handle tab selection
- Insert tab reference into text

### 4. Message Passing Updates

**New Message Types** (`src/types/messages.ts`)

```typescript
// Extend existing message types following the pattern
export type MessageType =
  | 'TOGGLE_SIDEBAR'
  | 'CLOSE_SIDEBAR'
  // ... existing types
  | 'GET_ALL_TABS' // New
  | 'EXTRACT_TAB_CONTENT'; // New

// Add to TypedMessage union
export type TypedMessage =
  | Message<ToggleSidebarPayload>
  | Message<void>
  // ... existing messages
  | Message<void, TabInfo[]> // GET_ALL_TABS
  | Message<ExtractTabPayload, ExtractedContent>; // EXTRACT_TAB_CONTENT

// Define payload types
export interface ExtractTabPayload {
  tabId: number;
  options?: ExtractionOptions;
}

// Use existing createMessage factory
const getAllTabsMessage = createMessage<void, TabInfo[]>({
  type: 'GET_ALL_TABS',
  source: 'sidebar',
  target: 'background',
});

const extractTabMessage = createMessage<ExtractTabPayload, ExtractedContent>({
  type: 'EXTRACT_TAB_CONTENT',
  payload: { tabId: 123, options: { maxLength: 50000 } },
  source: 'sidebar',
  target: 'background',
});
```

### 5. Background Script Updates

**TabManager Service** (`src/extension/background/tabManager.ts`)

- Query all open tabs using `chrome.tabs.query({})`
- Filter out restricted URLs (chrome://, extension://)
- Return tab information with metadata

**Content Extraction Service**

- Send extraction message to specific tab
- Handle cross-tab communication
- Cache extracted content (5 min TTL)

## Implementation Steps

### Phase 1: Backend Infrastructure (Tab Management)

1. Create `TabManager` service in background script
2. Implement `GET_ALL_TABS` message handler
3. Add `EXTRACT_TAB_CONTENT` message handler
4. Update content script to handle tab-specific extraction

### Phase 2: Data Layer

1. Create tab-related TypeScript types
2. Implement `useMultiTabExtraction` hook
3. Add tab content storage in Zustand store
4. Implement content caching logic

### Phase 3: UI Components

1. Create `TabMentionDropdown` component
2. Add dropdown trigger detection in `ChatInput`
3. Implement keyboard navigation
4. Add tab selection visual feedback
5. Create `MultiTabContentPreview` component to manage multiple `ContentPreview` instances

### Phase 4: Integration

1. Update `useAIChat` to include multi-tab content
2. Modify message formatting to use structured format
3. Add visual indicators for loaded tabs via ContentPreview components
4. Implement tab content preview management
5. Ensure auto-load happens only once at session start
6. Allow manual @ mentions throughout conversation

### Phase 5: Polish & UX

1. Add loading states for tab extraction
2. Implement error handling for failed extractions
3. Add tab favicon fetching
4. Create tab content collapsible previews
5. Add smooth animations for adding/removing tabs

## Technical Implementation Details

### 1. @ Mention Detection (Improved)

```typescript
// In ChatInput component - improved detection to avoid false triggers
const detectMention = (text: string, cursorPosition: number) => {
  const beforeCursor = text.slice(0, cursorPosition);
  const lastAtIndex = beforeCursor.lastIndexOf('@');

  if (lastAtIndex === -1) return null;

  // Check if @ is at start of line or preceded by whitespace
  const charBeforeAt = lastAtIndex > 0 ? beforeCursor[lastAtIndex - 1] : ' ';
  if (!/\s/.test(charBeforeAt) && charBeforeAt !== '\n') {
    return null; // Avoid triggering on emails/usernames
  }

  const afterAt = beforeCursor.slice(lastAtIndex + 1);
  // Stop on whitespace or punctuation
  const match = afterAt.match(/^[^\s,;:.!?()[\]{}]*$/);

  if (!match) return null;

  return {
    startIndex: lastAtIndex,
    query: afterAt,
  };
};
```

### 2. Tab Filtering Logic

```typescript
// Filter available tabs
const getAvailableTabs = (allTabs: TabInfo[], loadedTabIds: Set<number>) => {
  return allTabs.filter(tab => !loadedTabIds.has(tab.id) && !isRestrictedUrl(tab.url));
};
```

### 3. Content Aggregation with Structured Format

The content will be formatted in a structured way for better AI understanding:

```typescript
// Format multi-tab content for AI with structured format (corrected types)
const formatMultiTabContent = (
  userMessage: string,
  currentTab: ExtractedContent | null,
  additionalTabs: Record<number, TabContent> // Fixed: Record instead of Map
): string => {
  let formattedContent = '';

  // Add current tab content with structured tags
  if (currentTab) {
    // Escape title to prevent XML injection
    const escapedTitle = currentTab.title.replace(/[<>&"']/g, char => {
      const escapes: Record<string, string> = {
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        '"': '&quot;',
        "'": '&apos;',
      };
      return escapes[char];
    });
    formattedContent += `<tab title="${escapedTitle}">\n`;
    formattedContent += currentTab.content;
    formattedContent += '\n</tab>\n\n';
  }

  // Add additional tabs with structured tags
  for (const [tabId, tabContent] of Object.entries(additionalTabs)) {
    if (tabContent.content) {
      // Escape title to prevent XML injection
      const escapedTitle = tabContent.title.replace(/[<>&"']/g, char => {
        const escapes: Record<string, string> = {
          '<': '&lt;',
          '>': '&gt;',
          '&': '&amp;',
          '"': '&quot;',
          "'": '&apos;',
        };
        return escapes[char];
      });
      formattedContent += `<tab title="${escapedTitle}">\n`;
      formattedContent += tabContent.content.content; // Fixed: correct property access
      formattedContent += '\n</tab>\n\n';
    }
  }

  // Add user prompt with clear delineation
  formattedContent += '<user-query>\n';
  formattedContent += userMessage;
  formattedContent += '\n</user-query>';

  return formattedContent;
};
```

**Alternative Format Options:**

1. **JSON-LD Structure** (for models that understand JSON):

```json
{
  "tabs": [
    {
      "title": "Page Title",
      "url": "https://example.com",
      "content": "..."
    }
  ],
  "userQuery": "..."
}
```

2. **YAML-like Format**:

```yaml
---
tab: Current Page Title
url: https://example.com
---
Content here...
---
tab: Another Page
url: https://another.com
---
Content here...
---
user_query: |
  What the user asked
---
```

### 4. Multi-Tab Content Preview Management

```typescript
// In ChatPanel.tsx (corrected types and handlers)
const MultiTabContentSection: React.FC<{
  currentTab: ExtractedContent | null;
  currentTabLoading: boolean;
  currentTabError: Error | null;
  loadedTabs: Record<number, TabContent>; // Fixed: Record instead of Map
  onRemoveCurrentTab: () => void; // Fixed: separate handler for current tab
  onRemoveTab: (tabId: number) => void;
  onReextractCurrentTab: () => void; // Fixed: separate handler for current tab
  onReextractTab: (tabId: number) => void;
  onClearAll: () => void;
}> = ({
  currentTab,
  currentTabLoading,
  currentTabError,
  loadedTabs,
  onRemoveCurrentTab,
  onRemoveTab,
  onReextractCurrentTab,
  onReextractTab,
  onClearAll
}) => {
  return (
    <div className="multi-tab-content-section">
      {/* Current tab preview */}
      {currentTab && (
        <ContentPreview
          content={currentTab}
          loading={currentTabLoading}
          error={currentTabError}
          onReextract={onReextractCurrentTab} // Fixed: correct handler
          onClearContent={onRemoveCurrentTab} // Fixed: correct handler
          className="content-preview--current"
        />
      )}

      {/* Additional loaded tabs */}
      {Object.entries(loadedTabs).map(([tabId, tabContent]) => ( // Fixed: Object.entries
        <ContentPreview
          key={tabId}
          content={tabContent.content}
          loading={tabContent.loading} // Now properly typed in TabContent
          error={tabContent.error} // Now properly typed as Error | null
          onReextract={() => onReextractTab(Number(tabId))} // Fixed: convert string key to number
          onClearContent={() => onRemoveTab(Number(tabId))} // Fixed: convert string key to number
          className="content-preview--additional"
        />
      ))}

      {/* Clear all button if multiple tabs loaded */}
      {Object.keys(loadedTabs).length > 0 && ( // Fixed: Object.keys for length
        <button
          className="clear-all-tabs-btn"
          onClick={onClearAll}
        >
          Clear All Tabs
        </button>
      )}
    </div>
  );
};
```

### 5. Dropdown Positioning (Shadow DOM Compatible)

```typescript
// Calculate dropdown position relative to cursor (improved for Shadow DOM)
const getDropdownPosition = (
  inputElement: HTMLTextAreaElement,
  cursorPosition: number,
  shadowRoot: ShadowRoot
) => {
  const textBeforeCursor = inputElement.value.substring(0, cursorPosition);
  const lines = textBeforeCursor.split('\n');
  const currentLine = lines[lines.length - 1];

  // Create measurer element within Shadow DOM for accurate styling
  const measurer = document.createElement('div');
  const computedStyle = window.getComputedStyle(inputElement);

  // Copy relevant styles for text measurement
  measurer.style.cssText = `
    position: absolute;
    visibility: hidden;
    white-space: pre-wrap;
    word-wrap: break-word;
    font-family: ${computedStyle.fontFamily};
    font-size: ${computedStyle.fontSize};
    font-weight: ${computedStyle.fontWeight};
    letter-spacing: ${computedStyle.letterSpacing};
    padding: ${computedStyle.padding};
    border: ${computedStyle.border};
    width: ${inputElement.clientWidth}px;
  `;
  measurer.textContent = currentLine;

  // Append to shadow root for accurate measurement
  shadowRoot.appendChild(measurer);
  const width = measurer.offsetWidth;

  // Calculate line height dynamically
  const lineHeight =
    parseFloat(computedStyle.lineHeight) || parseFloat(computedStyle.fontSize) * 1.5;

  // Account for scroll position
  const scrollTop = inputElement.scrollTop;
  const scrollLeft = inputElement.scrollLeft;

  // Clean up
  shadowRoot.removeChild(measurer);

  // Calculate position relative to textarea
  const rect = inputElement.getBoundingClientRect();

  return {
    x: rect.left + width - scrollLeft,
    y: rect.top + lines.length * lineHeight - scrollTop,
    // Store for boundary checking
    maxX: rect.right,
    maxY: rect.bottom,
  };
};
```

## File Changes Summary

### New Files

1. `src/types/tabs.ts` - Tab type definitions
2. `src/sidebar/components/TabMentionDropdown.tsx` - Dropdown component
3. `src/sidebar/components/MultiTabContentPreview.tsx` - Multi-tab preview container
4. `src/sidebar/hooks/useMultiTabExtraction.ts` - Multi-tab extraction logic
5. `src/sidebar/hooks/useTabMention.ts` - Mention detection logic
6. `src/extension/background/tabManager.ts` - Tab management service
7. `src/sidebar/styles/tab-mention-dropdown.css` - Dropdown styles
8. `src/sidebar/styles/multi-tab-content.css` - Multi-tab preview styles

### Modified Files

1. `src/sidebar/components/ChatInput.tsx` - Add @ mention detection
2. `src/sidebar/ChatPanel.tsx` - Integrate multi-tab extraction and previews
3. `src/sidebar/hooks/ai/useMessageHandler.ts` - Include multi-tab content with structured format
4. `src/types/messages.ts` - Add new message types
5. `src/extension/background/messageHandler.ts` - Handle tab messages
6. `src/tabext/core/messageHandler.ts` - Handle tab-specific extraction
7. `src/sidebar/components/ContentPreview.tsx` - Minor adjustments for multi-tab context

## Testing Strategy

1. Unit tests for mention detection logic
2. Integration tests for tab extraction
3. E2E tests for full @ mention flow
4. Performance tests for multi-tab extraction
5. Accessibility tests for dropdown navigation
6. Visual regression tests for multiple ContentPreview components

## Performance Considerations

### Caching Strategy (MV3 Compatible)

```typescript
// Use chrome.storage.session for MV3 service worker persistence
interface CachedTabContent {
  tabId: number;
  content: ExtractedContent;
  extractedAt: number;
  ttl: number; // 5 minutes default
}

class TabContentCache {
  private readonly TTL = 5 * 60 * 1000; // 5 minutes

  async get(tabId: number): Promise<ExtractedContent | null> {
    const stored = await chrome.storage.session.get(`tab_${tabId}`);
    if (!stored[`tab_${tabId}`]) return null;

    const cached = stored[`tab_${tabId}`] as CachedTabContent;
    const now = Date.now();

    // Check if expired
    if (now - cached.extractedAt > cached.ttl) {
      await chrome.storage.session.remove(`tab_${tabId}`);
      return null;
    }

    return cached.content;
  }

  async set(tabId: number, content: ExtractedContent): Promise<void> {
    const cached: CachedTabContent = {
      tabId,
      content,
      extractedAt: Date.now(),
      ttl: this.TTL,
    };

    await chrome.storage.session.set({ [`tab_${tabId}`]: cached });
  }

  async clear(): Promise<void> {
    // Clear all tab caches
    const keys = await chrome.storage.session.get(null);
    const tabKeys = Object.keys(keys).filter(k => k.startsWith('tab_'));
    await chrome.storage.session.remove(tabKeys);
  }
}
```

### Concurrent Extraction Queue

```typescript
class ExtractionQueue {
  private queue: number[] = [];
  private running = 0;
  private readonly MAX_CONCURRENT = 3;

  async add(tabId: number, extractor: () => Promise<ExtractedContent>): Promise<ExtractedContent> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          this.running++;
          const result = await extractor();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.running--;
          this.processNext();
        }
      });

      if (this.running < this.MAX_CONCURRENT) {
        this.processNext();
      }
    });
  }

  private processNext(): void {
    if (this.queue.length === 0 || this.running >= this.MAX_CONCURRENT) {
      return;
    }

    const next = this.queue.shift();
    if (next) next();
  }
}
```

### Other Optimizations

- Lazy load tab content only when selected
- Use virtualization for long tab lists (>20 tabs)
- Debounce @ mention detection (100ms)
- Optimize ContentPreview rendering with React.memo
- Limit total content size to 1MB combined

## User Experience Flow

### Basic Flow

1. User opens sidebar on any tab
2. **Current tab content automatically loads ONCE at session start** (shows in first ContentPreview, ready to send with first prompt)
3. User types message and includes `@` character at ANY point in conversation
4. Dropdown appears showing available tabs (excluding already loaded tabs)
5. User selects tab(s) to include via manual `@` action
6. Each manually selected tab appears as a new ContentPreview component below existing ones
7. User can see all loaded tabs' previews stacked vertically
8. On send, all loaded tab contents are formatted with structured tags and sent

### Content Loading Behavior

**Automatic Loading (Session Start)**

- Occurs: **ONCE** when sidebar opens on a new tab
- Scope: Current tab only
- Timing: Immediately on mount
- Purpose: Pre-load current context for first prompt
- User Action: None required
- Persistence: Remains loaded for entire session unless manually cleared

**Manual Loading (@ Mention)**

- Occurs: **MULTIPLE TIMES** throughout conversation
- Scope: Any tab except already loaded ones
- Timing: On-demand via `@` trigger
- Purpose: Add additional context mid-conversation
- User Action: Type `@` and select from dropdown
- Persistence: Remains loaded until manually removed or session ends

**Duplicate Prevention**

```typescript
// Prevent duplicate tab loading
const canLoadTab = (
  tabId: number,
  loadedTabs: Record<number, TabContent>,
  currentTabId: number
) => {
  // Check if tab is already loaded
  if (loadedTabs[tabId]) return false;

  // Check if it's the current tab (already auto-loaded)
  if (tabId === currentTabId) return false;

  return true;
};

// Filter dropdown options
const getAvailableTabs = (
  allTabs: TabInfo[],
  loadedTabs: Record<number, TabContent>,
  currentTabId: number
) => {
  return allTabs.filter(
    tab => canLoadTab(tab.id, loadedTabs, currentTabId) && !isRestrictedUrl(tab.url)
  );
};
```

### Visual Layout

```
┌─────────────────────────────────┐
│ [Header]                        │
├─────────────────────────────────┤
│ [Message List]                  │
│                                 │
├─────────────────────────────────┤
│ [ContentPreview - Current Tab]  │
│  ▼ example.com                  │
│  Page content excerpt...        │
├─────────────────────────────────┤
│ [ContentPreview - Tab 2]        │
│  ▼ another.com                  │
│  Another page excerpt...        │
├─────────────────────────────────┤
│ [ContentPreview - Tab 3]        │
│  ▼ third.com                    │
│  Third page excerpt...          │
├─────────────────────────────────┤
│ [Chat Input]                    │
│  Type @ to mention tabs...      │
└─────────────────────────────────┘
```

### Advanced Features

- **Tab Chips**: Visual indicators in input area showing loaded tabs
- **Remove Tab**: Click X on ContentPreview to remove from selection
- **Tab Preview**: Collapsible ContentPreview for each loaded tab
- **Keyboard Shortcuts**:
  - `@` + arrow keys to navigate dropdown
  - `Enter` to select tab
  - `Escape` to close dropdown
  - `Cmd/Ctrl + Click` to select multiple tabs at once

### Error Handling

- Show error in individual ContentPreview if tab extraction fails
- Gracefully handle closed tabs (remove from available list)
- Handle restricted URLs (chrome://, etc.) - don't show in dropdown
- Timeout after 5 seconds for unresponsive tabs
- Show warning if too many tabs loaded (>10)

## Security Considerations

- Never extract content from restricted URLs
- Validate tab permissions before extraction
- Sanitize extracted content
- Respect same-origin policies
- Clear cached content on sidebar close
- Limit total content size (e.g., 1MB combined)

## Future Enhancements

1. **Smart Tab Suggestions**: ML-based tab relevance ranking
2. **Tab Groups**: Select entire tab groups at once
3. **History Integration**: Include recently closed tabs
4. **Bookmarks**: Include bookmarked pages
5. **Cross-Window Support**: Tabs from all browser windows
6. **Content Filtering**: Select specific parts of tab content
7. **Tab Templates**: Save common tab combinations
8. **Batch Operations**: Extract all tabs matching a pattern
9. **Persistent Tab Sessions**: Save and restore tab combinations
10. **Tab Content Diffing**: Show what changed since last extraction
