/**
 * Bridge: turn an imported {@link ShipDesign} into estimator seed inputs.
 *
 * The exact inverse of {@link estimateToDesign}. Analyze reads a finished ship
 * from a blueprint; this lets that ship *seed* an Estimate build so the user can
 * adjust its loadout (counts, cargo, planet) and watch the analysis recompute —
 * without ever mutating the source blueprint. It is the reverse direction of the
 * shared count-based representation the two modes already agree on.
 *
 * What carries over vs. what is re-sized
 * --------------------------------------
 * Per the product decision, **non-sized essentials** (drills, cargo, cockpit,
 * tools, …) carry over with their real counts, while the **sized categories**
 * (thrusters, power blocks, gyros — see {@link SIZED_CATEGORIES}) only seed the
 * estimator's *config choices* (which thruster model, which power block/kind).
 * The estimator then recomputes HOW MANY are needed. Geometry (positions) is not
 * represented — the seeded build is count-and-loadout, not a layout.
 *
 * Every block the blueprint parser *recognized* — whether hand-curated
 * (`source: 'vanilla'`) or generated from the game's own definition files
 * (`source: 'definition'`) — carries over as an essential and is factored into
 * the build's mass, even when the estimator can't re-size it. Only genuinely
 * unrecognized blocks (a `source: 'blueprint'` placeholder the parser synthesized
 * for an unknown/modded subtype, or a `user` block) can't round-trip through the
 * id-based estimator store, so those alone are reported in `skipped` — the UI
 * surfaces them as "not carried over."
 */

import type { ShipDesign } from '../types';
import type { CargoLoadout, ExtraMass } from '../types';
import type { BlockDefinition, GridSize, Direction } from '../../data/schema';
import { SIZED_CATEGORIES } from '../../data/block-categories';
import { BLOCKS_BY_ID } from '../../data/all-blocks';

/** Which kind of power block the estimator should size the count of. */
export type SeedPowerKind = 'battery' | 'producer';

/** A block that could not be represented in the seed, with why. */
export interface SkippedSeedBlock {
  readonly id: string;
  readonly name: string;
  readonly quantity: number;
  readonly reason: string;
}

/** One seeded thruster type + count for a single direction. */
export interface SeedThrusterEntry {
  readonly blockId: string;
  readonly count: number;
}

/** Per-direction seeded thruster stacks (empty array = none on that axis). */
export type SeedThrusterStacks = Record<Direction, readonly SeedThrusterEntry[]>;

/**
 * Serializable inputs for seeding the estimator from a design — mirrors the
 * estimator store's own input shape (ids + counts, no resolved definitions) so
 * the store can apply it in one atomic update.
 */
export interface EstimateSeed {
  readonly gridSize: GridSize;
  readonly planetId: string;
  readonly cargo: CargoLoadout;
  /**
   * Freeform extra mass carried straight through from the source design (always-on
   * `added` + loaded-only `payload`). Absent when the source had none, so a plain
   * blueprint seed stays identical to the pre-feature behavior.
   */
  readonly extraMass?: ExtraMass;
  /** Non-sized essentials, matched to the dataset, with their real counts. */
  readonly fixedBlocks: readonly { readonly id: string; readonly quantity: number }[];
  /**
   * The imported ship's real thruster layout — per direction, the matched
   * thruster types and their counts. Manual-estimator seed: the user starts from
   * the ship's actual thrusters (mixed types preserved) rather than a single
   * re-solved model. Unoriented thrusters are omitted (they can't be attributed
   * to a direction — mirrors {@link directionalThrust}).
   */
  readonly thrusterStacks: SeedThrusterStacks;
  /** Dominant matched power block id, or null → use the grid default battery. */
  readonly powerBlockId: string | null;
  /** Power kind implied by the dominant power block (battery vs producer). */
  readonly powerKind: SeedPowerKind;
  /** Blocks that couldn't be carried over (modded/unrecognized). */
  readonly skipped: readonly SkippedSeedBlock[];
}

/**
 * True when a block resolves to a recognized dataset entry the id-based store
 * can carry over — curated (`vanilla`) or generated-from-definitions
 * (`definition`). Placeholder (`blueprint`) and `user` blocks are not in the
 * shared dataset by id, so they can't round-trip and are reported as skipped.
 */
