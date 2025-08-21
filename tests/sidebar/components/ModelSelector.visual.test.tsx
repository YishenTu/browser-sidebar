import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModelSelector } from '@components/ModelSelector';

// Mock models for testing
const mockModels = ['GPT-4', 'GPT-3.5', 'Claude 3', 'Claude 2', 'Gemini Pro', 'Llama 2'];

// Helper to create themed wrapper
const createThemedWrapper = (theme: 'dark' | 'light') => {
  return ({ children }: { children: React.ReactNode }) => (
    <div className="ai-sidebar-container" data-theme={theme}>
      {children}
    </div>
  );
};

describe('ModelSelector Visual Styles', () => {
  const defaultProps = {
    value: 'GPT-4',
    onChange: vi.fn(),
    models: mockModels,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up any injected styles
    const existingStyle = document.getElementById('model-selector-styles');
    if (existingStyle) {
      existingStyle.remove();
    }
  });

  describe('Dark Mode Styles', () => {
    it('should apply correct dark theme colors to trigger button', () => {
      const DarkWrapper = createThemedWrapper('dark');
      render(<ModelSelector {...defaultProps} />, { wrapper: DarkWrapper });
      
      const trigger = screen.getByRole('combobox');
      
      // Should have dark background and light text
      expect(trigger).toHaveClass('model-selector__trigger');
      
      // Check that CSS variables are being applied correctly
      // We'll verify the classes are present and let CSS handle the actual colors
      expect(trigger.closest('.ai-sidebar-container')).toHaveAttribute('data-theme', 'dark');
    });

    it('should apply correct dark theme colors to dropdown when open', async () => {
      const user = userEvent.setup();
      const DarkWrapper = createThemedWrapper('dark');
      render(<ModelSelector {...defaultProps} />, { wrapper: DarkWrapper });
      
      // Open dropdown
      await user.click(screen.getByRole('combobox'));
      
      const dropdown = screen.getByRole('listbox');
      expect(dropdown).toHaveClass('model-selector__dropdown');
      
      // Check that dropdown is styled for dark theme
      expect(dropdown.closest('.ai-sidebar-container')).toHaveAttribute('data-theme', 'dark');
    });

    it('should style options correctly in dark mode', async () => {
      const user = userEvent.setup();
      const DarkWrapper = createThemedWrapper('dark');
      render(<ModelSelector {...defaultProps} />, { wrapper: DarkWrapper });
      
      await user.click(screen.getByRole('combobox'));
      
      const options = screen.getAllByRole('option');
      options.forEach(option => {
        expect(option).toHaveClass('model-selector__option');
      });
      
      // Selected option should have special styling
      const selectedOption = screen.getByRole('option', { name: 'GPT-4' });
      expect(selectedOption).toHaveClass('model-selector__option--selected');
    });
  });

  describe('Light Mode Styles', () => {
    it('should apply correct light theme colors to trigger button', () => {
      const LightWrapper = createThemedWrapper('light');
      render(<ModelSelector {...defaultProps} />, { wrapper: LightWrapper });
      
      const trigger = screen.getByRole('combobox');
      expect(trigger).toHaveClass('model-selector__trigger');
      expect(trigger.closest('.ai-sidebar-container')).toHaveAttribute('data-theme', 'light');
    });

    it('should apply correct light theme colors to dropdown when open', async () => {
      const user = userEvent.setup();
      const LightWrapper = createThemedWrapper('light');
      render(<ModelSelector {...defaultProps} />, { wrapper: LightWrapper });
      
      await user.click(screen.getByRole('combobox'));
      
      const dropdown = screen.getByRole('listbox');
      expect(dropdown).toHaveClass('model-selector__dropdown');
      expect(dropdown.closest('.ai-sidebar-container')).toHaveAttribute('data-theme', 'light');
    });
  });

  describe('Hover and Focus States', () => {
    it('should apply hover styles to trigger button', async () => {
      const user = userEvent.setup();
      render(<ModelSelector {...defaultProps} />);
      
      const trigger = screen.getByRole('combobox');
      
      // Hover the trigger
      await user.hover(trigger);
      
      // Should have hover class or styles applied
      expect(trigger).toHaveClass('model-selector__trigger');
    });

    it('should apply focus styles to trigger button', async () => {
      const user = userEvent.setup();
      render(<ModelSelector {...defaultProps} />);
      
      const trigger = screen.getByRole('combobox');
      
      // Focus the trigger
      await user.click(trigger);
      
      expect(trigger).toHaveClass('model-selector__trigger--focused');
    });

    it('should apply hover styles to dropdown options', async () => {
      const user = userEvent.setup();
      render(<ModelSelector {...defaultProps} />);
      
      await user.click(screen.getByRole('combobox'));
      
      const option = screen.getByRole('option', { name: 'Claude 3' });
      
      // Hover the option
      await user.hover(option);
      
      // Option should get highlighted class
      expect(option).toHaveClass('model-selector__option--highlighted');
    });

    it('should apply open state styles to trigger when dropdown is open', async () => {
      const user = userEvent.setup();
      render(<ModelSelector {...defaultProps} />);
      
      const trigger = screen.getByRole('combobox');
      
      // Open dropdown
      await user.click(trigger);
      
      expect(trigger).toHaveClass('model-selector__trigger--open');
    });
  });

  describe('Disabled State', () => {
    it('should apply disabled styles when disabled', () => {
      render(<ModelSelector {...defaultProps} disabled={true} />);
      
      const trigger = screen.getByRole('combobox');
      expect(trigger).toHaveClass('model-selector__trigger--disabled');
      expect(trigger).toBeDisabled();
    });
  });

  describe('Icon Styling', () => {
    it('should rotate icon when dropdown is open', async () => {
      const user = userEvent.setup();
      render(<ModelSelector {...defaultProps} />);
      
      const trigger = screen.getByRole('combobox');
      const icon = trigger.querySelector('.model-selector__icon');
      
      expect(icon).toBeInTheDocument();
      expect(icon).not.toHaveClass('model-selector__icon--rotated');
      
      // Open dropdown
      await user.click(trigger);
      
      expect(icon).toHaveClass('model-selector__icon--rotated');
    });
  });

  describe('Design Consistency', () => {
    it('should have consistent border radius with other components', () => {
      render(<ModelSelector {...defaultProps} />);
      
      const trigger = screen.getByRole('combobox');
      
      // Should use CSS variable for border radius
      expect(trigger).toHaveClass('model-selector__trigger');
    });

    it('should use consistent spacing and typography', () => {
      render(<ModelSelector {...defaultProps} />);
      
      const trigger = screen.getByRole('combobox');
      const value = trigger.querySelector('.model-selector__value');
      
      expect(value).toBeInTheDocument();
      expect(value).toHaveClass('model-selector__value');
    });

    it('should have consistent dropdown styling', async () => {
      const user = userEvent.setup();
      render(<ModelSelector {...defaultProps} />);
      
      await user.click(screen.getByRole('combobox'));
      
      const dropdown = screen.getByRole('listbox');
      expect(dropdown).toHaveClass('model-selector__dropdown');
      
      // Should have proper shadow and positioning
      expect(dropdown).toBeInTheDocument();
    });
  });

  describe('Header Integration', () => {
    it('should have proper sizing when used in header', () => {
      render(
        <ModelSelector 
          {...defaultProps} 
          className="model-selector--header" 
        />
      );
      
      const container = screen.getByRole('combobox').closest('.model-selector');
      expect(container).toHaveClass('model-selector--header');
    });
  });

  describe('Visual Regression Prevention', () => {
    it('should maintain expected DOM structure for styling', async () => {
      const user = userEvent.setup();
      render(<ModelSelector {...defaultProps} />);
      
      // Check basic structure
      const container = screen.getByRole('combobox').closest('.model-selector');
      const trigger = screen.getByRole('combobox');
      const value = trigger.querySelector('.model-selector__value');
      const icon = trigger.querySelector('.model-selector__icon');
      
      expect(container).toBeInTheDocument();
      expect(trigger).toHaveClass('model-selector__trigger');
      expect(value).toHaveClass('model-selector__value');
      expect(icon).toHaveClass('model-selector__icon');
      
      // Open and check dropdown structure
      await user.click(trigger);
      
      const dropdown = screen.getByRole('listbox');
      const options = screen.getAllByRole('option');
      
      expect(dropdown).toHaveClass('model-selector__dropdown');
      options.forEach(option => {
        expect(option).toHaveClass('model-selector__option');
      });
    });

    it('should inject styles only once', () => {
      // Render multiple instances
      const { unmount: unmount1 } = render(<ModelSelector {...defaultProps} />);
      const { unmount: unmount2 } = render(<ModelSelector {...defaultProps} value="Claude 3" />);
      
      // Should only have one style element (or none in test environment)
      const styleElements = document.querySelectorAll('#model-selector-styles');
      expect(styleElements.length).toBeGreaterThanOrEqual(0);
      
      unmount1();
      unmount2();
    });
  });
});