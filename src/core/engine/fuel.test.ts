import { describe, it, expect } from 'vitest';
import { VANILLA_BLOCKS_BY_ID } from '../../data/blocks';
import type { ShipDesign, DesignBlock } from '../types';
import type { Direction } from '../../data/schema';
import {
  hydrogenCapacity,
  maxHydrogenBurn,
  engineHydrogenBurn,
  hydrogenGeneration,
  hoverHydrogenBurn,
  flightTime,
  uraniumUsage,
  solarGuidance,
} from './fuel';

function block(id: string, quantity: number, thrustDirection?: Direction): DesignBlock {
  const definition = VANILLA_BLOCKS_BY_ID[id];
  if (!definition) throw new Error(`test setup: unknown block id ${id}`);
  return thrustDirection === undefined
    ? { definition, quantity }
    : { definition, quantity, thrustDirection };
}

/** A hydrogen ship: 4 large H2 thrusters up, 2 large H2 tanks, cockpit. */
const hydroShip: ShipDesign = {
  id: 'h2',
  name: 'H2 Lifter',
  gridSize: 'large',
  blocks: [
    block('large-large-hydrogen-thruster', 4, 'up'),
    block('large-hydrogen-tank', 2),
    block('large-cockpit', 1),
  ],
  planetId: 'earthlike',
  cargo: { fillFraction: 0, densityKgPerL: 2.0 },
};

describe('hydrogen capacity & burn', () => {
  it('sums tank capacity', () => {
    // 2 × 15,000,000 L
    expect(hydrogenCapacity(hydroShip)).toBe(30_000_000);
  });

  it('sums max thruster burn at full throttle', () => {
    // 4 × 4820.05 L/s
    expect(maxHydrogenBurn(hydroShip)).toBeCloseTo(19_280.2, 1);
  });

  it('reports zero engine burn when there are no hydrogen engines', () => {
    expect(engineHydrogenBurn(hydroShip)).toBe(0);
  });

  it('sums O2/H2 generator hydrogen output', () => {
    const withGen: ShipDesign = {
      ...hydroShip,
      blocks: [...hydroShip.blocks, block('large-o2h2-generator', 2)],
    };
    expect(hydrogenGeneration(withGen)).toBe(1000); // 2 × 500 L/s
  });
});

describe('hover burn & flight time', () => {
  it('computes the throttle needed to hover and scales burn by it', () => {
    // Dry mass: 4×6940 + 2×8161.6 + 508 = 44,591.2 kg
    // weight = 44,591.2 × 9.81 = 437,439.7 N
    // up-thrust available (hydrogen, full) = 4 × 7,200,000 = 28,800,000 N
    // throttle = 437,439.7 / 28,800,000 = 0.015189
    // burn = 19,280.2 × 0.015189 = 292.85 L/s
    const dryMass = 4 * 6940 + 2 * 8161.6 + 508;
    const h = hoverHydrogenBurn(hydroShip, 'earthlike', dryMass);
    expect(h.canHover).toBe(true);
    expect(h.throttle).toBeCloseTo(0.015189, 4);
    expect(h.burnRate).toBeCloseTo(292.85, 0);
  });

  it('flags a ship that cannot hover (throttle > 1)', () => {
    // A single tiny thruster cannot lift heavy tanks.
    const heavy: ShipDesign = {
      ...hydroShip,
      blocks: [block('small-small-hydrogen-thruster', 1, 'up'), block('large-hydrogen-tank', 1)],
    };
    const h = hoverHydrogenBurn(heavy, 'earthlike', 8_161_600); // absurd mass
    expect(h.canHover).toBe(false);
  });

  it('gives infinite hover time in zero-g (no burn to hold position)', () => {
    const ft = flightTime(hydroShip, 'space', 44_591.2);
    expect(ft.hoverBurnRate).toBe(0);
    expect(ft.hoverTimeSeconds).toBe(Infinity);
  });

  it('computes hover time from capacity / hover burn', () => {
    const dryMass = 4 * 6940 + 2 * 8161.6 + 508;
    const ft = flightTime(hydroShip, 'earthlike', dryMass);
    // 30,000,000 L / 292.85 L/s ≈ 102,442 s
    expect(ft.hoverTimeSeconds).toBeCloseTo(30_000_000 / 292.85, -2);
    expect(ft.canHover).toBe(true);
  });

  it('full-throttle time is far shorter than hover time', () => {
    const dryMass = 4 * 6940 + 2 * 8161.6 + 508;
    const ft = flightTime(hydroShip, 'earthlike', dryMass);
    // full: 30,000,000 / 19,280.2 ≈ 1,556 s
    expect(ft.fullThrottleTimeSeconds).toBeCloseTo(30_000_000 / 19_280.2, -1);
    expect(ft.fullThrottleTimeSeconds).toBeLessThan(ft.hoverTimeSeconds);
  });
});

describe('uranium consumption', () => {
  const reactorShip: ShipDesign = {
    id: 'r',
    name: 'Reactor Ship',
    gridSize: 'large',
    blocks: [block('large-large-reactor', 1), block('large-large-ion-thruster', 2, 'up')],
    planetId: 'earthlike',
    cargo: { fillFraction: 0, densityKgPerL: 2.0 },
  };

  it('burns uranium at load / 1,000,000 Wh-per-kg', () => {
    // peak draw = 2 × 33,600,000 = 67,200,000 W
    // kg/h = 67,200,000 / 1,000,000 = 67.2 kg/h
    const u = uraniumUsage(reactorShip);
    expect(u.loadWatts).toBe(67_200_000);
    expect(u.kgPerHour).toBeCloseTo(67.2, 1);
    expect(u.kgPerSecond).toBeCloseTo(67.2 / 3600, 6);
  });

  it('reports zero uranium use when there is no reactor', () => {
    const u = uraniumUsage(hydroShip);
    expect(u.kgPerHour).toBe(0);
  });

  it('honors an explicit load override', () => {
    const u = uraniumUsage(reactorShip, 300_000_000); // full reactor output
    expect(u.kgPerHour).toBeCloseTo(300, 1);
  });
});

describe('solar guidance', () => {
  it('needs more panels accounting for day/night than at full sun', () => {
    // load 1,000,000 W, large panel 160,000 W
    const g = solarGuidance(160_000, 1_000_000);
    expect(g.panelsFullSun).toBe(7); // ceil(6.25)
    expect(g.panelsDayNight).toBe(13); // ceil(12.5) at 50% avg
    expect(g.panelsDayNight).toBeGreaterThan(g.panelsFullSun);
  });
});

describe('hover on Earthlike vs cargo', () => {
  it('burns more hydrogen to hover when loaded', () => {
    const empty = flightTime(hydroShip, 'earthlike', 44_591.2);
    const loaded = flightTime(
      { ...hydroShip, cargo: { fillFraction: 1, densityKgPerL: 2 } },
      'earthlike',
      44_591.2 + 200_000, // pretend payload
    );
    expect(loaded.hoverBurnRate).toBeGreaterThan(empty.hoverBurnRate);
    expect(loaded.hoverTimeSeconds).toBeLessThan(empty.hoverTimeSeconds);
  });
});
