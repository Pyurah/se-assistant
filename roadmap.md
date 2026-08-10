# SE Assistant — Product Roadmap

> **Last Updated**: 2026-08-09 (v0.17.0)

A Space Engineers ship & base planner: import a blueprint (`.sbc`) and get
instant thrust-to-weight, mass, cargo, and power analysis — empty vs fully
loaded, on any vanilla planet.

---

## 👉 Next session starts here

**Everything through Phase 2 plus M6.6, M6.7, the first Phase 3 slice (M7 build
cost + throughput), the v0.16.0 full-coverage block generator, and the v0.17.0
build-cost generator is DONE, committed, and pushed to GitHub**
(`https://github.com/Pyurah/se-assistant`, branch `master`, at v0.17.0). Working
tree is clean and all four gates pass (`typecheck` / `lint` / `test` (369) /
`build`). Nothing is half-finished.

**v0.17.0 (2026-08-09) — build-cost generator, full vanilla cost coverage.** The
noted fast-follow is shipped: `pnpm generate:costs` maps every block's parsed
`<Components>` list to our component model and emits
`src/data/generated-block-costs.ts` — recipes for all **1,455 blocks (0 skipped)**.
The Build-cost panel now covers the whole catalogue (the reported "Jasen's Miner"
went from 11/21 to 21/21 costed). Added 11 components (7 Prototech + ZoneChip + 3
plushies) and a salvage-ingot model (`PrototechScrap` = 0-ore pseudo-ingot).
Repointing the engine surfaced ~18 curated cost rows that lagged the current game,
so the cost merge **inverts the block merge: generated wins** (curated kept only as
fallback for un-emitted SubtypeIds). See `docs/data-audit.md` for the divergence
table and the ADR 0002 addendum.

**v0.14.0 (2026-08-08) — blueprint build cost (Phase 3 / M7, first slice).**
Analyze now answers "what does it take to _build_ this ship?": total raw ore to
mine (by metal), total ingots, and refine time — walking blocks → components →
ingots → ore with exact arithmetic on the game's recipes. New pure manufacturing
dataset (`src/data/manufacturing.ts`: refine recipes, component recipes, per-block
`<Components>` costs, reskin aliases, refinery/assembler presets), new pure
`buildCost` engine (+ `totalOreMass`/`totalIngotMass`, 13 worked-example tests),
and a **Build cost** panel in the Analyze right rail with adjustable refinery /
assembler / Assembler-Efficiency and honest "cost known for N of M block types"
coverage (modded/unknown blocks flagged, never costed as zero). Every dataset
value citation-logged in `docs/data-audit.md` with 9 confidence flags (cross-check
found refining/assembly recipes unchanged since the 2019 archive — high
confidence). Locked decisions (with the user): build cost is the first Phase 3
slice; 1 ore = 1 kg; Assembler-Efficiency ×1 default; refine time is the headline
resource metric.

**v0.13.0 (2026-08-07) — blueprint as a base for an Estimate build (M6.7).**
Analyze read a finished ship; Estimate sized one from scratch; the two were
disconnected. Now a parsed `.sbc` can **seed an Estimate build**: essentials
(drills, cargo, cockpit, tools) carry over with their real counts, and the ship's
dominant thruster + power block preset the Estimate config's _model choices_ —
while the estimator re-sizes _how many_ for the target TWR. It is explicitly not
an in-place editor: the source `.sbc` is never mutated; it's read once,
snapshotted, and a fresh mutable build is handed over. New pure
`designToEstimateSeed` engine mapper (exact inverse of `estimateToDesign`), an
atomic `seedFromDesign` store action + source snapshot + derived
`isAdjustedFromSource` + `resetToSource`, two entry points (a **Use as estimate
base** button on Analyze and a **Start from a blueprint** dropzone in Estimate,
sharing one parse helper), an adjusted-vs-source indicator with reset, seed
diagnostics for skipped modded blocks, and a geometry caption on the directional
TWR. Locked decisions (with the user): both entry points; sized blocks seed the
config choice and re-size counts. No new game data.

**v0.12.0 (2026-08-07) — ranked thruster-type suggestions per direction
(M6.6).** Estimate mode's "Customize by direction" let the user pin a type per
axis, but they picked blind. Now each axis shows the three thruster types ranked
for the current build — feasible first, then fewest thrusters, then least added
mass — each a one-click chip with the count it would take and a short trade-off
tag (ion "weak in dense air", hydrogen "needs fuel", atmospheric "n/a here" in
vacuum); a ✓ marks the top feasible pick. Clicking a chip pins that type's
least-added-mass variant to the axis, feeding the existing per-direction config.
The ranking is a new pure `rankThrusterTypes` engine function (exact arithmetic
on the existing dataset via `effectiveThrust` + `weight`), sized against the
current build's loaded mass and surfaced through a new `suggestions` field on the
`useEstimate` result. Locked decision (with the user): rank the three _types_
(each as its least-added-mass variant), not every block, to keep the narrow
config column calm. No new game data.

