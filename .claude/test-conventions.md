# Test Conventions — SE Assistant

Read this before writing or modifying tests. It captures the setup so you do
not have to rediscover it.

## Framework & Commands

- **Runner**: Vitest (config lives in `vite.config.ts` under the `test` key —
  there is no separate `vitest.config.ts`).
- **DOM environment**: `jsdom`, with `@testing-library/react` +
  `@testing-library/jest-dom`.
- **Setup file**: `src/test/setup.ts` (registers jest-dom matchers, auto
  `cleanup()` after each test).

| Command              | Purpose                           |
| -------------------- | --------------------------------- |
| `pnpm test`          | Run the full suite once (CI mode) |
| `pnpm test:watch`    | Watch mode                        |
| `pnpm test:ui`       | Vitest UI                         |
| `pnpm test:coverage` | Coverage report                   |

`globals: true` is enabled, so `describe/it/expect/vi` are available without
imports — but existing tests import them explicitly for clarity. Match the
surrounding file's style.

## File Layout

- Tests are **co-located** with source: `foo.ts` -> `foo.test.ts`.
- Match `src/**/*.{test,spec}.{ts,tsx}`.
- Shared test-only helpers live under `src/test/`.

## What to Test Where

- **`src/core` (calc engine) and `src/data`** — the correctness-critical
  surface. People trust these numbers. Coverage thresholds are **enforced**
  here (90% lines/functions/statements, 85% branches — see `vite.config.ts`).
  - Use **known-good worked examples** for all math (TWR, mass, power). Each
    calc test should state the inputs and the hand-computed expected result in
    a comment so the expectation is auditable.
  - Use `toBeCloseTo` for floating-point comparisons, not `toBe`.
  - Keep tests pure — no DOM, no React, no mocking of internal math.
- **`src/ui` / `src/app`** — component tests via Testing Library. Query by
  role/text, not test ids, unless a test id is unavoidable.

## Purity Boundary (important)

`src/core` and `src/data` must not import React/DOM/UI. ESLint enforces this in
`eslint.config.js`. Do not add DOM-dependent tests to those folders; put
component tests in `src/ui` or `src/app`.

## Data & Isolation

- Tests own their data. No shared mutable fixtures that couple tests together.
- The audit store and any future persistence use **real in-memory
  implementations**, not mocks. When a database/IndexedDB layer lands, prefer
  a real instance over mocking (per project standard).
- `cleanup()` runs automatically after each test; do not call it manually.

## Blueprint Parser Tests (Phase 1)

- Keep sample `.sbc` fixtures small and committed under
  `src/core/blueprint/__fixtures__/` (create when the parser lands).
- Validate parsed output against Zod schemas at the boundary; test both valid
  and malformed XML paths, including the error/AI-metadata log path.

## E2E

- Not set up yet. Planned for a later phase (Playwright) once real user flows
  exist. Add an ADR / roadmap note before introducing it.
