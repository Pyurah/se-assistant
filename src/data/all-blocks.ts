/**
 * The full block dataset the app resolves blueprints against — the curated
 * vanilla blocks MERGED with the generated definition set.
 *
 * Merge rule (locked decision): generated `source: 'definition'` blocks fill
 * gaps, but curated `source: 'vanilla'` blocks WIN on any subtypeId conflict.
 * This is implemented by inserting generated blocks first, then overwriting with
 * curated ones — so every hand-verified, wiki-cross-referenced stat (cargo
 * inventory volume, hydrogen L/s burn, drill wattage, …) is preserved, while the
 * ~1,400 blocks we never hand-authored gain mass-correct coverage.
 *
 * `VANILLA_BLOCKS` / `VANILLA_BLOCKS_BY_*` keep their curated-only meaning (the
 * estimator and its tests size ships from trusted stats only). Blueprint
 * resolution (`src/core/blueprint/resolve-block.ts`) is the one consumer that
 * points at the merged set — so an imported ship matches the entire game
 * catalogue, not just what we curated by hand.
 */

import { VANILLA_BLOCKS } from './blocks';
import { GENERATED_BLOCKS } from './generated-blocks';
import type { BlockDefinition } from './schema';

const bySubtype = new Map<string, BlockDefinition>();
// Generated first — fills gaps.
for (const block of GENERATED_BLOCKS) bySubtype.set(block.subtypeId, block);
// Curated last — wins on conflict (no per-field merge; curated entry replaces).
for (const block of VANILLA_BLOCKS) bySubtype.set(block.subtypeId, block);

/** Every known block: curated (trusted) + generated (mass/physics from defs). */
export const ALL_BLOCKS: readonly BlockDefinition[] = [...bySubtype.values()];

/** Lookup by the game's SubtypeId — the map blueprint resolution uses. */
export const BLOCKS_BY_SUBTYPE: Readonly<Record<string, BlockDefinition>> =
  Object.fromEntries(ALL_BLOCKS.map((b) => [b.subtypeId, b]));

/** Lookup by our stable machine id. */
export const BLOCKS_BY_ID: Readonly<Record<string, BlockDefinition>> = Object.fromEntries(
  ALL_BLOCKS.map((b) => [b.id, b]),
);
