import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Import comprehensive Chrome API mocks
import './chrome-mock';

afterEach(() => {
  cleanup();
});
