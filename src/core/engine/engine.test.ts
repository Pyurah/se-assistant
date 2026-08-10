import { describe, it, expect } from 'vitest';
import { VANILLA_BLOCKS, VANILLA_BLOCKS_BY_ID } from '../../data/blocks';
import { PLANET_PRESETS_BY_ID } from '../../data/planets';
import type { ShipDesign, DesignBlock } from '../types';
import type { ThrusterBlock, Direction } from '../../data/schema';
import { thrusterEffectiveness, effectiveThrust } from './thruster';
import {
  dryMass,
  cargoCapacity,
  cargoMass,
  loadedMass,
  massByCategory,
  addedMass,
  extraPayload,
  massSummary,
} from './mass';
import {
  directionalThrust,
  directionalTwr,
  directionalAcceleration,
  liftAnalysis,
  type DirectionalThrust,
} from './twr';
import { powerSummary } from './power';
import { recommendThrusters, rankThrusterTypes } from './recommend';

/** Build a DesignBlock from a dataset id, optionally with a thrust direction. */
function block(id: string, quantity: number, thrustDirection?: Direction): DesignBlock {
  const definition = VANILLA_BLOCKS_BY_ID[id];
  if (!definition) throw new Error(`test setup: unknown block id ${id}`);
  return thrustDirection === undefined
    ? { definition, quantity }
    : { definition, quantity, thrustDirection };
}

const earthlike = PLANET_PRESETS_BY_ID['earthlike']!;
const moon = PLANET_PRESETS_BY_ID['moon']!;
const space = PLANET_PRESETS_BY_ID['space']!;

const ionLarge = VANILLA_BLOCKS_BY_ID['large-large-ion-thruster'] as ThrusterBlock;
const atmoLarge = VANILLA_BLOCKS_BY_ID['large-large-atmospheric-thruster'] as ThrusterBlock;
const hydroLarge = VANILLA_BLOCKS_BY_ID['large-large-hydrogen-thruster'] as ThrusterBlock;

describe('thruster effectiveness (air-density scaling)', () => {
  it('ion: full in vacuum, 30% at sea level, lerped between', () => {
    expect(thrusterEffectiveness(ionLarge, 0)).toBeCloseTo(1.0, 5);
    expect(thrusterEffectiveness(ionLarge, 1)).toBeCloseTo(0.3, 5);
    expect(thrusterEffectiveness(ionLarge, 0.5)).toBeCloseTo(0.65, 5);
  });

  it('atmospheric: dead in vacuum & below 0.3, full in dense air', () => {
    expect(thrusterEffectiveness(atmoLarge, 0)).toBeCloseTo(0, 5);
    expect(thrusterEffectiveness(atmoLarge, 0.3)).toBeCloseTo(0, 5);
    expect(thrusterEffectiveness(atmoLarge, 1)).toBeCloseTo(1.0, 5);
    // midpoint of the 0.3..1 band (0.65) → 0.5
    expect(thrusterEffectiveness(atmoLarge, 0.65)).toBeCloseTo(0.5, 5);
  });

  it('hydrogen: flat 1.0 everywhere', () => {
    expect(thrusterEffectiveness(hydroLarge, 0)).toBe(1);
    expect(thrusterEffectiveness(hydroLarge, 1)).toBe(1);
  });

  it('effective thrust applies the multiplier to max thrust', () => {
    // Large ion: 4,320,000 N × 0.3 at sea level.
    expect(effectiveThrust(ionLarge, 1)).toBeCloseTo(1_296_000, 0);
    // Large atmospheric: full 6,480,000 N in dense air.
    expect(effectiveThrust(atmoLarge, 1)).toBeCloseTo(6_480_000, 0);
  });
});

