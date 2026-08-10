/**
 * Ship requirement estimator — the inverse of blueprint import.
 *
 * You specify the *essential* gear (drills, cargo, cockpit, beacon, …) and
 * assign thrusters per direction by hand ({@link estimateManual}); this sizes
 * the *support* systems the build implies: how much power (batteries/reactor to
 * cover peak draw + a runtime target) and roughly how many gyros. It's what you
 * need while planning a build you can't yet export a blueprint for.
 *
 * Why it iterates
 * ---------------
 * The thrusters are fixed the moment the user's layout is set, but power blocks
 * and gyros each add mass AND power draw, which changes how many are needed. So
 * we can't size those once — we loop ({@link sizeSupport}): size power for the
 * current draw → it adds mass → size gyros → repeat until the counts stop
 * changing (fixed point). Without this, a naive single pass under-sizes support.
 *
 * Exactness
 * ---------
 * Power sizing is exact arithmetic (sum of draws, runtime capacity). Gyro count
 * is a HEURISTIC — true turn rate needs the ship's moment of inertia (its
 * geometry), unknown before the build. We approximate the ship as a solid cube
 * (the same model `motion.ts` uses) and solve for the fewest gyros that turn it
 * 90° within the user's target time, reporting the achieved turn time alongside.
 */

import type { PlanetPreset, ThrusterBlock, Direction, GridSize } from '../../data/schema';
import type { CargoLoadout, ExtraMass } from '../types';
import type {
  GyroscopeBlock,
  PowerProducerBlock,
  BatteryBlock,
  BlockDefinition,
} from '../../data/schema';
import { GRID_CELL_SIZE_M } from '../../data/fuel-constants';
import { effectiveThrust } from './thruster';
import { weight, DIRECTIONS } from './twr';
import {
  characteristicSide,
  solidCubeInertia,
  quarterTurnTime,
  angularAccelForQuarterTurnTime,
} from './motion';

/** A block the user has committed to (the "essentials"), with a count. */
export interface FixedBlockSpec {
  readonly definition: BlockDefinition;
  readonly quantity: number;
}

/** The power source the user chose the app to size the count of. */
export type PowerChoice =
  | { readonly kind: 'battery'; readonly block: BatteryBlock }
  | { readonly kind: 'producer'; readonly block: PowerProducerBlock };

/**
 * The subset of estimator config that {@link sizeSupport}, {@link sizePower} and
 * {@link sizeGyros} need — power source, runtime target, gyro model, and the
 * target turn time the gyro count is solved against. {@link ManualEstimatorConfig}
 * satisfies it structurally, so the support-sizing helpers stay decoupled from
 * the full manual config.
 */
export interface SupportConfig {
  readonly power: PowerChoice;
  readonly runtimeTargetHours: number;
  readonly gyro: GyroscopeBlock;
  /** Target time to turn the ship 90° from rest, seconds — drives the gyro count. */
  readonly targetTurnTime: number;
}

/** One thruster type + count assigned to a single direction. */
export interface ThrusterAssignment {
  readonly definition: ThrusterBlock;
  readonly count: number;
}

/**
 * Per-direction thruster assignments — a *stack* of (type × count) per axis. A
 * direction may mix types (e.g. UP = 4 large hydrogen + 6 small ion); its total
 * thrust/mass/draw is the sum over the stack. An empty stack means no thrusters
 * assigned to that direction.
 */
export type ThrusterLayout = Record<Direction, readonly ThrusterAssignment[]>;

/**
 * Manual estimator config: the user assigns thrusters per direction by hand
 * ({@link thrusterLayout}); the app only sizes the *support* systems (power,
 * gyros) against the resulting build.
 */
export interface ManualEstimatorConfig {
  /** User-assigned thruster stacks, per direction. */
  readonly thrusterLayout: ThrusterLayout;
  /** The power source to size the count of (battery or producer). */
  readonly power: PowerChoice;
  /** How long batteries must sustain peak draw, hours (ignored for producers). */
  readonly runtimeTargetHours: number;
  /** The gyroscope model to size the count of. */
  readonly gyro: GyroscopeBlock;
  /** Target time to turn 90° from rest, seconds — the gyro count is solved to meet it. */
  readonly targetTurnTime: number;
}

export interface ManualEstimatorInput {
  /** The essential gear the user selected. */
  readonly fixedBlocks: readonly FixedBlockSpec[];
  readonly planet: PlanetPreset;
  readonly cargo: CargoLoadout;
  /**
   * Optional freeform extra mass: always-on `added` (counts empty AND loaded,
   * folded into base/dry mass) and loaded-only `payload` (counts only loaded,
   * alongside cargo). Absent ⇒ no extra mass.
   */
  readonly extraMass?: ExtraMass;
  /** Grid scale of the build (drives geometry-less design synthesis downstream). */
  readonly gridSize: GridSize;
  readonly config: ManualEstimatorConfig;
}

