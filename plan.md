# Raw Mode Implementation Plan

## Overview

Implement a "Raw Mode" extraction option that preserves HTML structure (especially tables) with minimal processing. This provides an alternative when Defuddle struggles with table-heavy or fragmented pages.

## Core Principle

**"Snapshot visible DOM → Clean dangerous elements → Preserve structure → Convert to Markdown"**

## Implementation Details

### 1. Type System Updates

#### File: `/src/types/extraction.ts`

```typescript
// Line 16: Update ExtractionMethod type
export type ExtractionMethod = 'defuddle' | 'selection' | 'raw';

// Line 21: Update ExtractionMode enum
export enum ExtractionMode {
  DEFUDDLE = 'defuddle',
  SELECTION = 'selection',
  RAW = 'raw', // New mode
}

// Line 135: Update type guard to accept 'raw'
['defuddle', 'selection', 'raw'].includes(obj.extractionMethod);
```

#### File: `/src/types/messages.ts`

```typescript
// Add mode to ExtractTabPayload for multi-tab support
export interface ExtractTabPayload {
  tabId: number;
  options?: ExtractionOptions;
  mode?: ExtractionMode; // Add this
}
```

### 2. Raw Mode Extractor

#### New File: `/src/tabext/extraction/extractors/raw.ts`

**Core Features:**

1. **Smart root selection**
   - Priority: Configured hints → Best scoring container → document.body
   - Scoring: Text length × (1 - link density) × tag/class bonuses × table bonus

2. **Visibility filtering** (Critical insight from review)
   - Check `getComputedStyle` BEFORE removing styles
   - Filter out `display: none` and `visibility: hidden` elements
   - Preserves only actually visible content

3. **Security sanitization**
   - Remove: `<script>`, `<style>`, `<link>`, `<noscript>`, `<svg>`, `<canvas>`, `<iframe>`
   - Strip: All `on*` event attributes, `javascript:` URLs, inline `style` attributes
   - Preserve: Safe attributes for structure/semantics

4. **Table preservation**
   - Keep full table structure: `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th>`, `<td>`
   - Preserve table attributes: `colspan`, `rowspan`, `scope`, `headers`
   - No paragraph merging or text density analysis

5. **URL absolutization**
   - Convert all relative URLs to absolute
   - Handle: `href`, `src`, `srcset` attributes
   - Ensures content works offline/in Obsidian

**Configuration Options:**

```typescript
interface RawModeOptions {
  root_hints?: string[]; // Selector hints for main content
  strip_class?: boolean; // Remove class attributes (default: true)
  keep_id?: boolean; // Preserve id attributes (default: true)
  inject_pseudo?: boolean; // Inject ::before/::after content (default: false)
  shadow_aware?: boolean; // Handle Shadow DOM (default: false, future)
}
```

**Implementation Structure:**

```typescript
import { isVisible } from '@tabext/utils/domUtils';
import type { ExtractedContent } from '@/types/extraction';

export async function extractWithRaw(options?: RawModeOptions): Promise<ExtractedContent> {
  // 1. Simple root selection (no complex scoring for v1)
  const root = pickRoot(document, options?.root_hints);

  // 2. Create clean document
  const cleanDoc = document.implementation.createHTMLDocument('raw');

  // 3. Deep clone visible nodes only (reuse existing isVisible)
  const snapshot = deepCloneVisible(root, cleanDoc, options);

  // 4. Don't duplicate URL work - let orchestrator handle via normalizeUrls()
  // absolutizeUrls(cleanDoc); // REMOVED - orchestrator will do this

  // 5. Calculate metadata
  const tables = cleanDoc.querySelectorAll('table');
  const textContent = cleanDoc.body.textContent || '';

  // 6. Return full ExtractedContent shape
  return {
    title: document.title,
    url: window.location.href,
    domain: window.location.hostname,
    content: cleanDoc.body.innerHTML, // Raw HTML
    textContent,
    excerpt: textContent.substring(0, 200) + '...',
    extractedAt: Date.now(),
    extractionMethod: 'raw' as const,
    metadata: {
      hasCodeBlocks: false, // Will be detected after markdown conversion
      hasTables: tables.length > 0,
      truncated: false,
    },
    // Backward compatibility
    markdown: '', // Will be filled by orchestrator
    hasCode: false,
    hasTables: tables.length > 0,
    isTruncated: false,
  };
}

// Simple root picker - prefer known containers, fallback to body
function pickRoot(doc: Document, hints?: string[]): Element {
  // Try hints first
  if (hints) {
    for (const selector of hints) {
      const el = doc.querySelector(selector);
      if (el && isVisible(el)) return el;
    }
  }

  // Try common content containers
  const selectors = ['main', 'article', '#content', '[role="main"]', '.content', '.main'];
  for (const selector of selectors) {
    const el = doc.querySelector(selector);
    if (el && isVisible(el)) return el;
  }

  return doc.body;
}
```

