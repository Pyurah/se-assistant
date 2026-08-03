import { describe, it, expect } from 'vitest';
import { VANILLA_BLOCKS_BY_ID } from '../../data/blocks';
import { PLANET_PRESETS_BY_ID } from '../../data/planets';
import type { ShipDesign, DesignBlock, Vec3 } from '../types';
import type { Direction } from '../../data/schema';
import {
  stoppingDistance,
  centerOfMass,
  thrustCenterAlignment,
  turnRateEstimate,
  hasGeometry,
} from './motion';

const space = PLANET_PRESETS_BY_ID['space']!;
const earthlike = PLANET_PRESETS_BY_ID['earthlike']!;

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

describe('stopping distance', () => {
  // 4 large hydrogen thrusters braking (pointing "down" gives up-thrust; for
  // braking forward motion we need backward thrust). Give it backward thrusters.
  const ship: ShipDesign = {
    id: 's',
    name: 'S',
    gridSize: 'large',
    blocks: [
      block('large-large-hydrogen-thruster', 4, { thrustDirection: 'backward' }),
      block('large-cockpit', 1),
    ],
    planetId: 'space',
    cargo: { fillFraction: 0, densityKgPerL: 2.0 },
  };

  it('uses braking thrust opposite to travel and v²/2a', () => {
    // backward thrust = 4 × 7,200,000 = 28,800,000 N
    // mass = 4×6940 + 508 = 28,268 kg
    // a = 28,800,000 / 28,268 = 1018.8 m/s²
    // from 100 m/s: distance = 100² / (2×1018.8) = 4.909 m
    const r = stoppingDistance(ship, space, 'forward', 100);
    expect(r.deceleration).toBeCloseTo(1018.8, 0);
    expect(r.distance).toBeCloseTo(4.909, 1);
    expect(r.time).toBeCloseTo(100 / 1018.8, 3);
  });

  it('reports infinite distance when there is no braking thrust', () => {
    const r = stoppingDistance(ship, space, 'up', 100); // no up/down thrusters
    expect(r.distance).toBe(Infinity);
  });

  it('is zero distance at zero speed', () => {
    const r = stoppingDistance(ship, space, 'forward', 0);
    expect(r.distance).toBe(0);
  });
});

describe('center of mass', () => {
  it('returns null without geometry', () => {
    const noGeo: ShipDesign = {
      id: 'n',
      name: 'N',
      gridSize: 'large',
      blocks: [block('large-cockpit', 1)], // no positions
      planetId: 'space',
      cargo: { fillFraction: 0, densityKgPerL: 2.0 },
    };
    expect(hasGeometry(noGeo)).toBe(false);
    expect(centerOfMass(noGeo)).toBeNull();
  });

  it('computes the mass-weighted average position', () => {
    // Two equal-mass blocks at x=0 and x=10 → CoM at x=5.
    const ship: ShipDesign = {
      id: 'c',
      name: 'C',
      gridSize: 'large',
      blocks: [
        block('large-large-cargo-container', 2, {
          positions: [
            { x: 0, y: 0, z: 0 },
            { x: 10, y: 0, z: 0 },
          ],
        }),
      ],
      planetId: 'space',
      cargo: { fillFraction: 0, densityKgPerL: 2.0 },
    };
    const com = centerOfMass(ship);
    expect(com).not.toBeNull();
    expect(com!.x).toBeCloseTo(5, 5);
    expect(com!.y).toBeCloseTo(0, 5);
  });

  it('weights toward the heavier block', () => {
    // Heavy reactor at x=0, light cockpit at x=10 → CoM near 0.
    const ship: ShipDesign = {
      id: 'w',
      name: 'W',
      gridSize: 'large',
      blocks: [
        block('large-large-reactor', 1, { positions: [{ x: 0, y: 0, z: 0 }] }), // 73,795 kg
        block('large-cockpit', 1, { positions: [{ x: 10, y: 0, z: 0 }] }), // 508 kg
      ],
      planetId: 'space',
      cargo: { fillFraction: 0, densityKgPerL: 2.0 },
    };
    const com = centerOfMass(ship);
    // 508×10 / (73795+508) = 0.068
    expect(com!.x).toBeCloseTo(0.068, 2);
  });
});

