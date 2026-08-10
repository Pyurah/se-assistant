/**
 * Goal evaluation — did a direction's thrust hit the user's target?
 *
 * In the manual estimator the user sets a per-direction goal and assigns
 * thrusters until they reach it. This turns a (goal, thrust, mass, gravity)
 * tuple into a {@link GoalVerdict}: the achieved metric, the goal expressed as
 * an acceleration, and a reached/exceeded/short status.
 *
 * The goal number means different things by environment, matching the estimator
 * convention already in `estimate.ts`:
 *
 *   - On a planet (gravity > 0) the goal is a **TWR** target. Achieved metric is
 *     `thrust / (mass · gravity)`; the equivalent acceleration is `goal · gravity`
 *     (a TWR of 2 accelerates at 2 g *net of* the 1 g it spends hovering — but the
 *     goal-accel here is the raw `goal · gravity`, the thrust-equivalent readout).
 *   - In space (gravity = 0) TWR is undefined, so the goal is read as a
 *     **g-multiple of acceleration**: goal 2 → accelerate at 2 g (19.62 m/s²).
 *     Achieved metric is `(thrust / mass) / STANDARD_GRAVITY`, directly comparable
 *     to the goal; the equivalent acceleration is `goal · STANDARD_GRAVITY`.
 *
 * Pure `@core` — no DOM/React — so it stays inside the enforced purity boundary.
 */

import { STANDARD_GRAVITY } from '../../data/planets';

/** Whether the achieved metric reaches / clears / falls short of the goal. */
export type GoalStatus = 'reached' | 'exceeded' | 'short';

/** The outcome of comparing achieved thrust against a per-direction goal. */
export interface GoalVerdict {
  /** True when evaluated in space (gravity 0) → goal is a g-multiple of accel. */
  readonly isSpace: boolean;
  /**
   * The achieved goal metric, directly comparable to `goal`: TWR on a planet,
   * or acceleration-in-g in space. 0 when there is no thrust.
   */
  readonly metric: number;
  /** Achieved raw acceleration, m/s² (`thrust / mass`). */
  readonly accel: number;
  /** The goal expressed as an acceleration, m/s² (for display alongside `accel`). */
  readonly goalAccel: number;
  /** Verdict: at/above/below the goal (within `epsilon`). */
  readonly status: GoalStatus;
}

/** Inputs for a single direction's goal check. */
export interface GoalCheck {
  /** The user's target: TWR on a planet, g-multiple of acceleration in space. */
  readonly goal: number;
  /** Achieved thrust in this direction (N), already environment-adjusted. */
  readonly thrust: number;
  /** Mass the thrust acts on (kg) — the empty or loaded mass per the UI toggle. */
  readonly mass: number;
  /** Surface gravity (m/s²); 0 means space. */
  readonly gravity: number;
  /** Tolerance for the reached/exceeded boundary (default 1e-6). */
  readonly epsilon?: number;
}

/**
 * Evaluate a direction's achieved thrust against its goal.
 *
 * A non-positive `goal` is always `reached` (no target to miss). A non-positive
 * `mass` yields a 0 metric (nothing coherent to divide by) and is `short` unless
 * the goal itself is non-positive.
 */
export function evaluateGoal({ goal, thrust, mass, gravity, epsilon = 1e-6 }: GoalCheck): GoalVerdict {
  const isSpace = gravity <= 0;
  const accel = mass > 0 ? thrust / mass : 0;
  const metric = isSpace ? accel / STANDARD_GRAVITY : mass > 0 ? thrust / (mass * gravity) : 0;
  const goalAccel = isSpace ? goal * STANDARD_GRAVITY : goal * gravity;

  let status: GoalStatus;
  if (goal <= 0) {
    status = 'reached';
  } else if (metric >= goal + epsilon) {
    status = 'exceeded';
  } else if (metric >= goal - epsilon) {
    status = 'reached';
  } else {
    status = 'short';
  }

  return { isSpace, metric, accel, goalAccel, status };
}
