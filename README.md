# AI Browser Sidebar Extension

A privacy‑focused browser extension for AI‑powered chat with web content using your own API keys (BYOK). The sidebar is a Shadow DOM overlay that's resizable, draggable, and works across Chromium browsers.

## Features

- 🔒 **Privacy-First**: All data stays local, encrypted API key storage
- 💬 **AI Chat**: Full streaming support with OpenAI GPT-5 and Google Gemini 2.5
- 🧠 **Thinking Display**: Real-time reasoning visualization with timer
- 🎨 **Customizable UI**: Resizable & movable sidebar, light/dark themes
- 🌐 **Universal Compatibility**: Works in Chrome, Arc, Edge, and other Chromium browsers
- 🧩 **Multi-Provider (BYOK)**: OpenAI and Google Gemini fully integrated
- 🔍 **Web Search**: Automatic web search grounding for enhanced responses
- 🔄 **Smart Context Management**: OpenAI Response API with intelligent conversation continuity
- 📑 **Content Extraction**: Smart page content capture with markdown conversion
- 🎯 **Multi-Tab Context**: Smart @ mention system to aggregate content from multiple browser tabs with visual management

## Tech Stack

- **Frontend**: React 18 + TypeScript (strict mode)
- **Build**: Vite + CRXJS (Manifest V3)
- **Styling**: Layered CSS architecture with CSS variables + dark mode support
- **State**: Zustand stores for chat/settings/API keys
- **AI Providers**: OpenAI Response API, Gemini API
- **Testing**: Vitest + React Testing Library (>90% coverage)
- **Virtualization**: react-window for message lists
- **Markdown**: react-markdown + code highlighting + KaTeX math

## Development

### Prerequisites

- Node.js 18+
- Chromium-based browser (Chrome, Arc, Edge, Brave, etc.)
- Git

### Installation

```bash
# Clone the repository
git clone [repository-url]
cd browser-sidebar

# Install dependencies
npm install

# Start development server
npm run dev
```

### Build

```bash
# Build for production
npm run build

# Build and watch for changes
npm run watch

# Regenerate dist after changes (Chrome load)
npx vite build
```

### Testing

```bash
# Run unit tests once (no watch)
npm test

# Watch mode for local development
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests in UI mode
npm run test:ui
```

## Usage

1. **Install the extension**: Load the `dist` folder as an unpacked extension in your browser
2. **Click the extension icon**: Opens a floating sidebar on the right side of the page
3. **Interact with the sidebar**:
   - Drag the header to move it anywhere
   - Drag the left edge to resize (300-800px width)
   - Click the X button or extension icon to close
4. **Configure AI providers**: Add your API keys in the extension settings

## Multi-Tab Content Injection

The extension supports aggregating content from multiple browser tabs in your conversations with AI. This powerful feature allows you to provide comprehensive context from different sources.

### How It Works

- **Automatic Current Tab**: The content from your current tab is automatically loaded when you open the sidebar
- **@ Mention System**: Type `@` in the chat input to search and select additional tabs
- **Smart Content Extraction**: Uses advanced algorithms to extract clean, readable content from web pages
- **Structured Delivery**: All tab contents are sent to AI in a structured XML format for better understanding

### Using the @ Mention System

1. **Open the Chat Input**: Click in the message input area at the bottom of the sidebar
2. **Type @**: Start typing the `@` symbol to trigger the tab selection dropdown
3. **Search Tabs**: Continue typing to filter available tabs by title, domain, or URL
4. **Navigate**: Use arrow keys to navigate through the list, or click with your mouse
5. **Select**: Press Enter or click to select a tab - its content will be loaded
6. **Send**: Compose your message and send - all loaded tab content is included automatically

### Visual Indicators

- **Tab Chips**: Selected tabs appear as removable chips above the input
- **Content Previews**: Expandable content previews show what will be sent to AI
- **Loading States**: Visual indicators show when content is being extracted
- **Status Icons**: ✓ for completed, spinner for loading, warning for errors

### Keyboard Shortcuts

- `@` - Open tab selection dropdown
- `↑/↓` - Navigate dropdown options
- `Enter` - Select highlighted tab
- `Escape` - Close dropdown
- `Tab` - Navigate between UI elements

### Content Management

- **View Content**: Click tab headers in the preview area to expand/collapse content
- **Remove Tabs**: Click the X button on individual tab chips or preview headers
- **Clear All**: Use the "Clear All" button to remove all loaded tabs at once
- **Re-extract**: Refresh content if a page has been updated

### Best Practices

- **Relevant Content**: Select tabs that are relevant to your question for better AI responses
- **Performance**: Keep the number of tabs reasonable (recommended: 5-10 tabs max)
- **Content Quality**: The AI works best with text-heavy pages rather than media-heavy sites
- **Context**: Provide context about why you're including multiple tabs in your question

### Supported Content Types

- **Articles & Blogs**: News articles, blog posts, documentation
- **Reference Materials**: Wikipedia, Stack Overflow, technical docs
- **Product Pages**: E-commerce listings, software descriptions
- **Forums & Discussions**: Reddit threads, forum posts (where accessible)
- **Academic Content**: Research papers, educational resources

### Limitations

- **Restricted URLs**: Cannot access `chrome://`, `file://`, or extension pages
- **Authentication**: Cannot access content behind login walls
- **Dynamic Content**: Some JavaScript-heavy sites may have limited content extraction
- **Size Limits**: Very large pages may be truncated for performance
- **Rate Limits**: Extraction is throttled to prevent overwhelming the browser

### Troubleshooting

#### Tab Content Not Loading