**v0.11.0 (2026-08-07) — per-direction thruster mix + directional TWR in
Estimate.** Estimate mode was thin next to Analyze; this closes the two biggest
gaps the user called out. (1) **Per-direction thruster mixing** — the recommended
build can use a different thruster type per axis (e.g. flat atmospheric on
vertical/fore/aft, ion on the sides). `EstimatorConfig.thruster` generalized to
`thrusters: Record<Direction, ThrusterBlock>` (with a `uniformThrusters(block)`
helper for the unchanged single-type default); the convergence loop sizes each
direction against its own type's thrust/draw/atmosphere curve, and peak power
draw is now measured per-axis from the actual per-direction draw. A dead lateral
axis is flagged with a soft per-axis warning instead of blocking the whole
estimate; a dead UP axis still hard-stops. A "Customize by direction" disclosure
under the thruster picker exposes six selects (each "Same as default" until
pinned). (2) **Directional TWR readout in Estimate** — a new panel runs the
recommended build through the _same_ trusted TWR engine Analyze uses, via a new
pure `estimateToDesign` bridge that synthesizes a geometry-less `ShipDesign` from
the estimate. Six-axis bars, Empty/Loaded toggle, UP emphasized, per-direction
thruster captions when the build mixes types — answering "can I hold altitude
tilted fully onto one axis?" A round-trip test proves the synthesized design
reproduces the estimator's own `achievedUpTwr` through the real engine. The
`estimateToDesign` bridge is also the reusable seed for M6.7 (editing an imported
blueprint's loadout). No dataset values changed.

**v0.10.2 (2026-08-07) — estimator power-sizing realism.** Two power bugs on a
real small-grid mining ship (cockpit, 3 drills, connector, ore detector) that
was told it needed **4 warfare batteries** for a ship half that runs fine. (1)
The estimator sized power against _all six_ thruster directions at full draw,
but opposing pairs never fire together — the same realism the analyzer's
`peakDraw()` already applies (v0.10.0). Peak draw and the battery count it drives
now count only the larger side of each opposing pair (`up + 2×lateral`); the
reported case dropped 7 → 3 batteries (12.6 MW → 4.8 MW peak). (2) A
`SANITY_THRUSTER_CAP` now stops the mass↔count convergence loop from diverging
when a thruster type can't lift the ship (ion in dense atmosphere produced tens
of trillions of batteries) — it returns an infeasible estimate with a clear
"pick a stronger thruster / lower TWR / less cargo" warning. Both cited in
`docs/data-audit.md`; no dataset values changed.

**v0.10.1 (2026-08-07) — grid-aware gyro estimate.** A small-grid utility ship
(3 welders + cockpit + small cargo container, ≈6 t loaded) was recommended **3
gyros** where the real build flies fine on 2 (the math now says 1 is the
minimum). The estimator's torque-per-kg gyro target had been calibrated only for
the large grid (1 gyro per ~200 t) and applied unchanged to small-grid ships,
then divided by the 75×-weaker small gyro — a compounding over-count. Fix: scale
the target by the square of the grid cell-size ratio `(cell / large_cell)²`,
matching the moment-of-inertia model (`I ∝ m·s²`) the motion engine already
uses — a small-grid ship's inertia per kg is 1/25 of a large-grid ship's. The
large-grid calibration is untouched. See `gyroTorquePerKg` in
`src/core/engine/estimate.ts` and the "Grid-aware gyro sizing" note in
`docs/data-audit.md`.

**v0.10.0 (2026-08-07) — cargo item picker + power-budget realism.** Two
user-reported fixes on the real "Rapier" ship. (1) **Cargo loadout** replaced the
confusing "custom kg/L" density field with a **game-item picker** (ingots / ores
/ components) plus explicit **Mass + Volume** inputs; the app derives density
(`mass / volume`) so the user never divides by hand. Backed by a new verbatim
item dataset (`src/data/cargo-items.ts`, 44 items from `Components.sbc` +
`PhysicalItems.sbc`, SE v1.210.012 b0), guarded by data-integrity tests. (2)
**Power budget** stopped inventing brownouts: peak draw now counts only the
larger side of each opposing thruster pair (up/down never fire together), and
available power now includes **battery discharge** so battery-only ships read as
supplied instead of "0 W generation / brownout". Both cited in
`docs/data-audit.md`. The store's `densityKgPerL` and the pure engine are
unchanged — the item→density mapping lives entirely in `CargoControl.tsx`.

