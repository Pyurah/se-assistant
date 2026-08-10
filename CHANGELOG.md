# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and this project adheres to
[Semantic Versioning](https://semver.org/).

## [0.17.0] - 2026-08-09

### Added

- **Build-cost generator — full vanilla cost coverage from the game's own files.**
  A new build-time tool (`pnpm generate:costs`) reads the installed Space
  Engineers definition files (`Content/Data/CubeBlocks/*.sbc` + `Components.sbc`),
  maps each block's `<Components>` list to our component model, and emits
  [`src/data/generated-block-costs.ts`](./src/data/generated-block-costs.ts) —
  **build recipes for all 1,455 buildable blocks** (0 skipped, 0 unmapped). The
  Build-cost panel now covers the entire vanilla catalogue: "Jasen's Miner" reads
  **21 of 21 block types** instead of 11 of 21. New game versions are a
  regenerate, not a hand-transcription session.
- **Merged cost dataset** ([`src/data/all-block-costs.ts`](./src/data/all-block-costs.ts)):
  generated recipes are authoritative and **win on any subtypeId conflict**; the
  hand-curated `BLOCK_COMPONENT_COSTS` is retained only as a fallback for the few
  blocks whose game SubtypeId the generator does not emit (e.g. the hydrogen
  engines / oxygen generator, which the archived data named differently).
- **11 new components** — 7 Prototech (`PrototechFrame`, `PrototechPanel`,
  `PrototechCapacitor`, `PrototechPropulsionUnit`, `PrototechMachinery`,
  `PrototechCircuitry`, `PrototechCoolingUnit`) + `ZoneChip` + 3 plushies — with
  recipes from `Blueprints.sbc`. Prototech blocks (jump drive, reactor, thruster,
  battery, drill, gyro, assembler, O2 gen) now self-cost.
- **Salvage-ingot model.** `PrototechScrap` is a salvage-only pseudo-ingot: it is
  ground from endgame Prototech blocks, never mined. It counts toward ingot mass
  and shows on its own "salvaged, not mined" line, but contributes **zero ore**
  and zero refine time. `PrototechFrame`, `ZoneChip`, and the plushies are
  no-mineable-input salvage/novelty components (0 ore).
- `pnpm generate:costs:check` — a CI drift guard (where the game is available)
  that regenerates in memory and diffs the committed file.

### Changed

- **Build-cost data is now game-file-authoritative.** Repointing the engine at
  the generated recipes surfaced ~18 curated rows that lagged the current game
  (rebalanced solar-panel, battery, and atmospheric-thruster costs; a missing
  `metal-grid` on the refinery; a `bulletproof-glass` on the large cockpit the
  current files omit). The generated values now win — see the reversal noted in
  [ADR 0002](./docs/adr/0002-generated-block-dataset.md) and the divergence table
  in [`docs/data-audit.md`](./docs/data-audit.md).
- `REFINE_RECIPES` is now `Partial<Record<Metal, RefineRecipe>>` — salvage ingots
  (`prototech-scrap`) have no refine recipe, and the type system enforces that the
  ore-totals pass skips them rather than fabricating un-mineable ore.

### Fixed

- **Girder component SubtypeId** (`GirderComponent` → `Girder`) — the wrong id
  meant girder-using blocks (small solar panel, wind turbine) could not resolve
  their build cost. Restores their coverage.
- **Small welder / grinder recipes** carried a spurious `large-tube: 1` not in the
  current game files (the large variants were already correct) — corrected to
  match `CubeBlocks.sbc`.

## [0.16.0] - 2026-08-08

### Added

- **Block dataset generator — full vanilla coverage from the game's own files.**
  A new build-time tool (`pnpm generate:blocks`) reads the installed Space
  Engineers definition files (`Content/Data/CubeBlocks/*.sbc`, `Components.sbc`,
  and the localization `.resx`) and emits
  [`src/data/generated-blocks.ts`](./src/data/generated-blocks.ts) — **1,455
  buildable blocks** tagged `source: 'definition'`, with mass derived from each
  block's `<Components>` list and physics stats (thrust, power, torque, battery
  I/O and capacity) read straight from the definition. Committed to the repo so
  CI and other contributors never need the game installed.
- **Merged block dataset** ([`src/data/all-blocks.ts`](./src/data/all-blocks.ts)):
  generated definitions fill gaps while curated `source: 'vanilla'` blocks **win
  on any subtypeId conflict** — hand-verified stats are never overwritten. The
  blueprint resolver now matches this full set, so the "Heavy Space Fighter"
  blueprint's 26 formerly-unrecognized subtypes (heavy-armor shape family, SciFi
  thrusters, Warfare 2 weapons, merge block, projector, air vent) resolve with
  real mass instead of landing as `mass: 0` placeholders.
