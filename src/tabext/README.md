# Tab Content Extraction Module

## Overview

The `tabext` (Tab Extension) module is responsible for extracting, processing, and converting web page content into clean, structured Markdown suitable for AI consumption. This module runs in the context of web pages and provides the core content extraction functionality for the browser sidebar extension.

## Architecture

```
tabext/
├── contentExtractor.ts       # Main orchestrator for content extraction
├── extractorLoader.ts        # Dynamic import wrapper for test mocking
├── contentQuality.ts         # Content quality scoring system
├── domUtils.ts              # DOM manipulation and metadata utilities
├── extractors/              # Extraction strategies
│   ├── readability.ts       # Mozilla Readability adapter
│   └── fallback.ts          # Heuristic extraction for non-articles
├── markdown/                # HTML to Markdown conversion
│   └── markdownConverter.ts # Turndown-based converter
└── index.ts                 # Content script entry point
```

## Core Components

### Content Extractor (`contentExtractor.ts`)

The main orchestrator that coordinates the extraction pipeline:

- Attempts extraction using Mozilla Readability first
- Falls back to heuristic extraction for non-article pages
- Enforces timeouts (default 2s, configurable)
- Converts HTML to clean Markdown
- Manages character limits and truncation

**Usage:**

```typescript
import { extractContent } from '@tabext/contentExtractor';

const content = await extractContent({
  includeLinks: true, // Include hyperlinks in Markdown
  timeout: 2000, // Extraction timeout in ms
  maxLength: 200000, // Maximum output characters
});
```

### Extraction Strategies

#### Readability Extractor (`extractors/readability.ts`)

- Uses Mozilla's Readability library for article extraction
- Best for blog posts, news articles, and documentation
- Preserves semantic structure and metadata
- Non-destructive (clones DOM before parsing)

#### Fallback Extractor (`extractors/fallback.ts`)

- Heuristic-based extraction for non-article pages
- Scores content containers based on text density
- Removes scripts, styles, and hidden elements
- Handles SPAs and dynamically loaded content

### Markdown Conversion (`markdown/markdownConverter.ts`)

Converts HTML to clean Markdown using Turndown with:

- GFM (GitHub Flavored Markdown) support
- Code block language detection
- DOMPurify sanitization for security
- Optional link stripping for cleaner output
- Custom fenced code block rules

### Content Quality Scoring (`contentQuality.ts`)

Analyzes extracted content and provides quality metrics:

- Score: 0-100 based on completeness
- Quality levels: Low, Medium, High
- Signals: hasTitle, hasStructure, hasCode, etc.
- Used for UX hints and extraction confidence

### DOM Utilities (`domUtils.ts`)

Helper functions for safe DOM manipulation:

- `isVisible()`: Detects visible elements
- `getPageMetadata()`: Extracts meta tags and document info
- `clampText()`: Safely truncates text with ellipsis

## Performance Targets

- **Simple pages**: < 500ms extraction time
- **Complex pages**: 2s hard timeout (configurable)
- **Memory**: Automatic cleanup after extraction
- **Bundle size**: Dynamic imports for heavy libraries

## Integration Points

### With Sidebar Hook

The sidebar uses the `useContentExtraction` hook which dynamically imports this module:

```typescript
// In sidebar component
const { content, loading, error, reextract } = useContentExtraction(true);
```

### With Content Script

The content script (`index.ts`) handles:

- Sidebar injection and management
- Message passing with background script
- Future: Direct extraction message handling

## Extraction Options

```typescript
interface ExtractionOptions {
  includeLinks?: boolean; // Include hyperlinks (default: true)
  timeout?: number; // Timeout in ms (default: 2000)
  maxLength?: number; // Max output chars (default: 200000)

  // Deprecated (backwards compatibility)
  maxChars?: number; // Use maxLength instead
  maxOutputChars?: number; // Use maxLength instead
}
```

## Extracted Content Structure

```typescript
interface ExtractedContent {
  // Core content
  title: string;
  url: string;
  domain: string;
  markdown: string;
  excerpt: string;

  // Metadata
  author?: string;
  publishedDate?: string;
  wordCount: number;
  extractionMethod: 'readability' | 'fallback';
  extractionTime: number;

  // Content flags
  hasCode: boolean;
  hasTables: boolean;
  isTruncated: boolean;

  // Optional metadata
  metadata?: {
    wordCount: number;
    hasCodeBlocks: boolean;
    hasTables: boolean;
    truncated: boolean;
  };
}
```

## Testing

The module includes comprehensive test coverage:

- Unit tests for utilities and converters
- Integration tests for extraction pipeline
- Performance benchmarks
- Mock fixtures for various page types

Run tests:

```bash
npm test -- src/tabext
```

## Security Considerations

- **DOMPurify**: All HTML is sanitized before conversion
- **Non-destructive**: DOM is cloned before manipulation
- **No mutations**: Original page DOM is never modified
- **Content Security**: Respects CSP and same-origin policies

## Browser Compatibility

- Chrome/Edge: Full support
- Arc Browser: Full support
- Firefox: Requires manifest adjustments
- Safari: Not currently supported

## Future Enhancements

- [ ] Multi-tab content aggregation
- [ ] Incremental extraction for dynamic content
- [ ] Custom extraction rules per domain
- [ ] PDF and image content extraction
- [ ] Structured data extraction (JSON-LD, microdata)

## Dependencies

- `@mozilla/readability`: Article extraction
- `turndown` + `turndown-plugin-gfm`: HTML to Markdown
- `dompurify`: HTML sanitization
- Dynamic imports for optimal bundle splitting

## License

Part of the AI Browser Sidebar Extension project.
