# Stage 1: Extension Infrastructure - Detailed Task Breakdown

## Stage Overview

**Goal:** Create the foundational Chrome extension architecture with complete testing infrastructure and message passing system.

**Duration:** Estimated 1-2 weeks
**Total Tasks:** 15
**Parallelizable:** 9 (60%)
**Sequential:** 6 (40%)
**Status:** ✅ COMPLETED

## Prerequisites Checklist

- [x] Node.js 18+ installed
- [x] Chromium-based browser installed (Chrome, Arc, Edge, etc.)
- [x] VS Code or preferred IDE ready
- [x] Git initialized in project directory

## Stage 1 Deliverables

By the end of this stage, you will have:

1. ✅ Complete project setup with TypeScript, Vite, and CRXJS
2. ✅ Working Chrome extension that loads in browser
3. ✅ Test infrastructure with Vitest and React Testing Library
4. ✅ Message passing system between components
5. ✅ Type-safe architecture with strict TypeScript
6. ✅ Linting and formatting automation

---

## Phase 1.1: Project Initialization (9 tasks)

**Goal:** Set up the development environment and project structure

### 🔄 Parallel Block A: Core Setup (3 tasks)

#### Task 1.1.1a - Initialize NPM Project 🧪

**Status:** [x] Completed
**Assignee:**
**Dependencies:** None (can start immediately)

**Test Requirements:**

```javascript
// tests/setup/package.test.js
describe('Package.json validation', () => {
  it('should have valid package.json', () => {
    const pkg = require('../package.json');
    expect(pkg.name).toBe('browser-sidebar');
    expect(pkg.version).toBeDefined();
  });

  it('should have all required scripts', () => {
    const pkg = require('../package.json');
    expect(pkg.scripts.dev).toBeDefined();
    expect(pkg.scripts.build).toBeDefined();
    expect(pkg.scripts.test).toBeDefined();
    expect(pkg.scripts.lint).toBeDefined();
  });
});
```

**Implementation Steps:**

1. Run `npm init -y`
2. Edit package.json with proper name and description
3. Add script definitions:
   ```json
   {
     "name": "browser-sidebar",
     "version": "0.1.0",
     "description": "AI-powered browser sidebar extension",
     "scripts": {
       "dev": "vite",
       "build": "vite build",
       "test": "vitest",
       "test:ui": "vitest --ui",
       "test:coverage": "vitest --coverage",
       "lint": "eslint . --ext .ts,.tsx",
       "format": "prettier --write ."
     }
   }
   ```

**Deliverables:**

- `package.json` with all metadata and scripts
- Initial `node_modules/` (in .gitignore)
- `package-lock.json`

**Acceptance Criteria:**

- [ ] `npm install` completes without errors
- [ ] All scripts are defined in package.json
- [ ] Package name and version are set correctly

---

#### Task 1.1.1b - Setup Vite and CRXJS

**Status:** [ ] Not Started
**Assignee:**
**Dependencies:** Task 1.1.1a must be complete

**Test Requirements:**

```typescript
// tests/setup/vite.test.ts
import { describe, it, expect } from 'vitest';
import viteConfig from '../vite.config';

describe('Vite Configuration', () => {
  it('should have CRXJS plugin configured', () => {
    const hascrxjs = viteConfig.plugins.some(plugin => plugin.name === 'crxjs');
    expect(hascrxjs).toBe(true);
  });

  it('should have correct build output', () => {
    expect(viteConfig.build.outDir).toBe('dist');
    expect(viteConfig.build.sourcemap).toBeDefined();
  });
});
```

**Implementation Steps:**

1. Install dependencies:
   ```bash
   npm install -D vite @crxjs/vite-plugin @vitejs/plugin-react
   ```
2. Create `vite.config.ts`:

   ```typescript
   import { defineConfig } from 'vite';
   import react from '@vitejs/plugin-react';
   import { crx } from '@crxjs/vite-plugin';
   import manifest from './manifest.json';

   export default defineConfig({
     plugins: [react(), crx({ manifest })],
     build: {
       outDir: 'dist',
       sourcemap: process.env.NODE_ENV !== 'production',
       rollupOptions: {
         input: {
           popup: 'popup.html',
           sidepanel: 'sidepanel.html',
         },
       },
     },
   });
   ```

**Deliverables:**

- `vite.config.ts` with CRXJS plugin
- Updated package.json with Vite dependencies
- Build configuration for extension

**Acceptance Criteria:**

- [ ] Vite config exports valid configuration
- [ ] CRXJS plugin is properly configured
- [ ] `npm run dev` starts without errors

---

#### Task 1.1.1c - Create Folder Structure

**Status:** [ ] Not Started
**Assignee:**
**Dependencies:** Task 1.1.1a

**Test Requirements:**

