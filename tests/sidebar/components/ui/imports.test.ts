import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

/**
 * Test Suite: UI Components Import and Rendering from New Location
 *
 * This test suite verifies that all UI components can be successfully
 * imported from their new location at /src/sidebar/components/ui/
 * and that they render correctly with their existing props.
 *
 * Tests should FAIL initially during RED phase since components
 * haven't been moved to new location yet.
 */

describe('UI Components - Import and Basic Rendering Tests', () => {
  describe('Button Component', () => {
    it('should import Button from new location', async () => {
      // This should fail initially since Button isn't at new location yet
      const { Button } = await import('@/sidebar/components/ui/Button');
      expect(Button).toBeDefined();
      expect(typeof Button).toBe('object'); // forwardRef returns object
    });

    it('should render Button with basic props', async () => {
      const { Button } = await import('@/sidebar/components/ui/Button');
      render(React.createElement(Button, { children: 'Test Button' }));
      expect(screen.getByRole('button', { name: 'Test Button' })).toBeInTheDocument();
    });

    it('should render Button with different variants', async () => {
      const { Button } = await import('@/sidebar/components/ui/Button');
      render(
        React.createElement(Button, {
          variant: 'primary',
          children: 'Primary Button',
        })
      );
      const button = screen.getByRole('button', { name: 'Primary Button' });
      expect(button).toHaveClass('btn-primary');
    });
  });

  describe('Card Component', () => {
    it('should import Card from new location', async () => {
      const { Card } = await import('@/sidebar/components/ui/Card');
      expect(Card).toBeDefined();
      expect(typeof Card).toBe('object'); // forwardRef returns object
    });

    it('should render Card with children', async () => {
      const { Card } = await import('@/sidebar/components/ui/Card');
      render(React.createElement(Card, { children: 'Test Card Content' }));
      expect(screen.getByText('Test Card Content')).toBeInTheDocument();
    });
  });

  describe('IconButton Component', () => {
    it('should import IconButton from new location', async () => {
      const { IconButton } = await import('@/sidebar/components/ui/IconButton');
      expect(IconButton).toBeDefined();
      expect(typeof IconButton).toBe('object'); // forwardRef returns object
    });

    it('should render IconButton with icon', async () => {
      const { IconButton } = await import('@/sidebar/components/ui/IconButton');
      render(
        React.createElement(IconButton, {
          icon: '✨',
          'aria-label': 'Test Icon Button',
        })
      );
      expect(screen.getByRole('button', { name: 'Test Icon Button' })).toBeInTheDocument();
    });
  });

  describe('Input Component', () => {
    it('should import Input from new location', async () => {
      const { Input } = await import('@/sidebar/components/ui/Input');
      expect(Input).toBeDefined();
      expect(typeof Input).toBe('object'); // forwardRef returns object
    });

    it('should render Input with placeholder', async () => {
      const { Input } = await import('@/sidebar/components/ui/Input');
      render(
        React.createElement(Input, {
          placeholder: 'Test Input',
        })
      );
      expect(screen.getByPlaceholderText('Test Input')).toBeInTheDocument();
    });
  });

  describe('Spinner Component', () => {
    it('should import Spinner from new location', async () => {
      const { Spinner } = await import('@/sidebar/components/ui/Spinner');
      expect(Spinner).toBeDefined();
      expect(typeof Spinner).toBe('function');
    });

    it('should render Spinner with loading state', async () => {
      const { Spinner } = await import('@/sidebar/components/ui/Spinner');
      render(React.createElement(Spinner));
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  describe('TextArea Component', () => {
    it('should import TextArea from new location', async () => {
      const { TextArea } = await import('@/sidebar/components/ui/TextArea');
      expect(TextArea).toBeDefined();
      expect(typeof TextArea).toBe('object'); // forwardRef returns object
    });

    it('should render TextArea with placeholder', async () => {
      const { TextArea } = await import('@/sidebar/components/ui/TextArea');
      render(
        React.createElement(TextArea, {
          placeholder: 'Test TextArea',
        })
      );
      expect(screen.getByPlaceholderText('Test TextArea')).toBeInTheDocument();
    });
  });

  describe('UI Index Exports', () => {
    it('should import all components from index file', async () => {
      const exports = await import('@/sidebar/components/ui/index');

      // Verify all component exports exist
      expect(exports.Button).toBeDefined();
      expect(exports.Card).toBeDefined();
      expect(exports.IconButton).toBeDefined();
      expect(exports.Input).toBeDefined();
      expect(exports.Spinner).toBeDefined();
      expect(exports.TextArea).toBeDefined();

      // Verify type exports exist (these should not throw)
      expect(typeof exports.Button).toBe('object'); // forwardRef components
      expect(typeof exports.Card).toBe('object');
      expect(typeof exports.IconButton).toBe('object');
      expect(typeof exports.Input).toBe('object');
      expect(typeof exports.Spinner).toBe('function'); // regular function component
      expect(typeof exports.TextArea).toBe('object');
    });
  });

  describe('Style Integration', () => {
    it('should render components with correct CSS classes (no regressions)', async () => {
      const { Button } = await import('@/sidebar/components/ui/Button');
      const { Card } = await import('@/sidebar/components/ui/Card');

      // Test Button styles
      render(
        React.createElement(Button, {
          variant: 'primary',
          size: 'md',
          children: 'Styled Button',
        })
      );
      const button = screen.getByRole('button', { name: 'Styled Button' });
      expect(button).toHaveClass('btn', 'btn-primary', 'btn-md');

      // Test Card styles
      render(
        React.createElement(Card, {
          className: 'test-card',
          children: 'Styled Card',
        })
      );
      const card = screen.getByText('Styled Card').closest('div');
      expect(card).toHaveClass('test-card');
    });
  });
});
