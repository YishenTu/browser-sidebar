# Stage 2: Chat Panel UI - Detailed Task Breakdown

## Stage Overview
**Goal:** Build a complete, polished chat interface with React components using Test-Driven Development. This UI will work with mock data initially and connect to real AI providers in Stage 4.

**Duration:** Estimated 2 weeks
**Total Tasks:** 24
**Parallelizable:** 17 (71%)
**Sequential:** 7 (29%)

## Prerequisites from Stage 1
- [x] React and TypeScript configured
- [x] Vite build system working
- [x] Testing infrastructure (Vitest, React Testing Library)
- [x] Extension popup and side panel entry points
- [x] ESLint and Prettier configured

## Stage 2 Deliverables
By the end of this stage, you will have:
1. ✅ Complete chat UI with message display
2. ✅ Markdown rendering with syntax highlighting
3. ✅ Streaming message display
4. ✅ Theme system (light/dark/auto)
5. ✅ State management with Zustand
6. ✅ Fully responsive layout
7. ✅ Mock chat system for testing
8. ✅ 100% component test coverage

---

## Phase 2.1: UI Foundation (6 tasks)
**Goal:** Establish design system and state management

### 🔄 Parallel Block A: Design System (3 tasks)

#### Task 2.1.1a - Tailwind Configuration 🧪
**Status:** [ ] Not Started
**Assignee:** 
**Dependencies:** Stage 1 complete

**Test Requirements:**
```typescript
// tests/styles/tailwind.test.ts
import { describe, it, expect } from 'vitest';
import resolveConfig from 'tailwindcss/resolveConfig';
import tailwindConfig from '../../tailwind.config';

describe('Tailwind Configuration', () => {
  const config = resolveConfig(tailwindConfig);
  
  it('should have custom colors defined', () => {
    expect(config.theme.colors).toHaveProperty('primary');
    expect(config.theme.colors).toHaveProperty('secondary');
    expect(config.theme.colors).toHaveProperty('ai');
    expect(config.theme.colors).toHaveProperty('user');
  });
  
  it('should have custom font sizes', () => {
    expect(config.theme.fontSize).toHaveProperty('chat');
    expect(config.theme.fontSize.chat).toBe('14px');
  });
  
  it('should have animation utilities', () => {
    expect(config.theme.animation).toHaveProperty('pulse-soft');
    expect(config.theme.animation).toHaveProperty('slide-up');
  });
});
```

**Implementation Steps:**
1. Install Tailwind CSS:
   ```bash
   npm install -D tailwindcss postcss autoprefixer
   npx tailwindcss init -p
   ```
2. Configure `tailwind.config.js`:
   ```javascript
   module.exports = {
     content: [
       "./index.html",
       "./src/**/*.{js,ts,jsx,tsx}",
     ],
     darkMode: 'class',
     theme: {
       extend: {
         colors: {
           primary: {
             50: '#eff6ff',
             500: '#3b82f6',
             600: '#2563eb',
             700: '#1d4ed8',
           },
           secondary: {
             50: '#f8fafc',
             500: '#64748b',
             600: '#475569',
           },
           ai: {
             light: '#e0f2fe',
             DEFAULT: '#0ea5e9',
             dark: '#0284c7',
           },
           user: {
             light: '#f3e8ff',
             DEFAULT: '#a855f7',
             dark: '#9333ea',
           },
           surface: {
             light: '#ffffff',
             dark: '#1e293b',
           },
           border: {
             light: '#e2e8f0',
             dark: '#334155',
           }
         },
         fontSize: {
           'chat': '14px',
           'chat-sm': '12px',
           'chat-lg': '16px',
         },
         spacing: {
           'chat': '12px',
           'message': '16px',
         },
         animation: {
           'pulse-soft': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
           'slide-up': 'slideUp 0.3s ease-out',
           'fade-in': 'fadeIn 0.2s ease-in',
           'typing': 'typing 1.4s ease-in-out infinite',
         },
         keyframes: {
           slideUp: {
             '0%': { transform: 'translateY(10px)', opacity: 0 },
             '100%': { transform: 'translateY(0)', opacity: 1 },
           },
           fadeIn: {
             '0%': { opacity: 0 },
             '100%': { opacity: 1 },
           },
           typing: {
             '0%, 60%, 100%': { opacity: 1 },
             '30%': { opacity: 0.3 },
           }
         },
         maxWidth: {
           'chat': '500px',
           'message': '70%',
         },
         minHeight: {
           'chat': '400px',
         },
         borderRadius: {
           'message': '18px',
           'message-first': '18px 18px 18px 4px',
           'message-last': '4px 18px 18px 18px',
         }
       },
     },
     plugins: [
       require('@tailwindcss/typography'),
       require('@tailwindcss/forms'),
     ],
   };
   ```