```typescript
// tests/setup/structure.test.ts
import fs from 'fs';
import path from 'path';

describe('Project Structure', () => {
  const dirs = [
    'src',
    'src/background',
    'src/content',
    'src/popup',
    'src/sidepanel',
    'src/components',
    'src/utils',
    'src/types',
    'src/store',
    'public',
    'tests',
  ];

  dirs.forEach(dir => {
    it(`should have ${dir} directory`, () => {
      expect(fs.existsSync(path.join(process.cwd(), dir))).toBe(true);
    });
  });
});
```

**Implementation Steps:**

1. Create directory structure:
   ```bash
   mkdir -p src/{background,content,popup,sidepanel,components,utils,types,store,styles}
   mkdir -p tests/{unit,integration,e2e,mocks,utils}
   mkdir -p public/icons
   ```
2. Create `.gitignore`:
   ```
   node_modules/
   dist/
   .env
   .env.local
   *.log
   .DS_Store
   coverage/
   .vscode/
   *.crx
   *.pem
   ```
3. Create initial README.md

**Deliverables:**

- Complete directory structure
- `.gitignore` file
- `README.md` with project description

**Acceptance Criteria:**

- [ ] All required directories exist
- [ ] .gitignore includes necessary patterns
- [ ] Structure supports modular development

---

### 🔄 Parallel Block B: Configuration (3 tasks)

#### Task 1.1.2a - TypeScript Configuration 🧪

**Status:** [ ] Not Started
**Assignee:**
**Dependencies:** Task 1.1.1a

**Test Requirements:**

```typescript
// tests/setup/typescript.test.ts
import { describe, it, expect } from 'vitest';
import tsConfig from '../tsconfig.json';

describe('TypeScript Configuration', () => {
  it('should have strict mode enabled', () => {
    expect(tsConfig.compilerOptions.strict).toBe(true);
    expect(tsConfig.compilerOptions.noImplicitAny).toBe(true);
    expect(tsConfig.compilerOptions.strictNullChecks).toBe(true);
  });

  it('should have path aliases configured', () => {
    expect(tsConfig.compilerOptions.paths['@/*']).toBeDefined();
    expect(tsConfig.compilerOptions.paths['@components/*']).toBeDefined();
  });
});
```

**Implementation Steps:**

1. Install TypeScript:
   ```bash
   npm install -D typescript @types/node @types/react @types/react-dom
   ```
2. Create `tsconfig.json`:
   ```json
   {
     "compilerOptions": {
       "target": "ES2020",
       "lib": ["ES2020", "DOM", "DOM.Iterable"],
       "module": "ESNext",
       "skipLibCheck": true,
       "moduleResolution": "node",
       "resolveJsonModule": true,
       "isolatedModules": true,
       "noEmit": true,
       "jsx": "react-jsx",
       "strict": true,
       "noImplicitAny": true,
       "strictNullChecks": true,
       "strictFunctionTypes": true,
       "noImplicitThis": true,
       "esModuleInterop": true,
       "forceConsistentCasingInFileNames": true,
       "allowSyntheticDefaultImports": true,
       "baseUrl": ".",
       "paths": {
         "@/*": ["src/*"],
         "@components/*": ["src/components/*"],
         "@utils/*": ["src/utils/*"],
         "@types/*": ["src/types/*"],
         "@store/*": ["src/store/*"]
       }
     },
     "include": ["src", "tests"],
     "exclude": ["node_modules", "dist"]
   }
   ```

**Deliverables:**

- `tsconfig.json` with strict mode
- Path aliases configuration
- Type checking setup

**Acceptance Criteria:**

- [ ] TypeScript compiles without errors
- [ ] Strict mode is enabled
- [ ] Path aliases work correctly
- [ ] All type safety features enabled

---

#### Task 1.1.2b - ESLint Setup 🧪

**Status:** [ ] Not Started
**Assignee:**
**Dependencies:** Task 1.1.2a

**Test Requirements:**

```javascript
// tests/setup/eslint.test.js
const { ESLint } = require('eslint');

describe('ESLint Configuration', () => {
  let eslint;

  beforeAll(() => {
    eslint = new ESLint();
  });

  it('should have valid configuration', async () => {
    const config = await eslint.calculateConfigForFile('src/test.ts');
    expect(config).toBeDefined();
    expect(config.rules).toBeDefined();
  });

  it('should lint TypeScript files', async () => {
    const results = await eslint.lintText('const x: number = 5;', { filePath: 'test.ts' });
    expect(results[0].errorCount).toBe(0);
  });
});
```

**Implementation Steps:**

1. Install ESLint and plugins:
   ```bash
   npm install -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
   npm install -D eslint-plugin-react eslint-plugin-react-hooks
   npm install -D eslint-plugin-jsx-a11y eslint-config-prettier
   ```
