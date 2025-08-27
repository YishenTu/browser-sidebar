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
- 📑 **Planned: Smart Content Extraction**: Extract/format page content (Stage 5)
- 🎯 **Planned: Multi-Tab Context**: Aggregate information from multiple tabs (Stage 5)

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
│   ├── tabext/        # Content script for sidebar injection
│   ├── sidebar/       # React UI with Shadow DOM
│   │   ├── ChatPanel.tsx        # Main chat interface
│   │   ├── components/          # UI components
│   │   │   ├── MessageBubble.tsx    # Message display
│   │   │   ├── ThinkingWrapper.tsx  # Reasoning display
│   │   │   └── ModelSelector.tsx    # AI model picker
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

- [Product Requirements (PRD)](./docs/planning/PRD.md)
- [Development Plan](./docs/planning/development-plan.md)
- [Task Breakdown](./docs/planning/task-overview.md)
- Stage guides: `docs/stages/task-stage-*.md` — Stage 2 now includes the merged Refactoring Blueprint from `task.md` (file removed)

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

### 🚧 In Progress

- **Stage 5**: Content Extraction - Tab content capture and multi-tab aggregation

### Future Work

#### Chat Context Management

- **Include thinking/reasoning in chat history**: Currently, thinking content from AI responses is stored in metadata but not included when building subsequent API requests. This causes the AI to lose context of its previous reasoning in multi-turn conversations.
  - Implementation approach: When building API requests, prepend thinking content to assistant messages using format: `<thinking>content</thinking>\n\nactual response`
  - Affected files: `OpenAIProvider.convertMessagesToResponsesInput()`, `GeminiProvider.convertMessages()`
  - Add user setting: "Include reasoning in chat history" toggle
  - Considerations: Increased token usage, potential need for thinking summarization for long content

#### Phase 3 Storage & Security

- Phase 3.2 hardening (API Key Storage):
  - Align remaining test expectations with updated storage behavior:
    - Use singleton EncryptionService instance in tests (already applied in main/comprehensive suites)
    - Duplicate detection via `api_key_hash_<sha256>` mapping in Chrome storage
    - Connection tests should not assert real wall-clock delays (mock small timeout in fetch)
    - Prefer integrity check over decryption in `getAPIKey` tests
  - Optional: unify add-failure messages to a single "Failed to add API key" if preferred over specific errors
- Phase 3.3 parallelizable tasks to start now:
  - 3.3.1a Conversation Types
  - 3.3.2 Cache Implementation
  - 3.3.4a/b Sensitive Pattern Detection + Data Masking
- Defer until 3.2 fully green:
  - 3.3.1b Conversation Storage
  - 3.3.3 Data Cleanup

---

_Version: 0.4.0-dev_
_Last Updated: 2025-08-26_
