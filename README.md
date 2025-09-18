# AI Browser Sidebar

Chat with any webpage using AI — a privacy-focused Chrome extension that keeps your API keys local (Bring Your Own Key).

## Overview

The sidebar injects a React UI into any tab, extracts page context on demand, and streams responses from the AI provider you configure. It understands structured web pages via a readability-first pipeline, falls back to raw HTML or Defuddle OCR when needed, and supports slash commands for common tasks like summarizing, fact-checking, or rephrasing content.

## Key Features

- **Multi-provider support with BYOK**: Works with OpenAI GPT-5, Google Gemini 2.5, OpenRouter, and OpenAI-compatible presets (DeepSeek, Qwen, Zhipu, Kimi/Moonshot). Model capabilities such as reasoning effort or Gemini "thinking" budgets are configured centrally so the UI can expose the right toggles per provider.
- **Context-aware extraction**: Readability mode is the default, but users can re-run extraction in Raw, Defuddle, or Selection modes. Domain heuristics and user preferences influence the default mode, and content is cached per tab to keep switching fast.
- **Research-grade chat surface**: Streaming responses include cancel, regenerate, and edit controls, copy buttons for both user and assistant messages, KaTeX math rendering, auto-scroll with a virtualized transcript, and a reasoning/thinking panel when providers send it.
- **Search and citations**: Providers that surface real-time web search expose sources directly in the transcript so users can inspect titles, URLs, and snippets alongside the answer.
- **Productivity tooling**: Slash commands choose intent-specific prompts and providers, multi-tab extraction keeps results from any open page accessible, and selection capture lets users ask about specific highlights without reloading a whole page.
- **Security & privacy**: API keys never leave the browser; they are encrypted with AES-GCM in Chrome storage, with masking utilities to prevent accidental leakage. The extension requests the minimum MV3 permissions required for runtime messaging, storage, and clipboard integration.

## Quick Start

1. **Requirements**
   - Node.js 18+
   - npm 9+
   - Chromium-based browser (Chrome, Edge, Arc, Brave, etc.)

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Run in development**

   ```bash
   npm run dev      # Vite dev server with HMR
   npm run watch    # Rebuild on change for extension reloads
   ```

4. **Build & load the extension**

   ```bash
   npm run build
   ```

   Then open `chrome://extensions`, enable **Developer Mode**, click **Load unpacked**, and choose the generated `dist/` folder.

## Recommended Workflow

- `npm run lint` and `npm run format:check` before committing to keep the codebase consistent.
- `npm run typecheck` to validate the TypeScript surface.
- `npm test`, `npm run test:watch`, or `npm run test:ui` to exercise the Vitest suites (unit, integration, UI harness).
- `npm run test:coverage` for coverage metrics and `npm run test:openai` for manual contract checks against OpenAI's Responses API (requires BYOK credentials).

## Scripts

- `npm run dev` — Start the Vite dev server for rapid UI iteration.
- `npm run build` — Type-check and output the production bundle to `dist/`.
- `npm run watch` — Continuous build for hot extension reloads.
- `npm run preview` — Serve the built extension bundle locally.
- `npm run lint` / `npm run format` / `npm run format:check` — ESLint and Prettier helpers.
- `npm run typecheck` — TypeScript `--noEmit` verification.
- `npm test` / `npm run test:watch` / `npm run test:ui` / `npm run test:coverage` — Vitest runners.
- `npm run test:openai` — Smoke-test against OpenAI (requires a valid key and model access).

## Project Structure (high level)

- `src/extension/` — MV3 service worker: tab + sidebar lifecycle, extraction queue, content cache, messaging.
- `src/content/` — Injection bootstrap and extraction orchestrator (Readability, Raw, Defuddle, Selection).
- `src/sidebar/` — React Shadow-DOM UI, components, hooks, accessibility, and styling.
- `src/services/` — Higher-level facades for chat, extraction, engine management, sessions, and key handling.
- `src/core/` — Provider engines, request builders, stream processors, Markdown conversion.
- `src/data/` — Zustand stores, Chrome storage adapters, AES-GCM utilities, masking helpers.
- `src/config/` — Model catalog, slash commands, system prompts, OpenAI-compatible presets.
- `src/platform/` — Typed wrappers for Chrome runtime/tabs/storage/messaging APIs.
- `src/transport/` — Direct and background-proxied fetch transports.
- `src/types/` — Shared TypeScript types for messages, extraction, providers, sessions.
- `tests/` — Unit, integration, and e2e scaffolding mirroring the `src/` tree.

See [`src/README.md`](src/README.md) for module-level details and entry points.

## Extraction Modes & Tab Workflow

- The orchestrator uses Readability by default and lets users re-run extraction per tab in other modes; domain-specific defaults can be configured and cached.
- Extracted content (including selections or OCR output) is stored in per-tab stores so the sidebar can switch between tabs without recomputing work.
- Background caching holds recent extractions for quick reloads, with configurable TTLs and cleanup hooks.

## Provider Integrations

- Default models span OpenAI GPT-5, Gemini 2.5, OpenRouter-hosted Anthropic/OpenAI/DeepSeek models, and multiple OpenAI-compatible presets (DeepSeek, Qwen, Zhipu, Kimi/Moonshot).
- Reasoning parameters, thinking budgets, and provider-specific toggles flow from central config into the UI and engine layer.
- OpenAI and OpenRouter providers stream reasoning/thinking deltas and surface response IDs so the UI can anchor follow-up questions to the original response.
- Web search metadata is normalized into transcript chunks so citations render consistently regardless of provider.

## UI Highlights

- Virtualized message list with auto-scroll keeps long sessions responsive.
- Cancel streaming, regenerate a response, or edit and resend previous user prompts without leaving the thread.
- Copy any message with one click, inspect extracted tab content, and view web search sources inline.
- KaTeX and syntax highlighting ship with the Markdown renderer for math and code-heavy pages.

## Security & Privacy

- Keys are stored only in Chrome's extension storage, encrypted with AES-GCM and masked in logs/UI.
- Messaging uses a minimal MV3 permission set (`storage`, `tabs`, `activeTab`, `scripting`, `clipboardRead`).
- No keys or chat transcripts are transmitted to any server beyond the provider endpoints you configure.

## Testing

- Run `npm test` for the full Vitest suite. Use `npm run test:watch` or `npm run test:ui` for iterative development, and `npm run test:coverage` to validate coverage targets.
- Test files mirror the `src/` layout under `tests/` to make locating coverage gaps straightforward.

## Contributing

- Follow Conventional Commits (`type(scope): description`).
- Include rationale and screenshots/logs for UX changes in pull requests.
- Ensure `npm run typecheck`, `npm run lint`, and `npm test` pass before submitting.

## License

MIT — see `package.json` for details.