2. Create `.eslintrc.json`:
   ```json
   {
     "parser": "@typescript-eslint/parser",
     "extends": [
       "eslint:recommended",
       "plugin:@typescript-eslint/recommended",
       "plugin:react/recommended",
       "plugin:react-hooks/recommended",
       "plugin:jsx-a11y/recommended",
       "prettier"
     ],
     "plugins": ["@typescript-eslint", "react", "jsx-a11y"],
     "env": {
       "browser": true,
       "es2020": true,
       "node": true,
       "webextensions": true
     },
     "settings": {
       "react": {
         "version": "detect"
       }
     },
     "rules": {
       "@typescript-eslint/explicit-module-boundary-types": "error",
       "@typescript-eslint/no-explicit-any": "error",
       "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
       "react/react-in-jsx-scope": "off"
     }
   }
   ```

**Deliverables:**

- `.eslintrc.json` configuration
- ESLint plugins installed
- Linting scripts working

**Acceptance Criteria:**

- [ ] ESLint configuration is valid
- [ ] Can lint TypeScript files
- [ ] React rules are configured
- [ ] Accessibility rules enabled

---

#### Task 1.1.2c - Prettier and Pre-commit Hooks

**Status:** [ ] Not Started
**Assignee:**
**Dependencies:** Task 1.1.2b

**Test Requirements:**

```javascript
// tests/setup/prettier.test.js
describe('Prettier Configuration', () => {
  it('should have prettier config', () => {
    const config = require('../.prettierrc');
    expect(config.semi).toBeDefined();
    expect(config.singleQuote).toBeDefined();
  });

  it('should have husky hooks configured', () => {
    const huskyConfig = require('../.husky/pre-commit');
    expect(huskyConfig).toContain('lint-staged');
  });
});
```

**Implementation Steps:**

1. Install Prettier and Husky:
   ```bash
   npm install -D prettier husky lint-staged
   npx husky-init && npm install
   ```
2. Create `.prettierrc`:
   ```json
   {
     "semi": true,
     "trailingComma": "es5",
     "singleQuote": true,
     "printWidth": 100,
     "tabWidth": 2,
     "useTabs": false,
     "bracketSpacing": true,
     "arrowParens": "avoid"
   }
   ```
3. Configure lint-staged in package.json:
   ```json
   {
     "lint-staged": {
       "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
       "*.{json,md,css}": ["prettier --write"]
     }
   }
   ```
4. Setup husky pre-commit hook:
   ```bash
   npx husky add .husky/pre-commit "npx lint-staged"
   ```

**Deliverables:**

- `.prettierrc` configuration
- Husky pre-commit hooks
- lint-staged configuration

**Acceptance Criteria:**

- [ ] Prettier formats code consistently
- [ ] Pre-commit hooks run on commit
- [ ] Files are auto-formatted before commit

---

### 🔄 Parallel Block C: Manifest (3 tasks)

#### Task 1.1.3a - Manifest Schema and Validation 🧪

**Status:** [ ] Not Started
**Assignee:**
**Dependencies:** Task 1.1.2a

**Test Requirements:**

```typescript
// tests/setup/manifest.test.ts
import { describe, it, expect } from 'vitest';
import { validateManifest } from '../src/types/manifest';

describe('Manifest Validation', () => {
  it('should validate manifest structure', () => {
    const manifest = {
      manifest_version: 3,
      name: 'Browser Sidebar',
      version: '0.1.0',
      permissions: ['storage', 'tabs'],
    };

    expect(validateManifest(manifest)).toBe(true);
  });

  it('should have required fields typed', () => {
    // Type checking will fail if types are wrong
    const manifest: ChromeManifest = {
      manifest_version: 3,
      // This should fail type checking if not properly typed
    };
  });
});
```

**Implementation Steps:**

1. Create manifest type definitions:

   ```typescript
   // src/types/manifest.ts
   export interface ChromeManifest {
     manifest_version: 3;
     name: string;
     version: string;
     description?: string;
     permissions?: string[];
     host_permissions?: string[];
     background?: {
       service_worker: string;
       type?: 'module';
     };
     action?: {
       default_popup?: string;
       default_icon?: Record<string, string>;
     };
     side_panel?: {
       default_path: string;
     };
     content_scripts?: Array<{
       matches: string[];
       js: string[];
       css?: string[];
     }>;
     icons?: Record<string, string>;
   }

   export function validateManifest(manifest: any): manifest is ChromeManifest {
     return (
       manifest.manifest_version === 3 &&
       typeof manifest.name === 'string' &&
       typeof manifest.version === 'string'
     );
   }
   ```

**Deliverables:**

- `src/types/manifest.ts` with type definitions
- Validation function for manifest
- Type-safe manifest handling

**Acceptance Criteria:**

- [ ] Manifest types are comprehensive
- [ ] Validation function works correctly
- [ ] Types match Chrome's manifest v3 spec

---

#### Task 1.1.3b - Manifest Implementation

**Status:** [ ] Not Started
**Assignee:**
**Dependencies:** Task 1.1.3a

