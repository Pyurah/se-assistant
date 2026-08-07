/**
 * Ship requirement estimator — the inverse of blueprint import.
 *
 * You specify the *essential* gear (drills, cargo, cockpit, beacon, …) and a
 * few goals, and this sizes the rest: how many thrusters (per direction, to hit
 * a target TWR), how much power (batteries/reactor to cover peak draw + a
 * runtime target), and roughly how many gyros. It's what you need while
 * planning a build you can't yet export a blueprint for.
 *
 * Why it iterates
 * ---------------
 * Thrusters, power blocks, and gyros each add mass AND power draw, which changes
 * how many are needed. So we can't size once — we loop: size thrusters for the
 * current mass → they add mass/draw → size power for the new draw → it adds mass
 * → size gyros → repeat until the counts stop changing (fixed point). Without
 * this, a naive single pass under-sizes every ship.
 *
 * Exactness
 * ---------
 * Thruster and power sizing are exact arithmetic (thrust vs. weight, sum of
 * draws). Gyro count is a HEURISTIC — true turn rate needs the ship's moment of
 * inertia (its geometry), unknown before the build — so it's a torque-per-mass
 * target, clearly labeled an estimate.
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

export interface EstimatorConfig {
  /** Target loaded up-TWR (e.g. 2.0 = twice the thrust needed to hover). */
  readonly targetTwr: number;
  /** Fraction of the up-thrust magnitude to provide in each other direction. */
  readonly lateralThrustFraction: number;
  /** The thruster model to size counts of. */
  readonly thruster: ThrusterBlock;
  /** The power source to size the count of (battery or producer). */
  readonly power: PowerChoice;
  /** How long batteries must sustain peak draw, hours (ignored for producers). */
  readonly runtimeTargetHours: number;
  /** The gyroscope model to size the count of. */
  readonly gyro: GyroscopeBlock;
  /** Desired maneuverability, driving the gyro estimate. */
  readonly responsiveness: Responsiveness;
}

export interface EstimatorInput {
  /** The essential gear the user selected. */
  readonly fixedBlocks: readonly FixedBlockSpec[];
  readonly planet: PlanetPreset;
  readonly cargo: CargoLoadout;
  readonly config: EstimatorConfig;
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

const MAX_ITERATIONS = 25;

/**
 * Estimate the thruster/power/gyro requirements for a ship from its essentials.
 *
 * Iterates to a fixed point where the recommended counts stop changing.
 */
export function estimateRequirements(input: EstimatorInput): Estimate {
  const { fixedBlocks, planet, cargo, config } = input;
  const warnings: string[] = [];

  const baseMass = fixedMass(fixedBlocks);
  const baseDraw = fixedDraw(fixedBlocks);
  const cargoPayload =
    fixedCargoCapacity(fixedBlocks) *
    Math.min(1, Math.max(0, cargo.fillFraction)) *
    cargo.densityKgPerL;

  // Per-thruster effective thrust in this environment.
  const perThruster = effectiveThrust(config.thruster, planet.atmosphereDensity);
  const thrusterFeasible = perThruster > 0;
  if (!thrusterFeasible) {
    warnings.push(
      `${config.thruster.displayName} produces no thrust on ${planet.displayName} ` +
        `(air density ${planet.atmosphereDensity}). Pick a different thruster type.`,
    );
  }

  // Per-power-block supply (discharge rate for batteries, output for producers).
  const perPowerSupply =
    config.power.kind === 'battery'
      ? config.power.block.maxPowerOutput
      : config.power.block.maxPowerOutput;
  const perPowerMass = config.power.block.mass;

  let thrusterCount = 0;
  let powerCount = 0;
  let gyroCount = 0;
  let iterations = 0;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    iterations = i + 1;

    // Current recommended-block mass from the previous iteration's counts.
    const thrusterMass = thrusterCount * config.thruster.mass;
    const powerMass = powerCount * perPowerMass;
    const gyroMass = gyroCount * config.gyro.mass;
    const dryMass = baseMass + thrusterMass + powerMass + gyroMass;
    const loadedMass = dryMass + cargoPayload;

    // 1) Thrusters: size UP to hit target TWR against loaded weight.
    const g = planet.surfaceGravity;
    const upThrustNeeded = config.targetTwr * weight(loadedMass, g);
    const newUp = thrusterFeasible && upThrustNeeded > 0 ? Math.ceil(upThrustNeeded / perThruster) : 0;
    const lateralThrustNeeded = config.lateralThrustFraction * upThrustNeeded;
    const newLateral =
      thrusterFeasible && lateralThrustNeeded > 0
        ? Math.ceil(lateralThrustNeeded / perThruster)
        : 0;
    const newThrusterTotal = newUp + newLateral * 5;

    // 2) Power: cover peak draw (fixed + thrusters at full + gyros).
    const thrusterDraw = newThrusterTotal * config.thruster.maxPowerDraw;
    const gyroDraw = gyroCount * config.gyro.powerDraw;
    const peakDraw = baseDraw + thrusterDraw + gyroDraw;
    let newPowerCount = perPowerSupply > 0 ? Math.ceil(peakDraw / perPowerSupply) : 0;
    if (config.power.kind === 'battery' && peakDraw > 0) {
      // Batteries must ALSO store enough to sustain peak draw for the target
      // runtime: capacity(Wh) ≥ peakDraw(W) × hours. Take the larger count.
      const energyNeeded = peakDraw * config.runtimeTargetHours; // Wh
      const byCapacity = Math.ceil(energyNeeded / config.power.block.energyCapacity);
      newPowerCount = Math.max(newPowerCount, byCapacity);
    }

    // 3) Gyros: heuristic torque-per-mass target against loaded mass, scaled to
    // the ship's grid (small-grid ships need far less torque-per-kg — see
    // gyroTorquePerKg).
    const torqueNeeded =
      gyroTorquePerKg(config.responsiveness, config.gyro.gridSize) * loadedMass;
    const newGyroCount = config.gyro.maxTorque > 0 ? Math.ceil(torqueNeeded / config.gyro.maxTorque) : 0;

    const converged =
      newThrusterTotal === thrusterCount &&
      newPowerCount === powerCount &&
      newGyroCount === gyroCount;

    thrusterCount = newThrusterTotal;
    powerCount = newPowerCount;
    gyroCount = newGyroCount;

    if (converged) {
      // Recompute final directional split + summary with the settled counts.
      return finalize(
        input,
        { up: newUp, down: newLateral, forward: newLateral, backward: newLateral, left: newLateral, right: newLateral },
        powerCount,
        gyroCount,
        perThruster,
        perPowerSupply,
        cargoPayload,
        baseMass,
        baseDraw,
        iterations,
        warnings,
      );
    }
  }

