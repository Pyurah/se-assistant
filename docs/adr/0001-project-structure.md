# ADR 0001 — Single-Package `src/` Layout with an Enforced Purity Boundary

- **Status**: Accepted
- **Date**: 2026-08-03

## Context

SE Assistant is a browser SPA whose value is a **calculation engine** (TWR,
mass, power). Two constraints shaped the structure:

1. The engine must be **platform-agnostic** so it can later be wrapped in Tauri
   for a desktop build, run in a web worker, or run headless — i.e. no React,
   no DOM, no browser globals in the engine or its data.
2. The project is maintained by a **solo developer**, so tooling overhead has a
   real, ongoing cost.

The options considered were a full monorepo (pnpm workspaces + Turborepo with
`packages/core` and `app/`) versus a single package with internal folder
separation.

## Decision

Use a **single package** with a clean internal split:

- `src/core` — the pure calc engine (logging, audit, domain types, and the
  Phase 1 calc/parser modules).
- `src/data` — the pure block/planet dataset and schema.
- `src/ui` / `src/app` — the React presentation layers.

The `core`/`data` purity guarantee is **enforced by ESLint** rather than by
package boundaries: `eslint.config.js` bans imports of `react`, `react-dom`,
`zustand`, and the `@ui`/`@app` aliases, and bans browser globals (`window`,
`document`, `localStorage`) inside `src/core` and `src/data`. Dependencies flow
inward only: `app -> ui -> core -> data`.

## Consequences

**Positive**

- Zero workspace/build-orchestration overhead: one `package.json`, one install,
  one Vite build, one test config.
- The lint rule gives the _same_ portability guarantee a package split would —
  a violation fails CI, so the engine cannot silently grow a DOM dependency.
- Extracting `src/core` + `src/data` into a real package later (for Tauri) is
  mechanical, because the boundary is already clean and verified.

**Negative**

- The boundary lives in lint config, not in `package.json` `exports`, so it
  relies on lint actually running (CI + pre-commit discipline).
- No independent versioning of the engine vs the app (acceptable pre-1.0 and
  for a single deployable).

## Alternatives Considered

- **pnpm + Turborepo monorepo** — rejected for now: the orchestration,
  cross-package TS project references, and release tooling are overkill for a
  solo dev on a single deployable app. Revisit if/when the Tauri build or a
  published engine package materializes (tracked in the roadmap backlog).