- `pnpm generate:blocks:check` — a CI drift guard (where the game is available)
  that regenerates in memory and diffs the committed file.

### Changed

- Blueprint block resolution ([`resolve-block.ts`](./src/core/blueprint/resolve-block.ts))
  now reads the merged `BLOCKS_BY_SUBTYPE` instead of the curated-only map. The
  estimator and other trusted-stat consumers stay curated-scoped by design.

### Notes

- Definition-sourced **mass and physics are trusted**. Fields the game computes
  rather than stores literally — cargo inventory volume, hydrogen L/s burn rates,
  drill/tool operating wattage — are intentionally omitted from generated entries
  and remain curated-only (see [`docs/data-audit.md`](./docs/data-audit.md)).
- Two Prototech thrusters (`ThrusterType: Prototech`, outside the vanilla
  `atmospheric | ion | hydrogen` union) are correctly emitted as mass-only
  `'other'` rather than fabricated thrusters.
- Regenerating `BLOCK_COMPONENT_COSTS` (build-cost data) from the parsed
  `<Components>` is a planned fast-follow — this release covers block
  definitions (mass + physics) only.

## [0.15.0] - 2026-08-08

### Added

- **Manufacturing throughput & optimal fleet ratios.** The Build cost panel now
  answers "how long will this ship take to build, and what's the bottleneck?" —
  enter a fleet (N refineries, M assemblers) and get the pipelined **steady-state
  build time** (`max(refine ÷ N, assemble ÷ M)`), which stage is the bottleneck,
  and each stage's time against the other. It also solves the inverse: the
  **balanced ratio** (refineries per assembler) and a suggested integer refinery
  count that keeps neither stage idle.
- Shared **`Stepper`** component (controlled −/＋ integer stepper) driving the
  fleet-size controls.

### Notes

- The build-time model is bottleneck-bound: it assumes refining and assembling
  pipeline (the slower stage governs) and ignores pipeline fill/drain — an
  explicit, documented simplification (see [`docs/data-audit.md`](./docs/data-audit.md)),
  negligible against a whole-ship batch.

## [0.14.0] - 2026-08-08

### Added

- **Build cost analysis.** The Analyze view now reports what it takes to
  _construct_ an imported ship: total **raw ore** to mine (broken down by metal),
  total ingots, and the **refine time** to process it — computed by walking the
  manufacturing chain in reverse (blocks → components → ingots → raw ore) with
  exact arithmetic on the game's recipes. A new **Build cost** panel sits in the
  Analyze dashboard's right rail.
- **Adjustable manufacturing settings.** Toggle Refinery vs Basic Refinery,
  Assembler vs Basic Assembler, and the world's Assembler-Efficiency (×1 / ×3 /
  ×10) — the ore totals and times recompute live, since a Basic Refinery's lower
  yield materially changes how much ore a ship really costs.
- **Honest coverage reporting.** Blocks the dataset has no recipe for (modded,
  or not-yet-transcribed vanilla blocks) are listed as "cost unknown" chips with
  a "cost known for N of M block types" count — never silently costed as zero.
  Reskin/variant blocks map to their base recipe.
- New manufacturing dataset (`src/data/manufacturing.ts`): ore→ingot refine
  recipes, component→ingot recipes, per-block component costs, and refinery/
  assembler throughput presets — every value citation-logged in
  [`docs/data-audit.md`](./docs/data-audit.md) with confidence flags.

## [0.13.0] - 2026-08-07

### Added

- **Seed an Estimate build from an imported blueprint.** A parsed `.sbc` can now
  pre-fill an Estimate build: essentials (drills, cargo, cockpit, tools) carry
  over with their real counts, and the ship's dominant thruster + power block
  preset the Estimate config's _model choices_ — while the estimator re-sizes
  _how many_ are needed for the target TWR. It is explicitly not an in-place
  blueprint editor: the source `.sbc` is never mutated; it's read once,
  snapshotted, and a fresh mutable build is handed over. Two entry points: a
  **Use as estimate base** button on the Analyze view (seeds + switches to
  Estimate), and a **Start from a blueprint** dropzone in Estimate mode.
- **Adjusted-vs-source indicator + one-click reset.** Once seeded, Estimate mode
  shows "Matches _{source}_" or "Adjusted — no longer matches _{source}_" as you
  change counts, cargo, planet, or the thruster/power config, with a **Reset to
  source** button that re-seeds from the snapshot. The dirty check is derived, so
  it is always correct (sized-block counts are excluded — they're re-estimated,
  never seeded).
