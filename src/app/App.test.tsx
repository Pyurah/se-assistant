import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from './App';

describe('App shell', () => {
  it('renders the product name and scaffolding status', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /se assistant/i })).toBeInTheDocument();
    expect(screen.getByText(/scaffolding ready/i)).toBeInTheDocument();
  });
});
