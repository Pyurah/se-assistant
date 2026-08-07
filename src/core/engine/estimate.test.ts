import { describe, it, expect } from 'vitest';
import { VANILLA_BLOCKS_BY_ID } from '../../data/blocks';
import { PLANET_PRESETS_BY_ID } from '../../data/planets';
import type {
  ThrusterBlock,
  GyroscopeBlock,
  BatteryBlock,
  PowerProducerBlock,
  BlockDefinition,
} from '../../data/schema';
import { estimateRequirements, type EstimatorInput, type FixedBlockSpec } from './estimate';

const earthlike = PLANET_PRESETS_BY_ID['earthlike']!;
const moon = PLANET_PRESETS_BY_ID['moon']!;
const space = PLANET_PRESETS_BY_ID['space']!;

const hydroLarge = VANILLA_BLOCKS_BY_ID['large-large-hydrogen-thruster'] as ThrusterBlock;
const atmoLarge = VANILLA_BLOCKS_BY_ID['large-large-atmospheric-thruster'] as ThrusterBlock;
const ionLarge = VANILLA_BLOCKS_BY_ID['large-large-ion-thruster'] as ThrusterBlock;
const largeBattery = VANILLA_BLOCKS_BY_ID['large-battery'] as BatteryBlock;
const largeReactor = VANILLA_BLOCKS_BY_ID['large-large-reactor'] as PowerProducerBlock;

// A minimal gyro + drill built from the schema so the estimator has real inputs
// even before those blocks land in the shipped dataset. Values are the
// researched vanilla large-grid figures.
const largeGyro: GyroscopeBlock = {
  id: 'test-large-gyro',
  subtypeId: 'LargeBlockGyro',
  displayName: 'Gyroscope (Large Grid)',
  category: 'gyroscope',
  gridSize: 'large',
  dlc: 'base',
  mass: 12_817,
  maxTorque: 33_600_000,
  powerDraw: 30,
  source: 'vanilla',
};

const largeDrill: BlockDefinition = {
  id: 'test-large-drill',
  subtypeId: 'LargeBlockDrill',
  displayName: 'Drill (Large Grid)',
  category: 'drill',
  gridSize: 'large',
  dlc: 'base',
  mass: 6741,
  maxPowerDraw: 2000,
  source: 'vanilla',
};

const largeCargo = VANILLA_BLOCKS_BY_ID['large-large-cargo-container'];
const largeCockpit = VANILLA_BLOCKS_BY_ID['large-cockpit'];

/** The user's essentials: 4 drills, 2 cargo, a cockpit. */
const miningEssentials: FixedBlockSpec[] = [
  { definition: largeDrill, quantity: 4 },
  { definition: largeCargo!, quantity: 2 },
  { definition: largeCockpit!, quantity: 1 },
];

function baseInput(overrides?: Partial<EstimatorInput>): EstimatorInput {
  return {
    fixedBlocks: miningEssentials,
    planet: earthlike,
    cargo: { fillFraction: 1.0, densityKgPerL: 2.0 },
    config: {
      targetTwr: 2.0,
      lateralThrustFraction: 0.5,
      thruster: hydroLarge,
      power: { kind: 'battery', block: largeBattery },
      runtimeTargetHours: 0.25,
      gyro: largeGyro,
      responsiveness: 'normal',
    },
    ...overrides,
  };
}

