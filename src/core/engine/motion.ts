/**
 * Motion & stability analysis (Phase 2 / M6).
 *
 * Four related computations:
 *   - stoppingDistance: how far the ship travels while the dampeners brake it
 *     from a given speed, using the braking thrust available in that direction.
 *   - centerOfMass: the mass-weighted average block position (needs geometry).
 *   - thrustCenterAlignment: offset between the center of mass and the center of
 *     thrust in each axis — a large offset means off-center thrust that induces
 *     unwanted spin.
 *   - turnRate: an ESTIMATE of angular acceleration/turn rate from total gyro
 *     torque and an approximate moment of inertia (a solid-box approximation,
 *     since exact inertia needs the full mass distribution).
 *
 * Stopping distance and turn rate work without block positions (any design).
 * Center-of-mass and alignment need per-instance positions, so they return
 * `null` when the design has no geometry (e.g. the estimator) — the caller
 * shows "import a blueprint for this".
 */

import type { ShipDesign, Vec3 } from '../types';
import type { PlanetPreset, Direction } from '../../data/schema';
import { GRID_CELL_SIZE_M } from '../../data/fuel-constants';
import { directionalThrust } from './twr';
import { loadedMass } from './mass';

/** Opposite direction of travel — braking a forward motion uses backward thrust. */
const BRAKING_THRUST: Record<Direction, Direction> = {
  forward: 'backward',
  backward: 'forward',
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

export interface StoppingResult {
  /** Deceleration available in this travel direction, m/s². */
  readonly deceleration: number;
  /** Distance covered while stopping from the given speed, m. */
  readonly distance: number;
  /** Time to stop, seconds. */
  readonly time: number;
}

/**
 * Stopping distance when travelling in `travelDirection` at `speed` (m/s) and
 * cutting to a full stop with dampeners.
 *
 * Dampeners fire the thrusters opposing the motion. Net deceleration is the
 * braking thrust minus gravity's pull along that axis... but modelling gravity
 * per-axis needs orientation to the planet, which we don't track — so we report
 * the thrust-only deceleration (accurate in space and for horizontal motion;
 * slightly optimistic when braking a climb, pessimistic when braking a descent).
 * That caveat is surfaced in the UI.
 *
 *   a = brakingThrust / mass ;  distance = v² / (2a) ;  time = v / a
 */
export function stoppingDistance(
  design: ShipDesign,
  planet: PlanetPreset,
  travelDirection: Direction,
  speed: number,
): StoppingResult {
  const thrust = directionalThrust(design, planet.atmosphereDensity);
  const brakeThrust = thrust[BRAKING_THRUST[travelDirection]];
  const mass = loadedMass(design);
  const a = mass > 0 ? brakeThrust / mass : 0;
  if (a <= 0 || speed <= 0) {
    return { deceleration: a, distance: a <= 0 ? Infinity : 0, time: a <= 0 ? Infinity : 0 };
  }
  return {
    deceleration: a,
    distance: (speed * speed) / (2 * a),
    time: speed / a,
  };
}

/** True when every block carries a positions array matching its quantity. */
export function hasGeometry(design: ShipDesign): boolean {
  return design.blocks.every(
    (b) => b.positions !== undefined && b.positions.length === b.quantity,
  );
}

/**
 * Mass-weighted center of mass in grid cells, or `null` if the design lacks
 * per-instance positions. Uses each block definition's mass at each instance
 * position (dry mass; cargo contents are distributed and not localized).
 */
export function centerOfMass(design: ShipDesign): Vec3 | null {
  if (!hasGeometry(design)) return null;
  let mx = 0;
  let my = 0;
  let mz = 0;
  let totalMass = 0;
  for (const b of design.blocks) {
    const perBlockMass = b.definition.mass;
    for (const p of b.positions!) {
      mx += p.x * perBlockMass;
      my += p.y * perBlockMass;
      mz += p.z * perBlockMass;
      totalMass += perBlockMass;
    }
  }
  if (totalMass === 0) return null;
  return { x: mx / totalMass, y: my / totalMass, z: mz / totalMass };
}

/**
 * Center of thrust for a given thrust direction: the thrust-weighted average
 * position of the thrusters pushing that way. `null` if none or no geometry.
 */
function centerOfThrust(design: ShipDesign, direction: Direction): Vec3 | null {
  let sx = 0;
  let sy = 0;
  let sz = 0;
  let total = 0;
  for (const b of design.blocks) {
    if (b.definition.category !== 'thruster' || b.thrustDirection !== direction) continue;
    if (b.positions === undefined) return null;
    // Each thruster instance contributes equal thrust, so a plain positional
    // average is the (equal-weighted) center of thrust for this direction.
    for (const p of b.positions) {
      sx += p.x;
      sy += p.y;
      sz += p.z;
      total += 1;
    }
  }
  if (total === 0) return null;
  return { x: sx / total, y: sy / total, z: sz / total };
}

export interface AlignmentResult {
  /** The thrust direction this alignment is for. */
  readonly direction: Direction;
  /** Center-of-mass to center-of-thrust offset in meters (per axis + magnitude). */
  readonly offset: Vec3;
  readonly offsetMagnitude: number;
}

/**
 * Thrust-center vs. center-of-mass alignment for each direction that has
 * thrusters. A nonzero offset perpendicular to the thrust axis induces torque
 * (unwanted spin) when that thrust fires. Returns `null` without geometry.
 */
export function thrustCenterAlignment(design: ShipDesign): AlignmentResult[] | null {
  const com = centerOfMass(design);
  if (com === null) return null;
  const cell = GRID_CELL_SIZE_M[design.gridSize];
  const directions: Direction[] = ['up', 'down', 'forward', 'backward', 'left', 'right'];
  const results: AlignmentResult[] = [];
  for (const dir of directions) {
    const cot = centerOfThrust(design, dir);
    if (cot === null) continue;
    const offset: Vec3 = {
      x: (cot.x - com.x) * cell,
      y: (cot.y - com.y) * cell,
      z: (cot.z - com.z) * cell,
    };
    const offsetMagnitude = Math.sqrt(offset.x ** 2 + offset.y ** 2 + offset.z ** 2);
    results.push({ direction: dir, offset, offsetMagnitude });
  }
  return results;
}

/**
 * Characteristic side length (m) of a ship approximated as a uniform-density
 * cube of `blockCount` cells. `s = ∛(blockCount) · cell`. Used when exact
 * geometry (block positions) is unavailable — e.g. the estimator's synthesized
 * designs. Clamped to at least one cell so a degenerate build has a real size.
 */
export function characteristicSide(blockCount: number, cell: number): number {
  return Math.cbrt(Math.max(1, blockCount)) * cell;
}

/**
 * Moment of inertia (kg·m²) of a solid cube of mass `m` and side `s` about a
 * face axis: `I = (1/6) m s²`. The same approximation the turn-rate estimate
 * uses — good for relative comparisons, not exact for real geometry.
 */
export function solidCubeInertia(mass: number, side: number): number {
  return (1 / 6) * mass * side * side;
}

/**
 * Time (s) to rotate a quarter turn (90°, π/2 rad) from rest under a constant
 * angular acceleration `α`, from θ = ½αt² ⇒ t = √(π/α). `Infinity` when there
 * is no angular acceleration (the ship never completes the turn).
 */
export function quarterTurnTime(angularAccel: number): number {
  return angularAccel > 0 ? Math.sqrt((2 * (Math.PI / 2)) / angularAccel) : Infinity;
}

/**
 * The angular acceleration (rad/s²) required to complete a quarter turn (90°)
 * from rest within `seconds` — the inverse of {@link quarterTurnTime}, from
 * t = √(π/α) ⇒ α = π/t². `Infinity` for a non-positive time target (no finite
 * torque can turn instantly).
 */
export function angularAccelForQuarterTurnTime(seconds: number): number {
  return seconds > 0 ? (2 * (Math.PI / 2)) / (seconds * seconds) : Infinity;
}

export interface TurnRateEstimate {
  /** Total gyro torque available, N·m. */
  readonly totalTorque: number;
  /** Approximate moment of inertia (solid-box model), kg·m². */
  readonly momentOfInertia: number;
  /** Angular acceleration, rad/s². */
  readonly angularAcceleration: number;
  /** Rough time to reach a 90° (π/2) turn from rest, seconds. */
  readonly timeToQuarterTurn: number;
}

/**
 * Estimate turn rate from total gyro torque and an approximate moment of
 * inertia. This is a HEURISTIC: exact inertia needs the full mass distribution
 * and the axis of rotation. We approximate the ship as a uniform-density cube
 * whose side is derived from its bounding cells (when geometry is present) or a
 * mass-based fallback, and use I = (1/6) m s² for a solid cube about a face
 * axis. Good for relative comparisons and ballpark feel, not exact degrees/sec.
 */
export function turnRateEstimate(design: ShipDesign): TurnRateEstimate {
  let totalTorque = 0;
  for (const b of design.blocks) {
    if (b.definition.category === 'gyroscope') {
      totalTorque += b.definition.maxTorque * b.quantity;
    }
  }
  const mass = loadedMass(design);
  const cell = GRID_CELL_SIZE_M[design.gridSize];

  // Estimate the ship's characteristic side length (m).
  let side: number;
  if (hasGeometry(design)) {
    // Bounding box across all block cells → side = max extent.
    let min = { x: Infinity, y: Infinity, z: Infinity };
    let max = { x: -Infinity, y: -Infinity, z: -Infinity };
    for (const b of design.blocks) {
      for (const p of b.positions!) {
        min = { x: Math.min(min.x, p.x), y: Math.min(min.y, p.y), z: Math.min(min.z, p.z) };
        max = { x: Math.max(max.x, p.x), y: Math.max(max.y, p.y), z: Math.max(max.z, p.z) };
      }
    }
    const extent = Math.max(max.x - min.x, max.y - min.y, max.z - min.z) + 1; // +1 cell
    side = extent * cell;
  } else {
    // Fallback: approximate the ship as a cube of `blockCount` cells (no geometry
    // available, e.g. the estimator's synthesized designs).
    const blockCount = design.blocks.reduce((s, b) => s + b.quantity, 0);
    side = characteristicSide(blockCount, cell);
  }

  // Solid cube about a face axis: I = (1/6) m s².
  const momentOfInertia = solidCubeInertia(mass, side);
  const angularAcceleration = momentOfInertia > 0 ? totalTorque / momentOfInertia : 0;
  const timeToQuarterTurn = quarterTurnTime(angularAcceleration);

  return { totalTorque, momentOfInertia, angularAcceleration, timeToQuarterTurn };
}