- **Seed diagnostics for skipped blocks.** Modded / unrecognized blocks that
  can't round-trip through the id-based estimator are listed as chips ("N block
  types not carried over") rather than silently dropped, and a caption flags that
  the directional TWR reflects the imported ship's mass while thruster counts are
  re-estimated, not its original layout.

### Changed

- Extracted the sized-category set to a shared `SIZED_CATEGORIES` constant in
  `src/data` so the engine seed mapper and the essentials palette agree on which
  categories the estimator sizes (thrusters, power, gyros) vs. carries over.

## [0.12.0] - 2026-08-07

### Added

- **Ranked thruster-type suggestions per direction (Estimate mode).** Inside
  "Customize by direction," each axis now shows the three thruster types ranked
  for the current build — feasible types first, then fewest thrusters, then least
  added mass — each as a one-click chip with the count it would take and a short
  trade-off note (e.g. ion "weak in dense air", hydrogen "needs fuel",
  atmospheric "n/a here" in vacuum). A ✓ marks the top feasible pick. Clicking a
  chip pins that type's least-added-mass variant to the axis, feeding the existing
  per-direction config. Counts are sized against the current build's loaded mass.
  The ranking is exact arithmetic on the existing block dataset (a new pure
  `rankThrusterTypes` engine function), so it needs no new game data.

## [0.11.0] - 2026-08-07

### Added

- **Per-direction thruster mixing in Estimate mode.** The recommended build can
  now use a different thruster type per axis — e.g. flat atmospheric on the
  vertical/fore/aft axes with ion on the sides. A "Customize by direction"
  disclosure under the thruster picker exposes six selects (up/down/forward/
  backward/left/right), each defaulting to "Same as default"; a pinned selection
  overrides just that axis. The estimator sizes each direction against its own
  thruster and the power budget now measures peak draw per axis from the actual
  per-direction thruster draw (the larger side of each opposing pair).
- **Directional TWR readout in Estimate mode.** A new panel shows the recommended
  build's six-axis thrust-to-weight — the same bars Analyze shows — with an
  Empty/Loaded toggle and UP emphasized. It answers "can I hold altitude tilted
  fully onto one axis?" for a build you haven't exported yet, and per-direction
  thruster captions appear when the build mixes types. The bars run through the
  same trusted TWR engine as Analyze via a new pure `estimateToDesign` bridge
  that synthesizes a geometry-less `ShipDesign` from the estimate.

### Changed

- The estimator config now carries a per-direction thruster map
  (`EstimatorConfig.thrusters: Record<Direction, ThrusterBlock>`) instead of a
  single `thruster`; a `uniformThrusters(block)` helper builds the common
  single-type case. A dead lateral axis is now flagged with a soft per-axis
  warning rather than blocking the whole estimate, while a dead UP axis still
  hard-stops with a clear "can't lift" message.

## [0.10.2] - 2026-08-07

### Fixed

- **Estimator no longer over-sizes batteries.** A small-grid mining ship
  (cockpit, 3 drills, connector, ore detector) on atmospheric thrusters was told
  it needed **4 warfare batteries**; it now needs far fewer. The estimator sized
  power against _every_ thruster direction firing at once, but opposing thrusters
  (up/down, fwd/back, left/right) never fire together — the same realism the
  power-budget analyzer already applies. Peak draw (and the battery count it
  drives) now counts only the larger side of each opposing pair. In the reported
  case peak draw dropped from ~12.6 MW to ~4.8 MW.
- **Estimator no longer emits absurd counts for an unliftable thruster choice.**
  Sizing a thruster type that can't lift the ship on the chosen planet (e.g. ion
  in dense atmosphere) sent the mass↔count convergence loop running away — one
  case reached tens of trillions of batteries before the iteration cap. It now
  short-circuits with an infeasible estimate (zero counts) and a clear "can't
  lift this ship — try a stronger thruster, a lower target TWR, or less cargo"
  warning.

## [0.10.1] - 2026-08-07

### Fixed

- **Estimator gyro count is now grid-aware and no longer over-recommends on
  small-grid ships.** A small-grid utility ship (3 welders, a cockpit, a small
  cargo container — ≈6 t loaded) was recommended **3 gyros** where the real
  build flies fine on 2; it now recommends 1. Root cause: the torque-per-kg
  target was calibrated only for the large grid (1 gyro per ~200 t) and applied
  unchanged to small-grid ships, then divided by the 75×-weaker small gyro — a
  compounding over-count. The target now scales by the square of the grid
  cell-size ratio `(cell / large_cell)²`, matching the moment-of-inertia model
  (`I ∝ m·s²`) the motion engine already uses: a small-grid ship's inertia per
  kg is 1/25 of a large-grid ship's, so it needs ~1/25 the torque-per-kg. The
  large-grid calibration is unchanged. Cited in `docs/data-audit.md`.

