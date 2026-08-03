# SE Assistant — Product Roadmap

> **Last Updated**: 2026-08-03

A Space Engineers ship & base planner: import a blueprint (`.sbc`) and get
instant thrust-to-weight, mass, cargo, and power analysis — empty vs fully
loaded, on any vanilla planet.

---

## Current State

- **Version**: 0.8.0
- **Build**: passing (`pnpm build`)
- **Tests**: passing — 186 tests across logger, audit, data-integrity, engine
  (incl. `estimateRequirements`, the fuel/flight-time engine, and the
  motion/stability engine), blueprint parser, number formatter, stores, and
  UI-rendering suites
- **Phase**: Phase 1 (MVP) complete — M1 dataset, M2 blueprint parser, M3 calc
  engine, and M4 analysis UI all delivered. Phase 1.5 (M4.5, Requirement
  Estimator) complete — the design-from-scratch inverse of blueprint import.
  Phase 2 complete — M5 (Fuel & Flight Time) and M6 (Motion & Stability).
  React 19 + Vite + TypeScript SPA, `src/core` + `src/data` purity boundary
  (ESLint enforced), structured logging, append-only audit model, Vitest with
  enforced engine coverage thresholds, Tailwind v4, Zod, Zustand.

The app runs in two modes. **Analyze**: import an exported `.sbc` blueprint
(drag-drop, file picker, or bundled example) and render live thrust-to-weight,
mass, cargo, and power analysis — empty vs. fully loaded, on any vanilla planet.
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
