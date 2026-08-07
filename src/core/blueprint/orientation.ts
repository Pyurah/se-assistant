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

// --- Pilot-frame (cockpit-relative) direction transform ---------------------
//
// In-game, "forward / up / left" are defined by the MAIN COCKPIT's facing, not
// the raw grid axes a blueprint stores. Two identical ships built at different
// grid rotations would otherwise report thrust on different axes. To match what
// the pilot sees on the HUD, we rotate each thruster's grid-frame thrust
// direction into the frame whose forward = cockpit.Forward and up = cockpit.Up.

/** A grid-axis unit vector. SE grid is left-handed: Right = Forward × Up. */
type Vec3 = readonly [number, number, number];

const DIRECTION_TO_VEC: Readonly<Record<Direction, Vec3>> = {
  forward: [0, 0, -1],
  backward: [0, 0, 1],
  right: [1, 0, 0],
  left: [-1, 0, 0],
  up: [0, 1, 0],
  down: [0, -1, 0],
};

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

/** Maps a grid-frame {@link Direction} to the equivalent pilot-frame direction. */
export type GridToPilot = (grid: Direction) => Direction;

/**
 * Build the transform that rotates grid-frame directions into the pilot frame
 * defined by a cockpit's `Forward`/`Up` axes.
 *
 * The pilot basis is {forward = cockpit.Forward, up = cockpit.Up,
 * right = forward × up} (SE's left-handed convention). A grid direction's
 * pilot-frame label is found by projecting its unit vector onto that basis.
 *
 * Returns `undefined` when the axes are missing, unparseable, or not
 * perpendicular (a malformed orientation) — callers then fall back to reporting
 * in raw grid axes rather than emit a garbage rotation.
 */
export function buildGridToPilot(
  cockpitForward: string | undefined,
  cockpitUp: string | undefined,
): GridToPilot | undefined {
  const fwd = parseAxis(cockpitForward);
  const up = parseAxis(cockpitUp);
  if (fwd === undefined || up === undefined) return undefined;

  const f = DIRECTION_TO_VEC[fwd];
  const u = DIRECTION_TO_VEC[up];
  // Forward and Up must be perpendicular for a valid orientation basis.
  if (dot(f, u) !== 0) return undefined;
  const r = cross(f, u);

  return (grid: Direction): Direction => {
    const v = DIRECTION_TO_VEC[grid];
    const fp = dot(v, f);
    if (fp === 1) return 'forward';
    if (fp === -1) return 'backward';
    const upp = dot(v, u);
    if (upp === 1) return 'up';
    if (upp === -1) return 'down';
    return dot(v, r) === 1 ? 'right' : 'left';
  };
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