describe('mass & cargo (worked example)', () => {
  // Large reactor (73,795) + 4 hydrogen thrusters (6,940 ea) + large cargo (2,593.6).
  const ship: ShipDesign = {
    id: 'hauler',
    name: 'Hauler',
    gridSize: 'large',
    blocks: [
      block('large-large-reactor', 1),
      block('large-large-hydrogen-thruster', 4, 'up'),
      block('large-large-cargo-container', 1),
    ],
    planetId: 'earthlike',
    cargo: { fillFraction: 1.0, densityKgPerL: 2.0 },
  };

  it('dry mass sums block mass × quantity', () => {
    // 73,795 + 4×6,940 + 2,593.6 = 104,148.6
    expect(dryMass(ship)).toBeCloseTo(104_148.6, 1);
  });

  it('breaks mass down by category', () => {
    const by = massByCategory(ship);
    expect(by.reactor).toBeCloseTo(73_795, 1);
    expect(by.thruster).toBeCloseTo(27_760, 1);
    expect(by.cargo).toBeCloseTo(2_593.6, 1);
  });

  it('cargo capacity is the container volume', () => {
    expect(cargoCapacity(ship)).toBe(421_000);
  });

  it('cargo mass = capacity × fill × density', () => {
    // 421,000 × 1.0 × 2.0 = 842,000
    expect(cargoMass(ship)).toBeCloseTo(842_000, 0);
  });

  it('loaded mass = dry + cargo', () => {
    expect(loadedMass(ship)).toBeCloseTo(946_148.6, 1);
  });

  it('clamps fill fraction to [0,1]', () => {
    const over = { ...ship, cargo: { fillFraction: 2.0, densityKgPerL: 2.0 } };
    expect(cargoMass(over)).toBeCloseTo(842_000, 0); // clamped to 1.0
  });
});

describe('freeform extra mass (worked example)', () => {
  // The same hauler, now with a 10 t docked module bolted on (always-on) and a
  // 5 t detachable payload being hauled (loaded-only).
  const base: ShipDesign = {
    id: 'hauler',
    name: 'Hauler',
    gridSize: 'large',
    blocks: [
      block('large-large-reactor', 1),
      block('large-large-hydrogen-thruster', 4, 'up'),
      block('large-large-cargo-container', 1),
    ],
    planetId: 'earthlike',
    cargo: { fillFraction: 1.0, densityKgPerL: 2.0 },
  };
  // Dry (blocks only) = 104,148.6; cargo payload = 842,000.
  const blocksDry = 104_148.6;
  const cargoPayload = 842_000;

  it('absent extraMass is identical to the pre-feature ship', () => {
    expect(addedMass(base)).toBe(0);
    expect(extraPayload(base)).toBe(0);
    expect(dryMass(base)).toBeCloseTo(blocksDry, 1);
    expect(loadedMass(base)).toBeCloseTo(blocksDry + cargoPayload, 1);
  });

  it('always-on added mass counts in BOTH dry and loaded', () => {
    const ship = { ...base, extraMass: { added: 10_000, payload: 0 } };
    // Dry mass gains the always-on module: 104,148.6 + 10,000.
    expect(dryMass(ship)).toBeCloseTo(blocksDry + 10_000, 1);
    // Loaded inherits it (dry already includes it) plus cargo.
    expect(loadedMass(ship)).toBeCloseTo(blocksDry + 10_000 + cargoPayload, 1);
  });

  it('loaded-only extra payload counts ONLY in loaded, not dry', () => {
    const ship = { ...base, extraMass: { added: 0, payload: 5_000 } };
    // Dry mass unchanged — the hauled load isn't part of the empty ship.
    expect(dryMass(ship)).toBeCloseTo(blocksDry, 1);
    // Loaded gains the hauled payload alongside the cargo hold.
    expect(loadedMass(ship)).toBeCloseTo(blocksDry + cargoPayload + 5_000, 1);
  });

  it('both together: added in dry & loaded, payload only in loaded', () => {
    const ship = { ...base, extraMass: { added: 10_000, payload: 5_000 } };
    expect(dryMass(ship)).toBeCloseTo(blocksDry + 10_000, 1);
    expect(loadedMass(ship)).toBeCloseTo(blocksDry + 10_000 + cargoPayload + 5_000, 1);
  });

  it('clamps negative extra mass to zero', () => {
    const ship = { ...base, extraMass: { added: -10_000, payload: -5_000 } };
    expect(addedMass(ship)).toBe(0);
    expect(extraPayload(ship)).toBe(0);
    expect(dryMass(ship)).toBeCloseTo(blocksDry, 1);
    expect(loadedMass(ship)).toBeCloseTo(blocksDry + cargoPayload, 1);
  });

  it('massSummary surfaces addedMass and extraPayload', () => {
    const ship = { ...base, extraMass: { added: 10_000, payload: 5_000 } };
    const summary = massSummary(ship);
    expect(summary.addedMass).toBe(10_000);
    expect(summary.extraPayload).toBe(5_000);
    expect(summary.dryMass).toBeCloseTo(blocksDry + 10_000, 1);
    expect(summary.loadedMass).toBeCloseTo(blocksDry + 10_000 + cargoPayload + 5_000, 1);
    // Extra mass is NOT block mass, so the by-category breakdown is unchanged.
    expect(summary.byCategory.reactor).toBeCloseTo(73_795, 1);
  });

  it('extra mass raises loaded weight, lowering TWR', () => {
    const light = { ...base, cargo: { fillFraction: 0, densityKgPerL: 2.0 } };
    const heavy = { ...light, extraMass: { added: 50_000, payload: 0 } };
    const lightTwr = directionalTwr(light, earthlike, dryMass(light));
    const heavyTwr = directionalTwr(heavy, earthlike, dryMass(heavy));
    // Same thrust, more mass → strictly lower up-TWR.
    expect(heavyTwr.up).toBeLessThan(lightTwr.up);
  });
});


