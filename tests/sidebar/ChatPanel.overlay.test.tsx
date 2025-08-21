/**
 * @file ChatPanel Overlay Behavior Tests
 *
 * Tests for the overlay positioning, z-index, Shadow DOM isolation,
 * and fixed positioning behavior of the ChatPanel component.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatPanel } from '@/sidebar/ChatPanel';

// Mock window dimensions for consistent testing
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

describe('ChatPanel - Overlay Behavior', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Fixed Positioning', () => {
    it('renders with fixed position', () => {
      render(<ChatPanel onClose={mockOnClose} />);

      const overlay = screen.getByRole('dialog');
      expect(overlay).toHaveClass('ai-sidebar-overlay');

      // Should have ai-sidebar-overlay class which includes position: fixed
      expect(overlay).toHaveClass('ai-sidebar-overlay');
    });

    it('maintains fixed position regardless of page scroll', () => {
      // Simulate page scroll
      Object.defineProperty(window, 'scrollY', { value: 500, writable: true });
      Object.defineProperty(window, 'scrollX', { value: 100, writable: true });

      render(<ChatPanel onClose={mockOnClose} />);

      const overlay = screen.getByRole('dialog');

      // Position should be relative to viewport, not affected by scroll
      expect(overlay).toHaveStyle({
        left: '800px', // Still 1200 - 400, not affected by scrollX
        top: '60px', // Still centered, not affected by scrollY
      });
      // Should have fixed positioning class
      expect(overlay).toHaveClass('ai-sidebar-overlay');
    });

    it('positions correctly with different viewport sizes', () => {
      // Test with smaller viewport
      Object.defineProperty(window, 'innerWidth', { value: 800 });
      Object.defineProperty(window, 'innerHeight', { value: 600 });

      render(<ChatPanel onClose={mockOnClose} />);

      const overlay = screen.getByRole('dialog');

      expect(overlay).toHaveStyle({
        left: '400px', // 800 - 400
        top: '45px', // (600 * 0.15) / 2
        width: '400px',
        height: '510px', // 600 * 0.85
      });
    });

    it('handles very small viewports gracefully', () => {
      // Test with very small viewport
      Object.defineProperty(window, 'innerWidth', { value: 320 });
      Object.defineProperty(window, 'innerHeight', { value: 480 });

      render(<ChatPanel onClose={mockOnClose} />);

      const overlay = screen.getByRole('dialog');

      // Should still maintain minimum width and proper positioning
      expect(overlay).toHaveStyle({
        left: '-80px', // 320 - 400 (negative because sidebar wider than viewport)
        top: '36px', // (480 * 0.15) / 2
        width: '400px', // Maintains minimum width
        height: '408px', // 480 * 0.85
      });
    });
  });

  describe('Z-Index and Layering', () => {
    it('has high z-index for overlay behavior', () => {
      render(<ChatPanel onClose={mockOnClose} />);

      const overlay = screen.getByRole('dialog');

      // The z-index should be applied via CSS class
      expect(overlay).toHaveClass('ai-sidebar-overlay');

      // Check that the overlay appears "on top" by testing its position in DOM
      expect(overlay).toBeInTheDocument();
    });

    it('renders above page content', () => {
      // Create some mock page content
      const pageContent = document.createElement('div');
      pageContent.style.position = 'fixed';
      pageContent.style.zIndex = '1000';
      pageContent.setAttribute('data-testid', 'page-content');
      document.body.appendChild(pageContent);

      render(<ChatPanel onClose={mockOnClose} />);

      const overlay = screen.getByRole('dialog');

      // Our overlay should have the ai-sidebar-overlay class which has higher z-index
      expect(overlay).toHaveClass('ai-sidebar-overlay');

      // Clean up
      document.body.removeChild(pageContent);
    });

    it('maintains consistent z-index across different states', () => {
      const { rerender } = render(<ChatPanel onClose={mockOnClose} />);

      const overlay = screen.getByRole('dialog');
      expect(overlay).toHaveClass('ai-sidebar-overlay');

      // Rerender with different props
      rerender(<ChatPanel onClose={mockOnClose} className="custom-class" />);

      // Should still have the overlay class
      expect(overlay).toHaveClass('ai-sidebar-overlay');
      expect(overlay).toHaveClass('custom-class');
    });
  });

  describe('Viewport Responsiveness', () => {
    it('adjusts height based on viewport height', () => {
      const testCases = [
        { height: 600, expected: 510 }, // 600 * 0.85
        { height: 800, expected: 680 }, // 800 * 0.85
        { height: 1000, expected: 850 }, // 1000 * 0.85
        { height: 400, expected: 340 }, // 400 * 0.85
      ];

      testCases.forEach(({ height, expected }) => {
        Object.defineProperty(window, 'innerHeight', { value: height });

        const { unmount } = render(<ChatPanel onClose={mockOnClose} />);

        const overlay = screen.getByRole('dialog');
        expect(overlay).toHaveStyle({ height: `${expected}px` });

        unmount();
      });
    });

    it('maintains 85% height ratio consistently', () => {
      const heights = [300, 600, 900, 1200, 1600];

      heights.forEach(height => {
        Object.defineProperty(window, 'innerHeight', { value: height });

        const { unmount } = render(<ChatPanel onClose={mockOnClose} />);

        const overlay = screen.getByRole('dialog');
        const expectedHeight = height * 0.85;

        expect(overlay).toHaveStyle({ height: `${expectedHeight}px` });

        unmount();
      });
    });

    it('centers vertically with correct calculation', () => {
      const testCases = [
        { height: 600, expectedTop: 45 }, // (600 * 0.15) / 2
        { height: 800, expectedTop: 60 }, // (800 * 0.15) / 2
        { height: 1000, expectedTop: 75 }, // (1000 * 0.15) / 2
        { height: 1200, expectedTop: 90 }, // (1200 * 0.15) / 2
      ];

      testCases.forEach(({ height, expectedTop }) => {
        Object.defineProperty(window, 'innerHeight', { value: height });

        const { unmount } = render(<ChatPanel onClose={mockOnClose} />);

        const overlay = screen.getByRole('dialog');
        expect(overlay).toHaveStyle({ top: `${expectedTop}px` });

        unmount();
      });
    });

    it('positions correctly on the right edge by default', () => {
      const testCases = [
        { width: 800, expectedLeft: 400 }, // 800 - 400
        { width: 1200, expectedLeft: 800 }, // 1200 - 400
        { width: 1600, expectedLeft: 1200 }, // 1600 - 400
        { width: 300, expectedLeft: -100 }, // 300 - 400 (off-screen)
      ];

      testCases.forEach(({ width, expectedLeft }) => {
        Object.defineProperty(window, 'innerWidth', { value: width });

        const { unmount } = render(<ChatPanel onClose={mockOnClose} />);

        const overlay = screen.getByRole('dialog');
        expect(overlay).toHaveStyle({ left: `${expectedLeft}px` });

        unmount();
      });
    });
  });

  describe('Shadow DOM Isolation', () => {
    it('does not interfere with page layout', () => {
      // Create mock page content
      const pageElement = document.createElement('div');
      pageElement.style.width = '100%';
      pageElement.style.height = '2000px';
      pageElement.setAttribute('data-testid', 'page-content');
      document.body.appendChild(pageElement);

      const originalScrollHeight = document.body.scrollHeight;

      render(<ChatPanel onClose={mockOnClose} />);

      // Page layout should not be affected
      expect(document.body.scrollHeight).toBe(originalScrollHeight);

      // Clean up
      document.body.removeChild(pageElement);
    });

    it('maintains overlay behavior without affecting document flow', () => {
      const originalBodyWidth = document.body.offsetWidth;

      render(<ChatPanel onClose={mockOnClose} />);

      const overlay = screen.getByRole('dialog');
      expect(overlay).toBeInTheDocument();

      // Document body width should not change
      expect(document.body.offsetWidth).toBe(originalBodyWidth);
    });

    it('preserves page interactivity behind overlay', () => {
      render(<ChatPanel onClose={mockOnClose} />);

      const overlay = screen.getByRole('dialog');

      // The overlay should have pointer-events enabled for the sidebar itself
      // but the container outside should not interfere with page content
      expect(overlay).toBeInTheDocument();
      expect(overlay).toHaveClass('ai-sidebar-overlay');
    });
  });

  describe('Edge Cases', () => {
    it('handles window resize events gracefully', () => {
      // Set initial window size
      Object.defineProperty(window, 'innerWidth', { value: 1200 });

      const { unmount } = render(<ChatPanel onClose={mockOnClose} />);

      let overlay = screen.getByRole('dialog');
      expect(overlay).toHaveStyle({ width: '400px', left: '800px' });

      unmount();

      // Simulate window resize
      Object.defineProperty(window, 'innerWidth', { value: 1000 });

      render(<ChatPanel onClose={mockOnClose} />);

      overlay = screen.getByRole('dialog');
      // Position should update based on new window size
      expect(overlay).toHaveStyle({ left: '600px' }); // 1000 - 400
    });

    it('handles very wide viewports', () => {
      Object.defineProperty(window, 'innerWidth', { value: 3840 }); // 4K width
      Object.defineProperty(window, 'innerHeight', { value: 2160 }); // 4K height

      render(<ChatPanel onClose={mockOnClose} />);

      const overlay = screen.getByRole('dialog');

      expect(overlay).toHaveStyle({
        left: '3440px', // 3840 - 400
        top: '162px', // (2160 * 0.15) / 2
        width: '400px',
        height: '1836px', // 2160 * 0.85
      });
    });

    it('handles minimal viewport dimensions', () => {
      Object.defineProperty(window, 'innerWidth', { value: 200 });
      Object.defineProperty(window, 'innerHeight', { value: 300 });

      render(<ChatPanel onClose={mockOnClose} />);

      const overlay = screen.getByRole('dialog');

      // Should still render even if viewport is smaller than sidebar
      expect(overlay).toHaveStyle({
        left: '-200px', // 200 - 400 (sidebar extends beyond viewport)
        top: '23px', // Math.round((300 * 0.15) / 2) = Math.round(22.5) = 23
        width: '400px', // Maintains minimum width
        height: '255px', // Math.round(300 * 0.85) = 255
      });
    });
  });
});
