# AI Browser Sidebar Project Context

## Project Overview

**AI Browser Sidebar** is a privacy-focused, Bring-Your-Own-Key (BYOK) Chrome extension that allows users to chat with any web page. It injects a sidebar into the browser tab, utilizing Shadow DOM to avoid style conflicts. It supports multiple AI providers including Google Gemini, OpenAI, xAI (Grok), and OpenRouter.

**Key Features:**

- **BYOK:** Users provide their own API keys, stored securely locally (AES-GCM encrypted).
- **Content Extraction:** Intelligently extracts page content using Readability, Defuddle, or raw text fallback. Supports specific domain rules.
- **Multi-Model Support:** Switch between Gemini, GPT-4, Claude (via OpenRouter), and Grok on the fly.
- **Context Awareness:** Can capture text, tables, screenshots, and even content from other open tabs.
- **Tech Stack:** React 18, Vite, TypeScript, Zustand, Vitest.

## Architecture

The project is structured as a Monorepo-style extension codebase:

- **`src/extension/`**: The Extension Service Worker (Background script). Handles life-cycle, cross-tab messaging, and persistence.
- **`src/content/`**: Content scripts injected into web pages. Handles DOM manipulation, text extraction, and the Shadow DOM container for the sidebar.
- **`src/sidebar/`**: The React application that runs inside the Shadow DOM. Contains the chat UI, settings, and prompt management.
- **`src/core/`**: Core logic including AI engine wrappers (`engine/`), extraction algorithms (`extraction/`), and shared services.
- **`src/data/`**: Data layer using Zustand for state management and Chrome Storage for persistence. Handles encryption.
- **`src/transport/`**: Abstraction for communication between the Content Script, Sidebar (UI), and Background script.

## Development Workflow

### Build & Run

- **Install Dependencies:** `npm install`
- **Dev Server:** `npm run dev` (Starts Vite server)
- **Watch Mode:** `npm run watch` (Builds and watches for changes for extension reloading)
- **Production Build:** `npm run build` (Outputs to `dist/`)

### Loading the Extension

1.  Run `npm run build`.
2.  Open Chrome and navigate to `chrome://extensions`.
3.  Enable "Developer mode".
4.  Click "Load unpacked" and select the `dist/` directory.

### Testing

- **Run All Tests:** `npm test` (Vitest)
- **Watch Mode:** `npm run test:watch`
- **UI Mode:** `npm run test:ui`
- **Type Check:** `npm run typecheck`

## Coding Conventions

- **Style:** Adheres to strict TypeScript rules. Formatting is handled by Prettier and linting by ESLint.
- **Path Aliases:** Extensive use of aliases (e.g., `@core`, `@sidebar`, `@content`). Check `tsconfig.json` for mapping.
- **Components:** React Functional Components with Hooks.
- **State:** Zustand for global state; Local state for component-specific logic.
- **Commits:** Follow Conventional Commits (e.g., `feat(sidebar): add screenshot button`, `fix(content): improve extraction`).
- **Testing:** High coverage requirement (>90%). Tests are co-located in `tests/` mirroring the `src/` structure.

## Important Files

- `manifest.json`: Extension configuration (permissions, host permissions, scripts).
- `src/config/models.ts`: Definitions of supported AI models and their capabilities.
- `src/core/engine/EngineFactory.ts`: Factory pattern for instantiating AI providers.
- `AGENTS.md`: Detailed guidelines for AI agents working on this codebase.
- `CLAUDE.md`: Similar to AGENTS.md, likely containing specific instructions for Claude.

## Current State (Nov 2025)

- **Recent Updates:** Added Gemini 3 Pro support, xAI Grok integration, and improved "Thinking" model support.
- **Focus:** Stability, performance, and expanding the "Vault" for OpenAI-compatible providers.
