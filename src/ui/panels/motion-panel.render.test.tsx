import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { useDesignStore } from '../../app/store/design-store';
import { VANILLA_BLOCKS_BY_ID, type Direction } from '@data';
import type { ShipDesign, DesignBlock, Vec3 } from '@core';
import { MotionPanel } from './MotionPanel';

/** Build a DesignBlock from a vanilla definition, mirroring the engine tests. */
function block(
  id: string,
  quantity: number,
  opts?: { thrustDirection?: Direction; positions?: Vec3[] },
): DesignBlock {
  const definition = VANILLA_BLOCKS_BY_ID[id];
  if (!definition) throw new Error(`unknown block ${id}`);
  return {
    definition,
    quantity,
    ...(opts?.thrustDirection ? { thrustDirection: opts.thrustDirection } : {}),
    ...(opts?.positions ? { positions: opts.positions } : {}),
  };
}

/** Push a ready design straight into the store (bypasses XML parsing). */
function loadDesign(design: ShipDesign): void {
  useDesignStore.setState({
    design,
    planetId: design.planetId,
    cargo: design.cargo,
    status: 'ready',
    sourceName: `${design.name}.sbc`,
  });
}

describe('MotionPanel rendering', () => {
  beforeEach(() => {
    useDesignStore.getState().reset();
  });

  it('shows stopping distance for a braking-capable direction and "won\'t stop" where there is no braking thrust', () => {
    // Backward thrust brakes forward motion; no up/down thrust → can't brake a climb.
    const ship: ShipDesign = {
      id: 's',
      name: 'Brake Ship',
      gridSize: 'large',
      blocks: [
        block('large-large-hydrogen-thruster', 4, {
          thrustDirection: 'backward',
          positions: [
            { x: 0, y: 0, z: 0 },
            { x: 1, y: 0, z: 0 },
            { x: 2, y: 0, z: 0 },
            { x: 3, y: 0, z: 0 },
          ],
        }),
        block('large-cockpit', 1, { positions: [{ x: 0, y: 0, z: 2 }] }),
      ],
      planetId: 'space',
      cargo: { fillFraction: 0, densityKgPerL: 2.0 },
    };
    loadDesign(ship);
    render(<MotionPanel />);

    expect(screen.getByText(/dampener stopping distance/i)).toBeInTheDocument();

    // Forward brakes (has backward thrust) → a finite distance, no "won't stop".
    const forwardRow = screen.getByText('Forward').closest('div')!;
    expect(within(forwardRow).queryByText(/won't stop/i)).not.toBeInTheDocument();

    // Up has no braking thrust → the "won't stop" message.
    const upRow = screen.getByText(/up \(climb\)/i).closest('div')!;
    expect(within(upRow).getByText(/won't stop/i)).toBeInTheDocument();
  });

  it('lets the user change the cruise speed via a labeled input and offers presets', () => {
    const ship: ShipDesign = {
      id: 's',
      name: 'Brake Ship',
      gridSize: 'large',
      blocks: [
        block('large-large-hydrogen-thruster', 4, { thrustDirection: 'backward' }),
        block('large-cockpit', 1),
      ],
      planetId: 'space',
      cargo: { fillFraction: 0, densityKgPerL: 2.0 },
    };
    loadDesign(ship);
    render(<MotionPanel />);

    const speedInput = screen.getByLabelText(/cruise speed in meters per second/i);
    expect(speedInput).toHaveValue(100);
    expect(screen.getByRole('button', { name: '100 m/s' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '50 m/s' })).toBeInTheDocument();
  });

  it('shows the turn-rate estimate and badges it as an estimate', () => {
    const ship: ShipDesign = {
      id: 't',
      name: 'Gyro Ship',
      gridSize: 'large',
      blocks: [
        block('large-gyroscope', 4, {
          positions: [
            { x: 0, y: 0, z: 0 },
            { x: 1, y: 0, z: 0 },
            { x: 0, y: 1, z: 0 },
            { x: 0, y: 0, z: 1 },
          ],
        }),
        block('large-cockpit', 1, { positions: [{ x: 0, y: 0, z: 2 }] }),
      ],
      planetId: 'space',
      cargo: { fillFraction: 0, densityKgPerL: 2.0 },
    };
    loadDesign(ship);
    render(<MotionPanel />);

    expect(screen.getByText(/turn rate · 90° turn/i)).toBeInTheDocument();
    expect(screen.getByText('estimate')).toBeInTheDocument();
    expect(screen.getByText(/time to 90°/i)).toBeInTheDocument();
    expect(screen.getByText(/gyro torque/i)).toBeInTheDocument();
    expect(screen.queryByText(/no gyroscopes/i)).not.toBeInTheDocument();
  });

  it('shows "no gyroscopes" when the ship has no gyros', () => {
    const ship: ShipDesign = {
      id: 'ng',
      name: 'No Gyro',
      gridSize: 'large',
      blocks: [
        block('large-large-hydrogen-thruster', 2, {
          thrustDirection: 'up',
          positions: [
            { x: 0, y: 0, z: 0 },
            { x: 1, y: 0, z: 0 },
          ],
        }),
        block('large-cockpit', 1, { positions: [{ x: 0, y: 0, z: 2 }] }),
      ],
      planetId: 'space',
      cargo: { fillFraction: 0, densityKgPerL: 2.0 },
    };
    loadDesign(ship);
    render(<MotionPanel />);

    expect(screen.getByText(/no gyroscopes/i)).toBeInTheDocument();
  });

  it('surfaces an off-center thrust warning for a misaligned ship with geometry', () => {
    // Heavy reactor at x=0, single up-thruster off at x=4 → large lateral offset.
    const ship: ShipDesign = {
      id: 'off',
      name: 'Off-Center',
      gridSize: 'large',
      blocks: [
        block('large-large-reactor', 1, { positions: [{ x: 0, y: 0, z: 0 }] }),
        block('large-large-hydrogen-thruster', 1, {
          thrustDirection: 'up',
          positions: [{ x: 4, y: 0, z: 0 }],
        }),
      ],
      planetId: 'space',
      cargo: { fillFraction: 0, densityKgPerL: 2.0 },
    };
    loadDesign(ship);
    render(<MotionPanel />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/off-center thrust may cause spin/i);
    expect(alert).toHaveTextContent(/UP thrust is offset/i);
    // The per-direction list flags the UP row as off-center.
    expect(screen.getByText('off-center')).toBeInTheDocument();
  });

  it('shows the "needs block positions" note when the design has no geometry', () => {
    const ship: ShipDesign = {
      id: 'nogeo',
      name: 'Estimator',
      gridSize: 'large',
      blocks: [
        block('large-gyroscope', 2),
        block('large-large-hydrogen-thruster', 2, { thrustDirection: 'up' }),
        block('large-cockpit', 1),
      ],
      planetId: 'space',
      cargo: { fillFraction: 0, densityKgPerL: 2.0 },
    };
    loadDesign(ship);
    render(<MotionPanel />);

    expect(screen.getByText(/needs block positions/i)).toBeInTheDocument();
    expect(screen.getByText(/available when you import a blueprint/i)).toBeInTheDocument();
    // Turn rate still works without geometry (mass-based fallback).
    expect(screen.getByText(/time to 90°/i)).toBeInTheDocument();
  });
});
