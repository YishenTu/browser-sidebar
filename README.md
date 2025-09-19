# AI Browser Sidebar

Privacy-focused, Bring-Your-Own-Key Chrome sidebar that lets you chat with any web page, capture context (text, tables, screenshots), and switch between modern AI providers on the fly.

## Quick Start

1. **Requirements**
   - Node.js 18+ and npm
   - Google Chrome (or another Chromium-based browser)
2. **Install**
   - `npm install`
3. **Develop**
   - `npm run dev` — start the Vite dev server
   - `npm run watch` — build in watch mode for extension reloads
4. **Build & Load**
   - `npm run build`
   - Open `chrome://extensions` → enable Developer Mode → Load unpacked → choose the `dist/` folder

## Highlights · September 19, 2025

- **Domain-aware extraction rules** — Readability is the default; Raw, Defuddle, and Selection can be pinned per-domain from Settings.
- **OpenAI-compatible vault** — Manage DeepSeek, Qwen, Zhipu, Kimi, or fully custom endpoints (base URL + key + default model) alongside the built-ins.
- **Context capture upgrades** — Screenshot hotkey (configurable), multi-tab extraction via @-mentions, and inline content previews.
- **Faster model switching** — Engine Manager automatically boots providers from saved keys, tracks health, and exposes capability flags (reasoning/thinking) to the UI.
- **Refined slash commands** — `/summarize`, `/explain`, `/analyze`, `/comment`, `/fact-check`, `/rephrase`, each with optional per-command model overrides.

## Key Features

- Rich page understanding with Readability-first extraction, Raw/Defuddle fallbacks, Selection capture, and site-specific plugins.
- Multi-tab workflows: pull content from other tabs on demand, keep caches per session, and compare sources side-by-side.
- Provider flexibility: OpenAI, Google Gemini, OpenRouter, and OpenAI-compatible endpoints — all BYOK.
- Screenshot capture & upload pipeline for quick visual context (stored locally, never uploaded automatically).
- Shadow-DOM React UI with streaming responses, cancel-in-flight, reasoning indicators, and markdown/code rendering.

## Project Structure (high level)

- `src/extension/` — MV3 service worker, keep-alive, messaging, tab + cache orchestration
- `src/content/` — Content script injection, extraction orchestrator, domain rules, selection capture
- `src/sidebar/` — React Shadow-DOM UI, hooks, contexts, screenshot + settings components
- `src/core/` — Provider helpers, engines, extraction utilities, shared services (message editing, screenshots, model switching)
- `src/services/` — Facades for chat streaming, engine lifecycle, extraction, key/session helpers
- `src/data/` — Zustand stores, Chrome storage wrappers, key vault modules, AES-GCM utilities
- `src/config/` — Model catalog, compat presets, system prompts, slash command definitions
- `src/platform/` — Typed Chrome API wrappers (runtime, tabs, storage, ports, scripting)
- `src/transport/` — Direct/background transports with proxy policy and streaming helpers
- `src/types/` — Shared TypeScript shapes (messages, extraction, providers, settings, storage)
- `src/shared/` — Cross-cutting utilities (restricted URL checks, URL normalization)
- `tests/` — Vitest unit/integration suites mirrored to `src/`

## Settings & Personalization

- Manage OpenAI, Gemini, and OpenRouter API keys (validated before saving).
- Maintain a catalog of OpenAI-compatible providers (built-in presets plus custom entries).
- Configure domain-specific default extraction modes.
- Toggle debug features, compact layout, and fine-tune the screenshot hotkey.
- Per-session chat history is isolated by tab + normalized URL; clearing a session is instant.

## Configuration & Security

- BYOK only — secrets are never bundled. Provide keys through the Settings UI.
- The new `@data/storage/keys` vault encrypts secrets with AES-GCM and keeps hashes for duplicate detection. Chrome storage (`sync` with automatic fallback to `local`) stores encrypted payloads and metadata.
- Compat provider records (ID/base URL/default model) live in `chrome.storage.local`; API keys stay in the encrypted vault.
- Shadow DOM + minimal permissions (`activeTab`, `storage`) keep the surface area small.

## Testing

- `npm test` — run all Vitest suites once
- `npm run test:watch` — watch mode
- `npm run test:ui` — Vitest UI runner

Aim for >90% coverage on touched areas.

## Contributing

- Conventional commits (`feat(content): ...`, `fix(sidebar): ...`)
- Include rationale and screenshots/gifs for UI changes
- CI gate: `npm run typecheck`, `npm run lint`, and `npm test`

## Path Aliases

Common aliases: `@content`, `@core`, `@services`, `@sidebar`, `@store`, `@transport`, `@platform`, `@config`, `@shared`, etc. See `tsconfig.json` for the full list.

## License

MIT — see `package.json`.