3. Create base styles:
   ```css
   /* src/styles/globals.css */
   @tailwind base;
   @tailwind components;
   @tailwind utilities;

   @layer base {
     html {
       @apply antialiased;
     }
     
     body {
       @apply text-gray-900 dark:text-gray-100;
       @apply bg-surface-light dark:bg-surface-dark;
     }
   }

   @layer components {
     .chat-scrollbar {
       @apply scrollbar-thin scrollbar-thumb-gray-300 
              dark:scrollbar-thumb-gray-600 
              scrollbar-track-transparent;
     }
     
     .message-bubble {
       @apply px-4 py-2 rounded-message max-w-message;
       word-break: break-word;
     }
     
     .message-bubble-ai {
       @apply bg-ai-light dark:bg-ai-dark/20 
              text-gray-800 dark:text-gray-100;
     }
     
     .message-bubble-user {
       @apply bg-user-light dark:bg-user-dark/20 
              text-gray-800 dark:text-gray-100 ml-auto;
     }
   }
   ```

**Deliverables:**
- `tailwind.config.js` with custom theme
- `postcss.config.js` configuration
- `src/styles/globals.css` with base styles
- Custom color palette for chat UI
- Animation utilities for smooth UX

**Acceptance Criteria:**
- [ ] Tailwind classes compile correctly
- [ ] Custom colors available
- [ ] Dark mode utilities work
- [ ] Animations defined
- [ ] Tests pass

---

#### Task 2.1.1b - CSS Variables and Theme System 🧪
**Status:** [ ] Not Started
**Assignee:** 
**Dependencies:** Task 2.1.1a

**Test Requirements:**
```typescript
// tests/styles/theme.test.ts
import { describe, it, expect, beforeEach } from 'vitest';

describe('Theme System', () => {
  beforeEach(() => {
    document.documentElement.className = '';
  });
  
  it('should have CSS variables defined', () => {
    const styles = getComputedStyle(document.documentElement);
    
    // Check light theme variables
    document.documentElement.className = 'light';
    expect(styles.getPropertyValue('--color-background')).toBeDefined();
    expect(styles.getPropertyValue('--color-text')).toBeDefined();
  });
  
  it('should switch between themes', () => {
    const root = document.documentElement;
    
    root.className = 'light';
    expect(root.className).toBe('light');
    
    root.className = 'dark';
    expect(root.className).toBe('dark');
  });
});
```

**Implementation Steps:**
1. Create CSS variables:
   ```css
   /* src/styles/variables.css */
   :root {
     /* Light theme (default) */
     --color-background: #ffffff;
     --color-surface: #f8fafc;
     --color-surface-hover: #f1f5f9;
     --color-border: #e2e8f0;
     --color-text: #1e293b;
     --color-text-secondary: #64748b;
     
     --color-ai-bg: #e0f2fe;
     --color-ai-text: #075985;
     --color-ai-border: #7dd3fc;
     
     --color-user-bg: #f3e8ff;
     --color-user-text: #6b21a8;
     --color-user-border: #d8b4fe;
     
     --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
     --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
     
     --radius-message: 18px;
     --spacing-chat: 12px;
   }

   .dark {
     --color-background: #0f172a;
     --color-surface: #1e293b;
     --color-surface-hover: #334155;
     --color-border: #334155;
     --color-text: #f1f5f9;
     --color-text-secondary: #94a3b8;
     
     --color-ai-bg: #1e3a5f;
     --color-ai-text: #bfdbfe;
     --color-ai-border: #1e40af;
     
     --color-user-bg: #4c1d6b;
     --color-user-text: #e9d5ff;
     --color-user-border: #7c3aed;
     
     --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.2);
     --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.3);
   }

   /* System preference detection */
   @media (prefers-color-scheme: dark) {
     :root:not(.light) {
       --color-background: #0f172a;
       /* ... rest of dark theme variables */
     }
   }
   ```