**Implementation Steps:**

1. Create `public/manifest.json`:
   ```json
   {
     "manifest_version": 3,
     "name": "AI Browser Sidebar",
     "version": "0.1.0",
     "description": "Chat with any webpage using AI",
     "permissions": ["storage", "tabs", "activeTab", "sidePanel"],
     "host_permissions": ["<all_urls>"],
     "background": {
       "service_worker": "src/background/index.ts",
       "type": "module"
     },
     "action": {
       "default_popup": "popup.html",
       "default_icon": {
         "16": "icons/icon16.png",
         "32": "icons/icon32.png",
         "48": "icons/icon48.png",
         "128": "icons/icon128.png"
       }
     },
     "side_panel": {
       "default_path": "sidepanel.html"
     },
     "content_scripts": [
       {
         "matches": ["<all_urls>"],
         "js": ["src/content/index.ts"],
         "run_at": "document_idle"
       }
     ],
     "icons": {
       "16": "icons/icon16.png",
       "32": "icons/icon32.png",
       "48": "icons/icon48.png",
       "128": "icons/icon128.png"
     }
   }
   ```

**Deliverables:**

- `public/manifest.json` with all permissions
- Proper service worker registration
- Content script configuration

**Acceptance Criteria:**

- [ ] Manifest passes Chrome validation
- [ ] All required permissions included
- [ ] Extension loads in Chrome

---

#### Task 1.1.3c - Icon Assets

**Status:** [ ] Not Started
**Assignee:**
**Dependencies:** Task 1.1.3b

**Test Requirements:**

```javascript
// tests/setup/icons.test.js
import fs from 'fs';
import path from 'path';

describe('Icon Assets', () => {
  const sizes = [16, 32, 48, 128];

  sizes.forEach(size => {
    it(`should have ${size}x${size} icon`, () => {
      const iconPath = path.join('public', 'icons', `icon${size}.png`);
      expect(fs.existsSync(iconPath)).toBe(true);
    });
  });
});
```

**Implementation Steps:**

1. Create placeholder icons (or use actual designs):
   ```bash
   # Create placeholder icons with ImageMagick or similar
   for size in 16 32 48 128; do
     convert -size ${size}x${size} xc:blue \
       -gravity center -fill white \
       -pointsize $((size/4)) -annotate +0+0 "AI" \
       public/icons/icon${size}.png
   done
   ```
2. Optimize icons for size
3. Ensure PNG format with transparency

**Deliverables:**

- Icon files: 16x16, 32x32, 48x48, 128x128
- All icons in `public/icons/` directory
- Icons referenced in manifest.json

**Acceptance Criteria:**

- [ ] All required icon sizes exist
- [ ] Icons are valid PNG files
- [ ] Icons display correctly in Chrome

---

## Phase 1.2: Test Infrastructure (3 tasks)

**Goal:** Set up comprehensive testing framework

### ⚡ Sequential Block: Testing Setup

#### Task 1.2.1 - Vitest Configuration 🧪

**Status:** [ ] Not Started
**Assignee:**
**Dependencies:** Task 1.1.2a (TypeScript must be configured)

**Implementation Steps:**

1. Install Vitest and dependencies:
   ```bash
   npm install -D vitest @vitest/ui @vitest/coverage-c8
   npm install -D jsdom happy-dom
   ```
2. Create `vitest.config.ts`:

   ```typescript
   import { defineConfig } from 'vitest/config';
   import react from '@vitejs/plugin-react';
   import path from 'path';

   export default defineConfig({
     plugins: [react()],
     test: {
       globals: true,
       environment: 'jsdom',
       setupFiles: ['./tests/setup.ts'],
       coverage: {
         provider: 'c8',
         reporter: ['text', 'json', 'html'],
         exclude: ['node_modules/', 'tests/', '*.config.ts', 'dist/'],
       },
       alias: {
         '@': path.resolve(__dirname, './src'),
         '@components': path.resolve(__dirname, './src/components'),
         '@utils': path.resolve(__dirname, './src/utils'),
         '@types': path.resolve(__dirname, './src/types'),
       },
     },
   });
   ```

3. Create test setup file:

   ```typescript
   // tests/setup.ts
   import '@testing-library/jest-dom';
   import { expect, afterEach } from 'vitest';
   import { cleanup } from '@testing-library/react';
   import matchers from '@testing-library/jest-dom/matchers';

   expect.extend(matchers);

   afterEach(() => {
     cleanup();
   });
   ```

**Deliverables:**

- `vitest.config.ts` configuration
- Test setup files
- Coverage configuration

**Acceptance Criteria:**

- [ ] `npm run test` executes successfully
- [ ] Coverage reports generate
- [ ] Test environment configured

---

#### Task 1.2.2 - React Testing Library Setup 🧪

**Status:** [ ] Not Started
**Assignee:**
**Dependencies:** Task 1.2.1