function isMatched(def: BlockDefinition): boolean {
  if (def.source === 'blueprint' || def.source === 'user') return false;
  return BLOCKS_BY_ID[def.id] !== undefined;
}

/** The power kind a matched power block implies. */
function powerKindOf(def: BlockDefinition): SeedPowerKind {
  return def.category === 'battery' ? 'battery' : 'producer';
}

/**
 * Pick the "dominant" power definition from a tally by a caller-supplied score
 * (higher wins), breaking ties by id for determinism. Used only for the power
 * block now — thrusters carry over as their full per-direction layout rather
 * than collapsing to one dominant model.
 */
function pickDominant(
  tally: ReadonlyMap<string, { def: BlockDefinition; quantity: number }>,
  score: (def: BlockDefinition, quantity: number) => number,
): BlockDefinition | null {
  let best: { def: BlockDefinition; quantity: number } | null = null;
  let bestScore = -Infinity;
  for (const entry of tally.values()) {
    const s = score(entry.def, entry.quantity);
    const better = best === null || s > bestScore || (s === bestScore && entry.def.id < best.def.id);
    if (better) {
      best = entry;
      bestScore = s;
    }
  }
  return best?.def ?? null;
}

/** An empty per-direction thruster-stacks map. */
function emptyStacks(): Record<Direction, SeedThrusterEntry[]> {
  return {
    up: [],
    down: [],
    forward: [],
    backward: [],
    left: [],
    right: [],
  };
}

/**
 * Derive estimator seed inputs from an imported (or synthesized) design.
 *
 * @param design the source ship — its blocks, grid, planet and cargo.
 */
export function designToEstimateSeed(design: ShipDesign): EstimateSeed {
  const fixedBlocks: { id: string; quantity: number }[] = [];
  const skipped: SkippedSeedBlock[] = [];

  // The ship's real thruster layout, grouped by direction then by type. Only
  // oriented thrusters (a resolved `thrustDirection`) carry over — an unoriented
  // thruster can't be attributed to an axis, matching `directionalThrust`.
  const stacks = emptyStacks();
  const powerTally = new Map<string, { def: BlockDefinition; quantity: number }>();

  for (const block of design.blocks) {
    const def = block.definition;
    const qty = block.quantity;

    if (!isMatched(def)) {
      skipped.push({
        id: def.id,
        name: def.displayName,
        quantity: qty,
        reason: def.source === 'blueprint' ? 'modded / unrecognized' : 'not in dataset',
      });
      continue;
    }

    if (!SIZED_CATEGORIES.has(def.category)) {
      // Non-sized essential — carries over with its real count. Merge duplicates
      // (a design can list the same block id under multiple thrust directions,
      // though non-thrusters normally appear once).
      const existing = fixedBlocks.find((b) => b.id === def.id);
      if (existing) existing.quantity += qty;
      else fixedBlocks.push({ id: def.id, quantity: qty });
      continue;
    }

    if (def.category === 'thruster') {
      // Manual seed: preserve the ship's real per-direction layout (mixed types
      // and all). Unoriented thrusters have no direction to attribute to.
      const dir = block.thrustDirection;
      if (dir === undefined) continue;
      const stack = stacks[dir];
      const entry = stack.find((e) => e.blockId === def.id);
      if (entry) {
        stack[stack.indexOf(entry)] = { blockId: def.id, count: entry.count + qty };
      } else {
        stack.push({ blockId: def.id, count: qty });
      }
    } else if (def.category !== 'gyroscope') {
      // Power block (battery / reactor / solar / hydrogen-engine / wind-turbine).
      // Gyros are sized from mass + the target turn time — no model to seed.
      const entry = powerTally.get(def.id);
      if (entry) entry.quantity += qty;
      else powerTally.set(def.id, { def, quantity: qty });
    }
  }

  // Power: dominant = the more-numerous kind (the primary source).
  const dominantPower = pickDominant(powerTally, (_def, qty) => qty);

  return {
    gridSize: design.gridSize,
    planetId: design.planetId,
    cargo: design.cargo,
    ...(design.extraMass ? { extraMass: design.extraMass } : {}),
    fixedBlocks,
    thrusterStacks: stacks,
    powerBlockId: dominantPower?.id ?? null,
    powerKind: dominantPower ? powerKindOf(dominantPower) : 'battery',
    skipped,
  };
}