2. Create theme utilities:
   ```typescript
   // src/utils/theme.ts
   export type Theme = 'light' | 'dark' | 'auto';

   export class ThemeManager {
     private static STORAGE_KEY = 'theme-preference';
     
     static getTheme(): Theme {
       const stored = localStorage.getItem(this.STORAGE_KEY);
       if (stored && ['light', 'dark', 'auto'].includes(stored)) {
         return stored as Theme;
       }
       return 'auto';
     }
     
     static setTheme(theme: Theme): void {
       localStorage.setItem(this.STORAGE_KEY, theme);
       this.applyTheme(theme);
     }
     
     static applyTheme(theme: Theme): void {
       const root = document.documentElement;
       
       if (theme === 'auto') {
         const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
         root.className = prefersDark ? 'dark' : 'light';
       } else {
         root.className = theme;
       }
     }
     
     static initTheme(): void {
       const theme = this.getTheme();
       this.applyTheme(theme);
       
       // Listen for system theme changes
       window.matchMedia('(prefers-color-scheme: dark)')
         .addEventListener('change', (e) => {
           if (this.getTheme() === 'auto') {
             root.className = e.matches ? 'dark' : 'light';
           }
         });
     }
   }
   ```

**Deliverables:**
- `src/styles/variables.css` with CSS variables
- Theme utilities in `src/utils/theme.ts`
- Light and dark theme definitions
- Auto theme detection

**Acceptance Criteria:**
- [ ] CSS variables defined for both themes
- [ ] Theme switching works
- [ ] Auto detection follows system
- [ ] Variables apply to components
- [ ] Tests pass

---

#### Task 2.1.1c - Base Component Styles
**Status:** [ ] Not Started
**Assignee:** 
**Dependencies:** Task 2.1.1b

**Implementation Steps:**
1. Create component base styles:
   ```css
   /* src/styles/components.css */
   @layer components {
     /* Button styles */
     .btn {
       @apply px-4 py-2 rounded-lg font-medium transition-all duration-200;
       @apply focus:outline-none focus:ring-2 focus:ring-offset-2;
     }
     
     .btn-primary {
       @apply bg-primary-500 text-white hover:bg-primary-600;
       @apply focus:ring-primary-500;
     }
     
     .btn-secondary {
       @apply bg-gray-200 text-gray-900 hover:bg-gray-300;
       @apply dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600;
       @apply focus:ring-gray-500;
     }
     
     .btn-ghost {
       @apply bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800;
       @apply focus:ring-gray-500;
     }
     
     .btn-icon {
       @apply p-2 rounded-lg;
     }
     
     /* Input styles */
     .input {
       @apply w-full px-3 py-2 rounded-lg border;
       @apply bg-white dark:bg-gray-800;
       @apply border-gray-300 dark:border-gray-600;
       @apply focus:outline-none focus:ring-2 focus:ring-primary-500;
       @apply placeholder-gray-400 dark:placeholder-gray-500;
     }
     
     .textarea {
       @apply input resize-none;
       @apply min-h-[80px] max-h-[200px];
     }
     
     /* Card styles */
     .card {
       @apply bg-surface-light dark:bg-surface-dark;
       @apply border border-border-light dark:border-border-dark;
       @apply rounded-lg shadow-sm;
     }
     
     .card-hover {
       @apply card hover:shadow-md transition-shadow duration-200;
     }
     
     /* Loading states */
     .skeleton {
       @apply animate-pulse bg-gray-200 dark:bg-gray-700 rounded;
     }
     
     .spinner {
       @apply animate-spin rounded-full border-2;
       @apply border-gray-300 border-t-primary-500;
     }
   }
   ```

