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
import {
  estimateRequirements,
  uniformThrusters,
  type EstimatorInput,
  type FixedBlockSpec,
} from './estimate';

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
      thrusters: uniformThrusters(hydroLarge),
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
    const est = estimateRequirements(baseInput({ planet: space, config: { ...baseInput().config, thrusters: uniformThrusters(atmoLarge) } }));
    expect(est.warnings.length).toBeGreaterThan(0);
    expect(est.totalThrusters).toBe(0);
  });

  it('sizes thrusters in space by reading target TWR as target g-acceleration', () => {
    // In space there is no weight, so a TWR target would size ZERO thrusters and
    // leave the build unpropelled. Instead the target-TWR knob means target
    // acceleration in g-units: TWR 2 → accelerate at 2 g (19.62 m/s²). Hydrogen
    // works in vacuum, so the ship must get real thrusters and accelerate.
    const est = estimateRequirements(baseInput({ planet: space }));
    expect(est.warnings).toHaveLength(0);
    expect(est.thrusters.up).toBeGreaterThan(0);
    expect(est.totalThrusters).toBeGreaterThan(0);
    // Achieved acceleration = up-thrust / loaded mass must meet the 2 g target
    // (counts round up, so it's ≥). Worked from the settled build.
    const upThrust = est.thrusters.up * hydroLarge.maxThrust; // hydrogen: flat 1.0 in vacuum
    const achievedAccel = upThrust / est.loadedMass;
    expect(achievedAccel).toBeGreaterThanOrEqual(2.0 * 9.81);
  });

  it('needs FEWER thrusters in space than on a planet (no gravity, same g-target)', () => {
    // 2 g of acceleration in space is far less thrust than TWR 2 against full
    // Earth gravity plus the same 2 g — so space should size no more thrusters.
    const earth = estimateRequirements(baseInput());
    const vac = estimateRequirements(baseInput({ planet: space }));
    expect(vac.thrusters.up).toBeLessThanOrEqual(earth.thrusters.up);
    expect(vac.thrusters.up).toBeGreaterThan(0);
  });

  it('sizes power to cover peak draw (battery count ≥ draw/discharge)', () => {
    const est = estimateRequirements(baseInput());
    expect(est.powerSupply).toBeGreaterThanOrEqual(est.peakDraw);
  });

  it('sizes more batteries for a longer runtime target', () => {
    // Atmospheric thrusters draw real power (hydrogen draw 0 W), so battery
    // runtime scaling is observable. Use a LIGHT ship (cockpit only) so both
    // runtimes converge well inside the sanity cap — the heavy 4-drill mining
    // baseInput would run the count away at long runtimes.
    const lightAtmo: EstimatorInput = {
      fixedBlocks: [{ definition: largeCockpit!, quantity: 1 }],
      planet: earthlike,
      cargo: { fillFraction: 0, densityKgPerL: 2.0 },
      config: {
        targetTwr: 2.0,
        lateralThrustFraction: 0.5,
        thrusters: uniformThrusters(atmoLarge),
        power: { kind: 'battery', block: largeBattery },
        runtimeTargetHours: 0.25,
        gyro: largeGyro,
        responsiveness: 'normal',
      },
    };
    const short = estimateRequirements({
      ...lightAtmo,
      config: { ...lightAtmo.config, runtimeTargetHours: 0.25 },
    });
    const long = estimateRequirements({
      ...lightAtmo,
      config: { ...lightAtmo.config, runtimeTargetHours: 2 },
    });
    expect(short.warnings).toHaveLength(0);
    expect(long.warnings).toHaveLength(0);
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

  it('ion thrusters are inefficient in dense atmosphere but work in thin air (Moon)', () => {
    // Ion effectiveness falls to 0.3 in full atmosphere, so lifting a large-grid
    // ship to TWR 2 on Earthlike is infeasible (the estimator flags it rather
    // than diverging). On the Moon (thin atmosphere → near-full effectiveness +
    // low gravity) the same ship is easily liftable with a modest count.
    const light: EstimatorInput = {
      fixedBlocks: [{ definition: largeCockpit!, quantity: 1 }],
      planet: earthlike,
      cargo: { fillFraction: 0, densityKgPerL: 2.0 },
      config: { ...baseInput().config, thrusters: uniformThrusters(ionLarge) },
    };
    const onEarth = estimateRequirements(light);
    const onMoon = estimateRequirements({ ...light, planet: moon });
    expect(onEarth.warnings.length).toBeGreaterThan(0);
    expect(onEarth.totalThrusters).toBe(0);
    expect(onMoon.warnings).toHaveLength(0);
    expect(onMoon.thrusters.up).toBeGreaterThan(0);
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
        thrusters: uniformThrusters(smallHydro),
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
        thrusters: uniformThrusters(hydroLarge),
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

// ── Realistic peak-draw power sizing ─────────────────────────────────────────
// Opposing thrusters (up/down, fwd/back, left/right) never fire together, so
// power must be sized against only the larger side of each pair — the same
// model the analyzer's peakDraw() uses. The estimator used to sum ALL six
// directions, roughly doubling the electrical load and over-sizing batteries
// (a user's 3-drill mining ship on atmospheric thrusters was told it needed 4
// warfare batteries). It also had no guard against a runaway mass↔count loop
// for a thruster type that can't lift the ship.
describe('estimateRequirements — realistic peak-draw power sizing', () => {
  const smallGyro = VANILLA_BLOCKS_BY_ID['small-gyroscope'] as GyroscopeBlock;
  const smallDrill = VANILLA_BLOCKS_BY_ID['small-drill'] as BlockDefinition;
  const smallCockpit = VANILLA_BLOCKS_BY_ID['small-cockpit'] as BlockDefinition;
  const smallConnector = VANILLA_BLOCKS_BY_ID['small-connector'] as BlockDefinition;
  const smallOreDetector = VANILLA_BLOCKS_BY_ID['small-ore-detector'] as BlockDefinition;
  const smallAtmo = VANILLA_BLOCKS_BY_ID['small-small-atmospheric-thruster'] as ThrusterBlock;
  const smallIon = VANILLA_BLOCKS_BY_ID['small-small-ion-thruster'] as ThrusterBlock;
  const smallWarfareBattery = VANILLA_BLOCKS_BY_ID['small-battery-warfare2'] as BatteryBlock;

  // The user's reported mining ship: cockpit, 3 drills, connector, ore detector.
  const miningEssentials: FixedBlockSpec[] = [
    { definition: smallCockpit, quantity: 1 },
    { definition: smallDrill, quantity: 3 },
    { definition: smallConnector, quantity: 1 },
    { definition: smallOreDetector, quantity: 1 },
  ];

  function miningInput(overrides?: Partial<EstimatorInput['config']>): EstimatorInput {
    return {
      fixedBlocks: miningEssentials,
      planet: earthlike,
      cargo: { fillFraction: 0, densityKgPerL: 2.0 },
      config: {
        targetTwr: 2.0,
        lateralThrustFraction: 0.5,
        thrusters: uniformThrusters(smallAtmo),
        power: { kind: 'battery', block: smallWarfareBattery },
        runtimeTargetHours: 0.5,
        gyro: smallGyro,
        responsiveness: 'normal',
        ...overrides,
      },
    };
  }

  it('peak draw counts only the larger side of each opposing thruster pair', () => {
    const est = estimateRequirements(miningInput());
    // Realistic peak = fixed draw + (up + 2×lateral)×thrusterDraw + gyros.
    // The naive all-six sum would be up + 5×lateral — strictly more whenever
    // any lateral thrusters exist, so peak draw must be BELOW that bound.
    const perThr = smallAtmo.maxPowerDraw;
    const naiveAllSix =
      3 * 2000 + // drills
      2000 + // ore detector
      est.totalThrusters * perThr +
      est.gyroCount * smallGyro.powerDraw;
    expect(est.thrusters.forward).toBeGreaterThan(0); // laterals exist
    expect(est.peakDraw).toBeLessThan(naiveAllSix);
    // And it equals the opposing-pair formula exactly.
    const peakThrusters =
      Math.max(est.thrusters.up, est.thrusters.down) +
      Math.max(est.thrusters.forward, est.thrusters.backward) +
      Math.max(est.thrusters.left, est.thrusters.right);
    const expectedPeak =
      3 * 2000 + 2000 + peakThrusters * perThr + est.gyroCount * smallGyro.powerDraw;
    expect(est.peakDraw).toBe(expectedPeak);
  });

  it('sizes batteries to the realistic peak, not the doubled sum', () => {
    const est = estimateRequirements(miningInput());
    // The bug reported 4 warfare batteries; the realistic peak needs fewer.
    expect(est.powerCount).toBeLessThan(4);
    expect(est.powerCount).toBeGreaterThan(0);
    // Supply must still cover the (realistic) peak.
    expect(est.powerSupply).toBeGreaterThanOrEqual(est.peakDraw);
  });

  it('a hydrogen mining ship (0 W thrusters) needs just one battery for the fixed draw', () => {
    const smallHydro = VANILLA_BLOCKS_BY_ID['small-small-hydrogen-thruster'] as ThrusterBlock;
    const est = estimateRequirements(miningInput({ thrusters: uniformThrusters(smallHydro) }));
    // 3 drills + ore detector = 8 kW; one 4 MW / 1 MWh battery covers it.
    expect(est.powerCount).toBe(1);
  });

  it('returns an infeasible estimate (no runaway counts) when the thruster type cannot lift the ship', () => {
    // Ion thrusters are near-dead in dense atmosphere; sizing them to lift a
    // mining ship on Earthlike used to diverge to astronomically large counts.
    const est = estimateRequirements(miningInput({ thrusters: uniformThrusters(smallIon) }));
    expect(est.warnings.length).toBeGreaterThan(0);
    expect(est.warnings.some((w) => /can't lift/i.test(w))).toBe(true);
    expect(est.totalThrusters).toBe(0);
    expect(est.powerCount).toBe(0);
    // Numbers stay finite and sane.
    expect(Number.isFinite(est.loadedMass)).toBe(true);
  });
});

// ── Per-direction thruster mixing ────────────────────────────────────────────
// Each direction can use a different thruster type (e.g. flat atmospheric on the
// lift/fore/aft axes, ion on the sides). Sizing, mass, and peak draw must all be
// computed per direction — a lighter/stronger type on one axis needs fewer
// blocks there, and mixed types draw different watts, so the opposing-pair peak
// must compare watts, not counts.
describe('estimateRequirements — per-direction thruster mixing', () => {
  const light: FixedBlockSpec[] = [{ definition: largeCockpit!, quantity: 1 }];

  function mixInput(thrusters: EstimatorInput['config']['thrusters'], planet = earthlike): EstimatorInput {
    return {
      fixedBlocks: light,
      planet,
      cargo: { fillFraction: 0, densityKgPerL: 2.0 },
      config: {
        targetTwr: 2.0,
        lateralThrustFraction: 1.0, // full lateral so counts are directly comparable
        thrusters,
        power: { kind: 'battery', block: largeBattery },
        runtimeTargetHours: 0.25,
        gyro: largeGyro,
        responsiveness: 'normal',
      },
    };
  }

  it('sizes a stronger-thrust direction with fewer blocks than a weaker one', () => {
    // Hydrogen (7.2 MN) vs atmospheric (6.48 MN at full air): the stronger
    // hydrogen axis should need no more thrusters than the atmospheric one for
    // the same required thrust.
    const est = estimateRequirements(
      mixInput({ ...uniformThrusters(atmoLarge), forward: hydroLarge, backward: hydroLarge }),
    );
    expect(est.thrusters.forward).toBeLessThanOrEqual(est.thrusters.left);
    expect(est.thrusters.forward).toBeGreaterThan(0);
  });

  it('matches the uniform result when every direction uses the same type', () => {
    const uniform = estimateRequirements(mixInput(uniformThrusters(atmoLarge)));
    const explicit = estimateRequirements(
      mixInput({
        up: atmoLarge,
        down: atmoLarge,
        forward: atmoLarge,
        backward: atmoLarge,
        left: atmoLarge,
        right: atmoLarge,
      }),
    );
    expect(explicit.thrusters).toEqual(uniform.thrusters);
    expect(explicit.peakDraw).toBe(uniform.peakDraw);
    expect(explicit.powerCount).toBe(uniform.powerCount);
  });

  it('peak draw compares watts per axis, not block counts (draw-aware)', () => {
    // atmospheric everywhere but ion on the sides. Ion draws far more watts than
    // atmospheric, so the left/right axis peak must reflect the ion draw.
    const est = estimateRequirements(
      mixInput({ ...uniformThrusters(atmoLarge), left: ionLarge, right: ionLarge }),
    );
    const cockpitDraw = 0; // cockpit has no maxPowerDraw
    const axis = (a: number, ad: number, b: number, bd: number) => Math.max(a * ad, b * bd);
    const expectedThrusterDraw =
      axis(est.thrusters.up, atmoLarge.maxPowerDraw, est.thrusters.down, atmoLarge.maxPowerDraw) +
      axis(est.thrusters.forward, atmoLarge.maxPowerDraw, est.thrusters.backward, atmoLarge.maxPowerDraw) +
      axis(est.thrusters.left, ionLarge.maxPowerDraw, est.thrusters.right, ionLarge.maxPowerDraw);
    expect(est.peakDraw).toBe(cockpitDraw + expectedThrusterDraw + est.gyroCount * largeGyro.powerDraw);
  });

  it('hard-stops with a lift warning when the UP axis type is dead in the environment', () => {
    // Atmospheric UP in space produces no thrust — the ship can't lift at all,
    // regardless of what the other axes use.
    const est = estimateRequirements(
      mixInput({ ...uniformThrusters(hydroLarge), up: atmoLarge }, space),
    );
    expect(est.warnings.some((w) => /can't lift/i.test(w))).toBe(true);
    expect(est.totalThrusters).toBe(0);
  });

  it('sizes the rest but flags a dead LATERAL axis without stopping the estimate', () => {
    // Hydrogen UP (works anywhere) with atmospheric on the sides. On the Moon
    // (gravity 1.62, no atmosphere) atmospheric is dead but the ship still lifts
    // on hydrogen — so left/right get 0 thrusters and a per-axis note, while the
    // hydrogen axes are sized normally.
    const est = estimateRequirements(
      mixInput({ ...uniformThrusters(hydroLarge), left: atmoLarge, right: atmoLarge }, moon),
    );
    expect(est.thrusters.up).toBeGreaterThan(0);
    expect(est.thrusters.left).toBe(0);
    expect(est.thrusters.right).toBe(0);
    expect(est.thrusters.forward).toBeGreaterThan(0); // hydrogen laterals still sized
    expect(est.warnings.some((w) => /LEFT/i.test(w))).toBe(true);
  });
});
