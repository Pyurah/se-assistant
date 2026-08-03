# SE Assistant

Plan Space Engineers ships and bases with numbers you can trust. Import an
exported blueprint (`.sbc`) and instantly see thrust-to-weight ratio, mass
breakdown, cargo capacity, and power budget — **empty vs fully loaded**, on any
vanilla planet.

> The insight that matters: _"TWR 2.3 empty but 0.8 loaded — you can't take off
> full."_ SE Assistant tells you before you build.

## Status

Version **0.1.0** — scaffolding complete and verified. Feature work begins with
Phase 1 (see [`roadmap.md`](./roadmap.md)). The app currently renders a landing
shell; the calc engine, blueprint parser, and analysis UI are the next builds.

## Features (planned for v1)

- **Propulsion & TWR** — directional thrust-to-weight (up/down/forward/back/
  lateral), thruster environment scaling (atmospheric/ion/hydrogen), per-planet
  gravity presets, empty-vs-loaded comparison, and a thruster recommender.
- **Mass & cargo** — full mass breakdown by category, cargo volume vs mass, and
  how a full load changes TWR and power draw.
- **Power budget** — generation vs peak draw, brownout warnings, battery
  runtime under load.
- **Blueprint import** — drag in a `.sbc` and auto-populate the whole design.

See [`roadmap.md`](./roadmap.md) for the full phase plan (fuel/flight time,
stability, manufacturing, multi-design compare, PWA offline, and more).

## Prerequisites

- **Node.js** >= 20 (developed on 25)
- **pnpm** (developed on 10)

## Getting Started

```bash
pnpm install
pnpm dev
```

Then open the URL Vite prints (default http://localhost:5173).

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
in v1 (the app is client-only).

| Variable         | Description                                                        | Default                        |
| ---------------- | ------------------------------------------------------------------ | ------------------------------ |
| `VITE_LOG_LEVEL` | Log verbosity (`trace`\|`debug`\|`info`\|`warn`\|`error`\|`fatal`) | `debug` in dev, `info` in prod |

No secrets are required; never commit a real `.env`.

## Architecture

SE Assistant is a React 19 + Vite SPA with a strict internal boundary:

- **`src/core`** and **`src/data`** are the platform-agnostic calc engine and
  dataset — pure TypeScript, no React or DOM. This is enforced by ESLint so the
  engine can later be wrapped in Tauri or run headless.
- **`src/ui`** and **`src/app`** hold the React presentation layers.
- Dependencies flow inward: `app -> ui -> core -> data`.

The block/planet **data schema** is designed so a future `.sbc` _definition-file_
parser can regenerate it from game files. See
[`docs/adr/0001-project-structure.md`](./docs/adr/0001-project-structure.md)
and [`CLAUDE.md`](./CLAUDE.md) for details.

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
