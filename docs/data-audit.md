# Data Audit — M1 (SE v1.210.012 b0)

This is the citation log for the curated vanilla dataset. It records where every
block and planet value came from, and explicitly flags the handful of values
that could not be confirmed to full certainty. Update this file whenever a value
is corrected or a source changes.

**Target game version:** Space Engineers v1.210.012 b0 ("Prosperity", current as
of Aug 2026).

## Sources

- **Primary (current stats):** the official wiki, `spaceengineers.wiki.gg` —
  per-block pages for Atmospheric / Ion / Hydrogen Thrusters (+ Large variants),
  Cargo Container, Small/Large Reactor, Battery, Solar Panel, Hydrogen Engine,
  Wind Turbine; the hydrogen Fuel-Cost table; "Comparison of DLC Packs".
- **SubtypeIds + effectiveness-curve structure:** Keen's archived
  `CubeBlocks.sbc` (`github.com/KeenSoftwareHouse/SpaceEngineers`). These are
  design-stable constants; SubtypeIds and the planetary-influence semantics are
  unchanged even where raw thrust magnitudes were later rebalanced.
- **DLC list + release order:** Steam DLC store page + wiki DLC comparison.
- **Planets:** `spaceengineers.wiki.gg` planet pages, corroborated by the legacy
  fandom wiki.

Where the archived 2019 `.sbc` raw thrust numbers differed from the current
wiki (thrusters were buffed post-2019, ~17% on some), the **current wiki value
wins**; only SubtypeIds and effectiveness-curve fields were taken from the
archive.

## Thruster effectiveness envelopes (design constants)

| Type | minInfluence | maxInfluence | effAtMin | effAtMax | Behaviour |
|---|---|---|---|---|---|
| Ion | 0 | 1 | 1.0 | 0.3 | Full in vacuum, 30% in dense atmo |
| Atmospheric | 0.3 | 1 | 0.0 | 1.0 | Zero in vacuum, ramps up with air |
| Hydrogen | — | — | 1.0 | 1.0 | Flat 100% everywhere |

## Corrections applied vs. the original seed

| Item | Seed value | Corrected value | Note |
|---|---|---|---|
| Large Ion Thruster (large grid) mass | 3,625 kg | **43,200 kg** | Seed was badly low |
| Large Ion Thruster (large grid) thrust | 4,320,000 N | 4,320,000 N | Confirmed |
| Large Reactor (large grid) mass | 12,600 kg | **73,795 kg** | Seed was badly low |
| Large Reactor (large grid) output | 300 MW | 300 MW | Confirmed |
| Large Battery capacity | 3 MWh | 3 MWh | Confirmed |
| Large Battery mass | 3,762 kg | **3,845 kg** | Minor correction |
| Pertam gravity | 1.0 g / 9.81 | **1.20 g / 11.77 m/s²** | Seed was wrong |
| DLC enum | guessed list w/ "fields" | verified 21-entry list | No "Fields"; it's "Fieldwork" |

## Flagged / unverified values

These are in the dataset with a best-effort value but could **not** be confirmed
to full certainty. Confirm against the local game's `.sbc` files if exactness
matters, and update this table when resolved.

1. **Cockpit inventory volume** (`LargeBlockCockpit`, `SmallBlockCockpit`) —
   not published on the wiki. Using **120 L** (the common 1× default). Confirm
   via in-game or `CubeBlocks.sbc` `InventoryMaxVolume`.
2. **Hydrogen Engine SubtypeIds** (`SmallBlockHydrogenEngine`,
   `LargeBlockHydrogenEngine`) — from Keen naming convention; these blocks
   postdate the archived `.sbc` that was fetched. Stats are current-wiki.
3. **Wind Turbine SubtypeId** (`LargeBlockWindTurbine`) — same convention note.
   Output 400 kW is the quoted average-weather figure; real output varies with
   altitude/weather/obstruction.
4. **Europa atmosphere density** — wiki prints a flat "1 atm" surface label for
   all atmospheric bodies, but the game's `PlanetGeneratorDefinitions.sbc`
   `<Density>` for Europa is **0.5**, matching its "thin atmosphere" description.
   We use **0.5** because thruster effectiveness keys off that density
   multiplier. Confirm against local `PlanetGeneratorDefinitions.sbc`.

## DLC / block ownership

Every block currently in the dataset is base-game (`dlc: 'base'`). DLCs add only
stat-identical **reskins** of these base blocks (e.g. Sci-Fi thrusters, Warfare
reactors/batteries), so for the physics math the base block is sufficient. If
DLC-specific variants are added later, they share the base block's
mass/thrust/power and only differ by `dlc` tag and `displayName`.

