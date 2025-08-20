# AI Browser Sidebar Extension

A privacy-focused browser extension that enables users to interact with web content through AI-powered chat using their own API keys (BYOK - Bring Your Own Key).

## Features

- 🔒 **Privacy-First**: All data stays local, no cloud storage
- 🤖 **Multi-Provider Support**: OpenAI, Google Gemini, Anthropic
- 📑 **Smart Content Extraction**: Extract content from any webpage
- 🎯 **Multi-Tab Context**: Aggregate information from multiple tabs
- 💬 **Streaming Responses**: Real-time AI responses
- 🎨 **Customizable UI**: Light/dark themes, adjustable settings

## Tech Stack

- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Build**: Vite + CRXJS
- **State**: Zustand
- **Testing**: Vitest + React Testing Library
- **AI SDKs**: OpenAI, Gemini, Anthropic

## Development

### Prerequisites

- Node.js 18+
- Chrome browser
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

## Project Structure

```
browser-sidebar/
├── src/               # Source code
├── tests/             # Test files
├── public/            # Static assets
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

- [ ] Project setup
- [ ] Chrome extension manifest
- [ ] Message passing system
- [ ] Testing infrastructure

---

_Version: 0.1.0-dev_  
_Last Updated: 2025-08-19_
