# SE Assistant

A Space Engineers ship & base planner: import a blueprint (`.sbc`) and get instant thrust-to-weight, mass, cargo, and power analysis — empty vs fully loaded, on any vanilla planet.

## Project Principles

- **Numbers must be trustworthy.** The calc engine is the product. Every formula ships with unit tests built from known-good worked examples. If a user can't trust the TWR readout, nothing else matters.
- **The engine is platform-agnostic.** `src/core` and `src/data` are pure TypeScript — zero React, zero DOM, zero browser globals — so the engine can later be wrapped in Tauri or run headless. This boundary is ESLint-enforced, not just a convention.
- **Dependencies flow inward.** `app -> ui -> core -> core/data`. `core`/`data` never import from `ui`/`app`.
- **Validate at boundaries.** Imported blueprint XML and any external data is parsed and validated with Zod before it reaches the engine.
- **Taste bar: Linear / Vercel / Raycast.** Clean, fast, calm, high-contrast. Loading/empty/error states are part of every feature, not an afterthought.
- Every output is shippable — no stubs, no scaffolding, no placeholder code.

## Architecture & Roadmap

- `roadmap.md` is the master tracking document. Read it before starting work. Update it after completing features.
- Architecture decisions are recorded in `docs/adr/`. Notably `docs/adr/0001-project-structure.md` explains the single-package `src/` layout (vs a monorepo) and the enforced purity boundary.

## Tech Stack

| Layer           | Technology                                                                    |
| --------------- | ----------------------------------------------------------------------------- |
| Framework       | React 19 (SPA)                                                                |
| Build tool      | Vite 6                                                                        |
| Language        | TypeScript (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) |
| Styling         | Tailwind CSS v4 (`@tailwindcss/vite`)                                         |
| State           | Zustand (kept minimal; local UI state stays in components)                    |
| Validation      | Zod (parse boundaries)                                                        |
| XML parsing     | fast-xml-parser (blueprint `.sbc` import)                                     |
| Testing         | Vitest + Testing Library + jsdom                                              |
| Logging         | Custom structured logger in `src/core/logger` (browser + headless)            |
| Package manager | pnpm                                                                          |
| Hosting         | Static host (Vercel/Cloudflare/Netlify); client-only in v1                    |

## Project Structure

```
src/
  core/              Platform-agnostic calc engine (PURE — no React/DOM)
    logger/          Structured, AI-parseable logger + default console sink
    audit/           Append-only audit trail model + in-memory store
    types.ts         Shared domain types (ShipDesign, DesignBlock, CargoLoadout)
    index.ts         Engine public surface
    (Phase 1)        blueprint/ parser, twr/, mass/, power/ calc modules
  data/              Pure data layer (PURE — no React/DOM)
    schema.ts        Block & planet schema (designed for a future .sbc def parser)
    blocks.ts        Curated vanilla block dataset (seed; full coverage = M1)
    planets.ts       Vanilla planet/moon gravity + atmosphere presets
    index.ts         Data public surface
  ui/                Presentational components + styles (React)
    styles/index.css Tailwind entry + design tokens
  app/               App shell + feature composition (React)
    App.tsx
  test/setup.ts      Vitest setup (jest-dom, cleanup)
  main.tsx           Browser entry
docs/adr/            Architecture Decision Records
.claude/             test-conventions.md and other agent context
```

Path aliases: `@core/*`, `@data/*`, `@ui/*`, `@app/*` (mirrored in `tsconfig.app.json` and `vite.config.ts`).

## Build & Development

| Command              | Purpose                                         |
| -------------------- | ----------------------------------------------- |
| `pnpm install`       | Install dependencies                            |
| `pnpm dev`           | Start the Vite dev server                       |
| `pnpm build`         | Type-check (`tsc -b`) + production build        |
| `pnpm preview`       | Preview the production build                    |
| `pnpm test`          | Run the test suite once                         |
| `pnpm test:watch`    | Vitest watch mode                               |
| `pnpm test:coverage` | Coverage (thresholds enforced on `core`/`data`) |
| `pnpm typecheck`     | Type-check without emitting                     |
| `pnpm lint`          | ESLint (includes the purity-boundary rules)     |
| `pnpm format`        | Prettier write                                  |

## Key Architectural Decisions

- **Single package, not a monorepo.** For a solo dev the `src/core` + `src/data` folder split with an ESLint-enforced import boundary gives the same Tauri-portability guarantee as a monorepo without workspace/build-orchestration overhead. See ADR 0001.
- **Purity boundary is enforced.** `eslint.config.js` bans React/UI/DOM imports and browser globals inside `src/core` and `src/data`. Violations fail lint.
- **Data schema built for a future `.sbc` definition parser.** `src/data/schema.ts` mirrors the game's own concepts (grid size, subtype id, thrust-by-environment) so generated JSON can replace hand-authored constants without reshaping types. A `StatSource` field (`vanilla` / `definition` / `blueprint` / `user`) powers the vanilla-vs-modded distinction.
- **Client-only v1.** No backend. Audit logging is designed into the model now (append-only, pluggable sink) so a backend or local persistence can attach later without a schema change.

