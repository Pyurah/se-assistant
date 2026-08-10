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
- **Build cost** — what it takes to _construct_ the ship: total raw ore to mine
  (by metal), total ingots, the **full component breakdown** (every part and how
  many, so you can pre-stage an assembler queue and the welders never stall), and
  refine time — walking blocks → components → ingots → ore with exact arithmetic
  on the game's recipes. Toggle refinery / assembler tier and Assembler-Efficiency
  and the ore totals recompute; blocks with no recipe are flagged "cost unknown"
  rather than counted as free. A **throughput** readout turns that into wall-clock
  build time for a chosen refinery/assembler fleet, flags the bottleneck stage,
  and suggests the fleet ratio that keeps neither stage idle.
- **Motion & stability** — dampener stopping distance, center of mass,
  thrust-center alignment (off-center thrust that causes unwanted spin), and a
  gyroscope turn-rate estimate.
- **Conveyor audit** — flags which blocks need **large-port** conveyor lines
  (large refinery/assembler, O2/H2 generator, connector, large cargo, big drills)
  and whether the grid carries any large-port conveyor pieces to feed them. SE
  publishes no conveyor transfer rate — movement is instantaneous, gated only by
  port size — so this is an honest **presence** check, not a fabricated items/sec
  and not a routed-connectivity claim.
- **Life support** — O₂ generation vs. crew demand for a chosen crew size, the
  max crew a design can support, breathing time on stored O₂ if generation stops,
  and how much ice life support burns. Ships with no gas gear get a clean empty
  state.
