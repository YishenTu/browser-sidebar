/**
 * @file Simplified Model Selector Integration Tests
 *
 * Focused integration tests for model selector without triggering ThemeContext issues
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModelSelector } from '@/sidebar/components/ModelSelector';

// Mock dependencies
vi.mock('@/utils/cn', () => ({
  cn: (...classes: (string | undefined | boolean)[]) => classes.filter(Boolean).join(' '),
}));

describe('Integration: Model Selector Component', () => {
  const mockOnChange = vi.fn();
  const mockModels = ['GPT-4', 'GPT-3.5 Turbo', 'Claude 3', 'Gemini Pro'];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Model Selection Integration', () => {
    it('integrates model selection with external state management', async () => {
      const user = userEvent.setup();
      let selectedModel = 'GPT-4';

      const TestWrapper = () => {
        return (
          <ModelSelector
            value={selectedModel}
            onChange={model => {
              selectedModel = model;
              mockOnChange(model);
            }}
            models={mockModels}
          />
        );
      };

      const { rerender } = render(<TestWrapper />);

      // Verify initial state
      expect(screen.getByText('GPT-4')).toBeInTheDocument();

      // Open dropdown and select different model
      await user.click(screen.getByRole('combobox'));
      await user.click(screen.getByRole('option', { name: 'Claude 3' }));

      // Verify callback was called
      expect(mockOnChange).toHaveBeenCalledWith('Claude 3');
    });

    it('persists selection state across component updates', async () => {
      const user = userEvent.setup();
      let selectedModel = 'GPT-4';

      const { rerender } = render(
        <ModelSelector
          value={selectedModel}
          onChange={model => {
            selectedModel = model;
            mockOnChange(model);
          }}
          models={mockModels}
        />
      );

      // Change selection
      await user.click(screen.getByRole('combobox'));
      await user.click(screen.getByRole('option', { name: 'Claude 3' }));

      // Update component with new value
      selectedModel = 'Claude 3';
      rerender(<ModelSelector value={selectedModel} onChange={mockOnChange} models={mockModels} />);

      // Should show updated selection
      expect(screen.getByText('Claude 3')).toBeInTheDocument();
    });

    it('handles disabled state during loading operations', () => {
      render(
        <ModelSelector value="GPT-4" onChange={mockOnChange} models={mockModels} disabled={true} />
      );

      const combobox = screen.getByRole('combobox');
      expect(combobox).toBeDisabled();
      expect(combobox).toHaveAttribute('disabled');
    });

    it('maintains accessibility during state transitions', async () => {
      const user = userEvent.setup();

      render(<ModelSelector value="GPT-4" onChange={mockOnChange} models={mockModels} />);

      const combobox = screen.getByRole('combobox');

      // Initial state
      expect(combobox).toHaveAttribute('aria-expanded', 'false');
      expect(combobox).toHaveAttribute('aria-label', 'Select AI model');

      // Open dropdown
      await user.click(combobox);
      expect(combobox).toHaveAttribute('aria-expanded', 'true');

      // Should show options with proper ARIA
      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(mockModels.length);

      // Each option should have proper aria-selected
      options.forEach((option, index) => {
        const expectedSelected = mockModels[index] === 'GPT-4' ? 'true' : 'false';
        expect(option).toHaveAttribute('aria-selected', expectedSelected);
      });
    });

    it('supports keyboard navigation flow', async () => {
      const user = userEvent.setup();

      render(<ModelSelector value="GPT-4" onChange={mockOnChange} models={mockModels} />);

      const combobox = screen.getByRole('combobox');

      // Focus and open with Enter
      combobox.focus();
      await user.keyboard('{Enter}');

      expect(combobox).toHaveAttribute('aria-expanded', 'true');

      // Navigate with arrow keys
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      // Should select the next model
      expect(mockOnChange).toHaveBeenCalledWith('GPT-3.5 Turbo');
    });

    it('handles model list updates gracefully', () => {
      const { rerender } = render(
        <ModelSelector value="GPT-4" onChange={mockOnChange} models={mockModels} />
      );

      // Update with fewer models
      const updatedModels = ['GPT-4', 'Claude 3'];
      rerender(<ModelSelector value="GPT-4" onChange={mockOnChange} models={updatedModels} />);

      // Should still work with updated model list
      expect(screen.getByText('GPT-4')).toBeInTheDocument();
    });

    it('provides appropriate feedback for async operations', async () => {
      const user = userEvent.setup();

      // Simulate async operation
      const asyncOnChange = vi.fn().mockImplementation(async model => {
        // Simulate delay
        await new Promise(resolve => setTimeout(resolve, 100));
        return model;
      });

      render(<ModelSelector value="GPT-4" onChange={asyncOnChange} models={mockModels} />);

      await user.click(screen.getByRole('combobox'));
      await user.click(screen.getByRole('option', { name: 'Claude 3' }));

      expect(asyncOnChange).toHaveBeenCalledWith('Claude 3');

      // Dropdown should close after selection
      await waitFor(() => {
        expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('handles empty model list gracefully', () => {
      render(<ModelSelector value="" onChange={mockOnChange} models={[]} />);

      // Should render without crashing
      expect(screen.getByRole('combobox')).toBeInTheDocument();
      expect(screen.getByText('Select model...')).toBeInTheDocument();
    });

    it('handles invalid selected value', () => {
      render(<ModelSelector value="invalid-model" onChange={mockOnChange} models={mockModels} />);

      // Should show the invalid value (component doesn't validate)
      expect(screen.getByText('invalid-model')).toBeInTheDocument();
    });

    it('prevents onChange calls for same value selection', async () => {
      const user = userEvent.setup();

      render(<ModelSelector value="GPT-4" onChange={mockOnChange} models={mockModels} />);

      await user.click(screen.getByRole('combobox'));
      await user.click(screen.getByRole('option', { name: 'GPT-4' }));

      // Should not call onChange since value didn't change
      expect(mockOnChange).not.toHaveBeenCalled();
    });
  });

  describe('Performance and Responsiveness', () => {
    it('handles rapid selections without issues', async () => {
      const user = userEvent.setup({ delay: null });

      render(<ModelSelector value="GPT-4" onChange={mockOnChange} models={mockModels} />);

      // Rapidly open, select, open, select
      await user.click(screen.getByRole('combobox'));
      await user.click(screen.getByRole('option', { name: 'Claude 3' }));

      // Should work without issues
      expect(mockOnChange).toHaveBeenCalledWith('Claude 3');
    });

    it('maintains performance with large model lists', () => {
      const largeModelList = Array.from({ length: 100 }, (_, i) => `Model ${i}`);

      render(<ModelSelector value="Model 0" onChange={mockOnChange} models={largeModelList} />);

      // Should render without performance issues
      expect(screen.getByRole('combobox')).toBeInTheDocument();
      expect(screen.getByText('Model 0')).toBeInTheDocument();
    });
  });
});
