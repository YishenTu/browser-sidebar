# Source Code Structure

## Core Modules

### `/background`

Service worker that handles:

- Extension icon clicks
- Tab state management
- Message routing between components

### `/content`

Content script injected into web pages:

- Handles sidebar injection
- Manages communication with background script
- Lightweight bridge between page and extension

### `/sidebar`

Main application UI (React):

- **`/components`** - Reusable UI components
- **`/hooks`** - Custom React hooks
- **`/styles`** - CSS modules and styles
- **`Sidebar.tsx`** - Main sidebar container component
- **`index.tsx`** - Sidebar mounting/unmounting logic

## Future Modules (Stage 2+)

### `/providers`

AI provider integrations:

- OpenAI client
- Google Gemini client
- Anthropic client
- Provider abstraction layer

### `/storage`

Data persistence layer:

- Chrome storage API wrapper
- Encryption utilities
- Settings management
- Chat history storage

### `/services`

Business logic services:

- Content extraction
- Message formatting
- Rate limiting
- Error handling

### `/types`

TypeScript type definitions:

- API interfaces
- Message types
- Configuration types
- Component props

### `/utils`

Utility functions:

- DOM helpers
- String formatting
- Validation
- Common helpers

## Module Dependencies

```
background
    ↓
content ←→ sidebar
           ├── components
           ├── hooks
           └── styles

(Future):
sidebar → providers
        → storage
        → services
        → utils
```

## Development Guidelines

1. **Separation of Concerns**: Each module has a single responsibility
2. **Type Safety**: All modules use TypeScript with strict mode
3. **Testing**: Each module has corresponding tests in `/tests`
4. **Isolation**: Modules communicate via well-defined interfaces

## Import Aliases

Available import aliases (configured in `vite.config.ts`):

- `@/` - src directory
- `@components` - src/sidebar/components
- `@hooks` - src/sidebar/hooks
- `@providers` - src/providers
- `@storage` - src/storage
- `@services` - src/services
- `@types` - src/types
- `@utils` - src/utils
