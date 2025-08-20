# AI Browser Sidebar Extension

A privacy-focused browser extension that enables users to interact with web content through AI-powered chat using their own API keys (BYOK - Bring Your Own Key).

## Features

- 🔒 **Privacy-First**: All data stays local, no cloud storage
- 🤖 **Multi-Provider Support**: OpenAI, Google Gemini, Anthropic
- 📑 **Smart Content Extraction**: Extract content from any webpage
- 🎯 **Multi-Tab Context**: Aggregate information from multiple tabs
- 💬 **Streaming Responses**: Real-time AI responses
- 🎨 **Customizable UI**: Resizable & movable sidebar, light/dark themes
- 🌐 **Universal Compatibility**: Works in Chrome, Arc, Edge, and other Chromium browsers

## Tech Stack

- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Build**: Vite + CRXJS
- **State**: Zustand
- **Testing**: Vitest + React Testing Library
- **AI SDKs**: OpenAI, Gemini, Anthropic

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
```

### Testing

```bash
# Run unit tests
npm run test

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
│   ├── background/    # Service worker for extension logic
│   ├── content/       # Content script for page injection
│   ├── sidebar/       # Main sidebar application (React)
│   │   ├── components/  # Reusable UI components
│   │   ├── hooks/       # Custom React hooks
│   │   └── styles/      # CSS modules and styles
│   ├── providers/     # AI provider integrations (Stage 4)
│   ├── storage/       # Data persistence layer (Stage 3)
│   ├── services/      # Business logic services (Stage 5)
│   ├── types/         # TypeScript definitions
│   └── utils/         # Utility functions
├── tests/             # Test files
├── public/            # Static assets (icons)
├── dist/              # Build output
└── docs/              # Documentation
```

## Documentation

- [Product Requirements (PRD)](./docs/planning/PRD.md)
- [Development Plan](./docs/planning/development-plan.md)
- [Task Breakdown](./docs/planning/task-overview.md)
- Stage-specific tasks in `docs/stages/task-stage-*.md`

## Contributing

Please read our contributing guidelines before submitting PRs.

## License

[License Type] - See LICENSE file for details

## Status

🚧 **In Development** - Following staged development plan

### Current Stage: Stage 1 - Extension Infrastructure

- [x] Project setup
- [x] Chrome extension manifest
- [x] Custom sidebar implementation (resizable, movable)
- [x] Message passing system
- [x] Testing infrastructure
- [ ] AI provider integration (next stage)

---

_Version: 0.1.0-dev_  
_Last Updated: 2025-08-20_