- **Combat** — per-weapon and total-ship **DPS**: burst (trigger held) and
  sustained (reload gaps included), plus how long the loaded magazines last at
  full fire. Damage is labelled by kind (kinetic HP, missile explosion,
  shell/slug health-pool) rather than summed into one misleading number, and
  weapons with no curated firing stats are surfaced honestly ("DPS known for N of
  M"). No target-armour or time-to-kill model.
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

You can **mix thruster types per direction** — pick a default, then pin
individual axes (e.g. flat atmospheric for lift, ion on the sides) under
"Customize by direction." Each axis shows the **three thruster types ranked** for
your build — with the count each would take and a trade-off tag (ion "weak in
dense air", hydrogen "needs fuel", atmospheric "n/a here" in vacuum) — so you can
one-click pin the best fit instead of doing the arithmetic. A **directional TWR
readout** runs the recommended build through the same thrust-to-weight engine the
Analyze view uses, so you can check whether it holds altitude tilted fully onto
any one axis — empty or fully loaded — before you've built a thing.

**Already have a hull you like?** Import its blueprint and click **Use as estimate
base** (or drop the `.sbc` straight onto Estimate mode) to _seed_ a build from it:
your essentials carry over with their real counts, and the ship's dominant
thruster + power block preset the config — then adjust counts, cargo, or planet
and watch the analysis recompute. It never edits the source file; an "Adjusted —
no longer matches" indicator with one-click **Reset to source** keeps the
relationship clear.

Estimate mode also runs the **life support** and **combat** analyses on the build
it sizes — the same engines the Analyze view uses. Declare an O2/H2 generator and
an oxygen tank and you get the crew-oxygen balance and ice burn; add **weapons**
(now selectable in the essentials palette under a "Weapons" group) and you get the
build's burst/sustained DPS and how long its ammo lasts. Each readout stays hidden
until the build has the relevant hardware.

## Why the numbers are trustworthy

- Block stats (thrust, mass, power, capacity, fuel burn) are **fixed constants**
  from the game — SE Assistant does exact arithmetic on them, cross-referenced
  to the official wiki and cited in [`docs/data-audit.md`](./docs/data-audit.md).
  Beyond the hand-curated core, the full vanilla block catalogue (**1,455
  blocks**) is generated directly from the game's own definition files so ship
  imports resolve every buildable block (see _Regenerating block data_ below).
  Build-cost recipes for all 1,455 blocks are generated the same way, so an
  imported ship's bill of materials covers the whole catalogue too.
- The pure calc engine is covered by **worked-example tests** with hand-verified
  reference values (currently **449 tests**).
- Where a value is genuinely an estimate — the gyro turn-rate (needs the ship's
  moment of inertia) or stopping distance (ignores per-axis gravity) — the UI
  says so rather than implying false precision.

## Status

Version **0.20.0**. Phases 1 (core engine + blueprint import), 1.5 (requirement
estimator), 2 (fuel/flight-time + motion/stability), and 2.5 (Estimate-mode
enhancements incl. blueprint-seeded builds) are complete, and **Phase 3's first
block is done**: production/logistics (build cost, manufacturing throughput,
conveyor port audit) plus life support and combat DPS/ammo — the latter two now
available in **both** Analyze and Estimate mode. See
[`roadmap.md`](./roadmap.md) for what's next (multi-design compare, PWA offline,
and a `generate:weapons` fast-follow) and
[`CHANGELOG.md`](./CHANGELOG.md) for release history.

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

| Command                | Purpose                                                  |
| ---------------------- | -------------------------------------------------------- |
| `pnpm dev`             | Start the dev server                                     |
| `pnpm build`           | Type-check + production build                            |
| `pnpm preview`         | Preview the production build                             |
| `pnpm test`            | Run tests once                                           |
| `pnpm test:watch`      | Watch mode                                               |
| `pnpm test:coverage`   | Coverage report                                          |
| `pnpm typecheck`       | Type-check only                                          |
| `pnpm lint`            | ESLint (includes engine purity rules)                    |
| `pnpm format`          | Format with Prettier                                     |
| `pnpm generate:blocks` | Regenerate the vanilla block dataset from a game install |
| `pnpm generate:costs`  | Regenerate the vanilla build-cost recipes from a game install |

### Regenerating block data

The vanilla block catalogue in
[`src/data/generated-blocks.ts`](./src/data/generated-blocks.ts) is generated
from Space Engineers' own installed definition files — it is **committed**, so
you only need to regenerate it when the game updates or you're extending
coverage. Requires a local Space Engineers install.

```bash
pnpm generate:blocks                     # default Steam install path
pnpm generate:blocks --game-dir <path>   # custom install location
pnpm generate:blocks:check               # verify the committed file is current (CI drift guard)
```

The generator reads `Content/Data/CubeBlocks/*.sbc`, `Components.sbc`, and the
localization `.resx`, deriving each block's mass from its `<Components>` list and
its physics stats from the definition, then writes a Prettier-formatted module of
`source: 'definition'` blocks. These **fill gaps only**: the hand-curated
`source: 'vanilla'` blocks always win on a subtypeId conflict, so verified stats
are never overwritten (the merge lives in
[`src/data/all-blocks.ts`](./src/data/all-blocks.ts)). Fields the game computes
rather than stores literally — cargo inventory volume, hydrogen L/s burn rates,
drill/tool wattage — are omitted from generated entries and stay curated-only.

A companion generator produces the **build-cost recipes** the same way:

```bash
pnpm generate:costs                      # default Steam install path
pnpm generate:costs --game-dir <path>    # custom install location
pnpm generate:costs:check                # verify the committed file is current (CI drift guard)
```

It maps each block's `<Components>` list back to our component model and writes
[`src/data/generated-block-costs.ts`](./src/data/generated-block-costs.ts) (recipes
for all 1,455 blocks). A block is emitted only if **every** component maps — an
unmapped component leaves the block "cost unknown" rather than producing a partial
recipe. Unlike block definitions, the **cost merge lets generated recipes win**
(they come straight from the current version's files, which proved more accurate
than the older hand-curated numbers); the curated set is kept only as a fallback
for the few blocks whose game SubtypeId the generator doesn't emit. The merge lives
in [`src/data/all-block-costs.ts`](./src/data/all-block-costs.ts). Salvage-only
materials (Prototech Scrap) are modeled honestly — they count toward ingot mass but
contribute zero mined ore. See [`docs/data-audit.md`](./docs/data-audit.md) for the
recipe citations and the curated-vs-game divergence table.

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
