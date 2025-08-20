import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

const Popup = () => {
  return (
    <div className="popup-container">
      <h1>Browser Sidebar</h1>
      <p>Popup placeholder</p>
    </div>
  );
};

describe('Popup Component', () => {
  it('renders the popup with correct title', () => {
    render(<Popup />);

    const heading = screen.getByRole('heading', { name: /Browser Sidebar/i });
    expect(heading).toBeInTheDocument();

    const text = screen.getByText(/Popup placeholder/i);
    expect(text).toBeInTheDocument();
  });
});