**Implementation Steps:**

1. Install React Testing Library:
   ```bash
   npm install -D @testing-library/react @testing-library/user-event
   npm install -D @testing-library/jest-dom
   ```
2. Create custom render function:

   ```typescript
   // tests/utils/test-utils.tsx
   import React, { ReactElement } from 'react';
   import { render, RenderOptions } from '@testing-library/react';

   const AllTheProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
     // Add providers here as needed (Theme, Store, etc.)
     return <>{children}</>;
   };

   const customRender = (
     ui: ReactElement,
     options?: Omit<RenderOptions, 'wrapper'>
   ) => render(ui, { wrapper: AllTheProviders, ...options });

   export * from '@testing-library/react';
   export { customRender as render };
   ```

3. Create sample component test:

   ```typescript
   // tests/components/Button.test.tsx
   import { describe, it, expect, vi } from 'vitest';
   import { render, screen, fireEvent } from '../utils/test-utils';

   describe('Button Component', () => {
     it('should render and handle click', () => {
       const handleClick = vi.fn();
       render(<button onClick={handleClick}>Click me</button>);

       const button = screen.getByText('Click me');
       fireEvent.click(button);

       expect(handleClick).toHaveBeenCalledTimes(1);
     });
   });
   ```

**Deliverables:**

- Testing library setup
- Custom render utilities
- Mock providers setup

**Acceptance Criteria:**

- [ ] Can test React components
- [ ] Custom render function works
- [ ] User interactions testable

---

#### Task 1.2.3 - Chrome API Mocks 🧪

**Status:** [ ] Not Started
**Assignee:**
**Dependencies:** Task 1.2.1

**Implementation Steps:**

1. Create Chrome API mocks:

   ```typescript
   // tests/mocks/chrome.ts
   export const mockChrome = {
     runtime: {
       id: 'test-extension-id',
       sendMessage: vi.fn((message, callback) => {
         if (callback) callback({ success: true });
         return Promise.resolve({ success: true });
       }),
       onMessage: {
         addListener: vi.fn(),
         removeListener: vi.fn(),
         hasListener: vi.fn(() => false),
       },
       lastError: null,
     },
     storage: {
       local: {
         get: vi.fn((keys, callback) => {
           const result = {};
           if (callback) callback(result);
           return Promise.resolve(result);
         }),
         set: vi.fn((items, callback) => {
           if (callback) callback();
           return Promise.resolve();
         }),
         remove: vi.fn((keys, callback) => {
           if (callback) callback();
           return Promise.resolve();
         }),
         clear: vi.fn(callback => {
           if (callback) callback();
           return Promise.resolve();
         }),
       },
       sync: {
         get: vi.fn(),
         set: vi.fn(),
       },
     },
     tabs: {
       query: vi.fn((queryInfo, callback) => {
         const tabs = [{ id: 1, url: 'https://example.com', title: 'Example' }];
         if (callback) callback(tabs);
         return Promise.resolve(tabs);
       }),
       sendMessage: vi.fn(),
       create: vi.fn(),
       update: vi.fn(),
     },
   };

   // Set up global chrome object
   global.chrome = mockChrome as any;
   ```

2. Create mock setup for tests:

   ```typescript
   // tests/setup/chrome-mock.ts
   import { beforeEach, afterEach } from 'vitest';
   import { mockChrome } from '../mocks/chrome';

   beforeEach(() => {
     global.chrome = mockChrome as any;
   });

   afterEach(() => {
     vi.clearAllMocks();
   });
   ```

**Deliverables:**

- `tests/mocks/chrome.ts` with API mocks
- Storage mocks
- Runtime mocks
- Tab API mocks

**Acceptance Criteria:**

- [ ] Chrome APIs mocked successfully
- [ ] Can test extension-specific code
- [ ] Mocks reset between tests

---

## Phase 1.3: Core Extension Components (3 tasks)

**Goal:** Implement message passing and service worker

### ⚡ Sequential Block: Core Implementation

#### Task 1.3.1 - Message Types and Protocol 🧪

**Status:** [ ] Not Started
**Assignee:**
**Dependencies:** Task 1.1.2a

**Test Requirements:**

```typescript
// tests/types/messages.test.ts
import { describe, it, expect } from 'vitest';
import { Message, isValidMessage, createMessage } from '@/types/messages';

describe('Message Protocol', () => {
  it('should validate message structure', () => {
    const message = createMessage('TEST_ACTION', { data: 'test' });
    expect(isValidMessage(message)).toBe(true);
    expect(message.type).toBe('TEST_ACTION');
    expect(message.payload).toEqual({ data: 'test' });
  });

  it('should have unique message IDs', () => {
    const msg1 = createMessage('ACTION', {});
    const msg2 = createMessage('ACTION', {});
    expect(msg1.id).not.toBe(msg2.id);
  });

  it('should validate message types', () => {
    const invalidMessage = { type: 123, payload: {} };
    expect(isValidMessage(invalidMessage)).toBe(false);
  });
});
```

