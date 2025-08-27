# AI Browser Sidebar Extension

A privacy‑focused browser extension for AI‑powered chat with web content using your own API keys (BYOK). The sidebar is a Shadow DOM overlay that’s resizable, draggable, and works across Chromium browsers.

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
- 🎯 **Multi-Tab Context**: Aggregate information from multiple browser tabs

## Tech Stack

- **Frontend**: React 18 + TypeScript (strict mode)
- **Build**: Vite + CRXJS (Manifest V3)
- **Styling**: CSS modules + CSS variables + dark mode
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
4. **Configure AI providers**: Add your API keys in the extension settings (coming soon)

## Project Structure

```
browser-sidebar/
├── src/
│   ├── extension/     # Chrome extension infrastructure
│   │   └── background/   # Service worker, message handling
│   ├── tabext/        # Content script & extraction
│   │   ├── core/         # DOM manipulation, messaging
│   │   ├── extraction/   # Content extraction algorithms
│   │   └── utils/        # Helper utilities
│   ├── sidebar/       # React UI with Shadow DOM
│   │   ├── ChatPanel.tsx        # Main chat interface
│   │   ├── components/          # UI components
│   │   │   ├── MessageBubble.tsx    # Message display
│   │   │   ├── ThinkingWrapper.tsx  # Reasoning display
│   │   │   ├── ModelSelector.tsx    # AI model picker
│   │   │   └── ContentPreview.tsx   # Page content display
│   │   └── hooks/ai/            # AI chat hooks
│   ├── provider/      # AI provider implementations
│   │   ├── openai/    # OpenAI GPT-5 series
│   │   └── gemini/    # Google Gemini 2.5
│   ├── data/          # Data management layer
│   │   ├── store/     # Zustand state management
│   │   ├── storage/   # Chrome storage + encryption
│   │   └── security/  # AES-GCM encryption
│   ├── config/        # Model configurations
│   └── types/         # TypeScript definitions
├── tests/             # Comprehensive test suites
├── dist/              # Build output (load in browser)
└── docs/              # Documentation
```

## Documentation

- [Product Requirements (PRD)](./docs/PRD.md)
- [Claude Code Instructions](./CLAUDE.md)
- [Agent Guidelines](./AGENTS.md)
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
_Last Updated: 2025-08-27_
