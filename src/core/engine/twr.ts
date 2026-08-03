/**
 * Thrust-to-Weight Ratio (TWR) — the core of the tool.
 *
 *   TWR = usable thrust (N) / (mass (kg) × gravity (m/s²))
 *
 * TWR > 1 in a direction means the ship can accelerate that way against gravity
 * (i.e. lift off / hover). Because thrust is directional and thruster output
 * depends on the environment, this module computes thrust per grid-local axis
 * with each thruster's air-density effectiveness applied, then divides by
 * weight for the chosen planet.
 *
 * "Up thrust" is what fights gravity: the sum of thrusters whose resolved
 * thrust direction is `up`. A ship lifts off when up-TWR > 1.
 */

import type { ShipDesign } from '../types';
import type { Direction, PlanetPreset } from '../../data/schema';
import { effectiveThrust } from './thruster';
import { loadedMass, dryMass } from './mass';

/** The six local axes, for iterating directional results. */
export const DIRECTIONS: readonly Direction[] = [
  'up',
  'down',
  'forward',
  'backward',
  'left',
  'right',
];

export type DirectionalThrust = Record<Direction, number>;

/**
 * Usable thrust per direction (N) at a given air density.
 *
 * Only thrusters with a resolved `thrustDirection` contribute (an unoriented
 * thruster from a blueprint is excluded rather than mis-attributed). Each
 * thruster's contribution is its effective thrust × quantity.
 */
export function directionalThrust(design: ShipDesign, airDensity: number): DirectionalThrust {
  const out: DirectionalThrust = {
    up: 0,
    down: 0,
    forward: 0,
    backward: 0,
    left: 0,
    right: 0,
  };
  for (const b of design.blocks) {
    if (b.definition.category !== 'thruster') continue;
    const dir = b.thrustDirection;
    if (dir === undefined) continue;
    out[dir] += effectiveThrust(b.definition, airDensity) * b.quantity;
  }
  return out;
}

/** Weight (N) = mass (kg) × gravity (m/s²). */
export function weight(mass: number, gravity: number): number {
  return mass * gravity;
}

/**
 * TWR in every direction for a given mass and planet.
 *
 * In space (gravity 0) TWR is undefined (no weight to overcome); we return
 * `Infinity` for any direction with thrust and 0 for none, which the UI can
 * render as "n/a — no gravity".
 */
export function directionalTwr(
  design: ShipDesign,
  planet: PlanetPreset,
  mass: number,
): DirectionalThrust {
  const thrust = directionalThrust(design, planet.atmosphereDensity);
  const w = weight(mass, planet.surfaceGravity);
  const out: DirectionalThrust = {
    up: 0,
    down: 0,
    forward: 0,
    backward: 0,
    left: 0,
    right: 0,
  };
  for (const dir of DIRECTIONS) {
    out[dir] = w === 0 ? (thrust[dir] > 0 ? Infinity : 0) : thrust[dir] / w;
  }
  return out;
}

/** Result of the empty-vs-loaded lift analysis for one planet. */
export interface LiftAnalysis {
  readonly planetId: string;
  readonly gravity: number;
  readonly airDensity: number;
  /** Up-direction TWR with dry (empty) mass. */
  readonly emptyUpTwr: number;
  /** Up-direction TWR with fully-loaded mass. */
  readonly loadedUpTwr: number;
  readonly dryMass: number;
  readonly loadedMass: number;
  /** Can the empty ship lift off (up-TWR ≥ 1)? */
  readonly liftsEmpty: boolean;
  /** Can the fully-loaded ship lift off (up-TWR ≥ 1)? */
  readonly liftsLoaded: boolean;
  /** Full directional TWR at loaded mass, for the detail view. */
  readonly loadedDirectional: DirectionalThrust;
}

/**
 * The killer insight: compare empty vs loaded up-TWR on a planet and say
 * whether the ship can take off in each state.
 */
export function liftAnalysis(design: ShipDesign, planet: PlanetPreset): LiftAnalysis {
  const dry = dryMass(design);
  const loaded = loadedMass(design);
  const emptyTwr = directionalTwr(design, planet, dry);
  const loadedTwr = directionalTwr(design, planet, loaded);
  return {
    planetId: planet.id,
    gravity: planet.surfaceGravity,
    airDensity: planet.atmosphereDensity,
    emptyUpTwr: emptyTwr.up,
    loadedUpTwr: loadedTwr.up,
    dryMass: dry,
    loadedMass: loaded,
    liftsEmpty: emptyTwr.up >= 1,
    liftsLoaded: loadedTwr.up >= 1,
    loadedDirectional: loadedTwr,
  };
}
