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
 * geometry), unknown before the build — so it's a torque-per-mass target,
 * clearly labeled an estimate.
 */

import type { PlanetPreset, ThrusterBlock, Direction, GridSize } from '../../data/schema';
import type { CargoLoadout } from '../types';
import type {
  GyroscopeBlock,
  PowerProducerBlock,
  BatteryBlock,
  BlockDefinition,
} from '../../data/schema';
import { GRID_CELL_SIZE_M } from '../../data/fuel-constants';
import { effectiveThrust } from './thruster';
import { weight, DIRECTIONS } from './twr';

/** How responsive the ship should feel — drives the gyro torque-per-mass target. */
export type Responsiveness = 'sluggish' | 'normal' | 'nimble';

/**
 * Target gyro torque (N·m) per kg of loaded mass, by responsiveness, for a
 * LARGE-grid ship.
 *
 * Calibrated so one large-grid gyro (33.6 MN·m) handles roughly:
 *   sluggish ≈ 1 per 400 t,  normal ≈ 1 per 200 t,  nimble ≈ 1 per 100 t.
 * i.e. torque/kg = gyroForce / massPerGyro → 33.6e6/4e5 = 84, /2e5 = 168, /1e5 = 336.
 * This is a linear torque-per-mass heuristic; true turn rate depends on the
 * ship's moment of inertia (geometry), so the count is an ESTIMATE, not exact.
 */
const GYRO_TORQUE_PER_KG_LARGE: Record<Responsiveness, number> = {
  sluggish: 84,
  normal: 168,
  nimble: 336,
};

/**
 * Torque-per-kg must scale with grid size, because the torque a ship *needs* is
 * governed by its moment of inertia I = k·m·s² (a solid-box model — the same
 * one `motion.ts` uses), where `s` is the ship's characteristic size. Two ships
 * of equal mass but different grids have wildly different `s`: a large-grid cube
 * is built from 2.5 m cells, a small-grid one from 0.5 m cells, so for the same
 * block count the small ship is 5× smaller per axis and its moment of inertia
 * per kg is (0.5/2.5)² = 1/25 of the large ship's. It therefore needs ~1/25 the
 * torque-per-kg for the same responsiveness.
 *
 * Without this, the large-grid calibration above was applied to small-grid
 * ships and then divided by the 75×-weaker small gyro (448 kN·m vs 33.6 MN·m) —
 * a compounding over-count that recommended 3 gyros for a ~6 t utility ship real
 * builds fly on 1–2.
 *
 * We scale by (cell_size / large_cell_size)² so the large-grid row is unchanged
 * (ratio 1) and the small-grid target drops to 1/25, matching real small-grid
 * builds where a single gyro spins a light ship briskly.
 */
function gyroTorquePerKg(responsiveness: Responsiveness, gridSize: GridSize): number {
  const cellRatio = GRID_CELL_SIZE_M[gridSize] / GRID_CELL_SIZE_M.large;
  return GYRO_TORQUE_PER_KG_LARGE[responsiveness] * cellRatio * cellRatio;
}

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
 * {@link sizeGyros} need — power source, runtime target, gyro model, and desired
 * responsiveness. {@link ManualEstimatorConfig} satisfies it structurally, so the
 * support-sizing helpers stay decoupled from the full manual config.
 */
export interface SupportConfig {
  readonly power: PowerChoice;
  readonly runtimeTargetHours: number;
  readonly gyro: GyroscopeBlock;
  readonly responsiveness: Responsiveness;
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
  /** Desired maneuverability, driving the gyro estimate. */
  readonly responsiveness: Responsiveness;
}

