# Content Module

The content script runs in page context. It injects the React sidebar, coordinates extraction, and routes messages to/from the background.

## Overview

- Sidebar injection and lifecycle management
- Robust page content extraction
- Typed message routing with timeouts
- DOM patching for asset loading

## Structure

```
content/
├─ index.ts                   # Entry & initialization
├─ core/
│  ├─ documentPatcher.ts     # Resolve asset URLs safely
│  ├─ messageHandler.ts      # Route incoming messages
│  └─ sidebarController.ts   # Mount/unmount Shadow‑DOM UI
├─ extraction/
│  ├─ orchestrator.ts        # Selects mode, enforces timeout
│  ├─ extractors/
│  │  ├─ readability.ts      # Default: Mozilla Readability → Markdown
│  │  ├─ raw.ts              # Preserve HTML structure (good for tables)
│  │  └─ defuddle.ts         # Defuddle‑based extraction
│  └─ analyzers/
│     ├─ contentAnalyzer.ts  # Code/table detection, excerpt
│     └─ metadataExtractor.ts# Title/OG/Twitter meta
└─ utils/
   ├─ domUtils.ts            # DOM helpers
   └─ tabUtils.ts            # Tab helpers
```

## Architecture Overview

```
Web Page Context
    ↓
Content Script (content/)
    ├─ Document Patcher (asset URLs)
    ├─ Message Handler (routing)
    ├─ Sidebar Controller (UI)
    └─ Extraction Pipeline (content)
        ├─ Orchestrator
        ├─ Extractors
        ├─ Converters
        └─ Analyzers
```

## Core Components

### Entry Point (`index.ts`)

Initialization sequence:

1. Apply document patches for asset URL resolution
2. Initialize sidebar controller
3. Set up message handler
4. Notify background script of readiness

### Core Modules (`core/`)

#### Document Patcher

Patches DOM APIs to ensure dynamic content uses proper extension URLs:

- Intercepts `document.querySelector` for link elements
- Patches `document.createElement` for scripts/links
- Converts relative paths to extension URLs

#### Message Handler

Routes messages from the background script:

- `TOGGLE_SIDEBAR` - Show/hide sidebar
- `CLOSE_SIDEBAR` - Force close sidebar
- `EXTRACT_CONTENT` - Extract page content
- `PING` - Health check

#### Sidebar Controller

Manages sidebar lifecycle:

- Lazy loads React sidebar app
- Tracks open/closed state
- Handles mount/unmount operations
- Dispatches custom DOM events

### Content Extraction (`extraction/`)

#### Orchestrator

Selects a mode, validates options, enforces a timeout, and returns structured content. Default mode is Readability; callers may request Raw, Defuddle, or Selection.

#### Extractors

**Readability** (`readability.ts`)

- Reader‑friendly extraction via Mozilla Readability
- Converts HTML → Markdown (via `@core/extraction/markdownConverter`)
- Detects tables and generates excerpts

**Raw Extractor** (`raw.ts`)

- Preserves HTML structure
- Table-aware extraction
- Token optimization (40-70% reduction)
- Best for structured data sites

**Defuddle** (`defuddle.ts`)

- Alternative extraction using the `defuddle` library
- Useful fallback on some article pages

#### Converters

**Markdown Converter** (`markdownConverter.ts`)

- HTML to GitHub Flavored Markdown
- Preserves code blocks with languages
- Handles tables, lists, formatting
- Optional link preservation

#### Analyzers

**Content Analyzer** (`contentAnalyzer.ts`)

- Detects code blocks and tables
- Counts words
- Generates excerpts
- Identifies content features

**Metadata Extractor** (`metadataExtractor.ts`)

- Extracts title, author, date
- Parses Open Graph tags
- Handles Twitter Card meta
- Supports various metadata formats

### Utilities (`utils/`)

- DOM helpers for safe operations in page context
- Tab helpers for metadata and messaging

## Extraction Pipeline

### Flow Diagram

```
Page Content
    ↓
Orchestrator
    ├─ Validate Options
    ├─ Select Extractor
    │   ├─ Defuddle (articles)
    │   └─ Raw (tables/data)
    ├─ Clean HTML
    ├─ Convert Format
    │   └─ Markdown
    ├─ Analyze Content
    │   ├─ Word Count
    │   ├─ Code Detection
    │   └─ Table Detection
    └─ Apply Limits
        └─ Return Result
```

### Extraction Options

```ts
interface ExtractionOptions {
  includeLinks?: boolean; // Default: false
  maxLength?: number; // Default: 200_000
  timeout?: number; // Default: 2000ms
}
// Mode is selected separately via ExtractionMode (readability | raw | defuddle | selection)
```

