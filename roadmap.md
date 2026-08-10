# SE Assistant — Product Roadmap

> **Last Updated**: 2026-08-10 (v0.22.0)

A Space Engineers ship & base planner: import a blueprint (`.sbc`) and get
instant thrust-to-weight, mass, cargo, and power analysis — empty vs fully
loaded, on any vanilla planet.

---

## 👉 Next session starts here

**Everything through Phase 2 plus M6.6, M6.7, and all of Phase 3's first block —
M7 (build cost + throughput + conveyor audit) and M8 (life support + combat) — is
DONE, committed, and pushed to GitHub** (`https://github.com/Pyurah/se-assistant`,
branch `master`, at v0.22.0). Working tree is clean and all four gates pass
(`typecheck` / `lint` / `test` (474) / `build`). Nothing is half-finished.

**v0.22.0 (2026-08-10) — Estimate mode is now a manual goal-seeking thruster
workbench.** The old auto-sizer — one Target-TWR knob plus a lateral fraction
that picked every thruster count for you — is retired (`estimateRequirements`,
`uniformThrusters`, the `EstimatorInput`/`EstimatorConfig` surface, and the
`targetTwr`/`lateralThrustFraction`/single-`thrusterId` store slices all deleted).
You now **assign thrusters per direction by hand**, mixing multiple types on a
single axis (Up = 4 large hydrogen + 6 small ion), and set an **explicit goal per
direction**: target TWR on planets, target acceleration in g-multiples in space.
Each axis shows a live **reached / exceeded / short** verdict with a goal marker
on its TWR/AccelBar, checked against an **empty/loaded** toggle (default loaded —
worst case) that stays in lock-step across the assignment surface and the TWR
panel. Power blocks and gyros are still auto-sized against the resulting build via
the generalized `sizeSupport` mass fixed-point. Blueprint seeding now populates
each direction's stack from the imported ship's **real oriented thruster layout**
(grouped by type + count) instead of one model to re-solve; goals and load-state
are UI targets, not seeded, and changing a goal never flips "adjusted from source"
while changing a stack does. New engine surface: `estimateManual` and the pure
`evaluateGoal` helper (`GoalVerdict` reached/exceeded/short with the goal's m/s²
equivalent). Heavy test churn across all four estimator test files, landed with
each change; +`estimate-goal.test.ts` worked examples (474 total).

**v0.21.2 (2026-08-10) — A blueprint-seeded Estimate build no longer sizes zero
of everything.** After v0.21.1 carried every block over, an imported Heavy Space
Fighter in **Space** still recommended **0 thrusters, 0 gyroscopes, and 0
batteries** — directional acceleration read "n/a", changing maneuverability did
nothing, power read "0× Warfare Battery". Two independent bugs. (1) The seed
picked the _most numerous_ thruster as dominant, so the fighter's 28 small
maneuvering thrusters (0.40 MN total) beat its 23 large main-drive thrusters
(3.97 MN total); the estimator then tried to fly a 137 t ship on RCS, needed
thousands, blew the sanity cap, and gave up. `designToEstimateSeed` now scores
thruster dominance by **total thrust contributed** (count × per-block thrust), so
the main drive wins. (2) Both estimator hard-stops (dead UP axis; diverging count)
returned zero thrusters *and* zero power *and* zero gyros — but base draw and
attitude control don't depend on the thrusters lifting, so power + gyros are now
sized against the zero thruster count via a shared `sizeSupportOnly` fixed-point
pass. Net: the fighter now estimates a real Space build (77 thrusters, 27
batteries, 3 gyros, no warnings). +1 seed regression test, existing infeasibility
tests updated to assert power/gyros survive (466 total).

**v0.21.1 (2026-08-10) — Blueprint seeds no longer drop generated blocks in
Estimate mode.** Importing a real blueprint into Estimate mode reported most of a
ship's blocks as "not carried over (modded / unrecognized)" — a Heavy Space
Fighter lost its 523 Heavy Armor blocks, Sci-Fi ion thrusters, fighter cockpit,
and conveyors. Those blocks *are* recognized (they resolve from the generated
`source:'definition'` dataset; Analyze mode factors them in), but the estimator's
seed-matching (`designToEstimateSeed`) and block resolution (`useEstimate`)
checked the **curated-only** `VANILLA_BLOCKS_BY_ID`, so every generated block was
dropped from the build's mass. Both now resolve against the merged `BLOCKS_BY_ID`
(the same dataset the blueprint parser uses), so **every recognized block carries
over as a fixed essential and contributes its real mass** even when the estimator
can't re-size it — directly serving the rule that a seeded blueprint's blocks are
all essential. Only genuinely modded/placeholder subtypes are still reported as
not carried over. +3 seed tests (465 total).

