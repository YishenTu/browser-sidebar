# Testing Guide

## Testing Philosophy

We follow Test-Driven Development (TDD) principles:

1. **Red**: Write a failing test
2. **Green**: Make the test pass
3. **Refactor**: Improve the code

Target: **>90% code coverage** across all modules.

## Testing Stack

- **Unit/Integration**: Vitest
- **Component Testing**: React Testing Library + user-event
- **E2E-style flows**: Vitest (jsdom) covering full UI flows where feasible
- **Mocking**: Vitest built-in mocks
- **Coverage**: @vitest/coverage-v8

## Test Structure

```
tests/
├── e2e/                # Full UI flows in jsdom (Vitest)
├── integration/        # Component interaction tests
├── sidebar/            # Sidebar component tests (incl. performance/accessibility)
│   ├── components/     # Individual component tests
│   ├── performance-*.test.tsx
│   └── accessibility-*.test.tsx
├── store/              # Zustand store tests
└── setup/              # Test configuration (jest-dom + Chrome API mocks)
```

## Writing Tests

### Unit Tests

#### Basic Test Structure

```typescript
// tests/unit/utils/encryption.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { encrypt, decrypt } from '@/utils/encryption';

describe('Encryption Utilities', () => {
  let testData: string;

  beforeEach(() => {
    testData = 'sensitive-api-key';
  });

  it('should encrypt and decrypt data correctly', async () => {
    const encrypted = await encrypt(testData, 'password');
    const decrypted = await decrypt(encrypted, 'password');

    expect(decrypted).toBe(testData);
  });

  it('should fail with wrong password', async () => {
    const encrypted = await encrypt(testData, 'password');

    await expect(decrypt(encrypted, 'wrong')).rejects.toThrow();
  });
});
```

### Component Tests

#### Testing React Components

```typescript
// tests/sidebar/components/ChatMessage.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatMessage } from '@sidebar/components/MessageBubble';

describe('ChatMessage Component', () => {
  const mockMessage = {
    id: '1',
    content: 'Hello, world!',
    role: 'user' as const,
    timestamp: Date.now()
  };

  it('should render message content', () => {
    render(<ChatMessage message={mockMessage} />);

    expect(screen.getByText('Hello, world!')).toBeInTheDocument();
  });

  it('should handle copy button click', async () => {
    const mockCopy = vi.fn();
    global.navigator.clipboard = { writeText: mockCopy };

    render(<ChatMessage message={mockMessage} />);

    const copyButton = screen.getByRole('button', { name: /copy/i });
    fireEvent.click(copyButton);

    expect(mockCopy).toHaveBeenCalledWith('Hello, world!');
  });

  it('should render markdown correctly', () => {
    const markdownMessage = {
      ...mockMessage,
      content: '**Bold** and *italic* text'
    };

    render(<ChatMessage message={markdownMessage} />);

    const boldText = screen.getByText('Bold');
    expect(boldText).toHaveStyle({ fontWeight: 'bold' });
  });
});
```

### Integration Tests

#### Testing Component Integration

```typescript
// tests/integration/chat-flow.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChatPanel } from '@sidebar/ChatPanel';
import { mockProviders } from '../mocks/providers';

describe('Chat Flow Integration', () => {
  beforeEach(() => {
    mockProviders.setup();
  });

  it('should complete a full chat interaction', async () => {
    render(<ChatPanel />);

    // Type message
    const input = screen.getByPlaceholderText('Type your message...');
    fireEvent.change(input, { target: { value: 'Hello AI' } });

    // Send message
    const sendButton = screen.getByRole('button', { name: /send/i });
    fireEvent.click(sendButton);

    // Verify user message appears
    expect(screen.getByText('Hello AI')).toBeInTheDocument();

    // Wait for AI response
    await waitFor(() => {
      expect(screen.getByText(/AI response/i)).toBeInTheDocument();
    });
  });
});
```

### E2E-style UI Flows (Vitest)

Use Vitest + RTL to simulate full interaction flows in jsdom.

```tsx
// tests/e2e/sidebar-core.test.tsx (excerpt)
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { ModelSelector } from '@sidebar/components/ModelSelector';

describe('Model selection flow', () => {
  it('allows selecting a model via keyboard', async () => {
    const user = userEvent.setup();
    render(<ModelSelector value="GPT-4" onChange={() => {}} models={['GPT-4', 'Claude 3']} />);
    const combo = screen.getByRole('combobox');
    combo.focus();
    await user.keyboard('{Enter}{ArrowDown}{Enter}');
    expect(combo).toHaveAttribute('aria-expanded', 'false');
  });
});
```

## Mocking Strategies

### Chrome API Mocks

See `tests/setup/setup.ts` for the global Chrome mock. Example shape:

```ts
import { vi } from 'vitest';

beforeAll(() => {
  // @ts-expect-error test env mock
  global.chrome = {
    storage: { local: { get: vi.fn(), set: vi.fn() }, sync: { get: vi.fn(), set: vi.fn() } },
    runtime: { sendMessage: vi.fn(), onMessage: { addListener: vi.fn(), removeListener: vi.fn() } },
    tabs: { query: vi.fn(), sendMessage: vi.fn() },
    action: { onClicked: { addListener: vi.fn(), removeListener: vi.fn() } },
  };
});
```

### API Provider Mocks

```typescript
// tests/mocks/providers.ts
import { vi } from 'vitest';

export const mockOpenAI = {
  chat: vi.fn().mockResolvedValue({
    choices: [
      {
        message: { content: 'Mocked AI response' },
      },
    ],
  }),

  streamChat: vi.fn((request, callback) => {
    callback({ type: 'content', content: 'Streaming', finished: false });
    callback({ type: 'content', content: ' response', finished: false });
    callback({ type: 'done', finished: true });
  }),
};
```

## Test Utilities

### Custom Render Function

```typescript
// tests/utils/test-utils.tsx
import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { ThemeProvider } from '@sidebar/contexts/ThemeContext';
import { StoreProvider } from '@/contexts/StoreContext';

const AllTheProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <ThemeProvider>
      <StoreProvider>
        {children}
      </StoreProvider>
    </ThemeProvider>
  );
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

export * from '@testing-library/react';
export { customRender as render };
```

### Test Data Factories

```typescript
// tests/utils/factories.ts
export const createMessage = (overrides = {}) => ({
  id: 'test-id',
  content: 'Test message',
  role: 'user' as const,
  timestamp: Date.now(),
  ...overrides,
});

export const createConversation = (overrides = {}) => ({
  id: 'conv-test',
  title: 'Test Conversation',
  messages: [createMessage()],
  createdAt: Date.now(),
  updatedAt: Date.now(),
  ...overrides,
});
```

## Running Tests

### Command Line

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test -- --watch

# Run specific test file
npm test -- tests/sidebar/components/ChatMessage.test.tsx --run

# Run tests matching pattern
npm run test -- --grep "should render"

# Run with coverage
npm run test:coverage

# E2E-style flows (Vitest + RTL)
# Already included under tests/e2e/**/*
```

### VS Code Integration

```json
// .vscode/settings.json
{
  "vitest.enable": true,
  "vitest.commandLine": "npm run test --",
  "testing.automaticallyOpenPeekView": "never"
}
```

## Coverage Requirements

### Target Coverage

- **Overall**: >90%
- **Statements**: >90%
- **Branches**: >85%
- **Functions**: >90%
- **Lines**: >90%

### Viewing Coverage

```bash
# Generate coverage report
npm run test:coverage

# Open HTML report
open coverage/index.html
```

### Coverage Configuration

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'tests/', '*.config.ts', 'src/types/'],
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90,
      },
    },
  },
});
```

## Best Practices

### Test Organization

- One test file per source file
- Group related tests with `describe`
- Use descriptive test names
- Follow AAA pattern: Arrange, Act, Assert

### Test Quality

```typescript
// ❌ Bad: Too many assertions
it('should work', () => {
  const result = processData(input);
  expect(result.status).toBe('success');
  expect(result.data).toBeDefined();
  expect(result.data.length).toBe(10);
  expect(result.error).toBeNull();
  expect(result.timestamp).toBeDefined();
});

// ✅ Good: Focused tests
describe('processData', () => {
  it('should return success status', () => {
    const result = processData(input);
    expect(result.status).toBe('success');
  });

  it('should return correct data length', () => {
    const result = processData(input);
    expect(result.data).toHaveLength(10);
  });
});
```

### Async Testing

```typescript
// Testing async functions
it('should fetch data', async () => {
  const data = await fetchData();
  expect(data).toBeDefined();
});

// Testing promises
it('should resolve with data', () => {
  return expect(fetchData()).resolves.toEqual(expectedData);
});

// Testing rejections
it('should reject on error', () => {
  return expect(fetchWithError()).rejects.toThrow('Network error');
});
```

### Mocking Best Practices

```typescript
// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});

// Spy on existing functions
const spy = vi.spyOn(console, 'log');

// Mock modules
vi.mock('@utils/api', () => ({
  fetchData: vi.fn(),
}));

// Mock timers
vi.useFakeTimers();
vi.advanceTimersByTime(1000);
vi.useRealTimers();
```

## Debugging Tests

### Using Debug Output

```typescript
import { screen, debug } from '@testing-library/react';

it('should render correctly', () => {
  render(<Component />);

  // Print DOM tree
  debug();

  // Print specific element
  debug(screen.getByRole('button'));
});
```

### Interactive Debugging

```bash
# Run tests with UI
npm run test:ui

# Use browser DevTools
# Add debugger statement in test
debugger;
```

### VS Code Debugging

```json
// .vscode/launch.json
{
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Tests",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "test", "--", "--run"],
      "console": "integratedTerminal"
    }
  ]
}
```

## Continuous Integration

### GitHub Actions

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v3
```

---

_Testing Guide Version: 1.0_  
_Last Updated: 2025-08-19_