/** Per-direction recommended thruster counts. */
export type DirectionalCount = Record<Direction, number>;

export interface Estimate {
  /** Recommended thruster count per direction (0 where none needed). */
  readonly thrusters: DirectionalCount;
  /** Total recommended thrusters across all directions. */
  readonly totalThrusters: number;
  /** Recommended count of the chosen power block. */
  readonly powerCount: number;
  /** Recommended gyro count (heuristic estimate). */
  readonly gyroCount: number;
  /**
   * Achieved time to turn the ship 90° from rest with the recommended gyros, at
   * the settled loaded mass, seconds. `Infinity` if there are no gyros or no
   * mass. Compare against the config's `targetTurnTime` — the gyro count is the
   * fewest that gets this at or below the target.
   */
  readonly achievedTurnTime: number;
  /** Resulting dry mass (fixed + recommended blocks), kg. */
  readonly dryMass: number;
  /** Resulting loaded mass (dry + cargo payload), kg. */
  readonly loadedMass: number;
  /** Achieved loaded up-TWR with the recommended thrusters. */
  readonly achievedUpTwr: number;
  /** Peak electrical draw of the whole recommended ship, W. */
  readonly peakDraw: number;
  /** Sustained generation (producers) or battery discharge capacity, W. */
  readonly powerSupply: number;
  /** Iterations to converge (diagnostics). */
  readonly iterations: number;
  /** Warnings, e.g. infeasible thruster choice for the environment. */
  readonly warnings: readonly string[];
}

/** Sum mass of a set of fixed blocks. */
function fixedMass(fixed: readonly FixedBlockSpec[]): number {
  return fixed.reduce((s, b) => s + b.definition.mass * b.quantity, 0);
}

/** Sum peak electrical draw of a set of fixed blocks. */
function fixedDraw(fixed: readonly FixedBlockSpec[]): number {
  let total = 0;
  for (const b of fixed) {
    const def = b.definition;
    if ('maxPowerDraw' in def && typeof def.maxPowerDraw === 'number') {
      total += def.maxPowerDraw * b.quantity;
    } else if ('powerDraw' in def && typeof def.powerDraw === 'number') {
      total += def.powerDraw * b.quantity;
    }
  }
  return total;
}

/** Total inventory capacity across the fixed blocks, liters. */
function fixedCargoCapacity(fixed: readonly FixedBlockSpec[]): number {
  let total = 0;
  for (const b of fixed) {
    const def = b.definition;
    if (def.category === 'cargo' || def.category === 'cockpit') {
      total += def.inventoryVolume * b.quantity;
    }
  }
  return total;
}

/**
 * Realistic peak *thruster* electrical draw for power sizing: opposing thrusters
 * (up vs. down, forward vs. back, left vs. right) never fire together, so only
 * the larger-drawing side of each pair loads the grid at once. Summing all six
 * directions — as a naive total does — roughly doubles the true electrical load
 * and over-sizes the batteries. Mirrors `peakDraw()` in `power.ts`.
 *
 * Draw-aware (not just count-aware) because directions may use different thruster
 * types with different `maxPowerDraw`: the peak side of an axis is whichever
 * direction draws more watts, not whichever has more thrusters.
 */
function peakThrusterDraw(counts: DirectionalCount, draw: Record<Direction, number>): number {
  const axis = (a: Direction, b: Direction): number =>
    Math.max(counts[a] * draw[a], counts[b] * draw[b]);
  return axis('up', 'down') + axis('forward', 'backward') + axis('left', 'right');
}

/** Cap on the power↔gyro mass fixed-point loop (it converges in a few passes). */
const SUPPORT_MAX_ITERATIONS = 25;

/**
 * Battery/producer count to cover a peak electrical draw. Batteries must ALSO
 * store enough to sustain that draw for the runtime target (capacity ≥ draw ×
 * hours), so the larger of the two counts wins. Producers ignore runtime.
 */
function sizePower(config: SupportConfig, peakDraw: number, perPowerSupply: number): number {
  let count = perPowerSupply > 0 ? Math.ceil(peakDraw / perPowerSupply) : 0;
  if (config.power.kind === 'battery' && peakDraw > 0) {
    const energyNeeded = peakDraw * config.runtimeTargetHours; // Wh
    const byCapacity = Math.ceil(energyNeeded / config.power.block.energyCapacity);
    count = Math.max(count, byCapacity);
  }
  return count;
}

