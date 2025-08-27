# Sidebar Module

The sidebar module implements the injected React-based chat interface for the browser extension.

## Directory Structure

```
sidebar/
├── ChatPanel.tsx              # Main sidebar component with chat interface
├── index.tsx                  # Mount/unmount functions for sidebar
├── components/                # React components
│   ├── layout/               # Layout components
│   │   ├── Header.tsx        # Sidebar header with controls
│   │   ├── Footer.tsx        # Chat input footer
│   │   └── ResizeHandle.tsx  # Drag-to-resize functionality
│   ├── chat/                 # Chat-related components
│   │   ├── ChatInput.tsx     # Message input with character counter
│   │   ├── MessageList.tsx   # Virtualized message display
│   │   └── MessageBubble.tsx # Individual message rendering
│   ├── ai/                   # AI-specific components
│   │   ├── ModelSelector.tsx # AI model selection dropdown
│   │   └── ThinkingWrapper.tsx # Real-time reasoning display
│   ├── content/              # Content extraction components
│   │   └── ContentPreview.tsx           # Content preview display
│   └── ui/                   # Reusable UI components
│       ├── Button.tsx        # Button component
│       ├── Card.tsx          # Card container
│       ├── Input.tsx         # Input field
│       ├── Label.tsx         # Form label
│       ├── Select.tsx        # Select dropdown
│       ├── Textarea.tsx      # Multi-line input
│       └── Toast.tsx         # Toast notifications
├── contexts/                 # React contexts
│   └── ErrorContext.tsx     # Global error handling
├── hooks/                    # Custom React hooks
│   ├── ai/                  # AI-related hooks
│   │   ├── useAIChat.ts     # Main chat logic
│   │   ├── useStreamHandler.ts # Stream processing
│   │   └── useProviderManager.ts # Provider management
│   ├── useContentExtraction.ts # Content extraction hook
│   └── useSidebarEvents.ts  # Sidebar event handling
└── styles/                   # Component styles
    ├── base.css              # Base styles and resets
    ├── sidebar.css           # Main sidebar styles
    ├── chat-input.css        # Chat input styles
    └── settings.css          # Settings component styles
```

## Key Components

### ChatPanel

The main sidebar component that orchestrates all functionality:

- Manages chat state and AI interactions
- Handles sidebar positioning and resizing
- Coordinates content extraction
- Provides error boundaries

### Component Organization

#### Layout Components

- **Header**: Drag handle, title, and close button
- **Footer**: Chat input area with send button
- **ResizeHandle**: Left-edge drag-to-resize

#### Chat Components

- **ChatInput**: Enhanced textarea with character counting
- **MessageList**: Virtualized list for performance
- **MessageBubble**: Markdown rendering with syntax highlighting

#### AI Components

- **ModelSelector**: Dropdown for switching AI models
- **ThinkingWrapper**: Displays AI reasoning in real-time

#### Content Components

- **ContentPreview**: Displays extracted content with metadata

## Styling

The sidebar uses a modular CSS approach:

- **CSS Variables**: Defined in `/src/styles/variables.css`
- **Component Styles**: Scoped styles in `/styles/` directory
- **Shadow DOM**: Isolates styles from host page

## State Management

- **Chat State**: Zustand store in `/src/data/store/chat.ts`
- **Settings**: API keys and preferences in `/src/data/store/settings.ts`
- **Local State**: Component-specific state using React hooks

## Event System

The sidebar responds to custom DOM events:

- `sidebar-toggle`: Show/hide sidebar
- `sidebar-close`: Force close sidebar
- Content extraction events for page analysis

## Testing

Tests are located in `/tests/sidebar/`:

- Component tests for individual pieces
- Integration tests for workflows
- Performance benchmarks
- Accessibility compliance

## Development

### Adding a New Component

1. Create component in appropriate subdirectory
2. Add corresponding styles if needed
3. Write tests in `/tests/sidebar/components/`
4. Update this README

### Modifying Styles

1. Use CSS variables from `variables.css`
2. Keep styles modular and component-scoped
3. Test in Shadow DOM context

### Performance Considerations

- Message list uses virtualization for large conversations
- Components use React.memo where appropriate
- Event handlers use useCallback to prevent re-renders
- Streaming responses use buffering for smooth display
