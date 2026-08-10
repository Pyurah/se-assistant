/**
 * The full per-block build-cost dataset the engine costs designs against — the
 * generated cost set MERGED with the hand-curated `BLOCK_COMPONENT_COSTS`.
 *
 * Merge rule: **generated wins on any subtypeId conflict.** The generated recipes
 * are read straight from the target version's `CubeBlocks.sbc`, so for a
 * version-pinned tool they are the authoritative bill of materials — they even
 * fold duplicate/finishing components in automatically. The hand-curated
 * `BLOCK_COMPONENT_COSTS` is retained only as a **fallback**: it supplies the
 * handful of blocks whose game subtypeId the generator does not emit (e.g. the
 * hydrogen engines / oxygen generator, which use different SubtypeIds in the
 * archived data than the current `CubeBlocks.sbc`).
 *
 * This inverts the original "curated wins" design (ADR 0002): running the
 * generator against v1.210.012 revealed ~18 curated rows that lagged the current
 * game (rebalanced solar/battery/thruster costs, a stray `large-tube` on the
 * small welder/grinder, a missing `metal-grid` on the refinery). The game files
 * are the trustworthy source, so they take precedence; see `docs/data-audit.md`.
 *
 * `build-cost.ts` is the one consumer that points at this merged map — so an
 * imported ship's cost covers the entire vanilla catalogue at current-version
 * values, not just what we curated by hand.
 */

import { BLOCK_COMPONENT_COSTS, type BlockComponentCost } from './manufacturing';
import { GENERATED_BLOCK_COSTS } from './generated-block-costs';

const bySubtype = new Map<string, BlockComponentCost>();
// Curated first — supplies fallback rows for subtypeIds the generator lacks.
for (const [subtypeId, cost] of Object.entries(BLOCK_COMPONENT_COSTS)) {
  bySubtype.set(subtypeId, cost);
}
// Generated last — wins on conflict (authoritative current-version recipe).
for (const [subtypeId, cost] of Object.entries(GENERATED_BLOCK_COSTS)) {
  bySubtype.set(subtypeId, cost);
}

/** Every known block's build cost: generated (authoritative) + curated fallback. */
export const ALL_BLOCK_COSTS: Readonly<Record<string, BlockComponentCost>> =
  Object.fromEntries(bySubtype);