describe('directional TWR & lift analysis', () => {
  // 4 large hydrogen thrusters pointing up on a light-ish frame.
  const lifter: ShipDesign = {
    id: 'lifter',
    name: 'Lifter',
    gridSize: 'large',
    blocks: [
      block('large-large-reactor', 1),
      block('large-large-hydrogen-thruster', 4, 'up'),
      block('large-large-cargo-container', 1),
    ],
    planetId: 'earthlike',
    cargo: { fillFraction: 1.0, densityKgPerL: 2.0 },
  };

  it('sums directional thrust (hydrogen is density-independent)', () => {
    const t = directionalThrust(lifter, earthlike.atmosphereDensity);
    expect(t.up).toBeCloseTo(28_800_000, 0); // 4 × 7,200,000
    expect(t.down).toBe(0);
  });

  it('computes empty up-TWR on Earthlike', () => {
    // thrust 28,800,000 / (104,148.6 × 9.81) = 28.19
    const twr = directionalTwr(lifter, earthlike, dryMass(lifter));
    expect(twr.up).toBeCloseTo(28.19, 1);
  });

  it('empty-vs-loaded: both lift here, loaded TWR is much lower', () => {
    const a = liftAnalysis(lifter, earthlike);
    expect(a.liftsEmpty).toBe(true);
    expect(a.liftsLoaded).toBe(true);
    expect(a.emptyUpTwr).toBeGreaterThan(a.loadedUpTwr);
    // loaded: 28,800,000 / (946,148.6 × 9.81) = 3.10
    expect(a.loadedUpTwr).toBeCloseTo(3.10, 1);
  });

  it('shows the killer insight: lifts empty but NOT loaded', () => {
    // Overload the same lifter with dense cargo so loaded TWR drops below 1.
    const overloaded: ShipDesign = {
      ...lifter,
      cargo: { fillFraction: 1.0, densityKgPerL: 8.0 }, // heavy ore
    };
    const a = liftAnalysis(overloaded, earthlike);
    // dry 104,148.6; cargo 421,000×8=3,368,000; loaded 3,472,148.6
    // loaded up-TWR = 28,800,000/(3,472,148.6×9.81)=0.845 < 1
    expect(a.liftsEmpty).toBe(true);
    expect(a.liftsLoaded).toBe(false);
    expect(a.loadedUpTwr).toBeCloseTo(0.845, 2);
  });

  it('same ship is a rocket on the Moon (low gravity)', () => {
    const a = liftAnalysis(lifter, moon);
    // gravity 2.45 vs 9.81 → ~4× the TWR
    expect(a.loadedUpTwr).toBeGreaterThan(liftAnalysis(lifter, earthlike).loadedUpTwr * 3);
  });

  it('reports Infinity up-TWR in space (no gravity to fight)', () => {
    const twr = directionalTwr(lifter, space, loadedMass(lifter));
    expect(twr.up).toBe(Infinity);
  });

  it('atmospheric thrusters give zero up-thrust in space', () => {
    const atmoShip: ShipDesign = {
      id: 'atmo',
      name: 'Atmo',
      gridSize: 'large',
      blocks: [block('large-large-atmospheric-thruster', 4, 'up')],
      planetId: 'space',
      cargo: { fillFraction: 0, densityKgPerL: 2.0 },
    };
    expect(directionalThrust(atmoShip, space.atmosphereDensity).up).toBe(0);
  });
});

