/**
 * @file ChatPanel Drag Functionality Tests
 *
 * Tests for the drag functionality, position updates, and
 * drag interaction behavior of the ChatPanel component.
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

describe('ChatPanel - Drag Functionality', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Drag Handle (Header)', () => {
    it('renders draggable header', () => {
      render(<ChatPanel onClose={mockOnClose} />);

      const header = screen.getByTestId('sidebar-header');
      expect(header).toBeInTheDocument();
      expect(header).toHaveClass('ai-sidebar-header');
    });

    it('has grab cursor by default', () => {
      render(<ChatPanel onClose={mockOnClose} />);

      const header = screen.getByTestId('sidebar-header');
      expect(header).toHaveStyle({ cursor: 'grab' });
    });

    it('changes to grabbing cursor during drag', () => {
      render(<ChatPanel onClose={mockOnClose} />);

      const header = screen.getByTestId('sidebar-header');

      // Start drag
      fireEvent.mouseDown(header, { clientX: 100, clientY: 100 });

      // Should change to grabbing cursor
      expect(header).toHaveStyle({ cursor: 'grabbing' });

      // End drag
      fireEvent.mouseUp(document);

      // Should return to grab cursor
      expect(header).toHaveStyle({ cursor: 'grab' });
    });

    it('does not start drag when clicking close button', async () => {
      const user = userEvent.setup();
      render(<ChatPanel onClose={mockOnClose} />);

      const closeButton = screen.getByLabelText('Close sidebar');
      const overlay = screen.getByRole('dialog');

      const initialLeft = '770px';
      const initialTop = '60px';

      expect(overlay).toHaveStyle({ left: initialLeft, top: initialTop });

      // Click close button
      await user.click(closeButton);

      // Position should not change (drag should not start)
      expect(overlay).toHaveStyle({ left: initialLeft, top: initialTop });

      // But close should be called
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('does not start drag when clicking clear button', async () => {
      render(<ChatPanel onClose={mockOnClose} />);

      // First, send a message to make clear button appear
      const input = screen.getByPlaceholderText('Ask about this webpage...');
      const sendButton = screen.getByLabelText('Send message');

      await userEvent.type(input, 'Test message');
      await userEvent.click(sendButton);

      // Wait for clear button to appear
      await vi.waitFor(() => {
        const clearButton = screen.getByLabelText('Clear conversation');
        expect(clearButton).toBeInTheDocument();
      });

      const clearButton = screen.getByLabelText('Clear conversation');
      const overlay = screen.getByRole('dialog');

      const initialLeft = '770px';
      const initialTop = '60px';

      expect(overlay).toHaveStyle({ left: initialLeft, top: initialTop });

      // Click clear button
      fireEvent.mouseDown(clearButton, { clientX: 100, clientY: 100 });
      fireEvent.mouseMove(document, { clientX: 200, clientY: 200 });

      // Position should not change (drag should not start)
      expect(overlay).toHaveStyle({ left: initialLeft, top: initialTop });
    });
  });

  describe('Drag Position Updates', () => {
    it('updates position during drag operation', () => {
      render(<ChatPanel onClose={mockOnClose} />);

      const header = screen.getByTestId('sidebar-header');
      const overlay = screen.getByRole('dialog');

      // Initial position: left: 770px, top: 60px
      expect(overlay).toHaveStyle({ left: '770px', top: '60px' });

      // Start drag at specific coordinates
      fireEvent.mouseDown(header, { clientX: 850, clientY: 100 });

      // Move mouse to new position
      fireEvent.mouseMove(document, { clientX: 900, clientY: 150 });

      // Position should update based on mouse movement
      // New position = mouse position - initial offset
      // Offset x = 850 - 770 = 80, Offset y = 100 - 60 = 40
      // New position: x = 900 - 80 = 820, y = 150 - 40 = 110
      expect(overlay).toHaveStyle({
        left: '820px',
        top: '110px',
      });
    });

    it('moves sidebar to different screen positions', () => {
      render(<ChatPanel onClose={mockOnClose} />);

      const header = screen.getByTestId('sidebar-header');
      const overlay = screen.getByRole('dialog');

      // Start drag from header center
      fireEvent.mouseDown(header, { clientX: 1000, clientY: 100 });

      // Move to top-left area
      fireEvent.mouseMove(document, { clientX: 200, clientY: 50 });

      // Calculate expected position (accounting for offset)
      // Offset: x = 1000 - 770 = 230, y = 100 - 60 = 40
      // New position: x = 200 - 230 = -30, y = 50 - 40 = 10
      expect(overlay).toHaveStyle({
        left: '-30px',
        top: '10px',
      });
    });

    it('allows sidebar to be positioned anywhere on screen', () => {
      render(<ChatPanel onClose={mockOnClose} />);

      const header = screen.getByTestId('sidebar-header');
      const overlay = screen.getByRole('dialog');

      // Start drag
      fireEvent.mouseDown(header, { clientX: 900, clientY: 200 });

      // Move to bottom-center
      fireEvent.mouseMove(document, { clientX: 600, clientY: 700 });

      // Calculate expected position
      // Offset: x = 900 - 770 = 130, y = 200 - 60 = 140
      // New position: x = 600 - 130 = 470, y = 700 - 140 = 560
      expect(overlay).toHaveStyle({
        left: '470px',
        top: '560px',
      });
    });

    it('stops position updates when drag ends', () => {
      render(<ChatPanel onClose={mockOnClose} />);

      const header = screen.getByTestId('sidebar-header');
      const overlay = screen.getByRole('dialog');

      // Start and complete a drag operation
      fireEvent.mouseDown(header, { clientX: 850, clientY: 100 });
      fireEvent.mouseMove(document, { clientX: 400, clientY: 300 });
      fireEvent.mouseUp(document);

      // Get current position
      const currentLeft = '320px'; // 400 - (850 - 770) = 400 - 80 = 320
      const currentTop = '260px'; // 300 - (100 - 60) = 300 - 40 = 260

      expect(overlay).toHaveStyle({
        left: currentLeft,
        top: currentTop,
      });

      // Further mouse movements should not affect position
      fireEvent.mouseMove(document, { clientX: 100, clientY: 100 });

      expect(overlay).toHaveStyle({
        left: currentLeft,
        top: currentTop,
      });
    });
  });

  describe('Drag Offset Calculation', () => {
    it('calculates correct drag offset from mousedown position', () => {
      render(<ChatPanel onClose={mockOnClose} />);

      const header = screen.getByTestId('sidebar-header');
      const overlay = screen.getByRole('dialog');

      // Start drag from specific position on header
      fireEvent.mouseDown(header, { clientX: 950, clientY: 120 });

      // Move to a known position
      fireEvent.mouseMove(document, { clientX: 300, clientY: 400 });

      // Calculate expected position with offset
      // Initial position: 800, 60
      // Mouse down at: 950, 120
      // Offset: 950-770=180, 120-60=60
      // Mouse move to: 300, 400
      // Final position: 300-180=120, 400-60=340
      expect(overlay).toHaveStyle({
        left: '120px',
        top: '340px',
      });
    });

    it('maintains consistent offset throughout drag operation', () => {
      render(<ChatPanel onClose={mockOnClose} />);

      const header = screen.getByTestId('sidebar-header');
      const overlay = screen.getByRole('dialog');

      // Start drag with specific offset
      fireEvent.mouseDown(header, { clientX: 1000, clientY: 200 });

      // Multiple moves should maintain consistent offset
      const moves = [
        // Offset: 1000-770=230, 200-60=140
        { x: 500, y: 300, expectedLeft: '270px', expectedTop: '160px' }, // 500-230, 300-140
        { x: 700, y: 100, expectedLeft: '470px', expectedTop: '-40px' }, // 700-230, 100-140
        { x: 1100, y: 500, expectedLeft: '870px', expectedTop: '360px' }, // 1100-230, 500-140
      ];

      moves.forEach(({ x, y, expectedLeft, expectedTop }) => {
        fireEvent.mouseMove(document, { clientX: x, clientY: y });

        expect(overlay).toHaveStyle({
          left: expectedLeft,
          top: expectedTop,
        });
      });
    });
  });

  describe('Drag Visual Feedback', () => {
    it('disables text selection during drag', () => {
      render(<ChatPanel onClose={mockOnClose} />);

      const header = screen.getByTestId('sidebar-header');

      // Before drag
      expect(document.body.style.userSelect).not.toBe('none');

      // Start drag
      fireEvent.mouseDown(header, { clientX: 900, clientY: 100 });

      // During drag, text selection should be disabled
      expect(document.body.style.userSelect).toBe('none');

      // End drag
      fireEvent.mouseUp(document);

      // After drag, text selection should be restored
      expect(document.body.style.userSelect).toBe('');
    });

    it('maintains visual state during drag operation', () => {
      render(<ChatPanel onClose={mockOnClose} />);

      const header = screen.getByTestId('sidebar-header');
      const overlay = screen.getByRole('dialog');

      // Start drag
      fireEvent.mouseDown(header, { clientX: 900, clientY: 100 });

      // Overlay should still be visible and maintain its classes
      expect(overlay).toBeInTheDocument();
      expect(overlay).toHaveClass('ai-sidebar-overlay');

      // Move during drag
      fireEvent.mouseMove(document, { clientX: 500, clientY: 300 });

      // Should still maintain visual integrity
      expect(overlay).toBeInTheDocument();
      expect(overlay).toHaveClass('ai-sidebar-overlay');
      expect(header).toHaveStyle({ cursor: 'grabbing' });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('handles drag outside viewport bounds', () => {
      render(<ChatPanel onClose={mockOnClose} />);

      const header = screen.getByTestId('sidebar-header');
      const overlay = screen.getByRole('dialog');

      // Start drag
      fireEvent.mouseDown(header, { clientX: 900, clientY: 100 });

      // Move to negative coordinates
      fireEvent.mouseMove(document, { clientX: -100, clientY: -50 });

      // Should allow positioning outside viewport
      expect(overlay).toHaveStyle({
        left: '-230px', // -100 - (900 - 770)
        top: '-90px', // -50 - (100 - 60)
      });
    });

    it('handles drag beyond viewport dimensions', () => {
      render(<ChatPanel onClose={mockOnClose} />);

      const header = screen.getByTestId('sidebar-header');
      const overlay = screen.getByRole('dialog');

      // Start drag
      fireEvent.mouseDown(header, { clientX: 900, clientY: 100 });

      // Move beyond viewport bounds
      fireEvent.mouseMove(document, { clientX: 2000, clientY: 1000 });

      // Should allow positioning beyond viewport
      expect(overlay).toHaveStyle({
        left: '1870px', // 2000 - (900 - 770)
        top: '960px', // 1000 - (100 - 60)
      });
    });

    it('handles multiple drag operations in sequence', () => {
      render(<ChatPanel onClose={mockOnClose} />);

      const header = screen.getByTestId('sidebar-header');
      const overlay = screen.getByRole('dialog');

      // First drag operation
      fireEvent.mouseDown(header, { clientX: 900, clientY: 100 });
      fireEvent.mouseMove(document, { clientX: 500, clientY: 200 });
      fireEvent.mouseUp(document);

      // Second drag operation from new position
      const newPosition = { left: '370px', top: '160px' };
      expect(overlay).toHaveStyle(newPosition);

      fireEvent.mouseDown(header, { clientX: 600, clientY: 250 });
      fireEvent.mouseMove(document, { clientX: 300, clientY: 350 });

      // Calculate offset for second drag
      // Previous position: 370, 160
      // Mouse down at: 600, 250
      // Offset: 600-370=230, 250-160=90
      // Mouse move to: 300, 350
      // Final position: 300-230=70, 350-90=260
      expect(overlay).toHaveStyle({
        left: '70px',
        top: '260px',
      });
    });

    it('handles rapid drag start/stop operations', () => {
      render(<ChatPanel onClose={mockOnClose} />);

      const header = screen.getByTestId('sidebar-header');
      const overlay = screen.getByRole('dialog');

      // Rapid sequence
      fireEvent.mouseDown(header, { clientX: 900, clientY: 100 });
      fireEvent.mouseUp(document);

      fireEvent.mouseDown(header, { clientX: 850, clientY: 80 });
      fireEvent.mouseMove(document, { clientX: 400, clientY: 300 });
      fireEvent.mouseUp(document);

      // Should end up at final position
      // Initial position: 770, 60
      // Mouse down at: 850, 80
      // Offset: 850-770=80, 80-60=20
      // Mouse move to: 400, 300
      // Final position: 400-80=320, 300-20=280
      expect(overlay).toHaveStyle({
        left: '320px', // 400 - (850 - 770) = 320
        top: '280px', // 300 - (80 - 60) = 280
      });
    });

    it('handles mousemove without mousedown', () => {
      render(<ChatPanel onClose={mockOnClose} />);

      const overlay = screen.getByRole('dialog');

      // Mouse move without starting drag
      fireEvent.mouseMove(document, { clientX: 500, clientY: 300 });

      // Should not affect position
      expect(overlay).toHaveStyle({
        left: '770px',
        top: '60px',
      });
    });

    it('handles mouseup without mousedown', () => {
      render(<ChatPanel onClose={mockOnClose} />);

      const overlay = screen.getByRole('dialog');

      // Mouse up without starting drag
      fireEvent.mouseUp(document);

      // Should not affect position
      expect(overlay).toHaveStyle({
        left: '770px',
        top: '60px',
      });
    });
  });

  describe('Interaction with Other Features', () => {
    it('does not interfere with resize during drag', () => {
      render(<ChatPanel onClose={mockOnClose} />);

      const header = screen.getByTestId('sidebar-header');
      const resizeHandle = screen.getByTestId('resize-handle');
      const overlay = screen.getByRole('dialog');

      // Start drag
      fireEvent.mouseDown(header, { clientX: 900, clientY: 100 });

      // Try to start resize during drag (should not work)
      fireEvent.mouseDown(resizeHandle);

      // Move mouse
      fireEvent.mouseMove(document, { clientX: 500, clientY: 200 });

      // Should move (drag) not resize
      expect(overlay).toHaveStyle({
        left: '400px', // 500 - (900 - 800)
        top: '160px', // 200 - (100 - 60)
        width: '400px', // Width should not change
      });
    });

    it('allows keyboard shortcuts during drag', () => {
      render(<ChatPanel onClose={mockOnClose} />);

      const header = screen.getByTestId('sidebar-header');

      // Start drag
      fireEvent.mouseDown(header, { clientX: 900, clientY: 100 });

      // Escape key should still work
      fireEvent.keyDown(document, { key: 'Escape' });

      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});
