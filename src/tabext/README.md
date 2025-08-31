# TabExt Module

The tabext module is the content script portion of the browser extension that runs in web page contexts. It handles sidebar injection, content extraction, and serves as the communication bridge between web pages and the extension.

## Directory Structure

```
tabext/
├── index.ts                    # Entry point & initialization
├── core/                       # Core functionality
│   ├── index.ts               # Core exports
│   ├── documentPatcher.ts     # Document API patches for assets
│   ├── messageHandler.ts      # Message routing & handling
│   └── sidebarController.ts   # Sidebar lifecycle management
├── extraction/                 # Content extraction pipeline
│   ├── index.ts               # Extraction API exports
│   ├── orchestrator.ts        # Main extraction coordinator
│   ├── extractors/            # Extraction strategies
│   │   ├── index.ts          # Extractor exports
│   │   ├── defuddle.ts       # Defuddle-based extraction
│   │   └── raw.ts            # Raw HTML preservation mode
│   ├── converters/            # Format converters
│   │   ├── index.ts          # Converter exports
│   │   └── markdownConverter.ts # HTML to Markdown
│   └── analyzers/             # Content analysis tools
│       ├── contentAnalyzer.ts   # Text analysis
│       └── metadataExtractor.ts # Page metadata extraction
├── types/                      # TypeScript definitions (if present)
└── utils/                      # Utility functions
    ├── index.ts               # Utility exports
    ├── domUtils.ts            # DOM manipulation
    ├── textUtils.ts           # Text processing
    └── tabUtils.ts            # Tab-related utilities
```

## Architecture Overview

```
Web Page Context
    ↓
Content Script (tabext)
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

Coordinates the extraction pipeline:

1. Validate extraction options
2. Try primary extraction (Defuddle)
3. Clean and normalize HTML
4. Convert to Markdown if requested
5. Analyze content features
6. Apply size limits
7. Return structured content

#### Extractors

**Defuddle Extractor** (`defuddle.ts`)

- Intelligent content detection
- Removes ads, navigation, footers
- Best for articles and blog posts
- Uses Readability-like algorithms

**Raw Extractor** (`raw.ts`)

- Preserves HTML structure
- Table-aware extraction
- Token optimization (40-70% reduction)
- Best for structured data sites

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

#### DOM Utilities

- `isVisible()` - Check element visibility
- `normalizeUrls()` - Convert to absolute URLs
- `cleanHtml()` - Remove scripts and noise

#### Text Utilities

- `clampText()` - Safe text truncation with boundaries

#### Tab Utilities

- `getCurrentTabId()` - Get current tab ID
- `getCurrentTabIdSafe()` - Safe version with error handling

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

```typescript
interface ExtractionOptions {
  timeout?: number; // Default: 2000ms
  includeLinks?: boolean; // Default: true
  maxLength?: number; // Default: 200,000
  mode?: 'defuddle' | 'raw'; // Default: 'defuddle'
}
```

## API Usage

### Basic Extraction

```typescript
import { extractContent } from '@tabext/extraction';

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

```typescript
// For table-heavy content
const content = await extractContent({}, 'raw');

// With Markdown conversion
import { extractWithRaw } from '@tabext/extraction/extractors/raw';
const content = await extractWithRaw({
  convert_to_markdown: true,
  optimize_tokens: true,
});
```

### HTML to Markdown

```typescript
import { htmlToMarkdown } from '@tabext/extraction';

const markdown = await htmlToMarkdown(htmlString, {
  includeLinks: true,
});
```

### Content Analysis

```typescript
import { detectCodeBlocks, countWords, generateExcerpt } from '@tabext/extraction';

const hasCode = detectCodeBlocks(markdown);
const wordCount = countWords(text);
const excerpt = generateExcerpt(content);
```

## Message Communication

### Receiving Messages

```typescript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'EXTRACT_CONTENT':
      extractContent(message.options)
        .then(content => sendResponse({ success: true, content }))
        .catch(error => sendResponse({ success: false, error }));
      return true; // Async response
  }
});
```

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

### Content Sanitization

- DOMPurify for HTML sanitization
- Script and dangerous element removal
- URL validation before normalization
- Isolated content script sandbox

### Best Practices

1. Never execute extracted scripts
2. Sanitize all HTML content
3. Validate URLs before processing
4. Use timeout protection
5. Handle memory constraints

## Performance

### Optimization Strategies

- **Lazy Loading**: On-demand module loading
- **Module Caching**: Cache dynamic imports
- **Timeout Enforcement**: Prevent hanging
- **Memory Management**: Content truncation
- **Token Optimization**: 40-70% reduction in raw mode

### Performance Metrics

- Extraction time: <2s average
- Memory usage: <10MB per extraction
- Token reduction: 40-70% with optimization
- Cache hit rate: >80% for repeated extractions

## Testing

### Test Coverage

```bash
# Run all tabext tests
npm test -- src/tabext

# Specific test suites
npm test -- src/tabext/extraction
npm test -- src/tabext/core
npm test -- src/tabext/utils
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
- **turndown** - HTML to Markdown conversion
- **turndown-plugin-gfm** - GitHub Flavored Markdown
- **dompurify** - HTML sanitization (via Defuddle)
- **Chrome APIs** - Extension communication

## Future Enhancements

### Planned Features

- [ ] Readability.js integration
- [ ] Mozilla reader view algorithm
- [ ] Content caching layer
- [ ] PDF/DOCX export formats
- [ ] Academic paper extraction
- [ ] Content quality scoring
- [ ] Incremental extraction for large pages
- [ ] Visual content extraction (images, charts)

### Experimental Features

- Machine learning for content detection
- Custom extraction rules per domain
- Multi-language content support

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

## License

MIT License - Part of the AI Browser Sidebar Extension project