## [0.10.0] - 2026-08-07

### Added

- **Cargo contents picker.** The cargo loadout control now lets you choose a real
  game item — Ingots (Iron, Gold, Uranium, Platinum, …), Ores, or Components
  (Steel Plate, Computer, Power Cell, …) — and derives the cargo density from that
  item's exact mass and volume. This replaces the old "custom kg/L" field, which
  was confusing because the game shows every item as a **mass** (kg) _and_ a
  **volume** (L), never a density. For anything not in the list you can still enter
  a **Mass** and **Volume** directly and the app computes the density for you.
- **Cargo item dataset** (`src/data/cargo-items.ts`) — 44 haulable items (ingots,
  ores, components) with mass/volume copied verbatim from the installed game's
  `Components.sbc` and `PhysicalItems.sbc` (SE v1.210.012 b0), guarded by
  data-integrity tests. Cited in `docs/data-audit.md`.

### Fixed

- **Power budget no longer invents brownouts.** Two aggregation bugs are fixed:
  - **Opposing thrusters were double-counted.** Peak draw summed every thruster,
    including up-vs-down / forward-vs-back / left-vs-right pairs that can't fire
    at once. It now counts only the larger side of each opposing pair (plus all
    non-thruster draw), matching what the ship actually pulls at full throttle.
  - **Battery-only ships showed "0 W generation" and a permanent brownout.**
    Available power is now generation **plus** battery discharge, so a ship run
    entirely on batteries reads as supplied — a brownout appears only when peak
    draw genuinely exceeds all available power. A real imported ship (the
    "Rapier") that flies fine on batteries no longer reports a false deficit.

  These are corrections to how power is aggregated; no block stat changed.

## [0.9.2] - 2026-08-07

### Fixed

- **Directional thrust is now reported relative to the ship's main cockpit**, so
  forward / up / left / right match what the pilot sees on the in-game HUD.
  Previously thrust was bucketed by raw grid axes, so a ship whose cockpit is
  rotated relative to the grid showed thrust on the wrong axes — a real imported
  ship (the "Rapier") reported **zero forward thrust** despite having two
  forward-facing thrusters, because that force landed on the grid's "right" axis.
  The parser now derives the pilot frame from the main cockpit's orientation
  (the `<IsMainCockpit>` cockpit, or the sole cockpit if only one exists) and
  rotates every thruster's thrust direction into it. Verified against the game's
  own thrust overlay for the Rapier: up 920 kN, forward/back 460 kN, left/right
  288 kN, and nothing pushing "down" (that ship hovers on lift vs. gravity).
  Ships with no cockpit (e.g. drones) fall back to grid axes, and the block-list
  diagnostics say which frame is in use.

## [0.9.1] - 2026-08-07

### Added

- **8 DLC / base blocks** that real imported ships use but the dataset was
  dropping as "unrecognized" — sourced directly from the installed game's
  definition files (`CubeBlocks/*.sbc` + `Components.sbc`), the authoritative
  source. Block mass is computed from the component list; the method was
  validated by reproducing a known value (small atmospheric thruster = 699 kg).
  - Thrusters: `SmallBlockLargeFlatAtmosphericThrustDShape` (230 kN, 1060 kg),
    `SmallBlockSmallAtmosphericThrustSciFi` (Sparks of the Future reskin, 96 kN).
  - Cargo: `SmallBlockModularContainer` (Contact reskin of the Medium container,
    3375 L, 463 kg).
  - Welder: `SmallShipWelderReskin` (Apex Survival reskin, 448.4 kg).
  - Conveyors: `SmallShipConveyorHub` (313 kg), `ConveyorTubeCurvedMedium`
    (365 kg) — the first `conveyor`-category blocks in the dataset.
  - Armor: `SmallBlockArmorBlock`, `SmallBlockArmorSlope` (small-grid light
    armor, 20 kg each) — the first `structural`-category blocks.
- Two DLC packs added to the catalogue to tag the reskins: **Apex Survival**
  (`apex-survival`) and **Scrap Race** (`scrap-race`).

### Fixed

- **Missing thruster orientation no longer drops thrust from TWR.** Space
  Engineers omits `<BlockOrientation>` when a block is at its default identity
  orientation (`Forward="Forward"`); the parser was treating a missing element
  as "unoriented" and excluding that thruster from directional TWR, undercounting
  thrust. A missing orientation now correctly defaults to `Forward`. Only an
  orientation that is present but has an unparseable axis is still counted as
  unoriented. A real DLC-built ship that previously imported with 40/48 blocks
  unrecognized and 2 unoriented thrusters now resolves 48/48, 0 unrecognized,
  0 unoriented.

