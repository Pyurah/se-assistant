import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { useEstimatorStore } from '../../app/store/estimator-store';
import { RecommendationsPanel } from './RecommendationsPanel';
import { EssentialsBuilder } from './EssentialsBuilder';

const state = () => useEstimatorStore.getState();

describe('RecommendationsPanel rendering', () => {
  beforeEach(() => {
    state().reset();
  });

  it('shows the empty guidance state before any essentials are added', () => {
    render(<RecommendationsPanel />);
    expect(screen.getByText(/add your essential gear/i)).toBeInTheDocument();
    // No numeric readout yet.
    expect(screen.queryByText(/loaded up-twr/i)).not.toBeInTheDocument();
  });

  it('renders per-direction thruster counts once essentials exist', () => {
    state().addBlock('large-large-cargo-container');
    state().setPlanet('earthlike');
    render(<RecommendationsPanel />);
    // The UP (lift) direction is emphasized and present, along with the totals.
    expect(screen.getByText(/up \(lift\)/i)).toBeInTheDocument();
    expect(screen.getByText(/loaded up-twr/i)).toBeInTheDocument();
    expect(screen.getByText(/dry mass/i)).toBeInTheDocument();
  });

  it('labels the gyro count clearly as an estimate', () => {
    state().addBlock('large-large-cargo-container');
    render(<RecommendationsPanel />);
    const gyroHeading = screen.getByRole('heading', { name: /gyroscopes/i });
    const section = gyroHeading.closest('section');
    expect(section).not.toBeNull();
    expect(within(section as HTMLElement).getByText(/estimate/i)).toBeInTheDocument();
  });

  it('surfaces a prominent warning for atmospheric thrusters in space', () => {
    state().addBlock('large-large-cargo-container');
    state().setPlanet('space');
    state().setThruster('large-large-atmospheric-thruster');
    render(<RecommendationsPanel />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/no thrust|thrust/i);
  });

  it('shows the planning-estimate disclaimer', () => {
    state().addBlock('large-large-cargo-container');
    render(<RecommendationsPanel />);
    expect(screen.getByText(/planning estimate/i)).toBeInTheDocument();
    expect(screen.getByText(/import the real blueprint/i)).toBeInTheDocument();
  });
});

describe('EssentialsBuilder rendering', () => {
  beforeEach(() => {
    state().reset();
  });

  it('prompts to add gear when empty', () => {
    render(<EssentialsBuilder />);
    expect(screen.getByText(/no essentials yet/i)).toBeInTheDocument();
  });

  it('lists added essentials with a quantity control', () => {
    state().addBlock('large-drill');
    state().setQuantity('large-drill', 4);
    render(<EssentialsBuilder />);
    const qtyInput = screen.getByLabelText('Drill (Large Grid) quantity');
    expect(qtyInput).toHaveValue(4);
  });
});