**v0.16.0 (2026-08-08) — block dataset generator, full vanilla coverage.** The
on-demand block-adding workflow described in the v0.9.1 note (read a SubtypeId,
find its def, hand-add it) finally stopped scaling: a real "Heavy Space Fighter"
import showed **26 distinct unrecognized subtypes** — the whole small-grid
heavy-armor shape family, SciFi thrusters, Warfare 2 weapons, merge block,
projector, air vent — all landing as `mass: 0` placeholders and corrupting its
mass/TWR/power/cargo. Fixed at the root: a new build-time generator
(`scripts/generate-blocks/`, `pnpm generate:blocks`) reads the game's own
`CubeBlocks/*.sbc` + `Components.sbc` + localization and emits
`src/data/generated-blocks.ts` — **1,455 buildable blocks** (`source:
'definition'`), mass from each block's `<Components>`, physics stats read from
the definition. A merge module (`src/data/all-blocks.ts`) fills gaps with the
generated set while **curated `vanilla` blocks win on any conflict** (no
hand-verified stat is overwritten), and the blueprint resolver now matches the
full set — the fighter resolves completely. Committed output means CI needs no
game install; pure parser is fixture-tested; `pnpm generate:blocks:check` guards
drift. This delivers the backlog "`.sbc` definition-file parser" item and
advances **M1** from curated-on-demand to full vanilla coverage. Def-absent
fields (cargo volume, H2 L/s, drill wattage) stay curated-only; regenerating
`BLOCK_COMPONENT_COSTS` from the parsed components is the noted fast-follow.

**v0.9.2 (2026-08-07) — cockpit-relative directional thrust.** The same real DLC
ship ("Rapier") reported **zero forward thrust** despite having two
forward-facing thrusters. Root cause: SE defines forward/up/left by the ship's
**main cockpit**, but the parser bucketed thrust by raw grid axes, so on a ship
whose cockpit is rotated relative to the grid the forces landed on the wrong
axes. Fixed: the parser derives the pilot basis from the main cockpit's
orientation (`<IsMainCockpit>` cockpit, or the sole cockpit) and rotates every
thruster's thrust direction into it before aggregating; ships with no cockpit
fall back to grid axes, and a `cockpitRelative` report flag drives a block-list
note. Verified against the game's own thrust overlay: up 920 / fwd 460 / back
460 / left 288 / right 288 kN, nothing down — an exact match. See the
`buildGridToPilot` transform in `src/core/blueprint/orientation.ts` and the
"Cockpit-relative directional thrust" note in `docs/data-audit.md`.

**v0.9.1 (2026-08-07) — DLC block-coverage fix.** A real DLC-built ship
("Rapier") imported with 40 of 48 blocks unrecognized — all genuine DLC/base
blocks, not mods. Root cause: those subtypes weren't in the dataset. Added 8
blocks (2 atmospheric thruster variants, a Contact cargo reskin, an Apex welder
reskin, 2 conveyor pieces — the first `conveyor` blocks — and 2 small-grid light
armor shapes — the first `structural` blocks), all sourced from the **installed
game's own definition files** (`CubeBlocks/*.sbc` + `Components.sbc`), with mass
computed from component lists and the method validated against a known value.
Also fixed a real parser bug: a **missing** `<BlockOrientation>` (SE's identity
default) was being dropped from directional TWR instead of defaulting to
`Forward`. The Rapier now resolves 48/48, 0 unrecognized, 0 unoriented. If more
unrecognized blocks turn up from other ships, the same workflow applies — read
the SubtypeId from `bp.sbc`, find its def file under the game's `CubeBlocks/`,
compute mass from `Components.sbc`, add it with a citation in
`docs/data-audit.md`. Known coverage gap: only the armor _shapes_ and DLC blocks
seen so far are in the set; heavy armor, large-grid armor, and other shape
variants are added on demand the same way.

**The next unit of work continues Phase 3 — Production & Logistics (M7 + M8).**
Phase 2.5 is fully shipped (M6.5 v0.11.0, M6.6 v0.12.0, M6.7 v0.13.0), and Phase
3 is under way: **M7 build cost shipped in v0.14.0** (the ore-to-build slice the
user chose first), delivering the new manufacturing dataset the rest of Phase 3
builds on. Remaining M7 deliverables reuse that dataset: **refinery/assembler
throughput + optimal ratios** (a standalone "how many refiners to keep N
assemblers fed" calculator — recipes, times, and multipliers are already in
`manufacturing.ts`) and **conveyor throughput**. **M8 — Life Support & Combat**
still needs NEW game data not yet in the dataset (O2/H2 generation rates vs crew,
weapon DPS/ammo) — a fresh research pass (cite in `docs/data-audit.md`, flag
anything unconfirmed) → dataset → pure engine + worked-example tests → UI → bump.

If instead the user wants polish over new features: candidate small wins are a
GitHub Actions CI workflow (run the four gates on push, plus `pnpm
generate:blocks:check` / `pnpm generate:costs:check` on runners with the game — or
skip them where the game is absent), README screenshots, or resolving the
flagged-uncertain data values in `docs/data-audit.md` (some DLC SubtypeIds,
drill/sensor wattages, the Superconductor cobalt term) against a live game install.
The `BLOCK_COMPONENT_COSTS` regeneration fast-follow is **done** (v0.17.0).

