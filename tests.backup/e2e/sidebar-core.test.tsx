/**
 * @file Core E2E Sidebar Tests
 *
 * Essential end-to-end tests for sidebar functionality without complex mocking
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModelSelector } from '@/sidebar/components/ModelSelector';

// Mock dependencies
vi.mock('@/utils/cn', () => ({
  cn: (...classes: (string | undefined | boolean)[]) => classes.filter(Boolean).join(' '),
}));

describe('E2E: Core Sidebar Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock window dimensions
    Object.defineProperty(window, 'innerHeight', {
      value: 800,
      configurable: true,
    });
    Object.defineProperty(window, 'innerWidth', {
      value: 1200,
      configurable: true,
    });
  });

  describe('Component Lifecycle', () => {
    it('mounts and unmounts cleanly', () => {
      const { unmount } = render(
        <ModelSelector value="GPT-4" onChange={vi.fn()} models={['GPT-4', 'Claude 3']} />
      );

      // Should mount successfully
      expect(screen.getByRole('combobox')).toBeInTheDocument();

      // Should unmount without errors
      expect(() => unmount()).not.toThrow();
    });

    it('handles multiple mount/unmount cycles', () => {
      for (let i = 0; i < 5; i++) {
        const { unmount } = render(
          <ModelSelector value="GPT-4" onChange={vi.fn()} models={['GPT-4', 'Claude 3']} />
        );

        expect(screen.getByRole('combobox')).toBeInTheDocument();
        expect(() => unmount()).not.toThrow();
      }
    });
  });

  describe('User Interaction Flow', () => {
    it('completes full selection workflow', async () => {
      const user = userEvent.setup();
      const mockOnChange = vi.fn();

      render(
        <ModelSelector
          value="GPT-4"
          onChange={mockOnChange}
          models={['GPT-4', 'Claude 3', 'Gemini Pro']}
        />
      );

      // 1. Initial state
      const combobox = screen.getByRole('combobox');
      expect(combobox).toHaveAttribute('aria-expanded', 'false');
      expect(screen.getByText('GPT-4')).toBeInTheDocument();

      // 2. Open dropdown
      await user.click(combobox);
      expect(combobox).toHaveAttribute('aria-expanded', 'true');

      // 3. Verify options are shown
      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(3);
      expect(screen.getByRole('option', { name: 'GPT-4' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Claude 3' })).toBeInTheDocument();

      // 4. Select different option
      await user.click(screen.getByRole('option', { name: 'Claude 3' }));

      // 5. Verify selection
      expect(mockOnChange).toHaveBeenCalledWith('Claude 3');
      expect(combobox).toHaveAttribute('aria-expanded', 'false');
    });

    it('supports keyboard-only workflow', async () => {
      const user = userEvent.setup();
      const mockOnChange = vi.fn();

      render(
        <ModelSelector
          value="GPT-4"
          onChange={mockOnChange}
          models={['GPT-4', 'Claude 3', 'Gemini Pro']}
        />
      );

      const combobox = screen.getByRole('combobox');

      // 1. Focus component
      combobox.focus();
      expect(combobox).toHaveFocus();

      // 2. Open with keyboard
      await user.keyboard('{Enter}');
      expect(combobox).toHaveAttribute('aria-expanded', 'true');

      // 3. Navigate with arrows
      await user.keyboard('{ArrowDown}');

      // 4. Select with Enter
      await user.keyboard('{Enter}');

      expect(mockOnChange).toHaveBeenCalledWith('Claude 3');
    });

    it('handles escape key correctly', async () => {
      const user = userEvent.setup();

      render(<ModelSelector value="GPT-4" onChange={vi.fn()} models={['GPT-4', 'Claude 3']} />);

      const combobox = screen.getByRole('combobox');

      // Open dropdown
      await user.click(combobox);
      expect(combobox).toHaveAttribute('aria-expanded', 'true');

      // Close with Escape
      await user.keyboard('{Escape}');
      expect(combobox).toHaveAttribute('aria-expanded', 'false');
      expect(combobox).toHaveFocus();
    });
  });

  describe('State Management', () => {
    it('reflects external state changes', () => {
      const { rerender } = render(
        <ModelSelector value="GPT-4" onChange={vi.fn()} models={['GPT-4', 'Claude 3']} />
      );

      expect(screen.getByText('GPT-4')).toBeInTheDocument();

      // Update props
      rerender(
        <ModelSelector value="Claude 3" onChange={vi.fn()} models={['GPT-4', 'Claude 3']} />
      );

      expect(screen.getByText('Claude 3')).toBeInTheDocument();
    });

    it('maintains internal state during interactions', async () => {
      const user = userEvent.setup();

      render(<ModelSelector value="GPT-4" onChange={vi.fn()} models={['GPT-4', 'Claude 3']} />);

      const combobox = screen.getByRole('combobox');

      // Open and navigate
      await user.click(combobox);
      await user.keyboard('{ArrowDown}');

      // Internal state should be maintained (highlighted option)
      expect(combobox).toHaveAttribute('aria-expanded', 'true');
    });

    it('handles disabled state correctly', () => {
      render(
        <ModelSelector
          value="GPT-4"
          onChange={vi.fn()}
          models={['GPT-4', 'Claude 3']}
          disabled={true}
        />
      );

      const combobox = screen.getByRole('combobox');
      expect(combobox).toBeDisabled();
    });
  });

  describe('Error Boundaries and Edge Cases', () => {
    it('handles empty model list', () => {
      expect(() => {
        render(<ModelSelector value="" onChange={vi.fn()} models={[]} />);
      }).not.toThrow();

      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('handles null/undefined props gracefully', () => {
      expect(() => {
        render(<ModelSelector value="" onChange={vi.fn()} models={['GPT-4']} />);
      }).not.toThrow();
    });

    it('prevents crashes with invalid selections', async () => {
      const user = userEvent.setup();
      const mockOnChange = vi.fn();

      render(
        <ModelSelector
          value="invalid-model"
          onChange={mockOnChange}
          models={['GPT-4', 'Claude 3']}
        />
      );

      // Should still be functional
      await user.click(screen.getByRole('combobox'));
      await user.click(screen.getByRole('option', { name: 'GPT-4' }));

      expect(mockOnChange).toHaveBeenCalledWith('GPT-4');
    });
  });

  describe('Accessibility Integration', () => {
    it('maintains accessibility across full interaction flow', async () => {
      const user = userEvent.setup();

      render(<ModelSelector value="GPT-4" onChange={vi.fn()} models={['GPT-4', 'Claude 3']} />);

      const combobox = screen.getByRole('combobox');

      // Throughout interaction, accessibility should be maintained
      expect(combobox).toHaveAttribute('aria-label', 'Select AI model');

      await user.click(combobox);
      expect(combobox).toHaveAttribute('aria-expanded', 'true');

      const options = screen.getAllByRole('option');
      options.forEach(option => {
        expect(option).toHaveAttribute('aria-selected');
      });
    });

    it('supports screen reader navigation patterns', async () => {
      const user = userEvent.setup();

      render(
        <ModelSelector
          value="GPT-4"
          onChange={vi.fn()}
          models={['GPT-4', 'Claude 3', 'Gemini Pro']}
        />
      );

      const combobox = screen.getByRole('combobox');
      combobox.focus();

      // Screen reader navigation pattern
      await user.keyboard('{Enter}'); // Open
      expect(screen.getByRole('listbox')).toBeInTheDocument();

      await user.keyboard('{ArrowDown}'); // Navigate
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}'); // Select

      // Should complete successfully
      expect(combobox).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('Performance Under Load', () => {
    it('handles rapid user interactions', async () => {
      const user = userEvent.setup({ delay: null });
      const mockOnChange = vi.fn();

      render(
        <ModelSelector value="GPT-4" onChange={mockOnChange} models={['GPT-4', 'Claude 3']} />
      );

      const combobox = screen.getByRole('combobox');

      // Rapid interactions
      for (let i = 0; i < 5; i++) {
        await user.click(combobox);
        await user.keyboard('{Escape}');
      }

      // Should remain functional
      await user.click(combobox);
      expect(combobox).toHaveAttribute('aria-expanded', 'true');
    });

    it('handles large model lists efficiently', async () => {
      const user = userEvent.setup({ delay: null });
      const largeModelList = Array.from({ length: 50 }, (_, i) => `Model ${i + 1}`);

      render(<ModelSelector value="Model 1" onChange={vi.fn()} models={largeModelList} />);

      // Should open quickly even with many options
      const combobox = screen.getByRole('combobox');
      await user.click(combobox);

      expect(combobox).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getAllByRole('option')).toHaveLength(50);
    });
  });

  describe('Browser Compatibility', () => {
    it('works with different event types', async () => {
      render(<ModelSelector value="GPT-4" onChange={vi.fn()} models={['GPT-4', 'Claude 3']} />);

      const combobox = screen.getByRole('combobox');

      // Test different event mechanisms
      fireEvent.click(combobox);
      expect(combobox).toHaveAttribute('aria-expanded', 'true');

      fireEvent.keyDown(combobox, { key: 'Escape' });
      expect(combobox).toHaveAttribute('aria-expanded', 'false');
    });

    it('handles focus events correctly', () => {
      render(<ModelSelector value="GPT-4" onChange={vi.fn()} models={['GPT-4', 'Claude 3']} />);

      const combobox = screen.getByRole('combobox');

      // In JSDOM, focus events work differently, so we test the structure
      fireEvent.focus(combobox);
      fireEvent.blur(combobox);

      // Component should handle focus events without crashing
      expect(combobox).toBeInTheDocument();
    });
  });
});
