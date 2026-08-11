import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within, fireEvent, act } from '@testing-library/react';
import { useEstimatorStore } from '../../app/store/estimator-store';
import { VANILLA_BLOCKS_BY_ID } from '@data';
import type { BlockDefinition, ThrusterBlock } from '@data';
import type { ShipDesign, DesignBlock } from '@core';
import { RecommendationsPanel } from './RecommendationsPanel';
import { EssentialsBuilder } from './EssentialsBuilder';
import { ThrusterAssignmentPanel } from './ThrusterAssignmentPanel';
import { EstimatorTwrPanel } from './EstimatorTwrPanel';
import { SeedFromBlueprint } from './SeedFromBlueprint';

const state = () => useEstimatorStore.getState();

const cockpit = VANILLA_BLOCKS_BY_ID['large-cockpit'] as BlockDefinition;
const largeCargo = VANILLA_BLOCKS_BY_ID['large-large-cargo-container'] as BlockDefinition;
const atmoLarge = VANILLA_BLOCKS_BY_ID['large-large-atmospheric-thruster'] as ThrusterBlock;

const ATMO = 'large-large-atmospheric-thruster';
const ION = 'large-large-ion-thruster';

const moddedBlock: BlockDefinition = {
  id: 'modded:Exotic',
  subtypeId: 'Exotic',
  displayName: 'Exotic Widget',
  category: 'other',
  gridSize: 'large',
  dlc: 'base',
  mass: 0,
  source: 'blueprint',
};

function seedDesign(blocks: DesignBlock[]): ShipDesign {
  return {
    id: 'seed-src',
    name: 'Seed Source',
    gridSize: 'large',
    blocks,
    planetId: 'earthlike',
    cargo: { fillFraction: 0.5, densityKgPerL: 2.8 },
  };
}

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
    state().setThrusterCount('up', ATMO, 4);
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

describe('ThrusterAssignmentPanel manual assignment', () => {
  beforeEach(() => {
    state().reset();
  });

  it('offers a grouped "add thruster type" select for each of the six directions', () => {
    render(<ThrusterAssignmentPanel />);
    for (const dir of ['up', 'down', 'forward', 'backward', 'left', 'right']) {
      const select = document.getElementById(`est-add-thruster-${dir}`) as HTMLSelectElement | null;
      expect(select).not.toBeNull();
      // Placeholder is selected until the user picks a type.
      expect(select!.value).toBe('');
      expect(
        within(select!).getByRole('option', { name: /add thruster type/i }),
      ).toBeInTheDocument();
    }
  });

  it('adding a thruster type to a direction appends it to that stack', () => {
    render(<ThrusterAssignmentPanel />);
    const select = document.getElementById('est-add-thruster-up') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: ATMO } });
    expect(state().thrusterStacks.up).toEqual([{ blockId: ATMO, count: 1 }]);
  });

  it('renders an assigned stack row with a count stepper and remove control', () => {
    state().setThrusterCount('left', ION, 3);
    render(<ThrusterAssignmentPanel />);
    const count = screen.getByRole('status', { name: /count for left/i });
    expect(count).toHaveTextContent('3');
    expect(screen.getByRole('button', { name: /remove .* from left/i })).toBeInTheDocument();
  });

  it('supports mixing multiple thruster types in one direction', () => {
    render(<ThrusterAssignmentPanel />);
    const select = document.getElementById('est-add-thruster-up') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: ATMO } });
    fireEvent.change(select, { target: { value: ION } });
    expect(state().thrusterStacks.up.map((e) => e.blockId)).toEqual([ATMO, ION]);
  });

  it('exposes a per-direction goal input that writes to the store', () => {
    render(<ThrusterAssignmentPanel />);
    const goal = document.getElementById('est-goal-up') as HTMLInputElement;
    // Default UP goal is 2.0.
    expect(goal).toHaveValue(2);
    fireEvent.change(goal, { target: { value: '3.5' } });
    expect(state().directionGoals.up).toBe(3.5);
  });

  it('drives the empty/loaded goal check from the shared store slice', () => {
    render(<ThrusterAssignmentPanel />);
    const loaded = screen.getByRole('radio', { name: /loaded/i });
    const empty = screen.getByRole('radio', { name: /empty/i });
    // Default is loaded (worst case).
    expect(loaded).toBeChecked();
    fireEvent.click(empty);
    expect(state().goalLoadState).toBe('empty');
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
    state().setThrusterCount('up', ATMO, 8);
    state().setPlanet('earthlike');
    render(<EstimatorTwrPanel />);
    const meters = screen.getAllByRole('meter');
    expect(meters).toHaveLength(6);
    expect(screen.getByText(/thrust-to-weight/i)).toBeInTheDocument();
  });

  it('swaps TWR for directional acceleration in space', () => {
    // Assign thrusters so the synthesized build actually accelerates in vacuum.
    state().addBlock('large-large-cargo-container');
    state().setPlanet('space');
    state().setThrusterCount('up', ION, 8);
    render(<EstimatorTwrPanel />);
    expect(screen.getAllByText(/directional acceleration/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/reaches 100 m\/s in/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/not applicable in space/i)).not.toBeInTheDocument();
  });

  it('rescales time-to-top-speed when the speed cap changes', () => {
    state().addBlock('large-large-cargo-container');
    state().setPlanet('space');
    state().setThrusterCount('up', ION, 8);
    render(<EstimatorTwrPanel />);
    fireEvent.click(screen.getByRole('button', { name: '500 m/s' }));
    expect(screen.getAllByText(/reaches 500 m\/s in/i).length).toBeGreaterThan(0);
  });

  it('shows the seed caption only when the build was seeded from a blueprint', () => {
    state().addBlock('large-large-cargo-container');
    state().setThrusterCount('up', ATMO, 8);
    state().setPlanet('earthlike');
    const { unmount } = render(<EstimatorTwrPanel />);
    // Hand-started build: no seed caption.
    expect(screen.queryByText(/re-estimated/i)).not.toBeInTheDocument();
    unmount();

    // Seed from a design, then re-render: the caption appears.
    state().seedFromDesign(
      seedDesign([
        { definition: cockpit, quantity: 1 },
        { definition: largeCargo, quantity: 2 },
        { definition: atmoLarge, quantity: 8, thrustDirection: 'up' },
      ]),
      'ship.sbc',
    );
    render(<EstimatorTwrPanel />);
    expect(screen.getByText(/re-estimated/i)).toBeInTheDocument();
  });
});