---

## Current State

- **Version**: 0.17.0
- **Repo**: pushed to `https://github.com/Pyurah/se-assistant` (`master`);
  commits use the GitHub no-reply email (real email scrubbed from history).
- **Build**: passing (`pnpm build`)
- **Tests**: passing — 369 tests across logger, audit, data-integrity, the
  merged-dataset invariants (`all-blocks` + `all-block-costs` override/gap-fill
  proofs) and the block + cost generators' fixture-driven parser/emitter/map
  suites, engine
  (incl. `estimateRequirements`, the `estimateToDesign` + `designToEstimateSeed`
  bridges, the `rankThrusterTypes` ranker, the `buildCost` bill-of-materials
  engine, the `manufacturingThroughput` fleet/ratio engine, the fuel/flight-time
  engine, and the motion/stability engine), blueprint parser, number formatter,
  stores, and UI-rendering suites
- **Phase**: Phases 1, 1.5, and 2 all COMPLETE; Phase 3 begun. M1 dataset, M2
  blueprint parser, M3 calc engine, M4 analysis UI, M4.5 requirement estimator,
  M5 fuel/flight time, M6 motion/stability — all delivered. Phase 3 / M7 opened
  with the build-cost slice (v0.14.0): a manufacturing dataset (refine + component
  recipes, per-block component costs) and a pure `buildCost` engine that walks
  blocks → components → ingots → raw ore. React 19 + Vite + TypeScript SPA,
  `src/core` + `src/data` purity boundary (ESLint enforced), structured logging,
  append-only audit model, Vitest with enforced engine coverage thresholds,
  Tailwind v4, Zod, Zustand.
- **v0.9.0 note**: added the small-grid **Small Battery** (`SmallBlockSmallBatteryBlock`,
  50 kWh) that was missing, plus Warfare 2 battery reskins, and gave the
  estimator's block palette an inline −/+ stepper so added essentials can be
  removed at the point of add.

The app runs in two modes. **Analyze**: import an exported `.sbc` blueprint
(drag-drop, file picker, or bundled example) and render live thrust-to-weight,
mass, cargo, power, fuel/flight-time, and motion/stability analysis — empty vs.
fully loaded, on any vanilla planet.
**Estimate**: declare your essential gear and goals for a ship you can't export
yet, and get the recommended thruster/power/gyro counts to build it. Both over a
dark, calm UI.

---

## Phase 1 — Core Engine & Blueprint Import (MVP) ← COMPLETE

The MVP delivers the four v1 features on top of imported blueprints. Milestones
are largely sequential: the dataset (M1) and parser (M2) feed the calc engine
(M3), which the UI (M4) renders.

### M1 — Complete & Verified Vanilla Dataset

**Status**: ✅ Complete (v0.2.0, 2026-08-03)

Turn the seed dataset into full, trustworthy vanilla coverage.

**Deliverables:**

- [x] All thruster variants: atmospheric / ion / hydrogen x small+large grid x
      small+large thruster models, with accurate mass, max thrust (N), max
      power draw (W), and planetary-influence effectiveness envelopes (12 total)
- [x] Cargo blocks: all containers (small/large grid, small/medium/large) with
      inventory volume (L) and mass (5 total)
- [x] Power sources: reactors (small/large × both grids), batteries (capacity Wh + I/O rates), solar panels, hydrogen engines, wind turbine
- [x] Other mass/power-relevant blocks needed for realistic totals (cockpits).
      Gyroscopes / common structural deferred until the engine needs them
- [x] Every value cited/verified against the current game version (v1.210.012
      b0); source recorded in `docs/data-audit.md`
- [x] Every block tagged with its content pack (`dlc` field); full verified DLC
      catalogue (21 packs, base through Prosperity) so the UI can restrict the
      block list to owned DLC
- [x] Planet presets verified (gravity m/s^2, atmosphere density); Pertam
      gravity corrected to 1.20 g
- [x] Data-integrity tests extended to cover the full dataset (35 tests)

Known follow-ups (see `docs/data-audit.md`): confirm cockpit inventory volume,
hydrogen-engine / wind-turbine SubtypeIds, and Europa atmosphere density against
local `.sbc` files. Add hydrogen-engine fuel-consumption and reactor uranium
rate when Phase 2 fuel math needs them.

**Full-coverage upgrade (v0.16.0, 2026-08-08):** M1 shipped as a _curated_
dataset extended on demand — every ship using an un-added block showed gaps. That
model was replaced by a build-time generator (`scripts/generate-blocks/`) that
reads the game's own definition files and emits all **1,455 buildable blocks**
(`source: 'definition'`), merged so curated `vanilla` values still win on
conflict. Blueprint resolution now covers the full vanilla set — the "Heavy Space
Fighter" import that motivated this (26 unrecognized subtypes) resolves
completely. See the v0.16.0 note at the top of this file. Def-absent fields
(cargo volume, H2 L/s, drill wattage) remain curated-only.

