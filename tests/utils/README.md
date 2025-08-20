# Test Utilities

This directory contains custom testing utilities for the AI Browser Sidebar Extension.

## test-utils.tsx

Custom render function that wraps React Testing Library's render with necessary providers.

### Usage

```tsx
import { render, screen, userEvent } from '@tests/utils/test-utils';
import { MyComponent } from '@components/MyComponent';

test('renders component', () => {
  render(<MyComponent />);
  expect(screen.getByText('Hello')).toBeInTheDocument();
});

test('handles user interaction', async () => {
  const user = userEvent.setup();
  render(<MyButton />);
  
  await user.click(screen.getByRole('button'));
  expect(screen.getByText('Clicked!')).toBeInTheDocument();
});
```

### Features

- **Custom render**: Automatically wraps components with necessary providers
- **Provider support**: Ready to extend with Theme, Store, and other context providers
- **Re-exports**: All React Testing Library exports available
- **User events**: Pre-configured userEvent for interaction testing

### Future Extensions

The `AllTheProviders` wrapper is designed to be extended with:

- Theme providers for light/dark mode testing
- Redux/Zustand store providers for state testing
- React Query providers for data fetching tests
- Any other context providers needed

### Example Extension

```tsx
// Future provider wrapping example
const AllTheProviders: React.FC<AllTheProvidersProps> = ({ 
  children, 
  theme = 'light',
  initialStore 
}) => {
  return (
    <ThemeProvider theme={theme}>
      <StoreProvider store={initialStore}>
        {children}
      </StoreProvider>
    </ThemeProvider>
  );
};
```