**Implementation Steps:**

1. Create message type definitions:

   ```typescript
   // src/types/messages.ts
   export type MessageType =
     | 'EXTRACT_CONTENT'
     | 'CONTENT_EXTRACTED'
     | 'SEND_TO_AI'
     | 'AI_RESPONSE'
     | 'ERROR'
     | 'PING'
     | 'PONG';

   export interface Message<T = any> {
     id: string;
     type: MessageType;
     payload: T;
     timestamp: number;
     source: 'popup' | 'content' | 'background' | 'sidepanel';
     target?: 'popup' | 'content' | 'background' | 'sidepanel';
   }

   export function createMessage<T>(
     type: MessageType,
     payload: T,
     source: Message['source'] = 'background'
   ): Message<T> {
     return {
       id: crypto.randomUUID(),
       type,
       payload,
       timestamp: Date.now(),
       source,
     };
   }

   export function isValidMessage(msg: any): msg is Message {
     return (
       typeof msg === 'object' &&
       typeof msg.id === 'string' &&
       typeof msg.type === 'string' &&
       typeof msg.timestamp === 'number' &&
       typeof msg.source === 'string'
     );
   }
   ```

2. Create message validation utilities:

   ```typescript
   // src/utils/messageValidation.ts
   import { Message, MessageType } from '@/types/messages';

   export class MessageValidator {
     private static validTypes = new Set<MessageType>([
       'EXTRACT_CONTENT',
       'CONTENT_EXTRACTED',
       'SEND_TO_AI',
       'AI_RESPONSE',
       'ERROR',
       'PING',
       'PONG',
     ]);

     static validate(message: any): message is Message {
       if (!message || typeof message !== 'object') return false;
       if (!this.validTypes.has(message.type)) return false;
       if (!message.id || !message.timestamp) return false;
       return true;
     }

     static validatePayload<T>(
       message: Message,
       validator: (payload: any) => payload is T
     ): message is Message<T> {
       return this.validate(message) && validator(message.payload);
     }
   }
   ```

**Deliverables:**

- `src/types/messages.ts` with message types
- `src/utils/messageValidation.ts` with validators
- Message factory functions
- Type guards for messages

**Acceptance Criteria:**

- [ ] Message types are comprehensive
- [ ] Validation functions work correctly
- [ ] Messages have unique IDs
- [ ] Type safety enforced

---

#### Task 1.3.2 - Background Service Worker 🧪

**Status:** [ ] Not Started
**Assignee:**
**Dependencies:** Task 1.3.1

**Test Requirements:**

```typescript
// tests/background/messageHandler.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageHandler } from '@/background/messageHandler';
import { createMessage } from '@/types/messages';

describe('Background Message Handler', () => {
  let handler: MessageHandler;

  beforeEach(() => {
    handler = new MessageHandler();
  });

  it('should handle PING messages', async () => {
    const pingMessage = createMessage('PING', {});
    const response = await handler.handleMessage(pingMessage);

    expect(response.type).toBe('PONG');
    expect(response.payload).toEqual({ originalId: pingMessage.id });
  });

  it('should route messages to correct handlers', async () => {
    const contentMessage = createMessage('EXTRACT_CONTENT', {
      tabId: 1,
    });

    const mockTabsSendMessage = vi.spyOn(chrome.tabs, 'sendMessage');
    await handler.handleMessage(contentMessage);

    expect(mockTabsSendMessage).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ type: 'EXTRACT_CONTENT' })
    );
  });

  it('should handle errors gracefully', async () => {
    const invalidMessage = createMessage('INVALID_TYPE' as any, {});
    const response = await handler.handleMessage(invalidMessage);

    expect(response.type).toBe('ERROR');
    expect(response.payload.error).toBeDefined();
  });
});
```

**Implementation Steps:**

1. Create service worker entry:

   ```typescript
   // src/background/index.ts
   import { MessageHandler } from './messageHandler';
   import { KeepAlive } from './keepAlive';

   const messageHandler = new MessageHandler();
   const keepAlive = new KeepAlive();

   // Handle extension installation
   chrome.runtime.onInstalled.addListener(details => {
     console.log('Extension installed:', details);

     // Set default settings
     chrome.storage.local.set({
       settings: {
         theme: 'auto',
         provider: 'openai',
       },
     });
   });

   // Handle messages
   chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
     messageHandler
       .handleMessage(message, sender)
       .then(sendResponse)
       .catch(error =>
         sendResponse({
           type: 'ERROR',
           payload: { error: error.message },
         })
       );

     return true; // Keep channel open for async response
   });

   // Keep service worker alive
   keepAlive.start();
   ```

