/**
 * Pure emitter: turn parsed {@link BlockDefinition}s into the text of the
 * committed `src/data/generated-blocks.ts` module.
 *
 * Deterministic (stable sort, no timestamps, no `Date`/`Math.random`) so
 * re-running the generator produces byte-identical output when the game files
 * haven't changed — that's what makes `--check` a meaningful CI drift guard.
 *
 * exactOptionalPropertyTypes-safe: every value is serialized with
 * `JSON.stringify`, which omits `undefined`-valued keys entirely rather than
 * emitting `key: undefined` (which the compiler rejects against `?` fields).
 * `emit.test.ts` asserts the literal token `undefined` never appears.
 */

import type { BlockDefinition } from '../../src/data/schema';

/** Deterministic sort key: subtypeId (unique across the generated set). */
function bySubtypeId(a: BlockDefinition, b: BlockDefinition): number {
  return a.subtypeId < b.subtypeId ? -1 : a.subtypeId > b.subtypeId ? 1 : 0;
}

/**
 * Serialize one block as a TS object literal. Uses `JSON.stringify` with an
 * ordered replacer so keys land in a stable, readable order and no
 * `undefined`-valued key is emitted. Prettier reformats the final file.
 */
function serializeBlock(block: BlockDefinition): string {
  // Stable key order: identity first, then classification, then stats.
  const KEY_ORDER = [
    'id',
    'subtypeId',
    'displayName',
    'category',
    'thrusterType',
    'gridSize',
    'dlc',
    'mass',
    'cellCount',
    'maxThrust',
    'maxPowerDraw',
    'minPlanetaryInfluence',
    'maxPlanetaryInfluence',
    'effectivenessAtMinInfluence',
    'effectivenessAtMaxInfluence',
    'maxPowerOutput',
    'maxPowerInput',
    'energyCapacity',
    'maxTorque',
    'powerDraw',
    'source',
  ];
  const record = block as unknown as Record<string, unknown>;
  const ordered: Record<string, unknown> = {};
  for (const key of KEY_ORDER) {
    if (key in record && record[key] !== undefined) ordered[key] = record[key];
  }
  return JSON.stringify(ordered);
}

/** Build the DO-NOT-EDIT banner naming the source, build, and regen command. */
function banner(gameBuild: string, blockCount: number): string {
  return `/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Space Engineers block definitions extracted from the game's own
 * \`Content/Data/CubeBlocks/*.sbc\` + \`Components.sbc\` + localization files
 * (game build ${gameBuild}). ${blockCount} blocks, every entry
 * \`source: 'definition'\`.
 *
 * Regenerate with:  pnpm generate:blocks [--game-dir <path>]
 *
 * These entries only FILL GAPS: curated \`source: 'vanilla'\` blocks in
 * \`blocks.ts\` / \`functional-blocks.ts\` win on any subtypeId conflict (see
 * \`all-blocks.ts\`). Mass is derived from each block's \`<Components>\` list;
 * physics stats (thrust, power, torque, capacity) are read directly from the
 * definition. Definition-absent fields — cargo inventory volume, hydrogen L/s
 * burn rates, drill/tool operating wattage — are intentionally omitted here and
 * remain curated-only. See \`docs/data-audit.md\`.
 */`;
}

/**
 * Emit the full text of `src/data/generated-blocks.ts`.
 *
 * @param blocks    the parsed definition blocks (any order — sorted here)
 * @param gameBuild game build string for the banner
 */
export function emitModule(blocks: readonly BlockDefinition[], gameBuild: string): string {
  const sorted = [...blocks].sort(bySubtypeId);
  const entries = sorted.map((b) => `  ${serializeBlock(b)},`).join('\n');
  return `${banner(gameBuild, sorted.length)}

import type { BlockDefinition } from './schema';

export const GENERATED_BLOCKS: readonly BlockDefinition[] = [
${entries}
];
`;
}