  warnings.push('Estimate did not fully converge; showing the last iteration.');
  // Fall through: rebuild a directional split from the last counts.
  const up = thrusterFeasible ? Math.ceil((config.targetTwr * weight(baseMass + cargoPayload, planet.surfaceGravity)) / perThruster) : 0;
  const lateral = Math.ceil(config.lateralThrustFraction * up);
  return finalize(
    input,
    { up, down: lateral, forward: lateral, backward: lateral, left: lateral, right: lateral },
    powerCount,
    gyroCount,
    perThruster,
    perPowerSupply,
    cargoPayload,
    baseMass,
    baseDraw,
    iterations,
    warnings,
  );
}

/** Assemble the final Estimate from settled counts. */
function finalize(
  input: EstimatorInput,
  thrusters: DirectionalCount,
  powerCount: number,
  gyroCount: number,
  perThruster: number,
  perPowerSupply: number,
  cargoPayload: number,
  baseMass: number,
  baseDraw: number,
  iterations: number,
  warnings: string[],
): Estimate {
  const { config, planet } = input;
  const totalThrusters = DIRECTIONS.reduce((s, d) => s + thrusters[d], 0);
  const dryMass =
    baseMass +
    totalThrusters * config.thruster.mass +
    powerCount * config.power.block.mass +
    gyroCount * config.gyro.mass;
  const loadedMass = dryMass + cargoPayload;
  const upThrust = thrusters.up * perThruster;
  const w = weight(loadedMass, planet.surfaceGravity);
  const achievedUpTwr = w === 0 ? (upThrust > 0 ? Infinity : 0) : upThrust / w;
  const peakDraw =
    baseDraw + totalThrusters * config.thruster.maxPowerDraw + gyroCount * config.gyro.powerDraw;

  return {
    thrusters,
    totalThrusters,
    powerCount,
    gyroCount,
    dryMass,
    loadedMass,
    achievedUpTwr,
    peakDraw,
    powerSupply: powerCount * perPowerSupply,
    iterations,
    warnings,
  };
}
