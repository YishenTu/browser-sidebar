/**
 * @file ChatPanel Resize Functionality Tests
 * 
 * Tests for the resize handle functionality, width constraints,
 * and resize behavior of the ChatPanel component.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { ChatPanel } from '@/sidebar/ChatPanel';

// Mock window dimensions
Object.defineProperty(window, 'innerWidth', {
  writable: true,
  configurable: true,
  value: 1200,
});

Object.defineProperty(window, 'innerHeight', {
  writable: true,
  configurable: true,
  value: 800,
});

describe('ChatPanel - Resize Functionality', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Resize Handle', () => {
    it('renders resize handle element', () => {
      render(<ChatPanel onClose={mockOnClose} />);
      
      const resizeHandle = screen.getByTestId('resize-handle');
      expect(resizeHandle).toBeInTheDocument();
      expect(resizeHandle).toHaveClass('ai-sidebar-resize-handle');
    });

    it('has correct cursor style', () => {
      render(<ChatPanel onClose={mockOnClose} />);
      
      const resizeHandle = screen.getByTestId('resize-handle');
      expect(resizeHandle).toHaveStyle({ cursor: 'ew-resize' });
    });

    it('is positioned correctly for left edge resizing', () => {
      render(<ChatPanel onClose={mockOnClose} />);
      
      const resizeHandle = screen.getByTestId('resize-handle');
      const overlay = screen.getByRole('dialog');
      
      // Resize handle should be a child of the overlay
      expect(overlay).toContainElement(resizeHandle);
    });
  });

  describe('Mouse Resize Interaction', () => {
    it('starts resize on mousedown', () => {
      render(<ChatPanel onClose={mockOnClose} />);
      
      const resizeHandle = screen.getByTestId('resize-handle');
      const overlay = screen.getByRole('dialog');
      
      // Initial state
      expect(overlay).toHaveStyle({ width: '400px' });
      
      // Start resize
      fireEvent.mouseDown(resizeHandle);
      
      // Should be in resizing state (tested indirectly through behavior)
      expect(resizeHandle).toBeInTheDocument();
    });

    it('resizes width during mousemove', () => {
      render(<ChatPanel onClose={mockOnClose} />);
      
      const resizeHandle = screen.getByTestId('resize-handle');
      const overlay = screen.getByRole('dialog');
      
      // Start resize
      fireEvent.mouseDown(resizeHandle);
      
      // Simulate mouse move to make sidebar wider (move left)
      fireEvent.mouseMove(document, { clientX: 700 }); // Move to x=700
      
      // Width should increase to 500px (1200 - 700)
      expect(overlay).toHaveStyle({ 
        width: '500px',
        left: '700px'
      });
    });

    it('resizes width during mousemove to make narrower', () => {
      render(<ChatPanel onClose={mockOnClose} />);
      
      const resizeHandle = screen.getByTestId('resize-handle');
      const overlay = screen.getByRole('dialog');
      
      // Start resize
      fireEvent.mouseDown(resizeHandle);
      
      // Simulate mouse move to make sidebar narrower (move right)
      fireEvent.mouseMove(document, { clientX: 900 }); // Move to x=900
      
      // Width should decrease to 300px (1200 - 900)
      expect(overlay).toHaveStyle({ 
        width: '300px',
        left: '900px'
      });
    });

    it('stops resize on mouseup', () => {
      render(<ChatPanel onClose={mockOnClose} />);
      
      const resizeHandle = screen.getByTestId('resize-handle');
      const overlay = screen.getByRole('dialog');
      
      // Start resize
      fireEvent.mouseDown(resizeHandle);
      
      // Move and resize
      fireEvent.mouseMove(document, { clientX: 600 });
      expect(overlay).toHaveStyle({ width: '600px' });
      
      // End resize
      fireEvent.mouseUp(document);
      
      // Further mouse moves should not affect size
      fireEvent.mouseMove(document, { clientX: 500 });
      expect(overlay).toHaveStyle({ width: '600px' }); // Should stay the same
    });
  });

  describe('Width Constraints', () => {
    it('enforces minimum width of 300px', () => {
      render(<ChatPanel onClose={mockOnClose} />);
      
      const resizeHandle = screen.getByTestId('resize-handle');
      const overlay = screen.getByRole('dialog');
      
      // Start resize
      fireEvent.mouseDown(resizeHandle);
      
      // Try to resize beyond minimum (move very far right)
      fireEvent.mouseMove(document, { clientX: 1000 }); // Would result in 200px width
      
      // Should be constrained to minimum 300px
      expect(overlay).toHaveStyle({ 
        width: '300px',
        left: '900px' // 1200 - 300
      });
    });

    it('enforces maximum width of 800px', () => {
      render(<ChatPanel onClose={mockOnClose} />);
      
      const resizeHandle = screen.getByTestId('resize-handle');
      const overlay = screen.getByRole('dialog');
      
      // Start resize
      fireEvent.mouseDown(resizeHandle);
      
      // Try to resize beyond maximum (move very far left)
      fireEvent.mouseMove(document, { clientX: 300 }); // Would result in 900px width
      
      // Should be constrained to maximum 800px
      expect(overlay).toHaveStyle({ 
        width: '800px',
        left: '400px' // 1200 - 800
      });
    });

    it('handles edge case at exact minimum width', () => {
      render(<ChatPanel onClose={mockOnClose} />);
      
      const resizeHandle = screen.getByTestId('resize-handle');
      const overlay = screen.getByRole('dialog');
      
      // Start resize
      fireEvent.mouseDown(resizeHandle);
      
      // Move to exact minimum width position
      fireEvent.mouseMove(document, { clientX: 900 }); // Results in exactly 300px
      
      expect(overlay).toHaveStyle({ 
        width: '300px',
        left: '900px'
      });
    });

    it('handles edge case at exact maximum width', () => {
      render(<ChatPanel onClose={mockOnClose} />);
      
      const resizeHandle = screen.getByTestId('resize-handle');
      const overlay = screen.getByRole('dialog');
      
      // Start resize
      fireEvent.mouseDown(resizeHandle);
      
      // Move to exact maximum width position
      fireEvent.mouseMove(document, { clientX: 400 }); // Results in exactly 800px
      
      expect(overlay).toHaveStyle({ 
        width: '800px',
        left: '400px'
      });
    });
  });

  describe('Resize Visual Feedback', () => {
    it('disables text selection during resize', () => {
      render(<ChatPanel onClose={mockOnClose} />);
      
      const resizeHandle = screen.getByTestId('resize-handle');
      
      // Before resize
      expect(document.body.style.userSelect).not.toBe('none');
      
      // Start resize
      fireEvent.mouseDown(resizeHandle);
      
      // During resize, text selection should be disabled
      expect(document.body.style.userSelect).toBe('none');
      
      // End resize
      fireEvent.mouseUp(document);
      
      // After resize, text selection should be restored
      expect(document.body.style.userSelect).toBe('');
    });

    it('maintains visual state during resize operation', () => {
      render(<ChatPanel onClose={mockOnClose} />);
      
      const resizeHandle = screen.getByTestId('resize-handle');
      const overlay = screen.getByRole('dialog');
      
      // Start resize
      fireEvent.mouseDown(resizeHandle);
      
      // Overlay should still be visible and maintain its classes
      expect(overlay).toBeInTheDocument();
      expect(overlay).toHaveClass('ai-sidebar-overlay');
      
      // Move during resize
      fireEvent.mouseMove(document, { clientX: 700 });
      
      // Should still maintain visual integrity
      expect(overlay).toBeInTheDocument();
      expect(overlay).toHaveClass('ai-sidebar-overlay');
    });
  });

  describe('Multi-touch and Edge Cases', () => {
    it('handles multiple mousedown events gracefully', () => {
      render(<ChatPanel onClose={mockOnClose} />);
      
      const resizeHandle = screen.getByTestId('resize-handle');
      const overlay = screen.getByRole('dialog');
      
      // Multiple mousedowns
      fireEvent.mouseDown(resizeHandle);
      fireEvent.mouseDown(resizeHandle);
      
      // Should still work normally
      fireEvent.mouseMove(document, { clientX: 700 });
      expect(overlay).toHaveStyle({ width: '500px' });
      
      fireEvent.mouseUp(document);
    });

    it('handles mousemove without mousedown', () => {
      render(<ChatPanel onClose={mockOnClose} />);
      
      const overlay = screen.getByRole('dialog');
      
      // Mouse move without starting resize
      fireEvent.mouseMove(document, { clientX: 500 });
      
      // Should not affect width
      expect(overlay).toHaveStyle({ width: '400px' });
    });

    it('handles mouseup without mousedown', () => {
      render(<ChatPanel onClose={mockOnClose} />);
      
      const overlay = screen.getByRole('dialog');
      
      // Mouse up without starting resize
      fireEvent.mouseUp(document);
      
      // Should not affect width
      expect(overlay).toHaveStyle({ width: '400px' });
    });

    it('handles rapid resize operations', () => {
      render(<ChatPanel onClose={mockOnClose} />);
      
      const resizeHandle = screen.getByTestId('resize-handle');
      const overlay = screen.getByRole('dialog');
      
      // Rapid resize sequence
      fireEvent.mouseDown(resizeHandle);
      fireEvent.mouseMove(document, { clientX: 600 });
      fireEvent.mouseUp(document);
      
      fireEvent.mouseDown(resizeHandle);
      fireEvent.mouseMove(document, { clientX: 700 });
      fireEvent.mouseUp(document);
      
      // Should end up at final position
      expect(overlay).toHaveStyle({ 
        width: '500px',
        left: '700px'
      });
    });
  });

  describe('Resize with Different Viewport Sizes', () => {
    it('respects constraints with smaller viewport', () => {
      Object.defineProperty(window, 'innerWidth', { value: 800 });
      
      render(<ChatPanel onClose={mockOnClose} />);
      
      const resizeHandle = screen.getByTestId('resize-handle');
      const overlay = screen.getByRole('dialog');
      
      // Start resize
      fireEvent.mouseDown(resizeHandle);
      
      // Try to resize beyond maximum
      fireEvent.mouseMove(document, { clientX: 100 }); // Would be 700px width
      
      // Should still be constrained to 800px max, but viewport is only 800px
      // So left position would be 0
      expect(overlay).toHaveStyle({ width: '700px' });
    });

    it('handles resize when viewport is smaller than max width', () => {
      Object.defineProperty(window, 'innerWidth', { value: 600 });
      
      render(<ChatPanel onClose={mockOnClose} />);
      
      const resizeHandle = screen.getByTestId('resize-handle');
      const overlay = screen.getByRole('dialog');
      
      // Start resize
      fireEvent.mouseDown(resizeHandle);
      
      // Try to make very wide
      fireEvent.mouseMove(document, { clientX: 0 });
      
      // Should be constrained by viewport width
      expect(overlay).toHaveStyle({ width: '600px' }); // Can't be wider than viewport
    });
  });

  describe('Keyboard Accessibility', () => {
    it('does not interfere with keyboard navigation during resize', () => {
      render(<ChatPanel onClose={mockOnClose} />);
      
      const resizeHandle = screen.getByTestId('resize-handle');
      
      // Start resize
      fireEvent.mouseDown(resizeHandle);
      
      // Keyboard events should still work
      fireEvent.keyDown(document, { key: 'Escape' });
      
      // Should close sidebar
      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});