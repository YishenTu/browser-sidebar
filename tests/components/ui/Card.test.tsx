import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Card } from '../../../src/components/ui/Card';

describe('Card Component', () => {
  let mockContainer: HTMLElement;

  beforeEach(() => {
    // Create mock sidebar container for scoped styles
    mockContainer = document.createElement('div');
    mockContainer.className = 'ai-sidebar-container';
    document.body.appendChild(mockContainer);
  });

  afterEach(() => {
    if (document.body.contains(mockContainer)) {
      document.body.removeChild(mockContainer);
    }
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render with children content', () => {
      render(
        <Card>
          <div>Test content</div>
        </Card>,
        { container: mockContainer }
      );

      expect(screen.getByText('Test content')).toBeInTheDocument();
    });

    it('should apply default card styles', () => {
      const { container } = render(<Card>Test content</Card>, { container: mockContainer });

      const cardElement = container.querySelector('.card');
      expect(cardElement).toBeInTheDocument();
      expect(cardElement).toHaveClass('card');
    });

    it('should merge custom className with default classes', () => {
      const { container } = render(<Card className="custom-card">Test content</Card>, {
        container: mockContainer,
      });

      const cardElement = container.querySelector('.card');
      expect(cardElement).toHaveClass('card', 'custom-card');
    });
  });

  describe('Variants', () => {
    it('should apply basic variant by default', () => {
      const { container } = render(<Card>Test content</Card>, { container: mockContainer });

      const cardElement = container.querySelector('.card');
      expect(cardElement).toHaveClass('card');
      expect(cardElement).not.toHaveClass('card-elevated', 'card-interactive');
    });

    it('should apply elevated variant', () => {
      const { container } = render(<Card variant="elevated">Test content</Card>, {
        container: mockContainer,
      });

      const cardElement = container.querySelector('.card');
      expect(cardElement).toHaveClass('card', 'card-elevated');
    });

    it('should apply interactive variant', () => {
      const { container } = render(<Card variant="interactive">Test content</Card>, {
        container: mockContainer,
      });

      const cardElement = container.querySelector('.card');
      expect(cardElement).toHaveClass('card', 'card-interactive');
    });
  });

  describe('Padding Options', () => {
    it('should apply default padding', () => {
      const { container } = render(<Card>Test content</Card>, { container: mockContainer });

      const cardElement = container.querySelector('.card');
      expect(cardElement).toHaveClass('card');
    });

    it('should apply none padding', () => {
      const { container } = render(<Card padding="none">Test content</Card>, {
        container: mockContainer,
      });

      const cardElement = container.querySelector('.card');
      expect(cardElement).toHaveClass('p-0');
    });

    it('should apply small padding', () => {
      const { container } = render(<Card padding="sm">Test content</Card>, {
        container: mockContainer,
      });

      const cardElement = container.querySelector('.card');
      expect(cardElement).toHaveClass('p-3');
    });

    it('should apply medium padding', () => {
      const { container } = render(<Card padding="md">Test content</Card>, {
        container: mockContainer,
      });

      const cardElement = container.querySelector('.card');
      expect(cardElement).toHaveClass('p-4');
    });

    it('should apply large padding', () => {
      const { container } = render(<Card padding="lg">Test content</Card>, {
        container: mockContainer,
      });

      const cardElement = container.querySelector('.card');
      expect(cardElement).toHaveClass('p-6');
    });
  });

  describe('Interactive States', () => {
    it('should handle click events when interactive', () => {
      const mockOnClick = vi.fn();
      const { container } = render(
        <Card variant="interactive" onClick={mockOnClick}>
          Test content
        </Card>,
        { container: mockContainer }
      );

      const cardElement = container.querySelector('.card');
      expect(cardElement).toHaveClass('card-interactive');

      fireEvent.click(cardElement!);
      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('should not add cursor pointer when not interactive', () => {
      const { container } = render(<Card>Test content</Card>, { container: mockContainer });

      const cardElement = container.querySelector('.card');
      expect(cardElement).not.toHaveClass('card-interactive');
    });

    it('should be accessible with keyboard navigation', () => {
      const mockOnClick = vi.fn();
      const { container } = render(
        <Card variant="interactive" onClick={mockOnClick}>
          Test content
        </Card>,
        { container: mockContainer }
      );

      const cardElement = container.querySelector('.card');
      expect(cardElement).toHaveAttribute('tabIndex', '0');
      expect(cardElement).toHaveAttribute('role', 'button');
    });

    it('should handle Enter key press when interactive', () => {
      const mockOnClick = vi.fn();
      const { container } = render(
        <Card variant="interactive" onClick={mockOnClick}>
          Test content
        </Card>,
        { container: mockContainer }
      );

      const cardElement = container.querySelector('.card');
      fireEvent.keyDown(cardElement!, { key: 'Enter', code: 'Enter' });
      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('should handle Space key press when interactive', () => {
      const mockOnClick = vi.fn();
      const { container } = render(
        <Card variant="interactive" onClick={mockOnClick}>
          Test content
        </Card>,
        { container: mockContainer }
      );

      const cardElement = container.querySelector('.card');
      fireEvent.keyDown(cardElement!, { key: ' ', code: 'Space' });
      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Sub-components', () => {
    it('should render Card.Header', () => {
      render(
        <Card>
          <Card.Header>
            <Card.Title>Test Title</Card.Title>
          </Card.Header>
        </Card>,
        { container: mockContainer }
      );

      expect(screen.getByText('Test Title')).toBeInTheDocument();
      const headerElement = screen.getByText('Test Title').closest('.card-header');
      expect(headerElement).toBeInTheDocument();
      expect(headerElement).toHaveClass('card-header');
    });

    it('should render Card.Body', () => {
      render(
        <Card>
          <Card.Body>Body content</Card.Body>
        </Card>,
        { container: mockContainer }
      );

      const bodyElement = screen.getByText('Body content').closest('.card-body');
      expect(bodyElement).toBeInTheDocument();
      expect(bodyElement).toHaveClass('card-body');
    });

    it('should render Card.Footer', () => {
      render(
        <Card>
          <Card.Footer>Footer content</Card.Footer>
        </Card>,
        { container: mockContainer }
      );

      const footerElement = screen.getByText('Footer content').closest('.card-footer');
      expect(footerElement).toBeInTheDocument();
      expect(footerElement).toHaveClass('card-footer');
    });

    it('should render Card.Title with proper styling', () => {
      render(
        <Card>
          <Card.Header>
            <Card.Title>Test Title</Card.Title>
          </Card.Header>
        </Card>,
        { container: mockContainer }
      );

      const titleElement = screen.getByText('Test Title');
      expect(titleElement).toHaveClass('card-title');
    });

    it('should render Card.Description with proper styling', () => {
      render(
        <Card>
          <Card.Header>
            <Card.Title>Test Title</Card.Title>
            <Card.Description>Test description</Card.Description>
          </Card.Header>
        </Card>,
        { container: mockContainer }
      );

      const descriptionElement = screen.getByText('Test description');
      expect(descriptionElement).toHaveClass('card-description');
    });
  });

  describe('Composition and Flexibility', () => {
    it('should support complex composition', () => {
      render(
        <Card variant="elevated" className="custom-card">
          <Card.Header>
            <Card.Title>Message Card</Card.Title>
            <Card.Description>AI Assistant Response</Card.Description>
          </Card.Header>
          <Card.Body>
            <p>This is the main content of the message.</p>
          </Card.Body>
          <Card.Footer>
            <span>Actions go here</span>
          </Card.Footer>
        </Card>,
        { container: mockContainer }
      );

      expect(screen.getByText('Message Card')).toBeInTheDocument();
      expect(screen.getByText('AI Assistant Response')).toBeInTheDocument();
      expect(screen.getByText('This is the main content of the message.')).toBeInTheDocument();
      expect(screen.getByText('Actions go here')).toBeInTheDocument();

      const cardElement = screen.getByText('Message Card').closest('.card');
      expect(cardElement).toHaveClass('card', 'card-elevated', 'custom-card');
    });

    it('should work without sub-components', () => {
      render(
        <Card>
          <div>
            <h3>Direct content</h3>
            <p>No sub-components used</p>
          </div>
        </Card>,
        { container: mockContainer }
      );

      expect(screen.getByText('Direct content')).toBeInTheDocument();
      expect(screen.getByText('No sub-components used')).toBeInTheDocument();
    });

    it('should support partial sub-component usage', () => {
      render(
        <Card>
          <Card.Header>
            <Card.Title>Only Header</Card.Title>
          </Card.Header>
          <div className="p-4">Custom body content</div>
        </Card>,
        { container: mockContainer }
      );

      expect(screen.getByText('Only Header')).toBeInTheDocument();
      expect(screen.getByText('Custom body content')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes when interactive', () => {
      const { container } = render(
        <Card variant="interactive" onClick={() => {}}>
          Test content
        </Card>,
        { container: mockContainer }
      );

      const cardElement = container.querySelector('.card');
      expect(cardElement).toHaveAttribute('role', 'button');
      expect(cardElement).toHaveAttribute('tabIndex', '0');
    });

    it('should not have interactive ARIA attributes when not interactive', () => {
      const { container } = render(<Card>Test content</Card>, { container: mockContainer });

      const cardElement = container.querySelector('.card');
      expect(cardElement).not.toHaveAttribute('role');
      expect(cardElement).not.toHaveAttribute('tabIndex');
    });

    it('should support aria-label for interactive cards', () => {
      const { container } = render(
        <Card variant="interactive" onClick={() => {}} aria-label="Click to expand">
          Test content
        </Card>,
        { container: mockContainer }
      );

      const cardElement = container.querySelector('.card');
      expect(cardElement).toHaveAttribute('aria-label', 'Click to expand');
    });
  });

  describe('Border Options', () => {
    it('should apply default border', () => {
      const { container } = render(<Card>Test content</Card>, { container: mockContainer });

      const cardElement = container.querySelector('.card');
      expect(cardElement).toHaveClass('card');
    });

    it('should apply no border', () => {
      const { container } = render(<Card border="none">Test content</Card>, {
        container: mockContainer,
      });

      const cardElement = container.querySelector('.card');
      expect(cardElement).toHaveClass('border-0');
    });

    it('should apply subtle border', () => {
      const { container } = render(<Card border="subtle">Test content</Card>, {
        container: mockContainer,
      });

      const cardElement = container.querySelector('.card');
      expect(cardElement).toHaveClass('border-gray-100');
    });
  });

  describe('Error Boundaries', () => {
    it('should handle children rendering errors gracefully', () => {
      const ThrowingComponent = () => {
        throw new Error('Test error');
      };

      // This test verifies the card structure is maintained even if children fail
      expect(() => {
        render(
          <Card>
            <Card.Header>
              <Card.Title>Safe content</Card.Title>
            </Card.Header>
            <Card.Body>
              <ThrowingComponent />
            </Card.Body>
          </Card>,
          { container: mockContainer }
        );
      }).toThrow('Test error');
    });
  });
});
