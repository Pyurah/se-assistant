/**
 * CLI entry point for the block-definition generator.
 *
 * Reads the game's installed definition files, runs the pure parse + build
 * pipeline (`parse.ts`), and writes `src/data/generated-blocks.ts`.
 *
 *   pnpm generate:blocks                    # default Steam install path
 *   pnpm generate:blocks --game-dir <path>  # custom install location
 *   pnpm generate:blocks --check            # diff against committed file (CI)
 *
 * `--check` re-generates in memory and compares to the committed file, exiting
 * non-zero on drift — a guard for environments where the game IS available. CI
 * without the game simply doesn't run it (the committed file + unit tests over
 * fixtures cover correctness there).
 *
 * This file is allowed to use `fs` and `console` (see the `scripts/**` ESLint
 * override) — it lives OUTSIDE the `src/` purity boundary by design.
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import * as prettier from 'prettier';
import type { BlockDefinition } from '../../src/data/schema';
import {
  COMPONENTS_FILE,
  CONTENT_DATA_SUBDIR,
  CUBEBLOCKS_SUBDIR,
  DEFAULT_GAME_DIR,
  GAME_BUILD,
  LOCALIZATION_FILE,
} from './config';
import {
  buildBlock,
  parseComponentMasses,
  parseCubeBlocksFile,
  parseDisplayNames,
  type Diagnostic,
} from './parse';
import { emitModule } from './emit';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..', '..');
const OUTPUT_PATH = join(repoRoot, 'src', 'data', 'generated-blocks.ts');

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

/** Read all `CubeBlocks/*.sbc`, `Components.sbc`, and localization from disk. */
async function generate(gameDir: string): Promise<{
  source: string;
  blocks: BlockDefinition[];
  diagnostics: Diagnostic[];
}> {
  const dataDir = join(gameDir, CONTENT_DATA_SUBDIR);
  const cubeBlocksDir = join(dataDir, CUBEBLOCKS_SUBDIR);

  const componentMasses = parseComponentMasses(
    readFileSync(join(dataDir, COMPONENTS_FILE), 'utf8'),
  );
  const displayNames = parseDisplayNames(readFileSync(join(dataDir, LOCALIZATION_FILE), 'utf8'));
  const ctx = { componentMasses, displayNames };

  const sbcFiles = readdirSync(cubeBlocksDir)
    .filter((f) => f.toLowerCase().endsWith('.sbc'))
    .sort();

  const bySubtype = new Map<string, BlockDefinition>();
  const diagnostics: Diagnostic[] = [];

  for (const file of sbcFiles) {
    const defs = parseCubeBlocksFile(readFileSync(join(cubeBlocksDir, file), 'utf8'));
    for (const def of defs) {
      const { block, diagnostics: defDiags } = buildBlock(def, ctx);
      diagnostics.push(...defDiags);
      // Later files never override earlier — first definition of a subtype wins
      // (vanilla files are alphabetically first; DLC reskins share subtypeIds
      // only rarely, and curated override handles the ones that matter anyway).
      if (block && !bySubtype.has(block.subtypeId)) bySubtype.set(block.subtypeId, block);
    }
  }

  const blocks = [...bySubtype.values()];
  const raw = emitModule(blocks, GAME_BUILD);
  // Format with the repo's own Prettier config so the committed file is
  // canonical and `--check` compares like-for-like (no separate format step).
  const options = await prettier.resolveConfig(OUTPUT_PATH);
  const source = await prettier.format(raw, { ...options, parser: 'typescript' });
  return { source, blocks, diagnostics };
}

function summarize(blocks: readonly BlockDefinition[], diagnostics: readonly Diagnostic[]): void {
  const byCategory = new Map<string, number>();
  for (const b of blocks) byCategory.set(b.category, (byCategory.get(b.category) ?? 0) + 1);

  console.log(`\nGenerated ${blocks.length} blocks:`);
  for (const [cat, n] of [...byCategory.entries()].sort()) {
    console.log(`  ${cat.padEnd(16)} ${n}`);
  }

  const downgraded = diagnostics.filter((d) => d.kind === 'downgraded-stat');
  const zeroMass = diagnostics.filter((d) => d.kind === 'zero-mass');
  const skipped = diagnostics.filter((d) => d.kind === 'skipped-non-public');
  console.log(
    `\nDiagnostics: ${skipped.length} non-public skipped, ${zeroMass.length} zero-mass skipped, ${downgraded.length} stat-downgraded to 'other'.`,
  );
  for (const d of downgraded) {
    console.log(`  downgraded: ${d.subtypeId} — ${d.detail}`);
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
      console.error(`--check: ${OUTPUT_PATH} does not exist. Run \`pnpm generate:blocks\`.`);
      process.exit(1);
    }
    // Normalize line endings so CRLF/LF differences don't produce false drift.
    const norm = (s: string): string => s.replace(/\r\n/g, '\n').trimEnd();
    if (norm(existing) !== norm(result.source)) {
      console.error(
        '--check: generated-blocks.ts is out of date. Run `pnpm generate:blocks` and commit.',
      );
      process.exit(1);
    }
    summarize(result.blocks, result.diagnostics);
    console.log('\n--check: generated-blocks.ts is up to date. ✔');
    return;
  }

  writeFileSync(OUTPUT_PATH, result.source, 'utf8');
  summarize(result.blocks, result.diagnostics);
  console.log(`\nWrote ${OUTPUT_PATH} (Prettier-formatted).`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.stack : String(err));
  process.exit(1);
});
