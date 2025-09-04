# Shared Module

Common utilities and helper functions used across the application.

## Overview

The shared module contains reusable utilities, helper functions, and common logic that doesn't belong to any specific domain. These utilities are designed to be pure, stateless, and highly reusable across different modules.

## Structure

```
shared/
└── utils/              # Utility functions
    ├── restrictedUrls.ts # URL restriction checks
    ├── string.ts       # String manipulation utilities
    ├── dom.ts          # DOM helper functions
    ├── async.ts        # Async utilities
    └── index.ts        # Main exports
```

## Utilities

### URL Utilities (`restrictedUrls.ts`)

Checks for restricted URLs where the extension cannot operate:

```typescript
export function isRestrictedUrl(url: string): boolean;
export function canInjectContent(url: string): boolean;
export function normalizeUrl(url: string): string;
```

**Restricted URLs**:

- Chrome internal pages (`chrome://`, `chrome-extension://`)
- Browser store pages
- File URLs (unless permitted)
- Security-sensitive pages

### String Utilities

Common string manipulation functions:

```typescript
export function truncate(str: string, maxLength: number): string;
export function slugify(text: string): string;
export function capitalize(str: string): string;
export function escapeHtml(html: string): string;
export function stripHtml(html: string): string;
```

### DOM Utilities

Helper functions for DOM manipulation:

```typescript
export function waitForElement(selector: string): Promise<Element>;
export function observeElement(element: Element, callback: MutationCallback): void;
export function injectStyles(styles: string, id?: string): void;
export function removeElement(element: Element): void;
export function isVisible(element: Element): boolean;
```

### Async Utilities

Utilities for async operations:

```typescript
export function debounce<T>(fn: T, delay: number): T;
export function throttle<T>(fn: T, limit: number): T;
export function retry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T>;
export function timeout<T>(promise: Promise<T>, ms: number): Promise<T>;
export function sleep(ms: number): Promise<void>;
```

## Usage Examples

### URL Restriction Check

```typescript
import { isRestrictedUrl } from '@shared/utils';

const url = 'https://example.com';
if (!isRestrictedUrl(url)) {
  // Safe to inject content
  injectSidebar();
}
```

### String Manipulation

```typescript
import { truncate, escapeHtml } from '@shared/utils';

const longText = 'This is a very long text...';
const truncated = truncate(longText, 50);

const userInput = '<script>alert("XSS")</script>';
const safe = escapeHtml(userInput);
```

### Async Operations

```typescript
import { debounce, retry } from '@shared/utils';

// Debounced search
const debouncedSearch = debounce((query: string) => {
  performSearch(query);
}, 300);

// Retry failed operation
const result = await retry(() => fetchData(), { maxAttempts: 3, delay: 1000 });
```

### DOM Operations

```typescript
import { waitForElement, injectStyles } from '@shared/utils';

// Wait for element to appear
const element = await waitForElement('.target-class');

// Inject custom styles
injectStyles(
  `
  .custom-class {
    color: blue;
  }
`,
  'my-custom-styles'
);
```

## Utility Categories

### Validation Utilities

```typescript
export function isValidUrl(url: string): boolean;
export function isValidEmail(email: string): boolean;
export function isValidApiKey(key: string): boolean;
```

### Formatting Utilities

```typescript
export function formatDate(date: Date): string;
export function formatBytes(bytes: number): string;
export function formatDuration(ms: number): string;
```

### Array Utilities

```typescript
export function chunk<T>(array: T[], size: number): T[][];
export function unique<T>(array: T[]): T[];
export function shuffle<T>(array: T[]): T[];
```

### Object Utilities

```typescript
export function deepClone<T>(obj: T): T;
export function deepMerge<T>(target: T, source: Partial<T>): T;
export function pick<T, K>(obj: T, keys: K[]): Pick<T, K>;
```

## Best Practices

### Pure Functions

All utilities should be pure functions:

- No side effects
- Same input always produces same output
- No external dependencies on state

### Type Safety

```typescript
// Good: Type-safe with generics
export function identity<T>(value: T): T {
  return value;
}

// Bad: Loses type information
export function identity(value: any): any {
  return value;
}
```

### Error Handling

```typescript
export function safeJsonParse<T>(json: string): T | null {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}
```

### Documentation

Every utility should have:

- Clear JSDoc comments
- Parameter descriptions
- Return type documentation
- Usage examples

## Performance Considerations

- **Memoization**: Cache expensive computations
- **Lazy Evaluation**: Defer computation until needed
- **Efficient Algorithms**: Use optimal algorithms
- **Memory Management**: Avoid memory leaks

## Testing

### Unit Tests

```typescript
describe('truncate', () => {
  it('should truncate long strings', () => {
    expect(truncate('hello world', 5)).toBe('hello...');
  });

  it('should not truncate short strings', () => {
    expect(truncate('hi', 5)).toBe('hi');
  });
});
```

### Property-Based Testing

```typescript
import fc from 'fast-check';

test('truncate preserves string length constraint', () => {
  fc.assert(
    fc.property(fc.string(), fc.integer({ min: 1, max: 100 }), (str, max) => {
      const result = truncate(str, max);
      expect(result.length).toBeLessThanOrEqual(max + 3); // +3 for '...'
    })
  );
});
```

## Adding New Utilities

1. Create utility function in appropriate file
2. Add comprehensive tests
3. Document with JSDoc
4. Export from index.ts
5. Update this README

## Dependencies

The shared module should have minimal dependencies:

- No framework-specific code
- No module-specific business logic
- Only well-established utility libraries if needed

## Future Enhancements

- Crypto utilities for hashing
- Color manipulation utilities
- Advanced date/time utilities
- Internationalization helpers
- Performance monitoring utilities