### M2 — Blueprint (`.sbc`) Import & Parser

**Status**: ✅ Complete — core parser v0.3.0; UI-facing upload + audit wiring landed with M4 (v0.5.0)

Highest payoff-to-effort feature: drag-and-drop a `.sbc`, auto-populate blocks.

**Deliverables:**

- [x] Drag-and-drop / file-picker upload of an exported `bp.sbc` blueprint
      _(delivered in M4, v0.5.0 — wired to `parseBlueprint` via the import screen)_
- [x] XML parser (`fast-xml-parser`) extracting block SubtypeIds, counts, grid
      size, and thruster orientation
- [x] Zod validation at the parse boundary; malformed input produces a
      structured error log with AI metadata and a clear user message
- [x] Map parsed SubtypeIds to dataset definitions; unknown/modded blocks fall
      back to `blueprint` stat source (vanilla-vs-modded handling)
- [x] Resolve thruster orientation to thrust direction (up/down/fwd/etc.) —
      thrust pushes opposite to the exhaust (`BlockOrientation.Forward`)
- [x] Import recorded to the audit trail (`blueprint.import`)
      _(delivered in M4, v0.5.0 — recorded from the store's import action with
      source + match-rate metadata)_
- [x] Parser unit tests with a committed `.sbc` fixture (valid + malformed +
      multi-grid + modded fallback); 16 tests
- [x] Multi-grid (subgrid) blueprints merged, with a diagnostics report
      (grid count, match rate, unrecognized subtypes, unoriented thrusters)

### M3 — Calculation Engine

**Status**: ✅ Complete (v0.4.0, 2026-08-03)

Pure, heavily-tested math in `src/core`. Correctness is the product.

**Deliverables:**

- [x] **Mass**: full breakdown by block category; dry mass and loaded mass
- [x] **Cargo**: total inventory volume (L); loaded mass from fill fraction x
      cargo density; effect of load on totals
- [x] **TWR**: `Total Thrust (N) / (Mass (kg) x Gravity (m/s^2))`, directional
      (up/down/forward/back/left/right), with per-type environment scaling
      (atmospheric scales with air density, ion inverse, hydrogen constant) and
      per-planet gravity presets