describe('directional acceleration (space)', () => {
  it('computes accel = thrust/mass and time/distance to top speed (worked example)', () => {
    // 480 kN of thrust on a 20,000 kg ship → a = 480,000 / 20,000 = 24 m/s².
    const thrust: DirectionalThrust = {
      up: 480_000,
      down: 0,
      forward: 0,
      backward: 0,
      left: 0,
      right: 0,
    };
    const accel = directionalAcceleration(thrust, 20_000, 100);
    expect(accel.up.acceleration).toBeCloseTo(24, 6);
    // t = v/a = 100/24 = 4.1667 s
    expect(accel.up.timeToTopSpeed).toBeCloseTo(4.1667, 3);
    // d = v²/(2a) = 10,000/48 = 208.333 m
    expect(accel.up.distanceToTopSpeed).toBeCloseTo(208.333, 2);
  });

  it('a zero-thrust axis has zero accel and Infinite time/distance', () => {
    const thrust: DirectionalThrust = {
      up: 480_000,
      down: 0,
      forward: 0,
      backward: 0,
      left: 0,
      right: 0,
    };
    const accel = directionalAcceleration(thrust, 20_000, 100);
    expect(accel.down.acceleration).toBe(0);
    expect(accel.down.timeToTopSpeed).toBe(Infinity);
    expect(accel.down.distanceToTopSpeed).toBe(Infinity);
  });

  it('non-positive mass yields zero accel and Infinite time/distance', () => {
    const thrust: DirectionalThrust = {
      up: 480_000,
      down: 0,
      forward: 0,
      backward: 0,
      left: 0,
      right: 0,
    };
    const accel = directionalAcceleration(thrust, 0, 100);
    expect(accel.up.acceleration).toBe(0);
    expect(accel.up.timeToTopSpeed).toBe(Infinity);
    expect(accel.up.distanceToTopSpeed).toBe(Infinity);
  });

  it('non-positive top speed yields Infinite time/distance but real accel', () => {
    const thrust: DirectionalThrust = {
      up: 480_000,
      down: 0,
      forward: 0,
      backward: 0,
      left: 0,
      right: 0,
    };
    const accel = directionalAcceleration(thrust, 20_000, 0);
    expect(accel.up.acceleration).toBeCloseTo(24, 6);
    expect(accel.up.timeToTopSpeed).toBe(Infinity);
    expect(accel.up.distanceToTopSpeed).toBe(Infinity);
  });

  it('doubling the speed cap doubles time but quadruples distance', () => {
    const thrust: DirectionalThrust = {
      up: 480_000,
      down: 0,
      forward: 0,
      backward: 0,
      left: 0,
      right: 0,
    };
    const at100 = directionalAcceleration(thrust, 20_000, 100).up;
    const at200 = directionalAcceleration(thrust, 20_000, 200).up;
    expect(at200.timeToTopSpeed).toBeCloseTo(at100.timeToTopSpeed * 2, 6);
    expect(at200.distanceToTopSpeed).toBeCloseTo(at100.distanceToTopSpeed * 4, 6);
  });
});

