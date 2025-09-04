# Extraction Service

The Extraction Service provides a high-level API for extracting content from browser tabs with retry logic, error handling, and consistent TabContent formatting.

## Features

- **Current Tab Extraction**: Extract content from the currently active tab
- **Multi-Tab Extraction**: Extract content from multiple tabs concurrently
- **Retry Logic**: Automatic retry with exponential backoff for failed extractions
- **Error Handling**: Comprehensive error classification and handling
- **Background Messaging**: Integrates with the existing background script messaging system
- **TypeScript Support**: Full type safety with proper interfaces

## Usage

### Basic Usage

```typescript
import { ExtractionService } from '@/services/extraction';

// Create a service instance (typically from sidebar context)
const extractionService = new ExtractionService('sidebar');

// Extract current tab content
try {
  const tabContent = await extractionService.extractCurrentTab();
  console.log('Extracted content:', tabContent.extractedContent.content);
} catch (error) {
  console.error('Extraction failed:', error.message);
}
```

### Convenience Functions

```typescript
import { extractCurrentTab, extractTabs } from '@/services/extraction';

// Extract current tab using default service
const currentTab = await extractCurrentTab({
  mode: ExtractionMode.DEFUDDLE,
  timeout: 5000,
  forceRefresh: true,
});

// Extract multiple tabs
const results = await extractTabs([123, 456, 789], {
  maxRetries: 2,
  timeout: 3000,
});

console.log(`Successfully extracted ${results.successCount}/${results.totalTabs} tabs`);
```

### Advanced Configuration

```typescript
import { ExtractionService, ExtractionMode } from '@/services/extraction';

const service = new ExtractionService('sidebar');

// Extract with custom options
const tabContent = await service.extractCurrentTab({
  mode: ExtractionMode.RAW, // Use raw mode for tables
  timeout: 10000, // 10 second timeout
  maxLength: 500000, // 500k character limit
  forceRefresh: true, // Ignore cache
  maxRetries: 3, // Retry up to 3 times
  retryDelay: 2000, // Wait 2s between retries
});

// Batch extraction with error handling
const batchResults = await service.extractTabs([123, 456, 789]);

for (const result of batchResults.results) {
  if (result.success) {
    console.log(`Tab ${result.tabId}: ${result.content?.extractedContent.title}`);
  } else {
    console.error(`Tab ${result.tabId} failed: ${result.error}`);
  }
}
```

## Error Handling

The service provides comprehensive error classification:

```typescript
import { ExtractionError, ExtractionErrorType } from '@/services/extraction';

try {
  const content = await extractCurrentTab();
} catch (error) {
  if (error instanceof ExtractionError) {
    switch (error.type) {
      case ExtractionErrorType.TIMEOUT:
        console.log('Extraction timed out');
        break;
      case ExtractionErrorType.TAB_NOT_FOUND:
        console.log('Tab was closed or not found');
        break;
      case ExtractionErrorType.RESTRICTED_URL:
        console.log('Cannot access restricted URL');
        break;
      case ExtractionErrorType.CONTENT_SCRIPT_UNAVAILABLE:
        console.log('Content script not available');
        break;
      default:
        console.log('Unknown extraction error');
    }
  }
}
```

## Integration with Existing Systems

The service integrates seamlessly with the existing extraction infrastructure:

- **Uses TabManager**: Leverages the existing TabManager for actual extraction
- **Background Messaging**: Communicates with background script using the established messaging protocol
- **Consistent Types**: Returns TabContent in the same format as existing hooks
- **Cache Integration**: Works with the existing content caching system

## API Reference

### ExtractionService

Main service class for content extraction.

#### Methods

- `extractCurrentTab(options?): Promise<TabContent>` - Extract current tab content
- `extractTabs(tabIds, options?): Promise<BatchExtractionResult>` - Extract multiple tabs

### ServiceExtractionOptions

Configuration options for extraction:

```typescript
interface ServiceExtractionOptions extends ExtractionOptions {
  forceRefresh?: boolean; // Ignore cache
  mode?: ExtractionMode; // DEFUDDLE, SELECTION, or RAW
  maxRetries?: number; // Retry attempts (default: 2)
  retryDelay?: number; // Delay between retries (default: 1000ms)
}
```

### ExtractionResult

Individual extraction result:

```typescript
interface ExtractionResult {
  success: boolean;
  content?: TabContent; // If successful
  error?: string; // If failed
  tabId: number;
}
```

### BatchExtractionResult

Batch extraction results with statistics:

```typescript
interface BatchExtractionResult {
  results: ExtractionResult[];
  totalTabs: number;
  successCount: number;
  failureCount: number;
  successRate: number; // Percentage
}
```