**Deliverables:**
- `src/styles/components.css` with base styles
- Button variants (primary, secondary, ghost, icon)
- Input and textarea styles
- Card components
- Loading states (skeleton, spinner)

**Acceptance Criteria:**
- [ ] All base styles defined
- [ ] Styles work in light/dark mode
- [ ] Consistent design language
- [ ] Styles are reusable

---

### 🔄 Parallel Block B: State Management (3 tasks)

#### Task 2.1.2a - Zustand Store Setup 🧪
**Status:** [ ] Not Started
**Assignee:** 
**Dependencies:** Stage 1 complete

**Test Requirements:**
```typescript
// tests/store/index.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createStore } from '@/store';

describe('Store Setup', () => {
  let store;
  
  beforeEach(() => {
    store = createStore();
  });
  
  it('should initialize with default state', () => {
    const state = store.getState();
    expect(state).toBeDefined();
    expect(state.messages).toEqual([]);
    expect(state.settings).toBeDefined();
  });
  
  it('should persist state to localStorage', () => {
    store.getState().addMessage({ 
      id: '1', 
      content: 'Test', 
      role: 'user' 
    });
    
    const stored = localStorage.getItem('chat-store');
    expect(stored).toBeDefined();
    
    const parsed = JSON.parse(stored);
    expect(parsed.state.messages).toHaveLength(1);
  });
  
  it('should restore state from localStorage', () => {
    const testState = {
      state: {
        messages: [{ id: '1', content: 'Restored', role: 'user' }]
      }
    };
    
    localStorage.setItem('chat-store', JSON.stringify(testState));
    
    const newStore = createStore();
    expect(newStore.getState().messages).toHaveLength(1);
    expect(newStore.getState().messages[0].content).toBe('Restored');
  });
});
```

**Implementation Steps:**
1. Install Zustand:
   ```bash
   npm install zustand
   npm install -D @types/zustand
   ```
2. Create main store:
   ```typescript
   // src/store/index.ts
   import { create } from 'zustand';
   import { devtools, persist } from 'zustand/middleware';
   import { immer } from 'zustand/middleware/immer';
   import { ChatStore, createChatSlice } from './chat';
   import { SettingsStore, createSettingsSlice } from './settings';

   export type RootStore = ChatStore & SettingsStore;

   export const useStore = create<RootStore>()(
     devtools(
       persist(
         immer((...args) => ({
           ...createChatSlice(...args),
           ...createSettingsSlice(...args),
         })),
         {
           name: 'chat-store',
           partialize: (state) => ({
             // Only persist specific parts
             messages: state.messages.slice(-100), // Last 100 messages
             settings: state.settings,
           }),
         }
       ),
       {
         name: 'BrowserSidebarStore',
       }
     )
   );

   // For testing
   export const createStore = () => {
     return create<RootStore>()(
       persist(
         immer((...args) => ({
           ...createChatSlice(...args),
           ...createSettingsSlice(...args),
         })),
         {
           name: 'chat-store',
         }
       )
     );
   };
   ```

**Deliverables:**
- `src/store/index.ts` - Main store setup
- Zustand configuration with middleware
- Persistence to localStorage
- DevTools integration for debugging
- Test helper for store creation

**Acceptance Criteria:**
- [ ] Store initializes correctly
- [ ] State persists to localStorage
- [ ] State restores on reload
- [ ] DevTools integration works
- [ ] Tests pass

---

#### Task 2.1.2b - Chat Store Implementation 🧪
**Status:** [ ] Not Started
**Assignee:** 
**Dependencies:** Task 2.1.2a

