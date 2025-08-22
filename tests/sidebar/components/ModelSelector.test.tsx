import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModelSelector } from '@components/ModelSelector';

describe('ModelSelector', () => {
  const defaultProps = {
    value: 'gpt-5-nano', // Using model ID
    onChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with default selected model', () => {
    render(<ModelSelector {...defaultProps} />);

    // Should show the selected model
    expect(screen.getByText('GPT-5 Nano')).toBeInTheDocument();

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

    // Should show exactly two model options
    expect(screen.getByRole('option', { name: /GPT-5 Nano.*OpenAI/i })).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: /Gemini 2.5 Flash Lite.*Google/i })
    ).toBeInTheDocument();

    // Should not show legacy models
    expect(screen.queryByRole('option', { name: /GPT-4/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Claude/i })).not.toBeInTheDocument();
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

    // Click on Gemini option
    await user.click(screen.getByRole('option', { name: /Gemini 2.5 Flash Lite/i }));

    // Should call onChange with selected model ID
    expect(onChange).toHaveBeenCalledWith('gemini-2.5-flash-lite');

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

    // Navigate with arrow keys - starts at GPT-5 Nano (index 0),
    // ArrowDown goes to Gemini 2.5 Flash Lite (index 1)
    await user.keyboard('{ArrowDown}');

    // Select with Enter
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith('gemini-2.5-flash-lite');
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

    render(<ModelSelector {...defaultProps} onChange={onChange} disabled={true} />);

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
    render(<ModelSelector {...defaultProps} value="gemini-2.5-flash-lite" />);

    await user.click(screen.getByRole('combobox'));

    const selectedOption = screen.getByRole('option', { name: /Gemini 2.5 Flash Lite/i });
    expect(selectedOption).toHaveAttribute('aria-selected', 'true');

    // Other option should not be selected
    const otherOption = screen.getByRole('option', { name: /GPT-5 Nano/i });
    expect(otherOption).toHaveAttribute('aria-selected', 'false');
  });

  it('displays only two supported models', async () => {
    const user = userEvent.setup();
    render(<ModelSelector {...defaultProps} />);

    await user.click(screen.getByRole('combobox'));

    // Count all options
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(2);

    // Verify the exact models
    expect(options[0]).toHaveTextContent('GPT-5 Nano');
    expect(options[0]).toHaveTextContent('OpenAI');
    expect(options[1]).toHaveTextContent('Gemini 2.5 Flash Lite');
    expect(options[1]).toHaveTextContent('Google');
  });

  it('applies custom className when provided', () => {
    render(<ModelSelector {...defaultProps} className="custom-class" />);

    const container = screen.getByRole('combobox').closest('.model-selector');
    expect(container).toHaveClass('custom-class');
  });

  it('shows provider information in dropdown options', async () => {
    const user = userEvent.setup();
    render(<ModelSelector {...defaultProps} />);

    await user.click(screen.getByRole('combobox'));

    // Verify provider names are displayed
    const gptOption = screen.getByRole('option', { name: /GPT-5 Nano/i });
    expect(gptOption).toHaveTextContent('OpenAI');

    const geminiOption = screen.getByRole('option', { name: /Gemini 2.5 Flash Lite/i });
    expect(geminiOption).toHaveTextContent('Google');
  });

  it('cycles through both models with keyboard navigation', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <ModelSelector {...defaultProps} value="gpt-5-nano" onChange={onChange} />
    );

    const combobox = screen.getByRole('combobox');
    combobox.focus();
    await user.keyboard('{Enter}');

    // Down arrow to Gemini
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith('gemini-2.5-flash-lite');

    // Reset and test wrap-around
    onChange.mockClear();
    rerender(<ModelSelector {...defaultProps} value="gemini-2.5-flash-lite" onChange={onChange} />);
    await user.keyboard('{Enter}');

    // Down arrow should wrap to GPT-5 Nano
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith('gpt-5-nano');
  });
});
