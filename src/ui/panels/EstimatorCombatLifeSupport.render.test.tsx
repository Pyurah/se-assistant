import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useEstimatorStore } from '../../app/store/estimator-store';
import { EstimatorLifeSupportPanel } from './EstimatorLifeSupportPanel';
import { EstimatorCombatPanel } from './EstimatorCombatPanel';

const state = () => useEstimatorStore.getState();

describe('EstimatorLifeSupportPanel rendering', () => {
  beforeEach(() => {
    state().reset();
  });

  it('renders nothing before any essentials are added', () => {
    const { container } = render(<EstimatorLifeSupportPanel />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the no-hardware empty state for a build with no gas gear', () => {
    state().addBlock('large-large-cargo-container');
    render(<EstimatorLifeSupportPanel />);
    expect(screen.getByText(/no life-support hardware/i)).toBeInTheDocument();
    // Guides the user to add gear rather than showing zeros.
    expect(screen.getByText(/add an o2\/h2 generator/i)).toBeInTheDocument();
  });

  it('shows crew oxygen balance once an O2/H2 generator is declared', () => {
    state().addBlock('large-o2h2-generator');
    render(<EstimatorLifeSupportPanel />);
    // A large generator (250 L/s O2) covers a small crew.
    expect(screen.getByText(/generation covers the crew/i)).toBeInTheDocument();
    expect(screen.getByText(/supports/i)).toBeInTheDocument();
    expect(screen.getByText(/ice burn/i)).toBeInTheDocument();
    expect(screen.getByRole('meter')).toBeInTheDocument();
  });
});

describe('EstimatorCombatPanel rendering', () => {
  beforeEach(() => {
    state().reset();
  });

  it('renders nothing before any essentials are added', () => {
    const { container } = render(<EstimatorCombatPanel />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the unarmed empty state for a build with no weapons', () => {
    state().addBlock('large-large-cargo-container');
    render(<EstimatorCombatPanel />);
    expect(screen.getByText(/unarmed/i)).toBeInTheDocument();
    expect(screen.getByText(/add weapons to your essentials/i)).toBeInTheDocument();
  });

  it('shows DPS + ammo readout once a weapon is declared', () => {
    state().addBlock('weapon-small-gatling-turret');
    state().setQuantity('weapon-small-gatling-turret', 2);
    render(<EstimatorCombatPanel />);
    // Exact Stat labels — the per-weapon table also has a "burst / sustained DPS"
    // column header, so a loose /sustained dps/i would match two nodes.
    expect(screen.getByText('Burst DPS')).toBeInTheDocument();
    expect(screen.getByText('Sustained DPS')).toBeInTheDocument();
    expect(screen.getByText(/ammo lasts/i)).toBeInTheDocument();
    // The declared weapon appears in the per-weapon rows.
    expect(screen.getByText(/gatling turret/i)).toBeInTheDocument();
  });
});
