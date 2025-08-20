import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Import comprehensive Chrome API mocks
import './chrome-mock';

// Mock IntersectionObserver for MessageList component
global.IntersectionObserver = vi.fn().mockImplementation((_callback) => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  root: null,
  rootMargin: '',
  thresholds: [],
}));

// Mock scrollTo method for DOM elements
Element.prototype.scrollTo = vi.fn();
window.scrollTo = vi.fn();

// Mock confirm dialog
Object.defineProperty(window, 'confirm', {
  writable: true,
  value: vi.fn(() => true),
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
