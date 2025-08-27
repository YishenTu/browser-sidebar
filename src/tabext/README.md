# Tab Content Extraction Module

## Overview

The `tabext` (Tab Extension) module is responsible for extracting, processing, and converting web page content into clean, structured Markdown suitable for AI consumption. This module runs in the context of web pages and provides the core content extraction functionality for the browser sidebar extension.

## Architecture

```
tabext/
├── contentExtractor.ts       # Main orchestrator for content extraction
├── extractorLoader.ts        # Dynamic import wrapper for test mocking
├── contentQuality.ts         # Content quality scoring system
├── domUtils.ts              # DOM manipulation, cleaning, and URL normalization
├── extractors/              # Extraction strategies
│   ├── defuddle.ts          # Defuddle library adapter (smart extraction)
│   ├── readability.ts       # Mozilla Readability adapter
│   ├── comprehensive.ts     # Full content extraction (minus noise)
│   └── fallback.ts          # Heuristic extraction for non-articles
├── markdown/                # HTML to Markdown conversion
│   └── markdownConverter.ts # Enhanced Turndown converter
└── index.ts                 # Content script entry point
```

## Core Components

### Content Extractor (`contentExtractor.ts`)

The main orchestrator that coordinates the extraction pipeline:

- **Smart Mode** (default): Uses Defuddle with quality gates, falls back to Readability
- **Comprehensive Mode**: Subtractive extraction preserving all meaningful content
- **Article Mode**: Pure Readability extraction for clean articles
- **Minimal Mode**: Ultra-light extraction, respects user selection
- **Selection Mode**: Extract only selected text
- Cleans HTML and normalizes URLs before conversion
- Enforces timeouts (default 2s, configurable)
- Converts HTML to clean Markdown with enhanced rules
- Manages character limits and truncation

**Usage:**

```typescript
import { extractContent } from '@tabext/contentExtractor';

const content = await extractContent(
  {
    includeLinks: false, // Strip hyperlinks for cleaner output
    timeout: 2000, // Extraction timeout in ms
    maxLength: 200000, // Maximum output characters
  },
  ExtractionMode.SMART // Smart mode with quality gates (default)
);
```

### Extraction Strategies

#### Defuddle Extractor (`extractors/defuddle.ts`)

- Advanced content extraction with structure analysis
- Extracts schema.org JSON-LD and meta tags
- Better handling of modern web frameworks
- Used in Smart mode with quality gate decisions

#### Comprehensive Extractor (`extractors/comprehensive.ts`)

- Subtractive approach: starts with full content
- Removes noise elements (nav, footer, ads, etc.)
- Preserves comments, discussions, and interactive elements
- Handles SPAs with guard rails for dynamic content

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

Converts HTML to clean Markdown using enhanced Turndown with:

- GFM (GitHub Flavored Markdown) support
- Code block language detection
- DOMPurify sanitization for security
- Optional link stripping (default: disabled)
- Custom rules for:
  - Figures with captions
  - Footnote references and definitions
  - Iframe embeds (YouTube, Twitter)
  - Enhanced code blocks with language detection

### Content Quality Scoring (`contentQuality.ts`)

Analyzes extracted content and provides quality metrics:

- Score: 0-100 based on completeness
- Quality levels: Low, Medium, High
- Confidence rating for extraction quality
- Signals: hasTitle, hasStructure, hasCode, headingCount, etc.
- Used for quality gates between Defuddle and Readability
- Determines extraction method selection in Smart mode

### DOM Utilities (`domUtils.ts`)

Helper functions for safe DOM manipulation:

- `isVisible()`: Detects visible elements using computed styles
- `getPageMetadata()`: Extracts meta tags and document info
- `clampText()`: Safely truncates text with ellipsis
- `cleanHtml()`: Removes scripts, styles, and noise elements
- `normalizeUrls()`: Converts relative URLs to absolute
  - Smart handling of protocol-relative URLs
  - Conservative coercion of custom protocols
  - Preserves data URLs and special protocols
  - Optional link preservation (default: images only)

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
  includeLinks?: boolean; // Include hyperlinks (default: false)
  timeout?: number; // Timeout in ms (default: 2000)
  maxLength?: number; // Max output chars (default: 200000)

  // Deprecated (backwards compatibility)
  maxChars?: number; // Use maxLength instead
  maxOutputChars?: number; // Use maxLength instead
}

// Extraction modes
enum ExtractionMode {
  SMART = 'smart',               // Defuddle with quality gates (default)
  COMPREHENSIVE = 'comprehensive', // Full content minus noise
  ARTICLE = 'article',           // Readability extraction
  MINIMAL = 'minimal',           // Ultra-light extraction
  SELECTION = 'selection'        // Selection-only extraction
}
```

## Extracted Content Structure

```typescript
interface ExtractedContent {
  // Core content
  title: string;
  url: string;
  domain: string;
  content: string;        // Markdown content
  textContent: string;    // Plain text version
  excerpt?: string;

  // Metadata
  author?: string;
  publishedDate?: string;
  extractedAt: number;    // Unix timestamp
  extractionMethod: 'readability' | 'fallback' | 'comprehensive' | 'defuddle' | 'selection' | 'failed';

  // Enhanced metadata
  metadata?: {
    wordCount: number;
    hasCodeBlocks: boolean;
    hasTables: boolean;
    truncated?: boolean;
    timeoutMs?: number;
    schemaOrgData?: unknown;      // JSON-LD structured data
    metaTags?: Array<Record<string, string>>; // Meta tag collection
  };

  // Deprecated (backwards compatibility)
  markdown?: string;      // Use content instead
  wordCount?: number;     // Use metadata.wordCount
  hasCode?: boolean;      // Use metadata.hasCodeBlocks
  hasTables?: boolean;    // Use metadata.hasTables
  isTruncated?: boolean;  // Use metadata.truncated
  extractionTime?: number; // Use extractedAt
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

- `defuddle`: Advanced content extraction with structure analysis
- `@mozilla/readability`: Article extraction
- `turndown` + `turndown-plugin-gfm`: HTML to Markdown
- `dompurify`: HTML sanitization
- Dynamic imports for optimal bundle splitting

## License

Part of the AI Browser Sidebar Extension project.
