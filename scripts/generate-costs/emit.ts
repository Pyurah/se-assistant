/**
 * Pure emitter: turn parsed per-block component costs into the text of the
 * committed `src/data/generated-block-costs.ts` module.
 *
 * Deterministic (stable sort by block subtypeId, no timestamps, no
 * `Date`/`Math.random`) so re-running the generator produces byte-identical
 * output when the game files haven't changed — that's what makes `--check` a
 * meaningful CI drift guard.
 *
 * exactOptionalPropertyTypes-safe: each cost record is serialized with
 * `JSON.stringify`, which omits `undefined`-valued keys entirely rather than
 * emitting `key: undefined` (which the compiler rejects against `?` fields).
 * `emit.test.ts` asserts the literal token `undefined` never appears.
 */

import type { BlockComponentCost, ComponentId } from '../../src/data/manufacturing';

/** One block's generated cost: its game SubtypeId + component→count map. */
export interface GeneratedCost {
  readonly subtypeId: string;
  readonly cost: BlockComponentCost;
}

/** Deterministic sort key: block subtypeId (unique across the generated set). */
function bySubtypeId(a: GeneratedCost, b: GeneratedCost): number {
  return a.subtypeId < b.subtypeId ? -1 : a.subtypeId > b.subtypeId ? 1 : 0;
}

/**
 * Serialize one block's cost as `"SubtypeId": { component: count, … }`. Keys
 * within the cost are sorted for stable, readable, diff-friendly output.
 */
function serializeCost(entry: GeneratedCost): string {
  const ordered: Record<string, number> = {};
  const keys = (Object.keys(entry.cost) as ComponentId[]).sort();
  for (const key of keys) {
    const count = entry.cost[key];
    if (count !== undefined) ordered[key] = count;
  }
  return `${JSON.stringify(entry.subtypeId)}: ${JSON.stringify(ordered)}`;
}

/** Build the DO-NOT-EDIT banner naming the source, build, and regen command. */
function banner(gameBuild: string, count: number): string {
  return `/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Per-block build costs (bill of materials) extracted from the game's own
 * \`Content/Data/CubeBlocks/*.sbc\` \`<Components>\` lists, cross-referenced to the
 * component vocabulary in \`manufacturing.ts\` (game build ${gameBuild}).
 * ${count} blocks whose every component maps to a known \`ComponentId\`.
 *
 * Regenerate with:  pnpm generate:costs [--game-dir <path>]
 *
 * These entries only FILL GAPS: the hand-curated \`BLOCK_COMPONENT_COSTS\` in
 * \`manufacturing.ts\` wins on any subtypeId conflict (see \`all-block-costs.ts\`).
 * A block is emitted ONLY when every one of its components maps to a modelled
 * component — a block with any unmapped component is skipped and stays "cost
 * unknown" rather than being costed with a partial, misleading recipe. See
 * \`docs/data-audit.md\`.
 */`;
}

/**
 * Emit the full text of `src/data/generated-block-costs.ts`.
 *
 * @param costs     the parsed per-block costs (any order — sorted here)
 * @param gameBuild game build string for the banner
 */
export function emitCostModule(costs: readonly GeneratedCost[], gameBuild: string): string {
  const sorted = [...costs].sort(bySubtypeId);
  const entries = sorted.map((c) => `  ${serializeCost(c)},`).join('\n');
  return `${banner(gameBuild, sorted.length)}

import type { BlockComponentCost } from './manufacturing';

export const GENERATED_BLOCK_COSTS: Readonly<Record<string, BlockComponentCost>> = {
${entries}
};
`;
}
