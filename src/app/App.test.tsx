import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from './App';
import { useDesignStore } from './store/design-store';
import { EXAMPLE_BLUEPRINT_XML } from '../ui/lib/example-blueprint';

describe('App shell', () => {
  beforeEach(() => {
    useDesignStore.getState().reset();
  });

  it('renders the import/empty state when no design is loaded', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /analyze a ship/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /load example ship/i })).toBeInTheDocument();
  });

  it('switches to the analysis dashboard once a design is imported', async () => {
    await useDesignStore.getState().importBlueprint(EXAMPLE_BLUEPRINT_XML, 'example.sbc');
    render(<App />);
    expect(screen.getByRole('heading', { name: /prospector hauler/i })).toBeInTheDocument();
    expect(screen.getByText(/thrust-to-weight/i)).toBeInTheDocument();
  });
});
