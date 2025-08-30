# Sidebar Module

The sidebar module implements the injected React-based chat interface for the browser extension, rendered in Shadow DOM for complete style isolation.

## Directory Structure

```
sidebar/
├── ChatPanel.tsx              # Main sidebar component with chat interface
├── index.tsx                  # Mount/unmount functions for Shadow DOM
├── components/                # React components library
│   ├── layout/               # Layout components
│   │   ├── Header.tsx        # Sidebar header with title and controls
│   │   ├── Footer.tsx        # Chat input footer area
│   │   ├── Body.tsx          # Main content area wrapper
│   │   └── ResizeHandles.tsx # Drag-to-resize functionality
│   ├── ChatInput.tsx         # Multi-line input with character counter
│   ├── CodeBlock.tsx         # Syntax-highlighted code display
│   ├── ContentPreview.tsx    # Extracted page content preview
│   ├── ErrorBanner.tsx       # Error display banner
│   ├── MarkdownRenderer.tsx  # Full GFM markdown + KaTeX math
│   ├── MessageBubble.tsx     # Individual message rendering
│   ├── MessageList.tsx       # Virtualized message display
│   ├── ModelSelector.tsx     # AI model/provider selection
│   ├── SearchSources.tsx     # Search source display
│   ├── Settings/             # Settings components
│   │   └── Settings.tsx      # Main settings interface
│   ├── StreamingText.tsx     # Real-time text streaming display
│   ├── TabChip.tsx          # Tab selection chip
│   ├── TabContentItem.tsx   # Tab content display item
│   ├── TabErrorBoundary.tsx # Error boundary for tab operations
│   ├── TabLoadingIndicator.tsx # Loading state for tabs
│   ├── TabMentionDropdown.tsx # Tab mention autocomplete
│   ├── ThinkingWrapper.tsx   # AI reasoning display
│   ├── TypingIndicator.tsx   # Typing animation
│   ├── index.ts              # Component exports
│   └── ui/                   # Reusable UI components
│       ├── Alert.tsx         # Alert messages
│       ├── Collapsible.tsx   # Collapsible content sections
│       ├── CopyButton.tsx    # Copy to clipboard button
│       ├── Dropdown.tsx      # Dropdown menu component
│       ├── FullscreenModal.tsx # Fullscreen modal overlay
│       ├── Icons.tsx         # Icon components library
│       ├── Spinner.tsx       # Loading spinner
│       ├── TextArea.tsx      # Enhanced textarea
│       ├── Tooltip.tsx       # Tooltip component
│       └── index.ts          # UI exports
├── contexts/                 # React contexts
│   ├── ErrorContext.tsx     # Global error handling context
│   ├── ErrorContextDef.ts   # Error context type definitions
│   ├── errorUtils.ts        # Error utility functions
│   ├── index.ts             # Context exports
│   └── useError.ts          # Error hook
├── hooks/                    # Custom React hooks
│   ├── ai/                  # AI-related hooks
│   │   ├── index.ts         # AI hooks exports
│   │   ├── types.ts         # AI hook types
│   │   ├── useAIChat.ts     # Main chat logic
│   │   ├── useMessageHandler.ts # Message handling
│   │   ├── useProviderManager.ts # Provider switching
│   │   └── useStreamHandler.ts # Stream processing
│   ├── useAIChat.ts         # Legacy AI chat hook
│   ├── useContentExtraction.ts # Content extraction logic
│   ├── useDragPosition.ts   # Drag positioning hook
│   ├── useMultiTabExtraction.ts # Multi-tab extraction
│   ├── useResize.ts         # Resize handling
│   └── useTabMention.ts     # Tab mention functionality
├── styles/                   # CSS architecture
│   ├── 0-foundation/        # Foundation layer
│   │   ├── animations.css   # Animation definitions
│   │   ├── reset.css        # CSS reset
│   │   └── variables.css    # CSS custom properties
│   ├── 1-base/              # Base layer
│   │   ├── base.css         # Base element styles
│   │   └── typography.css   # Typography system
│   ├── 2-layout/            # Layout layer
│   │   ├── resize-handles.css # Resize handle styles
│   │   └── scrollbars.css   # Custom scrollbar styles
│   ├── 3-components/        # Component layer
│   │   ├── alert.css        # Alert component styles
│   │   ├── chat-input.css   # Chat input styles
│   │   ├── code-block.css   # Code block styles
│   │   ├── collapsible.css  # Collapsible styles
│   │   ├── copy-button.css  # Copy button styles
│   │   ├── dropdown.css     # Dropdown styles
│   │   ├── fullscreen-modal.css # Modal styles
│   │   ├── katex-math.css   # Math rendering styles
│   │   ├── markdown-content.css # Markdown styles
│   │   ├── message-bubbles.css # Message bubble styles
│   │   ├── model-selector.css # Model selector styles
│   │   ├── settings.css     # Settings panel styles
│   │   ├── thinking-wrapper.css # Thinking display styles
│   │   └── tooltip.css      # Tooltip styles
│   ├── 4-features/          # Feature layer
│   │   ├── multi-tab-content.css # Multi-tab styles
│   │   ├── search-sources.css # Search source styles
│   │   ├── tab-chip.css     # Tab chip styles
│   │   ├── tab-content-item.css # Tab content styles
│   │   ├── tab-error-boundary.css # Error boundary styles
│   │   ├── tab-loading-indicator.css # Loading styles
│   │   └── tab-mention-dropdown.css # Mention dropdown styles
│   ├── README.md            # CSS architecture documentation
│   └── index.css            # Main style entry point
├── utils/                    # Utility functions
│   ├── contentFormatter.ts  # Content formatting utilities
│   ├── contentFormatter.example.ts # Formatting examples
│   ├── dropdownPosition.ts  # Dropdown positioning logic
│   ├── favicon.ts           # Favicon utilities
│   ├── index.ts             # Utility exports
│   └── tabFilters.ts        # Tab filtering logic
└── constants.ts             # Sidebar constants
```