export interface ManualEstimatorInput {
  /** The essential gear the user selected. */
  readonly fixedBlocks: readonly FixedBlockSpec[];
  readonly planet: PlanetPreset;
  readonly cargo: CargoLoadout;
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

/** Heuristic gyro count for a loaded mass (torque-per-mass target, see gyroTorquePerKg). */
function sizeGyros(config: SupportConfig, loadedMass: number): number {
  const torqueNeeded =
    gyroTorquePerKg(config.responsiveness, config.gyro.gridSize) * loadedMass;
  return config.gyro.maxTorque > 0 ? Math.ceil(torqueNeeded / config.gyro.maxTorque) : 0;
}

/**
 * Size power + gyros for a build whose thruster contribution (mass + peak
 * electrical draw) is already fixed. Power and gyros couple through mass (each
 * adds weight the other must account for), so iterate to a fixed point.
 *
 * The thruster contribution is passed as two precomputed scalars —
 * `thrusterMass` (total kg of all thrusters) and `peakThrusterWatts` (the
 * opposing-pair peak draw) — so this helper is agnostic to *how* the thrusters
 * were chosen: the legacy auto-solver's dead/diverged fallback and the manual
 * estimator both feed it. The ship's base systems still draw power and the hull
 * still needs attitude control independent of the thrusters, so power and gyros
 * are always sized rather than zeroed when thrusters are absent.
 */
function sizeSupport(
  config: SupportConfig,
  thrusterMass: number,
  peakThrusterWatts: number,
  baseMass: number,
  baseDraw: number,
  cargoPayload: number,
  perPowerSupply: number,
): { powerCount: number; gyroCount: number } {
  let powerCount = 0;
  let gyroCount = 0;
  for (let i = 0; i < SUPPORT_MAX_ITERATIONS; i++) {
    const dryMass =
      baseMass + thrusterMass + powerCount * config.power.block.mass + gyroCount * config.gyro.mass;
    const loadedMass = dryMass + cargoPayload;
    const peakDraw = baseDraw + peakThrusterWatts + gyroCount * config.gyro.powerDraw;
    const newPowerCount = sizePower(config, peakDraw, perPowerSupply);
    const newGyroCount = sizeGyros(config, loadedMass);
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
 * Unlike {@link estimateRequirements}, there is no thruster fixed point — the
 * thruster mass and peak electrical draw are known the moment the user's layout
 * is fixed. Power and gyros still couple through mass, so those iterate to a
 * fixed point via {@link sizeSupport}. Warnings are advisory only (the user is
 * in control): an empty UP axis, or a direction whose assigned thruster type
 * produces no thrust in this environment.
 */
export function estimateManual(input: ManualEstimatorInput): Estimate {
  const { fixedBlocks, planet, cargo, config } = input;
  const { thrusterLayout } = config;
  const warnings: string[] = [];

  const baseMass = fixedMass(fixedBlocks);
  const baseDraw = fixedDraw(fixedBlocks);
  const cargoPayload =
    fixedCargoCapacity(fixedBlocks) *
    Math.min(1, Math.max(0, cargo.fillFraction)) *
    cargo.densityKgPerL;

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

  const perPowerSupply = perPowerSupplyOf(config);
  const { powerCount, gyroCount } = sizeSupport(
    config,
    thrusterMass,
    peakThrusterWatts,
    baseMass,
    baseDraw,
    cargoPayload,
    perPowerSupply,
  );

  const totalThrusters = DIRECTIONS.reduce((s, d) => s + countByDir[d], 0);
  const dryMass =
    baseMass + thrusterMass + powerCount * config.power.block.mass + gyroCount * config.gyro.mass;
  const loadedMass = dryMass + cargoPayload;
  const w = weight(loadedMass, planet.surfaceGravity);
  const achievedUpTwr = w === 0 ? (thrustByDir.up > 0 ? Infinity : 0) : thrustByDir.up / w;
  const peakDraw = baseDraw + peakThrusterWatts + gyroCount * config.gyro.powerDraw;

  return {
    thrusters: countByDir,
    totalThrusters,
    powerCount,
    gyroCount,
    dryMass,
    loadedMass,
    achievedUpTwr,
    peakDraw,
    powerSupply: powerCount * perPowerSupply,
    iterations: 1,
    warnings,
  };
}
