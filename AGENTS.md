# Repository Guidelines

## Project Structure & Module Organization

- `src/`: Extension source
  - `background/` (service worker), `content/` (content script)
  - `sidebar/` (UI entry: `index.tsx`, `Sidebar.tsx`, styles)
  - Optional: `components/`, `providers/`, `storage/`, `utils/`, `hooks/`, `types/`
- `public/icons/`: Extension icons (`icon16/32/48/128.png`)
- `tests/`: Vitest + RTL (`setup/`, `unit/`, `integration/`, `e2e/`)
- `docs/`: Planning, stages, and architecture

## Build, Test, and Development Commands

- `npm run dev`: Start Vite + CRXJS in dev mode
- `npm run build`: Type-check then build to `dist/`
- `npm run watch`: Build continuously on change
- `npm run preview`: Serve built assets locally
- `npm test` (once) | `npm run test:watch` (watch) | `npm run test:ui` | `npm run test:coverage`: Run tests
- `npm run lint` | `npm run format` | `npm run typecheck`: Quality checks
- Load in Chrome: `chrome://extensions` → Developer mode → Load unpacked → select `dist/`

## Coding Style & Naming Conventions

- TypeScript (strict), React function components with hooks
- 2-space indentation, single quotes, semicolons; Prettier enforced
- File names: `PascalCase.tsx` (components), `camelCase.ts` (utils/hooks)
- Use path aliases from `tsconfig.json` (e.g., `@/…`, `@components/…`)

## Testing Guidelines

- Frameworks: Vitest + React Testing Library (jsdom)
- Setup: `tests/setup/setup.ts` (jest-dom, Chrome API mocks)
- Naming: `*.test.ts` / `*.test.tsx` under `tests/`
- Run: `npm test` (once), `npm run test:watch` (watch), or `npm run test:coverage`

## Commit & Pull Request Guidelines

- Conventional Commits recommended
  - Example: `feat(sidebar): enable drag-to-resize`
- PRs: clear description, linked issues, UI screenshots/GIFs when relevant
- Required: lint, tests, and typecheck pass; update docs if needed
- Keep PRs focused and small; align with acceptance criteria in `docs/stages/*`

## Security & Configuration Tips

- Never commit secrets. Copy `.env.example` → `.env` (BYOK only)
- Limit permissions in `manifest.json`; verify via Chrome Activity Log
- Update `content_security_policy` if provider integrations require it