/**
 * Fewest gyros to turn a ship of `loadedMass` (kg) and `blockCount` cells (on a
 * grid of `cell` metres) 90° from rest within `config.targetTurnTime` seconds.
 *
 * Inverts the solid-cube turn model `motion.ts` uses: side `s = ∛(blockCount)·cell`,
 * inertia `I = ⅙·m·s²`, required `α = π/T²`, required torque `τ = α·I`, count =
 * `ceil(τ / gyro.maxTorque)`. A non-positive target (impossible to turn instantly)
 * or a torque-less gyro yields 0 — the achieved turn time then reads `Infinity`,
 * honestly signalling the target can't be met rather than propagating `Infinity`
 * into the count.
 */
function sizeGyros(
  config: SupportConfig,
  loadedMass: number,
  blockCount: number,
  cell: number,
): number {
  if (config.targetTurnTime <= 0 || config.gyro.maxTorque <= 0) return 0;
  const side = characteristicSide(blockCount, cell);
  const inertia = solidCubeInertia(loadedMass, side);
  const requiredAccel = angularAccelForQuarterTurnTime(config.targetTurnTime);
  const torqueNeeded = requiredAccel * inertia;
  return Math.ceil(torqueNeeded / config.gyro.maxTorque);
}

/**
 * Achieved time (s) to turn 90° from rest with `gyroCount` gyros on a ship of
 * `loadedMass` and `blockCount` cells — the forward direction of {@link sizeGyros},
 * used to report what the sized gyros actually deliver. `Infinity` when there is
 * no gyro torque or no mass to turn.
 */
function achievedTurnTimeFor(
  config: SupportConfig,
  gyroCount: number,
  loadedMass: number,
  blockCount: number,
  cell: number,
): number {
  const totalTorque = gyroCount * config.gyro.maxTorque;
  const inertia = solidCubeInertia(loadedMass, characteristicSide(blockCount, cell));
  const angularAccel = inertia > 0 ? totalTorque / inertia : 0;
  return quarterTurnTime(angularAccel);
}

/**
 * Size power + gyros for a build whose thruster contribution (mass + peak
 * electrical draw) is already fixed. Power and gyros couple through mass (each
 * adds weight the other must account for), so iterate to a fixed point.
 *
 * The thruster contribution is passed as two precomputed scalars —
 * `thrusterMass` (total kg of all thrusters) and `peakThrusterWatts` (the
 * opposing-pair peak draw) — so this helper is agnostic to *how* the thrusters
 * were chosen. Gyro sizing also needs the ship's block count and grid cell size
 * (they set the moment-of-inertia the turn-time target is solved against);
 * `baseBlockCount` (essentials + thrusters) plus the sized power/gyro counts give
 * the total cell count each pass. The ship's base systems still draw power and
 * the hull still needs attitude control independent of the thrusters, so power
 * and gyros are always sized rather than zeroed when thrusters are absent.
 */
function sizeSupport(
  config: SupportConfig,
  thrusterMass: number,
  peakThrusterWatts: number,
  baseMass: number,
  baseDraw: number,
  cargoPayload: number,
  perPowerSupply: number,
  baseBlockCount: number,
  cell: number,
): { powerCount: number; gyroCount: number } {
  let powerCount = 0;
  let gyroCount = 0;
  for (let i = 0; i < SUPPORT_MAX_ITERATIONS; i++) {
    const dryMass =
      baseMass + thrusterMass + powerCount * config.power.block.mass + gyroCount * config.gyro.mass;
    const loadedMass = dryMass + cargoPayload;
    const blockCount = baseBlockCount + powerCount + gyroCount;
    const peakDraw = baseDraw + peakThrusterWatts + gyroCount * config.gyro.powerDraw;
    const newPowerCount = sizePower(config, peakDraw, perPowerSupply);
    const newGyroCount = sizeGyros(config, loadedMass, blockCount, cell);
    if (newPowerCount === powerCount && newGyroCount === gyroCount) break;
    powerCount = newPowerCount;
    gyroCount = newGyroCount;
  }
  return { powerCount, gyroCount };
}

/** Per-power-block supply: discharge rate for batteries, output for producers. */
function perPowerSupplyOf(config: SupportConfig): number {
  return config.power.block.maxPowerOutput;
}

/**
 * Manual estimator: the user assigns thrusters per direction by hand and the app
 * sizes only the *support* systems (power + gyros) against the resulting build.
 *
 * There is no thruster fixed point — the thruster mass and peak electrical draw
 * are known the moment the user's layout is fixed. Power and gyros still couple
 * through mass, so those iterate to a fixed point via {@link sizeSupport}.
 * Warnings are advisory only (the user is in control): an empty UP axis, or a
 * direction whose assigned thruster type produces no thrust in this environment.
 */
