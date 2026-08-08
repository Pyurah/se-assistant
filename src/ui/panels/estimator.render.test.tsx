import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { useEstimatorStore } from '../../app/store/estimator-store';
import { RecommendationsPanel } from './RecommendationsPanel';
import { EssentialsBuilder } from './EssentialsBuilder';
import { EstimatorConfigPanel } from './EstimatorConfigPanel';
import { EstimatorTwrPanel } from './EstimatorTwrPanel';

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

describe('EstimatorConfigPanel per-direction pickers', () => {
  beforeEach(() => {
    state().reset();
  });

  it('offers a "Same as default" option on each of the six direction selects', () => {
    render(<EstimatorConfigPanel />);
    // Six per-direction selects, each defaulting to "same as default" (empty value).
    for (const dir of ['up', 'down', 'forward', 'backward', 'left', 'right']) {
      const select = document.getElementById(`est-thruster-${dir}`) as HTMLSelectElement | null;
      expect(select).not.toBeNull();
      expect(select!.value).toBe('');
      expect(within(select!).getByRole('option', { name: /same as default/i })).toBeInTheDocument();
    }
  });

  it('reflects a pinned override as the selected value', () => {
    state().setDirectionalThruster('left', 'large-large-ion-thruster');
    render(<EstimatorConfigPanel />);
    const select = document.getElementById('est-thruster-left') as HTMLSelectElement;
    expect(select.value).toBe('large-large-ion-thruster');
  });

  it('renders ranked type chips under each direction once a build exists', () => {
    state().addBlock('large-large-cargo-container');
    state().setPlanet('earthlike');
    render(<EstimatorConfigPanel />);
    // Each direction's chip row exposes a pressable button per thruster type.
    const upSelect = document.getElementById('est-thruster-up') as HTMLSelectElement;
    const row = upSelect.closest('div')?.parentElement as HTMLElement;
    const chips = within(row).getAllByRole('button');
    // Three type chips (hydrogen / ion / atmospheric).
    expect(chips.length).toBeGreaterThanOrEqual(3);
    expect(within(row).getByText('Atmospheric')).toBeInTheDocument();
    expect(within(row).getByText('Ion')).toBeInTheDocument();
  });

  it('clicking a suggestion chip pins that type to the direction', () => {
    state().addBlock('large-large-cargo-container');
    state().setPlanet('earthlike');
    render(<EstimatorConfigPanel />);
    const leftSelect = document.getElementById('est-thruster-left') as HTMLSelectElement;
    expect(leftSelect.value).toBe('');
    const row = leftSelect.closest('div')?.parentElement as HTMLElement;
    // Pin ion to the LEFT axis by clicking its chip. The pinned block is the
    // ion variant the engine ranked for this axis (least added mass) — which at
    // the smaller lateral requirement is the small model, not the large one.
    fireEvent.click(within(row).getByRole('button', { name: /^Ion/ }));
    expect(state().thrusterOverrides.left).toMatch(/ion-thruster$/);
    const pinned = state().thrusterOverrides.left;
    // The select reflects the pinned block.
    expect(
      (document.getElementById('est-thruster-left') as HTMLSelectElement).value,
    ).toBe(pinned);
  });
});

describe('EstimatorTwrPanel rendering', () => {
  beforeEach(() => {
    state().reset();
  });

  it('renders nothing before any essentials are added', () => {
    const { container } = render(<EstimatorTwrPanel />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders six directional TWR meters once a build exists', () => {
    state().addBlock('large-large-cargo-container');
    state().setPlanet('earthlike');
    render(<EstimatorTwrPanel />);
    const meters = screen.getAllByRole('meter');
    expect(meters).toHaveLength(6);
    expect(screen.getByText(/thrust-to-weight/i)).toBeInTheDocument();
  });

  it('shows a no-gravity note in space instead of runaway bars', () => {
    state().addBlock('large-large-cargo-container');
    state().setPlanet('space');
    render(<EstimatorTwrPanel />);
    expect(screen.getByText(/no gravity here/i)).toBeInTheDocument();
  });
});