describe('estimateRequirements', () => {
  it('sizes a mining ship and converges', () => {
    const est = estimateRequirements(baseInput());
    expect(est.iterations).toBeGreaterThan(0);
    expect(est.warnings).toHaveLength(0);
    expect(est.totalThrusters).toBeGreaterThan(0);
    expect(est.powerCount).toBeGreaterThan(0);
    expect(est.gyroCount).toBeGreaterThan(0);
  });

  it('achieves at least the target loaded TWR', () => {
    const est = estimateRequirements(baseInput());
    // We round thruster counts UP, so achieved TWR is >= the target.
    expect(est.achievedUpTwr).toBeGreaterThanOrEqual(2.0);
  });

  it('sizes lateral directions to the configured fraction of up', () => {
    const est = estimateRequirements(baseInput());
    // up sized to full target; each lateral to 50% → ceil gives ~half (rounded).
    expect(est.thrusters.down).toBeLessThanOrEqual(est.thrusters.up);
    expect(est.thrusters.down).toBeGreaterThan(0);
    expect(est.thrusters.forward).toBe(est.thrusters.down);
  });

  it('needs FEWER thrusters on the Moon (lower gravity)', () => {
    const earth = estimateRequirements(baseInput());
    const lunar = estimateRequirements(baseInput({ planet: moon }));
    expect(lunar.thrusters.up).toBeLessThan(earth.thrusters.up);
  });

  it('accounts for thruster mass in the loaded total (convergence effect)', () => {
    const est = estimateRequirements(baseInput());
    // Loaded mass must exceed just the essentials + cargo, because the
    // recommended thrusters/power/gyros add their own mass.
    const essentialsMass = 4 * 6741 + 2 * 2593.6 + 508; // drills + cargo + cockpit
    const cargoPayload = 2 * 421_000 * 1.0 * 2.0;
    expect(est.loadedMass).toBeGreaterThan(essentialsMass + cargoPayload);
  });

  it('warns and recommends no thrusters when the type is infeasible (atmo in space)', () => {
    const est = estimateRequirements(baseInput({ planet: space, config: { ...baseInput().config, thruster: atmoLarge } }));
    expect(est.warnings.length).toBeGreaterThan(0);
    expect(est.totalThrusters).toBe(0);
  });

  it('sizes power to cover peak draw (battery count ≥ draw/discharge)', () => {
    const est = estimateRequirements(baseInput());
    expect(est.powerSupply).toBeGreaterThanOrEqual(est.peakDraw);
  });

  it('sizes more batteries for a longer runtime target', () => {
    // Ion thrusters draw real power (hydrogen draw 0 W), so battery runtime
    // scaling is observable. Use ion + battery here.
    const ionCfg = { ...baseInput().config, thruster: ionLarge };
    const short = estimateRequirements(
      baseInput({ config: { ...ionCfg, runtimeTargetHours: 0.1 } }),
    );
    const long = estimateRequirements(
      baseInput({ config: { ...ionCfg, runtimeTargetHours: 4 } }),
    );
    expect(long.powerCount).toBeGreaterThan(short.powerCount);
  });

  it('recommends more gyros for a nimble ship than a sluggish one', () => {
    const sluggish = estimateRequirements(
      baseInput({ config: { ...baseInput().config, responsiveness: 'sluggish' } }),
    );
    const nimble = estimateRequirements(
      baseInput({ config: { ...baseInput().config, responsiveness: 'nimble' } }),
    );
    expect(nimble.gyroCount).toBeGreaterThan(sluggish.gyroCount);
  });

  it('supports a reactor as the power source', () => {
    const est = estimateRequirements(
      baseInput({ config: { ...baseInput().config, power: { kind: 'producer', block: largeReactor } } }),
    );
    // One large reactor (300 MW) easily covers a hydrogen ship's modest draw.
    expect(est.powerCount).toBeGreaterThanOrEqual(1);
    expect(est.powerSupply).toBeGreaterThanOrEqual(est.peakDraw);
  });

  it('ion thrusters need more count in atmosphere than in space', () => {
    const inAtmo = estimateRequirements(baseInput({ config: { ...baseInput().config, thruster: ionLarge } }));
    const inSpace = estimateRequirements(
      baseInput({ planet: space, config: { ...baseInput().config, thruster: ionLarge } }),
    );
    // In space there's no gravity → up-TWR target is trivially met → far fewer.
    expect(inAtmo.thrusters.up).toBeGreaterThan(inSpace.thrusters.up);
  });
});