## Key Components

### ChatPanel.tsx

The main orchestrator component that:

- Manages chat state and AI interactions
- Handles sidebar positioning and resizing
- Coordinates content extraction from tabs
- Provides error boundaries and recovery
- Integrates all sub-components

### Component Categories

#### Layout Components (`components/layout/`)

- **Header**: Draggable title bar with controls
- **Footer**: Chat input area with send controls
- **Body**: Scrollable content area
- **ResizeHandles**: Edge drag handles for resizing

#### Chat Components

- **MessageList**: Virtualized list supporting thousands of messages
- **MessageBubble**: Individual messages with role-based styling
- **ChatInput**: Enhanced textarea with auto-resize and shortcuts
- **StreamingText**: Smooth token-by-token display

#### AI Features

- **ModelSelector**: Provider and model switching with capabilities
- **ThinkingWrapper**: Real-time reasoning with elapsed time
- **TypingIndicator**: Visual feedback during AI processing

#### Content Extraction

- **ContentPreview**: Extracted content with metadata
- **TabContentItem**: Individual tab content display
- **TabChip**: Selectable tab indicators
- **TabMentionDropdown**: Autocomplete for @tab mentions

#### UI Library (`components/ui/`)

Reusable components following design system:

- Alert, Collapsible, CopyButton, Dropdown
- FullscreenModal, Icons, Spinner, TextArea, Tooltip

## Styling Architecture

### Layered CSS System

The styles follow a structured layer approach:

1. **Foundation (0-)**: Variables, animations, reset
2. **Base (1-)**: Element defaults, typography
3. **Layout (2-)**: Structural styles, scrollbars
4. **Components (3-)**: Component-specific styles
5. **Features (4-)**: Feature-specific styles

### Key Principles

- CSS custom properties for theming
- Minimal use of `!important`
- Component-scoped styles
- Shadow DOM isolation from host page

## State Management

### Global State (Zustand)

- **Chat Store** (`@store/chat.ts`): Messages, streaming state
- **Settings Store** (`@store/settings.ts`): API keys, preferences

### Local State

- Component-level React state for UI interactions
- Custom hooks for complex state logic

### Context Providers

- **ErrorContext**: Centralized error handling and recovery

## Event System

### Custom DOM Events

- `sidebar-toggle`: Show/hide sidebar
- `sidebar-close`: Force close
- Content extraction events from tabs

### Message Passing

- Chrome runtime messages for extension communication
- Type-safe message contracts in `@types/messages.ts`

## Hooks

### AI Integration (`hooks/ai/`)

- `useAIChat`: Main chat orchestration
- `useStreamHandler`: Token streaming and buffering
- `useProviderManager`: Provider switching and fallbacks
- `useMessageHandler`: Message processing

### Utility Hooks

- `useContentExtraction`: Tab content capture
- `useMultiTabExtraction`: Aggregate multiple tabs
- `useDragPosition`: Sidebar positioning
- `useResize`: Resize constraints
- `useTabMention`: @ mention functionality

## Performance Optimizations

- **Virtual Scrolling**: MessageList handles thousands of messages
- **React.memo**: Prevents unnecessary re-renders
- **useCallback/useMemo**: Optimized event handlers and computations
- **Lazy Loading**: Components loaded on demand
- **Stream Buffering**: Smooth token display at 60fps

## Testing

Located in `/tests/sidebar/`:

```bash
npm test -- tests/sidebar/           # All sidebar tests
npm test -- tests/sidebar/components # Component tests
npm test -- tests/sidebar/performance # Performance tests
npm test -- tests/sidebar/accessibility # A11y tests
```

### Coverage Requirements

- Minimum 80% line coverage
- Critical paths must have 95%+ coverage
- Performance benchmarks must pass

## Development Guidelines

### Adding New Components

1. Create component in appropriate `components/` subdirectory
2. Add styles following layer system in `styles/`
3. Write comprehensive tests
4. Update component exports in `index.ts`
5. Document in this README

### Modifying Styles

1. Follow CSS architecture in `styles/README.md`
2. Use CSS variables from `variables.css`
3. Maintain layer separation
4. Test in Shadow DOM context
5. Verify cross-browser compatibility

### Performance Best Practices

1. Use virtualization for long lists
2. Implement React.memo for pure components
3. Debounce expensive operations
4. Profile with React DevTools
5. Monitor bundle size impact

## Accessibility

- WCAG 2.1 AA compliance
- Keyboard navigation support
- Screen reader compatibility
- Focus management
- ARIA labels and roles

## Browser Compatibility

- Chrome 88+
- Edge 88+
- Arc (all versions)
- Brave (Chromium-based)

## Known Issues

- Sidebar may not appear on restricted pages (chrome://, file://)
- Some sites with strict CSP may block Shadow DOM
- Performance degrades with 10,000+ messages (use pagination)