- **Check URL**: Ensure the tab URL is accessible (not chrome:// or extension:// pages)
- **Reload Page**: Try refreshing the page if content seems incomplete
- **Network Issues**: Check if the page loads normally in the browser
- **Content Scripts**: Some sites may block content script injection

#### Dropdown Not Appearing

- **Permissions**: Ensure the extension has access to the tab's domain
- **Focus**: Make sure the input field is focused when typing `@`
- **Spelling**: Ensure you're typing the `@` symbol correctly
- **Browser Compatibility**: Verify you're using a supported Chromium-based browser

#### Performance Issues

- **Reduce Tabs**: Try using fewer tabs if the sidebar becomes slow
- **Clear Cache**: Close and reopen the sidebar to clear cached content
- **Browser Memory**: Close unused browser tabs to free up memory
- **Content Size**: Avoid selecting very large documents

#### Content Quality Issues

- **Page Structure**: Some sites may not extract content cleanly
- **Re-extract**: Try using the re-extract button if content looks wrong
- **Manual Selection**: Consider copying and pasting specific content if needed
- **Alternative Sources**: Try finding the same information on a different site

### Privacy & Security

- **Local Processing**: All content extraction happens locally in your browser
- **No Data Collection**: Tab content is never sent to extension servers
- **Encrypted Storage**: Content is cached locally with encryption
- **Automatic Cleanup**: Cache is cleared when you close the sidebar
- **BYOK**: Your API keys remain under your control

## Project Structure

```
browser-sidebar/
├── src/
│   ├── config/        # Configuration and constants
│   │   ├── models.ts      # AI model definitions
│   │   └── systemPrompt.ts # System prompts
│   ├── data/          # Data management layer
│   │   ├── security/      # AES-GCM encryption
│   │   ├── storage/       # Chrome storage + key management
│   │   └── store/         # Zustand state management
│   ├── extension/     # Browser extension infrastructure
│   │   ├── background/    # Service worker components
│   │   │   ├── cache/     # Content caching system
│   │   │   └── queue/     # Extraction queue management
│   │   └── messaging/     # Message passing system
│   ├── provider/      # AI provider implementations
│   │   ├── openai/        # OpenAI GPT-5 series
│   │   └── gemini/        # Google Gemini 2.5
│   ├── shared/        # Shared utilities
│   │   └── utils/         # Common utility functions
│   ├── sidebar/       # React UI with Shadow DOM
│   │   ├── ChatPanel.tsx  # Main chat interface
│   │   ├── components/    # React components library
│   │   │   ├── layout/    # Header, Footer, Body, ResizeHandles
│   │   │   ├── ui/        # Reusable UI components
│   │   │   └── ...        # Chat, AI, and content components
│   │   ├── contexts/      # React context providers
│   │   ├── hooks/         # Custom React hooks
│   │   │   └── ai/        # AI integration hooks
│   │   └── styles/        # Layered CSS architecture
│   │       ├── 0-foundation/  # Variables, animations, reset
│   │       ├── 1-base/        # Base styles, typography
│   │       ├── 2-layout/      # Layout and structure
│   │       ├── 3-components/  # Component styles
│   │       └── 4-features/    # Feature-specific styles
│   ├── tabext/        # Content extraction system
│   │   ├── core/          # Core functionality
│   │   ├── extraction/    # Content extraction pipeline
│   │   │   ├── analyzers/ # Content analysis
│   │   │   ├── converters/# Format conversion
│   │   │   └── extractors/# Extraction strategies
│   │   └── utils/         # DOM and text utilities
│   └── types/         # TypeScript definitions
├── tests/             # Comprehensive test suites
├── dist/              # Build output (load in browser)
└── docs/              # Documentation
    └── stages/        # Implementation stage guides
```

## Documentation

- [Product Requirements (PRD)](./docs/PRD.md)
- [Claude Code Instructions](./CLAUDE.md)
- [Agent Guidelines](./AGENTS.md)
- Module documentation in each `src/*/README.md`
- Stage guides in `docs/stages/` for detailed implementation

## Contributing

Please read our contributing guidelines before submitting PRs.

## License

MIT — see `package.json` for the license field (LICENSE file TBD)

## Status

### ✅ Completed Features

- **Stage 1**: Extension Infrastructure - Custom sidebar, message passing, cross-browser support
- **Stage 2**: Chat UI - Full React component suite with markdown, virtualization, thinking display
- **Stage 3**: Storage & Security - Encrypted API key storage, Chrome storage integration
- **Stage 4**: AI Providers - OpenAI and Gemini fully integrated with streaming
  - OpenAI Response API with multi-turn conversation support via response IDs
  - Intelligent context management: minimal tokens for consecutive OpenAI calls
  - Smart provider switching: preserves context when needed, clears when appropriate
- **Stage 5**: Content Extraction - Advanced tab content capture system
  - Smart content extraction with Readability algorithm
  - Markdown conversion with structure preservation
  - Multi-tab aggregation support
  - Selection handling with context markers
  - Dynamic content monitoring for SPAs

### Future Enhancements

#### Advanced Features

- **Enhanced Context Management**:
  - Include thinking/reasoning in chat history for better context retention
  - Implementation: Prepend thinking content to assistant messages
  - User toggle: "Include reasoning in chat history" option
- **Content Extraction Improvements**:
  - Image extraction for multimodal models
  - PDF and document parsing
  - Cross-origin iframe handling
  - Advanced table structure preservation

#### Planned Improvements

- **Performance Optimizations**:
  - WebWorker for heavy content processing
  - Advanced caching strategies
  - Incremental content updates
- **Security Enhancements**:
  - Sensitive data pattern detection
  - Automatic PII masking
  - Domain-specific security policies
- **User Experience**:
  - Custom prompt templates
  - Keyboard shortcuts customization
  - Export conversation history
  - Voice input support

---

_Version: 0.5.0-dev_
_Last Updated: 2025-08-29_
