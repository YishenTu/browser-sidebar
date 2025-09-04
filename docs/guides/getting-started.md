# Getting Started Guide

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18.0 or higher
- **npm** or **yarn** package manager
- **Git** for version control
- **Chromium-based browser** (Chrome, Arc, Edge, Brave, etc.) for testing

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/browser-sidebar.git
cd browser-sidebar
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

```bash
cp .env.example .env
# Edit .env with your API keys (optional for development)
```

### 4. Start Development Server

```bash
npm run dev
```

### 5. Load Extension in Your Browser

#### Chrome/Edge:

1. Navigate to `chrome://extensions/` (or `edge://extensions/`)
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `dist` folder from your project

#### Arc:

1. Navigate to `arc://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist` folder from your project

## Development Workflow

### Available Scripts

```bash
# Development
npm run dev          # Start dev server with hot reload
npm run build        # Build for production
npm run watch        # Build and watch for changes

# Testing
npm run test          # Run tests once (Vitest)
npm run test:watch    # Watch mode (TDD)
npm run test:ui       # Run tests with UI
npm run test:coverage # Generate coverage report

# Code Quality
npm run lint         # Run ESLint
npm run format       # Format code with Prettier
npm run typecheck    # Run TypeScript compiler checks
```

### Project Structure

```
browser-sidebar/
├── src/
│   ├── backend/         # Service worker: routing, tab state
│   ├── content/         # Content script: sidebar injection + tab content capture
│   ├── sidebar/         # Main sidebar application (React)
│   │   ├── components/  # Reusable UI components (MessageList, Markdown, ModelSelector, UI)
│   │   ├── hooks/       # Custom React hooks
│   │   ├── styles/      # Unified sidebar styles
│   │   ├── ChatPanel.tsx# Unified chat panel (overlay, resize/drag)
│   │   └── index.tsx    # Shadow DOM mounting logic
│   ├── provider/        # AI provider integrations (Stage 4)
│   ├── storage/         # Data persistence layer (Stage 3)
│   ├── services/        # Business logic services (Stage 5)
│   ├── types/           # TypeScript definitions
│   └── utils/           # Utility functions
├── tests/               # Test files
├── public/              # Static assets
│   └── icons/           # Extension icons
└── docs/                # Documentation
```

## Stage-by-Stage Development

### Stage 1: Extension Infrastructure ✅ (Completed)

Foundation implemented:

1. Basic extension structure with manifest v3
2. Custom sidebar implementation (resizable, movable)
3. Message passing between background and content scripts
4. Testing framework configured with Vitest

### Stage 2: Chat UI

Build the user interface:

1. Create React components
2. Implement chat interface
3. Add theme support
4. Set up state management

### Stage 3: Storage & Security

Implement secure storage:

1. Set up Chrome storage
2. Implement encryption
3. Create settings management
4. Add data persistence

### Stage 4: AI Providers

Integrate AI services:

1. Implement provider abstraction
2. Add OpenAI support
3. Add Gemini support
4. Add Anthropic support

### Stage 5: Content Extraction

Complete the feature set:

1. Create content scripts
2. Implement extraction logic
3. Add multi-tab support
4. Final integration

## Common Development Tasks

### Adding a New Component

```bash
# Create component file (example)
touch src/sidebar/components/MyComponent.tsx

# Create test file mirroring structure
touch tests/sidebar/components/MyComponent.test.tsx

# Import and use in your code
```

### Testing Your Changes

```bash
# Run specific test file
npm test -- tests/sidebar/components/MyComponent.test.tsx --run

# Run tests in watch mode
npm run test -- --watch

# Debug tests
npm run test:ui
```

### Building for Production

```bash
# Create production build
npm run build

# Output will be in dist/ folder
# Load this folder in Chrome for testing
```

## Debugging

### Extension Icon & Sidebar

1. Click extension icon to toggle sidebar
2. Open DevTools (F12) on the webpage to see sidebar logs
3. Check Console for any errors

### Background Service Worker

1. Go to `chrome://extensions/`
2. Find your extension
3. Click "Inspect views: service worker"

### Content Scripts

1. Open any webpage
2. Open DevTools (F12)
3. Check Console for content script logs

## Troubleshooting

### Extension Not Loading

- Check `manifest.json` for syntax errors
- Ensure all referenced files exist
- Check Chrome console for errors

### Build Errors

```bash
# Clear cache and rebuild
rm -rf node_modules dist
npm install
npm run build
```

### Hot Reload Not Working

- Ensure Vite server is running
- Check that CRXJS plugin is configured
- Manually reload extension if needed

### TypeScript Errors

```bash
# Check for type errors
npm run typecheck

# Update TypeScript definitions
npm install -D @types/chrome@latest
```

## Best Practices

### Code Style

- Follow TypeScript strict mode
- Use functional React components
- Implement proper error boundaries
- Write tests for new features

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/your-feature

# Make changes and commit
git add .
git commit -m "feat: add new feature"

# Push and create PR
git push origin feature/your-feature
```

### Performance Tips

- Lazy load heavy components
- Use React.memo for expensive renders
- Implement virtual scrolling for lists
- Cache API responses appropriately

## Getting Help

### Resources

- [Chrome Extension Documentation](https://developer.chrome.com/docs/extensions/mv3/)
- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)

### Project Documentation

- [Product Requirements](../planning/PRD.md)
- [Development Plan](../planning/development-plan.md)
- [Architecture Guide](../architecture/system-architecture.md)
- [API Design](../architecture/api-design.md)

### Community

- Create an issue on GitHub
- Check existing issues for solutions
- Join our Discord server (coming soon)

---

_Getting Started Guide Version: 1.1_  
_Last Updated: 2025-08-20_