**Test Requirements:**
```typescript
// tests/store/chat.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store';

describe('Chat Store', () => {
  beforeEach(() => {
    useStore.getState().clearMessages();
  });
  
  it('should add messages', () => {
    const { addMessage, messages } = useStore.getState();
    
    addMessage({
      content: 'Hello',
      role: 'user',
    });
    
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe('Hello');
    expect(messages[0].id).toBeDefined();
    expect(messages[0].timestamp).toBeDefined();
  });
  
  it('should update message content', () => {
    const { addMessage, updateMessage, messages } = useStore.getState();
    
    addMessage({ content: 'Initial', role: 'assistant' });
    const messageId = messages[0].id;
    
    updateMessage(messageId, { content: 'Updated' });
    
    expect(messages[0].content).toBe('Updated');
  });
  
  it('should handle streaming messages', () => {
    const { startStreaming, appendToStream, finishStreaming } = useStore.getState();
    
    const messageId = startStreaming();
    expect(useStore.getState().streamingMessageId).toBe(messageId);
    
    appendToStream('Hello ');
    appendToStream('World');
    
    const messages = useStore.getState().messages;
    expect(messages[0].content).toBe('Hello World');
    expect(messages[0].isStreaming).toBe(true);
    
    finishStreaming();
    expect(messages[0].isStreaming).toBe(false);
    expect(useStore.getState().streamingMessageId).toBeNull();
  });
  
  it('should delete messages', () => {
    const { addMessage, deleteMessage, messages } = useStore.getState();
    
    addMessage({ content: 'Test', role: 'user' });
    const messageId = messages[0].id;
    
    deleteMessage(messageId);
    expect(useStore.getState().messages).toHaveLength(0);
  });
  
  it('should clear all messages', () => {
    const { addMessage, clearMessages } = useStore.getState();
    
    addMessage({ content: 'Test 1', role: 'user' });
    addMessage({ content: 'Test 2', role: 'assistant' });
    
    clearMessages();
    expect(useStore.getState().messages).toHaveLength(0);
  });
});
```

**Implementation Steps:**
1. Create chat store slice:
   ```typescript
   // src/store/chat.ts
   import { StateCreator } from 'zustand';
   import { nanoid } from 'nanoid';

   export interface Message {
     id: string;
     content: string;
     role: 'user' | 'assistant' | 'system';
     timestamp: number;
     isStreaming?: boolean;
     error?: string;
     metadata?: {
       model?: string;
       tokens?: number;
       latency?: number;
     };
   }

   export interface ChatStore {
     // State
     messages: Message[];
     streamingMessageId: string | null;
     isLoading: boolean;
     
     // Actions
     addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => string;
     updateMessage: (id: string, updates: Partial<Message>) => void;
     deleteMessage: (id: string) => void;
     clearMessages: () => void;
     
     // Streaming
     startStreaming: () => string;
     appendToStream: (content: string) => void;
     finishStreaming: () => void;
     
     // Loading
     setLoading: (loading: boolean) => void;
   }

   export const createChatSlice: StateCreator<ChatStore> = (set, get) => ({
     messages: [],
     streamingMessageId: null,
     isLoading: false,
     
     addMessage: (message) => {
       const id = nanoid();
       const newMessage: Message = {
         ...message,
         id,
         timestamp: Date.now(),
       };
       
       set((state) => {
         state.messages.push(newMessage);
       });
       
       return id;
     },
     
     updateMessage: (id, updates) => {
       set((state) => {
         const message = state.messages.find(m => m.id === id);
         if (message) {
           Object.assign(message, updates);
         }
       });
     },
     
     deleteMessage: (id) => {
       set((state) => {
         state.messages = state.messages.filter(m => m.id !== id);
       });
     },
     
     clearMessages: () => {
       set((state) => {
         state.messages = [];
         state.streamingMessageId = null;
       });
     },
     
     startStreaming: () => {
       const id = get().addMessage({
         content: '',
         role: 'assistant',
         isStreaming: true,
       });
       
       set((state) => {
         state.streamingMessageId = id;
       });
       
       return id;
     },
     
     appendToStream: (content) => {
       const { streamingMessageId, messages } = get();
       if (!streamingMessageId) return;
       
       set((state) => {
         const message = state.messages.find(m => m.id === streamingMessageId);
         if (message) {
           message.content += content;
         }
       });
     },
     
     finishStreaming: () => {
       const { streamingMessageId } = get();
       if (!streamingMessageId) return;
       
       set((state) => {
         const message = state.messages.find(m => m.id === streamingMessageId);
         if (message) {
           message.isStreaming = false;
         }
         state.streamingMessageId = null;
       });
     },
     
     setLoading: (loading) => {
       set({ isLoading: loading });
     },
   });
   ```