## API Usage

### Basic Extraction

```typescript
import { extractContent } from '@content/extraction';

// Default extraction (Defuddle mode)
const content = await extractContent();

// With options
const content = await extractContent({
  timeout: 5000,
  includeLinks: false,
  maxLength: 100000,
});
```

### Raw Mode Extraction

```ts
import { ExtractionMode } from '@types/extraction';
import { extractContent } from '@content/extraction/orchestrator';

// Table‑heavy pages: returns HTML + text (no Markdown conversion)
const content = await extractContent({ includeLinks: true }, ExtractionMode.RAW);
```

### HTML to Markdown

The Markdown converter lives in `@core/extraction` and is used by the orchestrator
for non-RAW modes. You can import it directly if needed:

```typescript
import { htmlToMarkdown } from '@core/extraction/markdownConverter';

const markdown = await htmlToMarkdown(htmlString, { includeLinks: true });
```

### Content Analysis

The analyzer utilities live under `@core/extraction/analyzers` and are used by extractors to populate metadata (tables, excerpts, etc.).

## Message Communication

### Receiving Messages

Content script primarily responds to `EXTRACT_TAB_CONTENT` via the background message orchestrated in `extension/background/messageHandler.ts`.

### Sending Messages

```typescript
// To background script
chrome.runtime.sendMessage({
  type: 'CONTENT_READY',
  tabId: getCurrentTabId(),
});
```

## Error Handling

### Error Types

- `EXTRACTION_TIMEOUT` - Operation exceeded time limit
- `EXTRACTION_NETWORK_ERROR` - Network-related failure
- `EXTRACTION_DOM_ERROR` - DOM access issues
- `EXTRACTION_MEMORY_ERROR` - Memory constraints
- `EXTRACTION_PARSING_ERROR` - Content parsing failed

### Error Recovery

- Timeout protection on all operations
- Graceful degradation to basic extraction
- Fallback strategies for each extractor
- Safe DOM access with edge case handling

## Security

- Readability sanitizer + Markdown conversion minimize unsafe HTML in default mode
- No script execution; avoid direct `innerHTML` without sanitization
- Operates in an isolated content‑script world

### Best Practices

1. Never execute extracted scripts
2. Sanitize all HTML content
3. Validate URLs before processing
4. Use timeout protection
5. Handle memory constraints

## Performance

Optimization highlights:

- Dynamic import caching per extractor
- Timeout enforcement in orchestrator
- Raw mode avoids Markdown conversion for speed and token savings

## Testing

### Test Coverage

```bash
# Run all content tests
npm test -- src/content

# Specific test suites
npm test -- src/content/extraction
npm test -- src/content/core
npm test -- src/content/utils
```

### Test Types

- Unit tests for utilities
- Integration tests for pipeline
- E2E tests for sidebar interaction
- Performance benchmarks

## Debugging

### Enable Debug Logging

```typescript
// In any module
const DEBUG = true; // Enable verbose logging
```

### Chrome DevTools

1. Open target web page
2. Open DevTools Console
3. Filter by "ContentExtractor" or module name
4. Check extraction timing and errors

### Common Issues

#### Content Not Extracting

- Check if page has restricted permissions
- Verify extraction timeout settings
- Check for DOM mutation after load

#### Sidebar Not Appearing

- Verify content script injection
- Check message passing
- Confirm sidebar controller initialization

## Extraction Modes Comparison

| Feature         | Defuddle Mode     | Raw Mode        |
| --------------- | ----------------- | --------------- |
| Best For        | Articles, blogs   | Tables, data    |
| Removes         | Ads, navigation   | Minimal removal |
| Preserves       | Article content   | Full structure  |
| Token Reduction | 60-80%            | 40-70%          |
| Speed           | Fast              | Very fast       |
| Accuracy        | High for articles | High for data   |

## Dependencies

- **defuddle** - Intelligent content extraction
- **dompurify** - HTML sanitization (via Defuddle)
- **Chrome APIs** - Extension communication
- Markdown conversion is provided by `@core/extraction/markdownConverter` (Turndown + GFM)

## Future Enhancements

- Domain heuristics for extractor selection
- Incremental extraction for long pages
- PDF/Doc export

## Contributing

### Development Guidelines

1. **Module Independence** - Self-contained modules
2. **Error Handling** - Graceful edge case handling
3. **Type Safety** - Full TypeScript coverage
4. **Documentation** - Inline documentation for complex logic
5. **Performance** - Consider memory and CPU impact

### Code Standards

- TypeScript strict mode
- ESLint + Prettier formatting
- 80% minimum test coverage
- Comprehensive error handling