**v0.21.0 (2026-08-10) — Space swaps directional TWR for directional
acceleration.** TWR is thrust ÷ weight, and weight is `mass · gravity` — so in
space (gravity 0) it's undefined and both TWR panels rendered a dead "TWR is not
applicable in space" placeholder. Selecting **Space** now turns that panel into a
per-axis **acceleration** readout: m/s² per direction plus the time and distance
to reach the speed cap ("reaches 100 m/s in 4.2 s over 210 m"), empty vs loaded.
With no gravity and no atmospheric drag this is *exact* arithmetic
(`a = thrust / mass`), the same treatment `stoppingDistance` already gives vacuum
braking — not an estimate. Shipped in **both** modes (Analyze `TwrPanel` +
Estimate `EstimatorTwrPanel`) at full parity, per the user's explicit
both-tabs requirement. An **adjustable speed cap** (vanilla 100 m/s; preset chips
100 / 300 / 500 + free entry) rescales the time/distance readouts for raised-cap
servers. To make the Estimate tab useful in space — where a TWR target would size
zero thrusters — the estimator now reads the target-TWR knob as a target
acceleration in g-units in vacuum (TWR 2 → 2 g = 19.62 m/s²); planet sizing
(`targetTwr · weight`) is unchanged, so every worked example holds. New pure
`directionalAcceleration` helper (worked-example tested), `AccelBar` gauge,
`formatSpeed`/`formatAccel`, and `DEFAULT_MAX_SPEED_MPS`. See `docs/data-audit.md`.

**v0.20.0 (2026-08-10) — Life Support & Combat now available in Estimate mode.**
v0.19.0 shipped Life Support and Combat for imported blueprints (Analyze) only.
This release closes the mode gap: a build sized from declared essentials now gets
the same two readouts, run through the **same** trusted engines (`lifeSupport` /
`combatAnalysis`) on the `ShipDesign` that `estimateToDesign` already synthesizes
— no second implementation of the math. Declaring an O2/H2 generator + oxygen tank
surfaces crew-oxygen balance, max crew, breathing time, and ice burn; adding
weapons surfaces burst/sustained DPS and ammo duration. Each panel self-hides
until the build has the relevant hardware, so an essentials-only build stays
calm. To make the Combat readout usable, weapons became **declarable**: a new
`weapon` `BlockCategory` and 17 curated weapon blocks (one per weapon with curated
firing stats) appear in the essentials palette. Firing stats stay in the
`weapons.ts` overlay (joined by SubtypeId); the curated blocks copy
**mass/gridSize/dlc/cellCount verbatim** from the generated catalogue, so an
imported ship's mass is unchanged by their addition — guarded by a
trustworthiness-invariant test. New `useEstimate().design`, two Estimator panels,
render tests. Scope was locked (with the user) to Life Support + Combat only;
Conveyor is deliberately excluded because the estimator never places conveyor
pieces, so a presence audit would always false-warn. See `docs/data-audit.md`.

**v0.19.0 (2026-08-10) — conveyor audit, life support & combat (M7 finisher +
M8).** Three additive analyses ship as one release, each on trustworthy, cited
data:
- **Conveyor port & reachability audit** (closes M7). SE publishes no conveyor
  transfer rate — movement is instantaneous, gated only by port size — so instead
  of a fabricated items/sec, the Conveyor panel flags which blocks need
  **large-port** lines and whether the grid carries any. Honest **presence**
  check, not a routed-connectivity solve (stated in-panel). Curated, cited
  `conveyor-ports` dataset + pure `conveyorAudit`.
- **Life Support** (M8). O₂ generation vs. crew demand (0.063 L/s per character),
  max crew supported, breathing time on stored O₂, and ice-burn rate. Crew-size
  stepper; tidy empty state for ships with no gas gear. Generator rates derived
  from `IceConsumptionPerSecond × IceToGasRatio`, cross-confirming curated
  hydrogen outputs. Pure `lifeSupport` engine.
- **Combat — DPS & ammo burn** (M8). Per-weapon and total burst DPS (trigger
  held) and sustained DPS (reloads included), plus how long loaded magazines last
  at full fire. Damage is labelled by kind (kinetic HP / explosion / health-pool)
  and never summed across kinds; no target-armour or time-to-kill model.
  Curated `ammo` + `weapons` datasets from `Ammos.sbc` / `Weapons.sbc` /
  `AmmoMagazines.sbc`; pure `combatAnalysis` engine. Combat is a firing-stats
  **overlay** keyed by SubtypeId (NOT a `WeaponBlock` schema variant) so
  generated definition-sourced weapon mass is never overwritten. `generate:weapons`
  is a documented fast-follow. See `docs/data-audit.md`.

