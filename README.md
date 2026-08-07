# SE Assistant

Plan Space Engineers ships and bases with numbers you can trust. Either **import
an exported blueprint** (`.sbc`) to analyze a finished ship, or **design one from
scratch** and let the app size the propulsion, power, and attitude hardware for
you. Every number is exact arithmetic on the game's published block stats — no
guessing.

> The insight that matters: _"TWR 2.3 empty but 0.8 loaded — you can't take off
> full."_ SE Assistant tells you before you build.

Targets **Space Engineers v1.210.012 b0** (all block stats cited in
[`docs/data-audit.md`](./docs/data-audit.md)).

## Two modes

### 🔍 Analyze a blueprint

Drag in an exported `.sbc` (or load the bundled example) and get a live readout:

- **Thrust-to-weight** — directional TWR (up/down/forward/back/lateral) with
  per-type environment scaling (atmospheric thrusters fade with altitude, ion
  thrusters are the inverse, hydrogen is flat), per-planet gravity, and the
  **empty-vs-loaded** comparison with a can-it-take-off verdict.
- **Mass & cargo** — dry vs loaded mass, breakdown by block category, cargo
  capacity and how a full hold drags down TWR. Pick a real game item (Gold
  Ingot, Iron Ore, Steel Plate, …) or enter a mass + volume, and the loaded
  state uses that item's exact density.
- **Power budget** — available power (generation + battery discharge) vs a
  realistic peak draw (opposing thrusters don't both fire), a brownout warning,
  and battery runtime under load.
- **Fuel & flight time** — total hydrogen capacity, hover time and full-throttle
  time on a full tank, reactor uranium burn, solar sizing guidance.
- **Motion & stability** — dampener stopping distance, center of mass,
  thrust-center alignment (off-center thrust that causes unwanted spin), and a
  gyroscope turn-rate estimate.
- **Block list** — grouped by category with vanilla / modded / custom source
  badges, plus import diagnostics (recognition rate, unrecognized subtypes,
  multi-grid handling).

Change the **planet** or **cargo load** and everything recomputes instantly.

### 🛠️ Estimate a build from scratch

You can't export a blueprint until _after_ a ship is built — so this mode is the
inverse. Declare your essential gear (e.g. _4 drills, 2 cargo containers, a
cockpit_) and your goals (target TWR, thruster fuel type, power source, planet,
cargo), and SE Assistant estimates the rest: how many **thrusters per
direction**, how many **batteries/reactors** for your peak draw and runtime, and
roughly how many **gyroscopes**. It iterates to a stable answer because
thrusters, power, and gyros each add mass and draw that change the requirement.

## Why the numbers are trustworthy

- Block stats (thrust, mass, power, capacity, fuel burn) are **fixed constants**
  from the game — SE Assistant does exact arithmetic on them, cross-referenced
  to the official wiki and cited in [`docs/data-audit.md`](./docs/data-audit.md).
- The pure calc engine is covered by **worked-example tests** with hand-verified
  reference values (currently **212 tests**).
- Where a value is genuinely an estimate — the gyro turn-rate (needs the ship's
  moment of inertia) or stopping distance (ignores per-axis gravity) — the UI
  says so rather than implying false precision.

## Status

Version **0.10.1**. Phases 1 (core engine + blueprint import), 1.5 (requirement
estimator), and 2 (fuel/flight-time + motion/stability) are complete. See
[`roadmap.md`](./roadmap.md) for what's next (production/logistics,
multi-design compare, PWA offline) and [`CHANGELOG.md`](./CHANGELOG.md) for
release history.

## Prerequisites

- **Node.js** ≥ 20 (developed on 25)
- **pnpm** (developed on 10)

## Getting started

```bash
pnpm install
pnpm dev
```

Then open the URL Vite prints (default http://localhost:5173).

To analyze a ship, drag an exported `.sbc` onto the import screen — or click
**Load example** to explore without a file.

## Development

| Command              | Purpose                               |
| -------------------- | ------------------------------------- |
| `pnpm dev`           | Start the dev server                  |
| `pnpm build`         | Type-check + production build         |
| `pnpm preview`       | Preview the production build          |
| `pnpm test`          | Run tests once                        |
| `pnpm test:watch`    | Watch mode                            |
| `pnpm test:coverage` | Coverage report                       |
| `pnpm typecheck`     | Type-check only                       |
| `pnpm lint`          | ESLint (includes engine purity rules) |
| `pnpm format`        | Format with Prettier                  |

## Configuration

Copy `.env.example` to `.env` and adjust as needed. All variables are optional
(the app is client-only, no secrets).

| Variable         | Description                                                        | Default                        |
| ---------------- | ------------------------------------------------------------------ | ------------------------------ |
| `VITE_LOG_LEVEL` | Log verbosity (`trace`\|`debug`\|`info`\|`warn`\|`error`\|`fatal`) | `debug` in dev, `info` in prod |

## Architecture

React 19 + Vite + TypeScript SPA with a strict internal boundary:

- **`src/core`** — the platform-agnostic calc engine (TWR, mass, power, fuel,
  motion, estimator) plus the blueprint parser and structured logger. Pure
  TypeScript, no React or DOM.
- **`src/data`** — the curated block/planet dataset and its schema. Also pure.
- **`src/ui`** — React components (design-system kit) and Tailwind tokens.
- **`src/app`** — the app shell, Zustand stores, and feature dashboards.

Dependencies flow inward only (`app → ui → core → data`), enforced by ESLint —
so the engine can later be wrapped in Tauri or run headless. The data schema is
shaped so a future `.sbc` _definition-file_ parser can regenerate it from game
files. See [`docs/adr/0001-project-structure.md`](./docs/adr/0001-project-structure.md)
and [`CLAUDE.md`](./CLAUDE.md).

**Stack:** React 19, Vite, TypeScript (strict), Tailwind v4, Zustand, Zod,
`fast-xml-parser`, Vitest + Testing Library.

## Gotchas

- `no-console` is enforced everywhere except the logger sink — use the
  structured logger in `src/core/logger` (`logger.child({ module })`).
- Do not import React/DOM into `src/core` or `src/data`; lint will fail.
- Vitest config lives inside `vite.config.ts`; there is no separate config file.

## License

[MIT](./LICENSE) © Geoff Nelson

Space Engineers is a trademark of Keen Software House. This is an unofficial,
fan-made planning tool and is not affiliated with or endorsed by Keen Software
House.
