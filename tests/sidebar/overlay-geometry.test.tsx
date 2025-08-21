import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatPanel } from '@/sidebar/ChatPanel';

describe('Overlay: Positioning, Resize, Drag', () => {
  beforeEach(() => {
    // Stable viewport for deterministic math
    Object.defineProperty(window, 'innerHeight', { value: 800, writable: true });
    Object.defineProperty(window, 'innerWidth', { value: 1200, writable: true });
    // Minimal matchMedia mock for theme utils
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  });

  it('renders fixed overlay with high z-index class', () => {
    render(<ChatPanel onClose={() => {}} />);
    const panel = screen.getByTestId('chat-panel');
    expect(panel).toBeInTheDocument();
    // Structural assertions; styles are applied via CSS class
    expect(panel).toHaveClass('ai-sidebar-overlay');
  });

  it('resizes width within min/max constraints (east/west)', async () => {
    render(<ChatPanel onClose={() => {}} />);
    const panel = screen.getByTestId('chat-panel') as HTMLElement;

    const left = parseInt(panel.style.left, 10);
    const top = parseInt(panel.style.top, 10);
    const initialWidth = parseInt(panel.style.width, 10);

    // Expand using east handle beyond max (should clamp to 800)
    const east = document.querySelector('.ai-sidebar-resize-handle--e') as HTMLElement;
    fireEvent.mouseDown(east, { clientX: left + initialWidth, clientY: top + 10 });
    fireEvent.mouseMove(document, { clientX: left + initialWidth + 1000, clientY: top + 10 });
    fireEvent.mouseUp(document);
    expect(parseInt(panel.style.width, 10)).toBe(800);

    // Shrink using west handle beyond min (should clamp to 300)
    const west = document.querySelector('.ai-sidebar-resize-handle--w') as HTMLElement;
    const right = parseInt(panel.style.left, 10) + parseInt(panel.style.width, 10);
    fireEvent.mouseDown(west, { clientX: right, clientY: top + 10 });
    fireEvent.mouseMove(document, { clientX: right + 2000, clientY: top + 10 });
    fireEvent.mouseUp(document);
    expect(parseInt(panel.style.width, 10)).toBe(300);
  });

  it('drags by header, updates position accordingly', async () => {
    const user = userEvent.setup();
    render(<ChatPanel onClose={() => {}} />);
    const panel = screen.getByTestId('chat-panel') as HTMLElement;
    const header = screen.getByTestId('sidebar-header');

    const startLeft = parseInt(panel.style.left, 10);
    const startTop = parseInt(panel.style.top, 10);

    // Start drag on header, move by (+50, +20)
    fireEvent.mouseDown(header, { clientX: startLeft + 10, clientY: startTop + 10 });
    fireEvent.mouseMove(document, { clientX: startLeft + 60, clientY: startTop + 30 });
    fireEvent.mouseUp(document);

    const endLeft = parseInt(panel.style.left, 10);
    const endTop = parseInt(panel.style.top, 10);

    expect(endLeft - startLeft).toBe(50);
    expect(endTop - startTop).toBe(20);
  });
});