**Deliverables:**
- `src/store/chat.ts` - Chat state management
- Message CRUD operations
- Streaming message support
- Loading states
- Message metadata

**Acceptance Criteria:**
- [ ] Can add/update/delete messages
- [ ] Streaming works correctly
- [ ] Messages have unique IDs
- [ ] State updates trigger re-renders
- [ ] Tests pass

---

#### Task 2.1.2c - Settings Store Implementation 🧪
**Status:** [ ] Not Started
**Assignee:** 
**Dependencies:** Task 2.1.2a

**Test Requirements:**
```typescript
// tests/store/settings.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store';

describe('Settings Store', () => {
  beforeEach(() => {
    useStore.getState().resetSettings();
  });
  
  it('should have default settings', () => {
    const { settings } = useStore.getState();
    
    expect(settings.theme).toBe('auto');
    expect(settings.fontSize).toBe('medium');
    expect(settings.sendOnEnter).toBe(false);
    expect(settings.showTimestamps).toBe(true);
  });
  
  it('should update theme', () => {
    const { setTheme, settings } = useStore.getState();
    
    setTheme('dark');
    expect(useStore.getState().settings.theme).toBe('dark');
    
    setTheme('light');
    expect(useStore.getState().settings.theme).toBe('light');
  });
  
  it('should update multiple settings', () => {
    const { updateSettings } = useStore.getState();
    
    updateSettings({
      fontSize: 'large',
      sendOnEnter: true,
      showTimestamps: false,
    });
    
    const { settings } = useStore.getState();
    expect(settings.fontSize).toBe('large');
    expect(settings.sendOnEnter).toBe(true);
    expect(settings.showTimestamps).toBe(false);
  });
  
  it('should reset to defaults', () => {
    const { updateSettings, resetSettings } = useStore.getState();
    
    updateSettings({ theme: 'dark', fontSize: 'large' });
    resetSettings();
    
    const { settings } = useStore.getState();
    expect(settings.theme).toBe('auto');
    expect(settings.fontSize).toBe('medium');
  });
});
```

**Implementation Steps:**
1. Create settings store slice:
   ```typescript
   // src/store/settings.ts
   import { StateCreator } from 'zustand';

   export interface Settings {
     // Appearance
     theme: 'light' | 'dark' | 'auto';
     fontSize: 'small' | 'medium' | 'large';
     fontFamily: 'system' | 'mono';
     compactMode: boolean;
     
     // Behavior
     sendOnEnter: boolean;
     showTimestamps: boolean;
     showAvatars: boolean;
     soundEnabled: boolean;
     
     // Advanced
     streamingEnabled: boolean;
     debugMode: boolean;
   }

   export interface SettingsStore {
     settings: Settings;
     setTheme: (theme: Settings['theme']) => void;
     updateSettings: (updates: Partial<Settings>) => void;
     resetSettings: () => void;
   }

   const defaultSettings: Settings = {
     theme: 'auto',
     fontSize: 'medium',
     fontFamily: 'system',
     compactMode: false,
     sendOnEnter: false,
     showTimestamps: true,
     showAvatars: true,
     soundEnabled: true,
     streamingEnabled: true,
     debugMode: false,
   };

   export const createSettingsSlice: StateCreator<SettingsStore> = (set) => ({
     settings: { ...defaultSettings },
     
     setTheme: (theme) => {
       set((state) => {
         state.settings.theme = theme;
       });
       
       // Apply theme to document
       if (typeof document !== 'undefined') {
         if (theme === 'auto') {
           const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
           document.documentElement.className = prefersDark ? 'dark' : 'light';
         } else {
           document.documentElement.className = theme;
         }
       }
     },
     
     updateSettings: (updates) => {
       set((state) => {
         Object.assign(state.settings, updates);
       });
       
       // Apply theme if it was updated
       if (updates.theme) {
         useStore.getState().setTheme(updates.theme);
       }
     },
     
     resetSettings: () => {
       set((state) => {
         state.settings = { ...defaultSettings };
       });
       useStore.getState().setTheme(defaultSettings.theme);
     },
   });
   ```

