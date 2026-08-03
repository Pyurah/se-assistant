/**
 * Thruster effectiveness as a function of atmospheric air density.
 *
 * Space Engineers scales a thruster's usable thrust by an "effectiveness"
 * multiplier derived from the local air density (a.k.a. planetary influence,
 * 0..1). The block definition carries the envelope:
 *
 *   minPlanetaryInfluence, maxPlanetaryInfluence   — the density band
 *   effectivenessAtMinInfluence, ...AtMaxInfluence — effectiveness at each end
 *
 * The game clamps density into `[min, max]`, computes the normalized position
 * `t`, and linearly interpolates effectiveness between the two endpoints:
 *
 *   t = clamp((density - min) / (max - min), 0, 1)
 *   effectiveness = lerp(effAtMin, effAtMax, t)
 *
 * Result by type (with the vanilla envelopes):
 *   ion         (0→1, 1.0→0.3): full in vacuum, 30% at sea level
 *   atmospheric (0.3→1, 0→1.0): dead in vacuum, full in dense air
 *   hydrogen    (no envelope):  flat 1.0 everywhere
 */

import type { ThrusterBlock } from '../../data/schema';

/** Linear interpolation. */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Clamp `v` into `[lo, hi]`. */
function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Effectiveness multiplier (0..1+) for a thruster at a given air density.
 *
 * @param thruster the thruster block definition
 * @param airDensity sea-level-relative air density at the thruster, 0..~1.2
 * @returns thrust multiplier to apply to `maxThrust`
 */
export function thrusterEffectiveness(thruster: ThrusterBlock, airDensity: number): number {
  const {
    minPlanetaryInfluence,
    maxPlanetaryInfluence,
    effectivenessAtMinInfluence,
    effectivenessAtMaxInfluence,
  } = thruster;

  // Hydrogen (and any thruster without a full envelope) is flat 100%.
  if (
    minPlanetaryInfluence === undefined ||
    maxPlanetaryInfluence === undefined ||
    effectivenessAtMinInfluence === undefined ||
    effectivenessAtMaxInfluence === undefined
  ) {
    return 1;
  }

  const span = maxPlanetaryInfluence - minPlanetaryInfluence;
  // Degenerate envelope (min === max): pick the endpoint by which side density is on.
  if (span <= 0) {
    return airDensity >= maxPlanetaryInfluence
      ? effectivenessAtMaxInfluence
      : effectivenessAtMinInfluence;
  }

  const t = clamp((airDensity - minPlanetaryInfluence) / span, 0, 1);
  return lerp(effectivenessAtMinInfluence, effectivenessAtMaxInfluence, t);
}

/**
 * Effective (usable) max thrust of a single thruster at a given air density, N.
 */
export function effectiveThrust(thruster: ThrusterBlock, airDensity: number): number {
  return thruster.maxThrust * thrusterEffectiveness(thruster, airDensity);
}