2. Create message handler:

   ```typescript
   // src/background/messageHandler.ts
   import { Message, createMessage } from '@/types/messages';

   export class MessageHandler {
     private handlers = new Map<string, Function>();

     constructor() {
       this.registerHandlers();
     }

     private registerHandlers() {
       this.handlers.set('PING', this.handlePing.bind(this));
       this.handlers.set('EXTRACT_CONTENT', this.handleExtractContent.bind(this));
       this.handlers.set('SEND_TO_AI', this.handleSendToAI.bind(this));
     }

     async handleMessage(
       message: Message,
       sender?: chrome.runtime.MessageSender
     ): Promise<Message> {
       const handler = this.handlers.get(message.type);

       if (!handler) {
         return createMessage('ERROR', {
           error: `Unknown message type: ${message.type}`,
           originalMessage: message,
         });
       }

       try {
         return await handler(message, sender);
       } catch (error) {
         return createMessage('ERROR', {
           error: error.message,
           originalMessage: message,
         });
       }
     }

     private async handlePing(message: Message): Promise<Message> {
       return createMessage('PONG', { originalId: message.id });
     }

     private async handleExtractContent(message: Message<{ tabId: number }>): Promise<Message> {
       const response = await chrome.tabs.sendMessage(
         message.payload.tabId,
         createMessage('EXTRACT_CONTENT', {})
       );
       return response;
     }

     private async handleSendToAI(
       message: Message<{ content: string; query: string }>
     ): Promise<Message> {
       // Placeholder for AI integration
       return createMessage('AI_RESPONSE', {
         response: 'AI response will be implemented in Stage 4',
       });
     }
   }
   ```

3. Create keep-alive mechanism:

   ```typescript
   // src/background/keepAlive.ts
   export class KeepAlive {
     private interval: number | null = null;
     private readonly INTERVAL_MS = 20000; // 20 seconds

     start() {
       if (this.interval) return;

       this.interval = setInterval(() => {
         chrome.runtime.getPlatformInfo(() => {
           // Keep-alive ping
         });
       }, this.INTERVAL_MS);
     }

     stop() {
       if (this.interval) {
         clearInterval(this.interval);
         this.interval = null;
       }
     }
   }
   ```

**Deliverables:**

- `src/background/index.ts` - Service worker entry
- `src/background/messageHandler.ts` - Message routing
- `src/background/keepAlive.ts` - Worker persistence
- `tests/background/messageHandler.test.ts` - Tests

**Acceptance Criteria:**

- [ ] Service worker initializes
- [ ] Messages are routed correctly
- [ ] Keep-alive mechanism works
- [ ] Error handling implemented
- [ ] All tests pass

---

#### Task 1.3.3 - Message Passing Utilities 🧪

**Status:** [ ] Not Started
**Assignee:**
**Dependencies:** Task 1.3.2

**Test Requirements:**

```typescript
// tests/utils/messaging.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageBus } from '@/utils/messaging';
import { createMessage } from '@/types/messages';

describe('Message Bus', () => {
  let messageBus: MessageBus;

  beforeEach(() => {
    messageBus = new MessageBus();
  });

  it('should send messages and wait for response', async () => {
    const mockResponse = createMessage('PONG', {});
    chrome.runtime.sendMessage = vi.fn().mockResolvedValue(mockResponse);

    const response = await messageBus.send('PING', {});
    expect(response.type).toBe('PONG');
  });

  it('should timeout if no response', async () => {
    chrome.runtime.sendMessage = vi.fn().mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    await expect(messageBus.send('PING', {}, { timeout: 100 })).rejects.toThrow('Message timeout');
  });

  it('should retry on failure', async () => {
    let attempts = 0;
    chrome.runtime.sendMessage = vi.fn().mockImplementation(() => {
      attempts++;
      if (attempts < 3) {
        return Promise.reject(new Error('Network error'));
      }
      return Promise.resolve(createMessage('PONG', {}));
    });

    const response = await messageBus.send(
      'PING',
      {},
      {
        retries: 3,
      }
    );

    expect(response.type).toBe('PONG');
    expect(attempts).toBe(3);
  });
});
```

**Implementation Steps:**

