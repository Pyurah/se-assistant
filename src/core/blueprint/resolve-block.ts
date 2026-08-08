/**
 * Resolve a blueprint block's identity to a dataset {@link BlockDefinition}.
 *
 * Blueprints reference blocks by `SubtypeName` (the game's SubtypeId, e.g.
 * `LargeBlockLargeThrust`). Some base blocks ship with an EMPTY `<SubtypeName/>`
 * and are identified only by their `xsi:type` (e.g. `MyObjectBuilder_Reactor`).
 * Modded blocks carry subtypes we have no vanilla record of.
 *
 * The resolver maps known subtypes to the merged dataset (curated vanilla +
 * generated definitions) and, for anything unknown, synthesizes a minimal
 * `source: 'blueprint'` definition so the design still parses (the block
 * contributes mass 0 / no thrust until the user fills in stats — surfacing the
 * gap rather than silently dropping it).
 */

import { BLOCKS_BY_SUBTYPE } from '../../data/all-blocks';
import type { BlockDefinition, GridSize } from '../../data/schema';

/** Outcome of resolving one blueprint block reference. */
export interface ResolvedBlock {
  readonly definition: BlockDefinition;
  /** True when the subtype was found in the merged dataset. */
  readonly matched: boolean;
}

/** Strip any XML namespace prefix and the `MyObjectBuilder_` noise for display. */
function prettifyType(xsiType: string): string {
  return xsiType.replace(/^(?:[a-zA-Z0-9]+:)?MyObjectBuilder_/, '');
}

/**
 * Resolve a blueprint block reference to a definition.
 *
 * @param subtypeName the `<SubtypeName>` text (may be empty string)
 * @param xsiType     the `xsi:type` attribute (e.g. `MyObjectBuilder_Thrust`)
 * @param gridSize    the owning grid's size, used for the fallback definition
 */
export function resolveBlock(
  subtypeName: string,
  xsiType: string,
  gridSize: GridSize,
): ResolvedBlock {
  const subtype = subtypeName.trim();
  if (subtype.length > 0) {
    const known = BLOCKS_BY_SUBTYPE[subtype];
    if (known) return { definition: known, matched: true };
  }

  // Unknown or empty subtype: synthesize a placeholder so nothing is dropped.
  // We categorize it as 'other' rather than guessing a stat-bearing category
  // (a fabricated 0-thrust "thruster" would corrupt TWR math). The block still
  // contributes its own mass once the user fills stats in; until then it's a
  // visible gap, not a silent drop.
  const label = subtype.length > 0 ? subtype : prettifyType(xsiType);
  const fallback: BlockDefinition = {
    id: `blueprint:${xsiType}:${subtype || 'unknown'}`,
    subtypeId: subtype,
    displayName: `${label} (unrecognized)`,
    category: 'other',
    gridSize,
    dlc: 'base',
    mass: 0,
    source: 'blueprint',
  };
  return { definition: fallback, matched: false };
}
