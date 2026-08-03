# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and this project adheres to
[Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-08-03

### Added

- Initial project scaffolding: React 19 + Vite 6 + TypeScript (strict) SPA.
- Enforced platform-agnostic boundary: `src/core` and `src/data` are pure TS
  (no React/DOM/browser globals), guarded by ESLint rules.
- Structured, AI-parseable logger (`src/core/logger`) with levels, correlation
  IDs, child loggers, pluggable sinks, and AI metadata on errors.
- Append-only audit trail model with an in-memory store (`src/core/audit`),
  designed for a future durable sink.
- Block & planet data schema (`src/data/schema.ts`) designed for a future
  `.sbc` definition-file parser, with a `StatSource` field for vanilla-vs-modded
  handling.
- Seed vanilla block dataset and full vanilla planet/moon presets
  (flagged for verification in Phase 1 / M1).
- Shared `ShipDesign` domain types for the calc engine.
- App shell with Tailwind CSS v4 design tokens (Linear/Vercel/Raycast palette).
- Vitest test infrastructure (jsdom + Testing Library) with enforced coverage
  thresholds on the engine/data layers; suites for the logger, audit store,
  data integrity, and app shell.
- Tooling: ESLint (typed, purity boundary), Prettier, path aliases
  (`@core`/`@data`/`@ui`/`@app`), scripts for dev/build/test/lint/typecheck.
- Documentation: `README.md`, `CLAUDE.md`, `roadmap.md`,
  `docs/adr/0001-project-structure.md`, `.claude/test-conventions.md`,
  `.env.example`.

[0.1.0]: https://semver.org/