1. Create message bus utility:

   ```typescript
   // src/utils/messaging.ts
   import { Message, MessageType, createMessage } from '@/types/messages';

   export interface SendOptions {
     timeout?: number;
     retries?: number;
     target?: Message['target'];
   }

   export class MessageBus {
     private readonly DEFAULT_TIMEOUT = 5000;
     private readonly DEFAULT_RETRIES = 3;

     async send<T, R = any>(
       type: MessageType,
       payload: T,
       options: SendOptions = {}
     ): Promise<Message<R>> {
       const { timeout = this.DEFAULT_TIMEOUT, retries = this.DEFAULT_RETRIES, target } = options;

       const message = createMessage(type, payload);
       if (target) message.target = target;

       return this.sendWithRetry(message, retries, timeout);
     }

     private async sendWithRetry(
       message: Message,
       retries: number,
       timeout: number
     ): Promise<Message> {
       for (let attempt = 1; attempt <= retries; attempt++) {
         try {
           return await this.sendWithTimeout(message, timeout);
         } catch (error) {
           if (attempt === retries) throw error;

           // Exponential backoff
           await this.delay(Math.pow(2, attempt) * 100);
         }
       }

       throw new Error('Max retries exceeded');
     }

     private sendWithTimeout(message: Message, timeout: number): Promise<Message> {
       return Promise.race([
         chrome.runtime.sendMessage(message),
         new Promise<never>((_, reject) =>
           setTimeout(() => reject(new Error('Message timeout')), timeout)
         ),
       ]);
     }

     private delay(ms: number): Promise<void> {
       return new Promise(resolve => setTimeout(resolve, ms));
     }

     // Subscribe to messages
     subscribe(
       type: MessageType | MessageType[],
       handler: (message: Message) => void | Promise<void>
     ): () => void {
       const types = Array.isArray(type) ? type : [type];

       const listener = (
         message: Message,
         sender: chrome.runtime.MessageSender,
         sendResponse: (response?: any) => void
       ) => {
         if (types.includes(message.type)) {
           const result = handler(message);

           if (result instanceof Promise) {
             result.then(sendResponse).catch(error =>
               sendResponse({
                 type: 'ERROR',
                 payload: { error: error.message },
               })
             );
             return true; // Keep channel open
           }
         }
       };

       chrome.runtime.onMessage.addListener(listener);

       // Return unsubscribe function
       return () => {
         chrome.runtime.onMessage.removeListener(listener);
       };
     }
   }

   // Export singleton instance
   export const messageBus = new MessageBus();
   ```

2. Create error handling utilities:

   ```typescript
   // src/utils/errorHandling.ts
   export class ExtensionError extends Error {
     constructor(
       message: string,
       public code: string,
       public details?: any
     ) {
       super(message);
       this.name = 'ExtensionError';
     }
   }

   export function handleChromeError(): void {
     if (chrome.runtime.lastError) {
       throw new ExtensionError(
         chrome.runtime.lastError.message || 'Chrome API error',
         'CHROME_API_ERROR'
       );
     }
   }
   ```

**Deliverables:**

- `src/utils/messaging.ts` - Message bus utility
- `src/utils/errorHandling.ts` - Error utilities
- `tests/utils/messaging.test.ts` - Tests
- Retry logic with exponential backoff
- Timeout handling

**Acceptance Criteria:**

- [ ] Messages send successfully
- [ ] Timeout handling works
- [ ] Retry logic implemented
- [ ] Subscribe/unsubscribe works
- [ ] All tests pass

---

## Stage 1 Completion Checklist

### Testing Requirements

- [ ] All unit tests written and passing
- [ ] Test coverage > 90% for Stage 1 code
- [ ] Integration tests for message passing
- [ ] Manual testing in Chrome browser

### Documentation

- [ ] README updated with setup instructions
- [ ] API documentation for message protocol
- [ ] Type definitions documented
- [ ] Architecture diagram created

### Quality Gates

- [ ] No TypeScript errors
- [ ] No ESLint warnings
- [ ] Prettier formatting applied
- [ ] Pre-commit hooks working
- [ ] Code reviewed

### Deliverables Verification

- [ ] Extension loads in Chrome
- [ ] Popup opens when clicked
- [ ] Side panel accessible
- [ ] Background service worker running
- [ ] Messages pass between components
- [ ] Test suite executable
- [ ] Development environment ready

## Next Stage Prerequisites

Before moving to Stage 2 (Chat Panel UI), ensure:

1. ✅ All Stage 1 tasks complete
2. ✅ Message passing working reliably
3. ✅ Test infrastructure operational
4. ✅ TypeScript/ESLint configured properly
5. ✅ Extension loads without errors

## Common Issues and Solutions

### Issue: Extension not loading

**Solution:** Check manifest.json syntax and ensure all referenced files exist

### Issue: Service worker stops responding

**Solution:** Implement keep-alive mechanism (Task 1.3.2)

### Issue: TypeScript path aliases not working

**Solution:** Ensure tsconfig.json and vite.config.ts have matching aliases

### Issue: Tests failing with Chrome API errors

**Solution:** Verify Chrome mocks are properly initialized (Task 1.2.3)

## Resources

- [Chrome Extension Manifest V3 Documentation](https://developer.chrome.com/docs/extensions/mv3/)
- [Vite + CRXJS Guide](https://crxjs.dev/vite-plugin)
- [TypeScript Strict Mode Guide](https://www.typescriptlang.org/tsconfig#strict)
- [Vitest Documentation](https://vitest.dev/)

---

_Stage 1 Task Guide Version: 1.0_
_Total Tasks: 15_
_Estimated Duration: 1-2 weeks_
_Dependencies: Clearly mapped_
