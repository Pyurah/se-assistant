/**
 * Pure mapping logic for the build-cost generator: turn a block's raw
 * `<Components>` counts (keyed by the game's component SubtypeId) into our
 * {@link BlockComponentCost} (keyed by {@link ComponentId}).
 *
 * No `fs`, no globals — unit-tested from small in-memory inputs. The
 * disk-touching orchestration lives in `index.ts`.
 */

import {
  COMPONENT_RECIPES,
  type BlockComponentCost,
  type ComponentId,
} from '../../src/data/manufacturing';

/**
 * Invert `COMPONENT_RECIPES` into game-SubtypeId → {@link ComponentId}. Every
 * component we model carries its game `subtypeId`, so this is the single source
 * of truth for "which components can a generated cost reference".
 */
export function buildReverseMap(): ReadonlyMap<string, ComponentId> {
  const map = new Map<string, ComponentId>();
  for (const recipe of Object.values(COMPONENT_RECIPES)) {
    map.set(recipe.subtypeId, recipe.id);
  }
  return map;
}

/** Outcome of mapping one block's component counts. */
export type MapResult =
  | { readonly ok: true; readonly cost: BlockComponentCost }
  | { readonly ok: false; readonly unmapped: readonly string[] };

/**
 * Map one block's raw component counts to a {@link BlockComponentCost}.
 *
 * Honesty rule (project principle): the block is costed ONLY if EVERY component
 * maps to a modelled {@link ComponentId}. If any component is unmapped the
 * result is `ok: false` with the offending SubtypeIds, so the caller skips the
 * block (leaving it "cost unknown") rather than emitting a partial recipe that
 * would understate the true cost.
 *
 * Empty inputs (a block with no `<Components>`) map to `ok: false` — there is
 * nothing to cost, and we never want a `{}` entry masquerading as "free".
 */
export function mapComponentCounts(
  counts: ReadonlyMap<string, number>,
  reverse: ReadonlyMap<string, ComponentId>,
): MapResult {
  if (counts.size === 0) return { ok: false, unmapped: [] };

  const cost: Partial<Record<ComponentId, number>> = {};
  const unmapped: string[] = [];

  for (const [subtype, count] of counts) {
    const id = reverse.get(subtype);
    if (id === undefined) {
      unmapped.push(subtype);
      continue;
    }
    cost[id] = (cost[id] ?? 0) + count;
  }

  if (unmapped.length > 0) return { ok: false, unmapped };
  return { ok: true, cost };
}
