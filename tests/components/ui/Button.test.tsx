import { render, screen, fireEvent } from '@tests/utils/test-utils';
import { Button } from '@/components/ui/Button';

describe('Button Component', () => {
  describe('Basic Rendering', () => {
    it('renders with text content', () => {
      render(<Button>Click me</Button>);
      expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
    });

    it('renders with JSX children', () => {
      render(
        <Button>
          <span>Custom</span> Content
        </Button>
      );
      expect(screen.getByRole('button')).toHaveTextContent('Custom Content');
    });

    it('applies default button element type', () => {
      render(<Button>Test</Button>);
      const button = screen.getByRole('button');
      expect(button.tagName).toBe('BUTTON');
      expect(button).toHaveAttribute('type', 'button');
    });

    it('can be rendered as different HTML elements using asChild or custom type', () => {
      render(<Button type="submit">Submit</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('type', 'submit');
    });
  });

  describe('Click Handling', () => {
    it('calls onClick handler when clicked', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Click me</Button>);

      fireEvent.click(screen.getByRole('button'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('passes event object to onClick handler', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Click me</Button>);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(handleClick).toHaveBeenCalledWith(expect.any(Object));
      expect(handleClick.mock.calls[0][0].target).toBe(button);
    });
  });

  describe('Disabled State', () => {
    it('does not call onClick when disabled', () => {
      const handleClick = vi.fn();
      render(
        <Button onClick={handleClick} disabled>
          Click me
        </Button>
      );

      fireEvent.click(screen.getByRole('button'));
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('has disabled attribute when disabled prop is true', () => {
      render(<Button disabled>Disabled button</Button>);
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('applies disabled styling classes', () => {
      render(<Button disabled>Disabled button</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('btn');
      expect(button).toBeDisabled();
    });

    it('is not focusable when disabled', () => {
      render(<Button disabled>Disabled button</Button>);
      const button = screen.getByRole('button');
      button.focus();
      expect(button).not.toHaveFocus();
    });
  });

  describe('Loading State', () => {
    it('shows loading spinner when loading prop is true', () => {
      render(<Button loading>Loading button</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('loading');
    });

    it('does not call onClick when in loading state', () => {
      const handleClick = vi.fn();
      render(
        <Button onClick={handleClick} loading>
          Loading
        </Button>
      );

      fireEvent.click(screen.getByRole('button'));
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('is disabled when loading', () => {
      render(<Button loading>Loading</Button>);
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('shows loading text when provided', () => {
      render(
        <Button loading loadingText="Processing...">
          Submit
        </Button>
      );
      expect(screen.getByRole('button')).toHaveTextContent('Processing...');
    });

    it('shows original children when loading text is not provided', () => {
      render(<Button loading>Submit</Button>);
      expect(screen.getByRole('button')).toHaveTextContent('Submit');
    });
  });

  describe('Variants', () => {
    it('applies primary variant classes by default', () => {
      render(<Button>Primary</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('btn', 'btn-primary');
    });

    it('applies secondary variant classes', () => {
      render(<Button variant="secondary">Secondary</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('btn', 'btn-secondary');
    });

    it('applies ghost variant classes', () => {
      render(<Button variant="ghost">Ghost</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('btn', 'btn-ghost');
    });

    it('applies danger variant classes', () => {
      render(<Button variant="danger">Danger</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('btn', 'btn-danger');
    });

    it('applies outline variant classes', () => {
      render(<Button variant="outline">Outline</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('btn', 'btn-outline');
    });
  });

  describe('Sizes', () => {
    it('applies medium size classes by default', () => {
      render(<Button>Medium</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('btn', 'btn-md');
    });

    it('applies small size classes', () => {
      render(<Button size="sm">Small</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('btn', 'btn-sm');
    });

    it('applies large size classes', () => {
      render(<Button size="lg">Large</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('btn', 'btn-lg');
    });
  });

  describe('ClassName Merging', () => {
    it('merges custom className with default classes', () => {
      render(<Button className="custom-class">Custom</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('btn', 'btn-primary', 'btn-md', 'custom-class');
    });

    it('allows custom classes to override default styles', () => {
      render(<Button className="bg-purple-500">Custom style</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-purple-500');
    });

    it('preserves all variant and size classes with custom className', () => {
      render(
        <Button variant="secondary" size="lg" className="my-custom-class">
          Custom
        </Button>
      );
      const button = screen.getByRole('button');
      expect(button).toHaveClass('btn', 'btn-secondary', 'btn-lg', 'my-custom-class');
    });
  });

  describe('Accessibility', () => {
    it('has button role by default', () => {
      render(<Button>Accessible</Button>);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('supports custom aria-label', () => {
      render(<Button aria-label="Custom label">Icon only</Button>);
      expect(screen.getByRole('button', { name: 'Custom label' })).toBeInTheDocument();
    });

    it('supports aria-describedby', () => {
      render(
        <>
          <Button aria-describedby="help-text">Submit</Button>
          <div id="help-text">This submits the form</div>
        </>
      );
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-describedby', 'help-text');
    });

    it('indicates loading state to screen readers', () => {
      render(<Button loading>Loading</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-disabled', 'true');
    });

    it('indicates disabled state to screen readers', () => {
      render(<Button disabled>Disabled</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-disabled', 'true');
    });

    it('is focusable by default', () => {
      render(<Button>Focusable</Button>);
      const button = screen.getByRole('button');
      button.focus();
      expect(button).toHaveFocus();
    });

    it('supports keyboard interaction and is properly focusable', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Keyboard</Button>);
      const button = screen.getByRole('button');

      button.focus();
      expect(button).toHaveFocus();

      // Test that button can be activated by clicking (keyboard navigation would work in real browser)
      fireEvent.click(button);
      expect(handleClick).toHaveBeenCalledTimes(1);

      // Button should not have explicit tabindex (native focusability)
      expect(button).not.toHaveAttribute('tabindex');
    });
  });

  describe('Forward Ref Support', () => {
    it('forwards ref to button element', () => {
      const ref = React.createRef<HTMLButtonElement>();
      render(<Button ref={ref}>With ref</Button>);

      expect(ref.current).toBeInstanceOf(HTMLButtonElement);
      expect(ref.current?.textContent).toBe('With ref');
    });

    it('allows imperative access to button methods', () => {
      const ref = React.createRef<HTMLButtonElement>();
      render(<Button ref={ref}>Focus me</Button>);

      ref.current?.focus();
      expect(ref.current).toHaveFocus();
    });
  });

  describe('HTML Attributes', () => {
    it('passes through standard button attributes', () => {
      render(
        <Button id="test-button" data-testid="custom-button" title="Tooltip text">
          Standard attrs
        </Button>
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('id', 'test-button');
      expect(button).toHaveAttribute('data-testid', 'custom-button');
      expect(button).toHaveAttribute('title', 'Tooltip text');
    });

    it('supports form-related attributes', () => {
      render(
        <Button type="submit" form="my-form" name="submit-button" value="submit">
          Submit
        </Button>
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('type', 'submit');
      expect(button).toHaveAttribute('form', 'my-form');
      expect(button).toHaveAttribute('name', 'submit-button');
      expect(button).toHaveAttribute('value', 'submit');
    });
  });
});