**v0.18.0 (2026-08-10) — component breakdown in the Build-cost panel.** The
panel showed raw ore and refine time but not the components themselves — yet
that is exactly what a builder pre-stages so the welders never stall waiting on a
missing part. It now lists **every component and how many**, ordered
biggest-count-first, with a "N total" headline. The per-component totals were
already computed by `buildCost` (the `cost.components` map); this surfaces them
via two pure helpers, `componentBill(cost)` + `totalComponentCount(cost)`, with
worked-example tests for ordering, tie-breaking, and cross-block summing. No new
game data — pure display of already-trustworthy numbers.

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

**The next unit of work opens Phase 4 (or polish).** Phase 2.5 is fully shipped
(M6.5–M6.7), and **Phase 3's first block is complete**: M7 (build cost v0.14.0,
throughput v0.15.0, full cost coverage v0.16–0.17.0, component breakdown v0.18.0,
and the conveyor port audit v0.19.0) and M8 (life support + combat, v0.19.0) are
all delivered on cited data. Every new dataset value is citation-logged in
`docs/data-audit.md`, with the honest simplifications flagged (conveyor
presence-not-connectivity; life support flow-balance only; combat no
time-to-kill). Documented fast-follow: a `generate:weapons` script over
`Weapons.sbc` to replace hand-curated combat stats with full coverage.

If instead the user wants polish over new features: candidate small wins are a
GitHub Actions CI workflow (run the four gates on push, plus `pnpm
generate:blocks:check` / `pnpm generate:costs:check` on runners with the game — or
skip them where the game is absent), README screenshots, or resolving the
flagged-uncertain data values in `docs/data-audit.md` (some DLC SubtypeIds,
drill/sensor wattages, the Superconductor cobalt term, and the curated conveyor
port set) against a live game install. The `BLOCK_COMPONENT_COSTS` regeneration
fast-follow is **done** (v0.17.0).

---

## Current State

- **Version**: 0.22.0
- **Repo**: pushed to `https://github.com/Pyurah/se-assistant` (`master`);
  commits use the GitHub no-reply email (real email scrubbed from history).
- **Build**: passing (`pnpm build`)
- **Tests**: passing — 474 tests across logger, audit, data-integrity, the
  merged-dataset invariants (`all-blocks` + `all-block-costs` override/gap-fill
  proofs) and the block + cost generators' fixture-driven parser/emitter/map
  suites, engine
  (incl. `estimateManual` + the `evaluateGoal` goal helper, the `estimateToDesign`
  + `designToEstimateSeed`
  bridges, the `rankThrusterTypes` ranker, the `buildCost` bill-of-materials
  engine, the `manufacturingThroughput` fleet/ratio engine, the `conveyorAudit`
  port audit, the `lifeSupport` O₂/ice engine, the `combatAnalysis` DPS/ammo
  engine, the fuel/flight-time engine, and the motion/stability engine),
  blueprint parser, number formatter, stores, and UI-rendering suites
- **Phase**: Phases 1, 1.5, and 2 all COMPLETE; Phase 3's first block (M7 + M8)
  COMPLETE. M1 dataset, M2 blueprint parser, M3 calc engine, M4 analysis UI,
  M4.5 requirement estimator, M5 fuel/flight time, M6 motion/stability — all
  delivered. Phase 3 delivered build cost + throughput + conveyor audit (M7) and
  life support + combat (M8), each a pure engine over cited data with
  worked-example tests. React 19 + Vite + TypeScript SPA,
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

> **Superseded by v0.22.0.** The auto-sizing solver described here
> (`estimateRequirements`, target-TWR + lateral-fraction knobs) was retired in
> favor of a **manual goal-seeking workbench**: you assign thrusters per direction
> by hand (mixing types), set an explicit per-direction goal (TWR on planets,
> g-multiple accel in space), and see a live reached/exceeded/short verdict. Power
> and gyros are still auto-sized (via `estimateManual` → `sizeSupport`); goal
> verdicts come from the pure `evaluateGoal` helper. Blueprint seeding now
> populates each direction's real oriented thruster stack.

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

**Status**: ✅ Complete — build cost + throughput + conveyor audit shipped
(v0.14.0, v0.15.0, v0.17.0, v0.18.0, v0.19.0)

**Deliverables:**

- [x] Refinery / assembler throughput and optimal ratios — **v0.15.0**
- [x] Blueprint total resource cost (ore-to-build) — **v0.14.0**
- [x] Conveyor **port & reachability audit** (reframed — no fabricated rate) — **v0.19.0**

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

**Delivered (v0.18.0):** the Build-cost panel now surfaces the **component
breakdown** — every component the ship needs and how many, ordered
biggest-count-first, with a running total — so a builder can pre-stage an
assembler queue and the welders never stall waiting on a part. The per-component
totals were already computed by `buildCost` (`cost.components`); v0.18.0 adds two
pure engine helpers to surface them honestly (`componentBill`,
`totalComponentCount`) with worked-example tests, plus the panel section and its
render tests. No new game data.