// ── Small-grid gyro sizing ───────────────────────────────────────────────────
// A small-grid gyro is 75× weaker than a large one (448 kN·m vs 33.6 MN·m), but
// a small-grid ship is also physically ~5× smaller per axis (0.5 m cells vs
// 2.5 m), so its moment of inertia per kg is ~1/25 as large and it needs ~1/25
// the torque-per-kg for the same feel. The estimator must scale the torque
// target by grid or it wildly over-counts small ships. These tests lock the
// user-reported scenario (3 welders + cockpit + small container → 1–2 gyros,
// NOT 3) and confirm the large-grid calibration is untouched.
describe('estimateRequirements — small-grid gyro sizing', () => {
  const smallGyro = VANILLA_BLOCKS_BY_ID['small-gyroscope'] as GyroscopeBlock;
  const smallWelder = VANILLA_BLOCKS_BY_ID['small-welder'] as BlockDefinition;
  const smallCockpit = VANILLA_BLOCKS_BY_ID['small-cockpit'] as BlockDefinition;
  const smallContainer = VANILLA_BLOCKS_BY_ID['small-small-cargo-container'] as BlockDefinition;
  const smallHydro = VANILLA_BLOCKS_BY_ID['small-small-hydrogen-thruster'] as ThrusterBlock;
  const smallBattery = VANILLA_BLOCKS_BY_ID['small-battery'] as BatteryBlock;

  // The user's actual build: 3 welders, a cockpit, a small cargo container.
  const welderShipEssentials: FixedBlockSpec[] = [
    { definition: smallWelder, quantity: 3 },
    { definition: smallCockpit, quantity: 1 },
    { definition: smallContainer, quantity: 1 },
  ];

  function smallInput(overrides?: Partial<EstimatorInput['config']>): EstimatorInput {
    return {
      fixedBlocks: welderShipEssentials,
      planet: earthlike,
      cargo: { fillFraction: 0, densityKgPerL: 2.0 },
      config: {
        targetTwr: 2.0,
        lateralThrustFraction: 0.5,
        thruster: smallHydro,
        power: { kind: 'battery', block: smallBattery },
        runtimeTargetHours: 0.5,
        gyro: smallGyro,
        responsiveness: 'normal',
        ...overrides,
      },
    };
  }

  it("recommends 1–2 gyros for the user's welder ship, not 3+", () => {
    const est = estimateRequirements(smallInput());
    // Real build flies fine on 2; the old flat heuristic recommended 3+.
    expect(est.gyroCount).toBeGreaterThanOrEqual(1);
    expect(est.gyroCount).toBeLessThanOrEqual(2);
  });

  it('needs far fewer gyros than the un-scaled large-grid target would imply', () => {
    const est = estimateRequirements(smallInput());
    // The old code did ceil(168 * loadedMass / 448_000). Recompute what that
    // WOULD have produced for this ship's settled loaded mass and assert we now
    // recommend dramatically fewer (grid scaling divides the target by 25).
    const oldTarget = Math.ceil((168 * est.loadedMass) / 448_000);
    expect(est.gyroCount).toBeLessThan(oldTarget);
  });

  it('still scales gyro count with responsiveness on small grid', () => {
    const sluggish = estimateRequirements(smallInput({ responsiveness: 'sluggish' }));
    const nimble = estimateRequirements(smallInput({ responsiveness: 'nimble' }));
    expect(nimble.gyroCount).toBeGreaterThanOrEqual(sluggish.gyroCount);
  });

  it('leaves the large-grid gyro calibration unchanged (~1 per 200 t at normal)', () => {
    // A ~600 t large-grid ship at "normal" should want ceil(168*600000/33.6e6)=3.
    // Build a bare large-grid ship whose loaded mass lands near 600 t via cargo.
    const est = estimateRequirements({
      fixedBlocks: [{ definition: largeCockpit!, quantity: 1 }],
      planet: earthlike,
      cargo: { fillFraction: 1.0, densityKgPerL: 2.0 },
      config: {
        targetTwr: 1.0,
        lateralThrustFraction: 0,
        thruster: hydroLarge,
        power: { kind: 'battery', block: largeBattery },
        runtimeTargetHours: 0.25,
        gyro: largeGyro,
        responsiveness: 'normal',
      },
    });
    // Exact large-grid formula, unchanged by the grid scaling (ratio = 1).
    const expected = Math.ceil((168 * est.loadedMass) / 33_600_000);
    expect(est.gyroCount).toBe(expected);
  });
});