Note: **Prototech** blocks (Prototech Thruster / Battery / Fusion Reactor / Jump
Drive) are **not** DLC — they are rare base-game endgame loot with distinct
stats, to be handled separately if the calculator ever covers them.

## Blueprint (`bp.sbc`) format — M2 verification

The parser's assumptions about the blueprint XML were verified against primary
sources: a real multi-grid grid dump (`midspace/Space-Engineers-Admin-script-mod`
prefab), SEToolbox's serialization classes for the `ShipBlueprint` envelope, and
Whiplash141's physics code for the thrust-direction rule. Confirmed:

- Structure `Definitions → ShipBlueprints → ShipBlueprint → CubeGrids → CubeGrid
  → CubeBlocks → MyObjectBuilder_CubeBlock`. The root is always `Definitions`
  (shared by all `.sbc` types); a blueprint is identified by `ShipBlueprints`.
- Block identity is the **(xsi:type, SubtypeName)** pair; `SubtypeName` equals
  the `CubeBlocks.sbc` SubtypeId. Empty `<SubtypeName/>` is real and common
  (default variant) — fall back to `xsi:type`. ✓ handled.
- **No quantity field** — one element per placed block; count occurrences.
  ✓ handled (aggregation).
- **Thrust direction = `flip(BlockOrientation.Forward)`** — the flame exits the
  Forward face, grid is pushed opposite. Confirmed against
  `Base6Directions.GetFlippedDirection`. ✓ this is what `orientation.ts` does.
  The `Up` attribute does not affect thrust bucketing.

Flagged follow-ups (robustness, not blocking):

1. **Current-version fixture** — the reviewer could not pull a verbatim v1.210
   `bp.sbc` (only a slightly older grid dump + the serialization code). Export a
   real blueprint from the local v1.210 install to lock the fixture exactly.
2. **Inventory wrapper** — older schema nests `<Inventory>` directly in a block;
   newer versions may wrap it in `<ComponentContainer> → <Components>`. We don't
   read inventory contents yet (capacity comes from our dataset), so this is
   moot until "as-saved cargo mass" is added.
3. **`<Id>` attribute-vs-element form** — some serializations write
   `<Id Type=".." Subtype=".."/>`, others `<Id><TypeId/>..</Id>`. We read the
   grid `DisplayName`, not `<Id>`, so this doesn't affect parsing today.
4. **Subgrid thrust frames** — see the KNOWN APPROXIMATION note in `parse.ts`:
   subgrid thrust is bucketed in each grid's local axes without rotating into
   the main frame. Fine for main-grid thrusters; a future enhancement for
   rotated rotor/hinge-mounted thrusters.

## Functional / utility blocks (estimator dataset)

Added for the requirement-estimator's block palette. Sourced from the current
wiki, with SubtypeIds and key fields cross-checked against Keen's
`CubeBlocks.sbc`.

Confirmed authoritatively (`.sbc`):
- **Gyroscope** `ForceMagnitude` (= max torque, N·m): small `SmallBlockGyro`
  448,000; large `LargeBlockGyro` 33,600,000 (exactly 75×). Power fixed and
  negligible (0.6 W / 30 W). These drive the gyro-count heuristic.
- **Camera** `RequiredPowerInput` 0.00003 MW = 30 W. SubtypeIds
  `SmallCameraBlock` / `LargeCameraBlock` (NOT `…BlockCameraBlock`).

SubtypeId corrections captured in the dataset:
- Drill: `SmallBlockDrill` / `LargeBlockDrill` (TypeId `Drill`, not `ShipDrill`).
- Small connector: `ConnectorMedium` (NOT `ConnectorSmall`, which is a separate
  ejector). Large connector: `Connector`.
- Interior Light naming is inverted: large-grid = `SmallLight`, small-grid =
  `SmallBlockSmallLight`.
- Small ore detector: `SmallBlockOreDetector` (not `SmallOreDetector`).

Flagged power values (community-sourced; wiki does not list them and they're not
in the `.sbc` — power is code-driven). Used as best-effort; verify in-game
(place block → Info tab) if precision matters:
1. **Drill / welder / grinder** — 2 kW while OPERATING, ~0 idle. We store 2 kW
   (worst case for power budgeting) and mark `variableDraw`.
2. **Sensor** — ~100 W (near-zero; wiki lists none).
3. **Programmable block** — ~500 W (wiki confirms it draws power, no figure).
4. **Ore detector** — ~2 kW (wiki lists none).
5. **Beacon / antenna** — draw scales with broadcast range; we store the MAX
   (beacon ~20 kW, antenna 200 kW) and mark `variableDraw`. Beacon max is
   wiki-inconsistent; verify in-game.
