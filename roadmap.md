# SE Assistant — Product Roadmap

> **Last Updated**: 2026-08-03

A Space Engineers ship & base planner: import a blueprint (`.sbc`) and get
instant thrust-to-weight, mass, cargo, and power analysis — empty vs fully
loaded, on any vanilla planet.

---

## Current State

- **Version**: 0.1.0 (scaffolding)
- **Build**: passing (`pnpm build`)
- **Tests**: passing — logger, audit store, data-integrity, and app-shell
  suites (see CHANGELOG for the running count)
- **Phase**: Phase 1 not yet started. Infrastructure is complete: React 19 +
  Vite + TypeScript SPA, `src/core` + `src/data` purity boundary (ESLint
  enforced), structured logging, append-only audit model, Vitest with enforced
  engine coverage thresholds, Tailwind v4, Zod, Zustand.

The scaffolding ships a real block/planet **data schema** designed for a future
`.sbc` _definition-file_ parser, a seed of vanilla blocks and the full set of
planet presets (flagged for verification in M1), and the shared `ShipDesign`
domain types the calc engine will consume.

---

## Phase 1 — Core Engine & Blueprint Import (MVP) ← IN PROGRESS

The MVP delivers the four v1 features on top of imported blueprints. Milestones
are largely sequential: the dataset (M1) and parser (M2) feed the calc engine
(M3), which the UI (M4) renders.

### M1 — Complete & Verified Vanilla Dataset

**Status**: Not started

Turn the seed dataset into full, trustworthy vanilla coverage.

**Deliverables:**

- [ ] All thruster variants: atmospheric / ion / hydrogen x small+large grid x
      small+large thruster models, with accurate mass, max thrust (N), max
      power draw (W), and planetary-influence effectiveness envelopes
- [ ] Cargo blocks: all containers (small/large grid, small/large) + connectors
      with inventory volume (L) and mass
- [ ] Power sources: reactors (small/large), batteries (capacity Wh + I/O
      rates), solar panels, hydrogen engines, wind turbines
- [ ] Other mass/power-relevant blocks needed for realistic totals (cockpits,
      gyroscopes, common structural)
- [ ] Every value cited/verified against the current game version; record the
      source in an M1 data-audit note
- [ ] Planet presets verified (gravity in m/s^2, atmosphere density 0..1)
- [ ] Data-integrity tests extended to cover the full dataset

### M2 — Blueprint (`.sbc`) Import & Parser

**Status**: Not started

Highest payoff-to-effort feature: drag-and-drop a `.sbc`, auto-populate blocks.

**Deliverables:**

- [ ] Drag-and-drop / file-picker upload of an exported `bp.sbc` blueprint
- [ ] XML parser (`fast-xml-parser`) extracting block SubtypeIds, counts, grid
      size, and thruster orientation
- [ ] Zod validation at the parse boundary; malformed input produces a
      structured error log with AI metadata and a clear user message
- [ ] Map parsed SubtypeIds to dataset definitions; unknown/modded blocks fall
      back to `blueprint` or `user` stat source (vanilla-vs-modded handling)
- [ ] Resolve thruster orientation to thrust direction (up/down/fwd/etc.)
- [ ] Import recorded to the audit trail (`blueprint.import`)
- [ ] Parser unit tests with small committed `.sbc` fixtures (valid + malformed)

### M3 — Calculation Engine

**Status**: Not started

Pure, heavily-tested math in `src/core`. Correctness is the product.

**Deliverables:**

- [ ] **Mass**: full breakdown by block category; dry mass and loaded mass
- [ ] **Cargo**: total inventory volume (L); loaded mass from fill fraction x
      cargo density; effect of load on totals
- [ ] **TWR**: `Total Thrust (N) / (Mass (kg) x Gravity (m/s^2))`, directional
      (up/down/forward/back/left/right), with per-type environment scaling
      (atmospheric scales with air density, ion inverse, hydrogen constant) and
      per-planet gravity presets
- [ ] **Empty-vs-loaded comparison** — the killer insight ("TWR 2.3 empty but
      0.8 loaded")
- [ ] **Thruster recommender** — "you need X ion thrusters to hover this mass
      on planet Y"
- [ ] **Power budget**: total generation vs peak draw; brownout warning when
      draw exceeds supply; battery runtime under load
- [ ] Unit tests for every function using **known-good worked examples** with
      documented inputs/expected outputs; enforced coverage thresholds met

### M4 — Analysis UI

**Status**: Not started

Render the engine output with a Linear/Vercel-grade feel.

**Deliverables:**

- [ ] Import screen (empty state -> upload -> parsed summary)
- [ ] Block list with categories, quantities, and stat-source badges
      (vanilla / blueprint / user)
- [ ] Planet selector driving live recalculation
- [ ] TWR panel: directional readouts, empty-vs-loaded toggle, thruster
      recommender
- [ ] Mass breakdown panel
- [ ] Power budget panel with brownout + battery-runtime warnings
- [ ] Cargo loadout control (fill fraction, density) feeding the comparison
- [ ] Loading / empty / error states throughout; Zustand store wiring
- [ ] Component tests for critical UI logic

---

## Phase 2 — Flight Dynamics & Fuel

Deeper physics once the core loop is solid.

### M5 — Fuel & Flight Time

**Status**: Not started

**Deliverables:**

- [ ] Hydrogen fuel burn rate per thruster and total H2 capacity
- [ ] Flight-time / hover-time estimates under a given load
- [ ] Reactor uranium consumption over time
- [ ] Solar day/night sizing guidance

### M6 — Motion & Stability

**Status**: Not started

**Deliverables:**

- [ ] Dampener stopping distance from current velocity and available thrust
- [ ] Center-of-mass vs thrust-center alignment check
- [ ] Gyroscope count vs mass -> turn-rate estimate

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
