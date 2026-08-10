import { describe, it, expect } from 'vitest';
import { VANILLA_BLOCKS_BY_ID } from '../../data/blocks';
import { PLANET_PRESETS_BY_ID } from '../../data/planets';
import type {
  ThrusterBlock,
  GyroscopeBlock,
  BatteryBlock,
  BlockDefinition,
} from '../../data/schema';
import {
  estimateManual,
  type ManualEstimatorInput,
  type ThrusterLayout,
  type FixedBlockSpec,
} from './estimate';

const earthlike = PLANET_PRESETS_BY_ID['earthlike']!;
const space = PLANET_PRESETS_BY_ID['space']!;

const hydroLarge = VANILLA_BLOCKS_BY_ID['large-large-hydrogen-thruster'] as ThrusterBlock;
const atmoLarge = VANILLA_BLOCKS_BY_ID['large-large-atmospheric-thruster'] as ThrusterBlock;
const ionLarge = VANILLA_BLOCKS_BY_ID['large-large-ion-thruster'] as ThrusterBlock;
const largeBattery = VANILLA_BLOCKS_BY_ID['large-battery'] as BatteryBlock;

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

// ── Manual estimator (estimateManual) ────────────────────────────────────────
// The user assigns thrusters per direction by hand; the app sizes only power +
// gyros against the resulting build. Counts are taken verbatim from the layout
// (no TWR fixed point), mass/draw sum over each direction's stack (mixed types
// allowed), and support systems are still sized whether or not thrusters lift.
describe('estimateManual', () => {
  /** An empty per-direction layout (no thrusters assigned anywhere). */
  const emptyLayout = (): ThrusterLayout => ({
    up: [],
    down: [],
    forward: [],
    backward: [],
    left: [],
    right: [],
  });

  /** Layout with a single (type × count) on every direction. */
  const uniformLayout = (block: ThrusterBlock, count: number): ThrusterLayout => ({
    up: [{ definition: block, count }],
    down: [{ definition: block, count }],
    forward: [{ definition: block, count }],
    backward: [{ definition: block, count }],
    left: [{ definition: block, count }],
    right: [{ definition: block, count }],
  });

  function manualInput(
    layout: ThrusterLayout,
    overrides?: Partial<ManualEstimatorInput>,
  ): ManualEstimatorInput {
    return {
      fixedBlocks: miningEssentials,
      planet: earthlike,
      cargo: { fillFraction: 1.0, densityKgPerL: 2.0 },
      gridSize: 'large',
      config: {
        thrusterLayout: layout,
        power: { kind: 'battery', block: largeBattery },
        runtimeTargetHours: 0.25,
        gyro: largeGyro,
        targetTurnTime: 2.5,
      },
      ...overrides,
    };
  }

  it('takes thruster counts verbatim from the layout and sizes power + gyros', () => {
    const est = estimateManual(manualInput(uniformLayout(hydroLarge, 8)));
    expect(est.thrusters.up).toBe(8);
    expect(est.thrusters.left).toBe(8);
    expect(est.totalThrusters).toBe(48); // 8 × 6 directions
    expect(est.powerCount).toBeGreaterThan(0);
    expect(est.gyroCount).toBeGreaterThan(0);
    expect(est.iterations).toBe(1); // no thruster fixed point
  });

  it('computes achieved up-TWR from the assigned UP thrusters (worked)', () => {
    const layout = emptyLayout();
    layout.up = [{ definition: hydroLarge, count: 10 }];
    const est = estimateManual(manualInput(layout, { cargo: { fillFraction: 0, densityKgPerL: 2 } }));
    // Achieved up-TWR = 10 × 7.2 MN / (loadedMass × 9.81). Recompute from settled mass.
    const upThrust = 10 * hydroLarge.maxThrust;
    const expected = upThrust / (est.loadedMass * earthlike.surfaceGravity);
    expect(est.achievedUpTwr).toBeCloseTo(expected, 6);
    expect(est.thrusters.down).toBe(0);
  });

  it('sums count and mass across MULTIPLE thruster types in one direction', () => {
    // UP = 4 large hydrogen + 6 large atmospheric.
    const layout = emptyLayout();
    layout.up = [
      { definition: hydroLarge, count: 4 },
      { definition: atmoLarge, count: 6 },
    ];
    const est = estimateManual(manualInput(layout, { cargo: { fillFraction: 0, densityKgPerL: 2 } }));
    expect(est.thrusters.up).toBe(10); // 4 + 6
    // Dry mass includes both thruster types' mass.
    const thrusterMass = 4 * hydroLarge.mass + 6 * atmoLarge.mass;
    const essentialsMass = 4 * 6741 + 2 * 2593.6 + 508;
    expect(est.dryMass).toBeGreaterThanOrEqual(thrusterMass + essentialsMass);
  });

  it('sizes power + gyros even with NO thrusters assigned (base draw + attitude)', () => {
    const est = estimateManual(manualInput(emptyLayout()));
    expect(est.totalThrusters).toBe(0);
    expect(est.achievedUpTwr).toBe(0);
    expect(est.powerCount).toBeGreaterThan(0);
    expect(est.gyroCount).toBeGreaterThan(0);
    expect(est.warnings.some((w) => /UP axis/i.test(w))).toBe(true);
  });

  it('peak draw counts only the larger side of each opposing thruster pair', () => {
    // atmospheric everywhere (real watts) but MORE up than down so the up side wins.
    const layout: ThrusterLayout = {
      up: [{ definition: atmoLarge, count: 6 }],
      down: [{ definition: atmoLarge, count: 2 }],
      forward: [{ definition: atmoLarge, count: 3 }],
      backward: [{ definition: atmoLarge, count: 3 }],
      left: [{ definition: atmoLarge, count: 1 }],
      right: [{ definition: atmoLarge, count: 4 }],
    };
    const est = estimateManual(manualInput(layout));
    const d = atmoLarge.maxPowerDraw;
    const peakThrusters = Math.max(6, 2) * d + Math.max(3, 3) * d + Math.max(1, 4) * d;
    const essentialsDraw = 4 * 2000; // 4 drills @ 2 kW (cargo/cockpit draw 0)
    const expected = essentialsDraw + peakThrusters + est.gyroCount * largeGyro.powerDraw;
    expect(est.peakDraw).toBe(expected);
  });

  it('peak draw is watts-aware across mixed types in opposing directions', () => {
    // ion on UP (high watts, few blocks) vs atmospheric on DOWN (low watts): the
    // peak side is whichever draws more watts, not whichever has more blocks.
    const layout = emptyLayout();
    layout.up = [{ definition: ionLarge, count: 2 }];
    layout.down = [{ definition: atmoLarge, count: 5 }];
    const est = estimateManual(manualInput(layout));
    const upWatts = 2 * ionLarge.maxPowerDraw;
    const downWatts = 5 * atmoLarge.maxPowerDraw;
    const axisPeak = Math.max(upWatts, downWatts);
    const essentialsDraw = 4 * 2000;
    const expected = essentialsDraw + axisPeak + est.gyroCount * largeGyro.powerDraw;
    expect(est.peakDraw).toBe(expected);
  });

  it('sizes more batteries for a longer runtime target', () => {
    const layout = uniformLayout(atmoLarge, 4); // atmospheric draws real watts
    const short = estimateManual(
      manualInput(layout, { config: { ...manualInput(layout).config, runtimeTargetHours: 0.25 } }),
    );
    const long = estimateManual(
      manualInput(layout, { config: { ...manualInput(layout).config, runtimeTargetHours: 4 } }),
    );
    expect(long.powerCount).toBeGreaterThan(short.powerCount);
  });

  it('sizes more gyros for a tighter target turn time', () => {
    const layout = uniformLayout(hydroLarge, 6);
    const slow = estimateManual(
      manualInput(layout, { config: { ...manualInput(layout).config, targetTurnTime: 6.0 } }),
    );
    const fast = estimateManual(
      manualInput(layout, { config: { ...manualInput(layout).config, targetTurnTime: 0.75 } }),
    );
    expect(fast.gyroCount).toBeGreaterThan(slow.gyroCount);
  });

  it('sizes gyros so the achieved 90° turn time meets the target (worked)', () => {
    // No thrusters, so mass/side come only from essentials + the sized support.
    // The gyro count is solved from the solid-cube turn model: side = ∛(count)·2.5,
    // I = ⅙·m·side², α_needed = π/T², torque_needed = α·I, gyros = ⌈torque/33.6MN⌉.
    const est = estimateManual(
      manualInput(emptyLayout(), {
        cargo: { fillFraction: 0, densityKgPerL: 2 },
        config: { ...manualInput(emptyLayout()).config, targetTurnTime: 3.0 },
      }),
    );
    expect(est.gyroCount).toBeGreaterThan(0);
    // Recompute the achieved turn time from the settled build and confirm it (a)
    // matches the reported value and (b) meets the 3 s target the count solved for.
    const cell = 2.5;
    const blockCount = 4 + 2 + 1 + est.powerCount + est.gyroCount; // essentials + support
    const side = Math.cbrt(blockCount) * cell;
    const inertia = (1 / 6) * est.loadedMass * side * side;
    const accel = (est.gyroCount * largeGyro.maxTorque) / inertia;
    const turnTime = Math.sqrt(Math.PI / accel);
    expect(est.achievedTurnTime).toBeCloseTo(turnTime, 6);
    expect(est.achievedTurnTime).toBeLessThanOrEqual(3.0);
  });

  it('reports achievedTurnTime as Infinity when the target is non-positive (no gyros)', () => {
    const est = estimateManual(
      manualInput(uniformLayout(hydroLarge, 4), {
        config: { ...manualInput(uniformLayout(hydroLarge, 4)).config, targetTurnTime: 0 },
      }),
    );
    expect(est.gyroCount).toBe(0);
    expect(est.achievedTurnTime).toBe(Infinity);
  });

  it('warns (advisory) when an assigned type is dead in the environment but still counts it', () => {
    // Atmospheric UP in space: no thrust, but the blocks still add mass + draw.
    const layout = emptyLayout();
    layout.up = [{ definition: atmoLarge, count: 4 }];
    const est = estimateManual(manualInput(layout, { planet: space }));
    expect(est.thrusters.up).toBe(4); // counted verbatim (user's choice)
    expect(est.achievedUpTwr).toBe(0); // but no thrust in vacuum
    expect(est.warnings.some((w) => /no thrust/i.test(w))).toBe(true);
  });

  it('reports achieved up-TWR as Infinity in space when UP has vacuum-capable thrust', () => {
    const layout = emptyLayout();
    layout.up = [{ definition: hydroLarge, count: 4 }];
    const est = estimateManual(manualInput(layout, { planet: space }));
    expect(est.achievedUpTwr).toBe(Infinity); // no weight to divide by
  });

  // ── Freeform extra mass ─────────────────────────────────────────────────────
  // Always-on `added` joins the base (dry) mass; loaded-only `payload` joins the
  // cargo payload. Both flow through the support-sizing fixed point, so power +
  // gyros grow with the extra weight, and the reported dry/loaded mass reflect it.
  describe('extra mass', () => {
    it('folds always-on added mass into dry AND loaded mass', () => {
      const layout = uniformLayout(hydroLarge, 4);
      const baseline = estimateManual(manualInput(layout));
      const withAdded = estimateManual(
        manualInput(layout, { extraMass: { added: 20_000, payload: 0 } }),
      );
      // Dry mass gains exactly the always-on module.
      expect(withAdded.dryMass).toBeCloseTo(baseline.dryMass + 20_000, 0);
      // Loaded mass inherits it too (dry already includes it).
      expect(withAdded.loadedMass).toBeCloseTo(baseline.loadedMass + 20_000, 0);
    });

    it('folds loaded-only payload into loaded mass but NOT dry mass', () => {
      const layout = uniformLayout(hydroLarge, 4);
      const baseline = estimateManual(manualInput(layout));
      const withPayload = estimateManual(
        manualInput(layout, { extraMass: { added: 0, payload: 15_000 } }),
      );
      // Dry mass unchanged — the hauled load isn't part of the empty ship.
      expect(withPayload.dryMass).toBeCloseTo(baseline.dryMass, 0);
      // Loaded mass gains the hauled payload.
      expect(withPayload.loadedMass).toBeCloseTo(baseline.loadedMass + 15_000, 0);
    });

    it('extra mass lowers achieved up-TWR (same thrust, more weight)', () => {
      const layout = emptyLayout();
      layout.up = [{ definition: hydroLarge, count: 10 }];
      const light = estimateManual(
        manualInput(layout, { cargo: { fillFraction: 0, densityKgPerL: 2 } }),
      );
      const heavy = estimateManual(
        manualInput(layout, {
          cargo: { fillFraction: 0, densityKgPerL: 2 },
          extraMass: { added: 100_000, payload: 0 },
        }),
      );
      expect(heavy.achievedUpTwr).toBeLessThan(light.achievedUpTwr);
    });

    it('a large added mass can force more gyros (heavier ship to turn)', () => {
      // Light baseline (no cargo) so the extra mass is what dominates inertia; a
      // huge always-on module then demands strictly more gyros to hit the target.
      const layout = uniformLayout(hydroLarge, 4);
      const baseline = estimateManual(
        manualInput(layout, { cargo: { fillFraction: 0, densityKgPerL: 2 } }),
      );
      const heavy = estimateManual(
        manualInput(layout, {
          cargo: { fillFraction: 0, densityKgPerL: 2 },
          extraMass: { added: 10_000_000, payload: 0 },
        }),
      );
      expect(heavy.gyroCount).toBeGreaterThan(baseline.gyroCount);
    });

    it('clamps negative extra mass to zero (identical to no extra mass)', () => {
      const layout = uniformLayout(hydroLarge, 4);
      const baseline = estimateManual(manualInput(layout));
      const negative = estimateManual(
        manualInput(layout, { extraMass: { added: -50_000, payload: -50_000 } }),
      );
      expect(negative.dryMass).toBeCloseTo(baseline.dryMass, 6);
      expect(negative.loadedMass).toBeCloseTo(baseline.loadedMass, 6);
    });
  });
});

