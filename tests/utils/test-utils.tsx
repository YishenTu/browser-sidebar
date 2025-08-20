import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';

// This type allows for future provider additions (Theme, Store, etc.)
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  // Future provider options can be added here
  // theme?: 'light' | 'dark';
  // initialStore?: any;
}

interface AllTheProvidersProps {
  children: React.ReactNode;
}

/**
 * Custom wrapper component that can be extended with providers
 * Currently just renders children, but can be extended with:
 * - Theme providers
 * - Redux/Zustand store providers
 * - React Query providers
 * - Any other context providers needed for testing
 */
const AllTheProviders: React.FC<AllTheProvidersProps> = ({ children }) => {
  // Future provider wrapping will go here
  // Example:
  // return (
  //   <ThemeProvider theme={theme}>
  //     <StoreProvider store={store}>
  //       {children}
  //     </StoreProvider>
  //   </ThemeProvider>
  // );
  
  return <>{children}</>;
};

/**
 * Custom render function that wraps components with necessary providers
 * 
 * @param ui - The component to render
 * @param options - Custom render options
 * @returns RTL render result
 * 
 * @example
 * ```tsx
 * import { customRender } from '@tests/utils/test-utils';
 * 
 * test('renders component', () => {
 *   customRender(<MyComponent />);
 *   expect(screen.getByText('Hello')).toBeInTheDocument();
 * });
 * ```
 */
const customRender = (
  ui: ReactElement,
  options?: CustomRenderOptions
) => {
  return render(ui, {
    wrapper: AllTheProviders,
    ...options,
  });
};

// Re-export everything from React Testing Library
export * from '@testing-library/react';

// Override the default render with our custom render
export { customRender as render };

// Export user event for convenience
export { default as userEvent } from '@testing-library/user-event';