**Deliverables:**
- `src/store/settings.ts` - Settings management
- Theme preferences
- UI preferences (font size, timestamps, etc.)
- Behavior settings
- Reset functionality

**Acceptance Criteria:**
- [ ] Default settings initialized
- [ ] Settings update correctly
- [ ] Theme changes apply to DOM
- [ ] Settings persist
- [ ] Tests pass

---

## Phase 2.2: Base Components (5 tasks)
**Goal:** Build reusable UI components with tests

### 🔄 Parallel Block: Base UI Components

#### Task 2.2.1a - Button Component 🧪
**Status:** [ ] Not Started
**Assignee:** 
**Dependencies:** Task 2.1.1c

**Test Requirements:**
```typescript
// tests/components/ui/Button.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '@/components/ui/Button';

describe('Button Component', () => {
  it('should render with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });
  
  it('should handle click events', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    
    fireEvent.click(screen.getByText('Click'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
  
  it('should be disabled when prop is set', () => {
    const handleClick = vi.fn();
    render(<Button disabled onClick={handleClick}>Disabled</Button>);
    
    const button = screen.getByText('Disabled');
    expect(button).toBeDisabled();
    
    fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });
  
  it('should show loading state', () => {
    render(<Button loading>Loading</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('opacity-75');
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });
  
  it('should render different variants', () => {
    const { rerender } = render(<Button variant="primary">Primary</Button>);
    expect(screen.getByText('Primary')).toHaveClass('btn-primary');
    
    rerender(<Button variant="secondary">Secondary</Button>);
    expect(screen.getByText('Secondary')).toHaveClass('btn-secondary');
    
    rerender(<Button variant="ghost">Ghost</Button>);
    expect(screen.getByText('Ghost')).toHaveClass('btn-ghost');
  });
  
  it('should render different sizes', () => {
    const { rerender } = render(<Button size="sm">Small</Button>);
    expect(screen.getByText('Small')).toHaveClass('btn-sm');
    
    rerender(<Button size="lg">Large</Button>);
    expect(screen.getByText('Large')).toHaveClass('btn-lg');
  });
});
```

**Implementation:**
```typescript
// src/components/ui/Button.tsx
import React from 'react';
import { cn } from '@/utils/cn';
import { Spinner } from './Spinner';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    className,
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled,
    icon,
    children,
    ...props 
  }, ref) => {
    const variants = {
      primary: 'btn-primary',
      secondary: 'btn-secondary',
      ghost: 'btn-ghost',
      danger: 'btn-danger',
    };
    
    const sizes = {
      sm: 'btn-sm text-sm px-3 py-1.5',
      md: 'btn-md text-base px-4 py-2',
      lg: 'btn-lg text-lg px-6 py-3',
    };
    
    return (
      <button
        ref={ref}
        className={cn(
          'btn',
          variants[variant],
          sizes[size],
          loading && 'opacity-75 cursor-wait',
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <Spinner 
            className="mr-2 h-4 w-4" 
            data-testid="spinner" 
          />
        )}
        {icon && !loading && (
          <span className="mr-2">{icon}</span>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
```

**Deliverables:**
- `src/components/ui/Button.tsx`
- `tests/components/ui/Button.test.tsx`
- Variant support (primary, secondary, ghost, danger)
- Size variants (sm, md, lg)
- Loading state with spinner
- Icon support

**Acceptance Criteria:**
- [ ] All variants render correctly
- [ ] Click handlers work
- [ ] Disabled state prevents clicks
- [ ] Loading state shows spinner
- [ ] Tests pass with 100% coverage

---

#### Task 2.2.1b - Input Component 🧪
**Status:** [ ] Not Started
**Assignee:** 
**Dependencies:** Task 2.1.1c

