# Repository Guidelines

## Project Structure & Module Organization

- `src/extension/`: Background/service worker and messaging.
- `src/tabext/`: In‑page content extraction (Defuddle engine, cleaning, markdown).
- `src/sidebar/`: React Shadow‑DOM UI (Chat panel, components, hooks).
- `src/provider/`: AI providers (OpenAI, Gemini) — BYOK keys.
- `src/data/`: Zustand stores, storage, security (AES‑GCM).
- `src/config/`: Centralized model configuration.
- `src/types/`: Shared TypeScript types.
- `tests/`: Unit, integration, and e2e suites (e.g., `tests/unit/tabext/*`).

## Build, Test, and Development Commands

- `npm run dev`: Start Vite dev server with hot reload.
- `npm run build`: Type check and production build (outputs `dist/`).
- `npm run watch`: Build and watch for extension reloads.
- `npm test`: Run all tests once.
- `npm run test:watch` / `npm run test:ui`: Watch mode / Vitest UI.
- `npm run lint` / `npm run format`: ESLint and Prettier.
- `npm run typecheck`: TypeScript `--noEmit` verification.

Load extension: `npm run build` → Chrome `chrome://extensions` → Load unpacked `dist/`.

## Coding Style & Naming Conventions

- TypeScript strict, React function components + hooks.
- Formatting: 2‑space indent, single quotes, semicolons (Prettier).
- Linting: ESLint with TypeScript/React plugins.
- File names: `PascalCase.tsx` (components), `camelCase.ts` (modules/hooks), CSS modules per component.
- Use path aliases (`@tabext`, `@components`, `@provider`, etc.).

## Testing Guidelines

- Frameworks: Vitest + React Testing Library, jsdom.
- Coverage target: >90% lines/branches for touched areas.
- Performance budgets (guidance): <50ms render, <100ms interactions.
- Locations: `tests/unit/*`, `tests/integration/*`, `tests/e2e/*`.
- Naming: `*.test.ts(x)` colocated under `tests/` mirrors `src/` structure.
- Examples: `npm test -- tests/unit/tabext/markdownConverter.basic.test.ts`.

## Commit & Pull Request Guidelines

- Conventional Commits: `type(scope): description` (e.g., `feat(tabext): add Defuddle gates`).
- PRs must include: clear description, rationale, and screenshots/logs when UX changes.
- Quality gates: `npm run typecheck`, `npm run lint`, and `npm test` must pass; update docs when behavior changes.
- Keep PRs small and focused; avoid unrelated refactors.

## Security & Configuration Tips

- BYOK: users supply API keys; never commit secrets. Use `.env` locally only.
- Keys are encrypted at rest (AES‑GCM) and stored via Chrome storage; no cloud sync.
- Minimal permissions in `manifest.json`; UI isolated via Shadow DOM.
