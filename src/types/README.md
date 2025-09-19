# Types Module

Shared TypeScript definitions used across the extension. Types are grouped by feature area so UI, content, services, and background code can share a common contract.

## Directory Snapshot

```
types/
├─ apiKeys.ts        # API key vault + compat provider shapes
├─ chat.ts           # Chat message, stream chunk, attachment types
├─ conversation.ts   # Session + history models
├─ extraction.ts     # ExtractedContent, ExtractionMode, validators
├─ messages.ts       # MessageType unions, payload contracts, factories
├─ providers.ts      # Engine/provider configs, capability flags, errors
├─ settings.ts       # Persisted settings (UI, AI, privacy, domain rules, hotkeys)
├─ storage.ts        # Chrome storage schemas, migration helpers
├─ tabs.ts           # Tab info/state shared across background & sidebar
├─ manifest.ts       # Manifest v3 helpers
├─ index.ts          # Barrel exports
└─ *.d.ts            # CSS/Prism/Katex module declarations
```

## Messaging

`messages.ts` defines the canonical `MessageType` union and payloads for all inter-process communication. Examples:

- `TOGGLE_SIDEBAR`, `CLOSE_SIDEBAR`
- `CONTENT_READY`, `SIDEBAR_STATE`
- `GET_TAB_ID`, `GET_TAB_INFO`, `GET_ALL_TABS`
- `EXTRACT_TAB_CONTENT` ↔ `CONTENT_EXTRACTED`
- `CLEANUP_TAB_CACHE`, `PROXY_REQUEST`
- `PING`/`PONG`, `ERROR`

`createMessage` enforces typed payloads for every message we send.

## Extraction

`extraction.ts` exposes:

- `ExtractionMode` enum (`readability`, `raw`, `defuddle`, `selection`)
- `ExtractionOptions` + validators (`validateExtractionOptions`)
- `ExtractedContent` with metadata (method, excerpts, table/code flags, timestamps)
- `ExtractionErrorType` for consistent error handling between services/sidebar

## Providers

`providers.ts` defines provider configs, capability flags (`supportsReasoning`, `supportsThinking`, `supportsVision`), normalized request/response shapes, and error contracts consumed by `EngineManagerService` and UI badges.

## API Keys

`apiKeys.ts` contains the vault types:

- `APIProvider`, `CompatProvider`
- `EncryptedAPIKey`, `APIKeyMetadata`, `APIKeyUsageStats`
- `APIKeyConfiguration` (endpoint + security config)
- Utility helpers (`maskAPIKey`, `generateKeyId`)

Compat provider inputs (`compat-${id}`) are shared with `@data/storage/keys/compat` for custom endpoints.

## Settings

`settings.ts` models:

- UI preferences (font size, compact mode, debug mode, screenshot hotkey)
- AI defaults (selected model, stream toggles)
- Privacy options
- API key references (BYOK keys saved from the UI)
- Extraction preferences (`domainRules` controlling default mode per host)
- Helper types for store actions (`SettingsState`, `APIKeyReferences`, `DomainExtractionRuleSetting`)

## Tabs & Conversations

- `tabs.ts` — `TabInfo`, `TabContent`, and helper builders shared by background/service/UI code.
- `conversation.ts` — Chat history, message metadata, editing helpers.

## Storage

`storage.ts` defines strongly typed Chrome storage keys, schema versions, and migration helpers leveraged by stores and the key vault.

## Usage

Import types via aliases:

```ts
import type { ExtractionMode, ExtractedContent } from '@types/extraction';
import type { Message, MessageType } from '@types/messages';
import type { Settings, DomainExtractionRuleSetting } from '@types/settings';
import type { APIProvider, EncryptedAPIKey } from '@types/apiKeys';
```

Keep new types colocated with feature modules and re-export them through `types/index.ts` so consumers can rely on the alias.