6. **Event Controller** (Automatons DLC) — SubtypeId `EventControllerLarge` /
   `…Small` could NOT be authoritatively confirmed (block postdates the archived
   `.sbc`); mass/power from the wiki. Verify the SubtypeId if blueprint-matching
   Event Controllers matters.
7. **Light masses** — wiki infoboxes round to 0 kg (display rounding, not truly
   zero). We store small nonzero placeholders (1–3 kg); refine from `.sbc` if
   exact light mass ever matters.

## Fuel & flight-time data (M5)

Added for the fuel/flight-time engine (`src/core/engine/fuel.ts`). All from the
current wiki; several cross-checked against the fuel-cost tables.

Confirmed:
- **Hydrogen thruster fuel** (L/s at max thrust): small-grid small 80.33, small-
  grid large 385.6, large-grid small 803.34, large-grid large 4820.05 — all
  match the wiki fuel-cost table exactly (these were already in the dataset from
  M1; M5 verified them).
- **Hydrogen tank capacity** (L): 4 distinct blocks — `SmallHydrogenTankSmall`
  15,000; `SmallHydrogenTank` 500,000; `LargeHydrogenTankSmall` 1,000,000;
  `LargeHydrogenTank` 15,000,000.
- **Hydrogen engine**: 500 kW / 5 MW output confirmed; fuel 50 / 500 L/s at max.
- **Reactor uranium**: **1 MWh per 1 kg Uranium Ingot**, uniform across sizes
  (`URANIUM_WH_PER_KG = 1_000_000`). Burn rate kg/h = load_W / 1e6. This is the
  load-bearing constant and it's solid.
- **O2/H2 generator**: H2 output 100 / 500 L/s (small/large); 20 L H2 per kg ice.
  Key modeling insight: generation is negligible vs. thruster burn (one large
  generator = 500 L/s vs. one large H2 thruster = 4,820 L/s), so flight time is
  **tank-capacity-bound**, not generation-bound. The engine treats it that way.
- **Stored hydrogen adds no ship mass** in SE — only the empty tank block mass
  counts. Simplifies flight-time (no fuel-burn-lightens-ship feedback).

Flagged (community-sourced / not in game files this session; verify if precision
matters): the tank/tiny-tank SubtypeId strings, the ~10% thruster idle fuel
floor at low throttle (we model burn as linear with thrust — accurate near full
throttle, slightly optimistic for low-throttle station-keeping), and the O2/H2
generator ice-conversion rate.

## Motion & stability approximations (M6)

The motion engine (`src/core/engine/motion.ts`) is pure physics; the constants
are the grid cell sizes (`GRID_CELL_SIZE_M`: large 2.5 m, small 0.5 m — long-
established). Two deliberate approximations, surfaced in the UI:

1. **Stopping distance ignores per-axis gravity.** Net deceleration is
   braking-thrust / mass. Exact per-axis gravity needs the ship's orientation to
   the planet, which isn't tracked. Accurate in space and for horizontal motion;
   slightly optimistic braking a climb, pessimistic braking a descent.
2. **Turn rate uses a solid-cube moment of inertia.** Exact inertia needs the
   full mass distribution and rotation axis. We approximate the ship as a
   uniform cube (side from the bounding box when geometry is present, else a
   block-count cube root) and use I = (1/6)·m·s². Good for relative comparison
   and ballpark feel, not exact degrees/sec — labeled an estimate.

Center-of-mass and thrust-center alignment are exact given block positions;
they return `null` (UI: "import a blueprint") for position-less designs like the
estimator's.

## Battery variants (v0.9.0)

Five battery blocks, all wiki-confirmed for mass/capacity/I-O:
- `SmallBlockSmallBatteryBlock` — Small Battery, small grid: 146.4 kg, **50 kWh**,
  200 kW in/out. The compact variant (was missing pre-0.9.0).
- `SmallBlockBatteryBlock` — Battery, small grid: 1040.4 kg, 1 MWh, 4 MW.
- `LargeBlockBatteryBlock` — Battery, large grid: 3845 kg, 3 MWh, 12 MW.
- `LargeBlockBatteryBlockWarfare2` / `SmallBlockBatteryBlockWarfare2` — Warfare
  Battery (Warfare 2 DLC): stat-identical reskins of the base batteries.

Flagged: the two **Warfare 2 SubtypeId strings** follow Keen's convention but
were not confirmed against a live `.sbc` this session — verify before relying on
them for blueprint matching.