export function estimateManual(input: ManualEstimatorInput): Estimate {
  const { fixedBlocks, planet, cargo, config } = input;
  const { thrusterLayout } = config;
  const warnings: string[] = [];

  // Always-on extra mass (docked ship / bolted-on module) is part of the empty
  // ship, so it joins the base (dry) mass; loaded-only extra payload (a hauled
  // load) joins the cargo payload. Both clamped ≥ 0 and default to 0 when absent.
  const addedMass = Math.max(0, input.extraMass?.added ?? 0);
  const extraPayload = Math.max(0, input.extraMass?.payload ?? 0);

  const baseMass = fixedMass(fixedBlocks) + addedMass;
  const baseDraw = fixedDraw(fixedBlocks);
  const cargoPayload =
    fixedCargoCapacity(fixedBlocks) *
      Math.min(1, Math.max(0, cargo.fillFraction)) *
      cargo.densityKgPerL +
    extraPayload;

  // Per-direction totals from the user's stacks: effective thrust in this
  // environment, block count, total mass, and peak electrical draw.
  const thrustByDir = {} as Record<Direction, number>;
  const countByDir = {} as DirectionalCount;
  const drawByDir = {} as Record<Direction, number>;
  let thrusterMass = 0;
  for (const d of DIRECTIONS) {
    let thrust = 0;
    let count = 0;
    let watts = 0;
    for (const a of thrusterLayout[d]) {
      if (a.count <= 0) continue;
      thrust += effectiveThrust(a.definition, planet.atmosphereDensity) * a.count;
      count += a.count;
      watts += a.definition.maxPowerDraw * a.count;
      thrusterMass += a.definition.mass * a.count;
      // Advisory: a type assigned here that produces no thrust in this environment.
      if (effectiveThrust(a.definition, planet.atmosphereDensity) <= 0) {
        warnings.push(
          `${a.definition.displayName} on the ${d.toUpperCase()} axis produces no thrust ` +
            `on ${planet.displayName} (air density ${planet.atmosphereDensity}). It adds ` +
            `mass and power draw but no thrust here.`,
        );
      }
    }
    thrustByDir[d] = thrust;
    countByDir[d] = count;
    drawByDir[d] = watts;
  }

  if (countByDir.up === 0) {
    warnings.push(
      'No thrusters assigned to the UP axis — the ship has no lift. Assign UP thrusters ' +
        'to reach a positive TWR (or acceleration in space).',
    );
  }

  // Opposing thruster pairs never fire together, so peak thruster draw is the
  // larger-drawing side of each axis. drawByDir already holds per-direction total
  // watts, so a unit "count" of 1 selects that whole side.
  const unitCounts: DirectionalCount = {
    up: 1,
    down: 1,
    forward: 1,
    backward: 1,
    left: 1,
    right: 1,
  };
  const peakThrusterWatts = peakThrusterDraw(unitCounts, drawByDir);

  const totalThrusters = DIRECTIONS.reduce((s, d) => s + countByDir[d], 0);
  // Cells the gyro turn-time target is solved against: essentials + thrusters
  // (sizeSupport adds the power/gyro counts it sizes each pass). No geometry
  // exists yet, so the estimate uses the same cube approximation motion.ts falls
  // back to; the synthesized design's turn time therefore matches this readout.
  const essentialsCount = fixedBlocks.reduce((s, b) => s + b.quantity, 0);
  const baseBlockCount = essentialsCount + totalThrusters;
  const cell = GRID_CELL_SIZE_M[input.gridSize];

  const perPowerSupply = perPowerSupplyOf(config);
  const { powerCount, gyroCount } = sizeSupport(
    config,
    thrusterMass,
    peakThrusterWatts,
    baseMass,
    baseDraw,
    cargoPayload,
    perPowerSupply,
    baseBlockCount,
    cell,
  );

  const dryMass =
    baseMass + thrusterMass + powerCount * config.power.block.mass + gyroCount * config.gyro.mass;
  const loadedMass = dryMass + cargoPayload;
  const w = weight(loadedMass, planet.surfaceGravity);
  const achievedUpTwr = w === 0 ? (thrustByDir.up > 0 ? Infinity : 0) : thrustByDir.up / w;
  const peakDraw = baseDraw + peakThrusterWatts + gyroCount * config.gyro.powerDraw;
  const achievedTurnTime = achievedTurnTimeFor(
    config,
    gyroCount,
    loadedMass,
    baseBlockCount + powerCount + gyroCount,
    cell,
  );

  return {
    thrusters: countByDir,
    totalThrusters,
    powerCount,
    gyroCount,
    achievedTurnTime,
    dryMass,
    loadedMass,
    achievedUpTwr,
    peakDraw,
    powerSupply: powerCount * perPowerSupply,
    iterations: 1,
    warnings,
  };
}
