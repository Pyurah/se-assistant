/**
 * CLI entry point for the build-cost generator.
 *
 * Reads the game's installed `CubeBlocks/*.sbc` files, extracts each block's
 * `<Components>` bill of materials, maps every component to our modelled
 * {@link ComponentId} vocabulary, and writes `src/data/generated-block-costs.ts`.
 *
 *   pnpm generate:costs                    # default Steam install path
 *   pnpm generate:costs --game-dir <path>  # custom install location
 *   pnpm generate:costs --check            # diff against committed file (CI)
 *
 * `--check` re-generates in memory and compares to the committed file, exiting
 * non-zero on drift — a guard for environments where the game IS available. CI
 * without the game simply doesn't run it (the committed file + unit tests over
 * fixtures cover correctness there).
 *
 * A block is emitted ONLY when every one of its components maps to a modelled
 * component (honesty rule); blocks with any unmapped component are skipped and
 * reported, so they stay "cost unknown" rather than gaining a partial recipe.
 *
 * This file is allowed to use `fs` and `console` (see the `scripts/**` ESLint
 * override) — it lives OUTSIDE the `src/` purity boundary by design.
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import * as prettier from 'prettier';
import {
  COMPONENTS_FILE,
  CONTENT_DATA_SUBDIR,
  CUBEBLOCKS_SUBDIR,
  DEFAULT_GAME_DIR,
  GAME_BUILD,
} from '../generate-blocks/config';
import {
  componentCountsFromComponents,
  isPublic,
  parseCubeBlocksFile,
} from '../generate-blocks/parse';
import { buildReverseMap, mapComponentCounts } from './map';
import { emitCostModule, type GeneratedCost } from './emit';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..', '..');
const OUTPUT_PATH = join(repoRoot, 'src', 'data', 'generated-block-costs.ts');

interface CliArgs {
  gameDir: string;
  check: boolean;
}

function parseArgs(argv: readonly string[]): CliArgs {
  let gameDir = DEFAULT_GAME_DIR;
  let check = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--check') check = true;
    else if (arg === '--game-dir') {
      const next = argv[i + 1];
      if (!next) throw new Error('--game-dir requires a path argument');
      gameDir = next;
      i++;
    } else if (arg?.startsWith('--game-dir=')) {
      gameDir = arg.slice('--game-dir='.length);
    }
  }
  return { gameDir, check };
}

/** A block that could not be fully costed, with the components that blocked it. */
interface SkippedBlock {
  readonly subtypeId: string;
  readonly unmapped: readonly string[];
}

/** Read all `CubeBlocks/*.sbc`, map each public block's components to costs. */
async function generate(gameDir: string): Promise<{
  source: string;
  costs: GeneratedCost[];
  skipped: SkippedBlock[];
  emptyCount: number;
}> {
  const dataDir = join(gameDir, CONTENT_DATA_SUBDIR);
  const cubeBlocksDir = join(dataDir, CUBEBLOCKS_SUBDIR);
  // Touch Components.sbc so a missing/moved data dir fails here with a clear
  // message (same failure surface as the block generator), even though costs
  // are derived from counts, not component masses.
  readFileSync(join(dataDir, COMPONENTS_FILE), 'utf8');

  const reverse = buildReverseMap();

  const sbcFiles = readdirSync(cubeBlocksDir)
    .filter((f) => f.toLowerCase().endsWith('.sbc'))
    .sort();

  const bySubtype = new Map<string, GeneratedCost>();
  const skipped: SkippedBlock[] = [];
  let emptyCount = 0;

  for (const file of sbcFiles) {
    const defs = parseCubeBlocksFile(readFileSync(join(cubeBlocksDir, file), 'utf8'));
    for (const def of defs) {
      const subtypeId = def.Id?.SubtypeId?.trim();
      if (!subtypeId || !isPublic(def)) continue;
      // First definition of a subtype wins (mirrors the block generator).
      if (bySubtype.has(subtypeId)) continue;

      const counts = componentCountsFromComponents(def);
      const result = mapComponentCounts(counts, reverse);
      if (result.ok) {
        bySubtype.set(subtypeId, { subtypeId, cost: result.cost });
      } else if (result.unmapped.length === 0) {
        emptyCount += 1; // no components at all — nothing to cost
      } else {
        skipped.push({ subtypeId, unmapped: result.unmapped });
      }
    }
  }

  const costs = [...bySubtype.values()];
  const raw = emitCostModule(costs, GAME_BUILD);
  const options = await prettier.resolveConfig(OUTPUT_PATH);
  const source = await prettier.format(raw, { ...options, parser: 'typescript' });
  return { source, costs, skipped, emptyCount };
}

function summarize(
  costs: readonly GeneratedCost[],
  skipped: readonly SkippedBlock[],
  emptyCount: number,
): void {
  console.log(`\nGenerated costs for ${costs.length} blocks.`);
  console.log(
    `Skipped: ${skipped.length} with unmapped components, ${emptyCount} with no components.`,
  );

  // Tally the distinct unmapped components so a coverage gap is one glance away.
  const unmappedTally = new Map<string, number>();
  for (const s of skipped) {
    for (const c of s.unmapped) unmappedTally.set(c, (unmappedTally.get(c) ?? 0) + 1);
  }
  if (unmappedTally.size > 0) {
    console.log('\nUnmapped components (add to COMPONENT_RECIPES to cost these blocks):');
    for (const [comp, n] of [...unmappedTally.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${comp.padEnd(28)} blocks: ${n}`);
    }
  }
}

async function main(): Promise<void> {
  const { gameDir, check } = parseArgs(process.argv.slice(2));

  let result: Awaited<ReturnType<typeof generate>>;
  try {
    result = await generate(gameDir);
  } catch (err) {
    console.error(
      `\nFailed to read game data from "${gameDir}".\n` +
        `Pass --game-dir <path> if Space Engineers is installed elsewhere.\n` +
        `Cause: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
  }

  if (check) {
    let existing = '';
    try {
      existing = readFileSync(OUTPUT_PATH, 'utf8');
    } catch {
      console.error(`--check: ${OUTPUT_PATH} does not exist. Run \`pnpm generate:costs\`.`);
      process.exit(1);
    }
    const norm = (s: string): string => s.replace(/\r\n/g, '\n').trimEnd();
    if (norm(existing) !== norm(result.source)) {
      console.error(
        '--check: generated-block-costs.ts is out of date. Run `pnpm generate:costs` and commit.',
      );
      process.exit(1);
    }
    summarize(result.costs, result.skipped, result.emptyCount);
    console.log('\n--check: generated-block-costs.ts is up to date. ✔');
    return;
  }

  writeFileSync(OUTPUT_PATH, result.source, 'utf8');
  summarize(result.costs, result.skipped, result.emptyCount);
  console.log(`\nWrote ${OUTPUT_PATH} (Prettier-formatted).`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.stack : String(err));
  process.exit(1);
});
