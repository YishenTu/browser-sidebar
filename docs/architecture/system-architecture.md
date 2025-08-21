# System Architecture

## Overview

The AI Browser Sidebar Extension follows a modular Chrome Extension Manifest V3 architecture with clear separation of concerns.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│              Custom Sidebar (React)                  │
│  ┌────────────────────────────────────────────┐    │
│  │           Main Sidebar Container           │    │
│  │  - Resizable & Movable UI                  │    │
│  │  - Chat Interface                          │    │
│  │  - Settings Panel                          │    │
│  └──────────────────┬─────────────────────────┘    │
└────────────────────┼───────────────────────────────┘
                     │
          ┌──────────▼──────────┐
          │   Content Script     │
          │  - Sidebar Injection │
          │  - Event Bridge      │
          └──────────┬──────────┘
                     │
          ┌──────────▼──────────┐
          │  Background Service  │
          │     (Worker)         │
          │  - Message Router    │
          │  - State Manager     │
          │  - Tab Tracking      │
          └──────────┬──────────┘
                     │
       ┌─────────────┼─────────────┐
       │             │             │
┌──────▼──────┐ ┌───▼────┐ ┌──────▼──────┐
│   Content    │ │Storage │ │ AI Provider │
│  Extraction  │ │ Layer  │ │   System    │
│              │ │        │ │             │
│ - Extractor  │ │- Chrome│ │ - OpenAI    │
│ - Monitor    │ │- Index │ │ - Gemini    │
│ - Selection  │ │  DB    │ │ - Anthropic │
└──────────────┘ └────────┘ └─────────────┘
```

## Core Components

### 1. User Interface Layer (Sidebar)

- **Custom Sidebar**: Injected floating panel (resizable/movable)
- **React Components**: Modular UI components in `/sidebar/components`
- **Custom Hooks**: Reusable logic in `/sidebar/hooks`
- **State Management**: Local React state (Zustand in Stage 2)

### 2. Background Service Worker

- **Message Router**: Handles all inter-component communication
- **State Coordinator**: Manages global extension state
- **API Gateway**: Interfaces with AI providers
- **Keep-Alive**: Maintains service worker persistence

### 3. Content Scripts

- **DOM Extractor**: Extracts webpage content
- **Mutation Monitor**: Watches for dynamic changes
- **Selection Handler**: Manages text selection
- **Context Markers**: Preserves selection context

### 4. Storage Layer

- **Chrome Storage API**: Settings and small data
- **IndexedDB**: Conversation history
- **Encryption Service**: AES-256-GCM for API keys
- **Cache Manager**: TTL-based caching

### 5. AI Provider System

- **Provider Interface**: Unified API abstraction
- **Stream Handler**: SSE/WebSocket streaming
- **Rate Limiter**: Request throttling
- **Error Recovery**: Retry with exponential backoff

## Data Flow

### 1. Content Extraction Flow

```
User Action → Content Script → Background Worker → Storage
                     ↓
              Extract Content
                     ↓
              Format Markdown
                     ↓
               Cache Result
```

### 2. AI Chat Flow

```
User Input → UI → Background Worker → AI Provider
                        ↓
                  Validate API Key
                        ↓
                   Send Request
                        ↓
                  Stream Response
                        ↓
                    Update UI
```

### 3. Multi-Tab Aggregation Flow

```
@-mention → Tab Selector → Parallel Extraction → Context Aggregation → AI Request
```

## Message Protocol

### Message Structure

```typescript
interface Message {
  id: string;
  type: MessageType;
  payload: any;
  source: 'background' | 'content' | 'sidebar';
  target: 'background' | 'content' | 'sidebar';
  timestamp: number;
}
```

### Message Types

- `EXTRACT_CONTENT`: Request content extraction
- `CONTENT_EXTRACTED`: Content extraction complete
- `SEND_TO_AI`: Send message to AI provider
- `AI_RESPONSE`: AI provider response
- `ERROR`: Error message
- `PING/PONG`: Keep-alive messages

## Security Model

### API Key Protection

- Encrypted at rest using AES-256-GCM
- Never transmitted to third parties
- Isolated in secure storage

### Content Security

- Content scripts run in isolated world
- XSS protection via content sanitization
- CSP headers enforced

### Data Privacy

- Local-only storage
- No telemetry by default
- User-controlled data lifecycle

## Performance Considerations

### Optimization Strategies

- Lazy loading of UI components
- Content extraction caching (5 min TTL)
- Request debouncing (300ms)
- Virtual scrolling for long conversations
- WebWorker for heavy processing

### Resource Limits

- Memory budget: 50MB baseline
- Storage quota: 10MB Chrome storage
- IndexedDB: Browser-dependent (typically 50% of free disk)
- Content extraction: 500ms target

## Browser Compatibility

### Primary Support

- Chrome 120+
- Edge 120+ (Chromium)

### Secondary Support

- Brave (latest)
- Opera (latest)
- Arc Browser (latest)

### API Requirements

- Manifest V3
- Service Workers
- Chrome Storage API
- IndexedDB
- Web Crypto API

## Development Patterns

### Component Structure

```
src/
├── sidebar/            # Injected UI (React)
│   ├── components/     # Reusable components (incl. ui/)
│   ├── hooks/          # Custom React hooks
│   ├── contexts/       # React contexts
│   ├── styles/         # Sidebar styles
│   ├── ChatPanel.tsx   # Unified chat panel
│   └── index.tsx       # Shadow DOM mount/unmount
├── backend/            # Service worker
├── tabext/             # Content script
├── core/               # Messaging helpers
├── store/              # Zustand stores
├── types/              # Shared types
└── utils/              # Utilities
```

### State Management

- **UI State**: Zustand stores
- **Persistent State**: Chrome Storage
- **Conversation History**: IndexedDB
- **Temporary Cache**: In-memory with TTL

### Error Handling

- Try-catch at boundaries
- Error boundaries in React
- Graceful degradation
- User-friendly error messages

## Deployment Architecture

### Build Process

1. TypeScript compilation
2. React bundling
3. Tailwind CSS generation
4. Extension packaging
5. Source map generation (dev only)

### Distribution

- Chrome Web Store (primary)
- Edge Add-ons Store
- Direct CRX distribution (enterprise)

---

_Architecture Version: 1.0_  
_Last Updated: 2025-08-19_
