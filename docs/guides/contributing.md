# Contributing Guide

Thank you for your interest in contributing! This project aims to be clear, privacy‑first, and maintainable. Please read this guide to align with our standards.

## Project Expectations

- Keep PRs focused and small; align with acceptance criteria in `docs/stages/*`.
- Update docs when behavior or structure changes.
- Ensure lint, tests, and typecheck pass before opening a PR.

## Development Workflow

- Branch off `main`.
- Use Conventional Commits (recommended):
  - `feat(sidebar): add model selector`
  - `fix(content): handle toggle race`
  - `docs(architecture): clarify message sources`
- Run locally:
  - `npm run dev` — dev server
  - `npm run build` — typecheck + build
  - `npm test` / `npm run test:watch` — tests
  - `npm run lint` / `npm run format` / `npm run typecheck` — quality

## Code Style

- TypeScript (strict), React function components with hooks.
- 2‑space indentation, single quotes, semicolons; Prettier enforced.
- File names: `PascalCase.tsx` (components), `camelCase.ts` (utils/hooks).
- Use path aliases from `tsconfig.json` (e.g., `@/…`, `@sidebar/…`).

## Testing

- Framework: Vitest + React Testing Library (jsdom).
- Setup file: `tests/setup/setup.ts` (jest‑dom + Chrome API mocks).
- Name tests `*.test.ts(x)` under `tests/` mirroring structure (e2e/integration/sidebar/store).
- Prefer tests close to the code paths you change.

## Extension Build/Load

- After changes, run `npx vite build` to regenerate `dist/`.
- Load `dist/` as unpacked in `chrome://extensions` (Dev Mode).

## Security

- Never commit secrets. Copy `.env.example` → `.env` for local BYOK only.
- Limit permissions in `manifest.json`; verify via Chrome Activity Log.
- Update CSP if provider integrations require it.

## PR Checklist

- Lint passes: `npm run lint`
- Types pass: `npm run typecheck`
- Tests pass: `npm test`
- Docs updated (if needed)
- Screenshots/GIFs for UI changes

Thanks again for contributing!
