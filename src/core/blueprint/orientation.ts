/**
 * Resolve a Space Engineers block orientation to the grid-local direction a
 * thruster pushes the grid.
 *
 * Blueprint orientation
 * ---------------------
 * Each block stores `<BlockOrientation Forward="…" Up="…" />` where `Forward`
 * and `Up` are base-6 axis enum names. For a thruster, `Forward` is the
 * direction the flame/exhaust points. By Newton's third law the grid is pushed
 * in the OPPOSITE direction: a thruster whose exhaust points `Down` lifts the
 * ship `Up`. So the thrust direction is the opposite of `Forward`.
 *
 * The six enum values SE uses are the {@link Direction} names capitalized.
 * We accept any casing and trim, then map to our lowercase {@link Direction}.
 */

import type { Direction } from '../../data/schema';

/** The six SE orientation axis names, normalized to lowercase Direction. */
const AXIS_TO_DIRECTION: Readonly<Record<string, Direction>> = {
  forward: 'forward',
  backward: 'backward',
  left: 'left',
  right: 'right',
  up: 'up',
  down: 'down',
};

/** Opposite of each direction — thrust pushes opposite to exhaust. */
const OPPOSITE: Readonly<Record<Direction, Direction>> = {
  forward: 'backward',
  backward: 'forward',
  left: 'right',
  right: 'left',
  up: 'down',
  down: 'up',
};

/** Parse an SE axis enum name to a {@link Direction}, or undefined if unknown. */
export function parseAxis(raw: string | undefined): Direction | undefined {
  if (raw === undefined) return undefined;
  return AXIS_TO_DIRECTION[raw.trim().toLowerCase()];
}

/**
 * Given a thruster's `BlockOrientation.Forward` (the exhaust direction),
 * return the grid-local direction the thruster actually pushes the ship.
 *
 * Returns `undefined` when the forward axis can't be parsed, so callers can
 * decide how to treat an unorientable thruster (we default such thrust to be
 * excluded from directional TWR rather than mis-attributed).
 */
export function thrustDirectionFromForward(forward: string | undefined): Direction | undefined {
  const dir = parseAxis(forward);
  return dir === undefined ? undefined : OPPOSITE[dir];
}
