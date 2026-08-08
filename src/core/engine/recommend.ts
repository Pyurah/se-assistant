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

import type { PlanetPreset, ThrusterBlock, ThrusterType } from '../../data/schema';
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

/**
 * A ranked suggestion for ONE thruster type meeting a direction's thrust need.
 *
 * The type is represented by the single variant (small/large model) that meets
 * the requirement with the least added mass — so the user compares types, not a
 * long list of every block, and picking one pins a concrete, sensible block.
 */
export interface ThrusterTypeSuggestion {
  readonly thrusterType: ThrusterType;
  /** The least-added-mass variant of this type to pin when chosen. */
  readonly blockId: string;
  /** That variant's display name. */
  readonly displayName: string;
  /** Effective thrust of ONE such thruster at this planet's air density, N. */
  readonly effectivePerThruster: number;
  /** Whole thrusters of this type needed to meet the thrust. Infinity if dead here. */
  readonly countNeeded: number;
  /** Total mass those thrusters add, kg. Infinity when infeasible. */
  readonly addedMass: number;
  /** False when no variant of this type produces usable thrust here. */
  readonly feasible: boolean;
  /** True for hydrogen (a fuel dependency, unlike electric thrusters). */
  readonly needsFuel: boolean;
  /** Short trade-off tag for the UI (atmosphere fit / fuel dependency). */
  readonly note: string;
}

/** Short trade-off note for a thruster type given the planet environment. */
function typeNote(thrusterType: ThrusterType, planet: PlanetPreset): string {
  switch (thrusterType) {
    case 'hydrogen':
      return 'works everywhere · needs fuel';
    case 'atmospheric':
      return planet.hasAtmosphere ? 'strong in air' : 'no thrust in vacuum';
    case 'ion':
      if (planet.atmosphereDensity >= 1) return 'weak in dense air';
      return planet.atmosphereDensity > 0 ? 'reduced in air' : 'full in vacuum';
  }
}

/**
 * Rank the available thruster *types* for meeting a single direction's thrust
 * requirement on a planet — the honest form of "which thruster should I use
 * here?": a ranked list, not a black-box auto-pick.
 *
 * Each type is reduced to the variant (small/large model) that meets `thrustNeeded`
 * with the least added mass; a type with no working variant here is still returned
 * (feasible: false) so the user sees *why* it's a poor fit. Ranked feasible-first,
 * then by fewest thrusters, then least added mass.
 *
 * @param candidates the thruster blocks to consider (typically one grid's set)
 * @param planet     the target planet/moon (gravity + air density)
 * @param thrustNeeded required thrust in this direction, N (0 in zero gravity)
 */
export function rankThrusterTypes(
  candidates: readonly ThrusterBlock[],
  planet: PlanetPreset,
  thrustNeeded: number,
): ThrusterTypeSuggestion[] {
  // Group candidate variants by thruster type.
  const byType = new Map<ThrusterType, ThrusterBlock[]>();
  for (const block of candidates) {
    const list = byType.get(block.thrusterType) ?? [];
    list.push(block);
    byType.set(block.thrusterType, list);
  }

  const suggestions: ThrusterTypeSuggestion[] = [];
  for (const [thrusterType, variants] of byType) {
    // For each variant: how many to meet the need, and the mass that adds.
    let best: {
      block: ThrusterBlock;
      eff: number;
      count: number;
      addedMass: number;
    } | null = null;

    for (const block of variants) {
      const eff = effectiveThrust(block, planet.atmosphereDensity);
      // A working variant needs 0 in zero-g; a dead variant is always infeasible.
      const count =
        eff > 0 ? (thrustNeeded > 0 ? Math.ceil(thrustNeeded / eff) : 0) : Infinity;
      const addedMass = count === Infinity ? Infinity : count * block.mass;

      if (best === null) {
        best = { block, eff, count, addedMass };
        continue;
      }
      // Prefer the least added mass; tie-break by fewer thrusters, then lighter block.
      const better =
        addedMass < best.addedMass ||
        (addedMass === best.addedMass && count < best.count) ||
        (addedMass === best.addedMass && count === best.count && block.mass < best.block.mass);
      if (better) best = { block, eff, count, addedMass };
    }

    if (best === null) continue; // no variants of this type (shouldn't happen)

    suggestions.push({
      thrusterType,
      blockId: best.block.id,
      displayName: best.block.displayName,
      effectivePerThruster: best.eff,
      countNeeded: best.count,
      addedMass: best.addedMass,
      feasible: best.eff > 0,
      needsFuel: thrusterType === 'hydrogen',
      note: typeNote(thrusterType, planet),
    });
  }

  // Rank: feasible first, then fewest thrusters, then least added mass.
  suggestions.sort((a, b) => {
    if (a.feasible !== b.feasible) return a.feasible ? -1 : 1;
    if (a.countNeeded !== b.countNeeded) return a.countNeeded - b.countNeeded;
    return a.addedMass - b.addedMass;
  });

  return suggestions;
}
