# AI Browser Sidebar

Chat with any webpage using AI — a privacy‑focused Chrome extension with Bring‑Your‑Own‑Key (BYOK) support.

## Quick Start

1. Requirements

- Node.js 18+ and npm
- Google Chrome (or Chromium‑based browser)

2. Install

- `npm install`

3. Develop

- `npm run dev` — start Vite dev server
- `npm run watch` — build in watch mode for extension reloads

4. Build & Load

- `npm run build` → open `chrome://extensions` → Enable Developer Mode → Load unpacked → select `dist/`.

## Scripts

- `npm run dev` — Vite dev server with HMR
- `npm run build` — Type check + production build to `dist/`
- `npm run watch` — Continuous build for extension reloads
- `npm test` / `npm run test:watch` / `npm run test:ui` — Vitest
- `npm run lint` / `npm run format` / `npm run typecheck`

## What It Does

- Extracts page content and lets you chat about it
- Streaming responses with model switching
- Works with OpenAI, Google Gemini, OpenRouter, and OpenAI‑compatible endpoints
- BYOK only — keys stay local and encrypted

## Project Structure (high level)

- `src/extension/` — Background/service worker and messaging
- `src/content/` — In‑page injection + extraction glue (pure logic in `src/core/extraction/*`)
- `src/sidebar/` — React Shadow‑DOM UI (chat panel, components, hooks)
- `src/core/engine/` — Engines/providers (OpenAI, Gemini, OpenRouter, OpenAI‑Compat)
- `src/data/` — Zustand stores, storage, security (AES‑GCM)
- `src/config/` — Centralized model configuration
- `src/types/` — Shared TypeScript types
- `tests/` — Unit, integration, e2e (Vitest + RTL)

More detailed module docs live in `src/README.md`.

## Configuration & Security

- BYOK: add API keys in the extension’s Settings UI. Do not commit secrets.
- Keys are encrypted at rest (AES‑GCM) and stored via Chrome storage; no cloud sync.
- Minimal permissions in `manifest.json`; UI is isolated via Shadow DOM.
- Optional `.env` is for local development only. Prefer an untracked `.env` and consider adding a `.env.example` for contributors.

## Testing

- `npm test` runs all tests once (Vitest + jsdom)
- Target >90% coverage for touched areas

## Contributing

- Conventional Commits: `type(scope): description` (e.g., `feat(content): add extractor`)
- PRs: include rationale and screenshots for UX changes
- Quality gates: `npm run typecheck`, `npm run lint`, and `npm test` must pass

## Path Aliases

- Import via aliases like `@content`, `@components`, `@core`, `@platform`, `@data`, etc. (see `tsconfig.json`).

## License

MIT — see `package.json`.