describe('power budget', () => {
  it('reports surplus with no brownout when generation covers draw', () => {
    const ship: ShipDesign = {
      id: 'p1',
      name: 'P1',
      gridSize: 'large',
      blocks: [block('large-large-reactor', 1), block('large-large-ion-thruster', 2, 'up')],
      planetId: 'earthlike',
      cargo: { fillFraction: 0, densityKgPerL: 2.0 },
    };
    const p = powerSummary(ship);
    expect(p.generation).toBe(300_000_000);
    expect(p.peakDraw).toBe(67_200_000); // 2 × 33,600,000
    expect(p.surplus).toBe(232_800_000);
    expect(p.brownout).toBe(false);
    expect(p.batteryRuntimeHours).toBe(Infinity);
  });

  it('detects a brownout and computes battery runtime under deficit', () => {
    const ship: ShipDesign = {
      id: 'p2',
      name: 'P2',
      gridSize: 'large',
      blocks: [
        block('large-small-reactor', 1), // 15 MW
        block('large-battery', 1), // 12 MW out, 3 MWh
        block('large-large-ion-thruster', 2, 'up'), // 67.2 MW draw
      ],
      planetId: 'earthlike',
      cargo: { fillFraction: 0, densityKgPerL: 2.0 },
    };
    const p = powerSummary(ship);
    expect(p.generation).toBe(15_000_000);
    expect(p.peakDraw).toBe(67_200_000);
    expect(p.availablePower).toBe(27_000_000); // gen 15 + battery 12
    // draw 67.2 > gen 15 + battery 12 = 27 → brownout
    expect(p.brownout).toBe(true);
    expect(p.batteryOnly).toBe(false);
    // deficit 52,200,000 W; 3,000,000 Wh / 52,200,000 W = 0.05747 h
    expect(p.batteryRuntimeHours).toBeCloseTo(0.05747, 4);
  });

  it('counts only the larger side of an opposing thruster pair (up vs down)', () => {
    // 3 up + 2 down ion thrusters: you fire one axis at a time, so peak draw is
    // the larger side (3 × 33.6M), not the naive sum of all 5 (which would be
    // 168M and invent a brownout the ship never sees).
    const ship: ShipDesign = {
      id: 'p3',
      name: 'P3',
      gridSize: 'large',
      blocks: [
        block('large-large-reactor', 1), // 300 MW
        block('large-large-ion-thruster', 3, 'up'), // 100.8 MW
        block('large-large-ion-thruster', 2, 'down'), // 67.2 MW
      ],
      planetId: 'earthlike',
      cargo: { fillFraction: 0, densityKgPerL: 2.0 },
    };
    const p = powerSummary(ship);
    // max(up 100.8M, down 67.2M) = 100.8M, NOT 168M.
    expect(p.peakDraw).toBe(100_800_000);
    expect(p.brownout).toBe(false);
  });

  it('sums distinct axes but only the larger of each opposing pair', () => {
    // up 3 (100.8M) vs down 1 (33.6M) → 100.8M; left 1 vs right 2 → 67.2M.
    // Total peak = 100.8M + 67.2M = 168M across two independent axes.
    const ship: ShipDesign = {
      id: 'p4',
      name: 'P4',
      gridSize: 'large',
      blocks: [
        block('large-large-ion-thruster', 3, 'up'),
        block('large-large-ion-thruster', 1, 'down'),
        block('large-large-ion-thruster', 1, 'left'),
        block('large-large-ion-thruster', 2, 'right'),
      ],
      planetId: 'earthlike',
      cargo: { fillFraction: 0, densityKgPerL: 2.0 },
    };
    expect(powerSummary(ship).peakDraw).toBe(168_000_000);
  });

  it('treats a battery-only ship as battery-powered, not a 0 W brownout', () => {
    // A battery covering the peak draw is supply, not "0 W generation".
    const ship: ShipDesign = {
      id: 'p5',
      name: 'P5',
      gridSize: 'large',
      blocks: [
        block('large-battery', 8), // 96 MW out, 24 MWh
        block('large-large-ion-thruster', 2, 'up'), // 67.2 MW draw
      ],
      planetId: 'earthlike',
      cargo: { fillFraction: 0, densityKgPerL: 2.0 },
    };
    const p = powerSummary(ship);
    expect(p.generation).toBe(0);
    expect(p.batteryOutput).toBe(96_000_000);
    expect(p.availablePower).toBe(96_000_000);
    expect(p.batteryOnly).toBe(true);
    expect(p.brownout).toBe(false); // 96 MW battery covers 67.2 MW draw
    // Runtime: full draw is the deficit (no generation). 24 MWh / 67.2 MW.
    expect(p.batteryRuntimeHours).toBeCloseTo(24_000_000 / 67_200_000, 4);
  });
});

describe('thruster recommender', () => {
  it('atmospheric on Earthlike: ceil(weight / effective thrust)', () => {
    // mass 1,000,000 → weight 9,810,000; atmo effective 6,480,000 → ceil(1.51)=2
    const r = recommendThrusters(atmoLarge, earthlike, 1_000_000);
    expect(r.feasible).toBe(true);
    expect(r.effectivePerThruster).toBeCloseTo(6_480_000, 0);
    expect(r.countNeeded).toBe(2);
  });

  it('ion on Earthlike needs more (only 30% effective in atmosphere)', () => {
    // effective 1,296,000; weight 9,810,000 → ceil(7.57)=8
    const r = recommendThrusters(ionLarge, earthlike, 1_000_000);
    expect(r.countNeeded).toBe(8);
  });

  it('atmospheric in space is infeasible (zero thrust)', () => {
    const r = recommendThrusters(atmoLarge, space, 1_000_000);
    expect(r.feasible).toBe(false);
    expect(r.countNeeded).toBe(Infinity);
  });
});