**Delivered (v0.19.0):** the conveyor **port & reachability audit** closes M7.
Since SE publishes no conveyor transfer rate (in-network movement is
instantaneous, gated only by port size), a literal items/sec figure would be
fabricated — so the deliverable is reframed (locked decision, with the user) as a
presence audit. New curated, cited `src/data/conveyor-ports.ts`
(`LARGE_PORT_BLOCKS` + `LARGE_PORT_CONVEYORS`, port size is not a clean def field
so it's hand-curated from wiki rules and flagged uncertain) and pure
`conveyorAudit(design)` engine (Pattern-A `use-conveyor` hook, `ConveyorPanel`):
counts large-port-requiring blocks vs. large-port conveyor pieces present and
lists the specific blocks to route, with an explicit **presence-not-connectivity**
caveat in-panel and in `docs/data-audit.md`. Worked-example + panel render tests.

### M8 — Life Support & Combat

**Status**: ✅ Complete — life support + combat shipped in Analyze (v0.19.0) and
Estimate (v0.20.0)

**Deliverables:**

- [x] O2 / H2 generation vs crew size — **v0.19.0** (Analyze), **v0.20.0** (Estimate)
- [x] Weapon DPS / ammo consumption math — **v0.19.0** (Analyze), **v0.20.0** (Estimate)

**Delivered (v0.19.0, life support):** the Life Support panel answers "can my
crew breathe, and how much ice does life support burn?" New pure
`src/data/life-support.ts` constants (character O₂ 0.063 L/s from `Characters.sbc`;
ice→gas ratios 10/20 from `Production.sbc`) and pure `lifeSupport(design, opts)`
engine: total O₂ generation vs. crew demand, max crew supported, breathing time
on stored O₂ if generation stops, and ice-burn rate. Generator gas output is
derived from `IceConsumptionPerSecond × IceToGasRatio`, cross-confirming curated
hydrogen outputs. Pattern-B `use-life-support` hook (panel owns crew size via a
`Stepper`); tidy empty state for ships with no gas gear. Worked-example engine
tests (1 large gen supports ~3,968 crew) + panel render tests.

**Delivered (v0.19.0, combat):** the Combat panel shows per-weapon and total-ship
**burst DPS** (trigger held) and **sustained DPS** (reload gaps included), plus
how long loaded magazines last at full fire, driven by a magazines-per-weapon
stepper. Damage branches by ammo family — kinetic (`ProjectileHealthDamage`),
missile (`MissileExplosionDamage`), shell/slug (`MissileHealthPool`) — and each
weapon row is labelled by kind so figures are never summed into one misleading
number; there is no target-armour/time-to-kill model (stated in-panel). New
curated, cited `src/data/ammo.ts` + `src/data/weapons.ts` (from `Ammos.sbc`,
`AmmoMagazines.sbc`, `Weapons.sbc`) and pure `combatAnalysis(design, opts)`
engine. **Design decision (deviation from the plan):** combat is a firing-stats
**overlay** keyed by weapon SubtypeId, NOT a `WeaponBlock` schema variant — weapon
blocks already carry generated definition-sourced mass, and a hand-authored
`WeaponBlock` would overwrite it with an unverified value. Weapon-like blocks with
no curated stats are surfaced as "DPS known for N of M," never zeroed. A
`generate:weapons` script over `Weapons.sbc` is a documented fast-follow.
Worked-example engine tests (gatling 385 burst DPS, autocannon 212.5) + panel
render tests.

**Delivered (v0.20.0, Estimate-mode parity):** both analyses now also run in
Estimate mode, on the synthesized `ShipDesign` from `estimateToDesign` (newly
exposed as `useEstimate().design`) — the same engines Analyze uses, no second
implementation. Two thin Estimator panels mirror the EstimatorTwrPanel pattern
(own their local crew-size / magazines-per-weapon state, call the pure engine,
self-hide until the build has gas gear / weapons). To make the Combat readout
usable, weapons became declarable: a new `weapon` `BlockCategory` + 17 curated
weapon blocks (`src/data/weapon-blocks.ts`) surface in the essentials palette,
with mass/gridSize/dlc/cellCount **copied verbatim** from the generated catalogue
(trustworthiness-invariant test guards that the merge doesn't shift any imported
ship's mass). Firing stats remain the `weapons.ts` overlay joined by SubtypeId.
Scope locked (with the user) to Life Support + Combat; Conveyor excluded (the
estimator never places conveyor pieces, so a presence audit would always
false-warn). Panel render tests for populated / essentials-only / unarmed builds.

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