## Testing

- Framework: Vitest (config in `vite.config.ts`, no separate vitest config).
- Test files are co-located: `foo.ts` -> `foo.test.ts`.
- The calc engine and data layer are the correctness-critical surface — enforced coverage thresholds (90% lines/functions/statements, 85% branches) and known-good worked-example tests for all math.
- Integration/persistence uses real implementations, never database mocks.
- Full conventions: `.claude/test-conventions.md`.

## Logging

- Structured logger in `src/core/logger` — JSON-shaped records, real levels, correlation IDs, child loggers.
- Error/fatal records carry AI metadata (`actionable`, `suggestion`, `severity_reason`) for automated triage.
- `no-console` is ESLint-enforced everywhere except the logger's own sink. Use `logger.child({ module })`.
- Meaningful user actions go through the append-only audit trail (`src/core/audit`).

## Current Phase Status

Scaffolding complete and verified (v0.1.0). Build, tests, lint, and typecheck pass. Phase 1 (M1 dataset + full-coverage block generator), M2 blueprint parser, and all of Phase 3's first block are shipped: M7 build cost (with a `pnpm generate:costs` generator giving full vanilla cost coverage, v0.17.0, plus a component breakdown in the Build-cost panel, v0.18.0), the M7 conveyor **port & reachability audit** (v0.19.0 — a presence check, not a fabricated transfer rate), and M8 **life support + combat DPS/ammo** (v0.19.0). Life support + combat are now available in **both** modes: v0.20.0 brought them into Estimate mode (on the `estimateToDesign`-synthesized `ShipDesign`) and added a `weapon` `BlockCategory` + 17 curated weapon blocks so weapons are declarable in the essentials palette. v0.21.0 swapped the dead space-TWR placeholder for a per-direction **acceleration** readout (m/s² + time/distance to an adjustable speed cap, exact `thrust ÷ mass` in vacuum) in **both** tabs, and made the estimator read its target-TWR knob as a target g-acceleration in space so an estimated build gets real thrusters there. v0.21.1 fixed blueprint-seeded Estimate builds silently dropping every generated (`source:'definition'`) block — armor, Sci-Fi thrusters, conveyors — by pointing the seed matcher (`designToEstimateSeed`) and the estimator's block resolution (`useEstimate`) at the merged `BLOCKS_BY_ID` instead of the curated-only map, so every recognized block now carries over as a fixed essential and contributes its real mass. v0.21.2 fixed a blueprint-seeded Estimate build sizing **zero of everything** (0 thrusters/gyros/batteries) for the same fighter in Space: (1) `designToEstimateSeed` now picks the dominant thruster by **total thrust contributed** (count × per-block thrust) instead of by count, so a ship's few large main-drive thrusters win over its many small maneuvering ones (previously the weak type was chosen, diverged past the sanity cap, and gave up); and (2) the two estimator hard-stops (dead UP axis, diverging count) now still size power + gyros via a shared `sizeSupportOnly` fixed-point pass — base draw and attitude control don't depend on the thrusters hitting their TWR target — instead of zeroing the whole build. **v0.22.0 turned Estimate mode into a manual goal-seeking thruster workbench**: the auto-sizing solver (`estimateRequirements`, target-TWR + lateral-fraction knobs, `uniformThrusters`, the `EstimatorInput`/`EstimatorConfig` surface) is **retired**. You now assign thrusters per direction by hand (mixing types on one axis) and set an explicit per-direction goal — target TWR on planets, target acceleration in g-multiples in space — with a live reached/exceeded/short verdict on each axis, checked against an empty/loaded toggle (default loaded). Power + gyros are still auto-sized against the resulting build via the generalized `sizeSupport` mass fixed-point (`estimateManual`); per-direction goal verdicts come from the pure `evaluateGoal` helper (`estimate-goal.ts`). Blueprint seeding now populates each direction's stack from the imported ship's real oriented thruster layout; goals and load-state are UI targets, not seeded, and changing a goal never flips "adjusted from source". See `roadmap.md`.

## Response Protocol

| Request Type           | Action                                                 |
| ---------------------- | ------------------------------------------------------ |
| **Clear**              | Build it. No permission needed.                        |
| **Ambiguous**          | Ask ONE sharp question, then build.                    |
| **Rough/incomplete**   | Expand beyond the brief with good taste.               |
| **Questionable/risky** | Flag concern in one sentence, then do the right thing. |