describe('ranked thruster-type suggestions', () => {
  // Every large-grid thruster block, both model sizes of each type.
  const largeThrusters = VANILLA_BLOCKS.filter(
    (b): b is ThrusterBlock => b.category === 'thruster' && b.gridSize === 'large',
  );

  it('Earthlike (dense air): counts are exact ceil(need / effective), ranked count-then-mass', () => {
    // need = full thrust of one large atmospheric thruster in dense air.
    const s = rankThrusterTypes(largeThrusters, earthlike, 6_480_000);
    expect(s).toHaveLength(3);

    // Atmospheric (eff 6.48 MN) and hydrogen (flat 7.2 MN) both need exactly 1;
    // the tiebreak on added mass puts the lighter hydrogen (6,940 kg) first.
    expect(s[0]!.thrusterType).toBe('hydrogen');
    expect(s[0]!.countNeeded).toBe(1);
    expect(s[0]!.blockId).toBe('large-large-hydrogen-thruster');
    expect(s[0]!.needsFuel).toBe(true);
    expect(s[0]!.note).toBe('works everywhere · needs fuel');

    expect(s[1]!.thrusterType).toBe('atmospheric');
    expect(s[1]!.countNeeded).toBe(1);
    expect(s[1]!.blockId).toBe('large-large-atmospheric-thruster');
    expect(s[1]!.note).toBe('strong in air');

    // Ion is only 30% effective in dense air → 4.32 MN × 0.3 = 1.296 MN each,
    // ceil(6.48 / 1.296) = 5.
    expect(s[2]!.thrusterType).toBe('ion');
    expect(s[2]!.countNeeded).toBe(5);
    expect(s[2]!.blockId).toBe('large-large-ion-thruster');
    expect(s[2]!.effectivePerThruster).toBeCloseTo(1_296_000, 0);
    expect(s[2]!.note).toBe('weak in dense air');

    // Every type is feasible in dense air.
    expect(s.every((x) => x.feasible)).toBe(true);
  });

  it('variant selection: picks the least-added-mass model per type', () => {
    // A small need (648 kN) is met by 1 small atmospheric (4,000 kg) — far less
    // added mass than 1 large atmospheric (32,970 kg) — so the small variant wins.
    const s = rankThrusterTypes(largeThrusters, earthlike, 648_000);
    const atmo = s.find((x) => x.thrusterType === 'atmospheric')!;
    expect(atmo.blockId).toBe('large-small-atmospheric-thruster');
    expect(atmo.countNeeded).toBe(1);
    expect(atmo.addedMass).toBeCloseTo(4_000, 0);
  });

  it('Moon (vacuum + gravity): atmospheric is infeasible and sorted last', () => {
    const s = rankThrusterTypes(largeThrusters, moon, 4_320_000);
    expect(s).toHaveLength(3);

    // In vacuum ion runs at full power (4.32 MN each) → exactly 1.
    expect(s[0]!.thrusterType).toBe('ion');
    expect(s[0]!.countNeeded).toBe(1);
    expect(s[0]!.feasible).toBe(true);
    expect(s[0]!.note).toBe('full in vacuum');

    // Hydrogen: least-added-mass variant is 4 small (5,680 kg) < 1 large (6,940 kg).
    expect(s[1]!.thrusterType).toBe('hydrogen');
    expect(s[1]!.countNeeded).toBe(4);
    expect(s[1]!.blockId).toBe('large-small-hydrogen-thruster');

    // Atmospheric produces zero thrust in vacuum → infeasible, ranked last.
    expect(s[2]!.thrusterType).toBe('atmospheric');
    expect(s[2]!.feasible).toBe(false);
    expect(s[2]!.countNeeded).toBe(Infinity);
    expect(s[2]!.addedMass).toBe(Infinity);
    expect(s[2]!.note).toBe('no thrust in vacuum');
  });

  it('Space (no gravity): working types need 0, atmospheric still infeasible', () => {
    const s = rankThrusterTypes(largeThrusters, space, 0);
    const ion = s.find((x) => x.thrusterType === 'ion')!;
    const hydro = s.find((x) => x.thrusterType === 'hydrogen')!;
    const atmo = s.find((x) => x.thrusterType === 'atmospheric')!;

    expect(ion.feasible).toBe(true);
    expect(ion.countNeeded).toBe(0);
    expect(ion.addedMass).toBe(0);
    expect(hydro.feasible).toBe(true);
    expect(hydro.countNeeded).toBe(0);

    // No air means atmospheric is dead even with nothing to lift.
    expect(atmo.feasible).toBe(false);
    expect(atmo.countNeeded).toBe(Infinity);

    // Feasible types always rank ahead of infeasible ones.
    expect(s[s.length - 1]!.thrusterType).toBe('atmospheric');
  });
});
