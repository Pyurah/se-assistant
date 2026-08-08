# SE Assistant — Product Roadmap

> **Last Updated**: 2026-08-07 (v0.11.0)

A Space Engineers ship & base planner: import a blueprint (`.sbc`) and get
instant thrust-to-weight, mass, cargo, and power analysis — empty vs fully
loaded, on any vanilla planet.

---

## 👉 Next session starts here

**Everything through Phase 2 is DONE, committed, and pushed to GitHub**
(`https://github.com/Pyurah/se-assistant`, branch `master`, at v0.11.0). Working
tree is clean and all four gates pass (`typecheck` / `lint` / `test` (238) /
`build`). Nothing is half-finished.

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
recommended build through the *same* trusted TWR engine Analyze uses, via a new
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
The estimator sized power against *all six* thruster directions at full draw,
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
`docs/data-audit.md`. Known coverage gap: only the armor *shapes* and DLC blocks
seen so far are in the set; heavy armor, large-grid armor, and other shape
variants are added on demand the same way.

**The next unit of work is Phase 2.5 — M6.6 (Ranked Thruster-Type
Suggestions), then M6.7 (Edit an Imported Blueprint).** M6.5 shipped its two
highest-value features in v0.11.0 — per-direction thruster mixing and the
directional TWR readout in Estimate — built on the pure `estimateToDesign`
bridge (a geometry-less `ShipDesign` the Analyze engine runs on unchanged). The
one M6.5 deliverable deliberately deferred is the fully store-backed *mutable*
loadout state; it's folded into M6.7, where seeding an Estimate build from an
imported blueprint and adjusting its loadout is the real consumer that needs it.
`estimateToDesign` is the (reverse-direction) seed for that. Follow the established rhythm: extend the engine in
`src/core/engine` with worked-example tests → build the UI via the web-ui-builder
agent → bump version + CHANGELOG + roadmap. No new game *data* is required
(unlike Phase 3), so it's a lighter lift.

**Phase 3 — Production & Logistics (M7 + M8) is still queued** after 2.5. Note
its data lift when the time comes: M7/M8 need NEW game data that isn't in the
dataset yet — **component recipes, refinery/assembler conversion ratios +
processing times, and block build-costs** (ore → ingot → component → block).
That's a bigger research pass than Phase 2 needed: research the numbers with a
subagent (cite in `docs/data-audit.md`, flag anything unconfirmed) → extend the
schema/dataset → build the pure engine with worked-example tests → build the UI
panel → bump version.

If instead the user wants polish over new features: candidate small wins are a
GitHub Actions CI workflow (run the four gates on push), README screenshots, or
resolving the flagged-uncertain data values in `docs/data-audit.md` (some DLC
SubtypeIds, drill/sensor wattages) against a live game install.

---

## Current State

- **Version**: 0.11.0
- **Repo**: pushed to `https://github.com/Pyurah/se-assistant` (`master`);
  commits use the GitHub no-reply email (real email scrubbed from history).
- **Build**: passing (`pnpm build`)
- **Tests**: passing — 238 tests across logger, audit, data-integrity, engine
  (incl. `estimateRequirements`, the `estimateToDesign` bridge, the fuel/flight-time
  engine, and the motion/stability engine), blueprint parser, number formatter,
  stores, and UI-rendering suites
- **Phase**: Phases 1, 1.5, and 2 all COMPLETE. M1 dataset, M2 blueprint parser,
  M3 calc engine, M4 analysis UI, M4.5 requirement estimator, M5 fuel/flight
  time, M6 motion/stability — all delivered. React 19 + Vite + TypeScript SPA,
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
- [x] Power sources: reactors (small/large × both grids), batteries (capacity Wh
      + I/O rates), solar panels, hydrogen engines, wind turbine
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

### M2 — Blueprint (`.sbc`) Import & Parser

**Status**: ✅ Complete — core parser v0.3.0; UI-facing upload + audit wiring landed with M4 (v0.5.0)

Highest payoff-to-effort feature: drag-and-drop a `.sbc`, auto-populate blocks.

**Deliverables:**

- [x] Drag-and-drop / file-picker upload of an exported `bp.sbc` blueprint
      *(delivered in M4, v0.5.0 — wired to `parseBlueprint` via the import screen)*