describe('thrust-center alignment', () => {
  it('returns null without geometry', () => {
    const noGeo: ShipDesign = {
      id: 'n',
      name: 'N',
      gridSize: 'large',
      blocks: [block('large-large-hydrogen-thruster', 1, { thrustDirection: 'up' })],
      planetId: 'space',
      cargo: { fillFraction: 0, densityKgPerL: 2.0 },
    };
    expect(thrustCenterAlignment(noGeo)).toBeNull();
  });

  it('reports a lateral offset when thrust is off-center from CoM', () => {
    // Mass centered at x=0 (single reactor). One up-thruster off at x=4 cells.
    // Large grid cell = 2.5 m → offset ~ (4 - comX) × 2.5.
    const ship: ShipDesign = {
      id: 'a',
      name: 'A',
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
    const alignment = thrustCenterAlignment(ship);
    expect(alignment).not.toBeNull();
    const up = alignment!.find((a) => a.direction === 'up');
    expect(up).toBeDefined();
    // CoM is near x=0 (reactor dominates); thrust center at x=4 → offset ~10 m.
    expect(up!.offsetMagnitude).toBeGreaterThan(5);
  });

  it('reports near-zero offset when thrust is centered on mass', () => {
    // Symmetric: two up-thrusters at ±2, mass centered between them.
    const ship: ShipDesign = {
      id: 'sym',
      name: 'Sym',
      gridSize: 'large',
      blocks: [
        block('large-cockpit', 1, { positions: [{ x: 0, y: 0, z: 0 }] }),
        block('large-large-hydrogen-thruster', 2, {
          thrustDirection: 'up',
          positions: [
            { x: -2, y: 0, z: 0 },
            { x: 2, y: 0, z: 0 },
          ],
        }),
      ],
      planetId: 'space',
      cargo: { fillFraction: 0, densityKgPerL: 2.0 },
    };
    const up = thrustCenterAlignment(ship)!.find((a) => a.direction === 'up');
    // Thruster center is x=0; CoM x weighted by masses but all at x∈{-2,0,2}
    // symmetric → thrust center 0. Cockpit at 0 pulls CoM to 0 too.
    expect(up!.offset.x).toBeCloseTo(0, 5);
  });
});

describe('turn rate estimate', () => {
  it('sums gyro torque and yields positive angular acceleration', () => {
    const ship: ShipDesign = {
      id: 't',
      name: 'T',
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
        block('large-cockpit', 1, { positions: [{ x: 0, y: 0, z: 0 }] }),
      ],
      planetId: 'space',
      cargo: { fillFraction: 0, densityKgPerL: 2.0 },
    };
    const t = turnRateEstimate(ship);
    expect(t.totalTorque).toBe(4 * 33_600_000);
    expect(t.momentOfInertia).toBeGreaterThan(0);
    expect(t.angularAcceleration).toBeGreaterThan(0);
    expect(t.timeToQuarterTurn).toBeGreaterThan(0);
    expect(t.timeToQuarterTurn).toBeLessThan(Infinity);
  });

  it('turns faster (less time) with more gyros for the same mass', () => {
    // Keep the footprint identical (all gyros stacked at the origin) so only
    // torque varies — isolating the gyro-count effect from the bounding box.
    const base = (gyros: number): ShipDesign => ({
      id: 'g',
      name: 'G',
      gridSize: 'large',
      blocks: [
        block('large-gyroscope', gyros, {
          positions: Array.from({ length: gyros }, () => ({ x: 0, y: 0, z: 0 })),
        }),
        block('large-large-reactor', 1, { positions: [{ x: 0, y: 0, z: 0 }] }),
      ],
      planetId: 'space',
      cargo: { fillFraction: 0, densityKgPerL: 2.0 },
    });
    const few = turnRateEstimate(base(1));
    const many = turnRateEstimate(base(8));
    // More gyros → more torque, but they also add mass (moment of inertia).
    // Net: torque scales linearly with count while gyro mass is a fraction of
    // the reactor-dominated total, so more gyros still turn faster.
    expect(many.timeToQuarterTurn).toBeLessThan(few.timeToQuarterTurn);
  });

  it('works without geometry using the mass-based fallback', () => {
    const ship: ShipDesign = {
      id: 'ng',
      name: 'NG',
      gridSize: 'large',
      blocks: [block('large-gyroscope', 2), block('large-cockpit', 1)],
      planetId: 'space',
      cargo: { fillFraction: 0, densityKgPerL: 2.0 },
    };
    const t = turnRateEstimate(ship);
    expect(t.totalTorque).toBe(2 * 33_600_000);
    expect(t.angularAcceleration).toBeGreaterThan(0);
  });
});

describe('stopping distance in atmosphere (ion thrusters weaker)', () => {
  it('reflects reduced thrust from environment scaling', () => {
    const ionShip: ShipDesign = {
      id: 'ion',
      name: 'Ion',
      gridSize: 'large',
      blocks: [block('large-large-ion-thruster', 4, { thrustDirection: 'backward' })],
      planetId: 'earthlike',
      cargo: { fillFraction: 0, densityKgPerL: 2.0 },
    };
    const inSpace = stoppingDistance(ionShip, space, 'forward', 100);
    const inAtmo = stoppingDistance(ionShip, earthlike, 'forward', 100);
    // Ion thrust is 30% in dense atmo → weaker braking → longer stop.
    expect(inAtmo.distance).toBeGreaterThan(inSpace.distance);
  });
});
