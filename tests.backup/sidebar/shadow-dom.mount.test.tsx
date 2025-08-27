import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mountSidebar, unmountSidebar } from '@/sidebar/index';

describe('Shadow DOM Mount/Unmount', () => {
  beforeEach(() => {
    // Ensure clean slate
    unmountSidebar();
    // Provide matchMedia for theme provider
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

  afterEach(() => {
    unmountSidebar();
  });

  it('mounts sidebar into Shadow DOM with host and root', () => {
    mountSidebar();

    const host = document.getElementById('ai-browser-sidebar-host');
    expect(host).toBeInTheDocument();
    // @ts-expect-error JSDOM supports shadowRoot
    const sr: ShadowRoot | null = host!.shadowRoot;
    expect(sr).toBeTruthy();
    const container = sr!.getElementById('ai-browser-sidebar-root');
    expect(container).toBeInTheDocument();

    // Style tag should be injected for Shadow DOM styles
    const styleEl = sr!.querySelector('style');
    expect(styleEl).toBeTruthy();
  });

  it('unmounts cleanly and removes host container', () => {
    mountSidebar();
    unmountSidebar();
    const host = document.getElementById('ai-browser-sidebar-host');
    expect(host).not.toBeInTheDocument();
  });

  it('closes on Escape via global keydown handler', () => {
    mountSidebar();
    expect(document.getElementById('ai-browser-sidebar-host')).toBeInTheDocument();

    const evt = new KeyboardEvent('keydown', { key: 'Escape' });
    document.dispatchEvent(evt);

    expect(document.getElementById('ai-browser-sidebar-host')).not.toBeInTheDocument();
  });
});
