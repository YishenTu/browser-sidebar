# Zustand Stores

Chat/session state lives in a set of small, focused stores. Only the session store holds data; the others delegate to the active session.

## Stores

```
useSessionStore  # sessions map + activeSessionKey + create/switch/clear
useMessageStore  # add/update/delete messages in the active session
useTabStore      # manage extracted tab content for the active session
useUIStore       # loading/error/activeMessageId for the active session
useSettingsStore # persistent user settings and API key refs
```

## Session keying

`createSessionKey(tabId, url)` → `tab_{id}:{normalizedUrl}` (query kept, hash dropped). See `@shared/utils/urlNormalizer`.

## Usage

```ts
import { useSessionStore, useMessageStore, useTabStore, useUIStore } from '@data/store/chat';

// Switch to the session for the current tab+URL
const sessionStore = useSessionStore.getState();
sessionStore.switchSession(tabId, url);

// Add a user message
const messageStore = useMessageStore.getState();
const msg = messageStore.addMessage({ role: 'user', content: 'Hello!' });

// Update UI while streaming
const uiStore = useUIStore.getState();
uiStore.setLoading(true);

// Save extracted content for the active session
const tabStore = useTabStore.getState();
tabStore.addLoadedTab(tabId, extractedContent);
```

## Settings

`useSettingsStore` persists to Chrome storage and gates available models by saved API keys and OpenAI‑Compat providers. See `data/store/settings.ts` for details.

## Notes

- Stores are plain Zustand without persistence (except settings). Keep operations minimal and synchronous where possible.
- Prefer selectors when subscribing in React components to avoid unnecessary re‑renders.
