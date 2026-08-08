# ADR 0002 — Generated Block Dataset with Curated-Wins Merge

- **Status**: Accepted
- **Date**: 2026-08-08

## Context

The block dataset (`src/data/blocks.ts` + functional/utility blocks) began as a
small hand-curated set — every stat cross-referenced to the wiki and cited in
`docs/data-audit.md` — extended one ship at a time. Each imported blueprint that
used an un-added block showed it as a `mass: 0`, `category: 'other'` placeholder,
silently corrupting that ship's mass / TWR / power / cargo readouts (the very
numbers the product exists to make trustworthy).

This did not scale. Space Engineers defines **~1,600 block subtypes** (~1,550
buildable); the curated set covered fewer than 90. A real "Heavy Space Fighter"
import surfaced **26 distinct unrecognized subtypes in one ship** — not mods, but
mainstream base/DLC content (the small-grid heavy-armor shape family, SciFi
thrusters, Warfare 2 weapons, merge block, projector, air vent). The documented
"read the SubtypeId, find its def, hand-add it" workflow (ADR-adjacent note in
`docs/data-audit.md`) was a treadmill, not a fix.

The schema was deliberately built for this moment: `schema.ts` mirrors the game's
own concepts (grid size, subtype id, thrust-by-environment) and reserves a
`StatSource` value `'definition'` for exactly this source. The user's install has
every `CubeBlocks/*.sbc` on disk, with mass derivable from `<Components>` (method
already validated at 699 kg for the small atmospheric thruster).

Two questions had to be settled: (1) how do generated definitions coexist with
the hand-verified curated blocks, and (2) where does file-reading generator code
live given the ESLint-enforced purity boundary (ADR 0001)?

## Decision

**1. Generate the full vanilla catalogue from the game's own definition files,
and merge with curated blocks under a "curated wins" contract.**

A build-time generator (`scripts/generate-blocks/`, `pnpm generate:blocks`) reads
`CubeBlocks/*.sbc` + `Components.sbc` + localization and emits
`src/data/generated-blocks.ts` — ~1,455 blocks tagged `source: 'definition'`,
mass from components, physics stats from the definition, ids namespaced
`gen:<subtypeId>`. The output is **committed** so CI and other contributors never
need the game installed.

`src/data/all-blocks.ts` merges the two sets by insertion order — generated
first, curated last — so a `Map` keyed on `subtypeId` lets **curated
`source: 'vanilla'` blocks win on any conflict**. Generated entries only fill
gaps; no hand-verified value is ever overwritten. The blueprint resolver
(`resolve-block.ts`) reads the merged map; trusted-stat consumers (the estimator)
stay curated-scoped by design.

Fields the game computes rather than stores literally — cargo inventory volume,
hydrogen L/s burn rates, drill/tool wattage — are **omitted** from generated
entries and remain curated-only, rather than fabricated. Stat-bearing definitions
missing a required field (e.g. a Prototech thruster with a non-vanilla
`ThrusterType`) are **downgraded to mass-only `'other'`** with a diagnostic,
never emitted as a fabricated 0-thrust block that would corrupt TWR.

**2. The generator lives in top-level `scripts/`, outside the purity boundary.**

It uses `fs` and `console`, which ADR 0001's ESLint rules ban inside
`src/core` / `src/data`. Placing it in `scripts/` (excluded from
`tsconfig.app.json` and the coverage globs, with a `scripts/**` ESLint override
enabling `node` globals and `no-console`) keeps the boundary intact. The _pure_
parsing/emitting logic is still unit-tested against small committed fixtures, so
correctness is verified in CI without the game.

## Consequences

- **Coverage stops being a treadmill.** Every buildable vanilla block resolves;
  the reported fighter resolves completely. New game versions are a re-run of
  `pnpm generate:blocks`, not a hand-transcription session.
- **Curated trust is preserved.** The 8+ overlapping subtypes keep their
  wiki-verified stats; `all-blocks.test.ts` asserts this (identity + mass) so a
  future generator change can't silently clobber them.
- **`pnpm generate:blocks:check`** guards drift where the game is available; the
  committed file + fixture tests cover CI where it isn't.
- **Two-source-of-truth cost.** The dataset now has curated and generated
  origins. The `source` field and the audit doc keep the distinction explicit,
  and the merge is the single reconciliation point.
- **Follow-up owed.** `BLOCK_COMPONENT_COSTS` (build-cost bill-of-materials) is
  still hand-curated; the same parsed `<Components>` lists can regenerate it — a
  planned fast-follow so cost coverage matches block coverage.

## Alternatives considered

- **Keep hand-adding blocks.** Rejected — does not scale; the fighter alone would
  be 26 manual entries, and the next ship another batch.
- **Generated wins over curated.** Rejected — would discard hand-verified,
  wiki-cross-referenced values (and the def-absent fields curated blocks supply,
  like cargo volume) in favor of raw extraction.
- **Generate at runtime / ship the raw `.sbc` files.** Rejected — the app is
  client-only and must run without a game install; a committed, pre-parsed module
  is smaller, validated, and CI-friendly.
- **Put the generator in `src/`.** Rejected — violates the ADR 0001 purity
  boundary (`fs`, `console`).
