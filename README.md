# AI Browser Sidebar Extension

A privacy‑focused browser extension for AI‑powered chat with web content using your own API keys (BYOK). The sidebar is a Shadow DOM overlay that’s resizable, draggable, and works across Chromium browsers.

## Features

- 🔒 **Privacy-First**: All data stays local, no cloud storage
- 💬 **Streaming UI**: Smooth streaming display in the chat UI (mock-based today)
- 🎨 **Customizable UI**: Resizable & movable sidebar, light/dark themes
- 🌐 **Universal Compatibility**: Works in Chrome, Arc, Edge, and other Chromium browsers
- 🧩 **Planned: Multi-Provider (BYOK)**: OpenAI, Google Gemini, Anthropic (Stage 4)
- 📑 **Planned: Smart Content Extraction**: Extract/format page content (Stage 5)
- 🎯 **Planned: Multi-Tab Context**: Aggregate information from multiple tabs (Stage 5)

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **Build**: Vite + CRXJS
- **Styling**: CSS + Tailwind tokens + dark mode
- **State**: Zustand stores (`@store/*`) for chat/settings
- **Testing**: Vitest + React Testing Library
- **Virtualization**: react-window
- **Markdown**: react-markdown + remark-gfm + rehype-highlight

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
│   ├── backend/       # Service worker, routing, tab state
│   ├── tabext/        # Content script: sidebar injection + tab content capture
│   ├── sidebar/       # Sidebar React app (unified ChatPanel, components, hooks, styles, contexts)
│   ├── core/          # Messaging and shared infra
│   ├── provider/      # Provider clients & BYOK (Stage 4)
│   ├── storage/       # Secure storage & encryption (Stage 3)
│   ├── services/      # Extraction/aggregation services (Stage 5)
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
- Stage guides: `docs/stages/task-stage-*.md` — Stage 2 now includes the merged Refactoring Blueprint from `task.md` (file removed)

## Contributing

Please read our contributing guidelines before submitting PRs.

## License

MIT — see `package.json` for the license field (LICENSE file TBD)

## Status

✅ **Stage 2 complete** — Unified sidebar UI, Shadow DOM overlay preserved, model selector integrated, tests passing. AI provider integration and extraction are planned next.

### Current Focus

- Stage 3: Storage & Security (planned)
- Stage 4: AI Provider System (planned)

---

_Version: 0.1.0-dev_
_Last Updated: 2025-08-21_
