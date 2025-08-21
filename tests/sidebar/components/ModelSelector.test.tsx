import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModelSelector } from '@components/ModelSelector';

// Mock models for testing
const mockModels = ['GPT-4', 'GPT-3.5', 'Claude 3', 'Claude 2', 'Gemini Pro', 'Llama 2'];

describe('ModelSelector', () => {
  const defaultProps = {
    value: 'GPT-4',
    onChange: vi.fn(),
    models: mockModels,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with default selected model', () => {
    render(<ModelSelector {...defaultProps} />);
    
    // Should show the selected model
    expect(screen.getByText('GPT-4')).toBeInTheDocument();
    
    // Should have proper accessibility attributes
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens dropdown when clicked', async () => {
    const user = userEvent.setup();
    render(<ModelSelector {...defaultProps} />);
    
    const combobox = screen.getByRole('combobox');
    await user.click(combobox);
    
    // Should expand the dropdown
    expect(combobox).toHaveAttribute('aria-expanded', 'true');
    
    // Should show all model options
    mockModels.forEach(model => {
      expect(screen.getByRole('option', { name: model })).toBeInTheDocument();
    });
  });

  it('closes dropdown when clicking outside', async () => {
    const user = userEvent.setup();
    render(<ModelSelector {...defaultProps} />);
    
    const combobox = screen.getByRole('combobox');
    await user.click(combobox);
    
    // Dropdown should be open
    expect(combobox).toHaveAttribute('aria-expanded', 'true');
    
    // Click outside
    await user.click(document.body);
    
    // Should close the dropdown
    await waitFor(() => {
      expect(combobox).toHaveAttribute('aria-expanded', 'false');
    });
  });

  it('selects model when option is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ModelSelector {...defaultProps} onChange={onChange} />);
    
    // Open dropdown
    await user.click(screen.getByRole('combobox'));
    
    // Click on Claude 3 option
    await user.click(screen.getByRole('option', { name: 'Claude 3' }));
    
    // Should call onChange with selected model
    expect(onChange).toHaveBeenCalledWith('Claude 3');
    
    // Should close dropdown
    await waitFor(() => {
      expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');
    });
  });

  it('handles keyboard navigation correctly', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ModelSelector {...defaultProps} onChange={onChange} />);
    
    const combobox = screen.getByRole('combobox');
    
    // Focus and open with Enter
    combobox.focus();
    await user.keyboard('{Enter}');
    expect(combobox).toHaveAttribute('aria-expanded', 'true');
    
    // Navigate with arrow keys - starts at GPT-4 (index 0), 
    // ArrowDown goes to GPT-3.5 (index 1)
    await user.keyboard('{ArrowDown}');
    
    // Select with Enter
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith('GPT-3.5');
  });

  it('closes dropdown with Escape key', async () => {
    const user = userEvent.setup();
    render(<ModelSelector {...defaultProps} />);
    
    const combobox = screen.getByRole('combobox');
    await user.click(combobox);
    
    // Should be open
    expect(combobox).toHaveAttribute('aria-expanded', 'true');
    
    // Press Escape
    await user.keyboard('{Escape}');
    
    // Should close
    await waitFor(() => {
      expect(combobox).toHaveAttribute('aria-expanded', 'false');
    });
  });

  it('respects disabled state', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    
    render(
      <ModelSelector 
        {...defaultProps} 
        onChange={onChange} 
        disabled={true}
      />
    );
    
    const combobox = screen.getByRole('combobox');
    
    // Should be disabled
    expect(combobox).toBeDisabled();
    
    // Should not open when clicked
    await user.click(combobox);
    expect(combobox).toHaveAttribute('aria-expanded', 'false');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows proper ARIA attributes for accessibility', () => {
    render(<ModelSelector {...defaultProps} />);
    
    const combobox = screen.getByRole('combobox');
    
    expect(combobox).toHaveAttribute('aria-haspopup', 'listbox');
    expect(combobox).toHaveAttribute('aria-expanded', 'false');
    expect(combobox).toHaveAttribute('aria-label', 'Select AI model');
  });

  it('highlights selected option in dropdown', async () => {
    const user = userEvent.setup();
    render(<ModelSelector {...defaultProps} value="Claude 3" />);
    
    await user.click(screen.getByRole('combobox'));
    
    const selectedOption = screen.getByRole('option', { name: 'Claude 3' });
    expect(selectedOption).toHaveAttribute('aria-selected', 'true');
    
    // Other options should not be selected
    const otherOption = screen.getByRole('option', { name: 'GPT-4' });
    expect(otherOption).toHaveAttribute('aria-selected', 'false');
  });

  it('handles empty models array gracefully', () => {
    render(<ModelSelector {...defaultProps} models={[]} />);
    
    // Should still render the component
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('applies custom className when provided', () => {
    render(<ModelSelector {...defaultProps} className="custom-class" />);
    
    const container = screen.getByRole('combobox').closest('.model-selector');
    expect(container).toHaveClass('custom-class');
  });
});