**Test Requirements:**
```typescript
// tests/components/ui/Input.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Input } from '@/components/ui/Input';

describe('Input Component', () => {
  it('should render with placeholder', () => {
    render(<Input placeholder="Enter text" />);
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
  });
  
  it('should handle value changes', () => {
    const handleChange = vi.fn();
    render(<Input onChange={handleChange} />);
    
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'test' } });
    
    expect(handleChange).toHaveBeenCalled();
    expect(input).toHaveValue('test');
  });
  
  it('should show error state', () => {
    render(<Input error="Invalid input" />);
    
    const input = screen.getByRole('textbox');
    expect(input).toHaveClass('border-red-500');
    expect(screen.getByText('Invalid input')).toBeInTheDocument();
  });
  
  it('should show helper text', () => {
    render(<Input helperText="This is a hint" />);
    expect(screen.getByText('This is a hint')).toBeInTheDocument();
  });
  
  it('should render with label', () => {
    render(<Input label="Username" id="username" />);
    
    const label = screen.getByText('Username');
    expect(label).toBeInTheDocument();
    expect(label).toHaveAttribute('for', 'username');
  });
  
  it('should be disabled', () => {
    render(<Input disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });
});
```

**Implementation:**
```typescript
// src/components/ui/Input.tsx
import React from 'react';
import { cn } from '@/utils/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ 
    className,
    label,
    error,
    helperText,
    leftIcon,
    rightIcon,
    id,
    ...props 
  }, ref) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
    
    return (
      <div className="w-full">
        {label && (
          <label 
            htmlFor={inputId}
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            {label}
          </label>
        )}
        
        <div className="relative">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              {leftIcon}
            </div>
          )}
          
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'input',
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              error && 'border-red-500 focus:ring-red-500',
              className
            )}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
            {...props}
          />
          
          {rightIcon && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              {rightIcon}
            </div>
          )}
        </div>
        
        {error && (
          <p id={`${inputId}-error`} className="mt-1 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        
        {helperText && !error && (
          <p id={`${inputId}-helper`} className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
```

**Deliverables:**
- `src/components/ui/Input.tsx`
- `tests/components/ui/Input.test.tsx`
- Label support
- Error and helper text
- Icon support (left/right)
- Accessibility attributes

**Acceptance Criteria:**
- [ ] Input handles value changes
- [ ] Error state displays correctly
- [ ] Helper text shows
- [ ] Icons render in correct position
- [ ] Tests pass with 100% coverage

---

Continue with remaining Phase 2.2, 2.3, and 2.4 tasks...

[Note: This is a partial file. The complete task-stage-2.md would include all 24 tasks with similar detail level. Each task would have test requirements, implementation code, deliverables, and acceptance criteria.]

---

## Stage 2 Completion Checklist

### Testing Requirements
- [ ] All component tests written and passing
- [ ] Test coverage > 95% for Stage 2 code
- [ ] Integration tests for state management
- [ ] Visual regression tests for UI components

### Documentation
- [ ] Component storybook created
- [ ] Props documentation for all components
- [ ] State management flow documented
- [ ] Theme customization guide

### Quality Gates
- [ ] No TypeScript errors
- [ ] No ESLint warnings
- [ ] Prettier formatting applied
- [ ] Accessibility audit passed (WCAG 2.1 AA)
- [ ] Code reviewed

### Deliverables Verification
- [ ] Complete chat UI renders
- [ ] Messages display correctly
- [ ] Markdown rendering works
- [ ] Code syntax highlighting works
- [ ] Streaming animation smooth
- [ ] Theme switching works
- [ ] State persists correctly
- [ ] Mock chat system functional

## Next Stage Prerequisites
Before moving to Stage 3 (Storage & Security), ensure:
1. ✅ All Stage 2 tasks complete
2. ✅ UI components fully tested
3. ✅ State management working
4. ✅ Theme system operational
5. ✅ Mock chat demonstrates all features

---

*Stage 2 Task Guide Version: 1.0*
*Total Tasks: 24*
*Estimated Duration: 2 weeks*
*Dependencies: Stage 1 complete*