- [x] **Empty-vs-loaded comparison** — the killer insight ("TWR 2.3 empty but
      0.8 loaded")
- [x] **Thruster recommender** — "you need X ion thrusters to hover this mass
      on planet Y"
- [x] **Power budget**: total generation vs peak draw; brownout warning when
      draw exceeds supply; battery runtime under load
- [x] Unit tests for every function using **known-good worked examples** with
      documented inputs/expected outputs (22 engine tests, 73 total)

### M4 — Analysis UI

**Status**: ✅ Complete (v0.5.0, 2026-08-03)

Render the engine output with a Linear/Vercel-grade feel.

**Deliverables:**

- [x] Import screen (empty state -> upload -> parsed summary)
- [x] Block list with categories, quantities, and stat-source badges
      (vanilla / blueprint / user)
- [x] Planet selector driving live recalculation
- [x] TWR panel: directional readouts, empty-vs-loaded toggle, thruster
      recommender
- [x] Mass breakdown panel
- [x] Power budget panel with brownout + battery-runtime warnings
- [x] Cargo loadout control (fill fraction, density) feeding the comparison
- [x] Loading / empty / error states throughout; Zustand store wiring
- [x] Component tests for critical UI logic (formatter, store actions, TWR
      pass/fail + brownout rendering — 30 UI tests, 103 total)

---

## Phase 1.5 — Design From Scratch / Requirement Estimator

The inverse of blueprint import: you can't export a `.sbc` until _after_ a ship
is built, so this lets you plan the build up front. Delivered as a second
top-level app mode alongside Analyze, sharing the same UI kit and design tokens.

### M4.5 — Requirement Estimator

**Status**: ✅ Complete (v0.6.0, 2026-08-03)

Declare your essential gear + goals; the app estimates the propulsion, power,
and attitude hardware you need.

**Deliverables:**

- [x] **Functional-block dataset expansion** — gyroscopes, drills, welders,
      grinders, connectors/collectors, lights, beacons, antennas, sensors/
      cameras/ore-detectors, and logic blocks across both grids, plus the new
      `BlockCategory` values and `GyroscopeBlock` / `UtilityBlock` schema shapes
- [x] **`estimateRequirements` engine** (`src/core/engine/estimate.ts`) — sizes
      thrusters per direction (target up-TWR + lateral fraction), power blocks
      (battery discharge + runtime target, or producer output) to cover peak
      draw, and a torque-per-mass gyro heuristic, iterating to a fixed point;
      returns achieved TWR, dry/loaded mass, peak draw vs. supply, and warnings
- [x] **Estimator store** (`useEstimatorStore`) + **`useEstimate`** derived hook,
      following the design-store conventions (inputs only, derived on demand,
      clamping, structured logging); fully independent of the design store
- [x] **Top-level mode switch** in the app header (Analyze ↔ Estimate),
      persisted to localStorage; existing analyze flow untouched
- [x] **Essentials builder** — grid-size gate + searchable, category-grouped
      block palette (propulsion/power/gyros excluded) with quantity steppers and
      a running block-count/mass tally
- [x] **Build-goals panel** — planet, target-TWR & lateral-thrust sliders,
      thruster picker grouped by type with feasibility hints, battery-or-
      generator power source with runtime target, maneuverability control, cargo
- [x] **Recommendations panel** — per-direction thruster counts (UP emphasized),
      power count + supply-vs-draw meter, gyro count badged as an _estimate_,
      resulting mass & achieved TWR (zero-g handled), prominent warnings, and an
      import-to-verify note; empty / live / infeasible states all shipped
- [x] Estimator store + recommendations-panel render tests (33 new tests, 136
      total)

---

## Phase 2 — Flight Dynamics & Fuel

Deeper physics once the core loop is solid.

### M5 — Fuel & Flight Time

**Status**: ✅ Complete (v0.7.0, 2026-08-03)

**Deliverables:**

- [x] Hydrogen fuel burn rate per thruster and total H2 capacity
- [x] Flight-time / hover-time estimates under a given load
- [x] Reactor uranium consumption over time
- [x] Solar day/night sizing guidance

Delivered as the pure fuel engine (`src/core/engine/fuel.ts`) plus a Fuel panel
in Analyze mode (`src/ui/panels/FuelPanel.tsx`, fed by the `useFuel` hook) that
recomputes live with the current planet + cargo loadout. Headlines hover time on
a full tank for hydrogen ships (with a can't-hover verdict and a zero-g case),
shows reactor uranium burn with a "1 kg lasts X" readout, and falls back to a
tidy electric/solar empty state.

### M6 — Motion & Stability

**Status**: ✅ Complete (v0.8.0, 2026-08-03)

**Deliverables:**

- [x] Dampener stopping distance from current velocity and available thrust
- [x] Center-of-mass vs thrust-center alignment check
- [x] Gyroscope count vs mass -> turn-rate estimate

Delivered as the pure motion engine (`src/core/engine/motion.ts`) plus a Motion
panel in Analyze mode (`src/ui/panels/MotionPanel.tsx`, fed by the `useMotion`
hook) that recomputes live with the current planet + cargo loadout. The blueprint
parser now preserves per-block grid positions from each `<Min>`, so imported
blueprints carry the geometry the center-of-mass and thrust-alignment analyses
need. The panel offers a speed control (100 / 50 m/s presets + free entry)
driving per-direction stopping distance/time (with a "won't stop" state), an
estimate-badged gyro turn-rate (time to 90°, torque, angular accel, with a
"no gyroscopes" case), and a thrust-center alignment insight surfacing the worst
off-center thrust ("your UP thrust is offset X m — expect rotation"), degrading
to a "needs block positions" note for geometry-less designs.

### Phase 2 status

Both M5 (Fuel & Flight Time) and M6 (Motion & Stability) are complete — **Phase 2
is complete** as of v0.8.0.

---

## Phase 2.5 — Editable Design Model & Estimator Depth

The two app modes grew up separately: **Analyze** runs the full engine
(directional TWR, mass, power, fuel, motion) but only on a `ShipDesign` parsed
from a `.sbc`; **Estimate** sizes hardware from goals but emits a recommendation
list, not an inspectable design. Three user-requested features all want the same
missing piece — **a mutable in-memory `ShipDesign` the Analyze engine can run on
regardless of where it came from** (parsed blueprint, estimator output, or
hand-edited). Build that once and the rest hang off it.

### M6.5 — Editable Design Model + Per-Direction Thruster Mix

**Status**: ✅ Mostly complete (v0.11.0) — per-direction mix + directional TWR
readout shipped; the store-backed mutable loadout state is deferred into M6.7 (its
real consumer: seeding an Estimate build from an imported blueprint).

The foundational plumbing plus the highest-value features it unlocks. The pure
`estimateToDesign` bridge (a geometry-less `ShipDesign` the Analyze engine runs
on unchanged) is the foundational piece; the store-backed _mutable_ loadout state
is only worth building alongside blueprint-seeded builds, so it moved to M6.7.

**Deliverables:**

- [~] **Editable design model** — the pure half shipped: `estimateToDesign`
  synthesizes a `ShipDesign` the existing Analyze engine (`twr`, `mass`,
  `power`, …) runs on unchanged, decoupled from the parse step. The
  _store-backed mutable loadout_ half is deferred to M6.7, where seeding an
  Estimate build from an imported blueprint and adjusting it is the consumer
  that needs it.
- [x] **Per-direction thruster type** — `config.thruster` generalized to
      `thrusters: Record<Direction, ThrusterBlock>` (`uniformThrusters(block)`
      keeps the single-type default unchanged). The convergence loop sizes each
      direction's group with its own type's thrust / draw / atmosphere curve, and
      peak power draw is measured per-axis from the actual per-direction draw.
      Serves the "flat atmospheric on vertical/fore/aft, something else on the
      sides" case directly. UI: a "Customize by direction" disclosure with six
      per-axis selects (each "Same as default" until pinned).
- [x] **Directional TWR readout in Estimate** — the estimated build feeds the
      _same_ TWR engine used in Analyze (via `estimateToDesign`) into a new panel:
      six-axis bars, Empty/Loaded toggle, UP emphasized, per-direction thruster
      captions when the build mixes types. Answers "can I stay airborne if I tilt
      fully to one side?" A round-trip test proves it reproduces the estimator's
      own `achievedUpTwr` through the real engine.
- [x] **Calm mixed-feasibility UI** — a dead lateral axis gets a soft per-axis
      warning (that axis sized to 0) while the rest of the build still sizes; a
      dead UP axis hard-stops with a clear "can't lift" message. Extends the
      v0.10.2 divergence guard per-direction; no runaway numbers.
- [x] Worked-example tests for per-direction sizing (mixed types,
      one-infeasible-direction, default-single-type unchanged) + the
      `estimateToDesign` round-trip test.

### M6.6 — Ranked Thruster-Type Suggestions

**Status**: ✅ Complete (v0.12.0)

The honest form of "recommend a thruster type for these sliders": not a black-box
auto-pick, but a **ranked list of viable types per direction** so the user stays
the decider and the app removes the arithmetic.

Shipped as per-direction ranked chips inside "Customize by direction": for each
axis, the three thruster types are ranked (feasible first, then fewest thrusters,
then least added mass) with the count each would take and a short trade-off tag
(ion "weak in dense air", hydrogen "needs fuel", atmospheric "n/a here" in
vacuum); a ✓ marks the top feasible pick. Clicking a chip pins that type's
least-added-mass variant to the axis (feeding the M6.5 per-direction config).
Counts are sized against the current build's loaded mass. Locked decision (with
the user): rank the three _types_, each represented by its least-added-mass
variant — not every one of the 7–8 blocks — so the narrow config column stays
calm. Exact arithmetic on the existing dataset (new pure `rankThrusterTypes`),
no new game data.

**Deliverables:**

- [x] For each direction, given planet + required thrust, size the candidate
      thruster types and rank them (e.g. _"UP needs 6.48 MN — Hydrogen: 1 (fuel) /
      Atmospheric: 1 ✓ / Ion: 5 (weak here)"_), with feasibility and trade-off
      tags (fuel dependency, atmosphere fit, mass cost)
- [x] UI surfaces the ranking inline on the per-direction control; picking one
      feeds M6.5's per-direction config
- [x] Tests: ranking correctness at representative planets (Earthlike / Moon /
      space), variant selection, infeasible-type exclusion

### M6.7 — Blueprint as a Base for an Estimate Build

**Status**: ✅ Complete (v0.13.0)

**Not** an in-place blueprint editor. The flow is: **import a `.sbc` → seed an
Estimate build from its block list → adjust the loadout from there → see the
analysis update live.** The blueprint is a _starting point_, not a document you
mutate; the source file is never changed. This is the "platform I load out with
different utilities" case — take a hull you already have and try different gear on
it. It's the reverse of the `estimateToDesign` bridge shipped in M6.5/v0.11.0
(estimate → design): here a parsed design _seeds_ the estimate inputs, and this
milestone owns the store-backed mutable design state that adjusting the loadout
needs.

**Delivered (v0.13.0):**

- [x] **Seed the estimator from a parsed blueprint** — a pure `designToEstimateSeed`
      engine mapper (the exact inverse of `estimateToDesign`): non-sized essentials
      carry their real counts; the dominant thruster + power block preset the config
      _model choices_ (per the locked decision) while the estimator re-sizes _how
      many_. Two entry points: a **Use as estimate base** button on the Analyze
      header, and a **Start from a blueprint** dropzone in Estimate mode (both share
      one read-file-then-parse helper in `src/ui/lib/blueprint-import.ts`).
- [x] **Store-backed mutable loadout** — `seedFromDesign` applies the seed in one
      atomic `set` (never composed from `setGridSize`/`addBlock`, which would clear
      essentials), snapshots the source, and hands back a fully adjustable build the
      Analyze engine runs on unchanged.
- [x] Add / remove / change block counts on the seeded build with live
      recomputation across all analysis panels (already free via `useEstimate`).
- [x] Scope note: **counts/loadout, not geometry.** The seeded build is
      geometry-less; the directional-TWR readout carries a caption that TWR reflects
      the imported ship's mass while thruster counts are re-estimated, not its layout.
- [x] A clear "Adjusted — no longer matches _{source}_" indicator (derived via
      `isAdjustedFromSource`) + **Reset to source**, plus seed diagnostics listing
      modded/unrecognized blocks that couldn't be carried over.
- [x] Tests: engine worked-examples + `estimateToDesign` round-trip, store
      (atomic seed, dirty flip, reset, skipped), UI render (indicator, reset,
      geometry caption).

---

## Phase 3 — Production & Logistics

### M7 — Manufacturing

**Status**: 🚧 In progress — build cost + throughput shipped (v0.14.0, v0.15.0)

**Deliverables:**

- [x] Refinery / assembler throughput and optimal ratios — **v0.15.0**
- [x] Blueprint total resource cost (ore-to-build) — **v0.14.0**
- [ ] Conveyor throughput analysis

**Delivered (v0.14.0):** build-cost analysis for an imported ship. New pure
manufacturing dataset (`src/data/manufacturing.ts`) — ore→ingot refine recipes
(yield + base time), component→ingot recipes (ingot kg + time), per-block
`<Components>` costs keyed by SubtypeId, reskin/variant aliases, and refinery/
assembler throughput presets, all citation-logged in `docs/data-audit.md` with 9
confidence flags. New pure `buildCost(design, opts)` engine (blocks → components
→ ingots → raw ore, with the Assembler-Efficiency divisor and refinery yield/
speed multipliers) + `totalOreMass`/`totalIngotMass` helpers, covered by 13
worked-example tests with hand-verified reference values. New **Build cost** panel
in the Analyze right rail: raw ore (by metal), ingots, refine time, adjustable
refinery/assembler/efficiency, and honest "cost known for N of M block types"
reporting (modded/unrecognized blocks flagged, never zeroed). Locked decisions
(with the user): build cost is the first Phase 3 slice; 1 ore unit = 1 kg;
Assembler-Efficiency ×1 default; refine time is the headline resource metric.

**Delivered (v0.15.0):** manufacturing throughput & optimal fleet ratios, folded
into the Build cost panel (locked decision: shared refinery/assembler pickers, no
duplicate controls). New pure `manufacturingThroughput(cost, opts)` engine
(`src/core/engine/throughput.ts`) built on the build-cost `refineTimeSeconds` /
`assembleTimeSeconds` — no new dataset. Solves **both directions** (locked
decision): forward, `max(refineTime ÷ N, assembleTime ÷ M)` steady-state build
time for a chosen refinery/assembler fleet + bottleneck + per-stage utilization;
inverse, the balanced ratio (`refineTime : assembleTime`) and a suggested integer
refinery count. 11 worked-example tests (stage division, bottleneck each
direction, balance epsilon, per-hour rates, zero/divide-by-zero guards). New
shared `Stepper` component drives the fleet steppers; panel render tests extended
(4 → 7). Bottleneck-bound pipeline model documented as an explicit simplification
in `docs/data-audit.md`. Conveyor throughput (the third M7 deliverable) remains
open — it needs a fresh data pass (transfer rates, port sizes).

**Delivered (v0.17.0):** full vanilla build-cost coverage via a second generator
(`scripts/generate-costs/`, `pnpm generate:costs`) that maps each block's parsed
`<Components>` list to our `ComponentId` model and emits
`src/data/generated-block-costs.ts` — recipes for all **1,455 blocks, 0 skipped, 0
unmapped**. Added 11 components (7 Prototech + ZoneChip + 3 plushies) with recipes
from `Blueprints.sbc`, plus a salvage-ingot model (`PrototechScrap` = 0-ore
pseudo-ingot; `REFINE_RECIPES` → `Partial`). The merged `all-block-costs.ts` makes
**generated recipes authoritative** (curated kept only as fallback for un-emitted
SubtypeIds) after running the generator revealed ~18 curated rows lagged the
current game — the reversal + divergence table are in `docs/data-audit.md` and the
ADR 0002 addendum. Fixed the girder component SubtypeId and the small welder/grinder
recipes along the way. New salvage worked-example tests + `all-block-costs.test.ts`
merge invariants. The reported "Jasen's Miner" import now reads 21/21 costed.

### M8 — Life Support & Combat

**Status**: Not started

**Deliverables:**

- [ ] O2 / H2 generation vs crew size
- [ ] Weapon DPS / ammo consumption math

---

## Phase 4 — Multi-Design & Offline

### M9 — Design Management

**Status**: Not started

**Deliverables:**

- [ ] Save multiple ship designs (local persistence; audit-backed)
- [ ] Compare designs side by side

### M10 — PWA / Offline

**Status**: Not started

**Deliverables:**

- [ ] Installable PWA, offline-capable (was a v1 nice-to-have, deferred)

---

## Backlog

Not designed or committed. Captured for future consideration.

- `.sbc` _definition-file_ parser to regenerate the dataset from game files
  (the schema is already designed for this)
- Modded block library / user-shared stat packs
- Tauri desktop build wrapping the pure `src/core` engine
- Shareable analysis links / export to image
- Subgrid / rotor-connected mass handling