## [0.9.0] - 2026-08-03

### Added

- **Small Battery** (`SmallBlockSmallBatteryBlock`) — the compact 1×1×1 small-
  grid battery (50 kWh capacity, 200 kW I/O, 146.4 kg), which was missing. It's
  the right choice for light small-grid ships where the 1 MWh Battery is
  oversized. Both existing batteries were re-verified against the wiki (correct).
- **Warfare Battery** variants (Warfare 2 DLC) for both grids — stat-identical
  reskins of the base Battery, tagged `warfare-2` so DLC filtering can hide them.

### Changed

- **Estimator essentials builder**: palette blocks that have been added now show
  an inline −/count/+ stepper in place of the plain add button, so a mis-added
  block can be decremented or removed right where you clicked, without scrolling
  to the "Your essentials" list. (The per-item remove/stepper in that list is
  unchanged.)

## [0.8.0] - 2026-08-03

### Added

- **Motion & Stability (M6)** — a motion/stability engine and the Motion panel
  that consumes it in Analyze mode, alongside the TWR / Mass / Power / Fuel
  panels and recomputing live with the current planet + cargo loadout.
  - **Motion engine** (`src/core/engine/motion.ts`): dampener stopping distance
    (distance/time/deceleration from a given speed using the braking thrust
    opposing travel, Infinity when there's no opposing thrust); mass-weighted
    center of mass; thrust-center vs. center-of-mass alignment per direction
    (offset vector + magnitude in meters); and a gyro turn-rate estimate (total
    torque, approximate solid-cube moment of inertia, angular acceleration, and
    time to a 90° turn, with a mass-based fallback when geometry is absent).
    Exposed as `stoppingDistance`, `centerOfMass`, `thrustCenterAlignment`,
    `turnRateEstimate`, and `hasGeometry`.
  - **Block-position support in the blueprint parser** (`src/core/blueprint`):
    each block's grid-cell positions are now preserved from its `<Min>` element,
    so imported blueprints carry the per-instance geometry the center-of-mass and
    thrust-alignment analyses require. Designs built without geometry (the
    estimator) skip those analyses gracefully.
  - **Motion panel** (`src/ui/panels/MotionPanel.tsx`): a speed control (SE's
    default 100 m/s and a 50 m/s preset chip plus a labeled free numeric entry)
    driving per-direction stopping distance + time (forward / up / down), with a
    "no braking thrust — won't stop" state for directions that can't brake and a
    footnote that it ignores per-axis gravity (accurate in space / level flight).
    Turn rate shows time-to-90°, total gyro torque, and angular acceleration,
    clearly badged an estimate (with a "no gyroscopes" case). Center-of-mass /
    thrust alignment surfaces the worst off-center thrust as an actionable
    warning ("UP thrust is offset 3.2 m … expect rotation"), a per-direction
    offset list with well-aligned / off-center badges, and a tidy "needs block
    positions — import a blueprint" note for geometry-less designs.
  - **`useMotion` hook** (`src/app/hooks/use-motion.ts`): derives the turn-rate
    estimate, alignment, center of mass, and geometry flag from the store
    (memoized on design/planet like `useAnalysis`) and exposes a
    `stopping(direction, speed)` helper for the panel's speed control.
  - **`formatMeters`** added to the formatter library (meters → "4.91 m" /
    "42.6 m" / "640 m" / "1.24 km" / "∞"), for stopping distances and offsets.
- Motion panel render tests (stopping distance shown vs. "won't stop", turn-rate
  estimate + "no gyroscopes", off-center thrust warning, and the "needs block
  positions" no-geometry note) and `formatMeters` unit tests.

## [0.7.0] - 2026-08-03

### Added

- **Fuel & Flight Time (M5)** — a new fuel/flight-time engine and the Fuel panel
  that consumes it in Analyze mode, sitting alongside the TWR / Mass / Power
  panels and recomputing live with the current planet + cargo loadout.
  - **Fuel engine** (`src/core/engine/fuel.ts`): total hydrogen capacity across
    all tanks; per-thruster and total H2 burn rate; hover-time and full-throttle
    flight-time estimates on a full tank at a given loaded mass and planet
    (Infinity in zero-g, and a "can't hold a hover" verdict when up-thrust can't
    match weight); reactor uranium consumption (kg/s and kg/h) from electrical
    load and the 1 MWh-per-kg constant; O2/H2 generator output vs. hover burn;
    and solar day/night panel-sizing guidance. Exposed as `fuelSummary`,
    `flightTime`, `hydrogenCapacity`, `maxHydrogenBurn`, `hydrogenGeneration`,
    `uraniumUsage`, and `solarGuidance`.
  - **Fuel dataset fields** (`src/data`): hydrogen-tank `gasCapacity` (L) and
    O2/H2-generator `hydrogenOutput` (L/s) on gas blocks, thruster/engine
    `maxHydrogenConsumption` (L/s), and the `URANIUM_WH_PER_KG` constant
    (`src/data/fuel-constants.ts`).
  - **Fuel panel** (`src/ui/panels/FuelPanel.tsx`): adapts to the ship's
    propulsion/power type. Hydrogen ships lead with HOVER TIME on a full tank
    (with a hover-vs-full-throttle burn meter carrying an O2/H2-generation
    threshold line), H2 capacity, full-throttle time, a prominent can't-hover
    alert, a zero-g "unlimited" case, and generator-sustains / net-deficit
    notes. Reactor ships get uranium burn at peak draw with a "1 kg lasts X"
    readout. Ships with neither show a tidy "no consumable fuel — electric/solar"
    empty state. Battery runtime is cross-referenced lightly.
  - **`useFuel` hook** (`src/app/hooks/use-fuel.ts`): derives `fuelSummary` +
    generator output from the store, memoized on design/planet like `useAnalysis`.
  - **`formatDuration`** added to the formatter library (seconds → "1h 42m" /
    "3.4 min" / "42 s" / "unlimited"), a seconds-based sibling to `formatRuntime`.
- Fuel panel render tests (hover time, can't-hover warning, zero-g unlimited,
  reactor uranium section, electric-only empty state) and `formatDuration` unit
  tests — 26 new tests (162 total).

## [0.6.0] - 2026-08-03

### Added

- **Design From Scratch — Requirement Estimator (new app mode)** — the inverse
  of blueprint import. You can't export a blueprint until _after_ a ship is
  built, so this mode lets you declare your essential gear and goals up front and
  have the app estimate the rest. A top-level segmented control in the app header
  switches between "Analyze blueprint" (existing) and "Estimate build" (new); the
  two modes have fully independent stores and the active mode persists to
  localStorage.
  - **Functional-block dataset expansion** (`src/data/functional-blocks.ts`):
    gyroscopes, drills, welders, grinders, connectors/collectors, lights,
    beacons, antennas, sensors/cameras/ore-detectors, logic blocks
    (programmable/timer/event-controller), and life-support/utility blocks
    (O2/H2 generators, hydrogen/oxygen tanks, survival kit, remote control,
    landing gear) across both grid sizes — all cited in `docs/data-audit.md`,
    with community-sourced/uncertain power values explicitly flagged. Plus the
    new `BlockCategory` values and the `GyroscopeBlock` / `UtilityBlock` schema
    shapes that back them.
  - **`estimateRequirements` engine** (`src/core/engine/estimate.ts`): sizes a
    ship from its essentials by iterating to a fixed point — thrusters per
    direction (to hit a target up-TWR plus a lateral-thrust fraction), power
    blocks (battery discharge + runtime target, or a producer's output) to cover
    peak draw, and a torque-per-mass gyro heuristic. Returns achieved TWR, dry/
    loaded mass, peak draw vs. supply, and warnings for infeasible choices.
  - **Estimator store** (`src/app/store/estimator-store.ts`, `useEstimatorStore`)
    holding the grid size, essentials list (add/remove/set-quantity, by block
    id), planet, cargo, and the estimator config (target TWR, lateral thrust,
    thruster/power/gyro choices, runtime target, responsiveness) — all inputs;
    the `Estimate` is derived on demand via a `useEstimate` hook that resolves
    ids to definitions and calls the engine.
  - **Essentials builder** with a grid-size gate and a searchable, category-
    grouped block palette (propulsion/power/gyros excluded — the app sizes those)
    plus per-block quantity steppers and a running block-count/mass tally.
  - **Build-goals panel**: planet selector, target-TWR and lateral-thrust
    sliders, a thruster picker grouped by type with atmospheric/ion feasibility
    hints, a battery-or-generator power source with a runtime-target control, a
    maneuverability segmented control, and the cargo loadout controls.
  - **Recommendations panel** (the payoff): per-direction thruster counts (UP
    emphasized), total thrusters, power-block count with a supply-vs-peak-draw
    meter, a gyro count clearly badged as an _estimate_, resulting dry/loaded
    mass and achieved loaded up-TWR (with a zero-g "n/a" case), prominent engine
    warnings, and a note to import the real blueprint afterward to verify. Ships
    empty, live, and infeasible/warning states.

### Changed

- App shell (`src/app/App.tsx`) now carries an app-wide header with the
  Analyze/Estimate mode switch; the analysis dashboard's header is no longer
  sticky so it sits below the shared top bar.

## [0.5.0] - 2026-08-03

### Added

- **Analysis UI (M4)** — the interactive front end over the calc engine, built
  to a Linear/Vercel/Raycast bar (dark, calm, high-contrast) with every state
  shipped: loading, empty, hover, error, and the unrecognized/modded-block case.
  - **Zustand design store** (`src/app/store/design-store.ts`): holds the
    imported `ShipDesign`, selected planet, cargo loadout, and last
    `BlueprintReport`; actions for `importBlueprint` (catches
    `BlueprintParseError` → friendly error state), `setPlanet`, `setCargoFill`,
    `setCargoDensity`, and `reset`. Engine output is derived on demand via a
    `useAnalysis` hook so planet/cargo changes recompute everything live.
  - **Import screen**: drag-and-drop or file-picker upload of a `.sbc`, a
    bundled "load example" ship (run through the real `parseBlueprint` path),
    and inline loading/error states. The drop zone is a focusable, aria-labeled
    button — keyboard and screen-reader operable.
  - **TWR panel**: empty-vs-loaded verdict cards, six-axis directional gauges
    with UP emphasized and a fixed 1.0 lift-off line, the signature "lifts empty
    but can't take off loaded" story, zero-g "no gravity" handling, and a
    thruster recommender (count needed to hover current loaded mass, with the
    "won't work here" case for atmospheric thrusters in vacuum).
  - **Mass panel**: dry/payload/loaded stats and a category-colored stacked bar
    with legend. **Power panel**: draw-vs-generation meter with a sustained-
    generation threshold marker, a prominent brownout alert, and humane battery
    runtime ("sustained" / minutes / seconds).
  - **Block list panel**: blocks grouped by category with per-source badges
    (vanilla/modded/custom), modded rows highlighted, plus blueprint diagnostics
    (recognition rate, unrecognized subtypes, unoriented thrusters, merged/mixed
    grids).
  - **Environment + cargo controls**: planet selector driving live recompute,
    fill-fraction slider and density presets (ice/components/ingots/ore/uranium)
    plus a custom density input.
  - Reusable UI kit (`Panel`, `Badge`, `Stat`, `Meter`, `TwrBar`, `StackedBar`,
    `SegmentedControl`, `Button`, icon set) and a unit-formatting library
    (N→kN/MN/GN, W→kW/MW, kg→t, L→kL/ML, runtime, TWR).
  - Blueprint imports recorded to the append-only audit trail as
    `blueprint.import` with source and match-rate metadata; import + parse
    errors logged through the structured logger with AI triage metadata.
- 30 new UI tests (103 total): the number formatter, store actions (import
  success/error, planet/cargo updates, audit recording, reset), and TWR
  pass/fail + brownout rendering logic.

### Changed

- Extended the design-token set in `src/ui/styles/index.css` with semantic
  status colors (success/warning/danger/info), a second surface layer, stronger
  borders, theme-matched scrollbars, focus-ring and reduced-motion handling, and
  centralized `.badge` / `.panel` component classes.
- `App.tsx` is now a thin shell that routes between the import screen and the
  analysis dashboard based on store state.
- Added bare-specifier path aliases (`@core`, `@data`) to `tsconfig.app.json`
  so the UI can import the package barrels the same way Vite resolves them.

## [0.4.0] - 2026-08-03

### Added

- **Calculation engine (M3)** — pure, heavily-tested math in `src/core/engine`:
  - **Thruster effectiveness**: air-density scaling per type (ion 1.0→0.3,
    atmospheric 0→1.0 across the 0.3–1.0 band, hydrogen flat), via clamp + lerp
    on each block's planetary-influence envelope.
  - **Mass & cargo**: dry mass, mass breakdown by category, cargo capacity (L),
    cargo payload mass (fill × density), loaded mass.
  - **Directional TWR**: thrust summed per grid axis with effectiveness applied,
    divided by weight; per-planet gravity; Infinity in zero-g.
  - **Empty-vs-loaded lift analysis**: the killer insight — reports whether a
    ship lifts off empty vs. fully loaded on a chosen planet.
  - **Power budget**: generation vs. peak draw, surplus, brownout detection,
    battery runtime under deficit.
  - **Thruster recommender**: whole thrusters needed to hover a mass on a
    planet, with an infeasible verdict when a thruster type produces no thrust
    there (e.g. atmospheric in vacuum).
- 22 worked-example engine tests with hand-verified reference values (73 total),
  including the "lifts empty at TWR 28 but only 0.845 loaded — can't take off"
  scenario and the same ship as a rocket on the Moon.

### Fixed

- Thruster recommender now flags a zero-thrust thruster (atmospheric in space)
  as infeasible before the no-gravity shortcut, instead of reporting "0 needed."

## [0.3.1] - 2026-08-03

### Changed

- Verified the blueprint parser against primary sources (real grid dump,
  SEToolbox serialization classes, Whiplash141 physics code). Confirmed the
  structure, the `(xsi:type, SubtypeName)` identity with empty-subtype fallback,
  the count-occurrences model, and the `flip(BlockOrientation.Forward)`
  thrust-direction rule. Recorded in `docs/data-audit.md`.

### Fixed

- Documented a known approximation: subgrid thrust is bucketed in each grid's
  local axes without rotating rotated rotor/hinge subgrids into the main frame
  (accurate for main-grid thrusters; a future enhancement otherwise). Made
  explicit in `parse.ts` rather than left silent.

## [0.3.0] - 2026-08-03

### Added

- **Blueprint import (M2):** parse an exported Space Engineers `bp.sbc` into a
  typed `ShipDesign`. `parseBlueprint(xml)` returns the design plus a
  `BlueprintReport` (grid count, total/matched blocks, unrecognized subtypes,
  unoriented thrusters, mixed-grid-size flag).
- Lenient Zod schema validating the parsed blueprint XML tree at the boundary
  (`fast-xml-parser` → validated tree), tolerant of the single-vs-array child
  collapse and the many fields we ignore.
- Orientation resolver mapping a thruster's `BlockOrientation.Forward` (exhaust
  direction) to the grid-local thrust direction — thrust pushes opposite to
  exhaust (exhaust down ⇒ lifts up). Powers directional TWR.
- Block resolver mapping blueprint `SubtypeName` to the curated dataset;
  unrecognized (modded) subtypes become `source: 'blueprint'` placeholders in
  the `'other'` category (never fabricating stat-bearing thrusters) so nothing
  is silently dropped.
- Multi-grid (subgrid) blueprints supported: blocks merged across grids, the
  primary grid labels the design, mixed grid sizes reported.
- 16 parser tests (orientation, resolver, full-fixture parse, multi-grid,
  malformed input, unoriented thrusters) + a realistic `bp.sbc` fixture;
  51 tests total.

## [0.2.0] - 2026-08-03

### Added

- Full verified vanilla block dataset for SE v1.210.012 b0: all 12 thrusters
  (atmospheric/ion/hydrogen × small/large grid × small/large variant), 5 cargo
  containers, 4 reactors, 2 batteries, 2 solar panels, 2 hydrogen engines, the
  wind turbine, and 2 cockpits — every value cited to the current wiki.
- DLC content-pack catalogue (`src/data/dlc.ts`) with the verified 21-entry
  pack list (base game through Prosperity) and `addsFunctionalBlocks` flags,
  backing the "restrict blocks to owned DLC" filter.
- `dlc` field on every block (schema `Dlc` type + `DlcInfo`) so the catalogue
  can be filtered by owned content packs.
- `maxHydrogenConsumption` field on hydrogen thrusters (L/s at full thrust) to
  enable Phase 2 fuel-burn / flight-time math.
- `docs/data-audit.md` — citation log, corrections applied, and the values
  still flagged as unverified (cockpit inventory volume, hydrogen-engine /
  wind-turbine SubtypeIds, Europa atmosphere density).
- Extended data-integrity tests: type-correct thruster envelopes, full-coverage
  counts per category, battery I/O consistency, DLC-tag validity, and a
  regression guard on the Pertam gravity correction (35 tests total).

### Changed

- Planet presets verified against SE v1.210 and cited.

### Fixed

- **Pertam surface gravity** corrected from 1.0 g (9.81 m/s²) to the true
  1.20 g (11.77 m/s²).
- Large-grid **Large Ion Thruster** mass corrected (3,625 → 43,200 kg) and
  large-grid **Large Reactor** mass corrected (12,600 → 73,795 kg); several
  other seed placeholders replaced with cited current-version values.

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

[0.7.0]: https://semver.org/
[0.6.0]: https://semver.org/
[0.5.0]: https://semver.org/
[0.4.0]: https://semver.org/
[0.3.1]: https://semver.org/
[0.3.0]: https://semver.org/
[0.2.0]: https://semver.org/
[0.1.0]: https://semver.org/
