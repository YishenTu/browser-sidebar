import React from 'react';
import { render, screen, userEvent } from '@tests/utils/test-utils';
import { describe, it, expect, vi } from 'vitest';
import { Input } from '@/components/ui/Input';

describe('Input Component', () => {
  describe('Basic Rendering', () => {
    it('renders input element', () => {
      render(<Input />);
      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
      expect(input).toHaveClass('input', 'input-md');
    });

    it('renders with placeholder', () => {
      const placeholder = 'Enter your text';
      render(<Input placeholder={placeholder} />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('placeholder', placeholder);
    });

    it('renders with default value', () => {
      const defaultValue = 'Default text';
      render(<Input defaultValue={defaultValue} />);
      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe(defaultValue);
    });

    it('renders with controlled value', () => {
      const value = 'Controlled text';
      render(<Input value={value} onChange={() => {}} />);
      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe(value);
    });
  });

  describe('Input Types', () => {
    it('renders with text type by default', () => {
      render(<Input />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('type', 'text');
    });

    it('renders with email type', () => {
      render(<Input type="email" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('type', 'email');
    });

    it('renders with password type', () => {
      render(<Input type="password" />);
      const input = document.querySelector('input[type="password"]') as HTMLInputElement;
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('type', 'password');
    });

    it('renders with number type', () => {
      render(<Input type="number" />);
      const input = screen.getByRole('spinbutton');
      expect(input).toHaveAttribute('type', 'number');
    });

    it('renders with search type', () => {
      render(<Input type="search" />);
      const input = screen.getByRole('searchbox');
      expect(input).toHaveAttribute('type', 'search');
    });
  });

  describe('Sizes', () => {
    it('renders with small size', () => {
      render(<Input size="sm" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('input-sm');
      expect(input).not.toHaveClass('input-md', 'input-lg');
    });

    it('renders with medium size (default)', () => {
      render(<Input />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('input-md');
      expect(input).not.toHaveClass('input-sm', 'input-lg');
    });

    it('renders with large size', () => {
      render(<Input size="lg" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('input-lg');
      expect(input).not.toHaveClass('input-sm', 'input-md');
    });
  });

  describe('States', () => {
    it('renders disabled state', () => {
      render(<Input disabled />);
      const input = screen.getByRole('textbox');
      expect(input).toBeDisabled();
      expect(input).toHaveAttribute('disabled');
    });

    it('renders readonly state', () => {
      render(<Input readOnly />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('readonly');
    });

    it('renders required state', () => {
      render(<Input required />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('required');
      expect(input).toBeRequired();
    });

    it('renders error state', () => {
      render(<Input error />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('error');
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('renders success state', () => {
      render(<Input success />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('success');
    });
  });

  describe('Labels and Helper Text', () => {
    it('renders with label', () => {
      const labelText = 'Username';
      render(<Input label={labelText} />);
      const input = screen.getByRole('textbox');
      const label = screen.getByLabelText(labelText);
      expect(label).toBeInTheDocument();
      expect(input).toHaveAccessibleName(labelText);
    });

    it('renders with helper text', () => {
      const helperText = 'Enter at least 3 characters';
      render(<Input helperText={helperText} />);
      const helper = screen.getByText(helperText);
      expect(helper).toBeInTheDocument();

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-describedby', expect.stringContaining('helper'));
    });

    it('renders with error message', () => {
      const errorMessage = 'This field is required';
      render(<Input error errorMessage={errorMessage} />);
      const error = screen.getByText(errorMessage);
      expect(error).toBeInTheDocument();
      expect(error).toHaveClass('error-text');

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-describedby', expect.stringContaining('error'));
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('renders with success message', () => {
      const successMessage = 'Valid input';
      render(<Input success successMessage={successMessage} />);
      const success = screen.getByText(successMessage);
      expect(success).toBeInTheDocument();
      expect(success).toHaveClass('success-text');
    });
  });

  describe('Icons', () => {
    it('renders with left icon', () => {
      const LeftIcon = () => <span data-testid="left-icon">🔍</span>;
      render(<Input leftIcon={<LeftIcon />} />);
      const leftIcon = screen.getByTestId('left-icon');
      expect(leftIcon).toBeInTheDocument();
    });

    it('renders with right icon', () => {
      const RightIcon = () => <span data-testid="right-icon">👁️</span>;
      render(<Input rightIcon={<RightIcon />} />);
      const rightIcon = screen.getByTestId('right-icon');
      expect(rightIcon).toBeInTheDocument();
    });

    it('renders with both left and right icons', () => {
      const LeftIcon = () => <span data-testid="left-icon">🔍</span>;
      const RightIcon = () => <span data-testid="right-icon">👁️</span>;
      render(<Input leftIcon={<LeftIcon />} rightIcon={<RightIcon />} />);
      expect(screen.getByTestId('left-icon')).toBeInTheDocument();
      expect(screen.getByTestId('right-icon')).toBeInTheDocument();
    });

    it('applies correct padding when icons are present', () => {
      const LeftIcon = () => <span data-testid="left-icon">🔍</span>;
      const RightIcon = () => <span data-testid="right-icon">👁️</span>;

      const { rerender } = render(<Input leftIcon={<LeftIcon />} />);
      let input = screen.getByRole('textbox');
      expect(input).toHaveClass('pl-10');

      rerender(<Input rightIcon={<RightIcon />} />);
      input = screen.getByRole('textbox');
      expect(input).toHaveClass('pr-10');

      rerender(<Input leftIcon={<LeftIcon />} rightIcon={<RightIcon />} />);
      input = screen.getByRole('textbox');
      expect(input).toHaveClass('pl-10', 'pr-10');
    });
  });

  describe('User Interactions', () => {
    it('handles value changes in controlled mode', async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();
      const newValue = 'New text';

      render(<Input value="" onChange={handleChange} />);
      const input = screen.getByRole('textbox');

      await user.type(input, newValue);

      expect(handleChange).toHaveBeenCalledTimes(newValue.length);
      // Check that onChange was called with the correct event structure
      expect(handleChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          target: expect.objectContaining({
            value: expect.any(String),
          }),
        })
      );
    });

    it('handles value changes in uncontrolled mode', async () => {
      const user = userEvent.setup();
      const newValue = 'New text';

      render(<Input defaultValue="" />);
      const input = screen.getByRole('textbox') as HTMLInputElement;

      await user.type(input, newValue);

      expect(input.value).toBe(newValue);
    });

    it('handles focus events', async () => {
      const user = userEvent.setup();
      const handleFocus = vi.fn();

      render(<Input onFocus={handleFocus} />);
      const input = screen.getByRole('textbox');

      await user.click(input);

      expect(handleFocus).toHaveBeenCalledTimes(1);
      expect(input).toHaveFocus();
    });

    it('handles blur events', async () => {
      const user = userEvent.setup();
      const handleBlur = vi.fn();

      render(<Input onBlur={handleBlur} />);
      const input = screen.getByRole('textbox');

      await user.click(input);
      await user.tab();

      expect(handleBlur).toHaveBeenCalledTimes(1);
      expect(input).not.toHaveFocus();
    });

    it('does not trigger events when disabled', async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();
      const handleFocus = vi.fn();

      render(<Input disabled onChange={handleChange} onFocus={handleFocus} />);
      const input = screen.getByRole('textbox');

      await user.type(input, 'test');
      await user.click(input);

      expect(handleChange).not.toHaveBeenCalled();
      expect(handleFocus).not.toHaveBeenCalled();
    });
  });

  describe('Validation', () => {
    it('displays validation error when error prop is true', () => {
      const errorMessage = 'Invalid input';
      render(<Input error errorMessage={errorMessage} />);

      const input = screen.getByRole('textbox');
      const errorElement = screen.getByText(errorMessage);

      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(errorElement).toBeInTheDocument();
      expect(errorElement).toHaveClass('error-text');
    });

    it('clears validation error when error prop becomes false', () => {
      const errorMessage = 'Invalid input';
      const { rerender } = render(<Input error errorMessage={errorMessage} />);

      expect(screen.getByText(errorMessage)).toBeInTheDocument();

      rerender(<Input error={false} errorMessage={errorMessage} />);

      const input = screen.getByRole('textbox');
      expect(input).not.toHaveAttribute('aria-invalid', 'true');
      expect(screen.queryByText(errorMessage)).not.toBeInTheDocument();
    });

    it('shows success state with message', () => {
      const successMessage = 'Valid input';
      render(<Input success successMessage={successMessage} />);

      const input = screen.getByRole('textbox');
      const successElement = screen.getByText(successMessage);

      expect(input).toHaveClass('success');
      expect(successElement).toBeInTheDocument();
      expect(successElement).toHaveClass('success-text');
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      const label = 'Test Label';
      const helperText = 'Helper text';

      render(<Input label={label} helperText={helperText} />);
      const input = screen.getByRole('textbox');

      expect(input).toHaveAccessibleName(label);
      expect(input).toHaveAttribute('aria-describedby');
    });

    it('has proper ARIA attributes for error state', () => {
      const errorMessage = 'Error message';

      render(<Input error errorMessage={errorMessage} />);
      const input = screen.getByRole('textbox');

      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAttribute('aria-describedby', expect.stringContaining('error'));
    });

    it('supports aria-label when no visible label', () => {
      const ariaLabel = 'Search input';
      render(<Input aria-label={ariaLabel} />);
      const input = screen.getByRole('textbox');

      expect(input).toHaveAccessibleName(ariaLabel);
    });

    it('supports custom aria attributes', () => {
      render(<Input aria-describedby="custom-description" aria-labelledby="custom-label" />);
      const input = screen.getByRole('textbox');

      expect(input).toHaveAttribute('aria-describedby', 'custom-description');
      expect(input).toHaveAttribute('aria-labelledby', 'custom-label');
    });
  });

  describe('Forward Ref', () => {
    it('forwards ref to input element', () => {
      const ref = React.createRef<HTMLInputElement>();
      render(<Input ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLInputElement);
      expect(ref.current).toBe(screen.getByRole('textbox'));
    });

    it('allows calling input methods via ref', () => {
      const ref = React.createRef<HTMLInputElement>();
      render(<Input ref={ref} />);

      expect(ref.current?.focus).toBeDefined();
      expect(ref.current?.blur).toBeDefined();
      expect(ref.current?.select).toBeDefined();
    });
  });

  describe('Custom Classes', () => {
    it('applies custom className', () => {
      const customClass = 'custom-input-class';
      render(<Input className={customClass} />);
      const input = screen.getByRole('textbox');

      expect(input).toHaveClass(customClass);
      expect(input).toHaveClass('input', 'input-md'); // Still has base classes
    });

    it('merges custom classes with base classes', () => {
      render(<Input className="custom-class" size="lg" error />);
      const input = screen.getByRole('textbox');

      expect(input).toHaveClass('input', 'input-lg', 'error', 'custom-class');
    });
  });

  describe('Container Structure', () => {
    it('wraps input in ai-sidebar-container when withContainer is true', () => {
      const { container } = render(<Input withContainer />);
      const sidebarContainer = container.querySelector('.ai-sidebar-container');

      expect(sidebarContainer).toBeInTheDocument();
      const input = sidebarContainer?.querySelector('input');
      expect(input).toBeInTheDocument();
    });

    it('does not wrap in container by default', () => {
      const { container } = render(<Input />);
      const sidebarContainer = container.querySelector('.ai-sidebar-container');

      expect(sidebarContainer).not.toBeInTheDocument();
    });
  });
});