### 3. Orchestrator Integration

#### File: `/src/tabext/extraction/orchestrator.ts`

**Critical Changes:**

```typescript
// Line 217: Fix extractionMethod type
let extractionMethod: ExtractionMethod = 'defuddle'; // Use the type, not literal

// Around line 246, add RAW mode handling BEFORE defuddle
if (mode === ExtractionMode.RAW && !htmlContent) {
  try {
    const rawExtractor = await import('./extractors/raw');
    const rawResult = await rawExtractor.extractWithRaw({
      root_hints: ['.company-detail', '.content', 'main'],
      strip_class: true,
      keep_id: true,
      inject_pseudo: false,
    });

    if (rawResult.content && rawResult.content.trim()) {
      htmlContent = rawResult.content;
      textContent = rawResult.textContent || '';
      author = rawResult.author;
      extractionMethod = 'raw';
    }
  } catch (error) {
    // Fall through to defuddle
  }
}

// Line 269-275: For RAW mode, preserve classes for code detection
if (htmlContent && htmlContent.trim()) {
  try {
    // CRITICAL: Use cleanHtml(html, true) for raw mode to preserve classes
    const preserveClasses = extractionMethod === 'raw';
    htmlContent = cleanHtml(htmlContent, preserveClasses);

    // Then normalize URLs - this handles absolutization
    htmlContent = normalizeUrls(htmlContent, window.location.href, includeLinks);
  } catch (error) {
    // HTML cleaning/normalization failed
  }
}
```

### 4. UI Integration

#### File: `/src/sidebar/components/TabContentItem.tsx`

**CRITICAL: Fix prop type mismatch**

Option A - Update prop type to accept options:

```typescript
// Line 27: Update prop type
onReextract: (options?: { mode?: ExtractionMode }) => void;
```

Option B - Add separate callback (less breaking):

```typescript
// Add new prop
onReextractRaw?: () => void;
```

For Option A, update button (line ~235):

```jsx
{
  /* Raw Mode button - for table-heavy pages */
}
<button
  onClick={e => {
    e.stopPropagation();
    onReextract({ mode: ExtractionMode.RAW });
  }}
  className="content-preview-raw-inline"
  title="Re-extract in Raw Mode (preserves tables)"
  aria-label="Re-extract in Raw Mode"
>
  <TableIcon size={14} />
</button>;
```

Add visual indicator when content was extracted in raw mode:

```jsx
{
  /* After line 224, add raw mode badge */
}
{
  content?.extractionMethod === 'raw' && (
    <span className="content-preview-badge content-preview-badge--raw">Raw</span>
  );
}
```

**Required updates for Option A:**

- `/src/sidebar/components/ContentPreview.tsx` lines 80, 98: Update calls to `onReextract()`
- `/src/sidebar/ChatPanel.tsx` line 696: Update call to `reextract()`

#### File: `/src/sidebar/styles/tab-content-item.css`

Add styling for raw mode elements:

```css
.content-preview-raw-inline {
  /* Similar to refresh button but with different hover color */
  color: var(--color-text-tertiary);
  transition: color 0.2s;
}

.content-preview-raw-inline:hover {
  color: var(--color-primary);
}

.content-preview-badge--raw {
  background: var(--color-info-bg);
  color: var(--color-info-text);
}
```

### 5. Message Passing Updates (for multi-tab support)

#### File: `/src/extension/background/tabManager.ts`

```typescript
// Line 126: Include mode in extraction payload
const extractionPayload: ExtractTabPayload = {
  tabId: tab.id,
  options: extractionOptions,
  mode: mode, // Add this if mode is provided
};
```

#### File: `/src/tabext/core/messageHandler.ts`