- [x] XML parser (`fast-xml-parser`) extracting block SubtypeIds, counts, grid
      size, and thruster orientation
- [x] Zod validation at the parse boundary; malformed input produces a
      structured error log with AI metadata and a clear user message
- [x] Map parsed SubtypeIds to dataset definitions; unknown/modded blocks fall
      back to `blueprint` stat source (vanilla-vs-modded handling)
- [x] Resolve thruster orientation to thrust direction (up/down/fwd/etc.) —
      thrust pushes opposite to the exhaust (`BlockOrientation.Forward`)
- [x] Import recorded to the audit trail (`blueprint.import`)
      *(delivered in M4, v0.5.0 — recorded from the store's import action with
      source + match-rate metadata)*
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

The inverse of blueprint import: you can't export a `.sbc` until *after* a ship
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
      power count + supply-vs-draw meter, gyro count badged as an *estimate*,
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
on unchanged) is the foundational piece; the store-backed *mutable* loadout state
is only worth building alongside blueprint-seeded builds, so it moved to M6.7.

**Deliverables:**

- [~] **Editable design model** — the pure half shipped: `estimateToDesign`
      synthesizes a `ShipDesign` the existing Analyze engine (`twr`, `mass`,
      `power`, …) runs on unchanged, decoupled from the parse step. The
      *store-backed mutable loadout* half is deferred to M6.7, where seeding an
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
      *same* TWR engine used in Analyze (via `estimateToDesign`) into a new panel:
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

**Status**: Not started

The honest form of "recommend a thruster type for these sliders": not a black-box
auto-pick, but a **ranked list of viable types per direction** so the user stays
the decider and the app removes the arithmetic.

**Deliverables:**

- [ ] For each direction, given planet + required thrust, size *every* candidate
      thruster type and rank them (e.g. _"UP needs 1.2 MN — Atmospheric: 3 ✓ /
      Hydrogen: 2 (needs fuel) / Ion: 9 (weak here)"_), with feasibility and
      trade-off tags (fuel dependency, atmosphere fit, mass cost)
- [ ] UI surfaces the ranking inline on the per-direction control; picking one
      feeds M6.5's per-direction config
- [ ] Tests: ranking correctness at representative planets (Earthlike / Moon /
      space), infeasible-type exclusion

### M6.7 — Blueprint as a Base for an Estimate Build

**Status**: Not started

**Not** an in-place blueprint editor. The flow is: **import a `.sbc` → seed an
Estimate build from its block list → adjust the loadout from there → see the
analysis update live.** The blueprint is a *starting point*, not a document you
mutate; the source file is never changed. This is the "platform I load out with
different utilities" case — take a hull you already have and try different gear on
it. It's the reverse of the `estimateToDesign` bridge shipped in M6.5/v0.11.0
(estimate → design): here a parsed design *seeds* the estimate inputs, and this
milestone owns the store-backed mutable design state that adjusting the loadout
needs.

**Deliverables:**

- [ ] **Seed the estimator from a parsed blueprint** — an import path that
      populates the Estimate build's essentials/loadout from a `.sbc`'s block
      list (the inverse of `estimateToDesign`), so the user starts from a real
      hull instead of a blank slate.
- [ ] **Store-backed mutable loadout** — adjustable design state the Analyze
      engine runs on unchanged (both a seeded blueprint and a from-scratch
      estimate produce one; mutation lives in the store, the model stays pure
      data).
- [ ] Add / remove / change block counts on the seeded build with live
      recomputation across all analysis panels
- [ ] Scope note: **counts/loadout, not geometry.** Center-of-mass and
      thrust-alignment (Motion) depend on block *placement*, which a 2D web editor
      can't meaningfully change; geometry-dependent readouts are flagged as
      "reflects the original layout" when only counts were adjusted
- [ ] A clear "adjusted — no longer matches the source file" indicator + reset
- [ ] Tests: seed-from-blueprint round-trip, loadout-adjust recompute,
      geometry-flag behavior

---

## Phase 3 — Production & Logistics

### M7 — Manufacturing

**Status**: Not started

**Deliverables:**

- [ ] Refinery / assembler throughput and optimal ratios
- [ ] Blueprint total resource cost (ore-to-build)
- [ ] Conveyor throughput analysis

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
