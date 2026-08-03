/**
 * Thruster recommender — "how many of thruster X to hover mass M on planet Y?"
 *
 * To hover (up-TWR ≥ 1) the ship needs upward thrust ≥ weight. A single
 * thruster of the given type provides `effectiveThrust(type, airDensity)` at
 * the planet's air density. The count needed is:
 *
 *   ceil( weight / effectivePerThruster )
 *
 * Atmospheric thrusters in vacuum and any thruster whose effective thrust is 0
 * cannot hover there — reported as `feasible: false` (Infinity count).
 */

import type { PlanetPreset, ThrusterBlock } from '../../data/schema';
import { effectiveThrust } from './thruster';
import { weight } from './twr';

export interface ThrusterRecommendation {
  readonly thrusterId: string;
  readonly planetId: string;
  /** Target mass to hover, kg. */
  readonly mass: number;
  /** Effective thrust of ONE such thruster at this planet's air density, N. */
  readonly effectivePerThruster: number;
  /** Whole thrusters needed to reach up-TWR ≥ 1. Infinity if impossible here. */
  readonly countNeeded: number;
  /** False when the thruster type produces no usable thrust on this planet. */
  readonly feasible: boolean;
}

/**
 * Recommend how many of a given thruster are needed to hover `mass` on a planet.
 *
 * @param thruster the candidate thruster block
 * @param planet   the target planet/moon (gravity + air density)
 * @param mass     the ship mass to lift, kg (usually loaded mass)
 */
export function recommendThrusters(
  thruster: ThrusterBlock,
  planet: PlanetPreset,
  mass: number,
): ThrusterRecommendation {
  const perThruster = effectiveThrust(thruster, planet.atmosphereDensity);
  const w = weight(mass, planet.surfaceGravity);

  // A thruster producing no usable thrust here (e.g. atmospheric in vacuum) is
  // infeasible regardless of gravity — checked before the no-gravity shortcut
  // so a useless thruster is never reported as "0 needed".
  if (perThruster <= 0) {
    return {
      thrusterId: thruster.id,
      planetId: planet.id,
      mass,
      effectivePerThruster: perThruster,
      countNeeded: Infinity,
      feasible: false,
    };
  }

  // In space (no gravity) a working thruster needs 0 units to "not fall".
  if (w === 0) {
    return {
      thrusterId: thruster.id,
      planetId: planet.id,
      mass,
      effectivePerThruster: perThruster,
      countNeeded: 0,
      feasible: true,
    };
  }

  return {
    thrusterId: thruster.id,
    planetId: planet.id,
    mass,
    effectivePerThruster: perThruster,
    countNeeded: Math.ceil(w / perThruster),
    feasible: true,
  };
}