```typescript
// Line 105: Pass mode to extractContent
const result = await extractContent(extractionOptions, payload.mode);
```

### 6. Hook Updates

#### File: `/src/sidebar/hooks/useContentExtraction.ts`

The hook already supports passing `mode` in options, so it will work as-is for single-tab:

```typescript
// This already works for current tab!
onReextract({ mode: ExtractionMode.RAW });
```

### 7. Markdown Conversion

The existing `markdownConverter.ts` already has:

- GFM plugin with table support
- Table preservation rules
- Proper attribute handling

This will correctly convert raw HTML tables to Markdown tables.

## Critical Implementation Notes

### Key Fixes from Review

1. **Type System**: Must update type guard at line 135 to accept 'raw', not just add the enum
2. **Orchestrator**: Use ExtractionMethod type (not literal) for extractionMethod variable
3. **Clean HTML**: Use `cleanHtml(html, true)` for raw mode to preserve code language classes
4. **URL Normalization**: Don't duplicate - reuse existing `normalizeUrls()` from orchestrator
5. **Return Shape**: Raw extractor must return full ExtractedContent, not just content field
6. **UI Props**: Must fix prop type mismatch - onReextract needs to accept options parameter
7. **Message Passing**: ExtractTabPayload needs mode field for multi-tab support

### Testing will be done by user

User will handle all testing after implementation is complete.

## Implementation Order

1. **Update Type System**
   - [ ] Add 'raw' to ExtractionMethod type at line 16 in `/src/types/extraction.ts`
   - [ ] Add RAW to ExtractionMode enum at line 21
   - [ ] Update type guard at line 135 to accept 'raw'
   - [ ] Add mode to ExtractTabPayload in `/src/types/messages.ts`

2. **Create Raw Extractor**
   - [ ] Create `/src/tabext/extraction/extractors/raw.ts`
   - [ ] Import and reuse `isVisible` from `@tabext/utils/domUtils`
   - [ ] Implement simple root selection (no complex scoring)
   - [ ] Clone only visible nodes with security sanitization
   - [ ] Return full ExtractedContent shape (not just content)
   - [ ] Let orchestrator handle URL normalization (don't duplicate)

3. **Update Orchestrator**
   - [ ] Fix extractionMethod type at line 217 to use ExtractionMethod type
   - [ ] Add RAW mode handling around line 246 (before defuddle)
   - [ ] Use `cleanHtml(html, true)` for raw mode to preserve classes
   - [ ] Let existing normalizeUrls handle URL absolutization

4. **Update UI Components**
   - [ ] Choose Option A or B for prop type fix:
     - Option A: Update onReextract prop type in TabContentItem.tsx
     - Option B: Add separate onReextractRaw prop
   - [ ] If Option A, update all call sites (ContentPreview, ChatPanel)
   - [ ] Add Raw Mode button with TableIcon
   - [ ] Add raw mode badge indicator
   - [ ] Add CSS styles in tab-content-item.css

5. **Update Message Passing** (for multi-tab)
   - [ ] Update tabManager.ts line 126 to include mode in payload
   - [ ] Update messageHandler.ts line 105 to pass mode to extractContent

6. **Add Icon**
   - [ ] Create TableIcon in `/src/sidebar/components/ui/Icons.tsx` or reuse existing

7. **Future Enhancements** (if needed)
   - [ ] Shadow DOM support
   - [ ] Pseudo-element injection
   - [ ] Site-specific configurations

## Benefits

1. **No Risk** - Completely isolated from Defuddle
2. **Table Preservation** - Full structural fidelity
3. **User Control** - Manual activation when needed
4. **Simple** - No complex algorithms, just DOM manipulation
5. **Secure** - Strips all dangerous content
6. **Future-Proof** - Can add Shadow DOM support later

## Configuration

For known problematic sites, we can add default hints:

```typescript
const SITE_CONFIGS = {
  'qichacha.com': {
    root_hints: ['.company-detail', '.layout-content'],
    inject_pseudo: true, // They use ::before for some labels
  },
  'bloomberg.com': {
    root_hints: ['.content-main', 'article'],
  },
};
```

## Success Criteria

✅ Tables are fully preserved with structure
✅ No regression in normal Defuddle mode
✅ Clean, safe HTML output
✅ Works within existing extraction flow
✅ User can easily switch between modes
✅ Performance <500ms on typical pages