describe('SeedFromBlueprint rendering', () => {
  beforeEach(() => {
    state().reset();
  });

  it('shows the dropzone prompt when nothing has been seeded', () => {
    render(<SeedFromBlueprint />);
    expect(screen.getByText(/start from a blueprint/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Matches/)).not.toBeInTheDocument();
  });

  it('shows a "Matches {source}" indicator right after seeding', () => {
    state().seedFromDesign(
      seedDesign([
        { definition: cockpit, quantity: 1 },
        { definition: largeCargo, quantity: 2 },
        { definition: atmoLarge, quantity: 8, thrustDirection: 'up' },
      ]),
      'ship.sbc',
    );
    render(<SeedFromBlueprint />);
    expect(screen.getByText(/^Matches/)).toBeInTheDocument();
    expect(screen.getByText('ship.sbc')).toBeInTheDocument();
    // Not adjusted yet → no reset button.
    expect(screen.queryByRole('button', { name: /reset to source/i })).not.toBeInTheDocument();
  });

  it('flips to "Adjusted" and reveals Reset after an edit, which reset undoes', () => {
    state().seedFromDesign(
      seedDesign([
        { definition: cockpit, quantity: 1 },
        { definition: largeCargo, quantity: 2 },
        { definition: atmoLarge, quantity: 8, thrustDirection: 'up' },
      ]),
      'ship.sbc',
    );
    const { rerender } = render(<SeedFromBlueprint />);
    // Adjust the build → indicator flips and Reset appears.
    act(() => state().setQuantity(largeCargo.id, 5));
    rerender(<SeedFromBlueprint />);
    expect(screen.getByText(/adjusted — no longer matches/i)).toBeInTheDocument();
    const resetBtn = screen.getByRole('button', { name: /reset to source/i });
    fireEvent.click(resetBtn);
    rerender(<SeedFromBlueprint />);
    expect(screen.getByText(/^Matches/)).toBeInTheDocument();
    expect(state().fixedBlocks.find((b) => b.id === largeCargo.id)?.quantity).toBe(2);
  });

  it('lists skipped modded blocks as diagnostics chips', () => {
    state().seedFromDesign(
      seedDesign([
        { definition: cockpit, quantity: 1 },
        { definition: moddedBlock, quantity: 3 },
      ]),
      'modded.sbc',
    );
    render(<SeedFromBlueprint />);
    expect(screen.getByText(/not carried over/i)).toBeInTheDocument();
    expect(screen.getByText(/Exotic Widget/)).toBeInTheDocument();
  });
});
